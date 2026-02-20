import { supabase } from "../lib/supabase";
import type {
  BattleMetric,
  BattlePlayerResult,
  TournamentAnalyticsCacheKey,
  TournamentAnalyticsKpi,
  TournamentAnalyticsPlayerGame,
  TournamentAnalyticsSnapshot,
  MatchPlayerStatsInput,
  MvpBreakdownRow,
  PlayerStatsLine,
  PlayoffGameRow,
  PlayoffSeriesRow,
  RaceSeriesPlayer,
  RaceSeriesPoint,
  TournamentResultBoxscoreRow,
  TournamentLeaderRow,
  TournamentResultMatchOverview,
  TournamentPhaseFilter,
  TournamentResultSummary,
  TournamentSettings,
  TournamentStatMetric,
} from "../types/tournament-analytics";
import {
  computeBattleWinner,
  computeFgPct,
  computeMvpScores,
  round2,
} from "../utils/tournament-stats";

type EnrichedStatsRow = {
  tournament_id: string;
  match_id: number;
  match_date: string | null;
  match_time: string | null;
  game_order?: number | null;
  player_id: number;
  names: string | null;
  lastnames: string | null;
  photo: string | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  team_name: string | null;
  phase: "regular" | "playoffs" | "finals";
};

const DEFAULT_PLAYOFF_FORMAT: TournamentSettings["playoffFormat"] = {
  enabled: true,
  format: "custom_1vN_handicap_2v3_bo3_finals_bo3",
  rounds: [
    {
      name: "Round 1",
      series: [
        {
          pairing: "1vN",
          type: "handicap",
          targetWins: { topSeed: 1, bottomSeed: 2 },
        },
        {
          pairing: "2v3",
          type: "bestOf",
          bestOf: 3,
        },
      ],
    },
    {
      name: "Finals",
      series: [
        {
          pairing: "Winners",
          type: "bestOf",
          bestOf: 3,
        },
      ],
    },
  ],
};

const METRIC_LOWER_IS_BETTER: Record<TournamentStatMetric, boolean> = {
  points: false,
  rebounds: false,
  assists: false,
  steals: false,
  blocks: false,
  turnovers: true,
  fouls: true,
  fg_pct: false,
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fullName = (names: string | null | undefined, lastnames: string | null | undefined): string =>
  [names, lastnames].filter(Boolean).join(" ").trim();

const inPhase = (phase: EnrichedStatsRow["phase"], filter: TournamentPhaseFilter): boolean => {
  if (filter === "all") return true;
  return phase === filter;
};

const buildPlayerLines = (
  rows: EnrichedStatsRow[],
  phaseFilter: TournamentPhaseFilter
): PlayerStatsLine[] => {
  const grouped = new Map<
    number,
    {
      playerId: number;
      name: string;
      photo: string | null;
      teamName: string | null;
      games: Set<number>;
      totals: PlayerStatsLine["totals"];
    }
  >();

  rows
    .filter((row) => inPhase(row.phase, phaseFilter))
    .forEach((row) => {
      const existing = grouped.get(row.player_id) ?? {
        playerId: row.player_id,
        name: fullName(row.names, row.lastnames),
        photo: row.photo,
        teamName: row.team_name,
        games: new Set<number>(),
        totals: {
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          fgm: 0,
          fga: 0,
        },
      };

      existing.name = existing.name || fullName(row.names, row.lastnames);
      existing.teamName = existing.teamName ?? row.team_name;
      existing.photo = existing.photo ?? row.photo;

      existing.games.add(row.match_id);
      existing.totals.points += toNumber(row.points);
      existing.totals.rebounds += toNumber(row.rebounds);
      existing.totals.assists += toNumber(row.assists);
      existing.totals.steals += toNumber(row.steals);
      existing.totals.blocks += toNumber(row.blocks);
      existing.totals.turnovers += toNumber(row.turnovers);
      existing.totals.fouls += toNumber(row.fouls);
      existing.totals.fgm += toNumber(row.fgm);
      existing.totals.fga += toNumber(row.fga);

      grouped.set(row.player_id, existing);
    });

  return Array.from(grouped.values()).map((entry) => {
    const gamesPlayed = entry.games.size;

    return {
      playerId: entry.playerId,
      name: entry.name,
      photo: entry.photo,
      teamName: entry.teamName,
      gamesPlayed,
      totals: entry.totals,
      perGame: {
        ppg: gamesPlayed > 0 ? round2(entry.totals.points / gamesPlayed) : 0,
        rpg: gamesPlayed > 0 ? round2(entry.totals.rebounds / gamesPlayed) : 0,
        apg: gamesPlayed > 0 ? round2(entry.totals.assists / gamesPlayed) : 0,
        spg: gamesPlayed > 0 ? round2(entry.totals.steals / gamesPlayed) : 0,
        bpg: gamesPlayed > 0 ? round2(entry.totals.blocks / gamesPlayed) : 0,
        topg: gamesPlayed > 0 ? round2(entry.totals.turnovers / gamesPlayed) : 0,
        fpg: gamesPlayed > 0 ? round2(entry.totals.fouls / gamesPlayed) : 0,
      },
      fgPct: computeFgPct(entry.totals.fgm, entry.totals.fga),
    };
  });
};

const loadLegacyStatsRows = async (tournamentId: string): Promise<EnrichedStatsRow[]> => {
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, tournament_id, match_date, match_time")
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true });

  if (matchesError) {
    throw new Error(matchesError.message);
  }

  const matchIds = (matches ?? []).map((match) => match.id);
  if (matchIds.length === 0) return [];

  const { data: stats, error: statsError } = await supabase
    .from("player_stats")
    .select("match_id, player_id, points, rebounds, assists")
    .in("match_id", matchIds);

  if (statsError) {
    throw new Error(statsError.message);
  }

  const playerIds = Array.from(new Set((stats ?? []).map((row) => row.player_id)));

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, names, lastnames, photo")
    .in("id", playerIds.length > 0 ? playerIds : [0]);

  if (playersError) {
    throw new Error(playersError.message);
  }

  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const matchesById = new Map((matches ?? []).map((match) => [match.id, match]));
  const matchOrderById = new Map(
    (matches ?? []).map((match, index) => [match.id, index + 1])
  );

  return (stats ?? []).map((row) => {
    const player = playersById.get(row.player_id);
    const match = matchesById.get(row.match_id);

    return {
      tournament_id: tournamentId,
      match_id: row.match_id,
      match_date: match?.match_date ?? null,
      match_time: match?.match_time ?? null,
      game_order: matchOrderById.get(row.match_id) ?? 0,
      player_id: row.player_id,
      names: player?.names ?? null,
      lastnames: player?.lastnames ?? null,
      photo: player?.photo ?? null,
      points: toNumber(row.points),
      rebounds: toNumber(row.rebounds),
      assists: toNumber(row.assists),
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fgm: 0,
      fga: 0,
      fg_pct: 0,
      team_name: null,
      phase: "regular",
    };
  });
};

