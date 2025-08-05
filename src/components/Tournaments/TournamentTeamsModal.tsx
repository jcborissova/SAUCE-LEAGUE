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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center px-4 z-50">
      <div className="bg-white w-full max-w-6xl rounded-3xl p-8 overflow-y-auto max-h-[95vh] shadow-2xl relative animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <UserGroupIcon className="w-7 h-7 text-blue-600" />
            Configurar Equipos
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold transition">×</button>
        </div>

        <button
          onClick={addTeam}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-2xl mb-6 transition"
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
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-6 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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
            className="px-5 py-2 rounded-2xl bg-gray-300 hover:bg-gray-400 text-sm font-medium transition"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={saveTeams}
            className="px-5 py-2 rounded-2xl bg-green-600 text-white hover:bg-green-700 text-sm font-medium transition flex items-center gap-2"
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
