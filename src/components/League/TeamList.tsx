import React from "react";
import type { LeaguePlayer } from "../../types/player";
import PlayerCard from "./PlayerCard";

interface Props {
  players: LeaguePlayer[];
  title?: string;
  teamMode?: boolean;
}

const TeamList: React.FC<Props> = ({ players, title, teamMode = false }) => {
  if (!players || players.length === 0) return null;

  if (teamMode) {
    const quintetoA = players.slice(0, 5);
    const quintetoB = players.slice(5, 10);

    return (
      <div className="space-y-6">
        {title && <h4 className="font-semibold text-blue-950 text-lg">{title}</h4>}
        <div>
          <h4 className="font-semibold text-blue-950">Quinteto A</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {quintetoA.map((player) => <PlayerCard key={player.id} player={player} />)}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-blue-950">Quinteto B</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {quintetoB.map((player) => <PlayerCard key={player.id} player={player} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && <h4 className="font-semibold text-blue-950 text-lg">{title}</h4>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {players.map((player) => <PlayerCard key={player.id} player={player} />)}
      </div>
    </div>
  );
};

export default TeamList;
