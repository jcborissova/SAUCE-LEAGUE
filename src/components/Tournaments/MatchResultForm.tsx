/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrophyIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import { supabase } from "../../lib/supabase";
import { saveMatchStats, syncMatchParticipantsFromCurrentTeams } from "../../services/tournamentAnalytics";
import type { MatchPlayerStatsInput } from "../../types/tournament-analytics";
import AppSelect from "../ui/AppSelect";

const STAT_FIELDS: Array<{ key: keyof Omit<MatchPlayerStatsInput, "playerId">; label: string }> = [
  { key: "points", label: "Pts" },
  { key: "rebounds", label: "Reb" },
  { key: "assists", label: "Ast" },
  { key: "steals", label: "Stl" },
  { key: "blocks", label: "Blk" },
  { key: "turnovers", label: "TO" },
  { key: "fouls", label: "Fls" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "tpm", label: "3PM" },
  { key: "tpa", label: "3PA" },
  { key: "ftm", label: "FTM" },
  { key: "fta", label: "FTA" },
];

type PlayerRow = {
  playerId: number;
  teamSide: "A" | "B";
  teamName: string;
  names: string;
  lastnames: string;
};

type Props = {
  matchId: number;
  onClose: () => void;
  onSaved?: () => void;
};

type StatsLine = Omit<MatchPlayerStatsInput, "playerId">;
type SupabaseQueryError = { code?: string; message: string } | null;
type SupabaseQueryResult<T> = { data: T | null; error: SupabaseQueryError };
type MatchResultDraft = {
  version: number;
  matchId: number;
  winnerTeam: string;
  teams: { A: string; B: string };
  players: PlayerRow[];
  stats: Record<string, StatsLine>;
  playedByPlayer: Record<string, boolean>;
  updatedAt: string;
};

const DRAFT_VERSION = 1;
const DRAFT_STORAGE_PREFIX = "sauce:match-result-draft";
const PLAYER_QUERY_CHUNK = 200;
const QUERY_MAX_ATTEMPTS = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryDelay = (attempt: number) => {
  const base = Math.min(900, 180 * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 90);
  return base + jitter;
};

const toStringSafe = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toNonNegativeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const emptyLine = (): StatsLine => ({
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0,
});

const sanitizeStatsLine = (line: unknown): StatsLine => {
  const source = typeof line === "object" && line !== null ? (line as Partial<StatsLine>) : {};

  return {
    points: toNonNegativeInt(source.points),
    rebounds: toNonNegativeInt(source.rebounds),
    assists: toNonNegativeInt(source.assists),
    steals: toNonNegativeInt(source.steals),
    blocks: toNonNegativeInt(source.blocks),
    turnovers: toNonNegativeInt(source.turnovers),
    fouls: toNonNegativeInt(source.fouls),
    fgm: toNonNegativeInt(source.fgm),
    fga: toNonNegativeInt(source.fga),
    tpm: toNonNegativeInt(source.tpm),
    tpa: toNonNegativeInt(source.tpa),
    ftm: toNonNegativeInt(source.ftm),
    fta: toNonNegativeInt(source.fta),
  };
};

const SHOT_RELATED_FIELDS: Array<keyof StatsLine> = ["fgm", "fga", "tpm", "tpa", "ftm", "fta"];

const isShotRelatedField = (key: keyof StatsLine): boolean => SHOT_RELATED_FIELDS.includes(key);

const computePointsFromShooting = (line: StatsLine): number =>
  Math.max(0, 2 * toNonNegativeInt(line.fgm) + toNonNegativeInt(line.tpm) + toNonNegativeInt(line.ftm));

