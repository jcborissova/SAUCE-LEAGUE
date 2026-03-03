import type {
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  MvpBreakdownRow,
} from "../types/tournament-analytics";

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const computePct = (made: number, attempts: number): number => {
  if (attempts <= 0) return 0;
  return round2((made / attempts) * 100);
};

export const computeFgPct = (fgm: number, fga: number): number => {
  return computePct(fgm, fga);
};

export const computeValuation = (stats: {
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
}): number => {
  // Valoracion = positivos - negativos.
  // Positivos: PTS, REB, AST, STL, BLK, FGM, FTM, 3PM.
  // Negativos: (FGA-FGM), (FTA-FTM), TOV y PF.
  const positive =
    stats.points +
    stats.rebounds +
    stats.assists +
    stats.steals +
    stats.blocks +
    stats.fgm +
    stats.ftm +
    stats.tpm;

  const missedFieldGoals = Math.max(0, stats.fga - stats.fgm);
  const missedFreeThrows = Math.max(0, stats.fta - stats.ftm);
  const negative = missedFieldGoals + missedFreeThrows + stats.turnovers + stats.fouls;

  return round2(positive - negative);
};

export const computeImpactScore = (stats: {
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
}): number => {
  const missedFieldGoals = Math.max(0, stats.fga - stats.fgm);
  const missedFreeThrows = Math.max(0, stats.fta - stats.ftm);

  const positive =
    stats.points * 1 +
    stats.rebounds * 0.8 +
    stats.assists * 1 +
    stats.steals * 1.5 +
    stats.blocks * 1.2 +
    stats.tpm * 0.7 +
    stats.fgm * 0.3 +
    stats.ftm * 0.2;

  const negative =
    stats.turnovers * 1.3 +
    stats.fouls * 0.45 +
    missedFieldGoals * 0.35 +
    missedFreeThrows * 0.25;

  return round2(positive - negative);
};

export const computeValuationPerGame = (valuation: number, gamesPlayed: number): number => {
  if (gamesPlayed <= 0) return 0;
  return round2(valuation / gamesPlayed);
};

export const computeZScores = (values: number[]): number[] => {
  if (values.length === 0) return [];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => (value - mean) / stdDev);
};

export const MVP_SCORE_WEIGHTS = {
  scoring: 0.12,
  playmaking: 0.08,
  rebounding: 0.07,
  steals: 0.08,
  blocks: 0.04,
  trueShooting: 0.1,
  fieldGoalPct: 0.03,
  threePointPct: 0.02,
  pieShareImpact: 0.14,
  praImpact: 0.1,
  valuationImpact: 0.16,
  durability: 0.1,
  teamRecord: 0.14,
  turnovers: -0.11,
  fouls: -0.05,
} as const;

export const computeMvpScores = (
  players: Array<{
    playerId: number;
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    topg: number;
    fpg: number;
    tsPct: number;
    fgPct: number;
    tpPct: number;
    pieShare: number;
    praPerGame: number;
    valuationPerGame: number;
    teamFactor: number;
    availabilityRate: number;
  }>
): Record<
  number,
  Pick<MvpBreakdownRow, "z" | "componentScore" | "teamFactor" | "finalScore">
