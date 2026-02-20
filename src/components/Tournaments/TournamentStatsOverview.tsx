import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon, BoltIcon, FireIcon } from "@heroicons/react/24/solid";

import {
  getAnalyticsDashboardKpis,
  getBattleData,
  getLeaders,
  getMvpRace,
  listTournamentPlayers,
} from "../../services/tournamentAnalytics";
import type {
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  TournamentAnalyticsKpi,
  TournamentLeaderRow,
  TournamentPhaseFilter,
  MvpBreakdownRow,
} from "../../types/tournament-analytics";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import LoadingSpinner from "../LoadingSpinner";

type StatsFocus = "points" | "rebounds" | "assists" | "mvp" | "duel";
type PerGameMetricKey = "ppg" | "rpg" | "apg";

type FullLeaderItem = {
  playerId: number;
  name: string;
  teamName: string | null;
  valuePrimaryText: string;
  valueSecondaryText?: string;
  helperText: string;
};

const PHASE_OPTIONS: Array<{ value: TournamentPhaseFilter; label: string }> = [
  { value: "regular", label: "Temporada regular" },
  { value: "playoffs", label: "Playoffs" },
  { value: "all", label: "Todas las fases" },
];

const FOCUS_OPTIONS: Array<{ value: Exclude<StatsFocus, "duel">; label: string }> = [
  { value: "points", label: "Puntos" },
  { value: "rebounds", label: "Rebotes" },
  { value: "assists", label: "Asistencias" },
  { value: "mvp", label: "MVP" },
];

const focusMeta: Record<
  Exclude<StatsFocus, "mvp" | "duel">,
  {
    title: string;
    tabLabel: string;
    metricLabel: string;
    metric: "points" | "rebounds" | "assists";
    perGameKey: PerGameMetricKey;
    totalKey: "points" | "rebounds" | "assists";
  }
> = {
  points: {
    title: "Líderes de puntos",
    tabLabel: "Puntos",
    metricLabel: "PPP",
    metric: "points",
    perGameKey: "ppg",
    totalKey: "points",
  },
  rebounds: {
    title: "Líderes de rebotes",
    tabLabel: "Rebotes",
    metricLabel: "RPP",
    metric: "rebounds",
    perGameKey: "rpg",
    totalKey: "rebounds",
  },
  assists: {
    title: "Líderes de asistencias",
    tabLabel: "Asistencias",
    metricLabel: "APP",
    metric: "assists",
    perGameKey: "apg",
    totalKey: "assists",
  },
};

type DuelPlayerOption = {
  playerId: number;
  name: string;
  teamName: string | null;
};

type DuelResult = {
  players: BattlePlayerResult[];
  summary: BattleSummary;
};

type DuelMetricMeta = {
  label: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
};

const DUEL_METRICS: BattleMetric[] = ["ppg", "rpg", "apg", "spg", "bpg", "fg_pct", "topg"];

