import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import LoadingSpinner from "../LoadingSpinner";

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

    if (error) {
      return null;
    }

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
    const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] =
      await Promise.all([
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

  const totalGames = useMemo(
    () => Math.round(sorted.reduce((acc, team) => acc + team.pj, 0) / 2),
    [sorted]
  );
  const maxWins = useMemo(
    () => sorted.reduce((max, team) => Math.max(max, team.pg), 0),
    [sorted]
  );
  const seededTeams = Math.min(4, sorted.length);

  if (loading) return <LoadingSpinner />;

  if (sorted.length === 0) {
    return (
      <section className="space-y-4">
        {!embedded ? (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold">Tabla de Posiciones</h3>
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Orden oficial para siembra de playoffs (desempate por orden de equipo).
            </p>
          </div>
        ) : (
          <p className="text-sm text-[hsl(var(--text-subtle))]">
            Orden oficial para siembra de playoffs (desempate por orden de equipo).
          </p>
        )}

        <div className="app-card p-5 text-center">
          <p className="text-sm text-[hsl(var(--text-subtle))]">
            Todavía no hay resultados cargados para calcular posiciones.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      {!embedded ? (
        <div>
          <h3 className="text-xl sm:text-2xl font-bold">Tabla de Posiciones</h3>
          <p className="text-sm text-[hsl(var(--text-subtle))]">
            Orden oficial para siembra de playoffs (desempate por orden de equipo).
          </p>
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Orden oficial para siembra de playoffs (desempate por orden de equipo).
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="app-card rounded-xl px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
            Equipos
          </p>
          <p className="text-lg font-bold">{sorted.length}</p>
        </div>
        <div className="app-card rounded-xl px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
            Partidos
          </p>
          <p className="text-lg font-bold">{totalGames}</p>
        </div>
        <div className="app-card rounded-xl px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
            Zona Playoffs
          </p>
          <p className="text-lg font-bold">{seededTeams}</p>
        </div>
        <div className="app-card rounded-xl px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
            Líder
          </p>
          <p className="text-sm font-semibold truncate">{sorted[0]?.name ?? "-"}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-[hsl(var(--surface-1))]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-xs sm:text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))] sticky top-0">
              <tr>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left font-semibold">Seed</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left font-semibold">Equipo</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold">PJ</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold">PG</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold">PP</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold">Win%</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold">Barra</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-right font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((team, index) => {
                const seed = index + 1;
                const playoffSpot = seed <= 4;
                const winProgress = maxWins > 0 ? (team.pg / maxWins) * 100 : 0;

                return (
                  <tr
                    key={team.teamId}
                    className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))]"
                  >
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-2 text-[11px] sm:h-7 sm:min-w-7 sm:text-xs font-bold ${
                          playoffSpot
                            ? "bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary))]"
                            : "bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]"
                        }`}
                      >
                        #{seed}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold">{team.name}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-center">{team.pj}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold text-[hsl(var(--success))]">
                      {team.pg}
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-center font-semibold text-[hsl(var(--destructive))]">
                      {team.pp}
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-center">{formatWinPct(team.winPct)}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="mx-auto h-1.5 w-16 sm:w-24 overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
                        <div
                          className="h-full rounded-full bg-[hsl(var(--primary))]"
                          style={{ width: `${winProgress}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold ${
                          playoffSpot
                            ? "bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]"
                            : "bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]"
                        }`}
                      >
                        {playoffSpot ? "Playoffs" : "Fuera"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default TournamentStandings;
