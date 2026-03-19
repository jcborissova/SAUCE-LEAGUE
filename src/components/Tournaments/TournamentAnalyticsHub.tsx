import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getAnalyticsDashboardKpis,
  getBattleData,
  getFinalsMvpRace,
  getLeaders,
  getMvpRaceFast,
  getRaceSeries,
  getTournamentPlayerDetailFast,
  getTournamentPlayerLinesFast,
  listTournamentPlayers,
  clearTournamentAnalyticsCache,
} from "../../services/tournamentAnalytics";
import type {
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  MvpBreakdownRow,
  PlayerStatsLine,
  RaceSeriesPlayer,
  TournamentAnalyticsKpi,
  TournamentLeaderRow,
  TournamentPhaseFilter,
  TournamentStatMetric,
} from "../../types/tournament-analytics";
import AnalyticsDashboard from "./analytics/AnalyticsDashboard";
import AnalyticsFiltersBar from "./analytics/AnalyticsFiltersBar";
import BattlePanel from "./analytics/BattlePanel";
import FinalsMvpPanel from "./analytics/FinalsMvpPanel";
import LeadersPanel from "./analytics/LeadersPanel";
import MvpPanel from "./analytics/MvpPanel";
import PlayerAnalyticsModal, {
  type PlayerAnalyticsDetail,
} from "./analytics/PlayerAnalyticsModal";
import RacesPanel from "./analytics/RacesPanel";
import AppSelect from "../ui/AppSelect";
import { ANALYTICS_PANEL_OPTIONS, type AnalyticsPanelKey } from "./analytics/constants";

type BattleResult = { players: BattlePlayerResult[]; summary: BattleSummary };

type BattlePlayerOption = {
  playerId: number;
  name: string;
  photo: string | null;
  teamName: string | null;
};

type DashboardQuickLeadersGroup = {
  metric: string;
  rows: TournamentLeaderRow[];
};

type ChartTheme = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipText: string;
  seriesColors: string[];
};

const readHslVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : fallback;
};

