/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { Link } from "react-router-dom";
import { UserGroupIcon, TrophyIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import logo from "../assets/sl-logo.png";

import playersImg from '../assets/players.png';
import leaguesImg from '../assets/leagues.png';
import matchesImg from '../assets/matches.png';

const Home: React.FC = () => {
  return (
    <div className="p-4 md:p-6 lg:p-10 space-y-24">

      {/* HERO */}
      <div className="flex flex-col items-center text-center space-y-4">
        <img src={logo} alt="Sauce League Logo" className="w-32 md:w-44 mb-4 drop-shadow-lg" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide text-blue-950 drop-shadow-sm">SAUCE LEAGUE</h1>
        <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
          Bienvenido a la Sauce League, donde el baloncesto, el orden y la comunidad se unen cada semana.
          Un sistema profesionalizado con quintetos, rotaciones y gestión de partidos.
        </p>
      </div>

      {/* PRESENTACIÓN */}
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-3xl p-6 md:p-12 text-gray-700 space-y-10 border border-gray-200">
        <Section title="¿Qué es la Sauce League?">
          Liga profesional amateur de baloncesto organizada, donde todos tienen oportunidad bajo un sistema justo, rotativo y competitivo.
        </Section>
        <Section title="Historia">
          Desde 2024 nos enfocamos en estructurar juegos con orden, equilibrio, disciplina y rotaciones automatizadas; permitiendo fluidez semanal, resultados documentados y participación continua.
        </Section>
        <Section title="Misión">
          Generar una experiencia de baloncesto seria, estructurada, justa y apasionante; integrando jugadores de distintos niveles bajo un sistema profesional.
        </Section>
      </div>

      {/* SECCIÓN JUGADORES */}
      <ResponsiveSection
        img={playersImg}
        icon={<UserGroupIcon className="h-28 w-28 text-gray-400" />}
        title="Jugadores"
        description="Registro detallado de jugadores activos, control de invitados, llegada, uniformes y administración de la base de datos."
        link="/players"
        buttonText="Ver Jugadores"
      />

      {/* SECCIÓN LIGAS */}
      <ResponsiveSection
        img={leaguesImg}
        icon={<TrophyIcon className="h-28 w-28 text-gray-400" />}
        title="Ligas"
        description="Organización de quintetos, rotación automática y manejo de reglas dominicales bajo un sistema profesional de administración."
        link="/leagues"
        buttonText="Administrar Ligas"
        reverse
      />

      {/* SECCIÓN PARTIDOS */}
      <ResponsiveSection
        img={matchesImg}
        icon={<CalendarDaysIcon className="h-28 w-28 text-gray-400" />}
        title="Partidos"
        description="Registro completo de resultados, rotaciones, puntuaciones, historial de encuentros y seguimiento estadístico."
        link="/matches"
        buttonText="Ver Partidos"
      />
    </div>
  );
};

// Sub-component Section
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div>
    <h2 className="text-3xl font-bold text-blue-950 mb-4">{title}</h2>
    <p className="leading-relaxed text-base md:text-lg">{children}</p>
  </div>
);

// Sub-component ResponsiveSection
const ResponsiveSection = ({
  img, icon, title, description, link, buttonText, reverse = false
}: {
  img?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  buttonText: string;
  reverse?: boolean;
}) => (
  <div className={`max-w-6xl mx-auto flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10`}>
    {img ? (
      <img src={img} alt={title} className="rounded-3xl shadow-xl w-full md:w-1/2 object-cover max-h-[400px]" />
    ) : (
      <div className="w-full md:w-1/2 h-[250px] md:h-[300px] flex justify-center items-center bg-gray-100 rounded-3xl border">
        {icon}
      </div>
    )}
    <div className="space-y-6 text-center md:text-left">
      <h2 className="text-3xl md:text-4xl font-bold text-blue-950">{title}</h2>
      <p className="text-base md:text-lg text-gray-600 leading-relaxed">{description}</p>
      <div>
        <Link to={link} className="inline-block bg-blue-950 text-white font-semibold py-3 px-8 rounded-full shadow-lg hover:bg-blue-900 transition">
          {buttonText}
        </Link>
      </div>
    </div>
  </div>
);

export default Home;
