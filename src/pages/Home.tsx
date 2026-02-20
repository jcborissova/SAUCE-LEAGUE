import React from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, CalendarDaysIcon, TrophyIcon, UserGroupIcon } from "@heroicons/react/24/solid";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import StatPill from "../components/ui/StatPill";
import Badge from "../components/ui/Badge";
import leaguesHomeImage from "../assets/home/leagues-home.jpg";
import matchesHomeImage from "../assets/home/matches-home.jpg";

const Home: React.FC = () => {
  return (
    <PageShell>
      <section className="overflow-hidden border bg-[hsl(var(--surface-1))]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">Temporada activa</Badge>
              <Badge>Control central</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Sauce League</h1>
              <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
                Gestiona ligas y torneos de baloncesto con un flujo operativo claro: quintetos, marcador en vivo, resultados y líderes.
              </p>
            </div>

            <div className="border-l-2 border-[hsl(var(--primary)/0.55)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Objetivo</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] sm:text-[15px]">
                Estandarizar la operación del torneo en un panel móvil-first, minimizando pasos para registrar partidos y tomar decisiones rápidas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatPill label="Roster" value="24" />
              <StatPill label="Partidos" value="132" />
              <StatPill label="Ligas" value="4" />
              <StatPill label="Torneos" value="2" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
                Ver torneo
              </Link>
              <Link to="/leagues" className="btn-secondary w-full sm:w-auto">
                Gestionar liga
              </Link>
            </div>
          </div>

          <div className="border-t bg-[hsl(var(--surface-2)/0.56)] p-3 sm:p-4 lg:border-l lg:border-t-0">
            <div className="grid h-full grid-cols-2 gap-2 sm:gap-3">
              <article className="relative col-span-2 min-h-[148px] overflow-hidden border sm:min-h-[170px]">
                <img
                  src={leaguesHomeImage}
                  alt="Vista de gestión de ligas"
                  loading="eager"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/80">Operación</p>
                  <p className="text-base font-bold sm:text-xl">Control total de liga en tiempo real</p>
                </div>
              </article>

              <article className="relative min-h-[104px] overflow-hidden border sm:min-h-[128px]">
                <img src={matchesHomeImage} alt="Calendario y resultados" loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/12 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                  <p className="text-xs font-semibold">Resultados</p>
                </div>
              </article>

              <article className="grid min-h-[104px] place-content-center border bg-[hsl(var(--surface-1))] p-3 text-center sm:min-h-[128px]">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--text-subtle))]">Experiencia</p>
                <p className="mt-1 text-sm font-semibold sm:text-base">Simple, rápida y profesional</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Pensada para organizar torneos sin fricción.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HomeFeatureTile
          icon={<UserGroupIcon className="h-6 w-6" />}
          title="Jugadores"
          text="Registro, edición, búsqueda y control de roster."
          link="/players"
          cta="Abrir jugadores"
          visualStyle="data"
        />
        <HomeFeatureTile
          icon={<TrophyIcon className="h-6 w-6" />}
          title="Ligas"
          text="Gestión de cola, quintetos, invitados y partido actual."
          link="/leagues"
          cta="Abrir ligas"
          imageSrc={leaguesHomeImage}
          imageAlt="Panel de ligas"
          visualStyle="image"
        />
        <HomeFeatureTile
          icon={<CalendarDaysIcon className="h-6 w-6" />}
          title="Torneos"
          text="Calendario, resultados, posiciones y analíticas del torneo."
          link="/tournaments"
          cta="Abrir torneos"
          imageSrc={matchesHomeImage}
          imageAlt="Panel de torneos y partidos"
          visualStyle="image"
        />
      </section>
    </PageShell>
  );
};

const HomeFeatureTile = ({
  icon,
  title,
  text,
  link,
  cta,
  imageSrc,
  imageAlt,
  visualStyle,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  link: string;
  cta: string;
  imageSrc?: string;
  imageAlt?: string;
  visualStyle: "image" | "data";
}) => (
  <SectionCard className="space-y-0 overflow-hidden p-0">
    {visualStyle === "image" && imageSrc ? (
      <div className="relative h-36 w-full border-b sm:h-40">
        <img src={imageSrc} alt={imageAlt ?? title} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/18 to-transparent" />
        <div className="absolute bottom-2 left-3 inline-flex h-9 w-9 items-center justify-center border border-white/45 bg-black/28 text-white backdrop-blur-sm">
          {icon}
        </div>
      </div>
    ) : (
      <div className="border-b bg-[hsl(var(--surface-2)/0.85)] p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Activos</p>
            <p className="text-base font-bold tabular-nums">24</p>
          </div>
          <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Equipos</p>
            <p className="text-base font-bold tabular-nums">8</p>
          </div>
          <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Invitados</p>
            <p className="text-base font-bold tabular-nums">5</p>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center border bg-[hsl(var(--surface-2))] text-[hsl(var(--primary))]">
          {icon}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{text}</p>
      <Link to={link} className="btn-secondary inline-flex min-w-[170px] gap-2">
        {cta}
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  </SectionCard>
);

export default Home;
