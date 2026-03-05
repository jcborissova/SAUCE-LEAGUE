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
  computePct,
  computeFgPct,
  computeMvpScores,
  computeValuation,
  computeValuationPerGame,
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
  ftm: number;
  fta: number;
  ft_pct: number;
  tpm: number;
  tpa: number;
  tp_pct: number;
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
  defensive_impact: false,
  pra: false,
  turnovers: true,
  fouls: true,
  fg_pct: false,
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSafeText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const isStatementTimeoutError = (message: string): boolean =>
  message.toLowerCase().includes("statement timeout");

const isMissingTeamPlayersTournamentColumnError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("team_players") && normalized.includes("tournament_id");
};

type QueryError = { message: string } | null;
type QueryResult<T> = { data: T | null; error: QueryError };

const ANALYTICS_QUERY_RETRIES = 1;
const REVISION_CACHE_TTL_MS = 12000;
const ANALYTICS_PLAYER_GAME_PAGE_SIZE = 600;
const ANALYTICS_PLAYER_TOTALS_PAGE_SIZE = 600;
const TOURNAMENT_PLAYER_IDS_CHUNK = 250;
const TOURNAMENT_PLAYER_LIST_CACHE_TTL_MS = 20_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableQueryError = (error: QueryError): boolean => {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    isStatementTimeoutError(message) ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("timeout")
  );
};

const runSelectWithRetry = async <T>(
  queryFactory: () => PromiseLike<QueryResult<T>>,
  retries = ANALYTICS_QUERY_RETRIES
): Promise<QueryResult<T>> => {
  let last: QueryResult<T> | null = null;
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await queryFactory();
    last = result;

    if (!result.error) {
      return result;
    }

    const shouldRetry = attempt < maxAttempts && isRetryableQueryError(result.error);
    if (!shouldRetry) {
      return result;
    }

    await wait(120 * attempt);
  }

  return (
    last ?? {
      data: null,
      error: { message: "No se pudo completar la consulta." },
    }
  );
};

const toSelectPromise = <T,>(query: unknown): PromiseLike<QueryResult<T>> =>
  query as PromiseLike<QueryResult<T>>;

const getLineValuation = (
  totals: PlayerStatsLine["totals"],
  gamesPlayed: number
): Pick<PlayerStatsLine, "valuation" | "valuationPerGame"> => {
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
    valuation,
    valuationPerGame: computeValuationPerGame(valuation, gamesPlayed),
  };
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
          plusMinus: 0,
          turnovers: 0,
          fouls: 0,
          fgm: 0,
          fga: 0,
          ftm: 0,
          fta: 0,
          tpm: 0,
          tpa: 0,
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
      existing.totals.ftm += toNumber(row.ftm);
      existing.totals.fta += toNumber(row.fta);
      existing.totals.tpm += toNumber(row.tpm);
      existing.totals.tpa += toNumber(row.tpa);

      grouped.set(row.player_id, existing);
    });

  return Array.from(grouped.values()).map((entry) => {
    const gamesPlayed = entry.games.size;
    const valuation = getLineValuation(entry.totals, gamesPlayed);

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
        plusMinus: 0,
        topg: gamesPlayed > 0 ? round2(entry.totals.turnovers / gamesPlayed) : 0,
        fpg: gamesPlayed > 0 ? round2(entry.totals.fouls / gamesPlayed) : 0,
      },
      fgPct: computeFgPct(entry.totals.fgm, entry.totals.fga),
      ftPct: computePct(entry.totals.ftm, entry.totals.fta),
      tpPct: computePct(entry.totals.tpm, entry.totals.tpa),
      ...valuation,
    };
  });
};

const hydrateMissingPlayerPhotos = async (playerLines: PlayerStatsLine[]): Promise<PlayerStatsLine[]> => {
  if (playerLines.length === 0) return playerLines;

  const missingPhotoIds = Array.from(
    new Set(
      playerLines
        .filter((line) => !toSafeText(line.photo))
        .map((line) => toNumber(line.playerId))
        .filter((playerId) => playerId > 0)
    )
  );

  if (missingPhotoIds.length === 0) return playerLines;

  const photoByPlayerId = new Map<number, string>();

  for (const idsChunk of chunkArray(missingPhotoIds, TOURNAMENT_PLAYER_IDS_CHUNK)) {
    const { data, error } = await runSelectWithRetry<Array<{ id: number; photo: string | null }>>(() =>
      supabase
        .from("players")
        .select("id, photo")
        .in("id", idsChunk)
    );

    // Si falla la hidratacion de fotos, seguimos con las lineas actuales para no romper analytics.
    if (error || !data) continue;

    data.forEach((row) => {
      const playerId = toNumber(row.id);
      const photo = toSafeText(row.photo);
      if (playerId > 0 && photo) {
        photoByPlayerId.set(playerId, photo);
      }
    });
  }

  return playerLines.map((line) => {
    if (toSafeText(line.photo)) return line;
    const photo = photoByPlayerId.get(line.playerId);
    if (!photo) return line;
    return {
      ...line,
      photo,
    };
  });
};

const buildPlayerPlusMinusByPlayer = (
  rows: TournamentAnalyticsPlayerGame[]
): Map<number, { total: number; perGame: number }> => {
  // Alineado con NBA/ACB: +/- = puntos de tu equipo - puntos del rival.
  // Sin tracking de sustituciones por posesion, se aplica el margen del juego
  // a cada jugador con participacion registrada en player_stats.
  type MatchTeamTotals = {
    points: number;
    players: Set<number>;
  };

  const byMatch = new Map<number, Map<string, MatchTeamTotals>>();

  rows.forEach((row) => {
    if (!row.teamName) return;
    const matchId = toNumber(row.matchId);
    const playerId = toNumber(row.playerId);
    if (matchId <= 0 || playerId <= 0) return;

    const byTeam = byMatch.get(matchId) ?? new Map<string, MatchTeamTotals>();
    const teamKey = row.teamName;
    const current = byTeam.get(teamKey) ?? { points: 0, players: new Set<number>() };
    current.points += toNumber(row.points);
    current.players.add(playerId);
    byTeam.set(teamKey, current);
    byMatch.set(matchId, byTeam);
  });

  const byPlayer = new Map<number, { total: number; games: Set<number> }>();

  byMatch.forEach((byTeam, matchId) => {
    if (byTeam.size < 2) return;

    const teamEntries = Array.from(byTeam.entries());
    teamEntries.forEach(([teamKey, teamData]) => {
      let opponentPoints = 0;
      teamEntries.forEach(([otherTeamKey, otherTeamData]) => {
        if (otherTeamKey !== teamKey) {
          opponentPoints += otherTeamData.points;
        }
      });

      const margin = round2(teamData.points - opponentPoints);
      teamData.players.forEach((playerId) => {
        const current = byPlayer.get(playerId) ?? {
          total: 0,
          games: new Set<number>(),
        };
        if (current.games.has(matchId)) return;
        current.total += margin;
        current.games.add(matchId);
        byPlayer.set(playerId, current);
      });
    });
  });

  const result = new Map<number, { total: number; perGame: number }>();
  byPlayer.forEach((entry, playerId) => {
    const gamesPlayed = entry.games.size;
    result.set(playerId, {
      total: round2(entry.total),
      perGame: gamesPlayed > 0 ? round2(entry.total / gamesPlayed) : 0,
    });
  });

  return result;
};

