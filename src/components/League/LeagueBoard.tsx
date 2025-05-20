import React from "react";
import type { Player } from "../../types/player";
import PlayerCard from "./PlayerCard";
import { useDroppable } from "@dnd-kit/core";

interface Props {
  id: string; // 👉 agregar esta línea para permitir la prop `id`
  team: Player[];
  label: string;
  onRemove: (id: number) => void;
}

const LeagueBoard: React.FC<Props> = ({ id, team, label, onRemove }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`p-4 border-2 rounded min-h-[150px] transition ${
        isOver ? "bg-green-100" : "bg-gray-100"
      }`}
    >
      <h4 className="font-bold mb-3">{label}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {team.map((p) => (
          <PlayerCard key={p.id} player={p} onDelete={onRemove} />
        ))}
      </div>
    </div>
  );
};

export default LeagueBoard;
