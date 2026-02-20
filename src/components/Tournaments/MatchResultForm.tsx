/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { TrophyIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import { supabase } from "../../lib/supabase";
import { saveMatchStats } from "../../services/tournamentAnalytics";
import type { MatchPlayerStatsInput } from "../../types/tournament-analytics";

const STAT_FIELDS: Array<{ key: keyof Omit<MatchPlayerStatsInput, "playerId">; label: string }> = [
  { key: "points", label: "Pts" },
  { key: "rebounds", label: "Reb" },
  { key: "assists", label: "Ast" },
  { key: "steals", label: "Stl" },
  { key: "blocks", label: "Blk" },
  { key: "turnovers", label: "TO" },
  { key: "fouls", label: "Fls" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
];

type PlayerRow = {
  playerId: number;
  teamSide: "A" | "B";
  teamName: string;
  names: string;
  lastnames: string;
};

type Props = {
  matchId: number;
  onClose: () => void;
  onSaved?: () => void;
};

const emptyLine = (): Omit<MatchPlayerStatsInput, "playerId"> => ({
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  fgm: 0,
  fga: 0,
});

const MatchResultForm: React.FC<Props> = ({ matchId, onClose, onSaved }) => {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<{ A: string; B: string }>({ A: "", B: "" });
  const [winnerTeam, setWinnerTeam] = useState("");
  const [stats, setStats] = useState<Record<number, Omit<MatchPlayerStatsInput, "playerId">>>({});
  const [playedByPlayer, setPlayedByPlayer] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id, team_a, team_b, winner_team")
        .eq("id", matchId)
        .single();

      if (matchError || !match) throw new Error(matchError?.message ?? "No se encontró el partido.");

      setTeams({ A: match.team_a ?? "Equipo A", B: match.team_b ?? "Equipo B" });
      setWinnerTeam(match.winner_team ?? "");

      const { data: participants, error: participantsError } = await supabase
        .from("match_players")
        .select("player_id, team, player:players(id, names, lastnames)")
        .eq("match_id", matchId)
        .order("team", { ascending: true });

      if (participantsError) throw new Error(participantsError.message);

      const rawParticipants = (participants ?? []) as any[];
      const parsedParticipants = rawParticipants
        .filter((item) => item.player_id && (item.team === "A" || item.team === "B"))
        .map((item) => ({
          playerId: item.player_id,
          teamSide: item.team as "A" | "B",
          teamName: item.team === "A" ? match.team_a : match.team_b,
          names: Array.isArray(item.player) ? item.player[0]?.names ?? "" : item.player?.names ?? "",
          lastnames: Array.isArray(item.player) ? item.player[0]?.lastnames ?? "" : item.player?.lastnames ?? "",
        }));

      if (parsedParticipants.length === 0) throw new Error("Este partido no tiene participantes en match_players.");

      const { data: existingStats, error: statsError } = await supabase
        .from("player_stats")
        .select("player_id, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga")
        .eq("match_id", matchId);

      let existingRows: Array<Record<string, number>> = [];

      if (!statsError) {
        existingRows = (existingStats ?? []) as Array<Record<string, number>>;
      } else {
        const { data: legacyStats } = await supabase
          .from("player_stats")
          .select("player_id, points, rebounds, assists")
          .eq("match_id", matchId);

        existingRows = (legacyStats ?? []).map((row) => ({
          ...row,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          fgm: 0,
          fga: 0,
        }));
      }

      const initialStats: Record<number, Omit<MatchPlayerStatsInput, "playerId">> = {};
      const initialPlayed: Record<number, boolean> = {};
      const hasPersistedRows = existingRows.length > 0;

      parsedParticipants.forEach((player) => {
        const existing = existingRows.find((row) => Number(row.player_id) === player.playerId);
        initialStats[player.playerId] = {
          points: Number(existing?.points ?? 0),
          rebounds: Number(existing?.rebounds ?? 0),
          assists: Number(existing?.assists ?? 0),
          steals: Number(existing?.steals ?? 0),
          blocks: Number(existing?.blocks ?? 0),
          turnovers: Number(existing?.turnovers ?? 0),
          fouls: Number(existing?.fouls ?? 0),
          fgm: Number(existing?.fgm ?? 0),
          fga: Number(existing?.fga ?? 0),
        };
        initialPlayed[player.playerId] = hasPersistedRows ? Boolean(existing) : true;
      });

      setPlayers(parsedParticipants);
      setStats(initialStats);
      setPlayedByPlayer(initialPlayed);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el partido.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [matchId]);

  const groupedTeams = useMemo(
    () => ({
      A: players.filter((player) => player.teamSide === "A"),
      B: players.filter((player) => player.teamSide === "B"),
    }),
    [players]
  );

  const setValue = (playerId: number, key: keyof Omit<MatchPlayerStatsInput, "playerId">, value: string) => {
    const parsed = Math.max(0, Number(value || 0));

    setStats((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? emptyLine()),
        [key]: Number.isFinite(parsed) ? parsed : 0,
      },
    }));
  };

  const setPlayed = (playerId: number, checked: boolean) => {
    setPlayedByPlayer((prev) => ({
      ...prev,
      [playerId]: checked,
    }));
  };

  const handleSubmit = async () => {
    if (!winnerTeam) {
      setErrorMessage("Selecciona el equipo ganador.");
      return;
    }

    const lines: MatchPlayerStatsInput[] = players
      .filter((player) => Boolean(playedByPlayer[player.playerId]))
      .map((player) => ({
        playerId: player.playerId,
        ...(stats[player.playerId] ?? emptyLine()),
      }));

    for (const line of lines) {
      if (line.fgm > line.fga) {
        setErrorMessage(`FGM no puede ser mayor que FGA para ${line.playerId}.`);
        return;
      }
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await saveMatchStats({ matchId, winnerTeam, playerStats: lines });
      onSaved?.();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron guardar los resultados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
      <div className="h-[100dvh] w-full overflow-hidden border bg-[hsl(var(--background))] shadow-2xl sm:h-auto sm:max-h-[94vh] sm:max-w-6xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
              <TrophyIcon className="h-5 w-5 text-[hsl(var(--warning))]" />
              Resultado del partido
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] sm:text-sm">Carga stats por jugador y define el ganador.</p>
          </div>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center border" onClick={onClose} aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="soft-scrollbar max-h-[calc(100dvh-136px)] overflow-y-auto space-y-4 px-4 py-4 sm:max-h-[calc(94vh-140px)] sm:px-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
          ) : (
            <>
              {errorMessage ? (
                <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                  {errorMessage}
                </div>
              ) : null}

              <label className="block border bg-[hsl(var(--surface-1))] px-3 py-2 text-sm">
                <span className="mb-1 block font-medium">Equipo ganador</span>
                <select value={winnerTeam} onChange={(event) => setWinnerTeam(event.target.value)} className="input-base">
                  <option value="">Seleccionar</option>
                  <option value={teams.A}>{teams.A}</option>
                  <option value={teams.B}>{teams.B}</option>
                </select>
              </label>

              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Marca si el jugador participó. Solo los jugadores marcados como "Jugó" cuentan para promedios (PPP/RPP/APP) y totales.
              </p>

              {(["A", "B"] as const).map((side) => (
                <section key={side} className="space-y-3 border bg-[hsl(var(--surface-1))] p-3 sm:p-4">
                  <h3 className="text-base font-semibold sm:text-lg">{teams[side]}</h3>

                  <div className="space-y-3 md:hidden">
                    {groupedTeams[side].map((player) => (
                      <article key={player.playerId} className="border bg-[hsl(var(--surface-2))] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">
                            {player.names} {player.lastnames}
                          </p>
                          <label className="inline-flex items-center gap-1 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={Boolean(playedByPlayer[player.playerId])}
                              onChange={(event) => setPlayed(player.playerId, event.target.checked)}
                            />
                            Jugó
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {STAT_FIELDS.map((field) => (
                            <label key={`${player.playerId}-${field.key}`} className="space-y-1 text-xs">
                              <span className="text-[hsl(var(--muted-foreground))]">{field.label}</span>
                              <input
                                type="number"
                                min={0}
                                value={stats[player.playerId]?.[field.key] ?? 0}
                                onChange={(event) => setValue(player.playerId, field.key, event.target.value)}
                                disabled={!playedByPlayer[player.playerId]}
                                className={`input-base h-9 min-h-0 px-2 py-1 text-center ${
                                  !playedByPlayer[player.playerId] ? "cursor-not-allowed opacity-60" : ""
                                }`}
                              />
                            </label>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto border md:block">
                    <table className="w-full min-w-[920px] text-sm">
                      <thead>
                        <tr className="bg-[hsl(var(--muted))]">
                          <th className="px-2 py-2 text-left">Jugador</th>
                          <th className="px-2 py-2 text-center">Jugó</th>
                          {STAT_FIELDS.map((field) => (
                            <th key={field.key} className="px-2 py-2 text-center">
                              {field.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupedTeams[side].map((player) => (
                          <tr key={player.playerId} className="border-t border-[hsl(var(--border))]">
                            <td className="px-2 py-2 whitespace-nowrap font-medium">
                              {player.names} {player.lastnames}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(playedByPlayer[player.playerId])}
                                onChange={(event) => setPlayed(player.playerId, event.target.checked)}
                              />
                            </td>
                            {STAT_FIELDS.map((field) => (
                              <td key={`${player.playerId}-${field.key}`} className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={stats[player.playerId]?.[field.key] ?? 0}
                                  onChange={(event) => setValue(player.playerId, field.key, event.target.value)}
                                  disabled={!playedByPlayer[player.playerId]}
                                  className={`input-base h-9 min-h-0 w-16 px-2 py-1 text-center ${
                                    !playedByPlayer[player.playerId] ? "cursor-not-allowed opacity-60" : ""
                                  }`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" disabled={saving || loading} onClick={handleSubmit} className="btn-primary disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar resultado"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchResultForm;