const applyPlusMinusToPlayerLines = (
  lines: PlayerStatsLine[],
  playerGames: TournamentAnalyticsPlayerGame[]
): PlayerStatsLine[] => {
  if (lines.length === 0 || playerGames.length === 0) {
    return lines.map((line) => ({
      ...line,
      totals: {
        ...line.totals,
        plusMinus: line.totals.plusMinus ?? 0,
      },
      perGame: {
        ...line.perGame,
        plusMinus: line.perGame.plusMinus ?? 0,
      },
    }));
  }

  const plusMinusByPlayer = buildPlayerPlusMinusByPlayer(playerGames);

  return lines.map((line) => {
    const plusMinus = plusMinusByPlayer.get(line.playerId);
    if (!plusMinus) {
      return {
        ...line,
        totals: {
          ...line.totals,
          plusMinus: line.totals.plusMinus ?? 0,
        },
        perGame: {
          ...line.perGame,
          plusMinus: line.perGame.plusMinus ?? 0,
        },
      };
    }

    return {
      ...line,
      totals: {
        ...line.totals,
        plusMinus: plusMinus.total,
      },
      perGame: {
        ...line.perGame,
        plusMinus: plusMinus.perGame,
      },
    };
  });
};

const computeTrueShootingPct = (points: number, fga: number, fta: number): number => {
  const attempts = fga + 0.44 * fta;
  if (attempts <= 0) return 0;
  return round2((points / (2 * attempts)) * 100);
};

const computeDefensiveImpactPerGame = (line: PlayerStatsLine): number =>
  round2(
    line.perGame.spg * 1.4 +
      line.perGame.bpg * 1.8 +
      line.perGame.rpg * 0.35 -
      line.perGame.fpg * 0.15
  );

const computePieLikeNumerator = (row: TournamentAnalyticsPlayerGame): number => {
  // Inspirado en el PIE oficial de NBA; no usamos OREB/DREB por no existir en nuestro boxscore.
  const value =
    toNumber(row.points) +
    toNumber(row.fgm) +
    toNumber(row.ftm) -
    toNumber(row.fga) -
    toNumber(row.fta) +
    toNumber(row.rebounds) +
    toNumber(row.assists) +
    toNumber(row.steals) +
    toNumber(row.blocks) * 0.5 -
    toNumber(row.fouls) -
    toNumber(row.turnovers);

  return round2(value);
};

const buildPlayerPieShareByPlayer = (
  rows: TournamentAnalyticsPlayerGame[]
): Map<number, { average: number; total: number; games: number }> => {
  const byMatchTeam = new Map<string, TournamentAnalyticsPlayerGame[]>();

  rows.forEach((row) => {
    if (!row.teamName) return;
    const key = `${row.matchId}:${row.teamName}`;
    const current = byMatchTeam.get(key) ?? [];
    current.push(row);
    byMatchTeam.set(key, current);
  });

  const byPlayer = new Map<number, { total: number; games: Set<number> }>();

  byMatchTeam.forEach((teamRows) => {
    const pieRows = teamRows.map((row) => ({
      row,
      value: computePieLikeNumerator(row),
    }));
    const minPieValue = pieRows.reduce(
      (min, entry) => Math.min(min, entry.value),
      Number.POSITIVE_INFINITY
    );
    const adjustedPieRows = pieRows.map((entry) => ({
      row: entry.row,
      value:
        minPieValue < 0
          ? entry.value - minPieValue + 0.01
          : entry.value + 0.01,
    }));
    const teamPieTotal = adjustedPieRows.reduce(
      (sum, entry) => sum + entry.value,
      0
    );

    if (teamPieTotal <= 0) {
      return;
    }

    adjustedPieRows.forEach(({ row, value }) => {
      const pieShare = value / teamPieTotal;
      const current = byPlayer.get(row.playerId) ?? {
        total: 0,
        games: new Set<number>(),
      };

      if (!current.games.has(row.matchId)) {
        current.total += pieShare;
        current.games.add(row.matchId);
      }

      byPlayer.set(row.playerId, current);
    });
  });

  const result = new Map<number, { average: number; total: number; games: number }>();
  byPlayer.forEach((entry, playerId) => {
    const games = entry.games.size;
    result.set(playerId, {
      average: games > 0 ? round2(entry.total / games) : 0,
      total: round2(entry.total),
      games,
    });
  });

  return result;
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
  const playersById = new Map<number, { id: number; names: string | null; lastnames: string | null; photo: string | null }>();

  if (playerIds.length > 0) {
    const chunkSize = 200;
    for (let index = 0; index < playerIds.length; index += chunkSize) {
      const chunk = playerIds.slice(index, index + chunkSize);
      const { data: players, error: playersError } = await runSelectWithRetry<
        Array<{ id: number; names: string | null; lastnames: string | null; photo: string | null }>
      >(() =>
        supabase
          .from("players")
          .select("id, names, lastnames, photo")
          .in("id", chunk)
      );

      if (playersError) {
        throw new Error(playersError.message);
      }

      (players ?? []).forEach((player) => {
        playersById.set(player.id, player);
      });
    }
  }
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
      ftm: 0,
      fta: 0,
      ft_pct: 0,
      tpm: 0,
      tpa: 0,
      tp_pct: 0,
      team_name: null,
      phase: "regular",
    };
  });
};

const loadStatsRows = async (tournamentId: string): Promise<EnrichedStatsRow[]> => {
  const { data, error } = await supabase
    .from("tournament_player_stats_enriched")
    .select(
      "tournament_id, match_id, match_date, match_time, game_order, player_id, names, lastnames, team_name, phase, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa"
    )
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .order("match_id", { ascending: true });

  if (!error && data) {
    return (data as Record<string, unknown>[]).map((row) => ({
      tournament_id: String(row.tournament_id ?? tournamentId),
      match_id: toNumber(row.match_id),
      match_date: row.match_date ? String(row.match_date) : null,
      match_time: row.match_time ? String(row.match_time) : null,
      game_order: toNumber(row.game_order),
      player_id: toNumber(row.player_id),
      names: row.names ? String(row.names) : null,
      lastnames: row.lastnames ? String(row.lastnames) : null,
      photo: null,
      points: toNumber(row.points),
      rebounds: toNumber(row.rebounds),
      assists: toNumber(row.assists),
      steals: toNumber(row.steals),
      blocks: toNumber(row.blocks),
      turnovers: toNumber(row.turnovers),
      fouls: toNumber(row.fouls),
      fgm: toNumber(row.fgm),
      fga: toNumber(row.fga),
      fg_pct: computeFgPct(toNumber(row.fgm), toNumber(row.fga)),
      ftm: toNumber(row.ftm),
      fta: toNumber(row.fta),
      ft_pct: computePct(toNumber(row.ftm), toNumber(row.fta)),
      tpm: toNumber(row.tpm),
      tpa: toNumber(row.tpa),
      tp_pct: computePct(toNumber(row.tpm), toNumber(row.tpa)),
      team_name: row.team_name ? String(row.team_name) : null,
      phase: toAnalyticsPhase(row.phase),
    }));
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

const analyticsSnapshotInflight = new Map<TournamentAnalyticsCacheKey, Promise<TournamentAnalyticsSnapshot>>();

const analyticsPlayerLinesCache = new Map<
  TournamentAnalyticsCacheKey,
  {
    revisionKey: string;
    playerLines: PlayerStatsLine[];
  }
>();

const analyticsPlayerLinesInflight = new Map<TournamentAnalyticsCacheKey, Promise<PlayerStatsLine[]>>();

const analyticsRevisionCache = new Map<
  string,
  {
    revisionKey: string;
    fetchedAt: number;
  }
>();

const tournamentPlayersListCache = new Map<
  string,
  {
    fetchedAt: number;
    rows: Array<{ playerId: number; name: string; photo: string | null; teamName: string | null }>;
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
  ftm: toNumber(row.ftm),
  fta: toNumber(row.fta),
  ftPct: computePct(toNumber(row.ftm), toNumber(row.fta)),
  tpm: toNumber(row.tpm),
  tpa: toNumber(row.tpa),
  tpPct: computePct(toNumber(row.tpm), toNumber(row.tpa)),
  fgPct: computeFgPct(toNumber(row.fgm), toNumber(row.fga)),
});

const loadStatsRowsFromAnalyticsView = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<EnrichedStatsRow[] | null> => {
  const selectColumns =
    "tournament_id, match_id, match_date, match_time, game_order, player_id, names, lastnames, team_name, phase, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa";

  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const to = from + ANALYTICS_PLAYER_GAME_PAGE_SIZE - 1;
    let query = supabase
      .from("tournament_analytics_player_game")
      .select(selectColumns)
      .eq("tournament_id", tournamentId)
      .range(from, to);

    if (phaseFilter !== "all") {
      query = query.eq("phase", phaseFilter);
    }

    const { data, error } = await runSelectWithRetry<Record<string, unknown>[]>(() =>
      toSelectPromise<Record<string, unknown>[]>(query)
    );
    if (error || !data) {
      return null;
    }

    const chunk = data as Record<string, unknown>[];
    if (chunk.length === 0) {
      break;
    }

    allRows.push(...chunk);
    if (chunk.length < ANALYTICS_PLAYER_GAME_PAGE_SIZE) {
      break;
    }

    from += ANALYTICS_PLAYER_GAME_PAGE_SIZE;
  }

  return allRows.map((row) => ({
    tournament_id: String(row.tournament_id ?? tournamentId),
    match_id: toNumber(row.match_id),
    match_date: row.match_date ? String(row.match_date) : null,
    match_time: row.match_time ? String(row.match_time) : null,
    game_order: toNumber(row.game_order),
    player_id: toNumber(row.player_id),
    names: row.names ? String(row.names) : null,
    lastnames: row.lastnames ? String(row.lastnames) : null,
    photo: null,
    points: toNumber(row.points),
    rebounds: toNumber(row.rebounds),
    assists: toNumber(row.assists),
    steals: toNumber(row.steals),
    blocks: toNumber(row.blocks),
    turnovers: toNumber(row.turnovers),
    fouls: toNumber(row.fouls),
    fgm: toNumber(row.fgm),
    fga: toNumber(row.fga),
    fg_pct: computeFgPct(toNumber(row.fgm), toNumber(row.fga)),
    ftm: toNumber(row.ftm),
    fta: toNumber(row.fta),
    ft_pct: computePct(toNumber(row.ftm), toNumber(row.fta)),
    tpm: toNumber(row.tpm),
    tpa: toNumber(row.tpa),
    tp_pct: computePct(toNumber(row.tpm), toNumber(row.tpa)),
    team_name: row.team_name ? String(row.team_name) : null,
    phase: toAnalyticsPhase(row.phase),
  }));
};

