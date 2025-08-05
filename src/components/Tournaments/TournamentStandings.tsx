/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import * as htmlToImage from "html-to-image";
import { toast } from "react-toastify";
import LoadingSpinner from "../LoadingSpinner";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type TeamStanding = {
  name: string;
  pj: number;
  pg: number;
  pp: number;
  points: number;
};

type Props = {
  tournamentId: string;
};

const TournamentStandings: React.FC<Props> = ({ tournamentId }) => {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const loadStandings = async () => {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("tournament_id", tournamentId);

    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .not("winner_team", "is", null);

    const teamStats: Record<string, TeamStanding> = {};

    teams?.forEach((team) => {
      teamStats[team.name] = {
        name: team.name,
        pj: 0,
        pg: 0,
        pp: 0,
        points: 0, // será reemplazado por diferencia
      };
    });

    matches?.forEach((match) => {
      const {
        team_a,
        team_b,
        winner_team,
        score_team_a,
        score_team_b,
      } = match;

      if (!teamStats[team_a] || !teamStats[team_b]) return;

      teamStats[team_a].pj++;
      teamStats[team_b].pj++;

      const scoreA = score_team_a || 0;
      const scoreB = score_team_b || 0;

      if (winner_team === team_a) {
        teamStats[team_a].pg++;
        teamStats[team_b].pp++;
      } else if (winner_team === team_b) {
        teamStats[team_b].pg++;
        teamStats[team_a].pp++;
      }

      // Acumular puntos a favor y en contra
      teamStats[team_a].points += scoreA - scoreB;
      teamStats[team_b].points += scoreB - scoreA;
    });

    const sorted = Object.values(teamStats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.pg - a.pg;
    });

    setStandings(sorted);
    setLoading(false);
  };

  loadStandings();
}, [tournamentId]);


  const handleExport = async () => {
    const element = document.getElementById("tabla-posiciones");
    if (!element) {
      toast.error("No se encontró el contenedor");
      return;
    }

    try {
      await new Promise((r) => setTimeout(r, 300));
      const dataUrl = await htmlToImage.toPng(element, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "white",
      });

      const link = document.createElement("a");
      link.download = `Tabla_Posiciones_SauceLeague.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Tabla exportada correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar tabla");
    }
  };

  if (loading) return <LoadingSpinner />;

return (
  <div className="w-full px-2 sm:px-4 lg:px-10">
  <div
    id="tabla-posiciones"
    className="relative w-full max-w-full sm:max-w-2xl lg:max-w-4xl mx-auto rounded-xl shadow-2xl border border-blue-600 p-4 sm:p-6 overflow-hidden"
    style={{
      backgroundImage: `url('/game-bg.png')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}
  >
    {/* Overlay */}
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0" />

    {/* Logo */}
    <img
      src="/sl-logo-white.png"
      alt="Sauce League"
      className="absolute top-3 right-3 w-12 sm:w-16 lg:w-20 z-0"
    />

    {/* Export Button */}
    <button
      onClick={handleExport}
      className="absolute top-3 left-3 flex items-center gap-1 bg-yellow-400 text-black font-bold px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-full shadow hover:bg-yellow-300 transition z-0"
    >
    </button>

    {/* Title */}
    <div className="relative z-0 text-center mt-14 sm:mt-16 mb-6">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold uppercase tracking-wider text-yellow-400 drop-shadow">
        Tabla de Posiciones
      </h2>
      <p className="text-blue-100 text-xs sm:text-sm md:text-base font-medium italic">
        Sauce League • Clasificación oficial
      </p>
    </div>

    {/* Table */}
    <div className="relative z-0 overflow-x-auto">
      <table className="w-full text-[10px] sm:text-xs md:text-sm text-white border-collapse">
        <thead className="bg-blue-900/90 uppercase text-yellow-400">
          <tr>
            <th className="px-2 py-2 text-left">#</th>
            <th className="px-2 py-2 text-left">Equipo</th>
            <th className="px-2 py-2 text-center">PJ</th>
            <th className="px-2 py-2 text-center">PG</th>
            <th className="px-2 py-2 text-center">PP</th>
           
          </tr>
        </thead>
        <tbody>
          {standings.map((team, idx) => (
            <tr
              key={team.name}
              className={`${
                idx % 2 === 0 ? "bg-white/5" : "bg-white/10"
              } hover:bg-yellow-100/10 transition`}
            >
              <td className="px-2 py-2 font-bold">{idx + 1}</td>
              <td className="px-2 py-2 font-semibold">{team.name}</td>
              <td className="px-2 py-2 text-center">{team.pj}</td>
              <td className="px-2 py-2 text-center text-green-400 font-bold">{team.pg}</td>
              <td className="px-2 py-2 text-center text-red-400 font-bold">{team.pp}</td>
              
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Footer */}
    <p className="relative z-10 text-center text-[10px] sm:text-xs text-white/60 mt-6 italic">
      © Sauce League 2025
    </p>
  </div>
</div>

);

};

export default TournamentStandings;
