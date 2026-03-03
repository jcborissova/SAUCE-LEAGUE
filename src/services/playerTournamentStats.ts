import { supabase } from "../lib/supabase";
import { getTournamentAnalyticsSnapshot } from "./tournamentAnalytics";
import type { PlayerStatsLine } from "../types/tournament-analytics";
import { computeValuation, computeValuationPerGame } from "../utils/tournament-stats";

export type TournamentOption = {
  id: string;
  name: string;
  startDate: string | null;
  createdAt: string | null;
};

export type PlayerTournamentStatSummary = {
  tournamentId: string;
  tournamentName: string;
  tournamentStartDate: string | null;
  line: PlayerStatsLine;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const fullName = (names: unknown, lastnames: unknown, playerId: number) => {
  const joined = `${String(names ?? "").trim()} ${String(lastnames ?? "").trim()}`.replace(/\s+/g, " ").trim();
  return joined || `Jugador ${playerId}`;
};

const computeFgPct = (fgm: number, fga: number) => {
  if (fga <= 0) return 0;
  return Number(((fgm / fga) * 100).toFixed(2));
};

const computePct = (made: number, attempts: number) => {
  if (attempts <= 0) return 0;
  return Number(((made / attempts) * 100).toFixed(2));
};

const listTournamentsMap = async () => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, startdate, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const options: TournamentOption[] = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? "Torneo"),
    startDate: row.startdate ? String(row.startdate) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
  }));

  const byId = new Map(options.map((tournament) => [tournament.id, tournament]));
  return { options, byId };
};

const sortPlayerLines = (rows: PlayerStatsLine[]) =>
  [...rows].sort((a, b) => {
    if (b.valuation !== a.valuation) return b.valuation - a.valuation;
    if (b.valuationPerGame !== a.valuationPerGame) return b.valuationPerGame - a.valuationPerGame;
    if (b.totals.points !== a.totals.points) return b.totals.points - a.totals.points;
    if (b.perGame.ppg !== a.perGame.ppg) return b.perGame.ppg - a.perGame.ppg;
    return a.name.localeCompare(b.name, "es");
  });

const toMergedLine = (row: Record<string, unknown>): PlayerStatsLine => {
  const playerId = toNumber(row.player_id);
  const gamesPlayed = Math.max(0, toNumber(row.games_played));
  const totals = {
    points: toNumber(row.points),
    rebounds: toNumber(row.rebounds),
    assists: toNumber(row.assists),
    steals: toNumber(row.steals),
    blocks: toNumber(row.blocks),
    turnovers: toNumber(row.turnovers),
    fouls: toNumber(row.fouls),
    fgm: toNumber(row.fgm),
    fga: toNumber(row.fga),
    ftm: toNumber(row.ftm),
    fta: toNumber(row.fta),
    tpm: toNumber(row.tpm),
    tpa: toNumber(row.tpa),
  };
  const valuation = computeValuation({
    points: totals.points,
    rebounds: totals.rebounds,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: totals.fouls,
    fgm: totals.fgm,
    fga: totals.fga,
    ftm: totals.ftm,
    fta: totals.fta,
    tpm: totals.tpm,
  });

  return {
    playerId,
    name: fullName(row.names, row.lastnames, playerId),
    photo: row.photo ? String(row.photo) : null,
    teamName: row.team_name ? String(row.team_name) : null,
    gamesPlayed,
    totals,
    perGame: {
      ppg: gamesPlayed > 0 ? Number((totals.points / gamesPlayed).toFixed(2)) : 0,
      rpg: gamesPlayed > 0 ? Number((totals.rebounds / gamesPlayed).toFixed(2)) : 0,
      apg: gamesPlayed > 0 ? Number((totals.assists / gamesPlayed).toFixed(2)) : 0,
      spg: gamesPlayed > 0 ? Number((totals.steals / gamesPlayed).toFixed(2)) : 0,
      bpg: gamesPlayed > 0 ? Number((totals.blocks / gamesPlayed).toFixed(2)) : 0,
      topg: gamesPlayed > 0 ? Number((totals.turnovers / gamesPlayed).toFixed(2)) : 0,
      fpg: gamesPlayed > 0 ? Number((totals.fouls / gamesPlayed).toFixed(2)) : 0,
    },
    fgPct: computeFgPct(totals.fgm, totals.fga),
    ftPct: computePct(totals.ftm, totals.fta),
    tpPct: computePct(totals.tpm, totals.tpa),
    valuation,
    valuationPerGame: computeValuationPerGame(valuation, gamesPlayed),
  };
};

