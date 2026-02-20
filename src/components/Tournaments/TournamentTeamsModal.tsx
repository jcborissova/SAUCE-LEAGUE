/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import type { Player } from "../../types/player";
import { PlusIcon, UserGroupIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import TeamSelector from "./TeamSelector";
import TeamPlayersGrid from "./TeamPlayersGrid";

type Team = {
  id: number;
  name: string;
  playerIds: number[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
};

const TournamentTeamsModal: React.FC<Props> = ({ isOpen, onClose, tournamentId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("players").select("*").order("id");
      if (error) toast.error("Error al cargar jugadores");
      else setPlayers(data || []);
      setLoading(false);
    };

    const fetchTeams = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, team_players(player_id)")
        .eq("tournament_id", tournamentId);

      if (error) {
        toast.error("Error al cargar equipos");
      } else {
        const formatted = (data || []).map((team) => ({
          id: team.id,
          name: team.name,
          playerIds: team.team_players ? team.team_players.map((tp: any) => tp.player_id) : [],
        }));
        setTeams(formatted);
        setActiveTeamIndex(formatted.length > 0 ? 0 : null);
      }
      setLoading(false);
    };

    if (isOpen) {
      fetchPlayers();
      fetchTeams();
    }
  }, [isOpen, tournamentId]);

  const addTeam = () => {
    const newTeam = { id: Date.now(), name: "", playerIds: [] };
    setTeams([...teams, newTeam]);
    setActiveTeamIndex(teams.length);
  };

  const deleteTeam = (index: number) => {
    const updated = teams.filter((_, i) => i !== index);
    setTeams(updated);
    if (updated.length === 0) setActiveTeamIndex(null);
    else if (activeTeamIndex === index) setActiveTeamIndex(0);
    else if (activeTeamIndex && activeTeamIndex > index) setActiveTeamIndex(activeTeamIndex - 1);
  };

  const handleNameChange = (index: number, value: string) => {
    const updated = [...teams];
    updated[index].name = value;
    setTeams(updated);
  };

  const assignPlayer = (playerId: number) => {
    if (activeTeamIndex === null || !teams[activeTeamIndex]) return;
    const updated = [...teams];
    if (!updated[activeTeamIndex].playerIds.includes(playerId)) {
      updated[activeTeamIndex].playerIds.push(playerId);
      setTeams(updated);
    }
  };

  const removePlayer = (playerId: number) => {
    if (activeTeamIndex === null || !teams[activeTeamIndex]) return;
    const updated = [...teams];
    updated[activeTeamIndex].playerIds = updated[activeTeamIndex].playerIds.filter((id) => id !== playerId);
    setTeams(updated);
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
        const { data: createdTeam, error } = await supabase
          .from("teams")
          .insert({ name: team.name, tournament_id: tournamentId })
          .select()
          .single();

        if (error) throw error;

        for (const playerId of team.playerIds) {
          const { error: playerError } = await supabase
            .from("team_players")
            .insert({ team_id: createdTeam.id, player_id: playerId });
          if (playerError) throw playerError;
        }
      }

      toast.success("Equipos guardados");
      onClose();
      setTeams([]);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar equipos");
    } finally {
      setSaving(false);
    }
  };

  const availablePlayers = players.filter((p) => !teams.some((t) => t.playerIds.includes(p.id)));
  const currentTeamPlayers =
    activeTeamIndex !== null && teams[activeTeamIndex]
      ? teams[activeTeamIndex].playerIds.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[]
      : [];

  if (!isOpen) return null;

  return (
    <div className="modal-shell">
      <div className="modal-card max-w-6xl animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserGroupIcon className="w-7 h-7 text-[hsl(var(--primary))]" />
            Configurar Equipos
          </h2>
          <button onClick={onClose} className="btn-secondary h-9 w-9 rounded-lg p-0 text-2xl">×</button>
        </div>

        <button
          onClick={addTeam}
          className="btn-primary rounded-2xl mb-6"
          disabled={loading || saving}
        >
          <PlusIcon className="w-5 h-5" />
          Agregar equipo
        </button>

        <TeamSelector
          teams={teams}
          activeIndex={activeTeamIndex}
          setActiveIndex={setActiveTeamIndex}
          deleteTeam={deleteTeam}
        />

        {activeTeamIndex !== null && teams[activeTeamIndex] && (
          <>
            <input
              type="text"
              placeholder="Nombre del equipo"
              value={teams[activeTeamIndex].name}
              onChange={(e) => handleNameChange(activeTeamIndex, e.target.value)}
              className="input-base text-base sm:text-lg mb-6"
            />

            <TeamPlayersGrid
              availablePlayers={availablePlayers}
              currentTeamPlayers={currentTeamPlayers}
              assignPlayer={assignPlayer}
              removePlayer={removePlayer}
            />
          </>
        )}

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="btn-secondary rounded-2xl"
            disabled={saving}
          >
            Cancelar
          </button>
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
    </div>
  );
};

export default TournamentTeamsModal;
