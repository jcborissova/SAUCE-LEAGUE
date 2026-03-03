import React, { useEffect, useMemo, useState } from "react";
import {
  Squares2X2Icon,
  TableCellsIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ChartBarSquareIcon,
} from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

import PlayerCard from "../components/PlayerCard";
import PlayerTable from "../components/PlayerTable";
import AddPlayerModal from "../components/AddPlayerModal";
import Pagination from "../components/ui/pagination";
import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import EmptyState from "../components/ui/EmptyState";
import AppSelect from "../components/ui/AppSelect";
import SegmentedControl from "../components/ui/SegmentedControl";
import PlayerProfileModal from "../components/PlayerProfileModal";
import {
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import type { Player, PlayerFormState } from "../types/player";
import type { PlayerStatsLine } from "../types/tournament-analytics";
import type { TournamentOption } from "../services/playerTournamentStats";
import { getTournamentPlayersDirectory, listTournamentOptions } from "../services/playerTournamentStats";

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

const formatTournamentStartDate = (value: string | null) => {
  if (!value) return "Fecha no registrada";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const Players: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [screenMode, setScreenMode] = useState<"roster" | "tournament_stats">("roster");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<PlayerSortMode>("name_asc");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("all");
  const [page, setPage] = useState(1);
  const [tournamentOptions, setTournamentOptions] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [tournamentStatsRows, setTournamentStatsRows] = useState<PlayerStatsLine[]>([]);
  const [tournamentStatsLoading, setTournamentStatsLoading] = useState(false);
  const [tournamentStatsError, setTournamentStatsError] = useState<string | null>(null);
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
    let cancelled = false;

    const loadTournamentOptions = async () => {
      try {
        const options = await listTournamentOptions();
        if (cancelled) return;

        setTournamentOptions(options);
        setSelectedTournamentId((current) => (current ? current : options[0]?.id ?? ""));
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          toast.error("No se pudieron cargar los torneos para estadísticas.");
        }
      }
    };

    loadTournamentOptions();

    return () => {
      cancelled = true;
    };
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

  const openEditFromProfile = (player: Player) => {
    setViewPlayer(null);
    openEditModal(player);
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

  useEffect(() => {
    if (screenMode !== "tournament_stats" || !selectedTournamentId) return;

    let cancelled = false;

    const loadTournamentStatsDirectory = async () => {
      setTournamentStatsLoading(true);
      setTournamentStatsError(null);

      try {
        const rows = await getTournamentPlayersDirectory(selectedTournamentId);
        if (!cancelled) setTournamentStatsRows(rows);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setTournamentStatsRows([]);
          setTournamentStatsError(error instanceof Error ? error.message : "No se pudieron cargar estadísticas del torneo.");
        }
      } finally {
        if (!cancelled) setTournamentStatsLoading(false);
      }
    };

    loadTournamentStatsDirectory();

    return () => {
      cancelled = true;
    };
  }, [screenMode, selectedTournamentId]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selectedTournament = useMemo(
    () => tournamentOptions.find((option) => option.id === selectedTournamentId) ?? null,
    [tournamentOptions, selectedTournamentId]
  );

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

      <PlayerProfileModal
        isOpen={Boolean(viewPlayer)}
        player={viewPlayer}
        onClose={() => setViewPlayer(null)}
        onEdit={openEditFromProfile}
      />

      <SectionCard>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Vista de jugadores</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">
                Alterna entre el roster y la vista completa de números por torneo.
              </p>
            </div>
          </div>

          <SegmentedControl
            value={screenMode}
            onChange={setScreenMode}
            options={[
              { label: "Roster", value: "roster" },
              { label: "Números Torneo", value: "tournament_stats" },
            ]}
            className="max-w-full"
          />
        </div>
      </SectionCard>

      {screenMode === "roster" ? (
        <>
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

              <AppSelect value={sortMode} onChange={(e) => setSortMode(e.target.value as PlayerSortMode)} className="input-base w-full">
                <option value="name_asc">Nombre A-Z</option>
                <option value="name_desc">Nombre Z-A</option>
                <option value="jersey_asc">Jersey (menor a mayor)</option>
                <option value="recent">Más recientes</option>
              </AppSelect>

              <AppSelect value={photoFilter} onChange={(e) => setPhotoFilter(e.target.value as PhotoFilter)} className="input-base w-full">
                <option value="all">Fotos: Todos</option>
                <option value="with_photo">Con foto</option>
                <option value="without_photo">Sin foto</option>
              </AppSelect>
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
        </>
      ) : (
        <>
          <SectionCard
            title="Números por torneo"
            description="Vista organizada de estadísticas simples de todos los jugadores en el torneo seleccionado."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Torneo</span>
                  <AppSelect
                    value={selectedTournamentId}
                    onChange={(e) => setSelectedTournamentId(String(e.target.value))}
                    className="input-base"
                    disabled={tournamentOptions.length === 0}
                  >
                    {tournamentOptions.length > 0 ? (
                      tournamentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Sin torneos</option>
                    )}
                  </AppSelect>
                </label>

                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <ChartBarSquareIcon className="h-4 w-4" />
                  <span>
                    {selectedTournament
                      ? `Inicio: ${formatTournamentStartDate(selectedTournament.startDate)}`
                      : "Selecciona un torneo"}
                  </span>
                </div>
              </div>

	              <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.45)] p-3 text-xs text-[hsl(var(--muted-foreground))]">
	                Incluye estadísticas simples completas: PTS, REB, AST, STL, BLK, TOV, PF, FG, TL (FT) y triples
	                (3PT). En partidos viejos, TL/3PT pueden verse en 0 si no se registraron en esa planilla. La
	                valoración se calcula como:
	                {" "}
	                <span className="font-semibold text-[hsl(var(--foreground))]">
	                  (PTS+REB+AST+STL+BLK+FGM+FTM+3PM) - ((FGA-FGM)+(FTA-FTM)+TOV+PF)
	                </span>
	                .
	              </div>

              {tournamentStatsLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-[10px] border bg-[hsl(var(--surface-2)/0.45)] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
                  Cargando estadísticas del torneo...
                </div>
              ) : null}

              {!tournamentStatsLoading && tournamentStatsError ? (
                <div className="rounded-[10px] border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.08)] p-3 text-sm text-[hsl(var(--destructive))]">
                  {tournamentStatsError}
                </div>
              ) : null}

              {!tournamentStatsLoading && !tournamentStatsError && tournamentStatsRows.length === 0 ? (
                <EmptyState
                  title="Sin números disponibles"
                  description="Este torneo todavía no tiene estadísticas agregadas de jugadores."
                />
              ) : null}

              {!tournamentStatsLoading && !tournamentStatsError && tournamentStatsRows.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:hidden">
                    {tournamentStatsRows.map((line, index) => {
                      const player = playersById.get(line.playerId);
                      return (
                        <article key={`mobile-line-${line.playerId}`} className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {index + 1}. {line.name}
                              </p>
                              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {line.teamName ?? "Equipo no detectado"} · {line.gamesPlayed} PJ
                              </p>
                            </div>
                            {player ? (
                              <button type="button" onClick={() => setViewPlayer(player)} className="btn-secondary px-3 py-1.5 text-xs min-h-[34px]">
                                Ver
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
	                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
	                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Pts</p>
	                              <p className="text-sm font-bold tabular-nums">{line.totals.points}</p>
	                            </div>
	                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
	                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Val</p>
	                              <p className="text-sm font-bold tabular-nums">{line.valuation.toFixed(1)}</p>
	                            </div>
	                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
	                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PPP</p>
	                              <p className="text-sm font-bold tabular-nums">{line.perGame.ppg.toFixed(1)}</p>
	                            </div>
	                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
	                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Val/PJ</p>
	                              <p className="text-sm font-bold tabular-nums">{line.valuationPerGame.toFixed(1)}</p>
	                            </div>
	                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
	                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FG%</p>
	                              <p className="text-sm font-bold tabular-nums">{line.fgPct.toFixed(1)}%</p>
	                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Reb</p>
                              <p className="text-sm font-semibold tabular-nums">{line.totals.rebounds}</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Ast</p>
                              <p className="text-sm font-semibold tabular-nums">{line.totals.assists}</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Stl</p>
                              <p className="text-sm font-semibold tabular-nums">{line.totals.steals}</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Blk</p>
                              <p className="text-sm font-semibold tabular-nums">{line.totals.blocks}</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Tov</p>
                              <p className="text-sm font-semibold tabular-nums">{line.totals.turnovers}</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">PF</p>
                              <p className="text-sm font-semibold tabular-nums">{line.totals.fouls}</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5 sm:col-span-3">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FGM / FGA</p>
                              <p className="text-sm font-semibold tabular-nums">
                                {line.totals.fgm}/{line.totals.fga}
                              </p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FTM / FTA</p>
                              <p className="text-sm font-semibold tabular-nums">
                                {line.totals.ftm}/{line.totals.fta}
                              </p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">FT%</p>
                              <p className="text-sm font-semibold tabular-nums">{line.ftPct.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5 sm:col-span-3">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">3PM / 3PA</p>
                              <p className="text-sm font-semibold tabular-nums">
                                {line.totals.tpm}/{line.totals.tpa}
                              </p>
                            </div>
                            <div className="rounded-[8px] border bg-[hsl(var(--surface-2)/0.6)] px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">3P%</p>
                              <p className="text-sm font-semibold tabular-nums">{line.tpPct.toFixed(1)}%</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <TableContainer className="hidden xl:block rounded-[12px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[64px]">#</TableHead>
                          <TableHead>Jugador</TableHead>
                          <TableHead>Equipo</TableHead>
	                          <TableHead className="text-right">PJ</TableHead>
	                          <TableHead className="text-right">Pts</TableHead>
	                          <TableHead className="text-right">Val</TableHead>
	                          <TableHead className="text-right">PPP</TableHead>
	                          <TableHead className="text-right">Val/PJ</TableHead>
	                          <TableHead className="text-right">Reb</TableHead>
	                          <TableHead className="text-right">Ast</TableHead>
                          <TableHead className="text-right">Stl</TableHead>
                          <TableHead className="text-right">Blk</TableHead>
                          <TableHead className="text-right">Tov</TableHead>
                          <TableHead className="text-right">PF</TableHead>
                          <TableHead className="text-right">FGM</TableHead>
                          <TableHead className="text-right">FGA</TableHead>
                          <TableHead className="text-right">FG%</TableHead>
                          <TableHead className="text-right">FTM</TableHead>
                          <TableHead className="text-right">FTA</TableHead>
                          <TableHead className="text-right">FT%</TableHead>
                          <TableHead className="text-right">3PM</TableHead>
                          <TableHead className="text-right">3PA</TableHead>
                          <TableHead className="text-right">3P%</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tournamentStatsRows.map((line, index) => {
                          const player = playersById.get(line.playerId);
                          return (
                            <TableRow key={`table-line-${line.playerId}`}>
                              <TableCell className="font-semibold tabular-nums">{index + 1}</TableCell>
                              <TableCell className="font-semibold">{line.name}</TableCell>
                              <TableCell className="text-[hsl(var(--muted-foreground))]">{line.teamName ?? "--"}</TableCell>
	                              <TableCell className="text-right tabular-nums">{line.gamesPlayed}</TableCell>
	                              <TableCell className="text-right tabular-nums font-semibold">{line.totals.points}</TableCell>
	                              <TableCell className="text-right tabular-nums font-semibold">{line.valuation.toFixed(1)}</TableCell>
	                              <TableCell className="text-right tabular-nums">{line.perGame.ppg.toFixed(1)}</TableCell>
	                              <TableCell className="text-right tabular-nums">{line.valuationPerGame.toFixed(1)}</TableCell>
	                              <TableCell className="text-right tabular-nums">{line.totals.rebounds}</TableCell>
	                              <TableCell className="text-right tabular-nums">{line.totals.assists}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.steals}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.blocks}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.turnovers}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.fouls}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.fgm}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.fga}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.fgPct.toFixed(1)}%</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.ftm}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.fta}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.ftPct.toFixed(1)}%</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.tpm}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.totals.tpa}</TableCell>
                              <TableCell className="text-right tabular-nums">{line.tpPct.toFixed(1)}%</TableCell>
                              <TableCell className="text-right">
                                {player ? (
                                  <button type="button" onClick={() => setViewPlayer(player)} className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs">
                                    Ver
                                  </button>
                                ) : (
                                  <span className="text-xs text-[hsl(var(--muted-foreground))]">--</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : null}
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
};

export default Players;
