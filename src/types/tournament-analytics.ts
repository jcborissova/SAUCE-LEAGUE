export type TournamentPhaseFilter = "regular" | "playoffs" | "finals" | "all";

export type TournamentStatMetric =
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "defensive_impact"
  | "pra"
  | "most_improved"
  | "turnovers"
  | "fouls"
  | "fg_pct";

export type MostImprovedBreakdown = {
  score: number;
  gamesAnalyzed: number;
  startWindowGames: number;
  endWindowGames: number;
  earlyValuation: number;
  lateValuation: number;
  valuationDelta: number;
  earlyPra: number;
  latePra: number;
  praDelta: number;
  earlyTsPct: number;
  lateTsPct: number;
  tsPctDelta: number;
  earlyShotLoad: number;
  lateShotLoad: number;
  shotLoadDelta: number;
  earlyTurnovers: number;
  lateTurnovers: number;
  turnoversDelta: number;
  trendSlope: number;
  startBoost: number;
  explanation: string;
};

export type BattleMetric =
  | "ppg"
  | "rpg"
  | "apg"
  | "spg"
  | "bpg"
  | "pra"
  | "fg_pct"
  | "topg";

export type BattleDimensionKey =
  | "scoring"
  | "creation"
  | "defense"
  | "control"
  | "impact";

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
    plusMinus: number;
    turnovers: number;
    fouls: number;
    fgm: number;
    fga: number;
    ftm: number;
    fta: number;
    tpm: number;
    tpa: number;
  };
  perGame: {
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    plusMinus: number;
    topg: number;
    fpg: number;
  };
  fgPct: number;
  ftPct: number;
  tpPct: number;
  valuation: number;
  valuationPerGame: number;
};

export type TournamentLeaderRow = PlayerStatsLine & {
  value: number;
  metric: TournamentStatMetric;
  mostImproved?: MostImprovedBreakdown;
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
  availabilityRate: number;
  tsPct: number;
  pieShare: number;
  z: {
    ppg: number;
    apg: number;
    rpg: number;
    spg: number;
    bpg: number;
    tsPct: number;
    fgPct: number;
    tpPct: number;
    shotLoad: number;
    pieShare: number;
    pra: number;
    valuationPerGame: number;
    topg: number;
    fpg: number;
    teamFactor: number;
    availability: number;
  };
  componentScore: {
    offense: number;
    playmaking: number;
    boards: number;
    defense: number;
    efficiency: number;
    impact: number;
    durability: number;
    teamRecord: number;
    turnovers: number;
    fouls: number;
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
    teamAPoints: number;
    teamBPoints: number;
    hasScore: boolean;
    hasStats: boolean;
    resultNote: string | null;
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
  ftm: number;
  fta: number;
  tpm: number;
  tpa: number;
};

export type TournamentResultMatchOverview = {
  matchId: number;
  tournamentId: string;
  matchDate: string | null;
  matchTime: string | null;
  phase: TournamentAnalyticsPhase;
  teamA: string;
  teamB: string;
  winnerTeam: string | null;
  teamAPoints: number;
  teamBPoints: number;
  hasScore: boolean;
  hasStats: boolean;
  resultNote: string | null;
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
  plusMinus: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  fgPct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  tpm: number;
  tpa: number;
  tpPct: number;
};

export type TournamentResultSummary = {
  playedMatches: number;
  matchesWithScore: number;
  matchesWithStats: number;
  totalPoints: number;
  avgPoints: number;
};

export type ViewerFollowState = {
  teams: string[];
  players: number[];
};

export type ViewerMatchStatusFilter = "all" | "pending" | "completed";
export type ViewerMatchWindowFilter = "all" | "today" | "next7";

export type ViewerMatchFilters = {
  team: string | null;
  status: ViewerMatchStatusFilter;
  window: ViewerMatchWindowFilter;
};

export type TournamentActivityType =
  | "match_result_updated"
  | "match_stats_updated"
  | "playoff_series_updated"
  | "leader_of_day";

export type TournamentActivityItem = {
  id: number;
  tournamentId: string;
  type: TournamentActivityType;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type TournamentChallengeStatus =
  | "pending"
  | "completed"
  | "elite"
  | "failed"
  | "not_evaluated";

export type ChallengeMetric =
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "turnovers_max"
  | "fouls_max"
  | "fg_pct"
  | "ft_pct"
  | "tp_pct"
  | "tpm"
  | "valuation";

export type ChallengeTarget = {
  metric: ChallengeMetric;
  label: string;
  op: "gte" | "lte";
  target: number;
  actual: number | null;
  hit: boolean | null;
};

export type TournamentPlayerChallenge = {
  id: number;
  tournamentId: string;
  matchId: number;
  playerId: number;
  playerName: string;
  teamName: string | null;
  teamSide: "A" | "B" | "U" | null;
  challengeDate: string | null;
  challengeTime: string | null;
  archetype: "scorer" | "creator" | "two_way" | "rim_protector" | "all_around";
  targets: ChallengeTarget[];
  baseline: Record<string, unknown>;
  actuals: Record<string, unknown>;
  successCount: number;
  status: TournamentChallengeStatus;
  settled: boolean;
  settledAt: string | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChallengeBoardTrend = "up" | "steady" | "down";

export type ChallengeBoardRow = {
  playerId: number;
  playerName: string;
  teamName: string | null;
  nextMatchId: number | null;
  nextMatchLabel: string;
  challengeStatus: TournamentChallengeStatus;
  successCount: number;
  streak: number;
  trend: ChallengeBoardTrend;
  latestChallenge: TournamentPlayerChallenge | null;
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
  ftm: number;
  fta: number;
  ftPct: number;
  tpm: number;
  tpa: number;
  tpPct: number;
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
  photo?: string | null;
  teamName: string | null;
  metrics: Record<BattleMetric, number>;
  shotLoadPerGame: number;
  compositeScore: number;
};

export type BattleSummary = {
  overallWinnerId: number | null;
  overallWinnerName: string | null;
  categoryWins: Record<number, number>;
  perMetricLeader: Record<BattleMetric, number[]>;
  metricScoreByPlayer: Record<number, number>;
  impactScoreByPlayer: Record<number, number>;
  battleIndexByPlayer: Record<number, number>;
  dimensionScoresByPlayer: Record<number, Record<BattleDimensionKey, number>>;
  dimensionWinners: Record<BattleDimensionKey, number | null>;
};
