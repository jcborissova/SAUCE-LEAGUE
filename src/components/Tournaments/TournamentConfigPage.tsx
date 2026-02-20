import React, { useMemo, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

import TournamentTeamsConfig from "./TournamentTeamsConfig";
import TournamentScheduleConfig from "./TournamentScheduleConfig";
import TournamentResultsConfig from "./TournamentResultsConfig";
import TournamentPlayoffConfig from "./TournamentPlayoffConfig";
import TournamentRulesConfig from "./TournamentRulesConfig";
import ModalShell from "../ui/ModalShell";
import SegmentedControl from "../ui/SegmentedControl";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
};

type ConfigTabKey = "teams" | "schedule" | "results" | "playoffs" | "rules";

const CONFIG_TABS: Array<{ value: ConfigTabKey; label: string; helper: string }> = [
  { value: "teams", label: "Equipos", helper: "Define equipos y asigna jugadores de forma rápida." },
  { value: "schedule", label: "Calendario", helper: "Genera y guarda el calendario oficial del torneo." },
  { value: "results", label: "Resultados", helper: "Carga ganadores y estadísticas por partido." },
  { value: "playoffs", label: "Playoffs", helper: "Configura formato y genera cruces finales." },
  { value: "rules", label: "Reglamento", helper: "Asocia el PDF de reglas específico del torneo." },
];

const TournamentConfigPage: React.FC<Props> = ({ isOpen, onClose, tournamentId }) => {
  const [globalLoading, setGlobalLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ConfigTabKey>("teams");

  const activeTabMeta = useMemo(
    () => CONFIG_TABS.find((tab) => tab.value === activeTab),
    [activeTab]
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración del torneo"
      subtitle="Administra equipos, calendario, resultados, playoffs y reglamento."
      maxWidthClassName="h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[92vh] sm:max-w-6xl"
    >
      <div className="-mx-4 sm:mx-0">
        <div className="sticky top-0 z-10 border-b border-[hsl(var(--border)/0.75)] bg-[hsl(var(--surface-1))] px-4 pb-3 pt-1 sm:px-0 sm:pt-0 sm:pb-4">
          <SegmentedControl
            options={CONFIG_TABS.map((item) => ({ value: item.value, label: item.label }))}
            value={activeTab}
            onChange={(value) => setActiveTab(value as ConfigTabKey)}
            scrollable
          />
          <p className="mt-2 text-xs text-[hsl(var(--text-subtle))]">{activeTabMeta?.helper}</p>
        </div>

        <div className="relative px-4 pb-2 pt-3 sm:px-0 sm:pt-4">
          {activeTab === "teams" ? <TournamentTeamsConfig tournamentId={tournamentId} setGlobalLoading={setGlobalLoading} /> : null}
          {activeTab === "schedule" ? <TournamentScheduleConfig tournamentId={tournamentId} /> : null}
          {activeTab === "results" ? <TournamentResultsConfig tournamentId={tournamentId} /> : null}
          {activeTab === "playoffs" ? <TournamentPlayoffConfig tournamentId={tournamentId} /> : null}
          {activeTab === "rules" ? <TournamentRulesConfig tournamentId={tournamentId} /> : null}

          {globalLoading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[hsl(var(--background)/0.74)] backdrop-blur-[1px]">
              <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
};

export default TournamentConfigPage;
