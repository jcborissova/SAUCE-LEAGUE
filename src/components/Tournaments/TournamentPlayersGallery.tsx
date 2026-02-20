import React, { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "../LoadingSpinner";
import type { Player } from "../../types/player";

type Team = {
  id: number;
  name: string;
  players: Player[];
};

type TournamentPlayersGalleryProps = {
  teams: Team[];
  loading?: boolean;
};

type PlayerCardModel = {
  id: number;
  fullName: string;
  photo?: string;
  role: string;
  jersey: string;
  teamId: number;
  teamName: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const TournamentPlayersGallery: React.FC<TournamentPlayersGalleryProps> = ({ teams, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  const playerCards = useMemo<PlayerCardModel[]>(() => {
    const grouped = new Map<number, PlayerCardModel>();

    teams.forEach((team) => {
      team.players.forEach((player) => {
        const fullName = `${player.names} ${player.lastnames}`.replace(/\s+/g, " ").trim();

        if (!grouped.has(player.id)) {
          grouped.set(player.id, {
            id: player.id,
            fullName: fullName || `Jugador ${player.id}`,
            photo: player.photo,
            role: player.description?.trim() || "Jugador",
            jersey: Number.isFinite(Number(player.jerseynumber)) ? String(player.jerseynumber) : "--",
            teamId: team.id,
            teamName: team.name,
          });
        }
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
  }, [teams]);

  const filteredPlayers = useMemo(() => {
    const query = normalizeText(searchTerm);

    return playerCards.filter((player) => {
      const matchesTeam = teamFilter === "all" || String(player.teamId) === teamFilter;
      const matchesSearch = query.length === 0 || normalizeText(player.fullName).includes(query);
      return matchesTeam && matchesSearch;
    });
  }, [playerCards, searchTerm, teamFilter]);

  const teamOptions = useMemo(
    () =>
      teams
        .map((team) => ({ id: String(team.id), label: team.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [teams]
  );

  if (loading) {
    return <LoadingSpinner label="Cargando jugadores" />;
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-xl sm:text-2xl font-bold">Jugadores del Torneo</h3>
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Galería de plantilla por equipo, optimizada para móvil.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--text-subtle))]">
        <span className="rounded-md border px-2.5 py-1">{teams.length} equipos</span>
        <span className="rounded-md border px-2.5 py-1">{playerCards.length} jugadores</span>
        <span className="rounded-md border px-2.5 py-1">
          Filtro: {teamFilter === "all" ? "Todos" : teamOptions.find((team) => team.id === teamFilter)?.label || "Equipo"}
        </span>
        <span className="rounded-md border px-2.5 py-1">{filteredPlayers.length} visibles</span>
      </div>

      <div className="app-panel p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2 sm:gap-3">
        <label className="relative block">
          <MagnifyingGlassIcon className="h-4 w-4 text-[hsl(var(--text-subtle))] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar jugador"
            className="input-base pl-9"
          />
        </label>

        <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="select-base w-full">
          <option value="all">Todos los equipos</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.label}
            </option>
          ))}
        </select>
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-[hsl(var(--text-subtle))]">No hay jugadores para esos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredPlayers.map((player) => (
            <article
              key={player.id}
              className="app-card overflow-hidden border-[hsl(var(--border)/0.85)] transition-transform duration-[var(--motion-tab)] hover:-translate-y-0.5"
            >
              <div className="relative h-40 bg-gradient-to-br from-[hsl(var(--primary)/0.16)] via-[hsl(var(--info)/0.06)] to-[hsl(var(--surface-2))]">
                {player.photo ? (
                  <img src={player.photo} alt={player.fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <UserCircleIcon className="h-20 w-20 text-[hsl(var(--text-subtle))]" />
                  </div>
                )}
                <span className="absolute right-2 top-2 inline-flex rounded-md border border-white/35 bg-black/35 px-2 py-1 text-xs font-bold text-white">
                  #{player.jersey}
                </span>
              </div>

              <div className="space-y-2 p-3.5">
                <h4 className="line-clamp-2 text-base font-semibold leading-tight">{player.fullName}</h4>
                <p className="text-sm text-[hsl(var(--text-subtle))] line-clamp-2">{player.role}</p>
                <div className="pt-1">
                  <span className="inline-flex rounded-md border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.1)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
                    {player.teamName}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default TournamentPlayersGallery;