const mapAnalyticsPlayerGameRow = (
  row: Record<string, unknown>,
  tournamentId: string
): TournamentAnalyticsPlayerGame => {
  const playerId = toNumber(row.player_id);
  const names = row.names ? String(row.names) : null;
  const lastnames = row.lastnames ? String(row.lastnames) : null;

  return {
    tournamentId: String(row.tournament_id ?? tournamentId),
    matchId: toNumber(row.match_id),
    matchDate: row.match_date ? String(row.match_date) : null,
    matchTime: row.match_time ? String(row.match_time) : null,
    gameOrder: toNumber(row.game_order),
    playerId,
    playerName: fullName(names, lastnames) || `Jugador ${playerId}`,
    teamName: row.team_name ? String(row.team_name) : null,
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
    ftm: toNumber(row.ftm),
    fta: toNumber(row.fta),
    ftPct: computePct(toNumber(row.ftm), toNumber(row.fta)),
    tpm: toNumber(row.tpm),
    tpa: toNumber(row.tpa),
    tpPct: computePct(toNumber(row.tpm), toNumber(row.tpa)),
  };
};

const loadPlayerGamesFromAnalyticsView = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter,
  playerId: number
): Promise<TournamentAnalyticsPlayerGame[] | null> => {
  let query = supabase
    .from("tournament_analytics_player_game")
    .select(
      "tournament_id, match_id, match_date, match_time, game_order, player_id, names, lastnames, team_name, phase, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa"
    )
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .order("game_order", { ascending: true })
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .order("match_id", { ascending: true });

  if (phaseFilter !== "all") {
    query = query.eq("phase", phaseFilter);
  }

  const { data, error } = await runSelectWithRetry<Record<string, unknown>[]>(() =>
    toSelectPromise<Record<string, unknown>[]>(query)
  );
  if (error || !data) return null;

  return (data as Record<string, unknown>[]).map((row) =>
    mapAnalyticsPlayerGameRow(row, tournamentId)
  );
};

const loadPlayerTotalsFromAnalyticsView = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<PlayerStatsLine[] | null> => {
  const selectColumns =
    "tournament_id, phase, player_id, names, lastnames, photo, team_name, games_played, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, fg_pct, ftm, fta, ft_pct, tpm, tpa, tp_pct, ppg, rpg, apg, spg, bpg, topg, fpg";
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const to = from + ANALYTICS_PLAYER_TOTALS_PAGE_SIZE - 1;
    let query = supabase
      .from("tournament_analytics_player_totals")
      .select(selectColumns)
      .eq("tournament_id", tournamentId)
      .range(from, to);

    if (phaseFilter !== "all") {
      query = query.eq("phase", phaseFilter);
    }

    const { data, error } = await runSelectWithRetry<Record<string, unknown>[]>(() =>
      toSelectPromise<Record<string, unknown>[]>(query)
    );
    if (error || !data) return null;

    const chunk = data as Record<string, unknown>[];
    if (chunk.length === 0) {
      break;
    }

    allRows.push(...chunk);
    if (chunk.length < ANALYTICS_PLAYER_TOTALS_PAGE_SIZE) {
      break;
    }

    from += ANALYTICS_PLAYER_TOTALS_PAGE_SIZE;
  }

  if (phaseFilter !== "all") {
    return allRows.map((row) => {
      const gamesPlayed = Math.max(0, toNumber(row.games_played));
      const names = row.names ? String(row.names) : null;
      const lastnames = row.lastnames ? String(row.lastnames) : null;
      const playerName = fullName(names, lastnames) || `Jugador ${toNumber(row.player_id)}`;
      const totals: PlayerStatsLine["totals"] = {
        points: toNumber(row.points),
        rebounds: toNumber(row.rebounds),
        assists: toNumber(row.assists),
        steals: toNumber(row.steals),
        blocks: toNumber(row.blocks),
        plusMinus: 0,
        turnovers: toNumber(row.turnovers),
        fouls: toNumber(row.fouls),
        fgm: toNumber(row.fgm),
        fga: toNumber(row.fga),
        ftm: toNumber(row.ftm),
        fta: toNumber(row.fta),
        tpm: toNumber(row.tpm),
        tpa: toNumber(row.tpa),
      };
      const valuation = getLineValuation(totals, gamesPlayed);

      return {
        playerId: toNumber(row.player_id),
        name: playerName,
        photo: row.photo ? String(row.photo) : null,
        teamName: row.team_name ? String(row.team_name) : null,
        gamesPlayed,
        totals,
        perGame: {
          ppg: toNumber(row.ppg),
          rpg: toNumber(row.rpg),
          apg: toNumber(row.apg),
          spg: toNumber(row.spg),
          bpg: toNumber(row.bpg),
          plusMinus: 0,
          topg: toNumber(row.topg),
          fpg: toNumber(row.fpg),
        },
        fgPct: toNumber(row.fg_pct),
        ftPct: toNumber(row.ft_pct) || computePct(toNumber(row.ftm), toNumber(row.fta)),
        tpPct: toNumber(row.tp_pct) || computePct(toNumber(row.tpm), toNumber(row.tpa)),
        ...valuation,
      };
    });
  }

  const merged = new Map<number, PlayerStatsLine>();
  allRows.forEach((row) => {
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
    const ftm = toNumber(row.ftm);
    const fta = toNumber(row.fta);
    const tpm = toNumber(row.tpm);
    const tpa = toNumber(row.tpa);
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
          plusMinus: 0,
          turnovers: 0,
          fouls: 0,
          fgm: 0,
          fga: 0,
          ftm: 0,
          fta: 0,
          tpm: 0,
          tpa: 0,
        },
        perGame: {
          ppg: 0,
          rpg: 0,
          apg: 0,
          spg: 0,
          bpg: 0,
          plusMinus: 0,
          topg: 0,
          fpg: 0,
        },
        fgPct: 0,
        ftPct: 0,
        tpPct: 0,
        valuation: 0,
        valuationPerGame: 0,
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
    current.totals.ftm += ftm;
    current.totals.fta += fta;
    current.totals.tpm += tpm;
    current.totals.tpa += tpa;

    merged.set(playerId, current);
  });

  return Array.from(merged.values()).map((entry) => {
    const valuation = getLineValuation(entry.totals, entry.gamesPlayed);

    return {
      ...entry,
      perGame: {
        ppg: entry.gamesPlayed > 0 ? round2(entry.totals.points / entry.gamesPlayed) : 0,
        rpg: entry.gamesPlayed > 0 ? round2(entry.totals.rebounds / entry.gamesPlayed) : 0,
        apg: entry.gamesPlayed > 0 ? round2(entry.totals.assists / entry.gamesPlayed) : 0,
        spg: entry.gamesPlayed > 0 ? round2(entry.totals.steals / entry.gamesPlayed) : 0,
        bpg: entry.gamesPlayed > 0 ? round2(entry.totals.blocks / entry.gamesPlayed) : 0,
        plusMinus: 0,
        topg: entry.gamesPlayed > 0 ? round2(entry.totals.turnovers / entry.gamesPlayed) : 0,
        fpg: entry.gamesPlayed > 0 ? round2(entry.totals.fouls / entry.gamesPlayed) : 0,
      },
      fgPct: computeFgPct(entry.totals.fgm, entry.totals.fga),
      ftPct: computePct(entry.totals.ftm, entry.totals.fta),
      tpPct: computePct(entry.totals.tpm, entry.totals.tpa),
      ...valuation,
    };
  });
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

  const { data, error } = await runSelectWithRetry<Array<{ team_name: string; win_pct: number }>>(() => query);
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
  const cached = analyticsRevisionCache.get(tournamentId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt <= REVISION_CACHE_TTL_MS) {
    return cached.revisionKey;
  }

  const [latestMatchResult, latestStatsResult] = await Promise.all([
    runSelectWithRetry<Array<{ id: number }>>(() =>
      supabase
        .from("matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: false })
        .limit(1)
    ),
    runSelectWithRetry<Array<{ id: number }>>(() =>
      supabase
        .from("player_stats")
        .select("id")
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: false })
        .limit(1)
    ),
  ]);

  const matchId = latestMatchResult.data?.[0]?.id ?? 0;
  const statId = latestStatsResult.data?.[0]?.id ?? 0;
  const revisionKey = `${matchId}:${statId}`;

  analyticsRevisionCache.set(tournamentId, {
    revisionKey,
    fetchedAt: now,
  });

  return revisionKey;
};

