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
          match_time: index === 0 ? "17:15" : "18:15",
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

    // 5. (Opcional) asociar current_match a la primera liga disponible.
    // Esto no debe bloquear el guardado del torneo si no hay ligas creadas.
    const { data: leagues } = await supabase
      .from("leagues")
      .select("id")
      .limit(1);

    const leagueId = leagues?.[0]?.id;

    if (leagueId) {
      const currentMatchInsert = insertedMatches.map((match) => ({
        match_id: match.id,
        league_id: leagueId,
      }));

      const { error: currentMatchError } = await supabase
        .from("current_match")
        .insert(currentMatchInsert);

      if (currentMatchError) {
        console.warn("No se pudieron crear registros en current_match:", currentMatchError.message);
      }
    }

    // 6. Construir participantes del partido desde equipos del torneo (teams + team_players)
    const { data: tournamentTeams, error: tournamentTeamsError } = await supabase
      .from("teams")
      .select("name, team_players(player_id)")
      .eq("tournament_id", tournamentId);

    if (tournamentTeamsError) throw tournamentTeamsError;

    const playersByTeamName = new Map<string, number[]>();

    (tournamentTeams ?? []).forEach((team: any) => {
      const playerIds = (team.team_players ?? [])
        .map((tp: any) => Number(tp.player_id))
        .filter((playerId: number) => Number.isFinite(playerId));

      playersByTeamName.set(team.name, playerIds);
    });

    const allMatchPlayers: Array<{ match_id: number; player_id: number; team: "A" | "B" }> = [];
    const uniqueKeys = new Set<string>();

    insertedMatches.forEach((match) => {
      const teamAPlayers = playersByTeamName.get(match.team_a) ?? [];
      const teamBPlayers = playersByTeamName.get(match.team_b) ?? [];

      teamAPlayers.forEach((playerId) => {
        const uniqueKey = `${match.id}-${playerId}`;
        if (uniqueKeys.has(uniqueKey)) return;

        uniqueKeys.add(uniqueKey);
        allMatchPlayers.push({
          match_id: match.id,
          player_id: playerId,
          team: "A",
        });
      });

      teamBPlayers.forEach((playerId) => {
        const uniqueKey = `${match.id}-${playerId}`;
        if (uniqueKeys.has(uniqueKey)) return;

        uniqueKeys.add(uniqueKey);
        allMatchPlayers.push({
          match_id: match.id,
          player_id: playerId,
          team: "B",
        });
      });
    });

    if (allMatchPlayers.length > 0) {
      const chunkSize = 1000;

      for (let i = 0; i < allMatchPlayers.length; i += chunkSize) {
        const chunk = allMatchPlayers.slice(i, i + chunkSize);
        const { error: insertPlayersError } = await supabase
          .from("match_players")
          .insert(chunk);

        if (insertPlayersError) throw insertPlayersError;
      }
    }

    if (allMatchPlayers.length === 0) {
      toast.warn("Partidos guardados, pero sin jugadores asignados. Revisa la configuración de equipos.");
    } else {
      toast.success("Partidos y jugadores guardados correctamente.");
    }

    setMatches(insertedMatches);
    setPreviewMatches([]);
  } catch (error) {
    console.error(error);
    toast.error(error instanceof Error ? error.message : "Error al guardar los partidos.");
  }
};


  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold">Configurar Calendario</h3>

      <div className="app-panel p-4 sm:p-6 space-y-4">
        <label className="block text-[hsl(var(--text-strong))] font-medium">Juegos que debe jugar cada equipo</label>
        <input
          type="number"
          min={1}
          value={gamesPerTeam}
          onChange={(e) => setGamesPerTeam(Number(e.target.value))}
          className="input-base w-full md:w-60"
        />

        <button
          onClick={generateMatches}
          disabled={generating}
          className="btn-primary w-full md:w-auto rounded-full"
        >
          {generating ? "Generando..." : "Generar Partidos"}
        </button>
      </div>

      {previewMatches.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xl font-bold text-[hsl(var(--primary))]">Partidos Generados (sin guardar)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewMatches.map((match, idx) => (
              <div
                key={idx}
                className="app-card rounded-xl p-4 flex flex-col space-y-2 hover:shadow-md transition"
              >
                <p className="font-semibold">{match.team_a} vs {match.team_b}</p>
                <p className="text-sm text-[hsl(var(--text-subtle))]">{match.match_date} - {match.match_time}</p>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="btn-primary rounded-full"
          >
            Guardar en Base de Datos
          </button>
        </div>
      )}

      <h3 className="text-xl font-bold text-[hsl(var(--primary))] mt-10">Partidos Guardados</h3>
      {loading ? (
        <p className="text-center text-[hsl(var(--text-subtle))]">Cargando...</p>
      ) : matches.length === 0 ? (
        <p className="text-center text-[hsl(var(--text-subtle))]">No hay partidos programados aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="app-card rounded-xl p-4 flex flex-col space-y-2 hover:shadow-md transition"
            >
              <p className="font-semibold">{match.team_a} vs {match.team_b}</p>
              <p className="text-sm text-[hsl(var(--text-subtle))]">{match.match_date} - {match.match_time}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentScheduleConfig;
