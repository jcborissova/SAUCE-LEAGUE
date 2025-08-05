/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import TournamentTeamsConfig from "./TournamentTeamsConfig";
import TournamentScheduleConfig from "./TournamentScheduleConfig";
import TournamentResultsConfig from "./TournamentResultsConfig";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
};

const TournamentConfigPage: React.FC<Props> = ({ isOpen, onClose, tournamentId }) => {
  const [globalLoading, setGlobalLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"teams" | "schedule" | "results">("teams");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center px-4 z-50">
      <div className="bg-white w-full max-w-5xl rounded-3xl p-6 overflow-y-auto max-h-[95vh] shadow-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-blue-900">Configuración del Torneo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl font-bold transition"
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
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600 font-bold"
                  : "text-gray-600"
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

        {/* Loader */}
        {globalLoading && (
          <div className="absolute inset-0 bg-white/70 flex justify-center items-center rounded-3xl">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentConfigPage;
