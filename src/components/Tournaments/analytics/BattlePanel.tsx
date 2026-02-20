import React, { useMemo, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BoltIcon, FireIcon, SparklesIcon } from "@heroicons/react/24/solid";
import type {
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  TournamentPhaseFilter,
} from "../../../types/tournament-analytics";
import AnalyticsEmptyState from "./AnalyticsEmptyState";
import { BATTLE_METRICS, PHASE_OPTIONS } from "./constants";

type BattlePlayerOption = {
  playerId: number;
  name: string;
  teamName: string | null;
};

type ChartTheme = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipText: string;
  seriesColors: string[];
};

type BattlePanelProps = {
  phase: TournamentPhaseFilter;
  loading: boolean;
  isMobile: boolean;
  players: BattlePlayerOption[];
  selectedPlayerIds: number[];
  selectedMetrics: BattleMetric[];
  result: { players: BattlePlayerResult[]; summary: BattleSummary } | null;
  chartTheme: ChartTheme;
  onPhaseChange: (value: TournamentPhaseFilter) => void;
  onSelectedPlayersChange: (playerIds: number[]) => void;
  onSelectedMetricsChange: (metrics: BattleMetric[]) => void;
  onCompare: () => void;
};

type MetricMeta = {
  label: string;
  hint: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
};

type RadarDatum = {
  metricLabel: string;
  metricKey: BattleMetric;
} & Record<string, string | number>;

type RadarTooltipPayload = {
  dataKey?: string | number;
  value?: number | string;
  payload?: RadarDatum;
};

type BattleViewMode = "arena" | "radar";

type BattleSeriesStyle = {
  color: string;
  dash: string;
  fillOpacity: number;
};

const RADAR_DASHES = ["0", "7 4", "3 3", "10 4 2 4"];
const RADAR_FILLS = [0.26, 0.18, 0.14, 0.1];

const phaseLabel = (phase: TournamentPhaseFilter) => {
  if (phase === "regular") return "Temporada Regular";
  if (phase === "playoffs") return "Playoffs";
  if (phase === "finals") return "Finales";
  return "Todos";
};

