import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ArrowPathIcon, BoltIcon } from "@heroicons/react/24/solid";
import TournamentPlayoffOverview from "./TournamentPlayoffOverview";
import {
  generatePlayoffs,
  getTournamentSettings,
  saveTournamentSettings,
} from "../../services/tournamentAnalytics";
import type { TournamentSettings } from "../../types/tournament-analytics";

type Props = {
  tournamentId: string;
};

type PlayoffEditorState = {
  enabled: boolean;
  seasonType: "regular_only" | "regular_plus_playoffs";
  handicapTopSeed: number;
  handicapBottomSeed: number;
  semiBestOf: number;
  finalsBestOf: number;
};

const defaultEditorState: PlayoffEditorState = {
  enabled: true,
  seasonType: "regular_plus_playoffs",
  handicapTopSeed: 1,
  handicapBottomSeed: 2,
  semiBestOf: 3,
  finalsBestOf: 3,
};

const parseFromSettings = (settings: TournamentSettings): PlayoffEditorState => {
  const rounds = settings.playoffFormat?.rounds ?? [];
  const round1 = rounds.find((round) => round.name.toLowerCase().includes("round"));
  const finalsRound = rounds.find((round) => round.name.toLowerCase().includes("final"));

  const handicap = round1?.series?.find((series) => series["type"] === "handicap") as
    | { targetWins?: { topSeed?: number; bottomSeed?: number } }
    | undefined;

  const semiBestOfSeries = round1?.series?.find((series) => series["pairing"] === "2v3") as
    | { bestOf?: number }
    | undefined;

  const finalsBestOfSeries = finalsRound?.series?.[0] as { bestOf?: number } | undefined;

  return {
    enabled: Boolean(settings.playoffFormat?.enabled ?? true),
    seasonType: settings.seasonType,
    handicapTopSeed: handicap?.targetWins?.topSeed ?? 1,
    handicapBottomSeed: handicap?.targetWins?.bottomSeed ?? 2,
    semiBestOf: semiBestOfSeries?.bestOf ?? 3,
    finalsBestOf: finalsBestOfSeries?.bestOf ?? 3,
  };
};

const toOddBestOf = (value: number): number => {
  const safe = Math.max(1, Math.floor(value));
  return safe % 2 === 0 ? safe + 1 : safe;
};

const TournamentPlayoffConfig: React.FC<Props> = ({ tournamentId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [editor, setEditor] = useState<PlayoffEditorState>(defaultEditorState);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await getTournamentSettings(tournamentId);
      setEditor(parseFromSettings(settings));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la configuración de playoffs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [tournamentId]);

  const finalFormat = useMemo(
    () => ({
      enabled: editor.enabled,
      format: "custom_1vN_handicap_2v3_bo3_finals_bo3",
      rounds: [
        {
          name: "Round 1",
          series: [
            {
              pairing: "1vN",
              type: "handicap",
              targetWins: {
                topSeed: Math.max(1, Math.floor(editor.handicapTopSeed)),
                bottomSeed: Math.max(1, Math.floor(editor.handicapBottomSeed)),
              },
            },
            {
              pairing: "2v3",
              type: "bestOf",
              bestOf: toOddBestOf(editor.semiBestOf),
            },
          ],
        },
        {
          name: "Finals",
          series: [
            {
              pairing: "Winners",
              type: "bestOf",
              bestOf: toOddBestOf(editor.finalsBestOf),
            },
          ],
        },
      ],
    }),
    [editor]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTournamentSettings({
        tournamentId,
        seasonType: editor.seasonType,
        playoffFormat: finalFormat,
      });
      toast.success("Configuración de playoffs guardada.");
      setRefreshToken((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!window.confirm("Se crearán series y partidos de playoffs usando la siembra final. ¿Deseas continuar?")) {
      return;
    }

    setGenerating(true);
    try {
      await generatePlayoffs(tournamentId);
      toast.success("Playoffs generados correctamente.");
      setRefreshToken((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron generar los playoffs.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-[hsl(var(--card))] p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold">Configuración de Playoffs</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Ajusta reglas de handicap y formato de series. La generación usa top 4 de la tabla regular.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 rounded-xl border px-3 py-2">
            <input
              type="checkbox"
              checked={editor.enabled}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  enabled: event.target.checked,
                }))
              }
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">Habilitar playoffs</span>
          </label>

          <label className="rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">Tipo de temporada</span>
            <select
              value={editor.seasonType}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  seasonType: event.target.value as "regular_only" | "regular_plus_playoffs",
                }))
              }
              className="rounded-lg border px-2 py-1 bg-[hsl(var(--background))]"
            >
              <option value="regular_plus_playoffs">Regular + Playoffs</option>
              <option value="regular_only">Solo Regular</option>
            </select>
          </label>

          <label className="rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">1vN: victorias top seed</span>
            <input
              type="number"
              min={1}
              value={editor.handicapTopSeed}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  handicapTopSeed: Number(event.target.value),
                }))
              }
              className="w-20 rounded-lg border px-2 py-1 text-center bg-[hsl(var(--background))]"
            />
          </label>

          <label className="rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">1vN: victorias seed bajo</span>
            <input
              type="number"
              min={1}
              value={editor.handicapBottomSeed}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  handicapBottomSeed: Number(event.target.value),
                }))
              }
              className="w-20 rounded-lg border px-2 py-1 text-center bg-[hsl(var(--background))]"
            />
          </label>

          <label className="rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">Serie 2v3 (Best Of)</span>
            <input
              type="number"
              min={1}
              step={2}
              value={editor.semiBestOf}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  semiBestOf: Number(event.target.value),
                }))
              }
              className="w-20 rounded-lg border px-2 py-1 text-center bg-[hsl(var(--background))]"
            />
          </label>

          <label className="rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">Finals (Best Of)</span>
            <input
              type="number"
              min={1}
              step={2}
              value={editor.finalsBestOf}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  finalsBestOf: Number(event.target.value),
                }))
              }
              className="w-20 rounded-lg border px-2 py-1 text-center bg-[hsl(var(--background))]"
            />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))] disabled:opacity-60"
          >
            {saving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
            Guardar configuración
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !editor.enabled || editor.seasonType === "regular_only"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60"
          >
            {generating ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BoltIcon className="w-4 h-4" />}
            Generar Playoffs
          </button>
        </div>
      </div>

      <TournamentPlayoffOverview key={refreshToken} tournamentId={tournamentId} />
    </div>
  );
};

export default TournamentPlayoffConfig;
