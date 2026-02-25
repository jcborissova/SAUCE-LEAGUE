import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowPathIcon,
  BoltIcon,
  CalendarDaysIcon,
  ClockIcon,
  FireIcon,
  InformationCircleIcon,
  SparklesIcon,
  TrophyIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon, MegaphoneIcon } from "@heroicons/react/24/outline";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import StatPill from "../components/ui/StatPill";
import Badge from "../components/ui/Badge";
import { useRole } from "../contexts/RoleContext";
import { supabase } from "../lib/supabase";
import {
  getLeaders,
  getTournamentSettings,
  getTournamentAnalyticsSnapshot,
  getTournamentResultsOverview,
  getTournamentResultsSummary,
} from "../services/tournamentAnalytics";
import type {
  PlayerStatsLine,
  TournamentAnalyticsSnapshot,
  TournamentLeaderRow,
  TournamentResultMatchOverview,
  TournamentResultSummary,
} from "../types/tournament-analytics";
import { TOURNAMENT_RULES_PDF_URL } from "../constants/tournamentRules";

type TeamStandingSummary = {
  teamId: number;
  name: string;
  pj: number;
  pg: number;
  pp: number;
  winPct: number;
};

type TournamentHomeLeader = {
  name: string;
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

type HomeDailyNote = {
  id: string;
  badge: string;
  variant: "default" | "primary" | "success" | "warning" | "danger";
  title: string;
  body: string;
};

type HomeQuickHighlight = {
  id: string;
  label: string;
  value: string;
  helper: string;
  accent: "primary" | "success" | "warning" | "danger" | "default";
};

type TournamentHomeInsight = {
  tournamentId: string;
  tournamentName: string;
  generatedAt: string;
  generatedAtTime: string;
  headline: string;
  leaderLine: string;
  teamsLine: string;
  playfulLine: string;
  challengeLine: string;
  leader: TournamentHomeLeader | null;
  bestTeam: TeamStandingSummary | null;
  worstTeam: TeamStandingSummary | null;
  rulesPdfUrl: string;
  resultsSummary: TournamentResultSummary;
  playedResultsCount: number;
  pendingMatchesCount: number;
  todayPendingMatchesCount: number;
  next7DaysPendingMatchesCount: number;
  statsCoveragePct: number;
  latestResults: TournamentResultMatchOverview[];
  latestResult: TournamentResultMatchOverview | null;
  upcomingMatches: UpcomingTournamentMatch[];
  nextMatch: UpcomingTournamentMatch | null;
  topScorers: TournamentHomeLeader[];
  topTeams: TeamStandingSummary[];
  hotMatch: TournamentResultMatchOverview | null;
  closeMatch: TournamentResultMatchOverview | null;
  topRebounderLine: string | null;
  topAssisterLine: string | null;
  snapshotGamesAnalyzed: number;
  snapshotPlayersAnalyzed: number;
  dailyNotes: HomeDailyNote[];
  quickHighlights: HomeQuickHighlight[];
  stats: Array<{ label: string; value: string }>;
};

type TournamentHomeFeedState = {
  insight: TournamentHomeInsight | null;
  loading: boolean;
  errorMessage: string | null;
  refreshTick: number;
  refresh: () => void;
};

const getDaySeed = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return date.getFullYear() * 1000 + dayOfYear;
};

const getStringSeed = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const pickBySeed = <T,>(items: T[], seed: number, offset = 0): T => {
  return items[(seed + offset) % items.length];
};

