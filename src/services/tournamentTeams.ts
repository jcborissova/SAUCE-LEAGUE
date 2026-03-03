import { supabase } from "../lib/supabase";
import type { Player } from "../types/player";

export type TournamentTeamAssignment = {
  id: number;
  name: string;
  playerIds: number[];
};

export type TournamentTeamRoster = {
  id: number;
  name: string;
  players: Player[];
};

type TournamentTeamInput = {
  name: string;
  playerIds: number[];
};

const PLAYER_DIRECTORY_COLUMNS = "id, names, lastnames, backjerseyname, jerseynumber";
const PLAYER_IN_QUERY_CHUNK = 200;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toStringSafe = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizePlayer = (row: Record<string, unknown>): Player => ({
  id: toNumber(row.id),
  names: toStringSafe(row.names),
  lastnames: toStringSafe(row.lastnames),
  backjerseyname: toStringSafe(row.backjerseyname),
  jerseynumber: toNumber(row.jerseynumber),
  cedula: toStringSafe(row.cedula),
  description: toStringSafe(row.description),
  photo: toStringSafe(row.photo),
});

const normalizeTeamName = (value: unknown, fallbackIndex?: number): string => {
  const clean = toStringSafe(value);
  if (clean.length > 0) return clean;
  if (typeof fallbackIndex === "number") return `Equipo ${fallbackIndex + 1}`;
  return "Equipo";
};

const isStatementTimeoutError = (message: string): boolean =>
  message.toLowerCase().includes("statement timeout");

const isMissingTournamentColumnError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("tournament_id") && normalized.includes("team_players");
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export const fetchTournamentPlayers = async (): Promise<Player[]> => {
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_DIRECTORY_COLUMNS)
    .eq("is_guest", false)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => normalizePlayer(row as Record<string, unknown>))
    .filter((player) => player.id > 0);
};

const fetchPlayersByIds = async (
  playerIds: number[],
  options?: { withPhoto?: boolean }
): Promise<Player[]> => {
  const uniqueIds = Array.from(new Set(playerIds.map((id) => toNumber(id)).filter((id) => id > 0)));
  if (uniqueIds.length === 0) return [];

  const playersMap = new Map<number, Player>();

  for (const idChunk of chunkArray(uniqueIds, PLAYER_IN_QUERY_CHUNK)) {
    const result = options?.withPhoto
      ? await supabase
          .from("players")
          .select("id, names, lastnames, backjerseyname, jerseynumber, description, photo")
          .eq("is_guest", false)
          .in("id", idChunk)
          .order("id", { ascending: true })
      : await supabase
          .from("players")
          .select("id, names, lastnames, backjerseyname, jerseynumber")
          .eq("is_guest", false)
          .in("id", idChunk)
          .order("id", { ascending: true });

    if (result.error) {
      throw new Error(result.error.message);
    }

    (result.data ?? []).forEach((row) => {
      const normalized = normalizePlayer(row as Record<string, unknown>);
      if (normalized.id > 0) {
        playersMap.set(normalized.id, normalized);
      }
    });
  }

  return Array.from(playersMap.values()).sort((a, b) => a.id - b.id);
};

