/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { Player } from "../../types/player";
import { ArrowRightIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";

type Props = {
  availablePlayers: Player[];
  currentTeamPlayers: Player[];
  assignPlayer: (id: number) => void;
  removePlayer: (id: number) => void;
};

const TeamPlayersGrid: React.FC<Props> = ({
  availablePlayers,
  currentTeamPlayers,
  assignPlayer,
  removePlayer,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <div className="app-card rounded-xl p-4">
        <h4 className="text-base font-semibold mb-3 text-[hsl(var(--primary))]">Jugadores disponibles</h4>
        <ul className="space-y-2 overflow-y-auto max-h-72">
          {availablePlayers.map((player) => (
            <li
              key={player.id}
              className="flex justify-between items-center bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--muted))] rounded-lg px-3 py-2 transition cursor-pointer"
              onDoubleClick={() => assignPlayer(player.id)}
            >
              <span className="text-sm font-medium">
                {player.names} {player.lastnames} #{player.jerseynumber}
              </span>
              <button
                onClick={() => assignPlayer(player.id)}
                className="p-1 text-[hsl(var(--success))] hover:opacity-80 transition"
              >
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="app-card rounded-xl p-4">
        <h4 className="text-base font-semibold mb-3 text-[hsl(var(--primary))]">Jugadores en el equipo</h4>
        <ul className="space-y-2 overflow-y-auto max-h-72">
          {currentTeamPlayers.map((player) => (
            <li
              key={player.id}
              className="flex justify-between items-center bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--muted))] rounded-lg px-3 py-2 transition cursor-pointer"
              onDoubleClick={() => removePlayer(player.id)}
            >
              <span className="text-sm font-medium">
                {player.names} {player.lastnames} #{player.jerseynumber}
              </span>
              <button
                onClick={() => removePlayer(player.id)}
                className="p-1 text-[hsl(var(--destructive))] hover:opacity-80 transition"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TeamPlayersGrid;
