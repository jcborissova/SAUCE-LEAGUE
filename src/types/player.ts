/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface PlayerBase {
  id: number;
  names: string;
  lastnames: string;
  backJerseyName: string;
  jerseyNumber: number;
  cedula: string;
  description: string;
  photo?: string;
}

export interface Player extends PlayerBase {}

export type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

export interface PlayerFormState extends Omit<PlayerBase, "jerseyNumber" | "cedula" | "photo"> {
  jerseyNumber: string;
  cedula: string;
  photo: string | File;
}