const pickManyBySeed = <T,>(items: T[], seed: number, count: number) => {
  if (items.length === 0) return [];
  const safeCount = Math.min(count, items.length);
  const start = Math.abs(seed) % items.length;

  return Array.from({ length: safeCount }, (_, index) => items[(start + index) % items.length]);
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

const getScheduleSortKey = (date: string | null | undefined, time: string | null | undefined, direction: "asc" | "desc") => {
  const datePart = date ?? (direction === "asc" ? "9999-12-31" : "0000-01-01");
  const timePart = time ?? (direction === "asc" ? "99:99" : "00:00");
  return `${datePart}T${timePart}`;
};

const sortMatchesByScheduleDesc = (rows: TournamentResultMatchOverview[]) =>
  [...rows].sort((a, b) =>
    getScheduleSortKey(b.matchDate, b.matchTime, "desc").localeCompare(getScheduleSortKey(a.matchDate, a.matchTime, "desc"))
  );

const sortMatchesByScheduleAsc = <T extends { matchDate: string | null; matchTime: string | null }>(rows: T[]) =>
  [...rows].sort((a, b) =>
    getScheduleSortKey(a.matchDate, a.matchTime, "asc").localeCompare(getScheduleSortKey(b.matchDate, b.matchTime, "asc"))
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
    .limit(10);

  if (error) throw new Error(error.message);

  return sortMatchesByScheduleAsc((data ?? []).map((row) => toUpcomingMatch(row as Record<string, unknown>)));
};

const isCompletedResult = (match: TournamentResultMatchOverview) => Boolean(match.winnerTeam);

const getMatchTotalPoints = (match: TournamentResultMatchOverview) =>
  Number(match.teamAPoints ?? 0) + Number(match.teamBPoints ?? 0);

const getMatchMargin = (match: TournamentResultMatchOverview) =>
  Math.abs(Number(match.teamAPoints ?? 0) - Number(match.teamBPoints ?? 0));

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

const toTournamentHomeLeaderFromLine = (row: PlayerStatsLine): TournamentHomeLeader => ({
  name: row.name,
  teamName: row.teamName,
  totalPoints: row.totals.points,
  ppp: row.perGame.ppg,
  gamesPlayed: row.gamesPlayed,
});

const sortStandings = (rows: TeamStandingSummary[]) => {
  return [...rows].sort((a, b) => {
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (a.pp !== b.pp) return a.pp - b.pp;
    return a.name.localeCompare(b.name);
  });
};

const loadStandingsFromView = async (tournamentId: string): Promise<TeamStandingSummary[] | null> => {
  const { data, error } = await supabase
    .from("tournament_regular_standings")
    .select("team_id, team_name, games_played, wins, losses, win_pct")
    .eq("tournament_id", tournamentId);

  if (error) return null;

  return (data || []).map((row) => ({
    teamId: Number(row.team_id),
    name: String(row.team_name),
    pj: Number(row.games_played ?? 0),
    pg: Number(row.wins ?? 0),
    pp: Number(row.losses ?? 0),
    winPct: Number(row.win_pct ?? 0),
  }));
};

const loadStandingsFallback = async (tournamentId: string): Promise<TeamStandingSummary[]> => {
  const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
    supabase
      .from("matches")
      .select("team_a, team_b, winner_team")
      .eq("tournament_id", tournamentId)
      .not("winner_team", "is", null),
  ]);

  if (teamsError) throw new Error(teamsError.message);
  if (matchesError) throw new Error(matchesError.message);

  const grouped = new Map<string, TeamStandingSummary>();

  (teams || []).forEach((team) => {
    grouped.set(team.name, {
      teamId: Number(team.id),
      name: String(team.name),
      pj: 0,
      pg: 0,
      pp: 0,
      winPct: 0,
    });
  });

  (matches || []).forEach((match) => {
    const teamA = grouped.get(String(match.team_a));
    const teamB = grouped.get(String(match.team_b));
    if (!teamA || !teamB) return;

    teamA.pj += 1;
    teamB.pj += 1;

    if (match.winner_team === match.team_a) {
      teamA.pg += 1;
      teamB.pp += 1;
    } else if (match.winner_team === match.team_b) {
      teamB.pg += 1;
      teamA.pp += 1;
    }
  });

  return Array.from(grouped.values()).map((team) => ({
    ...team,
    winPct: team.pj > 0 ? team.pg / team.pj : 0,
  }));
};

const loadTeamStandings = async (tournamentId: string): Promise<TeamStandingSummary[]> => {
  const fromView = await loadStandingsFromView(tournamentId);
  if (fromView) return fromView;
  return loadStandingsFallback(tournamentId);
};

const toLeaderInsight = (row: TournamentLeaderRow | undefined): TournamentHomeLeader | null => {
  if (!row) return null;

  return {
    name: row.name,
    teamName: row.teamName,
    totalPoints: row.totals.points,
    ppp: row.perGame.ppg,
    gamesPlayed: row.gamesPlayed,
  };
};

const toGeneratedDate = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return formatter.format(date);
};

