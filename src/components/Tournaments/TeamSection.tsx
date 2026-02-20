/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import type { Player } from "../../types/player";
import { UserGroupIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

type Props = {
  teamName: string;
  players: Player[];
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const TeamSection: React.FC<Props> = ({ teamName, players }) => {
  const [expanded, setExpanded] = useState(false);

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        const jerseyA = Number.isFinite(Number(a.jerseynumber)) ? Number(a.jerseynumber) : 9999;
        const jerseyB = Number.isFinite(Number(b.jerseynumber)) ? Number(b.jerseynumber) : 9999;
        if (jerseyA !== jerseyB) return jerseyA - jerseyB;
        return `${a.names} ${a.lastnames}`.localeCompare(`${b.names} ${b.lastnames}`);
      }),
    [players]
  );

  const previewPlayers = sortedPlayers.slice(0, 5);

  return (
    <article className="w-full app-card rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col">
      <header className="rounded-2xl border bg-[hsl(var(--surface-2))] p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary)/0.2)] to-[hsl(var(--info)/0.18)] border flex items-center justify-center text-sm font-bold text-[hsl(var(--primary))]">
              {getInitials(teamName) || "TM"}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">{teamName}</h2>
              <p className="text-xs text-[hsl(var(--text-subtle))]">Plantilla oficial</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border bg-[hsl(var(--surface-1))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
            <UserGroupIcon className="h-3.5 w-3.5" />
            {players.length}
          </div>
        </div>

        {previewPlayers.length > 0 && (
          <div className="mt-3 flex -space-x-2">
            {previewPlayers.map((player) =>
              player.photo ? (
                <img
                  key={`preview-${player.id}`}
                  src={player.photo}
                  alt={`${player.names} ${player.lastnames}`}
                  className="h-8 w-8 rounded-full border-2 border-[hsl(var(--surface-2))] object-cover"
                />
              ) : (
                <div
                  key={`preview-${player.id}`}
                  className="h-8 w-8 rounded-full border-2 border-[hsl(var(--surface-2))] bg-[hsl(var(--surface-3))] text-[10px] font-bold text-[hsl(var(--text-subtle))] flex items-center justify-center"
                >
                  {getInitials(player.names)}
                </div>
              )
            )}
          </div>
        )}
      </header>

      {sortedPlayers.length === 0 ? (
        <p className="text-[hsl(var(--text-subtle))] text-sm">
          No hay jugadores en este equipo.
        </p>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="w-full flex items-center justify-between rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2.5 text-sm font-semibold hover:bg-[hsl(var(--muted))] transition"
          >
            <span>{expanded ? "Ocultar jugadores" : `Ver jugadores (${sortedPlayers.length})`}</span>
            <ChevronDownIcon
              className={`h-4 w-4 text-[hsl(var(--text-subtle))] transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {expanded && (
            <ul className="space-y-2.5">
              {sortedPlayers.map((player) => (
                <li
                  key={player.id}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 border bg-[hsl(var(--surface-2))] transition hover:shadow-sm hover:border-[hsl(var(--primary)/0.35)]"
                >
                  {player.photo ? (
                    <img
                      src={player.photo}
                      alt={`${player.names} ${player.lastnames}`}
                      className="h-11 w-11 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-[hsl(var(--surface-3))] flex items-center justify-center text-[hsl(var(--text-subtle))] font-bold">
                      {getInitials(player.names)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {player.names} {player.lastnames}
                    </p>
                    <p className="text-xs text-[hsl(var(--text-subtle))] truncate">
                      {player.backjerseyname || "Sin alias"}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-lg border bg-[hsl(var(--surface-1))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--primary))]">
                    #{Number.isFinite(Number(player.jerseynumber)) ? player.jerseynumber : "--"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
};

export default TeamSection;
