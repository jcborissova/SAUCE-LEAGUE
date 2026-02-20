import React, { useEffect, useMemo, useState } from "react";
import PlayerCard from "../components/PlayerCard";
import PlayerTable from "../components/PlayerTable";
import AddPlayerModal from "../components/AddPlayerModal";
import { Squares2X2Icon, TableCellsIcon, ArrowPathIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import type { Player, PlayerFormState } from "../types/player";
import Pagination from "../components/ui/pagination";
import PageHeader from "../components/ui/PageHeader";

type PlayerSortMode = "name_asc" | "name_desc" | "jersey_asc" | "recent";
type PhotoFilter = "all" | "with_photo" | "without_photo";

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getPlayerSearchBlob = (player: Player): string =>
  normalizeText(
    [
      player.names,
      player.lastnames,
      player.backjerseyname,
      player.description || "",
      String(player.jerseynumber || ""),
      String(player.cedula || ""),
    ].join(" ")
  );

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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<PlayerSortMode>("name_asc");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 220);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, viewMode, sortMode, photoFilter]);

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

  const filteredPlayers = useMemo(() => {
    const query = normalizeText(debouncedSearchTerm);
    let next = [...players];

    if (photoFilter === "with_photo") {
      next = next.filter((player) => Boolean(player.photo));
    } else if (photoFilter === "without_photo") {
      next = next.filter((player) => !player.photo);
    }

    if (query.length > 0) {
      next = next.filter((player) => getPlayerSearchBlob(player).includes(query));
    }

    next.sort((a, b) => {
      if (sortMode === "recent") return b.id - a.id;
      if (sortMode === "jersey_asc") return Number(a.jerseynumber || 0) - Number(b.jerseynumber || 0);

      const aName = `${a.lastnames || ""} ${a.names || ""}`.trim();
      const bName = `${b.lastnames || ""} ${b.names || ""}`.trim();
      const compare = aName.localeCompare(bName, "es", { sensitivity: "base" });
      return sortMode === "name_desc" ? -compare : compare;
    });

    return next;
  }, [players, debouncedSearchTerm, sortMode, photoFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const paginatedPlayers = filteredPlayers.slice((page - 1) * pageSize, page * pageSize);
  const isSearchPending = searchTerm !== debouncedSearchTerm;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="mx-auto p-3 sm:p-4 lg:p-5 space-y-5">
      <PageHeader
        title="Gestión de jugadores"
        subtitle="Agrega, edita y organiza el roster con vista tabla o tarjetas."
        badge="Roster"
        actions={(
          <button
            onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
            className="btn-secondary w-full sm:w-auto"
            disabled={loading}
          >
            {viewMode === "table" ? (
              <>
                <Squares2X2Icon className="h-5 w-5" />
                Vista tarjetas
              </>
            ) : (
              <>
                <TableCellsIcon className="h-5 w-5" />
                Vista tabla
              </>
            )}
          </button>
        )}
      />

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
          <div className="relative app-card rounded-3xl shadow-xl w-full max-w-sm p-6 pt-20 text-center">
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full border-4 border-[hsl(var(--surface-1))] shadow-lg overflow-hidden cursor-pointer bg-[hsl(var(--surface-2))] flex items-center justify-center">
              {viewPlayer.photo ? (
                <img
                  src={viewPlayer.photo}
                  alt="Jugador"
                  className="w-full h-full object-cover"
                  onClick={() => setExpanded(true)}
                />
              ) : (
                <UserCircleIcon className="w-20 h-20 text-[hsl(var(--text-subtle))]" />
              )}
            </div>
            <button onClick={() => setViewPlayer(null)} className="absolute top-4 right-4 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--foreground))] text-xl font-bold">×</button>
            <div>
              <h2 className="text-xl font-semibold">{viewPlayer.names} {viewPlayer.lastnames}</h2>
              <p className="text-sm text-[hsl(var(--text-subtle))] mt-1">Jersey #{viewPlayer.jerseynumber}</p>
              <p className="text-xs text-[hsl(var(--text-subtle))] mt-1 italic">{viewPlayer.description || "Jugador de liga"}</p>
            </div>
          </div>
          {expanded && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setExpanded(false)}>
              <img src={viewPlayer.photo} alt="Jugador" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </div>
      )}

      <div className="app-card p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_220px] gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, alias, jersey o cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base w-full pl-9 pr-10"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full inline-flex items-center justify-center hover:bg-[hsl(var(--muted))] transition"
                aria-label="Limpiar búsqueda"
              >
                <XMarkIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </button>
            ) : null}
          </div>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as PlayerSortMode)}
            className="input-base w-full"
          >
            <option value="name_asc">Orden: Nombre A-Z</option>
            <option value="name_desc">Orden: Nombre Z-A</option>
            <option value="jersey_asc">Orden: Jersey (menor a mayor)</option>
            <option value="recent">Orden: Más recientes</option>
          </select>

          <select
            value={photoFilter}
            onChange={(e) => setPhotoFilter(e.target.value as PhotoFilter)}
            className="input-base w-full"
          >
            <option value="all">Fotos: Todos</option>
            <option value="with_photo">Fotos: Con foto</option>
            <option value="without_photo">Fotos: Sin foto</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <p className="text-[hsl(var(--muted-foreground))]">
            Mostrando <span className="font-semibold text-[hsl(var(--foreground))]">{filteredPlayers.length}</span> de{" "}
            <span className="font-semibold text-[hsl(var(--foreground))]">{players.length}</span> jugadores.
          </p>
          {isSearchPending ? (
            <span className="inline-flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              Buscando...
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="h-8 w-8 text-[hsl(var(--primary))] animate-spin" />
        </div>
      ) : viewMode === "table" ? (
        <PlayerTable
          players={paginatedPlayers}
          resultSummary={`Página ${page} de ${totalPages}`}
          onDelete={handleDeletePlayer}
          onOpenModal={openAddModal}
          onEdit={openEditModal}
          onView={setViewPlayer}
        />
      ) : (
        <>
          {paginatedPlayers.length === 0 ? (
            <div className="app-card p-6 text-center text-[hsl(var(--muted-foreground))]">
              No encontramos jugadores con ese criterio.
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedPlayers.map((player) => (
                <PlayerCard key={player.id} player={player} onDelete={handleDeletePlayer} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && filteredPlayers.length > 0 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

    </div>
  );
};

export default Players;
