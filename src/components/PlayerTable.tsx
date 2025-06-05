import React from "react";
import { TrashIcon, PencilIcon, EyeIcon, UserPlusIcon } from "@heroicons/react/24/solid";
import type { Player } from "../types/player";

interface PlayerTableProps {
  players: Player[];
  onDelete: (id: number) => void;
  onOpenModal: () => void;
  onEdit: (player: Player) => void;
  onView: (player: Player) => void;
}

const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  onDelete,
  onOpenModal,
  onEdit,
  onView,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-blue-950">Player List</h2>
        <button
          onClick={onOpenModal}
          className="flex items-center gap-2 bg-blue-950 text-white px-4 py-2 rounded hover:bg-blue-800 transition"
        >
          <UserPlusIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Add Player</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-blue-950 text-white">
            <tr>
              <th className="p-3 text-left font-semibold">#</th>
              <th className="p-3 text-left font-semibold">Name</th>
              <th className="p-3 text-left font-semibold hidden md:table-cell">Back Name</th>
              <th className="p-3 text-left font-semibold hidden lg:table-cell">Description</th>
              <th className="p-3 text-left font-semibold hidden lg:table-cell">Cédula</th>
              <th className="p-3 text-left font-semibold hidden xl:table-cell">Photo</th>
              <th className="p-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {players.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-gray-600 font-semibold">
                  🚫 No players registered.
                </td>
              </tr>
            ) : (
              players.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">#{p.jerseyNumber}</td>
                  <td className="p-3 text-gray-700">{p.names} {p.lastnames}</td>
                  <td className="p-3 text-gray-700 hidden md:table-cell">{p.backJerseyName}</td>
                  <td className="p-3 text-gray-600 hidden lg:table-cell">{p.description}</td>
                  <td className="p-3 text-gray-600 hidden lg:table-cell">{p.cedula}</td>
                  <td className="p-3 hidden xl:table-cell">
                    {p.photo ? (
                      <img
                        src={p.photo}
                        alt="Photo"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 italic">No photo</span>
                    )}
                  </td>
                  <td className="p-3 flex justify-center gap-2 text-center">
                    <button onClick={() => onView(p)} className="text-blue-500 hover:text-blue-700" title="View">
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => onEdit(p)} className="text-yellow-500 hover:text-yellow-600" title="Edit">
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="text-red-600 hover:text-red-800" title="Delete">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerTable;
