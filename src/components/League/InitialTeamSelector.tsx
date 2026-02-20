import React, { useState } from "react";
import type { LeaguePlayer } from "../../types/player";
import PlayerCard from "./PlayerCard";

interface Props {
  players: LeaguePlayer[];
  onConfirm: (teamA: LeaguePlayer[], teamB: LeaguePlayer[]) => void | Promise<void>;
}

const InitialTeamSelector: React.FC<Props> = ({ players, onConfirm }) => {
  const [teamA, setTeamA] = useState<LeaguePlayer[]>([]);
  const [teamB, setTeamB] = useState<LeaguePlayer[]>([]);

  const handleSelect = (player: LeaguePlayer) => {
    if (teamA.includes(player) || teamB.includes(player)) return;
    if (teamA.length < 5) setTeamA([...teamA, player]);
    else if (teamB.length < 5) setTeamB([...teamB, player]);
  };

  const handleRemove = (player: LeaguePlayer) => {
    setTeamA(teamA.filter((p) => p.id !== player.id));
    setTeamB(teamB.filter((p) => p.id !== player.id));
  };

  const isConfirmDisabled = teamA.length !== 5 || teamB.length !== 5;

  return (
    <div className="space-y-8">
      <h3 className="font-bold text-xl text-center">Seleccionar Quintetos Iniciales</h3>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h4 className="font-semibold text-[hsl(var(--primary))] mb-2">Equipo A</h4>
          <div className="grid grid-cols-2 gap-3">
            {teamA.map((p) => (
              <PlayerCard key={p.id} player={p} onDoubleClick={() => handleRemove(p)} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-[hsl(var(--primary))] mb-2">Equipo B</h4>
          <div className="grid grid-cols-2 gap-3">
            {teamB.map((p) => (
              <PlayerCard key={p.id} player={p} onDoubleClick={() => handleRemove(p)} />
            ))}
          </div>
        </div>
      </div>

      <div className="app-card p-4 rounded-xl">
        <h4 className="font-semibold mb-2">Jugadores Disponibles</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {players.map((p) => {
            const isSelected = teamA.includes(p) || teamB.includes(p);
            return (
              <div key={p.id} className={`cursor-pointer ${isSelected ? "opacity-30" : ""}`} onClick={() => handleSelect(p)}>
                <PlayerCard player={p} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <button
          disabled={isConfirmDisabled}
          className={`btn-primary ${isConfirmDisabled ? "opacity-60" : ""}`}
          onClick={() => onConfirm(teamA, teamB)}
        >
          Confirmar Quintetos
        </button>
      </div>
    </div>
  );
};

export default InitialTeamSelector;
