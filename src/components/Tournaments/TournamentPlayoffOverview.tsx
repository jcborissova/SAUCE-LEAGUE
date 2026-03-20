import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, BoltIcon, SparklesIcon, TrophyIcon } from "@heroicons/react/24/solid";
import type { PlayoffSeriesRow, TournamentSettings } from "../../types/tournament-analytics";
import { getPlayoffState } from "../../services/tournamentAnalytics";

type Props = {
  tournamentId: string;
  embedded?: boolean;
};

const statusClassName: Record<PlayoffSeriesRow["status"], string> = {
  pending: "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]",
  active: "border-[#f59e0b]/28 bg-[#f59e0b]/12 text-[#b45309] dark:text-[#fcd34d]",
  completed: "border-[#22c55e]/28 bg-[#22c55e]/10 text-[#15803d] dark:text-[#86efac]",
};

const gameStatusClassName: Record<string, string> = {
  scheduled: "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]",
  completed: "border-[#22c55e]/28 bg-[#22c55e]/10 text-[#15803d] dark:text-[#86efac]",
  cancelled: "border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]",
};

const statusLabel: Record<PlayoffSeriesRow["status"], string> = {
  pending: "Pendiente",
  active: "Activa",
  completed: "Completada",
};

const gameStatusLabel: Record<string, string> = {
  scheduled: "Programado",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

const readableDate = (date: string | null, time: string | null) => {
  if (!date) return "Por programar";
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("es-DO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  if (!time) return formattedDate;
  return `${formattedDate} · ${time.slice(0, 5)}`;
};

const TournamentPlayoffOverview: React.FC<Props> = ({ tournamentId, embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TournamentSettings | null>(null);
  const [series, setSeries] = useState<PlayoffSeriesRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPlayoffState(tournamentId);
      setSettings(response.settings);
      setSeries(response.series);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la información de playoffs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tournamentId]);

  const groupedSeries = useMemo(() => {
    return series.reduce<Record<number, PlayoffSeriesRow[]>>((acc, item) => {
      if (!acc[item.roundOrder]) {
        acc[item.roundOrder] = [];
      }
      acc[item.roundOrder].push(item);
      return acc;
    }, {});
  }, [series]);
  const totalGames = useMemo(
    () => series.reduce((acc, item) => acc + item.games.length, 0),
    [series]
  );
  const activeSeries = useMemo(
    () => series.filter((item) => item.status === "active").length,
    [series]
  );
  const completedSeries = useMemo(
    () => series.filter((item) => item.status === "completed").length,
    [series]
  );
  const qualifiedTeams = useMemo(
    () => series.filter((item) => item.winnerName).length,
    [series]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[hsl(var(--border)/0.82)] bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,rgba(245,158,11,0.08)_100%)] shadow-[0_1px_0_hsl(var(--border)/0.3)]">
        <div className="pointer-events-none h-0.5 bg-[linear-gradient(90deg,#f59e0b,rgba(245,158,11,0.08),#f97316)]" />
        <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/24 bg-[#f59e0b]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b45309] dark:text-[#fcd34d]">
              Playoff Stage
            </div>
            <h3 className={`mt-3 font-bold tracking-tight ${embedded ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
              Playoffs
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Estado de series, juegos y clasificados. Esta vista separa claramente la fase de eliminación del
              recorrido de temporada regular.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={`rounded-full border px-3 py-1 ${
                  settings?.playoffFormat?.enabled
                    ? "border-[#f59e0b]/24 bg-[#f59e0b]/10 text-[#b45309] dark:text-[#fcd34d]"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]"
                }`}
              >
                {settings?.playoffFormat?.enabled ? "Formato activo" : "Playoffs desactivados"}
              </span>
              <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1 text-[hsl(var(--text-subtle))]">
                {settings?.seasonType === "regular_plus_playoffs" ? "Regular + Playoffs" : "Solo regular"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <article className="rounded-[14px] border border-[#f59e0b]/24 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(245,158,11,0.04))] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b45309] dark:text-[#fcd34d]">Series</p>
              <p className="mt-1 text-xl font-semibold">{series.length}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{activeSeries} activas</p>
            </article>
            <article className="rounded-[14px] border border-[#fb923c]/22 bg-[linear-gradient(180deg,rgba(249,115,22,0.14),rgba(249,115,22,0.04))] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c2410c] dark:text-[#fdba74]">Juegos</p>
              <p className="mt-1 text-xl font-semibold">{totalGames}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Calendario de eliminación</p>
            </article>
            <article className="rounded-[14px] border border-[#22c55e]/24 bg-[linear-gradient(180deg,rgba(34,197,94,0.14),rgba(34,197,94,0.04))] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#15803d] dark:text-[#86efac]">Clasificados</p>
              <p className="mt-1 text-xl font-semibold">{qualifiedTeams}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Equipos con serie cerrada</p>
            </article>
            <article className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1)/0.9)] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Completadas</p>
              <p className="mt-1 text-xl font-semibold">{completedSeries}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Series resueltas</p>
            </article>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-[hsl(var(--surface-1)/0.72)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-subtle))]">
            <SparklesIcon className="h-4 w-4 text-[#f59e0b]" />
            Bracket, avance por ronda y lectura de momentum.
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-4 py-3 text-sm text-[hsl(var(--destructive))]">
          {error}
        </div>
      )}

      {!error && series.length === 0 && (
        <div className="border bg-[hsl(var(--card))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
          Aún no hay series de playoffs generadas para este torneo.
        </div>
      )}

      {Object.entries(groupedSeries)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, roundSeries]) => (
          <div key={roundSeries[0].roundOrder} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">
                  Ronda {roundSeries[0].roundOrder}
                </p>
                <h4 className="text-lg font-semibold">{roundSeries[0].roundName}</h4>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1 text-xs font-semibold text-[hsl(var(--text-subtle))]">
                <BoltIcon className="h-3.5 w-3.5 text-[#f59e0b]" />
                {roundSeries.length} {roundSeries.length === 1 ? "serie" : "series"}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {roundSeries.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[16px] border border-[hsl(var(--border)/0.82)] bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2)/0.32)_100%)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]"
                >
                  <div className="border-b bg-[hsl(var(--surface-1)/0.72)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">
                          {item.matchupKey.split("_").join(" ")}
                        </p>
                        <p className="mt-1 text-base font-semibold">
                          {item.teamAName ?? "Por definir"} vs {item.teamBName ?? "Por definir"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName[item.status]}`}
                      >
                        {statusLabel[item.status]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="rounded-[12px] border border-[hsl(var(--border)/0.76)] bg-[hsl(var(--surface-1))] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold">
                              {item.seedA ? (
                                <span className="inline-flex min-w-[38px] items-center justify-center rounded-full border border-[#38bdf8]/24 bg-[#0ea5e9]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0369a1] dark:text-[#7dd3fc]">
                                  Seed #{item.seedA}
                                </span>
                              ) : null}
                              <span className="truncate">{item.teamAName ?? "Por definir"}</span>
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {item.winsA}/{item.targetWinsA}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                          <span
                            className="block h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#38bdf8)]"
                            style={{
                              width: `${item.targetWinsA > 0 ? Math.min(100, (item.winsA / item.targetWinsA) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="rounded-[12px] border border-[hsl(var(--border)/0.76)] bg-[hsl(var(--surface-1))] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold">
                              {item.seedB ? (
                                <span className="inline-flex min-w-[38px] items-center justify-center rounded-full border border-[#fb923c]/24 bg-[#f97316]/10 px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] dark:text-[#fdba74]">
                                  Seed #{item.seedB}
                                </span>
                              ) : null}
                              <span className="truncate">{item.teamBName ?? "Por definir"}</span>
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {item.winsB}/{item.targetWinsB}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                          <span
                            className="block h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#fb923c)]"
                            style={{
                              width: `${item.targetWinsB > 0 ? Math.min(100, (item.winsB / item.targetWinsB) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {item.winnerName && (
                      <div className="inline-flex items-center gap-2 rounded-[12px] border border-[#22c55e]/24 bg-[#22c55e]/10 px-3 py-2 text-sm font-medium text-[#15803d] dark:text-[#86efac]">
                        <TrophyIcon className="w-4 h-4" />
                        Clasificado: {item.winnerName}
                      </div>
                    )}

                    <div className="space-y-2">
                      {item.games.map((game) => (
                        <div
                          key={game.id}
                          className="rounded-[12px] border border-[hsl(var(--border)/0.76)] bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">Juego {game.gameNumber}</p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                gameStatusClassName[game.status] ??
                                "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]"
                              }`}
                            >
                              {gameStatusLabel[game.status] ?? game.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[hsl(var(--foreground))]">
                            {game.match?.teamA ?? item.teamAName ?? "TBD"} vs {game.match?.teamB ?? item.teamBName ?? "TBD"}
                          </p>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                            {readableDate(
                              game.scheduledDate ?? game.match?.matchDate ?? null,
                              game.scheduledTime ?? game.match?.matchTime ?? null
                            )}
                          </p>
                          {game.match?.winnerTeam ? (
                            <p className="mt-1 text-xs font-semibold text-[#15803d] dark:text-[#86efac]">
                              Ganador: {game.match.winnerTeam}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
    </section>
  );
};

export default TournamentPlayoffOverview;
