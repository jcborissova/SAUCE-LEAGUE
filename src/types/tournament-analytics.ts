export type TournamentPhaseFilter = "regular" | "playoffs" | "finals" | "all";

export type TournamentStatMetric =
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "turnovers"
  | "fouls"
  | "fg_pct";

export type BattleMetric =
  | "ppg"
  | "rpg"
  | "apg"
  | "spg"
  | "bpg"
  | "fg_pct"
  | "topg";

export type PlayerStatsLine = {
  playerId: number;
  name: string;
  photo?: string | null;
  teamName: string | null;
  gamesPlayed: number;
  totals: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    fgm: number;
    fga: number;
  };
  perGame: {
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    topg: number;
    fpg: number;
  };
  fgPct: number;
};

export type TournamentLeaderRow = PlayerStatsLine & {
  value: number;
  metric: TournamentStatMetric;
};

export type RaceSeriesPoint = {
  matchId: number;
  gameIndex: number;
  date: string;
  value: number;
  cumulative: number;
};

export type RaceSeriesPlayer = {
  playerId: number;
  name: string;
  teamName: string | null;
  points: RaceSeriesPoint[];
};

export type MvpBreakdownRow = PlayerStatsLine & {
  eligible: boolean;
  eligibilityThreshold: number;
  teamFactor: number;
  z: {
    ppg: number;
    apg: number;
    rpg: number;
    spg: number;
    bpg: number;
    fgPct: number;
    topg: number;
    fpg: number;
    teamFactor: number;
  };
  componentScore: {
    offense: number;
    playmaking: number;
    boards: number;
    steals: number;
    blocks: number;
    shooting: number;
    turnovers: number;
    fouls: number;
    team: number;
  };
  finalScore: number;
};

export type PlayoffGameRow = {
  id: number;
  tournamentId: string;
  seriesId: number;
  matchId: number;
  gameNumber: number;
  status: "scheduled" | "completed" | "cancelled";
  scheduledDate: string | null;
  scheduledTime: string | null;
  match: {
    id: number;
    teamA: string | null;
    teamB: string | null;
    winnerTeam: string | null;
    matchDate: string | null;
    matchTime: string | null;
  } | null;
};

export type PlayoffSeriesRow = {
  id: number;
  tournamentId: string;
  roundOrder: number;
  roundName: string;
  matchupKey: string;
  teamAId: number | null;
  teamBId: number | null;
  seedA: number | null;
  seedB: number | null;
  winsA: number;
  winsB: number;
  targetWinsA: number;
  targetWinsB: number;
  status: "pending" | "active" | "completed";
  winnerTeamId: number | null;
  teamAName: string | null;
  teamBName: string | null;
  winnerName: string | null;
  games: PlayoffGameRow[];
};

export type TournamentSettings = {
  tournamentId: string;
  seasonType: "regular_only" | "regular_plus_playoffs";
  playoffFormat: {
    enabled: boolean;
    format: string;
    rounds: Array<{
      name: string;
      series: Array<Record<string, unknown>>;
    }>;
  };
  rulesPdfUrl: string | null;
};

export type MatchPlayerStatsInput = {
  playerId: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
};

export type TournamentResultMatchOverview = {
  matchId: number;
  tournamentId: string;
  matchDate: string | null;
  matchTime: string | null;
  teamA: string;
  teamB: string;
  winnerTeam: string | null;
  teamAPoints: number;
  teamBPoints: number;
  hasStats: boolean;
};

export type TournamentResultBoxscoreRow = {
  playerId: number;
  teamSide: "A" | "B" | "U";
  playerName: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  fgPct: number;
};

export type TournamentResultSummary = {
  playedMatches: number;
  matchesWithStats: number;
  totalPoints: number;
  avgPoints: number;
};

export type TournamentAnalyticsPhase = Exclude<TournamentPhaseFilter, "all">;

export type TournamentAnalyticsPlayerGame = {
  tournamentId: string;
  matchId: number;
  matchDate: string | null;
  matchTime: string | null;
  gameOrder: number;
  playerId: number;
  playerName: string;
  teamName: string | null;
  phase: TournamentAnalyticsPhase;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  fgPct: number;
};

export type TournamentAnalyticsSnapshot = {
  tournamentId: string;
  phase: TournamentPhaseFilter;
  revisionKey: string;
  playerGames: TournamentAnalyticsPlayerGame[];
  playerLines: PlayerStatsLine[];
  gamesAnalyzed: number;
  playersAnalyzed: number;
  teamFactors: Record<string, number>;
};

export type TournamentAnalyticsKpi = {
  id: "players" | "games" | "leader_points" | "leader_mvp";
  label: string;
  value: string | number;
  helper: string;
};

export type TournamentAnalyticsCacheKey = `${string}:${TournamentPhaseFilter}`;

export type BattlePlayerResult = {
  playerId: number;
  name: string;
  teamName: string | null;
  metrics: Record<BattleMetric, number>;
  compositeScore: number;
};

export type BattleSummary = {
  overallWinnerId: number | null;
  overallWinnerName: string | null;
  categoryWins: Record<number, number>;
  perMetricLeader: Record<BattleMetric, number[]>;
};
