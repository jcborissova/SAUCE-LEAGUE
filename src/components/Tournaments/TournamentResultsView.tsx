import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "../LoadingSpinner";
import {
  getTournamentResultsOverview,
  getTournamentResultsSummary,
  getMatchBoxscore,
  groupBoxscoreBySide,
} from "../../services/tournamentAnalytics";
import type { TournamentResultBoxscoreRow, TournamentResultMatchOverview } from "../../types/tournament-analytics";

type MatchBoxscoreState = {
  loading: boolean;
  errorMessage: string | null;
  rows: TournamentResultBoxscoreRow[] | null;
};

const formatDateLabel = (value: string | null) => {
  if (!value) return "Fecha por definir";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("dddd DD MMM YYYY") : "Fecha por definir";
};

const formatTime = (value: string | null) => (value ? String(value).slice(0, 5) : "--:--");

const TournamentResultsView = ({
  tournamentId,
  embedded = false,
}: {
  tournamentId: string;
  embedded?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<TournamentResultMatchOverview[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [detailMatch, setDetailMatch] = useState<TournamentResultMatchOverview | null>(null);
  const [boxscoreByMatch, setBoxscoreByMatch] = useState<Record<number, MatchBoxscoreState>>({});

  useEffect(() => {
    const loadResults = async () => {
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
    };

    loadResults();
  }, [tournamentId]);

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

  const ensureBoxscore = async (matchId: number) => {
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
  };

  const handleToggleInline = (match: TournamentResultMatchOverview) => {
    setExpandedMatchId((prev) => (prev === match.matchId ? null : match.matchId));
    ensureBoxscore(match.matchId);
  };

  const handleOpenDetail = (match: TournamentResultMatchOverview) => {
    setDetailMatch(match);
    ensureBoxscore(match.matchId);
  };

  const summary = useMemo(() => getTournamentResultsSummary(matches), [matches]);

  const groupedResults = useMemo(() => {
    const grouped = new Map<string, TournamentResultMatchOverview[]>();

    matches.forEach((match) => {
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
  }, [matches]);

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

      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:max-w-xs">
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Partidos</p>
          <p className="text-sm font-semibold">{summary.playedMatches}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Con marcador</p>
          <p className="text-sm font-semibold">{summary.matchesWithStats}</p>
        </div>
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
          No hay resultados cargados todavía.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedResults.map((group) => (
            <article key={group.key} className="app-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <h3 className="text-sm font-semibold capitalize">{group.label}</h3>
                <span className="text-[11px] text-[hsl(var(--text-subtle))]">{group.rows.length} juego(s)</span>
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
          onReload={() => ensureBoxscore(detailMatch.matchId)}
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
        <div className="soft-scrollbar overflow-x-auto">
          <table className="w-full min-w-[740px] text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
              <tr>
                <th className="px-2 py-2 text-left">Jugador</th>
                <th className="px-2 py-2 text-center">PTS</th>
                <th className="px-2 py-2 text-center">REB</th>
                <th className="px-2 py-2 text-center">AST</th>
                <th className="px-2 py-2 text-center">STL</th>
                <th className="px-2 py-2 text-center">BLK</th>
                <th className="px-2 py-2 text-center">TO</th>
                <th className="px-2 py-2 text-center">FLS</th>
                <th className="px-2 py-2 text-center">FGM/FGA</th>
                <th className="px-2 py-2 text-center">FG%</th>
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
                  <td className="px-2 py-2 text-center tabular-nums">{row.turnovers}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{row.fouls}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{row.fgm}/{row.fga}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{row.fgPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default TournamentResultsView;
