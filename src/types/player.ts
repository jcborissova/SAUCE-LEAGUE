// types/player.ts

export interface Player {
  id: number;
  names: string;
  lastnames: string;
  backJerseyName: string;
  jerseyNumber: number;
  cedula: string;
  description: string;
  photo?: string;
}

export interface PlayerFormState extends Omit<Player, "jerseyNumber" | "cedula" | "photo"> {
  jerseyNumber: string;
  cedula: string;
  photo: string | File;
}

export type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

