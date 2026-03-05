import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  HashtagIcon,
  IdentificationIcon,
  PencilSquareIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassPlusIcon } from "@heroicons/react/24/solid";

import ModalShell from "./ui/ModalShell";
import Badge from "./ui/Badge";
import type { Player } from "../types/player";
import PlayerTournamentStatsPanel from "./PlayerTournamentStatsPanel";

type Props = {
  isOpen: boolean;
  player: Player | null;
  onClose: () => void;
  onEdit: (player: Player) => void;
};

const buildPhotoDownloadName = (name: string) => {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${normalized || "jugador"}-perfil.jpg`;
};

const PlayerProfileModal: React.FC<Props> = ({ isOpen, player, onClose, onEdit }) => {
  const [zoomOpen, setZoomOpen] = useState(false);

  const fullName = useMemo(() => {
    if (!player) return "";
    return `${player.names} ${player.lastnames}`.replace(/\s+/g, " ").trim();
  }, [player]);
  const photoDownloadName = useMemo(
    () => buildPhotoDownloadName(fullName || `jugador-${player?.id ?? ""}`),
    [fullName, player?.id]
  );

  useEffect(() => {
    if (!isOpen) {
      setZoomOpen(false);
      return;
    }
    if (!player?.photo) {
      setZoomOpen(false);
    }
  }, [isOpen, player?.id, player?.photo]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomOpen]);

  if (!isOpen || !player) return null;

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        title={fullName || `Jugador ${player.id}`}
        subtitle="Perfil del jugador y rendimiento dividido por torneo."
        maxWidthClassName="sm:max-w-4xl"
        actions={
          <>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cerrar
            </button>
            <button type="button" onClick={() => onEdit(player)} className="btn-primary">
              <PencilSquareIcon className="h-4 w-4" />
              Editar
            </button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="space-y-3">
            <div className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))]">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.10)] via-transparent to-[hsl(var(--warning)/0.08)]" />
              <div className="relative p-4">
                <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-2))] shadow-[0_8px_18px_hsl(var(--background)/0.08)] sm:h-44 sm:w-44">
                  {player.photo ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setZoomOpen(true)}
                        className="group relative h-full w-full"
                        aria-label="Ampliar foto del jugador"
                        title="Ampliar foto"
                      >
                        <img src={player.photo} alt={fullName} className="h-full w-full object-cover" />
                        <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/35 bg-black/45 text-white opacity-90 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                          <MagnifyingGlassPlusIcon className="h-4 w-4" />
                        </span>
                      </button>
                      <a
                        href={player.photo}
                        download={photoDownloadName}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/35 bg-black/45 text-white opacity-90 backdrop-blur-sm transition-opacity hover:opacity-100"
                        aria-label="Descargar foto del jugador"
                        title="Descargar foto"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </a>
                    </>
                  ) : (
                    <UserCircleIcon className="h-20 w-20 text-[hsl(var(--text-subtle))]" />
                  )}
                </div>

                <div className="mt-4 space-y-2 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="primary">#{player.jerseynumber ?? "--"}</Badge>
                    <Badge>{player.backjerseyname || "Sin alias dorsal"}</Badge>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {player.description?.trim() || "Jugador registrado en la liga."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[12px] border bg-[hsl(var(--surface-1))] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.55)] p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Nombre completo</p>
                  <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-strong))]">{fullName || "Sin nombre"}</p>
                </div>

                <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.55)] p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                    <HashtagIcon className="h-3.5 w-3.5" />
                    Número / dorsal
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-strong))]">
                    #{player.jerseynumber ?? "--"} · {player.backjerseyname || "Sin alias"}
                  </p>
                </div>

                <div className="rounded-[10px] border bg-[hsl(var(--surface-2)/0.55)] p-2.5 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                    <IdentificationIcon className="h-3.5 w-3.5" />
                    Cédula
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-strong))]">{player.cedula || "No registrada"}</p>
                </div>
              </div>
            </div>
          </section>

          <PlayerTournamentStatsPanel playerId={player.id} enabled={isOpen} />
        </div>
      </ModalShell>

      {zoomOpen && player.photo ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de la foto del jugador"
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <a
              href={player.photo}
              download={photoDownloadName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white backdrop-blur-sm"
              aria-label="Descargar foto del jugador"
              title="Descargar foto"
              onClick={(event) => event.stopPropagation()}
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </a>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white backdrop-blur-sm"
              onClick={(event) => {
                event.stopPropagation();
                setZoomOpen(false);
              }}
              aria-label="Cerrar vista ampliada"
              title="Cerrar"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <img
            src={player.photo}
            alt={fullName}
            className="max-h-full max-w-full rounded-[12px] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
};

export default PlayerProfileModal;