const loadStatsRows = async (tournamentId: string): Promise<EnrichedStatsRow[]> => {
  const { data, error } = await supabase
    .from("tournament_player_stats_enriched")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .order("match_id", { ascending: true });

  if (!error && data) {
    return data as EnrichedStatsRow[];
  }

  return loadLegacyStatsRows(tournamentId);
};

const getTeamWinPct = async (tournamentId: string): Promise<Map<string, number>> => {
  const { data, error } = await supabase
    .from("tournament_regular_standings")
    .select("team_name, win_pct")
    .eq("tournament_id", tournamentId);

  if (error || !data) {
    return new Map<string, number>();
  }

  return new Map(data.map((row) => [row.team_name as string, toNumber(row.win_pct)]));
};

const analyticsSnapshotCache = new Map<
  TournamentAnalyticsCacheKey,
  {
    revisionKey: string;
    snapshot: TournamentAnalyticsSnapshot;
  }
>();

const toAnalyticsPhase = (value: unknown): "regular" | "playoffs" | "finals" => {
  if (value === "playoffs" || value === "finals") return value;
  return "regular";
};

const toAnalyticsPlayerGame = (row: EnrichedStatsRow): TournamentAnalyticsPlayerGame => ({
  tournamentId: row.tournament_id,
  matchId: row.match_id,
  matchDate: row.match_date,
  matchTime: row.match_time,
  gameOrder: toNumber(row.game_order),
  playerId: row.player_id,
  playerName: fullName(row.names, row.lastnames) || `Jugador ${row.player_id}`,
  teamName: row.team_name,
  phase: toAnalyticsPhase(row.phase),
  points: toNumber(row.points),
  rebounds: toNumber(row.rebounds),
  assists: toNumber(row.assists),
  steals: toNumber(row.steals),
  blocks: toNumber(row.blocks),
  turnovers: toNumber(row.turnovers),
  fouls: toNumber(row.fouls),
  fgm: toNumber(row.fgm),
  fga: toNumber(row.fga),
  fgPct: computeFgPct(toNumber(row.fgm), toNumber(row.fga)),
});

const loadStatsRowsFromAnalyticsView = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<EnrichedStatsRow[] | null> => {
  let query = supabase
    .from("tournament_analytics_player_game")
    .select(
      "tournament_id, match_id, match_date, match_time, game_order, player_id, names, lastnames, photo, team_name, phase, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, fg_pct"
    )
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .order("match_id", { ascending: true });

  if (phaseFilter !== "all") {
    query = query.eq("phase", phaseFilter);
  }

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  return (data as Record<string, unknown>[]).map((row) => ({
    tournament_id: String(row.tournament_id ?? tournamentId),
    match_id: toNumber(row.match_id),
    match_date: row.match_date ? String(row.match_date) : null,
    match_time: row.match_time ? String(row.match_time) : null,
    game_order: toNumber(row.game_order),
    player_id: toNumber(row.player_id),
    names: row.names ? String(row.names) : null,
    lastnames: row.lastnames ? String(row.lastnames) : null,
    photo: row.photo ? String(row.photo) : null,
    points: toNumber(row.points),
    rebounds: toNumber(row.rebounds),
    assists: toNumber(row.assists),
    steals: toNumber(row.steals),
    blocks: toNumber(row.blocks),
    turnovers: toNumber(row.turnovers),
    fouls: toNumber(row.fouls),
    fgm: toNumber(row.fgm),
    fga: toNumber(row.fga),
    fg_pct: toNumber(row.fg_pct),
    team_name: row.team_name ? String(row.team_name) : null,
    phase: toAnalyticsPhase(row.phase),
  }));
};

