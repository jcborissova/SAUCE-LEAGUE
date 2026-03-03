import type { TournamentPhaseFilter } from "../../../types/tournament-analytics";
import React from "react";
import type { MvpBreakdownRow } from "../../../types/tournament-analytics";
import MvpPanel from "./MvpPanel";

type FinalsMvpPanelProps = {
  rows: MvpBreakdownRow[];
  loading: boolean;
  onPlayerSelect?: (playerId: number, phase: TournamentPhaseFilter) => void;
};

const FinalsMvpPanel: React.FC<FinalsMvpPanelProps> = ({ rows, loading, onPlayerSelect }) => {
  return (
    <MvpPanel
      rows={rows}
      loading={loading}
      title="Finals MVP"
      subtitle="Evaluación exclusiva de finales con la misma fórmula inteligente y ponderación de récord/disponibilidad."
      phase="finals"
      onPlayerSelect={onPlayerSelect}
    />
  );
};

export default FinalsMvpPanel;
