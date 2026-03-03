import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, ChartBarIcon } from "@heroicons/react/24/solid";

import Badge from "./ui/Badge";
import type { PlayerTournamentStatSummary } from "../services/playerTournamentStats";
import { getPlayerStatsByTournament } from "../services/playerTournamentStats";

type Props = {
  playerId: number;
  enabled?: boolean;
  compact?: boolean;
  className?: string;
};

const formatTournamentDate = (value: string | null) => {
  if (!value) return "Fecha no registrada";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const metricCardClassName =
  "rounded-[10px] border bg-[hsl(var(--surface-1))] px-2.5 py-2 shadow-[0_1px_0_hsl(var(--border)/0.24)]";

const formatSigned = (value: number, digits = 1) => {
  const fixed = value.toFixed(digits);
  if (value > 0) return `+${fixed}`;
  return fixed;
};

const PlayerTournamentStatsPanel: React.FC<Props> = ({
  playerId,
  enabled = true,
  compact = false,
  className = "",
}) => {
  const [rows, setRows] = useState<PlayerTournamentStatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !playerId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const data = await getPlayerStatsByTournament(playerId);
        if (!cancelled) setRows(data);
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las estadísticas del jugador.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, playerId]);

  const visibleRows = useMemo(() => (compact ? rows.slice(0, 4) : rows), [compact, rows]);

  return (
    <section className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border bg-[hsl(var(--surface-2))] text-[hsl(var(--primary))]">
            <ChartBarIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Números por torneo</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Totales y promedios del jugador, separados por torneo.
            </p>
          </div>
        </div>
        {compact && rows.length > visibleRows.length ? (
          <Badge>{visibleRows.length} de {rows.length}</Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.45)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
          <span className="inline-flex items-center gap-2">
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            Cargando estadísticas por torneo...
          </span>
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="rounded-[10px] border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.08)] p-3 text-sm text-[hsl(var(--destructive))]">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && visibleRows.length === 0 ? (
        <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.45)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
          Aún no hay estadísticas registradas para este jugador en torneos.
        </div>
      ) : null}

      {!loading && !errorMessage && visibleRows.length > 0 ? (
        <div className="space-y-3">
          {visibleRows.map((item) => (
            <article
              key={`${item.tournamentId}-${item.line.playerId}`}
              className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3 shadow-[0_4px_14px_hsl(var(--background)/0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--text-strong))] sm:text-base">{item.tournamentName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {formatTournamentDate(item.tournamentStartDate)} · {item.line.teamName ?? "Equipo no detectado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="primary">{item.line.gamesPlayed} PJ</Badge>
                  <Badge variant="success">{item.line.totals.points} pts</Badge>
                  <Badge>{`Val ${item.line.valuation.toFixed(1)}`}</Badge>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PPP</p>
                  <p className="text-sm font-bold tabular-nums">{item.line.perGame.ppg.toFixed(1)}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">RPP</p>
                  <p className="text-sm font-bold tabular-nums">{item.line.perGame.rpg.toFixed(1)}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">APP</p>
                  <p className="text-sm font-bold tabular-nums">{item.line.perGame.apg.toFixed(1)}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FG%</p>
                  <p className="text-sm font-bold tabular-nums">{item.line.fgPct.toFixed(1)}%</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">+/- PJ</p>
                  <p className="text-sm font-bold tabular-nums">{formatSigned(item.line.perGame.plusMinus, 1)}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Val/PJ</p>
                  <p className="text-sm font-bold tabular-nums">{item.line.valuationPerGame.toFixed(1)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Reb</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.rebounds}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Ast</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.assists}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Stl</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.steals}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Blk</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.blocks}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">+/- Total</p>
                  <p className="text-sm font-semibold tabular-nums">{formatSigned(item.line.totals.plusMinus, 0)}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Tov</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.turnovers}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Fouls</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.fouls}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FG</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.fgm}/{item.line.totals.fga}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FT</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.ftm}/{item.line.totals.fta}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">3PT</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.totals.tpm}/{item.line.totals.tpa}</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FT%</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.ftPct.toFixed(1)}%</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">3P%</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.tpPct.toFixed(1)}%</p>
                </div>
                <div className={metricCardClassName}>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">TOPG</p>
                  <p className="text-sm font-semibold tabular-nums">{item.line.perGame.topg.toFixed(1)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default PlayerTournamentStatsPanel;