export const fetchTournamentTeamAssignments = async (
  tournamentId: string
): Promise<TournamentTeamAssignment[]> => {
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("tournament_id", tournamentId)
    .order("id", { ascending: true });

  if (teamsError) {
    throw new Error(teamsError.message);
  }

  const teams = (teamsData ?? []).map((row, index) => ({
    id: toNumber(row.id),
    name: normalizeTeamName(row.name, index),
    playerIds: [],
  }));

  const teamIds = teams.map((team) => team.id).filter((teamId) => teamId > 0);
  if (teamIds.length === 0) return teams;

  let linksData: Array<{ team_id: unknown; player_id: unknown }> = [];
  let linksErrorMessage: string | null = null;

  const { data: scopedLinksData, error: scopedLinksError } = await supabase
    .from("team_players")
    .select("team_id, player_id")
    .eq("tournament_id", tournamentId);

  if (!scopedLinksError) {
    linksData = (scopedLinksData ?? []) as Array<{ team_id: unknown; player_id: unknown }>;
  } else {
    linksErrorMessage = scopedLinksError.message;

    // Compatibilidad hacia atras: si la columna tournament_id aun no existe,
    // usamos el camino legacy por team_id.
    if (isMissingTournamentColumnError(scopedLinksError.message) || isStatementTimeoutError(scopedLinksError.message)) {
      const { data: legacyLinksData, error: legacyLinksError } = await supabase
        .from("team_players")
        .select("team_id, player_id")
        .in("team_id", teamIds);

      if (!legacyLinksError) {
        linksData = (legacyLinksData ?? []) as Array<{ team_id: unknown; player_id: unknown }>;
        linksErrorMessage = null;
      } else {
        linksErrorMessage = legacyLinksError.message;
      }
    }
  }

  if (linksErrorMessage) {
    if (isStatementTimeoutError(linksErrorMessage)) {
      console.warn("team_players excedio statement_timeout; se devolvieron equipos sin plantilla.");
      return teams;
    }
    throw new Error(linksErrorMessage);
  }

  const playersByTeam = new Map<number, Set<number>>();
  linksData.forEach((row) => {
    const teamId = toNumber(row.team_id);
    const playerId = toNumber(row.player_id);
    if (teamId <= 0 || playerId <= 0) return;

    const current = playersByTeam.get(teamId) ?? new Set<number>();
    current.add(playerId);
    playersByTeam.set(teamId, current);
  });

  return teams.map((team) => ({
    ...team,
    playerIds: Array.from(playersByTeam.get(team.id) ?? []),
  }));
};

export const fetchTournamentTeamsRoster = async (tournamentId: string): Promise<TournamentTeamRoster[]> => {
  const teams = await fetchTournamentTeamAssignments(tournamentId);
  const rosterPlayerIds = Array.from(new Set(teams.flatMap((team) => team.playerIds)));
  let players: Player[] = [];

  try {
    players = await fetchPlayersByIds(rosterPlayerIds, { withPhoto: true });
  } catch (error) {
    console.error("No se pudo cargar el directorio de jugadores. Se mostraran equipos sin detalles.", error);
  }

  const playersById = new Map(players.map((player) => [player.id, player]));

  return teams.map((team, index) => ({
    id: team.id,
    name: normalizeTeamName(team.name, index),
    players: team.playerIds
      .map((playerId) => playersById.get(playerId))
      .filter((player): player is Player => Boolean(player)),
  }));
};

export const saveTournamentTeamAssignments = async (
  tournamentId: string,
  teams: TournamentTeamInput[]
): Promise<void> => {
  const sanitizedTeams = teams.map((team, index) => ({
    name: normalizeTeamName(team.name, index),
    playerIds: Array.from(
      new Set(team.playerIds.map((playerId) => toNumber(playerId)).filter((playerId) => playerId > 0))
    ),
  }));

  const { data: existingTeams, error: existingTeamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (existingTeamsError) {
    throw new Error(existingTeamsError.message);
  }

  const existingIds = (existingTeams ?? [])
    .map((team) => toNumber(team.id))
    .filter((teamId) => teamId > 0);

  if (existingIds.length > 0) {
    const { error: removePlayersError } = await supabase.from("team_players").delete().in("team_id", existingIds);
    if (removePlayersError) {
      throw new Error(removePlayersError.message);
    }

    const { error: removeTeamsError } = await supabase.from("teams").delete().in("id", existingIds);
    if (removeTeamsError) {
      throw new Error(removeTeamsError.message);
    }
  }

  for (const team of sanitizedTeams) {
    const { data: createdTeam, error: createTeamError } = await supabase
      .from("teams")
      .insert({ name: team.name, tournament_id: tournamentId })
      .select("id")
      .single();

    if (createTeamError || !createdTeam) {
      throw new Error(createTeamError?.message ?? `No se pudo crear el equipo "${team.name}".`);
    }

    if (team.playerIds.length === 0) continue;

    const participantsRows = team.playerIds.map((playerId) => ({
      team_id: toNumber(createdTeam.id),
      player_id: playerId,
      tournament_id: tournamentId,
    }));

    const { error: addPlayersError } = await supabase.from("team_players").insert(participantsRows);
    if (!addPlayersError) continue;

    if (isMissingTournamentColumnError(addPlayersError.message)) {
      const legacyRows = participantsRows.map((row) => ({
        team_id: row.team_id,
        player_id: row.player_id,
      }));
      const { error: legacyInsertError } = await supabase.from("team_players").insert(legacyRows);
      if (legacyInsertError) {
        throw new Error(legacyInsertError.message);
      }
      continue;
    }

    throw new Error(addPlayersError.message);
  }
};
