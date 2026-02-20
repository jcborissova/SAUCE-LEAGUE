import React from "react";
import { UserPlusIcon } from "@heroicons/react/24/solid";
import type { Player } from "../types/player";
import ActionMenu from "./ui/action-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface PlayerTableProps {
  players: Player[];
  resultSummary?: string;
  onDelete: (id: number) => void;
  onOpenModal: () => void;
  onEdit: (player: Player) => void;
  onView: (player: Player) => void;
}

const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  resultSummary,
  onDelete,
  onOpenModal,
  onEdit,
  onView,
}) => {
  return (
    <div className="app-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold">Jugadores</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Gestión y edición del roster.</p>
          {resultSummary ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{resultSummary}</p>
          ) : null}
        </div>
        <button onClick={onOpenModal} className="btn-primary">
          <UserPlusIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Nuevo jugador</span>
          <span className="sm:hidden">Añadir</span>
        </button>
      </div>

      <div className="hidden md:block">
        <TableContainer className="max-h-[68vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--muted)/0.9)]">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Back Name</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-10 text-center text-[hsl(var(--muted-foreground))] font-semibold">
                    No hay jugadores registrados.
                  </TableCell>
                </TableRow>
              ) : (
                players.map((p, index) => (
                  <TableRow
                    key={p.id}
                    className={index % 2 === 0 ? "bg-[hsl(var(--card))]" : "bg-[hsl(var(--surface-1))]"}
                  >
                    <TableCell className="font-semibold text-[hsl(var(--foreground))]">#{p.jerseynumber}</TableCell>
                    <TableCell>{p.names} {p.lastnames}</TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))] max-w-[180px] truncate" title={p.backjerseyname}>
                      {p.backjerseyname}
                    </TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))] max-w-[260px] truncate" title={p.description || ""}>
                      {p.description || "—"}
                    </TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">{p.cedula}</TableCell>
                    <TableCell>
                      {p.photo ? (
                        <img
                          src={p.photo}
                          alt="Foto"
                          className="w-10 h-10 rounded-full object-cover border"
                        />
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))] italic">Sin foto</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <ActionMenu
                        onView={() => onView(p)}
                        onEdit={() => onEdit(p)}
                        onDelete={() => onDelete(p.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {players.length === 0 && (
          <div className="border p-4 text-center text-[hsl(var(--muted-foreground))]">
            No hay jugadores registrados.
          </div>
        )}
        {players.map((p) => (
          <div key={p.id} className="border p-4 bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]">
            <div className="flex items-center gap-3">
              {p.photo ? (
                <img src={p.photo} alt="Foto" className="w-12 h-12 rounded-full object-cover border" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] flex items-center justify-center font-semibold">#{p.jerseynumber}</div>
              )}
              <div className="flex-1">
                <p className="font-semibold">{p.names} {p.lastnames}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate" title={p.backjerseyname}>
                  {p.backjerseyname}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Jersey #{p.jerseynumber} • Cédula {p.cedula}
                </p>
              </div>
              <ActionMenu
                onView={() => onView(p)}
                onEdit={() => onEdit(p)}
                onDelete={() => onDelete(p.id)}
                className="ml-auto"
              />
            </div>
            {p.description && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">{p.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerTable;
