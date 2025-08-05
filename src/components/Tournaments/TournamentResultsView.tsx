/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TrophyIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "../LoadingSpinner";

type Match = {
  id: number;
  match_date: string;
  match_time: string;
  team_a: string;
  team_b: string;
  winner_team: string | null;
};

type PlayerStat = {
  player_id: number;
  points: number;
  player: {
    names: string;
    lastnames: string;
  };
};

type TeamPlayersMap = {
  [teamName: string]: number[];
};

const TournamentResultsView = ({ tournamentId }: { tournamentId: string }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [teamPlayersMap, setTeamPlayersMap] = useState<TeamPlayersMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .not("winner_team", "is", null)
        .order("match_date", { ascending: true });

      if (!error) setMatches(data || []);
    };

    const fetchTeamPlayers = async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("name, team_players(player_id)")
        .eq("tournament_id", tournamentId);

      if (!error && data) {
        const map: TeamPlayersMap = {};
        for (const team of data) {
          map[team.name] = team.team_players.map((tp: any) => tp.player_id);
        }
        setTeamPlayersMap(map);
      }
    };

    fetchMatches();
    fetchTeamPlayers();
  }, [tournamentId]);

  const fetchStats = async (match: Match) => {
    setLoading(true);
    setSelectedMatch(match);

    const { data, error } = await supabase
      .from("player_stats")
      .select("player_id, points, player:players(id, names, lastnames)")
      .eq("match_id", match.id);

    if (!error && data) {
      const stats: PlayerStat[] = data.map((stat: any) => ({
        player_id: stat.player_id,
        points: stat.points,
        player: stat.player
          ? {
              names: stat.player.names,
              lastnames: stat.player.lastnames,
            }
          : { names: "", lastnames: "" },
      }));
      setPlayerStats(stats);
    }

    setLoading(false);
  };

  const groupByTeam = (teamName: string) => {
    const playerIds = teamPlayersMap[teamName] || [];
    return playerStats
      .filter((s) => playerIds.includes(s.player_id))
      .sort((a, b) => b.points - a.points);
  };

  const getTeamTotal = (teamName: string) => {
    return groupByTeam(teamName).reduce((sum, s) => sum + s.points, 0);
  };

  const getUngroupedStats = () => {
    const assignedIds = Object.values(teamPlayersMap).flat();
    return playerStats
      .filter((s) => !assignedIds.includes(s.player_id))
      .sort((a, b) => b.points - a.points);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 space-y-8">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-gray-800">
        Resultados del Torneo
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {matches.map((match) => (
          <div
            key={match.id}
            onClick={() => fetchStats(match)}
            className={`cursor-pointer rounded-lg border border-gray-300 bg-white p-4 sm:p-5 transition hover:shadow-md ${
              selectedMatch?.id === match.id ? "ring-2 ring-blue-500" : ""
            }`}
          >
<div className="flex flex-col items-center sm:items-start sm:flex-row sm:justify-between gap-2 mb-3 border-b pb-2">
  <div className="text-center sm:text-left flex-1">
    <h3 className="text-sm sm:text-base font-bold text-gray-800">
      {match.team_a}
    </h3>
    <div className="my-1">
      <span className="inline-block px-3 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs sm:text-sm font-semibold shadow-sm tracking-widest">
        VS
      </span>
    </div>
    <h3 className="text-sm sm:text-base font-bold text-gray-800">
      {match.team_b}
    </h3>
  </div>

  {match.winner_team && (
    <div className="flex items-center gap-1 text-green-600 text-xs sm:text-sm font-semibold">
      <TrophyIcon className="w-4 h-4" />
      <span className="truncate max-w-[140px]">{match.winner_team}</span>
    </div>
  )}
</div>

            <p className="text-xs sm:text-sm text-gray-500">
              {match.match_date} • {match.match_time}
            </p>
          </div>
        ))}
      </div>

      {selectedMatch && (
        <div className="bg-white border rounded-xl shadow-md px-4 sm:px-6 py-5">
          <div className="text-center mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
              {selectedMatch.team_a}
            </h3>

            <div className="my-1 sm:my-2">
              <span className="inline-block px-3 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs sm:text-sm font-semibold shadow-sm tracking-widest">
                VS
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
              {selectedMatch.team_b}
            </h3>

            <p className="mt-2 text-sm sm:text-base text-gray-500 italic">
              Estadísticas del partido
            </p>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : playerStats.length === 0 ? (
            <p className="text-center text-sm text-gray-500">
              No hay estadísticas disponibles.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[selectedMatch.team_a, selectedMatch.team_b].map((team) => (
                <div key={team}>
                  <h4 className="text-sm sm:text-base font-semibold text-blue-700 mb-2">
                    {team}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border border-gray-200 rounded-md">
                      <thead className="bg-gray-100 text-gray-700 uppercase text-[10px] sm:text-xs font-bold">
                        <tr>
                          <th className="px-3 py-2">Jugador</th>
                          <th className="px-3 py-2 text-center">Puntos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {groupByTeam(team).map((stat, idx) => (
                          <tr key={idx} className="bg-white hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800">
                              {stat.player.names} {stat.player.lastnames}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-blue-800">
                              {stat.points}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold">
                          <td className="px-3 py-2 text-gray-900">Total</td>
                          <td className="px-3 py-2 text-center text-blue-900">
                            {getTeamTotal(team)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {getUngroupedStats().length > 0 && (
                <div className="lg:col-span-2">
                  <h4 className="text-sm sm:text-base font-semibold text-red-700 mb-2">
                    Sin equipo
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border border-gray-200 rounded-md">
                      <thead className="bg-gray-100 text-gray-700 uppercase text-[10px] sm:text-xs font-bold">
                        <tr>
                          <th className="px-3 py-2">Jugador</th>
                          <th className="px-3 py-2 text-center">Puntos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getUngroupedStats().map((stat, idx) => (
                          <tr key={idx} className="bg-white hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800">
                              {stat.player.names} {stat.player.lastnames}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-blue-800">
                              {stat.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TournamentResultsView;
