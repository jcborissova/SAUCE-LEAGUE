import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  FireIcon,
  SparklesIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import StatPill from "../components/ui/StatPill";
import Badge from "../components/ui/Badge";
import ModalShell from "../components/ui/ModalShell";
import AppSelect from "../components/ui/AppSelect";
import TournamentActivityTimeline from "../components/Tournaments/TournamentActivityTimeline";
import { useRole } from "../contexts/RoleContext";
import { supabase } from "../lib/supabase";
import {
  getTournamentPlayerLinesFast,
  getTournamentRegularStandings,
  getTournamentResultsOverview,
  getTournamentResultsSummary,
  getTournamentSettings,
} from "../services/tournamentAnalytics";
import {
  buildChallengeBoardRows,
  listTournamentChallenges,
  regenerateTournamentChallenges,
} from "../services/tournamentChallenges";
import type {
  ChallengeBoardRow,
  TournamentChallengeStatus,
  TournamentPlayerChallenge,
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
import {
  getViewerSelectedPlayerForTournament,
  loadViewerSelectedTournamentId,
  saveViewerSelectedPlayerForTournament,
  saveViewerSelectedTournamentId,
} from "../utils/viewer-preferences";

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

type TournamentHomeOption = {
  id: string;
  name: string;
};

type TournamentHomeFeedState = {
  insight: TournamentHomeInsight | null;
  loading: boolean;
  errorMessage: string | null;
  tournaments: TournamentHomeOption[];
  selectedTournamentId: string | null;
  setSelectedTournamentId: (tournamentId: string) => void;
  refresh: () => void;
};

type DailyTournamentSpotlight = {
  id: string;
  subjectKey: string;
  topicKey: string;
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

type DailySpotlightHistoryEntry = {
  dateIso: string;
  subjectKey: string;
  topicKey: string;
  candidateId: string;
};

const DAILY_SPOTLIGHT_AUTO_PREFIX = "sauce-league:home:nunaico:auto:v1";
const DAILY_SPOTLIGHT_READ_PREFIX = "sauce-league:home:nunaico:read:v1";
const DAILY_SPOTLIGHT_USER_SEED_KEY = "sauce-league:home:nunaico:user-seed:v1";
const DAILY_SPOTLIGHT_HISTORY_PREFIX = "sauce-league:home:nunaico:history:v2";
const DAILY_SPOTLIGHT_PICK_PREFIX = "sauce-league:home:nunaico:pick:v2";
const DAILY_SPOTLIGHT_HISTORY_MAX_ENTRIES = 90;
const DAILY_SPOTLIGHT_HISTORY_WINDOW_DAYS = 45;
const DAILY_SPOTLIGHT_TOPIC_COOLDOWN_DAYS = 2;
const DAILY_SPOTLIGHT_SUBJECT_COOLDOWN_DAYS = 12;

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

const loadStandings = async (tournamentId: string): Promise<TeamStandingSummary[]> => {
  const rows = await getTournamentRegularStandings(tournamentId, { limit: 12 });
  return rows.map((row) => ({
    teamId: row.teamId,
    name: row.name,
    pj: row.pj,
    pg: row.pg,
    pp: row.pp,
    winPct: row.winPct,
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

const getMatchMargin = (match: TournamentResultMatchOverview) =>
  hasScoredResult(match) ? Math.abs(match.teamAPoints - match.teamBPoints) : null;

const formatMatchScoreLine = (match: TournamentResultMatchOverview) => {
  if (hasScoredResult(match)) return `${match.teamAPoints} - ${match.teamBPoints}`;
  if (match.winnerTeam) return `Ganó ${match.winnerTeam}`;
  return "Pendiente";
};

const formatUpcomingMatchLabel = (match: UpcomingTournamentMatch) =>
  `${formatHomeDateTime(match.matchDate, match.matchTime)}`;

const CHALLENGE_STATUS_OPTIONS: Array<{
  value: TournamentChallengeStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "completed", label: "Cumplidos" },
  { value: "elite", label: "Elite" },
  { value: "failed", label: "Fallados" },
  { value: "not_evaluated", label: "N/J" },
];

const HOME_DAILY_CONTEXT_ENABLED = false;
const HOME_CHALLENGES_IN_HOME_ENABLED = false;

const challengeStatusLabel = (status: TournamentChallengeStatus) => {
  if (status === "completed") return "Cumplido";
  if (status === "elite") return "Elite";
  if (status === "failed") return "Fallado";
  if (status === "not_evaluated") return "N/J";
  return "Pendiente";
};

const challengeStatusBadgeVariant = (
  status: TournamentChallengeStatus
): "default" | "primary" | "success" | "warning" | "danger" => {
  if (status === "elite") return "success";
  if (status === "completed") return "primary";
  if (status === "failed") return "danger";
  if (status === "not_evaluated") return "warning";
  return "default";
};

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatChallengeMetricValue = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const withinNextDays = (dateValue: string | null, days: number) => {
  const parsed = parseIsoDateLocal(dateValue);
  if (!parsed) return false;

  const today = parseIsoDateLocal(getTodayIsoLocal());
  if (!today) return false;

  const diffMs = parsed.getTime() - today.getTime();
  const diffDays = diffMs / 86400000;
  return diffDays >= 0 && diffDays <= days;
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

  const sortedStandings = standings;
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

const buildDailySpotlightHistoryKey = (
  tournamentId: string,
  mode: "viewer" | "admin"
) => `${DAILY_SPOTLIGHT_HISTORY_PREFIX}:${mode}:${tournamentId}`;

const buildDailySpotlightPickKey = (
  tournamentId: string,
  mode: "viewer" | "admin",
  dateIso: string
) => `${DAILY_SPOTLIGHT_PICK_PREFIX}:${mode}:${tournamentId}:${dateIso}`;

const getIsoDayDiff = (fromIso: string, toIso: string): number | null => {
  const fromDate = parseIsoDateLocal(fromIso);
  const toDate = parseIsoDateLocal(toIso);
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
};

const getTopicKeyFromSubject = (subjectKey: string): string => {
  const [topicKey] = subjectKey.split("-");
  return topicKey && topicKey.trim().length > 0 ? topicKey : "general";
};

const appendSpotlightStatContext = (
  description: string,
  statLeftLabel: string,
  statLeftValue: string,
  statRightLabel: string,
  statRightValue: string
): string => {
  if (description.includes(statLeftLabel) || description.includes(statRightLabel)) {
    return description;
  }

  return `${description} ${statLeftLabel}: ${statLeftValue} · ${statRightLabel}: ${statRightValue}.`;
};

const SPOTLIGHT_FLAVOR_LINES: Record<DailyTournamentSpotlight["accent"], string[]> = {
  primary: [
    "Boletín del camerino: está metido en el guion del día.",
    "Sin vender humo: el rival debería ir calentando excusas.",
    "Reporte callejero: hoy toca respetar esa vibra.",
  ],
  success: [
    "Traducción rápida: si le das una rendija, te cobra con intereses.",
    "Dato no pedido: ese flow está llegando en premium.",
    "Parte oficial: hoy anda con permiso para hacer daño deportivo.",
  ],
  warning: [
    "Informe sin filtro: hoy toca resetear fundamentos con humildad.",
    "Diagnóstico de cancha: hay talento, pero la brújula está pidiendo batería.",
    "Mensaje con cariño: menos invento, más ejecución limpia.",
  ],
};

const appendSpotlightFlavorContext = (
  description: string,
  candidateId: string,
  accent: DailyTournamentSpotlight["accent"]
): string => {
  const options = SPOTLIGHT_FLAVOR_LINES[accent];
  if (!options || options.length === 0) return description;

  const pickIndex = hashString(`${candidateId}:flavor`) % options.length;
  return `${description} ${options[pickIndex]}`;
};

const readDailySpotlightHistory = (
  tournamentId: string,
  mode: "viewer" | "admin",
  todayIso: string
): DailySpotlightHistoryEntry[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(buildDailySpotlightHistoryKey(tournamentId, mode));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const data = entry as Partial<DailySpotlightHistoryEntry>;
        const dateIso = typeof data.dateIso === "string" ? data.dateIso : "";
        const subjectKey = typeof data.subjectKey === "string" ? data.subjectKey : "";
        const topicKey = typeof data.topicKey === "string" ? data.topicKey : getTopicKeyFromSubject(subjectKey);
        const candidateId = typeof data.candidateId === "string" ? data.candidateId : "";
        if (!toIsoDateParts(dateIso) || !subjectKey || !candidateId) return null;

        const daysAgo = getIsoDayDiff(dateIso, todayIso);
        if (daysAgo === null || daysAgo < 0 || daysAgo > DAILY_SPOTLIGHT_HISTORY_WINDOW_DAYS) return null;

        return {
          dateIso,
          subjectKey,
          topicKey,
          candidateId,
        };
      })
      .filter((entry): entry is DailySpotlightHistoryEntry => Boolean(entry))
      .sort((entryA, entryB) => entryB.dateIso.localeCompare(entryA.dateIso))
      .slice(0, DAILY_SPOTLIGHT_HISTORY_MAX_ENTRIES);
  } catch {
    return [];
  }
};

const saveDailySpotlightSelection = (
  tournamentId: string,
  mode: "viewer" | "admin",
  dateIso: string,
  spotlight: DailyTournamentSpotlight,
  historyEntries: DailySpotlightHistoryEntry[]
) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(buildDailySpotlightPickKey(tournamentId, mode, dateIso), spotlight.id);

    const nextHistory: DailySpotlightHistoryEntry[] = [
      {
        dateIso,
        subjectKey: spotlight.subjectKey,
        topicKey: spotlight.topicKey,
        candidateId: spotlight.id,
      },
      ...historyEntries.filter((entry) => entry.dateIso !== dateIso),
    ].slice(0, DAILY_SPOTLIGHT_HISTORY_MAX_ENTRIES);

    window.localStorage.setItem(
      buildDailySpotlightHistoryKey(tournamentId, mode),
      JSON.stringify(nextHistory)
    );
  } catch {
    // noop
  }
};

const readSavedDailySpotlightPick = (
  tournamentId: string,
  mode: "viewer" | "admin",
  dateIso: string
): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const pickId = window.localStorage.getItem(buildDailySpotlightPickKey(tournamentId, mode, dateIso));
    if (!pickId || pickId.trim().length === 0) return null;
    return pickId;
  } catch {
    return null;
  }
};

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
  base: Omit<DailyTournamentSpotlight, "id" | "title" | "description" | "subjectKey" | "topicKey">,
  variants: DailyTournamentSpotlightVariant[]
) => {
  const topicKey = getTopicKeyFromSubject(idPrefix);
  variants.forEach((variant) => {
    const resolvedAccent = variant.accent ?? base.accent;
    const candidateId = `${idPrefix}-${variant.idSuffix}`;
    const withStats = appendSpotlightStatContext(
      variant.description,
      base.statLeftLabel,
      base.statLeftValue,
      base.statRightLabel,
      base.statRightValue
    );

    candidates.push({
      ...base,
      id: candidateId,
      subjectKey: idPrefix,
      topicKey,
      title: variant.title,
      description: appendSpotlightFlavorContext(withStats, candidateId, resolvedAccent),
      badge: variant.badge ?? base.badge,
      accent: resolvedAccent,
    });
  });
};

