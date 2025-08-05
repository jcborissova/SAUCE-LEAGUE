/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

type Props = {
  teams: { id: number; name: string }[];
  activeIndex: number | null;
  setActiveIndex: (index: number) => void;
  deleteTeam: (index: number) => void;
};

const TeamSelector: React.FC<Props> = ({ teams, activeIndex, setActiveIndex, deleteTeam }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 mb-6">
      {teams.map((team, idx) => (
        <div
          key={team.id}
          className={`flex items-center border rounded-2xl px-4 py-2 whitespace-nowrap font-medium transition ${
            activeIndex === idx
              ? "bg-blue-600 text-white border-blue-600 shadow-md"
              : "bg-white text-blue-700 border-blue-700"
          }`}
        >
          <button onClick={() => setActiveIndex(idx)} className="flex-1 text-left">
            {team.name || `Equipo ${idx + 1}`}
          </button>
          <button
            onClick={() => deleteTeam(idx)}
            className="ml-2 p-1 text-red-500 hover:text-red-700 transition"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default TeamSelector;
