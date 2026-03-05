import type { PlayerStatsLine } from "../types/tournament-analytics";
import { buildPlayerDeepInsight } from "./player-insights";

export type IdealFiveRole = "PG" | "SG" | "SF" | "PF" | "C";

export type IdealFivePlayer = {
  role: IdealFiveRole;
  playerId: number;
  name: string;
  photo: string | null;
  teamName: string | null;
  gamesPlayed: number;
  roleScore: number;
  overallScore: number;
  keyStatLabel: string;
  keyStatValue: string;
  archetype: string;
};

export type IdealFiveProjection = {
  lineup: IdealFivePlayer[];
  chemistryScore: number;
  modelScore: number;
  sampleSize: number;
  minGames: number;
  confidence: "alta" | "media" | "baja";
  note: string;
  modelVersion: string;
};

export const IDEAL_FIVE_ROLES: IdealFiveRole[] = ["PG", "SG", "SF", "PF", "C"];

export const IDEAL_FIVE_ROLE_BADGE_VARIANT: Record<
  IdealFiveRole,
  "primary" | "success" | "warning" | "default" | "danger"
> = {
  PG: "primary",
  SG: "warning",
  SF: "success",
  PF: "default",
  C: "danger",
};

type CandidateRaw = {
  line: PlayerStatsLine;
  games: number;
  scoringIndex: number;
  creationIndex: number;
  shootingIndex: number;
  perimeterDefenseIndex: number;
  interiorDefenseIndex: number;
  reboundingIndex: number;
  impactIndex: number;
  disciplineCost: number;
  tsPct: number;
  tpPct: number;
};

type CandidateProfile = {
  line: PlayerStatsLine;
  reliability: number;
  playoffBoost: number;
  insightScore: number;
  pScoring: number;
  pCreation: number;
  pShooting: number;
  pPerimeterDefense: number;
  pInteriorDefense: number;
  pRebounding: number;
  pImpact: number;
  pDiscipline: number;
  overallScore: number;
  archetype: string;
  roleScores: Record<IdealFiveRole, number>;
};

const MODEL_VERSION = "ideal-five-v2.3";
const SHRINKAGE_GAMES = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Number(value.toFixed(1));

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const standardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const percentile = (values: number[], target: number, higherIsBetter = true): number => {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return 0.5;

  let lessCount = 0;
  let equalCount = 0;
  clean.forEach((value) => {
    if (value < target) lessCount += 1;
    else if (value === target) equalCount += 1;
  });

  const base = (lessCount + equalCount * 0.5) / clean.length;
  return clamp(higherIsBetter ? base : 1 - base, 0, 1);
};

const computeTsPct = (line: PlayerStatsLine): number => {
  const attempts = line.totals.fga + 0.44 * line.totals.fta;
  if (attempts <= 0) return 0;
  return (line.totals.points / (2 * attempts)) * 100;
};

const computePraPerGame = (line: PlayerStatsLine): number =>
  line.perGame.ppg + line.perGame.rpg + line.perGame.apg - line.perGame.topg;

const shrinkToMean = (value: number, prior: number, games: number, k = SHRINKAGE_GAMES): number => {
  const weight = games / (games + k);
  return prior + (value - prior) * weight;
};

const getReliability = (games: number, minGames: number): number => {
  if (games >= minGames + 4) return 1;
  if (games >= minGames + 2) return 0.985;
  if (games >= minGames) return 0.965;
  if (games >= 2) return 0.935;
  return 0.9;
};

const roleKeyStat = (role: IdealFiveRole, line: PlayerStatsLine): { label: string; value: string } => {
  if (role === "PG") {
    return { label: "Control", value: `${line.perGame.apg.toFixed(1)} APG · ${line.perGame.topg.toFixed(1)} TOPG` };
  }
  if (role === "SG") {
    return { label: "Anotación", value: `${line.perGame.ppg.toFixed(1)} PPP · ${line.tpPct.toFixed(1)}% 3P` };
  }
  if (role === "SF") {
    return { label: "Impacto", value: `${line.valuationPerGame.toFixed(1)} VAL/PJ` };
  }
  if (role === "PF") {
    return { label: "Físico", value: `${line.perGame.rpg.toFixed(1)} RPG · ${line.perGame.bpg.toFixed(1)} BPG` };
  }
  return { label: "Pintura", value: `${line.perGame.bpg.toFixed(1)} BPG · ${line.perGame.rpg.toFixed(1)} RPG` };
};

