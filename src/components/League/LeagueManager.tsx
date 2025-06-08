/* eslint-disable @typescript-eslint/no-explicit-any */
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
  arrivalTime?: number;
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
  const [winnerStreak, setWinnerStreak] = useState<{ team: LeaguePlayer[]; wins: number } | null>(null);

  useEffect(() => {
    fetchAvailablePlayers();
    fetchLeaguePlayers();
  }, []);

  const fetchAvailablePlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("players").select("*").order("id");
    if (error) toast.error("Error al cargar los jugadores.");
    else setAvailable(data || []);
    setLoading(false);
  };

  const fetchLeaguePlayers = async () => {
    const { data, error } = await supabase
      .from("league_players")
      .select("player_id, is_guest, arrival_time, players(*)")
      .eq("league_id", leagueId)
      .order("arrival_time");

    if (error) {
      console.error("Error al cargar jugadores de la liga", error);
      return;
    }

    const leaguePlayers: LeaguePlayer[] =
      data?.map((item: any) => ({
        ...item.players,
        isGuest: item.is_guest,
        arrivalTime: new Date(item.arrival_time).getTime(),
      })) || [];

    setPlayers(leaguePlayers);
  };

  const handleAddGuest = async (guest: Player) => {
    const arrival = new Date().toISOString();
    const newGuest: LeaguePlayer = {
      ...guest,
      isGuest: true,
      arrivalTime: new Date(arrival).getTime(),
    };

    setPlayers((prev) => [...prev, newGuest]);
    toast.success("Invitado agregado");

    const { error } = await supabase.from("league_players").insert({
      league_id: leagueId,
      player_id: guest.id,
      is_guest: true,
      arrival_time: arrival,
    });

    if (error) console.error("Error al guardar invitado en DB", error);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over?.id === "league-dropzone") {
      const player = available.find((p) => p.id.toString() === active.id);
      if (player && !players.some((p) => p.id === player.id)) {
        const arrival = new Date().toISOString();
        const newPlayer = {
          ...player,
          arrivalTime: new Date(arrival).getTime(),
        };

        setPlayers((prev) => [...prev, newPlayer]);
        setAvailable((prev) => prev.filter((p) => p.id !== player.id));
        toast.info("⚡ Jugador agregado");

        const { error } = await supabase.from("league_players").insert({
          league_id: leagueId,
          player_id: player.id,
          is_guest: false,
          arrival_time: arrival,
        });

        if (error) console.error("Error al guardar jugador en DB", error);
      }
    }
  };

  const handleRemovePlayer = async (id: number) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase
      .from("league_players")
      .delete()
      .match({ league_id: leagueId, player_id: id });

    if (error) {
      toast.error("Error al eliminar jugador de la liga");
      console.error("Supabase deletion error:", error);
    } else {
      toast.success("Jugador eliminado de la liga");
    }
  };

  const generateMatch = () => {
    const ordered = [...players].sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0));
    if (ordered.length < 10) return toast.warning("Se necesitan 10 jugadores para iniciar.");
    setGameQueue([ordered.slice(0, 5), ordered.slice(5, 10)]);
    setShowModal(true);
  };

  const handleGameEnd = async (winner: LeaguePlayer[] | null) => {
    if (!winner || gameQueue.length < 2) return;

    const [teamA, teamB] = gameQueue;
    const loser = winner === teamA ? teamB : teamA;

    const isSameTeam =
      winnerStreak && winner.every((p) => winnerStreak.team.some((w) => w.id === p.id));
    let newStreak: { team: LeaguePlayer[]; wins: number } | null = isSameTeam
      ? { team: winner, wins: winnerStreak!.wins + 1 }
      : { team: winner, wins: 1 };

    if (newStreak.wins >= 2 && players.length - 10 >= 10) {
      const remaining = players.filter((p) => !winner.some((w) => w.id === p.id));
      setPlayers([...remaining]);
      toast.success("🏆 Equipo se retira por 2 victorias");
      newStreak = null;
    } else {
      const remaining = players.filter((p) => !loser.some((l) => l.id === p.id));
      setPlayers([...remaining, ...loser]);
    }

    const rest = players.slice(10);
    setGameQueue(rest.length >= 5 ? [winner, rest.slice(0, 5)] : []);
    setWinnerStreak(newStreak);
    setShowModal(false);

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .insert({
        league_id: leagueId,
        winner_team: winner === teamA ? "A" : "B",
      })
      .select()
      .single();

    if (matchError || !matchData) {
      toast.error("Error al guardar resultado del partido");
      return;
    }

    await supabase
      .from("current_match")
      .upsert({ league_id: leagueId, match_id: matchData.id });

    const matchPlayersPayload = [
      ...teamA.map((p) => ({
        match_id: matchData.id,
        player_id: p.id,
        team: "A",
      })),
      ...teamB.map((p) => ({
        match_id: matchData.id,
        player_id: p.id,
        team: "B",
      })),
    ];

    const { error: mpError } = await supabase.from("match_players").insert(matchPlayersPayload);

    if (mpError) {
      console.error("Error al guardar jugadores del partido", mpError);
      toast.error("Error al guardar jugadores del partido");
    } else {
      toast.success("Resultado guardado");
      await fetchLeaguePlayers();
    }
  };

  const orderedPlayers = [...players].sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0));
  const currentMatch = orderedPlayers.slice(0, 10);
  const waitingList = orderedPlayers.slice(10);

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
              <h3 className="text-lg font-semibold text-blue-950 mb-3">Jugadores de la Liga</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto">
                {available.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    onDoubleClick={async () => {
                      if (!players.some((pl) => pl.id === p.id)) {
                        const arrival = new Date().toISOString();
                        const newPlayer = {
                          ...p,
                          arrivalTime: new Date(arrival).getTime(),
                        };

                        setPlayers((prev) => [...prev, newPlayer]);
                        setAvailable((prev) => prev.filter((pl) => pl.id !== p.id));
                        toast.info("Jugador agregado");

                        const { error } = await supabase.from("league_players").insert({
                          league_id: leagueId,
                          player_id: p.id,
                          is_guest: false,
                          arrival_time: arrival,
                        });

                        if (error) console.error("Error al guardar jugador en DB", error);
                      }
                    }}
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
          <h3 className="text-lg font-semibold text-blue-950 mb-3">Quintetos en orden de llegada</h3>
          <TeamList players={currentMatch} />
        </section>
      )}

      {waitingList.length > 0 && (
        <section className="bg-white p-4 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-blue-950 mb-3">Jugadores en espera</h3>
          <TeamList players={waitingList} />
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
