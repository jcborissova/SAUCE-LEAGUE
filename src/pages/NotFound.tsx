import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowPathIcon, ExclamationTriangleIcon, HomeIcon } from "@heroicons/react/24/solid";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";

const REDIRECT_SECONDS = 6;

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    setSecondsLeft(REDIRECT_SECONDS);

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    const timeout = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, REDIRECT_SECONDS * 1000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [navigate, location.pathname]);

  return (
    <PageShell>
      <section className="relative overflow-hidden rounded-[14px] border bg-[hsl(var(--surface-1))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,hsl(var(--warning)/0.18),transparent_42%),radial-gradient(circle_at_86%_12%,hsl(var(--primary)/0.14),transparent_34%)]" />
        <div className="relative grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border bg-[hsl(var(--surface-2))] px-3 py-1 text-xs font-semibold text-[hsl(var(--text-subtle))]">
              <ExclamationTriangleIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
              Ruta no encontrada
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Esta página no existe</h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                La URL <span className="font-semibold text-[hsl(var(--text-strong))]">{location.pathname}</span> no tiene contenido activo.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link to="/" className="btn-primary w-full sm:w-auto">
                <HomeIcon className="h-4 w-4" />
                Ir al inicio
              </Link>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary w-full sm:w-auto"
              >
                Volver atrás
              </button>
            </div>
          </div>

          <SectionCard
            title="Redirección automática"
            description="Te llevamos al home para que sigas navegando sin fricción."
            className="bg-[hsl(var(--surface-1)/0.95)]"
          >
            <div className="space-y-3">
              <div className="rounded-[10px] border bg-[hsl(var(--surface-2))] p-3">
                <p className="text-xs uppercase tracking-wide text-[hsl(var(--text-subtle))]">Tiempo restante</p>
                <p className="mt-1 text-3xl font-black tabular-nums">{secondsLeft}s</p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="btn-secondary w-full"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Redirigir ahora
              </button>
            </div>
          </SectionCard>
        </div>
      </section>
    </PageShell>
  );
};

export default NotFound;