const pickArchetype = (candidate: {
  pCreation: number;
  pDiscipline: number;
  pScoring: number;
  pShooting: number;
  pImpact: number;
  pPerimeterDefense: number;
  pInteriorDefense: number;
  pRebounding: number;
}): string => {
  const shape: Array<{ key: string; score: number }> = [
    { key: "Creador", score: candidate.pCreation * 0.7 + candidate.pDiscipline * 0.3 },
    { key: "Anotador", score: candidate.pScoring * 0.7 + candidate.pShooting * 0.3 },
    { key: "2-Way", score: candidate.pImpact * 0.45 + candidate.pPerimeterDefense * 0.3 + candidate.pInteriorDefense * 0.25 },
    { key: "Ancla", score: candidate.pInteriorDefense * 0.6 + candidate.pRebounding * 0.4 },
  ];

  shape.sort((a, b) => b.score - a.score);
  return shape[0]?.key ?? "Balanceado";
};

const normalizeTeamKey = (teamName: string | null, playerId: number): string => {
  const normalized = (teamName ?? "").trim();
  return normalized.length > 0 ? normalized : `player-${playerId}`;
};

const buildPlayoffBoost = (playoffLines: PlayerStatsLine[]): Map<number, number> => {
  const active = playoffLines.filter((line) => line.gamesPlayed > 0);
  if (active.length === 0) return new Map<number, number>();

  const playoffImpactValues = active.map((line) => {
    const pra = computePraPerGame(line);
    return line.valuationPerGame * 0.62 + pra * 0.38;
  });

  const boostMap = new Map<number, number>();
  active.forEach((line, index) => {
    const value = playoffImpactValues[index];
    const p = percentile(playoffImpactValues, value);
    const sample = line.gamesPlayed / (line.gamesPlayed + 2);
    const boost = round1(clamp((p - 0.5) * 8 * sample, -4.2, 4.2));
    boostMap.set(line.playerId, boost);
  });
  return boostMap;
};

const selectComparisonPool = (lines: PlayerStatsLine[]): { pool: PlayerStatsLine[]; minGames: number } => {
  const activeLines = lines.filter((line) => line.gamesPlayed > 0);
  if (activeLines.length === 0) return { pool: [], minGames: 0 };

  const maxGames = Math.max(...activeLines.map((line) => line.gamesPlayed), 1);
  const minGames = clamp(Math.ceil(maxGames * 0.35), 2, 6);
  const stable = activeLines.filter((line) => line.gamesPlayed >= minGames);

  if (stable.length >= 6) return { pool: stable, minGames };

  const fallback = activeLines.filter((line) => line.gamesPlayed >= 2);
  if (fallback.length >= 5) return { pool: fallback, minGames };

  return { pool: activeLines, minGames };
};

