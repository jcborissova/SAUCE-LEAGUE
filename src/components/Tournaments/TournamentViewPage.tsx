import React, { useEffect, useMemo, useState } from "react";
import type { Player } from "../../types/player";
import {
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  SparklesIcon,
  TrophyIcon,
} from "@heroicons/react/24/solid";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpOnSquareIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import TournamentScheduleView from "./TournamentScheduleView";
import TournamentStandings from "./TournamentStandings";
import TournamentResultsView from "./TournamentResultsView";
import TournamentPlayoffOverview from "./TournamentPlayoffOverview";
import TournamentPlayersGallery from "./TournamentPlayersGallery";
import TournamentStatsOverview from "./TournamentStatsOverview";
import TournamentActivityTimeline from "./TournamentActivityTimeline";

import SegmentedControl from "../ui/SegmentedControl";
import EmptyState from "../ui/EmptyState";
import ModalShell from "../ui/ModalShell";
import {
  TOURNAMENT_RULES_PDF_URL,
  TOURNAMENT_RULES_TITLE,
} from "../../constants/tournamentRules";
import { getTournamentSettings } from "../../services/tournamentAnalytics";
import { fetchTournamentTeamsRoster } from "../../services/tournamentTeams";
import { supabase } from "../../lib/supabase";
import type {
  ViewerFollowState,
  ViewerMatchFilters,
} from "../../types/tournament-analytics";
import type { ViewerResultsFilters } from "../../utils/viewer-preferences";
import {
  getViewerMatchFiltersForTournament,
  loadViewerFollows,
  saveViewerFollows,
  saveViewerMatchFiltersForTournament,
  toggleViewerPlayerFollow,
} from "../../utils/viewer-preferences";
import {
  parseTournamentViewQuery,
  serializeTournamentViewQuery,
  type TournamentViewMainTab,
  type TournamentViewMatchesTab,
  type TournamentViewStatsTab,
} from "../../utils/tournament-view-query";

type Team = {
  id: number;
  name: string;
  players: Player[];
};

