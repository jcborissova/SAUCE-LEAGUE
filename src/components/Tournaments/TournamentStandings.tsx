import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../ui/EmptyState";

type TeamStanding = {
  teamId: number;
  name: string;
  pj: number;
  pg: number;
  pp: number;
  winPct: number;
};

type Props = {
  tournamentId: string;
  embedded?: boolean;
};

const formatWinPct = (value: number) => `${(value * 100).toFixed(1)}%`;

const TournamentStandings: React.FC<Props> = ({ tournamentId, embedded = false }) => {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStandingsFromView = async () => {
    const { data, error } = await supabase
      .from("tournament_regular_standings")
      .select("team_id, team_name, games_played, wins, losses, win_pct")
      .eq("tournament_id", tournamentId);

    if (error) return null;

    return (data || []).map((row) => ({
      teamId: Number(row.team_id),
      name: String(row.team_name),
      pj: Number(row.games_played ?? 0),
      pg: Number(row.wins ?? 0),
      pp: Number(row.losses ?? 0),
      winPct: Number(row.win_pct ?? 0),
    }));
  };

  const loadStandingsFallback = async () => {
    const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] = await Promise.all([
      supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
      supabase
        .from("matches")
        .select("team_a, team_b, winner_team")
        .eq("tournament_id", tournamentId)
        .not("winner_team", "is", null),
    ]);

    if (teamsError) throw teamsError;
    if (matchesError) throw matchesError;

    const grouped = new Map<string, TeamStanding>();

    (teams || []).forEach((team) => {
      grouped.set(team.name, {
        teamId: team.id,
        name: team.name,
        pj: 0,
        pg: 0,
        pp: 0,
        winPct: 0,
      });
    });

    (matches || []).forEach((match) => {
      const teamA = grouped.get(match.team_a);
      const teamB = grouped.get(match.team_b);
      if (!teamA || !teamB) return;

      teamA.pj += 1;
      teamB.pj += 1;

      if (match.winner_team === match.team_a) {
        teamA.pg += 1;
        teamB.pp += 1;
      } else if (match.winner_team === match.team_b) {
        teamB.pg += 1;
        teamA.pp += 1;
      }
    });

    return Array.from(grouped.values()).map((team) => ({
      ...team,
      winPct: team.pj > 0 ? team.pg / team.pj : 0,
    }));
  };

  const loadStandings = async () => {
    setLoading(true);
    try {
      const fromView = await loadStandingsFromView();
      const rows = fromView ?? (await loadStandingsFallback());
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

  const sorted = useMemo(
    () =>
      [...standings].sort((a, b) => {
        if (b.pg !== a.pg) return b.pg - a.pg;
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return a.teamId - b.teamId;
      }),
    [standings]
  );

  const totalGames = useMemo(() => Math.round(sorted.reduce((acc, team) => acc + team.pj, 0) / 2), [sorted]);
  const seededTeams = Math.min(4, sorted.length);

  if (loading) return <LoadingSpinner />;

  if (sorted.length === 0) {
    return (
      <section className="space-y-4">
        {!embedded ? (
          <div>
            <h3 className="text-xl font-bold sm:text-2xl">Tabla de posiciones</h3>
            <p className="text-sm text-[hsl(var(--text-subtle))]">Orden oficial para siembra de playoffs.</p>
          </div>
        ) : (
          <p className="text-sm text-[hsl(var(--text-subtle))]">Orden oficial para siembra de playoffs.</p>
        )}

        <EmptyState
          title="Todavía no hay resultados"
          description="Carga resultados de partidos para calcular posiciones automáticamente."
        />
      </section>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      {!embedded ? (
        <div>
          <h3 className="text-xl font-bold sm:text-2xl">Tabla de posiciones</h3>
          <p className="text-sm text-[hsl(var(--text-subtle))]">Orden oficial para siembra de playoffs.</p>
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">Orden oficial para siembra de playoffs.</p>
      )}

      <div className="app-panel flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-[hsl(var(--text-subtle))] sm:text-sm">
        <span>
          Equipos: <span className="font-semibold text-[hsl(var(--foreground))]">{sorted.length}</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span>
          Partidos: <span className="font-semibold text-[hsl(var(--foreground))]">{totalGames}</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span>
          Zona playoffs: <span className="font-semibold text-[hsl(var(--foreground))]">Top {seededTeams}</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span>
          Líder: <span className="font-semibold text-[hsl(var(--foreground))]">{sorted[0]?.name ?? "-"}</span>
        </span>
      </div>

      <div className="space-y-2 md:hidden">
        {sorted.map((team, index) => {
          const seed = index + 1;
          const playoffSpot = seed <= 4;

          return (
            <article key={team.teamId} className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-[hsl(var(--surface-2))] px-2 text-xs font-semibold">
                  #{seed}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{team.name}</p>
                  <p className="text-xs text-[hsl(var(--text-subtle))]">
                    Récord {team.pg}-{team.pp} · PJ {team.pj} · Win% {formatWinPct(team.winPct)}
                  </p>
                </div>

                <span
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                    playoffSpot
                      ? "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {playoffSpot ? "Playoffs" : "Fuera"}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-[hsl(var(--surface-1))] md:block">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Seed</th>
              <th className="px-3 py-2 text-left font-semibold">Equipo</th>
              <th className="px-3 py-2 text-center font-semibold">Récord</th>
              <th className="px-3 py-2 text-center font-semibold">PJ</th>
              <th className="px-3 py-2 text-center font-semibold">Win%</th>
              <th className="px-3 py-2 text-right font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, index) => {
              const seed = index + 1;
              const playoffSpot = seed <= 4;

              return (
                <tr
                  key={team.teamId}
                  className={`border-t border-[hsl(var(--border))] ${playoffSpot ? "bg-[hsl(var(--primary)/0.04)]" : ""}`}
                >
                  <td className="px-3 py-2">#{seed}</td>
                  <td className="px-3 py-2 font-semibold">{team.name}</td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    <span className="font-semibold text-[hsl(var(--success))]">{team.pg}</span>
                    <span className="text-[hsl(var(--text-subtle))]">-</span>
                    <span className="font-semibold text-[hsl(var(--destructive))]">{team.pp}</span>
                  </td>
                  <td className="px-3 py-2 text-center">{team.pj}</td>
                  <td className="px-3 py-2 text-center font-semibold">{formatWinPct(team.winPct)}</td>
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
    </section>
  );
};

export default TournamentStandings;
