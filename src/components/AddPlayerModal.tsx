import React, { useRef, useEffect, useState } from "react";
import type { PlayerFormState } from "../types/player"; // Asegúrate de que esta ruta sea correcta

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
    "w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6 animate-fadeIn">
        <h3 className="text-xl font-semibold text-blue-950 mb-4 text-center">
          {mode === "add" ? "Add New Player" : "Edit Player"}
        </h3>

        <div className="space-y-4">
          {previewURL && (
            <img
              src={previewURL}
              alt="Preview"
              className="w-24 h-24 object-cover rounded-full mx-auto"
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
              className="text-sm text-blue-900 hover:underline"
            >
              {previewURL ? "Change Photo" : "Upload Photo"}
            </button>
          </div>

          <input
            type="text"
            placeholder="First Names"
            className={inputStyle}
            value={newPlayer.names}
            onChange={(e) => setNewPlayer((p) => ({ ...p, names: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Last Names"
            className={inputStyle}
            value={newPlayer.lastnames}
            onChange={(e) => setNewPlayer((p) => ({ ...p, lastnames: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Back Jersey Name"
            className={inputStyle}
            value={newPlayer.backJerseyName}
            onChange={(e) => setNewPlayer((p) => ({ ...p, backJerseyName: e.target.value }))}
          />
          <input
            type="number"
            placeholder="Jersey Number"
            className={inputStyle}
            value={newPlayer.jerseyNumber}
            onChange={(e) => setNewPlayer((p) => ({ ...p, jerseyNumber: e.target.value }))}
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
            placeholder="Description"
            className={inputStyle}
            value={newPlayer.description}
            onChange={(e) => setNewPlayer((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="w-full px-4 py-2 rounded-lg bg-blue-950 text-white hover:bg-blue-800 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlayerModal;
