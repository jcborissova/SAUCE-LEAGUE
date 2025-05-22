import React from "react";
import type { Player } from "../../types/player";
import PlayerCard from "./PlayerCard";

// Extendemos Player para incluir campos usados solo en liga
type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

interface Props {
  players: LeaguePlayer[];
}

const TeamList: React.FC<Props> = ({ players }) => {
  const ordered = [...players].sort(
    (a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0)
  );

  const teams: LeaguePlayer[][] = [];
  for (let i = 0; i < ordered.length; i += 5) {
    teams.push(ordered.slice(i, i + 5));
  }

  return (
    <div className="space-y-6">
      {teams.map((team, index) => (
        <div key={index} className="space-y-2">
          <h4 className="font-semibold text-blue-950">
            🏀 Quinteto {index + 1}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {team.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TeamList;
