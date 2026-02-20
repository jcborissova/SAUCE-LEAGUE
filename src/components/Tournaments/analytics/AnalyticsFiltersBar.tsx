import React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import type { TournamentPhaseFilter } from "../../../types/tournament-analytics";
import { PHASE_OPTIONS } from "./constants";

type AnalyticsFiltersBarProps = {
  phase: TournamentPhaseFilter;
  onPhaseChange: (phase: TournamentPhaseFilter) => void;
  onRefresh: () => void;
  loading?: boolean;
};

const AnalyticsFiltersBar: React.FC<AnalyticsFiltersBarProps> = ({
  phase,
  onPhaseChange,
  onRefresh,
  loading = false,
}) => {
  return (
    <div className="app-panel p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-3">
      <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
        <span className="font-semibold text-[hsl(var(--text-subtle))]">Fase global</span>
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
        onClick={onRefresh}
        disabled={loading}
        className="btn-secondary min-h-[44px]"
      >
        <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Refrescar
      </button>
    </div>
  );
};

export default AnalyticsFiltersBar;
