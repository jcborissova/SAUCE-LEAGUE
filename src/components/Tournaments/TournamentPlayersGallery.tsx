import React, { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";

import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../ui/EmptyState";
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
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);

  useEffect(() => {
    if (teams.length === 0) {
      if (expandedTeamId !== null) setExpandedTeamId(null);
      return;
    }
    if (expandedTeamId === null) return;

    const exists = teams.some((team) => team.id === expandedTeamId);
    if (!exists) setExpandedTeamId(null);
  }, [teams, expandedTeamId]);

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

  const playersByTeam = useMemo(() => {
    const map = new Map<number, PlayerCardModel[]>();
    playerCards.forEach((player) => {
      const list = map.get(player.teamId) ?? [];
      list.push(player);
      map.set(player.teamId, list);
    });
    return map;
  }, [playerCards]);

  const query = normalizeText(searchTerm);

  if (loading) return <LoadingSpinner label="Cargando jugadores" />;

  if (teams.length === 0) {
    return (
      <EmptyState
        title="No hay equipos vinculados"
        description="Primero agrega equipos y jugadores en la configuración del torneo."
      />
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-xl font-bold sm:text-2xl">Equipos del torneo</h3>
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Abre un equipo para ver su plantilla; puedes dejar todos cerrados.
        </p>
      </header>

      <div className="rounded-lg border bg-[hsl(var(--surface-1))] p-3 sm:p-4">
        <label className="relative block w-full sm:max-w-[360px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-subtle))]" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar jugador"
            className="input-base pl-9"
          />
        </label>
      </div>

      <div className="space-y-2.5">
        {teams
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
          .map((team) => {
            const allPlayers = playersByTeam.get(team.id) ?? [];
            const visiblePlayers = allPlayers.filter((player) =>
              query.length === 0 ? true : normalizeText(player.fullName).includes(query)
            );
            const expanded = expandedTeamId === team.id;

            return (
              <article key={team.id} className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
                <button
                  type="button"
                  onClick={() => setExpandedTeamId(expanded ? null : team.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2)/0.72)]"
                  aria-expanded={expanded}
                  aria-controls={`team-panel-${team.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold sm:text-base">{team.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {visiblePlayers.length} de {allPlayers.length} jugadores
                    </p>
                  </div>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform duration-[var(--motion-tab)] ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded ? (
                  <div id={`team-panel-${team.id}`} className="border-t bg-[hsl(var(--surface-2)/0.52)] px-3 py-3">
                    {visiblePlayers.length === 0 ? (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin coincidencias para este equipo.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {visiblePlayers.map((player) => (
                          <article key={player.id} className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
                            <div className="relative h-32 bg-[hsl(var(--surface-2))]">
                              {player.photo ? (
                                <img src={player.photo} alt={player.fullName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <UserCircleIcon className="h-14 w-14 text-[hsl(var(--text-subtle))]" />
                                </div>
                              )}
                              <span className="absolute right-2 top-2 rounded-md border border-white/35 bg-black/45 px-2 py-1 text-xs font-bold text-white">
                                #{player.jersey}
                              </span>
                            </div>
                            <div className="space-y-1 p-3">
                              <h4 className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">{player.fullName}</h4>
                              <p className="text-xs text-[hsl(var(--text-subtle))] sm:text-sm">{player.role}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
      </div>
    </section>
  );
};

export default TournamentPlayersGallery;
