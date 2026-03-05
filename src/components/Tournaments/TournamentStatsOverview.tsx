import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, EyeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon, BoltIcon, FireIcon } from "@heroicons/react/24/solid";

import {
  getAnalyticsDashboardKpis,
  getBattleData,
  getLeaders,
  getMvpRaceFast,
  getTournamentPlayerDetailFast,
  getTournamentPlayerLinesFast,
  listTournamentPlayers,
} from "../../services/tournamentAnalytics";
import type {
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  TournamentAnalyticsKpi,
  TournamentLeaderRow,
  TournamentPhaseFilter,
  MvpBreakdownRow,
} from "../../types/tournament-analytics";
import { abbreviateLeaderboardName, getPlayerInitials } from "../../utils/player-display";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import LoadingSpinner from "../LoadingSpinner";
import AppSelect from "../ui/AppSelect";
import PlayerAnalyticsModal, { type PlayerAnalyticsDetail } from "./analytics/PlayerAnalyticsModal";

type StatsFocus =
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "pra"
  | "defensive"
  | "mvp"
  | "duel";
type PerGameMetricKey = "ppg" | "rpg" | "apg" | "spg" | "bpg";

type FullLeaderItem = {
  playerId: number;
  name: string;
  photo?: string | null;
  teamName: string | null;
  valuePrimaryText: string;
  valueSecondaryText?: string;
  helperText: string;
};

const PHASE_OPTIONS: Array<{ value: TournamentPhaseFilter; label: string }> = [
  { value: "regular", label: "Temporada regular" },
  { value: "playoffs", label: "Playoffs" },
  { value: "all", label: "Todas las fases" },
];

const FOCUS_OPTIONS: Array<{ value: Exclude<StatsFocus, "duel">; label: string }> = [
  { value: "points", label: "Puntos" },
  { value: "rebounds", label: "Rebotes" },
  { value: "assists", label: "Asistencias" },
  { value: "steals", label: "Robos" },
  { value: "blocks", label: "Tapones" },
  { value: "pra", label: "PRA" },
  { value: "defensive", label: "Líder defensivo" },
  { value: "mvp", label: "MVP" },
];

const focusMeta: Record<
  Exclude<StatsFocus, "mvp" | "duel" | "defensive" | "pra">,
  {
    title: string;
    tabLabel: string;
    metricLabel: string;
    metric: "points" | "rebounds" | "assists" | "steals" | "blocks";
    perGameKey: PerGameMetricKey;
    totalKey: "points" | "rebounds" | "assists" | "steals" | "blocks";
  }
> = {
  points: {
    title: "Líderes de puntos",
    tabLabel: "Puntos",
    metricLabel: "PPP",
    metric: "points",
    perGameKey: "ppg",
    totalKey: "points",
  },
  rebounds: {
    title: "Líderes de rebotes",
    tabLabel: "Rebotes",
    metricLabel: "RPP",
    metric: "rebounds",
    perGameKey: "rpg",
    totalKey: "rebounds",
  },
  assists: {
    title: "Líderes de asistencias",
    tabLabel: "Asistencias",
    metricLabel: "APP",
    metric: "assists",
    perGameKey: "apg",
    totalKey: "assists",
  },
  steals: {
    title: "Líderes de robos",
    tabLabel: "Robos",
    metricLabel: "SPG",
    metric: "steals",
    perGameKey: "spg",
    totalKey: "steals",
  },
  blocks: {
    title: "Líderes de tapones",
    tabLabel: "Tapones",
    metricLabel: "BPG",
    metric: "blocks",
    perGameKey: "bpg",
    totalKey: "blocks",
  },
};

type DuelPlayerOption = {
  playerId: number;
  name: string;
  photo: string | null;
  teamName: string | null;
};

type DuelResult = {
  players: BattlePlayerResult[];
  summary: BattleSummary;
};

