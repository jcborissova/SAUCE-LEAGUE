import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import LeagueManager from "../components/League/LeagueManager";
import { ArrowPathIcon } from "@heroicons/react/16/solid";

type League = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

const LeaguesPage: React.FC = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newLeague, setNewLeague] = useState({ name: "", description: "" });
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);

  const fetchLeagues = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leagues").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Error al cargar ligas");
    else setLeagues(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleCreate = async () => {
    if (!newLeague.name.trim()) return toast.warn("Nombre requerido");
    setShowModal(false);
    setLoading(true);

    const { data, error } = await supabase
      .from("leagues")
      .insert({ ...newLeague, created_at: new Date().toISOString() })
      .select("*")
      .single();

    setLoading(false);
    if (error) return toast.error("Error creando liga");

    toast.success("Liga creada");
    setNewLeague({ name: "", description: "" });
    setLeagues([data!, ...leagues]);
  };

  if (selectedLeague)
    return (
      <div className="mx-auto px-4">
        <button
          onClick={() => setSelectedLeague(null)}
          className="text-blue-700 text-sm mb-4 flex items-center"
        >
          ← Volver a lista de ligas
        </button>
        <h2 className="text-2xl font-bold text-blue-950 mb-2">{selectedLeague.name}</h2>
        <p className="text-gray-600 mb-6">{selectedLeague.description}</p>
        <LeagueManager leagueId={selectedLeague.id} />
      </div>
    );

  return (
    <div className="mx-auto px-4 py-6 space-y-6">
      <h2 className="text-3xl font-bold text-blue-950">Ligas</h2>

      <div>
        <button
          className="bg-blue-950 text-white px-6 py-2 rounded-xl hover:bg-blue-800 transition"
          onClick={() => setShowModal(true)}
        >
          Crear nueva liga
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <ul className="space-y-4">
          {leagues.map((l) => (
            <li
              key={l.id}
              className="bg-white rounded-xl p-4 shadow hover:shadow-md hover:bg-blue-50 cursor-pointer transition"
              onClick={() => setSelectedLeague(l)}
            >
              <h3 className="text-lg font-semibold">{l.name}</h3>
              <p className="text-gray-600 text-sm">{l.description}</p>
              <p className="text-gray-400 text-xs mt-1">
                Creado el {new Date(l.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-blue-950">Nueva Liga</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nombre"
                value={newLeague.name}
                onChange={(e) => setNewLeague((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
              />
              <textarea
                placeholder="Descripción"
                value={newLeague.description}
                onChange={(e) => setNewLeague((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm"
                  onClick={handleCreate}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaguesPage;
