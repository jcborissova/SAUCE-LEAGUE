export type StandingTeamInput = {
  teamId: number;
  name: string;
};

export type StandingMatchInput = {
  matchId: number;
  teamA: string;
  teamB: string;
  winnerTeam: string | null;
  teamAPoints: number;
  teamBPoints: number;
  hasStats: boolean;
};

export type StandingTieBreakCriterion =
  | "none"
  | "h2h_record"
  | "h2h_point_diff"
  | "h2h_points_scored"
  | "overall_point_diff"
  | "overall_points_scored"
  | "draw";

export type TeamStandingResolved = {
  teamId: number;
  name: string;
  pj: number;
  pg: number;
  pp: number;
  winPct: number;
  classificationPoints: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  tieGroupSize: number;
  tieBreakApplied: boolean;
  tieBreakCriterion: StandingTieBreakCriterion;
  tieBreakExplanation: string;
};

type MutableStanding = {
  teamId: number;
  name: string;
  pj: number;
  pg: number;
  pp: number;
  winPct: number;
  classificationPoints: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

type TieReason = {
  criterion: StandingTieBreakCriterion;
  explanation: string;
};

type CriterionValueMap = {
  valuesByTeam: Map<string, number>;
  valueLabelByTeam: Map<string, string>;
};

type HeadToHeadStat = {
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

type HeadToHeadData = {
  statsByTeam: Map<string, HeadToHeadStat>;
  completeScoreData: boolean;
};

const criteriaOrder: StandingTieBreakCriterion[] = [
  "h2h_record",
  "h2h_point_diff",
  "h2h_points_scored",
  "overall_point_diff",
  "overall_points_scored",
];

const compareTextEs = (left: string, right: string): number =>
  left.localeCompare(right, "es", { sensitivity: "base" });

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const formatSigned = (value: number): string => {
  if (value > 0) return `+${value}`;
  return `${value}`;
};

const toBucketKey = (value: number): string => value.toFixed(6);

const isScoreAvailable = (match: StandingMatchInput): boolean =>
  match.hasStats || match.teamAPoints !== 0 || match.teamBPoints !== 0;

const createEmptyHeadToHeadStat = (): HeadToHeadStat => ({
  games: 0,
  wins: 0,
  losses: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  pointDiff: 0,
});

const buildHeadToHeadData = (
  teamNames: string[],
  matches: StandingMatchInput[]
): HeadToHeadData => {
  const teamSet = new Set(teamNames);
  const statsByTeam = new Map<string, HeadToHeadStat>();
  teamNames.forEach((teamName) => statsByTeam.set(teamName, createEmptyHeadToHeadStat()));

  let matchesInSubset = 0;
  let matchesWithScore = 0;

  matches.forEach((match) => {
    if (!match.winnerTeam) return;
    if (!teamSet.has(match.teamA) || !teamSet.has(match.teamB)) return;

    matchesInSubset += 1;
    const teamAStat = statsByTeam.get(match.teamA);
    const teamBStat = statsByTeam.get(match.teamB);
    if (!teamAStat || !teamBStat) return;

    teamAStat.games += 1;
    teamBStat.games += 1;

    if (match.winnerTeam === match.teamA) {
      teamAStat.wins += 1;
      teamBStat.losses += 1;
    } else if (match.winnerTeam === match.teamB) {
      teamBStat.wins += 1;
      teamAStat.losses += 1;
    }

    if (!isScoreAvailable(match)) return;

    matchesWithScore += 1;
    teamAStat.pointsFor += match.teamAPoints;
    teamAStat.pointsAgainst += match.teamBPoints;
    teamAStat.pointDiff = teamAStat.pointsFor - teamAStat.pointsAgainst;

    teamBStat.pointsFor += match.teamBPoints;
    teamBStat.pointsAgainst += match.teamAPoints;
    teamBStat.pointDiff = teamBStat.pointsFor - teamBStat.pointsAgainst;
  });

  return {
    statsByTeam,
    completeScoreData: matchesInSubset > 0 && matchesInSubset === matchesWithScore,
  };
};

const buildCriterionValueMap = (
  criterion: StandingTieBreakCriterion,
  teamNames: string[],
  overallByTeam: Map<string, MutableStanding>,
  headToHead: HeadToHeadData
): CriterionValueMap | null => {
  const valuesByTeam = new Map<string, number>();
  const valueLabelByTeam = new Map<string, string>();

  for (const teamName of teamNames) {
    const overall = overallByTeam.get(teamName);
    const h2h = headToHead.statsByTeam.get(teamName) ?? createEmptyHeadToHeadStat();
    if (!overall) continue;

    if (criterion === "h2h_record") {
      const value = h2h.games > 0 ? h2h.wins / h2h.games : 0;
      valuesByTeam.set(teamName, value);
      valueLabelByTeam.set(teamName, `${h2h.wins}-${h2h.losses}`);
      continue;
    }

    if (criterion === "h2h_point_diff") {
      if (!headToHead.completeScoreData) return null;
      const value = h2h.pointDiff;
      valuesByTeam.set(teamName, value);
      valueLabelByTeam.set(teamName, formatSigned(value));
      continue;
    }

    if (criterion === "h2h_points_scored") {
      if (!headToHead.completeScoreData) return null;
      const value = h2h.pointsFor;
      valuesByTeam.set(teamName, value);
      valueLabelByTeam.set(teamName, `${value}`);
      continue;
    }

    if (criterion === "overall_point_diff") {
      const value = overall.pointDiff;
      valuesByTeam.set(teamName, value);
      valueLabelByTeam.set(teamName, formatSigned(value));
      continue;
    }

    if (criterion === "overall_points_scored") {
      const value = overall.pointsFor;
      valuesByTeam.set(teamName, value);
      valueLabelByTeam.set(teamName, `${value}`);
      continue;
    }
  }

  return {
    valuesByTeam,
    valueLabelByTeam,
  };
};

const buildTieExplanation = (params: {
  criterion: StandingTieBreakCriterion;
  teamName: string;
  teamCount: number;
  classificationPoints: number;
  valueLabelByTeam: Map<string, string>;
}): string => {
  const valueLabel = params.valueLabelByTeam.get(params.teamName) ?? "-";
  const prefix = `Empate con ${params.teamCount} equipos en ${params.classificationPoints} pts`;

  if (params.criterion === "h2h_record") {
    return `${prefix}: mejor récord directo (${valueLabel}).`;
  }
  if (params.criterion === "h2h_point_diff") {
    return `${prefix}: mejor +/- entre empatados (${valueLabel}).`;
  }
  if (params.criterion === "h2h_points_scored") {
    return `${prefix}: más puntos anotados entre empatados (${valueLabel}).`;
  }
  if (params.criterion === "overall_point_diff") {
    return `${prefix}: mejor +/- general (${valueLabel}).`;
  }
  if (params.criterion === "overall_points_scored") {
    return `${prefix}: más puntos anotados en todos los juegos (${valueLabel}).`;
  }

  return `${prefix}: orden final por sorteo/criterio administrativo.`;
};

const resolveTiedGroup = (
  teamNames: string[],
  matches: StandingMatchInput[],
  overallByTeam: Map<string, MutableStanding>,
  reasonsByTeam: Map<string, TieReason>,
  classificationPoints: number
): string[] => {
  if (teamNames.length <= 1) return [...teamNames];

  const headToHead = buildHeadToHeadData(teamNames, matches);

  for (const criterion of criteriaOrder) {
    const metric = buildCriterionValueMap(criterion, teamNames, overallByTeam, headToHead);
    if (!metric) continue;

    const buckets = new Map<string, { value: number; teams: string[] }>();
    teamNames.forEach((teamName) => {
      const value = metric.valuesByTeam.get(teamName) ?? 0;
      const key = toBucketKey(value);
      const bucket = buckets.get(key) ?? { value, teams: [] };
      bucket.teams.push(teamName);
      buckets.set(key, bucket);
    });

    const orderedBuckets = Array.from(buckets.values()).sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      const leftName = [...left.teams].sort(compareTextEs)[0] ?? "";
      const rightName = [...right.teams].sort(compareTextEs)[0] ?? "";
      return compareTextEs(leftName, rightName);
    });

    if (orderedBuckets.length <= 1) continue;

    const resolved: string[] = [];
    orderedBuckets.forEach((bucket) => {
      if (bucket.teams.length === 1) {
        const teamName = bucket.teams[0];
        if (!reasonsByTeam.has(teamName)) {
          reasonsByTeam.set(teamName, {
            criterion,
            explanation: buildTieExplanation({
              criterion,
              teamName,
              teamCount: teamNames.length,
              classificationPoints,
              valueLabelByTeam: metric.valueLabelByTeam,
            }),
          });
        }
        resolved.push(teamName);
        return;
      }

      resolved.push(
        ...resolveTiedGroup(
          bucket.teams,
          matches,
          overallByTeam,
          reasonsByTeam,
          classificationPoints
        )
      );
    });

    return resolved;
  }

  const alphabetical = [...teamNames].sort(compareTextEs);
  alphabetical.forEach((teamName) => {
    if (!reasonsByTeam.has(teamName)) {
      reasonsByTeam.set(teamName, {
        criterion: "draw",
        explanation: `Empate total con ${teamNames.length} equipos en ${classificationPoints} pts: orden alfabético local.`,
      });
    }
  });

  return alphabetical;
};

