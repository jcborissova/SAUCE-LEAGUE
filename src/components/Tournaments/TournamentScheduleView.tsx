import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import dayjs from "dayjs";
import "dayjs/locale/es";
import LoadingSpinner from "../LoadingSpinner";
import AppSelect from "../ui/AppSelect";
import type { ViewerMatchFilters } from "../../types/tournament-analytics";

type Props = {
  tournamentId: string;
  embedded?: boolean;
  initialFilters?: ViewerMatchFilters;
  onFiltersChange?: (filters: ViewerMatchFilters) => void;
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
const DEFAULT_FILTERS: ViewerMatchFilters = {
  team: null,
  status: "all",
  window: "all",
};

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

const getTodayIsoLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateFromIso = (value: string | null) => {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const isWithinDays = (value: string | null, days: number) => {
  const date = toDateFromIso(value);
  if (!date) return false;
  const today = toDateFromIso(getTodayIsoLocal());
  if (!today) return false;
  const diffMs = date.getTime() - today.getTime();
  const diffDays = diffMs / 86400000;
  return diffDays >= 0 && diffDays <= days;
};

const sameFilters = (a: ViewerMatchFilters, b: ViewerMatchFilters): boolean =>
  a.team === b.team && a.status === b.status && a.window === b.window;

const normalizeFilters = (filters?: ViewerMatchFilters): ViewerMatchFilters => ({
  team: filters?.team?.trim() ? filters.team.trim() : null,
  status: filters?.status === "pending" || filters?.status === "completed" ? filters.status : "all",
  window: filters?.window === "today" || filters?.window === "next7" ? filters.window : "all",
});

const TournamentScheduleView: React.FC<Props> = ({
  tournamentId,
  embedded = false,
  initialFilters,
  onFiltersChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [filters, setFilters] = useState<ViewerMatchFilters>(() =>
    normalizeFilters(initialFilters ?? DEFAULT_FILTERS)
  );

  const fetchMatches = useCallback(async () => {
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
  }, [tournamentId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    const next = normalizeFilters(initialFilters ?? DEFAULT_FILTERS);
    setFilters((current) => (sameFilters(current, next) ? current : next));
  }, [initialFilters?.team, initialFilters?.status, initialFilters?.window]);

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMatches();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [fetchMatches]);

  const teams = useMemo(
    () =>
      Array.from(
        new Set(
          matches
            .flatMap((match) => [match.team_a, match.team_b])
            .map((team) => (typeof team === "string" ? team.trim() : ""))
            .filter((team) => team.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [matches]
  );

  const filteredMatches = useMemo(() => {
    const today = getTodayIsoLocal();

    return matches.filter((match) => {
      if (filters.team && match.team_a !== filters.team && match.team_b !== filters.team) {
        return false;
      }

      if (filters.status === "completed" && !match.winner_team) {
        return false;
      }

      if (filters.status === "pending" && Boolean(match.winner_team)) {
        return false;
      }

      if (filters.window === "today" && match.match_date !== today) {
        return false;
      }

      if (filters.window === "next7" && !isWithinDays(match.match_date, 7)) {
        return false;
      }

      return true;
    });
  }, [filters, matches]);

  const groupedMatches = useMemo<MatchGroup[]>(() => {
    const grouped = new Map<string, MatchRow[]>();

    filteredMatches.forEach((match) => {
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
  }, [filteredMatches]);

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

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Total</p>
          <p className="text-sm font-semibold">{totalMatches}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Finalizados</p>
          <p className="text-sm font-semibold">{completedMatches}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-2 py-2">
          <p className="text-[hsl(var(--text-subtle))]">Pendientes</p>
          <p className="text-sm font-semibold">{pendingMatches}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg border bg-[hsl(var(--surface-1))] p-2 sm:grid-cols-3 sm:p-3">
        <AppSelect
          value={filters.team ?? ""}
          onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value || null }))}
          className="input-base h-10"
        >
          <option value="">Todos los equipos</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </AppSelect>

        <AppSelect
          value={filters.status}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              status: event.target.value as ViewerMatchFilters["status"],
            }))
          }
          className="input-base h-10"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="completed">Finalizados</option>
        </AppSelect>

        <AppSelect
          value={filters.window}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              window: event.target.value as ViewerMatchFilters["window"],
            }))
          }
          className="input-base h-10"
        >
          <option value="all">Todo el calendario</option>
          <option value="today">Solo hoy</option>
          <option value="next7">Próximos 7 días</option>
        </AppSelect>
      </div>

      {loading ? (
        <LoadingSpinner label="Cargando calendario" />
      ) : groupedMatches.length === 0 ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">No hay partidos para estos filtros.</div>
      ) : (
        <div className="space-y-4">
          {groupedMatches.map((group) => (
            <article key={group.key} className="app-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <h3 className="text-sm font-semibold capitalize">{group.label}</h3>
                <span className="text-[11px] text-[hsl(var(--text-subtle))]">{group.matches.length} juego(s)</span>
              </div>

              <div className="divide-y">
                {group.matches.map((match) => {
                  const played = Boolean(match.winner_team);
                  const winnerIsA = played && match.winner_team === match.team_a;
                  const winnerIsB = played && match.winner_team === match.team_b;

                  return (
                    <div key={match.id} className="px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p
                            className={`truncate text-sm font-semibold sm:text-base ${winnerIsA ? "text-[hsl(var(--primary))]" : ""}`}
                          >
                            {match.team_a ?? "Equipo A"}
                          </p>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">vs</p>
                          <p
                            className={`truncate text-sm font-semibold sm:text-base ${winnerIsB ? "text-[hsl(var(--primary))]" : ""}`}
                          >
                            {match.team_b ?? "Equipo B"}
                          </p>
                        </div>

                        <div className="space-y-1 text-right">
                          <span className="inline-flex rounded-md border bg-[hsl(var(--surface-2))] px-2 py-1 text-[11px] font-semibold text-[hsl(var(--text-subtle))]">
                            {formatTime(match.match_time)}
                          </span>
                          <p className="text-xs text-[hsl(var(--text-subtle))]">
                            {played ? (
                              <>
                                Ganador: <span className="font-semibold text-[hsl(var(--foreground))]">{match.winner_team}</span>
                              </>
                            ) : (
                              "Pendiente"
                            )}
                          </p>
                        </div>
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