const toGeneratedTime = (date: Date) =>
  new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const buildTournamentInsight = ({
  tournamentId,
  tournamentName,
  leaderRows,
  snapshot,
  matches,
  upcomingMatches,
  standings,
  summary,
  rulesPdfUrl,
}: {
  tournamentId: string;
  tournamentName: string;
  leaderRows: TournamentLeaderRow[];
  snapshot: TournamentAnalyticsSnapshot | null;
  matches: TournamentResultMatchOverview[];
  upcomingMatches: UpcomingTournamentMatch[];
  standings: TeamStandingSummary[];
  summary: TournamentResultSummary;
  rulesPdfUrl: string | null;
}): TournamentHomeInsight => {
  const now = new Date();
  const seed = getDaySeed(now) + getStringSeed(tournamentId);
  const sortedResultsDesc = sortMatchesByScheduleDesc(matches);
  const completedResults = sortedResultsDesc.filter(isCompletedResult);
  const latestResults = completedResults.slice(0, 5);
  const latestResult = latestResults[0] ?? null;
  const pendingMatchesCount = upcomingMatches.length;
  const todayIso = getTodayIsoLocal();
  const todayPendingMatchesCount = upcomingMatches.filter((match) => match.matchDate === todayIso).length;
  const next7DaysPendingMatchesCount = upcomingMatches.filter((match) => withinNextDays(match.matchDate, 7)).length;

  const leadersFromSnapshot = snapshot?.playerLines
    ? [...snapshot.playerLines]
        .sort((a, b) => {
          if (b.totals.points !== a.totals.points) return b.totals.points - a.totals.points;
          return a.name.localeCompare(b.name, "es");
        })
        .slice(0, 5)
        .map(toTournamentHomeLeaderFromLine)
    : [];

  const topScorers =
    leaderRows.length > 0
      ? leaderRows.slice(0, 5).map((row) => toLeaderInsight(row)).filter((row): row is TournamentHomeLeader => Boolean(row))
      : leadersFromSnapshot;

  const leader = topScorers[0] ?? null;
  const sortedStandings = sortStandings(standings);
  const bestTeam = sortedStandings[0] ?? null;
  const worstTeam = sortedStandings.length > 1 ? sortedStandings[sortedStandings.length - 1] : null;
  const topTeams = sortedStandings.slice(0, 5);

  const scoredCompleted = completedResults.filter(hasScoredResult);
  const hotMatch =
    [...scoredCompleted].sort((a, b) => {
      const totalDiff = getMatchTotalPoints(b) - getMatchTotalPoints(a);
      if (totalDiff !== 0) return totalDiff;
      return getScheduleSortKey(b.matchDate, b.matchTime, "desc").localeCompare(getScheduleSortKey(a.matchDate, a.matchTime, "desc"));
    })[0] ?? null;

  const closeMatch =
    [...scoredCompleted].sort((a, b) => {
      const marginDiff = getMatchMargin(a) - getMatchMargin(b);
      if (marginDiff !== 0) return marginDiff;
      return getScheduleSortKey(b.matchDate, b.matchTime, "desc").localeCompare(getScheduleSortKey(a.matchDate, a.matchTime, "desc"));
    })[0] ?? null;

  const topRebounder = snapshot?.playerLines
    ? [...snapshot.playerLines]
        .filter((row) => row.gamesPlayed > 0)
        .sort((a, b) => {
          if (b.totals.rebounds !== a.totals.rebounds) return b.totals.rebounds - a.totals.rebounds;
          return a.name.localeCompare(b.name, "es");
        })[0] ?? null
    : null;

  const topAssister = snapshot?.playerLines
    ? [...snapshot.playerLines]
        .filter((row) => row.gamesPlayed > 0)
        .sort((a, b) => {
          if (b.totals.assists !== a.totals.assists) return b.totals.assists - a.totals.assists;
          return a.name.localeCompare(b.name, "es");
        })[0] ?? null
    : null;

  const topRebounderLine = topRebounder
    ? `${topRebounder.name}${topRebounder.teamName ? ` (${topRebounder.teamName})` : ""} manda en rebotes con ${topRebounder.totals.rebounds} (${topRebounder.perGame.rpg.toFixed(1)} RPP).`
    : null;

  const topAssisterLine = topAssister
    ? `${topAssister.name}${topAssister.teamName ? ` (${topAssister.teamName})` : ""} reparte juego con ${topAssister.totals.assists} asistencias (${topAssister.perGame.apg.toFixed(1)} APP).`
    : null;

  const leaderName = leader?.name ?? "Sin líder confirmado";
  const bestName = bestTeam?.name ?? "tabla sin datos";
  const worstName = worstTeam?.name ?? "sin fondo definido";
  const nextMatch = upcomingMatches[0] ?? null;
  const playedResultsCount = completedResults.length;
  const statsCoveragePct = playedResultsCount > 0 ? (summary.matchesWithStats / playedResultsCount) * 100 : 0;

  const headlineOptions = [
    `Radar de jornada: ${leaderName} marca el ritmo y ${bestName} defiende la cima.`,
    `Reporte del torneo: ${bestName} llega sólido y la pelea por escalar está viva.`,
    `Lectura rápida: ${pendingMatchesCount > 0 ? `${pendingMatchesCount} juegos pendientes` : "la jornada cerró"} y hay margen para sorpresas.`,
    `Panorama del torneo: liderazgo claro arriba y presión total en la parte baja.`,
  ];

  const playfulOptions = [
    leader
      ? `Jocoso del día: ${leader.name} anda en modo microondas con ${leader.ppp.toFixed(1)} PPP.`
      : "Jocoso del día: el líder está escondido, pero la próxima carga de stats lo delata.",
    `Termómetro de camerino: ${bestName} está fino, ${worstName} promete remontada con música de película.`,
    `Dato picante: promedio de ${summary.avgPoints.toFixed(1)} puntos por juego, hoy no se baja el ritmo.`,
    `Reporte de pasillo: si no cierran rebote, la tabla te pasa factura en 24 horas.`,
  ];

  const challengeOptions = [
    bestTeam && worstTeam
      ? `Distancia entre cima y fondo: ${(Math.max(0, bestTeam.winPct - worstTeam.winPct) * 100).toFixed(1)} pts de win%.`
      : "El reto del día: convertir cada posesión en puntos seguros para mover la tabla.",
    leader
      ? `${leader.name} suma ${leader.totalPoints} puntos totales; el reto es bajarlo del trono.`
      : "No hay líder de puntos definitivo todavía: gran oportunidad para romper la tabla.",
    `Se han jugado ${summary.playedMatches} partidos, con ${summary.matchesWithStats} cargados con estadísticas completas.`,
    "La lectura premium sigue simple: defensa, rebote y ejecución en cierre.",
  ];

  const leaderLine = leader
    ? `${leader.name}${leader.teamName ? ` (${leader.teamName})` : ""} lidera en puntos con ${leader.totalPoints} totales y ${leader.ppp.toFixed(1)} PPP en ${leader.gamesPlayed} juego(s).`
    : "Todavía no hay líder de puntos disponible. Sube resultados con estadísticas para activar este ranking.";

  const teamsLine =
    bestTeam && worstTeam
      ? `${bestTeam.name} es el mejor equipo hasta ahora (${bestTeam.pg}-${bestTeam.pp}, ${formatPct(bestTeam.winPct)}). ${worstTeam.name} va último (${worstTeam.pg}-${worstTeam.pp}, ${formatPct(worstTeam.winPct)}).`
      : bestTeam
      ? `${bestTeam.name} lidera la tabla con ${formatPct(bestTeam.winPct)} de victorias.`
      : "Aún no hay suficientes resultados para definir mejor y peor equipo.";

  const dailyNotesPool: HomeDailyNote[] = [
    nextMatch
      ? {
          id: "agenda-next",
          badge: "Agenda",
          variant: "primary",
          title: `Próxima cita: ${nextMatch.teamA} vs ${nextMatch.teamB}`,
          body: `${formatUpcomingMatchLabel(nextMatch)}. Ajusta la alarma del equipo y llega con rotación lista.`,
        }
      : {
          id: "agenda-empty",
          badge: "Agenda",
          variant: "default",
          title: "Sin partidos pendientes confirmados",
          body: "La agenda visible está vacía o falta programar la próxima jornada.",
        },
    latestResult
      ? {
          id: "latest-result",
          badge: "Cierre",
          variant: "success",
          title: `Último resultado: ${latestResult.teamA} vs ${latestResult.teamB}`,
          body: `${formatMatchScoreLine(latestResult)} · ${formatHomeDateTime(latestResult.matchDate, latestResult.matchTime)}.`,
        }
      : {
          id: "latest-result-empty",
          badge: "Resultados",
          variant: "default",
          title: "Aún no hay resultados cerrados",
          body: "Cuando se registren ganadores, aquí aparecerá el resumen de la última finalización.",
        },
    hotMatch
      ? {
          id: "hot-match",
          badge: "Fuego",
          variant: "warning",
          title: `Partido más explosivo: ${hotMatch.teamA} vs ${hotMatch.teamB}`,
          body: `${getMatchTotalPoints(hotMatch)} puntos combinados (${formatMatchScoreLine(hotMatch)}).`,
        }
      : {
          id: "hot-match-empty",
          badge: "Fuego",
          variant: "default",
          title: "Sin marcador explosivo detectado todavía",
          body: "Faltan estadísticas cargadas para comparar ritmo ofensivo entre partidos.",
        },
    closeMatch
      ? {
          id: "close-match",
          badge: "Clutch",
          variant: "danger",
          title: `Final apretado: ${closeMatch.teamA} vs ${closeMatch.teamB}`,
          body: `Margen de ${getMatchMargin(closeMatch)} punto(s). ${formatMatchScoreLine(closeMatch)}.`,
        }
      : {
          id: "close-match-empty",
          badge: "Clutch",
          variant: "default",
          title: "No hay finales cerrados para destacar",
          body: "Se activará cuando tengamos marcadores con diferencia corta.",
        },
    {
      id: "coverage",
      badge: "Stats",
      variant: summary.matchesWithStats > 0 ? "success" : "default",
      title: `Cobertura estadística: ${statsCoveragePct.toFixed(0)}%`,
      body: `${summary.matchesWithStats} de ${Math.max(playedResultsCount, summary.matchesWithStats)} partidos cerrados tienen stats completas.`,
    },
    topRebounderLine
      ? {
          id: "boards",
          badge: "Rebote",
          variant: "primary",
          title: "Control de pintura",
          body: topRebounderLine,
        }
      : {
          id: "boards-empty",
          badge: "Rebote",
          variant: "default",
          title: "Rebote líder en espera",
          body: "Cargando más juegos con estadísticas para detectar dominadores del tablero.",
        },
    topAssisterLine
      ? {
          id: "assists",
          badge: "Playmaking",
          variant: "primary",
          title: "Distribución en modo premium",
          body: topAssisterLine,
        }
      : {
          id: "assists-empty",
          badge: "Playmaking",
          variant: "default",
          title: "Asistencias líder en espera",
          body: "A medida que crezcan los boxscores, aquí saldrá quién maneja la ofensiva.",
        },
  ];

  const quickHighlights: HomeQuickHighlight[] = [
    {
      id: "played-real",
      label: "Finalizados",
      value: String(playedResultsCount),
      helper: `${pendingMatchesCount} pendientes por jugar`,
      accent: "primary",
    },
    {
      id: "today",
      label: "Hoy en agenda",
      value: String(todayPendingMatchesCount),
      helper: todayPendingMatchesCount > 0 ? "Partidos programados para hoy" : "Sin juegos confirmados hoy",
      accent: todayPendingMatchesCount > 0 ? "warning" : "default",
    },
    {
      id: "next-week",
      label: "Próximos 7 días",
      value: String(next7DaysPendingMatchesCount),
      helper: "Carga de jornada cercana",
      accent: next7DaysPendingMatchesCount > 0 ? "success" : "default",
    },
    {
      id: "coverage-pct",
      label: "Cobertura stats",
      value: `${statsCoveragePct.toFixed(0)}%`,
      helper: `${summary.matchesWithStats} con boxscore`,
      accent: statsCoveragePct >= 70 ? "success" : statsCoveragePct >= 35 ? "warning" : "danger",
    },
    {
      id: "snapshot-games",
      label: "Juegos analizados",
      value: String(snapshot?.gamesAnalyzed ?? 0),
      helper: `${snapshot?.playersAnalyzed ?? 0} jugadores procesados`,
      accent: "primary",
    },
    {
      id: "avg-points",
      label: "Promedio juego",
      value: summary.avgPoints.toFixed(1),
      helper: "Puntos combinados por partido",
      accent: "warning",
    },
  ];

  return {
    tournamentId,
    tournamentName,
    generatedAt: toGeneratedDate(now),
    generatedAtTime: toGeneratedTime(now),
    headline: pickBySeed(headlineOptions, seed),
    leaderLine,
    teamsLine,
    playfulLine: pickBySeed(playfulOptions, seed, 3),
    challengeLine: pickBySeed(challengeOptions, seed, 5),
    leader,
    bestTeam,
    worstTeam,
    rulesPdfUrl: rulesPdfUrl ?? TOURNAMENT_RULES_PDF_URL,
    resultsSummary: summary,
    playedResultsCount,
    pendingMatchesCount,
    todayPendingMatchesCount,
    next7DaysPendingMatchesCount,
    statsCoveragePct,
    latestResults,
    latestResult,
    upcomingMatches: upcomingMatches.slice(0, 6),
    nextMatch,
    topScorers: topScorers.slice(0, 5),
    topTeams,
    hotMatch,
    closeMatch,
    topRebounderLine,
    topAssisterLine,
    snapshotGamesAnalyzed: snapshot?.gamesAnalyzed ?? 0,
    snapshotPlayersAnalyzed: snapshot?.playersAnalyzed ?? 0,
    dailyNotes: pickManyBySeed(dailyNotesPool, seed + 11, 4),
    quickHighlights: pickManyBySeed(quickHighlights, seed + 5, 6),
    stats: [
      { label: "Finalizados", value: String(playedResultsCount) },
      { label: "Pendientes", value: String(pendingMatchesCount) },
      { label: "Puntos totales", value: String(summary.totalPoints) },
      { label: "PPP líder", value: leader ? leader.ppp.toFixed(1) : "--" },
      { label: "Mejor win%", value: bestTeam ? formatPct(bestTeam.winPct) : "--" },
    ],
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
          leaderResult,
          snapshotResult,
          matchesResult,
          upcomingResult,
          standingsResult,
          settingsResult,
        ] = await Promise.allSettled([
          getLeaders({ tournamentId, phase: "regular", metric: "points", limit: 5 }),
          getTournamentAnalyticsSnapshot(tournamentId, "regular"),
          getTournamentResultsOverview(tournamentId),
          loadUpcomingMatches(tournamentId),
          loadTeamStandings(tournamentId),
          getTournamentSettings(tournamentId),
        ]);

        const leaders = leaderResult.status === "fulfilled" ? leaderResult.value : [];
        const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
        const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
        const upcomingMatches = upcomingResult.status === "fulfilled" ? upcomingResult.value : [];
        const standings =
          standingsResult.status === "fulfilled"
            ? standingsResult.value
            : snapshot
            ? Object.entries(snapshot.teamFactors).map(([name, winPct], index) => ({
                teamId: index + 1,
                name,
                pj: 0,
                pg: 0,
                pp: 0,
                winPct: Number(winPct ?? 0),
              }))
            : [];

        const rulesPdfUrl =
          settingsResult.status === "fulfilled" ? settingsResult.value.rulesPdfUrl : null;

        const summary = getTournamentResultsSummary(matches.filter(isCompletedResult));
        const nextInsight = buildTournamentInsight({
          tournamentId,
          tournamentName,
          leaderRows: leaders,
          snapshot,
          matches,
          upcomingMatches,
          standings,
          summary,
          rulesPdfUrl,
        });

        if (!cancelled) setInsight(nextInsight);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el panel informativo del torneo.");
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
    refreshTick,
    refresh: () => setRefreshTick((value) => value + 1),
  };
};

