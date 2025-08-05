/* eslint-disable @typescript-eslint/no-empty-object-type */
// src/types/player.ts
export interface PlayerBase {
  id: number;
  names: string;
  lastnames: string;
  backjerseyname: string;
  jerseynumber: number;
  cedula: string;
  description: string;
  photo?: string;
}

export interface Player extends PlayerBase {}

export type LeaguePlayer = Player & {
  arrivalTime?: number;   // ahora queda como timestamp en milisegundos
  isGuest?: boolean;
};

export interface PlayerFormState extends Omit<PlayerBase, "jerseynumber" | "cedula" | "photo"> {
  jerseynumber: string;
  cedula: string;
  photo: string | File;
}
