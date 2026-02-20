/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import TournamentTeamsConfig from "./TournamentTeamsConfig";
import TournamentScheduleConfig from "./TournamentScheduleConfig";
import TournamentResultsConfig from "./TournamentResultsConfig";
import TournamentPlayoffConfig from "./TournamentPlayoffConfig";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
};

const TournamentConfigPage: React.FC<Props> = ({ isOpen, onClose, tournamentId }) => {
  const [globalLoading, setGlobalLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"teams" | "schedule" | "results" | "playoffs">("teams");

  if (!isOpen) return null;

  return (
    <div className="modal-shell">
      <div className="modal-card max-w-5xl relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Configuración del Torneo</h2>
          <button
            onClick={onClose}
            className="btn-secondary h-9 w-9 rounded-lg p-0 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b mb-6">
          {[
            { id: "teams", label: "Equipos" },
            { id: "schedule", label: "Calendario" },
            { id: "results", label: "Resultados" },
            { id: "playoffs", label: "Playoffs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 ${
                activeTab === tab.id
                  ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))] font-bold"
                  : "text-[hsl(var(--text-subtle))]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido de los tabs */}
        {activeTab === "teams" && (
          <TournamentTeamsConfig
            tournamentId={tournamentId}
            setGlobalLoading={setGlobalLoading}
          />
        )}
        {activeTab === "schedule" && (
          <TournamentScheduleConfig tournamentId={tournamentId} />
        )}
        {activeTab === "results" && (
          <TournamentResultsConfig tournamentId={tournamentId} />
        )}
        {activeTab === "playoffs" && (
          <TournamentPlayoffConfig tournamentId={tournamentId} />
        )}

        {/* Loader */}
        {globalLoading && (
          <div className="absolute inset-0 bg-[hsl(var(--background)/0.75)] flex justify-center items-center rounded-3xl">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-[hsl(var(--primary))]" />
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentConfigPage;
