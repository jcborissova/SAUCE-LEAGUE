import React, { useState, useEffect } from "react";
import type { Player } from "../types/player";
import LeagueBoard from "../components/League/LeagueBoard";
import GuestInput from "../components/League/GuestInput";
import TeamList from "../components/League/TeamList";
import PlayerCard from "../components/League/PlayerCard";
import GameModal from "../components/League/GameModal";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";

// Solo en este componente:
type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

const Leagues: React.FC = () => {
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [available, setAvailable] = useState<LeaguePlayer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [gameQueue, setGameQueue] = useState<LeaguePlayer[][]>([]);
  const [winnerStreak, setWinnerStreak] = useState<{ team: LeaguePlayer[]; wins: number } | null>(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/players");
        const data = await res.json();
        console.log(data);
        setAvailable(data);
      } catch (err) {
        console.error("Failed to fetch players:", err);
      }
    };
    fetchPlayers();
  }, []);

  const handleAddGuest = (player: Player) => {
    const arrival = Date.now();
    setPlayers((prev) => [...prev, { ...player, isGuest: true, arrivalTime: arrival }]);
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
      }
    }
  };

  const generateGames = () => {
    const ordered = [...players].sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0));
    const groups: LeaguePlayer[][] = [];
    for (let i = 0; i < ordered.length; i += 5) {
      if (i + 5 <= ordered.length) {
        groups.push(ordered.slice(i, i + 5));
      }
    }
    setGameQueue(groups);
    setShowModal(true);
  };

  const handleGameEnd = (winningTeam: LeaguePlayer[] | null) => {
    const newQueue = [...gameQueue];
    if (
      winningTeam &&
      winnerStreak &&
      winnerStreak.team.every((p) => winningTeam.some((w) => w.id === p.id))
    ) {
      const newWins = winnerStreak.wins + 1;
      if (newWins >= 2 && players.length - 10 >= 10) {
        const idsToRemove = winningTeam.map((p) => p.id);
        setPlayers((prev) => prev.filter((p) => !idsToRemove.includes(p.id)));
        newQueue.shift();
        setWinnerStreak(null);
      } else {
        setWinnerStreak({ team: winningTeam, wins: newWins });
        newQueue.shift();
        const nextTeam = newQueue.shift();
        if (nextTeam) newQueue.push(nextTeam);
      }
    } else {
      setWinnerStreak(winningTeam ? { team: winningTeam, wins: 1 } : null);
      newQueue.shift();
      const nextTeam = newQueue.shift();
      if (nextTeam) newQueue.push(nextTeam);
    }
    setGameQueue(newQueue);
  };

  return (
    <div className="space-y-8 mx-auto px-4 sm:px-6 lg:px-0 pb-16">
      <header className="text-center px-2 sm:px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-blue-950 leading-tight">
          Gestión de Ligas
        </h2>
      </header>

      <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-blue-950 mb-3">Agregar Invitados</h3>
        <GuestInput onAddGuest={handleAddGuest} />
      </section>

      <DndContext onDragEnd={handleDragEnd}>
        {available.length > 0 && (
          <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-blue-950 mb-3">Jugadores de la Liga</h3>
            <div className="max-h-[300px] overflow-y-auto pr-1 custom-scroll">
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
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
          <LeagueBoard
            id="league-dropzone"
            team={players}
            label="Jugadores en lista"
            onRemove={handleRemovePlayer}
          />
        </section>
      </DndContext>

      {players.length >= 10 && (
        <section className="text-center">
          <button
            className="bg-blue-950 text-white px-6 py-2 rounded-xl text-sm hover:bg-blue-800 transition"
            onClick={generateGames}
          >
            🎮 Iniciar Partido
          </button>
        </section>
      )}

      {players.length > 0 && (
        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-blue-950 mb-3">Quintetos en orden de llegada</h3>
          <TeamList players={[...players]} />
        </section>
      )}

      {showModal && gameQueue.length >= 2 && (
        <GameModal
          onClose={() => setShowModal(false)}
          teamA={gameQueue[0]}
          teamB={gameQueue[1]}
          onFinish={handleGameEnd}
        />
      )}
    </div>
  );
};

export default Leagues;
