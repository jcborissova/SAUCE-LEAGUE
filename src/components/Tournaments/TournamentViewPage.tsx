/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Player } from "../../types/player";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link, useParams } from "react-router-dom";

import TournamentScheduleView from "./TournamentScheduleView";
import TournamentStandings from "./TournamentStandings";
import TournamentResultsView from "./TournamentResultsView";
import TournamentPlayoffOverview from "./TournamentPlayoffOverview";
import TournamentPlayersGallery from "./TournamentPlayersGallery";
import TournamentStatsOverview from "./TournamentStatsOverview";

import SegmentedControl from "../ui/SegmentedControl";
import EmptyState from "../ui/EmptyState";

type Team = {
  id: number;
  name: string;
  players: Player[];
};

type MainTabKey = "matches" | "standings" | "stats" | "players";
type MatchesSubtab = "schedule" | "results";
type StatsSubtab = "analytics" | "playoffs" | "duel";

const MAIN_TABS: Array<{ key: MainTabKey; label: string }> = [
  { key: "matches", label: "Partidos" },
  { key: "standings", label: "Posiciones" },
  { key: "stats", label: "Estadísticas" },
  { key: "players", label: "Equipos" },
];

const TournamentViewPage: React.FC = () => {
  const { id: tournamentId } = useParams();
  const [activeTab, setActiveTab] = useState<MainTabKey>("matches");
  const [matchesSubtab, setMatchesSubtab] = useState<MatchesSubtab>("schedule");
  const [statsSubtab, setStatsSubtab] = useState<StatsSubtab>("analytics");

  const [tournamentName, setTournamentName] = useState("Sauce League");
  const [tournamentLoading, setTournamentLoading] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;

    const loadTournament = async () => {
      setTournamentLoading(true);

      const { data, error } = await supabase.from("tournaments").select("name").eq("id", tournamentId).single();
      if (!error && data?.name) setTournamentName(data.name);
      else setTournamentName("Sauce League");

      setTournamentLoading(false);
    };

    loadTournament();
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId || activeTab !== "players" || teamsLoaded) return;

    const fetchTeamsAndPlayers = async () => {
      setTeamsLoading(true);
      try {
        const { data: playersData, error: playersError } = await supabase.from("players").select("*");
        if (playersError) throw playersError;

        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("id, name, team_players(player_id)")
          .eq("tournament_id", tournamentId);

        if (teamsError) throw teamsError;

        const formattedTeams = (teamsData || []).map((team) => {
          const playerIds = team.team_players ? team.team_players.map((tp: any) => tp.player_id) : [];
          const teamPlayers = playersData?.filter((player) => playerIds.includes(player.id)) || [];

          return {
            id: team.id,
            name: team.name,
            players: teamPlayers,
          };
        });

        setTeams(formattedTeams);
        setTeamsLoaded(true);
      } catch (error) {
        console.error("Error al cargar jugadores del torneo", error);
      } finally {
        setTeamsLoading(false);
      }
    };

    fetchTeamsAndPlayers();
  }, [activeTab, teamsLoaded, tournamentId]);

  const totalPlayers = useMemo(() => teams.reduce((acc, team) => acc + team.players.length, 0), [teams]);

  if (!tournamentId) {
    return (
      <div className="w-full py-2">
        <EmptyState
          title="No se encontró el torneo solicitado"
          description="Revisa el enlace o vuelve al listado de torneos."
          action={
            <Link to="/tournaments" className="btn-secondary">
              Volver a torneos
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <header className="w-full py-1">
        <div className="overflow-hidden border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] shadow-[0_1px_0_hsl(var(--border)/0.35)]">
          <div className="relative border-b border-white/12 bg-[linear-gradient(118deg,hsl(var(--primary)/0.94),hsl(var(--primary)/0.76))] text-[hsl(var(--primary-foreground))]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_14%,hsl(var(--text-inverse)/0.2),transparent_38%),radial-gradient(circle_at_88%_82%,hsl(var(--text-inverse)/0.12),transparent_30%)]" />
            <div className="relative flex w-full flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/72">Torneo</p>
                <h1 className="truncate text-2xl font-bold sm:text-3xl">
                  {tournamentLoading ? "Cargando torneo..." : tournamentName}
                </h1>
              </div>

              <Link
                to="/tournaments"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-4 text-sm font-semibold text-white transition-colors duration-[var(--motion-hover)] hover:bg-white/18"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver
              </Link>
            </div>
          </div>

          <nav className="grid w-full grid-cols-4 border-t border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))]" aria-label="Secciones de torneo">
            {MAIN_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative min-h-[48px] px-2 text-[13px] font-semibold transition-colors duration-[var(--motion-tab)] sm:text-sm ${
                    active
                      ? "bg-[hsl(var(--primary)/0.09)] text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--surface-2)/0.75)] hover:text-[hsl(var(--foreground))]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={`pointer-events-none absolute inset-x-2 bottom-0 h-0.5 transition-colors duration-[var(--motion-tab)] ${
                      active ? "bg-[hsl(var(--primary))]" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <section className="w-full space-y-4 pb-2">
        {activeTab === "matches" ? (
          <div className="space-y-3">
            <SegmentedControl
              options={[
                { value: "schedule", label: "Calendario" },
                { value: "results", label: "Resultados" },
              ]}
              value={matchesSubtab}
              onChange={(value) => setMatchesSubtab(value as MatchesSubtab)}
            />
            {matchesSubtab === "schedule" ? (
              <TournamentScheduleView tournamentId={tournamentId} embedded />
            ) : (
              <TournamentResultsView tournamentId={tournamentId} embedded />
            )}
          </div>
        ) : null}

        {activeTab === "standings" ? <TournamentStandings tournamentId={tournamentId} embedded /> : null}

        {activeTab === "stats" ? (
          <div className="space-y-3">
            <SegmentedControl
              options={[
                { value: "analytics", label: "Analíticas" },
                { value: "playoffs", label: "Playoffs" },
                { value: "duel", label: "Duelo" },
              ]}
              value={statsSubtab}
              onChange={(value) => setStatsSubtab(value as StatsSubtab)}
            />

            {statsSubtab === "analytics" ? <TournamentStatsOverview tournamentId={tournamentId} embedded /> : null}
            {statsSubtab === "playoffs" ? <TournamentPlayoffOverview tournamentId={tournamentId} embedded /> : null}
            {statsSubtab === "duel" ? <TournamentStatsOverview tournamentId={tournamentId} embedded mode="duel" /> : null}
          </div>
        ) : null}

        {activeTab === "players" ? (
          <div className="space-y-3">
            {teamsLoading && !teamsLoaded ? (
              <div className="flex justify-center py-24">
                <ArrowPathIcon className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
              </div>
            ) : (
              <TournamentPlayersGallery teams={teams} loading={teamsLoading} />
            )}

            {teamsLoaded ? (
              <p className="text-xs text-[hsl(var(--text-subtle))]">
                {teams.length} equipos vinculados, {totalPlayers} jugadores detectados.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default TournamentViewPage;
