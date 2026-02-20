/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import MatchResultForm from "./MatchResultForm";
import { TrophyIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import { supabase } from "../../lib/supabase";

type Props = {
  tournamentId: string;
};

const TournamentResultsConfig: React.FC<Props> = ({ tournamentId }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);

  const fetchMatches = async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true });

    if (error) {
      console.error("Error al cargar partidos:", error);
      return;
    }

    setMatches(data || []);
  };

  useEffect(() => {
    fetchMatches();
  }, [tournamentId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("es-DO", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-6">
      <div>
        <h3 className="text-2xl sm:text-3xl font-bold">Resultados de Partidos</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Registra ganador y estadísticas completas por jugador.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {matches.map((match) => (
          <div
            key={match.id}
            className="border bg-[hsl(var(--card))] p-4 transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(match.match_date)}</span>
              {match.winner_team && (
                <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--warning))] font-semibold">
                  <TrophyIcon className="w-4 h-4" />
                  Listo
                </span>
              )}
            </div>

            <h4 className="text-sm font-semibold mb-1">
              {match.team_a} <span className="text-[hsl(var(--muted-foreground))]">vs</span> {match.team_b}
            </h4>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              {match.match_time ? String(match.match_time).slice(0, 5) : "--:--"}
            </p>

            {match.winner_team && (
              <p className="text-xs text-[hsl(var(--success))] font-semibold mb-3">Ganador: {match.winner_team}</p>
            )}

            <button
              onClick={() => setSelectedMatch(match.id)}
              className="btn-primary w-full"
            >
              <PencilSquareIcon className="w-4 h-4" />
              {match.winner_team ? "Editar resultado" : "Cargar resultado"}
            </button>
          </div>
        ))}
      </div>

      {selectedMatch !== null && (
        <MatchResultForm
          matchId={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSaved={() => {
            setSelectedMatch(null);
            fetchMatches();
          }}
        />
      )}
    </div>
  );
};

export default TournamentResultsConfig;