const loadPlayerTotalsFromAnalyticsView = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<PlayerStatsLine[] | null> => {
  let query = supabase
    .from("tournament_analytics_player_totals")
    .select(
      "tournament_id, phase, player_id, names, lastnames, photo, team_name, games_played, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, fg_pct, ppg, rpg, apg, spg, bpg, topg, fpg"
    )
    .eq("tournament_id", tournamentId);

  if (phaseFilter !== "all") {
    query = query.eq("phase", phaseFilter);
  }

  const { data, error } = await query;
  if (error || !data) return null;

  if (phaseFilter !== "all") {
    return (data as Record<string, unknown>[]).map((row) => {
      const gamesPlayed = Math.max(0, toNumber(row.games_played));
      const names = row.names ? String(row.names) : null;
      const lastnames = row.lastnames ? String(row.lastnames) : null;
      const playerName = fullName(names, lastnames) || `Jugador ${toNumber(row.player_id)}`;

      return {
        playerId: toNumber(row.player_id),
        name: playerName,
        photo: row.photo ? String(row.photo) : null,
        teamName: row.team_name ? String(row.team_name) : null,
        gamesPlayed,
        totals: {
          points: toNumber(row.points),
          rebounds: toNumber(row.rebounds),
          assists: toNumber(row.assists),
          steals: toNumber(row.steals),
          blocks: toNumber(row.blocks),
          turnovers: toNumber(row.turnovers),
          fouls: toNumber(row.fouls),
          fgm: toNumber(row.fgm),
          fga: toNumber(row.fga),
        },
        perGame: {
          ppg: toNumber(row.ppg),
          rpg: toNumber(row.rpg),
          apg: toNumber(row.apg),
          spg: toNumber(row.spg),
          bpg: toNumber(row.bpg),
          topg: toNumber(row.topg),
          fpg: toNumber(row.fpg),
        },
        fgPct: toNumber(row.fg_pct),
      };
    });
  }

  const merged = new Map<number, PlayerStatsLine>();
  (data as Record<string, unknown>[]).forEach((row) => {
    const playerId = toNumber(row.player_id);
    const gamesPlayed = Math.max(0, toNumber(row.games_played));
    const points = toNumber(row.points);
    const rebounds = toNumber(row.rebounds);
    const assists = toNumber(row.assists);
    const steals = toNumber(row.steals);
    const blocks = toNumber(row.blocks);
    const turnovers = toNumber(row.turnovers);
    const fouls = toNumber(row.fouls);
    const fgm = toNumber(row.fgm);
    const fga = toNumber(row.fga);
    const names = row.names ? String(row.names) : null;
    const lastnames = row.lastnames ? String(row.lastnames) : null;
    const fallbackName = fullName(names, lastnames) || `Jugador ${playerId}`;

    const current =
      merged.get(playerId) ??
      ({
        playerId,
        name: fallbackName,
        photo: row.photo ? String(row.photo) : null,
        teamName: row.team_name ? String(row.team_name) : null,
        gamesPlayed: 0,
        totals: {
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          fgm: 0,
          fga: 0,
        },
        perGame: {
          ppg: 0,
          rpg: 0,
          apg: 0,
          spg: 0,
          bpg: 0,
          topg: 0,
          fpg: 0,
        },
        fgPct: 0,
      } as PlayerStatsLine);

    current.name = current.name || fallbackName;
    current.photo = current.photo ?? (row.photo ? String(row.photo) : null);
    current.teamName = current.teamName ?? (row.team_name ? String(row.team_name) : null);
    current.gamesPlayed += gamesPlayed;
    current.totals.points += points;
    current.totals.rebounds += rebounds;
    current.totals.assists += assists;
    current.totals.steals += steals;
    current.totals.blocks += blocks;
    current.totals.turnovers += turnovers;
    current.totals.fouls += fouls;
    current.totals.fgm += fgm;
    current.totals.fga += fga;

    merged.set(playerId, current);
  });

  return Array.from(merged.values()).map((entry) => ({
    ...entry,
    perGame: {
      ppg: entry.gamesPlayed > 0 ? round2(entry.totals.points / entry.gamesPlayed) : 0,
      rpg: entry.gamesPlayed > 0 ? round2(entry.totals.rebounds / entry.gamesPlayed) : 0,
      apg: entry.gamesPlayed > 0 ? round2(entry.totals.assists / entry.gamesPlayed) : 0,
      spg: entry.gamesPlayed > 0 ? round2(entry.totals.steals / entry.gamesPlayed) : 0,
      bpg: entry.gamesPlayed > 0 ? round2(entry.totals.blocks / entry.gamesPlayed) : 0,
      topg: entry.gamesPlayed > 0 ? round2(entry.totals.turnovers / entry.gamesPlayed) : 0,
      fpg: entry.gamesPlayed > 0 ? round2(entry.totals.fouls / entry.gamesPlayed) : 0,
    },
    fgPct: computeFgPct(entry.totals.fgm, entry.totals.fga),
  }));
};

const loadTeamFactorFromView = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<Map<string, number> | null> => {
  let query = supabase
    .from("tournament_analytics_team_factor")
    .select("team_name, phase, win_pct")
    .eq("tournament_id", tournamentId);

  if (phaseFilter !== "all") {
    query = query.eq("phase", phaseFilter);
  } else {
    query = query.eq("phase", "regular");
  }

  const { data, error } = await query;
  if (error || !data) return null;

  return new Map(
    (data as Array<{ team_name: string; win_pct: number }>).map((row) => [
      row.team_name,
      toNumber(row.win_pct),
    ])
  );
};

const getTeamFactorFromMatches = async (
  tournamentId: string,
  statsRows: EnrichedStatsRow[]
): Promise<Map<string, number>> => {
  const matchIds = Array.from(new Set(statsRows.map((row) => row.match_id)));
  if (matchIds.length === 0) return new Map<string, number>();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, team_a, team_b, winner_team")
    .eq("tournament_id", tournamentId)
    .in("id", matchIds);

  if (error || !matches) return new Map<string, number>();

  const byTeam = new Map<string, { games: number; wins: number }>();

  for (const match of matches) {
    const teams = [match.team_a, match.team_b].filter(
      (teamName): teamName is string => Boolean(teamName)
    );

    for (const teamName of teams) {
      const current = byTeam.get(teamName) ?? { games: 0, wins: 0 };
      current.games += 1;
      if (match.winner_team === teamName) {
        current.wins += 1;
      }
      byTeam.set(teamName, current);
    }
  }

  return new Map(
    Array.from(byTeam.entries()).map(([teamName, summary]) => [
      teamName,
      summary.games > 0 ? summary.wins / summary.games : 0,
    ])
  );
};

const getAnalyticsRevisionKey = async (tournamentId: string): Promise<string> => {
  const [{ count: matchesCount }, { count: statsCount }] = await Promise.all([
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId),
    supabase
      .from("player_stats")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId),
  ]);

  return `${matchesCount ?? 0}:${statsCount ?? 0}`;
};

