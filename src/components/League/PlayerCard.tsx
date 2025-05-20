import React from "react";
import type { Player } from "../../types/player";
import { useDraggable } from "@dnd-kit/core";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface Props {
  player: Player;
  onDelete?: (id: number) => void;
  onDoubleClick?: () => void;
}

const PlayerCard: React.FC<Props> = ({ player, onDelete, onDoubleClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id.toString(),
    data: player,
  });

  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.6 : 1,
    transition: "opacity 0.2s, transform 0.2s",
  };

  const arrivalTimeFormatted = player.arrivalTime
    ? new Date(player.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={onDoubleClick}
      className="relative bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-center text-sm sm:text-base font-medium text-blue-950 cursor-move hover:shadow-md transition w-full"
    >
      {onDelete && (
        <button
          onClick={() => onDelete(player.id)}
          className="absolute top-1 right-1 text-gray-400 hover:text-red-600"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      )}

      <p className="truncate font-semibold text-blue-950">{player.name}</p>
      {player.isGuest && (
        <p className="text-xs text-gray-500 font-normal">(Invitado)</p>
      )}
      {arrivalTimeFormatted && (
        <p className="text-xs text-gray-400 font-normal mt-1">
          🕒 {arrivalTimeFormatted}
        </p>
      )}
    </div>
  );
};

export default PlayerCard;