type DuelMetricMeta = {
  label: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const DUEL_UNASSIGNED_TEAM = "__duel_unassigned_team__";

const getDuelTeamKey = (teamName: string | null | undefined): string => {
  const normalized = (teamName ?? "").trim();
  return normalized.length > 0 ? normalized : DUEL_UNASSIGNED_TEAM;
};

const getDuelTeamLabel = (teamKey: string): string =>
  teamKey === DUEL_UNASSIGNED_TEAM ? "Sin equipo" : teamKey;

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const phaseLabel = (phase: TournamentPhaseFilter): string => {
  if (phase === "regular") return "Temporada regular";
  if (phase === "playoffs") return "Playoffs";
  return "Todas las fases";
};

const DUEL_METRICS: BattleMetric[] = [
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "pra",
  "fg_pct",
  "topg",
];

const DUEL_METRIC_META: Record<BattleMetric, DuelMetricMeta> = {
  ppg: {
    label: "PPP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  rpg: {
    label: "RPP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  apg: {
    label: "APP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  spg: {
    label: "ROB",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  bpg: {
    label: "BLK",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  pra: {
    label: "PRA",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  fg_pct: {
    label: "FG%",
    higherIsBetter: true,
    format: (value) => `${value.toFixed(1)}%`,
  },
  topg: {
    label: "PÉRD",
    higherIsBetter: false,
    format: (value) => value.toFixed(1),
  },
};

const getDuelRatio = (
  leftValue: number,
  rightValue: number,
  higherIsBetter: boolean
): { leftRatio: number; rightRatio: number } => {
  if (higherIsBetter) {
    const leftScore = Math.max(0, leftValue);
    const rightScore = Math.max(0, rightValue);
    const total = leftScore + rightScore;
    if (total === 0) return { leftRatio: 50, rightRatio: 50 };
    return { leftRatio: (leftScore / total) * 100, rightRatio: (rightScore / total) * 100 };
  }

  const epsilon = 0.25;
  const leftScore = 1 / (Math.max(0, leftValue) + epsilon);
  const rightScore = 1 / (Math.max(0, rightValue) + epsilon);
  const total = leftScore + rightScore;
  if (total === 0) return { leftRatio: 50, rightRatio: 50 };
  return { leftRatio: (leftScore / total) * 100, rightRatio: (rightScore / total) * 100 };
};

const TournamentStatsOverview: React.FC<{ tournamentId: string; embedded?: boolean; mode?: "default" | "duel" }> = ({
  tournamentId,
  embedded = false,
  mode = "default",
}) => {
  const isDuelMode = mode === "duel";
  const [phase, setPhase] = useState<TournamentPhaseFilter>("regular");
  const [focus, setFocus] = useState<StatsFocus>(isDuelMode ? "duel" : "points");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<TournamentAnalyticsKpi[]>([]);
  const [pointsLeaders, setPointsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [reboundsLeaders, setReboundsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [assistsLeaders, setAssistsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [stealsLeaders, setStealsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [blocksLeaders, setBlocksLeaders] = useState<TournamentLeaderRow[]>([]);
  const [defensiveLeaders, setDefensiveLeaders] = useState<TournamentLeaderRow[]>([]);
  const [praLeaders, setPraLeaders] = useState<TournamentLeaderRow[]>([]);
  const [mvpRows, setMvpRows] = useState<MvpBreakdownRow[]>([]);

  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [fullLeadersLoading, setFullLeadersLoading] = useState(false);
  const [fullLeadersError, setFullLeadersError] = useState<string | null>(null);
  const [fullLeadersRows, setFullLeadersRows] = useState<TournamentLeaderRow[]>([]);
  const [fullLeadersKey, setFullLeadersKey] = useState<string | null>(null);
  const [playerDirectoryOpen, setPlayerDirectoryOpen] = useState(false);
  const [playerDirectoryLoading, setPlayerDirectoryLoading] = useState(false);
  const [playerDirectoryError, setPlayerDirectoryError] = useState<string | null>(null);
  const [playerDirectoryRows, setPlayerDirectoryRows] = useState<DuelPlayerOption[]>([]);
  const [playerDirectoryQuery, setPlayerDirectoryQuery] = useState("");

  const [duelPlayers, setDuelPlayers] = useState<DuelPlayerOption[]>([]);
  const [duelPlayersLoading, setDuelPlayersLoading] = useState(false);
  const [duelLoading, setDuelLoading] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);
  const [duelTeamA, setDuelTeamA] = useState<string>("");
  const [duelTeamB, setDuelTeamB] = useState<string>("");
  const [duelPlayerA, setDuelPlayerA] = useState<number | "">("");
  const [duelPlayerB, setDuelPlayerB] = useState<number | "">("");
  const [duelResult, setDuelResult] = useState<DuelResult | null>(null);
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [playerDetailLoading, setPlayerDetailLoading] = useState(false);
  const [playerDetailError, setPlayerDetailError] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerAnalyticsDetail | null>(null);
  const [lastSelectedPlayer, setLastSelectedPlayer] = useState<{
    playerId: number;
    phase: TournamentPhaseFilter;
  } | null>(null);

  const playerDetailCacheRef = useRef(new Map<string, PlayerAnalyticsDetail>());
  const playerDetailRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadKpis = async () => {
      try {
        const nextKpis = await getAnalyticsDashboardKpis(tournamentId);
        if (!cancelled) {
          setKpis(nextKpis);
        }
      } catch {
        if (!cancelled) {
          setKpis([]);
        }
      }
    };

    loadKpis();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    playerDetailCacheRef.current.clear();
    setPlayerDetail(null);
    setPlayerDetailError(null);
    setPlayerDetailOpen(false);
    setLastSelectedPlayer(null);
    setPlayerDirectoryOpen(false);
    setPlayerDirectoryRows([]);
    setPlayerDirectoryQuery("");
    setPlayerDirectoryError(null);
  }, [tournamentId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [points, rebounds, assists, steals, blocks, pra, defensive, mvp] = await Promise.all([
          getLeaders({ tournamentId, phase, metric: "points", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "rebounds", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "assists", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "steals", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "blocks", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "pra", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "defensive_impact", limit: 10 }),
          getMvpRaceFast({
            tournamentId,
            phase: phase === "all" ? "regular" : phase === "playoffs" ? "playoffs" : "regular",
          }),
        ]);

        if (cancelled) return;

        setPointsLeaders(points);
        setReboundsLeaders(rebounds);
        setAssistsLeaders(assists);
        setStealsLeaders(steals);
        setBlocksLeaders(blocks);
        setPraLeaders(pra);
        setDefensiveLeaders(defensive);
        setMvpRows(mvp);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las estadísticas.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tournamentId, phase]);

  useEffect(() => {
    if (!fullViewOpen && !playerDirectoryOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (playerDetailOpen) return;
      if (playerDirectoryOpen) {
        setPlayerDirectoryOpen(false);
        return;
      }
      if (fullViewOpen) {
        setFullViewOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [fullViewOpen, playerDirectoryOpen, playerDetailOpen]);

  useEffect(() => {
    if (isDuelMode) {
      if (focus !== "duel") setFocus("duel");
      return;
    }

    if (focus === "duel") setFocus("points");
  }, [focus, isDuelMode]);

  useEffect(() => {
    if (focus !== "duel") return;

    let cancelled = false;
    const loadDuelPlayers = async () => {
      setDuelPlayersLoading(true);
      setDuelError(null);

      try {
        const rows = await listTournamentPlayers(tournamentId, phase);
        if (cancelled) return;

        setDuelPlayers(rows);
        const availableIds = new Set(rows.map((player) => player.playerId));

        setDuelPlayerA((prev) => (typeof prev === "number" && availableIds.has(prev) ? prev : ""));
        setDuelPlayerB((prev) => (typeof prev === "number" && availableIds.has(prev) ? prev : ""));
        setDuelResult(null);
      } catch (err) {
        if (!cancelled) {
          setDuelPlayers([]);
          setDuelError(err instanceof Error ? err.message : "No se pudieron cargar jugadores para el duelo.");
        }
      } finally {
        if (!cancelled) setDuelPlayersLoading(false);
      }
    };

    loadDuelPlayers();

    return () => {
      cancelled = true;
    };
  }, [focus, tournamentId, phase]);

  useEffect(() => {
    if (!playerDirectoryOpen) return;

    let cancelled = false;
    const loadPlayerDirectory = async () => {
      setPlayerDirectoryLoading(true);
      setPlayerDirectoryError(null);

      try {
        const rows = await listTournamentPlayers(tournamentId, phase);
        if (!cancelled) {
          setPlayerDirectoryRows(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setPlayerDirectoryRows([]);
          setPlayerDirectoryError(err instanceof Error ? err.message : "No se pudo cargar el directorio de jugadores.");
        }
      } finally {
        if (!cancelled) {
          setPlayerDirectoryLoading(false);
        }
      }
    };

    loadPlayerDirectory();

    return () => {
      cancelled = true;
    };
  }, [playerDirectoryOpen, tournamentId, phase]);

  const hasContent = useMemo(
    () =>
      pointsLeaders.length > 0 ||
      reboundsLeaders.length > 0 ||
      assistsLeaders.length > 0 ||
      stealsLeaders.length > 0 ||
      blocksLeaders.length > 0 ||
      praLeaders.length > 0 ||
      defensiveLeaders.length > 0 ||
      mvpRows.length > 0,
    [
      pointsLeaders.length,
      reboundsLeaders.length,
      assistsLeaders.length,
      stealsLeaders.length,
      blocksLeaders.length,
      praLeaders.length,
      defensiveLeaders.length,
      mvpRows.length,
    ]
  );

  const previewRows = useMemo(() => {
    if (focus === "points") return pointsLeaders;
    if (focus === "rebounds") return reboundsLeaders;
    if (focus === "assists") return assistsLeaders;
    if (focus === "steals") return stealsLeaders;
    if (focus === "blocks") return blocksLeaders;
    if (focus === "pra") return praLeaders;
    if (focus === "defensive") return defensiveLeaders;
    return [];
  }, [focus, pointsLeaders, reboundsLeaders, assistsLeaders, stealsLeaders, blocksLeaders, praLeaders, defensiveLeaders]);

  const hasFocusContent = useMemo(() => {
    if (focus === "mvp") return mvpRows.length > 0;
    if (focus === "duel") return duelPlayers.length >= 2;
    return previewRows.length > 0;
  }, [focus, previewRows.length, mvpRows.length, duelPlayers.length]);

  const previewMvpRows = useMemo(() => mvpRows.slice(0, 10), [mvpRows]);

  const focusTitle = useMemo(() => {
    if (focus === "mvp") return "Carrera MVP";
    if (focus === "duel") return "Duelo 1v1";
    if (focus === "pra") return "Líderes de PRA";
    if (focus === "defensive") return "Líder defensivo";
    return focusMeta[focus].title;
  }, [focus]);

  const fullViewTitle = useMemo(() => {
    if (focus === "mvp") return "Ranking MVP completo";
    if (focus === "duel") return "Ranking completo";
    if (focus === "pra") return "Líderes de PRA (Ranking completo)";
    if (focus === "defensive") return "Líder defensivo (Ranking completo)";
    return `${focusMeta[focus].title} (Ranking completo)`;
  }, [focus]);

  const fullViewValueLabel = useMemo(() => {
    if (focus === "mvp") return "Score";
    if (focus === "duel") return "Valor";
    if (focus === "pra") return "PRA/PJ";
    if (focus === "defensive") return "D-Impact";
    return focusMeta[focus].metricLabel;
  }, [focus]);

  const fullViewSecondaryLabel = useMemo(() => {
    if (focus === "mvp" || focus === "duel") return undefined;
    if (focus === "pra") return "PRA Total";
    if (focus === "defensive") return "ROB/TAP";
    return "Total";
  }, [focus]);

  const fullViewInfoNote = useMemo(() => {
    if (focus === "pra") {
      return "PRA por partido = puntos + rebotes + asistencias - pérdidas. Ajusta el volumen ofensivo por el costo de perder posesiones.";
    }
    if (focus === "defensive") {
      return "D-Impact/PJ = (1.4 x ROB/PJ) + (1.8 x TAP/PJ) + (0.35 x REB/PJ) - (0.15 x FALTAS/PJ). Mide acciones defensivas directas y su consistencia.";
    }
    return undefined;
  }, [focus]);

  const openFullLeaders = async () => {
    setFullViewOpen(true);
    setFullLeadersError(null);

    if (focus === "mvp" || focus === "duel") return;

    const metric =
      focus === "defensive"
        ? "defensive_impact"
        : focus === "pra"
          ? "pra"
          : focusMeta[focus].metric;
    const nextKey = `${tournamentId}:${phase}:${metric}`;
    if (fullLeadersKey === nextKey && fullLeadersRows.length > 0) return;

    setFullLeadersLoading(true);
    setFullLeadersRows([]);

    try {
      const rows = await getLeaders({
        tournamentId,
        phase,
        metric,
        limit: 500,
      });
      setFullLeadersRows(rows);
      setFullLeadersKey(nextKey);
    } catch (err) {
      setFullLeadersError(err instanceof Error ? err.message : "No se pudo cargar el ranking completo.");
    } finally {
      setFullLeadersLoading(false);
    }
  };

  const retryFullLeaders = async () => {
    if (focus === "mvp" || focus === "duel") return;
    setFullLeadersKey(null);
    await openFullLeaders();
  };

  const fullRows = useMemo<FullLeaderItem[]>(() => {
    if (focus === "mvp") {
      return mvpRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        photo: row.photo ?? null,
        teamName: row.teamName,
        valuePrimaryText: row.finalScore.toFixed(3),
        helperText: `PJ ${row.gamesPlayed} · Elegible`,
      }));
    }

    if (focus === "duel") {
      return [];
    }

    if (focus === "pra") {
      return fullLeadersRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        photo: row.photo ?? null,
        teamName: row.teamName,
        valuePrimaryText: row.value.toFixed(1),
        valueSecondaryText: `${(
          row.totals.points + row.totals.rebounds + row.totals.assists - row.totals.turnovers
        ).toFixed(0)}`,
        helperText: `PJ ${row.gamesPlayed}`,
      }));
    }

    if (focus === "defensive") {
      return fullLeadersRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        photo: row.photo ?? null,
        teamName: row.teamName,
        valuePrimaryText: row.value.toFixed(2),
        valueSecondaryText: `ROB ${row.perGame.spg.toFixed(1)} · TAP ${row.perGame.bpg.toFixed(1)}`,
        helperText: `PJ ${row.gamesPlayed}`,
      }));
    }

    const metricInfo = focusMeta[focus];
    return fullLeadersRows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      photo: row.photo ?? null,
      teamName: row.teamName,
      valuePrimaryText: row.perGame[metricInfo.perGameKey].toFixed(1),
      valueSecondaryText: String(row.totals[metricInfo.totalKey]),
      helperText: `PJ ${row.gamesPlayed}`,
    }));
  }, [focus, mvpRows, fullLeadersRows]);

  const filteredPlayerDirectoryRows = useMemo(() => {
    const query = normalizeText(playerDirectoryQuery);
    if (!query) return playerDirectoryRows;

    return playerDirectoryRows.filter((player) => {
      const searchable = normalizeText(`${player.name} ${player.teamName ?? ""}`);
      return searchable.includes(query);
    });
  }, [playerDirectoryQuery, playerDirectoryRows]);

  const duelPlayerById = useMemo(() => {
    const map = new Map<number, DuelPlayerOption>();
    duelPlayers.forEach((player) => {
      map.set(player.playerId, player);
    });
    return map;
  }, [duelPlayers]);

  const duelTeamOptions = useMemo(() => {
    const map = new Map<string, string>();
    duelPlayers.forEach((player) => {
      const teamKey = getDuelTeamKey(player.teamName);
      if (!map.has(teamKey)) {
        map.set(teamKey, getDuelTeamLabel(teamKey));
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "es", { sensitivity: "base" }));
  }, [duelPlayers]);

  const duelPlayersForTeamA = useMemo(() => {
    const rows = duelPlayers.filter((player) =>
      duelTeamA ? getDuelTeamKey(player.teamName) === duelTeamA : true
    );

    return rows.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  }, [duelPlayers, duelTeamA]);

  const duelPlayersForTeamB = useMemo(() => {
    const rows = duelPlayers.filter((player) =>
      duelTeamB ? getDuelTeamKey(player.teamName) === duelTeamB : true
    );

    return rows.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  }, [duelPlayers, duelTeamB]);

  const duelPlayerAInfo =
    typeof duelPlayerA === "number" ? duelPlayerById.get(duelPlayerA) ?? null : null;
  const duelPlayerBInfo =
    typeof duelPlayerB === "number" ? duelPlayerById.get(duelPlayerB) ?? null : null;

  useEffect(() => {
    if (focus !== "duel") return;

    const teamValues = duelTeamOptions.map((team) => team.value);
    if (teamValues.length === 0) {
      if (duelTeamA !== "") setDuelTeamA("");
      if (duelTeamB !== "") setDuelTeamB("");
      return;
    }

    const teamFromPlayerA = duelPlayerAInfo ? getDuelTeamKey(duelPlayerAInfo.teamName) : "";
    const teamFromPlayerB = duelPlayerBInfo ? getDuelTeamKey(duelPlayerBInfo.teamName) : "";

    const nextTeamA = teamFromPlayerA || (teamValues.includes(duelTeamA) ? duelTeamA : teamValues[0]) || "";
    const fallbackTeamB = teamValues.find((teamValue) => teamValue !== nextTeamA) ?? nextTeamA;
    const nextTeamB =
      teamFromPlayerB || (teamValues.includes(duelTeamB) ? duelTeamB : fallbackTeamB) || "";

    if (nextTeamA !== duelTeamA) setDuelTeamA(nextTeamA);
    if (nextTeamB !== duelTeamB) setDuelTeamB(nextTeamB);
  }, [focus, duelTeamOptions, duelPlayerAInfo, duelPlayerBInfo, duelTeamA, duelTeamB]);

  useEffect(() => {
    if (focus !== "duel") return;

    const validIds = new Set(duelPlayersForTeamA.map((player) => player.playerId));
    setDuelPlayerA((previous) => (typeof previous === "number" && validIds.has(previous) ? previous : ""));
  }, [focus, duelPlayersForTeamA]);

  useEffect(() => {
    if (focus !== "duel") return;

    const validIds = new Set(duelPlayersForTeamB.map((player) => player.playerId));
    setDuelPlayerB((previous) => (typeof previous === "number" && validIds.has(previous) ? previous : ""));
  }, [focus, duelPlayersForTeamB]);

  useEffect(() => {
    if (focus !== "duel") return;
    if (typeof duelPlayerA !== "number" || typeof duelPlayerB !== "number") return;
    if (duelPlayerA === duelPlayerB) setDuelPlayerB("");
  }, [focus, duelPlayerA, duelPlayerB]);

  const canCompareDuel =
    typeof duelPlayerA === "number" &&
    typeof duelPlayerB === "number" &&
    duelPlayerA !== duelPlayerB;

  const duelRows = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return [];

    const [leftPlayer, rightPlayer] = duelResult.players;

    return DUEL_METRICS.map((metric) => {
      const meta = DUEL_METRIC_META[metric];
      const leftValue = leftPlayer.metrics[metric];
      const rightValue = rightPlayer.metrics[metric];
      const leaders = duelResult.summary.perMetricLeader[metric] ?? [];
      const winnerId = leaders.length === 1 ? leaders[0] : null;

      return {
        metric,
        meta,
        leftPlayer,
        rightPlayer,
        leftValue,
        rightValue,
        winnerId,
        ratio: getDuelRatio(leftValue, rightValue, meta.higherIsBetter),
      };
    });
  }, [duelResult]);

  const duelStory = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return "";

    const [leftPlayer, rightPlayer] = duelResult.players;
    const leftWins = duelResult.summary.categoryWins[leftPlayer.playerId] ?? 0;
    const rightWins = duelResult.summary.categoryWins[rightPlayer.playerId] ?? 0;
    const diff = Math.abs(leftWins - rightWins);

    if (leftWins === rightWins) {
      return "Empate técnico: ambos tienen derecho a hablar basura hasta el próximo duelo.";
    }

    const winner = leftWins > rightWins ? leftPlayer.name : rightPlayer.name;
    const loser = leftWins > rightWins ? rightPlayer.name : leftPlayer.name;

    if (diff >= 4) {
      return `${winner} le pasó el rolo a ${loser}. Dominio total en este battle.`;
    }

    if (diff >= 2) {
      return `${winner} se llevó el duelo con autoridad. ${loser} pide revancha.`;
    }

    return `${winner} ganó por la mínima. ${loser} sigue respirándole en la nuca.`;
  }, [duelResult]);

  const handleCompareDuel = async () => {
    if (!canCompareDuel) {
      setDuelError("Selecciona dos jugadores distintos para comparar.");
      return;
    }

    setDuelLoading(true);
    setDuelError(null);

    try {
      const data = await getBattleData({
        tournamentId,
        playerIds: [duelPlayerA, duelPlayerB],
        metrics: DUEL_METRICS,
        phase,
      });
      setDuelResult(data);
    } catch (err) {
      setDuelResult(null);
      setDuelError(err instanceof Error ? err.message : "No se pudo generar la comparación.");
    } finally {
      setDuelLoading(false);
    }
  };

  const mvpDetailPhase: TournamentPhaseFilter = phase === "playoffs" ? "playoffs" : "regular";

  const openPlayerDetail = async (
    playerId: number,
    selectedPhase: TournamentPhaseFilter,
    options?: { forceRefresh?: boolean }
  ) => {
    const requestId = playerDetailRequestRef.current + 1;
    playerDetailRequestRef.current = requestId;

    setLastSelectedPlayer({ playerId, phase: selectedPhase });
    setPlayerDetailOpen(true);
    setPlayerDetailError(null);
    setPlayerDetailLoading(true);

    const cacheKey = `${tournamentId}:${selectedPhase}:${playerId}`;
    const useCache = !options?.forceRefresh;

    if (useCache) {
      const cached = playerDetailCacheRef.current.get(cacheKey);
      if (cached) {
        setPlayerDetail(cached);
        setPlayerDetailLoading(false);
        return;
      }
    }

    try {
      const [playerDetailData, phaseLines] = await Promise.all([
        getTournamentPlayerDetailFast({
          tournamentId,
          playerId,
          phase: selectedPhase,
          forceRefresh: Boolean(options?.forceRefresh),
        }),
        getTournamentPlayerLinesFast(tournamentId, selectedPhase),
      ]);
      const line = playerDetailData.line;

      const games = playerDetailData.games
        .map((item) => ({
          ...item,
          pra: round2(item.points + item.rebounds + item.assists - item.turnovers),
        }));

      let mvpRow: MvpBreakdownRow | null = null;
      if (selectedPhase !== "all") {
        try {
          const mvpRows = await getMvpRaceFast({
            tournamentId,
            phase: selectedPhase,
            eligibilityRate: 0.3,
          });
          mvpRow = mvpRows.find((row) => row.playerId === playerId) ?? null;
        } catch {
          mvpRow = null;
        }
      }

      const nextDetail: PlayerAnalyticsDetail = {
        phase: selectedPhase,
        line,
        games,
        mvpRow,
        phaseLines,
      };

      playerDetailCacheRef.current.set(cacheKey, nextDetail);

      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(nextDetail);
    } catch (err) {
      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(null);
      setPlayerDetailError(
        err instanceof Error ? err.message : "No se pudo cargar el detalle del jugador."
      );
    } finally {
      if (playerDetailRequestRef.current === requestId) {
        setPlayerDetailLoading(false);
      }
    }
  };

  const retryPlayerDetail = () => {
    if (!lastSelectedPlayer) return;
    void openPlayerDetail(lastSelectedPlayer.playerId, lastSelectedPlayer.phase, {
      forceRefresh: true,
    });
  };

  return (
    <section className="space-y-4">
      {!embedded ? (
        <header className="space-y-1">
          <h3 className="text-xl font-bold sm:text-2xl">{isDuelMode ? "Duelo de jugadores" : "Estadísticas"}</h3>
          {isDuelMode ? (
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Compara dos jugadores cara a cara con resultado final y lectura rápida.
            </p>
          ) : (
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Vista simplificada para revisar líderes y carrera MVP sin ruido visual.
            </p>
          )}
        </header>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          {isDuelMode ? "Modo duelo: comparación directa entre dos jugadores." : "Estadísticas clave del torneo en formato simple."}
        </p>
      )}

      <div className={`grid gap-2 ${isDuelMode ? "grid-cols-1 sm:max-w-xs" : "grid-cols-1 sm:grid-cols-2"}`}>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Fase</span>
          <AppSelect
            value={phase}
            onChange={(event) => setPhase(event.target.value as TournamentPhaseFilter)}
            className="input-base"
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={`phase-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </label>

        {!isDuelMode ? (
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Métrica</span>
            <AppSelect
              value={focus}
              onChange={(event) => setFocus(event.target.value as Exclude<StatsFocus, "duel">)}
              className="input-base"
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={`focus-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </label>
        ) : null}
      </div>

      {!isDuelMode ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPlayerDirectoryOpen(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Buscar jugador
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : null}

      {error ? (
        <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      {!loading && !hasContent && focus !== "duel" ? (
        <EmptyState
          title="Sin estadísticas disponibles"
          description="Carga resultados de partidos para ver líderes del torneo."
        />
      ) : null}

      {!loading && (hasContent || focus === "duel") ? (
        <>
          {!isDuelMode && kpis.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.slice(0, 4).map((kpi) => (
                <article key={kpi.id} className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{kpi.label}</p>
                  <p className="text-sm font-bold sm:text-base">{kpi.value}</p>
                  <p className="truncate text-xs text-[hsl(var(--text-subtle))]">{kpi.helper}</p>
                </article>
              ))}
            </div>
          ) : null}

          {focus === "duel" ? (
            <SectionCard
              title="Duelo 1v1"
              description="Compara dos jugadores en todas las métricas clave con un veredicto claro."
              actions={
                <button
                  type="button"
                  onClick={handleCompareDuel}
                  disabled={!canCompareDuel || duelLoading}
                  className="btn-primary min-h-[36px] px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {duelLoading ? "Comparando..." : "Comparar ahora"}
                </button>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <article className="rounded-lg border bg-[hsl(var(--surface-1))] p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Lado A
                    </p>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Equipo</span>
                      <AppSelect
                        value={duelTeamA}
                        onChange={(event) => {
                          setDuelTeamA(String(event.target.value));
                          setDuelPlayerA("");
                        }}
                        className="input-base"
                      >
                        <option value="">Seleccionar equipo</option>
                        {duelTeamOptions.map((teamOption) => (
                          <option key={`duel-team-a-${teamOption.value}`} value={teamOption.value}>
                            {teamOption.label}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Jugador</span>
                      <AppSelect
                        value={duelPlayerA}
                        onChange={(event) => setDuelPlayerA(event.target.value ? Number(event.target.value) : "")}
                        className="input-base"
                        disabled={!duelTeamA || duelPlayersForTeamA.length === 0}
                      >
                        <option value="">{duelTeamA ? "Seleccionar jugador" : "Elige equipo primero"}</option>
                        {duelPlayersForTeamA.map((player) => (
                          <option
                            key={`duel-a-${player.playerId}`}
                            value={player.playerId}
                            disabled={duelPlayerB === player.playerId}
                          >
                            {player.name}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                  </article>

                  <article className="rounded-lg border bg-[hsl(var(--surface-1))] p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Lado B
                    </p>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Equipo</span>
                      <AppSelect
                        value={duelTeamB}
                        onChange={(event) => {
                          setDuelTeamB(String(event.target.value));
                          setDuelPlayerB("");
                        }}
                        className="input-base"
                      >
                        <option value="">Seleccionar equipo</option>
                        {duelTeamOptions.map((teamOption) => (
                          <option key={`duel-team-b-${teamOption.value}`} value={teamOption.value}>
                            {teamOption.label}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Jugador</span>
                      <AppSelect
                        value={duelPlayerB}
                        onChange={(event) => setDuelPlayerB(event.target.value ? Number(event.target.value) : "")}
                        className="input-base"
                        disabled={!duelTeamB || duelPlayersForTeamB.length === 0}
                      >
                        <option value="">{duelTeamB ? "Seleccionar jugador" : "Elige equipo primero"}</option>
                        {duelPlayersForTeamB.map((player) => (
                          <option
                            key={`duel-b-${player.playerId}`}
                            value={player.playerId}
                            disabled={duelPlayerA === player.playerId}
                          >
                            {player.name}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                  </article>
                </div>

                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  Modo jocoso activado:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {duelPlayerAInfo?.name ?? "Selecciona jugador A"}
                  </span>{" "}
                  vs{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {duelPlayerBInfo?.name ?? "Selecciona jugador B"}
                  </span>
                  .
                </p>

                {duelPlayersLoading ? <LoadingSpinner label="Cargando jugadores para duelo" /> : null}
                {duelError ? (
                  <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                    {duelError}
                  </div>
                ) : null}

                {duelResult && duelResult.players.length === 2 ? (
                  <div className="space-y-3">
                    <article className="rounded-lg border bg-[hsl(var(--surface-2)/0.72)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1 text-sm font-semibold">
                          <FireIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                          {duelResult.summary.overallWinnerName
                            ? `Ganador: ${duelResult.summary.overallWinnerName}`
                            : "Empate técnico"}
                        </p>
                        <p className="text-xs text-[hsl(var(--text-subtle))]">Fase: {phase}</p>
                      </div>
                      <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">{duelStory}</p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {duelResult.players.map((player) => (
                          <div key={`duel-score-${player.playerId}`} className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2">
                            <p className="flex min-w-0 items-center gap-2 text-xs text-[hsl(var(--text-subtle))]">
                              {player.photo ? (
                                <img
                                  src={player.photo}
                                  alt={player.name}
                                  className="h-6 w-6 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                />
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px]">
                                  {getPlayerInitials(player.name)}
                                </span>
                              )}
                              <span className="truncate" title={player.name}>
                                {abbreviateLeaderboardName(player.name, 18)}
                              </span>
                            </p>
                            <p className="text-lg font-black tabular-nums">
                              {duelResult.summary.categoryWins[player.playerId] ?? 0}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--text-subtle))]">categorías ganadas</p>
                          </div>
                        ))}
                      </div>
                    </article>

                    <div className="space-y-2">
                      {duelRows.map((row) => {
                        const winnerName =
                          row.winnerId === null
                            ? "Empate"
                            : row.winnerId === row.leftPlayer.playerId
                            ? row.leftPlayer.name
                            : row.rightPlayer.name;

                        return (
                          <article key={`duel-metric-${row.metric}`} className="rounded-lg border bg-[hsl(var(--surface-2)/0.65)] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{row.meta.label}</p>
                              <span className="inline-flex items-center gap-1 rounded-md border bg-[hsl(var(--surface-1))] px-2 py-0.5 text-[11px]">
                                <BoltIcon className="h-3 w-3 text-[hsl(var(--primary))]" />
                                {winnerName}
                              </span>
                            </div>

                            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                              <p className="truncate text-right font-semibold tabular-nums">{row.meta.format(row.leftValue)}</p>
                              <span className="text-[hsl(var(--text-subtle))]">vs</span>
                              <p className="truncate font-semibold tabular-nums">{row.meta.format(row.rightValue)}</p>
                            </div>

                            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-1))]">
                              <span className="bg-[hsl(var(--primary))]" style={{ width: `${row.ratio.leftRatio}%` }} />
                              <span className="bg-[hsl(var(--chart-5))]" style={{ width: `${row.ratio.rightRatio}%` }} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title={focusTitle}
              description="Top 10 del torneo"
              actions={
                hasFocusContent ? (
                  <button
                    type="button"
                    onClick={openFullLeaders}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
                  >
                    Ver todo
                  </button>
                ) : undefined
              }
            >
              {focus === "mvp" ? (
                <div className="space-y-2">
                  <p className="rounded-lg border bg-[hsl(var(--surface-2)/0.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    MVP score = producción + eficiencia + impacto (PRA y VAL/PJ) + disponibilidad + récord del equipo.
                  </p>
                  {previewMvpRows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--text-subtle))]">No hay datos MVP para esta fase.</p>
                  ) : (
                    previewMvpRows.map((row, index) => (
                      <div
                        key={row.playerId}
                        className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-2 font-semibold">
                            {row.photo ? (
                              <img
                                src={row.photo}
                                alt={row.name}
                                className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                              />
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                {getPlayerInitials(row.name)}
                              </span>
                            )}
                            <span className="truncate" title={row.name}>
                              #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                            </span>
                          </p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{row.finalScore.toFixed(3)}</p>
                          <button
                            type="button"
                            onClick={() => void openPlayerDetail(row.playerId, mvpDetailPhase)}
                            className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                            title="Ver detalle del jugador"
                            aria-label={`Ver detalle de ${row.name}`}
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            Ver detalle
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {focus === "pra" || focus === "defensive" ? (
                    <p className="rounded-lg border bg-[hsl(var(--surface-2)/0.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {focus === "pra"
                        ? "PRA/PJ = puntos + rebotes + asistencias - pérdidas por juego. Es la referencia usada para medir volumen productivo neto."
                        : "D-Impact/PJ = (1.4 x ROB/PJ) + (1.8 x TAP/PJ) + (0.35 x REB/PJ) - (0.15 x FALTAS/PJ)."}
                    </p>
                  ) : null}
                  {previewRows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--text-subtle))]">No hay datos para esta métrica.</p>
                  ) : (
                    previewRows.map((row, index) => {
                      if (focus === "pra") {
                        return (
                          <div
                            key={row.playerId}
                            className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center gap-2 font-semibold">
                                {row.photo ? (
                                  <img
                                    src={row.photo}
                                    alt={row.name}
                                    className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                  />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                    {getPlayerInitials(row.name)}
                                  </span>
                                )}
                                <span className="truncate" title={row.name}>
                                  #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                                </span>
                              </p>
                              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums">
                                PRA/PJ {row.value.toFixed(1)}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                Total{" "}
                                {(
                                  row.totals.points +
                                  row.totals.rebounds +
                                  row.totals.assists -
                                  row.totals.turnovers
                                ).toFixed(0)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(row.playerId, phase)}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                                title="Ver detalle del jugador"
                                aria-label={`Ver detalle de ${row.name}`}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver detalle
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (focus === "defensive") {
                        return (
                          <div
                            key={row.playerId}
                            className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center gap-2 font-semibold">
                                {row.photo ? (
                                  <img
                                    src={row.photo}
                                    alt={row.name}
                                    className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                  />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                    {getPlayerInitials(row.name)}
                                  </span>
                                )}
                                <span className="truncate" title={row.name}>
                                  #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                                </span>
                              </p>
                              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums">
                                D-Impact {row.value.toFixed(2)}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                ROB {row.perGame.spg.toFixed(1)} · TAP {row.perGame.bpg.toFixed(1)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(row.playerId, phase)}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                                title="Ver detalle del jugador"
                                aria-label={`Ver detalle de ${row.name}`}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver detalle
                              </button>
                          </div>
                        </div>
                      );
                    }

                      const metricInfo = focusMeta[focus];
                      return (
                        <div
                          key={row.playerId}
                          className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="flex min-w-0 items-center gap-2 font-semibold">
                              {row.photo ? (
                                <img
                                  src={row.photo}
                                  alt={row.name}
                                  className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                />
                              ) : (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                  {getPlayerInitials(row.name)}
                                </span>
                              )}
                              <span className="truncate" title={row.name}>
                                #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                              </span>
                            </p>
                            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums">
                              {metricInfo.metricLabel} {row.perGame[metricInfo.perGameKey].toFixed(1)}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                              Total {row.totals[metricInfo.totalKey]}
                            </p>
                            <button
                              type="button"
                              onClick={() => void openPlayerDetail(row.playerId, phase)}
                              className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                              title="Ver detalle del jugador"
                              aria-label={`Ver detalle de ${row.name}`}
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              Ver detalle
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </SectionCard>
          )}
        </>
      ) : null}

      {fullViewOpen ? (
        <LeadersFullscreen
          title={fullViewTitle}
          valuePrimaryLabel={fullViewValueLabel}
          valueSecondaryLabel={fullViewSecondaryLabel}
          infoNote={fullViewInfoNote}
          rows={fullRows}
          loading={focus === "mvp" ? false : fullLeadersLoading}
          errorMessage={focus === "mvp" ? null : fullLeadersError}
          onBack={() => setFullViewOpen(false)}
          onRetry={focus === "mvp" ? undefined : retryFullLeaders}
          onPlayerSelect={(playerId) => {
            void openPlayerDetail(playerId, focus === "mvp" ? mvpDetailPhase : phase);
          }}
        />
      ) : null}

      {playerDirectoryOpen ? (
        <PlayersDirectoryFullscreen
          phase={phase}
          rows={filteredPlayerDirectoryRows}
          totalRows={playerDirectoryRows.length}
          loading={playerDirectoryLoading}
          errorMessage={playerDirectoryError}
          query={playerDirectoryQuery}
          onQueryChange={setPlayerDirectoryQuery}
          onBack={() => setPlayerDirectoryOpen(false)}
          onRetry={async () => {
            setPlayerDirectoryError(null);
            setPlayerDirectoryRows([]);
            setPlayerDirectoryLoading(true);
            try {
              const rows = await listTournamentPlayers(tournamentId, phase);
              setPlayerDirectoryRows(rows);
            } catch (err) {
              setPlayerDirectoryError(err instanceof Error ? err.message : "No se pudo cargar el directorio de jugadores.");
            } finally {
              setPlayerDirectoryLoading(false);
            }
          }}
          onPlayerSelect={(playerId) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      <PlayerAnalyticsModal
        isOpen={playerDetailOpen}
        loading={playerDetailLoading}
        errorMessage={playerDetailError}
        detail={playerDetail}
        onClose={() => setPlayerDetailOpen(false)}
        onRetry={retryPlayerDetail}
      />
    </section>
  );
};

const PlayersDirectoryFullscreen = ({
  phase,
  rows,
  totalRows,
  loading,
  errorMessage,
  query,
  onQueryChange,
  onBack,
  onRetry,
  onPlayerSelect,
}: {
  phase: TournamentPhaseFilter;
  rows: DuelPlayerOption[];
  totalRows: number;
  loading: boolean;
  errorMessage: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onPlayerSelect: (playerId: number) => void;
}) => {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[70] bg-[hsl(var(--background))]">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b bg-[hsl(var(--surface-1))] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs sm:text-sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Volver
            </button>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold sm:text-base">Buscador de jugadores</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">
                {totalRows} jugadores · {phaseLabel(phase)}
              </p>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          <label className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="input-base w-full pl-9"
              placeholder="Buscar por nombre o equipo..."
            />
          </label>

          <p className="mt-2 text-xs text-[hsl(var(--text-subtle))]">
            Mostrando {rows.length} de {totalRows} jugadores.
          </p>

          {loading ? (
            <div className="mt-4">
              <LoadingSpinner label="Cargando directorio de jugadores" />
            </div>
          ) : errorMessage ? (
            <div className="mt-4 space-y-3">
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </div>
              <button className="btn-secondary" onClick={onRetry}>
                Reintentar
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-[hsl(var(--text-subtle))]">
              {hasQuery ? "No hay jugadores que coincidan con tu búsqueda." : "No hay jugadores registrados en esta fase."}
            </p>
          ) : (
            <section className="mt-4 overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
              <div className="divide-y">
                {rows.map((row) => (
                  <article key={row.playerId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-semibold">
                        {row.photo ? (
                          <img
                            src={row.photo}
                            alt={row.name}
                            className="h-8 w-8 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                            {getPlayerInitials(row.name)}
                          </span>
                        )}
                        <span className="truncate" title={row.name}>
                          {abbreviateLeaderboardName(row.name, 34)}
                        </span>
                      </p>
                      <p className="truncate pl-10 text-xs text-[hsl(var(--muted-foreground))]">{row.teamName ?? "Sin equipo"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlayerSelect(row.playerId)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-2))]"
                      title="Ver detalle del jugador"
                      aria-label={`Ver detalle de ${row.name}`}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Ver perfil
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

const LeadersFullscreen = ({
  title,
  valuePrimaryLabel,
  valueSecondaryLabel,
  infoNote,
  rows,
  loading,
  errorMessage,
  onBack,
  onRetry,
  onPlayerSelect,
}: {
  title: string;
  valuePrimaryLabel: string;
  valueSecondaryLabel?: string;
  infoNote?: string;
  rows: FullLeaderItem[];
  loading: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onRetry?: () => void;
  onPlayerSelect?: (playerId: number) => void;
}) => {
  const hasSecondary = Boolean(valueSecondaryLabel);
  const headerGridClass = hasSecondary
    ? "grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b bg-[hsl(var(--surface-2))] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]"
    : "grid grid-cols-[auto_1fr_auto] gap-3 border-b bg-[hsl(var(--surface-2))] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]";
  const rowGridClass = hasSecondary
    ? "grid min-h-[74px] grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-sm"
    : "grid min-h-[74px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 text-sm";

  return (
    <div className="fixed inset-0 z-[70] bg-[hsl(var(--background))]">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b bg-[hsl(var(--surface-1))] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs sm:text-sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Volver
            </button>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">{rows.length} jugadores</p>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          {infoNote ? (
            <p className="mb-3 rounded-lg border bg-[hsl(var(--surface-2)/0.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
              {infoNote}
            </p>
          ) : null}
          {loading ? (
            <LoadingSpinner label="Cargando ranking completo" />
          ) : errorMessage ? (
            <div className="space-y-3">
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </div>
              {onRetry ? (
                <button className="btn-secondary" onClick={onRetry}>
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[hsl(var(--text-subtle))]">No hay jugadores para mostrar en este ranking.</p>
          ) : (
            <section className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
              <div className={headerGridClass}>
                <span>Rank</span>
                <span>Jugador</span>
                <span>{valuePrimaryLabel}</span>
                {hasSecondary ? <span>{valueSecondaryLabel}</span> : null}
              </div>
              <div className="divide-y">
                {rows.map((row, index) => (
                  <article key={row.playerId} className={rowGridClass}>
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-[hsl(var(--surface-2))] px-2 text-xs font-semibold">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-semibold">
                        {row.photo ? (
                          <img
                            src={row.photo}
                            alt={row.name}
                            className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                          />
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                            {getPlayerInitials(row.name)}
                          </span>
                        )}
                        <span className="truncate" title={row.name}>
                          {abbreviateLeaderboardName(row.name, 24)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {row.teamName ?? "Sin equipo"} · {row.helperText}
                      </p>
                      {onPlayerSelect ? (
                        <button
                          type="button"
                          onClick={() => onPlayerSelect(row.playerId)}
                          className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-2))]"
                          title="Ver detalle del jugador"
                          aria-label={`Ver detalle de ${row.name}`}
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Ver detalle
                        </button>
                      ) : null}
                    </div>
                    <p className="text-right font-semibold tabular-nums">{row.valuePrimaryText}</p>
                    {hasSecondary ? (
                      <p className="text-right font-semibold tabular-nums">{row.valueSecondaryText ?? "-"}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentStatsOverview;
