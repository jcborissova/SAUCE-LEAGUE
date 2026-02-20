/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import { ArrowPathIcon } from "@heroicons/react/16/solid";

import LeagueManager from "../components/League/LeagueManager";
import ConfirmModal from "../components/ConfirmModal";
import LeagueItem from "../components/League/LeagueItem";
import ModalShell from "../components/ui/ModalShell";
import Field from "../components/ui/Field";
import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import EmptyState from "../components/ui/EmptyState";

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [leagueToDelete, setLeagueToDelete] = useState<League | null>(null);

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

  const handleDeleteLeague = async (leagueId: number) => {
    try {
      setLoading(true);

      const { error: activePlayersError } = await supabase.from("active_players").delete().eq("league_id", leagueId);
      if (activePlayersError) throw activePlayersError;

      const { error: matchError } = await supabase.from("current_match").delete().eq("league_id", leagueId);
      if (matchError) throw matchError;

      const { error: leagueError } = await supabase.from("leagues").delete().eq("id", leagueId);
      if (leagueError) throw leagueError;

      toast.success("Liga eliminada");
      fetchLeagues();
    } catch (err: any) {
      console.error(err);
      if (err.code === "23503") {
        toast.error("No se puede eliminar la liga porque tiene referencias activas.");
      } else {
        toast.error("Error al eliminar liga");
      }
    } finally {
      setLoading(false);
    }
  };

  if (selectedLeague) {
    return (
      <PageShell
        title={selectedLeague.name}
        subtitle={selectedLeague.description || "Liga activa"}
        badge="League Manager"
        actions={
          <button onClick={() => setSelectedLeague(null)} className="btn-secondary w-full sm:w-auto">
            Volver a ligas
          </button>
        }
      >
        <LeagueManager leagueId={selectedLeague.id} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Ligas"
      subtitle="Crea y administra ligas activas sin perder fluidez en móvil."
      badge="Competencia"
      actions={
        <button className="btn-primary w-full sm:w-auto" onClick={() => setShowModal(true)}>
          Crear liga
        </button>
      }
    >
      <SectionCard>
        {loading ? (
          <div className="flex justify-center py-10">
            <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
          </div>
        ) : leagues.length === 0 ? (
          <EmptyState title="Todavía no hay ligas registradas" description="Crea la primera liga para comenzar la gestión de equipos y rotaciones." />
        ) : (
          <ul className="space-y-2">
            {leagues.map((l) => (
              <LeagueItem
                key={l.id}
                league={l}
                onSelect={() => setSelectedLeague(l)}
                onDeleteRequest={() => {
                  setLeagueToDelete(l);
                  setShowConfirm(true);
                }}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <ModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva Liga"
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
        <Field label="Nombre">
          <input
            type="text"
            placeholder="Nombre"
            value={newLeague.name}
            onChange={(e) => setNewLeague((p) => ({ ...p, name: e.target.value }))}
            className="input-base"
          />
        </Field>
        <Field label="Descripción">
          <textarea
            placeholder="Descripción"
            value={newLeague.description}
            onChange={(e) => setNewLeague((p) => ({ ...p, description: e.target.value }))}
            className="textarea-base"
          />
        </Field>
      </ModalShell>

      <ConfirmModal
        isOpen={showConfirm}
        title="Eliminar Liga"
        message={`¿Estás seguro de eliminar la liga "${leagueToDelete?.name}"? Esta acción eliminará todos sus resultados.`}
        onCancel={() => {
          setShowConfirm(false);
          setLeagueToDelete(null);
        }}
        onConfirm={async () => {
          if (!leagueToDelete) return;
          await handleDeleteLeague(leagueToDelete.id);
          setShowConfirm(false);
          setLeagueToDelete(null);
        }}
      />
    </PageShell>
  );
};

export default LeaguesPage;
