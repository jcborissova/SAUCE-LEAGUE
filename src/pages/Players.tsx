import React, { useEffect, useState } from "react";
import PlayerCard from "../components/PlayerCard";
import PlayerTable from "../components/PlayerTable";
import AddPlayerModal from "../components/AddPlayerModal";
import { Squares2X2Icon, TableCellsIcon } from "@heroicons/react/24/solid";
import type { Player, PlayerFormState } from "../types/player";

const Players: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);

  const [newPlayer, setNewPlayer] = useState<PlayerFormState>({
    id: 0,
    names: "",
    lastnames: "",
    backJerseyName: "",
    jerseyNumber: "",
    cedula: "",
    description: "",
    photo: "",
  });

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const fetchPlayers = async () => {
    const res = await fetch("http://localhost:3001/api/players");
    const data = await res.json();
    setPlayers(data);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const openAddModal = () => {
    setNewPlayer({
      id: 0,
      names: "",
      lastnames: "",
      backJerseyName: "",
      jerseyNumber: "",
      cedula: "",
      description: "",
      photo: "",
    });
    setModalMode("add");
    setEditingPlayerId(null);
    setModalOpen(true);
  };

  const openEditModal = (player: Player) => {
    setNewPlayer({
      id: player.id,
      names: player.names,
      lastnames: player.lastnames,
      backJerseyName: player.backJerseyName,
      jerseyNumber: player.jerseyNumber.toString(),
      cedula: player.cedula,
      description: player.description,
      photo: player.photo || "",
    });
    setEditingPlayerId(player.id);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleAddOrEditPlayer = async () => {
    if (
      !newPlayer.names.trim() ||
      !newPlayer.lastnames.trim() ||
      !newPlayer.backJerseyName.trim() ||
      !newPlayer.jerseyNumber.trim() ||
      !newPlayer.cedula.trim()
    ) {
      return;
    }

    let photoToSave = "";
    if (typeof newPlayer.photo === "string") {
      photoToSave = newPlayer.photo;
    } else if (newPlayer.photo instanceof File) {
      photoToSave = await fileToBase64(newPlayer.photo);
    }

    const payload = {
      names: newPlayer.names,
      lastnames: newPlayer.lastnames,
      backJerseyName: newPlayer.backJerseyName,
      jerseyNumber: parseInt(newPlayer.jerseyNumber),
      cedula: newPlayer.cedula,
      description: newPlayer.description,
      photo: photoToSave,
    };

    if (modalMode === "add") {
      await fetch("http://localhost:3001/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else if (editingPlayerId) {
      await fetch(`http://localhost:3001/api/players/${editingPlayerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setModalOpen(false);
    setNewPlayer({
      id: 0,
      names: "",
      lastnames: "",
      backJerseyName: "",
      jerseyNumber: "",
      cedula: "",
      description: "",
      photo: "",
    });
    fetchPlayers();
  };

  const handleDeletePlayer = async (id: number) => {
    await fetch(`http://localhost:3001/api/players/${id}`, {
      method: "DELETE",
    });
    fetchPlayers();
  };

  return (
    <div className="mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-blue-950">Player Management</h2>
        <button
          onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
          className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition"
        >
          {viewMode === "table" ? (
            <Squares2X2Icon className="h-6 w-6" />
          ) : (
            <TableCellsIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      <AddPlayerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddOrEditPlayer}
        newPlayer={newPlayer}
        setNewPlayer={setNewPlayer}
        mode={modalMode}
      />

      {viewPlayer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center">
            {viewPlayer.photo && (
              <img
                src={viewPlayer.photo}
                alt="Player"
                className="w-24 h-24 object-cover rounded-full mx-auto mb-4"
              />
            )}
            <h2 className="text-xl font-bold text-blue-950 mb-1">
              {viewPlayer.names} {viewPlayer.lastnames}
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              Jersey #{viewPlayer.jerseyNumber}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              {viewPlayer.description}
            </p>
            <button
              onClick={() => setViewPlayer(null)}
              className="px-4 py-2 rounded bg-blue-950 text-white hover:bg-blue-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {viewMode === "table" ? (
        <PlayerTable
          players={players}
          onDelete={handleDeletePlayer}
          onOpenModal={openAddModal}
          onEdit={openEditModal}
          onView={(player) => setViewPlayer(player)}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {players.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center space-y-2 p-10 text-center text-gray-600 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">🚫 No players registered.</h3>
              <p className="text-sm text-gray-500">Add players to see them here.</p>
              <button
                onClick={openAddModal}
                className="mt-4 px-4 py-2 bg-blue-950 text-white rounded hover:bg-blue-800 transition"
              >
                Add Player
              </button>
            </div>
          ) : (
            players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onDelete={handleDeletePlayer}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Players;
