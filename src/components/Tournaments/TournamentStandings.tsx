import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { getTournamentRegularStandings } from "../../services/tournamentAnalytics";
import type { TeamStandingResolved } from "../../utils/standings-tiebreak";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../ui/EmptyState";

type Props = {
  tournamentId: string;
  embedded?: boolean;
};

const formatWinPct = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);
const tieBreakShortLabel = (team: TeamStandingResolved) => {
  if (!team.tieBreakApplied) return "Sin desempate";
  if (team.tieBreakCriterion === "h2h_record") return "H2H récord";
  if (team.tieBreakCriterion === "h2h_point_diff") return "H2H +/-";
  if (team.tieBreakCriterion === "h2h_points_scored") return "H2H puntos";
  if (team.tieBreakCriterion === "overall_point_diff") return "+/- global";
  if (team.tieBreakCriterion === "overall_points_scored") return "Puntos global";
  return "Criterio final";
};

const TournamentStandings: React.FC<Props> = ({ tournamentId, embedded = false }) => {
  const [standings, setStandings] = useState<TeamStandingResolved[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStandings = async () => {
    setLoading(true);
    try {
      const rows = await getTournamentRegularStandings(tournamentId);
      setStandings(rows);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar la tabla de posiciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStandings();
  }, [tournamentId]);

  const sorted = standings;

  const totalGames = useMemo(() => Math.round(sorted.reduce((acc, team) => acc + team.pj, 0) / 2), [sorted]);
  const seededTeams = Math.min(4, sorted.length);
  const teamsWithTieBreak = useMemo(
    () => sorted.filter((team) => team.tieBreakApplied).length,
    [sorted]
  );
  const leaderName = sorted[0]?.name ?? "-";
  const cutoffName = sorted[seededTeams - 1]?.name ?? "-";

  if (loading) return <LoadingSpinner />;

  if (sorted.length === 0) {
    return (
      <section className="space-y-4">
        {!embedded ? (
          <div>
            <h3 className="text-xl font-bold sm:text-2xl">Tabla de posiciones</h3>
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Orden oficial para siembra de playoffs con criterios de desempate tipo FIBA.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[hsl(var(--text-subtle))]">
            Orden oficial para siembra de playoffs con criterios de desempate tipo FIBA.
          </p>
        )}

        <EmptyState
          title="Todavía no hay resultados"
          description="Carga resultados de temporada regular para calcular posiciones y desempates automáticamente."
        />
      </section>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="overflow-hidden rounded-[16px] border border-[hsl(var(--border)/0.82)] bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2)/0.54)_100%)] shadow-[0_1px_0_hsl(var(--border)/0.3)]">
        <div className="pointer-events-none h-0.5 bg-[linear-gradient(90deg,#0ea5e9,rgba(14,165,233,0.08),#22c55e)]" />
        <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/24 bg-[#0ea5e9]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0369a1] dark:text-[#7dd3fc]">
              Regular Season
            </div>
            <h3 className={`mt-3 font-bold tracking-tight ${embedded ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
              Tabla de posiciones
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              La fase regular define la siembra oficial rumbo a playoffs. El orden aplica desempate FIBA:
              enfrentamiento directo, diferencia de puntos y producción anotadora.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1 text-[hsl(var(--text-subtle))]">
                Clasifican Top {seededTeams}
              </span>
              <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1 text-[hsl(var(--text-subtle))]">
                Desempate FIBA activo
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-[14px] border border-[#38bdf8]/24 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(14,165,233,0.04))] px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0369a1] dark:text-[#7dd3fc]">
                Seed #1 actual
              </p>
              <p className="mt-2 text-base font-semibold">{leaderName}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Mejor récord del torneo y referencia inicial de la llave.
              </p>
            </div>
            <div className="rounded-[14px] border border-[#22c55e]/24 bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))] px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#15803d] dark:text-[#86efac]">
                Línea de corte
              </p>
              <p className="mt-2 text-base font-semibold">#{seededTeams} {cutoffName}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Último cupo proyectado a playoffs con la tabla actual.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <article className="rounded-[12px] border bg-[hsl(var(--surface-1))] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Equipos</p>
          <p className="mt-1 text-lg font-semibold">{sorted.length}</p>
        </article>
        <article className="rounded-[12px] border bg-[hsl(var(--surface-1))] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Partidos</p>
          <p className="mt-1 text-lg font-semibold">{totalGames}</p>
        </article>
        <article className="rounded-[12px] border bg-[hsl(var(--surface-1))] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Zona playoffs</p>
          <p className="mt-1 text-lg font-semibold">Top {seededTeams}</p>
        </article>
        <article className="rounded-[12px] border bg-[hsl(var(--surface-1))] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Líder</p>
          <p className="mt-1 truncate text-lg font-semibold">{leaderName}</p>
        </article>
        <article className="rounded-[12px] border bg-[hsl(var(--surface-1))] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Empates resueltos</p>
          <p className="mt-1 text-lg font-semibold">{teamsWithTieBreak}</p>
        </article>
      </div>

      <div className="space-y-2 md:hidden">
        {sorted.map((team, index) => {
          const seed = index + 1;
          const playoffSpot = seed <= seededTeams;
          const seedTone = playoffSpot
            ? "border-[hsl(var(--success)/0.38)] bg-[linear-gradient(135deg,hsl(var(--success)/0.2),hsl(var(--success)/0.05))] text-[hsl(var(--success))]"
            : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]";
          const cardTone = playoffSpot
            ? "border-[hsl(var(--success)/0.24)] bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--success)/0.05)_100%)]"
            : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]";

          return (
            <article key={team.teamId} className={`rounded-xl border px-3 py-3.5 shadow-sm ${cardTone}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-[11px] font-bold ${seedTone}`}>
                      #{seed}
                    </span>
                    <p className="truncate text-sm font-semibold">{team.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">
                    Récord {team.pg}-{team.pp} · PJ {team.pj} · Win% {formatWinPct(team.winPct)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                      playoffSpot
                        ? "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {playoffSpot ? "Playoffs" : "Fuera"}
                  </span>
                  <span className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--text-subtle))]">
                    {tieBreakShortLabel(team)}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border bg-[hsl(var(--surface-2)/0.66)] px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PTS</p>
                  <p className="text-sm font-semibold tabular-nums">{team.classificationPoints}</p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--surface-2)/0.66)] px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">+/-</p>
                  <p className="text-sm font-semibold tabular-nums">{formatSigned(team.pointDiff)}</p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--surface-2)/0.66)] px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PF:PC</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {team.pointsFor}:{team.pointsAgainst}
                  </p>
                </div>
              </div>

              <div className="mt-2 inline-flex w-full items-start gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-2)/0.62)] px-2.5 py-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                <InformationCircleIcon className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">
                  {team.tieBreakExplanation}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))] md:block">
        <div className="flex items-center justify-between gap-3 border-b bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2)/0.5)_100%)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Seeding board</p>
            <p className="text-xs text-[hsl(var(--text-subtle))]">Las primeras {seededTeams} plazas avanzan a playoffs.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-[#22c55e]/28 bg-[#22c55e]/10 px-2.5 py-1 text-[#15803d] dark:text-[#86efac]">
              Clasifica
            </span>
            <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-2.5 py-1 text-[hsl(var(--text-subtle))]">
              Fuera
            </span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Seed</th>
              <th className="px-3 py-2 text-left font-semibold">Equipo</th>
              <th className="px-3 py-2 text-center font-semibold">Récord</th>
              <th className="px-3 py-2 text-center font-semibold">PTS</th>
              <th className="px-3 py-2 text-center font-semibold">+/-</th>
              <th className="px-3 py-2 text-center font-semibold">PF:PC</th>
              <th className="px-3 py-2 text-center font-semibold">PJ</th>
              <th className="px-3 py-2 text-center font-semibold">Win%</th>
              <th className="px-3 py-2 text-left font-semibold">Criterio</th>
              <th className="px-3 py-2 text-right font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, index) => {
              const seed = index + 1;
              const playoffSpot = seed <= seededTeams;

              return (
                <tr
                  key={team.teamId}
                  className={`border-t border-[hsl(var(--border))] ${
                    playoffSpot
                      ? "bg-[linear-gradient(90deg,rgba(34,197,94,0.08),transparent_38%)]"
                      : ""
                  } ${seed === seededTeams ? "border-b-[3px] border-b-[#22c55e]/28" : ""}`}
                >
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex min-w-[40px] items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
                        playoffSpot
                          ? "border-[#22c55e]/28 bg-[#22c55e]/10 text-[#15803d] dark:text-[#86efac]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]"
                      }`}
                    >
                      #{seed}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold">{team.name}</td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    <span className="font-semibold text-[hsl(var(--success))]">{team.pg}</span>
                    <span className="text-[hsl(var(--text-subtle))]">-</span>
                    <span className="font-semibold text-[hsl(var(--destructive))]">{team.pp}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{team.classificationPoints}</td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{formatSigned(team.pointDiff)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {team.pointsFor}:{team.pointsAgainst}
                  </td>
                  <td className="px-3 py-2 text-center">{team.pj}</td>
                  <td className="px-3 py-2 text-center font-semibold">{formatWinPct(team.winPct)}</td>
                  <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{team.tieBreakExplanation}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={playoffSpot ? "font-semibold text-[hsl(var(--success))]" : "text-[hsl(var(--muted-foreground))]"}>
                      {playoffSpot ? "Playoffs" : "Fuera"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-[12px] border bg-[hsl(var(--surface-2)/0.65)] px-3 py-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
        Criterios de desempate (FIBA) aplicados en orden: 1) récord entre empatados, 2) +/- entre empatados, 3)
        puntos anotados entre empatados, 4) +/- global, 5) puntos anotados globales, 6) orden alfabético local.
      </div>
    </section>
  );
};

export default TournamentStandings;
