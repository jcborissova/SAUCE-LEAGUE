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
      <div className="space-y-3">
        {title ? <h4 className="text-base font-semibold">{title}</h4> : null}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <section className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 shadow-[0_1px_0_hsl(var(--border)/0.3)]">
            <h4 className="mb-2 text-sm font-semibold text-[hsl(var(--primary))]">Quinteto A</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quintetoA.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </section>
          <section className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 shadow-[0_1px_0_hsl(var(--border)/0.3)]">
            <h4 className="mb-2 text-sm font-semibold text-[hsl(var(--success))]">Quinteto B</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quintetoB.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title ? <h4 className="text-base font-semibold">{title}</h4> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
};

export default TeamList;
