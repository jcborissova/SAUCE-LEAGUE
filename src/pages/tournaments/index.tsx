/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import { ArrowPathIcon, EyeIcon, Cog6ToothIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

import ConfirmModal from "../../components/ConfirmModal";
import TournamentConfigPage from "../../components/Tournaments/TournamentConfigPage";
import ModalShell from "../../components/ui/ModalShell";
import Field from "../../components/ui/Field";
import PageShell from "../../components/ui/PageShell";
import SectionCard from "../../components/ui/SectionCard";
import EmptyState from "../../components/ui/EmptyState";
import StatPill from "../../components/ui/StatPill";
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
  const [newTournament, setNewTournament] = useState({ name: "", startdate: "", description: "" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [tournamentToConfigure, setTournamentToConfigure] = useState<string | null>(null);
  const { role } = useRole();

  useEffect(() => {
    if (role !== null) fetchTournaments();
  }, [role]);

  const fetchTournaments = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
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
      const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
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

  if (role === null) return null;

  return (
    <PageShell
      title="Torneos"
      subtitle="Configura equipos, calendario, resultados y analíticas de cada temporada."
      badge="Season Hub"
      actions={
        role === "admin" ? (
          <button className="btn-primary w-full sm:w-auto" onClick={() => setShowModal(true)}>
            Crear torneo
          </button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Activos" value={tournaments.length} />
      </div>

      <SectionCard>
        {loading ? (
          <div className="flex justify-center py-10">
            <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState title="No hay torneos creados" description="Crea el primer torneo para cargar equipos, calendario y resultados." />
        ) : (
          <ul className="space-y-2">
            {tournaments.map((t) => (
              <li key={t.id} className="border bg-[hsl(var(--surface-1))] px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{t.name}</h3>
                    <p className="text-xs text-[hsl(var(--text-subtle))]">Inicio: {t.startdate || "--"}</p>
                    {t.description ? <p className="text-sm text-[hsl(var(--text-subtle))]">{t.description}</p> : null}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                    <Link to={`/tournaments/view/${t.id}`} className="btn-secondary w-full sm:w-auto">
                      <EyeIcon className="h-4 w-4" />
                      Ver
                    </Link>
                    {role === "admin" ? (
                      <>
                        <button onClick={() => setTournamentToConfigure(t.id)} className="btn-primary w-full sm:w-auto">
                          <Cog6ToothIcon className="h-4 w-4" />
                          Configurar
                        </button>
                        <button
                          onClick={() => {
                            setTournamentToDelete(t);
                            setShowConfirm(true);
                          }}
                          className="btn-danger w-full sm:w-auto"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Eliminar
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Torneo"
        maxWidthClassName="sm:max-w-md"
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

      {tournamentToConfigure ? (
        <TournamentConfigPage
          isOpen={!!tournamentToConfigure}
          onClose={() => setTournamentToConfigure(null)}
          tournamentId={tournamentToConfigure}
        />
      ) : null}
    </PageShell>
  );
};

export default TournamentsPage;
