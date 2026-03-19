import type { BattlePlayerResult, PlayerStatsLine } from "../types/tournament-analytics";
import { buildPlayerDeepInsight } from "./player-insights";

export type PlayerGradeLetter = "S" | "A" | "B" | "C" | "D" | "E";

export type PlayerGradeDisplay = {
  grade: PlayerGradeLetter;
  score: number;
  badgeClassName: string;
  ringClassName: string;
  source: "profile" | "fallback";
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const PLAYER_GRADE_STYLES: Record<PlayerGradeLetter, { badgeClassName: string; ringClassName: string }> = {
  S: {
    badgeClassName: "border-[#fbbf24] bg-[#f59e0b] text-[#111827]",
    ringClassName: "border-[#fcd34d]/55",
  },
  A: {
    badgeClassName: "border-[#60a5fa] bg-[#2563eb] text-white",
    ringClassName: "border-[#93c5fd]/55",
  },
  B: {
    badgeClassName: "border-[#64748b] bg-[#334155] text-white",
    ringClassName: "border-white/35",
  },
  C: {
    badgeClassName: "border-[#fb923c] bg-[#f97316] text-white",
    ringClassName: "border-[#fdba74]/55",
  },
  D: {
    badgeClassName: "border-[#f87171] bg-[#dc2626] text-white",
    ringClassName: "border-[#fca5a5]/55",
  },
  E: {
    badgeClassName: "border-[#ef4444] bg-[#7f1d1d] text-[#fee2e2]",
    ringClassName: "border-[#ef4444]/45",
  },
};

export const buildPlayerGradeDisplay = (
  grade: PlayerGradeLetter,
  score: number,
  source: PlayerGradeDisplay["source"] = "profile"
): PlayerGradeDisplay => ({
  grade,
  score,
  source,
  ...PLAYER_GRADE_STYLES[grade],
});

export const derivePlayerGradeFromProfile = (
  line: PlayerStatsLine | null | undefined,
  peers: PlayerStatsLine[]
): PlayerGradeDisplay | null => {
  if (!line || peers.length === 0) return null;
  const insight = buildPlayerDeepInsight(line, peers);
  return buildPlayerGradeDisplay(insight.grade, insight.score, "profile");
};

export const deriveFallbackBattleGrade = (player: BattlePlayerResult): PlayerGradeDisplay => {
  const metrics = player.metrics;
  const ppg = Math.max(0, metrics.ppg ?? 0);
  const rpg = Math.max(0, metrics.rpg ?? 0);
  const apg = Math.max(0, metrics.apg ?? 0);
  const spg = Math.max(0, metrics.spg ?? 0);
  const bpg = Math.max(0, metrics.bpg ?? 0);
  const fgPct = Math.max(0, metrics.fg_pct ?? 0);
  const topg = Math.max(0, metrics.topg ?? 0);
  const pra = Math.max(0, metrics.pra ?? ppg + rpg + apg - topg);
  const shotLoad = Math.max(0, player.shotLoadPerGame ?? 0);

  const scoreRaw =
    clamp01(ppg / 30) * 24 +
    clamp01(pra / 36) * 18 +
    clamp01(fgPct / 60) * 13 +
    clamp01(apg / 7) * 12 +
    clamp01((spg + bpg) / 4) * 12 +
    clamp01(rpg / 12) * 7 +
    clamp01(1 - topg / 4.5) * 8 +
    clamp01(shotLoad / 16) * 6;

  const score = Math.max(0, Math.min(100, Number(scoreRaw.toFixed(1))));

  if (score >= 90) return buildPlayerGradeDisplay("S", score, "fallback");
  if (score >= 80) return buildPlayerGradeDisplay("A", score, "fallback");
  if (score >= 70) return buildPlayerGradeDisplay("B", score, "fallback");
  if (score >= 60) return buildPlayerGradeDisplay("C", score, "fallback");
  if (score >= 50) return buildPlayerGradeDisplay("D", score, "fallback");
  return buildPlayerGradeDisplay("E", score, "fallback");
};
