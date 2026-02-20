import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import dayjs from "dayjs";
import "dayjs/locale/es";
import LoadingSpinner from "../LoadingSpinner";

type Props = {
  tournamentId: string;
  embedded?: boolean;
};

type MatchRow = {
  id: number;
  team_a: string | null;
  team_b: string | null;
  winner_team: string | null;
  match_date: string | null;
  match_time: string | null;
};

type MatchGroup = {
  key: string;
  label: string;
  matches: MatchRow[];
};

const DATELESS_KEY = "__sin_fecha__";

dayjs.locale("es");

const formatDateLabel = (value: string | null) => {
  if (!value) return "Fecha por definir";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("dddd DD MMM YYYY") : "Fecha por definir";
};

const formatTime = (value: string | null) => (value ? String(value).slice(0, 5) : "--:--");

const parseTime = (value: string | null) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.MAX_SAFE_INTEGER;
  return hours * 60 + minutes;
};

const TournamentScheduleView: React.FC<Props> = ({ tournamentId, embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchRow[]>([]);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("matches")
        .select("id, team_a, team_b, winner_team, match_date, match_time")
        .eq("tournament_id", tournamentId)
        .order("match_date", { ascending: true })
        .order("match_time", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        setMatches([]);
      } else {
        setMatches((data ?? []) as MatchRow[]);
      }

      setLoading(false);
    };

    fetchMatches();
  }, [tournamentId]);

  const groupedMatches = useMemo<MatchGroup[]>(() => {
    const grouped = new Map<string, MatchRow[]>();

    matches.forEach((match) => {
      const key = match.match_date ?? DATELESS_KEY;
      const rows = grouped.get(key) ?? [];
      rows.push(match);
      grouped.set(key, rows);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => {
        if (a[0] === DATELESS_KEY) return 1;
        if (b[0] === DATELESS_KEY) return -1;
        return new Date(a[0]).getTime() - new Date(b[0]).getTime();
      })
      .map(([key, rows]) => {
        const sortedRows = [...rows].sort((a, b) => parseTime(a.match_time) - parseTime(b.match_time));
        const rawDate = key === DATELESS_KEY ? null : key;

        return {
          key,
          label: formatDateLabel(rawDate),
          matches: sortedRows,
        };
      });
  }, [matches]);

  const totalMatches = matches.length;
  const completedMatches = matches.filter((match) => Boolean(match.winner_team)).length;
  const pendingMatches = totalMatches - completedMatches;

  return (
    <section className="space-y-4">
      {!embedded ? (
        <header className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold">Calendario</h2>
          <p className="text-sm text-[hsl(var(--text-subtle))]">Vista general de todos los partidos programados.</p>
        </header>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">Calendario general del torneo, sin vista por jornada.</p>
      )}

      <div className="text-xs text-[hsl(var(--text-subtle))]">
        Total: <span className="font-semibold text-[hsl(var(--foreground))]">{totalMatches}</span>
        <span className="mx-1">•</span>
        Finalizados: <span className="font-semibold text-[hsl(var(--foreground))]">{completedMatches}</span>
        <span className="mx-1">•</span>
        Pendientes: <span className="font-semibold text-[hsl(var(--foreground))]">{pendingMatches}</span>
      </div>

      {loading ? (
        <LoadingSpinner label="Cargando calendario" />
      ) : groupedMatches.length === 0 ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">No hay partidos programados todavía.</div>
      ) : (
        <div className="space-y-4">
          {groupedMatches.map((group) => (
            <article key={group.key} className="app-card overflow-hidden">
              <div className="border-b bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <h3 className="text-sm font-semibold capitalize">{group.label}</h3>
              </div>

              <div className="divide-y">
                {group.matches.map((match) => {
                  const played = Boolean(match.winner_team);
                  const winnerIsA = played && match.winner_team === match.team_a;
                  const winnerIsB = played && match.winner_team === match.team_b;

                  return (
                    <div key={match.id} className="px-3 py-3">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <p className={`truncate text-sm font-semibold ${winnerIsA ? "text-[hsl(var(--primary))]" : ""}`}>
                          {match.team_a ?? "Equipo A"}
                        </p>

                        <span className="text-xs font-bold text-[hsl(var(--text-subtle))]">VS</span>

                        <p className={`truncate text-right text-sm font-semibold ${winnerIsB ? "text-[hsl(var(--primary))]" : ""}`}>
                          {match.team_b ?? "Equipo B"}
                        </p>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-xs text-[hsl(var(--text-subtle))]">
                        <span>{played ? `Ganador: ${match.winner_team}` : "Programado"}</span>
                        <span>{formatTime(match.match_time)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default TournamentScheduleView;
