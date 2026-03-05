import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  FireIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import StatPill from "../components/ui/StatPill";
import Badge from "../components/ui/Badge";
import { useRole } from "../contexts/RoleContext";
import { supabase } from "../lib/supabase";
import {
  getTournamentPlayerLinesFast,
  getTournamentResultsOverview,
  getTournamentResultsSummary,
  getTournamentSettings,
} from "../services/tournamentAnalytics";
import type {
  PlayerStatsLine,
  TournamentResultMatchOverview,
  TournamentResultSummary,
} from "../types/tournament-analytics";
import { TOURNAMENT_RULES_PDF_URL } from "../constants/tournamentRules";
import { abbreviateLeaderboardName, getPlayerInitials } from "../utils/player-display";
import {
  IDEAL_FIVE_ROLE_BADGE_VARIANT,
  buildIdealFiveProjection,
  type IdealFiveProjection,
} from "../utils/ideal-five";

type TeamStandingSummary = {
  teamId: number;
  name: string;
  pj: number;
  pg: number;
  pp: number;
  winPct: number;
};

type TournamentHomeLeader = {
  playerId: number;
  name: string;
  photo: string | null;
  teamName: string | null;
  totalPoints: number;
  ppp: number;
  gamesPlayed: number;
};

type UpcomingTournamentMatch = {
  matchId: number;
  matchDate: string | null;
  matchTime: string | null;
  teamA: string;
  teamB: string;
};

type TournamentHomeInsight = {
  tournamentId: string;
  tournamentName: string;
  generatedAt: string;
  generatedAtTime: string;
  headline: string;
  rulesPdfUrl: string;
  leader: TournamentHomeLeader | null;
  bestTeam: TeamStandingSummary | null;
  latestResult: TournamentResultMatchOverview | null;
  latestResults: TournamentResultMatchOverview[];
  upcomingMatches: UpcomingTournamentMatch[];
  nextMatch: UpcomingTournamentMatch | null;
  topScorers: TournamentHomeLeader[];
  topTeams: TeamStandingSummary[];
  resultsSummary: TournamentResultSummary;
  playedResultsCount: number;
  pendingMatchesCount: number;
  todayPendingMatchesCount: number;
  next7DaysPendingMatchesCount: number;
  statsCoveragePct: number;
  idealFive: IdealFiveProjection | null;
};

type TournamentHomeFeedState = {
  insight: TournamentHomeInsight | null;
  loading: boolean;
  errorMessage: string | null;
  refresh: () => void;
};

const formatPct = (value: number) => `${(value * 100).toFixed(1)}%`;

const toIsoDateParts = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const parseIsoDateLocal = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parts = toIsoDateParts(value);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
};

const formatHomeDate = (
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short" }
) => {
  const parsed = parseIsoDateLocal(value);
  if (!parsed) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-ES", options).format(parsed);
};

const formatHomeTime = (value: string | null | undefined) => {
  if (!value) return "Hora por definir";
  return value.slice(0, 5);
};

