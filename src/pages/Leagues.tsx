import React, { useState, useEffect } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Player } from "../types/player";
import GuestInput from "../components/League/GuestInput";
import PlayerCard from "../components/League/PlayerCard";
import GameModal from "../components/League/GameModal";
import TeamList from "../components/League/TeamList";
import SortableLeagueBoard from "../components/League/LeagueBoard";

type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

const Leagues: React.FC = () => {
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [available, setAvailable] = useState<LeaguePlayer[]>([]);
  const [gameQueue, setGameQueue] = useState<LeaguePlayer[][]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [winnerStreak, setWinnerStreak] = useState<{ team: LeaguePlayer[]; wins: number } | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("players").select("*").order("id");
    if (error) toast.error("Error al cargar los jugadores.");
    else setAvailable(data || []);
    setLoading(false);
  };

  const handleAddGuest = (guest: Player) => {
    const arrival = Date.now();
    setPlayers((prev) => [...prev, { ...guest, isGuest: true, arrivalTime: arrival }]);
    toast.success("✅ Invitado agregado");
  };

  const handleRemovePlayer = (id: number) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over?.id === "league-dropzone") {
      const player = available.find((p) => p.id.toString() === active.id);
      if (player && !players.some((p) => p.id === player.id)) {
        const arrival = Date.now();
        setPlayers((prev) => [...prev, { ...player, arrivalTime: arrival }]);
        setAvailable((prev) => prev.filter((p) => p.id !== player.id));
        toast.info("⚡ Jugador agregado");
      }
    }
  };

  const generateMatch = () => {
    const ordered = [...players].sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0));
    if (ordered.length < 10) return toast.warning("Se necesitan 10 jugadores para iniciar.");

    const teamA = ordered.slice(0, 5);
    const teamB = ordered.slice(5, 10);
    setGameQueue([teamA, teamB]);
    setShowModal(true);
  };

  const handleGameEnd = async (winner: LeaguePlayer[] | null) => {
    if (!winner || gameQueue.length < 2) return;
  
    const [teamA, teamB] = gameQueue;
    const loser = winner === teamA ? teamB : teamA;
  
    const isSameTeam = winnerStreak && winner.every((p) => winnerStreak.team.some((w) => w.id === p.id));
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
  
    await supabase.from("matches").insert({
      league_id: 1,
      team_a: teamA.map((p) => ({ player_id: p.id })),
      team_b: teamB.map((p) => ({ player_id: p.id })),
      winner_team: winner === teamA ? "A" : "B",
      created_at: new Date().toISOString(),
    });
  
    toast.success("📊 Resultado guardado");
  };  

  const orderedPlayers = [...players].sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0));
  const currentMatch = orderedPlayers.slice(0, 10);
  const waitingList = orderedPlayers.slice(10);

  return (
    <div className="space-y-8 mx-auto px-4 sm:px-6 lg:px-0 pb-16">
      <header className="text-center">
        <h2 className="text-3xl font-extrabold text-blue-950">Gestión de Ligas</h2>
      </header>

      <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-blue-950 mb-3">Agregar Invitados</h3>
        <GuestInput onAddGuest={handleAddGuest} />
      </section>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          {available.length > 0 && (
            <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
              <h3 className="text-lg font-semibold text-blue-950 mb-3">Jugadores de la Liga</h3>
              <div className="max-h-[300px] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {available.map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      onDoubleClick={() => {
                        if (!players.some((pl) => pl.id === p.id)) {
                          const arrival = Date.now();
                          setPlayers((prev) => [...prev, { ...p, arrivalTime: arrival }]);
                          setAvailable((prev) => prev.filter((pl) => pl.id !== p.id));
                          toast.info("⚡ Jugador agregado");
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
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
            🎮 Iniciar Partido
          </button>
        </section>
      )}

      {currentMatch.length > 0 && (
        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-blue-950 mb-3">Quintetos en orden de llegada</h3>
          <TeamList players={currentMatch} />
        </section>
      )}

      {waitingList.length > 0 && (
        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
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

export default Leagues;
