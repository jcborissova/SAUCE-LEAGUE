import React from "react";
import { ChartBarSquareIcon, TvIcon } from "@heroicons/react/24/outline";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";

const Matches: React.FC = () => {
  return (
    <PageShell
      title="Partidos"
      subtitle="Centro de partido en construcción: marcador, control y lectura rápida para móvil."
      badge="Game Center"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard>
          <div className="inline-flex h-10 w-10 items-center justify-center border bg-[hsl(var(--surface-1))] text-[hsl(var(--primary))]">
            <TvIcon className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-lg font-semibold">Marcador en tiempo real</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Aquí se mostrará el board principal del partido con cronómetro, posesión y estado del juego.
          </p>
        </SectionCard>

        <SectionCard>
          <div className="inline-flex h-10 w-10 items-center justify-center border bg-[hsl(var(--surface-1))] text-[hsl(var(--primary))]">
            <ChartBarSquareIcon className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-lg font-semibold">Estadísticas instantáneas</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Tiros, rebotes y asistencias se presentarán en formato compacto, con enfoque táctil y legible.
          </p>
        </SectionCard>
      </div>
    </PageShell>
  );
};

export default Matches;