const METRIC_META: Record<BattleMetric, MetricMeta> = {
  ppg: {
    label: "PPG",
    hint: "Anotación por juego",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  rpg: {
    label: "RPG",
    hint: "Rebotes por juego",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  apg: {
    label: "APG",
    hint: "Asistencias por juego",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  spg: {
    label: "SPG",
    hint: "Robos por juego",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  bpg: {
    label: "BPG",
    hint: "Bloqueos por juego",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  fg_pct: {
    label: "FG%",
    hint: "Eficiencia de campo",
    higherIsBetter: true,
    format: (value) => `${value.toFixed(1)}%`,
  },
  topg: {
    label: "TOPG",
    hint: "Pérdidas por juego (menos es mejor)",
    higherIsBetter: false,
    format: (value) => value.toFixed(1),
  },
};

const EPSILON = 0.25;

const getDuelRatio = (
  left: number,
  right: number,
  higherIsBetter: boolean
): { leftRatio: number; rightRatio: number } => {
  if (higherIsBetter) {
    const leftScore = Math.max(0, left);
    const rightScore = Math.max(0, right);
    const total = leftScore + rightScore;

    if (total === 0) {
      return { leftRatio: 50, rightRatio: 50 };
    }

    return {
      leftRatio: (leftScore / total) * 100,
      rightRatio: (rightScore / total) * 100,
    };
  }

  const leftScore = 1 / (Math.max(0, left) + EPSILON);
  const rightScore = 1 / (Math.max(0, right) + EPSILON);
  const total = leftScore + rightScore;

  if (total === 0) {
    return { leftRatio: 50, rightRatio: 50 };
  }

  return {
    leftRatio: (leftScore / total) * 100,
    rightRatio: (rightScore / total) * 100,
  };
};

const extractPlayerIdFromDataKey = (dataKey: string | number | undefined): number | null => {
  if (typeof dataKey !== "string") return null;
  if (!dataKey.startsWith("player_")) return null;

  const parsed = Number(dataKey.replace("player_", ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const BattlePanel: React.FC<BattlePanelProps> = ({
  phase,
  loading,
  isMobile,
  players,
  selectedPlayerIds,
  selectedMetrics,
  result,
  chartTheme,
  onPhaseChange,
  onSelectedPlayersChange,
  onSelectedMetricsChange,
  onCompare,
}) => {
  const [playerSearch, setPlayerSearch] = useState("");
  const [viewMode, setViewMode] = useState<BattleViewMode>("arena");

  const selectedPlayerSet = useMemo(() => new Set(selectedPlayerIds), [selectedPlayerIds]);

  const selectedPlayerCards = useMemo(
    () => players.filter((player) => selectedPlayerSet.has(player.playerId)),
    [players, selectedPlayerSet]
  );

  const filteredPlayers = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();
    const rows = players.filter((player) => {
      if (!search) return true;

      return (
        player.name.toLowerCase().includes(search) ||
        (player.teamName ?? "").toLowerCase().includes(search)
      );
    });

    return rows.sort((a, b) => {
      const aSelected = selectedPlayerSet.has(a.playerId);
      const bSelected = selectedPlayerSet.has(b.playerId);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [players, playerSearch, selectedPlayerSet]);

  const resultPlayers = result?.players ?? [];

  const resultPlayerById = useMemo(() => {
    const map = new Map<number, BattlePlayerResult>();
    resultPlayers.forEach((player) => map.set(player.playerId, player));
    return map;
  }, [resultPlayers]);

  const battlePalette = useMemo(() => {
    const fromTheme = [
      chartTheme.seriesColors[4],
      chartTheme.seriesColors[2],
      chartTheme.seriesColors[7],
      chartTheme.seriesColors[3],
      chartTheme.seriesColors[0],
      chartTheme.seriesColors[1],
      chartTheme.seriesColors[5],
      chartTheme.seriesColors[6],
    ].filter((value): value is string => Boolean(value));

    if (fromTheme.length >= 4) {
      return fromTheme;
    }

    return [
      "hsl(7 84% 57%)",
      "hsl(145 63% 42%)",
      "hsl(340 82% 52%)",
      "hsl(39 100% 52%)",
      "hsl(224 71% 47%)",
      "hsl(197 93% 45%)",
    ];
  }, [chartTheme.seriesColors]);

  const playerStyleById = useMemo(() => {
    const map = new Map<number, BattleSeriesStyle>();
    resultPlayers.forEach((player, index) => {
      map.set(player.playerId, {
        color: battlePalette[index % battlePalette.length] ?? chartTheme.axis,
        dash: RADAR_DASHES[index % RADAR_DASHES.length] ?? "0",
        fillOpacity: RADAR_FILLS[index % RADAR_FILLS.length] ?? 0.14,
      });
    });
    return map;
  }, [resultPlayers, battlePalette, chartTheme.axis]);

  const playerColorById = useMemo(() => {
    const map = new Map<number, string>();
    resultPlayers.forEach((player) => {
      map.set(player.playerId, playerStyleById.get(player.playerId)?.color ?? chartTheme.axis);
    });
    return map;
  }, [resultPlayers, playerStyleById, chartTheme.axis]);

  const ranking = useMemo(() => {
    if (!result) return [];

    return [...result.players].sort((a, b) => {
      const byWins =
        (result.summary.categoryWins[b.playerId] ?? 0) - (result.summary.categoryWins[a.playerId] ?? 0);
      if (byWins !== 0) return byWins;
      return b.compositeScore - a.compositeScore;
    });
  }, [result]);

  const topCategoryWins = useMemo(() => {
    if (!result) return 0;
    return Math.max(0, ...Object.values(result.summary.categoryWins));
  }, [result]);

  const duelLeaderIds = useMemo(() => {
    if (!result) return [];

    return result.players
      .filter((player) => (result.summary.categoryWins[player.playerId] ?? 0) === topCategoryWins)
      .map((player) => player.playerId);
  }, [result, topCategoryWins]);

  const isCategoryTie = duelLeaderIds.length > 1 && topCategoryWins > 0;

  const duelLeaderNames = useMemo(
    () =>
      duelLeaderIds
        .map((playerId) => resultPlayerById.get(playerId)?.name)
        .filter((name): name is string => Boolean(name))
        .join(", "),
    [duelLeaderIds, resultPlayerById]
  );

  const metricBreakdown = useMemo(() => {
    if (!result) return [];

    return selectedMetrics.map((metric) => {
      const leaders = result.summary.perMetricLeader[metric] ?? [];
      const sortedValues = [...result.players].sort((a, b) => {
        if (METRIC_META[metric].higherIsBetter) {
          return b.metrics[metric] - a.metrics[metric];
        }
        return a.metrics[metric] - b.metrics[metric];
      });

      return {
        metric,
        leaders,
        sortedValues,
      };
    });
  }, [result, selectedMetrics]);

  const duelPlayers = useMemo(() => {
    if (!result || result.players.length !== 2) return null;
    return result.players;
  }, [result]);

  const duelRows = useMemo(() => {
    if (!result || !duelPlayers) return [];

    const [leftPlayer, rightPlayer] = duelPlayers;

    return selectedMetrics.map((metric) => {
      const meta = METRIC_META[metric];
      const leftValue = leftPlayer.metrics[metric];
      const rightValue = rightPlayer.metrics[metric];
      const leaders = result.summary.perMetricLeader[metric] ?? [];
      const winnerId = leaders.length === 1 ? leaders[0] : null;
      const valueGap = Math.abs(leftValue - rightValue);
      const ratio = getDuelRatio(leftValue, rightValue, meta.higherIsBetter);

      return {
        metric,
        meta,
        leftPlayer,
        rightPlayer,
        leftValue,
        rightValue,
        winnerId,
        ratio,
        valueGap,
      };
    });
  }, [result, duelPlayers, selectedMetrics]);

  const arenaMetricRows = useMemo(() => {
    if (!result) return [];

    return selectedMetrics.map((metric) => {
      const meta = METRIC_META[metric];
      const values = result.players.map((player) => player.metrics[metric]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const spread = max - min;
      const leaders = result.summary.perMetricLeader[metric] ?? [];

      const rows = [...result.players]
        .sort((a, b) =>
          meta.higherIsBetter ? b.metrics[metric] - a.metrics[metric] : a.metrics[metric] - b.metrics[metric]
        )
        .map((player) => {
          const value = player.metrics[metric];
          const normalized =
            spread === 0
              ? 100
              : meta.higherIsBetter
                ? ((value - min) / spread) * 100
                : ((max - value) / spread) * 100;

          return {
            ...player,
            value,
            normalized: spread === 0 ? 100 : Math.max(8, Number(normalized.toFixed(2))),
            isLeader: leaders.includes(player.playerId),
          };
        });

      return {
        metric,
        meta,
        spread,
        rows,
      };
    });
  }, [result, selectedMetrics]);

  const chartData = useMemo(() => {
    if (!result) return [];

    return selectedMetrics.map((metric) => {
      const values = result.players.map((player) => player.metrics[metric]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      const row: RadarDatum = {
        metricLabel: METRIC_META[metric].label,
        metricKey: metric,
      };

      result.players.forEach((player) => {
        const raw = player.metrics[metric];
        const normalized =
          range === 0
            ? 100
            : METRIC_META[metric].higherIsBetter
              ? ((raw - min) / range) * 100
              : ((max - raw) / range) * 100;

        row[`player_${player.playerId}`] = Number(normalized.toFixed(2));
      });

      return row;
    });
  }, [result, selectedMetrics]);

  const renderRadarTooltip = (props: {
    active?: boolean;
    payload?: RadarTooltipPayload[];
  }) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }

    const row = props.payload[0]?.payload;
    if (!row) return null;

    const metricKey = row.metricKey;

    return (
      <div
        className="rounded-xl border p-2.5 shadow-sm"
        style={{
          backgroundColor: chartTheme.tooltipBg,
          borderColor: chartTheme.grid,
          color: chartTheme.tooltipText,
        }}
      >
        <p className="text-xs font-semibold mb-1.5">{METRIC_META[metricKey].label}</p>
        <div className="space-y-1 text-xs">
          {props.payload.map((entry) => {
            const playerId = extractPlayerIdFromDataKey(entry.dataKey);
            if (!playerId) return null;

            const player = resultPlayerById.get(playerId);
            if (!player) return null;

            const rawValue = player.metrics[metricKey];
            const normalizedValue =
              typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);

            return (
              <p key={playerId} className="flex items-center justify-between gap-3">
                <span className="truncate">{player.name}</span>
                <span className="font-semibold tabular-nums">
                  {METRIC_META[metricKey].format(rawValue)} | {normalizedValue.toFixed(0)}
                </span>
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const togglePlayer = (playerId: number) => {
    const selected = selectedPlayerSet.has(playerId);
    const selectionSize = selectedPlayerIds.length;

    if (selected) {
      onSelectedPlayersChange(selectedPlayerIds.filter((id) => id !== playerId));
      return;
    }

    if (selectionSize >= 2) return;
    onSelectedPlayersChange([...selectedPlayerIds, playerId]);
  };

  const toggleMetric = (metric: BattleMetric) => {
    if (selectedMetrics.includes(metric)) {
      if (selectedMetrics.length === 1) return;
      onSelectedMetricsChange(selectedMetrics.filter((value) => value !== metric));
      return;
    }

    onSelectedMetricsChange([...selectedMetrics, metric]);
  };

  return (
    <section className="space-y-4">
      <div className="app-panel p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 sm:gap-3">
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

        <button
          type="button"
          className="btn-primary min-h-[44px]"
          onClick={onCompare}
          disabled={loading || selectedPlayerIds.length !== 2}
        >
          Comparar
        </button>
      </div>

      <article className="app-card p-4 space-y-4">
        <div className="rounded-xl border bg-[hsl(var(--surface-2))] p-3">
          <p className="text-sm text-[hsl(var(--text-subtle))] leading-relaxed">
            Arma un duelo entre <span className="font-semibold text-[hsl(var(--text-strong))]">2 jugadores exactos</span>,
            activa métricas clave y obtén un veredicto claro. Ideal para comparar con enfoque competitivo y lectura rápida.
          </p>
          <p className="text-xs mt-1 text-[hsl(var(--text-subtle))]">
            Seleccionados:{" "}
            <span className="font-semibold text-[hsl(var(--text-strong))]">{selectedPlayerIds.length}</span>/2 jugadores •{" "}
            <span className="font-semibold text-[hsl(var(--text-strong))]">{selectedMetrics.length}</span> métricas
          </p>
        </div>

        <details className="rounded-xl border bg-[hsl(var(--surface-2))] p-3 space-y-3" open>
          <summary className="cursor-pointer text-sm font-semibold">Jugadores (exactamente 2)</summary>
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
              placeholder="Buscar por nombre o equipo"
              className="input-base min-h-[44px]"
            />

            {selectedPlayerCards.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedPlayerCards.map((player) => (
                  <div
                    key={`selected-${player.playerId}`}
                    className="rounded-full border bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold"
                    title={player.teamName ?? undefined}
                  >
                    {player.name}
                    <span className="text-[hsl(var(--text-subtle))]">
                      {player.teamName ? ` • ${player.teamName}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {filteredPlayers.map((player) => {
                const selected = selectedPlayerSet.has(player.playerId);
                const disabled = !selected && selectedPlayerIds.length >= 2;

                return (
                  <button
                    key={player.playerId}
                    type="button"
                    onClick={() => togglePlayer(player.playerId)}
                    disabled={disabled}
                    className={`min-h-[44px] rounded-full border px-3 py-2 text-sm transition max-w-full truncate ${
                      selected
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--muted))]"
                    } ${disabled ? "opacity-50" : ""}`}
                    title={`${player.name} ${player.teamName ? `(${player.teamName})` : ""}`}
                  >
                    <span className="truncate inline-block max-w-[180px] align-bottom">{player.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </details>

        <details className="rounded-xl border bg-[hsl(var(--surface-2))] p-3">
          <summary className="cursor-pointer text-sm font-semibold">Métricas activas</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm mt-3">
            {BATTLE_METRICS.map((metricOption) => {
              const meta = METRIC_META[metricOption.value];
              const checked = selectedMetrics.includes(metricOption.value);

              return (
                <button
                  key={metricOption.value}
                  type="button"
                  onClick={() => toggleMetric(metricOption.value)}
                  className={`rounded-xl border px-2.5 py-2 min-h-[44px] text-left transition ${
                    checked
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.35)]"
                      : "bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-[11px] text-[hsl(var(--text-subtle))]">{meta.hint}</p>
                </button>
              );
            })}
          </div>
        </details>
      </article>

      {!result ? (
        <AnalyticsEmptyState
          title="Battle listo para iniciar"
          description="Selecciona exactamente 2 jugadores, define métricas y presiona comparar."
        />
      ) : (
        <>
          <article className="app-card p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:items-center">
              <div>
                <h4 className="font-semibold text-base">Resumen del duelo</h4>
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  {phaseLabel(phase)} • {result.players.length} jugadores • {selectedMetrics.length} métricas
                </p>
              </div>
              <div className="rounded-xl border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">
                <p className="font-semibold">
                  {isCategoryTie
                    ? `Empate técnico: ${duelLeaderNames}`
                    : `Ganador: ${result.summary.overallWinnerName ?? "Sin definir"}`}
                </p>
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  Máximo de categorías: {topCategoryWins}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {resultPlayers.map((player) => {
                const style = playerStyleById.get(player.playerId);

                return (
                  <span
                    key={`battle-legend-${player.playerId}`}
                    className="inline-flex items-center gap-2 rounded-full border bg-[hsl(var(--surface-2))] px-2.5 py-1 text-xs"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: style?.color ?? chartTheme.axis }}
                    />
                    <span className="truncate max-w-[120px]">{player.name}</span>
                  </span>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {ranking.map((player, index) => {
                const wins = result.summary.categoryWins[player.playerId] ?? 0;
                const highlighted = index === 0 && !isCategoryTie;
                const accentColor =
                  playerColorById.get(player.playerId) ??
                  chartTheme.seriesColors[index % chartTheme.seriesColors.length] ??
                  chartTheme.axis;

                return (
                  <div
                    key={`ranking-${player.playerId}`}
                    className={`rounded-xl border p-3 ${
                      highlighted
                        ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)]"
                        : "bg-[hsl(var(--surface-2))]"
                    }`}
                    style={{
                      boxShadow: `inset 3px 0 0 ${accentColor}`,
                    }}
                  >
                    <p className="text-xs text-[hsl(var(--text-subtle))]">#{index + 1}</p>
                    <p className="font-semibold truncate inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                      {player.name}
                    </p>
                    <p className="text-xs text-[hsl(var(--text-subtle))] truncate">
                      {player.teamName ?? "Sin equipo"}
                    </p>
                    <p className="text-xs mt-1">
                      <span className="font-semibold">{wins}</span> categorías • MVP score{" "}
                      <span className="font-semibold">{player.compositeScore.toFixed(3)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </article>

          <div className="app-panel p-2 inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("arena")}
              className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold transition ${
                viewMode === "arena"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--muted))]"
              }`}
            >
              Arena
            </button>
            <button
              type="button"
              onClick={() => setViewMode("radar")}
              className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold transition ${
                viewMode === "radar"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-[hsl(var(--surface-1))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--muted))]"
              }`}
            >
              Radar
            </button>
          </div>

          {viewMode === "arena" ? (
            <>
              {duelPlayers ? (
                <article className="app-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm sm:text-base inline-flex items-center gap-2">
                      <FireIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                      Duelo directo
                    </h4>
                    <p className="text-xs text-[hsl(var(--text-subtle))]">
                      Comparativa real por categoría entre 2 jugadores
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {duelPlayers.map((player) => (
                      <div key={`duel-score-${player.playerId}`} className="rounded-xl border bg-[hsl(var(--surface-2))] p-3">
                        <p className="text-xs text-[hsl(var(--text-subtle))] truncate">{player.name}</p>
                        <p className="text-lg font-black tabular-nums">
                          {result.summary.categoryWins[player.playerId] ?? 0}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--text-subtle))]">categorías ganadas</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {duelRows.map((row) => {
                      const winnerName =
                        row.winnerId === null
                          ? "Empate"
                          : row.winnerId === row.leftPlayer.playerId
                            ? row.leftPlayer.name
                            : row.rightPlayer.name;

                      const leftColor =
                        playerColorById.get(row.leftPlayer.playerId) ?? battlePalette[0] ?? chartTheme.axis;
                      const rightColor =
                        playerColorById.get(row.rightPlayer.playerId) ?? battlePalette[1] ?? chartTheme.axis;

                      return (
                        <div key={`duel-row-${row.metric}`} className="rounded-xl border bg-[hsl(var(--surface-2))] p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{row.meta.label}</p>
                            <span className="text-[11px] rounded-full border px-2 py-0.5 text-[hsl(var(--text-subtle))]">
                              {winnerName}
                            </span>
                          </div>

                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                            <p className="font-semibold tabular-nums truncate text-right inline-flex items-center justify-end gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: leftColor }}
                              />
                              {row.meta.format(row.leftValue)}
                            </p>
                            <BoltIcon className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                            <p className="font-semibold tabular-nums truncate inline-flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: rightColor }}
                              />
                              {row.meta.format(row.rightValue)}
                            </p>
                          </div>

                          <div className="h-2 rounded-full overflow-hidden bg-[hsl(var(--surface-1))] flex">
                            <span style={{ width: `${row.ratio.leftRatio}%`, backgroundColor: leftColor }} />
                            <span style={{ width: `${row.ratio.rightRatio}%`, backgroundColor: rightColor }} />
                          </div>

                          <p className="text-[11px] text-[hsl(var(--text-subtle))]">
                            Brecha: <span className="font-semibold">{row.meta.format(row.valueGap)}</span>
                            {" • "}
                            {row.meta.higherIsBetter ? "Más alto gana" : "Más bajo gana"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ) : (
                <article className="app-panel p-3 text-xs text-[hsl(var(--text-subtle))]">
                  Para ver la comparación, selecciona exactamente 2 jugadores.
                </article>
              )}

              <article className="app-panel p-4 space-y-3">
                <h4 className="font-semibold text-sm sm:text-base inline-flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                  Arena por métrica
                </h4>

                <div className="space-y-3">
                  {arenaMetricRows.map((row) => (
                    <div key={`arena-metric-${row.metric}`} className="rounded-xl border bg-[hsl(var(--surface-1))] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{row.meta.label}</p>
                        <p className="text-[11px] text-[hsl(var(--text-subtle))]">
                          {row.meta.higherIsBetter ? "Más alto gana" : "Más bajo gana"}
                        </p>
                      </div>

                      <div className="mt-2 space-y-2">
                        {row.rows.map((player, index) => {
                          const fillColor =
                            playerColorById.get(player.playerId) ??
                            battlePalette[index % battlePalette.length] ??
                            chartTheme.axis;

                          return (
                            <div key={`arena-player-${row.metric}-${player.playerId}`} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <p className="truncate">
                                  {index + 1}. {player.name}
                                </p>
                                <p className="font-semibold tabular-nums">
                                  {row.meta.format(player.value)}
                                </p>
                              </div>

                              <div className="h-2 rounded-full overflow-hidden bg-[hsl(var(--surface-2))]">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${player.normalized}%`, backgroundColor: fillColor }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </>
          ) : (
            <>
              <article className="app-card p-3 sm:p-4 space-y-2">
                <div>
                  <h4 className="font-semibold text-sm sm:text-base">Radar comparativo normalizado</h4>
                  <p className="text-xs text-[hsl(var(--text-subtle))]">
                    Escala 0-100 por métrica para comparar rendimiento relativo entre seleccionados.
                  </p>
                  <p className="text-xs text-[hsl(var(--text-subtle))] mt-1">
                    Consejo: usa <span className="font-semibold">Arena</span> para lectura rápida y {""}
                    <span className="font-semibold">Radar</span> para forma global.
                  </p>
                </div>

                <div className="h-[280px] sm:h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={chartData} outerRadius="70%">
                      <PolarGrid stroke={chartTheme.grid} />
                      <PolarAngleAxis dataKey="metricLabel" tick={{ fill: chartTheme.axis, fontSize: 12 }} />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fill: chartTheme.axis, fontSize: 11 }}
                        axisLine={{ stroke: chartTheme.grid }}
                      />
                      <Tooltip
                        content={(props) =>
                          renderRadarTooltip({
                            active: props.active,
                            payload: props.payload as RadarTooltipPayload[] | undefined,
                          })
                        }
                      />
                      {!isMobile ? (
                        <Legend wrapperStyle={{ color: chartTheme.axis, fontSize: 12 }} />
                      ) : null}
                      {result.players.map((player, index) => {
                        const style = playerStyleById.get(player.playerId);

                        return (
                          <Radar
                            key={player.playerId}
                            dataKey={`player_${player.playerId}`}
                            name={player.name}
                            stroke={style?.color ?? battlePalette[index % battlePalette.length] ?? chartTheme.axis}
                            fill={style?.color ?? battlePalette[index % battlePalette.length] ?? chartTheme.axis}
                            fillOpacity={style?.fillOpacity ?? 0.14}
                            strokeWidth={2.4}
                            strokeDasharray={style?.dash ?? "0"}
                          />
                        );
                      })}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="app-panel p-4 space-y-3">
                <h4 className="font-semibold text-sm sm:text-base">Detalle por métrica</h4>

                {isMobile ? (
                  <div className="space-y-2">
                    {metricBreakdown.map((entry) => (
                      <div key={`metric-card-${entry.metric}`} className="rounded-xl border bg-[hsl(var(--surface-1))] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{METRIC_META[entry.metric].label}</p>
                          <p className="text-[11px] text-[hsl(var(--text-subtle))]">
                            {METRIC_META[entry.metric].higherIsBetter ? "Más alto gana" : "Más bajo gana"}
                          </p>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {entry.sortedValues.map((player) => {
                            const isLeader = entry.leaders.includes(player.playerId);

                            return (
                              <div
                                key={`metric-mobile-${entry.metric}-${player.playerId}`}
                                className={`rounded-lg border px-2.5 py-2 text-xs flex items-center justify-between ${
                                  isLeader
                                    ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)]"
                                    : "bg-[hsl(var(--surface-2))]"
                                }`}
                              >
                                <span className="truncate pr-2">{player.name}</span>
                                <span className="font-semibold tabular-nums">
                                  {METRIC_META[entry.metric].format(player.metrics[entry.metric])}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--surface-2))]">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Métrica</th>
                          {resultPlayers.map((player) => (
                            <th key={`head-${player.playerId}`} className="px-3 py-2 text-left font-semibold">
                              <span className="block truncate max-w-[140px]">{player.name}</span>
                              <span className="block text-xs font-normal text-[hsl(var(--text-subtle))] truncate max-w-[140px]">
                                {player.teamName ?? "Sin equipo"}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMetrics.map((metric) => (
                          <tr key={`row-${metric}`} className="border-t">
                            <td className="px-3 py-2">
                              <p className="font-semibold">{METRIC_META[metric].label}</p>
                              <p className="text-xs text-[hsl(var(--text-subtle))]">{METRIC_META[metric].hint}</p>
                            </td>
                            {resultPlayers.map((player) => {
                              const isLeader = result.summary.perMetricLeader[metric]?.includes(player.playerId);

                              return (
                                <td key={`metric-${metric}-${player.playerId}`} className="px-3 py-2">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      isLeader
                                        ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                                        : "bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]"
                                    }`}
                                  >
                                    {METRIC_META[metric].format(player.metrics[metric])}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </>
          )}

          {selectedPlayerIds.some((playerId) => !resultPlayerById.has(playerId)) ? (
            <article className="app-panel p-3 text-xs text-[hsl(var(--text-subtle))]">
              Algunos jugadores seleccionados no tienen suficientes datos en la fase actual y no entraron en la comparación.
            </article>
          ) : null}
        </>
      )}
    </section>
  );
};

export default BattlePanel;
