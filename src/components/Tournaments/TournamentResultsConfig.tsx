/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MatchResultForm from "./MatchResultForm";
import { TrophyIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import { supabase } from "../../lib/supabase";
import { getTournamentResultsOverview } from "../../services/tournamentAnalytics";
import type { TournamentResultMatchOverview } from "../../types/tournament-analytics";

type Props = {
  tournamentId: string;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isStatementTimeoutError = (message: string): boolean =>
  message.toLowerCase().includes("statement timeout");

const scheduleSortValue = (date: string | null, time: string | null): number => {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(`${date}T${time ? String(time).slice(0, 8) : "00:00:00"}`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

type MatchConfigRow = {
  matchId: number;
  matchDate: string | null;
  matchTime: string | null;
  teamA: string;
  teamB: string;
  winnerTeam: string | null;
  teamAPoints: number;
  teamBPoints: number;
  hasStats: boolean;
};

const TournamentResultsConfig: React.FC<Props> = ({ tournamentId }) => {
  const [matches, setMatches] = useState<MatchConfigRow[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const fetchMatches = useCallback(async () => {
    const maxAttempts = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const [{ data: scheduleRows, error: scheduleError }, scoreRows] = await Promise.all([
          supabase
            .from("matches")
            .select("id, match_date, match_time, team_a, team_b, winner_team")
            .eq("tournament_id", tournamentId)
            .order("match_date", { ascending: true })
            .order("match_time", { ascending: true }),
          getTournamentResultsOverview(tournamentId).catch(() => null),
        ]);

        if (scheduleError) {
          throw new Error(scheduleError.message);
        }

        const scoreById = new Map<number, TournamentResultMatchOverview>(
          (scoreRows ?? []).map((row) => [row.matchId, row])
        );

        const rows: MatchConfigRow[] = (scheduleRows ?? []).map((match) => {
          const score = scoreById.get(match.id);
          return {
            matchId: Number(match.id),
            matchDate: match.match_date ? String(match.match_date) : null,
            matchTime: match.match_time ? String(match.match_time) : null,
            teamA: String(match.team_a ?? ""),
            teamB: String(match.team_b ?? ""),
            winnerTeam: match.winner_team ? String(match.winner_team) : null,
            teamAPoints: score?.teamAPoints ?? 0,
            teamBPoints: score?.teamBPoints ?? 0,
            hasStats: score?.hasStats ?? false,
          };
        });

        setMatches(
          [...rows].sort(
            (a, b) => scheduleSortValue(a.matchDate, a.matchTime) - scheduleSortValue(b.matchDate, b.matchTime)
          )
        );
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "No se pudieron cargar los resultados.";
      }

      const shouldRetry = attempt < maxAttempts && isStatementTimeoutError(lastError);
      if (!shouldRetry) {
        break;
      }

      await wait(180 * 2 ** (attempt - 1));
    }

    console.error("Error al cargar partidos:", lastError);
    setMatches([]);
  }, [tournamentId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    if (selectedMatch === null) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedMatch]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Fecha por definir";
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("es-DO", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const resolvedMatches = useMemo(() => matches ?? [], [matches]);
  const completedMatches = useMemo(() => resolvedMatches.filter((match) => Boolean(match.winnerTeam)).length, [resolvedMatches]);
  const totalPoints = useMemo(
    () => resolvedMatches.reduce((acc, match) => acc + match.teamAPoints + match.teamBPoints, 0),
    [resolvedMatches]
  );
  const selectedMatchInfo = useMemo(
    () => resolvedMatches.find((match) => match.matchId === selectedMatch) ?? null,
    [resolvedMatches, selectedMatch]
  );

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
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Puntos acumulados</p>
            <p className="text-sm font-semibold">{totalPoints}</p>
          </div>
        </div>
      </section>

      {selectedMatch !== null ? (
        <div ref={editorRef} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
            {selectedMatchInfo
              ? `Editando: ${selectedMatchInfo.teamA} vs ${selectedMatchInfo.teamB}`
              : `Editando partido #${selectedMatch}`}
          </p>
          <MatchResultForm
            matchId={selectedMatch}
            onClose={() => setSelectedMatch(null)}
            onSaved={() => {
              setSelectedMatch(null);
              fetchMatches();
            }}
          />
        </div>
      ) : null}

      {resolvedMatches.length === 0 ? (
        <section className="app-card p-4 text-sm text-[hsl(var(--muted-foreground))] sm:p-5">
          No hay partidos cargados en el calendario.
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resolvedMatches.map((match) => (
            <article key={match.matchId} className="app-card p-4 transition-colors hover:bg-[hsl(var(--surface-2)/0.5)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(match.matchDate)}</span>
                {match.winnerTeam ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--warning))]">
                    <TrophyIcon className="h-4 w-4" />
                    Listo
                  </span>
                ) : null}
              </div>

              <h4 className="text-sm font-semibold">
                {match.teamA} <span className="text-[hsl(var(--muted-foreground))]">vs</span> {match.teamB}
              </h4>
              <p className="mb-3 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {match.matchTime ? String(match.matchTime).slice(0, 5) : "--:--"}
              </p>

              {match.hasStats ? (
                <p className="mb-1 text-xs font-semibold text-[hsl(var(--primary))]">
                  Marcador: {match.teamAPoints} - {match.teamBPoints}
                </p>
              ) : null}

              {match.hasStats ? (
                <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
                  Total del partido: {match.teamAPoints + match.teamBPoints} pts
                </p>
              ) : null}

              {match.winnerTeam ? (
                <p className="mb-3 text-xs font-semibold text-[hsl(var(--success))]">Ganador: {match.winnerTeam}</p>
              ) : null}

              <button onClick={() => setSelectedMatch(match.matchId)} className="btn-primary w-full">
                <PencilSquareIcon className="h-4 w-4" />
                {match.winnerTeam ? "Editar resultado" : "Cargar resultado"}
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default TournamentResultsConfig;
