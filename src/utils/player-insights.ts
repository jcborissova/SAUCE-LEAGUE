import type { PlayerStatsLine } from "../types/tournament-analytics";

export type InsightGrade = "S" | "A" | "B" | "C" | "D";
export type InsightTone = "primary" | "success" | "warning" | "danger";
export type InsightConfidence = "alta" | "media" | "baja";
export type InsightBadgeTier = "HOF" | "Gold" | "Silver" | "Bronze";
export type InsightBadgeIcon =
  | "fire"
  | "sparkles"
  | "rocket"
  | "star"
  | "shield"
  | "hand"
  | "target"
  | "control";

export type PlayerInsightBadge = {
  name: string;
  tier: InsightBadgeTier;
  note: string;
  strength: number;
  icon: InsightBadgeIcon;
};

export type PlayerInsightStat = {
  label: string;
  value: string;
  percentile: number;
};

export type PlayerDeepInsight = {
  grade: InsightGrade;
  gradeTone: InsightTone;
  score: number;
  confidence: InsightConfidence;
  confidenceNote: string;
  styleTags: string[];
  badges: PlayerInsightBadge[];
  strengths: PlayerInsightStat[];
  watchouts: PlayerInsightStat[];
};

type DerivedMetrics = {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  tpPct: number;
  tsPct: number;
  topg: number;
  valuationPerGame: number;
  praPerGame: number;
  stocksPerGame: number;
  playmakingIndex: number;
  defenseIndex: number;
  efficiencyIndex: number;
  impactIndex: number;
  scoringVolume: number;
  gamesPlayed: number;
};

type InsightPercentiles = {
  scoring: number;
  playmaking: number;
  efficiency: number;
  defense: number;
  impact: number;
  rebounding: number;
  ballSecurity: number;
  steals: number;
  blocks: number;
  shooting3pt: number;
  volume: number;
};

const round1 = (value: number) => Number(value.toFixed(1));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const deriveMetrics = (line: PlayerStatsLine): DerivedMetrics => {
  const ppg = line.perGame.ppg;
  const rpg = line.perGame.rpg;
  const apg = line.perGame.apg;
  const spg = line.perGame.spg;
  const bpg = line.perGame.bpg;
  const topg = line.perGame.topg;
  const praPerGame = ppg + rpg + apg - topg;
  const stocksPerGame = spg + bpg;
  const tsAttempts = line.totals.fga + 0.44 * line.totals.fta;
  const tsPct = tsAttempts > 0 ? (line.totals.points / (2 * tsAttempts)) * 100 : 0;
  const playmakingIndex = apg - topg * 0.55;
  const defenseIndex = stocksPerGame * 0.7 + rpg * 0.3;
  const efficiencyIndex = tsPct * 0.52 + line.fgPct * 0.3 + line.tpPct * 0.18;
  const impactIndex = line.valuationPerGame * 0.62 + praPerGame * 0.38;

  return {
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    fgPct: line.fgPct,
    tpPct: line.tpPct,
    tsPct,
    topg,
    valuationPerGame: line.valuationPerGame,
    praPerGame,
    stocksPerGame,
    playmakingIndex,
    defenseIndex,
    efficiencyIndex,
    impactIndex,
    scoringVolume: line.totals.points,
    gamesPlayed: line.gamesPlayed,
  };
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
  const normalized = higherIsBetter ? base : 1 - base;
  return clamp(normalized, 0, 1);
};

const badgeTierFromPercentile = (value: number): InsightBadgeTier | null => {
  if (value >= 0.95) return "HOF";
  if (value >= 0.86) return "Gold";
  if (value >= 0.74) return "Silver";
  if (value >= 0.6) return "Bronze";
  return null;
};

const confidenceFromGames = (games: number): { confidence: InsightConfidence; factor: number; note: string } => {
  if (games >= 8) {
    return { confidence: "alta", factor: 1, note: "Muestra sólida, perfil bien definido." };
  }
  if (games >= 4) {
    return { confidence: "media", factor: 0.96, note: "Tendencia clara, todavía puede moverse." };
  }
  return { confidence: "baja", factor: 0.92, note: "Pocos juegos, leer con cautela." };
};

const gradeFromRelativeRank = (relativeRank: number): { grade: InsightGrade; tone: InsightTone } => {
  if (relativeRank >= 0.9) return { grade: "S", tone: "success" };
  if (relativeRank >= 0.72) return { grade: "A", tone: "success" };
  if (relativeRank >= 0.46) return { grade: "B", tone: "primary" };
  if (relativeRank >= 0.24) return { grade: "C", tone: "warning" };
  return { grade: "D", tone: "danger" };
};

