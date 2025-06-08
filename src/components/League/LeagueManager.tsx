/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/League/LeagueManager.tsx
import React, { useEffect, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "react-toastify";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabase";
import type { Player } from "../../types/player";
import GuestInput from "./GuestInput";
import PlayerCard from "./PlayerCard";
import GameModal from "./GameModal";
import TeamList from "./TeamList";
import SortableLeagueBoard from "./LeagueBoard";

type LeaguePlayer = Player & {
  arrivalTime: number;
  isGuest?: boolean;
};

type Props = {
  leagueId: number;
};

const LeagueManager: React.FC<Props> = ({ leagueId }) => {
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [available, setAvailable] = useState<LeaguePlayer[]>([]);
  const [gameQueue, setGameQueue] = useState<LeaguePlayer[][]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [winnerStreak, setWinnerStreak] = useState<{ ids: number[]; wins: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: leagueData, error: errorLeague } = await supabase
      .from("league_players")
      .select("player_id, is_guest, arrival_time, players(*)")
      .eq("league_id", leagueId)
      .order("arrival_time");

    const { data: allPlayers, error: errorPlayers } = await supabase.from("players").select("*");

    if (errorLeague || errorPlayers) {
      toast.error("Error al cargar los datos");
      setLoading(false);
      return;
    }

    const leaguePlayers: LeaguePlayer[] = (leagueData || []).map((item: any) => ({
      ...item.players,
      isGuest: item.is_guest,
      arrivalTime: new Date(item.arrival_time).getTime(),
    }));

    const leagueIds = leaguePlayers.map((p) => p.id);
    const notInLeague = (allPlayers || []).filter((p: any) => !leagueIds.includes(p.id));

    setPlayers(leaguePlayers);
    setAvailable(notInLeague);
    setLoading(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || over.id !== "league-dropzone") return;

    const player = available.find((p) => p.id.toString() === active.id);
    if (!player || players.some((p) => p.id === player.id)) return;

    const arrival = new Date().toISOString();
    const newPlayer = { ...player, arrivalTime: new Date(arrival).getTime() };

    await supabase.from("league_players").insert({
      league_id: leagueId,
      player_id: player.id,
      is_guest: false,
      arrival_time: arrival,
    });

    toast.info("Jugador agregado");
    loadData();
  };

  const handleAddGuest = async (guest: Player) => {
    const arrival = new Date().toISOString();
    await supabase.from("league_players").insert({
      league_id: leagueId,
      player_id: guest.id,
      is_guest: true,
      arrival_time: arrival,
    });
    toast.success("Invitado agregado");
    loadData();
  };

  const handleRemovePlayer = async (id: number) => {
    await supabase.from("league_players").delete().match({ league_id: leagueId, player_id: id });
    toast.success("Jugador eliminado");
    loadData();
  };

  const updateActivePlayers = async (teamA: LeaguePlayer[], teamB: LeaguePlayer[]) => {
    await supabase.from("active_players").delete().eq("league_id", leagueId);
    const payload = [
      ...teamA.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "A", position: i })),
      ...teamB.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "B", position: i })),
    ];
    await supabase.from("active_players").insert(payload);
  };

  const generateMatch = async () => {
    const ordered = [...players].sort((a, b) => a.arrivalTime - b.arrivalTime);
    if (ordered.length < 10) return toast.warning("Se necesitan al menos 10 jugadores");
    const teamA = ordered.slice(0, 5);
    const teamB = ordered.slice(5, 10);
    await updateActivePlayers(teamA, teamB);
    setGameQueue([teamA, teamB]);
    setShowModal(true);
  };

  const handleGameEnd = async (winner: LeaguePlayer[] | null) => {
    if (!winner || gameQueue.length < 2) return;

    const [teamA, teamB] = gameQueue;
    const loser = winner === teamA ? teamB : teamA;

    const sameStreak =
      winnerStreak && winner.every((p) => winnerStreak.ids.includes(p.id));
    const newStreak = sameStreak
      ? { ids: winner.map((p) => p.id), wins: winnerStreak.wins + 1 }
      : { ids: winner.map((p) => p.id), wins: 1 };

    const allIds = [...teamA, ...teamB].map((p) => p.id);
    const waiting = players.filter((p) => !allIds.includes(p.id)).sort((a, b) => a.arrivalTime - b.arrivalTime);

    let nextA: LeaguePlayer[] = [];
    let nextB: LeaguePlayer[] = [];

    if (newStreak.wins >= 2 && waiting.length >= 10) {
      nextA = waiting.slice(0, 5);
      nextB = waiting.slice(5, 10);
      setWinnerStreak(null);
    } else {
      const replacement = waiting.slice(0, 5);
      if (winner === teamA) {
        nextA = teamA;
        nextB = replacement.length < 5 ? [...replacement, loser[0]] : replacement;
      } else {
        nextA = replacement.length < 5 ? [...replacement, loser[0]] : replacement;
        nextB = teamB;
      }
      setWinnerStreak(newStreak);
    }

    const { data: matchData, error } = await supabase
      .from("matches")
      .insert({ league_id: leagueId, winner_team: winner === teamA ? "A" : "B" })
      .select()
      .single();

    if (error || !matchData) {
      toast.error("Error al guardar el partido");
      return;
    }

    await supabase.from("current_match").upsert({ league_id: leagueId, match_id: matchData.id });

    await supabase.from("match_players").insert(
      [...teamA, ...teamB].map((p) => ({
        match_id: matchData.id,
        player_id: p.id,
        team: teamA.includes(p) ? "A" : "B",
      }))
    );

    await updateActivePlayers(nextA, nextB);
    setGameQueue([nextA, nextB]);
    setShowModal(false);
    loadData();
  };

  const ordered = [...players].sort((a, b) => a.arrivalTime - b.arrivalTime);
  const currentMatch = ordered.slice(0, 10);
  const waitingList = ordered.slice(10);

  return (
    <div className="space-y-8 pb-20">
      <section className="bg-white p-4 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-blue-950 mb-3">Agregar Invitados</h3>
        <GuestInput onAddGuest={handleAddGuest} />
      </section>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          {available.length > 0 && (
            <section className="bg-white p-4 rounded-xl shadow-md">
              <h3 className="text-lg font-semibold text-blue-950 mb-3">Jugadores disponibles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto">
                {available.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    onDoubleClick={() =>
                      handleDragEnd({
                        active: { id: p.id.toString() } as any,
                        over: { id: "league-dropzone" } as any,
                      } as DragEndEvent)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className="bg-white p-4 rounded-xl shadow-md">
            <SortableLeagueBoard players={players} onRemove={handleRemovePlayer} />
          </section>
        </DndContext>
      )}

      {currentMatch.length === 10 && (
        <section className="text-center">
          <button
            onClick={generateMatch}
            className="bg-blue-950 text-white px-6 py-2 rounded-xl text-sm hover:bg-blue-800 transition"
          >
            Iniciar Partido
          </button>
        </section>
      )}

      {currentMatch.length > 0 && (
        <section className="bg-white p-4 rounded-xl shadow-md">
          <TeamList players={currentMatch} title="Jugadores del partido" teamMode />
        </section>
      )}

      {waitingList.length > 0 && (
        <section className="bg-white p-4 rounded-xl shadow-md">
          <TeamList players={waitingList} title="Jugadores en espera" />
        </section>
      )}

      {showModal && gameQueue.length >= 2 && (
        <GameModal
          teamA={gameQueue[0]}
          teamB={gameQueue[1]}
          onClose={() => setShowModal(false)}
          onFinish={handleGameEnd}
        />
      )}
    </div>
  );
};

export default LeagueManager;