const enforceStatsConsistency = (line: StatsLine): StatsLine => {
  const next: StatsLine = {
    ...line,
    points: toNonNegativeInt(line.points),
    rebounds: toNonNegativeInt(line.rebounds),
    assists: toNonNegativeInt(line.assists),
    steals: toNonNegativeInt(line.steals),
    blocks: toNonNegativeInt(line.blocks),
    turnovers: toNonNegativeInt(line.turnovers),
    fouls: toNonNegativeInt(line.fouls),
    fgm: toNonNegativeInt(line.fgm),
    fga: toNonNegativeInt(line.fga),
    tpm: toNonNegativeInt(line.tpm),
    tpa: toNonNegativeInt(line.tpa),
    ftm: toNonNegativeInt(line.ftm),
    fta: toNonNegativeInt(line.fta),
  };

  if (next.fgm > next.fga) next.fgm = next.fga;
  if (next.tpa > next.fga) next.tpa = next.fga;
  if (next.tpm > next.tpa) next.tpm = next.tpa;
  if (next.tpm > next.fgm) next.tpm = next.fgm;
  if (next.ftm > next.fta) next.ftm = next.fta;

  return next;
};

const applySmartStatUpdate = (
  currentLine: StatsLine,
  key: keyof StatsLine,
  rawValue: number
): StatsLine => {
  const next: StatsLine = {
    ...currentLine,
    [key]: toNonNegativeInt(rawValue),
  };

  if (key === "tpa") {
    if (next.tpa > next.fga) next.fga = next.tpa;
  } else if (key === "tpm") {
    if (next.tpm > next.tpa) next.tpa = next.tpm;
    if (next.tpm > next.fgm) next.fgm = next.tpm;
    if (next.tpa > next.fga) next.fga = next.tpa;
    if (next.fgm > next.fga) next.fga = next.fgm;
  } else if (key === "fgm") {
    if (next.fgm > next.fga) next.fga = next.fgm;
  } else if (key === "ftm") {
    if (next.ftm > next.fta) next.fta = next.ftm;
  }

  const normalized = enforceStatsConsistency(next);
  if (isShotRelatedField(key)) {
    normalized.points = computePointsFromShooting(normalized);
  }

  return normalized;
};

const normalizeDraftPlayer = (value: unknown): PlayerRow | null => {
  if (typeof value !== "object" || value === null) return null;

  const player = value as Partial<PlayerRow>;
  const playerId = Number(player.playerId);
  if (!Number.isFinite(playerId) || playerId <= 0) return null;

  const side = player.teamSide === "A" || player.teamSide === "B" ? player.teamSide : null;
  if (!side) return null;

  return {
    playerId,
    teamSide: side,
    teamName: toStringSafe(player.teamName),
    names: toStringSafe(player.names),
    lastnames: toStringSafe(player.lastnames),
  };
};

const isRetryableSupabaseError = (error: SupabaseQueryError): boolean => {
  if (!error) return false;

  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "57014" ||
    message.includes("statement timeout") ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("timeout")
  );
};

const isRetryableRuntimeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("failed to fetch") || message.includes("network") || message.includes("timeout");
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0 || items.length === 0) return [items];
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

const runQueryWithRetry = async <T,>(
  queryFactory: () => PromiseLike<SupabaseQueryResult<T>>,
  maxAttempts = QUERY_MAX_ATTEMPTS
): Promise<SupabaseQueryResult<T>> => {
  let lastResult: SupabaseQueryResult<T> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await queryFactory();
      lastResult = result;

      if (!result.error) {
        return result;
      }

      const shouldRetry = attempt < maxAttempts && isRetryableSupabaseError(result.error);
      if (!shouldRetry) {
        return result;
      }

      await wait(retryDelay(attempt));
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isRetryableRuntimeError(error);
      if (!shouldRetry) {
        throw error;
      }

      await wait(retryDelay(attempt));
    }
  }

  return (
    lastResult ?? {
      data: null,
      error: { message: "No se pudo completar la consulta." },
    }
  );
};

const draftStorageKey = (matchId: number) => `${DRAFT_STORAGE_PREFIX}:v${DRAFT_VERSION}:${matchId}`;

