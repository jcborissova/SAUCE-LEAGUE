import React, { useRef, useEffect, useState } from "react";
import type { PlayerFormState } from "../types/player";
import ModalShell from "./ui/ModalShell";
import Field from "./ui/Field";

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
      maxWidthClassName="sm:max-w-md"
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
      <div className="space-y-4">
        {previewURL ? (
          <img src={previewURL} alt="Preview" className="mx-auto h-24 w-24 object-cover border" />
        ) : null}

        <div className="text-center">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            {previewURL ? "Cambiar foto" : "Subir foto"}
          </button>
        </div>

        <Field label="Nombres">
          <input
            type="text"
            className="input-base"
            value={newPlayer.names}
            onChange={(e) => setNewPlayer((p) => ({ ...p, names: e.target.value }))}
          />
        </Field>
        <Field label="Apellidos">
          <input
            type="text"
            className="input-base"
            value={newPlayer.lastnames}
            onChange={(e) => setNewPlayer((p) => ({ ...p, lastnames: e.target.value }))}
          />
        </Field>
        <Field label="Nombre dorsal">
          <input
            type="text"
            className="input-base"
            value={newPlayer.backjerseyname}
            onChange={(e) => setNewPlayer((p) => ({ ...p, backjerseyname: e.target.value }))}
          />
        </Field>
        <Field label="Número de jersey">
          <input
            type="number"
            className="input-base"
            value={newPlayer.jerseynumber}
            onChange={(e) => setNewPlayer((p) => ({ ...p, jerseynumber: e.target.value }))}
          />
        </Field>
        <Field label="Cédula">
          <input
            type="text"
            className="input-base"
            value={newPlayer.cedula}
            onChange={(e) => setNewPlayer((p) => ({ ...p, cedula: e.target.value }))}
          />
        </Field>
        <Field label="Descripción">
          <input
            type="text"
            className="input-base"
            value={newPlayer.description}
            onChange={(e) => setNewPlayer((p) => ({ ...p, description: e.target.value }))}
          />
        </Field>
      </div>
    </ModalShell>
  );
};

export default AddPlayerModal;
