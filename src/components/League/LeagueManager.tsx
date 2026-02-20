/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "react-toastify";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabase";
import type { Player } from "../../types/player";
import GuestInput from "./GuestInput";
import PlayerCard from "./PlayerCard";
import GameModal from "./GameModal";
import TeamList from "./TeamList";
import SortableLeagueBoard from "./LeagueBoard";

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
      arrival_time: new Date().toISOString(),  // <-- agregar aquí
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

    // Si el usuario configuró manualmente los quintetos iniciales, respetarlos
    if (selectedA.length === 5 && selectedB.length === 5) {
      teamA = selectedA
        .map((id) => availableTen.find((p) => p.id === id))
        .filter(Boolean) as LeaguePlayer[];
      teamB = selectedB
        .map((id) => availableTen.find((p) => p.id === id))
        .filter(Boolean) as LeaguePlayer[];
    }

    // Si falta alguien (por selección incompleta), aplicar balance alternado
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

    // Regla: dos victorias seguidas y hay 10 en cola -> refresco completo
    if (newStreak.wins >= 2 && waiting.length >= 10) {
      const incoming = waiting.slice(0, 10);
      nextA = incoming.slice(0, 5);
      nextB = incoming.slice(5, 10);
      updatedWaiting = [...waiting.slice(10), ...teamA, ...teamB]; // los que estaban juegan pasan al final
      setWinnerStreak(null);
      toast.info("Racha de 2: rotación completa, entran 10 nuevos.");
    } else {
      // Caso normal: ganador permanece; perdedor sale
      const entrants = waiting.slice(0, 5);
      const faltantes = 5 - entrants.length;
      const completar = loser.slice(0, faltantes); // si faltan, se completan con perdedores

      if (winnerTeam === "A") {
        nextA = teamA;
        nextB = [...entrants, ...completar];
      } else {
        nextB = teamB;
        nextA = [...entrants, ...completar];
      }

      // Actualizar cola: quitar los que entraron; los perdedores van al final
      updatedWaiting = [...waiting.slice(entrants.length), ...loser];
      setWinnerStreak(newStreak);
    }

    await supabase.from("active_players").delete().eq("league_id", leagueId);
    await supabase.from("active_players").insert([
      ...nextA.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "A", position: i })),
      ...nextB.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "B", position: i })),
    ]);

    // Persistir nuevo orden de espera (order_number) según lista actualizada
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
        const timeDiff =
          new Date(a.arrival_time || 0).getTime() - new Date(b.arrival_time || 0).getTime();
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
    <div className="space-y-8 pb-20">
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold">Agregar invitados</h3>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Doble clic para añadir rápido</span>
        </div>
        <GuestInput onAddGuest={handleAddGuest} />
      </section>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          {available.length > 0 && (
            <section className="card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Jugadores disponibles</h3>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Arrastra o doble clic para sumar</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[320px] overflow-y-auto no-scrollbar">
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
            </section>
          )}

          <section className="card p-4 sm:p-5">
            <SortableLeagueBoard players={players} onRemove={handleRemovePlayer} />
          </section>
        </DndContext>
      )}

      {activePlayers.length === 10 && (
        <section className="card p-4 sm:p-5">
          <TeamList players={[...activeTeamA, ...activeTeamB]} title="Jugadores del partido" teamMode />
        </section>
      )}

      {players.length >= 10 && (
        <section className="text-center">
          <button
            onClick={generateMatch}
            className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-6 py-3 rounded-xl text-sm font-semibold shadow hover:opacity-90 transition"
          >
            Iniciar Partido
          </button>
          <div className="mt-3 flex justify-center">
            <button
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
              onClick={() => setSelectionOpen(true)}
            >
              Ajustar quintetos iniciales
            </button>
          </div>
        </section>
      )}

      {waitingList.length > 0 && (
        <section className="card p-4 sm:p-5">
          <TeamList players={waitingList} title="Jugadores en espera" />
        </section>
      )}

      {showModal && (
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
      )}

      {selectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-4xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold">Configurar quintetos iniciales</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Elige 5 para Equipo A y 5 para Equipo B. Los demás quedan en la cola según llegada.
                </p>
              </div>
              <button
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-2xl font-bold"
                onClick={() => setSelectionOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <h4 className="font-semibold mb-2">Primeros 10 por llegada</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {orderedPlayers.slice(0, 10).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b pb-1">
                      <div>
                        <p className="font-semibold leading-tight">{p.names} {p.lastnames}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          Llegada: {new Date(p.arrival_time || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className={`px-2 py-1 rounded text-xs border ${
                            selectedA.includes(p.id) ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "hover:bg-[hsl(var(--muted))]"
                          }`}
                          onClick={() => toggleSelection("A", p.id)}
                          disabled={selectedA.length >= 5 && !selectedA.includes(p.id)}
                        >
                          A
                        </button>
                        <button
                          className={`px-2 py-1 rounded text-xs border ${
                            selectedB.includes(p.id)
                              ? "bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]"
                              : "hover:bg-[hsl(var(--muted))]"
                          }`}
                          onClick={() => toggleSelection("B", p.id)}
                          disabled={selectedB.length >= 5 && !selectedB.includes(p.id)}
                        >
                          B
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Equipo A</h4>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{selectedA.length}/5</span>
                </div>
                <div className="space-y-2">
                  {selectedA.map((id) => {
                    const p = orderedPlayers.find((pl) => pl.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="text-sm flex items-center justify-between">
                        <span>{p.names} {p.lastnames}</span>
                        <button
                          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-destructive"
                          onClick={() => toggleSelection("A", id)}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Equipo B</h4>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{selectedB.length}/5</span>
                </div>
                <div className="space-y-2">
                  {selectedB.map((id) => {
                    const p = orderedPlayers.find((pl) => pl.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="text-sm flex items-center justify-between">
                        <span>{p.names} {p.lastnames}</span>
                        <button
                          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-destructive"
                          onClick={() => toggleSelection("B", id)}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border text-sm hover:bg-[hsl(var(--muted))]"
                onClick={() => {
                  setSelectedA([]);
                  setSelectedB([]);
                }}
              >
                Limpiar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold disabled:opacity-60"
                disabled={selectedA.length !== 5 || selectedB.length !== 5}
                onClick={() => {
                  setSelectionOpen(false);
                  generateMatch();
                }}
              >
                Usar estos quintetos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueManager;
