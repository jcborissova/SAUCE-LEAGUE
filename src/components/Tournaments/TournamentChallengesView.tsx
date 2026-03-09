import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

import AppSelect from "../ui/AppSelect";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import SegmentedControl from "../ui/SegmentedControl";
import {
  buildChallengeBoardRows,
  listTournamentChallenges,
  regenerateTournamentChallenges,
} from "../../services/tournamentChallenges";
import type {
  ChallengeBoardRow,
  ChallengeTarget,
  TournamentChallengeStatus,
  TournamentPlayerChallenge,
} from "../../types/tournament-analytics";

type Props = {
  tournamentId: string;
  embedded?: boolean;
  isAdmin?: boolean;
};

type ChallengeViewMode = "board" | "list";
type ChallengeDifficultyLevel = "easy" | "medium" | "elite";

type ChallengeDifficultyThresholds = {
  easyUpper: number;
  eliteLower: number;
  calibrated: boolean;
  sampleSize: number;
};

const FALLBACK_DIFFICULTY_THRESHOLDS: ChallengeDifficultyThresholds = {
  easyUpper: 1.04,
  eliteLower: 1.18,
  calibrated: false,
  sampleSize: 0,
};

const CHALLENGE_STATUS_OPTIONS: Array<{
  value: TournamentChallengeStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "completed", label: "Cumplidos" },
  { value: "elite", label: "Elite" },
  { value: "failed", label: "Fallados" },
  { value: "not_evaluated", label: "N/J" },
];

const CHALLENGE_VIEW_OPTIONS: Array<{ value: ChallengeViewMode; label: string }> = [
  { value: "board", label: "Radar" },
  { value: "list", label: "Lista" },
];

const archetypeLabel = (value: TournamentPlayerChallenge["archetype"]): string => {
  if (value === "scorer") return "Anotador";
  if (value === "creator") return "Creador";
  if (value === "two_way") return "Two-way";
  if (value === "rim_protector") return "Protector";
  return "All-around";
};

const challengeStatusLabel = (status: TournamentChallengeStatus) => {
  if (status === "completed") return "Cumplido";
  if (status === "elite") return "Elite";
  if (status === "failed") return "Fallado";
  if (status === "not_evaluated") return "N/J";
  return "Pendiente";
};

const challengeStatusBadgeVariant = (
  status: TournamentChallengeStatus
): "default" | "primary" | "success" | "warning" | "danger" => {
  if (status === "elite") return "success";
  if (status === "completed") return "primary";
  if (status === "failed") return "danger";
  if (status === "not_evaluated") return "warning";
  return "default";
};

const challengeStatusToneClass = (status: TournamentChallengeStatus): string => {
  if (status === "elite") {
    return "border-[hsl(var(--success)/0.38)] bg-[linear-gradient(135deg,hsl(var(--success)/0.12),hsl(var(--success)/0.02))]";
  }
  if (status === "completed") {
    return "border-[hsl(var(--primary)/0.36)] bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--primary)/0.02))]";
  }
  if (status === "failed") {
    return "border-[hsl(var(--destructive)/0.36)] bg-[linear-gradient(135deg,hsl(var(--destructive)/0.1),hsl(var(--destructive)/0.02))]";
  }
  if (status === "not_evaluated") {
    return "border-[hsl(var(--warning)/0.36)] bg-[linear-gradient(135deg,hsl(var(--warning)/0.14),hsl(var(--warning)/0.03))]";
  }
  return "border-[hsl(var(--border)/0.86)] bg-[hsl(var(--surface-1))]";
};

const trendLabel = (trend: ChallengeBoardRow["trend"]) => {
  if (trend === "up") return "Subiendo";
  if (trend === "down") return "Bajando";
  return "Estable";
};

const trendSymbol = (trend: ChallengeBoardRow["trend"]) => {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
};

const formatMetricValue = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const isPercentMetric = (metric: ChallengeTarget["metric"]): boolean =>
  metric === "fg_pct" || metric === "ft_pct" || metric === "tp_pct";

