import React, { useRef, useEffect, useState } from "react";
import { CameraIcon, IdentificationIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import type { PlayerFormState } from "../types/player";
import ModalShell from "./ui/ModalShell";
import Field from "./ui/Field";
import PlayerTournamentStatsPanel from "./PlayerTournamentStatsPanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  newPlayer: PlayerFormState;
  setNewPlayer: React.Dispatch<React.SetStateAction<PlayerFormState>>;
  mode: "add" | "edit";
}

const AddPlayerModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, newPlayer, setNewPlayer, mode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  useEffect(() => {
    if (newPlayer.photo instanceof File) {
      const url = URL.createObjectURL(newPlayer.photo);
      setPreviewURL(url);
      return () => URL.revokeObjectURL(url);
    }

    if (typeof newPlayer.photo === "string") {
      setPreviewURL(newPlayer.photo);
    } else {
      setPreviewURL(null);
    }
  }, [newPlayer.photo]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setNewPlayer((prev) => ({ ...prev, photo: file }));
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Agregar jugador" : "Editar jugador"}
      subtitle={mode === "add" ? "Completa el perfil del jugador." : "Actualiza datos y revisa sus números por torneo."}
      maxWidthClassName="sm:max-w-4xl"
      actions={
        <>
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={onSubmit} className="btn-primary">
            Guardar
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))]">
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.08)] via-transparent to-[hsl(var(--warning)/0.06)]" />
            <div className="relative space-y-4 p-4">
              <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-2))] shadow-[0_8px_18px_hsl(var(--background)/0.06)]">
                {previewURL ? (
                  <img src={previewURL} alt="Preview jugador" className="h-full w-full object-cover" />
                ) : (
                  <UserCircleIcon className="h-20 w-20 text-[hsl(var(--text-subtle))]" />
                )}
              </div>

              <div className="space-y-2 text-center">
                <p className="text-sm font-semibold">
                  {newPlayer.names || newPlayer.lastnames
                    ? `${newPlayer.names} ${newPlayer.lastnames}`.replace(/\s+/g, " ").trim()
                    : "Nuevo jugador"}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {newPlayer.backjerseyname ? `Dorsal: ${newPlayer.backjerseyname}` : "Configura foto, dorsal y datos básicos."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full">
                  <CameraIcon className="h-4 w-4" />
                  {previewURL ? "Cambiar foto" : "Subir foto"}
                </button>
              </div>
            </div>
          </div>

          {mode === "edit" && Number(newPlayer.id) > 0 ? (
            <div className="rounded-[12px] border bg-[hsl(var(--surface-2)/0.35)] p-3">
              <PlayerTournamentStatsPanel playerId={Number(newPlayer.id)} compact enabled={isOpen} />
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombres">
              <input
                type="text"
                className="input-base"
                value={newPlayer.names}
                onChange={(e) => setNewPlayer((p) => ({ ...p, names: e.target.value }))}
                placeholder="Ej. Juan"
              />
            </Field>

            <Field label="Apellidos">
              <input
                type="text"
                className="input-base"
                value={newPlayer.lastnames}
                onChange={(e) => setNewPlayer((p) => ({ ...p, lastnames: e.target.value }))}
                placeholder="Ej. Pérez"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Nombre dorsal" hint="Texto que aparece en la espalda del jersey.">
              <input
                type="text"
                className="input-base"
                value={newPlayer.backjerseyname}
                onChange={(e) => setNewPlayer((p) => ({ ...p, backjerseyname: e.target.value }))}
                placeholder="Ej. PEREZ"
              />
            </Field>

            <Field label="Jersey">
              <input
                type="number"
                className="input-base"
                value={newPlayer.jerseynumber}
                onChange={(e) => setNewPlayer((p) => ({ ...p, jerseynumber: e.target.value }))}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Cédula" hint="Identificación del jugador.">
            <div className="relative">
              <IdentificationIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                className="input-base pl-9"
                value={newPlayer.cedula}
                onChange={(e) => setNewPlayer((p) => ({ ...p, cedula: e.target.value }))}
                placeholder="Número de cédula"
              />
            </div>
          </Field>

          <Field label="Descripción" hint="Rol, posición o detalle breve (opcional).">
            <textarea
              className="textarea-base"
              rows={4}
              value={newPlayer.description}
              onChange={(e) => setNewPlayer((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ej. Base armador, buen tiro exterior y lectura de juego."
            />
          </Field>
        </section>
      </div>
    </ModalShell>
  );
};

export default AddPlayerModal;
