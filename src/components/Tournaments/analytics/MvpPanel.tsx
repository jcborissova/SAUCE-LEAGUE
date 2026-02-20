import React from "react";
import type { MvpBreakdownRow } from "../../../types/tournament-analytics";
import AnalyticsEmptyState from "./AnalyticsEmptyState";

type MvpPanelProps = {
  rows: MvpBreakdownRow[];
  loading: boolean;
  title: string;
  subtitle: string;
};

const MvpPanel: React.FC<MvpPanelProps> = ({ rows, loading, title, subtitle }) => {
  return (
    <section className="space-y-4">
      <article className="app-panel p-4 text-sm text-[hsl(var(--text-subtle))] leading-relaxed">
        <h4 className="font-semibold text-[hsl(var(--text-strong))] mb-1">{title}</h4>
        <p>{subtitle}</p>
        <p className="mt-2 text-xs">
          Score = 0.30*z(PPG) + 0.20*z(APG) + 0.20*z(RPG) + 0.10*z(SPG) + 0.10*z(BPG) + 0.10*z(FG%) - 0.15*z(TOPG)
          - 0.05*z(FPG) + 0.10*z(team factor).
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
          {rows.map((row, index) => (
            <details key={row.playerId} className="app-card p-3 sm:p-4 group" open={index === 0}>
              <summary className="list-none cursor-pointer">
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
                    <p className="text-lg font-black text-[hsl(var(--primary))] tabular-nums">{row.finalScore.toFixed(3)}</p>
                    <p className="text-[11px] text-[hsl(var(--text-subtle))]">MVP score</p>
                  </div>
                </div>
              </summary>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">PPG: {row.perGame.ppg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">RPG: {row.perGame.rpg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">APG: {row.perGame.apg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">SPG: {row.perGame.spg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">BPG: {row.perGame.bpg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">FG%: {row.fgPct}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">TOPG: {row.perGame.topg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">FPG: {row.perGame.fpg}</div>
                <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-2.5 py-2">Team factor: {row.teamFactor.toFixed(3)}</div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
};

export default MvpPanel;
