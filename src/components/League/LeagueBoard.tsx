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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: player.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PlayerCard player={player} onDelete={onRemove} dragProps={{ attributes, listeners }} />
    </div>
  );
};

const SortableLeagueBoard: React.FC<Props> = ({ players, onRemove }) => {
  return (
    <div id="league-dropzone" className="border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-semibold">Lista activa</h4>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Arrastra para ordenar</span>
      </div>

      <SortableContext items={players.map((p) => p.id.toString())} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {players.map((player) => (
            <SortableItem key={player.id} player={player} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export default SortableLeagueBoard;
