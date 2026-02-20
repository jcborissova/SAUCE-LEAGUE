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
import ModalShell from "../../components/ui/ModalShell";
import PageHeader from "../../components/ui/PageHeader";
import Field from "../../components/ui/Field";

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
    <div className="mx-auto px-3 py-4 sm:px-4 sm:py-6 space-y-5">
      <PageHeader
        title="Torneos"
        subtitle="Configura equipos, calendario, resultados y analíticas avanzadas."
        badge="Season Hub"
        actions={
          role === "admin" ? (
            <button className="btn-primary w-full sm:w-auto" onClick={() => setShowModal(true)}>
              Crear torneo
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : (
        <ul className="space-y-3">
          <li className="app-panel p-3 sm:p-4">
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--text-subtle))]">Total activos</p>
            <p className="text-2xl font-bold">{tournaments.length}</p>
          </li>
          {tournaments.map((t) => (
            <li
              key={t.id}
              className="app-card group rounded-xl border-[hsl(var(--border)/0.85)] px-4 py-4 sm:px-5 transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2)/0.72)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full">
                  <h3 className="text-base font-semibold">{t.name}</h3>
                  <p className="text-sm text-[hsl(var(--text-subtle))]">{t.startdate}</p>
                  <p className="text-sm text-[hsl(var(--text-subtle))]">{t.description}</p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
                  <Link
                    to={`/tournaments/view/${t.id}`}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    <EyeIcon className="w-4 h-4 sm:hidden" />
                    <span className="sm:hidden">Ver torneo</span>
                    <span className="hidden sm:inline">Ver</span>
                  </Link>
                  {role === "admin" && (
                    <>
                      <button
                        onClick={() => setTournamentToConfigure(t.id)}
                        className="btn-primary w-full sm:w-auto"
                      >
                        <Cog6ToothIcon className="w-4 h-4 sm:hidden" />
                        <span className="sm:hidden">Configurar</span>
                        <span className="hidden sm:inline">Configurar</span>
                      </button>
                      <button
                        onClick={() => {
                          setTournamentToDelete(t);
                          setShowConfirm(true);
                        }}
                        className="btn-danger w-full sm:w-auto"
                      >
                        <TrashIcon className="w-4 h-4 sm:hidden" />
                        <span className="sm:hidden">Eliminar</span>
                        <span className="hidden sm:inline">Eliminar</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Torneo"
        maxWidthClassName="max-w-md"
        actions={
          <>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={handleCreate}>
              Guardar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <input
              type="text"
              placeholder="Nombre"
              value={newTournament.name}
              onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))}
              className="input-base"
            />
          </Field>
          <Field label="Fecha de inicio">
            <input
              type="date"
              value={newTournament.startdate}
              onChange={(e) => setNewTournament((p) => ({ ...p, startdate: e.target.value }))}
              className="input-base"
            />
          </Field>
          <Field label="Descripción">
            <textarea
              placeholder="Descripción"
              value={newTournament.description}
              onChange={(e) => setNewTournament((p) => ({ ...p, description: e.target.value }))}
              className="textarea-base"
            />
          </Field>
        </div>
      </ModalShell>

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
