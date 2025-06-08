// components/League/GuestInput.tsx
import React, { useState } from "react";
import type { LeaguePlayer } from "../../types/player";

interface Props {
  onAddGuest: (player: LeaguePlayer) => void;
}

const GuestInput: React.FC<Props> = ({ onAddGuest }) => {
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddGuest({
      id: Date.now(),
      names: name,
      lastnames: "",
      backjerseyname: name,
      jerseynumber: 0,
      cedula: "",
      description: "",
      photo: "",
      isGuest: true,
      arrivalTime: Date.now(),
    });
    setName("");
  };

  return (
    <div className="flex gap-2 mt-4">
      <input
        type="text"
        placeholder="Nombre del invitado"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border px-3 py-1 rounded w-full"
      />
      <button
        onClick={handleAdd}
        className="bg-blue-950 text-white px-3 py-1 rounded"
      >
        Agregar
      </button>
    </div>
  );
};

export default GuestInput;
