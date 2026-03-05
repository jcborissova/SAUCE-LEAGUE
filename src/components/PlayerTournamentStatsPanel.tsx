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

const computePraPerGame = (item: PlayerTournamentStatSummary) =>
  item.line.perGame.ppg + item.line.perGame.rpg + item.line.perGame.apg - item.line.perGame.topg;

const computePraTotal = (item: PlayerTournamentStatSummary) =>
  item.line.totals.points + item.line.totals.rebounds + item.line.totals.assists - item.line.totals.turnovers;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type PlayerLevel = {
  grade: "S" | "A" | "B" | "C" | "D" | "E";
  label: string;
  variant: "primary" | "success" | "warning" | "danger";
  score: number;
  sampleGames: number;
  ppg: number;
  praPerGame: number;
  valuationPerGame: number;
  fgPct: number;
  topg: number;
};

const levelToneClassByVariant: Record<PlayerLevel["variant"], string> = {
  primary: "border-[hsl(var(--primary)/0.32)] bg-[hsl(var(--primary)/0.1)]",
  success: "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.11)]",
  warning: "border-[hsl(var(--warning)/0.34)] bg-[hsl(var(--warning)/0.12)]",
  danger: "border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)]",
};

const buildPlayerLevel = (rows: PlayerTournamentStatSummary[]): PlayerLevel | null => {
  if (rows.length === 0) return null;

  const aggregate = rows.reduce(
    (acc, item) => {
      const { totals, valuation, gamesPlayed } = item.line;
      acc.games += gamesPlayed;
      acc.points += totals.points;
      acc.rebounds += totals.rebounds;
      acc.assists += totals.assists;
      acc.steals += totals.steals;
      acc.blocks += totals.blocks;
      acc.turnovers += totals.turnovers;
      acc.fouls += totals.fouls;
      acc.fgm += totals.fgm;
      acc.fga += totals.fga;
      acc.valuation += valuation;
      return acc;
    },
    {
      games: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fgm: 0,
      fga: 0,
      valuation: 0,
    }
  );

  if (aggregate.games <= 0) return null;

  const games = aggregate.games;
  const ppg = aggregate.points / games;
  const praPerGame = (aggregate.points + aggregate.rebounds + aggregate.assists - aggregate.turnovers) / games;
  const valuationPerGame = aggregate.valuation / games;
  const fgPct = aggregate.fga > 0 ? (aggregate.fgm / aggregate.fga) * 100 : 0;
  const topg = aggregate.turnovers / games;
  const stocksPerGame = (aggregate.steals + aggregate.blocks) / games;

  const availability = clamp01(games / 22);
  const ballSecurity = clamp01(1 - topg / 4.2);

  const scoreRaw =
    clamp01(ppg / 30) * 22 +
    clamp01(praPerGame / 36) * 24 +
    clamp01(valuationPerGame / 30) * 22 +
    clamp01(fgPct / 58) * 10 +
    clamp01(stocksPerGame / 3.2) * 8 +
    availability * 8 +
    ballSecurity * 6;

  const score = Number(scoreRaw.toFixed(1));

  if (score >= 92) {
    return {
      grade: "S",
      label: "Superestrella",
      variant: "success",
      score,
      sampleGames: games,
      ppg: Number(ppg.toFixed(1)),
      praPerGame: Number(praPerGame.toFixed(1)),
      valuationPerGame: Number(valuationPerGame.toFixed(1)),
      fgPct: Number(fgPct.toFixed(1)),
      topg: Number(topg.toFixed(1)),
    };
  }

  if (score >= 84) {
    return {
      grade: "A",
      label: "Alto impacto",
      variant: "success",
      score,
      sampleGames: games,
      ppg: Number(ppg.toFixed(1)),
      praPerGame: Number(praPerGame.toFixed(1)),
      valuationPerGame: Number(valuationPerGame.toFixed(1)),
      fgPct: Number(fgPct.toFixed(1)),
      topg: Number(topg.toFixed(1)),
    };
  }

  if (score >= 76) {
    return {
      grade: "B",
      label: "Rendimiento sólido",
      variant: "primary",
      score,
      sampleGames: games,
      ppg: Number(ppg.toFixed(1)),
      praPerGame: Number(praPerGame.toFixed(1)),
      valuationPerGame: Number(valuationPerGame.toFixed(1)),
      fgPct: Number(fgPct.toFixed(1)),
      topg: Number(topg.toFixed(1)),
    };
  }

  if (score >= 68) {
    return {
      grade: "C",
      label: "Nivel competitivo",
      variant: "warning",
      score,
      sampleGames: games,
      ppg: Number(ppg.toFixed(1)),
      praPerGame: Number(praPerGame.toFixed(1)),
      valuationPerGame: Number(valuationPerGame.toFixed(1)),
      fgPct: Number(fgPct.toFixed(1)),
      topg: Number(topg.toFixed(1)),
    };
  }

  if (score >= 58) {
    return {
      grade: "D",
      label: "En desarrollo",
      variant: "warning",
      score,
      sampleGames: games,
      ppg: Number(ppg.toFixed(1)),
      praPerGame: Number(praPerGame.toFixed(1)),
      valuationPerGame: Number(valuationPerGame.toFixed(1)),
      fgPct: Number(fgPct.toFixed(1)),
      topg: Number(topg.toFixed(1)),
    };
  }

  return {
    grade: "E",
    label: "Necesita evolución",
    variant: "danger",
    score,
    sampleGames: games,
    ppg: Number(ppg.toFixed(1)),
    praPerGame: Number(praPerGame.toFixed(1)),
    valuationPerGame: Number(valuationPerGame.toFixed(1)),
    fgPct: Number(fgPct.toFixed(1)),
    topg: Number(topg.toFixed(1)),
  };
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
  const playerLevel = useMemo(() => buildPlayerLevel(rows), [rows]);

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

      {!compact && !loading && !errorMessage && playerLevel ? (
        <article className={`rounded-[12px] border p-3 ${levelToneClassByVariant[playerLevel.variant]}`.trim()}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Nivel real</p>
              <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">
                {playerLevel.label} · Score {playerLevel.score.toFixed(1)}/100
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Muestra analizada: {playerLevel.sampleGames} juegos (todos los torneos del jugador).
              </p>
            </div>
            <Badge variant={playerLevel.variant} className="px-3 py-1.5 text-sm">
              {playerLevel.grade}
            </Badge>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className={metricCardClassName}>
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PPP</p>
              <p className="text-sm font-bold tabular-nums">{playerLevel.ppg.toFixed(1)}</p>
            </div>
            <div className={metricCardClassName}>
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PRA PJ</p>
              <p className="text-sm font-bold tabular-nums">{playerLevel.praPerGame.toFixed(1)}</p>
            </div>
            <div className={metricCardClassName}>
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Val/PJ</p>
              <p className="text-sm font-bold tabular-nums">{playerLevel.valuationPerGame.toFixed(1)}</p>
            </div>
            <div className={metricCardClassName}>
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FG%</p>
              <p className="text-sm font-bold tabular-nums">{playerLevel.fgPct.toFixed(1)}%</p>
            </div>
            <div className={metricCardClassName}>
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">TOPG</p>
              <p className="text-sm font-bold tabular-nums">{playerLevel.topg.toFixed(1)}</p>
            </div>
          </div>
        </article>
      ) : null}

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
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PRA PJ</p>
                  <p className="text-sm font-bold tabular-nums">{computePraPerGame(item).toFixed(1)}</p>
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
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PRA Total</p>
                  <p className="text-sm font-semibold tabular-nums">{computePraTotal(item).toFixed(0)}</p>
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
