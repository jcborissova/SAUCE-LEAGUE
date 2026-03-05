import React, { useEffect, useMemo, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  HandRaisedIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";
import type {
  MvpBreakdownRow,
  PlayerStatsLine,
  TournamentAnalyticsPlayerGame,
  TournamentPhaseFilter,
} from "../../../types/tournament-analytics";
import { computeImpactScore, computeValuation, round2 } from "../../../utils/tournament-stats";
import { buildPlayerDeepInsight, type InsightBadgeIcon } from "../../../utils/player-insights";
import ModalShell from "../../ui/ModalShell";
import Badge from "../../ui/Badge";

export type PlayerAnalyticsGameDetail = TournamentAnalyticsPlayerGame & {
  pra: number;
};

export type PlayerAnalyticsDetail = {
  phase: TournamentPhaseFilter;
  line: PlayerStatsLine;
  games: PlayerAnalyticsGameDetail[];
  mvpRow: MvpBreakdownRow | null;
  phaseLines?: PlayerStatsLine[];
};

type PlayerAnalyticsModalProps = {
  isOpen: boolean;
  loading: boolean;
  errorMessage: string | null;
  detail: PlayerAnalyticsDetail | null;
  onClose: () => void;
  onRetry: () => void;
};

type TabKey = "summary" | "games";

const metricCardClassName =
  "rounded-[10px] border bg-[hsl(var(--surface-1))] px-2.5 py-2 shadow-[0_1px_0_hsl(var(--border)/0.24)]";

const BasketballBallIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.6 2.2 4.2 5.5 4.2 9s-1.6 6.8-4.2 9" />
    <path d="M12 3c-2.6 2.2-4.2 5.5-4.2 9s1.6 6.8 4.2 9" />
  </svg>
);

const HoopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <rect x="5" y="3.5" width="14" height="4.5" rx="1.2" />
    <path d="M12 8v3" />
    <ellipse cx="12" cy="12.4" rx="5" ry="1.9" />
    <path d="M7.2 12.6 9.5 18M12 12.8V19m4.8-6.4L14.5 18" />
  </svg>
);

const CourtIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <rect x="3.5" y="4" width="17" height="16" rx="1.8" />
    <path d="M12 4v16" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M3.5 9h2.4M3.5 15h2.4M20.5 9h-2.4M20.5 15h-2.4" />
  </svg>
);

const insightToneClassByVariant: Record<"primary" | "success" | "warning" | "danger", string> = {
  primary:
    "border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2)/0.62)] shadow-[0_1px_0_hsl(var(--border)/0.36)] border-l-[3px] border-l-[hsl(var(--primary)/0.58)]",
  success:
    "border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2)/0.62)] shadow-[0_1px_0_hsl(var(--border)/0.36)] border-l-[3px] border-l-[hsl(var(--success)/0.58)]",
  warning:
    "border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2)/0.62)] shadow-[0_1px_0_hsl(var(--border)/0.36)] border-l-[3px] border-l-[hsl(var(--warning)/0.62)]",
  danger:
    "border-[hsl(var(--border)/0.78)] bg-[hsl(var(--surface-2)/0.62)] shadow-[0_1px_0_hsl(var(--border)/0.36)] border-l-[3px] border-l-[hsl(var(--destructive)/0.6)]",
};

const badgeCardToneByTier: Record<"HOF" | "Gold" | "Silver" | "Bronze", string> = {
  HOF: "border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-1))] border-l-[3px] border-l-[hsl(var(--success)/0.56)]",
  Gold: "border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-1))] border-l-[3px] border-l-[hsl(var(--warning)/0.62)]",
  Silver: "border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-1))] border-l-[3px] border-l-[hsl(var(--primary)/0.56)]",
  Bronze: "border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-1))] border-l-[3px] border-l-[hsl(var(--text-subtle)/0.52)]",
};

const badgeIconToneByTier: Record<"HOF" | "Gold" | "Silver" | "Bronze", string> = {
  HOF: "text-[hsl(var(--success))]",
  Gold: "text-[hsl(var(--warning))]",
  Silver: "text-[hsl(var(--primary))]",
  Bronze: "text-[hsl(var(--text-subtle))]",
};

