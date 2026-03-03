import React, { useEffect, useMemo, useState } from "react";
import type {
  TournamentLeaderRow,
  TournamentPhaseFilter,
  TournamentStatMetric,
} from "../../../types/tournament-analytics";
import AppSelect from "../../ui/AppSelect";
import AnalyticsEmptyState from "./AnalyticsEmptyState";
import { LEADER_CATEGORIES, PHASE_OPTIONS } from "./constants";

type LeadersPanelProps = {
  rows: TournamentLeaderRow[];
  metric: TournamentStatMetric;
  phase: TournamentPhaseFilter;
  loading: boolean;
  onMetricChange: (value: TournamentStatMetric) => void;
  onPhaseChange: (value: TournamentPhaseFilter) => void;
  onPlayerSelect?: (playerId: number, phase: TournamentPhaseFilter) => void;
};

const formatLeaderValue = (metric: TournamentStatMetric, value: number) => {
  if (metric === "fg_pct") return `${value.toFixed(2)}%`;
  if (metric === "defensive_impact") return value.toFixed(2);
  if (metric === "pra") return value.toFixed(1);
  return value.toLocaleString("es-ES");
};

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "JG";

const LeadersPanel: React.FC<LeadersPanelProps> = ({
  rows,
  metric,
  phase,
  loading,
  onMetricChange,
  onPhaseChange,
  onPlayerSelect,
}) => {
  const [showAll, setShowAll] = useState(false);
  const showPraExplanation = metric === "pra";
  const showDefensiveExplanation = metric === "defensive_impact";

  useEffect(() => {
    setShowAll(false);
  }, [metric, phase, rows.length]);

  const visibleRows = useMemo(
    () => (showAll ? rows : rows.slice(0, 10)),
    [showAll, rows]
  );

  return (
    <section className="space-y-4">
      <div className="app-panel p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-[hsl(var(--text-subtle))]">Categoría</span>
          <AppSelect
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as TournamentStatMetric)}
            className="select-base"
          >
            {LEADER_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </AppSelect>
        </label>

        <label className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-[hsl(var(--text-subtle))]">Fase</span>
          <AppSelect
            value={phase}
            onChange={(event) => onPhaseChange(event.target.value as TournamentPhaseFilter)}
            className="select-base"
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </label>
      </div>

      {showPraExplanation ? (
        <article className="app-panel p-3 text-xs text-[hsl(var(--text-subtle))] leading-relaxed">
          <p className="font-semibold text-[hsl(var(--text-strong))]">Cómo se calcula el PRA</p>
          <p className="mt-1">
            En este módulo el PRA mide la producción neta del jugador combinando anotación y creación, y penalizando pérdidas.
          </p>
          <p className="mt-1 tabular-nums">
            PRA (partido) = puntos + rebotes + asistencias - pérdidas
          </p>
          <p className="mt-1">
            En rankings de este módulo usamos <span className="font-semibold">PRA por juego</span> para comparar volumen
            ofensivo neto de forma más consistente.
          </p>
        </article>
      ) : null}

      {showDefensiveExplanation ? (
        <article className="app-panel p-3 text-xs text-[hsl(var(--text-subtle))] leading-relaxed">
          <p className="font-semibold text-[hsl(var(--text-strong))]">Cómo se calcula el Líder Defensivo (D-Impact)</p>
          <p className="mt-1">
            D-Impact combina robos, tapones y contexto de resultado para medir impacto defensivo por juego.
          </p>
          <p className="mt-1 tabular-nums">
            D-Impact/PJ = (1.4 x ROB/PJ) + (1.8 x TAP/PJ) + (0.35 x REB/PJ) - (0.15 x FALTAS/PJ)
          </p>
          <p className="mt-1">
            Los tapones y robos pesan más por ser acciones defensivas directas; el rebote ayuda a cerrar posesiones y
            las faltas excesivas penalizan el impacto.
          </p>
        </article>
      ) : null}

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
          <div className="app-panel p-2.5 flex items-center justify-between gap-2">
            <p className="text-xs text-[hsl(var(--text-subtle))]">
              Mostrando {visibleRows.length} de {rows.length} jugadores.
            </p>
            {rows.length > 10 ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="btn-secondary min-h-[36px] px-3 text-xs"
              >
                {showAll ? "Ver top 10" : "Ver todos"}
              </button>
            ) : null}
          </div>

          {visibleRows.map((row, index) => (
            <article key={row.playerId} className="app-card p-3 sm:p-4">
              <button
                type="button"
                onClick={() => onPlayerSelect?.(row.playerId, phase)}
                className={`w-full text-left grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg transition ${
                  onPlayerSelect
                    ? "hover:bg-[hsl(var(--surface-2)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
                    : ""
                }`}
                disabled={!onPlayerSelect}
              >
                <div className="h-8 w-8 rounded-full border bg-[hsl(var(--surface-2))] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))]">
                  #{index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate inline-flex items-center gap-2">
                    {row.photo ? (
                      <img
                        src={row.photo}
                        alt={row.name}
                        className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px]">
                        {initialsFromName(row.name)}
                      </span>
                    )}
                    {row.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--text-subtle))] truncate">
                    {row.teamName ?? "Sin equipo"} • {row.gamesPlayed} juegos
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[hsl(var(--primary))] tabular-nums">
                    {formatLeaderValue(metric, row.value)}
                  </p>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default LeadersPanel;