export const clearTournamentAnalyticsCache = (tournamentId?: string) => {
  if (!tournamentId) {
    analyticsSnapshotCache.clear();
    analyticsSnapshotInflight.clear();
    analyticsPlayerLinesCache.clear();
    analyticsPlayerLinesInflight.clear();
    analyticsRevisionCache.clear();
    tournamentPlayersListCache.clear();
    return;
  }

  for (const key of analyticsSnapshotCache.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      analyticsSnapshotCache.delete(key);
    }
  }

  for (const key of analyticsSnapshotInflight.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      analyticsSnapshotInflight.delete(key);
    }
  }

  for (const key of analyticsPlayerLinesCache.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      analyticsPlayerLinesCache.delete(key);
    }
  }

  for (const key of analyticsPlayerLinesInflight.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      analyticsPlayerLinesInflight.delete(key);
    }
  }

  for (const key of tournamentPlayersListCache.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      tournamentPlayersListCache.delete(key);
    }
  }

  analyticsRevisionCache.delete(tournamentId);
};

export const getTournamentAnalyticsSnapshot = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter = "all",
  options?: { forceRefresh?: boolean }
): Promise<TournamentAnalyticsSnapshot> => {
  const cacheKey = `${tournamentId}:${phaseFilter}` as TournamentAnalyticsCacheKey;
  if (!options?.forceRefresh) {
    const inflight = analyticsSnapshotInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  }

  const loader = (async (): Promise<TournamentAnalyticsSnapshot> => {
  const revisionKey = await getAnalyticsRevisionKey(tournamentId);

  if (!options?.forceRefresh) {
    const cached = analyticsSnapshotCache.get(cacheKey);
    if (cached && cached.revisionKey === revisionKey) {
      return cached.snapshot;
    }
  }

    const [statsRowsFromView, playerLinesFromView] = await Promise.all([
      loadStatsRowsFromAnalyticsView(tournamentId, phaseFilter),
      loadPlayerTotalsFromAnalyticsView(tournamentId, phaseFilter),
    ]);

    let statsRows = statsRowsFromView;
    if (!statsRows) {
      try {
        const fallbackRows = await loadStatsRows(tournamentId);
        statsRows =
          phaseFilter === "all"
            ? fallbackRows
            : fallbackRows.filter((row) => inPhase(row.phase, phaseFilter));
      } catch (error) {
        console.warn("Fallback de analytics rows fallo; se intentara continuar con totales agregados.", error);
        statsRows = [];
      }
    }

    let playerLines = playerLinesFromView;
    if (!playerLines) {
      playerLines = statsRows.length > 0 ? buildPlayerLines(statsRows, "all") : [];
    }

    if (playerLines.length === 0 && statsRows.length === 0) {
      throw new Error("No se pudieron cargar datos de analytics para este torneo.");
    }

    const playerGames = statsRows.map(toAnalyticsPlayerGame);
    playerLines = applyPlusMinusToPlayerLines(playerLines, playerGames);
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
  })();

  if (!options?.forceRefresh) {
    analyticsSnapshotInflight.set(cacheKey, loader);
  }

  try {
    return await loader;
  } finally {
    analyticsSnapshotInflight.delete(cacheKey);
  }
};

const buildMvpRowsFromSnapshot = (
  snapshot: TournamentAnalyticsSnapshot,
  eligibilityRate = 0.3
): MvpBreakdownRow[] => {
  const pieShareByPlayer = buildPlayerPieShareByPlayer(snapshot.playerGames);

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
    const availabilityRate = teamGames > 0 ? Math.min(1, line.gamesPlayed / teamGames) : 0;
    const tsPct = computeTrueShootingPct(
      line.totals.points,
      line.totals.fga,
      line.totals.fta
    );
    const pieShare = pieShareByPlayer.get(line.playerId)?.average ?? 0;

    return {
      line,
      eligible: line.gamesPlayed >= minGames,
      minGames,
      teamFactor,
      availabilityRate,
      tsPct,
      pieShare,
    };
  });

  const eligibleInput = scoresInput.filter((entry) => entry.eligible);
  if (eligibleInput.length === 0) {
    return [];
  }

  const scored = computeMvpScores(
    eligibleInput.map((entry) => ({
      playerId: entry.line.playerId,
      ppg: entry.line.perGame.ppg,
      rpg: entry.line.perGame.rpg,
      apg: entry.line.perGame.apg,
      spg: entry.line.perGame.spg,
      bpg: entry.line.perGame.bpg,
      topg: entry.line.perGame.topg,
      fpg: entry.line.perGame.fpg,
      tsPct: entry.tsPct,
      fgPct: entry.line.fgPct,
      tpPct: entry.line.tpPct,
      pieShare: entry.pieShare,
      praPerGame: round2(
        entry.line.perGame.ppg + entry.line.perGame.rpg + entry.line.perGame.apg - entry.line.perGame.topg
      ),
      valuationPerGame: entry.line.valuationPerGame,
      teamFactor: entry.teamFactor,
      availabilityRate: entry.availabilityRate,
    }))
  );

  return eligibleInput
    .map((entry) => {
      const details = scored[entry.line.playerId];
      if (!details) return null;
      return {
        ...entry.line,
        eligible: entry.eligible,
        eligibilityThreshold: entry.minGames,
        teamFactor: details.teamFactor,
        availabilityRate: entry.availabilityRate,
        tsPct: entry.tsPct,
        pieShare: entry.pieShare,
        z: details.z,
        componentScore: details.componentScore,
        finalScore: details.finalScore,
      };
    })
    .filter((row): row is MvpBreakdownRow => Boolean(row))
    .sort((a, b) => b.finalScore - a.finalScore);
};

