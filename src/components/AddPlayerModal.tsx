import React, { useRef, useEffect, useState } from "react";
import type { PlayerFormState } from "../types/player";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  newPlayer: PlayerFormState;
  setNewPlayer: React.Dispatch<React.SetStateAction<PlayerFormState>>;
  mode: "add" | "edit";
}

const AddPlayerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  newPlayer,
  setNewPlayer,
  mode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  useEffect(() => {
    if (newPlayer.photo instanceof File) {
      const url = URL.createObjectURL(newPlayer.photo);
      setPreviewURL(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof newPlayer.photo === "string") {
      setPreviewURL(newPlayer.photo);
    } else {
      setPreviewURL(null);
    }
  }, [newPlayer.photo]);  

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPlayer((prev) => ({ ...prev, photo: file }));
    }
  };

  const inputStyle =
    "input-base";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 animate-fadeIn shadow-2xl">
        <h3 className="text-xl font-semibold text-center">
          {mode === "add" ? "Agregar jugador" : "Editar jugador"}
        </h3>

        <div className="space-y-4 mt-4">
          {previewURL && (
            <img
              src={previewURL}
              alt="Preview"
              className="w-24 h-24 object-cover rounded-full mx-auto border"
            />
          )}

          <div className="text-center">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-[hsl(var(--primary))] hover:underline"
            >
              {previewURL ? "Cambiar foto" : "Subir foto"}
            </button>
          </div>

          <input
            type="text"
            placeholder="Nombres"
            className={inputStyle}
            value={newPlayer.names}
            onChange={(e) => setNewPlayer((p) => ({ ...p, names: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Apellidos"
            className={inputStyle}
            value={newPlayer.lastnames}
            onChange={(e) => setNewPlayer((p) => ({ ...p, lastnames: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Nombre dorsal"
            className={inputStyle}
            value={newPlayer.backjerseyname}
            onChange={(e) => setNewPlayer((p) => ({ ...p, backjerseyname: e.target.value }))}
          />
          <input
            type="number"
            placeholder="Número de jersey"
            className={inputStyle}
            value={newPlayer.jerseynumber}
            onChange={(e) => setNewPlayer((p) => ({ ...p, jerseynumber: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Cédula"
            className={inputStyle}
            value={newPlayer.cedula}
            onChange={(e) => setNewPlayer((p) => ({ ...p, cedula: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Descripción"
            className={inputStyle}
            value={newPlayer.description}
            onChange={(e) => setNewPlayer((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            className="w-full px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold hover:opacity-90 transition"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlayerModal;
