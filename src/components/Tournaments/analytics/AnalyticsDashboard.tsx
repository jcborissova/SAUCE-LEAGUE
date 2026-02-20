import React from "react";
import {
  ChartBarIcon,
  ScaleIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  RaceSeriesPlayer,
  TournamentAnalyticsKpi,
  TournamentLeaderRow,
  TournamentPhaseFilter,
} from "../../../types/tournament-analytics";
import type { AnalyticsPanelKey } from "./constants";
import { RACE_METRICS } from "./constants";

type RaceMetric = "points" | "rebounds" | "assists";

type ChartTheme = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipText: string;
  seriesColors: string[];
};

type QuickLeadersGroup = {
  metric: string;
  rows: TournamentLeaderRow[];
};

type AnalyticsDashboardProps = {
  loading: boolean;
  kpis: TournamentAnalyticsKpi[];
  quickLeaders: QuickLeadersGroup[];
  spotlightSeries: RaceSeriesPlayer[];
  spotlightMetric: RaceMetric;
  spotlightMode: "cumulative" | "perGame";
  spotlightPhase: TournamentPhaseFilter;
  chartTheme: ChartTheme;
  onSpotlightMetricChange: (metric: RaceMetric) => void;
  onSpotlightModeChange: (mode: "cumulative" | "perGame") => void;
  onOpenPanel: (panel: AnalyticsPanelKey) => void;
};

type SpotlightTooltipPayload = {
  dataKey?: string | number;
  value?: number | string;
  name?: string;
};

