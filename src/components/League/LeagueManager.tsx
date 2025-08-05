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
    const teamA = ordered.slice(0, 5);
    const teamB = ordered.slice(5, 10);

    await supabase.from("active_players").delete().eq("league_id", leagueId);
    await supabase.from("active_players").insert([
      ...teamA.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "A", position: i })),
      ...teamB.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "B", position: i })),
    ]);

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

    const allCurrentIds = [...teamA, ...teamB].map((p) => p.id);
    const waiting = players.filter((p) => !allCurrentIds.includes(p.id)).sort((a, b) => a.order_number - b.order_number);

    let nextA: LeaguePlayer[] = [];
    let nextB: LeaguePlayer[] = [];

    if (newStreak.wins >= 2 && waiting.length >= 10) {
      nextA = waiting.slice(0, 5);
      nextB = waiting.slice(5, 10);
      setWinnerStreak(null);
    } else {
      const subir = waiting.slice(0, 5);
      const faltantes = 5 - subir.length;
      const completar = loser.slice(0, faltantes);

      if (winnerTeam === "A") {
        nextA = teamA;
        nextB = [...subir, ...completar];
      } else {
        nextB = teamB;
        nextA = [...subir, ...completar];
      }
      setWinnerStreak(newStreak);
    }

    await supabase.from("active_players").delete().eq("league_id", leagueId);
    await supabase.from("active_players").insert([
      ...nextA.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "A", position: i })),
      ...nextB.map((p, i) => ({ league_id: leagueId, player_id: p.id, team: "B", position: i })),
    ]);

    await supabase.from("matches").insert({
      league_id: leagueId,
      winner_team: winnerTeam,
    });

    setShowModal(false);
    loadData();
  };

  const orderedPlayers = [...players].sort((a, b) =>
    new Date(a.arrival_time || 0).getTime() - new Date(b.arrival_time || 0).getTime()
  );  
  const activeTeamA = activePlayers.filter((p) => p.team === "A").map((p) => p.player);
  const activeTeamB = activePlayers.filter((p) => p.team === "B").map((p) => p.player);
  const waitingList = orderedPlayers.filter((p) => !activePlayers.some((ap) => ap.player_id === p.id));

  return (
    <div className="space-y-8 pb-20">
      <section className="bg-white p-4 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-blue-950 mb-3">Agregar Invitados</h3>
        <GuestInput onAddGuest={handleAddGuest} />
      </section>

      {loading ? (
        <div className="flex justify-center py-10">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          {available.length > 0 && (
            <section className="bg-white p-4 rounded-xl shadow-md">
              <h3 className="text-lg font-semibold text-blue-950 mb-3">Jugadores disponibles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto">
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

          <section className="bg-white p-4 rounded-xl shadow-md">
            <SortableLeagueBoard players={players} onRemove={handleRemovePlayer} />
          </section>
        </DndContext>
      )}

      {activePlayers.length === 10 && (
        <section className="bg-white p-4 rounded-xl shadow-md">
          <TeamList players={[...activeTeamA, ...activeTeamB]} title="Jugadores del partido" teamMode />
        </section>
      )}

      {players.length >= 10 && (
        <section className="text-center">
          <button
            onClick={generateMatch}
            className="bg-blue-950 text-white px-6 py-2 rounded-xl text-sm hover:bg-blue-800 transition"
          >
            Iniciar Partido
          </button>
        </section>
      )}

      {waitingList.length > 0 && (
        <section className="bg-white p-4 rounded-xl shadow-md">
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
    </div>
  );
};

export default LeagueManager;
