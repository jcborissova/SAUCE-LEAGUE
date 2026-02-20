/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import MatchResultForm from "./MatchResultForm";
import { TrophyIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import { supabase } from "../../lib/supabase";

type Props = {
  tournamentId: string;
};

const TournamentResultsConfig: React.FC<Props> = ({ tournamentId }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);

  const fetchMatches = useCallback(async () => {
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
  }, [tournamentId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("es-DO", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const resolvedMatches = useMemo(() => matches ?? [], [matches]);
  const completedMatches = useMemo(() => resolvedMatches.filter((match) => Boolean(match.winner_team)).length, [resolvedMatches]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="app-card space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-lg font-bold tracking-tight sm:text-xl">Resultados de partidos</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Registra ganador y estadísticas completas por jugador.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Partidos</p>
            <p className="text-sm font-semibold">{resolvedMatches.length}</p>
          </div>
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Completados</p>
            <p className="text-sm font-semibold">{completedMatches}</p>
          </div>
        </div>
      </section>

      {resolvedMatches.length === 0 ? (
        <section className="app-card p-4 text-sm text-[hsl(var(--muted-foreground))] sm:p-5">
          No hay partidos cargados en el calendario.
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resolvedMatches.map((match) => (
            <article key={match.id} className="app-card p-4 transition-colors hover:bg-[hsl(var(--surface-2)/0.5)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(match.match_date)}</span>
                {match.winner_team ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--warning))]">
                    <TrophyIcon className="h-4 w-4" />
                    Listo
                  </span>
                ) : null}
              </div>

              <h4 className="text-sm font-semibold">
                {match.team_a} <span className="text-[hsl(var(--muted-foreground))]">vs</span> {match.team_b}
              </h4>
              <p className="mb-3 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {match.match_time ? String(match.match_time).slice(0, 5) : "--:--"}
              </p>

              {match.winner_team ? (
                <p className="mb-3 text-xs font-semibold text-[hsl(var(--success))]">Ganador: {match.winner_team}</p>
              ) : null}

              <button onClick={() => setSelectedMatch(match.id)} className="btn-primary w-full">
                <PencilSquareIcon className="h-4 w-4" />
                {match.winner_team ? "Editar resultado" : "Cargar resultado"}
              </button>
            </article>
          ))}
        </section>
      )}

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
