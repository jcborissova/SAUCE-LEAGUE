/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LeaguePlayer } from "../types/player";

export function mapSupabaseLeaguePlayer(item: any): LeaguePlayer {
  return {
    ...item.players,
    isGuest: item.players.is_guest,
    arrivalTime: item.arrival_time ? new Date(item.arrival_time).getTime() : undefined,
  };
}
