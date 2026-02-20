import React from "react";
import type { LeaguePlayer } from "../../types/player";
import PlayerCard from "./PlayerCard";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  players: LeaguePlayer[];
  onRemove: (id: number) => void;
}

const SortableItem: React.FC<{ player: LeaguePlayer; onRemove: (id: number) => void }> = ({ player, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PlayerCard player={player} onDelete={onRemove} dragProps={{ attributes, listeners }} />
    </div>
  );
};


const SortableLeagueBoard: React.FC<Props> = ({ players, onRemove }) => {
  return (
    <div className="p-4 sm:p-5 border rounded-2xl bg-[hsl(var(--muted)/0.40)]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Jugadores en lista</h4>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Arrastra para ordenar</span>
      </div>
      <SortableContext items={players.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {players.map(player => (
            <SortableItem key={player.id} player={player} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export default SortableLeagueBoard;
