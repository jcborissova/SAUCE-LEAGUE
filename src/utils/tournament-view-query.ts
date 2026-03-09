import type { ViewerMatchStatusFilter } from "../types/tournament-analytics";

export type TournamentViewMainTab = "matches" | "standings" | "stats" | "players";
export type TournamentViewMatchesTab = "schedule" | "results";
export type TournamentViewStatsTab = "analytics" | "playoffs" | "duel";

export type TournamentViewQueryState = {
  tab: TournamentViewMainTab;
  matchesTab: TournamentViewMatchesTab;
  statsTab: TournamentViewStatsTab;
  team: string | null;
  status: ViewerMatchStatusFilter;
  matchId: number | null;
};

export const DEFAULT_TOURNAMENT_VIEW_QUERY: TournamentViewQueryState = {
  tab: "matches",
  matchesTab: "schedule",
  statsTab: "analytics",
  team: null,
  status: "all",
  matchId: null,
};

const parseMainTab = (value: string | null): TournamentViewMainTab => {
  if (value === "standings" || value === "stats" || value === "players") return value;
  return "matches";
};

const parseMatchesTab = (value: string | null): TournamentViewMatchesTab =>
  value === "results" ? "results" : "schedule";

const parseStatsTab = (value: string | null): TournamentViewStatsTab => {
  if (value === "playoffs" || value === "duel") return value;
  return "analytics";
};

const parseStatus = (value: string | null): ViewerMatchStatusFilter => {
  if (value === "pending" || value === "completed") return value;
  return "all";
};

const parseTeam = (value: string | null): string | null => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const parseMatchId = (value: string | null): number | null => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
};

export const parseTournamentViewQuery = (search: string): TournamentViewQueryState => {
  const params = new URLSearchParams(search);

  return {
    tab: parseMainTab(params.get("tab")),
    matchesTab: parseMatchesTab(params.get("matchesTab")),
    statsTab: parseStatsTab(params.get("statsTab")),
    team: parseTeam(params.get("team")),
    status: parseStatus(params.get("status")),
    matchId: parseMatchId(params.get("matchId")),
  };
};

export const serializeTournamentViewQuery = (
  state: TournamentViewQueryState
): string => {
  const params = new URLSearchParams();

  if (state.tab !== DEFAULT_TOURNAMENT_VIEW_QUERY.tab) params.set("tab", state.tab);
  if (state.matchesTab !== DEFAULT_TOURNAMENT_VIEW_QUERY.matchesTab) params.set("matchesTab", state.matchesTab);
  if (state.statsTab !== DEFAULT_TOURNAMENT_VIEW_QUERY.statsTab) params.set("statsTab", state.statsTab);
  if (state.team) params.set("team", state.team);
  if (state.status !== "all") params.set("status", state.status);
  if (state.matchId && state.matchId > 0) params.set("matchId", String(state.matchId));

  const query = params.toString();
  return query ? `?${query}` : "";
};