const phaseLabel = (phase: TournamentPhaseFilter) => {
  if (phase === "regular") return "Temporada Regular";
  if (phase === "playoffs") return "Playoffs";
  if (phase === "finals") return "Finales";
  return "Todos";
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  loading,
  kpis,
  quickLeaders,
  spotlightSeries,
  spotlightMetric,
  spotlightMode,
  spotlightPhase,
  chartTheme,
  onSpotlightMetricChange,
  onSpotlightModeChange,
  onOpenPanel,
}) => {
  const rankedSpotlight = [...spotlightSeries]
    .map((player) => {
      if (player.points.length === 0) {
        return { player, latest: 0 };
      }

      if (spotlightMode === "cumulative") {
        return {
          player,
          latest: player.points[player.points.length - 1]?.cumulative ?? 0,
        };
      }

      return {
        player,
        latest:
          player.points.reduce((acc, point) => acc + point.value, 0) / Math.max(1, player.points.length),
      };
    })
    .sort((a, b) => b.latest - a.latest);

  const visibleSpotlight = rankedSpotlight.slice(0, 5).map((entry) => entry.player);
  const maxGames = Math.max(...visibleSpotlight.map((item) => item.points.length), 0);

  const chartData = Array.from({ length: maxGames }, (_, index) => {
    const row: Record<string, string | number> = { game: index + 1 };

    visibleSpotlight.forEach((player) => {
      const point = player.points[index];
      row[`player_${player.playerId}`] = spotlightMode === "cumulative" ? point?.cumulative ?? 0 : point?.value ?? 0;
    });

    return row;
  });

  const renderSpotlightTooltip = (props: {
    active?: boolean;
    payload?: SpotlightTooltipPayload[];
    label?: string | number;
  }) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null;

    const rows = props.payload
      .map((entry) => {
        const value = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
        return {
          name: String(entry.name ?? ""),
          value,
        };
      })
      .sort((a, b) => b.value - a.value);

    return (
      <div
        className="rounded-xl border p-2.5 shadow-sm text-xs"
        style={{
          backgroundColor: chartTheme.tooltipBg,
          borderColor: chartTheme.grid,
          color: chartTheme.tooltipText,
        }}
      >
        <p className="font-semibold mb-1">Juego {props.label}</p>
        <div className="space-y-1">
          {rows.map((row) => (
            <p key={`${row.name}-${row.value}`} className="flex items-center justify-between gap-3">
              <span className="truncate max-w-[160px]">{row.name}</span>
              <span className="font-semibold tabular-nums">{row.value.toFixed(2)}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold">Dashboard de Analíticas</h2>
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Vista rápida con insights clave, líderes y tendencias por fase.
        </p>
      </header>

      {loading ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">Cargando dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {kpis.map((kpi) => (
              <article key={kpi.id} className="app-card px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{kpi.label}</p>
                <p className="text-lg font-black truncate">{kpi.value}</p>
                <p className="text-xs text-[hsl(var(--text-subtle))] mt-0.5 truncate">{kpi.helper}</p>
              </article>
            ))}
          </div>

          <article className="app-panel p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Quick Leaders</h3>
              <button type="button" className="btn-secondary min-h-[44px]" onClick={() => onOpenPanel("leaders")}>
                Ver módulo completo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {quickLeaders.map((group) => (
                <article key={group.metric} className="app-card p-3 space-y-2">
                  <h4 className="text-sm font-semibold">{group.metric}</h4>
                  <div className="space-y-1.5">
                    {group.rows.map((row, index) => (
                      <div key={`${group.metric}-${row.playerId}`} className="flex items-center justify-between gap-2 text-sm">
                        <p className="truncate">
                          <span className="text-[hsl(var(--text-subtle))] mr-1">#{index + 1}</span>
                          {row.name}
                        </p>
                        <p className="font-semibold text-[hsl(var(--primary))] tabular-nums shrink-0">
                          {group.metric === "FG%" ? `${row.value.toFixed(2)}%` : row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="app-panel p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Race Spotlight</h3>
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  {phaseLabel(spotlightPhase)} • {spotlightMode === "cumulative" ? "Acumulado" : "Por juego"}
                </p>
              </div>
              <button type="button" className="btn-secondary min-h-[44px]" onClick={() => onOpenPanel("races")}>
                Abrir Races
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
                <span className="font-semibold text-[hsl(var(--text-subtle))]">Métrica</span>
                <select
                  value={spotlightMetric}
                  onChange={(event) => onSpotlightMetricChange(event.target.value as RaceMetric)}
                  className="select-base"
                >
                  {RACE_METRICS.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
                <span className="font-semibold text-[hsl(var(--text-subtle))]">Modo</span>
                <select
                  value={spotlightMode}
                  onChange={(event) => onSpotlightModeChange(event.target.value as "cumulative" | "perGame")}
                  className="select-base"
                >
                  <option value="cumulative">Acumulado</option>
                  <option value="perGame">Por juego</option>
                </select>
              </label>
            </div>

            {spotlightSeries.length === 0 ? (
              <div className="app-card p-5 text-sm text-[hsl(var(--text-subtle))] text-center">
                No hay datos suficientes para mostrar tendencia en esta fase.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {rankedSpotlight.slice(0, 5).map((entry, index) => (
                    <span
                      key={`spotlight-chip-${entry.player.playerId}`}
                      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs bg-[hsl(var(--surface-2))]"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: chartTheme.seriesColors[index % chartTheme.seriesColors.length] }}
                      />
                      <span className="truncate max-w-[120px]">{entry.player.name}</span>
                      <span className="font-semibold tabular-nums">{entry.latest.toFixed(2)}</span>
                    </span>
                  ))}
                </div>

                <div className="h-[280px] sm:h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 16, right: 10, left: -12, bottom: 6 }}>
                      <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="game"
                        stroke={chartTheme.axis}
                        tick={{ fill: chartTheme.axis, fontSize: 12 }}
                        tickCount={6}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke={chartTheme.axis}
                        tick={{ fill: chartTheme.axis, fontSize: 12 }}
                        width={44}
                      />
                      <Tooltip
                        content={(props) =>
                          renderSpotlightTooltip({
                            active: props.active,
                            payload: props.payload as SpotlightTooltipPayload[] | undefined,
                            label: props.label,
                          })
                        }
                      />
                      {visibleSpotlight.map((player, index) => (
                        <Line
                          key={player.playerId}
                          dataKey={`player_${player.playerId}`}
                          name={player.name}
                          stroke={chartTheme.seriesColors[index % chartTheme.seriesColors.length]}
                          strokeWidth={index === 0 ? 3.2 : 2.4}
                          dot={false}
                          activeDot={{ r: index === 0 ? 4 : 3.5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </article>

          <article className="app-panel p-3 sm:p-4">
            <h3 className="font-semibold mb-2">Módulos</h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button type="button" onClick={() => onOpenPanel("leaders")} className="btn-secondary min-h-[44px] justify-start shrink-0">
                <TrophyIcon className="h-4 w-4" />
                Líderes
              </button>
              <button type="button" onClick={() => onOpenPanel("races")} className="btn-secondary min-h-[44px] justify-start shrink-0">
                <ChartBarIcon className="h-4 w-4" />
                Races
              </button>
              <button type="button" onClick={() => onOpenPanel("mvp")} className="btn-secondary min-h-[44px] justify-start shrink-0">
                <ScaleIcon className="h-4 w-4" />
                MVP
              </button>
              <button type="button" onClick={() => onOpenPanel("finalsMvp")} className="btn-secondary min-h-[44px] justify-start shrink-0">
                <TrophyIcon className="h-4 w-4" />
                Finals MVP
              </button>
              <button type="button" onClick={() => onOpenPanel("battle")} className="btn-secondary min-h-[44px] justify-start shrink-0">
                <UserGroupIcon className="h-4 w-4" />
                Battle
              </button>
            </div>
          </article>
        </>
      )}
    </section>
  );
};

export default AnalyticsDashboard;
