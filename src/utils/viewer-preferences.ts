import type {
  ViewerFollowState,
  ViewerMatchFilters,
  ViewerMatchStatusFilter,
  ViewerMatchWindowFilter,
} from "../types/tournament-analytics";

export const VIEWER_SELECTED_TOURNAMENT_KEY = "sauce-league:viewer:selected-tournament:v1";
export const VIEWER_FOLLOWS_KEY = "sauce-league:viewer:follows:v1";
export const VIEWER_MATCH_FILTERS_KEY = "sauce-league:viewer:match-filters:v1";
export const VIEWER_SELECTED_PLAYER_BY_TOURNAMENT_KEY =
  "sauce-league:viewer:selected-player-by-tournament:v1";

export type ViewerResultsFilters = ViewerMatchFilters & {
  date: string | null;
  hasScore: "all" | "with_score";
};

export type ViewerTournamentMatchFilterState = {
  schedule: ViewerMatchFilters;
  results: ViewerResultsFilters;
};

const DEFAULT_MATCH_FILTERS: ViewerMatchFilters = {
  team: null,
  status: "all",
  window: "all",
};

const DEFAULT_RESULTS_FILTERS: ViewerResultsFilters = {
  ...DEFAULT_MATCH_FILTERS,
  date: null,
  hasScore: "all",
};

const sanitizeStatus = (value: unknown): ViewerMatchStatusFilter =>
  value === "pending" || value === "completed" ? value : "all";

const sanitizeWindow = (value: unknown): ViewerMatchWindowFilter =>
  value === "today" || value === "next7" ? value : "all";

const sanitizeTeam = (value: unknown): string | null => {
  const team = typeof value === "string" ? value.trim() : "";
  return team.length > 0 ? team : null;
};

const sanitizeDate = (value: unknown): string | null => {
  const date = typeof value === "string" ? value.trim() : "";
  return date.length > 0 ? date : null;
};

const readLocalStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocalStorage = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // noop
  }
};

export const loadViewerSelectedTournamentId = (): string | null => {
  const raw = readLocalStorage(VIEWER_SELECTED_TOURNAMENT_KEY);
  if (!raw) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
};

export const saveViewerSelectedTournamentId = (tournamentId: string) => {
  const value = tournamentId.trim();
  if (!value) return;
  writeLocalStorage(VIEWER_SELECTED_TOURNAMENT_KEY, value);
};

export const loadViewerSelectedPlayerByTournament = (): Record<string, number> => {
  const raw = readLocalStorage(VIEWER_SELECTED_PLAYER_BY_TOURNAMENT_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const byTournament: Record<string, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([tournamentId, value]) => {
      const safeTournamentId = tournamentId.trim();
      const playerId = Number(value);
      if (!safeTournamentId) return;
      if (!Number.isFinite(playerId) || playerId <= 0) return;
      byTournament[safeTournamentId] = Math.floor(playerId);
    });

    return byTournament;
  } catch {
    return {};
  }
};

export const getViewerSelectedPlayerForTournament = (tournamentId: string): number | null => {
  const safeTournamentId = tournamentId.trim();
  if (!safeTournamentId) return null;
  const byTournament = loadViewerSelectedPlayerByTournament();
  return byTournament[safeTournamentId] ?? null;
};

export const saveViewerSelectedPlayerForTournament = (
  tournamentId: string,
  playerId: number | null
) => {
  const safeTournamentId = tournamentId.trim();
  if (!safeTournamentId) return;

  const byTournament = loadViewerSelectedPlayerByTournament();
  if (playerId === null || !Number.isFinite(playerId) || playerId <= 0) {
    delete byTournament[safeTournamentId];
  } else {
    byTournament[safeTournamentId] = Math.floor(playerId);
  }

  writeLocalStorage(
    VIEWER_SELECTED_PLAYER_BY_TOURNAMENT_KEY,
    JSON.stringify(byTournament)
  );
};

