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

      if (matchError || !match) {
        throw new Error(matchError?.message ?? "No se encontró el partido.");
      }

      setTeams({ A: match.team_a ?? "Equipo A", B: match.team_b ?? "Equipo B" });
      setWinnerTeam(match.winner_team ?? "");

      const { data: participants, error: participantsError } = await supabase
        .from("match_players")
        .select("player_id, team, player:players(id, names, lastnames)")
        .eq("match_id", matchId)
        .order("team", { ascending: true });

      if (participantsError) {
        throw new Error(participantsError.message);
      }

      const rawParticipants = (participants ?? []) as any[];

      const parsedParticipants = rawParticipants
        .filter((item) => item.player_id && (item.team === "A" || item.team === "B"))
        .map((item) => ({
          playerId: item.player_id,
          teamSide: item.team as "A" | "B",
          teamName: item.team === "A" ? match.team_a : match.team_b,
          names: Array.isArray(item.player) ? item.player[0]?.names ?? "" : item.player?.names ?? "",
          lastnames: Array.isArray(item.player)
            ? item.player[0]?.lastnames ?? ""
            : item.player?.lastnames ?? "",
        }));

      if (parsedParticipants.length === 0) {
        throw new Error("Este partido no tiene participantes en match_players.");
      }

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
      });

      setPlayers(parsedParticipants);
      setStats(initialStats);
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

  const setValue = (
    playerId: number,
    key: keyof Omit<MatchPlayerStatsInput, "playerId">,
    value: string
  ) => {
    const parsed = Math.max(0, Number(value || 0));

    setStats((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? emptyLine()),
        [key]: Number.isFinite(parsed) ? parsed : 0,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!winnerTeam) {
      setErrorMessage("Selecciona el equipo ganador.");
      return;
    }

    const lines: MatchPlayerStatsInput[] = players.map((player) => ({
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
      await saveMatchStats({
        matchId,
        winnerTeam,
        playerStats: lines,
      });

      onSaved?.();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron guardar los resultados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl border bg-[hsl(var(--background))] shadow-2xl">
        <div className="border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <TrophyIcon className="w-5 h-5 text-[hsl(var(--warning))]" />
              Resultado del Partido
            </h2>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
              Carga stats avanzadas por jugador y define el ganador oficial.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-[hsl(var(--muted))]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-140px)] px-4 sm:px-6 py-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="rounded-xl border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                  {errorMessage}
                </div>
              )}

              <label className="block rounded-xl border px-3 py-2 text-sm">
                <span className="block mb-1 font-medium">Equipo ganador</span>
                <select
                  value={winnerTeam}
                  onChange={(event) => setWinnerTeam(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-[hsl(var(--background))]"
                >
                  <option value="">Seleccionar</option>
                  <option value={teams.A}>{teams.A}</option>
                  <option value={teams.B}>{teams.B}</option>
                </select>
              </label>

              {(["A", "B"] as const).map((side) => (
                <section key={side} className="rounded-2xl border bg-[hsl(var(--card))] p-3 sm:p-4 space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold">{teams[side]}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-sm border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-[hsl(var(--muted))]">
                          <th className="text-left px-2 py-2 rounded-tl-xl">Jugador</th>
                          {STAT_FIELDS.map((field) => (
                            <th key={field.key} className="px-2 py-2 text-center">
                              {field.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupedTeams[side].map((player) => (
                          <tr key={player.playerId} className="border-b border-[hsl(var(--border))]">
                            <td className="px-2 py-2 whitespace-nowrap font-medium">
                              {player.names} {player.lastnames}
                            </td>
                            {STAT_FIELDS.map((field) => (
                              <td key={`${player.playerId}-${field.key}`} className="px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={stats[player.playerId]?.[field.key] ?? 0}
                                  onChange={(event) => setValue(player.playerId, field.key, event.target.value)}
                                  className="w-16 rounded-lg border px-2 py-1 text-center bg-[hsl(var(--background))]"
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

        <div className="border-t px-4 sm:px-6 py-3 flex justify-end gap-2 bg-[hsl(var(--background))]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSubmit}
            className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar Resultado"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchResultForm;
