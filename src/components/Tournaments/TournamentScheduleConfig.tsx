/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import dayjs from "dayjs";

type Props = {
  tournamentId: string;
};

const TournamentScheduleConfig: React.FC<Props> = ({ tournamentId }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [gamesPerTeam, setGamesPerTeam] = useState<number>(6);
  const [startDate, setStartDate] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [previewMatches, setPreviewMatches] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: tournamentData } = await supabase
        .from("tournaments")
        .select("startdate")
        .eq("id", tournamentId)
        .single();

      if (tournamentData?.startdate) {
        setStartDate(tournamentData.startdate);
      }

      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", tournamentId);

      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId);

      setTeams(teamsData || []);
      setMatches(matchesData || []);
      setLoading(false);
    };

    fetchData();
  }, [tournamentId]);

  const generateMatches = () => {
    if (teams.length < 2) {
      toast.warn("Se necesitan al menos 2 equipos");
      return;
    }

    if (!startDate) {
      toast.warn("No se ha definido la fecha de inicio del torneo");
      return;
    }

    setGenerating(true);

    const teamNames = teams.map((t) => t.name);
    const numTeams = teamNames.length;
    const rivalsPerTeam = numTeams - 1;
    const gamesPerRival = gamesPerTeam / rivalsPerTeam;

    if (!Number.isInteger(gamesPerRival)) {
      toast.warn("El número de juegos por equipo puede no ser perfectamente equilibrado entre rivales.");
    }

    // Crear los pares base (cada par una sola vez)
    let basePairs: [string, string][] = [];
    for (let i = 0; i < numTeams; i++) {
      for (let j = i + 1; j < numTeams; j++) {
        basePairs.push([teamNames[i], teamNames[j]]);
      }
    }

    // Mezclar los pares para evitar secuencias fijas
    let shuffledBasePairs = [...basePairs].sort(() => Math.random() - 0.5);
    let firstHalfPairs = [...shuffledBasePairs];
    let secondHalfPairs = [...shuffledBasePairs];

    // Para contadores
    let gamesCount: Record<string, number> = {};
    teamNames.forEach((t) => (gamesCount[t] = 0));

    const scheduledMatches: any[] = [];
    let currentDate = dayjs(startDate);
    if (currentDate.day() !== 0) {
      currentDate = currentDate.day(7);
    }

    let allPairs = [...firstHalfPairs, ...secondHalfPairs];
    let weekNumber = 0;

    while (allPairs.length > 0) {
      let sundayPairs: [string, string][] = [];
      let usedTeams: Set<string> = new Set();

      for (let i = 0; i < allPairs.length; i++) {
        const [a, b] = allPairs[i];

        if (
          gamesCount[a] < gamesPerTeam &&
          gamesCount[b] < gamesPerTeam &&
          !usedTeams.has(a) &&
          !usedTeams.has(b)
        ) {
          sundayPairs.push([a, b]);
          usedTeams.add(a);
          usedTeams.add(b);

          if (sundayPairs.length === 2) break;
        }
      }

      if (sundayPairs.length === 0) {
  const remainingPairs = allPairs.filter(
    ([a, b]) =>
      gamesCount[a] < gamesPerTeam &&
      gamesCount[b] < gamesPerTeam
  );

  if (remainingPairs.length === 0) {
    // Ya no quedan pares válidos para emparejar → salir del bucle
    break;
  }

  // No se pudieron armar juegos esta semana, pasar a la próxima
  currentDate = currentDate.add(1, "week");
  weekNumber++;
  continue;
}


      // Asignar partidos
      sundayPairs.forEach((pair, index) => {
        let [a, b] = pair;

        // Alternar quién empieza
        if (weekNumber % 2 === 1 && index === 0) {
          [a, b] = [b, a];
        }

        scheduledMatches.push({
          team_a: a,
          team_b: b,
          match_date: currentDate.format("YYYY-MM-DD"),
          match_time: index === 0 ? "18:15" : "19:15",
          tournament_id: tournamentId,
        });

        gamesCount[a]++;
        gamesCount[b]++;
      });

      // Remover los pares ya usados este domingo
      sundayPairs.forEach((sp) => {
        const idx = allPairs.findIndex(
          (p) => (p[0] === sp[0] && p[1] === sp[1]) || (p[0] === sp[1] && p[1] === sp[0])
        );
        if (idx !== -1) allPairs.splice(idx, 1);
      });

      // Avanzar al siguiente domingo
      currentDate = currentDate.add(1, "week");
      weekNumber++;
    }

    setPreviewMatches(scheduledMatches);
    setGenerating(false);
    toast.success("Partidos generados. Revisa y guarda cuando estés listo.");
  };

