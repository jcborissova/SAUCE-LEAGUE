import React, { useEffect, useState } from "react";
import PlayerCard from "../components/PlayerCard";
import PlayerTable from "../components/PlayerTable";
import AddPlayerModal from "../components/AddPlayerModal";
import { Squares2X2Icon, TableCellsIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import { supabase } from "../lib/supabase";
import type { Player, PlayerFormState } from "../types/player";
import { toast } from "react-toastify";

const Players: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [newPlayer, setNewPlayer] = useState<Player>({
    id: 0,
    names: "",
    lastnames: "",
    backJerseyName: "",
    jerseyNumber: 0,
    cedula: "",
    description: "",
    photo: "",
  });

  const resetPlayerForm = () => {
    setNewPlayer({
      id: 0,
      names: "",
      lastnames: "",
      backJerseyName: "",
      jerseyNumber: 0,
      cedula: "",
      description: "",
      photo: "",
    });
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("players").select("*").order("id");
      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al cargar jugadores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const openAddModal = () => {
    resetPlayerForm();
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
      jerseyNumber: player.jerseyNumber,
      cedula: player.cedula,
      description: player.description,
      photo: player.photo || "",
    });
    setModalMode("edit");
    setEditingPlayerId(player.id);
    setModalOpen(true);
  };

  const handleAddOrEditPlayer = async () => {
    const { names, lastnames, backJerseyName, jerseyNumber, cedula } = newPlayer;

    if (!names.trim() || !lastnames.trim() || !backJerseyName.trim() || !jerseyNumber || !cedula) {
      toast.warning("⚠️ Todos los campos obligatorios deben estar llenos.");
      return;
    }

    try {
      setLoading(true);
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
        jerseyNumber: newPlayer.jerseyNumber,
        cedula: newPlayer.cedula,
        description: newPlayer.description,
        photo: photoToSave,
      };

      if (modalMode === "add") {
        const { error } = await supabase.from("players").insert([payload]);
        if (error) throw error;
        toast.success("✅ Jugador agregado correctamente");
      } else if (editingPlayerId) {
        const { error } = await supabase.from("players").update(payload).eq("id", editingPlayerId);
        if (error) throw error;
        toast.success("✏️ Jugador actualizado");
      }

      setModalOpen(false);
      fetchPlayers();
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al guardar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (id: number) => {
    try {
      setLoading(true);
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
      toast.success("🗑️ Jugador eliminado");
      fetchPlayers();
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al eliminar jugador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-blue-950">Gestión de Jugadores</h2>
        <button
          onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
          className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition"
          disabled={loading}
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
            <p className="text-sm text-gray-600 mb-2">Jersey #{viewPlayer.jerseyNumber}</p>
            <p className="text-gray-500 text-sm mb-4">{viewPlayer.description}</p>
            <button
              onClick={() => setViewPlayer(null)}
              className="px-4 py-2 rounded bg-blue-950 text-white hover:bg-blue-800 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="h-8 w-8 text-blue-800 animate-spin" />
        </div>
      ) : viewMode === "table" ? (
        <PlayerTable
          players={players}
          onDelete={handleDeletePlayer}
          onOpenModal={openAddModal}
          onEdit={openEditModal}
          onView={setViewPlayer}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {players.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center space-y-2 p-10 text-center text-gray-600 bg-white rounded-lg shadow-md">
              <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Sin jugadores registrados</p>
            </div>
          ) : (
            players.map((player) => (
              <PlayerCard key={player.id} player={player} onDelete={handleDeletePlayer} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Players;