const badgeTierToneByTier: Record<"HOF" | "Gold" | "Silver" | "Bronze", string> = {
  HOF: "border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]",
  Gold: "border-[hsl(var(--warning)/0.34)] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]",
  Silver: "border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]",
  Bronze: "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]",
};

const badgeIconByKey: Record<
  InsightBadgeIcon,
  React.ComponentType<{ className?: string }>
> = {
  fire: BasketballBallIcon,
  sparkles: CourtIcon,
  rocket: RocketLaunchIcon,
  star: HoopIcon,
  shield: ShieldCheckIcon,
  hand: HandRaisedIcon,
  target: HoopIcon,
  control: AdjustmentsHorizontalIcon,
};

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "JG";

const formatDate = (value: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const phaseLabel = (phase: TournamentPhaseFilter) => {
  if (phase === "regular") return "Temporada regular";
  if (phase === "playoffs") return "Playoffs";
  if (phase === "finals") return "Finales";
  return "Todas las fases";
};

const computeTrueShootingPct = (points: number, fga: number, fta: number): number => {
  const attempts = fga + 0.44 * fta;
  if (attempts <= 0) return 0;
  return round2((points / (2 * attempts)) * 100);
};

const PlayerAnalyticsModal: React.FC<PlayerAnalyticsModalProps> = ({
  isOpen,
  loading,
  errorMessage,
  detail,
  onClose,
  onRetry,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("summary");
  }, [isOpen, detail?.line.playerId, detail?.phase]);

  const summary = useMemo(() => {
    if (!detail) return null;

    const line = detail.line;
    const missedFg = Math.max(0, line.totals.fga - line.totals.fgm);
    const missedFt = Math.max(0, line.totals.fta - line.totals.ftm);

    const positiveActions =
      line.totals.points +
      line.totals.rebounds +
      line.totals.assists +
      line.totals.steals +
      line.totals.blocks +
      line.totals.fgm +
      line.totals.ftm +
      line.totals.tpm;

    const negativeActions = missedFg + missedFt + line.totals.turnovers + line.totals.fouls;

    const tsPct = computeTrueShootingPct(line.totals.points, line.totals.fga, line.totals.fta);

    const defensiveImpact = round2(
      line.perGame.spg * 1.4 + line.perGame.bpg * 1.8 + line.perGame.rpg * 0.35 - line.perGame.fpg * 0.15
    );

    const totalImpact = computeImpactScore({
      points: line.totals.points,
      rebounds: line.totals.rebounds,
      assists: line.totals.assists,
      steals: line.totals.steals,
      blocks: line.totals.blocks,
      turnovers: line.totals.turnovers,
      fouls: line.totals.fouls,
      fgm: line.totals.fgm,
      fga: line.totals.fga,
      ftm: line.totals.ftm,
      fta: line.totals.fta,
      tpm: line.totals.tpm,
    });

    return {
      missedFg,
      missedFt,
      positiveActions,
      negativeActions,
      tsPct,
      defensiveImpact,
      praPerGame: round2(line.perGame.ppg + line.perGame.rpg + line.perGame.apg - line.perGame.topg),
      praTotal: line.totals.points + line.totals.rebounds + line.totals.assists - line.totals.turnovers,
      totalImpact,
      impactPerGame: line.gamesPlayed > 0 ? round2(totalImpact / line.gamesPlayed) : 0,
    };
  }, [detail]);

  const insight = useMemo(() => {
    if (!detail) return null;
    const peers = detail.phaseLines && detail.phaseLines.length > 0 ? detail.phaseLines : [detail.line];
    return buildPlayerDeepInsight(detail.line, peers);
  }, [detail]);

  const gamesWithCalculations = useMemo(() => {
    if (!detail) return [];

    return detail.games
      .map((game) => {
        const valuation = computeValuation({
          points: game.points,
          rebounds: game.rebounds,
          assists: game.assists,
          steals: game.steals,
          blocks: game.blocks,
          turnovers: game.turnovers,
          fouls: game.fouls,
          fgm: game.fgm,
          fga: game.fga,
          ftm: game.ftm,
          fta: game.fta,
          tpm: game.tpm,
        });

        const impact = computeImpactScore({
          points: game.points,
          rebounds: game.rebounds,
          assists: game.assists,
          steals: game.steals,
          blocks: game.blocks,
          turnovers: game.turnovers,
          fouls: game.fouls,
          fgm: game.fgm,
          fga: game.fga,
          ftm: game.ftm,
          fta: game.fta,
          tpm: game.tpm,
        });

        return {
          ...game,
          valuation,
          impact,
        };
      })
      .sort((a, b) => {
        if (a.gameOrder !== b.gameOrder) return b.gameOrder - a.gameOrder;
        return b.matchId - a.matchId;
      });
  }, [detail]);

  const modalTitle = detail?.line.name ?? "Detalle del jugador";
  const modalSubtitle = detail
    ? `${detail.line.teamName ?? "Sin equipo"} • ${phaseLabel(detail.phase)}`
    : "Analítica individual";
  const visibleInsightBadges = insight ? insight.badges.slice(0, 3) : [];
  const hiddenInsightBadgeCount = insight ? Math.max(0, insight.badges.length - visibleInsightBadges.length) : 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      maxWidthClassName="sm:max-w-6xl"
      overlayClassName="!z-[90]"
      actions={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {loading ? (
        <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.45)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
          Cargando detalle del jugador...
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="space-y-3 rounded-[10px] border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.08)] p-4 text-sm text-[hsl(var(--destructive))]">
          <p>{errorMessage}</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : null}

      {!loading && !errorMessage && detail && summary ? (
        <div className="space-y-4">
          <section className="app-card p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {detail.line.photo ? (
                  <img
                    src={detail.line.photo}
                    alt={detail.line.name}
                    className="h-12 w-12 rounded-full border object-cover"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border bg-[hsl(var(--surface-2))] text-sm font-semibold">
                    {initialsFromName(detail.line.name)}
                  </span>
                )}
                <div>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{detail.line.teamName ?? "Sin equipo"}</p>
                  <p className="text-xs text-[hsl(var(--text-subtle))]">{detail.line.gamesPlayed} juegos analizados</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {insight ? (
                  <Badge variant={insight.gradeTone} className="px-3 py-1.5 text-sm">
                    Nivel {insight.grade}
                  </Badge>
                ) : null}
                <span className="rounded-full border bg-[hsl(var(--surface-2))] px-2.5 py-1 font-semibold">
                  VAL/PJ {detail.line.valuationPerGame.toFixed(2)}
                </span>
                <span className="rounded-full border bg-[hsl(var(--surface-2))] px-2.5 py-1 font-semibold">
                  PRA PJ {summary.praPerGame.toFixed(1)}
                </span>
                {detail.mvpRow ? (
                  <span className="rounded-full border bg-[hsl(var(--surface-2))] px-2.5 py-1 font-semibold">
                    MVP score {detail.mvpRow.finalScore.toFixed(3)}
                  </span>
                ) : null}
              </div>
            </div>

            {insight ? (
              <div className={`mt-3 rounded-[10px] border p-3 ${insightToneClassByVariant[insight.gradeTone]}`.trim()}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Perfil inteligente (fase actual)
                    </p>
                    <p className="text-sm font-semibold text-[hsl(var(--text-strong))]">
                      Nivel {insight.grade} · {insight.score.toFixed(1)}/100
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Confianza {insight.confidence} · {insight.confidenceNote}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {insight.styleTags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>

                {visibleInsightBadges.length > 0 ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {visibleInsightBadges.map((badge) => {
                      const Icon = badgeIconByKey[badge.icon];
                      return (
                        <article
                          key={`${badge.name}-${badge.tier}`}
                          className={`rounded-[10px] border px-2.5 py-2 ${badgeCardToneByTier[badge.tier]}`.trim()}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-[8px] border bg-[hsl(var(--surface-2)/0.78)] ${badgeIconToneByTier[badge.tier]}`.trim()}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${badgeTierToneByTier[badge.tier]}`.trim()}
                            >
                              {badge.tier}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-[hsl(var(--text-strong))]">{badge.name}</p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{badge.note}</p>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {hiddenInsightBadgeCount > 0 ? (
                  <p className="mt-2 text-[11px] text-[hsl(var(--text-subtle))]">
                    +{hiddenInsightBadgeCount} badge{hiddenInsightBadgeCount > 1 ? "s" : ""} adicional
                    {hiddenInsightBadgeCount > 1 ? "es" : ""} en análisis interno.
                  </p>
                ) : null}

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Lo más duro
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--text-strong))]">
                      {insight.strengths.length > 0
                        ? insight.strengths
                            .slice(0, 2)
                            .map((item) => `${item.label}: ${item.value}`)
                            .join(" • ")
                        : "Aporte equilibrado en varias áreas del juego."}
                    </p>
                  </div>

                  <div className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Para subir de nivel
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--text-strong))]">
                      {insight.watchouts.length > 0
                        ? `${insight.watchouts[0].label}: ${insight.watchouts[0].value}`
                        : "Mantener la consistencia partido a partido."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 inline-flex rounded-xl border bg-[hsl(var(--surface-2))] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "summary"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-strong))]"
                }`}
              >
                Resumen
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("games")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "games"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-strong))]"
                }`}
              >
                Por partido
              </button>
            </div>
          </section>

          {activeTab === "summary" ? (
            <section className="space-y-3">
              <article className="app-card p-3">
                <h4 className="text-sm font-semibold mb-2">Números principales</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PPG</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.perGame.ppg.toFixed(1)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">RPG</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.perGame.rpg.toFixed(1)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">APG</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.perGame.apg.toFixed(1)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">SPG</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.perGame.spg.toFixed(1)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">BPG</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.perGame.bpg.toFixed(1)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PRA/PJ</p>
                    <p className="text-sm font-bold tabular-nums">{summary.praPerGame.toFixed(1)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FG%</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.fgPct.toFixed(1)}%</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">3P%</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.tpPct.toFixed(1)}%</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FT%</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.ftPct.toFixed(1)}%</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">TS%</p>
                    <p className="text-sm font-bold tabular-nums">{summary.tsPct.toFixed(1)}%</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">VAL/PJ</p>
                    <p className="text-sm font-bold tabular-nums">{detail.line.valuationPerGame.toFixed(2)}</p>
                  </div>
                  <div className={metricCardClassName}>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">IMP/PJ</p>
                    <p className="text-sm font-bold tabular-nums">{summary.impactPerGame.toFixed(2)}</p>
                  </div>
                </div>
              </article>

              <article className="app-card p-3 space-y-2 text-sm">
                <h4 className="font-semibold">Cálculos con sentido</h4>
                <p className="text-[hsl(var(--muted-foreground))]">
                  El resumen mezcla productividad, eficiencia y costo de errores para dar una lectura más completa.
                </p>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-2">
                    <p className="font-semibold">Valoración total</p>
                    <p className="mt-1 tabular-nums">{detail.line.valuation.toFixed(1)}</p>
                    <p className="mt-1 text-[hsl(var(--text-subtle))]">
                      VAL = acciones positivas ({summary.positiveActions}) - acciones negativas ({summary.negativeActions}).
                    </p>
                  </div>
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-2">
                    <p className="font-semibold">Impacto global</p>
                    <p className="mt-1 tabular-nums">{summary.totalImpact.toFixed(1)}</p>
                    <p className="mt-1 text-[hsl(var(--text-subtle))]">
                      Combina puntos, creación, defensa y castiga pérdidas/faltas y tiros fallados.
                    </p>
                  </div>
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-2">
                    <p className="font-semibold">Impacto defensivo</p>
                    <p className="mt-1 tabular-nums">{summary.defensiveImpact.toFixed(2)}</p>
                    <p className="mt-1 text-[hsl(var(--text-subtle))]">
                      1.4xSPG + 1.8xBPG + 0.35xRPG - 0.15xFPG por juego.
                    </p>
                  </div>
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-2">
                    <p className="font-semibold">TS% (True Shooting)</p>
                    <p className="mt-1 tabular-nums">{summary.tsPct.toFixed(1)}%</p>
                    <p className="mt-1 text-[hsl(var(--text-subtle))]">
                      TS% = PTS / (2 x (FGA + 0.44 x FTA)).
                    </p>
                  </div>
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-2">
                    <p className="font-semibold">Errores de tiro</p>
                    <p className="mt-1 tabular-nums">FG fallados {summary.missedFg} · TL fallados {summary.missedFt}</p>
                    <p className="mt-1 text-[hsl(var(--text-subtle))]">
                      Estos fallos restan en valoración e impacto.
                    </p>
                  </div>
                  <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-2">
                    <p className="font-semibold">PRA del torneo</p>
                    <p className="mt-1 tabular-nums">Total {summary.praTotal.toFixed(0)}</p>
                    <p className="mt-1 text-[hsl(var(--text-subtle))]">
                      PRA = puntos + rebotes + asistencias - pérdidas, acumulado en los partidos jugados.
                    </p>
                  </div>
                </div>
              </article>

              {detail.mvpRow ? (
                <article className="app-card p-3 text-xs">
                  <p className="font-semibold text-sm">Detalle MVP (fase actual)</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className={metricCardClassName}>
                      <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">MVP Score</p>
                      <p className="text-sm font-bold tabular-nums">{detail.mvpRow.finalScore.toFixed(3)}</p>
                    </div>
                    <div className={metricCardClassName}>
                      <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PIE Share</p>
                      <p className="text-sm font-bold tabular-nums">{(detail.mvpRow.pieShare * 100).toFixed(1)}%</p>
                    </div>
                    <div className={metricCardClassName}>
                      <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Disponibilidad</p>
                      <p className="text-sm font-bold tabular-nums">{(detail.mvpRow.availabilityRate * 100).toFixed(1)}%</p>
                    </div>
                    <div className={metricCardClassName}>
                      <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Record equipo</p>
                      <p className="text-sm font-bold tabular-nums">{(detail.mvpRow.teamFactor * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </article>
              ) : null}
            </section>
          ) : (
            <section className="app-card p-3 sm:p-4">
              {gamesWithCalculations.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No hay partidos registrados para este jugador en la fase seleccionada.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[hsl(var(--text-subtle))]">
                    Detalle individual por partido. Incluye valoración e impacto calculados en cada juego.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1050px] w-full text-xs border-separate border-spacing-0">
                      <thead>
                        <tr className="text-[hsl(var(--text-subtle))]">
                          <th className="text-left px-2 py-2 border-b">Juego</th>
                          <th className="text-left px-2 py-2 border-b">Fecha</th>
                          <th className="text-right px-2 py-2 border-b">PTS</th>
                          <th className="text-right px-2 py-2 border-b">REB</th>
                          <th className="text-right px-2 py-2 border-b">AST</th>
                          <th className="text-right px-2 py-2 border-b">STL</th>
                          <th className="text-right px-2 py-2 border-b">BLK</th>
                          <th className="text-right px-2 py-2 border-b">TOV</th>
                          <th className="text-right px-2 py-2 border-b">FG</th>
                          <th className="text-right px-2 py-2 border-b">3P</th>
                          <th className="text-right px-2 py-2 border-b">FT</th>
                          <th className="text-right px-2 py-2 border-b">PRA</th>
                          <th className="text-right px-2 py-2 border-b">VAL</th>
                          <th className="text-right px-2 py-2 border-b">IMP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gamesWithCalculations.map((game) => (
                          <tr key={`${game.matchId}-${game.playerId}`} className="odd:bg-[hsl(var(--surface-2)/0.35)]">
                            <td className="px-2 py-2 border-b">#{game.gameOrder || game.matchId}</td>
                            <td className="px-2 py-2 border-b">{formatDate(game.matchDate)}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.points}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.rebounds}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.assists}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.steals}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.blocks}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.turnovers}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.fgm}/{game.fga}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.tpm}/{game.tpa}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.ftm}/{game.fta}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.pra.toFixed(1)}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.valuation.toFixed(1)}</td>
                            <td className="px-2 py-2 border-b text-right tabular-nums">{game.impact.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      ) : null}
    </ModalShell>
  );
};

export default PlayerAnalyticsModal;
