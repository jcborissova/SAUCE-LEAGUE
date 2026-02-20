import React from "react";
import { ChartBarSquareIcon, TvIcon } from "@heroicons/react/24/outline";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

const Matches: React.FC = () => {
  return (
    <div className="mx-auto space-y-5 px-3 py-4 sm:px-4 sm:py-6">
      <PageHeader
        title="Partidos"
        subtitle="Marcador en vivo y control de partido con lectura rápida para móvil y desktop."
        badge="Game Center"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-[hsl(var(--surface-1))] text-[hsl(var(--primary))]">
            <TvIcon className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold">Marcador en tiempo real</h3>
          <p className="app-muted text-sm">
            Aquí se integrará el board principal de partido con cronómetro, posesión y estado por cuarto.
          </p>
        </Panel>

        <Panel className="space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-[hsl(var(--surface-1))] text-[hsl(var(--primary))]">
            <ChartBarSquareIcon className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold">Estadísticas instantáneas</h3>
          <p className="app-muted text-sm">
            Se mostrarán tiros, rebotes y asistencias por equipo en un layout táctil estilo broadcast.
          </p>
        </Panel>
      </div>
    </div>
  );
};

export default Matches;
