/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

import TournamentTeamsConfig from "./TournamentTeamsConfig";
import TournamentScheduleConfig from "./TournamentScheduleConfig";
import TournamentResultsConfig from "./TournamentResultsConfig";
import TournamentPlayoffConfig from "./TournamentPlayoffConfig";
import ModalShell from "../ui/ModalShell";
import SegmentedControl from "../ui/SegmentedControl";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
};

const TournamentConfigPage: React.FC<Props> = ({ isOpen, onClose, tournamentId }) => {
  const [globalLoading, setGlobalLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"teams" | "schedule" | "results" | "playoffs">("teams");

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Configuración del torneo" maxWidthClassName="sm:max-w-5xl">
      <SegmentedControl
        options={[
          { id: "teams", value: "teams", label: "Equipos" },
          { id: "schedule", value: "schedule", label: "Calendario" },
          { id: "results", value: "results", label: "Resultados" },
          { id: "playoffs", value: "playoffs", label: "Playoffs" },
        ].map((item) => ({ value: item.value, label: item.label }))}
        value={activeTab}
        onChange={(value) => setActiveTab(value as any)}
      />

      {activeTab === "teams" ? <TournamentTeamsConfig tournamentId={tournamentId} setGlobalLoading={setGlobalLoading} /> : null}
      {activeTab === "schedule" ? <TournamentScheduleConfig tournamentId={tournamentId} /> : null}
      {activeTab === "results" ? <TournamentResultsConfig tournamentId={tournamentId} /> : null}
      {activeTab === "playoffs" ? <TournamentPlayoffConfig tournamentId={tournamentId} /> : null}

      {globalLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--background)/0.72)]">
          <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : null}
    </ModalShell>
  );
};

export default TournamentConfigPage;
