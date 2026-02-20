import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, TrophyIcon } from "@heroicons/react/24/solid";
import type { PlayoffSeriesRow, TournamentSettings } from "../../types/tournament-analytics";
import { getPlayoffState } from "../../services/tournamentAnalytics";

type Props = {
  tournamentId: string;
  embedded?: boolean;
};

const statusClassName: Record<PlayoffSeriesRow["status"], string> = {
  pending: "bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]",
  active: "bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]",
  completed: "bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]",
};

const gameStatusClassName: Record<string, string> = {
  scheduled: "bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]",
  completed: "bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]",
  cancelled: "bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]",
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

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {embedded ? (
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Estado completo de cruces, series y juegos de playoffs.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`${embedded ? "text-xl sm:text-2xl" : "text-2xl"} font-bold`}>Playoffs</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {settings?.playoffFormat?.enabled ? "Formato activo" : "Playoffs desactivados"}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 border px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Actualizar
        </button>
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
            <h4 className="text-lg font-semibold">{roundSeries[0].roundName}</h4>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {roundSeries.map((item) => (
                <article key={item.id} className="border bg-[hsl(var(--card))] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{item.matchupKey.split("_").join(" ").toUpperCase()}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName[item.status]}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="border px-3 py-2 flex items-center justify-between gap-2">
                      <span>
                        {item.seedA ? `#${item.seedA} ` : ""}
                        {item.teamAName ?? "Por definir"}
                      </span>
                      <span className="font-semibold">
                        {item.winsA}/{item.targetWinsA}
                      </span>
                    </div>
                    <div className="border px-3 py-2 flex items-center justify-between gap-2">
                      <span>
                        {item.seedB ? `#${item.seedB} ` : ""}
                        {item.teamBName ?? "Por definir"}
                      </span>
                      <span className="font-semibold">
                        {item.winsB}/{item.targetWinsB}
                      </span>
                    </div>
                  </div>

                  {item.winnerName && (
                    <div className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--success)/0.2)] px-3 py-1 text-sm text-[hsl(var(--success))]">
                      <TrophyIcon className="w-4 h-4" />
                      Clasificado: {item.winnerName}
                    </div>
                  )}

                  <div className="space-y-2">
                    {item.games.map((game) => (
                      <div key={game.id} className="border px-3 py-2 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">Juego {game.gameNumber}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              gameStatusClassName[game.status] ??
                              "bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]"
                            }`}
                          >
                            {game.status}
                          </span>
                        </div>
                        <p className="text-[hsl(var(--muted-foreground))]">
                          {game.match?.teamA ?? item.teamAName ?? "TBD"} vs {game.match?.teamB ?? item.teamBName ?? "TBD"}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {readableDate(game.scheduledDate ?? game.match?.matchDate ?? null, game.scheduledTime ?? game.match?.matchTime ?? null)}
                        </p>
                        {game.match?.winnerTeam && (
                          <p className="text-xs font-semibold text-[hsl(var(--success))]">Ganador: {game.match.winnerTeam}</p>
                        )}
                      </div>
                    ))}
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
