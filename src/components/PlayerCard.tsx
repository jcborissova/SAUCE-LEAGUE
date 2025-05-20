import React from "react";
import { TrashIcon } from "@heroicons/react/24/solid";

interface Player {
  id: number;
  name: string;
  number: number;
  description: string;
  photo?: string;
}

interface PlayerCardProps {
  player: Player;
  onDelete: (id: number) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, onDelete }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-12 h-12 rounded-full object-cover border border-gray-300"
          />
        ) : (
          <div className="w-12 h-12 bg-red-900 text-white rounded-full flex items-center justify-center font-bold">
            #{player.number}
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold">{player.name}</h3>
          <p className="text-gray-600 text-sm">{player.description}</p>
        </div>
      </div>
      <button
        onClick={() => onDelete(player.id)}
        className="text-red-600 hover:text-red-800 flex items-center gap-1 transition"
      >
        <TrashIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default PlayerCard;
