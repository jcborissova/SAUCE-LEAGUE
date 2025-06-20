import React, { useEffect, useState } from "react";
import PlayerCard from "../components/PlayerCard";
import PlayerTable from "../components/PlayerTable";
import AddPlayerModal from "../components/AddPlayerModal";
import { Squares2X2Icon, TableCellsIcon, ArrowPathIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import type { Player, PlayerFormState } from "../types/player";

const Players: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [newPlayer, setNewPlayer] = useState<PlayerFormState>({
    id: 0,
    names: "",
    lastnames: "",
    backjerseyname: "",
    jerseynumber: "",
    cedula: "",
    description: "",
    photo: "",
  });

  const resetPlayerForm = () => {
    setNewPlayer({
      id: 0,
      names: "",
      lastnames: "",
      backjerseyname: "",
      jerseynumber: "",
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
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("is_guest", false)
        .order("id");

      if (error) throw error;

      const normalizedPlayers = (data || []).map((player) => ({
        ...player,
        photo: typeof player.photo === "string" && player.photo.trim() !== "" ? player.photo : "",
      }));

      setPlayers(normalizedPlayers);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar jugadores.");
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
      backjerseyname: player.backjerseyname,
      jerseynumber: player.jerseynumber?.toString() || "",
      cedula: player.cedula?.toString() || "",
      description: player.description,
      photo: player.photo || "",
    });
    setModalMode("edit");
    setEditingPlayerId(player.id);
    setModalOpen(true);
  };

  const handleAddOrEditPlayer = async () => {
    const { names, lastnames, backjerseyname, jerseynumber, cedula } = newPlayer;

    if (!names?.trim() || !lastnames?.trim() || !backjerseyname?.trim() || !jerseynumber || !cedula) {
      toast.warning("Todos los campos obligatorios deben estar llenos.");
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
        names: names.trim(),
        lastnames: lastnames.trim(),
        backjerseyname: backjerseyname.trim(),
        jerseynumber: parseInt(jerseynumber, 10),
        cedula: parseInt(cedula, 10),
        description: newPlayer.description?.trim() || null,
        photo: photoToSave || null,
      };

      if (modalMode === "add") {
        const { error } = await supabase.from("players").insert([payload]);
        if (error) throw error;
        toast.success("Jugador agregado correctamente");
      } else if (editingPlayerId) {
        const { error } = await supabase.from("players").update(payload).eq("id", editingPlayerId);
        if (error) throw error;
        toast.success("Jugador actualizado");
      }

      setModalOpen(false);
      fetchPlayers();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (id: number) => {
    try {
      setLoading(true);
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
      toast.success("Jugador eliminado");
      fetchPlayers();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar jugador");
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(p =>
    `${p.names} ${p.lastnames} ${p.backjerseyname} ${p.jerseynumber}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );  

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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 pt-20 text-center">
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden cursor-pointer bg-gray-100 flex items-center justify-center">
              {viewPlayer.photo ? (
                <img
                  src={viewPlayer.photo}
                  alt="Jugador"
                  className="w-full h-full object-cover"
                  onClick={() => setExpanded(true)}
                />
              ) : (
                <UserCircleIcon className="w-20 h-20 text-gray-300" />
              )}
            </div>
            <button onClick={() => setViewPlayer(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl font-bold">×</button>
            <div>
              <h2 className="text-xl font-semibold text-blue-950">{viewPlayer.names} {viewPlayer.lastnames}</h2>
              <p className="text-sm text-gray-500 mt-1">Jersey #{viewPlayer.jerseynumber}</p>
              <p className="text-xs text-gray-400 mt-1 italic">{viewPlayer.description || "Jugador de liga"}</p>
            </div>
          </div>
          {expanded && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setExpanded(false)}>
              <img src={viewPlayer.photo} alt="Jugador" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </div>
      )}

      {/* Buscador */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Buscar jugador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded-lg px-4 py-2 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="h-8 w-8 text-blue-800 animate-spin" />
        </div>
      ) : viewMode === "table" ? (
        <PlayerTable
          players={filteredPlayers}
          onDelete={handleDeletePlayer}
          onOpenModal={openAddModal}
          onEdit={openEditModal}
          onView={setViewPlayer}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlayers.map((player) => (
            <PlayerCard key={player.id} player={player} onDelete={handleDeletePlayer} />
          ))}
        </div>
      )}

    </div>
  );
};

export default Players;
