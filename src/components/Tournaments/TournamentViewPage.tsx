import React, { useEffect, useMemo, useState } from "react";
import type { Player } from "../../types/player";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
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
  toggleViewerTeamFollow,
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

const MAIN_TABS: Array<{ key: TournamentViewMainTab; label: string }> = [
  { key: "matches", label: "Partidos" },
  { key: "standings", label: "Posiciones" },
  { key: "stats", label: "Estadísticas" },
  { key: "players", label: "Equipos" },
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
  const [teamOptions, setTeamOptions] = useState<string[]>([]);

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

    setActiveTab(parsed.tab);
    setMatchesSubtab(parsed.matchesTab);
    setStatsSubtab(parsed.statsTab);

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
    if (!tournamentId || !hasValidTournamentId || tournamentFound !== true) return;

    let cancelled = false;

    const loadTeamOptions = async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("name")
        .eq("tournament_id", tournamentId)
        .order("name", { ascending: true });

      if (cancelled) return;
      if (error || !data) {
        setTeamOptions([]);
        return;
      }

      setTeamOptions(
        Array.from(
          new Set(
            data
              .map((row) => String(row.name ?? "").trim())
              .filter((name) => name.length > 0)
          )
        )
      );
    };

    loadTeamOptions();

    return () => {
      cancelled = true;
    };
  }, [hasValidTournamentId, tournamentFound, tournamentId]);

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

  const toggleTeamFollow = (teamName: string) => {
    setViewerFollows((prev) => {
      const next = toggleViewerTeamFollow(prev, teamName);
      saveViewerFollows(next);
      return next;
    });
  };

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
        <div className="overflow-hidden border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))] shadow-[0_1px_0_hsl(var(--border)/0.35)]">
          <div className="h-0.5 bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--chart-2)))]" />
          <div className="border-b bg-[hsl(var(--surface-1))]">
            <div className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--text-subtle))]">
                  Torneo
                </p>
                <h1 className="truncate text-2xl font-bold sm:text-3xl">
                  {tournamentLoading ? "Cargando torneo..." : tournamentName}
                </h1>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={handleShareView}
                  className="btn-secondary min-h-[42px] w-full sm:w-auto"
                >
                  <ArrowUpOnSquareIcon className="h-4 w-4" />
                  Compartir vista
                </button>
                <button
                  type="button"
                  onClick={() => setRulesOpen(true)}
                  className="btn-secondary min-h-[42px] w-full sm:w-auto"
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  Reglamento
                </button>
                <Link
                  to="/tournaments"
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[6px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))] sm:w-auto"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Volver
                </Link>
              </div>
            </div>
          </div>

          {teamOptions.length > 0 ? (
            <div className="border-t border-[hsl(var(--border)/0.82)] px-3 py-2 sm:px-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
                Seguir equipos
              </p>
              <div className="soft-scrollbar flex gap-2 overflow-x-auto pb-1">
                {teamOptions.map((teamName) => {
                  const following = viewerFollows.teams.includes(teamName);
                  return (
                    <button
                      key={teamName}
                      type="button"
                      onClick={() => toggleTeamFollow(teamName)}
                      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        following
                          ? "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))]"
                      }`}
                    >
                      {following ? "Siguiendo" : "Seguir"} · {teamName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <nav
            className="grid w-full grid-cols-4 border-t border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))]"
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
