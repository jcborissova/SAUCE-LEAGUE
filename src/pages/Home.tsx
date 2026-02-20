/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { Link } from "react-router-dom";
import { UserGroupIcon, TrophyIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import logo from "../assets/sl-logo.png";

import playersImg from "../assets/players.png";
import leaguesImg from "../assets/leagues.png";
import matchesImg from "../assets/matches.png";

const Home: React.FC = () => {
  return (
    <div className="space-y-10 p-3 sm:space-y-14 sm:p-4 lg:p-6">
      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div className="space-y-4 rounded-2xl border bg-[hsl(var(--surface-1)/0.92)] p-5 sm:p-7">
          <span className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
            Domingo / Liga en vivo
          </span>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight sm:text-5xl">Sauce League</h1>
            <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
              Baloncesto organizado con rotaciones justas, resultados claros y una experiencia elegante para jugadores y espectadores.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
              Ver torneo
            </Link>
            <Link to="/players" className="btn-secondary w-full sm:w-auto">
              Ver jugadores
            </Link>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border bg-[hsl(var(--surface-1)/0.94)]">
          <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--info))] p-4 text-[hsl(var(--text-inverse))] sm:p-5">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Sauce League" className="h-12 w-12" />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--text-inverse)/0.75)]">Próximo Juego</p>
                <p className="text-lg font-bold sm:text-xl">Domingo 6:00 PM</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 sm:p-5">
            <div className="rounded-2xl border bg-[hsl(var(--surface-2))] p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Equipo A</p>
              <p className="text-4xl font-black">72</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">Último marcador</p>
            </div>
            <div className="rounded-2xl border bg-[hsl(var(--surface-2))] p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Equipo B</p>
              <p className="text-4xl font-black">69</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">Último marcador</p>
            </div>
            <div className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--text-subtle))]">
              Roster activo <span className="ml-1 font-semibold text-[hsl(var(--foreground))]">24</span>
            </div>
            <div className="rounded-xl border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm text-[hsl(var(--text-subtle))]">
              Partidos jugados <span className="ml-1 font-semibold text-[hsl(var(--foreground))]">132</span>
            </div>
          </div>
        </article>
      </section>

      <section className="card mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
        <Section title="¿Qué es la Sauce League?">
          Liga profesional amateur de baloncesto organizada, donde todos tienen oportunidad bajo un sistema justo, rotativo y competitivo.
        </Section>
        <Section title="Historia">
          Desde 2024 se estructura cada jornada con orden, equilibrio, disciplina y rotaciones automatizadas para mantener continuidad semanal.
        </Section>
        <Section title="Misión">
          Generar una experiencia de baloncesto seria, estructurada y apasionante, integrando jugadores de distintos niveles bajo un sistema profesional.
        </Section>
      </section>

      <ResponsiveSection
        img={playersImg}
        icon={<UserGroupIcon className="h-24 w-24 text-[hsl(var(--text-subtle))]" />}
        title="Jugadores"
        description="Registro detallado de jugadores activos, control de invitados, uniformes y administración de plantilla."
        link="/players"
        buttonText="Ver Jugadores"
      />

      <ResponsiveSection
        img={leaguesImg}
        icon={<TrophyIcon className="h-24 w-24 text-[hsl(var(--text-subtle))]" />}
        title="Ligas"
        description="Organización de quintetos, rotación automática y manejo de reglas dominicales bajo un sistema profesional."
        link="/leagues"
        buttonText="Administrar Ligas"
        reverse
      />

      <ResponsiveSection
        img={matchesImg}
        icon={<CalendarDaysIcon className="h-24 w-24 text-[hsl(var(--text-subtle))]" />}
        title="Partidos"
        description="Registro completo de resultados, historial de encuentros y seguimiento estadístico de la temporada."
        link="/matches"
        buttonText="Ver Partidos"
      />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
    <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))]">{children}</p>
  </div>
);

const ResponsiveSection = ({
  img,
  icon,
  title,
  description,
  link,
  buttonText,
  reverse = false,
}: {
  img?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  buttonText: string;
  reverse?: boolean;
}) => (
  <article
    className={`card mx-auto flex max-w-6xl flex-col items-center gap-5 p-4 sm:gap-8 sm:p-6 ${
      reverse ? "md:flex-row-reverse" : "md:flex-row"
    }`}
  >
    {img ? (
      <img src={img} alt={title} className="max-h-[360px] w-full rounded-2xl border object-cover md:w-1/2" />
    ) : (
      <div className="flex h-[240px] w-full items-center justify-center rounded-2xl border bg-[hsl(var(--muted))] md:w-1/2">
        {icon}
      </div>
    )}

    <div className="w-full space-y-3 text-center md:w-1/2 md:text-left">
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>
      <Link to={link} className="btn-primary inline-flex">
        {buttonText}
      </Link>
    </div>
  </article>
);

export default Home;