const buildRawCandidates = (pool: PlayerStatsLine[]): CandidateRaw[] => {
  if (pool.length === 0) return [];

  const priors = {
    ppg: average(pool.map((line) => line.perGame.ppg)),
    apg: average(pool.map((line) => line.perGame.apg)),
    topg: average(pool.map((line) => line.perGame.topg)),
    fpg: average(pool.map((line) => line.perGame.fpg)),
    rpg: average(pool.map((line) => line.perGame.rpg)),
    spg: average(pool.map((line) => line.perGame.spg)),
    bpg: average(pool.map((line) => line.perGame.bpg)),
    tpPct: average(pool.map((line) => line.tpPct)),
    valuationPerGame: average(pool.map((line) => line.valuationPerGame)),
    praPerGame: average(pool.map((line) => computePraPerGame(line))),
    tsPct: average(pool.map((line) => computeTsPct(line))),
  };

  return pool.map((line) => {
    const games = Math.max(0, line.gamesPlayed);
    const tsPct = computeTsPct(line);
    const praPerGame = computePraPerGame(line);

    const shrunkPpg = shrinkToMean(line.perGame.ppg, priors.ppg, games);
    const shrunkApg = shrinkToMean(line.perGame.apg, priors.apg, games);
    const shrunkTopg = shrinkToMean(line.perGame.topg, priors.topg, games);
    const shrunkFpg = shrinkToMean(line.perGame.fpg, priors.fpg, games);
    const shrunkRpg = shrinkToMean(line.perGame.rpg, priors.rpg, games);
    const shrunkSpg = shrinkToMean(line.perGame.spg, priors.spg, games);
    const shrunkBpg = shrinkToMean(line.perGame.bpg, priors.bpg, games);
    const shrunkTpPct = shrinkToMean(line.tpPct, priors.tpPct, games);
    const shrunkValPg = shrinkToMean(line.valuationPerGame, priors.valuationPerGame, games);
    const shrunkPraPg = shrinkToMean(praPerGame, priors.praPerGame, games);
    const shrunkTsPct = shrinkToMean(tsPct, priors.tsPct, games);

    const scoringIndex = shrunkPpg * 0.66 + shrunkTsPct * 0.2 + shrunkTpPct * 0.14;
    const creationIndex = shrunkApg - shrunkTopg * 0.65;
    const shootingIndex = shrunkTpPct * 0.58 + shrunkTsPct * 0.42;
    const perimeterDefenseIndex = shrunkSpg * 1.35 + shrunkRpg * 0.22;
    const interiorDefenseIndex = shrunkBpg * 1.9 + shrunkRpg * 0.43;
    const reboundingIndex = shrunkRpg;
    const impactIndex = shrunkValPg * 0.64 + shrunkPraPg * 0.36;
    const disciplineCost = shrunkTopg * 0.78 + shrunkFpg * 0.22;

    return {
      line,
      games,
      scoringIndex,
      creationIndex,
      shootingIndex,
      perimeterDefenseIndex,
      interiorDefenseIndex,
      reboundingIndex,
      impactIndex,
      disciplineCost,
      tsPct: shrunkTsPct,
      tpPct: shrunkTpPct,
    };
  });
};

const buildCandidateProfiles = (
  regularPool: PlayerStatsLine[],
  playoffBoost: Map<number, number>,
  minGames: number
): CandidateProfile[] => {
  const raws = buildRawCandidates(regularPool);
  if (raws.length === 0) return [];

  const scoringValues = raws.map((raw) => raw.scoringIndex);
  const creationValues = raws.map((raw) => raw.creationIndex);
  const shootingValues = raws.map((raw) => raw.shootingIndex);
  const perimeterDefenseValues = raws.map((raw) => raw.perimeterDefenseIndex);
  const interiorDefenseValues = raws.map((raw) => raw.interiorDefenseIndex);
  const reboundingValues = raws.map((raw) => raw.reboundingIndex);
  const impactValues = raws.map((raw) => raw.impactIndex);
  const disciplineValues = raws.map((raw) => raw.disciplineCost);

  return raws.map((raw) => {
    const pScoring = percentile(scoringValues, raw.scoringIndex);
    const pCreation = percentile(creationValues, raw.creationIndex);
    const pShooting = percentile(shootingValues, raw.shootingIndex);
    const pPerimeterDefense = percentile(perimeterDefenseValues, raw.perimeterDefenseIndex);
    const pInteriorDefense = percentile(interiorDefenseValues, raw.interiorDefenseIndex);
    const pRebounding = percentile(reboundingValues, raw.reboundingIndex);
    const pImpact = percentile(impactValues, raw.impactIndex);
    const pDiscipline = percentile(disciplineValues, raw.disciplineCost, false);

    const reliability = getReliability(raw.games, minGames);
    const playoffRoleBoost = playoffBoost.get(raw.line.playerId) ?? 0;
    const deepInsight = buildPlayerDeepInsight(raw.line, regularPool);
    const insightScore = clamp(deepInsight.score / 100, 0.35, 0.99);

    const overallTalent =
      pImpact * 0.25 +
      pScoring * 0.18 +
      pCreation * 0.14 +
      pShooting * 0.13 +
      ((pPerimeterDefense + pInteriorDefense) / 2) * 0.16 +
      pRebounding * 0.09 +
      pDiscipline * 0.05;

    const overallScore = round1(
      clamp((overallTalent * 0.72 + insightScore * 0.28) * 100 * reliability + playoffRoleBoost, 30, 99)
    );

    const roleScores: Record<IdealFiveRole, number> = {
      PG: (pCreation * 0.34 + pDiscipline * 0.2 + pShooting * 0.16 + pImpact * 0.14 + pScoring * 0.1 + pPerimeterDefense * 0.06) * 100,
      SG: (pScoring * 0.33 + pShooting * 0.24 + pImpact * 0.17 + pDiscipline * 0.12 + pPerimeterDefense * 0.14) * 100,
      SF: (pImpact * 0.22 + pScoring * 0.2 + pPerimeterDefense * 0.17 + pRebounding * 0.14 + pShooting * 0.16 + pInteriorDefense * 0.11) * 100,
      PF: (pInteriorDefense * 0.23 + pRebounding * 0.22 + pImpact * 0.2 + pPerimeterDefense * 0.12 + pShooting * 0.12 + pScoring * 0.11) * 100,
      C: (pInteriorDefense * 0.34 + pRebounding * 0.28 + pImpact * 0.2 + pScoring * 0.1 + pDiscipline * 0.08) * 100,
    };

    IDEAL_FIVE_ROLES.forEach((role) => {
      roleScores[role] = round1(clamp((roleScores[role] * 0.74 + insightScore * 26) * reliability + playoffRoleBoost * 0.9, 30, 99));
    });

    const archetype = pickArchetype({
      pScoring,
      pCreation,
      pShooting,
      pPerimeterDefense,
      pInteriorDefense,
      pRebounding,
      pImpact,
      pDiscipline,
    });

    return {
      line: raw.line,
      reliability,
      playoffBoost: playoffRoleBoost,
      insightScore,
      pScoring,
      pCreation,
      pShooting,
      pPerimeterDefense,
      pInteriorDefense,
      pRebounding,
      pImpact,
      pDiscipline,
      overallScore,
      archetype,
      roleScores,
    };
  });
};

