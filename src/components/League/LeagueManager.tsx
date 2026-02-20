/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

import { supabase } from "../../lib/supabase";
import type { Player } from "../../types/player";
import GuestInput from "./GuestInput";
import PlayerCard from "./PlayerCard";
import GameModal from "./GameModal";
import TeamList from "./TeamList";
import SortableLeagueBoard from "./LeagueBoard";
import ModalShell from "../ui/ModalShell";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";

type LeaguePlayer = Player & {
  order_number: number;
  isGuest?: boolean;
  arrival_time?: string;
};

type ActivePlayer = {
  league_id: number;
  player_id: number;
  team: "A" | "B";
  position: number;
  player: LeaguePlayer;
};

type Props = {
  leagueId: number;
};

const LeagueManager: React.FC<Props> = ({ leagueId }) => {
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [available, setAvailable] = useState<LeaguePlayer[]>([]);
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [winnerStreak, setWinnerStreak] = useState<{ ids: number[]; wins: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectedA, setSelectedA] = useState<number[]>([]);
  const [selectedB, setSelectedB] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: leagueData } = await supabase
      .from("league_players")
      .select("player_id, order_number, players(*)")
      .eq("league_id", leagueId)
      .order("order_number");

    const { data: allPlayers } = await supabase.from("players").select("*");

    const leaguePlayers: LeaguePlayer[] = (leagueData || []).map((item: any) => ({
      ...item.players,
      isGuest: item.players.is_guest,
      order_number: item.order_number ?? 9999,
      arrival_time: item.arrival_time,
    }));

    setPlayers(leaguePlayers);

    const leagueIds = leaguePlayers.map((p) => p.id);
    const notInLeague = (allPlayers || []).filter((p: any) => !leagueIds.includes(p.id));
    setAvailable(notInLeague);

    const { data: activeData } = await supabase
      .from("active_players")
      .select("*, player:players(*)")
      .eq("league_id", leagueId)
      .order("position");

    setActivePlayers(activeData || []);
    setLoading(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || over.id !== "league-dropzone") return;

    const player = available.find((p) => p.id.toString() === active.id);
    if (!player || players.some((p) => p.id === player.id)) return;

    const maxOrder = players.reduce((max, p) => Math.max(max, p.order_number), 0);

    await supabase.from("league_players").insert({
      league_id: leagueId,
      player_id: player.id,
      is_guest: false,
      order_number: maxOrder + 1,
      arrival_time: new Date().toISOString(),
    });

    toast.success("Jugador agregado");
    loadData();
  };

  const handleAddGuest = async (guest: Player) => {
    const { data: insertedPlayer } = await supabase
      .from("players")
      .insert({
        names: guest.names,
        lastnames: guest.lastnames || "",
        backjerseyname: guest.backjerseyname || guest.names,
        jerseynumber: 0,
        cedula: null,
        description: "Invitado",
        photo: null,
        is_guest: true,
      })
      .select()
      .single();

    const maxOrder = players.reduce((max, p) => Math.max(max, p.order_number), 0);

    await supabase.from("league_players").insert({
      league_id: leagueId,
      player_id: insertedPlayer.id,
      is_guest: true,
      order_number: maxOrder + 1,
      arrival_time: new Date().toISOString(),
    });

    toast.success("Invitado agregado");
    loadData();
  };

  const handleRemovePlayer = async (id: number) => {
    await supabase.from("league_players").delete().match({ league_id: leagueId, player_id: id });
    toast.success("Jugador eliminado");
    loadData();
  };

  const generateMatch = async () => {
    const ordered = [...players].sort((a, b) => a.order_number - b.order_number);
    const availableTen = ordered.slice(0, 10);

    if (availableTen.length < 10) {
      toast.warning("Se necesitan al menos 10 jugadores para iniciar.");
      return;
    }

    let teamA: LeaguePlayer[] = [];
    let teamB: LeaguePlayer[] = [];

    if (selectedA.length === 5 && selectedB.length === 5) {
      teamA = selectedA.map((id) => availableTen.find((p) => p.id === id)).filter(Boolean) as LeaguePlayer[];
      teamB = selectedB.map((id) => availableTen.find((p) => p.id === id)).filter(Boolean) as LeaguePlayer[];
    }

    if (teamA.length !== 5 || teamB.length !== 5) {
      teamA = [];
      teamB = [];
      availableTen.forEach((p, idx) => {
        if (idx % 2 === 0) teamA.push(p);
        else teamB.push(p);
      });
    }

    await supabase.from("active_players").delete().eq("league_id", leagueId);
    await supabase.from("active_players").insert([
      ...teamA.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "A", position: i })),
      ...teamB.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "B", position: i })),
    ]);

    setSelectedA([]);
    setSelectedB([]);
    setSelectionOpen(false);
    loadData();
    setShowModal(true);
  };

  const handleGameEnd = async (winnerTeam: "A" | "B") => {
    const teamA = activePlayers.filter((p) => p.team === "A").map((p) => p.player);
    const teamB = activePlayers.filter((p) => p.team === "B").map((p) => p.player);
    const winner = winnerTeam === "A" ? teamA : teamB;
    const loser = winnerTeam === "A" ? teamB : teamA;

    const sameStreak = winnerStreak && winner.every((p) => winnerStreak.ids.includes(p.id));
    const newStreak = sameStreak
      ? { ids: winner.map((p) => p.id), wins: winnerStreak.wins + 1 }
      : { ids: winner.map((p) => p.id), wins: 1 };

    const queue = orderedPlayers;
    const currentIds = [...teamA, ...teamB].map((p) => p.id);
    const waiting = queue.filter((p) => !currentIds.includes(p.id));

    let nextA: LeaguePlayer[] = [];
    let nextB: LeaguePlayer[] = [];
    let updatedWaiting: LeaguePlayer[] = waiting;

    if (newStreak.wins >= 2 && waiting.length >= 10) {
      const incoming = waiting.slice(0, 10);
      nextA = incoming.slice(0, 5);
      nextB = incoming.slice(5, 10);
      updatedWaiting = [...waiting.slice(10), ...teamA, ...teamB];
      setWinnerStreak(null);
      toast.info("Racha de 2: rotación completa, entran 10 nuevos.");
    } else {
      const entrants = waiting.slice(0, 5);
      const faltantes = 5 - entrants.length;
      const completar = loser.slice(0, faltantes);

      if (winnerTeam === "A") {
        nextA = teamA;
        nextB = [...entrants, ...completar];
      } else {
        nextB = teamB;
        nextA = [...entrants, ...completar];
      }

      updatedWaiting = [...waiting.slice(entrants.length), ...loser];
      setWinnerStreak(newStreak);
    }

    await supabase.from("active_players").delete().eq("league_id", leagueId);
    await supabase.from("active_players").insert([
      ...nextA.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "A", position: i })),
      ...nextB.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "B", position: i })),
    ]);

    await Promise.all(
      updatedWaiting.map((player, idx) =>
        supabase
          .from("league_players")
          .update({ order_number: idx + 1, arrival_time: player.arrival_time || new Date().toISOString() })
          .eq("league_id", leagueId)
          .eq("player_id", player.id)
      )
    );

    setShowModal(false);
    loadData();
  };

  const orderedPlayers = React.useMemo(
    () =>
      [...players].sort((a, b) => {
        const timeDiff = new Date(a.arrival_time || 0).getTime() - new Date(b.arrival_time || 0).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.order_number - b.order_number;
      }),
    [players]
  );

  const activeTeamA = activePlayers.filter((p) => p.team === "A").map((p) => p.player);
  const activeTeamB = activePlayers.filter((p) => p.team === "B").map((p) => p.player);
  const waitingList = orderedPlayers.filter((p) => !activePlayers.some((ap) => ap.player_id === p.id));

  const toggleSelection = (team: "A" | "B", playerId: number) => {
    if (team === "A") {
      if (selectedA.includes(playerId)) setSelectedA((prev) => prev.filter((id) => id !== playerId));
      else if (selectedA.length < 5) {
        setSelectedA((prev) => [...prev, playerId]);
        setSelectedB((prev) => prev.filter((id) => id !== playerId));
      }
    } else {
      if (selectedB.includes(playerId)) setSelectedB((prev) => prev.filter((id) => id !== playerId));
      else if (selectedB.length < 5) {
        setSelectedB((prev) => [...prev, playerId]);
        setSelectedA((prev) => prev.filter((id) => id !== playerId));
      }
    }
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      <SectionCard title="Guest + Available Pool" description="Agrega invitados y arma la cola activa con drag & drop.">
        <div className="space-y-3">
          <GuestInput onAddGuest={handleAddGuest} />

          {loading ? (
            <div className="flex justify-center py-10">
              <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
            </div>
          ) : (
            <DndContext onDragEnd={handleDragEnd}>
              {available.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Jugadores disponibles</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {available.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        onDoubleClick={() =>
                          handleDragEnd({
                            active: { id: p.id.toString() } as any,
                            over: { id: "league-dropzone" } as any,
                          } as DragEndEvent)
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="No hay jugadores disponibles" description="Todos los jugadores están asignados a la cola activa." />
              )}

              <div className="mt-3">
                <SortableLeagueBoard players={players} onRemove={handleRemovePlayer} />
              </div>
            </DndContext>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Match Controls" description="Inicia partido y configura quintetos iniciales cuando sea necesario.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button onClick={generateMatch} disabled={players.length < 10} className="btn-primary w-full sm:w-auto disabled:opacity-50">
            Iniciar partido
          </button>
          <button onClick={() => setSelectionOpen(true)} disabled={players.length < 10} className="btn-secondary w-full sm:w-auto disabled:opacity-50">
            Ajustar quintetos iniciales
          </button>
        </div>
      </SectionCard>

      {activePlayers.length === 10 ? (
        <SectionCard title="Playing now" description="Quintetos actualmente en cancha.">
          <TeamList players={[...activeTeamA, ...activeTeamB]} teamMode />
        </SectionCard>
      ) : null}

      {waitingList.length > 0 ? (
        <SectionCard title="Next up / Waiting" description="Orden de espera según llegada y rotación.">
          <TeamList players={waitingList} />
        </SectionCard>
      ) : null}

      {showModal ? (
        <GameModal
          teamA={activeTeamA}
          teamB={activeTeamB}
          onClose={() => setShowModal(false)}
          onFinish={(winnerTeam) => {
            if (winnerTeam === "DRAW") {
              toast.info("Empate, no hay cambios en la rotación");
              setShowModal(false);
            } else {
              handleGameEnd(winnerTeam);
            }
          }}
        />
      ) : null}

      <ModalShell
        isOpen={selectionOpen}
        onClose={() => setSelectionOpen(false)}
        title="Configurar quintetos iniciales"
        subtitle="Elige 5 para Equipo A y 5 para Equipo B."
        maxWidthClassName="sm:max-w-5xl"
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedA([]);
                setSelectedB([]);
              }}
            >
              Limpiar
            </button>
            <button
              className="btn-primary disabled:opacity-60"
              disabled={selectedA.length !== 5 || selectedB.length !== 5}
              onClick={() => {
                setSelectionOpen(false);
                generateMatch();
              }}
            >
              Usar quintetos
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
          <section className="border p-3">
            <h4 className="mb-2 text-sm font-semibold">Primeros 10 por llegada</h4>
            <div className="space-y-2">
              {orderedPlayers.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border bg-[hsl(var(--surface-1))] px-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {p.names} {p.lastnames}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Llegada: {new Date(p.arrival_time || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleSelection("A", p.id)}
                      className={`h-8 w-10 border text-xs font-semibold ${
                        selectedA.includes(p.id) ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : ""
                      }`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSelection("B", p.id)}
                      className={`h-8 w-10 border text-xs font-semibold ${
                        selectedB.includes(p.id) ? "bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]" : ""
                      }`}
                    >
                      B
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Equipo A</h4>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{selectedA.length}/5</span>
            </div>
            <div className="space-y-2 text-sm">
              {selectedA.map((id) => {
                const p = orderedPlayers.find((pl) => pl.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center justify-between border bg-[hsl(var(--surface-1))] px-2 py-2">
                    <span className="truncate">
                      {p.names} {p.lastnames}
                    </span>
                    <button className="text-xs text-[hsl(var(--muted-foreground))]" onClick={() => toggleSelection("A", id)}>
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Equipo B</h4>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{selectedB.length}/5</span>
            </div>
            <div className="space-y-2 text-sm">
              {selectedB.map((id) => {
                const p = orderedPlayers.find((pl) => pl.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center justify-between border bg-[hsl(var(--surface-1))] px-2 py-2">
                    <span className="truncate">
                      {p.names} {p.lastnames}
                    </span>
                    <button className="text-xs text-[hsl(var(--muted-foreground))]" onClick={() => toggleSelection("B", id)}>
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </ModalShell>
    </div>
  );
};

export default LeagueManager;
