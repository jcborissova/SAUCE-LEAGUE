/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { Player } from "../../types/player";
import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/solid";

type LeaguePlayer = Player & {
  arrivalTime?: number;
  isGuest?: boolean;
};

interface Props {
  player: LeaguePlayer;
  onDelete?: (id: number) => void;
  onDoubleClick?: () => void;
  dragProps?: {
    attributes: any;
    listeners: any;
  };
}

const PlayerCard: React.FC<Props> = ({ player, onDelete, onDoubleClick, dragProps }) => {
  const arrivalTimeFormatted = player.arrivalTime
    ? new Date(player.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <article
      className="relative border bg-[hsl(var(--surface-1))] px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--surface-2))]"
      onDoubleClick={onDoubleClick}
    >
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(player.id);
          }}
          className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
          aria-label="Eliminar jugador"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      ) : null}

      {dragProps ? (
        <div
          {...dragProps.listeners}
          {...dragProps.attributes}
          className="absolute bottom-1 right-1 cursor-grab text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          title="Arrastrar"
        >
          <Bars3Icon className="h-4 w-4" />
        </div>
      ) : null}

      <div className="pr-8">
        <p className="truncate font-semibold leading-tight">
          {player.names} {player.lastnames}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--text-subtle))]">
          {player.isGuest ? <span>Invitado</span> : null}
          {arrivalTimeFormatted ? <span>{arrivalTimeFormatted}</span> : null}
        </div>
      </div>
    </article>
  );
};

export default PlayerCard;