const readMatchResultDraft = (matchId: number): MatchResultDraft | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(draftStorageKey(matchId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MatchResultDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    if (Number(parsed.version) !== DRAFT_VERSION) return null;
    if (Number(parsed.matchId) !== matchId) return null;

    const players = Array.isArray(parsed.players)
      ? parsed.players.map((player) => normalizeDraftPlayer(player)).filter((player): player is PlayerRow => Boolean(player))
      : [];

    const rawStats = typeof parsed.stats === "object" && parsed.stats !== null ? parsed.stats : {};
    const stats: Record<string, StatsLine> = {};
    Object.entries(rawStats).forEach(([playerId, line]) => {
      stats[String(playerId)] = sanitizeStatsLine(line);
    });

    const rawPlayed =
      typeof parsed.playedByPlayer === "object" && parsed.playedByPlayer !== null ? parsed.playedByPlayer : {};
    const playedByPlayer: Record<string, boolean> = {};
    Object.entries(rawPlayed).forEach(([playerId, played]) => {
      playedByPlayer[String(playerId)] = Boolean(played);
    });

    return {
      version: DRAFT_VERSION,
      matchId,
      winnerTeam: toStringSafe(parsed.winnerTeam),
      teams: {
        A: toStringSafe(parsed.teams?.A),
        B: toStringSafe(parsed.teams?.B),
      },
      players,
      stats,
      playedByPlayer,
      updatedAt: toStringSafe(parsed.updatedAt),
    };
  } catch {
    return null;
  }
};

const writeMatchResultDraft = (matchId: number, draft: MatchResultDraft) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(draftStorageKey(matchId), JSON.stringify(draft));
  } catch {
    // Ignora errores de cuota o almacenamiento restringido.
  }
};

const clearMatchResultDraft = (matchId: number) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(draftStorageKey(matchId));
  } catch {
    // Ignora errores de almacenamiento restringido.
  }
};

