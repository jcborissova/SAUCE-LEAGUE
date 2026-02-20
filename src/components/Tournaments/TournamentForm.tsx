import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";

const TournamentForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !startDate) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("tournaments").insert({
      name,
      start_date: startDate,
    });

    if (error) {
      toast.error("Error al crear el torneo");
    } else {
      toast.success("Torneo creado");
      setName("");
      setStartDate("");
      onCreated();
    }
    setLoading(false);
  };

  return (
    <div className="app-card p-4 rounded-xl space-y-4">
      <h3 className="text-lg font-semibold mb-3">Crear Nuevo Torneo</h3>

      <div>
        <label className="font-semibold">Nombre:</label>
        <input
          type="text"
          className="input-base mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="font-semibold">Fecha de inicio:</label>
        <input
          type="date"
          className="input-base mt-1"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="text-center">
        <button
          className="btn-primary"
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? "Guardando..." : "Crear Torneo"}
        </button>
      </div>
    </div>
  );
};

export default TournamentForm;
