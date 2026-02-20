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
    <div className="space-y-4 sm:space-y-5">
      <section className="app-card space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-lg font-bold tracking-tight sm:text-xl">Calendario del torneo</h3>
          <p className="text-sm text-[hsl(var(--text-subtle))]">Genera jornadas automáticas y guarda el fixture oficial.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Equipos</p>
            <p className="text-sm font-semibold">{teams.length}</p>
          </div>
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Guardados</p>
            <p className="text-sm font-semibold">{matches.length}</p>
          </div>
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">En preview</p>
            <p className="text-sm font-semibold">{previewMatches.length}</p>
          </div>
          <div className="border bg-[hsl(var(--surface-2))] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Inicio</p>
            <p className="text-sm font-semibold">{startDate || "--"}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto] sm:items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Juegos por equipo</span>
            <input
              type="number"
              min={1}
              value={gamesPerTeam}
              onChange={(e) => setGamesPerTeam(Number(e.target.value))}
              className="input-base"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">Fecha base</span>
            <input type="text" value={startDate || "Sin fecha"} readOnly className="input-base" />
          </label>

          <button onClick={generateMatches} disabled={generating} className="btn-primary w-full sm:w-auto">
            {generating ? "Generando..." : "Generar partidos"}
          </button>
        </div>
      </section>

      {previewMatches.length > 0 ? (
        <section className="app-card space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold sm:text-lg">Partidos generados (sin guardar)</h4>
              <p className="text-sm text-[hsl(var(--text-subtle))]">Revisa el resultado antes de confirmar en base de datos.</p>
            </div>
            <button onClick={handleSave} className="btn-primary w-full sm:w-auto">
              Guardar en base de datos
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {previewMatches.map((match, idx) => (
              <article key={idx} className="border bg-[hsl(var(--surface-1))] p-3">
                <p className="text-sm font-semibold">
                  {match.team_a} <span className="text-[hsl(var(--text-subtle))]">vs</span> {match.team_b}
                </p>
                <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">
                  {match.match_date} · {match.match_time}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="app-card space-y-4 p-4 sm:p-5">
        <h4 className="text-base font-semibold sm:text-lg">Partidos guardados</h4>
        {loading ? (
          <p className="text-sm text-[hsl(var(--text-subtle))]">Cargando partidos...</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-[hsl(var(--text-subtle))]">No hay partidos programados aún.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <article key={match.id} className="border bg-[hsl(var(--surface-1))] p-3">
                <p className="text-sm font-semibold">
                  {match.team_a} <span className="text-[hsl(var(--text-subtle))]">vs</span> {match.team_b}
                </p>
                <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">
                  {match.match_date} · {match.match_time}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TournamentScheduleConfig;