const handleSave = async () => {
  if (previewMatches.length === 0) {
    toast.warn("No hay partidos para guardar");
    return;
  }

  try {
    // 1. Obtener IDs de los partidos existentes del torneo
    const { data: matchesToDelete, error: fetchError } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament_id", tournamentId);

    if (fetchError) throw fetchError;

    const matchIds = matchesToDelete?.map((m) => m.id) || [];

    // 2. Eliminar registros en current_match que referencian esos partidos
    if (matchIds.length > 0) {
      const { error: deleteCurrentMatchError } = await supabase
        .from("current_match")
        .delete()
        .in("match_id", matchIds);

      if (deleteCurrentMatchError) throw deleteCurrentMatchError;

      // 3. Eliminar partidos anteriores del torneo
      const { error: deleteMatchesError } = await supabase
        .from("matches")
        .delete()
        .in("id", matchIds);

      if (deleteMatchesError) throw deleteMatchesError;
    }

    // 4. Insertar nuevos partidos
    const { data: insertedMatches, error: insertError } = await supabase
      .from("matches")
      .insert(previewMatches)
      .select(); // Obtener IDs insertados

    if (insertError) throw insertError;

    // 5. Obtener ligas existentes
    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("id");

    if (leaguesError || !leagues) throw leaguesError;

    const leagueId = leagues[0]?.id;

    if (!leagueId) throw new Error("No se encontró ninguna liga válida.");

    // 6. Insertar en current_match
    const currentMatchInsert = insertedMatches.map((match) => ({
      match_id: match.id,
      league_id: leagueId,
    }));

    const { error: currentMatchError } = await supabase
      .from("current_match")
      .insert(currentMatchInsert);

    if (currentMatchError) throw currentMatchError;

    // 7. Obtener jugadores activos para esa liga
    const { data: activePlayers, error: activeError } = await supabase
      .from("active_players")
      .select("player_id, team")
      .eq("league_id", leagueId);

    if (activeError) throw activeError;

    // 8. Insertar en match_players
    const allMatchPlayers: any[] = [];

    insertedMatches.forEach((match) => {
      activePlayers?.forEach((p) => {
        allMatchPlayers.push({
          match_id: match.id,
          player_id: p.player_id,
          team: p.team,
        });
      });
    });

    if (allMatchPlayers.length > 0) {
      const { error: insertPlayersError } = await supabase
        .from("match_players")
        .insert(allMatchPlayers);

      if (insertPlayersError) throw insertPlayersError;
    }

    toast.success("Partidos y jugadores guardados correctamente.");
    setMatches(insertedMatches);
    setPreviewMatches([]);
  } catch (error) {
    console.error(error);
    toast.error("Error al guardar los partidos.");
  }
};


  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-blue-900">Configurar Calendario</h3>

      <div className="bg-gray-50 rounded-xl border p-6 space-y-4 shadow-sm">
        <label className="block text-gray-700 font-medium">Juegos que debe jugar cada equipo</label>
        <input
          type="number"
          min={1}
          value={gamesPerTeam}
          onChange={(e) => setGamesPerTeam(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-60 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />

        <button
          onClick={generateMatches}
          disabled={generating}
          className="bg-green-600 text-white font-semibold px-6 py-2 rounded-full hover:bg-green-700 transition w-full md:w-auto"
        >
          {generating ? "Generando..." : "Generar Partidos"}
        </button>
      </div>

      {previewMatches.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xl font-bold text-blue-800">Partidos Generados (sin guardar)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewMatches.map((match, idx) => (
              <div
                key={idx}
                className="bg-white border rounded-xl shadow p-4 flex flex-col space-y-2 hover:shadow-md transition"
              >
                <p className="font-semibold text-blue-900">{match.team_a} vs {match.team_b}</p>
                <p className="text-sm text-gray-500">{match.match_date} - {match.match_time}</p>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition"
          >
            Guardar en Base de Datos
          </button>
        </div>
      )}

      <h3 className="text-xl font-bold text-blue-800 mt-10">Partidos Guardados</h3>
      {loading ? (
        <p className="text-center text-gray-500">Cargando...</p>
      ) : matches.length === 0 ? (
        <p className="text-center text-gray-500">No hay partidos programados aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="bg-white border rounded-xl shadow p-4 flex flex-col space-y-2 hover:shadow-md transition"
            >
              <p className="font-semibold text-blue-900">{match.team_a} vs {match.team_b}</p>
              <p className="text-sm text-gray-500">{match.match_date} - {match.match_time}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentScheduleConfig;
