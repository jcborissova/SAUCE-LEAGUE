import { supabase } from "../lib/supabase";
import type {
  ChallengeBoardRow,
  ChallengeBoardTrend,
  ChallengeMetric,
  ChallengeTarget,
  TournamentChallengeStatus,
  TournamentPlayerChallenge,
} from "../types/tournament-analytics";

export type TournamentChallengeFilters = {
  status?: TournamentChallengeStatus | "all";
  playerId?: number | null;
  search?: string;
  limit?: number;
};

type MatchLookup = {
  id: number;
  teamA: string | null;
  teamB: string | null;
  matchDate: string | null;
  matchTime: string | null;
};

const toNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toIsoDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toIsoTime = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 5);
};

const toChallengeStatus = (value: unknown): TournamentChallengeStatus => {
  if (value === "completed" || value === "elite" || value === "failed" || value === "not_evaluated") {
    return value;
  }
  return "pending";
};

const toChallengeMetric = (value: unknown): ChallengeMetric => {
  if (
    value === "points" ||
    value === "rebounds" ||
    value === "assists" ||
    value === "steals" ||
    value === "blocks" ||
    value === "turnovers_max" ||
    value === "fouls_max" ||
    value === "fg_pct" ||
    value === "ft_pct" ||
    value === "tp_pct" ||
    value === "tpm" ||
    value === "valuation"
  ) {
    return value;
  }

  return "points";
};

const toArchetype = (value: unknown): TournamentPlayerChallenge["archetype"] => {
  if (
    value === "scorer" ||
    value === "creator" ||
    value === "two_way" ||
    value === "rim_protector"
  ) {
    return value;
  }
  return "all_around";
};

const toTeamSide = (value: unknown): TournamentPlayerChallenge["teamSide"] => {
  if (value === "A" || value === "B" || value === "U") return value;
  return null;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const parseTargets = (value: unknown): ChallengeTarget[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const source = toRecord(entry);
      const targetValue = toNumber(source.target);
      const actualValueRaw = source.actual;

      return {
        metric: toChallengeMetric(source.metric),
        label: typeof source.label === "string" && source.label.trim().length > 0 ? source.label.trim() : "Reto",
        op: source.op === "lte" ? "lte" : "gte",
        target: targetValue,
        actual: Number.isFinite(Number(actualValueRaw)) ? Number(actualValueRaw) : null,
        hit: typeof source.hit === "boolean" ? source.hit : null,
      } satisfies ChallengeTarget;
    })
    .filter((target) => Number.isFinite(target.target));
};

const toPlayerName = (row: Record<string, unknown>, fallbackId: number): string => {
  const names = typeof row.names === "string" ? row.names.trim() : "";
  const lastnames = typeof row.lastnames === "string" ? row.lastnames.trim() : "";
  const fullName = `${names} ${lastnames}`.replace(/\s+/g, " ").trim();
  return fullName || `Jugador ${fallbackId}`;
};

const getTodayIsoLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const scheduleSortKey = (dateValue: string | null, timeValue: string | null) => {
  const datePart = dateValue ?? "9999-12-31";
  const timePart = timeValue ?? "99:99";
  return `${datePart}T${timePart}`;
};

const formatChallengeDateLabel = (dateValue: string | null, timeValue: string | null) => {
  if (!dateValue) return "Fecha por definir";

  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return "Fecha por definir";

  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(year, month - 1, day));

  if (!timeValue) return dateLabel;
  return `${dateLabel} · ${timeValue.slice(0, 5)}`;
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const challengeStatusScore = (status: TournamentChallengeStatus): number => {
  if (status === "elite") return 3;
  if (status === "completed") return 2;
  if (status === "failed") return 0;
  return 1;
};

const computeStreak = (rows: TournamentPlayerChallenge[]): number => {
  const settled = rows
    .filter((row) => row.settled)
    .sort((a, b) => scheduleSortKey(a.challengeDate, a.challengeTime).localeCompare(scheduleSortKey(b.challengeDate, b.challengeTime)));

  let streak = 0;
  settled.forEach((row) => {
    if (row.status === "elite" || row.status === "completed") {
      streak += 1;
      return;
    }

    if (row.status === "failed") {
      streak = 0;
    }
  });

  return streak;
};