const selectDailySpotlight = (
  candidates: DailyTournamentSpotlight[],
  seedSource: string,
  todayIso: string,
  historyEntries: DailySpotlightHistoryEntry[]
): DailyTournamentSpotlight | null => {
  if (candidates.length === 0) return null;

  const historyByTopic = new Map<string, DailySpotlightHistoryEntry[]>();
  const historyBySubject = new Map<string, DailySpotlightHistoryEntry[]>();
  const historyByCandidate = new Map<string, DailySpotlightHistoryEntry[]>();

  historyEntries.forEach((entry) => {
    const topicEntries = historyByTopic.get(entry.topicKey) ?? [];
    topicEntries.push(entry);
    historyByTopic.set(entry.topicKey, topicEntries);

    const subjectEntries = historyBySubject.get(entry.subjectKey) ?? [];
    subjectEntries.push(entry);
    historyBySubject.set(entry.subjectKey, subjectEntries);

    const candidateEntries = historyByCandidate.get(entry.candidateId) ?? [];
    candidateEntries.push(entry);
    historyByCandidate.set(entry.candidateId, candidateEntries);
  });

  const getDaysSince = (dateIso: string) => getIsoDayDiff(dateIso, todayIso);

  const isWithinCooldown = (dateIso: string, cooldownDays: number) => {
    const daysSince = getDaysSince(dateIso);
    return daysSince !== null && daysSince >= 0 && daysSince <= cooldownDays;
  };

  const pickFreshKey = (
    keys: string[],
    getEntries: (key: string) => DailySpotlightHistoryEntry[],
    namespace: string
  ): string | null => {
    if (keys.length === 0) return null;

    const ranked = [...keys].sort((keyA, keyB) => {
      const entriesA = getEntries(keyA);
      const entriesB = getEntries(keyB);
      const usesA = entriesA.length;
      const usesB = entriesB.length;

      if (usesA !== usesB) return usesA - usesB;

      const lastA = entriesA[0]?.dateIso ?? "0000-01-01";
      const lastB = entriesB[0]?.dateIso ?? "0000-01-01";
      if (lastA !== lastB) return lastA.localeCompare(lastB);

      const scoreA = hashString(`${seedSource}:${namespace}:${keyA}`);
      const scoreB = hashString(`${seedSource}:${namespace}:${keyB}`);
      return scoreA - scoreB;
    });

    return ranked[0] ?? null;
  };

  const topicKeys = Array.from(new Set(candidates.map((candidate) => candidate.topicKey)));
  const freshTopicKeys = topicKeys.filter((topicKey) =>
    !(historyByTopic.get(topicKey) ?? []).some((entry) =>
      isWithinCooldown(entry.dateIso, DAILY_SPOTLIGHT_TOPIC_COOLDOWN_DAYS)
    )
  );
  const chosenTopic = pickFreshKey(
    freshTopicKeys.length > 0 ? freshTopicKeys : topicKeys,
    (topicKey) => historyByTopic.get(topicKey) ?? [],
    "topic"
  );
  if (!chosenTopic) return null;

  const topicCandidates = candidates.filter((candidate) => candidate.topicKey === chosenTopic);
  const subjectKeys = Array.from(new Set(topicCandidates.map((candidate) => candidate.subjectKey)));
  const freshSubjectKeys = subjectKeys.filter((subjectKey) =>
    !(historyBySubject.get(subjectKey) ?? []).some((entry) =>
      isWithinCooldown(entry.dateIso, DAILY_SPOTLIGHT_SUBJECT_COOLDOWN_DAYS)
    )
  );
  const chosenSubject = pickFreshKey(
    freshSubjectKeys.length > 0 ? freshSubjectKeys : subjectKeys,
    (subjectKey) => historyBySubject.get(subjectKey) ?? [],
    "subject"
  );
  if (!chosenSubject) return null;

  const subjectCandidates = topicCandidates.filter((candidate) => candidate.subjectKey === chosenSubject);
  const freshCandidates = subjectCandidates.filter((candidate) =>
    !(historyByCandidate.get(candidate.id) ?? []).some((entry) =>
      isWithinCooldown(entry.dateIso, DAILY_SPOTLIGHT_SUBJECT_COOLDOWN_DAYS)
    )
  );

  const ranked = [...(freshCandidates.length > 0 ? freshCandidates : subjectCandidates)].sort(
    (candidateA, candidateB) => {
      const scoreA = hashString(`${seedSource}:variant:${candidateA.id}`);
      const scoreB = hashString(`${seedSource}:variant:${candidateB.id}`);
      return scoreA - scoreB;
    }
  );

  return ranked[0] ?? null;
};