const evaluateLineup = (
  lineup: Array<{ role: IdealFiveRole; candidate: CandidateProfile }>
): { chemistryScore: number; modelScore: number } => {
  const roleScores = lineup.map((slot) => slot.candidate.roleScores[slot.role]);
  const overallScores = lineup.map((slot) => slot.candidate.overallScore);

  const avgRoleScore = average(roleScores);
  const minRoleScore = Math.min(...roleScores);
  const avgOverall = average(overallScores);
  const roleBalance = clamp(100 - standardDeviation(roleScores) * 1.3, 45, 100);

  const avgShooting = average(lineup.map((slot) => slot.candidate.pShooting));
  const creatorCoverage = Math.max(
    ...lineup
      .filter((slot) => slot.role === "PG" || slot.role === "SG")
      .map((slot) => slot.candidate.pCreation)
  );
  const rimCoverage = Math.max(
    ...lineup
      .filter((slot) => slot.role === "PF" || slot.role === "C")
      .map((slot) => slot.candidate.pInteriorDefense)
  );
  const perimeterContainment = Math.max(
    ...lineup
      .filter((slot) => slot.role === "PG" || slot.role === "SG" || slot.role === "SF")
      .map((slot) => slot.candidate.pPerimeterDefense)
  );
  const reboundingCoverage = average(
    lineup
      .filter((slot) => slot.role === "SF" || slot.role === "PF" || slot.role === "C")
      .map((slot) => slot.candidate.pRebounding)
  );
  const discipline = average(
    lineup
      .filter((slot) => slot.role === "PG" || slot.role === "SG" || slot.role === "SF")
      .map((slot) => slot.candidate.pDiscipline)
  );

  const teamCount = new Map<string, number>();
  lineup.forEach((slot) => {
    const key = normalizeTeamKey(slot.candidate.line.teamName, slot.candidate.line.playerId);
    teamCount.set(key, (teamCount.get(key) ?? 0) + 1);
  });

  const maxTeamStack = Math.max(...Array.from(teamCount.values()));
  const teamDiversity = (teamCount.size / 5) * 100;
  const teamStackPenalty = maxTeamStack > 2 ? (maxTeamStack - 2) * 4 : 0;

  const archetypes = new Set(lineup.map((slot) => slot.candidate.archetype));
  const archetypeDiversity = (archetypes.size / 5) * 100;

  const chemistryScore = round1(
    clamp(
      (creatorCoverage * 0.2 +
        avgShooting * 0.17 +
        rimCoverage * 0.18 +
        perimeterContainment * 0.14 +
        reboundingCoverage * 0.1 +
        discipline * 0.09 +
        roleBalance / 100 * 0.08 +
        teamDiversity / 100 * 0.03 +
        archetypeDiversity / 100 * 0.01) *
        100 -
        teamStackPenalty,
      30,
      99
    )
  );

  const weakLinkPenalty = minRoleScore < 58 ? (58 - minRoleScore) * 0.45 : 0;
  const modelScore = round1(
    clamp(avgRoleScore * 0.5 + avgOverall * 0.24 + minRoleScore * 0.11 + chemistryScore * 0.15 - weakLinkPenalty, 30, 99)
  );

  return { chemistryScore, modelScore };
};

