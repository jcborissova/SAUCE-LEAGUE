import React from "react";
import { useSwipeable } from "react-swipeable";
import { TrashIcon } from "@heroicons/react/24/solid";

type League = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

interface Props {
  league: League;
  onSelect: () => void;
  onDeleteRequest: () => void;
}

const LeagueItem: React.FC<Props> = ({ league, onSelect, onDeleteRequest }) => {
  const handlers = useSwipeable({
    onSwipedLeft: () => onDeleteRequest(),
    preventScrollOnSwipe: true,
    trackTouch: true,
  });

  return (
    <li
      {...handlers}
      className="group app-card px-4 py-3 sm:px-5 flex justify-between items-center transition-colors hover:bg-[hsl(var(--muted))]"
    >
      <div onClick={onSelect} className="cursor-pointer w-full">
        <h3 className="text-base font-semibold">{league.name}</h3>
        {league.description && (
          <p className="text-sm text-[hsl(var(--text-subtle))] truncate">{league.description}</p>
        )}
        <p className="text-xs text-[hsl(var(--text-subtle))] mt-1">
          Creado el {new Date(league.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Botón de eliminar siempre visible */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRequest();
        }}
        className="ml-4 text-[hsl(var(--destructive))] hover:opacity-80 transition"
        title="Eliminar"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </li>
  );
};

export default LeagueItem;