const formatHomeDateTime = (dateValue: string | null | undefined, timeValue: string | null | undefined) => {
  const dateLabel = formatHomeDate(dateValue, { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = formatHomeTime(timeValue);
  if (timeLabel === "Hora por definir") return dateLabel;
  return `${dateLabel} · ${timeLabel}`;
};

const getTodayIsoLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getScheduleSortKey = (
  date: string | null | undefined,
  time: string | null | undefined,
  direction: "asc" | "desc"
) => {
  const datePart = date ?? (direction === "asc" ? "9999-12-31" : "0000-01-01");
  const timePart = time ?? (direction === "asc" ? "99:99" : "00:00");
  return `${datePart}T${timePart}`;
};

const sortMatchesByScheduleDesc = (rows: TournamentResultMatchOverview[]) =>
  [...rows].sort((a, b) =>
    getScheduleSortKey(b.matchDate, b.matchTime, "desc").localeCompare(
      getScheduleSortKey(a.matchDate, a.matchTime, "desc")
    )
  );

const sortMatchesByScheduleAsc = <T extends { matchDate: string | null; matchTime: string | null }>(rows: T[]) =>
  [...rows].sort((a, b) =>
    getScheduleSortKey(a.matchDate, a.matchTime, "asc").localeCompare(
      getScheduleSortKey(b.matchDate, b.matchTime, "asc")
    )
  );

const toUpcomingMatch = (row: Record<string, unknown>): UpcomingTournamentMatch => ({
  matchId: Number(row.id ?? 0),
  matchDate: row.match_date ? String(row.match_date) : null,
  matchTime: row.match_time ? String(row.match_time) : null,
  teamA: String(row.team_a ?? ""),
  teamB: String(row.team_b ?? ""),
});

const loadUpcomingMatches = async (tournamentId: string): Promise<UpcomingTournamentMatch[]> => {
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_date, match_time, team_a, team_b")
    .eq("tournament_id", tournamentId)
    .is("winner_team", null)
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .limit(8);

  if (error) throw new Error(error.message);

  return sortMatchesByScheduleAsc((data ?? []).map((row) => toUpcomingMatch(row as Record<string, unknown>)));
};

const loadStandingsFromView = async (tournamentId: string): Promise<TeamStandingSummary[]> => {
  const { data, error } = await supabase
    .from("tournament_regular_standings")
    .select("team_id, team_name, games_played, wins, losses, win_pct")
    .eq("tournament_id", tournamentId)
    .limit(12);

  if (error || !data) {
    return [];
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

const loadTopScorersQuick = async (tournamentId: string): Promise<TournamentHomeLeader[]> => {
  const cacheResult = await supabase
    .from("tournament_player_totals_cache")
    .select("player_id, names, lastnames, team_name, games_played, points, ppg")
    .eq("tournament_id", tournamentId)
    .eq("phase", "regular")
    .order("points", { ascending: false })
    .limit(10);

  const shouldUseViewFallback = Boolean(cacheResult.error) || (cacheResult.data ?? []).length === 0;
  const viewResult = shouldUseViewFallback
    ? await supabase
        .from("tournament_analytics_player_totals")
        .select("player_id, names, lastnames, photo, team_name, games_played, points, ppg")
        .eq("tournament_id", tournamentId)
        .eq("phase", "regular")
        .order("points", { ascending: false })
        .limit(10)
    : null;

  const sourceRows = ((shouldUseViewFallback ? viewResult?.data : cacheResult.data) ?? []) as Array<Record<string, unknown>>;
  if (sourceRows.length === 0) {
    return [];
  }

  const playerIds = Array.from(
    new Set(sourceRows.map((row) => Number(row.player_id ?? 0)).filter((playerId) => Number.isFinite(playerId) && playerId > 0))
  );
  const photosByPlayerId = new Map<number, string>();

  if (playerIds.length > 0) {
    const { data: playerRows } = await supabase
      .from("players")
      .select("id, photo")
      .in("id", playerIds);

    (playerRows ?? []).forEach((row) => {
      const playerId = Number(row.id ?? 0);
      const photo = typeof row.photo === "string" ? row.photo.trim() : "";
      if (playerId > 0 && photo.length > 0) {
        photosByPlayerId.set(playerId, photo);
      }
    });
  }

  return sourceRows.map((row) => {
    const names = row.names ? String(row.names) : "";
    const lastnames = row.lastnames ? String(row.lastnames) : "";
    const name = `${names} ${lastnames}`.trim() || `Jugador ${Number(row.player_id ?? 0)}`;
    const playerId = Number(row.player_id ?? 0);
    const inlinePhoto = typeof row.photo === "string" ? row.photo.trim() : "";

    return {
      playerId,
      name,
      photo: photosByPlayerId.get(playerId) ?? (inlinePhoto || null),
      teamName: row.team_name ? String(row.team_name) : null,
      totalPoints: Number(row.points ?? 0),
      ppp: Number(row.ppg ?? 0),
      gamesPlayed: Number(row.games_played ?? 0),
    };
  });
};

const isCompletedResult = (match: TournamentResultMatchOverview) => Boolean(match.winnerTeam);

const hasScoredResult = (match: TournamentResultMatchOverview) =>
  Number.isFinite(match.teamAPoints) &&
  Number.isFinite(match.teamBPoints) &&
  (match.teamAPoints > 0 || match.teamBPoints > 0);

const formatMatchScoreLine = (match: TournamentResultMatchOverview) => {
  if (hasScoredResult(match)) return `${match.teamAPoints} - ${match.teamBPoints}`;
  if (match.winnerTeam) return `Ganó ${match.winnerTeam}`;
  return "Pendiente";
};

const formatUpcomingMatchLabel = (match: UpcomingTournamentMatch) =>
  `${formatHomeDateTime(match.matchDate, match.matchTime)}`;

const withinNextDays = (dateValue: string | null, days: number) => {
  const parsed = parseIsoDateLocal(dateValue);
  if (!parsed) return false;

  const today = parseIsoDateLocal(getTodayIsoLocal());
  if (!today) return false;

  const diffMs = parsed.getTime() - today.getTime();
  const diffDays = diffMs / 86400000;
  return diffDays >= 0 && diffDays <= days;
};

const sortStandings = (rows: TeamStandingSummary[]) => {
  return [...rows].sort((a, b) => {
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (a.pp !== b.pp) return a.pp - b.pp;
    return a.name.localeCompare(b.name);
  });
};

const buildTournamentInsight = ({
  tournamentId,
  tournamentName,
  topScorers,
  playerLines,
  playoffLines,
  matches,
  upcomingMatches,
  standings,
  summary,
  rulesPdfUrl,
}: {
  tournamentId: string;
  tournamentName: string;
  topScorers: TournamentHomeLeader[];
  playerLines: PlayerStatsLine[];
  playoffLines: PlayerStatsLine[];
  matches: TournamentResultMatchOverview[];
  upcomingMatches: UpcomingTournamentMatch[];
  standings: TeamStandingSummary[];
  summary: TournamentResultSummary;
  rulesPdfUrl: string | null;
}): TournamentHomeInsight => {
  const now = new Date();
  const sortedResultsDesc = sortMatchesByScheduleDesc(matches);
  const completedResults = sortedResultsDesc.filter(isCompletedResult);
  const latestResults = completedResults.slice(0, 5);
  const latestResult = latestResults[0] ?? null;
  const pendingMatchesCount = upcomingMatches.length;
  const todayIso = getTodayIsoLocal();
  const todayPendingMatchesCount = upcomingMatches.filter((match) => match.matchDate === todayIso).length;
  const next7DaysPendingMatchesCount = upcomingMatches.filter((match) => withinNextDays(match.matchDate, 7)).length;

  const sortedStandings = sortStandings(standings);
  const bestTeam = sortedStandings[0] ?? null;

  const leader = topScorers[0] ?? null;
  const idealFive = buildIdealFiveProjection(playerLines, playoffLines);
  const playedResultsCount = completedResults.length;
  const statsCoveragePct = playedResultsCount > 0 ? (summary.matchesWithStats / playedResultsCount) * 100 : 0;

  const headline = leader
    ? `${leader.name} lidera con ${leader.totalPoints} pts (${leader.ppp.toFixed(1)} PPP).`
    : `Resumen rápido: ${pendingMatchesCount} partidos pendientes y tabla en movimiento.`;

  return {
    tournamentId,
    tournamentName,
    generatedAt: new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(now),
    generatedAtTime: new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now),
    headline,
    rulesPdfUrl: rulesPdfUrl ?? TOURNAMENT_RULES_PDF_URL,
    leader,
    bestTeam,
    latestResult,
    latestResults,
    upcomingMatches: upcomingMatches.slice(0, 5),
    nextMatch: upcomingMatches[0] ?? null,
    topScorers: topScorers.slice(0, 8),
    topTeams: sortedStandings.slice(0, 6),
    resultsSummary: summary,
    playedResultsCount,
    pendingMatchesCount,
    todayPendingMatchesCount,
    next7DaysPendingMatchesCount,
    statsCoveragePct,
    idealFive,
  };
};

const Home: React.FC = () => {
  const { role } = useRole();

  if (role === "visor") {
    return <TournamentModeHome />;
  }

  return <AdminModeHome />;
};

const useTournamentHomeFeed = (): TournamentHomeFeedState => {
  const [insight, setInsight] = useState<TournamentHomeInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data: tournaments, error } = await supabase
          .from("tournaments")
          .select("id, name")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw new Error(error.message);

        const currentTournament = tournaments?.[0];
        if (!currentTournament) {
          if (!cancelled) setInsight(null);
          return;
        }

        const tournamentId = String(currentTournament.id);
        const tournamentName = String(currentTournament.name ?? "Torneo activo");

        const [
          scorersResult,
          playerLinesResult,
          playoffLinesResult,
          matchesResult,
          upcomingResult,
          standingsResult,
          settingsResult,
        ] = await Promise.allSettled([
          loadTopScorersQuick(tournamentId),
          getTournamentPlayerLinesFast(tournamentId, "regular"),
          getTournamentPlayerLinesFast(tournamentId, "playoffs"),
          getTournamentResultsOverview(tournamentId),
          loadUpcomingMatches(tournamentId),
          loadStandingsFromView(tournamentId),
          getTournamentSettings(tournamentId),
        ]);

        const topScorers = scorersResult.status === "fulfilled" ? scorersResult.value : [];
        const playerLines = playerLinesResult.status === "fulfilled" ? playerLinesResult.value : [];
        const playoffLines = playoffLinesResult.status === "fulfilled" ? playoffLinesResult.value : [];
        const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
        const upcomingMatches = upcomingResult.status === "fulfilled" ? upcomingResult.value : [];
        const standings = standingsResult.status === "fulfilled" ? standingsResult.value : [];
        const rulesPdfUrl =
          settingsResult.status === "fulfilled" ? settingsResult.value.rulesPdfUrl : null;

        const summary = getTournamentResultsSummary(matches.filter(isCompletedResult));
        const nextInsight = buildTournamentInsight({
          tournamentId,
          tournamentName,
          topScorers,
          playerLines,
          playoffLines,
          matches,
          upcomingMatches,
          standings,
          summary,
          rulesPdfUrl,
        });

        if (!cancelled) setInsight(nextInsight);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el home del torneo.");
          setInsight(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return {
    insight,
    loading,
    errorMessage,
    refresh: () => setRefreshTick((value) => value + 1),
  };
};

const TournamentHomeLoading = () => (
  <>
    <section className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))] p-4 sm:p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.09)] via-transparent to-[hsl(var(--warning)/0.08)]" />
      <div className="relative space-y-4 animate-pulse">
        <div className="h-6 w-40 rounded-full bg-[hsl(var(--surface-3))]" />
        <div className="h-8 w-3/4 bg-[hsl(var(--surface-3))]" />
        <div className="h-4 w-full bg-[hsl(var(--surface-3))]" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[56px] rounded-[10px] border bg-[hsl(var(--surface-1))]" />
          ))}
        </div>
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <section key={index} className="app-card animate-pulse p-4">
          <div className="h-4 w-24 bg-[hsl(var(--surface-3))]" />
          <div className="mt-3 h-3 w-full bg-[hsl(var(--surface-3))]" />
          <div className="mt-2 h-3 w-4/5 bg-[hsl(var(--surface-3))]" />
        </section>
      ))}
    </section>
  </>
);

