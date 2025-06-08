// components/League/TeamList.tsx
import React from "react";
import type { LeaguePlayer } from "../../types/player";
import PlayerCard from "./PlayerCard";

interface Props {
  players: LeaguePlayer[];
  title?: string;
  teamMode?: boolean; // true = mostrar quintetoA y quintetoB, false = lista normal
}

const TeamList: React.FC<Props> = ({ players, title, teamMode = false }) => {
  if (!players || players.length === 0) return null;

  const ordered = [...players].sort(
    (a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0)
  );

  if (teamMode) {
    const quintetoA = ordered.slice(0, 5);
    const quintetoB = ordered.slice(5, 10);

    return (
      <div className="space-y-6">
        {title && <h4 className="font-semibold text-blue-950 text-lg">{title}</h4>}

        {quintetoA.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-950">Quinteto A</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {quintetoA.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </div>
        )}

        {quintetoB.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-950">Quinteto B</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {quintetoB.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Lista normal (jugadores en espera)
  return (
    <div className="space-y-2">
      {title && <h4 className="font-semibold text-blue-950 text-lg">{title}</h4>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {ordered.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
};

export default TeamList;
