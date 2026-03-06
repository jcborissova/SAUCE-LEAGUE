import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  FireIcon,
  SparklesIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import StatPill from "../components/ui/StatPill";
import Badge from "../components/ui/Badge";
import ModalShell from "../components/ui/ModalShell";
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
import { abbreviateLeaderboardName } from "../utils/player-display";
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
  playerLines: PlayerStatsLine[];
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

type DailyTournamentSpotlight = {
  id: string;
  badge: string;
  title: string;
  description: string;
  accent: "primary" | "warning" | "success";
  photo: string | null;
  photoAlt: string;
  statLeftLabel: string;
  statLeftValue: string;
  statRightLabel: string;
  statRightValue: string;
};

type DailyTournamentSpotlightVariant = {
  idSuffix: string;
  title: string;
  description: string;
  badge?: DailyTournamentSpotlight["badge"];
  accent?: DailyTournamentSpotlight["accent"];
};

const DAILY_SPOTLIGHT_AUTO_PREFIX = "sauce-league:home:nunaico:auto:v1";
const DAILY_SPOTLIGHT_READ_PREFIX = "sauce-league:home:nunaico:read:v1";
const DAILY_SPOTLIGHT_USER_SEED_KEY = "sauce-league:home:nunaico:user-seed:v1";

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
    playerLines,
    resultsSummary: summary,
    playedResultsCount,
    pendingMatchesCount,
    todayPendingMatchesCount,
    next7DaysPendingMatchesCount,
    statsCoveragePct,
    idealFive,
  };
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildDailySpotlightAutoShownKey = (
  tournamentId: string,
  mode: "viewer" | "admin",
  dateIso: string
) => `${DAILY_SPOTLIGHT_AUTO_PREFIX}:${mode}:${tournamentId}:${dateIso}`;

const buildDailySpotlightReadKey = (
  tournamentId: string,
  mode: "viewer" | "admin",
  dateIso: string
) => `${DAILY_SPOTLIGHT_READ_PREFIX}:${mode}:${tournamentId}:${dateIso}`;

