import React from "react";
import { TrashIcon, PencilIcon, EyeIcon, UserPlusIcon } from "@heroicons/react/24/solid";

interface Player {
  id: number;
  name: string;
  number: number;
  description: string;
}

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
              <th className="p-3 text-left font-semibold hidden md:table-cell">Description</th>
              <th className="p-3 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {players.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-gray-600 font-semibold">
                  🚫 No players registered.
                </td>
              </tr>
            ) : (
              players.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">#{player.number}</td>
                  <td className="p-3 text-gray-700">{player.name}</td>
                  <td className="p-3 text-gray-600 hidden md:table-cell">{player.description}</td>
                  <td className="p-3 text-center space-x-2 flex justify-center">
                    <button
                      onClick={() => onView(player)}
                      className="text-blue-500 hover:text-blue-700 transition"
                      title="View"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onEdit(player)}
                      className="text-yellow-500 hover:text-yellow-600 transition"
                      title="Edit"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(player.id)}
                      className="text-red-600 hover:text-red-800 transition"
                      title="Delete"
                    >
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
