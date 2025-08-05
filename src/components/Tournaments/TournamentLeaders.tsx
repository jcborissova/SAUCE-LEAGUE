/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Player } from "../../types/player";
import { TrophyIcon, UserIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "../LoadingSpinner";

type PlayerStat = {
  player_id: number;
  points: number;
  player: {
    names: string;
    lastnames: string;
    photo?: string | null;
  };
};

const Trophy = ({ index }: { index: number }) => {
  const color =
    index === 0
      ? "text-yellow-400"
      : index === 1
      ? "text-gray-400"
      : "text-amber-700";

  return <TrophyIcon className={`w-5 h-5 ${color}`} />;
};

const TournamentLeaders = ({ tournamentId }: { tournamentId: string }) => {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      const { data: matches } = await supabase
        .from("matches")
        .select("id")
        .eq("tournament_id", tournamentId);

      if (!matches) return setLoading(false);
      const matchIds = matches.map((m) => m.id);

      const { data: playerStats } = await supabase
        .from("player_stats")
        .select("player_id, points, player:players(id, names, lastnames, photo)")
        .in("match_id", matchIds);

      if (!playerStats) return setLoading(false);

      const grouped: {
        [player_id: number]: { points: number; player: Player };
      } = {};

      for (const stat of playerStats) {
        const playerObj = Array.isArray(stat.player)
          ? stat.player[0]
          : stat.player;

        const player: Player = {
          id: playerObj.id,
          names: playerObj.names,
          lastnames: playerObj.lastnames,
          photo: playerObj.photo,
          backjerseyname: "",
          jerseynumber: 0,
          cedula: "",
          description: "",
        };

        grouped[stat.player_id] = grouped[stat.player_id]
          ? {
              points: grouped[stat.player_id].points + stat.points,
              player,
            }
          : { points: stat.points, player };
      }

      const result: PlayerStat[] = Object.entries(grouped)
        .map(([id, value]) => ({
          player_id: parseInt(id),
          points: value.points,
          player: value.player,
        }))
        .sort((a, b) => b.points - a.points);

      setStats(result);
      setLoading(false);
    };

    fetchStats();
  }, [tournamentId]);

  return (
    <section className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-col items-center justify-center mb-8">
        <TrophyIcon className="w-8 h-8 text-yellow-500 mb-1" />
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight text-center">
          Líderes del Torneo
        </h2>
        <p className="text-sm sm:text-base text-gray-500 mt-1 text-center">
          Jugadores con mayor puntuación acumulada
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : stats.length === 0 ? (
        <p className="text-center text-gray-500">
          No hay estadísticas disponibles.
        </p>
      ) : (
        <div className="space-y-3">
          {stats.map((stat, index) => (
            <div
              key={stat.player_id}
              className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-200 shadow hover:shadow-md transition"
            >
              <div className="text-lg font-bold text-gray-700 w-6 text-center">
                #{index + 1}
              </div>
              {stat.player.photo ? (
                <img
                  src={stat.player.photo}
                  alt={`${stat.player.names} ${stat.player.lastnames}`}
                  className="w-12 h-12 rounded-full object-cover border border-gray-300"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center border">
                  <UserIcon className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {stat.player.names} {stat.player.lastnames}
                </p>
                <p className="text-xs text-gray-500">
                  Total de puntos:{" "}
                  <span className="text-blue-900 font-semibold">
                    {stat.points}
                  </span>
                </p>
              </div>
              {index < 3 && <Trophy index={index} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TournamentLeaders;
