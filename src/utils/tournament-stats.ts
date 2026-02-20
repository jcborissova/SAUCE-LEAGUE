import type {
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  MvpBreakdownRow,
} from "../types/tournament-analytics";

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const computeFgPct = (fgm: number, fga: number): number => {
  if (fga <= 0) return 0;
  return round2((fgm / fga) * 100);
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
    fgPct: number;
    teamFactor: number;
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
  const fgPctZ = computeZScores(players.map((p) => p.fgPct));
  const topgZ = computeZScores(players.map((p) => p.topg));
  const fpgZ = computeZScores(players.map((p) => p.fpg));
  const teamFactorZ = computeZScores(players.map((p) => p.teamFactor));

  return players.reduce((acc, player, index) => {
    const offense = 0.3 * ppgZ[index];
    const playmaking = 0.2 * apgZ[index];
    const boards = 0.2 * rpgZ[index];
    const steals = 0.1 * spgZ[index];
    const blocks = 0.1 * bpgZ[index];
    const shooting = 0.1 * fgPctZ[index];
    const turnovers = -0.15 * topgZ[index];
    const fouls = -0.05 * fpgZ[index];
    const team = 0.1 * teamFactorZ[index];

    acc[player.playerId] = {
      z: {
        ppg: ppgZ[index],
        apg: apgZ[index],
        rpg: rpgZ[index],
        spg: spgZ[index],
        bpg: bpgZ[index],
        fgPct: fgPctZ[index],
        topg: topgZ[index],
        fpg: fpgZ[index],
        teamFactor: teamFactorZ[index],
      },
      componentScore: {
        offense,
        playmaking,
        boards,
        steals,
        blocks,
        shooting,
        turnovers,
        fouls,
        team,
      },
      teamFactor: player.teamFactor,
      finalScore: round2(
        offense + playmaking + boards + steals + blocks + shooting + turnovers + fouls + team
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