const buildQuickLeaders = (rows: PlayerStatsLine[]): DashboardQuickLeadersGroup[] => {
  const metricConfig: Array<{
    label: string;
    metric: "points" | "assists" | "rebounds" | "steals" | "blocks" | "pra";
  }> = [
    { label: "Puntos", metric: "points" },
    { label: "Asistencias", metric: "assists" },
    { label: "Rebotes", metric: "rebounds" },
    { label: "Robos", metric: "steals" },
    { label: "Tapones", metric: "blocks" },
    { label: "PRA", metric: "pra" },
  ];

  return metricConfig.map((config) => {
    const values = rows
      .map((line) => ({
        ...line,
        value:
          config.metric === "pra"
            ? round2(line.perGame.ppg + line.perGame.rpg + line.perGame.apg - line.perGame.topg)
            : line.totals[config.metric],
        metric: config.metric,
      }))
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return b.gamesPlayed - a.gamesPlayed;
      })
      .slice(0, 10);

    return {
      metric: config.label,
      rows: values,
    };
  });
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const TournamentAnalyticsHub: React.FC<{ tournamentId: string; embedded?: boolean }> = ({
  tournamentId,
  embedded = false,
}) => {
  const [activePanel, setActivePanel] = useState<AnalyticsPanelKey>("dashboard");
  const [refreshTick, setRefreshTick] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [globalPhase, setGlobalPhase] = useState<TournamentPhaseFilter>("regular");

  const [leadersMetric, setLeadersMetric] = useState<TournamentStatMetric>("points");
  const [leadersPhase, setLeadersPhase] = useState<TournamentPhaseFilter>("regular");

  const [raceMetric, setRaceMetric] = useState<"points" | "rebounds" | "assists">("points");
  const [racePhase, setRacePhase] = useState<TournamentPhaseFilter>("regular");
  const [raceMode, setRaceMode] = useState<"cumulative" | "perGame">("cumulative");

  const [dashboardRaceMetric, setDashboardRaceMetric] = useState<"points" | "rebounds" | "assists">("points");
  const [dashboardRaceMode, setDashboardRaceMode] = useState<"cumulative" | "perGame">("cumulative");

  const [battlePhase, setBattlePhase] = useState<TournamentPhaseFilter>("regular");
  const [battleMetrics, setBattleMetrics] = useState<BattleMetric[]>([
    "ppg",
    "rpg",
    "apg",
    "spg",
    "bpg",
    "pra",
    "fg_pct",
    "topg",
  ]);
  const [battlePlayers, setBattlePlayers] = useState<BattlePlayerOption[]>([]);
  const [selectedBattlePlayers, setSelectedBattlePlayers] = useState<number[]>([]);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [racesLoading, setRacesLoading] = useState(false);
  const [mvpLoading, setMvpLoading] = useState(false);
  const [finalsMvpLoading, setFinalsMvpLoading] = useState(false);
  const [battleLoading, setBattleLoading] = useState(false);

  const [dashboardKpis, setDashboardKpis] = useState<TournamentAnalyticsKpi[]>([]);
  const [dashboardQuickLeaders, setDashboardQuickLeaders] = useState<DashboardQuickLeadersGroup[]>([]);
  const [dashboardRaceSeries, setDashboardRaceSeries] = useState<RaceSeriesPlayer[]>([]);

  const [leadersRows, setLeadersRows] = useState<TournamentLeaderRow[]>([]);
  const [racesRows, setRacesRows] = useState<RaceSeriesPlayer[]>([]);
  const [mvpRows, setMvpRows] = useState<MvpBreakdownRow[]>([]);
  const [finalsMvpRows, setFinalsMvpRows] = useState<MvpBreakdownRow[]>([]);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [playerDetailLoading, setPlayerDetailLoading] = useState(false);
  const [playerDetailError, setPlayerDetailError] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerAnalyticsDetail | null>(null);
  const [lastSelectedPlayer, setLastSelectedPlayer] = useState<{
    playerId: number;
    phase: TournamentPhaseFilter;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 639px)").matches;
  });

  const playerDetailCacheRef = useRef(new Map<string, PlayerAnalyticsDetail>());
  const playerDetailRequestRef = useRef(0);

  const [chartTheme, setChartTheme] = useState<ChartTheme>(() => ({
    axis: "hsl(215 20% 65%)",
    grid: "hsl(217 21% 22%)",
    tooltipBg: "hsl(224 14% 12%)",
    tooltipText: "hsl(210 40% 98%)",
    seriesColors: [
      "hsl(224 71% 47%)",
      "hsl(197 93% 45%)",
      "hsl(145 63% 42%)",
      "hsl(39 100% 52%)",
      "hsl(7 84% 57%)",
      "hsl(171 78% 39%)",
      "hsl(201 96% 44%)",
      "hsl(340 82% 52%)",
    ],
  }));

  useEffect(() => {
    const applyTheme = () => {
      setChartTheme({
        axis: readHslVar("--text-subtle", "hsl(215 20% 65%)"),
        grid: readHslVar("--border", "hsl(217 21% 22%)"),
        tooltipBg: readHslVar("--surface-1", "hsl(224 14% 12%)"),
        tooltipText: readHslVar("--text-strong", "hsl(210 40% 98%)"),
        seriesColors: [
          readHslVar("--chart-1", "hsl(224 71% 47%)"),
          readHslVar("--chart-2", "hsl(197 93% 45%)"),
          readHslVar("--chart-3", "hsl(145 63% 42%)"),
          readHslVar("--chart-4", "hsl(39 100% 52%)"),
          readHslVar("--chart-5", "hsl(7 84% 57%)"),
          readHslVar("--chart-6", "hsl(171 78% 39%)"),
          readHslVar("--chart-7", "hsl(201 96% 44%)"),
          readHslVar("--chart-8", "hsl(340 82% 52%)"),
        ],
      });
    };

    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 639px)");
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    playerDetailCacheRef.current.clear();
    setPlayerDetail(null);
    setPlayerDetailError(null);
    setPlayerDetailOpen(false);
    setLastSelectedPlayer(null);
  }, [tournamentId]);

  useEffect(() => {
    setLeadersPhase(globalPhase);
    setRacePhase(globalPhase);
    setBattlePhase(globalPhase);
  }, [globalPhase]);

  useEffect(() => {
    let cancelled = false;
    const loadKpis = async () => {
      try {
        const kpis = await getAnalyticsDashboardKpis(tournamentId);
        if (!cancelled) {
          setDashboardKpis(kpis);
        }
      } catch {
        if (!cancelled) {
          setDashboardKpis([]);
        }
      }
    };

    loadKpis();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, refreshTick]);

  useEffect(() => {
    if (activePanel !== "dashboard") return;

    let cancelled = false;
    const loadDashboard = async () => {
      setDashboardLoading(true);
      setErrorMessage(null);

      try {
        const [playerLines, spotlight] = await Promise.all([
          getTournamentPlayerLinesFast(tournamentId, globalPhase),
          getRaceSeries({
            tournamentId,
            phase: globalPhase,
            metric: dashboardRaceMetric,
            topN: 10,
          }),
        ]);

        if (cancelled) return;

        setDashboardQuickLeaders(buildQuickLeaders(playerLines));
        setDashboardRaceSeries(spotlight);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el dashboard de analíticas.");
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [
    activePanel,
    tournamentId,
    globalPhase,
    dashboardRaceMetric,
    isMobile,
    refreshTick,
  ]);

  useEffect(() => {
    if (activePanel !== "leaders") return;

    let cancelled = false;
    const loadLeaders = async () => {
      setLeadersLoading(true);
      setErrorMessage(null);

      try {
        const rows = await getLeaders({
          tournamentId,
          phase: leadersPhase,
          metric: leadersMetric,
          limit: 1000,
        });

        if (!cancelled) {
          setLeadersRows(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los líderes.");
        }
      } finally {
        if (!cancelled) {
          setLeadersLoading(false);
        }
      }
    };

    loadLeaders();

    return () => {
      cancelled = true;
    };
  }, [activePanel, tournamentId, leadersMetric, leadersPhase, refreshTick]);

  useEffect(() => {
    if (activePanel !== "races") return;

    let cancelled = false;
    const loadRaces = async () => {
      setRacesLoading(true);
      setErrorMessage(null);

      try {
        const rows = await getRaceSeries({
          tournamentId,
          phase: racePhase,
          metric: raceMetric,
          topN: 10,
        });

        if (!cancelled) {
          setRacesRows(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las carreras.");
        }
      } finally {
        if (!cancelled) {
          setRacesLoading(false);
        }
      }
    };

    loadRaces();

    return () => {
      cancelled = true;
    };
  }, [activePanel, tournamentId, raceMetric, racePhase, refreshTick]);

  useEffect(() => {
    if (activePanel !== "mvp") return;

    let cancelled = false;
    const loadMvp = async () => {
      setMvpLoading(true);
      setErrorMessage(null);

      try {
        const rows = await getMvpRaceFast({
          tournamentId,
          phase: "regular",
        });

        if (!cancelled) {
          setMvpRows(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el ranking MVP.");
        }
      } finally {
        if (!cancelled) {
          setMvpLoading(false);
        }
      }
    };

    loadMvp();

    return () => {
      cancelled = true;
    };
  }, [activePanel, tournamentId, refreshTick]);

  useEffect(() => {
    if (activePanel !== "finalsMvp") return;

    let cancelled = false;
    const loadFinalsMvp = async () => {
      setFinalsMvpLoading(true);
      setErrorMessage(null);

      try {
        const rows = await getFinalsMvpRace(tournamentId);

        if (!cancelled) {
          setFinalsMvpRows(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el Finals MVP.");
        }
      } finally {
        if (!cancelled) {
          setFinalsMvpLoading(false);
        }
      }
    };

    loadFinalsMvp();

    return () => {
      cancelled = true;
    };
  }, [activePanel, tournamentId, refreshTick]);

  useEffect(() => {
    if (activePanel !== "battle") return;

    let cancelled = false;
    const loadBattle = async () => {
      setBattleLoading(true);
      setErrorMessage(null);

      try {
        const options = await listTournamentPlayers(tournamentId, battlePhase);
        if (cancelled) return;

        setBattlePlayers(options);

        const availableIds = new Set(options.map((player) => player.playerId));
        let nextSelection = selectedBattlePlayers.filter((id) => availableIds.has(id));

        if (nextSelection.length > 2) {
          nextSelection = nextSelection.slice(0, 2);
        }

        if (nextSelection.length < 2 && options.length >= 2) {
          nextSelection = options.slice(0, 2).map((item) => item.playerId);
        }

        setSelectedBattlePlayers(nextSelection);

        if (nextSelection.length >= 2) {
          const data = await getBattleData({
            tournamentId,
            playerIds: nextSelection,
            metrics: battleMetrics,
            phase: battlePhase,
          });

          if (!cancelled) {
            setBattleResult(data);
          }
        } else {
          setBattleResult(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el módulo Battle.");
        }
      } finally {
        if (!cancelled) {
          setBattleLoading(false);
        }
      }
    };

    loadBattle();

    return () => {
      cancelled = true;
    };
  }, [activePanel, tournamentId, battlePhase, refreshTick]);

  const handleRefresh = () => {
    clearTournamentAnalyticsCache(tournamentId);
    playerDetailCacheRef.current.clear();
    setRefreshTick((value) => value + 1);
  };

  const handleCompareBattle = async () => {
    if (selectedBattlePlayers.length !== 2) {
      setErrorMessage("Selecciona exactamente 2 jugadores para comparar.");
      return;
    }

    setBattleLoading(true);
    setErrorMessage(null);

    try {
      const data = await getBattleData({
        tournamentId,
        playerIds: selectedBattlePlayers,
        metrics: battleMetrics,
        phase: battlePhase,
      });

      setBattleResult(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo calcular el Battle.");
    } finally {
      setBattleLoading(false);
    }
  };

  const openPlayerDetail = async (
    playerId: number,
    phase: TournamentPhaseFilter,
    options?: { forceRefresh?: boolean }
  ) => {
    const requestId = playerDetailRequestRef.current + 1;
    playerDetailRequestRef.current = requestId;

    setLastSelectedPlayer({ playerId, phase });
    setPlayerDetailOpen(true);
    setPlayerDetailError(null);
    setPlayerDetailLoading(true);

    const cacheKey = `${tournamentId}:${phase}:${playerId}`;
    const useCache = !options?.forceRefresh;

    if (useCache) {
      const cached = playerDetailCacheRef.current.get(cacheKey);
      if (cached) {
        setPlayerDetail(cached);
        setPlayerDetailLoading(false);
        return;
      }
    }

    try {
      const [playerDetailData, phaseLines] = await Promise.all([
        getTournamentPlayerDetailFast({
          tournamentId,
          playerId,
          phase,
          forceRefresh: Boolean(options?.forceRefresh),
        }),
        getTournamentPlayerLinesFast(tournamentId, phase),
      ]);
      const line = playerDetailData.line;

      const games = playerDetailData.games
        .map((item) => ({
          ...item,
          pra: round2(item.points + item.rebounds + item.assists - item.turnovers),
        }));

      let mvpRow: MvpBreakdownRow | null = null;
      if (phase !== "all") {
        try {
          const mvpRows = await getMvpRaceFast({
            tournamentId,
            phase,
          });
          mvpRow = mvpRows.find((row) => row.playerId === playerId) ?? null;
        } catch {
          mvpRow = null;
        }
      }

      const nextDetail: PlayerAnalyticsDetail = {
        phase,
        line,
        games,
        mvpRow,
        phaseLines,
      };

      playerDetailCacheRef.current.set(cacheKey, nextDetail);

      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(nextDetail);
    } catch (error) {
      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(null);
      setPlayerDetailError(
        error instanceof Error ? error.message : "No se pudo cargar el detalle del jugador."
      );
    } finally {
      if (playerDetailRequestRef.current === requestId) {
        setPlayerDetailLoading(false);
      }
    }
  };

  const handleRetryPlayerDetail = () => {
    if (!lastSelectedPlayer) return;
    void openPlayerDetail(lastSelectedPlayer.playerId, lastSelectedPlayer.phase, {
      forceRefresh: true,
    });
  };

  const activePanelLoading = useMemo(() => {
    if (activePanel === "dashboard") return dashboardLoading;
    if (activePanel === "leaders") return leadersLoading;
    if (activePanel === "races") return racesLoading;
    if (activePanel === "mvp") return mvpLoading;
    if (activePanel === "finalsMvp") return finalsMvpLoading;
    if (activePanel === "battle") return battleLoading;
    return false;
  }, [
    activePanel,
    dashboardLoading,
    leadersLoading,
    racesLoading,
    mvpLoading,
    finalsMvpLoading,
    battleLoading,
  ]);

  return (
    <section
      className={`max-w-7xl mx-auto space-y-5 ${
        embedded ? "px-1 sm:px-2 py-2 sm:py-3" : "px-2 sm:px-4 py-4 sm:py-6"
      }`}
    >
      {embedded ? (
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Dashboard avanzado para líderes, carreras, MVP y comparativas Battle.
        </p>
      ) : null}

      <div className={`sticky z-20 space-y-3 ${embedded ? "top-0" : "top-2"}`}>
        <AnalyticsFiltersBar
          phase={globalPhase}
          onPhaseChange={setGlobalPhase}
          onRefresh={handleRefresh}
          loading={activePanelLoading}
        />

        <div className="app-panel p-2 sm:p-3">
          <div className="sm:hidden px-1">
            <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
              <span className="font-semibold text-[hsl(var(--text-subtle))]">Módulo</span>
              <AppSelect
                value={activePanel}
                onChange={(event) => setActivePanel(event.target.value as AnalyticsPanelKey)}
                className="select-base"
              >
                {ANALYTICS_PANEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </AppSelect>
            </label>
          </div>

          <div className="hidden sm:flex gap-2 overflow-x-auto no-scrollbar">
            {ANALYTICS_PANEL_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = activePanel === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActivePanel(option.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold min-h-[44px] shrink-0 transition ${
                    active
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {errorMessage}
        </div>
      ) : null}

      {activePanel === "dashboard" ? (
        <AnalyticsDashboard
          loading={dashboardLoading}
          kpis={dashboardKpis}
          quickLeaders={dashboardQuickLeaders}
          spotlightSeries={dashboardRaceSeries}
          spotlightMetric={dashboardRaceMetric}
          spotlightMode={dashboardRaceMode}
          spotlightPhase={globalPhase}
          chartTheme={chartTheme}
          onSpotlightMetricChange={setDashboardRaceMetric}
          onSpotlightModeChange={setDashboardRaceMode}
          onOpenPanel={setActivePanel}
          onPlayerSelect={(playerId, phase) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      {activePanel === "leaders" ? (
        <LeadersPanel
          rows={leadersRows}
          metric={leadersMetric}
          phase={leadersPhase}
          loading={leadersLoading}
          onMetricChange={setLeadersMetric}
          onPhaseChange={setLeadersPhase}
          onPlayerSelect={(playerId, phase) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      {activePanel === "races" ? (
        <RacesPanel
          races={racesRows}
          metric={raceMetric}
          phase={racePhase}
          mode={raceMode}
          loading={racesLoading}
          isMobile={isMobile}
          chartTheme={chartTheme}
          onMetricChange={setRaceMetric}
          onPhaseChange={setRacePhase}
          onModeChange={setRaceMode}
          onPlayerSelect={(playerId, phase) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      {activePanel === "mvp" ? (
        <MvpPanel
          rows={mvpRows}
          loading={mvpLoading}
          title="MVP de Temporada"
          subtitle="Ranking oficial con fórmula inteligente: producción, impacto, eficiencia, disponibilidad y récord del equipo."
          phase="regular"
          onPlayerSelect={(playerId, phase) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      {activePanel === "finalsMvp" ? (
        <FinalsMvpPanel
          rows={finalsMvpRows}
          loading={finalsMvpLoading}
          onPlayerSelect={(playerId, phase) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      {activePanel === "battle" ? (
        <BattlePanel
          phase={battlePhase}
          loading={battleLoading}
          isMobile={isMobile}
          players={battlePlayers}
          selectedPlayerIds={selectedBattlePlayers}
          selectedMetrics={battleMetrics}
          result={battleResult}
          chartTheme={chartTheme}
          onPhaseChange={setBattlePhase}
          onSelectedPlayersChange={(playerIds) => setSelectedBattlePlayers(playerIds.slice(0, 2))}
          onSelectedMetricsChange={setBattleMetrics}
          onCompare={handleCompareBattle}
        />
      ) : null}

      <PlayerAnalyticsModal
        isOpen={playerDetailOpen}
        loading={playerDetailLoading}
        errorMessage={playerDetailError}
        detail={playerDetail}
        onClose={() => setPlayerDetailOpen(false)}
        onRetry={handleRetryPlayerDetail}
      />
    </section>
  );
};

export default TournamentAnalyticsHub;