export const computeStandingsWithFibaTiebreak = (
  teams: StandingTeamInput[],
  matches: StandingMatchInput[]
): TeamStandingResolved[] => {
  const standingsByTeamName = new Map<string, MutableStanding>();
  teams.forEach((team) => {
    standingsByTeamName.set(team.name, {
      teamId: team.teamId,
      name: team.name,
      pj: 0,
      pg: 0,
      pp: 0,
      winPct: 0,
      classificationPoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  });

  matches.forEach((match) => {
    if (!match.winnerTeam) return;

    const teamA = standingsByTeamName.get(match.teamA);
    const teamB = standingsByTeamName.get(match.teamB);
    if (!teamA || !teamB) return;

    teamA.pj += 1;
    teamB.pj += 1;

    if (match.winnerTeam === match.teamA) {
      teamA.pg += 1;
      teamB.pp += 1;
    } else if (match.winnerTeam === match.teamB) {
      teamB.pg += 1;
      teamA.pp += 1;
    }

    if (!isScoreAvailable(match)) return;

    teamA.pointsFor += match.teamAPoints;
    teamA.pointsAgainst += match.teamBPoints;
    teamA.pointDiff = teamA.pointsFor - teamA.pointsAgainst;

    teamB.pointsFor += match.teamBPoints;
    teamB.pointsAgainst += match.teamAPoints;
    teamB.pointDiff = teamB.pointsFor - teamB.pointsAgainst;
  });

  standingsByTeamName.forEach((row) => {
    row.classificationPoints = row.pg * 2 + row.pp;
    row.winPct = row.pj > 0 ? round4(row.pg / row.pj) : 0;
  });

  const groupsByClassificationPoints = new Map<number, string[]>();
  standingsByTeamName.forEach((row) => {
    const current = groupsByClassificationPoints.get(row.classificationPoints) ?? [];
    current.push(row.name);
    groupsByClassificationPoints.set(row.classificationPoints, current);
  });

  const reasonsByTeam = new Map<string, TieReason>();
  const tieGroupSizeByTeam = new Map<string, number>();
  const orderedTeamNames: string[] = [];

  Array.from(groupsByClassificationPoints.entries())
    .sort((left, right) => right[0] - left[0])
    .forEach(([classificationPoints, teamNames]) => {
      const sortedGroup =
        teamNames.length > 1
          ? resolveTiedGroup(
              teamNames,
              matches,
              standingsByTeamName,
              reasonsByTeam,
              classificationPoints
            )
          : [...teamNames];

      sortedGroup.forEach((teamName) => {
        tieGroupSizeByTeam.set(teamName, teamNames.length);
      });
      orderedTeamNames.push(...sortedGroup);
    });

  return orderedTeamNames
    .map((teamName) => {
      const row = standingsByTeamName.get(teamName);
      if (!row) return null;

      const tieGroupSize = tieGroupSizeByTeam.get(teamName) ?? 1;
      const reason = reasonsByTeam.get(teamName);

      return {
        teamId: row.teamId,
        name: row.name,
        pj: row.pj,
        pg: row.pg,
        pp: row.pp,
        winPct: row.winPct,
        classificationPoints: row.classificationPoints,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        pointDiff: row.pointDiff,
        tieGroupSize,
        tieBreakApplied: tieGroupSize > 1,
        tieBreakCriterion: reason?.criterion ?? "none",
        tieBreakExplanation:
          reason?.explanation ??
          "Sin desempate: mejor récord general en el grupo.",
      } satisfies TeamStandingResolved;
    })
    .filter((row): row is TeamStandingResolved => row !== null);
};
