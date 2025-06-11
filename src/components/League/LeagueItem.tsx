// components/League/LeagueItem.tsx
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
      className="group bg-white rounded-xl px-5 py-4 shadow flex justify-between items-center transition hover:shadow-lg hover:bg-blue-50"
    >
      <div onClick={onSelect} className="cursor-pointer w-full">
        <h3 className="text-base font-semibold text-blue-950">{league.name}</h3>
        {league.description && (
          <p className="text-sm text-gray-600 truncate">{league.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Creado el {new Date(league.created_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRequest();
        }}
        className="ml-4 text-red-500 hover:text-red-700 transition sm:opacity-100 opacity-0 group-hover:opacity-100"
        title="Eliminar"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </li>
  );
};

export default LeagueItem;