const TournamentHomeLoading = () => (
  <>
    <section className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))] p-4 sm:p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.08)] via-transparent to-[hsl(var(--warning)/0.08)]" />
      <div className="relative space-y-4 animate-pulse">
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-[hsl(var(--surface-3))]" />
          <div className="h-6 w-28 rounded-full bg-[hsl(var(--surface-3))]" />
        </div>
        <div className="h-8 w-3/4 bg-[hsl(var(--surface-3))]" />
        <div className="h-4 w-full bg-[hsl(var(--surface-3))]" />
        <div className="h-4 w-5/6 bg-[hsl(var(--surface-3))]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[62px] rounded-[10px] border bg-[hsl(var(--surface-1))]" />
          ))}
        </div>
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <section key={index} className="app-card animate-pulse p-4">
          <div className="h-4 w-24 bg-[hsl(var(--surface-3))]" />
          <div className="mt-3 h-3 w-full bg-[hsl(var(--surface-3))]" />
          <div className="mt-2 h-3 w-4/5 bg-[hsl(var(--surface-3))]" />
          <div className="mt-4 h-16 bg-[hsl(var(--surface-3))]" />
        </section>
      ))}
    </section>
  </>
);

const TournamentHomeError = ({ errorMessage, onRetry }: { errorMessage: string; onRetry: () => void }) => (
  <SectionCard title="Panel informativo no disponible" description="No se pudo cargar el resumen del torneo en este momento.">
    <div className="space-y-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{errorMessage}</p>
      <button className="btn-secondary w-full sm:w-auto" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  </SectionCard>
);

