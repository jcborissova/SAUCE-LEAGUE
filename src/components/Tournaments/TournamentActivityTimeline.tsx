import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  SparklesIcon,
  TrophyIcon,
} from "@heroicons/react/24/solid";

import Badge from "../ui/Badge";
import SectionCard from "../ui/SectionCard";
import { listTournamentActivity } from "../../services/tournamentAnalytics";
import type {
  TournamentActivityItem,
} from "../../types/tournament-analytics";

type TournamentActivityTimelineProps = {
  tournamentId: string;
  title?: string;
  limit?: number;
};

type ActivityDescriptor = {
  badge: string;
  badgeVariant: "primary" | "success" | "warning" | "danger" | "default";
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const readText = (payload: Record<string, unknown>, key: string): string | null => {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const readNumber = (payload: Record<string, unknown>, key: string): number | null => {
  const value = Number(payload[key]);
  if (!Number.isFinite(value)) return null;
  return value;
};

const formatActivityWhen = (iso: string): string => {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "hace un momento";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 45_000) return "hace segundos";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays <= 5) return `hace ${diffDays} días`;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const getActivityDescriptor = (activity: TournamentActivityItem): ActivityDescriptor => {
  const payload = activity.payload;

  if (activity.type === "match_result_updated") {
    const teamA = readText(payload, "teamA") ?? "Equipo A";
    const teamB = readText(payload, "teamB") ?? "Equipo B";
    const winnerTeam = readText(payload, "winnerTeam") ?? "por definir";

    return {
      badge: "Resultado cargado",
      badgeVariant: "success",
      icon: TrophyIcon,
      title: `${winnerTeam} cerró el juego`,
      description: `${teamA} vs ${teamB}. Marcador oficial actualizado.`,
    };
  }

  if (activity.type === "playoff_series_updated") {
    const roundName = readText(payload, "roundName") ?? "Playoffs";
    const matchupKey = readText(payload, "matchupKey") ?? "serie";
    const winsA = readNumber(payload, "winsA") ?? 0;
    const winsB = readNumber(payload, "winsB") ?? 0;
    const status = readText(payload, "status") ?? "en curso";

    return {
      badge: "Serie playoffs",
      badgeVariant: "warning",
      icon: BoltIcon,
      title: `${roundName} · ${matchupKey}`,
      description: `Estado ${status}. Parcial ${winsA}-${winsB}.`,
    };
  }

  if (activity.type === "leader_of_day") {
    const headline = readText(payload, "headline") ?? readText(payload, "title") ?? "Líder del día";
    const subtitle = readText(payload, "description") ?? "Nuevo destaque en el home del torneo.";

    return {
      badge: "Líder del día",
      badgeVariant: "primary",
      icon: SparklesIcon,
      title: headline,
      description: subtitle,
    };
  }

  const matchId = readNumber(payload, "matchId");
  return {
    badge: "Stats actualizadas",
    badgeVariant: "primary",
    icon: ChartBarIcon,
    title: "Se refrescaron estadísticas",
    description: matchId ? `Partido #${matchId} con nuevos datos de jugadores.` : "Se registraron ajustes de boxscore.",
  };
};

const TournamentActivityTimeline: React.FC<TournamentActivityTimelineProps> = ({
  tournamentId,
  title = "Últimos movimientos",
  limit = 20,
}) => {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<TournamentActivityItem[]>([]);

  const safeLimit = useMemo(() => {
    const normalized = Math.floor(Number(limit));
    if (!Number.isFinite(normalized) || normalized <= 0) return 20;
    return Math.min(normalized, 50);
  }, [limit]);

  const loadActivity = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setLoading(true);
      }

      try {
        const rows = await listTournamentActivity(tournamentId, safeLimit);
        setItems(rows);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la actividad del torneo."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [safeLimit, tournamentId]
  );

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadActivity({ silent: true });
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [loadActivity]);

  return (
    <SectionCard
      title={title}
      description="Actividad reciente del torneo para seguimiento diario."
      actions={
        <button
          type="button"
          onClick={() => void loadActivity()}
          className="btn-secondary min-h-[34px] px-2.5 py-1 text-xs"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refrescar
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-subtle))]">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
          Cargando actividad...
        </div>
      ) : errorMessage ? (
        <div className="rounded-[10px] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {errorMessage}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
          Aún no hay movimientos registrados para este torneo.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => {
            const descriptor = getActivityDescriptor(item);
            const Icon = descriptor.icon;

            return (
              <li key={item.id}>
                <article className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[hsl(var(--surface-2))] text-[hsl(var(--primary))]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{descriptor.title}</p>
                        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                          {descriptor.description}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-[hsl(var(--text-subtle))]">
                      {formatActivityWhen(item.createdAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={descriptor.badgeVariant}>{descriptor.badge}</Badge>
                    <Badge variant="default">{formatActivityWhen(item.createdAt)}</Badge>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
};

export default TournamentActivityTimeline;
