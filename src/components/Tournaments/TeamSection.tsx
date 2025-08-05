/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { Player } from "../../types/player";

type Props = {
  teamName: string;
  players: Player[];
};

const TeamSection: React.FC<Props> = ({ teamName, players }) => {
  return (
    <div className="w-full bg-white shadow-xl rounded-3xl p-4 md:p-6 border border-gray-200 space-y-6 flex flex-col">
      <h2 className="text-2xl md:text-3xl font-bold text-blue-900">{teamName}</h2>

      {players.length === 0 ? (
        <p className="text-gray-500">No hay jugadores en este equipo.</p>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-4 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 shadow-sm hover:shadow transition"
            >
              {player.photo ? (
                <img
                  src={player.photo}
                  alt={`${player.names} ${player.lastnames}`}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                  {player.names[0]}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{player.names} {player.lastnames}</p>
                <p className="text-xs text-gray-500">#{player.jerseynumber} • {player.backjerseyname}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TeamSection;
