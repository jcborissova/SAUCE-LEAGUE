import {
  ChartBarIcon,
  HomeModernIcon,
  ScaleIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import type { BattleMetric, TournamentPhaseFilter, TournamentStatMetric } from "../../../types/tournament-analytics";

export const ANALYTICS_PANEL_OPTIONS = [
  { id: "dashboard", label: "Dashboard", icon: HomeModernIcon },
  { id: "leaders", label: "Líderes", icon: TrophyIcon },
  { id: "races", label: "Races", icon: ChartBarIcon },
  { id: "mvp", label: "MVP", icon: ScaleIcon },
  { id: "finalsMvp", label: "Finals MVP", icon: TrophyIcon },
  { id: "battle", label: "Battle", icon: UserGroupIcon },
] as const;

export type AnalyticsPanelKey = (typeof ANALYTICS_PANEL_OPTIONS)[number]["id"];

export const PHASE_OPTIONS: Array<{ value: TournamentPhaseFilter; label: string }> = [
  { value: "regular", label: "Regular" },
  { value: "playoffs", label: "Playoffs" },
  { value: "finals", label: "Finales" },
  { value: "all", label: "Todos" },
];

export const LEADER_CATEGORIES: Array<{ value: TournamentStatMetric; label: string }> = [
  { value: "points", label: "Puntos" },
  { value: "assists", label: "Asistencias" },
  { value: "rebounds", label: "Rebotes" },
  { value: "steals", label: "Robos" },
  { value: "blocks", label: "Bloqueos" },
  { value: "fg_pct", label: "FG%" },
  { value: "turnovers", label: "Pérdidas (menos es mejor)" },
  { value: "fouls", label: "Faltas (menos es mejor)" },
];

export const RACE_METRICS: Array<{
  value: "points" | "rebounds" | "assists";
  label: string;
}> = [
  { value: "points", label: "Puntos" },
  { value: "rebounds", label: "Rebotes" },
  { value: "assists", label: "Asistencias" },
];

export const BATTLE_METRICS: Array<{ value: BattleMetric; label: string }> = [
  { value: "ppg", label: "PPG" },
  { value: "rpg", label: "RPG" },
  { value: "apg", label: "APG" },
  { value: "spg", label: "SPG" },
  { value: "bpg", label: "BPG" },
  { value: "fg_pct", label: "FG%" },
  { value: "topg", label: "TOPG" },
];