export const clearTournamentAnalyticsCache = (tournamentId?: string) => {
  if (!tournamentId) {
    analyticsSnapshotCache.clear();
    return;
  }

  for (const key of analyticsSnapshotCache.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      analyticsSnapshotCache.delete(key);
    }
  }
};

export const getTournamentAnalyticsSnapshot = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter = "all",
  options?: { forceRefresh?: boolean }
): Promise<TournamentAnalyticsSnapshot> => {
  const cacheKey = `${tournamentId}:${phaseFilter}` as TournamentAnalyticsCacheKey;
  const revisionKey = await getAnalyticsRevisionKey(tournamentId);

  if (!options?.forceRefresh) {
    const cached = analyticsSnapshotCache.get(cacheKey);
    if (cached && cached.revisionKey === revisionKey) {
      return cached.snapshot;
    }
  }

  let statsRows = await loadStatsRowsFromAnalyticsView(tournamentId, phaseFilter);
  if (!statsRows) {
    const fallbackRows = await loadStatsRows(tournamentId);
    statsRows =
      phaseFilter === "all"
        ? fallbackRows
        : fallbackRows.filter((row) => inPhase(row.phase, phaseFilter));
  }

  let playerLines = await loadPlayerTotalsFromAnalyticsView(tournamentId, phaseFilter);
  if (!playerLines) {
    playerLines = buildPlayerLines(statsRows, "all");
  }

  const playerGames = statsRows.map(toAnalyticsPlayerGame);
  const gamesAnalyzed = new Set(statsRows.map((row) => row.match_id)).size;
  const playersAnalyzed = playerLines.length;

  let teamFactors = await loadTeamFactorFromView(tournamentId, phaseFilter);
  if (!teamFactors) {
    if (phaseFilter === "regular" || phaseFilter === "all") {
      teamFactors = await getTeamWinPct(tournamentId);
    } else {
      teamFactors = await getTeamFactorFromMatches(tournamentId, statsRows);
    }
  }

  const snapshot: TournamentAnalyticsSnapshot = {
    tournamentId,
    phase: phaseFilter,
    revisionKey,
    playerGames,
    playerLines,
    gamesAnalyzed,
    playersAnalyzed,
    teamFactors: Object.fromEntries(teamFactors.entries()),
  };

  analyticsSnapshotCache.set(cacheKey, { revisionKey, snapshot });
  return snapshot;
};

const buildMvpRowsFromSnapshot = (
  snapshot: TournamentAnalyticsSnapshot,
  eligibilityRate = 0.3
): MvpBreakdownRow[] => {
  const perTeam = new Map<string, Set<number>>();
  snapshot.playerGames.forEach((row) => {
    if (!row.teamName) return;
    const current = perTeam.get(row.teamName) ?? new Set<number>();
    current.add(row.matchId);
    perTeam.set(row.teamName, current);
  });
  const teamGamesMap = new Map(
    Array.from(perTeam.entries()).map(([team, games]) => [team, games.size])
  );

  const teamFactorMap = new Map(
    Object.entries(snapshot.teamFactors).map(([team, factor]) => [team, toNumber(factor)])
  );

  const scoresInput = snapshot.playerLines.map((line) => {
    const teamGames = line.teamName ? teamGamesMap.get(line.teamName) ?? 0 : 0;
    const minGames = Math.max(1, Math.ceil(teamGames * eligibilityRate));
    const teamFactor = line.teamName ? teamFactorMap.get(line.teamName) ?? 0 : 0;

    return {
      line,
      eligible: line.gamesPlayed >= minGames,
      minGames,
      teamFactor,
    };
  });

  const scored = computeMvpScores(
    scoresInput.map((entry) => ({
      playerId: entry.line.playerId,
      ppg: entry.line.perGame.ppg,
      rpg: entry.line.perGame.rpg,
      apg: entry.line.perGame.apg,
      spg: entry.line.perGame.spg,
      bpg: entry.line.perGame.bpg,
      topg: entry.line.perGame.topg,
      fpg: entry.line.perGame.fpg,
      fgPct: entry.line.fgPct,
      teamFactor: entry.teamFactor,
    }))
  );

  return scoresInput
    .map((entry) => {
      const details = scored[entry.line.playerId];
      return {
        ...entry.line,
        eligible: entry.eligible,
        eligibilityThreshold: entry.minGames,
        teamFactor: details.teamFactor,
        z: details.z,
        componentScore: details.componentScore,
        finalScore: details.finalScore,
      };
    })
    .filter((row) => row.eligible)
    .sort((a, b) => b.finalScore - a.finalScore);
};

export const getLeaders = async (params: {
  tournamentId: string;
  phase?: TournamentPhaseFilter;
  metric?: TournamentStatMetric;
  limit?: number;
}): Promise<TournamentLeaderRow[]> => {
  const phase = params.phase ?? "regular";
  const metric = params.metric ?? "points";
  const limit = params.limit ?? 20;

  const snapshot = await getTournamentAnalyticsSnapshot(params.tournamentId, phase);

  return snapshot.playerLines
    .map((line) => {
      const value =
        metric === "fg_pct"
          ? line.fgPct
          : toNumber(line.totals[metric as keyof PlayerStatsLine["totals"]]);

      return {
        ...line,
        value,
        metric,
      };
    })
    .sort((a, b) => {
      const direction = METRIC_LOWER_IS_BETTER[metric] ? 1 : -1;
      const byValue = (a.value - b.value) * direction;
      if (byValue !== 0) return byValue;
      return b.gamesPlayed - a.gamesPlayed;
    })
    .slice(0, limit);
};

