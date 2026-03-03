import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { Player } from "../../types/player";
import {
  PlusIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XMarkIcon,
  ArrowPathIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import {
  fetchTournamentPlayers,
  fetchTournamentTeamAssignments,
  saveTournamentTeamAssignments,
} from "../../services/tournamentTeams";

type Team = {
  id: number;
  name: string;
  playerIds: number[];
};

type Props = {
  tournamentId: string;
  setGlobalLoading: (loading: boolean) => void;
};

const TournamentTeamsConfig: React.FC<Props> = ({ tournamentId, setGlobalLoading }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setGlobalLoading(true);
      try {
        const [playersData, teamsData] = await Promise.all([
          fetchTournamentPlayers(),
          fetchTournamentTeamAssignments(tournamentId),
        ]);

        setPlayers(playersData);
        setTeams(teamsData);
        setActiveTeamIndex(teamsData.length > 0 ? 0 : null);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los datos del torneo.");
      } finally {
        setGlobalLoading(false);
      }
    };

    fetchData();
  }, [tournamentId, setGlobalLoading]);

  const addTeam = () => {
    const newTeam = { id: Date.now(), name: "", playerIds: [] };
    setTeams((prev) => [...prev, newTeam]);
    setActiveTeamIndex(teams.length);
  };

  const deleteTeam = (index: number) => {
    const updated = teams.filter((_, i) => i !== index);
    setTeams(updated);

    if (updated.length === 0) {
      setActiveTeamIndex(null);
      return;
    }

    if (activeTeamIndex === index) {
      setActiveTeamIndex(Math.max(0, index - 1));
      return;
    }

    if (activeTeamIndex !== null && activeTeamIndex > index) {
      setActiveTeamIndex(activeTeamIndex - 1);
    }
  };

  const handleNameChange = (index: number, value: string) => {
    const updated = [...teams];
    updated[index].name = value;
    setTeams(updated);
  };

  const assignPlayer = (playerId: number) => {
    if (activeTeamIndex === null || !teams[activeTeamIndex]) return;
    const updatedTeams = [...teams];
    if (!updatedTeams[activeTeamIndex].playerIds.includes(playerId)) {
      updatedTeams[activeTeamIndex].playerIds.push(playerId);
      setTeams(updatedTeams);
    }
  };

  const removePlayer = (playerId: number) => {
    if (activeTeamIndex === null || !teams[activeTeamIndex]) return;
    const updatedTeams = [...teams];
    updatedTeams[activeTeamIndex].playerIds = updatedTeams[activeTeamIndex].playerIds.filter((id) => id !== playerId);
    setTeams(updatedTeams);
  };

  const saveTeams = async () => {
    if (teams.some((team) => !team.name.trim() || team.playerIds.length === 0)) {
      toast.warn("Cada equipo debe tener nombre y al menos un jugador");
      return;
    }

    try {
      setSaving(true);
      await saveTournamentTeamAssignments(tournamentId, teams);

      toast.success("Equipos guardados");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al guardar equipos");
    } finally {
      setSaving(false);
    }
  };

  const availablePlayers = useMemo(
    () => players.filter((player) => !teams.some((team) => team.playerIds.includes(player.id))),
    [players, teams]
  );

  const currentTeamPlayers =
    activeTeamIndex !== null && teams[activeTeamIndex]
      ? teams[activeTeamIndex].playerIds.map((id) => players.find((player) => player.id === id)).filter(Boolean) as Player[]
      : [];

  const selectedTeam = activeTeamIndex !== null ? teams[activeTeamIndex] : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="app-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight sm:text-xl">Equipos del torneo</h3>
            <p className="text-sm text-[hsl(var(--text-subtle))]">Crea equipos y reparte jugadores con un flujo simple y táctil.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={addTeam} className="btn-secondary w-full sm:w-auto" disabled={saving}>
              <PlusIcon className="h-4 w-4" />
              Agregar equipo
            </button>
            <button onClick={saveTeams} className="btn-primary w-full sm:w-auto" disabled={saving}>
              {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
              Guardar equipos
            </button>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="app-panel flex min-h-[150px] flex-col items-center justify-center gap-2 p-4 text-center">
            <UserGroupIcon className="h-8 w-8 text-[hsl(var(--text-subtle))]" />
            <p className="text-sm font-medium">Aún no hay equipos configurados</p>
            <p className="text-xs text-[hsl(var(--text-subtle))]">Pulsa “Agregar equipo” para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Selecciona equipo</p>
            <div className="flex gap-2 overflow-x-auto pb-1 soft-scrollbar">
              {teams.map((team, idx) => {
                const active = idx === activeTeamIndex;
                return (
                  <div
                    key={team.id}
                    className={`flex min-h-[44px] flex-none items-center gap-2 rounded-[8px] border px-3 ${
                      active
                        ? "border-[hsl(var(--primary)/0.32)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--foreground))]"
                        : "border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTeamIndex(idx)}
                      className="min-w-[120px] text-left text-sm font-semibold"
                    >
                      {team.name.trim() || `Equipo ${idx + 1}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTeam(idx)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))] text-[hsl(var(--destructive))]"
                      aria-label={`Eliminar ${team.name || `equipo ${idx + 1}`}`}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {selectedTeam ? (
        <section className="app-panel space-y-4 p-4 sm:p-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Nombre del equipo</label>
            <input
              type="text"
              placeholder="Ejemplo: Battle Seed Alpha"
              value={selectedTeam.name}
              onChange={(event) => handleNameChange(activeTeamIndex as number, event.target.value)}
              className="input-base"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="app-card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Disponibles</h4>
                <span className="text-xs text-[hsl(var(--text-subtle))]">{availablePlayers.length}</span>
              </div>

              {availablePlayers.length === 0 ? (
                <p className="text-sm text-[hsl(var(--text-subtle))]">No hay jugadores libres para asignar.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 soft-scrollbar">
                  {availablePlayers.map((player) => (
                    <li key={player.id} className="flex items-center justify-between border bg-[hsl(var(--surface-2))] px-3 py-2">
                      <span className="text-sm font-medium">
                        {player.names} {player.lastnames} #{player.jerseynumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => assignPlayer(player.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] text-[hsl(var(--success))]"
                        aria-label={`Agregar a ${player.names} ${player.lastnames}`}
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="app-card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">En el equipo</h4>
                <span className="text-xs text-[hsl(var(--text-subtle))]">{currentTeamPlayers.length}</span>
              </div>

              {currentTeamPlayers.length === 0 ? (
                <p className="text-sm text-[hsl(var(--text-subtle))]">Aún no hay jugadores asignados a este equipo.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 soft-scrollbar">
                  {currentTeamPlayers.map((player) => (
                    <li key={player.id} className="flex items-center justify-between border bg-[hsl(var(--surface-2))] px-3 py-2">
                      <span className="text-sm font-medium">
                        {player.names} {player.lastnames} #{player.jerseynumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePlayer(player.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] text-[hsl(var(--destructive))]"
                        aria-label={`Quitar de ${player.names} ${player.lastnames}`}
                      >
                        <ArrowLeftIcon className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default TournamentTeamsConfig;
