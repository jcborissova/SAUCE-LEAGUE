import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "../LoadingSpinner";
import AppSelect from "../ui/AppSelect";
import {
  getTournamentResultsOverview,
  getTournamentResultsSummary,
  getMatchBoxscore,
  groupBoxscoreBySide,
} from "../../services/tournamentAnalytics";
import type { TournamentResultBoxscoreRow, TournamentResultMatchOverview } from "../../types/tournament-analytics";
import type { ViewerResultsFilters } from "../../utils/viewer-preferences";

type MatchBoxscoreState = {
  loading: boolean;
  errorMessage: string | null;
  rows: TournamentResultBoxscoreRow[] | null;
};

type Props = {
  tournamentId: string;
  embedded?: boolean;
  initialFilters?: ViewerResultsFilters;
  onFiltersChange?: (filters: ViewerResultsFilters) => void;
  initialMatchId?: number | null;
  onMatchOpenChange?: (matchId: number | null) => void;
};

const DEFAULT_RESULTS_FILTERS: ViewerResultsFilters = {
  team: null,
  status: "all",
  window: "all",
  date: null,
  hasScore: "all",
};

const formatDateLabel = (value: string | null) => {
  if (!value) return "Fecha por definir";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("dddd DD MMM YYYY") : "Fecha por definir";
};

const formatTime = (value: string | null) => (value ? String(value).slice(0, 5) : "--:--");

const computePra = (row: TournamentResultBoxscoreRow) =>
  row.points + row.rebounds + row.assists - row.turnovers;

const formatPra = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const normalizeResultsFilters = (filters?: ViewerResultsFilters): ViewerResultsFilters => ({
  team: filters?.team?.trim() ? filters.team.trim() : null,
  status: filters?.status === "pending" || filters?.status === "completed" ? filters.status : "all",
  window: filters?.window === "today" || filters?.window === "next7" ? filters.window : "all",
  date: filters?.date?.trim() ? filters.date.trim() : null,
  hasScore: filters?.hasScore === "with_score" ? "with_score" : "all",
});

const sameResultsFilters = (a: ViewerResultsFilters, b: ViewerResultsFilters): boolean =>
  a.team === b.team &&
  a.status === b.status &&
  a.window === b.window &&
  a.date === b.date &&
  a.hasScore === b.hasScore;

const getTodayIsoLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateFromIso = (value: string | null) => {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const isWithinDays = (value: string | null, days: number) => {
  const date = toDateFromIso(value);
  if (!date) return false;
  const today = toDateFromIso(getTodayIsoLocal());
  if (!today) return false;
  const diffMs = date.getTime() - today.getTime();
  const diffDays = diffMs / 86400000;
  return diffDays >= 0 && diffDays <= days;
};

const TournamentResultsView = ({
  tournamentId,
  embedded = false,
  initialFilters,
  onFiltersChange,
  initialMatchId = null,
  onMatchOpenChange,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<TournamentResultMatchOverview[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [detailMatch, setDetailMatch] = useState<TournamentResultMatchOverview | null>(null);
  const [boxscoreByMatch, setBoxscoreByMatch] = useState<Record<number, MatchBoxscoreState>>({});
  const [filters, setFilters] = useState<ViewerResultsFilters>(() =>
    normalizeResultsFilters(initialFilters ?? DEFAULT_RESULTS_FILTERS)
  );

  const loadResults = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const rows = await getTournamentResultsOverview(tournamentId);
      setMatches(rows);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron cargar los resultados del torneo."
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadResults();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [loadResults]);

  useEffect(() => {
    const next = normalizeResultsFilters(initialFilters ?? DEFAULT_RESULTS_FILTERS);
    setFilters((current) => (sameResultsFilters(current, next) ? current : next));
  }, [
    initialFilters?.team,
    initialFilters?.status,
    initialFilters?.window,
    initialFilters?.date,
    initialFilters?.hasScore,
  ]);

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  useEffect(() => {
    if (!detailMatch) return;

    const previousOverflow = document.body.style.overflow;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailMatch(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [detailMatch]);

  useEffect(() => {
    onMatchOpenChange?.(detailMatch?.matchId ?? null);
  }, [detailMatch?.matchId, onMatchOpenChange]);

  const ensureBoxscore = useCallback(
    async (matchId: number) => {
      const current = boxscoreByMatch[matchId];
      if (current?.loading || current?.rows) return;

      setBoxscoreByMatch((prev) => ({
        ...prev,
        [matchId]: { loading: true, errorMessage: null, rows: null },
      }));

      try {
        const rows = await getMatchBoxscore(tournamentId, matchId);
        setBoxscoreByMatch((prev) => ({
          ...prev,
          [matchId]: { loading: false, errorMessage: null, rows },
        }));
      } catch (error) {
        setBoxscoreByMatch((prev) => ({
          ...prev,
          [matchId]: {
            loading: false,
            errorMessage: error instanceof Error ? error.message : "No se pudo cargar el detalle del juego.",
            rows: null,
          },
        }));
      }
    },
    [boxscoreByMatch, tournamentId]
  );

  useEffect(() => {
    if (!initialMatchId || initialMatchId <= 0 || matches.length === 0) return;
    const targetMatch = matches.find((match) => match.matchId === initialMatchId);
    if (!targetMatch) return;

    setExpandedMatchId(targetMatch.matchId);
    setDetailMatch(targetMatch);
    void ensureBoxscore(targetMatch.matchId);
  }, [initialMatchId, matches, ensureBoxscore]);

  const handleToggleInline = (match: TournamentResultMatchOverview) => {
    setExpandedMatchId((prev) => (prev === match.matchId ? null : match.matchId));
    void ensureBoxscore(match.matchId);
  };

  const handleOpenDetail = (match: TournamentResultMatchOverview) => {
    setDetailMatch(match);
    void ensureBoxscore(match.matchId);
  };

  const summary = useMemo(() => getTournamentResultsSummary(matches), [matches]);

  const teams = useMemo(
    () =>
      Array.from(
        new Set(
          matches
            .flatMap((match) => [match.teamA, match.teamB])
            .map((team) => team.trim())
            .filter((team) => team.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [matches]
  );

  const filteredMatches = useMemo(() => {
    const today = getTodayIsoLocal();

    return matches.filter((match) => {
      if (filters.team && match.teamA !== filters.team && match.teamB !== filters.team) {
        return false;
      }

      if (filters.status === "completed" && !match.winnerTeam) {
        return false;
      }

      if (filters.status === "pending" && Boolean(match.winnerTeam)) {
        return false;
      }

      if (filters.date && match.matchDate !== filters.date) {
        return false;
      }

      if (filters.hasScore === "with_score" && !match.hasStats) {
        return false;
      }

      if (filters.window === "today" && match.matchDate !== today) {
        return false;
      }

      if (filters.window === "next7" && !isWithinDays(match.matchDate, 7)) {
        return false;
      }

      return true;
    });
  }, [filters, matches]);

  const groupedResults = useMemo(() => {
    const grouped = new Map<string, TournamentResultMatchOverview[]>();

    filteredMatches.forEach((match) => {
      const key = match.matchDate ?? "__sin_fecha__";
      const rows = grouped.get(key) ?? [];
      rows.push(match);
      grouped.set(key, rows);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => {
        if (a[0] === "__sin_fecha__") return 1;
        if (b[0] === "__sin_fecha__") return -1;
        return new Date(b[0]).getTime() - new Date(a[0]).getTime();
      })
      .map(([key, rows]) => ({
        key,
        label: formatDateLabel(key === "__sin_fecha__" ? null : key),
        rows: rows.sort((a, b) => formatTime(b.matchTime).localeCompare(formatTime(a.matchTime))),
      }));
  }, [filteredMatches]);

  return (
    <section className="space-y-4">
      {!embedded ? (
        <header className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold">Resultados</h2>
          <p className="text-sm text-[hsl(var(--text-subtle))]">Abre cada partido para ver un resumen y entra en detalle completo cuando lo necesites.</p>
        </header>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">Resultados por juego, con acceso rápido a detalle completo.</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:max-w-2xl sm:grid-cols-4">
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Partidos</p>
          <p className="text-sm font-semibold">{summary.playedMatches}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Con marcador</p>
          <p className="text-sm font-semibold">{summary.matchesWithStats}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Puntos totales</p>
          <p className="text-sm font-semibold">{summary.totalPoints}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Promedio por juego</p>
          <p className="text-sm font-semibold">{summary.avgPoints}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg border bg-[hsl(var(--surface-1))] p-2 sm:grid-cols-2 lg:grid-cols-5 sm:p-3">
        <AppSelect
          value={filters.team ?? ""}
          onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value || null }))}
          className="input-base h-10"
        >
          <option value="">Todos los equipos</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </AppSelect>

        <AppSelect
          value={filters.status}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, status: event.target.value as ViewerResultsFilters["status"] }))
          }
          className="input-base h-10"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="completed">Finalizados</option>
        </AppSelect>

        <AppSelect
          value={filters.window}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, window: event.target.value as ViewerResultsFilters["window"] }))
          }
          className="input-base h-10"
        >
          <option value="all">Toda fecha</option>
          <option value="today">Solo hoy</option>
          <option value="next7">Próximos 7 días</option>
        </AppSelect>

        <input
          type="date"
          value={filters.date ?? ""}
          onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value || null }))}
          className="input-base h-10"
        />

        <AppSelect
          value={filters.hasScore}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, hasScore: event.target.value as ViewerResultsFilters["hasScore"] }))
          }
          className="input-base h-10"
        >
          <option value="all">Con y sin marcador</option>
          <option value="with_score">Solo con marcador</option>
        </AppSelect>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <LoadingSpinner label="Cargando resultados" />
      ) : groupedResults.length === 0 ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">
          No hay resultados para estos filtros.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedResults.map((group) => (
            <article key={group.key} className="app-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <h3 className="text-sm font-semibold capitalize">{group.label}</h3>
                <span className="text-xs text-[hsl(var(--text-subtle))]">{group.rows.length} juego(s)</span>
              </div>

              <div className="divide-y">
                {group.rows.map((match) => {
                  const hasScore = match.hasStats;
                  const winnerIsA = match.winnerTeam === match.teamA;
                  const winnerIsB = match.winnerTeam === match.teamB;
                  const expanded = expandedMatchId === match.matchId;
                  const boxscoreState = boxscoreByMatch[match.matchId];
                  const groupedBox = boxscoreState?.rows ? groupBoxscoreBySide(boxscoreState.rows) : null;

                  return (
                    <div key={match.matchId} className="px-3 py-3">
                      <div className="flex items-center justify-between text-xs text-[hsl(var(--text-subtle))]">
                        <span className="rounded-md border bg-[hsl(var(--surface-2))] px-2 py-1">{formatTime(match.matchTime)}</span>
                        <span>{match.winnerTeam ? "Finalizado" : "Programado"}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <p className={`truncate text-sm font-semibold sm:text-base ${winnerIsA ? "text-[hsl(var(--primary))]" : ""}`}>
                          {match.teamA}
                        </p>

                        <span className="text-lg font-black tabular-nums sm:text-xl">
                          {hasScore ? `${match.teamAPoints} - ${match.teamBPoints}` : "-- - --"}
                        </span>

                        <p className={`truncate text-right text-sm font-semibold sm:text-base ${winnerIsB ? "text-[hsl(var(--primary))]" : ""}`}>
                          {match.teamB}
                        </p>
                      </div>

                      {hasScore ? (
                        <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">
                          Total del partido: {match.teamAPoints + match.teamBPoints} pts
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleInline(match)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
                        >
                          {expanded ? (
                            <>
                              <ChevronUpIcon className="h-4 w-4" />
                              Ocultar detalle
                            </>
                          ) : (
                            <>
                              <ChevronDownIcon className="h-4 w-4" />
                              Ver detalle rápido
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDetail(match)}
                          className="inline-flex min-h-[36px] items-center rounded-lg border border-[hsl(var(--primary)/0.82)] bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition-colors duration-[var(--motion-hover)] hover:brightness-105"
                        >
                          Ver más
                        </button>
                      </div>

                      {expanded ? (
                        <div className="mt-3 rounded-lg border border-[hsl(var(--border)/0.85)] bg-[hsl(var(--surface-2)/0.72)] p-3">
                          {boxscoreState?.loading ? (
                            <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-subtle))]">
                              <ArrowPathIcon className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
                              Cargando detalle del juego...
                            </div>
                          ) : boxscoreState?.errorMessage ? (
                            <p className="text-xs text-[hsl(var(--destructive))]">{boxscoreState.errorMessage}</p>
                          ) : groupedBox ? (
                            <div className="space-y-2 text-xs">
                              <p className="text-[hsl(var(--text-subtle))]">
                                Ganador: <span className="font-semibold text-[hsl(var(--foreground))]">{match.winnerTeam ?? "Por definir"}</span>
                              </p>

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
                                  <p className="font-semibold">Top {match.teamA}</p>
                                  {groupedBox.A[0] ? (
                                    <p className="text-[hsl(var(--text-subtle))]">
                                      {groupedBox.A[0].playerName} · <span className="font-semibold text-[hsl(var(--foreground))]">{groupedBox.A[0].points} pts</span>
                                    </p>
                                  ) : (
                                    <p className="text-[hsl(var(--text-subtle))]">Sin stats cargadas.</p>
                                  )}
                                </div>

                                <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
                                  <p className="font-semibold">Top {match.teamB}</p>
                                  {groupedBox.B[0] ? (
                                    <p className="text-[hsl(var(--text-subtle))]">
                                      {groupedBox.B[0].playerName} · <span className="font-semibold text-[hsl(var(--foreground))]">{groupedBox.B[0].points} pts</span>
                                    </p>
                                  ) : (
                                    <p className="text-[hsl(var(--text-subtle))]">Sin stats cargadas.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-[hsl(var(--text-subtle))]">No hay detalle cargado para este juego.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      {detailMatch ? (
        <MatchDetailFullscreen
          match={detailMatch}
          boxscoreState={boxscoreByMatch[detailMatch.matchId]}
          onBack={() => setDetailMatch(null)}
          onReload={() => void ensureBoxscore(detailMatch.matchId)}
        />
      ) : null}
    </section>
  );
};

const MatchDetailFullscreen = ({
  match,
  boxscoreState,
  onBack,
  onReload,
}: {
  match: TournamentResultMatchOverview;
  boxscoreState?: MatchBoxscoreState;
  onBack: () => void;
  onReload: () => void;
}) => {
  const grouped = boxscoreState?.rows ? groupBoxscoreBySide(boxscoreState.rows) : null;

  return (
    <div className="fixed inset-0 z-[70] bg-[hsl(var(--background))]">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b bg-[hsl(var(--surface-1))]">
          <div className="bg-[linear-gradient(115deg,hsl(var(--primary)/0.96),hsl(var(--primary)/0.78))] px-3 py-3 text-[hsl(var(--primary-foreground))] sm:px-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <p className="truncate text-sm font-semibold sm:text-base">{match.teamA}</p>
              <p className="text-lg font-black tabular-nums sm:text-2xl">
                {match.hasStats ? `${match.teamAPoints} - ${match.teamBPoints}` : "-- - --"}
              </p>
              <p className="truncate text-right text-sm font-semibold sm:text-base">{match.teamB}</p>
            </div>
          </div>

          <div className="px-3 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={onBack} className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs sm:text-sm">
                <ArrowLeftIcon className="h-4 w-4" />
                Volver
              </button>

              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold sm:text-base">{match.teamA} vs {match.teamB}</p>
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  {formatDateLabel(match.matchDate)} · {formatTime(match.matchTime)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          <section className="mb-4 rounded-lg border bg-[hsl(var(--surface-1))] p-3 sm:p-4">
            <p className="text-xs text-[hsl(var(--text-subtle))]">
              Ganador: <span className="font-semibold text-[hsl(var(--foreground))]">{match.winnerTeam ?? "Por definir"}</span>
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">
              Total del partido: <span className="font-semibold text-[hsl(var(--foreground))]">{match.teamAPoints + match.teamBPoints}</span> pts
            </p>
          </section>

          {boxscoreState?.loading ? (
            <LoadingSpinner label="Cargando boxscore" />
          ) : boxscoreState?.errorMessage ? (
            <div className="space-y-3">
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {boxscoreState.errorMessage}
              </div>
              <button className="btn-secondary" onClick={onReload}>Reintentar</button>
            </div>
          ) : grouped ? (
            <div className="space-y-4">
              <TeamBoxscoreTable title={match.teamA} rows={grouped.A} />
              <TeamBoxscoreTable title={match.teamB} rows={grouped.B} />
              {grouped.U.length > 0 ? <TeamBoxscoreTable title="Sin equipo" rows={grouped.U} /> : null}
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--text-subtle))]">No hay detalle disponible para este partido.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const TeamBoxscoreTable = ({ title, rows }: { title: string; rows: TournamentResultBoxscoreRow[] }) => {
  return (
    <section className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
      <header className="border-b bg-[hsl(var(--surface-2))] px-3 py-2">
        <h4 className="text-sm font-semibold sm:text-base">{title}</h4>
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-[hsl(var(--text-subtle))]">Sin estadísticas registradas.</p>
      ) : (
        <>
          <div className="divide-y md:hidden">
            {rows.map((row) => (
              <div key={`mob-${title}-${row.playerId}`} className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold">{row.playerName}</p>
                <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
                  <div className="rounded border bg-[hsl(var(--surface-2)/0.6)] px-1 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PTS</p>
                    <p className="text-sm font-bold tabular-nums">{row.points}</p>
                  </div>
                  <div className="rounded border bg-[hsl(var(--surface-2)/0.6)] px-1 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">REB</p>
                    <p className="text-sm font-semibold tabular-nums">{row.rebounds}</p>
                  </div>
                  <div className="rounded border bg-[hsl(var(--surface-2)/0.6)] px-1 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">AST</p>
                    <p className="text-sm font-semibold tabular-nums">{row.assists}</p>
                  </div>
                  <div className="rounded border bg-[hsl(var(--surface-2)/0.6)] px-1 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PRA</p>
                    <p className="text-sm font-semibold tabular-nums">{formatPra(computePra(row))}</p>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[hsl(var(--text-subtle))] tabular-nums">
                  PRA {formatPra(computePra(row))} · STL {row.steals} · BLK {row.blocks} · TO {row.turnovers} · FLS {row.fouls} · FG {row.fgm}/{row.fga} ({row.fgPct.toFixed(0)}%) · FT {row.ftm}/{row.fta} ({row.ftPct.toFixed(0)}%) · 3PT {row.tpm}/{row.tpa} ({row.tpPct.toFixed(0)}%)
                </p>
              </div>
            ))}
          </div>

          <div className="soft-scrollbar hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-xs uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                <tr>
                  <th className="px-2 py-2 text-left">Jugador</th>
                  <th className="px-2 py-2 text-center">PTS</th>
                  <th className="px-2 py-2 text-center">REB</th>
                  <th className="px-2 py-2 text-center">AST</th>
                  <th className="px-2 py-2 text-center">STL</th>
                  <th className="px-2 py-2 text-center">BLK</th>
                  <th className="px-2 py-2 text-center">PRA</th>
                  <th className="px-2 py-2 text-center">TO</th>
                  <th className="px-2 py-2 text-center">FLS</th>
                  <th className="px-2 py-2 text-center">FGM/FGA</th>
                  <th className="px-2 py-2 text-center">FG%</th>
                  <th className="px-2 py-2 text-center">FTM/FTA</th>
                  <th className="px-2 py-2 text-center">FT%</th>
                  <th className="px-2 py-2 text-center">3PM/3PA</th>
                  <th className="px-2 py-2 text-center">3P%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={`${title}-${row.playerId}`}>
                    <td className="px-2 py-2 font-medium">{row.playerName}</td>
                    <td className="px-2 py-2 text-center tabular-nums font-semibold">{row.points}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.rebounds}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.assists}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.steals}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.blocks}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{formatPra(computePra(row))}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.turnovers}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.fouls}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.fgm}/{row.fga}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.fgPct.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.ftm}/{row.fta}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.ftPct.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.tpm}/{row.tpa}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.tpPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default TournamentResultsView;
