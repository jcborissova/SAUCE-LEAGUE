import React from "react";
import { TrashIcon } from "@heroicons/react/24/solid";
import type { Player } from "../types/player";

export type PlayerCardMode = "view" | "manage";

interface PlayerCardProps {
  player: Player;
  mode?: PlayerCardMode;
  onDelete?: (id: number) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, mode = "view", onDelete }) => {
  return (
    <div className="card flex items-center justify-between p-4 gap-3 hover:shadow-lg transition">
      <div className="flex items-center gap-3">
        {player.photo ? (
          <img
            src={player.photo}
            alt={`${player.names} ${player.lastnames}`}
            className="w-12 h-12 rounded-full object-cover border"
          />
        ) : (
          <div className="w-12 h-12 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full flex items-center justify-center font-bold">
            #{player.jerseynumber}
          </div>
        )}
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold leading-tight">
            {player.names} {player.lastnames}
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">#{player.jerseynumber}</p>
          {player.backjerseyname && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] italic">{player.backjerseyname}</p>
          )}

          {mode === "manage" && (
            <div className="space-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              {player.description && <p>{player.description}</p>}
              {player.cedula && <p>Cédula: {player.cedula}</p>}
            </div>
          )}
        </div>
      </div>

      {mode === "manage" && onDelete && (
        <button
          onClick={() => onDelete(player.id)}
          className="text-destructive hover:opacity-80 flex items-center gap-1 transition"
          title="Eliminar jugador"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default PlayerCard;
