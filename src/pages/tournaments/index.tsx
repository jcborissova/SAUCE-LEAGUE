/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import {
  ArrowPathIcon,
  EyeIcon,
  Cog6ToothIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import ConfirmModal from "../../components/ConfirmModal";
import TournamentConfigPage from "../../components/Tournaments/TournamentConfigPage";
import { Link } from "react-router-dom";
import { useRole } from "../../contexts/RoleContext";

type Tournament = {
  id: string;
  name: string;
  startdate: string;
  description: string;
  created_at: string;
};

const TournamentsPage: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: "",
    startdate: "",
    description: "",
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [tournamentToConfigure, setTournamentToConfigure] = useState<string | null>(null);
  const { role} = useRole();


  useEffect(() => {
  if (role !== null) {
    fetchTournaments();
  }
}, [role]);


  const fetchTournaments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Error al cargar torneos");
    else setTournaments(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newTournament.name.trim() || !newTournament.startdate.trim()) {
      return toast.warn("Nombre y fecha son requeridos");
    }
    setShowModal(false);
    setLoading(true);

    const { data, error } = await supabase
      .from("tournaments")
      .insert({ ...newTournament, created_at: new Date().toISOString() })
      .select("*")
      .single();

    setLoading(false);
    if (error) return toast.error("Error creando torneo");

    toast.success("Torneo creado");
    setNewTournament({ name: "", startdate: "", description: "" });
    setTournaments([data!, ...tournaments]);
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("tournaments")
        .delete()
        .eq("id", tournamentId);
      if (error) throw error;

      toast.success("Torneo eliminado");
      fetchTournaments();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar torneo");
    } finally {
      setLoading(false);
    }
  };

  if (role === null) {
    return null; // mientras elige el rol
  }

  return (
    <div className="mx-auto px-4 py-6 space-y-6">
      <h2 className="text-3xl font-bold text-blue-950">Torneos</h2>

      {role === "admin" && (
        <div>
          <button
            className="bg-blue-950 text-white px-6 py-2 rounded-xl hover:bg-blue-800 transition"
            onClick={() => setShowModal(true)}
          >
            Crear nuevo torneo
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <ul className="space-y-3">
          {tournaments.map((t) => (
            <li
              key={t.id}
              className="group bg-white rounded-xl px-5 py-4 shadow flex justify-between items-center transition hover:shadow-lg hover:bg-blue-50"
            >
              <div className="w-full">
                <h3 className="text-base font-semibold text-blue-950">{t.name}</h3>
                <p className="text-sm text-gray-600">{t.startdate}</p>
                <p className="text-sm text-gray-500">{t.description}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Link
                  to={`/tournaments/view/${t.id}`}
                  className="flex items-center justify-center gap-1 bg-gray-200 hover:bg-gray-300 text-blue-700 px-3 py-1 rounded-lg transition text-sm w-full sm:w-auto"
                >
                  <EyeIcon className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Ver</span>
                </Link>
                {role === "admin" && (
                  <>
                    <button
                      onClick={() => setTournamentToConfigure(t.id)}
                      className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition text-sm w-full sm:w-auto"
                    >
                      <Cog6ToothIcon className="w-4 h-4 sm:hidden" />
                      <span className="hidden sm:inline">Configurar</span>
                    </button>
                    <button
                      onClick={() => {
                        setTournamentToDelete(t);
                        setShowConfirm(true);
                      }}
                      className="flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition text-sm w-full sm:w-auto"
                    >
                      <TrashIcon className="w-4 h-4 sm:hidden" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-blue-950">Nuevo Torneo</h3>
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
                value={newTournament.name}
                onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
              />
              <input
                type="date"
                value={newTournament.startdate}
                onChange={(e) => setNewTournament((p) => ({ ...p, startdate: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
              />
              <textarea
                placeholder="Descripción"
                value={newTournament.description}
                onChange={(e) => setNewTournament((p) => ({ ...p, description: e.target.value }))}
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

      <ConfirmModal
        isOpen={showConfirm}
        title="Eliminar Torneo"
        message={`¿Estás seguro de eliminar el torneo "${tournamentToDelete?.name}"?`}
        onCancel={() => {
          setShowConfirm(false);
          setTournamentToDelete(null);
        }}
        onConfirm={async () => {
          if (!tournamentToDelete) return;
          await handleDeleteTournament(tournamentToDelete.id);
          setShowConfirm(false);
          setTournamentToDelete(null);
        }}
      />

      {tournamentToConfigure && (
        <TournamentConfigPage
          isOpen={!!tournamentToConfigure}
          onClose={() => setTournamentToConfigure(null)}
          tournamentId={tournamentToConfigure}
        />
      )}
    </div>
  );
};

export default TournamentsPage;