const selectComparisonPool = (derivedPeers: DerivedMetrics[]): DerivedMetrics[] => {
  if (derivedPeers.length <= 8) return derivedPeers;

  const maxGames = Math.max(...derivedPeers.map((item) => item.gamesPlayed), 1);
  const minStableGames = Math.max(2, Math.ceil(maxGames * 0.35));
  const stablePeers = derivedPeers.filter((item) => item.gamesPlayed >= minStableGames);

  if (stablePeers.length >= Math.max(6, Math.ceil(derivedPeers.length * 0.45))) {
    return stablePeers;
  }

  const fallbackPeers = derivedPeers.filter((item) => item.gamesPlayed >= 2);
  if (fallbackPeers.length >= 4) return fallbackPeers;

  return derivedPeers;
};

const getPercentiles = (
  target: DerivedMetrics,
  peers: DerivedMetrics[]
): InsightPercentiles => ({
  scoring: percentile(peers.map((item) => item.ppg), target.ppg),
  playmaking: percentile(peers.map((item) => item.playmakingIndex), target.playmakingIndex),
  efficiency: percentile(peers.map((item) => item.efficiencyIndex), target.efficiencyIndex),
  defense: percentile(peers.map((item) => item.defenseIndex), target.defenseIndex),
  impact: percentile(peers.map((item) => item.impactIndex), target.impactIndex),
  rebounding: percentile(peers.map((item) => item.rpg), target.rpg),
  ballSecurity: percentile(peers.map((item) => item.topg), target.topg, false),
  steals: percentile(peers.map((item) => item.spg), target.spg),
  blocks: percentile(peers.map((item) => item.bpg), target.bpg),
  shooting3pt: percentile(peers.map((item) => item.tpPct), target.tpPct),
  volume: percentile(peers.map((item) => item.scoringVolume), target.scoringVolume),
});

const weightedCompositeFromPercentiles = (p: InsightPercentiles): number =>
  (p.scoring * 0.27 +
    p.impact * 0.2 +
    p.efficiency * 0.15 +
    p.playmaking * 0.13 +
    p.defense * 0.11 +
    p.rebounding * 0.06 +
    p.ballSecurity * 0.05 +
    p.volume * 0.03) * 100;

const dominanceBonusFromScoring = (ppg: number, sortedPpg: number[]): number => {
  if (sortedPpg.length === 0) return 0;
  const isLeader = ppg >= sortedPpg[0] - 0.01;
  if (!isLeader) return 0;
  const second = sortedPpg.length > 1 ? sortedPpg[1] : sortedPpg[0];
  const scoringGap = ppg - second;
  return clamp(scoringGap * 0.85, 0, 6);
};

