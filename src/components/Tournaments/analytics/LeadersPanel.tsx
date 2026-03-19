import React, { useEffect, useMemo, useState } from "react";
import type {
  TournamentLeaderRow,
  TournamentPhaseFilter,
  TournamentStatMetric,
} from "../../../types/tournament-analytics";
import { abbreviateLeaderboardName, getPlayerInitials } from "../../../utils/player-display";
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
  if (metric === "most_improved") return value.toFixed(2);
  return value.toLocaleString("es-ES");
};

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
  const showMostImprovedExplanation = metric === "most_improved";
  const showFgPctExplanation = metric === "fg_pct";

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

      {showMostImprovedExplanation ? (
        <article className="app-panel p-3 text-xs text-[hsl(var(--text-subtle))] leading-relaxed">
          <p className="font-semibold text-[hsl(var(--text-strong))]">Cómo se calcula Más progreso (regular season)</p>
          <p className="mt-1">
            Esta categoría usa solo temporada regular y premia salto real: compara el inicio vs el cierre del jugador.
          </p>
          <p className="mt-1 tabular-nums">
            Score progreso (escala compacta) = salto de VAL + tendencia por juego + mejora de TS% ajustada por volumen + crecimiento de carga ofensiva + control de pérdidas
          </p>
          <p className="mt-1">
            También favorece a quienes arrancaron desde una base no élite y luego sostuvieron la mejora. Penaliza perfiles ya consolidados
            y excluye la zona MVP del torneo para que el ranking no se convierta en "el mejor jugador también mejoró".
          </p>
        </article>
      ) : null}

      {showFgPctExplanation ? (
        <article className="app-panel p-3 text-xs text-[hsl(var(--text-subtle))] leading-relaxed">
          <p className="font-semibold text-[hsl(var(--text-strong))]">Cómo se filtra el ranking FG%</p>
          <p className="mt-1">
            Para evitar líderes engañosos por muestras pequeñas, el ranking de FG% exige un mínimo dinámico de tiros convertidos.
          </p>
          <p className="mt-1">
            El criterio está adaptado de los <span className="font-semibold">stat minimums</span> de NBA: en porcentajes de tiro
            importa el volumen de aciertos, no solo cuántos juegos jugó el atleta.
          </p>
          <p className="mt-1">
            Si dos jugadores tienen porcentajes muy parecidos, se prioriza al que sostuvo ese acierto con más intentos.
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

          {visibleRows.map((row, index) => {
            const displayName = abbreviateLeaderboardName(row.name, 20);
            const usesExtendedMobileLayout =
              metric === "most_improved" || metric === "fg_pct";

            return (
            <article key={row.playerId} className="app-card min-h-[78px] p-3 sm:p-4">
              <button
                type="button"
                onClick={() => onPlayerSelect?.(row.playerId, phase)}
                className={`w-full text-left rounded-lg transition ${
                  onPlayerSelect
                    ? "hover:bg-[hsl(var(--surface-2)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
                    : ""
                } ${
                  usesExtendedMobileLayout
                    ? "grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-3"
                    : "grid grid-cols-[auto_1fr_auto] items-center gap-3"
                }`}
                disabled={!onPlayerSelect}
              >
                <div className="h-8 w-8 rounded-full border bg-[hsl(var(--surface-2))] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))]">
                  #{index + 1}
                </div>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-2 font-semibold">
                    {row.photo ? (
                      <img
                        src={row.photo}
                        alt={row.name}
                        className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px]">
                        {getPlayerInitials(row.name)}
                      </span>
                    )}
                    <span className="truncate" title={row.name}>
                      {displayName}
                    </span>
                  </p>
                  <p
                    className={`text-xs text-[hsl(var(--text-subtle))] ${
                      usesExtendedMobileLayout ? "line-clamp-2 sm:truncate" : "truncate"
                    }`}
                  >
                    {metric === "most_improved"
                      ? row.mostImproved?.explanation ?? `${row.teamName ?? "Sin equipo"} • Regular season`
                      : metric === "fg_pct"
                        ? `${row.teamName ?? "Sin equipo"} • FG ${row.totals.fgm}/${row.totals.fga} en ${row.gamesPlayed} juegos`
                        : `${row.teamName ?? "Sin equipo"} • ${row.gamesPlayed} juegos`}
                  </p>
                </div>
                <div
                  className={`text-right ${
                    usesExtendedMobileLayout
                      ? "col-span-2 flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-2)/0.5)] px-2.5 py-2 sm:col-span-1 sm:block sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
                      : ""
                  }`}
                >
                  {usesExtendedMobileLayout ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))] sm:hidden">
                      {metric === "most_improved" ? "Score progreso" : "FG%"}
                    </p>
                  ) : null}
                  <p className="text-lg font-black text-[hsl(var(--primary))] tabular-nums">
                    {formatLeaderValue(metric, row.value)}
                  </p>
                </div>
              </button>
            </article>
          );
          })}
        </div>
      )}
    </section>
  );
};

export default LeadersPanel;
