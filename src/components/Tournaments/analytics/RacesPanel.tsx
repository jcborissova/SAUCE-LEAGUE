import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  RaceSeriesPlayer,
  TournamentPhaseFilter,
} from "../../../types/tournament-analytics";
import AnalyticsEmptyState from "./AnalyticsEmptyState";
import { PHASE_OPTIONS, RACE_METRICS } from "./constants";

type RaceMetric = "points" | "rebounds" | "assists";

type ChartTheme = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipText: string;
  seriesColors: string[];
};

type RacesPanelProps = {
  races: RaceSeriesPlayer[];
  metric: RaceMetric;
  phase: TournamentPhaseFilter;
  mode: "cumulative" | "perGame";
  loading: boolean;
  isMobile: boolean;
  chartTheme: ChartTheme;
  onMetricChange: (value: RaceMetric) => void;
  onPhaseChange: (value: TournamentPhaseFilter) => void;
  onModeChange: (value: "cumulative" | "perGame") => void;
};

type LineTooltipPayload = {
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

const RacesPanel: React.FC<RacesPanelProps> = ({
  races,
  metric,
  phase,
  mode,
  loading,
  isMobile,
  chartTheme,
  onMetricChange,
  onPhaseChange,
  onModeChange,
}) => {
  const rankedRaces = useMemo(() => {
    return races
      .map((player) => {
        if (player.points.length === 0) {
          return { player, score: 0, latest: 0 };
        }

        if (mode === "cumulative") {
          const latest = player.points[player.points.length - 1]?.cumulative ?? 0;
          return { player, score: latest, latest };
        }

        const avg = player.points.reduce((acc, point) => acc + point.value, 0) / player.points.length;
        return { player, score: avg, latest: Number(avg.toFixed(2)) };
      })
      .sort((a, b) => b.score - a.score);
  }, [races, mode]);

  const visibleRaces = useMemo(() => {
    const limit = isMobile ? 4 : 6;
    return rankedRaces.slice(0, limit).map((entry) => entry.player);
  }, [rankedRaces, isMobile]);

  const chartData = useMemo(() => {
    const maxGames = Math.max(...visibleRaces.map((item) => item.points.length), 0);
    return Array.from({ length: maxGames }, (_, index) => {
      const row: Record<string, string | number> = {
        game: index + 1,
      };

      visibleRaces.forEach((player) => {
        const point = player.points[index];
        row[`player_${player.playerId}`] = mode === "cumulative" ? point?.cumulative ?? 0 : point?.value ?? 0;
      });

      return row;
    });
  }, [visibleRaces, mode]);

  const primaryLeader = useMemo(() => {
    const candidate = rankedRaces[0];

    if (!candidate) return null;

    return {
      playerName: candidate.player.name,
      value: candidate.latest,
    };
  }, [rankedRaces]);

  const renderTooltip = (props: { active?: boolean; payload?: LineTooltipPayload[]; label?: number | string }) => {
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
    <section className="space-y-4">
      <div className="app-panel p-3 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
        <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-[hsl(var(--text-subtle))]">Métrica</span>
          <select
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as RaceMetric)}
            className="select-base"
          >
            {RACE_METRICS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-[hsl(var(--text-subtle))]">Fase</span>
          <select
            value={phase}
            onChange={(event) => onPhaseChange(event.target.value as TournamentPhaseFilter)}
            className="select-base"
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-[hsl(var(--text-subtle))]">Modo</span>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as "cumulative" | "perGame")}
            className="select-base"
          >
            <option value="cumulative">Acumulado</option>
            <option value="perGame">Por juego</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">
          Cargando race...
        </div>
      ) : races.length === 0 ? (
        <AnalyticsEmptyState
          title="Sin datos para el race"
          description="No hay suficiente historial para mostrar la evolución de esta métrica."
        />
      ) : (
        <>
          <article className="app-card p-3 sm:p-4 space-y-2">
            <div>
              <h4 className="font-semibold text-sm sm:text-base">
                Race de {RACE_METRICS.find((item) => item.value === metric)?.label}
              </h4>
              <p className="text-xs text-[hsl(var(--text-subtle))]">
                {phaseLabel(phase)} • {mode === "cumulative" ? "Acumulado" : "Por juego"}
              </p>
              {primaryLeader ? (
                <p className="text-xs text-[hsl(var(--text-subtle))] mt-1">
                  Líder actual:{" "}
                  <span className="font-semibold text-[hsl(var(--text-strong))]">
                    {primaryLeader.playerName}
                  </span>{" "}
                  ({primaryLeader.value})
                </p>
              ) : null}
              <p className="text-xs text-[hsl(var(--text-subtle))] mt-1">
                Mostrando top {visibleRaces.length} jugadores para mantener lectura clara.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {rankedRaces.slice(0, isMobile ? 4 : 6).map((entry, index) => (
                <span
                  key={`race-chip-${entry.player.playerId}`}
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

            <div className="h-[290px] sm:h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 10, left: -12, bottom: 6 }}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="game"
                    stroke={chartTheme.axis}
                    tick={{ fill: chartTheme.axis, fontSize: 12 }}
                    tickCount={isMobile ? 4 : 8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke={chartTheme.axis}
                    tick={{ fill: chartTheme.axis, fontSize: 12 }}
                    width={44}
                  />
                  <Tooltip
                    content={(props) =>
                      renderTooltip({
                        active: props.active,
                        payload: props.payload as LineTooltipPayload[] | undefined,
                        label: props.label,
                      })
                    }
                  />
                  {!isMobile ? (
                    <Legend wrapperStyle={{ color: chartTheme.axis, fontSize: 12 }} />
                  ) : null}
                  {visibleRaces.map((player, index) => (
                    <Line
                      key={player.playerId}
                      type="monotone"
                      dataKey={`player_${player.playerId}`}
                      name={player.name}
                      stroke={chartTheme.seriesColors[index % chartTheme.seriesColors.length]}
                      strokeWidth={index === 0 ? 3.2 : 2.4}
                      dot={false}
                      activeDot={{ r: index === 0 ? 4.5 : 3.5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </>
      )}
    </section>
  );
};

export default RacesPanel;
