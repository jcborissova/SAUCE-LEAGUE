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
  const initials = `${player.names?.[0] ?? ""}${player.lastnames?.[0] ?? ""}`.trim().toUpperCase() || "SL";

  return (
    <article
      className="relative rounded-[8px] border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] px-3 py-2.5 text-left text-sm shadow-[0_1px_0_hsl(var(--border)/0.25)] transition-colors hover:bg-[hsl(var(--surface-2)/0.6)]"
      onDoubleClick={onDoubleClick}
    >
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(player.id);
          }}
          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--destructive))]"
          aria-label="Eliminar jugador"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      ) : null}

      {dragProps ? (
        <div
          {...dragProps.listeners}
          {...dragProps.attributes}
          className="absolute bottom-1 right-1 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-[6px] border border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground))]"
          title="Arrastrar"
        >
          <Bars3Icon className="h-5 w-5" />
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 pr-10">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-xs font-semibold text-[hsl(var(--text-subtle))]">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">
            {player.names} {player.lastnames}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--text-subtle))]">
            {player.isGuest ? <span className="inline-flex border px-1.5 py-0.5">Invitado</span> : null}
            {arrivalTimeFormatted ? <span>{arrivalTimeFormatted}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
};

export default PlayerCard;
