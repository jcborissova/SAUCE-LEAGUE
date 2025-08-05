/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Player } from "../../types/player";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { Link, useParams } from "react-router-dom";
import TournamentScheduleView from "./TournamentScheduleView";
import TournamentStandings from "./TournamentStandings";
import TeamSection from "./TeamSection";
import TournamentResultsView from "./TournamentResultsView";
import TournamentLeaders from "./TournamentLeaders";
import { Listbox } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

const tabs = [
  { key: "info", label: "Equipos" },
  { key: "schedule", label: "Calendario" },
  { key: "standings", label: "Tabla" },
  { key: "results", label: "Resultados" },
  { key: "leaders", label: "Líderes" },
];

type Team = {
  id: number;
  name: string;
  players: Player[];
};

const TournamentViewPage: React.FC = () => {
  const { id: tournamentId } = useParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "info" | "schedule" | "standings" | "results" | "leaders"
  >("info");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select("*");
        if (playersError) throw playersError;

        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("id, name, team_players(player_id)")
          .eq("tournament_id", tournamentId);

        if (teamsError) throw teamsError;

        const formattedTeams = (teamsData || []).map((team) => {
          const playerIds = team.team_players
            ? team.team_players.map((tp: any) => tp.player_id)
            : [];
          const teamPlayers =
            playersData?.filter((p) => playerIds.includes(p.id)) || [];
          return {
            id: team.id,
            name: team.name,
            players: teamPlayers,
          };
        });

        setTeams(formattedTeams);
      } catch (error) {
        console.error("Error al cargar equipos", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tournamentId]);

  return (
    <div className="w-full max-w-screen-xl mx-auto px-4 py-6 md:py-10 space-y-10">
      {/* Encabezado */}
      <div className="flex flex-col items-center text-center space-y-4">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-wide text-blue-950">
          Vista del Torneo
        </h1>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl">
          Explora toda la información, los equipos, el calendario y la tabla de
          posiciones.
        </p>
        <Link
          to="/tournaments"
          className="inline-block bg-blue-950 text-white font-semibold py-2 px-6 rounded-full shadow hover:bg-blue-900 transition"
        >
          Volver a Torneos
        </Link>
      </div>

      {/* Tabs Scrollable en móvil */}
      <div className="w-full">
        {/* Mobile dropdown */}
        <div className="sm:hidden mb-4">
          <Listbox value={activeTab} onChange={(value) => setActiveTab(value)}>
            <div className="relative">
              <Listbox.Button className="w-full bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm">
                {tabs.find((t) => t.key === activeTab)?.label}
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
                {tabs.map((tab) => (
                  <Listbox.Option
                    key={tab.key}
                    value={tab.key}
                    className={({ active }) =>
                      `cursor-pointer select-none relative py-2 pl-10 pr-4 ${
                        active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                      }`
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                          {tab.label}
                        </span>
                        {selected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                            ●
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Desktop tabs */}
        <div className="hidden sm:flex justify-center gap-4 border-b pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-2 border-b-2 transition-all text-sm md:text-base ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-gray-600 hover:text-blue-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-24">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {activeTab === "info" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {teams.length === 0 ? (
                <p className="text-center text-gray-500 col-span-full">
                  No hay equipos configurados todavía.
                </p>
              ) : (
                teams.map((team) => (
                  <TeamSection
                    key={team.id}
                    teamName={team.name}
                    players={team.players}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="w-full px-2 sm:px-4">
              <TournamentScheduleView tournamentId={tournamentId || ""} />
            </div>
          )}

          {activeTab === "standings" && (
            <div className="w-full px-2 sm:px-4">
              <TournamentStandings tournamentId={tournamentId || ""} />
            </div>
          )}

          {activeTab === "results" && (
            <div className="w-full px-2 sm:px-4">
              <TournamentResultsView tournamentId={tournamentId || ""} />
            </div>
          )}

          {activeTab === "leaders" && (
            <div className="w-full px-2 sm:px-4">
              <TournamentLeaders tournamentId={tournamentId || ""} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TournamentViewPage;
