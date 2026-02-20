import React, { useState } from "react";
import type { Player } from "../../types/player";

interface Props {
  onAddGuest: (guest: Player) => void;
}

const GuestInput: React.FC<Props> = ({ onAddGuest }) => {
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddGuest({ names: name, backjerseyname: name } as Player);
    setName("");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        className="input-base"
        placeholder="Nombre del invitado"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="btn-primary"
        onClick={handleAdd}
      >
        Agregar
      </button>
    </div>
  );
};

export default GuestInput;