const getDailySpotlightUserSeed = (): string => {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.localStorage.getItem(DAILY_SPOTLIGHT_USER_SEED_KEY);
    if (existing && existing.trim().length > 0) return existing;

    const generated = `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
    window.localStorage.setItem(DAILY_SPOTLIGHT_USER_SEED_KEY, generated);
    return generated;
  } catch {
    return "fallback";
  }
};

const pushDailySpotlightVariants = (
  candidates: DailyTournamentSpotlight[],
  idPrefix: string,
  base: Omit<DailyTournamentSpotlight, "id" | "title" | "description">,
  variants: DailyTournamentSpotlightVariant[]
) => {
  variants.forEach((variant) => {
    candidates.push({
      ...base,
      id: `${idPrefix}-${variant.idSuffix}`,
      title: variant.title,
      description: variant.description,
      badge: variant.badge ?? base.badge,
      accent: variant.accent ?? base.accent,
    });
  });
};

const selectDailySpotlight = (
  candidates: DailyTournamentSpotlight[],
  seedSource: string
): DailyTournamentSpotlight | null => {
  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((candidateA, candidateB) => {
    const scoreA = hashString(`${seedSource}:${candidateA.id}`);
    const scoreB = hashString(`${seedSource}:${candidateB.id}`);
    return scoreA - scoreB;
  });

  return ranked[0] ?? null;
};

const buildDailySpotlight = (
  insight: TournamentHomeInsight,
  mode: "viewer" | "admin",
  userSeed: string
): DailyTournamentSpotlight | null => {
  const candidates: DailyTournamentSpotlight[] = [];
  const leader = insight.leader;
  const bestTeam = insight.bestTeam;
  const latestResult = insight.latestResult;
  const nextMatch = insight.nextMatch;
  const regularLines = insight.playerLines.filter((line) => line.gamesPlayed >= 2);
  const topScoringLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.ppg - lineA.perGame.ppg)
    .slice(0, 5);
  const topReboundLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.rpg - lineA.perGame.rpg)
    .slice(0, 4);
  const top3ptLines = regularLines
    .filter((line) => line.totals.tpa >= 8)
    .slice()
    .sort((lineA, lineB) => lineB.tpPct - lineA.tpPct)
    .slice(0, 4);
  const low3ptLines = regularLines
    .filter((line) => line.totals.tpa >= 8)
    .slice()
    .sort((lineA, lineB) => lineA.tpPct - lineB.tpPct)
    .slice(0, 4);
  const topFtLines = regularLines
    .filter((line) => line.totals.fta >= 8)
    .slice()
    .sort((lineA, lineB) => lineB.ftPct - lineA.ftPct)
    .slice(0, 4);
  const lowFtLines = regularLines
    .filter((line) => line.totals.fta >= 8)
    .slice()
    .sort((lineA, lineB) => lineA.ftPct - lineB.ftPct)
    .slice(0, 4);
  const topImpactLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.plusMinus - lineA.perGame.plusMinus)
    .slice(0, 4);
  const lowImpactLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineA.perGame.plusMinus - lineB.perGame.plusMinus)
    .slice(0, 4);

  if (leader) {
    pushDailySpotlightVariants(
      candidates,
      `leader-${leader.playerId}`,
      {
        badge: "Nunaico del día",
        accent: "warning",
        photo: leader.photo,
        photoAlt: leader.name,
        statLeftLabel: "Puntos",
        statLeftValue: String(leader.totalPoints),
        statRightLabel: "PPP",
        statRightValue: leader.ppp.toFixed(1),
      },
      [
        {
          idSuffix: "fuego",
          title: `${abbreviateLeaderboardName(leader.name, 24)} está prendío`,
          description: `Anda sin freno con ${leader.totalPoints} puntos y ${leader.ppp.toFixed(1)} PPP en regular.`,
        },
        {
          idSuffix: "microondas",
          title: `${abbreviateLeaderboardName(leader.name, 24)} vino microondas`,
          description: `Le da al torneo una presión real: anota en volumen y sostiene el ritmo de su equipo.`,
        },
        {
          idSuffix: "su-numero",
          title: `${abbreviateLeaderboardName(leader.name, 24)} está en su número`,
          description: `Cuando se calienta, la pizarra lo siente. Está marcando el paso ofensivo de la liga.`,
        },
        {
          idSuffix: "luz-verde",
          title: `${abbreviateLeaderboardName(leader.name, 24)} tiene luz verde`,
          description: `Lo dejaron cocinar y está respondiendo: ${leader.totalPoints} puntos acumulados en el torneo.`,
        },
      ]
    );
  }

  if (bestTeam) {
    const teamFace = insight.topScorers.find((player) => player.teamName === bestTeam.name)?.photo ?? null;
    pushDailySpotlightVariants(
      candidates,
      `team-${bestTeam.teamId}`,
      {
        badge: "Equipo caliente",
        accent: "primary",
        photo: teamFace,
        photoAlt: bestTeam.name,
        statLeftLabel: "Récord",
        statLeftValue: `${bestTeam.pg}-${bestTeam.pp}`,
        statRightLabel: "Win%",
        statRightValue: `${(bestTeam.winPct * 100).toFixed(1)}%`,
      },
      [
        {
          idSuffix: "paso-firme",
          title: `${abbreviateLeaderboardName(bestTeam.name, 24)} va con todo`,
          description: `Marca ${bestTeam.pg}-${bestTeam.pp} y domina el paso del torneo.`,
        },
        {
          idSuffix: "sin-relajo",
          title: `${abbreviateLeaderboardName(bestTeam.name, 24)} no está en relajo`,
          description: `Ese grupo está jugando serio y se nota en la tabla. Récord de respeto en regular.`,
        },
        {
          idSuffix: "timon",
          title: `${abbreviateLeaderboardName(bestTeam.name, 24)} tiene el timón`,
          description: `Se plantó arriba con constancia: gana, cierra y mantiene el ritmo jornada tras jornada.`,
        },
      ]
    );
  }

  regularLines
    .slice()
    .sort((a, b) => b.perGame.apg - a.perGame.apg)
    .slice(0, 5)
    .forEach((line) => {
      pushDailySpotlightVariants(
        candidates,
        `creator-${line.playerId}`,
        {
          badge: "Mente de juego",
          accent: "primary",
          photo: line.photo ?? null,
          photoAlt: line.name,
          statLeftLabel: "APP",
          statLeftValue: line.perGame.apg.toFixed(1),
          statRightLabel: "PRA",
          statRightValue: (line.perGame.ppg + line.perGame.rpg + line.perGame.apg).toFixed(1),
        },
        [
          {
            idSuffix: "reparte",
            title: `${abbreviateLeaderboardName(line.name, 24)} reparte la funda`,
            description: `Está moviendo el balón con intención y dejando ventaja para su equipo.`,
          },
          {
            idSuffix: "ritmo",
            title: `${abbreviateLeaderboardName(line.name, 24)} controla el ritmo`,
            description: `Cuando acelera o pausa, todo el ataque se ordena alrededor de su lectura.`,
          },
          {
            idSuffix: "direccion",
            title: `${abbreviateLeaderboardName(line.name, 24)} dirige con calma`,
            description: `No juega apurado, juega claro. Eso le está sumando valor al grupo cada noche.`,
          },
        ]
      );
    });

  topScoringLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `scoring-${line.playerId}`,
      {
        badge: "Fábrica de puntos",
        accent: "success",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "PPP",
        statLeftValue: line.perGame.ppg.toFixed(1),
        statRightLabel: "PTS",
        statRightValue: String(line.totals.points),
      },
      [
        {
          idSuffix: "cae-cuarto",
          title: `${abbreviateLeaderboardName(line.name, 24)} cae con cuarto`,
          description: `Cada juego te garantiza puntos. Es una de las ofensivas más estables del torneo.`,
        },
        {
          idSuffix: "sin-freno",
          title: `${abbreviateLeaderboardName(line.name, 24)} no suelta el acelerador`,
          description: `Anota en ráfagas y obliga a la defensa a cambiar plan de juego.`,
        },
      ]
    );
  });

  topReboundLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `boards-${line.playerId}`,
      {
        badge: "Dueño del rebote",
        accent: "success",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "RPP",
        statLeftValue: line.perGame.rpg.toFixed(1),
        statRightLabel: "PJ",
        statRightValue: String(line.gamesPlayed),
      },
      [
        {
          idSuffix: "cristales",
          title: `${abbreviateLeaderboardName(line.name, 24)} está limpiando los cristales`,
          description: `Cada rebote extra es una posesión más para su equipo. Está dominando en esfuerzo.`,
        },
        {
          idSuffix: "segundas",
          title: `${abbreviateLeaderboardName(line.name, 24)} gana segundas oportunidades`,
          description: `Su trabajo en el tablero está inclinando partidos sin necesidad de mucho ruido.`,
        },
      ]
    );
  });

  regularLines
    .slice()
    .sort(
      (a, b) =>
        b.perGame.spg + b.perGame.bpg - (a.perGame.spg + a.perGame.bpg)
    )
    .slice(0, 5)
    .forEach((line) => {
      pushDailySpotlightVariants(
        candidates,
        `defense-${line.playerId}`,
        {
          badge: "Candado activo",
          accent: "success",
          photo: line.photo ?? null,
          photoAlt: line.name,
          statLeftLabel: "ROB",
          statLeftValue: line.perGame.spg.toFixed(1),
          statRightLabel: "TAP",
          statRightValue: line.perGame.bpg.toFixed(1),
        },
        [
          {
            idSuffix: "cerrando",
            title: `${abbreviateLeaderboardName(line.name, 24)} está cerrando`,
            description: `Cuando este tigre aprieta atrás, la ofensiva rival se tranca.`,
          },
          {
            idSuffix: "candado",
            title: `${abbreviateLeaderboardName(line.name, 24)} puso candado`,
            description: `Está metiendo manos legales, rotando bien y cambiando tiros clave.`,
          },
          {
            idSuffix: "pesadilla",
            title: `${abbreviateLeaderboardName(line.name, 24)} se volvió una pesadilla`,
            description: `Defiende líneas de pase y complica cada posesión en el perímetro.`,
          },
        ]
      );
    });

  regularLines
    .filter((line) => line.totals.fga >= 18)
    .slice()
    .sort((a, b) => b.fgPct - a.fgPct)
    .slice(0, 5)
    .forEach((line) => {
      pushDailySpotlightVariants(
        candidates,
        `efficiency-${line.playerId}`,
        {
          badge: "Mano fina",
          accent: "success",
          photo: line.photo ?? null,
          photoAlt: line.name,
          statLeftLabel: "FG%",
          statLeftValue: `${line.fgPct.toFixed(1)}%`,
          statRightLabel: "PPP",
          statRightValue: line.perGame.ppg.toFixed(1),
        },
        [
          {
            idSuffix: "calibrado",
            title: `${abbreviateLeaderboardName(line.name, 24)} anda calibrado`,
            description: `Está tirando con buen timing y sacándole jugo a cada posesión.`,
          },
          {
            idSuffix: "muneca-fina",
            title: `${abbreviateLeaderboardName(line.name, 24)} tiene la muñeca fina`,
            description: `No fuerza tanto y por eso su eficiencia ofensiva se mantiene arriba.`,
          },
          {
            idSuffix: "elige-bien",
            title: `${abbreviateLeaderboardName(line.name, 24)} está eligiendo bien`,
            description: `Buenas decisiones, buenos tiros, buenos porcentajes. Fórmula simple y efectiva.`,
          },
        ]
      );
    });

  top3ptLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `triples-hot-${line.playerId}`,
      {
        badge: "Mira de 3",
        accent: "success",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "3P%",
        statLeftValue: `${line.tpPct.toFixed(1)}%`,
        statRightLabel: "3PA",
        statRightValue: String(line.totals.tpa),
      },
      [
        {
          idSuffix: "francotirador",
          title: `${abbreviateLeaderboardName(line.name, 24)} está francotirador`,
          description: `Desde afuera está cobrando peaje. Si le das espacio, castiga.`,
        },
        {
          idSuffix: "perimetro",
          title: `${abbreviateLeaderboardName(line.name, 24)} manda en el perímetro`,
          description: `Su amenaza de tres abre cancha y le cambia la defensa al rival.`,
        },
      ]
    );
  });

  topFtLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `ft-hot-${line.playerId}`,
      {
        badge: "Línea segura",
        accent: "success",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "TL%",
        statLeftValue: `${line.ftPct.toFixed(1)}%`,
        statRightLabel: "TLA",
        statRightValue: String(line.totals.fta),
      },
      [
        {
          idSuffix: "linea-fria",
          title: `${abbreviateLeaderboardName(line.name, 24)} no tiembla en la línea`,
          description: `Cuando va al libre, su equipo respira. Está siendo garantía en cierre.`,
        },
        {
          idSuffix: "cerrador",
          title: `${abbreviateLeaderboardName(line.name, 24)} cierra con libres`,
          description: `En partido apretado, estos puntos pesan como oro.`,
        },
      ]
    );
  });

  topImpactLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `impact-up-${line.playerId}`,
      {
        badge: "Impacto positivo",
        accent: "success",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "+/- PJ",
        statLeftValue: line.perGame.plusMinus.toFixed(1),
        statRightLabel: "VAL/PJ",
        statRightValue: line.valuationPerGame.toFixed(1),
      },
      [
        {
          idSuffix: "plus",
          title: `${abbreviateLeaderboardName(line.name, 24)} mejora el equipo en cancha`,
          description: `Los parciales suelen favorecer a su quinteto cuando está en juego.`,
        },
        {
          idSuffix: "equilibrio",
          title: `${abbreviateLeaderboardName(line.name, 24)} aporta equilibrio real`,
          description: `No siempre hace ruido, pero sus minutos empujan al equipo hacia adelante.`,
        },
      ]
    );
  });

  regularLines
    .slice()
    .sort((a, b) => b.perGame.topg - a.perGame.topg)
    .slice(0, 5)
    .forEach((line) => {
      pushDailySpotlightVariants(
        candidates,
        `turnovers-${line.playerId}`,
        {
          badge: "En ajuste",
          accent: "warning",
          photo: line.photo ?? null,
          photoAlt: line.name,
          statLeftLabel: "TOPG",
          statLeftValue: line.perGame.topg.toFixed(1),
          statRightLabel: "APP",
          statRightValue: line.perGame.apg.toFixed(1),
        },
        [
          {
            idSuffix: "pegamento",
            title: `${abbreviateLeaderboardName(line.name, 24)} necesita pegamento`,
            description: `La bola se le está escapando más de la cuenta. Hoy toca jugar más simple.`,
          },
          {
            idSuffix: "mantequilla",
            title: `${abbreviateLeaderboardName(line.name, 24)} tiene la mano con mantequilla`,
            description: `Está soltando la bola temprano. Si baja pérdidas, sube su impacto de una vez.`,
          },
          {
            idSuffix: "jabon",
            title: `${abbreviateLeaderboardName(line.name, 24)} anda con el balón en jabón`,
            description: `Cada posesión está pidiendo más cuidado. Menos riesgo, más control.`,
          },
          {
            idSuffix: "acelerado",
            title: `${abbreviateLeaderboardName(line.name, 24)} está jugando acelerado`,
            description: `Con una pausa extra en cada ataque puede cortar pérdidas rápido.`,
          },
        ]
      );
    });

  regularLines
    .slice()
    .sort((a, b) => b.perGame.fpg - a.perGame.fpg)
    .slice(0, 5)
    .forEach((line) => {
      pushDailySpotlightVariants(
        candidates,
        `fouls-${line.playerId}`,
        {
          badge: "Falta control",
          accent: "warning",
          photo: line.photo ?? null,
          photoAlt: line.name,
          statLeftLabel: "FPG",
          statLeftValue: line.perGame.fpg.toFixed(1),
          statRightLabel: "PJ",
          statRightValue: String(line.gamesPlayed),
        },
        [
          {
            idSuffix: "zona-faltas",
            title: `${abbreviateLeaderboardName(line.name, 24)} está en zona de faltas`,
            description: `Si baja el contacto innecesario, puede rendir más minutos de calidad.`,
          },
          {
            idSuffix: "bonus",
            title: `${abbreviateLeaderboardName(line.name, 24)} está regalando bonus`,
            description: `Necesita defender con más disciplina para no poner al rival en la línea.`,
          },
          {
            idSuffix: "afinar",
            title: `${abbreviateLeaderboardName(line.name, 24)} tiene que afinar las manos`,
            description: `Le están pitando mucho contacto. Con técnica limpia gana continuidad.`,
          },
        ]
      );
    });

  regularLines
    .filter((line) => line.totals.fga >= 18)
    .slice()
    .sort((a, b) => a.fgPct - b.fgPct)
    .slice(0, 5)
    .forEach((line) => {
      pushDailySpotlightVariants(
        candidates,
        `cold-${line.playerId}`,
        {
          badge: "Día salao",
          accent: "warning",
          photo: line.photo ?? null,
          photoAlt: line.name,
          statLeftLabel: "FG%",
          statLeftValue: `${line.fgPct.toFixed(1)}%`,
          statRightLabel: "Tiros",
          statRightValue: String(line.totals.fga),
        },
        [
          {
            idSuffix: "aro-apretado",
            title: `${abbreviateLeaderboardName(line.name, 24)} tiene el aro apretado`,
            description: `No está entrando como quiere, pero esto cambia con dos juegos buenos.`,
          },
          {
            idSuffix: "coco",
            title: `${abbreviateLeaderboardName(line.name, 24)} no mete un coco en una piscina`,
            description: `Está en racha fría, pero con selección de tiro más limpia puede romper eso rápido.`,
          },
          {
            idSuffix: "salao",
            title: `${abbreviateLeaderboardName(line.name, 24)} anda salao en ofensiva`,
            description: `La bola le está coqueteando al aro. Calma y buenos tiros para virar la historia.`,
          },
          {
            idSuffix: "aro-chiquito",
            title: `${abbreviateLeaderboardName(line.name, 24)} ve el aro chiquito`,
            description: `Cuando vuelva a su ritmo, esos porcentajes deben subir de inmediato.`,
          },
        ]
      );
    });

  low3ptLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `triples-cold-${line.playerId}`,
      {
        badge: "Perímetro en ajuste",
        accent: "warning",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "3P%",
        statLeftValue: `${line.tpPct.toFixed(1)}%`,
        statRightLabel: "3PA",
        statRightValue: String(line.totals.tpa),
      },
      [
        {
          idSuffix: "frio",
          title: `${abbreviateLeaderboardName(line.name, 24)} está frío de tres`,
          description: `Hay volumen, pero falta precisión. Buen momento para resetear mecánica.`,
        },
        {
          idSuffix: "afuera",
          title: `${abbreviateLeaderboardName(line.name, 24)} necesita ajustar de afuera`,
          description: `Con un par de juegos sólidos desde el perímetro cambia su lectura completa.`,
        },
      ]
    );
  });

  lowFtLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `ft-cold-${line.playerId}`,
      {
        badge: "Libres en ajuste",
        accent: "warning",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "TL%",
        statLeftValue: `${line.ftPct.toFixed(1)}%`,
        statRightLabel: "TLA",
        statRightValue: String(line.totals.fta),
      },
      [
        {
          idSuffix: "linea",
          title: `${abbreviateLeaderboardName(line.name, 24)} está dejando puntos en la línea`,
          description: `Los libres pueden ser su salto inmediato. Aquí hay margen claro de mejora.`,
        },
        {
          idSuffix: "gratis",
          title: `${abbreviateLeaderboardName(line.name, 24)} tiene que cobrar los gratis`,
          description: `En cierre apretado, estos puntos pesan más que cualquier jugada bonita.`,
        },
      ]
    );
  });

  lowImpactLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `impact-down-${line.playerId}`,
      {
        badge: "Modo recarga",
        accent: "primary",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "+/- PJ",
        statLeftValue: line.perGame.plusMinus.toFixed(1),
        statRightLabel: "VAL/PJ",
        statRightValue: line.valuationPerGame.toFixed(1),
      },
      [
        {
          idSuffix: "beta",
          title: `${abbreviateLeaderboardName(line.name, 24)} está en versión beta`,
          description: `Tiene herramientas, pero necesita un tramo sólido para estabilizar impacto.`,
        },
        {
          idSuffix: "subir",
          title: `${abbreviateLeaderboardName(line.name, 24)} puede subir de nivel`,
          description: `Con menos errores forzados y mejor selección, su lectura cambia de una vez.`,
        },
      ]
    );
  });

  if (latestResult) {
    const hasScore =
      Number.isFinite(latestResult.teamAPoints) &&
      Number.isFinite(latestResult.teamBPoints) &&
      (latestResult.teamAPoints > 0 || latestResult.teamBPoints > 0);
    const margin = hasScore ? Math.abs(latestResult.teamAPoints - latestResult.teamBPoints) : 0;
    const winningTeam = hasScore
      ? latestResult.teamAPoints > latestResult.teamBPoints
        ? latestResult.teamA
        : latestResult.teamB
      : latestResult.winnerTeam;
    const winningFace =
      insight.topScorers.find((player) => player.teamName === winningTeam)?.photo ?? leader?.photo ?? null;
    const losingTeam = hasScore
      ? latestResult.teamAPoints > latestResult.teamBPoints
        ? latestResult.teamB
        : latestResult.teamA
      : null;

    pushDailySpotlightVariants(
      candidates,
      `result-${latestResult.matchId}`,
      {
        badge: "Cierre pesado",
        accent: "success",
        photo: winningFace,
        photoAlt: winningTeam ?? "Resultado del torneo",
        statLeftLabel: "Marcador",
        statLeftValue: formatMatchScoreLine(latestResult),
        statRightLabel: "Fecha",
        statRightValue: formatHomeDate(latestResult.matchDate, { day: "2-digit", month: "short" }),
      },
      [
        {
          idSuffix: "duro",
          title: hasScore
            ? `${abbreviateLeaderboardName(winningTeam ?? "Partidazo", 24)} cerró duro`
            : "Se cerró la jornada",
          description: hasScore
            ? `${latestResult.teamA} ${latestResult.teamAPoints} - ${latestResult.teamBPoints} ${latestResult.teamB}. Brecha de ${margin}.`
            : `Ganó ${latestResult.winnerTeam ?? "el local"} y sigue subiendo la presión en la tabla.`,
        },
        {
          idSuffix: "sin-piedad",
          title: hasScore
            ? `${abbreviateLeaderboardName(winningTeam ?? "Ganador", 24)} no bajó el ritmo`
            : "Jornada cerrada con autoridad",
          description: hasScore
            ? `${abbreviateLeaderboardName(winningTeam ?? "El ganador", 20)} sacó ventaja de ${margin} y dejó a ${abbreviateLeaderboardName(losingTeam ?? "su rival", 18)} persiguiendo.`
            : "El resultado se decidió por ejecución y control en los minutos finales.",
        },
      ]
    );
  }

  if (nextMatch) {
    const nextFace =
      insight.topScorers.find(
        (player) => player.teamName === nextMatch.teamA || player.teamName === nextMatch.teamB
      )?.photo ?? null;
    pushDailySpotlightVariants(
      candidates,
      `next-${nextMatch.matchId}`,
      {
        badge: "Alerta de cancha",
        accent: "primary",
        photo: nextFace,
        photoAlt: `${nextMatch.teamA} vs ${nextMatch.teamB}`,
        statLeftLabel: "Hora",
        statLeftValue: formatHomeTime(nextMatch.matchTime),
        statRightLabel: "Fecha",
        statRightValue: formatHomeDate(nextMatch.matchDate, { day: "2-digit", month: "short" }),
      },
      [
        {
          idSuffix: "picante",
          title: `${abbreviateLeaderboardName(nextMatch.teamA, 14)} vs ${abbreviateLeaderboardName(nextMatch.teamB, 14)}`,
          description: "Próximo choque en agenda. Nada de pestañear, que este viene picante.",
        },
        {
          idSuffix: "candela",
          title: `${abbreviateLeaderboardName(nextMatch.teamA, 14)} y ${abbreviateLeaderboardName(nextMatch.teamB, 14)} vienen en candela`,
          description: "Juego para llegar temprano. Puede mover tabla y narrativas del torneo.",
        },
      ]
    );
  }

  return selectDailySpotlight(
    candidates,
    `${insight.tournamentId}:${mode}:${getTodayIsoLocal()}:${userSeed}:${candidates.length}`
  );
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
  const [dailySpotlight, setDailySpotlight] = useState<DailyTournamentSpotlight | null>(null);
  const [dailySpotlightOpen, setDailySpotlightOpen] = useState(false);
  const [dailySpotlightUnread, setDailySpotlightUnread] = useState(false);

  const heroStats = insight
    ? [
        { label: "Finalizados", value: String(insight.playedResultsCount) },
        { label: "Pendientes", value: String(insight.pendingMatchesCount) },
        { label: "Cobertura", value: `${insight.statsCoveragePct.toFixed(0)}%` },
      ]
    : [
        { label: "Finalizados", value: "--" },
        { label: "Pendientes", value: "--" },
        { label: "Cobertura", value: "--" },
      ];

  useEffect(() => {
    if (!insight) {
      setDailySpotlight(null);
      setDailySpotlightOpen(false);
      setDailySpotlightUnread(false);
      return;
    }

    const todayIso = getTodayIsoLocal();
    const spotlight = buildDailySpotlight(insight, mode, getDailySpotlightUserSeed());
    if (!spotlight) {
      setDailySpotlight(null);
      setDailySpotlightOpen(false);
      setDailySpotlightUnread(false);
      return;
    }

    setDailySpotlight(spotlight);
    const autoShownKey = buildDailySpotlightAutoShownKey(insight.tournamentId, mode, todayIso);
    const readKey = buildDailySpotlightReadKey(insight.tournamentId, mode, todayIso);

    let shouldAutoOpen = true;
    let unread = true;

    try {
      const alreadyAutoShown = window.localStorage.getItem(autoShownKey) === "1";
      const alreadyRead = window.localStorage.getItem(readKey) === "1";

      if (!alreadyAutoShown) {
        window.localStorage.setItem(autoShownKey, "1");
      }

      shouldAutoOpen = !alreadyAutoShown;
      unread = !alreadyRead;
    } catch {
      // noop: if localStorage is unavailable, behaves as session-only popup.
    }

    setDailySpotlightUnread(unread);
    setDailySpotlightOpen(shouldAutoOpen);
  }, [insight, mode]);

  const handleCloseDailySpotlight = () => {
    setDailySpotlightOpen(false);
  };

  const handleOpenDailySpotlightFromBubble = () => {
    if (!insight || !dailySpotlight) return;
    setDailySpotlightOpen(true);
    setDailySpotlightUnread(false);

    const readKey = buildDailySpotlightReadKey(insight.tournamentId, mode, getTodayIsoLocal());
    try {
      window.localStorage.setItem(readKey, "1");
    } catch {
      // noop
    }
  };

  if (loading) return <TournamentHomeLoading />;
  if (errorMessage) return <TournamentHomeError errorMessage={errorMessage} onRetry={refresh} />;
  if (!insight) return <TournamentHomeEmpty />;

  const viewerMode = mode === "viewer";
  const topScorers = insight.topScorers.slice(0, 5);
  const topTeams = insight.topTeams.slice(0, 4);
  const idealFive = insight.idealFive;
  const idealFiveRoleOrder = ["PG", "SG", "SF", "PF", "C"];
  const idealFiveLineup = idealFive
    ? [...idealFive.lineup].sort((a, b) => {
        const indexA = idealFiveRoleOrder.indexOf(a.role);
        const indexB = idealFiveRoleOrder.indexOf(b.role);
        if (indexA !== indexB) return indexA - indexB;
        return b.overallScore - a.overallScore;
      })
    : [];
  const leagueFlavorLine = (() => {
    if (insight.leader && insight.bestTeam && insight.leader.teamName === insight.bestTeam.name) {
      return `${insight.bestTeam.name} está encendida: manda en tabla y también tiene al cañonero del torneo.`;
    }

    if (insight.nextMatch && insight.latestResult) {
      return `Se cerró ${formatMatchScoreLine(insight.latestResult)} y lo próximo viene con swing: ${insight.nextMatch.teamA} vs ${insight.nextMatch.teamB}.`;
    }

    if (insight.leader) {
      return `${insight.leader.name} anda en modo microondas con ${insight.leader.totalPoints} puntos acumulados.`;
    }

    return "La liga está en movimiento: cada jornada aprieta más la tabla.";
  })();
  const spotlightToneClass =
    dailySpotlight?.accent === "warning"
      ? "border-[hsl(var(--warning)/0.42)] bg-[hsl(var(--warning)/0.12)]"
      : dailySpotlight?.accent === "success"
        ? "border-[hsl(var(--success)/0.38)] bg-[hsl(var(--success)/0.1)]"
        : "border-[hsl(var(--primary)/0.36)] bg-[hsl(var(--primary)/0.1)]";

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
              <FireIcon className="h-5 w-5 text-[hsl(var(--warning))]" />
              <p className="text-sm font-semibold">Pulso del torneo</p>
            </div>

            <div className="mt-3 space-y-2.5">
              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Próximo tip-off</p>
                {insight.nextMatch ? (
                  <>
                    <p className="mt-0.5 text-sm font-semibold">
                      {insight.nextMatch.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {insight.nextMatch.teamB}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatUpcomingMatchLabel(insight.nextMatch)}</p>
                  </>
                ) : (
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Sin partido pendiente en agenda.</p>
                )}
              </article>

              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Último cierre</p>
                {insight.latestResult ? (
                  <>
                    <p className="mt-0.5 text-sm font-semibold">
                      {insight.latestResult.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {insight.latestResult.teamB}
                    </p>
                    <p className="text-xs font-semibold tabular-nums">{formatMatchScoreLine(insight.latestResult)}</p>
                  </>
                ) : (
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Aún no hay resultados cerrados.</p>
                )}
              </article>

              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Línea caliente</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{leagueFlavorLine}</p>
              </article>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Radar semanal" description="Calendario y cierres clave en una sola vista.">
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={insight.todayPendingMatchesCount > 0 ? "warning" : "default"}>
                Hoy: {insight.todayPendingMatchesCount}
              </Badge>
              <Badge variant="primary">7 días: {insight.next7DaysPendingMatchesCount}</Badge>
              <Badge
                variant={
                  insight.statsCoveragePct >= 70 ? "success" : insight.statsCoveragePct >= 35 ? "warning" : "danger"
                }
              >
                Cobertura: {insight.statsCoveragePct.toFixed(0)}%
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Próximos juegos</p>
                {insight.upcomingMatches.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {insight.upcomingMatches.slice(0, 3).map((match) => (
                      <li key={match.matchId} className="text-xs leading-relaxed">
                        <p className="font-semibold">
                          {match.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {match.teamB}
                        </p>
                        <p className="text-[hsl(var(--muted-foreground))]">{formatUpcomingMatchLabel(match)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">No hay juegos pendientes en agenda.</p>
                )}
              </article>

              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Cierres recientes</p>
                {insight.latestResults.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {insight.latestResults.slice(0, 3).map((match) => (
                      <li key={match.matchId} className="text-xs leading-relaxed">
                        <p className="font-semibold">{abbreviateLeaderboardName(`${match.teamA} vs ${match.teamB}`, 28)}</p>
                        <p className="font-semibold tabular-nums">{formatMatchScoreLine(match)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Aún no hay resultados finalizados.</p>
                )}
              </article>
            </div>

            <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Lectura de camerino</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{leagueFlavorLine}</p>
            </article>
          </div>
        </SectionCard>

        <SectionCard title="Ranking express" description="Top anotadores y tabla sin vueltas.">
          <div className="space-y-3">
            <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
              <div className="mb-2 flex items-center gap-2">
                <UserGroupIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Anotadores</p>
              </div>
              {topScorers.length > 0 ? (
                <ul className="space-y-1.5">
                  {topScorers.slice(0, 4).map((player, index) => (
                    <li key={player.playerId} className="flex items-center justify-between gap-2 text-xs">
                      <p className="truncate font-semibold" title={player.name}>
                        #{index + 1} {abbreviateLeaderboardName(player.name, 18)}
                      </p>
                      <span className="shrink-0 font-semibold tabular-nums">{player.totalPoints} pts</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin líderes aún.</p>
              )}
            </article>

            <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
              <div className="mb-2 flex items-center gap-2">
                <TrophyIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Equipos arriba</p>
              </div>
              {topTeams.length > 0 ? (
                <ul className="space-y-1.5">
                  {topTeams.slice(0, 4).map((team, index) => (
                    <li key={team.teamId} className="flex items-center justify-between gap-2 text-xs">
                      <p className="truncate font-semibold" title={team.name}>
                        #{index + 1} {abbreviateLeaderboardName(team.name, 18)}
                      </p>
                      <span className="shrink-0 font-semibold tabular-nums">{team.pg}-{team.pp}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin ranking suficiente todavía.</p>
              )}
            </article>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Quinteto ideal inteligente"
        description="Cinco puestos, una lectura objetiva y fácil de entender."
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
              <Badge variant="default">Mín. juegos: {idealFive.minGames}</Badge>
            </div>

            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {idealFiveLineup.map((slot) => (
                <li key={`${slot.role}-${slot.playerId}`}>
                  <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant={IDEAL_FIVE_ROLE_BADGE_VARIANT[slot.role]}>{slot.role}</Badge>
                      <p className="text-[10px] text-[hsl(var(--text-subtle))] tabular-nums">Fit {slot.roleScore.toFixed(1)}</p>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold" title={slot.name}>
                      {abbreviateLeaderboardName(slot.name, 18)}
                    </p>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{slot.teamName ?? "Sin equipo"}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{slot.keyStatLabel}</p>
                    <p className="text-xs font-semibold tabular-nums">{slot.keyStatValue}</p>
                  </article>
                </li>
              ))}
            </ol>

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

      <ModalShell
        isOpen={Boolean(dailySpotlightOpen && dailySpotlight)}
        onClose={handleCloseDailySpotlight}
        title="Nunaico del día"
        subtitle="Dosis rápida del torneo para arrancar la jornada."
        maxWidthClassName="sm:max-w-xl"
        actions={
          <button type="button" className="btn-primary" onClick={handleCloseDailySpotlight}>
            Entendido
          </button>
        }
      >
        {dailySpotlight ? (
          <article className={`rounded-[12px] border p-3.5 sm:p-4 ${spotlightToneClass}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={dailySpotlight.accent === "warning" ? "warning" : dailySpotlight.accent === "success" ? "success" : "primary"}>
                {dailySpotlight.badge}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                <SparklesIcon className="h-3.5 w-3.5" />
                1 vez por día
              </span>
            </div>

            <div className="mt-3 flex items-start gap-3">
              {dailySpotlight.photo ? (
                <img
                  src={dailySpotlight.photo}
                  alt={dailySpotlight.photoAlt}
                  className="h-14 w-14 shrink-0 rounded-full border border-[hsl(var(--border)/0.82)] object-cover"
                />
              ) : (
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]">
                  <TrophyIcon className="h-7 w-7" />
                </span>
              )}

              <div className="min-w-0">
                <p className="text-base font-bold leading-tight sm:text-lg">{dailySpotlight.title}</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{dailySpotlight.description}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                  {dailySpotlight.statLeftLabel}
                </p>
                <p className="text-sm font-semibold tabular-nums">{dailySpotlight.statLeftValue}</p>
              </article>
              <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                  {dailySpotlight.statRightLabel}
                </p>
                <p className="text-sm font-semibold tabular-nums">{dailySpotlight.statRightValue}</p>
              </article>
            </div>
          </article>
        ) : null}
      </ModalShell>

      {dailySpotlight && !dailySpotlightOpen ? (
        <button
          type="button"
          onClick={handleOpenDailySpotlightFromBubble}
          className={`fixed bottom-24 right-3 z-40 inline-flex items-center justify-center rounded-full border border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-1)/0.96)] p-1.5 shadow-[0_16px_40px_hsl(var(--bg)/0.45)] transition-transform duration-200 hover:scale-[1.04] sm:bottom-6 sm:right-6 ${
            dailySpotlightUnread ? "animate-pulse" : ""
          }`}
          aria-label="Abrir nunaico del día"
        >
          {dailySpotlightUnread ? (
            <span className="pointer-events-none absolute -inset-1 rounded-full bg-[hsl(var(--danger)/0.22)] animate-ping" />
          ) : null}

          <span className="relative z-10 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-2))]">
            {dailySpotlight.photo ? (
              <img
                src={dailySpotlight.photo}
                alt={dailySpotlight.photoAlt}
                className="h-full w-full object-cover"
              />
            ) : (
              <TrophyIcon className="h-6 w-6 text-[hsl(var(--text-subtle))]" />
            )}

            {dailySpotlightUnread ? (
              <span className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center">
                <span className="absolute inline-flex h-6 w-6 rounded-full bg-[hsl(var(--danger)/0.44)] animate-ping" />
                <span className="relative inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[hsl(var(--surface-1))] bg-[hsl(var(--danger))] px-1 text-[12px] font-black leading-none text-white shadow-[0_8px_18px_hsl(var(--danger)/0.45)]">
                  1
                </span>
              </span>
            ) : null}
          </span>
        </button>
      ) : null}
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
