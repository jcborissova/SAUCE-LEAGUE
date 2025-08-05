/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { TrophyIcon, XMarkIcon } from "@heroicons/react/24/solid";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type PlayerStatKey = "points" | "rebounds" | "assists";

type Props = {
  matchId: number;
  onClose: () => void;
};

const MatchResultForm: React.FC<Props> = ({ matchId, onClose }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [winnerTeam, setWinnerTeam] = useState<string>("");
  const [stats, setStats] = useState<Record<string, { points: number; rebounds: number; assists: number }>>({});
  const [originalStats, setOriginalStats] = useState<typeof stats>({});
  const [originalWinner, setOriginalWinner] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("team_a, team_b, winner_team, tournament_id")
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        console.error("Error fetching match:", matchError);
        setLoading(false);
        return;
      }

      setTeams([match.team_a, match.team_b]);
      setWinnerTeam(match.winner_team || "");
      setOriginalWinner(match.winner_team || "");

      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("tournament_id", match.tournament_id)
        .in("name", [match.team_a, match.team_b]);

      const teamIdToNameMap = Object.fromEntries((teamsData ?? []).map(t => [t.id, t.name]));

      const { data: teamPlayersData } = await supabase
        .from("team_players")
        .select("player_id, team_id")
        .in("team_id", (teamsData ?? []).map(t => t.id));

      const playerIds = (teamPlayersData ?? []).map(p => p.player_id);
      const { data: playerDetails } = await supabase
        .from("players")
        .select("id, names, lastnames")
        .in("id", playerIds);

      const fullPlayers = (teamPlayersData ?? []).map(tp => {
        const playerInfo = (playerDetails ?? []).find(p => p.id === tp.player_id);
        return {
          player_id: tp.player_id,
          team: teamIdToNameMap[tp.team_id],
          names: playerInfo?.names || "",
          lastnames: playerInfo?.lastnames || "",
        };
      });

      const { data: existingStats } = await supabase
        .from("player_stats")
        .select("player_id, points, rebounds, assists")
        .eq("match_id", matchId);

      const initialStats: any = {};
      fullPlayers.forEach((p) => {
        const existing = existingStats?.find((s) => s.player_id === p.player_id);
        initialStats[p.player_id] = {
          points: existing?.points || 0,
          rebounds: existing?.rebounds || 0,
          assists: existing?.assists || 0,
        };
      });

      setPlayers(fullPlayers);
      setStats(initialStats);
      setOriginalStats(initialStats);
      setLoading(false);
    };

    fetchData();
  }, [matchId]);

  const handleStatChange = (playerId: string, stat: string, value: number) => {
    setStats(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [stat]: value },
    }));
  };

  const hasChanges = () => {
    if (winnerTeam !== originalWinner) return true;
    for (const key in stats) {
      const s = stats[key];
      const o = originalStats[key] || {};
      if (s.points !== o.points || s.rebounds !== o.rebounds || s.assists !== o.assists) return true;
    }
    return false;
  };

  const handleClose = () => {
    if (hasChanges()) {
      if (!confirm("Hay cambios sin guardar. ¿Deseas salir sin guardar?")) return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!winnerTeam) {
      alert("Selecciona un equipo ganador.");
      return;
    }

    const { error: updateError } = await supabase
      .from("matches")
      .update({ winner_team: winnerTeam })
      .eq("id", matchId);

    const insertData = Object.entries(stats).map(([playerId, s]) => ({
      match_id: matchId,
      player_id: Number(playerId),
      points: s.points,
      rebounds: s.rebounds,
      assists: s.assists,
    }));

    const { error: insertError } = await supabase
      .from("player_stats")
      .upsert(insertData, { onConflict: "match_id,player_id" });

    if (!updateError && !insertError) {
      alert("Resultados guardados correctamente.");
      onClose();
    } else {
      console.error(updateError || insertError);
      alert("Error guardando los resultados.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center px-2">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b relative">
          <h2 className="text-xl font-bold text-gray-900 text-center flex items-center gap-2 justify-center">
            <TrophyIcon className="w-6 h-6 text-yellow-500" />
            {winnerTeam ? "Editar Resultado del Partido" : "Subir Resultado del Partido"}
          </h2>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition"
            title="Cerrar"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
          {loading ? (
            <p className="text-center text-gray-500">Cargando datos del partido...</p>
          ) : (
            <>
              {/* SELECT WINNER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipo ganador:
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={winnerTeam}
                  onChange={(e) => setWinnerTeam(e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              {/* TEAM STATS */}
              {teams.map((team) => (
                <div key={team}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">
                    {team}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-200 rounded-md">
                      <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                        <tr>
                          <th className="p-2 text-left">Jugador</th>
                          <th className="p-2 text-center">Pts</th>
                          <th className="p-2 text-center">Reb</th>
                          <th className="p-2 text-center">Ast</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players
                          .filter((p) => p.team === team)
                          .map((p) => (
                            <tr key={p.player_id} className="border-t hover:bg-gray-50">
                              <td className="p-2 whitespace-nowrap">
                                {p.names} {p.lastnames}
                              </td>
                              {(["points", "rebounds", "assists"] as PlayerStatKey[]).map((stat) => (
                                <td key={stat} className="p-2 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-16 md:w-20 border border-gray-300 rounded-md text-center px-1 py-0.5 focus:ring-1 focus:ring-blue-500"
                                    value={stats[p.player_id]?.[stat] || 0}
                                    onChange={(e) =>
                                      handleStatChange(p.player_id, stat, Number(e.target.value))
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex justify-end">
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md transition-all duration-150 w-full sm:w-auto"
          >
            {winnerTeam ? "Editar Resultado" : "Guardar Resultado"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchResultForm;
