import { supabase } from "../lib/supabase";
import { getTournamentAnalyticsSnapshot } from "./tournamentAnalytics";
import type { PlayerStatsLine } from "../types/tournament-analytics";
import {
  computeValuation,
  computeValuationPerGame,
} from "../utils/tournament-stats";

export type TournamentOption = {
  id: string;
  name: string;
  startDate: string | null;
  createdAt: string | null;
};

export type PlayerTournamentStatSummary = {
  tournamentId: string;
  tournamentName: string;
  tournamentStartDate: string | null;
  line: PlayerStatsLine;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const fullName = (names: unknown, lastnames: unknown, playerId: number) => {
  const joined = `${String(names ?? "").trim()} ${String(lastnames ?? "").trim()}`.replace(/\s+/g, " ").trim();
  return joined || `Jugador ${playerId}`;
};

const computeFgPct = (fgm: number, fga: number) => {
  if (fga <= 0) return 0;
  return Number(((fgm / fga) * 100).toFixed(2));
};

const computePct = (made: number, attempts: number) => {
  if (attempts <= 0) return 0;
  return Number(((made / attempts) * 100).toFixed(2));
};

const listTournamentsMap = async () => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, startdate, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const options: TournamentOption[] = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? "Torneo"),
    startDate: row.startdate ? String(row.startdate) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
  }));

  const byId = new Map(options.map((tournament) => [tournament.id, tournament]));
  return { options, byId };
};