const DUEL_METRIC_META: Record<BattleMetric, DuelMetricMeta> = {
  ppg: {
    label: "PPP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  rpg: {
    label: "RPP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  apg: {
    label: "APP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  spg: {
    label: "ROB",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  bpg: {
    label: "BLK",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  fg_pct: {
    label: "FG%",
    higherIsBetter: true,
    format: (value) => `${value.toFixed(1)}%`,
  },
  topg: {
    label: "PÉRD",
    higherIsBetter: false,
    format: (value) => value.toFixed(1),
  },
};

const getDuelRatio = (
  leftValue: number,
  rightValue: number,
  higherIsBetter: boolean
): { leftRatio: number; rightRatio: number } => {
  if (higherIsBetter) {
    const leftScore = Math.max(0, leftValue);
    const rightScore = Math.max(0, rightValue);
    const total = leftScore + rightScore;
    if (total === 0) return { leftRatio: 50, rightRatio: 50 };
    return { leftRatio: (leftScore / total) * 100, rightRatio: (rightScore / total) * 100 };
  }

  const epsilon = 0.25;
  const leftScore = 1 / (Math.max(0, leftValue) + epsilon);
  const rightScore = 1 / (Math.max(0, rightValue) + epsilon);
  const total = leftScore + rightScore;
  if (total === 0) return { leftRatio: 50, rightRatio: 50 };
  return { leftRatio: (leftScore / total) * 100, rightRatio: (rightScore / total) * 100 };
};

const TournamentStatsOverview: React.FC<{ tournamentId: string; embedded?: boolean; mode?: "default" | "duel" }> = ({
  tournamentId,
  embedded = false,
  mode = "default",
}) => {
  const isDuelMode = mode === "duel";
  const [phase, setPhase] = useState<TournamentPhaseFilter>("regular");
  const [focus, setFocus] = useState<StatsFocus>(isDuelMode ? "duel" : "points");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<TournamentAnalyticsKpi[]>([]);
  const [pointsLeaders, setPointsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [reboundsLeaders, setReboundsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [assistsLeaders, setAssistsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [mvpRows, setMvpRows] = useState<MvpBreakdownRow[]>([]);

  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [fullLeadersLoading, setFullLeadersLoading] = useState(false);
  const [fullLeadersError, setFullLeadersError] = useState<string | null>(null);
  const [fullLeadersRows, setFullLeadersRows] = useState<TournamentLeaderRow[]>([]);
  const [fullLeadersKey, setFullLeadersKey] = useState<string | null>(null);

  const [duelPlayers, setDuelPlayers] = useState<DuelPlayerOption[]>([]);
  const [duelPlayersLoading, setDuelPlayersLoading] = useState(false);
  const [duelLoading, setDuelLoading] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);
  const [duelPlayerA, setDuelPlayerA] = useState<number | "">("");
  const [duelPlayerB, setDuelPlayerB] = useState<number | "">("");
  const [duelResult, setDuelResult] = useState<DuelResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [nextKpis, points, rebounds, assists, mvp] = await Promise.all([
          getAnalyticsDashboardKpis(tournamentId),
          getLeaders({ tournamentId, phase, metric: "points", limit: 5 }),
          getLeaders({ tournamentId, phase, metric: "rebounds", limit: 5 }),
          getLeaders({ tournamentId, phase, metric: "assists", limit: 5 }),
          getMvpRace({
            tournamentId,
            phase: phase === "all" ? "regular" : phase === "playoffs" ? "playoffs" : "regular",
          }),
        ]);

        if (cancelled) return;

        setKpis(nextKpis);
        setPointsLeaders(points);
        setReboundsLeaders(rebounds);
        setAssistsLeaders(assists);
        setMvpRows(mvp);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las estadísticas.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tournamentId, phase]);

  useEffect(() => {
    if (!fullViewOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullViewOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [fullViewOpen]);

  useEffect(() => {
    if (isDuelMode) {
      if (focus !== "duel") setFocus("duel");
      return;
    }

    if (focus === "duel") setFocus("points");
  }, [focus, isDuelMode]);

  useEffect(() => {
    if (focus !== "duel") return;

    let cancelled = false;
    const loadDuelPlayers = async () => {
      setDuelPlayersLoading(true);
      setDuelError(null);

      try {
        const rows = await listTournamentPlayers(tournamentId, phase);
        if (cancelled) return;

        setDuelPlayers(rows);
        const availableIds = new Set(rows.map((player) => player.playerId));

        setDuelPlayerA((prev) => (typeof prev === "number" && availableIds.has(prev) ? prev : ""));
        setDuelPlayerB((prev) => (typeof prev === "number" && availableIds.has(prev) ? prev : ""));
        setDuelResult(null);
      } catch (err) {
        if (!cancelled) {
          setDuelPlayers([]);
          setDuelError(err instanceof Error ? err.message : "No se pudieron cargar jugadores para el duelo.");
        }
      } finally {
        if (!cancelled) setDuelPlayersLoading(false);
      }
    };

    loadDuelPlayers();

    return () => {
      cancelled = true;
    };
  }, [focus, tournamentId, phase]);

  const hasContent = useMemo(
    () =>
      pointsLeaders.length > 0 ||
      reboundsLeaders.length > 0 ||
      assistsLeaders.length > 0 ||
      mvpRows.length > 0,
    [pointsLeaders.length, reboundsLeaders.length, assistsLeaders.length, mvpRows.length]
  );

  const previewRows = useMemo(() => {
    if (focus === "points") return pointsLeaders;
    if (focus === "rebounds") return reboundsLeaders;
    if (focus === "assists") return assistsLeaders;
    return [];
  }, [focus, pointsLeaders, reboundsLeaders, assistsLeaders]);

  const hasFocusContent = useMemo(() => {
    if (focus === "mvp") return mvpRows.length > 0;
    if (focus === "duel") return duelPlayers.length >= 2;
    return previewRows.length > 0;
  }, [focus, previewRows.length, mvpRows.length, duelPlayers.length]);

  const previewMvpRows = useMemo(() => mvpRows.slice(0, 5), [mvpRows]);

  const focusTitle = useMemo(() => {
    if (focus === "mvp") return "Carrera MVP";
    if (focus === "duel") return "Duelo 1v1";
    return focusMeta[focus].title;
  }, [focus]);

  const fullViewTitle = useMemo(() => {
    if (focus === "mvp") return "Ranking MVP completo";
    if (focus === "duel") return "Ranking completo";
    return `${focusMeta[focus].title} (Ranking completo)`;
  }, [focus]);

  const fullViewValueLabel = useMemo(() => {
    if (focus === "mvp") return "Score";
    if (focus === "duel") return "Valor";
    return focusMeta[focus].metricLabel;
  }, [focus]);

  const fullViewSecondaryLabel = useMemo(() => {
    if (focus === "mvp" || focus === "duel") return undefined;
    return "Total";
  }, [focus]);

  const openFullLeaders = async () => {
    setFullViewOpen(true);
    setFullLeadersError(null);

    if (focus === "mvp" || focus === "duel") return;

    const metricInfo = focusMeta[focus];
    const nextKey = `${tournamentId}:${phase}:${metricInfo.metric}`;
    if (fullLeadersKey === nextKey && fullLeadersRows.length > 0) return;

    setFullLeadersLoading(true);
    setFullLeadersRows([]);

    try {
      const rows = await getLeaders({
        tournamentId,
        phase,
        metric: metricInfo.metric,
        limit: 500,
      });
      setFullLeadersRows(rows);
      setFullLeadersKey(nextKey);
    } catch (err) {
      setFullLeadersError(err instanceof Error ? err.message : "No se pudo cargar el ranking completo.");
    } finally {
      setFullLeadersLoading(false);
    }
  };

  const retryFullLeaders = async () => {
    if (focus === "mvp" || focus === "duel") return;
    setFullLeadersKey(null);
    await openFullLeaders();
  };

  const fullRows = useMemo<FullLeaderItem[]>(() => {
    if (focus === "mvp") {
      return mvpRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        teamName: row.teamName,
        valuePrimaryText: row.finalScore.toFixed(3),
        helperText: `PJ ${row.gamesPlayed} · Elegible`,
      }));
    }

    if (focus === "duel") {
      return [];
    }

    const metricInfo = focusMeta[focus];
    return fullLeadersRows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      teamName: row.teamName,
      valuePrimaryText: row.perGame[metricInfo.perGameKey].toFixed(1),
      valueSecondaryText: String(row.totals[metricInfo.totalKey]),
      helperText: `PJ ${row.gamesPlayed}`,
    }));
  }, [focus, mvpRows, fullLeadersRows]);

  const canCompareDuel =
    typeof duelPlayerA === "number" &&
    typeof duelPlayerB === "number" &&
    duelPlayerA !== duelPlayerB;

  const duelRows = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return [];

    const [leftPlayer, rightPlayer] = duelResult.players;

    return DUEL_METRICS.map((metric) => {
      const meta = DUEL_METRIC_META[metric];
      const leftValue = leftPlayer.metrics[metric];
      const rightValue = rightPlayer.metrics[metric];
      const leaders = duelResult.summary.perMetricLeader[metric] ?? [];
      const winnerId = leaders.length === 1 ? leaders[0] : null;

      return {
        metric,
        meta,
        leftPlayer,
        rightPlayer,
        leftValue,
        rightValue,
        winnerId,
        ratio: getDuelRatio(leftValue, rightValue, meta.higherIsBetter),
      };
    });
  }, [duelResult]);

  const duelStory = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return "";

    const [leftPlayer, rightPlayer] = duelResult.players;
    const leftWins = duelResult.summary.categoryWins[leftPlayer.playerId] ?? 0;
    const rightWins = duelResult.summary.categoryWins[rightPlayer.playerId] ?? 0;
    const diff = Math.abs(leftWins - rightWins);

    if (leftWins === rightWins) {
      return "Empate técnico: ambos tienen derecho a hablar basura hasta el próximo duelo.";
    }

    const winner = leftWins > rightWins ? leftPlayer.name : rightPlayer.name;
    const loser = leftWins > rightWins ? rightPlayer.name : leftPlayer.name;

    if (diff >= 4) {
      return `${winner} le pasó el rolo a ${loser}. Dominio total en este battle.`;
    }

    if (diff >= 2) {
      return `${winner} se llevó el duelo con autoridad. ${loser} pide revancha.`;
    }

    return `${winner} ganó por la mínima. ${loser} sigue respirándole en la nuca.`;
  }, [duelResult]);

  const handleCompareDuel = async () => {
    if (!canCompareDuel) {
      setDuelError("Selecciona dos jugadores distintos para comparar.");
      return;
    }

    setDuelLoading(true);
    setDuelError(null);

    try {
      const data = await getBattleData({
        tournamentId,
        playerIds: [duelPlayerA, duelPlayerB],
        metrics: DUEL_METRICS,
        phase,
      });
      setDuelResult(data);
    } catch (err) {
      setDuelResult(null);
      setDuelError(err instanceof Error ? err.message : "No se pudo generar la comparación.");
    } finally {
      setDuelLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      {!embedded ? (
        <header className="space-y-1">
          <h3 className="text-xl font-bold sm:text-2xl">{isDuelMode ? "Duelo de jugadores" : "Estadísticas"}</h3>
          {isDuelMode ? (
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Compara dos jugadores cara a cara con resultado final y lectura rápida.
            </p>
          ) : (
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Vista simplificada para revisar líderes y carrera MVP sin ruido visual.
            </p>
          )}
        </header>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          {isDuelMode ? "Modo duelo: comparación directa entre dos jugadores." : "Estadísticas clave del torneo en formato simple."}
        </p>
      )}

      <div className={`grid gap-2 ${isDuelMode ? "grid-cols-1 sm:max-w-xs" : "grid-cols-1 sm:grid-cols-2"}`}>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Fase</span>
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value as TournamentPhaseFilter)}
            className="input-base"
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={`phase-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {!isDuelMode ? (
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Métrica</span>
            <select
              value={focus}
              onChange={(event) => setFocus(event.target.value as Exclude<StatsFocus, "duel">)}
              className="input-base"
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={`focus-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : null}

      {error ? (
        <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      {!loading && !hasContent && focus !== "duel" ? (
        <EmptyState
          title="Sin estadísticas disponibles"
          description="Carga resultados de partidos para ver líderes del torneo."
        />
      ) : null}

      {!loading && (hasContent || focus === "duel") ? (
        <>
          {!isDuelMode && kpis.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kpis.slice(0, 4).map((kpi) => (
                <article key={kpi.id} className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{kpi.label}</p>
                  <p className="text-sm font-bold sm:text-base">{kpi.value}</p>
                  <p className="truncate text-xs text-[hsl(var(--text-subtle))]">{kpi.helper}</p>
                </article>
              ))}
            </div>
          ) : null}

          {focus === "duel" ? (
            <SectionCard
              title="Duelo 1v1"
              description="Compara dos jugadores en todas las métricas clave con un veredicto claro."
              actions={
                <button
                  type="button"
                  onClick={handleCompareDuel}
                  disabled={!canCompareDuel || duelLoading}
                  className="btn-primary min-h-[36px] px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {duelLoading ? "Comparando..." : "Comparar ahora"}
                </button>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Jugador A</span>
                    <select
                      value={duelPlayerA}
                      onChange={(event) => setDuelPlayerA(event.target.value ? Number(event.target.value) : "")}
                      className="input-base"
                    >
                      <option value="">Seleccionar</option>
                      {duelPlayers.map((player) => (
                        <option key={`duel-a-${player.playerId}`} value={player.playerId}>
                          {player.name} {player.teamName ? `(${player.teamName})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Jugador B</span>
                    <select
                      value={duelPlayerB}
                      onChange={(event) => setDuelPlayerB(event.target.value ? Number(event.target.value) : "")}
                      className="input-base"
                    >
                      <option value="">Seleccionar</option>
                      {duelPlayers.map((player) => (
                        <option key={`duel-b-${player.playerId}`} value={player.playerId}>
                          {player.name} {player.teamName ? `(${player.teamName})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  Modo jocoso activado: aquí se define quién manda en la cancha, sin lloros.
                </p>

                {duelPlayersLoading ? <LoadingSpinner label="Cargando jugadores para duelo" /> : null}
                {duelError ? (
                  <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                    {duelError}
                  </div>
                ) : null}

                {duelResult && duelResult.players.length === 2 ? (
                  <div className="space-y-3">
                    <article className="rounded-lg border bg-[hsl(var(--surface-2)/0.72)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1 text-sm font-semibold">
                          <FireIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                          {duelResult.summary.overallWinnerName
                            ? `Ganador: ${duelResult.summary.overallWinnerName}`
                            : "Empate técnico"}
                        </p>
                        <p className="text-xs text-[hsl(var(--text-subtle))]">Fase: {phase}</p>
                      </div>
                      <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">{duelStory}</p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {duelResult.players.map((player) => (
                          <div key={`duel-score-${player.playerId}`} className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2">
                            <p className="truncate text-xs text-[hsl(var(--text-subtle))]">{player.name}</p>
                            <p className="text-lg font-black tabular-nums">
                              {duelResult.summary.categoryWins[player.playerId] ?? 0}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--text-subtle))]">categorías ganadas</p>
                          </div>
                        ))}
                      </div>
                    </article>

                    <div className="space-y-2">
                      {duelRows.map((row) => {
                        const winnerName =
                          row.winnerId === null
                            ? "Empate"
                            : row.winnerId === row.leftPlayer.playerId
                            ? row.leftPlayer.name
                            : row.rightPlayer.name;

                        return (
                          <article key={`duel-metric-${row.metric}`} className="rounded-lg border bg-[hsl(var(--surface-2)/0.65)] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{row.meta.label}</p>
                              <span className="inline-flex items-center gap-1 rounded-md border bg-[hsl(var(--surface-1))] px-2 py-0.5 text-[11px]">
                                <BoltIcon className="h-3 w-3 text-[hsl(var(--primary))]" />
                                {winnerName}
                              </span>
                            </div>

                            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                              <p className="truncate text-right font-semibold tabular-nums">{row.meta.format(row.leftValue)}</p>
                              <span className="text-[hsl(var(--text-subtle))]">vs</span>
                              <p className="truncate font-semibold tabular-nums">{row.meta.format(row.rightValue)}</p>
                            </div>

                            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-1))]">
                              <span className="bg-[hsl(var(--primary))]" style={{ width: `${row.ratio.leftRatio}%` }} />
                              <span className="bg-[hsl(var(--chart-5))]" style={{ width: `${row.ratio.rightRatio}%` }} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title={focusTitle}
              description="Top 5 del torneo"
              actions={
                hasFocusContent ? (
                  <button
                    type="button"
                    onClick={openFullLeaders}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
                  >
                    Ver todo
                  </button>
                ) : undefined
              }
            >
              {focus === "mvp" ? (
                <div className="space-y-2">
                  {previewMvpRows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--text-subtle))]">No hay datos MVP para esta fase.</p>
                  ) : (
                    previewMvpRows.map((row, index) => (
                      <div
                        key={row.playerId}
                        className="flex items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            #{index + 1} {row.name}
                          </p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">{row.finalScore.toFixed(3)}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {previewRows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--text-subtle))]">No hay datos para esta métrica.</p>
                  ) : (
                    previewRows.map((row, index) => {
                      const metricInfo = focusMeta[focus];
                      return (
                        <div
                          key={row.playerId}
                          className="flex items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              #{index + 1} {row.name}
                            </p>
                            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums">
                              {metricInfo.metricLabel} {row.perGame[metricInfo.perGameKey].toFixed(1)}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                              Total {row.totals[metricInfo.totalKey]}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </SectionCard>
          )}
        </>
      ) : null}

      {fullViewOpen ? (
        <LeadersFullscreen
          title={fullViewTitle}
          valuePrimaryLabel={fullViewValueLabel}
          valueSecondaryLabel={fullViewSecondaryLabel}
          rows={fullRows}
          loading={focus === "mvp" ? false : fullLeadersLoading}
          errorMessage={focus === "mvp" ? null : fullLeadersError}
          onBack={() => setFullViewOpen(false)}
          onRetry={focus === "mvp" ? undefined : retryFullLeaders}
        />
      ) : null}
    </section>
  );
};

const LeadersFullscreen = ({
  title,
  valuePrimaryLabel,
  valueSecondaryLabel,
  rows,
  loading,
  errorMessage,
  onBack,
  onRetry,
}: {
  title: string;
  valuePrimaryLabel: string;
  valueSecondaryLabel?: string;
  rows: FullLeaderItem[];
  loading: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onRetry?: () => void;
}) => {
  const hasSecondary = Boolean(valueSecondaryLabel);
  const headerGridClass = hasSecondary
    ? "grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b bg-[hsl(var(--surface-2))] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]"
    : "grid grid-cols-[auto_1fr_auto] gap-3 border-b bg-[hsl(var(--surface-2))] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]";
  const rowGridClass = hasSecondary
    ? "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-sm"
    : "grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 text-sm";

  return (
    <div className="fixed inset-0 z-[70] bg-[hsl(var(--background))]">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b bg-[hsl(var(--surface-1))] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs sm:text-sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Volver
            </button>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">{rows.length} jugadores</p>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          {loading ? (
            <LoadingSpinner label="Cargando ranking completo" />
          ) : errorMessage ? (
            <div className="space-y-3">
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </div>
              {onRetry ? (
                <button className="btn-secondary" onClick={onRetry}>
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[hsl(var(--text-subtle))]">No hay jugadores para mostrar en este ranking.</p>
          ) : (
            <section className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
              <div className={headerGridClass}>
                <span>Rank</span>
                <span>Jugador</span>
                <span>{valuePrimaryLabel}</span>
                {hasSecondary ? <span>{valueSecondaryLabel}</span> : null}
              </div>
              <div className="divide-y">
                {rows.map((row, index) => (
                  <article key={row.playerId} className={rowGridClass}>
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-[hsl(var(--surface-2))] px-2 text-xs font-semibold">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.name}</p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {row.teamName ?? "Sin equipo"} · {row.helperText}
                      </p>
                    </div>
                    <p className="text-right font-semibold tabular-nums">{row.valuePrimaryText}</p>
                    {hasSecondary ? (
                      <p className="text-right font-semibold tabular-nums">{row.valueSecondaryText ?? "-"}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentStatsOverview;