export const loadViewerFollows = (): ViewerFollowState => {
  const raw = readLocalStorage(VIEWER_FOLLOWS_KEY);
  if (!raw) return { teams: [], players: [] };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { teams: [], players: [] };
    const source = parsed as Partial<ViewerFollowState>;

    const teams = Array.isArray(source.teams)
      ? Array.from(new Set(source.teams.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)))
      : [];

    const players = Array.isArray(source.players)
      ? Array.from(
          new Set(
            source.players
              .map((value) => Number(value))
              .filter((playerId) => Number.isFinite(playerId) && playerId > 0)
          )
        )
      : [];

    return { teams, players };
  } catch {
    return { teams: [], players: [] };
  }
};

export const saveViewerFollows = (state: ViewerFollowState) => {
  const teams = Array.from(new Set(state.teams.map((team) => team.trim()).filter(Boolean)));
  const players = Array.from(new Set(state.players.filter((playerId) => Number.isFinite(playerId) && playerId > 0)));
  writeLocalStorage(VIEWER_FOLLOWS_KEY, JSON.stringify({ teams, players }));
};

export const toggleViewerTeamFollow = (current: ViewerFollowState, teamName: string): ViewerFollowState => {
  const team = teamName.trim();
  if (!team) return current;
  const exists = current.teams.includes(team);
  return {
    ...current,
    teams: exists ? current.teams.filter((item) => item !== team) : [...current.teams, team],
  };
};

export const toggleViewerPlayerFollow = (current: ViewerFollowState, playerId: number): ViewerFollowState => {
  if (!Number.isFinite(playerId) || playerId <= 0) return current;
  const exists = current.players.includes(playerId);
  return {
    ...current,
    players: exists ? current.players.filter((item) => item !== playerId) : [...current.players, playerId],
  };
};

const sanitizeMatchFilters = (value: unknown): ViewerMatchFilters => {
  if (!value || typeof value !== "object") return { ...DEFAULT_MATCH_FILTERS };
  const source = value as Partial<ViewerMatchFilters>;
  return {
    team: sanitizeTeam(source.team),
    status: sanitizeStatus(source.status),
    window: sanitizeWindow(source.window),
  };
};

const sanitizeResultsFilters = (value: unknown): ViewerResultsFilters => {
  if (!value || typeof value !== "object") return { ...DEFAULT_RESULTS_FILTERS };
  const source = value as Partial<ViewerResultsFilters>;
  return {
    team: sanitizeTeam(source.team),
    status: sanitizeStatus(source.status),
    window: sanitizeWindow(source.window),
    date: sanitizeDate(source.date),
    hasScore: source.hasScore === "with_score" ? "with_score" : "all",
  };
};

export const loadViewerMatchFiltersByTournament = (): Record<string, ViewerTournamentMatchFilterState> => {
  const raw = readLocalStorage(VIEWER_MATCH_FILTERS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const byTournament: Record<string, ViewerTournamentMatchFilterState> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([tournamentId, value]) => {
      if (!tournamentId.trim()) return;
      const source = value as Partial<ViewerTournamentMatchFilterState> | undefined;
      byTournament[tournamentId] = {
        schedule: sanitizeMatchFilters(source?.schedule),
        results: sanitizeResultsFilters(source?.results),
      };
    });

    return byTournament;
  } catch {
    return {};
  }
};

export const getViewerMatchFiltersForTournament = (
  tournamentId: string
): ViewerTournamentMatchFilterState => {
  const all = loadViewerMatchFiltersByTournament();
  return all[tournamentId] ?? {
    schedule: { ...DEFAULT_MATCH_FILTERS },
    results: { ...DEFAULT_RESULTS_FILTERS },
  };
};

export const saveViewerMatchFiltersForTournament = (
  tournamentId: string,
  state: ViewerTournamentMatchFilterState
) => {
  const safeTournamentId = tournamentId.trim();
  if (!safeTournamentId) return;

  const all = loadViewerMatchFiltersByTournament();
  all[safeTournamentId] = {
    schedule: sanitizeMatchFilters(state.schedule),
    results: sanitizeResultsFilters(state.results),
  };
  writeLocalStorage(VIEWER_MATCH_FILTERS_KEY, JSON.stringify(all));
};