export const getRaceSeries = async (params: {
  tournamentId: string;
  phase?: TournamentPhaseFilter;
  metric: Exclude<TournamentStatMetric, "fg_pct">;
  topN?: number;
}): Promise<RaceSeriesPlayer[]> => {
  const phase = params.phase ?? "regular";
  const topN = params.topN ?? 5;
  const snapshot = await getTournamentAnalyticsSnapshot(params.tournamentId, phase);

  const topPlayers = [...snapshot.playerLines]
    .sort(
      (a, b) =>
        toNumber(b.totals[params.metric as keyof PlayerStatsLine["totals"]]) -
        toNumber(a.totals[params.metric as keyof PlayerStatsLine["totals"]])
    )
    .slice(0, topN);

  const topSet = new Set(topPlayers.map((player) => player.playerId));
  const grouped = new Map<number, RaceSeriesPoint[]>();

  [...snapshot.playerGames]
    .filter((row) => topSet.has(row.playerId))
    .sort((a, b) => {
      if (a.playerId !== b.playerId) return a.playerId - b.playerId;
      if (a.gameOrder !== b.gameOrder) return a.gameOrder - b.gameOrder;
      const dateA = a.matchDate ?? "";
      const dateB = b.matchDate ?? "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.matchTime ?? "";
      const timeB = b.matchTime ?? "";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return a.matchId - b.matchId;
    })
    .forEach((row) => {
      const metricValue = toNumber(row[params.metric]);
      const current = grouped.get(row.playerId) ?? [];
      const previousCumulative = current.length > 0 ? current[current.length - 1].cumulative : 0;

      current.push({
        matchId: row.matchId,
        gameIndex: current.length + 1,
        date: row.matchDate ?? "",
        value: metricValue,
        cumulative: round2(previousCumulative + metricValue),
      });

      grouped.set(row.playerId, current);
    });

  return topPlayers.map((player) => ({
    playerId: player.playerId,
    name: player.name,
    teamName: player.teamName,
    points: grouped.get(player.playerId) ?? [],
  }));
};

export const getMvpRace = async (params: {
  tournamentId: string;
  phase?: Exclude<TournamentPhaseFilter, "all">;
  eligibilityRate?: number;
}): Promise<MvpBreakdownRow[]> => {
  const phase = params.phase ?? "regular";
  const eligibilityRate = params.eligibilityRate ?? 0.3;
  const snapshot = await getTournamentAnalyticsSnapshot(params.tournamentId, phase);

  return buildMvpRowsFromSnapshot(snapshot, eligibilityRate);
};

export const getFinalsMvpRace = async (tournamentId: string): Promise<MvpBreakdownRow[]> =>
  getMvpRace({ tournamentId, phase: "finals", eligibilityRate: 0.3 });

export const getBattleData = async (params: {
  tournamentId: string;
  playerIds: number[];
  metrics: BattleMetric[];
  phase?: TournamentPhaseFilter;
}): Promise<{ players: BattlePlayerResult[]; summary: ReturnType<typeof computeBattleWinner> }> => {
  const uniquePlayerIds = Array.from(new Set(params.playerIds));
  if (uniquePlayerIds.length !== 2) {
    throw new Error("Battle requiere exactamente 2 jugadores.");
  }

  const phase = params.phase ?? "regular";
  const snapshot = await getTournamentAnalyticsSnapshot(params.tournamentId, phase);
  const lines = snapshot.playerLines.filter((line) => uniquePlayerIds.includes(line.playerId));

  if (lines.length !== 2) {
    throw new Error("No hay datos suficientes para comparar esos 2 jugadores en la fase seleccionada.");
  }
  const mvpRows = buildMvpRowsFromSnapshot(snapshot, 0.3);

  const mvpByPlayer = new Map(mvpRows.map((row) => [row.playerId, row.finalScore]));

  const players: BattlePlayerResult[] = lines.map((line) => ({
    playerId: line.playerId,
    name: line.name,
    teamName: line.teamName,
    metrics: {
      ppg: line.perGame.ppg,
      rpg: line.perGame.rpg,
      apg: line.perGame.apg,
      spg: line.perGame.spg,
      bpg: line.perGame.bpg,
      fg_pct: line.fgPct,
      topg: line.perGame.topg,
    },
    compositeScore: mvpByPlayer.get(line.playerId) ?? 0,
  }));

  const summary = computeBattleWinner(players, params.metrics);
  return { players, summary };
};

export const getAnalyticsDashboardKpis = async (
  tournamentId: string
): Promise<TournamentAnalyticsKpi[]> => {
  const regularSnapshot = await getTournamentAnalyticsSnapshot(tournamentId, "regular");
  const leaderByPoints = [...regularSnapshot.playerLines]
    .sort((a, b) => b.totals.points - a.totals.points)[0];
  const leaderByMvp = buildMvpRowsFromSnapshot(regularSnapshot, 0.3)[0];

  return [
    {
      id: "players",
      label: "Jugadores activos",
      value: regularSnapshot.playersAnalyzed,
      helper: "Con al menos un juego en temporada regular",
    },
    {
      id: "games",
      label: "Juegos analizados",
      value: regularSnapshot.gamesAnalyzed,
      helper: "Partidos con datos de jugador",
    },
    {
      id: "leader_points",
      label: "Líder PTS",
      value: leaderByPoints?.name ?? "N/A",
      helper: leaderByPoints ? `${leaderByPoints.totals.points} puntos` : "Sin registros",
    },
    {
      id: "leader_mvp",
      label: "Líder MVP",
      value: leaderByMvp?.name ?? "N/A",
      helper: leaderByMvp ? `Score ${leaderByMvp.finalScore.toFixed(3)}` : "Sin elegibles",
    },
  ];
};

