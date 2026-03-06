import type {
  BattleDimensionKey,
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

const BATTLE_METRIC_WEIGHTS: Record<BattleMetric, number> = {
  ppg: 0.24,
  fg_pct: 0.16,
  apg: 0.16,
  spg: 0.12,
  bpg: 0.08,
  rpg: 0.09,
  pra: 0.1,
  topg: 0.05,
};

const BATTLE_DIMENSION_COMPONENTS: Record<
  BattleDimensionKey,
  Array<{ metric: BattleMetric; weight: number }>
> = {
  scoring: [
    { metric: "ppg", weight: 0.58 },
    { metric: "fg_pct", weight: 0.42 },
  ],
  creation: [
    { metric: "apg", weight: 0.62 },
    { metric: "pra", weight: 0.38 },
  ],
  defense: [
    { metric: "rpg", weight: 0.28 },
    { metric: "spg", weight: 0.42 },
    { metric: "bpg", weight: 0.3 },
  ],
  control: [
    { metric: "topg", weight: 0.7 },
    { metric: "apg", weight: 0.15 },
    { metric: "fg_pct", weight: 0.15 },
  ],
  impact: [
    { metric: "pra", weight: 0.6 },
    { metric: "ppg", weight: 0.25 },
    { metric: "fg_pct", weight: 0.15 },
  ],
};

const BATTLE_INDEX_BLEND = {
  metricScore: 0.88,
  impactScore: 0.12,
} as const;

const BATTLE_TIE_THRESHOLD = 1;

const initPerMetricLeaders = (): Record<BattleMetric, number[]> => ({
  ppg: [],
  rpg: [],
  apg: [],
  spg: [],
  bpg: [],
  pra: [],
  fg_pct: [],
  topg: [],
});

const initMetricScoreMap = (): Record<BattleMetric, Record<number, number>> => ({
  ppg: {},
  rpg: {},
  apg: {},
  spg: {},
  bpg: {},
  pra: {},
  fg_pct: {},
  topg: {},
});

const aggregateWeighted = (inputs: Array<{ score: number; weight: number }>): number => {
  const valid = inputs.filter((input) => Number.isFinite(input.score) && input.weight > 0);
  if (valid.length === 0) return 50;
  const sumWeights = valid.reduce((acc, input) => acc + input.weight, 0);
  if (sumWeights <= 0) return 50;
  const weighted = valid.reduce((acc, input) => acc + input.score * input.weight, 0);
  return weighted / sumWeights;
};

const normalizeMetricShares = (
  players: BattlePlayerResult[],
  metric: BattleMetric
): Record<number, number> => {
  const scores: Record<number, number> = {};
  if (players.length === 0) return scores;

  if (HIGHER_IS_BETTER[metric]) {
    const safeValues = players.map((player) => Math.max(0, player.metrics[metric] ?? 0));
    const total = safeValues.reduce((acc, value) => acc + value, 0);
    if (total <= 0) {
      players.forEach((player) => {
        scores[player.playerId] = 50;
      });
      return scores;
    }

    players.forEach((player, index) => {
      scores[player.playerId] = round2((safeValues[index] / total) * 100);
    });
    return scores;
  }

  const epsilon = 0.25;
  const inverseValues = players.map((player) => 1 / (Math.max(0, player.metrics[metric] ?? 0) + epsilon));
  const inverseTotal = inverseValues.reduce((acc, value) => acc + value, 0);
  if (inverseTotal <= 0) {
    players.forEach((player) => {
      scores[player.playerId] = 50;
    });
    return scores;
  }

  players.forEach((player, index) => {
    scores[player.playerId] = round2((inverseValues[index] / inverseTotal) * 100);
  });
  return scores;
};

const normalizeImpactScores = (players: BattlePlayerResult[]): Record<number, number> => {
  const result: Record<number, number> = {};
  if (players.length === 0) return result;
  const values = players.map((player) => player.compositeScore);
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (Math.abs(max - min) < 1e-6) {
    players.forEach((player) => {
      result[player.playerId] = 50;
    });
    return result;
  }

  players.forEach((player) => {
    const normalized = ((player.compositeScore - min) / (max - min)) * 100;
    result[player.playerId] = round2(normalized);
  });

  return result;
};

export const computeBattleWinner = (
  players: BattlePlayerResult[],
  metrics: BattleMetric[]
): BattleSummary => {
  const categoryWins: Record<number, number> = {};
  const perMetricLeader = initPerMetricLeaders();
  const metricScoresByMetric = initMetricScoreMap();
  const metricScoreByPlayer: Record<number, number> = {};
  const impactScoreByPlayer: Record<number, number> = {};
  const battleIndexByPlayer: Record<number, number> = {};
  const dimensionScoresByPlayer: Record<number, Record<BattleDimensionKey, number>> = {};
  const dimensionWinners: Record<BattleDimensionKey, number | null> = {
    scoring: null,
    creation: null,
    defense: null,
    control: null,
    impact: null,
  };
  const selectedMetrics = Array.from(new Set(metrics)).filter((metric): metric is BattleMetric => metric in HIGHER_IS_BETTER);
  const effectiveMetrics = selectedMetrics.length > 0 ? selectedMetrics : (Object.keys(HIGHER_IS_BETTER) as BattleMetric[]);

  for (const player of players) {
    categoryWins[player.playerId] = 0;
  }

  for (const metric of effectiveMetrics) {
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

    metricScoresByMetric[metric] = normalizeMetricShares(players, metric);
  }

  const normalizedImpactScores = normalizeImpactScores(players);

  for (const player of players) {
    const weightedMetricScore = aggregateWeighted(
      effectiveMetrics.map((metric) => ({
        score: metricScoresByMetric[metric][player.playerId] ?? 50,
        weight: BATTLE_METRIC_WEIGHTS[metric] ?? 0,
      }))
    );
    const impactScore = normalizedImpactScores[player.playerId] ?? 50;

    metricScoreByPlayer[player.playerId] = round2(weightedMetricScore);
    impactScoreByPlayer[player.playerId] = round2(impactScore);
    battleIndexByPlayer[player.playerId] = round2(
      weightedMetricScore * BATTLE_INDEX_BLEND.metricScore +
        impactScore * BATTLE_INDEX_BLEND.impactScore
    );

    const dimensionScores = {} as Record<BattleDimensionKey, number>;
    (Object.keys(BATTLE_DIMENSION_COMPONENTS) as BattleDimensionKey[]).forEach((dimensionKey) => {
      const baseDimensionScore = aggregateWeighted(
        BATTLE_DIMENSION_COMPONENTS[dimensionKey]
          .filter((component) => effectiveMetrics.includes(component.metric))
          .map((component) => ({
            score: metricScoresByMetric[component.metric][player.playerId] ?? 50,
            weight: component.weight,
          }))
      );

      const score =
        dimensionKey === "impact"
          ? round2(baseDimensionScore * 0.55 + impactScore * 0.45)
          : round2(baseDimensionScore);

      dimensionScores[dimensionKey] = score;
    });

    dimensionScoresByPlayer[player.playerId] = dimensionScores;
  }

  (Object.keys(BATTLE_DIMENSION_COMPONENTS) as BattleDimensionKey[]).forEach((dimensionKey) => {
    const sortedByDimension = [...players].sort(
      (left, right) =>
        (dimensionScoresByPlayer[right.playerId]?.[dimensionKey] ?? 0) -
        (dimensionScoresByPlayer[left.playerId]?.[dimensionKey] ?? 0)
    );

    const top = sortedByDimension[0];
    const next = sortedByDimension[1];
    if (!top) {
      dimensionWinners[dimensionKey] = null;
      return;
    }

    if (!next) {
      dimensionWinners[dimensionKey] = top.playerId;
      return;
    }

    const topScore = dimensionScoresByPlayer[top.playerId]?.[dimensionKey] ?? 0;
    const nextScore = dimensionScoresByPlayer[next.playerId]?.[dimensionKey] ?? 0;
    dimensionWinners[dimensionKey] = Math.abs(topScore - nextScore) < BATTLE_TIE_THRESHOLD ? null : top.playerId;
  });

  const sortedByBattleIndex = [...players].sort(
    (left, right) => (battleIndexByPlayer[right.playerId] ?? 0) - (battleIndexByPlayer[left.playerId] ?? 0)
  );

  let overallWinnerId: number | null = null;
  const top = sortedByBattleIndex[0];
  const next = sortedByBattleIndex[1];

  if (top) {
    if (!next) {
      overallWinnerId = top.playerId;
    } else {
      const topScore = battleIndexByPlayer[top.playerId] ?? 0;
      const nextScore = battleIndexByPlayer[next.playerId] ?? 0;
      const scoreGap = Math.abs(topScore - nextScore);

      if (scoreGap >= BATTLE_TIE_THRESHOLD) {
        overallWinnerId = top.playerId;
      } else {
        const topCategoryWins = categoryWins[top.playerId] ?? 0;
        const nextCategoryWins = categoryWins[next.playerId] ?? 0;
        if (topCategoryWins !== nextCategoryWins) {
          overallWinnerId = topCategoryWins > nextCategoryWins ? top.playerId : next.playerId;
        } else {
          const topComposite = top.compositeScore ?? 0;
          const nextComposite = next.compositeScore ?? 0;
          overallWinnerId = Math.abs(topComposite - nextComposite) < 1e-6
            ? null
            : topComposite > nextComposite
              ? top.playerId
              : next.playerId;
        }
      }
    }
  }

  const overallWinner = overallWinnerId ? players.find((player) => player.playerId === overallWinnerId) ?? null : null;

  return {
    overallWinnerId: overallWinner?.playerId ?? null,
    overallWinnerName: overallWinner?.name ?? null,
    categoryWins,
    perMetricLeader,
    metricScoreByPlayer,
    impactScoreByPlayer,
    battleIndexByPlayer,
    dimensionScoresByPlayer,
    dimensionWinners,
  };
};