const formatDraftTime = (value: string | null): string => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "hace un momento";
  }

  return parsed.toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const MatchResultForm: React.FC<Props> = ({ matchId, onClose, onSaved }) => {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<{ A: string; B: string }>({ A: "", B: "" });
  const [winnerTeam, setWinnerTeam] = useState("");
  const [stats, setStats] = useState<Record<number, StatsLine>>({});
  const [playedByPlayer, setPlayedByPlayer] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const loadRequestRef = useRef(0);

  const persistDraft = useCallback(() => {
    if (!draftReady || players.length === 0) return;

    const statsSnapshot: Record<string, StatsLine> = {};
    const playedSnapshot: Record<string, boolean> = {};

    players.forEach((player) => {
      const key = String(player.playerId);
      statsSnapshot[key] = sanitizeStatsLine(stats[player.playerId] ?? emptyLine());
      playedSnapshot[key] = Boolean(playedByPlayer[player.playerId]);
    });

    const nowIso = new Date().toISOString();
    const payload: MatchResultDraft = {
      version: DRAFT_VERSION,
      matchId,
      winnerTeam: toStringSafe(winnerTeam),
      teams: {
        A: toStringSafe(teams.A),
        B: toStringSafe(teams.B),
      },
      players: players.map((player) => ({
        playerId: player.playerId,
        teamSide: player.teamSide,
        teamName: toStringSafe(player.teamName),
        names: toStringSafe(player.names),
        lastnames: toStringSafe(player.lastnames),
      })),
      stats: statsSnapshot,
      playedByPlayer: playedSnapshot,
      updatedAt: nowIso,
    };

    writeMatchResultDraft(matchId, payload);
    setDraftSavedAt(nowIso);
  }, [draftReady, matchId, playedByPlayer, players, stats, teams.A, teams.B, winnerTeam]);

  const loadData = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setDraftReady(false);

    const localDraft = readMatchResultDraft(matchId);

    try {
      const matchResult = await runQueryWithRetry<{
        id: number;
        tournament_id: string | null;
        team_a: string | null;
        team_b: string | null;
        winner_team: string | null;
      }>(() =>
        supabase
          .from("matches")
          .select("id, tournament_id, team_a, team_b, winner_team")
          .eq("id", matchId)
          .single()
      );

      if (matchResult.error || !matchResult.data) {
        throw new Error(matchResult.error?.message ?? "No se encontró el partido.");
      }

      const match = matchResult.data;

      const resolvedTeams = {
        A: toStringSafe(match.team_a) || "Equipo A",
        B: toStringSafe(match.team_b) || "Equipo B",
      };

      const tournamentId = toStringSafe(match.tournament_id);
      const syncPromise = tournamentId
        ? syncMatchParticipantsFromCurrentTeams({
            matchId,
            tournamentId,
            teamA: match.team_a ?? null,
            teamB: match.team_b ?? null,
          }).catch((error) => {
            console.warn("No se pudo sincronizar match_players al cargar resultados.", error);
          })
        : Promise.resolve();

      type MatchParticipantRow = { player_id: number; team: "A" | "B" | null; played: boolean | null };

      const fetchParticipants = async (): Promise<MatchParticipantRow[]> => {
        const participantsWithPlayedResult = await runQueryWithRetry<MatchParticipantRow[]>(() =>
          supabase
            .from("match_players")
            .select("player_id, team, played")
            .eq("match_id", matchId)
            .order("team", { ascending: true })
        );

        if (!participantsWithPlayedResult.error) {
          return (participantsWithPlayedResult.data ?? []) as MatchParticipantRow[];
        }

        const legacyParticipantsResult = await runQueryWithRetry<Array<{ player_id: number; team: "A" | "B" | null }>>(() =>
          supabase
            .from("match_players")
            .select("player_id, team")
            .eq("match_id", matchId)
            .order("team", { ascending: true })
        );

        if (legacyParticipantsResult.error) {
          throw new Error(legacyParticipantsResult.error.message);
        }

        return ((legacyParticipantsResult.data ?? []) as Array<{ player_id: number; team: "A" | "B" | null }>).map((row) => ({
          ...row,
          played: null,
        }));
      };

      let participantRows: MatchParticipantRow[] = [];

      try {
        participantRows = await fetchParticipants();
      } catch (error) {
        console.warn("Fallo inicial cargando match_players, se intentará sincronizar y reintentar.", error);
      }

      if (participantRows.length === 0) {
        await syncPromise;

        try {
          participantRows = await fetchParticipants();
        } catch (error) {
          console.warn("No se pudo recargar match_players luego de sincronizar.", error);
        }
      } else {
        await syncPromise;
      }

      const draftPlayers = localDraft?.players ?? [];
      let parsedParticipants: PlayerRow[] = participantRows
        .filter((row) => row.team === "A" || row.team === "B")
        .map((row) => ({
          playerId: Number(row.player_id),
          teamSide: row.team as "A" | "B",
          teamName: row.team === "A" ? resolvedTeams.A : resolvedTeams.B,
          names: "",
          lastnames: "",
        }))
        .filter((row) => Number.isFinite(row.playerId) && row.playerId > 0);

      if (parsedParticipants.length === 0 && draftPlayers.length > 0) {
        parsedParticipants = draftPlayers.map((player) => ({
          playerId: player.playerId,
          teamSide: player.teamSide,
          teamName: player.teamSide === "A" ? resolvedTeams.A : resolvedTeams.B,
          names: player.names,
          lastnames: player.lastnames,
        }));
      }

      if (parsedParticipants.length === 0) {
        throw new Error("Este partido no tiene participantes asignados en match_players.");
      }

      const playerNamesById = new Map<number, { names: string; lastnames: string }>();

      draftPlayers.forEach((player) => {
        playerNamesById.set(player.playerId, {
          names: toStringSafe(player.names),
          lastnames: toStringSafe(player.lastnames),
        });
      });

      const participantIds = Array.from(new Set(parsedParticipants.map((player) => player.playerId)));

      for (const idChunk of chunkArray(participantIds, PLAYER_QUERY_CHUNK)) {
        const playersResult = await runQueryWithRetry<Array<{ id: number; names: string | null; lastnames: string | null }>>(() =>
          supabase
            .from("players")
            .select("id, names, lastnames")
            .in("id", idChunk)
        );

        if (playersResult.error) {
          console.warn("No se pudo cargar un bloque de jugadores para el resultado.", playersResult.error.message);
          continue;
        }

        (playersResult.data ?? []).forEach((row) => {
          const playerId = Number(row.id);
          if (!Number.isFinite(playerId) || playerId <= 0) return;

          playerNamesById.set(playerId, {
            names: toStringSafe(row.names),
            lastnames: toStringSafe(row.lastnames),
          });
        });
      }

      parsedParticipants = parsedParticipants.map((player) => {
        const info = playerNamesById.get(player.playerId);

        const names = info?.names ?? toStringSafe(player.names);
        const lastnames = info?.lastnames ?? toStringSafe(player.lastnames);

        if (names || lastnames) {
          return {
            ...player,
            names,
            lastnames,
          };
        }

        return {
          ...player,
          names: "Jugador",
          lastnames: String(player.playerId),
        };
      });

      let existingRows: Array<Record<string, number>> = [];

      const fullStatsResult = await runQueryWithRetry<Array<Record<string, number>>>(() =>
        supabase
          .from("player_stats")
          .select("player_id, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa")
          .eq("match_id", matchId)
      );

      if (!fullStatsResult.error) {
        existingRows = (fullStatsResult.data ?? []) as Array<Record<string, number>>;
      } else {
        const legacyStatsResult = await runQueryWithRetry<Array<Record<string, number>>>(() =>
          supabase
            .from("player_stats")
            .select("player_id, points, rebounds, assists")
            .eq("match_id", matchId)
        );

        if (legacyStatsResult.error) {
          throw new Error(legacyStatsResult.error.message);
        }

        existingRows = (legacyStatsResult.data ?? []).map((row) => ({
          ...row,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          fgm: 0,
          fga: 0,
          ftm: 0,
          fta: 0,
          tpm: 0,
          tpa: 0,
        })) as Array<Record<string, number>>;
      }

      const existingByPlayerId = new Map<number, Record<string, number>>();
      existingRows.forEach((row) => {
        const playerId = Number(row.player_id);
        if (Number.isFinite(playerId) && playerId > 0) {
          existingByPlayerId.set(playerId, row);
        }
      });

      const persistedPlayedByPlayerId = new Map<number, boolean>();
      participantRows.forEach((row) => {
        const playerId = Number(row.player_id);
        if (!Number.isFinite(playerId) || playerId <= 0) return;
        if (typeof row.played !== "boolean") return;
        persistedPlayedByPlayerId.set(playerId, row.played);
      });

      const initialStats: Record<number, StatsLine> = {};
      const initialPlayed: Record<number, boolean> = {};
      const hasPersistedRows = existingRows.length > 0;

      parsedParticipants.forEach((player) => {
        const existing = existingByPlayerId.get(player.playerId);

        initialStats[player.playerId] = {
          points: toNonNegativeInt(existing?.points),
          rebounds: toNonNegativeInt(existing?.rebounds),
          assists: toNonNegativeInt(existing?.assists),
          steals: toNonNegativeInt(existing?.steals),
          blocks: toNonNegativeInt(existing?.blocks),
          turnovers: toNonNegativeInt(existing?.turnovers),
          fouls: toNonNegativeInt(existing?.fouls),
          fgm: toNonNegativeInt(existing?.fgm),
          fga: toNonNegativeInt(existing?.fga),
          ftm: toNonNegativeInt(existing?.ftm),
          fta: toNonNegativeInt(existing?.fta),
          tpm: toNonNegativeInt(existing?.tpm),
          tpa: toNonNegativeInt(existing?.tpa),
        };

        if (persistedPlayedByPlayerId.has(player.playerId)) {
          initialPlayed[player.playerId] = Boolean(persistedPlayedByPlayerId.get(player.playerId));
        } else {
          initialPlayed[player.playerId] = hasPersistedRows ? Boolean(existing) : true;
        }
      });

      const mergedStats: Record<number, StatsLine> = { ...initialStats };
      const mergedPlayed: Record<number, boolean> = { ...initialPlayed };
      let mergedWinner = toStringSafe(match.winner_team);

      if (localDraft) {
        parsedParticipants.forEach((player) => {
          const key = String(player.playerId);
          const draftLine = localDraft.stats[key];
          if (draftLine) {
            mergedStats[player.playerId] = sanitizeStatsLine(draftLine);
          }

          const draftPlayed = localDraft.playedByPlayer[key];
          if (typeof draftPlayed === "boolean") {
            mergedPlayed[player.playerId] = draftPlayed;
          }
        });

        const draftWinner = toStringSafe(localDraft.winnerTeam);
        if (draftWinner && (draftWinner === resolvedTeams.A || draftWinner === resolvedTeams.B)) {
          mergedWinner = draftWinner;
        }
      }

      if (loadRequestRef.current !== requestId) return;

      setTeams(resolvedTeams);
      setWinnerTeam(mergedWinner);
      setPlayers(parsedParticipants);
      setStats(mergedStats);
      setPlayedByPlayer(mergedPlayed);
      setDraftSavedAt(localDraft?.updatedAt ?? null);
      setDraftReady(true);

      if (localDraft && localDraft.players.length > 0) {
        if (participantRows.length === 0) {
          setInfoMessage("No hubo respuesta estable del servidor para participantes; se usó tu draft local.");
        } else {
          setInfoMessage("Borrador local restaurado automáticamente.");
        }
      }
    } catch (error) {
      if (loadRequestRef.current !== requestId) return;

      if (localDraft && localDraft.players.length > 0) {
        const fallbackTeams = {
          A: toStringSafe(localDraft.teams.A) || "Equipo A",
          B: toStringSafe(localDraft.teams.B) || "Equipo B",
        };

        const fallbackStats: Record<number, StatsLine> = {};
        const fallbackPlayed: Record<number, boolean> = {};

        localDraft.players.forEach((player) => {
          fallbackStats[player.playerId] = sanitizeStatsLine(localDraft.stats[String(player.playerId)] ?? emptyLine());
          fallbackPlayed[player.playerId] = Boolean(localDraft.playedByPlayer[String(player.playerId)]);
        });

        const fallbackWinner = toStringSafe(localDraft.winnerTeam);

        setTeams(fallbackTeams);
        setPlayers(localDraft.players);
        setStats(fallbackStats);
        setPlayedByPlayer(fallbackPlayed);
        setWinnerTeam(
          fallbackWinner && (fallbackWinner === fallbackTeams.A || fallbackWinner === fallbackTeams.B)
            ? fallbackWinner
            : ""
        );
        setDraftSavedAt(localDraft.updatedAt || null);
        setDraftReady(true);
        setInfoMessage("No se pudo cargar el partido desde servidor. Se abrió el draft local para que no pierdas avances.");
        setErrorMessage(null);
      } else {
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el partido.");
      }
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [matchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!draftReady || loading || players.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      persistDraft();
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftReady, loading, persistDraft, playedByPlayer, players, stats, winnerTeam]);

  const groupedTeams = useMemo(
    () => ({
      A: players.filter((player) => player.teamSide === "A"),
      B: players.filter((player) => player.teamSide === "B"),
    }),
    [players]
  );

  const pointsTotals = useMemo(() => {
    let teamA = 0;
    let teamB = 0;

    players.forEach((player) => {
      if (!playedByPlayer[player.playerId]) return;

      const points = toNonNegativeInt(stats[player.playerId]?.points ?? 0);
      if (player.teamSide === "A") {
        teamA += points;
      } else {
        teamB += points;
      }
    });

    return {
      teamA,
      teamB,
      total: teamA + teamB,
    };
  }, [playedByPlayer, players, stats]);

  const setValue = (playerId: number, key: keyof StatsLine, value: string) => {
    const parsed = Number(value || 0);
    const resolvedValue = Number.isFinite(parsed) ? parsed : 0;

    setErrorMessage(null);
    setStats((prev) => {
      const currentLine = prev[playerId] ?? emptyLine();
      const nextLine = applySmartStatUpdate(currentLine, key, resolvedValue);

      return {
        ...prev,
        [playerId]: nextLine,
      };
    });
  };

  const setPlayed = (playerId: number, checked: boolean) => {
    setPlayedByPlayer((prev) => ({
      ...prev,
      [playerId]: checked,
    }));
  };

  const handleClose = () => {
    persistDraft();
    onClose();
  };

  const handleSubmit = async () => {
    if (!winnerTeam) {
      setErrorMessage("Selecciona el equipo ganador.");
      return;
    }

    const lines: MatchPlayerStatsInput[] = players
      .filter((player) => Boolean(playedByPlayer[player.playerId]))
      .map((player) => {
        const rawLine = stats[player.playerId] ?? emptyLine();
        const normalized = enforceStatsConsistency(rawLine);
        const pointsByShots = computePointsFromShooting(normalized);
        const hasShootingData =
          normalized.fga > 0 ||
          normalized.fgm > 0 ||
          normalized.tpa > 0 ||
          normalized.tpm > 0 ||
          normalized.fta > 0 ||
          normalized.ftm > 0;

        return {
          playerId: player.playerId,
          ...normalized,
          points: hasShootingData ? pointsByShots : normalized.points,
        };
      });

    for (const line of lines) {
      if (line.fgm > line.fga) {
        setErrorMessage(`FGM no puede ser mayor que FGA para ${line.playerId}.`);
        return;
      }
      if (line.ftm > line.fta) {
        setErrorMessage(`FTM no puede ser mayor que FTA para ${line.playerId}.`);
        return;
      }
      if (line.tpm > line.tpa) {
        setErrorMessage(`3PM no puede ser mayor que 3PA para ${line.playerId}.`);
        return;
      }
      if (line.tpa > line.fga) {
        setErrorMessage(`3PA no puede ser mayor que FGA para ${line.playerId}.`);
        return;
      }
      if (line.tpm > line.fgm) {
        setErrorMessage(`3PM no puede ser mayor que FGM para ${line.playerId}.`);
        return;
      }
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await saveMatchStats({ matchId, winnerTeam, playerStats: lines });
      clearMatchResultDraft(matchId);
      setDraftSavedAt(null);
      onSaved?.();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron guardar los resultados.");
    } finally {
      setSaving(false);
    }
  };

  const draftStatusText = useMemo(() => {
    if (!draftSavedAt) {
      return "Draft local automático activo.";
    }

    return `Draft guardado a las ${formatDraftTime(draftSavedAt)}.`;
  }, [draftSavedAt]);

  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <TrophyIcon className="h-5 w-5 text-[hsl(var(--warning))]" />
            Resultado del partido
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] sm:text-sm">Carga stats por jugador y define el ganador.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center border"
          onClick={handleClose}
          aria-label="Cerrar editor"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="soft-scrollbar max-h-[70vh] overflow-y-auto space-y-4 px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          </div>
        ) : (
          <>
            {errorMessage ? (
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </div>
            ) : null}

            {infoMessage ? (
              <div className="border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] px-3 py-2 text-xs text-[hsl(var(--foreground))]">
                {infoMessage}
              </div>
            ) : null}

            <label className="block border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm">
              <span className="mb-1 block font-medium">Equipo ganador</span>
              <AppSelect value={winnerTeam} onChange={(event) => setWinnerTeam(event.target.value)} className="input-base">
                <option value="">Seleccionar</option>
                <option value={teams.A}>{teams.A}</option>
                <option value={teams.B}>{teams.B}</option>
              </AppSelect>
            </label>

            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Marca si el jugador participó. Solo los jugadores marcados como "Jugó" cuentan para promedios (PPP/RPP/APP) y totales.
            </p>
            <p className="text-xs text-[hsl(var(--text-subtle))]">
              Reglas automáticas activas: 3PA sube FGA si hace falta, 3PM ajusta FGM/3PA, FTM ajusta FTA y los puntos se sincronizan con los tiros cargados.
            </p>

            <p className="text-xs text-[hsl(var(--muted-foreground))]">{draftStatusText}</p>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="border bg-[hsl(var(--surface-1))] px-3 py-2">
                <p className="text-[hsl(var(--muted-foreground))]">{teams.A || "Equipo A"}</p>
                <p className="text-sm font-semibold">{pointsTotals.teamA} pts</p>
              </div>
              <div className="border bg-[hsl(var(--surface-1))] px-3 py-2">
                <p className="text-[hsl(var(--muted-foreground))]">{teams.B || "Equipo B"}</p>
                <p className="text-sm font-semibold">{pointsTotals.teamB} pts</p>
              </div>
              <div className="border bg-[hsl(var(--surface-1))] px-3 py-2">
                <p className="text-[hsl(var(--muted-foreground))]">Total partido</p>
                <p className="text-sm font-semibold">{pointsTotals.total} pts</p>
              </div>
            </div>

            {(["A", "B"] as const).map((side) => (
              <section key={side} className="space-y-3 border bg-[hsl(var(--surface-1))] p-3 sm:p-4">
                <h3 className="text-base font-semibold sm:text-lg">{teams[side]}</h3>

                <div className="space-y-3 md:hidden">
                  {groupedTeams[side].map((player) => (
                    <article key={player.playerId} className="border bg-[hsl(var(--surface-2))] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {player.names} {player.lastnames}
                        </p>
                        <label className="inline-flex items-center gap-1 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={Boolean(playedByPlayer[player.playerId])}
                            onChange={(event) => setPlayed(player.playerId, event.target.checked)}
                          />
                          Jugó
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {STAT_FIELDS.map((field) => (
                          <label key={`${player.playerId}-${field.key}`} className="space-y-1 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))]">{field.label}</span>
                            <input
                              type="number"
                              min={0}
                              value={stats[player.playerId]?.[field.key] ?? 0}
                              onChange={(event) => setValue(player.playerId, field.key, event.target.value)}
                              disabled={!playedByPlayer[player.playerId]}
                              className={`input-base h-9 min-h-0 px-2 py-1 text-center ${
                                !playedByPlayer[player.playerId] ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            />
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto border md:block">
                  <table className="w-full min-w-[1240px] text-sm">
                    <thead>
                      <tr className="bg-[hsl(var(--muted))]">
                        <th className="px-2 py-2 text-left">Jugador</th>
                        <th className="px-2 py-2 text-center">Jugó</th>
                        {STAT_FIELDS.map((field) => (
                          <th key={field.key} className="px-2 py-2 text-center">
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedTeams[side].map((player) => (
                        <tr key={player.playerId} className="border-t border-[hsl(var(--border))]">
                          <td className="px-2 py-2 whitespace-nowrap font-medium">
                            {player.names} {player.lastnames}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(playedByPlayer[player.playerId])}
                              onChange={(event) => setPlayed(player.playerId, event.target.checked)}
                            />
                          </td>
                          {STAT_FIELDS.map((field) => (
                            <td key={`${player.playerId}-${field.key}`} className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                value={stats[player.playerId]?.[field.key] ?? 0}
                                onChange={(event) => setValue(player.playerId, field.key, event.target.value)}
                                disabled={!playedByPlayer[player.playerId]}
                                className={`input-base h-9 min-h-0 w-16 px-2 py-1 text-center ${
                                  !playedByPlayer[player.playerId] ? "cursor-not-allowed opacity-60" : ""
                                }`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-3 sm:px-6">
        <button type="button" onClick={handleClose} className="btn-secondary">
          Cerrar editor
        </button>
        <button type="button" disabled={saving || loading} onClick={handleSubmit} className="btn-primary disabled:opacity-60">
          {saving ? "Guardando..." : "Guardar resultado"}
        </button>
      </div>
    </section>
  );
};

export default MatchResultForm;
