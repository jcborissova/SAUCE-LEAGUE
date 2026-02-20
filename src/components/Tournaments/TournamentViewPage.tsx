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
import TournamentAnalyticsHub from "./TournamentAnalyticsHub";
import TournamentPlayoffOverview from "./TournamentPlayoffOverview";
import TournamentPlayersGallery from "./TournamentPlayersGallery";

type Team = {
  id: number;
  name: string;
  players: Player[];
};

type MainTabKey = "matches" | "standings" | "stats" | "players";
type MatchesSubtab = "schedule" | "results";
type StatsSubtab = "analytics" | "playoffs";

const MAIN_TABS: Array<{ key: MainTabKey; label: string }> = [
  { key: "matches", label: "Partidos" },
  { key: "standings", label: "Posiciones" },
  { key: "stats", label: "Estadísticas" },
  { key: "players", label: "Jugadores" },
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

      const { data, error } = await supabase
        .from("tournaments")
        .select("name")
        .eq("id", tournamentId)
        .single();

      if (!error && data?.name) {
        setTournamentName(data.name);
      } else {
        setTournamentName("Sauce League");
      }

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
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="app-card p-6 text-center">
          <p className="text-sm text-[hsl(var(--text-subtle))]">No se encontró el torneo solicitado.</p>
          <Link to="/tournaments" className="btn-secondary mt-4">
            Volver a torneos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4 space-y-4">
      <section className="border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))]">
        <div className="border-b bg-[hsl(var(--primary))] px-4 py-3 text-[hsl(var(--text-inverse))] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--text-inverse)/0.78)]">Torneo</p>
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                {tournamentLoading ? "Cargando torneo..." : tournamentName}
              </h1>
            </div>
            <Link
              to="/tournaments"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-white/36 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-[var(--motion-hover)] hover:bg-white/18"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Volver
            </Link>
          </div>
        </div>

        <div className="border-b bg-[hsl(var(--surface-1))]">
          <div className="soft-scrollbar overflow-x-auto">
            <nav className="flex min-w-max items-center px-2 sm:px-3">
              {MAIN_TABS.map((tab) => {
                const active = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative px-3 py-3 text-sm font-semibold sm:px-5 ${
                      active
                        ? "text-[hsl(var(--primary))]"
                        : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`absolute inset-x-2 bottom-0 h-0.5 transition-all duration-[var(--motion-tab)] ${
                        active ? "bg-[hsl(var(--primary))] opacity-100" : "bg-[hsl(var(--primary)/0.4)] opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </section>

      <section className="space-y-4 p-1 sm:p-2 md:p-3">
        {activeTab === "matches" ? (
          <div className="space-y-4">
            <div className="border-b border-[hsl(var(--border))]">
              <button
                type="button"
                onClick={() => setMatchesSubtab("schedule")}
                className={`relative px-3 py-2.5 text-sm font-semibold transition-colors duration-[var(--motion-tab)] ${
                  matchesSubtab === "schedule"
                    ? "text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Calendario
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 transition-all duration-[var(--motion-tab)] ${
                    matchesSubtab === "schedule" ? "bg-[hsl(var(--primary))] opacity-100" : "opacity-0"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setMatchesSubtab("results")}
                className={`relative px-3 py-2.5 text-sm font-semibold transition-colors duration-[var(--motion-tab)] ${
                  matchesSubtab === "results"
                    ? "text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Resultados
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 transition-all duration-[var(--motion-tab)] ${
                    matchesSubtab === "results" ? "bg-[hsl(var(--primary))] opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            </div>

            {matchesSubtab === "schedule" ? (
              <TournamentScheduleView tournamentId={tournamentId} embedded />
            ) : (
              <TournamentResultsView tournamentId={tournamentId} embedded />
            )}
          </div>
        ) : null}

        {activeTab === "standings" ? <TournamentStandings tournamentId={tournamentId} embedded /> : null}

        {activeTab === "stats" ? (
          <div className="space-y-4">
            <div className="border-b border-[hsl(var(--border))]">
              <button
                type="button"
                onClick={() => setStatsSubtab("analytics")}
                className={`relative px-3 py-2.5 text-sm font-semibold transition-colors duration-[var(--motion-tab)] ${
                  statsSubtab === "analytics"
                    ? "text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Analíticas
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 transition-all duration-[var(--motion-tab)] ${
                    statsSubtab === "analytics" ? "bg-[hsl(var(--primary))] opacity-100" : "opacity-0"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setStatsSubtab("playoffs")}
                className={`relative px-3 py-2.5 text-sm font-semibold transition-colors duration-[var(--motion-tab)] ${
                  statsSubtab === "playoffs"
                    ? "text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Playoffs
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 transition-all duration-[var(--motion-tab)] ${
                    statsSubtab === "playoffs" ? "bg-[hsl(var(--primary))] opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            </div>

            {statsSubtab === "analytics" ? (
              <TournamentAnalyticsHub tournamentId={tournamentId} embedded />
            ) : (
              <TournamentPlayoffOverview tournamentId={tournamentId} embedded />
            )}
          </div>
        ) : null}

        {activeTab === "players" ? (
          <div className="space-y-4">
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