const loadPlayerPlusMinusByTournament = async (
  playerId: number
): Promise<Map<string, { total: number; perGame: number }>> => {
  // +/- estilo NBA/ACB: diferencial del equipo contra el rival durante el juego.
  // En este producto se aproxima usando participacion registrada (team_side + player_stats).
  const { data: playerGameRows, error: playerGameError } = await supabase
    .from("tournament_player_stats_enriched")
    .select("tournament_id, match_id, team_side")
    .eq("player_id", playerId);

  if (playerGameError || !playerGameRows || playerGameRows.length === 0) {
    return new Map();
  }

  const uniqueMatchIds = Array.from(
    new Set(
      (playerGameRows as Array<{ match_id: number }>).map((row) => toNumber(row.match_id))
    )
  ).filter((id) => id > 0);

  if (uniqueMatchIds.length === 0) {
    return new Map();
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("tournament_player_stats_enriched")
    .select("match_id, player_id, team_side, points")
    .in("match_id", uniqueMatchIds);

  if (matchError || !matchRows) {
    return new Map();
  }

  type MatchParticipant = {
    matchId: number;
    playerId: number;
    teamSide: "A" | "B";
    points: number;
  };

  const participants: MatchParticipant[] = (
    matchRows as Array<{
      match_id: number;
      player_id: number;
      team_side: "A" | "B" | "U" | null;
      points: number;
    }>
  )
    .filter((row): row is Omit<MatchParticipant, "matchId" | "playerId" | "points"> & {
      match_id: number;
      player_id: number;
      points: number;
      team_side: "A" | "B";
    } => row.team_side === "A" || row.team_side === "B")
    .map((row) => ({
      matchId: toNumber(row.match_id),
      playerId: toNumber(row.player_id),
      teamSide: row.team_side,
      points: toNumber(row.points),
    }))
    .filter((row) => row.matchId > 0 && row.playerId > 0);

  const byMatch = new Map<number, MatchParticipant[]>();
  participants.forEach((entry) => {
    const rows = byMatch.get(entry.matchId) ?? [];
    rows.push(entry);
    byMatch.set(entry.matchId, rows);
  });

  const plusMinusByMatchPlayer = new Map<string, number>();
  byMatch.forEach((matchRowsGroup) => {
    const bySide = new Map<"A" | "B", MatchParticipant[]>();
    matchRowsGroup.forEach((entry) => {
      const rows = bySide.get(entry.teamSide) ?? [];
      rows.push(entry);
      bySide.set(entry.teamSide, rows);
    });

    if (bySide.size < 2) return;

    const pointsA = (bySide.get("A") ?? []).reduce((sum, row) => sum + row.points, 0);
    const pointsB = (bySide.get("B") ?? []).reduce((sum, row) => sum + row.points, 0);
    const marginA = Number((pointsA - pointsB).toFixed(2));
    const marginB = Number((pointsB - pointsA).toFixed(2));

    (bySide.get("A") ?? []).forEach((entry) => {
      plusMinusByMatchPlayer.set(`${entry.matchId}-${entry.playerId}`, marginA);
    });
    (bySide.get("B") ?? []).forEach((entry) => {
      plusMinusByMatchPlayer.set(`${entry.matchId}-${entry.playerId}`, marginB);
    });
  });

  const byTournament = new Map<string, { total: number; games: Set<number> }>();

  (
    playerGameRows as Array<{
      tournament_id: string;
      match_id: number;
      team_side: "A" | "B" | "U" | null;
    }>
  ).forEach((row) => {
    const tournamentId = String(row.tournament_id ?? "");
    const matchId = toNumber(row.match_id);
    if (!tournamentId || matchId <= 0) return;
    if (row.team_side !== "A" && row.team_side !== "B") return;

    const diff = plusMinusByMatchPlayer.get(`${matchId}-${playerId}`) ?? 0;
    const current = byTournament.get(tournamentId) ?? { total: 0, games: new Set<number>() };

    if (!current.games.has(matchId)) {
      current.total += diff;
      current.games.add(matchId);
    }

    byTournament.set(tournamentId, current);
  });

  const result = new Map<string, { total: number; perGame: number }>();
  byTournament.forEach((value, tournamentId) => {
    const gamesPlayed = value.games.size;
    result.set(tournamentId, {
      total: Number(value.total.toFixed(2)),
      perGame: gamesPlayed > 0 ? Number((value.total / gamesPlayed).toFixed(2)) : 0,
    });
  });

  return result;
};

const sortPlayerLines = (rows: PlayerStatsLine[]) =>
  [...rows].sort((a, b) => {
    if (b.valuation !== a.valuation) return b.valuation - a.valuation;
    if (b.valuationPerGame !== a.valuationPerGame) return b.valuationPerGame - a.valuationPerGame;
    if (b.totals.points !== a.totals.points) return b.totals.points - a.totals.points;
    if (b.perGame.ppg !== a.perGame.ppg) return b.perGame.ppg - a.perGame.ppg;
    return a.name.localeCompare(b.name, "es");
  });

const toMergedLine = (row: Record<string, unknown>): PlayerStatsLine => {
  const playerId = toNumber(row.player_id);
  const gamesPlayed = Math.max(0, toNumber(row.games_played));
  const plusMinusTotal = toNumber(row.plus_minus);
  const plusMinusPerGame = toNumber(row.plus_minus_pg);
  const totals = {
    points: toNumber(row.points),
    rebounds: toNumber(row.rebounds),
    assists: toNumber(row.assists),
    steals: toNumber(row.steals),
    blocks: toNumber(row.blocks),
    plusMinus: plusMinusTotal,
    turnovers: toNumber(row.turnovers),
    fouls: toNumber(row.fouls),
    fgm: toNumber(row.fgm),
    fga: toNumber(row.fga),
    ftm: toNumber(row.ftm),
    fta: toNumber(row.fta),
    tpm: toNumber(row.tpm),
    tpa: toNumber(row.tpa),
  };
  const valuation = computeValuation({
    points: totals.points,
    rebounds: totals.rebounds,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: totals.fouls,
    fgm: totals.fgm,
    fga: totals.fga,
    ftm: totals.ftm,
    fta: totals.fta,
    tpm: totals.tpm,
  });

  return {
    playerId,
    name: fullName(row.names, row.lastnames, playerId),
    photo: row.photo ? String(row.photo) : null,
    teamName: row.team_name ? String(row.team_name) : null,
    gamesPlayed,
    totals,
    perGame: {
      ppg: gamesPlayed > 0 ? Number((totals.points / gamesPlayed).toFixed(2)) : 0,
      rpg: gamesPlayed > 0 ? Number((totals.rebounds / gamesPlayed).toFixed(2)) : 0,
      apg: gamesPlayed > 0 ? Number((totals.assists / gamesPlayed).toFixed(2)) : 0,
      spg: gamesPlayed > 0 ? Number((totals.steals / gamesPlayed).toFixed(2)) : 0,
      bpg: gamesPlayed > 0 ? Number((totals.blocks / gamesPlayed).toFixed(2)) : 0,
      plusMinus:
        gamesPlayed > 0
          ? plusMinusPerGame || Number((plusMinusTotal / gamesPlayed).toFixed(2))
          : 0,
      topg: gamesPlayed > 0 ? Number((totals.turnovers / gamesPlayed).toFixed(2)) : 0,
      fpg: gamesPlayed > 0 ? Number((totals.fouls / gamesPlayed).toFixed(2)) : 0,
    },
    fgPct: computeFgPct(totals.fgm, totals.fga),
    ftPct: computePct(totals.ftm, totals.fta),
    tpPct: computePct(totals.tpm, totals.tpa),
    valuation,
    valuationPerGame: computeValuationPerGame(valuation, gamesPlayed),
  };
};

const loadPlayerTournamentRowsFromAnalyticsView = async (playerId: number): Promise<PlayerTournamentStatSummary[] | null> => {
  const { data, error } = await supabase
    .from("tournament_analytics_player_totals")
    .select(
      "tournament_id, phase, player_id, names, lastnames, photo, team_name, games_played, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa"
    )
    .eq("player_id", playerId);

  if (error || !data) return null;

  const { byId } = await listTournamentsMap();
  const plusMinusByTournament = await loadPlayerPlusMinusByTournament(playerId);

  const grouped = new Map<string, Record<string, unknown>>();

  (data as Record<string, unknown>[]).forEach((row) => {
    const tournamentId = String(row.tournament_id ?? "");
    if (!tournamentId) return;

    const current = grouped.get(tournamentId) ?? {
      tournament_id: tournamentId,
      player_id: toNumber(row.player_id),
      names: row.names,
      lastnames: row.lastnames,
      photo: row.photo,
      team_name: row.team_name,
      games_played: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
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
      plus_minus: 0,
      plus_minus_pg: 0,
    };

    current.games_played = toNumber(current.games_played) + toNumber(row.games_played);
    current.points = toNumber(current.points) + toNumber(row.points);
    current.rebounds = toNumber(current.rebounds) + toNumber(row.rebounds);
    current.assists = toNumber(current.assists) + toNumber(row.assists);
    current.steals = toNumber(current.steals) + toNumber(row.steals);
    current.blocks = toNumber(current.blocks) + toNumber(row.blocks);
    current.turnovers = toNumber(current.turnovers) + toNumber(row.turnovers);
    current.fouls = toNumber(current.fouls) + toNumber(row.fouls);
    current.fgm = toNumber(current.fgm) + toNumber(row.fgm);
    current.fga = toNumber(current.fga) + toNumber(row.fga);
    current.ftm = toNumber(current.ftm) + toNumber(row.ftm);
    current.fta = toNumber(current.fta) + toNumber(row.fta);
    current.tpm = toNumber(current.tpm) + toNumber(row.tpm);
    current.tpa = toNumber(current.tpa) + toNumber(row.tpa);

    if (!current.team_name && row.team_name) current.team_name = row.team_name;
    if (!current.photo && row.photo) current.photo = row.photo;

    grouped.set(tournamentId, current);
  });

  const rows = Array.from(grouped.values()).map((row) => {
    const tournamentId = String(row.tournament_id ?? "");
    const tournament = byId.get(tournamentId);
    const plusMinus = plusMinusByTournament.get(tournamentId);

    if (plusMinus) {
      row.plus_minus = plusMinus.total;
      row.plus_minus_pg = plusMinus.perGame;
    }

    return {
      tournamentId,
      tournamentName: tournament?.name ?? "Torneo",
      tournamentStartDate: tournament?.startDate ?? null,
      line: toMergedLine(row),
    };
  });

  return rows.sort((a, b) => {
    const dateA = a.tournamentStartDate ?? "0000-01-01";
    const dateB = b.tournamentStartDate ?? "0000-01-01";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return a.tournamentName.localeCompare(b.tournamentName, "es");
  });
};

const loadPlayerTournamentRowsFallback = async (playerId: number): Promise<PlayerTournamentStatSummary[]> => {
  const { options } = await listTournamentsMap();
  const snapshots = await Promise.allSettled(
    options.map(async (tournament) => {
      const snapshot = await getTournamentAnalyticsSnapshot(tournament.id, "all");
      const line = snapshot.playerLines.find((item) => item.playerId === playerId);
      return line
        ? ({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            tournamentStartDate: tournament.startDate,
            line,
          } satisfies PlayerTournamentStatSummary)
        : null;
    })
  );

  return snapshots
    .filter((result): result is PromiseFulfilledResult<PlayerTournamentStatSummary | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((item): item is PlayerTournamentStatSummary => Boolean(item))
    .sort((a, b) => {
      const dateA = a.tournamentStartDate ?? "0000-01-01";
      const dateB = b.tournamentStartDate ?? "0000-01-01";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.tournamentName.localeCompare(b.tournamentName, "es");
    });
};

export const getPlayerStatsByTournament = async (playerId: number): Promise<PlayerTournamentStatSummary[]> => {
  const fromView = await loadPlayerTournamentRowsFromAnalyticsView(playerId);
  if (fromView) return fromView;
  return loadPlayerTournamentRowsFallback(playerId);
};

export const listTournamentOptions = async (): Promise<TournamentOption[]> => {
  const { options } = await listTournamentsMap();
  return options;
};

export const getTournamentPlayersDirectory = async (tournamentId: string): Promise<PlayerStatsLine[]> => {
  const snapshot = await getTournamentAnalyticsSnapshot(tournamentId, "all");
  return sortPlayerLines(snapshot.playerLines);
};