const formatTargetMetricValue = (target: ChallengeTarget, value: number | null): string => {
  const formatted = formatMetricValue(value);
  if (formatted === "--") return formatted;
  if (isPercentMetric(target.metric)) return `${formatted}%`;
  return formatted;
};

const toNumeric = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getBaselineKeyByMetric = (metric: ChallengeTarget["metric"]): string => {
  if (metric === "turnovers_max") return "turnovers";
  if (metric === "fouls_max") return "fouls";
  if (metric === "fg_pct") return "fgPct";
  if (metric === "ft_pct") return "ftPct";
  if (metric === "tp_pct") return "tpPct";
  return metric;
};

const getBaselineStddevKeyByMetric = (metric: ChallengeTarget["metric"]): string => {
  if (metric === "turnovers_max") return "turnoversStddev";
  if (metric === "fouls_max") return "foulsStddev";
  if (metric === "fg_pct") return "fgPctStddev";
  if (metric === "ft_pct") return "ftPctStddev";
  if (metric === "tp_pct") return "tpPctStddev";
  if (metric === "tpm") return "tpmStddev";
  return `${metric}Stddev`;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const computeQuantile = (sortedValues: number[], percentile: number): number => {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const position = clamp(percentile, 0, 1) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;

  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
};

const computeChallengeDifficultyScore = (challenge: TournamentPlayerChallenge | null): number => {
  if (!challenge || challenge.targets.length === 0) {
    return 1;
  }

  const baseline = challenge.baseline ?? {};
  const targetScores = challenge.targets.map((target) => {
    const baselineValue = toNumeric(baseline[getBaselineKeyByMetric(target.metric)]) ?? 0;
    const stddevValue = toNumeric(baseline[getBaselineStddevKeyByMetric(target.metric)]) ?? 0;
    const normalizedBaseline = Math.max(Math.abs(baselineValue), 1);
    const stretch =
      target.op === "lte"
        ? (baselineValue - target.target) / normalizedBaseline
        : (target.target - baselineValue) / normalizedBaseline;

    const coefficientVar = stddevValue / normalizedBaseline;
    const consistencyBoost =
      coefficientVar <= 0.22
        ? 0.35
        : coefficientVar <= 0.38
          ? 0.18
          : coefficientVar >= 0.65
            ? -0.15
            : 0;

    return Math.max(0.7, 1 + stretch + consistencyBoost);
  });

  if (targetScores.length === 0) return 1;
  const avgScore = targetScores.reduce((sum, value) => sum + value, 0) / targetScores.length;
  return Number(avgScore.toFixed(2));
};

const computeDifficultyThresholds = (
  challenges: TournamentPlayerChallenge[]
): ChallengeDifficultyThresholds => {
  const settled = challenges.filter(
    (challenge) => challenge.settled && challenge.status !== "not_evaluated"
  );

  if (settled.length < 18) return FALLBACK_DIFFICULTY_THRESHOLDS;

  const samples = settled
    .map((challenge) => ({
      score: computeChallengeDifficultyScore(challenge),
      success: challenge.status === "completed" || challenge.status === "elite",
    }))
    .filter((sample) => Number.isFinite(sample.score));

  if (samples.length < 18) return FALLBACK_DIFFICULTY_THRESHOLDS;

  const sortedScores = samples.map((sample) => sample.score).sort((a, b) => a - b);
  const uniqueScores = Array.from(new Set(sortedScores));
  const minBandSize = Math.max(6, Math.floor(samples.length * 0.18));

  const percentileEasy = clamp(computeQuantile(sortedScores, 0.35), 0.85, 1.32);
  const percentileElite = clamp(computeQuantile(sortedScores, 0.78), 1.05, 1.9);

  let easyUpper = percentileEasy;
  let eliteLower = percentileElite;

  let easyBestPenalty = Number.POSITIVE_INFINITY;
  uniqueScores.forEach((threshold) => {
    const band = samples.filter((sample) => sample.score <= threshold);
    if (band.length < minBandSize) return;
    const successRate = band.filter((sample) => sample.success).length / band.length;
    const targetRate = 0.74;
    const sizePenalty = Math.abs(band.length / samples.length - 0.38) * 0.35;
    const penalty = Math.abs(successRate - targetRate) + sizePenalty;
    if (penalty < easyBestPenalty) {
      easyBestPenalty = penalty;
      easyUpper = threshold;
    }
  });

  let eliteBestPenalty = Number.POSITIVE_INFINITY;
  uniqueScores.forEach((threshold) => {
    const band = samples.filter((sample) => sample.score >= threshold);
    if (band.length < minBandSize) return;
    const successRate = band.filter((sample) => sample.success).length / band.length;
    const targetRate = 0.31;
    const sizePenalty = Math.abs(band.length / samples.length - 0.22) * 0.35;
    const penalty = Math.abs(successRate - targetRate) + sizePenalty;
    if (penalty < eliteBestPenalty) {
      eliteBestPenalty = penalty;
      eliteLower = threshold;
    }
  });

  easyUpper = clamp(easyUpper, 0.82, 1.42);
  eliteLower = clamp(eliteLower, 1.01, 1.95);

  if (eliteLower < easyUpper + 0.08) {
    const midpoint = (easyUpper + eliteLower) / 2;
    easyUpper = clamp(midpoint - 0.04, 0.82, 1.4);
    eliteLower = clamp(midpoint + 0.04, 1.02, 1.95);
  }

  return {
    easyUpper: Number(easyUpper.toFixed(2)),
    eliteLower: Number(eliteLower.toFixed(2)),
    calibrated: true,
    sampleSize: samples.length,
  };
};

const difficultyFromScore = (
  score: number,
  thresholds: ChallengeDifficultyThresholds
): {
  level: ChallengeDifficultyLevel;
  label: string;
  pillClassName: string;
} => {
  if (score >= thresholds.eliteLower) {
    return {
      level: "elite",
      label: "Élite",
      pillClassName:
        "border-[hsl(var(--destructive)/0.42)] bg-[hsl(var(--destructive)/0.14)] text-[hsl(var(--destructive))]",
    };
  }

  if (score >= thresholds.easyUpper) {
    return {
      level: "medium",
      label: "Medio",
      pillClassName:
        "border-[hsl(var(--warning)/0.42)] bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]",
    };
  }

  return {
    level: "easy",
    label: "Fácil",
    pillClassName:
      "border-[hsl(var(--success)/0.42)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  };
};

const getChallengeDifficulty = (
  challenge: TournamentPlayerChallenge | null,
  thresholds: ChallengeDifficultyThresholds
): {
  level: ChallengeDifficultyLevel;
  label: string;
  score: number;
  pillClassName: string;
} => {
  const normalizedScore = computeChallengeDifficultyScore(challenge);
  const levelData = difficultyFromScore(normalizedScore, thresholds);

  return {
    ...levelData,
    score: normalizedScore,
  };
};

const getScheduleSortKey = (
  dateValue: string | null,
  timeValue: string | null,
  direction: "asc" | "desc"
) => {
  const datePart = dateValue ?? (direction === "asc" ? "9999-12-31" : "0000-01-01");
  const timePart = timeValue ?? (direction === "asc" ? "99:99" : "00:00");
  return `${datePart}T${timePart}`;
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatChallengeDateLabel = (dateValue: string | null, timeValue: string | null) => {
  if (!dateValue) return "Fecha por definir";
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return "Fecha por definir";

  const date = new Date(year, month - 1, day);
  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);

  if (!timeValue) return dateLabel;
  return `${dateLabel} · ${timeValue.slice(0, 5)}`;
};

const renderTargetTile = (challengeId: number, target: ChallengeTarget, index: number) => {
  const toneClass =
    target.hit === true
      ? "border-[hsl(var(--success)/0.36)] bg-[hsl(var(--success)/0.1)]"
      : target.hit === false
        ? "border-[hsl(var(--destructive)/0.36)] bg-[hsl(var(--destructive)/0.09)]"
        : "border-[hsl(var(--border)/0.86)] bg-[hsl(var(--surface-2)/0.42)]";

  return (
    <article
      key={`${challengeId}-${target.metric}-${index}`}
      className={`rounded-[10px] border px-2.5 py-2 text-center ${toneClass}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[hsl(var(--text-subtle))]">
        {target.label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {target.op === "lte" ? "≤ " : "≥ "}
        {formatTargetMetricValue(target, target.target)}
      </p>
      <p className="mt-0.5 text-[11px] text-[hsl(var(--text-subtle))]">
        Real: {formatTargetMetricValue(target, target.actual)}
      </p>
    </article>
  );
};

const TournamentChallengesView = ({
  tournamentId,
  embedded = false,
  isAdmin = false,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<TournamentPlayerChallenge[]>([]);

  const [viewMode, setViewMode] = useState<ChallengeViewMode>("board");
  const [statusFilter, setStatusFilter] = useState<TournamentChallengeStatus | "all">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const loadChallenges = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) setLoading(true);
      setErrorMessage(null);

      try {
        const challenges = await listTournamentChallenges(tournamentId);
        setRows(challenges);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudieron cargar los retos del torneo."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tournamentId]
  );

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadChallenges({ silent: true });
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [loadChallenges]);

  const handleRegenerate = async () => {
    if (!isAdmin || regenerating) return;
    setRegenerating(true);

    try {
      const regenerated = await regenerateTournamentChallenges(tournamentId);
      toast.success(`Retos regenerados: ${regenerated}`);
      await loadChallenges({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron regenerar los retos.");
    } finally {
      setRegenerating(false);
    }
  };

  const teamOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.teamName?.trim() ?? "")
            .filter((value) => value.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [rows]
  );

  const playerOptions = useMemo(() => {
    const byPlayer = new Map<number, { id: number; name: string; teamName: string | null }>();
    rows.forEach((row) => {
      if (!byPlayer.has(row.playerId)) {
        byPlayer.set(row.playerId, {
          id: row.playerId,
          name: row.playerName,
          teamName: row.teamName,
        });
      }
    });

    return Array.from(byPlayer.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  }, [rows]);

  const normalizedSearch = useMemo(() => normalizeSearch(search), [search]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (teamFilter !== "all" && row.teamName !== teamFilter) return false;
      if (playerFilter !== "all" && row.playerId !== Number(playerFilter)) return false;
      if (!normalizedSearch) return true;

      const searchable = normalizeSearch(
        `${row.playerName} ${row.teamName ?? ""} ${archetypeLabel(row.archetype)}`
      );
      return searchable.includes(normalizedSearch);
    });

    return filtered.sort((a, b) => {
      const aPending = a.status === "pending";
      const bPending = b.status === "pending";
      if (aPending !== bPending) return aPending ? -1 : 1;
      return getScheduleSortKey(b.challengeDate, b.challengeTime, "desc").localeCompare(
        getScheduleSortKey(a.challengeDate, a.challengeTime, "desc")
      );
    });
  }, [rows, statusFilter, teamFilter, playerFilter, normalizedSearch]);

  const boardRows = useMemo<ChallengeBoardRow[]>(
    () => buildChallengeBoardRows(filteredRows),
    [filteredRows]
  );

  const groupedByDate = useMemo(() => {
    const grouped = new Map<string, TournamentPlayerChallenge[]>();
    filteredRows.forEach((row) => {
      const key = row.challengeDate ?? "__sin_fecha__";
      const current = grouped.get(key) ?? [];
      current.push(row);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => {
        if (a[0] === "__sin_fecha__") return 1;
        if (b[0] === "__sin_fecha__") return -1;
        return new Date(b[0]).getTime() - new Date(a[0]).getTime();
      })
      .map(([key, items]) => ({
        key,
        label: key === "__sin_fecha__" ? "Fecha por definir" : formatChallengeDateLabel(key, null),
        items,
      }));
  }, [filteredRows]);

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((row) => row.status === "pending").length;
    const elite = rows.filter((row) => row.status === "elite").length;
    const completed = rows.filter((row) => row.status === "completed").length;
    const failed = rows.filter((row) => row.status === "failed").length;
    const notEvaluated = rows.filter((row) => row.status === "not_evaluated").length;
    const accomplished = completed + elite;
    const accomplishedRate = total > 0 ? Math.round((accomplished / total) * 100) : 0;

    return {
      total,
      pending,
      accomplished,
      accomplishedRate,
      elite,
      failed,
      notEvaluated,
    };
  }, [rows]);

  const difficultyThresholds = useMemo(
    () => computeDifficultyThresholds(rows),
    [rows]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <ArrowPathIcon className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <EmptyState
        title="No se pudieron cargar los retos"
        description={errorMessage}
        action={
          <button type="button" className="btn-secondary" onClick={() => void loadChallenges()}>
            Reintentar
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-4">
      {!embedded ? (
        <header className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold">Retos del torneo</h2>
          <p className="text-sm text-[hsl(var(--text-subtle))]">
            Todo el tablero de retos por jugador y partido, con cumplimiento en tiempo real.
          </p>
        </header>
      ) : null}

      <section className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,hsl(var(--primary)/0.16),transparent_38%),radial-gradient(circle_at_86%_20%,hsl(var(--warning)/0.13),transparent_35%)]" />
        <div className="relative space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(var(--text-subtle))]">
                Challenge Room
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Filtro por equipo/jugador y lectura inmediata de quién está cumpliendo.
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                className="btn-secondary min-h-[34px] px-2.5 py-1 text-xs"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                <ArrowPathIcon className={regenerating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {regenerating ? "Regenerando..." : "Regenerar retos"}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <article className="rounded-[10px] border bg-[hsl(var(--surface-1)/0.92)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Retos</p>
              <p className="text-base font-bold tabular-nums">{summary.total}</p>
            </article>
            <article className="rounded-[10px] border bg-[hsl(var(--surface-1)/0.92)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Pendientes</p>
              <p className="text-base font-bold tabular-nums">{summary.pending}</p>
            </article>
            <article className="rounded-[10px] border bg-[hsl(var(--surface-1)/0.92)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Cumplidos</p>
              <p className="text-base font-bold tabular-nums">
                {summary.accomplished} <span className="text-xs text-[hsl(var(--text-subtle))]">({summary.accomplishedRate}%)</span>
              </p>
            </article>
            <article className="rounded-[10px] border bg-[hsl(var(--surface-1)/0.92)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Elite</p>
              <p className="text-base font-bold tabular-nums">{summary.elite}</p>
            </article>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="danger">Fallados: {summary.failed}</Badge>
            <Badge variant="warning">N/J: {summary.notEvaluated}</Badge>
          </div>
          <p className="text-[11px] text-[hsl(var(--text-subtle))]">
            {difficultyThresholds.calibrated
              ? `Umbrales calibrados con ${difficultyThresholds.sampleSize} retos liquidados`
              : "Umbrales base (faltan resultados para calibrar)"}{" "}
            · Fácil &lt; {difficultyThresholds.easyUpper.toFixed(2)}x · Élite ≥{" "}
            {difficultyThresholds.eliteLower.toFixed(2)}x
          </p>
        </div>
      </section>

      <section className="space-y-2 rounded-[12px] border bg-[hsl(var(--surface-1))] p-2.5 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block lg:col-span-2">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-subtle))]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input-base h-10 pl-9"
              placeholder="Buscar por jugador, equipo o perfil"
            />
          </label>

          <AppSelect
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="input-base h-10"
          >
            <option value="all">Todos los equipos</option>
            {teamOptions.map((teamName) => (
              <option key={teamName} value={teamName}>
                {teamName}
              </option>
            ))}
          </AppSelect>

          <AppSelect
            value={playerFilter}
            onChange={(event) => setPlayerFilter(event.target.value)}
            className="input-base h-10"
          >
            <option value="all">Todos los jugadores</option>
            {playerOptions.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
                {player.teamName ? ` · ${player.teamName}` : ""}
              </option>
            ))}
          </AppSelect>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)]">
          <SegmentedControl
            options={CHALLENGE_VIEW_OPTIONS}
            value={viewMode}
            onChange={(value) => setViewMode(value as ChallengeViewMode)}
          />
          <AppSelect
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as TournamentChallengeStatus | "all")
            }
            className="input-base h-10"
          >
            {CHALLENGE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </div>
      </section>

      {filteredRows.length === 0 ? (
        <EmptyState
          title="Sin retos para esos filtros"
          description="Ajusta equipo, jugador o estado para ver resultados."
        />
      ) : viewMode === "board" ? (
        <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {boardRows.map((row) => {
            const difficulty = getChallengeDifficulty(row.latestChallenge, difficultyThresholds);

            return (
              <article
                key={row.playerId}
                className={`rounded-[12px] border p-3 ${challengeStatusToneClass(row.challengeStatus)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{row.playerName}</p>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {row.teamName ?? "Sin equipo"} · {row.nextMatchLabel}
                    </p>
                  </div>
                  <Badge variant={challengeStatusBadgeVariant(row.challengeStatus)}>
                    {challengeStatusLabel(row.challengeStatus)}
                  </Badge>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                  <span className="rounded-[8px] border bg-[hsl(var(--surface-1)/0.75)] px-2 py-1 text-center tabular-nums">
                    Aciertos {row.successCount}/3
                  </span>
                  <span
                    className={`rounded-[8px] border px-2 py-1 text-center font-semibold ${difficulty.pillClassName}`}
                  >
                    Dif. {difficulty.label} · {difficulty.score.toFixed(2)}x
                  </span>
                  <span className="rounded-[8px] border bg-[hsl(var(--surface-1)/0.75)] px-2 py-1 text-center tabular-nums">
                    Racha {row.streak}
                  </span>
                  <span className="rounded-[8px] border bg-[hsl(var(--surface-1)/0.75)] px-2 py-1 text-center">
                    {trendSymbol(row.trend)} {trendLabel(row.trend)}
                  </span>
                </div>

                {row.latestChallenge?.targets?.length ? (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {row.latestChallenge.targets.slice(0, 3).map((target, index) =>
                      renderTargetTile(row.latestChallenge?.id ?? row.playerId, target, index)
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="space-y-3">
          {groupedByDate.map((group) => (
            <article key={group.key} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(var(--text-subtle))]">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map((challenge) => {
                  const difficulty = getChallengeDifficulty(challenge, difficultyThresholds);
                  return (
                    <article
                      key={challenge.id}
                      className={`rounded-[12px] border p-3 ${challengeStatusToneClass(challenge.status)}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{challenge.playerName}</p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {challenge.teamName ?? "Sin equipo"} · Match #{challenge.matchId}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="default">{archetypeLabel(challenge.archetype)}</Badge>
                          <Badge variant={challengeStatusBadgeVariant(challenge.status)}>
                            {challengeStatusLabel(challenge.status)}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--text-subtle))]">
                        <span className="rounded-full border px-2 py-0.5">
                          {formatChallengeDateLabel(challenge.challengeDate, challenge.challengeTime)}
                        </span>
                        <span className="rounded-full border px-2 py-0.5">
                          Aciertos {challenge.successCount}/3
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${difficulty.pillClassName}`}
                        >
                          Dificultad {difficulty.label} · {difficulty.score.toFixed(2)}x
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {challenge.targets.map((target, index) =>
                          renderTargetTile(challenge.id, target, index)
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
};

export default TournamentChallengesView;