export const getTournamentSettings = async (tournamentId: string): Promise<TournamentSettings> => {
  const { data, error } = await supabase
    .from("tournament_settings")
    .select("tournament_id, season_type, playoff_format")
    .eq("tournament_id", tournamentId)
    .single();

  if (error || !data) {
    return {
      tournamentId,
      seasonType: "regular_plus_playoffs",
      playoffFormat: { ...DEFAULT_PLAYOFF_FORMAT },
    };
  }

  return {
    tournamentId: data.tournament_id,
    seasonType: data.season_type,
    playoffFormat:
      typeof data.playoff_format === "object" && data.playoff_format
        ? data.playoff_format
        : { ...DEFAULT_PLAYOFF_FORMAT },
  } as TournamentSettings;
};

export const saveTournamentSettings = async (settings: TournamentSettings): Promise<void> => {
  const { error } = await supabase.from("tournament_settings").upsert(
    {
      tournament_id: settings.tournamentId,
      season_type: settings.seasonType,
      playoff_format: settings.playoffFormat,
    },
    { onConflict: "tournament_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
};

export const getPlayoffState = async (
  tournamentId: string
): Promise<{ settings: TournamentSettings; series: PlayoffSeriesRow[] }> => {
  const settings = await getTournamentSettings(tournamentId);

  const [{ data: seriesData, error: seriesError }, { data: gamesData, error: gamesError }, { data: teamsData }] =
    await Promise.all([
      supabase
        .from("playoff_series")
        .select(
          "id, tournament_id, round_order, round_name, matchup_key, team_a_id, team_b_id, seed_a, seed_b, wins_a, wins_b, target_wins_a, target_wins_b, status, winner_team_id"
        )
        .eq("tournament_id", tournamentId)
        .order("round_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("playoff_games")
        .select(
          "id, tournament_id, series_id, match_id, game_number, status, scheduled_date, scheduled_time"
        )
        .eq("tournament_id", tournamentId)
        .order("series_id", { ascending: true })
        .order("game_number", { ascending: true }),
      supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
    ]);

  if (seriesError) {
    throw new Error(seriesError.message);
  }

  if (gamesError) {
    throw new Error(gamesError.message);
  }

  const matchIds = (gamesData ?? []).map((game) => game.match_id);
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, team_a, team_b, winner_team, match_date, match_time")
    .in("id", matchIds.length > 0 ? matchIds : [0]);

  const teamNameById = new Map((teamsData ?? []).map((team) => [team.id, team.name]));
  const matchById = new Map((matchesData ?? []).map((match) => [match.id, match]));

  const gamesBySeries = new Map<number, PlayoffGameRow[]>();
  for (const game of gamesData ?? []) {
    const list = gamesBySeries.get(game.series_id) ?? [];
    const match = matchById.get(game.match_id);

    list.push({
      id: game.id,
      tournamentId: game.tournament_id,
      seriesId: game.series_id,
      matchId: game.match_id,
      gameNumber: game.game_number,
      status: game.status,
      scheduledDate: game.scheduled_date,
      scheduledTime: game.scheduled_time,
      match: match
        ? {
            id: match.id,
            teamA: match.team_a,
            teamB: match.team_b,
            winnerTeam: match.winner_team,
            matchDate: match.match_date,
            matchTime: match.match_time,
          }
        : null,
    });

    gamesBySeries.set(game.series_id, list);
  }

  const series: PlayoffSeriesRow[] = (seriesData ?? []).map((item) => ({
    id: item.id,
    tournamentId: item.tournament_id,
    roundOrder: item.round_order,
    roundName: item.round_name,
    matchupKey: item.matchup_key,
    teamAId: item.team_a_id,
    teamBId: item.team_b_id,
    seedA: item.seed_a,
    seedB: item.seed_b,
    winsA: item.wins_a,
    winsB: item.wins_b,
    targetWinsA: item.target_wins_a,
    targetWinsB: item.target_wins_b,
    status: item.status,
    winnerTeamId: item.winner_team_id,
    teamAName: item.team_a_id ? teamNameById.get(item.team_a_id) ?? null : null,
    teamBName: item.team_b_id ? teamNameById.get(item.team_b_id) ?? null : null,
    winnerName: item.winner_team_id ? teamNameById.get(item.winner_team_id) ?? null : null,
    games: gamesBySeries.get(item.id) ?? [],
  }));

  return { settings, series };
};

export const generatePlayoffs = async (tournamentId: string): Promise<void> => {
  const { error } = await supabase.rpc("generate_tournament_playoffs", {
    p_tournament_id: tournamentId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const saveMatchStats = async (payload: {
  matchId: number;
  winnerTeam: string;
  playerStats: MatchPlayerStatsInput[];
}): Promise<void> => {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, tournament_id, winner_team")
    .eq("id", payload.matchId)
    .single();

  if (matchError || !match) {
    throw new Error(matchError?.message ?? "No se encontró el partido.");
  }

  const { data: participants, error: participantsError } = await supabase
    .from("match_players")
    .select("player_id")
    .eq("match_id", payload.matchId);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const participantIds = new Set((participants ?? []).map((item) => item.player_id));
  if (participantIds.size === 0) {
    throw new Error("Este partido no tiene participantes asignados en match_players.");
  }

  const normalizedRows = payload.playerStats.map((row) => {
    const normalized: MatchPlayerStatsInput = {
      playerId: row.playerId,
      points: Math.max(0, Math.floor(toNumber(row.points))),
      rebounds: Math.max(0, Math.floor(toNumber(row.rebounds))),
      assists: Math.max(0, Math.floor(toNumber(row.assists))),
      steals: Math.max(0, Math.floor(toNumber(row.steals))),
      blocks: Math.max(0, Math.floor(toNumber(row.blocks))),
      turnovers: Math.max(0, Math.floor(toNumber(row.turnovers))),
      fouls: Math.max(0, Math.floor(toNumber(row.fouls))),
      fgm: Math.max(0, Math.floor(toNumber(row.fgm))),
      fga: Math.max(0, Math.floor(toNumber(row.fga))),
    };

    if (!participantIds.has(normalized.playerId)) {
      throw new Error(`El jugador ${normalized.playerId} no está asignado a este partido.`);
    }

    if (normalized.fgm > normalized.fga) {
      throw new Error(`FGM no puede ser mayor que FGA para el jugador ${normalized.playerId}.`);
    }

    return normalized;
  });

  const submittedIds = new Set(normalizedRows.map((row) => row.playerId));
  const toDeleteIds = Array.from(participantIds).filter((playerId) => !submittedIds.has(playerId));

  const { error: winnerError } = await supabase
    .from("matches")
    .update({ winner_team: payload.winnerTeam })
    .eq("id", payload.matchId);

  if (winnerError) {
    throw new Error(winnerError.message);
  }

  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("player_stats")
      .delete()
      .eq("match_id", payload.matchId)
      .in("player_id", toDeleteIds);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  const upsertRows = normalizedRows.map((row) => ({
    match_id: payload.matchId,
    tournament_id: match.tournament_id,
    player_id: row.playerId,
    points: row.points,
    rebounds: row.rebounds,
    assists: row.assists,
    steals: row.steals,
    blocks: row.blocks,
    turnovers: row.turnovers,
    fouls: row.fouls,
    fgm: row.fgm,
    fga: row.fga,
  }));

  let statsError: { message: string } | null = null;
  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from("player_stats")
      .upsert(upsertRows, { onConflict: "match_id,player_id" });
    statsError = error;
  }

  if (statsError) {
    throw new Error(statsError.message);
  }

  const { error: syncError } = await supabase.rpc("sync_playoff_series_from_match", {
    p_match_id: payload.matchId,
  });

  if (syncError && syncError.code !== "PGRST202") {
    throw new Error(syncError.message);
  }

  clearTournamentAnalyticsCache(match.tournament_id);
};

export const listTournamentPlayers = async (
  tournamentId: string,
  phase: TournamentPhaseFilter = "all"
): Promise<Array<{ playerId: number; name: string; teamName: string | null }>> => {
  const snapshot = await getTournamentAnalyticsSnapshot(tournamentId, phase);
  const lines = snapshot.playerLines;

  return lines
    .map((line) => ({
      playerId: line.playerId,
      name: line.name,
      teamName: line.teamName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const toMatchOverview = (row: Record<string, unknown>): TournamentResultMatchOverview => ({
  matchId: toNumber(row.match_id),
  tournamentId: String(row.tournament_id ?? ""),
  matchDate: row.match_date ? String(row.match_date) : null,
  matchTime: row.match_time ? String(row.match_time) : null,
  teamA: String(row.team_a ?? ""),
  teamB: String(row.team_b ?? ""),
  winnerTeam: row.winner_team ? String(row.winner_team) : null,
  teamAPoints: toNumber(row.team_a_points),
  teamBPoints: toNumber(row.team_b_points),
  hasStats: Boolean(row.has_stats),
});

const loadResultsOverviewFromScoreboardView = async (
  tournamentId: string
): Promise<TournamentResultMatchOverview[] | null> => {
  const { data, error } = await supabase
    .from("tournament_match_scoreboard")
    .select(
      "tournament_id, match_id, match_date, match_time, team_a, team_b, winner_team, team_a_points, team_b_points, has_stats"
    )
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: false })
    .order("match_time", { ascending: false });

  if (error || !data) {
    return null;
  }

  return (data as Record<string, unknown>[]).map((row) => toMatchOverview(row));
};

const loadResultsOverviewFallback = async (
  tournamentId: string
): Promise<TournamentResultMatchOverview[]> => {
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, tournament_id, match_date, match_time, team_a, team_b, winner_team")
    .eq("tournament_id", tournamentId)
    .not("winner_team", "is", null)
    .order("match_date", { ascending: false })
    .order("match_time", { ascending: false });

  if (matchesError) {
    throw new Error(matchesError.message);
  }

  if (!matches || matches.length === 0) {
    return [];
  }

  const matchIds = matches.map((match) => match.id);

  const [{ data: statsRows, error: statsError }, { data: participantsRows, error: participantsError }] =
    await Promise.all([
      supabase
        .from("player_stats")
        .select("match_id, player_id, points")
        .in("match_id", matchIds),
      supabase
        .from("match_players")
        .select("match_id, player_id, team")
        .in("match_id", matchIds),
    ]);

  const scoresByMatch = new Map<number, { teamA: number; teamB: number; hasStats: boolean }>();

  matches.forEach((match) => {
    scoresByMatch.set(match.id, { teamA: 0, teamB: 0, hasStats: false });
  });

  if (!statsError && !participantsError && statsRows && participantsRows) {
    const sideByMatchPlayer = new Map<string, "A" | "B">();

    (participantsRows as Array<{ match_id: number; player_id: number; team: "A" | "B" | null }>).forEach(
      (row) => {
        if (row.team === "A" || row.team === "B") {
          sideByMatchPlayer.set(`${row.match_id}-${row.player_id}`, row.team);
        }
      }
    );

    (statsRows as Array<{ match_id: number; player_id: number; points: number }>).forEach((row) => {
      const score = scoresByMatch.get(row.match_id);
      if (!score) return;

      const side = sideByMatchPlayer.get(`${row.match_id}-${row.player_id}`);
      const points = toNumber(row.points);

      if (side === "A") {
        score.teamA += points;
        score.hasStats = true;
      }

      if (side === "B") {
        score.teamB += points;
        score.hasStats = true;
      }
    });
  }

  return matches.map((match) => {
    const score = scoresByMatch.get(match.id) ?? { teamA: 0, teamB: 0, hasStats: false };

    return {
      matchId: match.id,
      tournamentId: String(match.tournament_id),
      matchDate: match.match_date ? String(match.match_date) : null,
      matchTime: match.match_time ? String(match.match_time) : null,
      teamA: String(match.team_a ?? ""),
      teamB: String(match.team_b ?? ""),
      winnerTeam: match.winner_team ? String(match.winner_team) : null,
      teamAPoints: score.teamA,
      teamBPoints: score.teamB,
      hasStats: score.hasStats,
    };
  });
};

export const getTournamentResultsOverview = async (
  tournamentId: string
): Promise<TournamentResultMatchOverview[]> => {
  const fromView = await loadResultsOverviewFromScoreboardView(tournamentId);
  if (fromView) return fromView;

  return loadResultsOverviewFallback(tournamentId);
};

const toBoxscoreRowFromView = (row: Record<string, unknown>): TournamentResultBoxscoreRow => {
  const names = String(row.names ?? "").trim();
  const lastnames = String(row.lastnames ?? "").trim();
  const playerName = `${names} ${lastnames}`.trim() || `Jugador ${toNumber(row.player_id)}`;
  const fgm = toNumber(row.fgm);
  const fga = toNumber(row.fga);

  return {
    playerId: toNumber(row.player_id),
    teamSide:
      row.team_side === "A" || row.team_side === "B"
        ? (row.team_side as "A" | "B")
        : "U",
    playerName,
    points: toNumber(row.points),
    rebounds: toNumber(row.rebounds),
    assists: toNumber(row.assists),
    steals: toNumber(row.steals),
    blocks: toNumber(row.blocks),
    turnovers: toNumber(row.turnovers),
    fouls: toNumber(row.fouls),
    fgm,
    fga,
    fgPct: toNumber(row.fg_pct) || computeFgPct(fgm, fga),
  };
};

const loadMatchBoxscoreFromView = async (
  tournamentId: string,
  matchId: number
): Promise<TournamentResultBoxscoreRow[] | null> => {
  const { data, error } = await supabase
    .from("tournament_player_stats_enriched")
    .select(
      "player_id, names, lastnames, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, fg_pct, team_side"
    )
    .eq("tournament_id", tournamentId)
    .eq("match_id", matchId);

  if (error || !data) {
    return null;
  }

  return (data as Record<string, unknown>[]).map((row) => toBoxscoreRowFromView(row));
};

const loadMatchBoxscoreFallback = async (
  matchId: number
): Promise<TournamentResultBoxscoreRow[]> => {
  const { data: participantsRows, error: participantsError } = await supabase
    .from("match_players")
    .select("player_id, team")
    .eq("match_id", matchId);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const sideByPlayer = new Map<number, "A" | "B">();
  (participantsRows as Array<{ player_id: number; team: "A" | "B" | null }>).forEach((row) => {
    if (row.team === "A" || row.team === "B") {
      sideByPlayer.set(row.player_id, row.team);
    }
  });

  let rows: Array<Record<string, unknown>> = [];

  const { data: fullRows, error: fullRowsError } = await supabase
    .from("player_stats")
    .select(
      "player_id, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, player:players(id, names, lastnames)"
    )
    .eq("match_id", matchId);

  if (!fullRowsError && fullRows) {
    rows = fullRows as Array<Record<string, unknown>>;
  } else {
    const { data: legacyRows, error: legacyError } = await supabase
      .from("player_stats")
      .select("player_id, points, rebounds, assists, player:players(id, names, lastnames)")
      .eq("match_id", matchId);

    if (legacyError) {
      throw new Error(legacyError.message);
    }

    rows = (legacyRows ?? []).map((row) => ({
      ...row,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fgm: 0,
      fga: 0,
    })) as Array<Record<string, unknown>>;
  }

  return rows.map((row) => {
    const player = Array.isArray(row.player)
      ? (row.player[0] as Record<string, unknown> | undefined)
      : (row.player as Record<string, unknown> | undefined);

    const names = String(player?.names ?? "").trim();
    const lastnames = String(player?.lastnames ?? "").trim();
    const playerId = toNumber(row.player_id);
    const fgm = toNumber(row.fgm);
    const fga = toNumber(row.fga);

    return {
      playerId,
      teamSide: sideByPlayer.get(playerId) ?? "U",
      playerName: `${names} ${lastnames}`.trim() || `Jugador ${playerId}`,
      points: toNumber(row.points),
      rebounds: toNumber(row.rebounds),
      assists: toNumber(row.assists),
      steals: toNumber(row.steals),
      blocks: toNumber(row.blocks),
      turnovers: toNumber(row.turnovers),
      fouls: toNumber(row.fouls),
      fgm,
      fga,
      fgPct: computeFgPct(fgm, fga),
    };
  });
};

export const getMatchBoxscore = async (
  tournamentId: string,
  matchId: number
): Promise<TournamentResultBoxscoreRow[]> => {
  const fromView = await loadMatchBoxscoreFromView(tournamentId, matchId);
  if (fromView) return fromView;

  return loadMatchBoxscoreFallback(matchId);
};

export const groupBoxscoreBySide = (rows: TournamentResultBoxscoreRow[]) => {
  const sortRows = (list: TournamentResultBoxscoreRow[]) =>
    [...list].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.playerName.localeCompare(b.playerName);
    });

  return {
    A: sortRows(rows.filter((row) => row.teamSide === "A")),
    B: sortRows(rows.filter((row) => row.teamSide === "B")),
    U: sortRows(rows.filter((row) => row.teamSide === "U")),
  };
};

export const getTournamentResultsSummary = (
  matches: TournamentResultMatchOverview[]
): TournamentResultSummary => {
  const playedMatches = matches.length;
  const matchesWithStats = matches.filter((match) => match.hasStats).length;
  const totalPoints = matches.reduce((sum, match) => sum + match.teamAPoints + match.teamBPoints, 0);
  const avgPoints = playedMatches > 0 ? round2(totalPoints / playedMatches) : 0;

  return {
    playedMatches,
    matchesWithStats,
    totalPoints,
    avgPoints,
  };
};

export const buildResultsSummary = getTournamentResultsSummary;
