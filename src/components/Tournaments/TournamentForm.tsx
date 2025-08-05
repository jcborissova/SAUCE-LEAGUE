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
    <div className="bg-white p-4 rounded-xl shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-blue-950 mb-3">Crear Nuevo Torneo</h3>

      <div>
        <label className="font-semibold text-blue-900">Nombre:</label>
        <input
          type="text"
          className="w-full border p-2 rounded mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="font-semibold text-blue-900">Fecha de inicio:</label>
        <input
          type="date"
          className="w-full border p-2 rounded mt-1"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="text-center">
        <button
          className="bg-blue-950 text-white px-6 py-2 rounded-xl text-sm hover:bg-blue-800 transition disabled:opacity-50"
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