const TournamentHomeError = ({ errorMessage, onRetry }: { errorMessage: string; onRetry: () => void }) => (
  <SectionCard title="Home no disponible" description="No se pudo cargar el resumen del torneo en este momento.">
    <div className="space-y-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{errorMessage}</p>
      <button className="btn-secondary w-full sm:w-auto" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  </SectionCard>
);

const TournamentHomeEmpty = () => (
  <SectionCard title="Sin torneos disponibles" description="Crea o habilita un torneo para mostrar el panel principal.">
    <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
      Ver torneos
    </Link>
  </SectionCard>
);

const TournamentHomeLiveFeed = ({ mode }: { mode: "viewer" | "admin" }) => {
  const { insight, loading, errorMessage, refresh } = useTournamentHomeFeed();

  const heroStats = useMemo(() => {
    if (!insight) {
      return [
        { label: "Finalizados", value: "--" },
        { label: "Pendientes", value: "--" },
        { label: "Cobertura", value: "--" },
      ];
    }

    return [
      { label: "Finalizados", value: String(insight.playedResultsCount) },
      { label: "Pendientes", value: String(insight.pendingMatchesCount) },
      { label: "Cobertura", value: `${insight.statsCoveragePct.toFixed(0)}%` },
    ];
  }, [insight]);

  if (loading) return <TournamentHomeLoading />;
  if (errorMessage) return <TournamentHomeError errorMessage={errorMessage} onRetry={refresh} />;
  if (!insight) return <TournamentHomeEmpty />;

  const viewerMode = mode === "viewer";
  const topScorers = insight.topScorers.slice(0, 5);
  const topTeams = insight.topTeams.slice(0, 4);
  const idealFive = insight.idealFive;

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,hsl(var(--primary)/0.14),transparent_44%),radial-gradient(circle_at_88%_15%,hsl(var(--warning)/0.11),transparent_35%)]" />
        <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{viewerMode ? "Torneo en vivo" : "Panel de control"}</Badge>
              <Badge variant={insight.todayPendingMatchesCount > 0 ? "warning" : "default"}>
                {insight.todayPendingMatchesCount > 0
                  ? `${insight.todayPendingMatchesCount} juego(s) hoy`
                  : "Sin juegos hoy"}
              </Badge>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                {insight.generatedAt} · {insight.generatedAtTime}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{insight.tournamentName}</h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{insight.headline}</p>
              {insight.leader ? (
                <p className="mt-1.5 text-xs text-[hsl(var(--text-subtle))]">
                  Líder actual: <span className="font-semibold">{insight.leader.name}</span>
                  {insight.leader.teamName ? ` (${insight.leader.teamName})` : ""}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {heroStats.map((item) => (
                <StatPill key={item.label} label={item.label} value={item.value} className="bg-[hsl(var(--surface-1)/0.94)]" />
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link to={`/tournaments/view/${insight.tournamentId}`} className="btn-primary w-full sm:w-auto">
                {viewerMode ? "Ver torneo" : "Administrar torneo"}
              </Link>
              <button type="button" onClick={refresh} className="btn-secondary w-full sm:w-auto">
                <ArrowPathIcon className="h-4 w-4" />
                Actualizar
              </button>
            </div>
          </div>

          <article className="rounded-[12px] border bg-[hsl(var(--surface-1)/0.96)] p-4">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
              <p className="text-sm font-semibold">Jugadores en foco</p>
            </div>
            <div className="mt-3 space-y-2.5">
              {topScorers.length > 0 ? (
                topScorers.slice(0, 4).map((player, index) => (
                  <div key={player.playerId} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 inline-flex items-center gap-2">
                      {player.photo ? (
                        <img
                          src={player.photo}
                          alt={player.name}
                          className="h-8 w-8 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                        />
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px] font-semibold">
                          {getPlayerInitials(player.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" title={player.name}>
                          #{index + 1} {abbreviateLeaderboardName(player.name, 18)}
                        </p>
                        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                          {player.teamName ?? "Sin equipo"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{player.totalPoints}</p>
                      <p className="text-[11px] text-[hsl(var(--text-subtle))]">{player.ppp.toFixed(1)} PPP</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Aún no hay líderes de puntos para mostrar.</p>
              )}
            </div>
          </article>
        </div>
      </section>

      <SectionCard
        title="Quinteto ideal inteligente"
        description="Selección objetiva por rol (PG, SG, SF, PF, C) usando percentiles del torneo y confiabilidad por muestra."
      >
        {idealFive ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Química: {idealFive.chemistryScore.toFixed(1)}</Badge>
              <Badge variant="primary">Modelo: {idealFive.modelScore.toFixed(1)}</Badge>
              <Badge
                variant={
                  idealFive.confidence === "alta"
                    ? "success"
                    : idealFive.confidence === "media"
                      ? "warning"
                      : "danger"
                }
              >
                Confianza: {idealFive.confidence}
              </Badge>
              <Badge variant="primary">Muestra: {idealFive.sampleSize} jugadores</Badge>
              <Badge variant="default">Mín. juegos: {idealFive.minGames}</Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {idealFive.lineup.map((slot) => (
                <article key={`${slot.role}-${slot.playerId}`} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={IDEAL_FIVE_ROLE_BADGE_VARIANT[slot.role]}>{slot.role}</Badge>
                    <div className="text-right text-[10px] text-[hsl(var(--text-subtle))]">
                      <p>Fit {slot.roleScore.toFixed(1)}</p>
                      <p>Obj {slot.overallScore.toFixed(1)}</p>
                    </div>
                  </div>

                  <div className="mt-2 inline-flex items-center gap-2">
                    {slot.photo ? (
                      <img
                        src={slot.photo}
                        alt={slot.name}
                        className="h-9 w-9 rounded-full border border-[hsl(var(--border)/0.82)] object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px] font-semibold">
                        {getPlayerInitials(slot.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" title={slot.name}>
                        {abbreviateLeaderboardName(slot.name, 16)}
                      </p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {slot.teamName ?? "Sin equipo"} · {slot.gamesPlayed} PJ
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{slot.keyStatLabel}</p>
                  <p className="text-xs font-semibold text-[hsl(var(--text-strong))] tabular-nums">{slot.keyStatValue}</p>
                  <p className="mt-1 text-[10px] text-[hsl(var(--text-subtle))]">{slot.archetype}</p>
                </article>
              ))}
            </div>

            <p className="text-xs text-[hsl(var(--text-subtle))]">
              {idealFive.note} ({idealFive.modelVersion})
            </p>
          </div>
        ) : (
          <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
            No hay datos suficientes para construir un quinteto ideal confiable todavía.
          </p>
        )}
      </SectionCard>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Agenda inmediata" description="Próximos juegos y estado del calendario.">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={insight.todayPendingMatchesCount > 0 ? "warning" : "default"}>
                Hoy: {insight.todayPendingMatchesCount}
              </Badge>
              <Badge variant="primary">7 días: {insight.next7DaysPendingMatchesCount}</Badge>
            </div>

            {insight.upcomingMatches.length > 0 ? (
              insight.upcomingMatches.slice(0, 4).map((match) => (
                <article key={match.matchId} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <p className="text-sm font-semibold">
                    {match.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {match.teamB}
                  </p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatUpcomingMatchLabel(match)}</p>
                </article>
              ))
            ) : (
              <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                No hay partidos pendientes programados.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Resultados recientes" description="Últimos cierres con marcador y cobertura.">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">Finalizados: {insight.playedResultsCount}</Badge>
              <Badge variant={insight.statsCoveragePct >= 70 ? "success" : insight.statsCoveragePct >= 35 ? "warning" : "danger"}>
                Cobertura: {insight.statsCoveragePct.toFixed(0)}%
              </Badge>
            </div>

            {insight.latestResults.length > 0 ? (
              insight.latestResults.slice(0, 4).map((match) => (
                <article key={match.matchId} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {match.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {match.teamB}
                    </p>
                    <Badge variant={match.hasStats ? "success" : "default"}>
                      {match.hasStats ? "Con stats" : "Sin stats"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold tabular-nums">{formatMatchScoreLine(match)}</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {formatHomeDateTime(match.matchDate, match.matchTime)}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                Aún no hay resultados finalizados.
              </p>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Top anotadores" description="Más simple: puntos totales, PPP y foto del jugador.">
          <div className="space-y-2">
            {topScorers.length > 0 ? (
              topScorers.map((player, index) => (
                <article key={player.playerId} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 inline-flex items-center gap-2">
                      {player.photo ? (
                        <img
                          src={player.photo}
                          alt={player.name}
                          className="h-9 w-9 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                        />
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px] font-semibold">
                          {getPlayerInitials(player.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" title={player.name}>
                          #{index + 1} {abbreviateLeaderboardName(player.name, 18)}
                        </p>
                        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                          {player.teamName ?? "Sin equipo"} · {player.gamesPlayed} PJ
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{player.totalPoints}</p>
                      <p className="text-xs text-[hsl(var(--text-subtle))]">{player.ppp.toFixed(1)} PPP</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                Sin líderes disponibles todavía.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Top equipos" description="Récord y win% para lectura rápida de la tabla.">
          <div className="space-y-2">
            {topTeams.length > 0 ? (
              topTeams.map((team, index) => (
                <article key={team.teamId} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">#{index + 1} {team.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {team.pg}-{team.pp} · {team.pj} PJ
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums">{formatPct(team.winPct)}</p>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                No hay tabla suficiente para mostrar ranking.
              </p>
            )}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Accesos rápidos" description="Ir directo a las pantallas clave.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to={`/tournaments/view/${insight.tournamentId}`}
            className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
              <TrophyIcon className="h-5 w-5" />
              <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">Torneo</p>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Calendario, resultados y analíticas.</p>
          </Link>

          <Link
            to="/matches"
            className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
              <FireIcon className="h-5 w-5" />
              <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">Resultados</p>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Marcadores y partidos jugados.</p>
          </Link>

          <a
            href={insight.rulesPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
              <DocumentTextIcon className="h-5 w-5" />
              <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">Reglamento</p>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Documento oficial del torneo.</p>
          </a>

          {!viewerMode ? (
            <Link
              to="/tournaments"
              className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 transition-colors hover:bg-[hsl(var(--surface-2))]"
            >
              <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                <CalendarDaysIcon className="h-5 w-5" />
                <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">Torneos</p>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Gestión y configuración.</p>
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
};

const TournamentModeHome = () => {
  return (
    <PageShell>
      <TournamentHomeLiveFeed mode="viewer" />
    </PageShell>
  );
};

const AdminModeHome = () => {
  return (
    <PageShell>
      <TournamentHomeLiveFeed mode="admin" />
    </PageShell>
  );
};

export default Home;