const computeTrend = (rows: TournamentPlayerChallenge[]): ChallengeBoardTrend => {
  const settled = rows
    .filter((row) => row.settled)
    .sort((a, b) => scheduleSortKey(a.challengeDate, a.challengeTime).localeCompare(scheduleSortKey(b.challengeDate, b.challengeTime)));

  if (settled.length < 3) return "steady";

  const recent = settled.slice(-3).map((row) => challengeStatusScore(row.status));
  const previous = settled.slice(-6, -3).map((row) => challengeStatusScore(row.status));

  const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const previousAvg = previous.length > 0 ? previous.reduce((sum, value) => sum + value, 0) / previous.length : recentAvg;

  if (recentAvg > previousAvg + 0.24) return "up";
  if (recentAvg < previousAvg - 0.24) return "down";
  return "steady";
};

export const listTournamentChallenges = async (
  tournamentId: string,
  filters: TournamentChallengeFilters = {}
): Promise<TournamentPlayerChallenge[]> => {
  const safeTournamentId = tournamentId.trim();
  if (!safeTournamentId) return [];

  const safeStatus = filters.status ?? "all";
  const safePlayerId = Number.isFinite(Number(filters.playerId)) && Number(filters.playerId) > 0
    ? Math.floor(Number(filters.playerId))
    : null;

  let query = supabase
    .from("tournament_player_challenges")
    .select(
      "id, tournament_id, match_id, player_id, team_side, challenge_date, archetype, targets, baseline, actuals, success_count, status, settled, settled_at, locked, version, created_at, updated_at"
    )
    .eq("tournament_id", safeTournamentId)
    .order("challenge_date", { ascending: true })
    .order("match_id", { ascending: true });

  if (safeStatus !== "all") {
    query = query.eq("status", safeStatus);
  }

  if (safePlayerId) {
    query = query.eq("player_id", safePlayerId);
  }

  if (Number.isFinite(filters.limit) && (filters.limit ?? 0) > 0) {
    query = query.limit(Math.min(300, Math.floor(filters.limit!)));
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const playerIds = Array.from(
    new Set(rows.map((row) => toNumber(row.player_id)).filter((value) => value > 0))
  );
  const matchIds = Array.from(
    new Set(rows.map((row) => toNumber(row.match_id)).filter((value) => value > 0))
  );

  const [playersResult, matchesResult] = await Promise.all([
    playerIds.length > 0
      ? supabase
          .from("players")
          .select("id, names, lastnames")
          .in("id", playerIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length > 0
      ? supabase
          .from("matches")
          .select("id, team_a, team_b, match_date, match_time")
          .in("id", matchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  const playersById = new Map<number, string>();
  (playersResult.data ?? []).forEach((row) => {
    const playerId = toNumber(row.id);
    if (playerId <= 0) return;
    playersById.set(playerId, toPlayerName(row as Record<string, unknown>, playerId));
  });

  const matchesById = new Map<number, MatchLookup>();
  (matchesResult.data ?? []).forEach((row) => {
    const matchId = toNumber(row.id);
    if (matchId <= 0) return;

    matchesById.set(matchId, {
      id: matchId,
      teamA: typeof row.team_a === "string" ? row.team_a : null,
      teamB: typeof row.team_b === "string" ? row.team_b : null,
      matchDate: toIsoDate(row.match_date),
      matchTime: toIsoTime(row.match_time),
    });
  });

  const search = normalizeSearch(filters.search ?? "");

  const challenges = rows
    .map((row) => {
      const playerId = toNumber(row.player_id);
      const matchId = toNumber(row.match_id);
      const match = matchesById.get(matchId);
      const teamSide = toTeamSide(row.team_side);
      const teamName =
        teamSide === "A" ? match?.teamA ?? null : teamSide === "B" ? match?.teamB ?? null : null;

      return {
        id: toNumber(row.id),
        tournamentId: String(row.tournament_id ?? safeTournamentId),
        matchId,
        playerId,
        playerName: playersById.get(playerId) ?? `Jugador ${playerId}`,
        teamName,
        teamSide,
        challengeDate: toIsoDate(row.challenge_date),
        challengeTime: match?.matchTime ?? null,
        archetype: toArchetype(row.archetype),
        targets: parseTargets(row.targets),
        baseline: toRecord(row.baseline),
        actuals: toRecord(row.actuals),
        successCount: Math.max(0, toNumber(row.success_count)),
        status: toChallengeStatus(row.status),
        settled: Boolean(row.settled),
        settledAt: toIsoDate(row.settled_at),
        locked: Boolean(row.locked),
        createdAt: toIsoDate(row.created_at) ?? new Date().toISOString(),
        updatedAt: toIsoDate(row.updated_at) ?? new Date().toISOString(),
      } satisfies TournamentPlayerChallenge;
    })
    .filter((row) => {
      if (!search) return true;
      const name = normalizeSearch(row.playerName);
      const team = normalizeSearch(row.teamName ?? "");
      return name.includes(search) || team.includes(search);
    })
    .sort((a, b) => {
      const schedule = scheduleSortKey(a.challengeDate, a.challengeTime).localeCompare(
        scheduleSortKey(b.challengeDate, b.challengeTime)
      );
      if (schedule !== 0) return schedule;
      return a.matchId - b.matchId;
    });

  return challenges;
};

export const listPlayerChallenges = async (
  tournamentId: string,
  playerId: number
): Promise<TournamentPlayerChallenge[]> =>
  listTournamentChallenges(tournamentId, {
    playerId,
  });

export const regenerateTournamentChallenges = async (
  tournamentId: string
): Promise<number> => {
  const safeTournamentId = tournamentId.trim();
  if (!safeTournamentId) return 0;

  const { data, error } = await supabase.rpc("generate_tournament_challenges", {
    p_tournament_id: safeTournamentId,
    p_force: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  const regenerated = Number(data);
  return Number.isFinite(regenerated) ? regenerated : 0;
};

export const buildChallengeBoardRows = (
  challenges: TournamentPlayerChallenge[]
): ChallengeBoardRow[] => {
  const byPlayer = new Map<number, TournamentPlayerChallenge[]>();

  challenges.forEach((challenge) => {
    const current = byPlayer.get(challenge.playerId) ?? [];
    current.push(challenge);
    byPlayer.set(challenge.playerId, current);
  });

  const today = getTodayIsoLocal();

  const rows: ChallengeBoardRow[] = [];

  byPlayer.forEach((playerChallenges, playerId) => {
    const sorted = [...playerChallenges].sort((a, b) =>
      scheduleSortKey(a.challengeDate, a.challengeTime).localeCompare(
        scheduleSortKey(b.challengeDate, b.challengeTime)
      )
    );

    const nextPending =
      sorted.find((row) => row.status === "pending" && (row.challengeDate ?? "9999-12-31") >= today) ??
      sorted.find((row) => row.status === "pending") ??
      null;

    const latest =
      [...sorted].reverse().find((row) => row.settled || row.status === "pending") ?? null;

    const reference = nextPending ?? latest;
    if (!reference) return;

    rows.push({
      playerId,
      playerName: reference.playerName,
      teamName: reference.teamName,
      nextMatchId: nextPending?.matchId ?? null,
      nextMatchLabel: nextPending
        ? formatChallengeDateLabel(nextPending.challengeDate, nextPending.challengeTime)
        : "Sin reto pendiente",
      challengeStatus: reference.status,
      successCount: Math.max(0, reference.successCount),
      streak: computeStreak(sorted),
      trend: computeTrend(sorted),
      latestChallenge: latest,
    });
  });

  return rows.sort((a, b) => {
    const aHasPending = a.challengeStatus === "pending";
    const bHasPending = b.challengeStatus === "pending";

    if (aHasPending !== bHasPending) return aHasPending ? -1 : 1;
    if (b.streak !== a.streak) return b.streak - a.streak;
    return a.playerName.localeCompare(b.playerName, "es", { sensitivity: "base" });
  });
};
