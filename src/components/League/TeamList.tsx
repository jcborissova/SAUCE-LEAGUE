// components/League/TeamList.tsx
import React from "react";
import type { LeaguePlayer } from "../../types/player";
import PlayerCard from "./PlayerCard";

interface Props {
  players: LeaguePlayer[];
}

const TeamList: React.FC<Props> = ({ players }) => {
  const ordered = [...players].sort(
    (a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0)
  );

  const quinteto1 = ordered.slice(0, 5);
  const quinteto2 = ordered.slice(5, 10);
  const waitingList = ordered.slice(10);

  return (
    <div className="space-y-8">
      {quinteto1.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-blue-950">🏀 Quinteto 1</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {quinteto1.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      )}

      {quinteto2.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-blue-950">🏀 Quinteto 2</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {quinteto2.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      )}

      {waitingList.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-blue-950">⌛ Jugadores en espera</h4>
          <div className="flex flex-wrap gap-3">
            {waitingList.map((player) => (
              <div key={player.id} className="w-full sm:w-auto">
                <PlayerCard player={player} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamList;