> => {
  const ppgZ = computeZScores(players.map((p) => p.ppg));
  const rpgZ = computeZScores(players.map((p) => p.rpg));
  const apgZ = computeZScores(players.map((p) => p.apg));
  const spgZ = computeZScores(players.map((p) => p.spg));
  const bpgZ = computeZScores(players.map((p) => p.bpg));
  const tsPctZ = computeZScores(players.map((p) => p.tsPct));
  const fgPctZ = computeZScores(players.map((p) => p.fgPct));
  const tpPctZ = computeZScores(players.map((p) => p.tpPct));
  const pieShareZ = computeZScores(players.map((p) => p.pieShare));
  const praZ = computeZScores(players.map((p) => p.praPerGame));
  const valuationZ = computeZScores(players.map((p) => p.valuationPerGame));
  const topgZ = computeZScores(players.map((p) => p.topg));
  const fpgZ = computeZScores(players.map((p) => p.fpg));
  const teamFactorZ = computeZScores(players.map((p) => p.teamFactor));
  const availabilityZ = computeZScores(players.map((p) => p.availabilityRate));

  return players.reduce((acc, player, index) => {
    const offense = MVP_SCORE_WEIGHTS.scoring * ppgZ[index];
    const playmaking = MVP_SCORE_WEIGHTS.playmaking * apgZ[index];
    const boards = MVP_SCORE_WEIGHTS.rebounding * rpgZ[index];
    const defense =
      MVP_SCORE_WEIGHTS.steals * spgZ[index] +
      MVP_SCORE_WEIGHTS.blocks * bpgZ[index];
    const efficiency =
      MVP_SCORE_WEIGHTS.trueShooting * tsPctZ[index] +
      MVP_SCORE_WEIGHTS.fieldGoalPct * fgPctZ[index] +
      MVP_SCORE_WEIGHTS.threePointPct * tpPctZ[index];
    const impact =
      MVP_SCORE_WEIGHTS.pieShareImpact * pieShareZ[index] +
      MVP_SCORE_WEIGHTS.praImpact * praZ[index] +
      MVP_SCORE_WEIGHTS.valuationImpact * valuationZ[index];
    const durability = MVP_SCORE_WEIGHTS.durability * availabilityZ[index];
    const teamRecord = MVP_SCORE_WEIGHTS.teamRecord * teamFactorZ[index];
    const turnovers = MVP_SCORE_WEIGHTS.turnovers * topgZ[index];
    const fouls = MVP_SCORE_WEIGHTS.fouls * fpgZ[index];

    acc[player.playerId] = {
      z: {
        ppg: ppgZ[index],
        apg: apgZ[index],
        rpg: rpgZ[index],
        spg: spgZ[index],
        bpg: bpgZ[index],
        tsPct: tsPctZ[index],
        fgPct: fgPctZ[index],
        tpPct: tpPctZ[index],
        pieShare: pieShareZ[index],
        pra: praZ[index],
        valuationPerGame: valuationZ[index],
        topg: topgZ[index],
        fpg: fpgZ[index],
        teamFactor: teamFactorZ[index],
        availability: availabilityZ[index],
      },
      componentScore: {
        offense,
        playmaking,
        boards,
        defense,
        efficiency,
        impact,
        durability,
        teamRecord,
        turnovers,
        fouls,
      },
      teamFactor: player.teamFactor,
      finalScore: round2(
        offense +
          playmaking +
          boards +
          defense +
          efficiency +
          impact +
          durability +
          teamRecord +
          turnovers +
          fouls
      ),
    };

    return acc;
  }, {} as Record<number, Pick<MvpBreakdownRow, "z" | "componentScore" | "teamFactor" | "finalScore">>);
};

const HIGHER_IS_BETTER: Record<BattleMetric, boolean> = {
  ppg: true,
  rpg: true,
  apg: true,
  spg: true,
  bpg: true,
  pra: true,
  fg_pct: true,
  topg: false,
};

export const computeBattleWinner = (
  players: BattlePlayerResult[],
  metrics: BattleMetric[]
): BattleSummary => {
  const categoryWins: Record<number, number> = {};
  const perMetricLeader: Record<BattleMetric, number[]> = {
    ppg: [],
    rpg: [],
    apg: [],
    spg: [],
    bpg: [],
    pra: [],
    fg_pct: [],
    topg: [],
  };

  for (const player of players) {
    categoryWins[player.playerId] = 0;
  }

  for (const metric of metrics) {
    if (players.length === 0) continue;

    const values = players.map((player) => player.metrics[metric]);
    const target = HIGHER_IS_BETTER[metric]
      ? Math.max(...values)
      : Math.min(...values);

    const leaders = players
      .filter((player) => player.metrics[metric] === target)
      .map((player) => player.playerId);

    perMetricLeader[metric] = leaders;
    leaders.forEach((playerId) => {
      categoryWins[playerId] = (categoryWins[playerId] ?? 0) + 1;
    });
  }

  const sorted = [...players].sort((a, b) => {
    const byCategories = (categoryWins[b.playerId] ?? 0) - (categoryWins[a.playerId] ?? 0);
    if (byCategories !== 0) return byCategories;
    return b.compositeScore - a.compositeScore;
  });

  const overallWinner = sorted[0] ?? null;

  return {
    overallWinnerId: overallWinner?.playerId ?? null,
    overallWinnerName: overallWinner?.name ?? null,
    categoryWins,
    perMetricLeader,
  };
};
