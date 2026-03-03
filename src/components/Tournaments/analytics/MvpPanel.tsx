import React, { useEffect, useMemo, useState } from "react";
import type { MvpBreakdownRow, TournamentPhaseFilter } from "../../../types/tournament-analytics";
import AnalyticsEmptyState from "./AnalyticsEmptyState";
import { MVP_SCORE_WEIGHTS } from "../../../utils/tournament-stats";
import { abbreviateLeaderboardName, getPlayerInitials } from "../../../utils/player-display";

type MvpPanelProps = {
  rows: MvpBreakdownRow[];
  loading: boolean;
  title: string;
  subtitle: string;
  phase: TournamentPhaseFilter;
  onPlayerSelect?: (playerId: number, phase: TournamentPhaseFilter) => void;
};

const formatSigned = (value: number) => {
  const fixed = value.toFixed(3);
  if (value > 0) return `+${fixed}`;
  return fixed;
};

const formatPct = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatPlainPct = (value: number) => `${value.toFixed(1)}%`;
const formatPra = (row: MvpBreakdownRow) =>
  (row.perGame.ppg + row.perGame.rpg + row.perGame.apg - row.perGame.topg).toFixed(1);

const MvpPanel: React.FC<MvpPanelProps> = ({
  rows,
  loading,
  title,
  subtitle,
  phase,
  onPlayerSelect,
}) => {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setShowAll(false);
  }, [rows.length]);

  const formulaTerms: Array<{ weight: number; label: string }> = [
    { weight: MVP_SCORE_WEIGHTS.scoring, label: "z(PPG)" },
    { weight: MVP_SCORE_WEIGHTS.playmaking, label: "z(APG)" },
    { weight: MVP_SCORE_WEIGHTS.rebounding, label: "z(RPG)" },
    { weight: MVP_SCORE_WEIGHTS.steals, label: "z(SPG)" },
    { weight: MVP_SCORE_WEIGHTS.blocks, label: "z(BPG)" },
    { weight: MVP_SCORE_WEIGHTS.trueShooting, label: "z(TS%)" },
    { weight: MVP_SCORE_WEIGHTS.fieldGoalPct, label: "z(FG%)" },
    { weight: MVP_SCORE_WEIGHTS.threePointPct, label: "z(3P%)" },
    { weight: MVP_SCORE_WEIGHTS.pieShareImpact, label: "z(PIE Share)" },
    { weight: MVP_SCORE_WEIGHTS.praImpact, label: "z(PRA)" },
    { weight: MVP_SCORE_WEIGHTS.valuationImpact, label: "z(VAL/PJ)" },
    { weight: MVP_SCORE_WEIGHTS.durability, label: "z(disponibilidad)" },
    { weight: MVP_SCORE_WEIGHTS.teamRecord, label: "z(record equipo)" },
    { weight: MVP_SCORE_WEIGHTS.turnovers, label: "z(TOPG)" },
    { weight: MVP_SCORE_WEIGHTS.fouls, label: "z(FPG)" },
  ];

  const scoreFormula = formulaTerms
    .map((term, index) => {
      const weightText = Math.abs(term.weight).toFixed(2);
      if (index === 0) {
        return `${weightText}*${term.label}`;
      }
      return `${term.weight >= 0 ? "+" : "-"} ${weightText}*${term.label}`;
    })
    .join(" ");

  const visibleRows = useMemo(
    () => (showAll ? rows : rows.slice(0, 10)),
    [rows, showAll]
  );

  return (
    <section className="space-y-4">
      <article className="app-panel p-4 text-sm text-[hsl(var(--text-subtle))] leading-relaxed">
        <h4 className="font-semibold text-[hsl(var(--text-strong))] mb-1">{title}</h4>
        <p>{subtitle}</p>
        <p className="mt-2 text-xs">
          Modelo inspirado en prácticas NBA/ACB: valoración por juego (perfil ACB), eficiencia real TS%/FG%,
          impacto tipo PIE-share + volumen PRA neto (restando pérdidas) y éxito colectivo (récord + disponibilidad).
          Todas las métricas se normalizan con z-score para comparar en la misma escala y se calcula sobre el pool
          de jugadores elegibles.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed">
          <span className="font-semibold text-[hsl(var(--text-strong))]">MVP Score = </span>
          {scoreFormula}
        </p>
      </article>

      {loading ? (
        <div className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">Cargando ranking MVP...</div>
      ) : rows.length === 0 ? (
        <AnalyticsEmptyState
          title="Sin jugadores elegibles"
          description="Cuando más jugadores cumplan los requisitos de elegibilidad, verás el ranking aquí."
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
            return (
            <details key={row.playerId} className="app-card p-3 sm:p-4 group" open={index === 0}>
              <summary className="list-none cursor-pointer">
                <div className="grid min-h-[78px] grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div className="h-8 w-8 rounded-full border bg-[hsl(var(--surface-2))] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))]">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate inline-flex items-center gap-2" title={row.name}>
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
                      {displayName}
                    </p>
                    <p className="text-xs text-[hsl(var(--text-subtle))] truncate">
                      {row.teamName ?? "Sin equipo"} • {row.gamesPlayed} juegos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[hsl(var(--primary))] tabular-nums">{row.finalScore.toFixed(3)}</p>
                    <p className="text-[11px] text-[hsl(var(--text-subtle))]">MVP score</p>
                    {onPlayerSelect ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onPlayerSelect(row.playerId, phase);
                        }}
                        className="mt-1 inline-flex items-center justify-center rounded-md border px-2 py-1 text-[10px] font-semibold hover:bg-[hsl(var(--surface-2))]"
                      >
                        Ver detalle
                      </button>
                    ) : null}
                  </div>
                </div>
              </summary>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">PPG: {row.perGame.ppg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">RPG: {row.perGame.rpg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">APG: {row.perGame.apg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">SPG: {row.perGame.spg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">BPG: {row.perGame.bpg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">PRA: {formatPra(row)}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">PIE Share: {formatPct(row.pieShare)}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">FG%: {row.fgPct}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">3P%: {row.tpPct}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">TS%: {formatPlainPct(row.tsPct)}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">TOPG: {row.perGame.topg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">FPG: {row.perGame.fpg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">VAL/PJ: {row.valuationPerGame.toFixed(2)}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">
                  Record equipo: {formatPct(row.teamFactor)}
                </div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">
                  Disponibilidad: {formatPct(row.availabilityRate)} · Min MVP: {row.eligibilityThreshold} PJ
                </div>
              </div>

              <div className="mt-3 border rounded-lg bg-[hsl(var(--surface-2)/0.45)] p-2.5 text-[11px]">
                <p className="font-semibold text-[hsl(var(--text-strong))]">Desglose del score</p>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5 tabular-nums">
                  <p>Ofensiva: {formatSigned(row.componentScore.offense)}</p>
                  <p>Creación: {formatSigned(row.componentScore.playmaking)}</p>
                  <p>Rebotes: {formatSigned(row.componentScore.boards)}</p>
                  <p>Defensa: {formatSigned(row.componentScore.defense)}</p>
                  <p>Eficiencia: {formatSigned(row.componentScore.efficiency)}</p>
                  <p>Impacto: {formatSigned(row.componentScore.impact)}</p>
                  <p>Durabilidad: {formatSigned(row.componentScore.durability)}</p>
                  <p>Record equipo: {formatSigned(row.componentScore.teamRecord)}</p>
                  <p>Pérdidas: {formatSigned(row.componentScore.turnovers)}</p>
                  <p>Faltas: {formatSigned(row.componentScore.fouls)}</p>
                </div>
              </div>
            </details>
          );
          })}
        </div>
      )}
    </section>
  );
};

export default MvpPanel;