const MAIN_TABS: Array<{ key: TournamentViewMainTab; label: string; helper: string }> = [
  { key: "matches", label: "Partidos", helper: "Calendario y resultados del torneo completo." },
  { key: "standings", label: "Posiciones", helper: "La fase regular define la siembra oficial." },
  { key: "stats", label: "Estadísticas", helper: "Analíticas por fase y lectura de cruces." },
  { key: "players", label: "Equipos", helper: "Plantillas y seguimiento de jugadores del torneo." },
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TournamentViewPage: React.FC = () => {
  const { id: tournamentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const hasValidTournamentId = Boolean(
    tournamentId && UUID_PATTERN.test(tournamentId)
  );

  const [activeTab, setActiveTab] = useState<TournamentViewMainTab>("matches");
  const [matchesSubtab, setMatchesSubtab] =
    useState<TournamentViewMatchesTab>("schedule");
  const [statsSubtab, setStatsSubtab] =
    useState<TournamentViewStatsTab>("analytics");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<number | null>(null);

  const [scheduleFilters, setScheduleFilters] = useState<ViewerMatchFilters>({
    team: null,
    status: "all",
    window: "all",
  });
  const [resultsFilters, setResultsFilters] = useState<ViewerResultsFilters>({
    team: null,
    status: "all",
    window: "all",
    date: null,
    hasScore: "all",
  });

  const [viewerFollows, setViewerFollows] = useState<ViewerFollowState>({
    teams: [],
    players: [],
  });

  const [tournamentName, setTournamentName] = useState("Sauce League");
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [tournamentFound, setTournamentFound] = useState<boolean | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamsReloadToken, setTeamsReloadToken] = useState(0);
  const [rulesPdfUrl, setRulesPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    setViewerFollows(loadViewerFollows());
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    const persistedFilters = getViewerMatchFiltersForTournament(tournamentId);
    setScheduleFilters(persistedFilters.schedule);
    setResultsFilters(persistedFilters.results);
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    saveViewerMatchFiltersForTournament(tournamentId, {
      schedule: scheduleFilters,
      results: resultsFilters,
    });
  }, [tournamentId, scheduleFilters, resultsFilters]);

  useEffect(() => {
    const parsed = parseTournamentViewQuery(location.search);
    const params = new URLSearchParams(location.search);
    const legacyChallengesTab = params.get("tab") === "challenges";

    setActiveTab(legacyChallengesTab ? "stats" : parsed.tab);
    setMatchesSubtab(parsed.matchesTab);
    setStatsSubtab(
      legacyChallengesTab && !params.has("statsTab")
        ? "analytics"
        : parsed.statsTab
    );

    if (params.has("matchId")) {
      const parsedMatchId = Number(params.get("matchId"));
      if (Number.isFinite(parsedMatchId) && parsedMatchId > 0) {
        setOpenMatchId(Math.floor(parsedMatchId));
        setActiveTab("matches");
        setMatchesSubtab("results");
      }
    }

    if (params.has("team") || params.has("status")) {
      setScheduleFilters((prev) => ({
        ...prev,
        team: params.has("team") ? parsed.team : prev.team,
        status: params.has("status") ? parsed.status : prev.status,
      }));

      setResultsFilters((prev) => ({
        ...prev,
        team: params.has("team") ? parsed.team : prev.team,
        status: params.has("status") ? parsed.status : prev.status,
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const query = serializeTournamentViewQuery({
      tab: activeTab,
      matchesTab: matchesSubtab,
      statsTab: statsSubtab,
      team:
        activeTab === "matches"
          ? matchesSubtab === "schedule"
            ? scheduleFilters.team
            : resultsFilters.team
          : null,
      status:
        activeTab === "matches"
          ? matchesSubtab === "schedule"
            ? scheduleFilters.status
            : resultsFilters.status
          : "all",
      matchId:
        activeTab === "matches" && matchesSubtab === "results"
          ? openMatchId
          : null,
    });

    if (query === location.search) return;

    navigate(
      {
        pathname: location.pathname,
        search: query,
      },
      { replace: true }
    );
  }, [
    activeTab,
    matchesSubtab,
    statsSubtab,
    scheduleFilters.team,
    scheduleFilters.status,
    resultsFilters.team,
    resultsFilters.status,
    openMatchId,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!hasValidTournamentId || !tournamentId) {
      setTournamentLoading(false);
      setTournamentFound(false);
      setTournamentName("Sauce League");
      return;
    }

    let cancelled = false;

    const loadTournament = async () => {
      setTournamentLoading(true);
      setTournamentFound(null);

      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select("id, name")
          .eq("id", tournamentId)
          .maybeSingle();

        if (cancelled) return;
        if (!error && data?.id) {
          setTournamentName(data.name || "Sauce League");
          setTournamentFound(true);
        } else {
          setTournamentName("Sauce League");
          setTournamentFound(false);
        }
      } catch {
        if (cancelled) return;
        setTournamentName("Sauce League");
        setTournamentFound(false);
      } finally {
        if (!cancelled) setTournamentLoading(false);
      }
    };

    loadTournament();

    return () => {
      cancelled = true;
    };
  }, [hasValidTournamentId, tournamentId]);

  useEffect(() => {
    setTeams([]);
    setTeamsLoaded(false);
    setTeamsLoading(false);
    setTeamsError(null);
    setTeamsReloadToken(0);
  }, [tournamentId]);

  useEffect(() => {
    if (
      !tournamentId ||
      !hasValidTournamentId ||
      tournamentFound !== true ||
      activeTab !== "players" ||
      teamsLoaded
    )
      return;
    let cancelled = false;

    const fetchTeamsAndPlayers = async () => {
      setTeamsLoading(true);
      setTeamsError(null);
      try {
        const roster = await fetchTournamentTeamsRoster(tournamentId);
        if (cancelled) return;

        setTeams(roster);
        setTeamsLoaded(true);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar equipos y jugadores.";
        console.error("Error al cargar jugadores del torneo", error);
        toast.error(message);
        setTeams([]);
        setTeamsLoaded(false);
        setTeamsError(message);
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    };

    fetchTeamsAndPlayers();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    hasValidTournamentId,
    teamsLoaded,
    tournamentFound,
    tournamentId,
    teamsReloadToken,
  ]);

  useEffect(() => {
    if (!tournamentId || !hasValidTournamentId || tournamentFound !== true) return;
    let cancelled = false;

    const loadRules = async () => {
      try {
        const settings = await getTournamentSettings(tournamentId);
        if (!cancelled) setRulesPdfUrl(settings.rulesPdfUrl);
      } catch {
        if (!cancelled) setRulesPdfUrl(null);
      }
    };

    loadRules();

    return () => {
      cancelled = true;
    };
  }, [hasValidTournamentId, tournamentFound, tournamentId]);

  const totalPlayers = useMemo(
    () => teams.reduce((acc, team) => acc + team.players.length, 0),
    [teams]
  );
  const resolvedRulesPdfUrl = rulesPdfUrl || TOURNAMENT_RULES_PDF_URL;
  const activeMainTabMeta = useMemo(
    () => MAIN_TABS.find((tab) => tab.key === activeTab) ?? MAIN_TABS[0],
    [activeTab]
  );
  const competitionFocus = useMemo<"regular" | "playoffs" | "neutral">(() => {
    if (activeTab === "standings") return "regular";
    if (activeTab === "stats" && statsSubtab === "analytics") return "regular";
    if (activeTab === "stats" && statsSubtab === "playoffs") return "playoffs";
    return "neutral";
  }, [activeTab, statsSubtab]);
  const focusPillClassName =
    competitionFocus === "regular"
      ? "border-[#38bdf8]/28 bg-[#0ea5e9]/10 text-[#0369a1] dark:text-[#7dd3fc]"
      : competitionFocus === "playoffs"
        ? "border-[#f59e0b]/28 bg-[#f59e0b]/12 text-[#b45309] dark:text-[#fcd34d]"
        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]";

  const togglePlayerFollow = (playerId: number) => {
    setViewerFollows((prev) => {
      const next = toggleViewerPlayerFollow(prev, playerId);
      saveViewerFollows(next);
      return next;
    });
  };

  const handleShareView = async () => {
    const url = window.location.href;
    const title = `${tournamentName} · Sauce League`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado al portapapeles.");
    } catch {
      toast.error("No se pudo compartir esta vista.");
    }
  };

  if (!tournamentId || !hasValidTournamentId) {
    return <Navigate to="/404" replace />;
  }

  if (tournamentFound === false) {
    return <Navigate to="/404" replace />;
  }

  if (tournamentLoading || tournamentFound === null) {
    return (
      <div className="w-full py-12 flex items-center justify-center">
        <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <header className="w-full">
        <div className="overflow-hidden rounded-[16px] border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))] shadow-[0_1px_0_hsl(var(--border)/0.35)]">
          <div className="h-0.5 bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--chart-2)))]" />
          <div className="relative overflow-hidden border-b bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2)/0.55)_100%)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%)]" />
            <div className="relative px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
              <div className="flex w-full flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--text-subtle))]">
                      Torneo
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${focusPillClassName}`}
                    >
                      {competitionFocus === "regular"
                        ? "Temporada regular"
                        : competitionFocus === "playoffs"
                          ? "Playoffs"
                          : activeMainTabMeta.label}
                    </span>
                  </div>
                  <h1 className="mt-1 truncate text-2xl font-bold sm:text-3xl">
                    {tournamentLoading ? "Cargando torneo..." : tournamentName}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
                    {activeMainTabMeta.helper}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleShareView}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1)/0.94)] text-[hsl(var(--foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-1))] sm:h-[40px] sm:w-auto sm:px-3"
                    title="Compartir vista"
                    aria-label="Compartir vista"
                  >
                    <ArrowUpOnSquareIcon className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm sm:font-semibold">
                      Compartir
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1)/0.94)] text-[hsl(var(--foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-1))] sm:h-[40px] sm:w-auto sm:px-3"
                    title="Reglamento"
                    aria-label="Abrir reglamento"
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm sm:font-semibold">
                      Reglas
                    </span>
                  </button>
                  <Link
                    to="/tournaments"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1)/0.94)] text-[hsl(var(--foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-1))] sm:h-[40px] sm:w-auto sm:px-3"
                    title="Volver a torneos"
                    aria-label="Volver a torneos"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm sm:font-semibold">
                      Volver
                    </span>
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-[14px] border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-1)/0.88)] px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--surface-1)/0.7)]">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">
                    <SparklesIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                    Lectura del torneo
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    La experiencia ahora distingue mejor entre la carrera de la
                    <span className="font-semibold text-[hsl(var(--foreground))]"> temporada regular</span>,
                    donde se define la siembra, y la tensión de los
                    <span className="font-semibold text-[hsl(var(--foreground))]"> playoffs</span>,
                    donde cada serie empuja el cierre del torneo.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div
                    className={`rounded-[14px] border px-3.5 py-3 shadow-[0_8px_24px_-20px_rgba(14,165,233,0.45)] transition-colors ${
                      competitionFocus === "regular"
                        ? "border-[#38bdf8]/32 bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(14,165,233,0.04))]"
                        : "border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-1)/0.82)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#38bdf8]/28 bg-[#0ea5e9]/12 text-[#0284c7] dark:text-[#7dd3fc]">
                        <ChartBarIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">Regular Season</p>
                        <p className="text-[11px] text-[hsl(var(--text-subtle))]">Tabla y siembra</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                      Posiciones, consistencia y analíticas que ordenan el camino al Top 4.
                    </p>
                  </div>

                  <div
                    className={`rounded-[14px] border px-3.5 py-3 shadow-[0_8px_24px_-20px_rgba(245,158,11,0.45)] transition-colors ${
                      competitionFocus === "playoffs"
                        ? "border-[#f59e0b]/34 bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(251,191,36,0.05))]"
                        : "border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-1)/0.82)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#f59e0b]/30 bg-[#f59e0b]/12 text-[#d97706] dark:text-[#fcd34d]">
                        <TrophyIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">Playoffs</p>
                        <p className="text-[11px] text-[hsl(var(--text-subtle))]">Cruces y definición</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                      Series, avance por rondas y cierre del torneo con lectura de bracket.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <nav
            className="grid w-full border-t border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))]"
            style={{ gridTemplateColumns: `repeat(${MAIN_TABS.length}, minmax(0, 1fr))` }}
            aria-label="Secciones de torneo"
          >
            {MAIN_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative min-h-[48px] px-2 text-[13px] font-semibold transition-colors duration-[var(--motion-tab)] sm:text-sm ${
                    active
                      ? "text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--surface-2)/0.6)] hover:text-[hsl(var(--foreground))]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={`pointer-events-none absolute inset-x-2 bottom-0 h-0.5 transition-colors duration-[var(--motion-tab)] ${
                      active ? "bg-[hsl(var(--primary))]" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <section className="w-full space-y-4 pb-2">
        {activeTab === "matches" ? (
          <div className="space-y-3">
            <SegmentedControl
              options={[
                { value: "schedule", label: "Calendario" },
                { value: "results", label: "Resultados" },
              ]}
              value={matchesSubtab}
              onChange={(value) => setMatchesSubtab(value as TournamentViewMatchesTab)}
            />
            {matchesSubtab === "schedule" ? (
              <TournamentScheduleView
                tournamentId={tournamentId}
                embedded
                initialFilters={scheduleFilters}
                onFiltersChange={setScheduleFilters}
              />
            ) : (
              <TournamentResultsView
                tournamentId={tournamentId}
                embedded
                initialFilters={resultsFilters}
                onFiltersChange={setResultsFilters}
                initialMatchId={openMatchId}
                onMatchOpenChange={setOpenMatchId}
              />
            )}
          </div>
        ) : null}

        {activeTab === "standings" ? (
          <TournamentStandings tournamentId={tournamentId} embedded />
        ) : null}

        {activeTab === "stats" ? (
          <div className="space-y-3">
            <div className="rounded-[14px] border border-[hsl(var(--border)/0.78)] bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2)/0.44)_100%)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">
                    Enfoque de lectura
                  </p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Alterna entre regular season, playoffs y duelo directo sin perder contexto visual.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                      statsSubtab === "analytics"
                        ? "border-[#38bdf8]/28 bg-[#0ea5e9]/10 text-[#0369a1] dark:text-[#7dd3fc]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]"
                    }`}
                  >
                    <ChartBarIcon className="h-3.5 w-3.5" />
                    Regular
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                      statsSubtab === "playoffs"
                        ? "border-[#f59e0b]/28 bg-[#f59e0b]/12 text-[#b45309] dark:text-[#fcd34d]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]"
                    }`}
                  >
                    <TrophyIcon className="h-3.5 w-3.5" />
                    Playoffs
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                      statsSubtab === "duel"
                        ? "border-[#fb7185]/28 bg-[#fb7185]/10 text-[#be123c] dark:text-[#fda4af]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]"
                    }`}
                  >
                    <BoltIcon className="h-3.5 w-3.5" />
                    Duelo
                  </span>
                </div>
              </div>
            </div>
            <SegmentedControl
              options={[
                { value: "analytics", label: "Analíticas" },
                { value: "playoffs", label: "Playoffs" },
                { value: "duel", label: "Duelo" },
              ]}
              value={statsSubtab}
              onChange={(value) => setStatsSubtab(value as TournamentViewStatsTab)}
            />

            {statsSubtab === "analytics" ? (
              <TournamentStatsOverview tournamentId={tournamentId} embedded />
            ) : null}
            {statsSubtab === "playoffs" ? (
              <TournamentPlayoffOverview tournamentId={tournamentId} embedded />
            ) : null}
            {statsSubtab === "duel" ? (
              <TournamentStatsOverview tournamentId={tournamentId} embedded mode="duel" />
            ) : null}
          </div>
        ) : null}

        {activeTab === "players" ? (
          <div className="space-y-3">
            {teamsLoading && !teamsLoaded ? (
              <div className="flex justify-center py-24">
                <ArrowPathIcon className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
              </div>
            ) : teamsError ? (
              <EmptyState
                title="No se pudieron cargar los equipos"
                description={teamsError}
                action={
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setTeams([]);
                      setTeamsLoaded(false);
                      setTeamsError(null);
                      setTeamsReloadToken((value) => value + 1);
                    }}
                  >
                    Reintentar
                  </button>
                }
              />
            ) : (
              <TournamentPlayersGallery
                tournamentId={tournamentId}
                teams={teams}
                loading={teamsLoading}
                followedPlayerIds={viewerFollows.players}
                onToggleFollowPlayer={togglePlayerFollow}
              />
            )}

            {teamsLoaded ? (
              <p className="text-xs text-[hsl(var(--text-subtle))]">
                {teams.length} equipos vinculados, {totalPlayers} jugadores detectados.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <TournamentActivityTimeline tournamentId={tournamentId} />

      <ModalShell
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={TOURNAMENT_RULES_TITLE}
        subtitle="Consulta las reglas oficiales del torneo."
        maxWidthClassName="sm:max-w-5xl"
        actions={
          <>
            <a
              href={resolvedRulesPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              Abrir en pestaña
            </a>
            <a href={resolvedRulesPdfUrl} download className="btn-secondary">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Descargar
            </a>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setRulesOpen(false)}
            >
              Cerrar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[8px] border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-2))]">
            <iframe
              src={`${resolvedRulesPdfUrl}#toolbar=0`}
              title={TOURNAMENT_RULES_TITLE}
              className="h-[68vh] w-full"
            />
          </div>
          <p className="text-xs text-[hsl(var(--text-subtle))]">
            Si tu navegador bloquea la vista embebida, usa "Abrir en pestaña" o
            "Descargar".
          </p>
        </div>
      </ModalShell>
    </div>
  );
};

export default TournamentViewPage;
