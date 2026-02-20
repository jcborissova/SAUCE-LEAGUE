/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import type { Player } from "../../types/player";
import {
  PlusIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

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
        const { data: playersData, error: playersError } = await supabase.from("players").select("*").order("id");
        if (playersError) toast.error("Error al cargar jugadores");
        else setPlayers(playersData || []);

        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("id, name, team_players(player_id)")
          .eq("tournament_id", tournamentId);

        if (teamsError) {
          toast.error("Error al cargar equipos");
        } else {
          const formatted = (teamsData || []).map((team) => ({
            id: team.id,
            name: team.name,
            playerIds: team.team_players ? team.team_players.map((tp: any) => tp.player_id) : [],
          }));
          setTeams(formatted);
          setActiveTeamIndex(formatted.length > 0 ? 0 : null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setGlobalLoading(false);
      }
    };

    fetchData();
  }, [tournamentId]);

  const addTeam = () => {
    const newTeam = { id: Date.now(), name: "", playerIds: [] };
    setTeams([...teams, newTeam]);
    setActiveTeamIndex(teams.length);
  };

  const deleteTeam = (index: number) => {
    const updated = teams.filter((_, i) => i !== index);
    setTeams(updated);
    if (updated.length === 0) {
      setActiveTeamIndex(null);
    } else if (activeTeamIndex === index) {
      setActiveTeamIndex(0);
    } else if (activeTeamIndex && activeTeamIndex > index) {
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
    updatedTeams[activeTeamIndex].playerIds = updatedTeams[activeTeamIndex].playerIds.filter(
      (id) => id !== playerId
    );
    setTeams(updatedTeams);
  };

  const saveTeams = async () => {
    if (teams.some((t) => !t.name.trim() || t.playerIds.length === 0)) {
      toast.warn("Cada equipo debe tener nombre y al menos un jugador");
      return;
    }

    try {
      setSaving(true);

      const { data: existingTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("tournament_id", tournamentId);

      if (existingTeams && existingTeams.length > 0) {
        const existingIds = existingTeams.map((t) => t.id);
        await supabase.from("team_players").delete().in("team_id", existingIds);
        await supabase.from("teams").delete().in("id", existingIds);
      }

      for (const team of teams) {
        const { data: createdTeam, error: teamError } = await supabase
          .from("teams")
          .insert({ name: team.name, tournament_id: tournamentId })
          .select()
          .single();

        if (teamError) throw teamError;

        for (const playerId of team.playerIds) {
          const { error: playerError } = await supabase
            .from("team_players")
            .insert({ team_id: createdTeam.id, player_id: playerId });

          if (playerError) throw playerError;
        }
      }

      toast.success("Equipos guardados");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar equipos");
    } finally {
      setSaving(false);
    }
  };

  const availablePlayers = players.filter(
    (p) => !teams.some((t) => t.playerIds.includes(p.id))
  );

  const currentTeamPlayers =
    activeTeamIndex !== null && teams[activeTeamIndex]
      ? teams[activeTeamIndex].playerIds
          .map((id) => players.find((p) => p.id === id))
          .filter(Boolean) as Player[]
      : [];

  return (
    <div>
      <button
        onClick={addTeam}
        className="btn-primary rounded-2xl mb-6"
        disabled={saving}
      >
        <PlusIcon className="w-5 h-5" />
        Agregar equipo
      </button>

      <div className="flex gap-3 overflow-x-auto pb-4 mb-6">
        {teams.map((team, idx) => (
          <div
            key={team.id}
            className={`flex items-center border rounded-2xl px-4 py-2 whitespace-nowrap font-medium transition ${
              activeTeamIndex === idx
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))] shadow-md"
                : "bg-[hsl(var(--surface-1))] text-[hsl(var(--primary))] border-[hsl(var(--border))]"
            }`}
          >
            <button
              onClick={() => setActiveTeamIndex(idx)}
              className="flex-1 text-left"
            >
              {team.name || `Equipo ${idx + 1}`}
            </button>
            <button
              onClick={() => deleteTeam(idx)}
              className="ml-2 p-1 text-[hsl(var(--destructive))] hover:opacity-80 transition"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {activeTeamIndex !== null && teams[activeTeamIndex] && (
        <div className="rounded-2xl app-panel p-4 sm:p-6 transition">
          <input
            type="text"
            placeholder="Nombre del equipo"
            value={teams[activeTeamIndex].name}
            onChange={(e) => handleNameChange(activeTeamIndex, e.target.value)}
            className="input-base text-base sm:text-lg mb-6"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="app-card rounded-xl p-4">
              <h4 className="text-base font-semibold mb-3 text-[hsl(var(--primary))]">Jugadores disponibles</h4>
              <ul className="space-y-2 overflow-y-auto max-h-72">
                {availablePlayers.map((player) => (
                  <li
                    key={player.id}
                    className="flex justify-between items-center bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--muted))] rounded-lg px-3 py-2 transition cursor-pointer"
                    onDoubleClick={() => assignPlayer(player.id)}
                  >
                    <span className="text-sm font-medium">{player.names} {player.lastnames} #{player.jerseynumber}</span>
                    <button
                      onClick={() => assignPlayer(player.id)}
                      className="p-1 text-[hsl(var(--success))] hover:opacity-80 transition"
                    >
                      <ArrowRightIcon className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="app-card rounded-xl p-4">
              <h4 className="text-base font-semibold mb-3 text-[hsl(var(--primary))]">Jugadores en el equipo</h4>
              <ul className="space-y-2 overflow-y-auto max-h-72">
                {currentTeamPlayers.map((player) => (
                  <li
                    key={player.id}
                    className="flex justify-between items-center bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--muted))] rounded-lg px-3 py-2 transition cursor-pointer"
                    onDoubleClick={() => removePlayer(player.id)}
                  >
                    <span className="text-sm font-medium">{player.names} {player.lastnames} #{player.jerseynumber}</span>
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="p-1 text-[hsl(var(--destructive))] hover:opacity-80 transition"
                    >
                      <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-8">
        <button
          onClick={saveTeams}
          className="btn-primary rounded-2xl"
          disabled={saving}
        >
          {saving && <ArrowPathIcon className="w-5 h-5 animate-spin" />}
          Guardar equipos
        </button>
      </div>
    </div>
  );
};

export default TournamentTeamsConfig;
