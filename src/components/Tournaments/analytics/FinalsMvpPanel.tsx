import React from "react";
import type { MvpBreakdownRow } from "../../../types/tournament-analytics";
import MvpPanel from "./MvpPanel";

type FinalsMvpPanelProps = {
  rows: MvpBreakdownRow[];
  loading: boolean;
};

const FinalsMvpPanel: React.FC<FinalsMvpPanelProps> = ({ rows, loading }) => {
  return (
    <MvpPanel
      rows={rows}
      loading={loading}
      title="Finals MVP"
      subtitle="Evaluación exclusiva de partidos de finales con la misma fórmula oficial de MVP."
    />
  );
};

export default FinalsMvpPanel;
