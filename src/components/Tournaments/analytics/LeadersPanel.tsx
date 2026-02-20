import React from "react";
import type {
  TournamentLeaderRow,
  TournamentPhaseFilter,
  TournamentStatMetric,
} from "../../../types/tournament-analytics";
import AnalyticsEmptyState from "./AnalyticsEmptyState";
import { LEADER_CATEGORIES, PHASE_OPTIONS } from "./constants";

type LeadersPanelProps = {
  rows: TournamentLeaderRow[];
  metric: TournamentStatMetric;
  phase: TournamentPhaseFilter;
  loading: boolean;
  onMetricChange: (value: TournamentStatMetric) => void;
  onPhaseChange: (value: TournamentPhaseFilter) => void;
};

const formatLeaderValue = (metric: TournamentStatMetric, value: number) => {
  if (metric === "fg_pct") return `${value.toFixed(2)}%`;
  return value.toLocaleString("es-ES");
};

const LeadersPanel: React.FC<LeadersPanelProps> = ({
  rows,
  metric,
  phase,
  loading,
  onMetricChange,
  onPhaseChange,
}) => {
  return (
    <section className="space-y-4">
      <div className="app-panel p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-[hsl(var(--text-subtle))]">Categoría</span>
          <select
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as TournamentStatMetric)}
            className="select-base"
          >
            {LEADER_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
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
      </div>

      {loading ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">
          Cargando líderes...
        </div>
      ) : rows.length === 0 ? (
        <AnalyticsEmptyState
          title="Sin líderes disponibles"
          description="No hay datos suficientes para construir este ranking en la fase seleccionada."
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, index) => (
            <article key={row.playerId} className="app-card p-3 sm:p-4">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <div className="h-8 w-8 rounded-full border bg-[hsl(var(--surface-2))] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))]">
                  #{index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{row.name}</p>
                  <p className="text-xs text-[hsl(var(--text-subtle))] truncate">
                    {row.teamName ?? "Sin equipo"} • {row.gamesPlayed} juegos
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[hsl(var(--primary))] tabular-nums">
                    {formatLeaderValue(metric, row.value)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default LeadersPanel;