const buildDailySpotlight = (
  insight: TournamentHomeInsight,
  mode: "viewer" | "admin",
  userSeed: string
): DailyTournamentSpotlight | null => {
  const candidates: DailyTournamentSpotlight[] = [];
  const todayIso = getTodayIsoLocal();
  const historyEntries = readDailySpotlightHistory(insight.tournamentId, mode, todayIso);
  const leader = insight.leader;
  const bestTeam = insight.bestTeam;
  const latestResult = insight.latestResult;
  const nextMatch = insight.nextMatch;
  const regularLines = insight.playerLines.filter((line) => line.gamesPlayed >= 2);
  const topScoringLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.ppg - lineA.perGame.ppg)
    .slice(0, 12);
  const topReboundLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.rpg - lineA.perGame.rpg)
    .slice(0, 10);
  const top3ptLines = regularLines
    .filter((line) => line.totals.tpa >= 8)
    .slice()
    .sort((lineA, lineB) => lineB.tpPct - lineA.tpPct)
    .slice(0, 8);
  const low3ptLines = regularLines
    .filter((line) => line.totals.tpa >= 8)
    .slice()
    .sort((lineA, lineB) => lineA.tpPct - lineB.tpPct)
    .slice(0, 8);
  const topFtLines = regularLines
    .filter((line) => line.totals.fta >= 8)
    .slice()
    .sort((lineA, lineB) => lineB.ftPct - lineA.ftPct)
    .slice(0, 8);
  const lowFtLines = regularLines
    .filter((line) => line.totals.fta >= 8)
    .slice()
    .sort((lineA, lineB) => lineA.ftPct - lineB.ftPct)
    .slice(0, 8);
  const topImpactLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.plusMinus - lineA.perGame.plusMinus)
    .slice(0, 8);
  const lowImpactLines = regularLines
    .slice()
    .sort((lineA, lineB) => lineA.perGame.plusMinus - lineB.perGame.plusMinus)
    .slice(0, 8);
  const breakoutPool = regularLines
    .slice()
    .sort((lineA, lineB) => lineB.valuationPerGame - lineA.valuationPerGame);
  const breakoutLines = (breakoutPool.slice(5, 20).length > 0 ? breakoutPool.slice(5, 20) : breakoutPool.slice(0, 12))
    .slice(0, 10);

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
    .slice(0, 10)
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
    .slice(0, 10)
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
    .slice(0, 10)
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
    .slice(0, 10)
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
    .slice(0, 10)
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
    .slice(0, 10)
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

  breakoutLines.forEach((line) => {
    pushDailySpotlightVariants(
      candidates,
      `breakout-${line.playerId}`,
      {
        badge: "Radar abierto",
        accent: "primary",
        photo: line.photo ?? null,
        photoAlt: line.name,
        statLeftLabel: "VAL/PJ",
        statLeftValue: line.valuationPerGame.toFixed(1),
        statRightLabel: "PPP",
        statRightValue: line.perGame.ppg.toFixed(1),
      },
      [
        {
          idSuffix: "subiendo",
          title: `${abbreviateLeaderboardName(line.name, 24)} viene subiendo`,
          description: `No siempre sale en titulares, pero su producción ya está pidiendo más foco.`,
        },
        {
          idSuffix: "consistencia",
          title: `${abbreviateLeaderboardName(line.name, 24)} está aportando constante`,
          description: `Su línea por juego se mantiene pareja y eso ayuda a sostener el rendimiento del equipo.`,
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

  const savedPickId = readSavedDailySpotlightPick(insight.tournamentId, mode, todayIso);
  if (savedPickId) {
    const savedCandidate = candidates.find((candidate) => candidate.id === savedPickId);
    if (savedCandidate) return savedCandidate;
  }

  return selectDailySpotlight(
    candidates,
    `${insight.tournamentId}:${mode}:${todayIso}:${userSeed}:${candidates.length}`,
    todayIso,
    historyEntries
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
  const [tournaments, setTournaments] = useState<TournamentHomeOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentIdState] = useState<string | null>(() =>
    loadViewerSelectedTournamentId()
  );
  const [refreshTick, setRefreshTick] = useState(0);

  const setSelectedTournamentId = (tournamentId: string) => {
    const normalized = tournamentId.trim();
    if (!normalized) return;
    setSelectedTournamentIdState(normalized);
    saveViewerSelectedTournamentId(normalized);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select("id, name")
          .order("created_at", { ascending: false })
          .limit(40);

        if (error) throw new Error(error.message);

        const availableTournaments = (data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name ?? "Torneo activo"),
        }));

        if (!cancelled) {
          setTournaments(availableTournaments);
        }

        const currentTournament =
          availableTournaments.find((row) => row.id === selectedTournamentId) ??
          availableTournaments[0];

        if (!currentTournament) {
          if (!cancelled) {
            setInsight(null);
            setSelectedTournamentIdState(null);
          }
          return;
        }

        const tournamentId = currentTournament.id;
        const tournamentName = currentTournament.name;

        if (selectedTournamentId !== tournamentId) {
          if (!cancelled) setSelectedTournamentIdState(tournamentId);
          saveViewerSelectedTournamentId(tournamentId);
        }

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
          loadStandings(tournamentId),
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

        if (!cancelled) {
          setInsight(nextInsight);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el home del torneo.");
          setInsight(null);
          setTournaments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, selectedTournamentId]);

  return {
    insight,
    loading,
    errorMessage,
    tournaments,
    selectedTournamentId,
    setSelectedTournamentId,
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
  const {
    insight,
    loading,
    errorMessage,
    tournaments,
    selectedTournamentId,
    setSelectedTournamentId,
    refresh,
  } = useTournamentHomeFeed();
  const [dailySpotlight, setDailySpotlight] = useState<DailyTournamentSpotlight | null>(null);
  const [dailySpotlightOpen, setDailySpotlightOpen] = useState(false);
  const [dailySpotlightUnread, setDailySpotlightUnread] = useState(false);
  const [challengeRows, setChallengeRows] = useState<TournamentPlayerChallenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengeErrorMessage, setChallengeErrorMessage] = useState<string | null>(null);
  const [selectedChallengePlayerId, setSelectedChallengePlayerId] = useState<number | null>(null);
  const [challengeSearch, setChallengeSearch] = useState("");
  const [challengeStatusFilter, setChallengeStatusFilter] = useState<TournamentChallengeStatus | "all">("all");
  const [regeneratingChallenges, setRegeneratingChallenges] = useState(false);

  useEffect(() => {
    if (!HOME_CHALLENGES_IN_HOME_ENABLED || !insight) {
      setChallengeRows([]);
      setSelectedChallengePlayerId(null);
      return;
    }

    const savedPlayerId = getViewerSelectedPlayerForTournament(insight.tournamentId);
    setSelectedChallengePlayerId(savedPlayerId);
  }, [insight]);

  useEffect(() => {
    if (!HOME_CHALLENGES_IN_HOME_ENABLED || !insight) return;

    let cancelled = false;

    const loadChallenges = async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) setChallengesLoading(true);

      try {
        const rows = await listTournamentChallenges(insight.tournamentId);
        if (cancelled) return;
        setChallengeRows(rows);
        setChallengeErrorMessage(null);
      } catch (error) {
        if (cancelled) return;
        setChallengeErrorMessage(
          error instanceof Error ? error.message : "No se pudieron cargar los retos del torneo."
        );
      } finally {
        if (!cancelled && !silent) setChallengesLoading(false);
      }
    };

    void loadChallenges();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadChallenges({ silent: true });
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [insight]);

  const challengeBoardRows = useMemo<ChallengeBoardRow[]>(
    () => buildChallengeBoardRows(challengeRows),
    [challengeRows]
  );
  const filteredChallengeBoardRows = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(challengeSearch);

    return challengeBoardRows.filter((row) => {
      if (
        challengeStatusFilter !== "all" &&
        row.challengeStatus !== challengeStatusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const byPlayer = normalizeSearchValue(row.playerName);
      const byTeam = normalizeSearchValue(row.teamName ?? "");
      return byPlayer.includes(normalizedSearch) || byTeam.includes(normalizedSearch);
    });
  }, [challengeBoardRows, challengeSearch, challengeStatusFilter]);

  const challengePlayerOptions = useMemo(
    () =>
      challengeBoardRows
        .slice()
        .sort((a, b) => a.playerName.localeCompare(b.playerName, "es", { sensitivity: "base" })),
    [challengeBoardRows]
  );

  useEffect(() => {
    if (!insight) return;
    if (challengePlayerOptions.length === 0) return;

    if (
      selectedChallengePlayerId &&
      challengePlayerOptions.some((row) => row.playerId === selectedChallengePlayerId)
    ) {
      return;
    }

    const firstPlayerId = challengePlayerOptions[0].playerId;
    setSelectedChallengePlayerId(firstPlayerId);
    saveViewerSelectedPlayerForTournament(insight.tournamentId, firstPlayerId);
  }, [insight, selectedChallengePlayerId, challengePlayerOptions]);

  const selectedPlayerChallenges = useMemo(() => {
    if (!selectedChallengePlayerId) return [] as TournamentPlayerChallenge[];
    return challengeRows
      .filter((row) => row.playerId === selectedChallengePlayerId)
      .sort((a, b) =>
        getScheduleSortKey(a.challengeDate, a.challengeTime, "asc").localeCompare(
          getScheduleSortKey(b.challengeDate, b.challengeTime, "asc")
        )
      );
  }, [challengeRows, selectedChallengePlayerId]);

  const selectedPlayerNextChallenge = useMemo(
    () => selectedPlayerChallenges.find((row) => row.status === "pending") ?? null,
    [selectedPlayerChallenges]
  );

  const selectedPlayerLatestSettledChallenge = useMemo(() => {
    const settled = selectedPlayerChallenges
      .filter((row) => row.settled)
      .sort((a, b) =>
        getScheduleSortKey(b.challengeDate, b.challengeTime, "desc").localeCompare(
          getScheduleSortKey(a.challengeDate, a.challengeTime, "desc")
        )
      );
    return settled[0] ?? null;
  }, [selectedPlayerChallenges]);

  const handleChangeSelectedChallengePlayer = (playerId: number) => {
    if (!insight) return;
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    setSelectedChallengePlayerId(playerId);
    saveViewerSelectedPlayerForTournament(insight.tournamentId, playerId);
  };

  const handleRegenerateChallenges = async () => {
    if (!insight || mode !== "admin") return;
    setRegeneratingChallenges(true);
    setChallengeErrorMessage(null);

    try {
      await regenerateTournamentChallenges(insight.tournamentId);
      const refreshed = await listTournamentChallenges(insight.tournamentId);
      setChallengeRows(refreshed);
    } catch (error) {
      setChallengeErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron regenerar los retos del torneo."
      );
    } finally {
      setRegeneratingChallenges(false);
    }
  };

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
    if (!HOME_DAILY_CONTEXT_ENABLED) {
      setDailySpotlight(null);
      setDailySpotlightOpen(false);
      setDailySpotlightUnread(false);
      return;
    }

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
      const historyEntries = readDailySpotlightHistory(insight.tournamentId, mode, todayIso);
      saveDailySpotlightSelection(insight.tournamentId, mode, todayIso, spotlight, historyEntries);

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
  const topScorers = insight.topScorers.slice(0, 6);
  const topTeams = insight.topTeams.slice(0, 6);
  const selectedChallengeBoardRow =
    challengeBoardRows.find((row) => row.playerId === selectedChallengePlayerId) ??
    null;
  const myChallengeEmpty =
    selectedPlayerNextChallenge === null &&
    selectedPlayerLatestSettledChallenge === null;
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
  const regularFunLines = insight.playerLines.filter((line) => line.gamesPlayed >= 2);
  const hotScorerLine = regularFunLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.ppg - lineA.perGame.ppg)[0] ?? null;
  const sniperLine = regularFunLines
    .filter((line) => line.totals.tpa >= 8)
    .slice()
    .sort((lineA, lineB) => lineB.tpPct - lineA.tpPct)[0] ?? null;
  const riskyHandleLine = regularFunLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.topg - lineA.perGame.topg)[0] ?? null;
  const coldShooterLine = regularFunLines
    .filter((line) => line.totals.fga >= 18)
    .slice()
    .sort((lineA, lineB) => lineA.fgPct - lineB.fgPct)[0] ?? null;
  const funCornerCards: Array<{
    id: string;
    badge: string;
    variant: "primary" | "success" | "warning" | "danger";
    title: string;
    description: string;
  }> = [
    hotScorerLine
      ? {
          id: "hot-hand",
          badge: "Microondas",
          variant: "success",
          title: `${abbreviateLeaderboardName(hotScorerLine.name, 24)} está cocinando sin receta`,
          description: `${hotScorerLine.perGame.ppg.toFixed(1)} PPP y la defensa rival pidiendo tiempo para respirar.`,
        }
      : {
          id: "hot-hand-fallback",
          badge: "Microondas",
          variant: "success",
          title: "El horno está precalentando",
          description: "Todavía faltan datos sólidos, pero se viene candela en la tabla.",
        },
    sniperLine
      ? {
          id: "sniper",
          badge: "Francotirador",
          variant: "primary",
          title: `${abbreviateLeaderboardName(sniperLine.name, 24)} está tirando con GPS`,
          description: `${sniperLine.tpPct.toFixed(1)}% en triples. Si lo dejan solo, después no aceptamos quejas.`,
        }
      : {
          id: "sniper-fallback",
          badge: "Francotirador",
          variant: "primary",
          title: "La mira de tres está en calentamiento",
          description: "Aún no hay volumen suficiente desde afuera para coronar un sniper oficial.",
        },
    riskyHandleLine
      ? {
          id: "risky-handle",
          badge: "Balón enjabonado",
          variant: "warning",
          title: `${abbreviateLeaderboardName(riskyHandleLine.name, 24)} anda dribleando con jabón`,
          description: `${riskyHandleLine.perGame.topg.toFixed(1)} pérdidas por juego. Hoy toca modo simple y sin novela.`,
        }
      : coldShooterLine
        ? {
            id: "cold-shooter",
            badge: "Aro tímido",
            variant: "danger",
            title: `${abbreviateLeaderboardName(coldShooterLine.name, 24)} está peleado con el aro`,
            description: `${coldShooterLine.fgPct.toFixed(1)}% de campo. Esto se arregla con calma y mejores tiros.`,
          }
        : {
            id: "risky-fallback",
            badge: "Sin multa",
            variant: "warning",
            title: "Hoy no hay multa por manejo de balón",
            description: "No salió un candidato claro para tirar pulla técnica por pérdidas.",
          },
  ];
  const foulTroubleLine = regularFunLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.fpg - lineA.perGame.fpg)[0] ?? null;
  const assistKingLine = regularFunLines
    .slice()
    .sort((lineA, lineB) => lineB.perGame.apg - lineA.perGame.apg)[0] ?? null;
  const silentMvpLine = regularFunLines
    .filter((line) => line.playerId !== hotScorerLine?.playerId)
    .slice()
    .sort((lineA, lineB) => lineB.valuationPerGame - lineA.valuationPerGame)[0] ?? null;
  const latestScoredResults = insight.latestResults.filter(hasScoredResult);
  const closeGameCount = latestScoredResults.filter((match) => {
    const margin = getMatchMargin(match);
    return margin !== null && margin <= 6;
  }).length;
  const blowoutCount = latestScoredResults.filter((match) => {
    const margin = getMatchMargin(match);
    return margin !== null && margin >= 15;
  }).length;
  const hypeScore = Math.max(
    35,
    Math.min(
      98,
      Math.round(
        44 +
          insight.todayPendingMatchesCount * 11 +
          insight.next7DaysPendingMatchesCount * 2.5 +
          closeGameCount * 8 -
          blowoutCount * 3 +
          (insight.statsCoveragePct >= 70 ? 7 : insight.statsCoveragePct >= 45 ? 2 : -5)
      )
    )
  );
  const hypeVariant: "success" | "primary" | "warning" =
    hypeScore >= 80 ? "success" : hypeScore >= 62 ? "primary" : "warning";
  const hypeLabel =
    hypeScore >= 88
      ? "Nivel candela"
      : hypeScore >= 74
        ? "Picante serio"
        : hypeScore >= 62
          ? "Encendiendo"
          : "Bajo observación";
  const standingsByName = new Map(
    insight.topTeams.map((team) => [team.name.toLowerCase(), team])
  );
  const matchupRadar = insight.upcomingMatches.slice(0, 5).map((match) => {
    const teamAStanding = standingsByName.get(match.teamA.toLowerCase()) ?? null;
    const teamBStanding = standingsByName.get(match.teamB.toLowerCase()) ?? null;
    const teamAWin = teamAStanding?.winPct ?? 0.5;
    const teamBWin = teamBStanding?.winPct ?? 0.5;
    const balanceScore = 1 - Math.min(1, Math.abs(teamAWin - teamBWin));
    const qualityScore = (teamAWin + teamBWin) / 2;
    const urgencyScore = match.matchDate === getTodayIsoLocal() ? 1 : withinNextDays(match.matchDate, 2) ? 0.8 : 0.5;
    const hype = Math.round(balanceScore * 46 + qualityScore * 36 + urgencyScore * 18);

    return {
      match,
      hype,
      teamARecord: teamAStanding ? `${teamAStanding.pg}-${teamAStanding.pp}` : "--",
      teamBRecord: teamBStanding ? `${teamBStanding.pg}-${teamBStanding.pp}` : "--",
      balanceScore,
    };
  });
  const featuredMatchup = matchupRadar
    .slice()
    .sort((entryA, entryB) => entryB.hype - entryA.hype)[0] ?? null;
  const lockerRoomAwards: Array<{
    id: string;
    badge: string;
    variant: "primary" | "success" | "warning" | "danger";
    title: string;
    description: string;
  }> = [
    hotScorerLine
      ? {
          id: "award-microondas",
          badge: "Premio microondas",
          variant: "success",
          title: abbreviateLeaderboardName(hotScorerLine.name, 24),
          description: `${hotScorerLine.perGame.ppg.toFixed(1)} PPP. El scouting rival está sudando.`,
        }
      : {
          id: "award-microondas-fallback",
          badge: "Premio microondas",
          variant: "success",
          title: "En búsqueda de artillero",
          description: "Aún no hay volumen suficiente para repartir este premio.",
        },
    assistKingLine
      ? {
          id: "award-cerebro",
          badge: "Premio cerebro",
          variant: "primary",
          title: abbreviateLeaderboardName(assistKingLine.name, 24),
          description: `${assistKingLine.perGame.apg.toFixed(1)} APP. Reparte más que grupo de Navidad.`,
        }
      : {
          id: "award-cerebro-fallback",
          badge: "Premio cerebro",
          variant: "primary",
          title: "Cerebro en construcción",
          description: "Todavía no hay líder de asistencias con muestra robusta.",
        },
    silentMvpLine
      ? {
          id: "award-silencioso",
          badge: "MVP silencioso",
          variant: "primary",
          title: abbreviateLeaderboardName(silentMvpLine.name, 24),
          description: `${silentMvpLine.valuationPerGame.toFixed(1)} VAL/PJ. Hace daño sin pedir cámara.`,
        }
      : {
          id: "award-silencioso-fallback",
          badge: "MVP silencioso",
          variant: "primary",
          title: "Radar esperando señal",
          description: "Sin datos suficientes para identificar MVP silencioso por ahora.",
        },
    riskyHandleLine || foulTroubleLine
      ? {
          id: "award-ajuste",
          badge: "Premio 'bájale dos'",
          variant: "warning",
          title: abbreviateLeaderboardName((riskyHandleLine ?? foulTroubleLine)?.name ?? "Jugador", 24),
          description: riskyHandleLine
            ? `${riskyHandleLine.perGame.topg.toFixed(1)} pérdidas por juego. Hoy toca jugar sobrio.`
            : `${(foulTroubleLine as PlayerStatsLine).perGame.fpg.toFixed(1)} faltas por juego. Defensa, sí; karate, no.`,
        }
      : {
          id: "award-ajuste-fallback",
          badge: "Premio 'bájale dos'",
          variant: "warning",
          title: "No hubo multa hoy",
          description: "La data no encontró un candidato claro para pulla técnica.",
        },
  ];
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

      {HOME_CHALLENGES_IN_HOME_ENABLED ? (
        <section className="grid gap-3 lg:grid-cols-[1.06fr_0.94fr]">
          <SectionCard
            title="Mi reto del próximo juego"
            description="Elige tu jugador y mira su reto oficial guardado en base de datos."
          >
            <div className="space-y-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                  Torneo activo
                </span>
                <AppSelect
                  value={selectedTournamentId ?? insight.tournamentId}
                  onChange={(event) => setSelectedTournamentId(event.target.value)}
                  className="input-base h-11"
                >
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </AppSelect>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                  Soy este jugador
                </span>
                <AppSelect
                  value={selectedChallengePlayerId ? String(selectedChallengePlayerId) : ""}
                  onChange={(event) =>
                    handleChangeSelectedChallengePlayer(Number(event.target.value))
                  }
                  className="input-base h-11"
                >
                  {challengePlayerOptions.length === 0 ? (
                    <option value="">Sin jugadores con retos</option>
                  ) : null}
                  {challengePlayerOptions.map((row) => (
                    <option key={row.playerId} value={row.playerId}>
                      {row.playerName}
                      {row.teamName ? ` · ${row.teamName}` : ""}
                    </option>
                  ))}
                </AppSelect>
              </label>

              {challengesLoading ? (
                <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  Cargando retos...
                </p>
              ) : challengeErrorMessage ? (
                <p className="rounded-[10px] border border-[hsl(var(--destructive)/0.34)] bg-[hsl(var(--destructive)/0.1)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                  {challengeErrorMessage}
                </p>
              ) : myChallengeEmpty ? (
                <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  Este jugador aún no tiene retos listos. Asegura participantes en `match_players`.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedPlayerNextChallenge ? (
                    <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="primary">Reto pendiente</Badge>
                        <p className="text-xs text-[hsl(var(--text-subtle))]">
                          {formatHomeDateTime(
                            selectedPlayerNextChallenge.challengeDate,
                            selectedPlayerNextChallenge.challengeTime
                          )}
                        </p>
                      </div>

                      <div className="mt-2 grid gap-2 grid-cols-1 sm:grid-cols-3">
                        {selectedPlayerNextChallenge.targets.map((target, index) => (
                          <article
                            key={`${selectedPlayerNextChallenge.id}-${target.metric}-${index}`}
                            className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.5)] px-2.5 py-2"
                          >
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                              {target.label}
                            </p>
                            <p className="text-sm font-semibold tabular-nums">
                              {target.op === "lte" ? "≤ " : "≥ "}
                              {formatChallengeMetricValue(target.target)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </article>
                  ) : null}

                  {selectedPlayerLatestSettledChallenge ? (
                    <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant={challengeStatusBadgeVariant(selectedPlayerLatestSettledChallenge.status)}
                        >
                          Último: {challengeStatusLabel(selectedPlayerLatestSettledChallenge.status)}
                        </Badge>
                        <p className="text-xs text-[hsl(var(--text-subtle))]">
                          Aciertos {selectedPlayerLatestSettledChallenge.successCount}/3
                        </p>
                      </div>
                      <div className="mt-2 grid gap-2 grid-cols-1 sm:grid-cols-3">
                        {selectedPlayerLatestSettledChallenge.targets.map((target, index) => (
                          <article
                            key={`${selectedPlayerLatestSettledChallenge.id}-${target.metric}-${index}`}
                            className={`rounded-[8px] border px-2.5 py-2 ${
                              target.hit === true
                                ? "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.11)]"
                                : target.hit === false
                                  ? "border-[hsl(var(--destructive)/0.34)] bg-[hsl(var(--destructive)/0.09)]"
                                  : "border-[hsl(var(--border))] bg-[hsl(var(--surface-2)/0.5)]"
                            }`}
                          >
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                              {target.label}
                            </p>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatChallengeMetricValue(target.actual)} / {formatChallengeMetricValue(target.target)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </article>
                  ) : null}
                </div>
              )}

              {selectedChallengeBoardRow ? (
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  Racha actual: <span className="font-semibold">{selectedChallengeBoardRow.streak}</span> · Tendencia:{" "}
                  <span className="font-semibold">
                    {selectedChallengeBoardRow.trend === "up"
                      ? "Subiendo"
                      : selectedChallengeBoardRow.trend === "down"
                        ? "Bajando"
                        : "Estable"}
                  </span>
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Tablero de retos"
            description="Vista inteligente de todos los jugadores del torneo activo."
            actions={
              mode === "admin" ? (
                <button
                  type="button"
                  className="btn-secondary min-h-[34px] px-2.5 py-1 text-xs"
                  onClick={handleRegenerateChallenges}
                  disabled={regeneratingChallenges}
                >
                  <ArrowPathIcon className={regeneratingChallenges ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {regeneratingChallenges ? "Regenerando..." : "Regenerar retos"}
                </button>
              ) : null
            }
          >
            <div className="space-y-2.5">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <label className="relative block">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-subtle))]" />
                  <input
                    value={challengeSearch}
                    onChange={(event) => setChallengeSearch(event.target.value)}
                    placeholder="Buscar jugador o equipo"
                    className="input-base h-10 pl-9"
                  />
                </label>
                <AppSelect
                  value={challengeStatusFilter}
                  onChange={(event) =>
                    setChallengeStatusFilter(
                      event.target.value as TournamentChallengeStatus | "all"
                    )
                  }
                  className="input-base h-10 sm:min-w-[170px]"
                >
                  {CHALLENGE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </div>

              {filteredChallengeBoardRows.length === 0 ? (
                <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  No hay jugadores que coincidan con esos filtros.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredChallengeBoardRows.slice(0, 16).map((row) => (
                    <article
                      key={row.playerId}
                      className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{row.playerName}</p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {row.teamName ?? "Sin equipo"} · {row.nextMatchLabel}
                          </p>
                        </div>
                        <Badge variant={challengeStatusBadgeVariant(row.challengeStatus)}>
                          {challengeStatusLabel(row.challengeStatus)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                        <span className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.5)] px-2 py-1 text-center tabular-nums">
                          {row.successCount}/3
                        </span>
                        <span className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.5)] px-2 py-1 text-center tabular-nums">
                          Racha {row.streak}
                        </span>
                        <span className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.5)] px-2 py-1 text-center">
                          {row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "→"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Showtime Control"
          description="Termómetro real del torneo y duelo recomendado para no parpadear."
        >
          <div className="space-y-3">
            <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                  Índice de candela
                </p>
                <Badge variant={hypeVariant}>{hypeLabel}</Badge>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-3xl font-black leading-none tabular-nums">{hypeScore}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Cierres cerrados: {closeGameCount} · Palizas recientes: {blowoutCount}
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full border bg-[hsl(var(--surface-2))]">
                <div
                  className={`h-full transition-all duration-700 ${
                    hypeVariant === "success"
                      ? "bg-[hsl(var(--success))]"
                      : hypeVariant === "primary"
                        ? "bg-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--warning))]"
                  }`}
                  style={{ width: `${hypeScore}%` }}
                />
              </div>
            </article>

            <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                Duelo recomendado
              </p>
              {featuredMatchup ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-sm font-bold">
                    {featuredMatchup.match.teamA} <span className="text-[hsl(var(--text-subtle))]">vs</span> {featuredMatchup.match.teamB}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {formatUpcomingMatchLabel(featuredMatchup.match)}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Récords: {featuredMatchup.match.teamA} ({featuredMatchup.teamARecord}) · {featuredMatchup.match.teamB} ({featuredMatchup.teamBRecord})
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="primary">Heat {featuredMatchup.hype}</Badge>
                    <Badge variant={featuredMatchup.balanceScore >= 0.8 ? "success" : featuredMatchup.balanceScore >= 0.6 ? "primary" : "warning"}>
                      {featuredMatchup.balanceScore >= 0.8
                        ? "Choque parejo"
                        : featuredMatchup.balanceScore >= 0.6
                          ? "Ventaja corta"
                          : "Duelo con favorito"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  Sin juegos pendientes para recomendar ahora mismo.
                </p>
              )}
            </article>
          </div>
        </SectionCard>

        <SectionCard
          title="Premios Del Camerino"
          description="Ranking con chercha sana: mérito real y pulla deportiva."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {lockerRoomAwards.map((award) => (
              <article key={award.id} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={award.variant}>{award.badge}</Badge>
                </div>
                <p className="mt-2 text-sm font-bold">{award.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{award.description}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Agenda semanal" description="Calendario y cierres clave en una sola vista.">
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
                      <p className="min-w-0 truncate font-semibold" title={player.name}>
                        #{index + 1} {abbreviateLeaderboardName(player.name, 18)}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold tabular-nums">{player.totalPoints} pts</span>
                      </div>
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
                      <p className="min-w-0 truncate font-semibold" title={team.name}>
                        #{index + 1} {abbreviateLeaderboardName(team.name, 18)}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {team.pg}-{team.pp}
                        </span>
                      </div>
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
        title="Zona de chercha"
        description="Bulla sana del día: jocosidad + datos reales, sin inventar cuentos."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {funCornerCards.map((card) => (
            <article key={card.id} className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={card.variant}>{card.badge}</Badge>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                  Sin filtro
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{card.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>

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

      <TournamentActivityTimeline
        tournamentId={insight.tournamentId}
        title="Últimos movimientos"
      />

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

      {HOME_DAILY_CONTEXT_ENABLED ? (
        <>
          <ModalShell
            isOpen={Boolean(dailySpotlightOpen && dailySpotlight)}
            onClose={handleCloseDailySpotlight}
            title="Nunaico del día"
            subtitle="Dosis de chercha deportiva para arrancar la jornada."
            maxWidthClassName="sm:max-w-xl"
            actions={
              <button type="button" className="btn-primary" onClick={handleCloseDailySpotlight}>
                Ta' claro
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
                    1 joyita por día
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
        </>
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