const loadPlayerTournamentRowsFromAnalyticsView = async (playerId: number): Promise<PlayerTournamentStatSummary[] | null> => {
  const { data, error } = await supabase
    .from("tournament_analytics_player_totals")
    .select(
      "tournament_id, phase, player_id, names, lastnames, photo, team_name, games_played, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa"
    )
    .eq("player_id", playerId);

  if (error || !data) return null;

  const { byId } = await listTournamentsMap();

  const grouped = new Map<string, Record<string, unknown>>();

  (data as Record<string, unknown>[]).forEach((row) => {
    const tournamentId = String(row.tournament_id ?? "");
    if (!tournamentId) return;

    const current = grouped.get(tournamentId) ?? {
      tournament_id: tournamentId,
      player_id: toNumber(row.player_id),
      names: row.names,
      lastnames: row.lastnames,
      photo: row.photo,
      team_name: row.team_name,
      games_played: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fgm: 0,
      fga: 0,
      ftm: 0,
      fta: 0,
      tpm: 0,
      tpa: 0,
    };

    current.games_played = toNumber(current.games_played) + toNumber(row.games_played);
    current.points = toNumber(current.points) + toNumber(row.points);
    current.rebounds = toNumber(current.rebounds) + toNumber(row.rebounds);
    current.assists = toNumber(current.assists) + toNumber(row.assists);
    current.steals = toNumber(current.steals) + toNumber(row.steals);
    current.blocks = toNumber(current.blocks) + toNumber(row.blocks);
    current.turnovers = toNumber(current.turnovers) + toNumber(row.turnovers);
    current.fouls = toNumber(current.fouls) + toNumber(row.fouls);
    current.fgm = toNumber(current.fgm) + toNumber(row.fgm);
    current.fga = toNumber(current.fga) + toNumber(row.fga);
    current.ftm = toNumber(current.ftm) + toNumber(row.ftm);
    current.fta = toNumber(current.fta) + toNumber(row.fta);
    current.tpm = toNumber(current.tpm) + toNumber(row.tpm);
    current.tpa = toNumber(current.tpa) + toNumber(row.tpa);

    if (!current.team_name && row.team_name) current.team_name = row.team_name;
    if (!current.photo && row.photo) current.photo = row.photo;

    grouped.set(tournamentId, current);
  });

  const rows = Array.from(grouped.values()).map((row) => {
    const tournamentId = String(row.tournament_id ?? "");
    const tournament = byId.get(tournamentId);

    return {
      tournamentId,
      tournamentName: tournament?.name ?? "Torneo",
      tournamentStartDate: tournament?.startDate ?? null,
      line: toMergedLine(row),
    };
  });

  return rows.sort((a, b) => {
    const dateA = a.tournamentStartDate ?? "0000-01-01";
    const dateB = b.tournamentStartDate ?? "0000-01-01";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return a.tournamentName.localeCompare(b.tournamentName, "es");
  });
};

const loadPlayerTournamentRowsFallback = async (playerId: number): Promise<PlayerTournamentStatSummary[]> => {
  const { options } = await listTournamentsMap();
  const snapshots = await Promise.allSettled(
    options.map(async (tournament) => {
      const snapshot = await getTournamentAnalyticsSnapshot(tournament.id, "all");
      const line = snapshot.playerLines.find((item) => item.playerId === playerId);
      return line
        ? ({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            tournamentStartDate: tournament.startDate,
            line,
          } satisfies PlayerTournamentStatSummary)
        : null;
    })
  );

  return snapshots
    .filter((result): result is PromiseFulfilledResult<PlayerTournamentStatSummary | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((item): item is PlayerTournamentStatSummary => Boolean(item))
    .sort((a, b) => {
      const dateA = a.tournamentStartDate ?? "0000-01-01";
      const dateB = b.tournamentStartDate ?? "0000-01-01";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.tournamentName.localeCompare(b.tournamentName, "es");
    });
};

export const getPlayerStatsByTournament = async (playerId: number): Promise<PlayerTournamentStatSummary[]> => {
  const fromView = await loadPlayerTournamentRowsFromAnalyticsView(playerId);
  if (fromView) return fromView;
  return loadPlayerTournamentRowsFallback(playerId);
};

export const listTournamentOptions = async (): Promise<TournamentOption[]> => {
  const { options } = await listTournamentsMap();
  return options;
};

export const getTournamentPlayersDirectory = async (tournamentId: string): Promise<PlayerStatsLine[]> => {
  const snapshot = await getTournamentAnalyticsSnapshot(tournamentId, "all");
  return sortPlayerLines(snapshot.playerLines);
};
