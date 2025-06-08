/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { Player } from "../../types/player";
import { XMarkIcon } from "@heroicons/react/24/solid";

// Extendemos Player con propiedades específicas para la liga
type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

interface Props {
  player: LeaguePlayer;
  onDelete?: (id: number) => void;
  onDoubleClick?: () => void;
  dragProps?: {
    attributes: any;
    listeners: any;
  };
}

const PlayerCard: React.FC<Props> = ({ player, onDelete, onDoubleClick, dragProps }) => {
  const arrivalTimeFormatted = player.arrivalTime
    ? new Date(player.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="relative bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-center text-sm sm:text-base font-medium text-blue-950 hover:shadow-md transition w-full"
      onDoubleClick={onDoubleClick}
    >
      {/* Botón Eliminar */}
      {onDelete && (
        <div className="absolute top-1 right-1 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(player.id);
            }}
            className="text-gray-400 hover:text-red-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Zona de arrastre (solo si está disponible) */}
      {dragProps && (
        <div
          {...dragProps.listeners}
          {...dragProps.attributes}
          className="absolute bottom-1 left-1 text-gray-300 hover:text-gray-500 cursor-grab z-10"
          title="Arrastrar"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="5" cy="6" r="1.5" />
            <circle cx="5" cy="10" r="1.5" />
            <circle cx="5" cy="14" r="1.5" />
            <circle cx="11" cy="6" r="1.5" />
            <circle cx="11" cy="10" r="1.5" />
            <circle cx="11" cy="14" r="1.5" />
          </svg>
        </div>
      )}

      {/* Contenido */}
      <div className="pointer-events-auto">
        <p className="truncate font-semibold text-blue-950">
          {player.names} {player.lastnames}
        </p>
        {player.isGuest && (
          <p className="text-xs text-gray-500 font-normal">(Invitado)</p>
        )}
        {arrivalTimeFormatted && (
          <p className="text-xs text-gray-400 font-normal mt-1">
            {arrivalTimeFormatted}
          </p>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
