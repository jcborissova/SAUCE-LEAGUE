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

export interface PlayerFormState extends Omit<Player, "jerseyNumber" | "photo"> {
  jerseyNumber: string;
  photo: string | File;
}
