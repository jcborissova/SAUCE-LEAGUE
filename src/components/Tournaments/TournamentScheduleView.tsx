/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  ClockIcon,
  MapPinIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import * as htmlToImage from "html-to-image";
import dayjs from "dayjs";
import LoadingSpinner from "../LoadingSpinner";

type Props = {
  tournamentId: string;
};

const TournamentScheduleView: React.FC<Props> = ({ tournamentId }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedByDate, setGroupedByDate] = useState<Record<string, any[]>>({});
  const [coverMode, setCoverMode] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("match_date", { ascending: true })
        .order("match_time", { ascending: true });

      if (error) {
        toast.error("Error al cargar partidos");
        return;
      }

      setMatches(data || []);
      console.log(matches);
      groupMatchesByDate(data || []);
      setLoading(false);
    };

    fetchMatches();
  }, [tournamentId]);

  const groupMatchesByDate = (allMatches: any[]) => {
    const grouped: Record<string, any[]> = {};
    allMatches.forEach((match) => {
      if (!grouped[match.match_date]) {
        grouped[match.match_date] = [];
      }
      grouped[match.match_date].push(match);
    });
    setGroupedByDate(grouped);
  };

  const handleExportImage = async (idOrRef: string) => {
  const element = document.getElementById(idOrRef);
  if (!element) {
    console.error("ID not found in DOM:", idOrRef);
    toast.error("No se encontró el contenedor");
    return;
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dataUrl = await htmlToImage.toPng(element, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "white", // o "black" si lo prefieres
    });
    const link = document.createElement("a");
    link.download = `Calendario_SauceLeague.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Imagen exportada correctamente");
  } catch (error) {
    console.error(error);
    toast.error("Error al exportar la imagen");
  }
};


  return (
    <div className="w-full px-2 md:px-6 lg:px-10 space-y-10">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-blue-900">Calendario de Partidos</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Normal</span>
          <button
            onClick={() => setCoverMode(!coverMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out ${
              coverMode ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                coverMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">Portada</span>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : Object.keys(groupedByDate).length === 0 ? (
        <p className="text-center text-gray-500">No hay partidos programados aún.</p>
      ) : (
        <>
          {!coverMode ? (
<div
  id="tabla-completa"
  className="relative w-full text-white rounded-xl shadow-2xl border border-blue-600 p-6"
  style={{
    width: "100%",
    maxWidth: "100%",
    backgroundImage: `url('/game-bg.png')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }}
>

  {/* Overlay negro */}
  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0" />

  {/* Logo Sauce League */}
  <img
    src="/sl-logo-white.png"
    alt="Sauce League"
    className="absolute top-4 right-4 w-20 z-10"
  />

  {/* Botón exportar */}
  <button
    onClick={() => handleExportImage("tabla-completa")}
    className="absolute top-4 left-4 flex items-center gap-1 bg-yellow-400 text-black font-bold px-3 py-1 text-xs rounded-full shadow hover:bg-yellow-300 transition z-10"
  >
    
    
  </button>

  {/* Título */}
  <div className="relative z-10 text-center mt-6 mb-8">
    <h2 className="text-3xl font-extrabold uppercase tracking-wider text-yellow-400 drop-shadow">
      Calendario de Partidos
    </h2>
    <p className="text-blue-100 text-lg font-medium italic">
      Sauce League • Vive la pasión del baloncesto
    </p>
  </div>

  {/* Partidos como tabla en 2 columnas */}
  <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
    {Object.entries(groupedByDate).map(([date, jornadaMatches], idx) =>
      jornadaMatches.map((match) => (
        <div
          key={match.id}
          className="bg-white/10 rounded-lg px-3 py-4 text-xs sm:text-sm flex flex-col justify-between border border-white/20 shadow-md"
        >
          {/* Jornada y Fecha */}
          <div className="text-yellow-300 font-bold uppercase text-[11px] mb-2 text-center tracking-wide">
            Jornada {idx + 1} • {dayjs(date).format("DD/MM/YYYY")}
          </div>

          {/* Equipos */}
          <div className="flex items-center justify-center gap-2 font-bold text-white text-xs sm:text-sm uppercase">
            <div className="flex items-center gap-1">
              <span>{match.team_a}</span>
              {match.logo_a && (
                <img
                  src={match.logo_a}
                  alt={match.team_a}
                  className="w-6 h-6 rounded-full ring-1 ring-white"
                />
              )}
            </div>
            <span className="text-yellow-400 font-black text-sm">VS</span>
            <div className="flex items-center gap-1">
              {match.logo_b && (
                <img
                  src={match.logo_b}
                  alt={match.team_b}
                  className="w-6 h-6 rounded-full ring-1 ring-white"
                />
              )}
              <span>{match.team_b}</span>
            </div>
          </div>

          {/* Hora y Lugar */}
          <div className="flex justify-center items-center gap-3 mt-3 text-blue-100 text-[11px]">
            <div className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4 text-yellow-300" />
              {match.match_time}
            </div>
            <div className="flex items-center gap-1">
              <MapPinIcon className="w-4 h-4 text-yellow-300" />
              Cancha Principal
            </div>
          </div>
        </div>
      ))
    )}
  </div>

  {/* Footer */}
  <p className="relative z-10 text-center text-xs text-white/60 mt-8 italic">
    © Sauce League 2025
  </p>
</div>

          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(groupedByDate).map(([date, jornadaMatches], idx) => (
                <div
                  key={date}
                  id={`jornada-${date}`}
                  className="w-full relative rounded-2xl shadow-2xl flex flex-col justify-between p-6"
                  style={{
                    backgroundImage: `url('/game-bg.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: "black",
                  }}
                >
                  <div className="absolute inset-0 bg-black/70 rounded-2xl z-0"></div>

                  <img
                    src="/sl-logo-white.png"
                    alt="Sauce League Logo"
                    className="absolute top-5 right-5 w-20 opacity-90 z-10"
                  />

                  <button
                    onClick={() => handleExportImage(`jornada-${date}`)} 
                    className="absolute top-5 left-5 flex items-center gap-1 bg-white/20 text-white px-3 py-1 rounded-full hover:bg-white/30 transition z-10"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    
                  </button>

                  <div className="relative text-center mt-6 z-10">
                    <h3 className="text-4xl font-extrabold tracking-wide drop-shadow-md text-white">
                      Jornada {idx + 1}
                    </h3>
                    <p className="text-blue-100 text-xl mt-2 drop-shadow-sm font-semibold">
                      {dayjs(date).format("DD/MM/YYYY")}
                    </p>
                  </div>

                  <div className="relative flex flex-col justify-center gap-4 w-full px-2 mt-6 z-10">
                    {jornadaMatches.map((match) => (
                      <div
                        key={match.id}
                        className="bg-white/10 border border-white/30 backdrop-blur-none rounded-xl p-5 flex flex-col items-center text-center transition w-full"
                      >
                        <p className="font-extrabold text-2xl text-white drop-shadow">
                          {match.team_a} <span className="text-yellow-400">vs</span> {match.team_b}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-md text-blue-100 mt-2 justify-center">
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-5 h-5" />
                            <span>{match.match_time}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPinIcon className="w-5 h-5" />
                            <span>Cancha Principal</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="relative text-center text-blue-200 mt-4 italic text-sm z-10">
                    Sauce League • Vive la pasión del baloncesto
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TournamentScheduleView;
