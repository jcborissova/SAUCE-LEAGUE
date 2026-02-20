import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import LoadingSpinner from "../LoadingSpinner";
import {
  getTournamentResultsOverview,
  getTournamentResultsSummary,
} from "../../services/tournamentAnalytics";
import type { TournamentResultMatchOverview } from "../../types/tournament-analytics";

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
          <p className="text-sm text-[hsl(var(--text-subtle))]">Marcador simple por partido: equipos y puntos.</p>
        </header>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">Resultados del torneo en formato simple.</p>
      )}

      <div className="text-xs text-[hsl(var(--text-subtle))]">
        Partidos: <span className="font-semibold text-[hsl(var(--foreground))]">{summary.playedMatches}</span>
        <span className="mx-1">•</span>
        Con marcador: <span className="font-semibold text-[hsl(var(--foreground))]">{summary.matchesWithStats}</span>
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
              <div className="border-b bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <h3 className="text-sm font-semibold capitalize">{group.label}</h3>
              </div>

              <div className="divide-y">
                {group.rows.map((match) => {
                  const hasScore = match.hasStats;
                  const winnerIsA = match.winnerTeam === match.teamA;
                  const winnerIsB = match.winnerTeam === match.teamB;

                  return (
                    <div key={match.matchId} className="px-3 py-3">
                      <div className="flex items-center justify-between text-xs text-[hsl(var(--text-subtle))]">
                        <span>{formatTime(match.matchTime)}</span>
                        <span>{match.winnerTeam ? "Finalizado" : "Programado"}</span>
                      </div>

                      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <p className={`truncate text-sm font-semibold ${winnerIsA ? "text-[hsl(var(--primary))]" : ""}`}>
                          {match.teamA}
                        </p>

                        <span className="text-base font-black tabular-nums">
                          {hasScore ? `${match.teamAPoints} - ${match.teamBPoints}` : "-- - --"}
                        </span>

                        <p className={`truncate text-right text-sm font-semibold ${winnerIsB ? "text-[hsl(var(--primary))]" : ""}`}>
                          {match.teamB}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default TournamentResultsView;
