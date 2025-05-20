import React, { useState } from "react";
import type { Player } from "../types/player";
import LeagueBoard from "../components/League/LeagueBoard";
import GuestInput from "../components/League/GuestInput";
import TeamList from "../components/League/TeamList";
import PlayerCard from "../components/League/PlayerCard";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";

// Lista de jugadores oficiales de la liga
const leagueRoster: Player[] = [
  "Brian Del Pilar", "Jeremy Devers", "Xiolin Ramírez", "Angel Martinez", "Richard Almengo",
  "Manuel Medina", "Geny Fernandez", "Rafael Almonte", "Juan Carlos Borissova", "Victor Veloz",
  "Jhoan Santos", "Jesús Aquino", "Angel Mojica", "Diego Paula", "Cristopher Herasme",
  "Manny Alexander", "Darwin Capellan", "Angel Rafael López Durán", "Alberto Lorenzo",
  "Carlos Lorenzo", "Emmanuel Guillen Beltran", "Hector Angel Mateo", "Moises Ramirez",
  "Danilo Soto Araujo", "Carlos Susanna"
].map((name, i) => ({
  id: i + 1,
  name,
}));

const Leagues: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [available, setAvailable] = useState<Player[]>(leagueRoster);

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

  return (
    <div className="space-y-8 mx-auto px-4 sm:px-6 lg:px-0 pb-16">
      <header className="text-center px-2 sm:px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-blue-950 leading-tight">
          Gestión de Ligas
        </h2>
      </header>


      {/* Invitados */}
      <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-blue-950 mb-3">Agregar Invitados</h3>
        <GuestInput onAddGuest={handleAddGuest} />
      </section>

      {/* Jugadores disponibles */}
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

        {/* Jugadores ya añadidos */}
        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
          <LeagueBoard
            id="league-dropzone"
            team={players}
            label="Jugadores en lista"
            onRemove={handleRemovePlayer}
          />
        </section>

      </DndContext>

      {/* Quintetos */}
      {players.length > 0 && (
        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-blue-950 mb-3">Quintetos en orden de llegada</h3>
          <TeamList players={[...players]} />
        </section>
      )}
    </div>
  );
};

export default Leagues;
