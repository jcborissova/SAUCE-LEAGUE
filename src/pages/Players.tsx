import React, { useEffect, useMemo, useState } from "react";
import {
  Squares2X2Icon,
  TableCellsIcon,
  ArrowPathIcon,
  UserCircleIcon,
  UserPlusIcon,
} from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

import PlayerCard from "../components/PlayerCard";
import PlayerTable from "../components/PlayerTable";
import AddPlayerModal from "../components/AddPlayerModal";
import Pagination from "../components/ui/pagination";
import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import EmptyState from "../components/ui/EmptyState";

import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import type { Player, PlayerFormState } from "../types/player";

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
      const { data, error } = await supabase.from("players").select("*").eq("is_guest", false).order("id");

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
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <PageShell
      title="Gestión de jugadores"
      subtitle="Administra roster con búsqueda rápida y vistas optimizadas para móvil."
      badge="Roster"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button onClick={openAddModal} className="btn-primary w-full sm:w-auto" disabled={loading}>
            <UserPlusIcon className="h-4 w-4" />
            Nuevo
          </button>
          <button
            onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
            className="btn-secondary w-full sm:w-auto"
            disabled={loading}
          >
            {viewMode === "table" ? (
              <>
                <Squares2X2Icon className="h-5 w-5" />
                Tarjetas
              </>
            ) : (
              <>
                <TableCellsIcon className="h-5 w-5" />
                Tabla
              </>
            )}
          </button>
        </div>
      }
    >
      <AddPlayerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddOrEditPlayer}
        newPlayer={newPlayer}
        setNewPlayer={setNewPlayer}
        mode={modalMode}
      />

      {viewPlayer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/56 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-sm border bg-[hsl(var(--surface-1))] p-5 pt-16 text-center">
            <div className="absolute -top-12 left-1/2 flex h-24 w-24 -translate-x-1/2 items-center justify-center overflow-hidden border bg-[hsl(var(--surface-2))]">
              {viewPlayer.photo ? (
                <img src={viewPlayer.photo} alt="Jugador" className="h-full w-full object-cover" onClick={() => setExpanded(true)} />
              ) : (
                <UserCircleIcon className="h-16 w-16 text-[hsl(var(--text-subtle))]" />
              )}
            </div>
            <button
              onClick={() => setViewPlayer(null)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center border text-[hsl(var(--muted-foreground))]"
            >
              ×
            </button>
            <div>
              <h2 className="text-xl font-semibold">
                {viewPlayer.names} {viewPlayer.lastnames}
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--text-subtle))]">Jersey #{viewPlayer.jerseynumber}</p>
              <p className="mt-1 text-xs italic text-[hsl(var(--text-subtle))]">{viewPlayer.description || "Jugador de liga"}</p>
            </div>
          </div>
          {expanded ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setExpanded(false)}>
              <img src={viewPlayer.photo} alt="Jugador" className="max-h-full max-w-full object-contain" />
            </div>
          ) : null}
        </div>
      ) : null}

      <SectionCard>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
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
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center border"
                aria-label="Limpiar búsqueda"
              >
                <XMarkIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </button>
            ) : null}
          </div>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as PlayerSortMode)} className="input-base w-full">
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
            <option value="jersey_asc">Jersey (menor a mayor)</option>
            <option value="recent">Más recientes</option>
          </select>

          <select value={photoFilter} onChange={(e) => setPhotoFilter(e.target.value as PhotoFilter)} className="input-base w-full">
            <option value="all">Fotos: Todos</option>
            <option value="with_photo">Con foto</option>
            <option value="without_photo">Sin foto</option>
          </select>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
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
      </SectionCard>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
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
      ) : paginatedPlayers.length === 0 ? (
        <EmptyState title="No encontramos jugadores" description="Ajusta búsqueda o filtros para ver resultados." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedPlayers.map((player) => (
            <PlayerCard key={player.id} player={player} onDelete={handleDeletePlayer} />
          ))}
        </div>
      )}

      {!loading && filteredPlayers.length > 0 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </PageShell>
  );
};

export default Players;
