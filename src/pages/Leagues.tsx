/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import LeagueManager from "../components/League/LeagueManager";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import ConfirmModal from "../components/ConfirmModal";
import LeagueItem from "../components/League/LeagueItem";
import ModalShell from "../components/ui/ModalShell";
import PageHeader from "../components/ui/PageHeader";
import Field from "../components/ui/Field";


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
    const { data, error } = await supabase
      .from("leagues")
      .select("*")
      .order("created_at", { ascending: false });
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
  
      // 1. Elimina jugadores activos de la liga
      const { error: activePlayersError } = await supabase
        .from("active_players")
        .delete()
        .eq("league_id", leagueId);
      if (activePlayersError) throw activePlayersError;
  
      // 2. Elimina el partido actual de esa liga
      const { error: matchError } = await supabase
        .from("current_match")
        .delete()
        .eq("league_id", leagueId);
      if (matchError) throw matchError;
  
      // 3. Ahora sí, elimina la liga
      const { error: leagueError } = await supabase
        .from("leagues")
        .delete()
        .eq("id", leagueId);
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
  

  if (selectedLeague)
    return (
      <div className="mx-auto px-3 py-4 sm:px-4 sm:py-6 space-y-4">
        <button
          onClick={() => setSelectedLeague(null)}
          className="btn-secondary w-full sm:w-auto"
        >
          <span className="text-lg leading-none">←</span>
          Volver a lista de ligas
        </button>
        <div className="app-card rounded-2xl p-4 sm:p-5 space-y-2">
          <h2 className="text-3xl font-bold">{selectedLeague.name}</h2>
          <p className="text-[hsl(var(--muted-foreground))]">{selectedLeague.description}</p>
        </div>
        <div className="card p-4 sm:p-6">
          <LeagueManager leagueId={selectedLeague.id} />
        </div>
      </div>
    );

  return (
    <div className="mx-auto px-3 py-4 sm:px-4 sm:py-6 space-y-5">
      <PageHeader
        title="Ligas"
        subtitle="Crea y administra las ligas activas."
        badge="Competencia"
        actions={
          <button className="btn-primary w-full sm:w-auto" onClick={() => setShowModal(true)}>
            Crear liga
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : (
        <ul className="space-y-3">
          {leagues.length === 0 ? (
            <li className="app-card p-6 text-center text-sm text-[hsl(var(--text-subtle))]">
              Todavía no hay ligas registradas.
            </li>
          ) : null}
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

      <ModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva Liga"
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
    </div>
  );
};

export default LeaguesPage;