export const buildPlayerDeepInsight = (
  line: PlayerStatsLine,
  peersInput: PlayerStatsLine[]
): PlayerDeepInsight => {
  const rawPeers = peersInput.length > 0 ? peersInput : [line];
  const peers = rawPeers.some((peer) => peer.playerId === line.playerId) ? rawPeers : [...rawPeers, line];
  const derivedSelf = deriveMetrics(line);
  const derivedPeers = peers.map((peer) => deriveMetrics(peer));
  const comparisonPool = selectComparisonPool(derivedPeers);
  const p = getPercentiles(derivedSelf, comparisonPool);

  const { confidence, factor, note } = confidenceFromGames(derivedSelf.gamesPlayed);
  const weightedBase = weightedCompositeFromPercentiles(p);

  const comparisonPpgSorted = [...comparisonPool.map((item) => item.ppg)].sort((a, b) => b - a);
  const dominanceBonus = dominanceBonusFromScoring(derivedSelf.ppg, comparisonPpgSorted);
  const adjustedSelfScore = weightedBase * factor + dominanceBonus;

  const peerCompositeScores = comparisonPool.map((peer) => {
    const peerPercentiles = getPercentiles(peer, comparisonPool);
    const peerBase = weightedCompositeFromPercentiles(peerPercentiles);
    const peerConfidenceFactor = confidenceFromGames(peer.gamesPlayed).factor;
    const peerDominanceBonus = dominanceBonusFromScoring(peer.ppg, comparisonPpgSorted);
    return peerBase * peerConfidenceFactor + peerDominanceBonus;
  });

  const relativeRank = percentile(peerCompositeScores, adjustedSelfScore);
  const score = round1(clamp(adjustedSelfScore, 35, 99));
  const gradeMeta = gradeFromRelativeRank(relativeRank);
  const confidenceNote = `${note} Comparado contra ${comparisonPool.length} jugadores de la fase.`;

  const styleCandidates: Array<{ tag: string; score: number }> = [
    { tag: "Anotador principal", score: p.scoring * 0.75 + p.impact * 0.25 },
    { tag: "Armador creador", score: p.playmaking * 0.75 + p.ballSecurity * 0.25 },
    { tag: "Ancla defensiva", score: p.defense * 0.7 + p.rebounding * 0.3 },
    { tag: "Tirador confiable", score: p.efficiency * 0.6 + p.shooting3pt * 0.4 },
    { tag: "Reboteador físico", score: p.rebounding * 0.8 + p.defense * 0.2 },
    { tag: "Impacto global", score: p.impact * 0.75 + p.scoring * 0.25 },
  ];

  const styleTags = styleCandidates
    .filter((entry) => entry.score >= 0.62)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.tag);

  if (styleTags.length === 0) {
    styleTags.push("Perfil balanceado");
  }

  if (p.scoring >= 0.7 && p.defense >= 0.67 && !styleTags.includes("Doble vía")) {
    styleTags[0] = "Doble vía";
  }

  const badgeCandidates: Array<{ name: string; percentile: number; note: string; icon: InsightBadgeIcon }> = [
    {
      name: "Anotador de fuego",
      percentile: p.scoring,
      note: `${derivedSelf.ppg.toFixed(1)} PPP`,
      icon: "fire",
    },
    {
      name: "Creador letal",
      percentile: p.impact,
      note: `PRA ${derivedSelf.praPerGame.toFixed(1)}`,
      icon: "sparkles",
    },
    {
      name: "Motor de juego",
      percentile: p.playmaking,
      note: `${derivedSelf.apg.toFixed(1)} APG`,
      icon: "rocket",
    },
    {
      name: "Francotirador",
      percentile: (p.efficiency + p.shooting3pt) / 2,
      note: `${derivedSelf.tpPct.toFixed(1)}% 3P`,
      icon: "target",
    },
    {
      name: "Dueño del cristal",
      percentile: p.rebounding,
      note: `${derivedSelf.rpg.toFixed(1)} RPG`,
      icon: "star",
    },
    {
      name: "Manos rápidas",
      percentile: p.steals,
      note: `${derivedSelf.spg.toFixed(1)} SPG`,
      icon: "hand",
    },
    {
      name: "Protector del aro",
      percentile: p.blocks,
      note: `${derivedSelf.bpg.toFixed(1)} BPG`,
      icon: "shield",
    },
    {
      name: "Manejo seguro",
      percentile: p.ballSecurity,
      note: `${derivedSelf.topg.toFixed(1)} TOPG`,
      icon: "control",
    },
  ];

  const badges = badgeCandidates
    .map((entry) => {
      const tier = badgeTierFromPercentile(entry.percentile);
      if (!tier) return null;
      return {
        name: entry.name,
        tier,
          note: entry.note,
          strength: entry.percentile,
          icon: entry.icon,
        } satisfies PlayerInsightBadge;
    })
    .filter((entry): entry is PlayerInsightBadge => Boolean(entry))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);

  const strengths: PlayerInsightStat[] = [
    { label: "Anotación", value: `${derivedSelf.ppg.toFixed(1)} PPP`, percentile: p.scoring },
    { label: "Creación", value: `${derivedSelf.apg.toFixed(1)} APG`, percentile: p.playmaking },
    { label: "Eficiencia", value: `${derivedSelf.efficiencyIndex.toFixed(1)} índice`, percentile: p.efficiency },
    { label: "Defensa", value: `${derivedSelf.stocksPerGame.toFixed(1)} stocks`, percentile: p.defense },
    { label: "Impacto", value: `${derivedSelf.valuationPerGame.toFixed(1)} Val/PJ`, percentile: p.impact },
    { label: "Rebote", value: `${derivedSelf.rpg.toFixed(1)} RPG`, percentile: p.rebounding },
  ]
    .filter((entry) => entry.percentile >= 0.62)
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 3);

  const watchouts: PlayerInsightStat[] = [
    { label: "Control de pérdidas", value: `${derivedSelf.topg.toFixed(1)} TOPG`, percentile: p.ballSecurity },
    { label: "Tiro exterior", value: `${derivedSelf.tpPct.toFixed(1)}% 3P`, percentile: p.shooting3pt },
    { label: "Eficiencia", value: `${derivedSelf.efficiencyIndex.toFixed(1)} índice`, percentile: p.efficiency },
    { label: "Defensa activa", value: `${derivedSelf.stocksPerGame.toFixed(1)} stocks`, percentile: p.defense },
  ]
    .filter((entry) => entry.percentile <= 0.42)
    .sort((a, b) => a.percentile - b.percentile)
    .slice(0, 2);

  return {
    grade: gradeMeta.grade,
    gradeTone: gradeMeta.tone,
    score,
    confidence,
    confidenceNote,
    styleTags: styleTags.slice(0, 2),
    badges,
    strengths,
    watchouts,
  };
};