const buildMvpRowsFromPlayerLines = (
  playerLines: PlayerStatsLine[],
  teamFactorMap: Map<string, number>,
  eligibilityRate = 0.3
): MvpBreakdownRow[] => {
  const teamGamesMap = new Map<string, number>();
  const teamValuationMap = new Map<string, number>();

  playerLines.forEach((line) => {
    if (!line.teamName) return;
    const currentTeamGames = teamGamesMap.get(line.teamName) ?? 0;
    teamGamesMap.set(line.teamName, Math.max(currentTeamGames, line.gamesPlayed));

    const currentTeamVal = teamValuationMap.get(line.teamName) ?? 0;
    teamValuationMap.set(line.teamName, currentTeamVal + Math.max(0, line.valuationPerGame));
  });

  const scoredInput = playerLines.map((line) => {
    const teamGames = line.teamName ? teamGamesMap.get(line.teamName) ?? 0 : 0;
    const minGames = Math.max(1, Math.ceil(teamGames * eligibilityRate));
    const teamFactor = line.teamName ? teamFactorMap.get(line.teamName) ?? 0 : 0;
    const availabilityRate = teamGames > 0 ? Math.min(1, line.gamesPlayed / teamGames) : 0;
    const tsPct = computeTrueShootingPct(line.totals.points, line.totals.fga, line.totals.fta);
    const teamValuation = line.teamName ? teamValuationMap.get(line.teamName) ?? 0 : 0;
    const pieShare =
      teamValuation > 0 ? round2(Math.max(0, line.valuationPerGame) / teamValuation) : 0;

    return {
      line,
      eligible: line.gamesPlayed >= minGames,
      minGames,
      teamFactor,
      availabilityRate,
      tsPct,
      pieShare,
    };
  });

  const eligibleInput = scoredInput.filter((entry) => entry.eligible);
  if (eligibleInput.length === 0) return [];

  const scored = computeMvpScores(
    eligibleInput.map((entry) => ({
      playerId: entry.line.playerId,
      ppg: entry.line.perGame.ppg,
      rpg: entry.line.perGame.rpg,
      apg: entry.line.perGame.apg,
      spg: entry.line.perGame.spg,
      bpg: entry.line.perGame.bpg,
      topg: entry.line.perGame.topg,
      fpg: entry.line.perGame.fpg,
      tsPct: entry.tsPct,
      fgPct: entry.line.fgPct,
      tpPct: entry.line.tpPct,
      pieShare: entry.pieShare,
      praPerGame: round2(
        entry.line.perGame.ppg + entry.line.perGame.rpg + entry.line.perGame.apg - entry.line.perGame.topg
      ),
      valuationPerGame: entry.line.valuationPerGame,
      teamFactor: entry.teamFactor,
      availabilityRate: entry.availabilityRate,
    }))
  );

  return eligibleInput
    .map((entry) => {
      const details = scored[entry.line.playerId];
      if (!details) return null;
      return {
        ...entry.line,
        eligible: entry.eligible,
        eligibilityThreshold: entry.minGames,
        teamFactor: details.teamFactor,
        availabilityRate: entry.availabilityRate,
        tsPct: entry.tsPct,
        pieShare: entry.pieShare,
        z: details.z,
        componentScore: details.componentScore,
        finalScore: details.finalScore,
      };
    })
    .filter((row): row is MvpBreakdownRow => Boolean(row))
    .sort((a, b) => b.finalScore - a.finalScore);
};

const loadAnalyticsSummary = async (
  tournamentId: string,
  phase: Exclude<TournamentPhaseFilter, "all">
): Promise<{ gamesAnalyzed: number; playersAnalyzed: number } | null> => {
  const { data, error } = await runSelectWithRetry<
    Array<{ games_analyzed: number; players_analyzed: number }>
  >(() =>
    supabase
      .from("tournament_analytics_summary")
      .select("games_analyzed, players_analyzed")
      .eq("tournament_id", tournamentId)
      .eq("phase", phase)
      .limit(1)
  );

  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    gamesAnalyzed: toNumber(row.games_analyzed),
    playersAnalyzed: toNumber(row.players_analyzed),
  };
};

const loadTeamFactorMapForPhase = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<Map<string, number>> => {
  const phaseForTeamFactor: TournamentPhaseFilter =
    phaseFilter === "all" ? "regular" : phaseFilter;

  let teamFactors = await loadTeamFactorFromView(tournamentId, phaseForTeamFactor);
  if (teamFactors) return teamFactors;

  if (phaseForTeamFactor === "regular") {
    teamFactors = await getTeamWinPct(tournamentId);
  } else {
    teamFactors = new Map<string, number>();
  }

  return teamFactors;
};

