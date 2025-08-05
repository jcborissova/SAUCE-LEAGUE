/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import MatchResultForm from "./MatchResultForm";
import {
  TrophyIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type Props = {
  tournamentId: string;
};

const TournamentResultsConfig: React.FC<Props> = ({ tournamentId }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("match_date", { ascending: true });

      if (error) {
        console.error("Error al cargar partidos:", error);
        return;
      }

      setMatches(data || []);
    };

    fetchMatches();
  }, [tournamentId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-DO", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h3 className="text-3xl font-bold text-center text-gray-900 mb-10">
        Resultados de Partidos
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {matches.map((match) => (
          <div
            key={match.id}
            className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 transition hover:shadow-md hover:-translate-y-1 duration-300"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500">
                {formatDate(match.match_date)}
              </span>
              {match.winner_team && (
                <div className="flex items-center gap-1 text-yellow-500">
                  <TrophyIcon className="w-5 h-5" title="Ganador" />
                </div>
              )}
            </div>

            <h4 className="text-lg font-semibold text-gray-800 mb-1 truncate">
              {match.team_a} <span className="text-gray-400">vs</span>{" "}
              {match.team_b}
            </h4>

            {match.winner_team && (
              <p className="text-sm text-green-600 font-medium mb-4">
                🏆 {match.winner_team}
              </p>
            )}

            <button
              onClick={() => setSelectedMatch(match.id)}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <PencilSquareIcon className="w-4 h-4" />
              {match.winner_team ? "Editar Resultado" : "Subir Resultado"}
            </button>
          </div>
        ))}
      </div>

      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 animate-fade-in">
            <MatchResultForm
              matchId={selectedMatch}
              onClose={() => setSelectedMatch(null)}
            />
            <button
              onClick={() => setSelectedMatch(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition"
              aria-label="Cerrar"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentResultsConfig;