const TournamentHomeEmpty = () => (
  <SectionCard title="Sin torneos disponibles" description="Crea o habilita un torneo para mostrar el panel informativo.">
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
        Ver torneos
      </Link>
    </div>
  </SectionCard>
);

const TournamentHomeLiveFeed = ({ mode }: { mode: "viewer" | "admin" }) => {
  const { insight, loading, errorMessage, refresh } = useTournamentHomeFeed();

  const heroStats = useMemo(() => {
    if (insight) return insight.stats.slice(0, 3);
    return [
      { label: "Finalizados", value: "--" },
      { label: "Pendientes", value: "--" },
      { label: "Puntos totales", value: "--" },
    ];
  }, [insight]);

  if (loading) return <TournamentHomeLoading />;
  if (errorMessage) return <TournamentHomeError errorMessage={errorMessage} onRetry={refresh} />;
  if (!insight) return <TournamentHomeEmpty />;

  const viewerMode = mode === "viewer";
  const heroTitle = insight.tournamentName;
  const highlightCards = insight.quickHighlights.slice(0, 3);
  const dailyNotes = insight.dailyNotes.slice(0, 2);
  const recentMatches = insight.latestResults.slice(0, 3);
  const upcomingMatches = insight.upcomingMatches.slice(0, 3);
  const topTeams = insight.topTeams.slice(0, 3);
  const topScorers = insight.topScorers.slice(0, 3);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,hsl(var(--primary)/0.14),transparent_46%),radial-gradient(circle_at_88%_12%,hsl(var(--warning)/0.12),transparent_38%)]" />
        <div className="relative grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">
                <span className="mr-1.5 inline-flex h-2 w-2 rounded-full bg-[hsl(var(--primary))] motion-safe:animate-pulse" />
                {viewerMode ? "Torneo en curso" : "Control del torneo"}
              </Badge>
              <Badge variant={insight.todayPendingMatchesCount > 0 ? "warning" : "default"}>
                {insight.todayPendingMatchesCount > 0 ? `${insight.todayPendingMatchesCount} juego(s) hoy` : "Sin juegos hoy"}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">
                <MegaphoneIcon className="h-4 w-4" />
                Resumen del torneo más reciente
              </div>
              <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">{heroTitle}</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] sm:text-base">{insight.headline}</p>
            </div>

            <div className="rounded-[12px] border bg-[hsl(var(--surface-1)/0.78)] p-3">
              <div className="flex items-start gap-2">
                <SparklesIcon className="mt-0.5 h-4 w-4 text-[hsl(var(--warning))]" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[hsl(var(--text-subtle))]">
                    Radar del día · {insight.generatedAt} · {insight.generatedAtTime}
                  </p>
                  <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">{insight.challengeLine}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {insight.topRebounderLine ?? insight.topAssisterLine ?? insight.playfulLine}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {heroStats.map((item) => (
                <StatPill
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  className="bg-[hsl(var(--surface-1)/0.92)] shadow-[0_3px_10px_hsl(var(--background)/0.04)]"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {highlightCards.map((item) => (
                <div key={item.id} className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        item.accent === "success"
                          ? "bg-[hsl(var(--success))]"
                          : item.accent === "warning"
                          ? "bg-[hsl(var(--warning))]"
                          : item.accent === "danger"
                          ? "bg-[hsl(var(--destructive))]"
                          : item.accent === "primary"
                          ? "bg-[hsl(var(--primary))]"
                          : "bg-[hsl(var(--text-subtle))]"
                      }`}
                    />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-bold tabular-nums">{item.value}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.helper}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link to={`/tournaments/view/${insight.tournamentId}`} className="btn-primary w-full sm:w-auto">
                {viewerMode ? "Ver torneo actual" : "Administrar torneo"}
              </Link>
              <button type="button" onClick={refresh} className="btn-secondary w-full sm:w-auto">
                <ArrowPathIcon className="h-4 w-4" />
                Actualizar
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <article className="rounded-[12px] border bg-[hsl(var(--surface-1)/0.95)] p-4 shadow-[0_8px_20px_hsl(var(--background)/0.06)]">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border bg-[hsl(var(--surface-2))] text-[hsl(var(--primary))]">
                  <CalendarDaysIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Próxima cita</p>
                  <p className="text-sm font-semibold">Agenda inmediata</p>
                </div>
              </div>

              {insight.nextMatch ? (
                <div className="mt-3 space-y-2">
                  <p className="text-base font-bold leading-tight">
                    {insight.nextMatch.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {insight.nextMatch.teamB}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{formatUpcomingMatchLabel(insight.nextMatch)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={insight.todayPendingMatchesCount > 0 ? "warning" : "default"}>
                      Hoy: {insight.todayPendingMatchesCount}
                    </Badge>
                    <Badge variant="primary">7 días: {insight.next7DaysPendingMatchesCount}</Badge>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                  No hay partidos pendientes programados en este momento.
                </p>
              )}
            </article>

            <article className="rounded-[12px] border bg-[hsl(var(--surface-1)/0.95)] p-4 shadow-[0_8px_20px_hsl(var(--background)/0.06)]">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border bg-[hsl(var(--surface-2))] text-[hsl(var(--success))]">
                  <FireIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Último cierre</p>
                  <p className="text-sm font-semibold">Resultado reciente</p>
                </div>
              </div>

              {insight.latestResult ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-base font-bold leading-tight">
                    {insight.latestResult.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {insight.latestResult.teamB}
                  </p>
                  <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">{formatMatchScoreLine(insight.latestResult)}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {formatHomeDateTime(insight.latestResult.matchDate, insight.latestResult.matchTime)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Aún no hay resultados cerrados para mostrar.</p>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <SectionCard title="Novedades del día" description="Señales rápidas para entender el estado del torneo.">
            <div className="space-y-2">
              {dailyNotes.map((note, index) => (
                <article key={note.id} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={note.variant}>{note.badge}</Badge>
                        <span className="text-[11px] text-[hsl(var(--text-subtle))]">#{index + 1}</span>
                      </div>
                      <p className="text-sm font-semibold leading-snug text-[hsl(var(--text-strong))]">{note.title}</p>
                      <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{note.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Agenda y resultados" description="Lo que viene y lo último que cerró en el torneo.">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                    Próximos partidos
                  </p>
                </div>
                {upcomingMatches.length > 0 ? (
                  upcomingMatches.map((match) => (
                    <article key={`upcoming-${match.matchId}`} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                      <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">
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

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BoltIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                    Resultados recientes
                  </p>
                </div>
                {recentMatches.length > 0 ? (
                  recentMatches.map((match) => (
                    <article key={`recent-${match.matchId}`} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">
                          {match.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {match.teamB}
                        </p>
                        <Badge variant={match.hasStats ? "success" : "default"}>
                          {match.hasStats ? "Con stats" : "Sin stats"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-semibold tabular-nums text-[hsl(var(--text-strong))]">
                        {formatMatchScoreLine(match)}
                      </p>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {formatHomeDateTime(match.matchDate, match.matchTime)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                    Aún no hay partidos finalizados.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
          <SectionCard title="Tabla y líderes" description="Resumen competitivo del torneo en curso.">
            <div className="space-y-3">
              <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.5)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Panorama</p>
                <p className="mt-1 text-sm text-[hsl(var(--text-strong))]">{insight.teamsLine}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Top equipos</p>
                {topTeams.length > 0 ? (
                  topTeams.map((team, index) => (
                    <article key={`team-${team.teamId}`} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[hsl(var(--text-strong))]">
                            {index + 1}. {team.name}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {team.pg}-{team.pp} · {team.pj} PJ
                          </p>
                        </div>
                        <span className="text-sm font-bold tabular-nums">{formatPct(team.winPct)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                    Sin tabla suficiente para mostrar ranking.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Top anotadores</p>
                {topScorers.length > 0 ? (
                  topScorers.map((player, index) => (
                    <article key={`${player.name}-${index}`} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {index + 1}. {player.name}
                          </p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {player.teamName ?? "Equipo sin registrar"} · {player.gamesPlayed} PJ
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">{player.totalPoints}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{player.ppp.toFixed(1)} PPP</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                    Sin líderes de puntos todavía.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Accesos rápidos" description="Entradas directas al seguimiento del torneo.">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  to={`/tournaments/view/${insight.tournamentId}`}
                  className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 transition-colors hover:bg-[hsl(var(--surface-2))]"
                >
                  <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                    <TrophyIcon className="h-5 w-5" />
                    <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">Torneo actual</p>
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Calendario, resultados y analíticas del torneo en curso.</p>
                </Link>

                <Link
                  to="/matches"
                  className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 transition-colors hover:bg-[hsl(var(--surface-2))]"
                >
                  <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                    <FireIcon className="h-5 w-5" />
                    <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">Resultados</p>
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Consulta marcadores recientes y partidos jugados.</p>
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
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Reglas oficiales del torneo actual.</p>
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
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Gestiona torneos y revisa configuraciones.</p>
                  </Link>
                ) : null}
              </div>

              <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.55)] p-3">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                      Cobertura de datos
                    </p>
                    <div className="h-2 rounded-full bg-[hsl(var(--surface-3))]">
                      <div
                        className="h-2 rounded-full bg-[hsl(var(--primary))] transition-all duration-700"
                        style={{ width: `${Math.max(6, Math.min(100, insight.statsCoveragePct))}%` }}
                      />
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {insight.resultsSummary.matchesWithStats} boxscores completos · {insight.snapshotPlayersAnalyzed} jugadores analizados
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
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