const getTournamentPlayerLines = async (
  tournamentId: string,
  phaseFilter: TournamentPhaseFilter
): Promise<PlayerStatsLine[]> => {
  const cacheKey = `${tournamentId}:${phaseFilter}` as TournamentAnalyticsCacheKey;
  const inflight = analyticsPlayerLinesInflight.get(cacheKey);
  if (inflight) return inflight;

  const loader = (async (): Promise<PlayerStatsLine[]> => {
    const revisionKey = await getAnalyticsRevisionKey(tournamentId);
    const cached = analyticsPlayerLinesCache.get(cacheKey);
    if (cached && cached.revisionKey === revisionKey) {
      return cached.playerLines;
    }

    let playerLines = await loadPlayerTotalsFromAnalyticsView(tournamentId, phaseFilter);
    if (!playerLines) {
      let statsRows = await loadStatsRowsFromAnalyticsView(tournamentId, phaseFilter);
      if (!statsRows) {
        const fallbackRows = await loadStatsRows(tournamentId);
        statsRows =
          phaseFilter === "all"
            ? fallbackRows
            : fallbackRows.filter((row) => inPhase(row.phase, phaseFilter));
      }
      playerLines = statsRows.length > 0 ? buildPlayerLines(statsRows, "all") : [];
    }

    playerLines = await hydrateMissingPlayerPhotos(playerLines);

    analyticsPlayerLinesCache.set(cacheKey, {
      revisionKey,
      playerLines,
    });

    return playerLines;
  })();

  analyticsPlayerLinesInflight.set(cacheKey, loader);
  try {
    return await loader;
  } finally {
    analyticsPlayerLinesInflight.delete(cacheKey);
  }
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

  const playerLines = await getTournamentPlayerLines(params.tournamentId, phase);

  return playerLines
    .map((line) => {
      const value =
        metric === "fg_pct"
          ? line.fgPct
          : metric === "defensive_impact"
            ? computeDefensiveImpactPerGame(line)
          : metric === "pra"
            ? line.gamesPlayed > 0
              ? round2(
                  (line.totals.points + line.totals.rebounds + line.totals.assists - line.totals.turnovers) /
                    line.gamesPlayed
                )
              : 0
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
  metric: Exclude<TournamentStatMetric, "fg_pct" | "pra" | "defensive_impact">;
  topN?: number;
}): Promise<RaceSeriesPlayer[]> => {
  const phase = params.phase ?? "regular";
  const topN = params.topN ?? 10;
  const playerLines = await getTournamentPlayerLines(params.tournamentId, phase);

  const topPlayers = [...playerLines]
    .sort(
      (a, b) =>
        toNumber(b.totals[params.metric as keyof PlayerStatsLine["totals"]]) -
        toNumber(a.totals[params.metric as keyof PlayerStatsLine["totals"]])
    )
    .slice(0, topN);

  if (topPlayers.length === 0) {
    return [];
  }

  const topSet = new Set(topPlayers.map((player) => player.playerId));
  const grouped = new Map<number, RaceSeriesPoint[]>();

  const selectColumns = `player_id, match_id, match_date, match_time, game_order, ${params.metric}`;
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const to = from + ANALYTICS_PLAYER_GAME_PAGE_SIZE - 1;
    let query = supabase
      .from("tournament_analytics_player_game")
      .select(selectColumns)
      .eq("tournament_id", params.tournamentId)
      .in("player_id", Array.from(topSet))
      .range(from, to);

    if (phase !== "all") {
      query = query.eq("phase", phase);
    }

    const { data, error } = await runSelectWithRetry<Record<string, unknown>[]>(() =>
      toSelectPromise<Record<string, unknown>[]>(query)
    );
    if (error || !data) {
      const snapshot = await getTournamentAnalyticsSnapshot(params.tournamentId, phase);
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
    }

    const chunk = data as Record<string, unknown>[];
    if (chunk.length === 0) break;
    allRows.push(...chunk);
    if (chunk.length < ANALYTICS_PLAYER_GAME_PAGE_SIZE) break;
    from += ANALYTICS_PLAYER_GAME_PAGE_SIZE;
  }

  allRows
    .map((row) => ({
      playerId: toNumber(row.player_id),
      matchId: toNumber(row.match_id),
      matchDate: row.match_date ? String(row.match_date) : "",
      matchTime: row.match_time ? String(row.match_time) : "",
      gameOrder: toNumber(row.game_order),
      value: toNumber(row[params.metric]),
    }))
    .filter((row) => topSet.has(row.playerId))
    .sort((a, b) => {
      if (a.playerId !== b.playerId) return a.playerId - b.playerId;
      if (a.gameOrder !== b.gameOrder) return a.gameOrder - b.gameOrder;
      if (a.matchDate !== b.matchDate) return a.matchDate.localeCompare(b.matchDate);
      if (a.matchTime !== b.matchTime) return a.matchTime.localeCompare(b.matchTime);
      return a.matchId - b.matchId;
    })
    .forEach((row) => {
      const current = grouped.get(row.playerId) ?? [];
      const previousCumulative = current.length > 0 ? current[current.length - 1].cumulative : 0;

      current.push({
        matchId: row.matchId,
        gameIndex: current.length + 1,
        date: row.matchDate,
        value: row.value,
        cumulative: round2(previousCumulative + row.value),
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

export const getTournamentPlayerLinesFast = async (
  tournamentId: string,
  phase: TournamentPhaseFilter = "all"
): Promise<PlayerStatsLine[]> => getTournamentPlayerLines(tournamentId, phase);

export const getTournamentPlayerDetailFast = async (params: {
  tournamentId: string;
  playerId: number;
  phase?: TournamentPhaseFilter;
  forceRefresh?: boolean;
}): Promise<{ line: PlayerStatsLine; games: TournamentAnalyticsPlayerGame[] }> => {
  const phase = params.phase ?? "all";
  const [playerLines, playerGamesFromView] = await Promise.all([
    getTournamentPlayerLines(params.tournamentId, phase),
    loadPlayerGamesFromAnalyticsView(params.tournamentId, phase, params.playerId),
  ]);

  const line = playerLines.find((item) => item.playerId === params.playerId);

  if (line && playerGamesFromView) {
    return {
      line,
      games: playerGamesFromView,
    };
  }

  const snapshot = await getTournamentAnalyticsSnapshot(params.tournamentId, phase, {
    forceRefresh: Boolean(params.forceRefresh),
  });
  const fallbackLine = snapshot.playerLines.find((item) => item.playerId === params.playerId);
  if (!line && !fallbackLine) {
    throw new Error("No se encontró data analítica para este jugador en la fase seleccionada.");
  }

  const games = snapshot.playerGames
    .filter((item) => item.playerId === params.playerId)
    .sort((a, b) => {
      if (a.gameOrder !== b.gameOrder) return a.gameOrder - b.gameOrder;
      const dateA = a.matchDate ?? "";
      const dateB = b.matchDate ?? "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.matchTime ?? "";
      const timeB = b.matchTime ?? "";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return a.matchId - b.matchId;
    });

  return {
    line: line ?? fallbackLine!,
    games,
  };
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

export const getMvpRaceFast = async (params: {
  tournamentId: string;
  phase?: Exclude<TournamentPhaseFilter, "all">;
  eligibilityRate?: number;
}): Promise<MvpBreakdownRow[]> => {
  const phase = params.phase ?? "regular";
  const eligibilityRate = params.eligibilityRate ?? 0.3;
  const [playerLines, teamFactorMap] = await Promise.all([
    getTournamentPlayerLines(params.tournamentId, phase),
    loadTeamFactorMapForPhase(params.tournamentId, phase),
  ]);

  return buildMvpRowsFromPlayerLines(playerLines, teamFactorMap, eligibilityRate);
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
  const [playerLines, teamFactorMap] = await Promise.all([
    getTournamentPlayerLines(params.tournamentId, phase),
    loadTeamFactorMapForPhase(params.tournamentId, phase),
  ]);
  const lines = playerLines.filter((line) => uniquePlayerIds.includes(line.playerId));

  if (lines.length !== 2) {
    throw new Error("No hay datos suficientes para comparar esos 2 jugadores en la fase seleccionada.");
  }
  const mvpRows = buildMvpRowsFromPlayerLines(playerLines, teamFactorMap, 0.3);

  const mvpByPlayer = new Map(mvpRows.map((row) => [row.playerId, row.finalScore]));

  const players: BattlePlayerResult[] = lines.map((line) => ({
    playerId: line.playerId,
    name: line.name,
    photo: line.photo ?? null,
    teamName: line.teamName,
    metrics: {
      ppg: line.perGame.ppg,
      rpg: line.perGame.rpg,
      apg: line.perGame.apg,
      spg: line.perGame.spg,
      bpg: line.perGame.bpg,
      pra: round2(line.perGame.ppg + line.perGame.rpg + line.perGame.apg - line.perGame.topg),
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
  const [playerLines, teamFactorMap, summary] = await Promise.all([
    getTournamentPlayerLines(tournamentId, "regular"),
    loadTeamFactorMapForPhase(tournamentId, "regular"),
    loadAnalyticsSummary(tournamentId, "regular"),
  ]);
  const leaderByPoints = [...playerLines]
    .sort((a, b) => b.totals.points - a.totals.points)[0];
  const leaderByMvp = buildMvpRowsFromPlayerLines(playerLines, teamFactorMap, 0.3)[0];

  return [
    {
      id: "players",
      label: "Jugadores activos",
      value: summary?.playersAnalyzed ?? playerLines.length,
      helper: "Con al menos un juego en temporada regular",
    },
    {
      id: "games",
      label: "Juegos analizados",
      value: summary?.gamesAnalyzed ?? 0,
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
    .maybeSingle();

  if (error || !data) {
    return {
      tournamentId,
      seasonType: "regular_plus_playoffs",
      playoffFormat: { ...DEFAULT_PLAYOFF_FORMAT },
      rulesPdfUrl: null,
    };
  }

  const rawPlayoffFormat =
    typeof data.playoff_format === "object" && data.playoff_format
      ? (data.playoff_format as Record<string, unknown>)
      : ({ ...DEFAULT_PLAYOFF_FORMAT } as Record<string, unknown>);

  const rawRulesPdfUrl = rawPlayoffFormat["rules_pdf_url"] ?? rawPlayoffFormat["rulesPdfUrl"];
  const rulesPdfUrl =
    typeof rawRulesPdfUrl === "string" && rawRulesPdfUrl.trim().length > 0 ? rawRulesPdfUrl.trim() : null;

  return {
    tournamentId: data.tournament_id,
    seasonType: data.season_type,
    playoffFormat:
      typeof data.playoff_format === "object" && data.playoff_format
        ? data.playoff_format
        : { ...DEFAULT_PLAYOFF_FORMAT },
    rulesPdfUrl,
  } as TournamentSettings;
};

export const saveTournamentSettings = async (settings: TournamentSettings): Promise<void> => {
  const playoffFormatPayload: Record<string, unknown> = {
    ...settings.playoffFormat,
    rules_pdf_url: settings.rulesPdfUrl,
  };

  const { error } = await supabase.from("tournament_settings").upsert(
    {
      tournament_id: settings.tournamentId,
      season_type: settings.seasonType,
      playoff_format: playoffFormatPayload,
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

export const syncMatchParticipantsFromCurrentTeams = async (params: {
  matchId: number;
  tournamentId: string;
  teamA: string | null;
  teamB: string | null;
}): Promise<void> => {
  const teamNameA = params.teamA?.trim() ?? "";
  const teamNameB = params.teamB?.trim() ?? "";
  const namesToResolve = [teamNameA, teamNameB].filter((name) => name.length > 0);
  if (namesToResolve.length === 0) return;

  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("tournament_id", params.tournamentId)
    .in("name", namesToResolve);

  if (teamsError) {
    throw new Error(teamsError.message);
  }

  const teams = (teamsData ?? []) as Array<{ id: number; name: string }>;
  if (teams.length === 0) return;

  const teamIds = teams.map((team) => team.id).filter((teamId) => Number.isFinite(Number(teamId)));
  if (teamIds.length === 0) return;

  let rosterRows: Array<{ team_id: number; player_id: number }> = [];
  const { data: scopedRosterRows, error: scopedRosterError } = await supabase
    .from("team_players")
    .select("team_id, player_id")
    .eq("tournament_id", params.tournamentId)
    .in("team_id", teamIds);

  if (!scopedRosterError) {
    rosterRows = (scopedRosterRows ?? []) as Array<{ team_id: number; player_id: number }>;
  } else if (
    isMissingTeamPlayersTournamentColumnError(scopedRosterError.message) ||
    isStatementTimeoutError(scopedRosterError.message)
  ) {
    const { data: legacyRosterRows, error: legacyRosterError } = await supabase
      .from("team_players")
      .select("team_id, player_id")
      .in("team_id", teamIds);

    if (legacyRosterError) {
      throw new Error(legacyRosterError.message);
    }

    rosterRows = (legacyRosterRows ?? []) as Array<{ team_id: number; player_id: number }>;
  } else {
    throw new Error(scopedRosterError.message);
  }

  const teamIdByName = new Map<string, number>(
    teams.map((team) => [String(team.name ?? "").trim(), Number(team.id)])
  );
  const playersByTeamId = new Map<number, number[]>();
  rosterRows.forEach((row) => {
    const teamId = Number(row.team_id);
    const playerId = Number(row.player_id);
    if (!Number.isFinite(teamId) || !Number.isFinite(playerId)) return;
    const current = playersByTeamId.get(teamId) ?? [];
    current.push(playerId);
    playersByTeamId.set(teamId, current);
  });

  const { data: existingParticipants, error: participantsError } = await supabase
    .from("match_players")
    .select("player_id, team")
    .eq("match_id", params.matchId);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const existingTeamByPlayerId = new Map<number, "A" | "B">();
  (existingParticipants ?? []).forEach((row) => {
    const playerId = Number(row.player_id);
    if (!Number.isFinite(playerId)) return;

    if (row.team === "A" || row.team === "B") {
      existingTeamByPlayerId.set(playerId, row.team);
    }
  });

  const toInsert: Array<{ match_id: number; player_id: number; team: "A" | "B" }> = [];
  const toUpdate: Array<{ player_id: number; team: "A" | "B" }> = [];

  const pushFromTeam = (teamName: string, side: "A" | "B") => {
    if (!teamName) return;
    const teamId = teamIdByName.get(teamName);
    if (!teamId) return;

    const playerIds = playersByTeamId.get(teamId) ?? [];
    playerIds.forEach((playerId) => {
      const existingSide = existingTeamByPlayerId.get(playerId);
      if (existingSide === side) return;

      if (existingSide === "A" || existingSide === "B") {
        toUpdate.push({ player_id: playerId, team: side });
        return;
      }

      toInsert.push({
        match_id: params.matchId,
        player_id: playerId,
        team: side,
      });
    });
  };

  pushFromTeam(teamNameA, "A");
  pushFromTeam(teamNameB, "B");

  if (toUpdate.length > 0) {
    for (const row of toUpdate) {
      const { error: updateError } = await supabase
        .from("match_players")
        .update({ team: row.team })
        .eq("match_id", params.matchId)
        .eq("player_id", row.player_id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }
  }

  if (toInsert.length === 0) return;

  const { error: insertError } = await supabase.from("match_players").insert(toInsert);
  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }
};

export const saveMatchStats = async (payload: {
  matchId: number;
  winnerTeam: string;
  playerStats: MatchPlayerStatsInput[];
}): Promise<void> => {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, tournament_id, winner_team, team_a, team_b")
    .eq("id", payload.matchId)
    .single();

  if (matchError || !match) {
    throw new Error(matchError?.message ?? "No se encontró el partido.");
  }

  const tournamentId = typeof match.tournament_id === "string" ? match.tournament_id : "";
  if (tournamentId) {
    try {
      await syncMatchParticipantsFromCurrentTeams({
        matchId: payload.matchId,
        tournamentId,
        teamA: match.team_a ?? null,
        teamB: match.team_b ?? null,
      });
    } catch (syncError) {
      console.warn("No se pudo sincronizar match_players con la plantilla actual. Se continuara con los participantes existentes.", syncError);
    }
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
      ftm: Math.max(0, Math.floor(toNumber(row.ftm))),
      fta: Math.max(0, Math.floor(toNumber(row.fta))),
      tpm: Math.max(0, Math.floor(toNumber(row.tpm))),
      tpa: Math.max(0, Math.floor(toNumber(row.tpa))),
    };

    if (!participantIds.has(normalized.playerId)) {
      throw new Error(`El jugador ${normalized.playerId} no está asignado a este partido.`);
    }

    if (normalized.fgm > normalized.fga) {
      throw new Error(`FGM no puede ser mayor que FGA para el jugador ${normalized.playerId}.`);
    }

    if (normalized.ftm > normalized.fta) {
      throw new Error(`FTM no puede ser mayor que FTA para el jugador ${normalized.playerId}.`);
    }

    if (normalized.tpm > normalized.tpa) {
      throw new Error(`3PM no puede ser mayor que 3PA para el jugador ${normalized.playerId}.`);
    }

    if (normalized.tpa > normalized.fga) {
      throw new Error(`3PA no puede ser mayor que FGA para el jugador ${normalized.playerId}.`);
    }

    if (normalized.tpm > normalized.fgm) {
      throw new Error(`3PM no puede ser mayor que FGM para el jugador ${normalized.playerId}.`);
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
    ftm: row.ftm,
    fta: row.fta,
    tpm: row.tpm,
    tpa: row.tpa,
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
): Promise<Array<{ playerId: number; name: string; photo: string | null; teamName: string | null }>> => {
  const cacheKey = `${tournamentId}:${phase}`;
  const cached = tournamentPlayersListCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt <= TOURNAMENT_PLAYER_LIST_CACHE_TTL_MS) {
    return cached.rows;
  }

  const { data: teamsData, error: teamsError } = await runSelectWithRetry<
    Array<{ id: number; name: string | null }>
  >(() =>
    supabase
      .from("teams")
      .select("id, name")
      .eq("tournament_id", tournamentId)
  );

  if (teamsError) {
    throw new Error(teamsError.message);
  }

  const teamRows = (teamsData ?? []) as Array<{ id: number; name: string | null }>;
  const teamIds = teamRows.map((row) => toNumber(row.id)).filter((id) => id > 0);
  if (teamIds.length === 0) {
    tournamentPlayersListCache.set(cacheKey, { fetchedAt: Date.now(), rows: [] });
    return [];
  }

  let linksRows: Array<{ team_id: number; player_id: number }> = [];
  const { data: scopedLinksData, error: scopedLinksError } = await runSelectWithRetry<
    Array<{ team_id: number; player_id: number }>
  >(() =>
    supabase
      .from("team_players")
      .select("team_id, player_id")
      .eq("tournament_id", tournamentId)
      .in("team_id", teamIds)
  );

  if (!scopedLinksError) {
    linksRows = (scopedLinksData ?? []) as Array<{ team_id: number; player_id: number }>;
  } else if (
    isMissingTeamPlayersTournamentColumnError(scopedLinksError.message) ||
    isStatementTimeoutError(scopedLinksError.message)
  ) {
    const { data: legacyLinksData, error: legacyLinksError } = await runSelectWithRetry<
      Array<{ team_id: number; player_id: number }>
    >(() =>
      supabase
        .from("team_players")
        .select("team_id, player_id")
        .in("team_id", teamIds)
    );

    if (legacyLinksError) {
      throw new Error(legacyLinksError.message);
    }

    linksRows = (legacyLinksData ?? []) as Array<{ team_id: number; player_id: number }>;
  } else {
    throw new Error(scopedLinksError.message);
  }

  const uniquePlayerIds = Array.from(
    new Set(linksRows.map((row) => toNumber(row.player_id)).filter((id) => id > 0))
  );
  if (uniquePlayerIds.length === 0) {
    tournamentPlayersListCache.set(cacheKey, { fetchedAt: Date.now(), rows: [] });
    return [];
  }

  const playerChunks = chunkArray(uniquePlayerIds, TOURNAMENT_PLAYER_IDS_CHUNK);
  const activeRowsPromise: Promise<QueryResult<Array<{ player_id: number }>>> =
    phase !== "all"
      ? runSelectWithRetry<Array<{ player_id: number }>>(() =>
          supabase
            .from("tournament_analytics_player_totals")
            .select("player_id")
            .eq("tournament_id", tournamentId)
            .eq("phase", phase)
        )
      : Promise.resolve({ data: null, error: null });

  const [playerChunkResults, activeRowsResult] = await Promise.all([
    Promise.all(
      playerChunks.map((idChunk) =>
        runSelectWithRetry<
          Array<{ id: number; names: string | null; lastnames: string | null; photo: string | null }>
        >(() =>
          supabase
            .from("players")
            .select("id, names, lastnames, photo")
            .in("id", idChunk)
        )
      )
    ),
    activeRowsPromise,
  ]);

  const playersById = new Map<number, { names: string; lastnames: string; photo: string | null }>();
  playerChunkResults.forEach(({ data: playersData, error: playersError }) => {
    if (playersError || !playersData) return;

    playersData.forEach((row) => {
      const playerId = toNumber(row.id);
      if (playerId <= 0) return;
      playersById.set(playerId, {
        names: toSafeText(row.names),
        lastnames: toSafeText(row.lastnames),
        photo: toSafeText(row.photo) || null,
      });
    });
  });

  let activePlayerIds: Set<number> | null = null;
  if (!activeRowsResult.error && activeRowsResult.data) {
    activePlayerIds = new Set(
      activeRowsResult.data.map((row) => toNumber(row.player_id)).filter((id) => id > 0)
    );
  }

  const teamNameById = new Map(
    teamRows.map((row) => [toNumber(row.id), toSafeText(row.name)])
  );
  const rowsByPlayerId = new Map<
    number,
    { playerId: number; name: string; photo: string | null; teamName: string | null }
  >();

  linksRows.forEach((row) => {
    const playerId = toNumber(row.player_id);
    const teamId = toNumber(row.team_id);
    if (playerId <= 0) return;
    if (activePlayerIds && !activePlayerIds.has(playerId)) return;
    if (rowsByPlayerId.has(playerId)) return;

    const player = playersById.get(playerId);
    const name = fullName(player?.names, player?.lastnames) || `Jugador ${playerId}`;
    const teamName = teamNameById.get(teamId) || null;

    rowsByPlayerId.set(playerId, {
      playerId,
      name,
      photo: player?.photo ?? null,
      teamName,
    });
  });

  const rows = Array.from(rowsByPlayerId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );

  tournamentPlayersListCache.set(cacheKey, {
    fetchedAt: Date.now(),
    rows,
  });

  return rows;
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
  const ftm = toNumber(row.ftm);
  const fta = toNumber(row.fta);
  const tpm = toNumber(row.tpm);
  const tpa = toNumber(row.tpa);

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
    plusMinus: 0,
    turnovers: toNumber(row.turnovers),
    fouls: toNumber(row.fouls),
    fgm,
    fga,
    fgPct: toNumber(row.fg_pct) || computeFgPct(fgm, fga),
    ftm,
    fta,
    ftPct: toNumber(row.ft_pct) || computePct(ftm, fta),
    tpm,
    tpa,
    tpPct: toNumber(row.tp_pct) || computePct(tpm, tpa),
  };
};

const loadMatchBoxscoreFromView = async (
  tournamentId: string,
  matchId: number
): Promise<TournamentResultBoxscoreRow[] | null> => {
  const { data, error } = await supabase
    .from("tournament_player_stats_enriched")
    .select(
      "player_id, names, lastnames, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, fg_pct, ftm, fta, ft_pct, tpm, tpa, tp_pct, team_side"
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
      "player_id, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa, player:players(id, names, lastnames)"
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
      ftm: 0,
      fta: 0,
      tpm: 0,
      tpa: 0,
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
    const ftm = toNumber(row.ftm);
    const fta = toNumber(row.fta);
    const tpm = toNumber(row.tpm);
    const tpa = toNumber(row.tpa);

    return {
      playerId,
      teamSide: sideByPlayer.get(playerId) ?? "U",
      playerName: `${names} ${lastnames}`.trim() || `Jugador ${playerId}`,
      points: toNumber(row.points),
      rebounds: toNumber(row.rebounds),
      assists: toNumber(row.assists),
      steals: toNumber(row.steals),
      blocks: toNumber(row.blocks),
      plusMinus: 0,
      turnovers: toNumber(row.turnovers),
      fouls: toNumber(row.fouls),
      fgm,
      fga,
      fgPct: computeFgPct(fgm, fga),
      ftm,
      fta,
      ftPct: computePct(ftm, fta),
      tpm,
      tpa,
      tpPct: computePct(tpm, tpa),
    };
  });
};

const applyPlusMinusToBoxscoreRows = (
  rows: TournamentResultBoxscoreRow[]
): TournamentResultBoxscoreRow[] => {
  const teamRows = new Map<"A" | "B", TournamentResultBoxscoreRow[]>();
  rows.forEach((row) => {
    if (row.teamSide !== "A" && row.teamSide !== "B") return;
    const current = teamRows.get(row.teamSide) ?? [];
    current.push(row);
    teamRows.set(row.teamSide, current);
  });

  if (teamRows.size < 2) {
    return rows.map((row) => ({ ...row, plusMinus: 0 }));
  }

  const teamPoints = new Map<"A" | "B", number>();
  teamRows.forEach((sideRows, side) => {
    teamPoints.set(
      side,
      sideRows.reduce((sum, row) => sum + toNumber(row.points), 0)
    );
  });
  const pointsA = teamPoints.get("A") ?? 0;
  const pointsB = teamPoints.get("B") ?? 0;

  return rows.map((row) => ({
    ...row,
    plusMinus:
      row.teamSide === "A"
        ? round2(pointsA - pointsB)
        : row.teamSide === "B"
          ? round2(pointsB - pointsA)
          : 0,
  }));
};

export const getMatchBoxscore = async (
  tournamentId: string,
  matchId: number
): Promise<TournamentResultBoxscoreRow[]> => {
  const fromView = await loadMatchBoxscoreFromView(tournamentId, matchId);
  if (fromView) return applyPlusMinusToBoxscoreRows(fromView);

  const fallbackRows = await loadMatchBoxscoreFallback(matchId);
  return applyPlusMinusToBoxscoreRows(fallbackRows);
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