export const buildIdealFiveProjection = (
  regularLines: PlayerStatsLine[],
  playoffLines: PlayerStatsLine[] = []
): IdealFiveProjection | null => {
  const { pool: regularPool, minGames } = selectComparisonPool(regularLines);
  if (regularPool.length < 5) return null;

  const playoffBoost = buildPlayoffBoost(playoffLines);
  const profiles = buildCandidateProfiles(regularPool, playoffBoost, minGames);
  if (profiles.length < 5) return null;

  const shortlistSize = Math.min(9, profiles.length);
  const roleCandidates: Record<IdealFiveRole, CandidateProfile[]> = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  };

  IDEAL_FIVE_ROLES.forEach((role) => {
    roleCandidates[role] = [...profiles]
      .sort((a, b) => b.roleScores[role] - a.roleScores[role])
      .slice(0, shortlistSize);
  });

  let best:
    | {
        lineup: Array<{ role: IdealFiveRole; candidate: CandidateProfile }>;
        chemistryScore: number;
        modelScore: number;
      }
    | null = null;

  for (const pg of roleCandidates.PG) {
    for (const sg of roleCandidates.SG) {
      for (const sf of roleCandidates.SF) {
        for (const pf of roleCandidates.PF) {
          for (const c of roleCandidates.C) {
            const lineup = [
              { role: "PG" as const, candidate: pg },
              { role: "SG" as const, candidate: sg },
              { role: "SF" as const, candidate: sf },
              { role: "PF" as const, candidate: pf },
              { role: "C" as const, candidate: c },
            ];

            const uniquePlayers = new Set(lineup.map((slot) => slot.candidate.line.playerId));
            if (uniquePlayers.size < 5) continue;

            const { chemistryScore, modelScore } = evaluateLineup(lineup);
            if (!best || modelScore > best.modelScore) {
              best = { lineup, chemistryScore, modelScore };
            }
          }
        }
      }
    }
  }

  if (!best) return null;

  const lineup = IDEAL_FIVE_ROLES.map((role) => {
    const selected = best?.lineup.find((slot) => slot.role === role);
    if (!selected) return null;

    const { line } = selected.candidate;
    const keyStat = roleKeyStat(role, line);

    return {
      role,
      playerId: line.playerId,
      name: line.name,
      photo: line.photo ?? null,
      teamName: line.teamName,
      gamesPlayed: line.gamesPlayed,
      roleScore: selected.candidate.roleScores[role],
      overallScore: selected.candidate.overallScore,
      keyStatLabel: keyStat.label,
      keyStatValue: keyStat.value,
      archetype: selected.candidate.archetype,
    } satisfies IdealFivePlayer;
  }).filter((slot): slot is IdealFivePlayer => Boolean(slot));

  if (lineup.length < 5) return null;

  const confidence: "alta" | "media" | "baja" =
    regularPool.length >= 18 ? "alta" : regularPool.length >= 10 ? "media" : "baja";

  const hasPlayoffSignal = Array.from(playoffBoost.values()).some((value) => Math.abs(value) > 0.4);
  const note = hasPlayoffSignal
    ? "Modelo por rol con shrinkage por muestra, percentiles del torneo y ajuste por rendimiento en playoffs."
    : "Modelo por rol con shrinkage por muestra, percentiles del torneo y optimización de balance colectivo.";

  return {
    lineup,
    chemistryScore: best.chemistryScore,
    modelScore: best.modelScore,
    sampleSize: regularPool.length,
    minGames,
    confidence,
    note,
    modelVersion: MODEL_VERSION,
  };
};
