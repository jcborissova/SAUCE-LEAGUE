import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  SparklesIcon,
  TrophyIcon,
} from "@heroicons/react/24/solid";
import TournamentPlayoffOverview from "./TournamentPlayoffOverview";
import {
  generatePlayoffs,
  getTournamentSettings,
  saveTournamentSettings,
} from "../../services/tournamentAnalytics";
import type { TournamentSettings } from "../../types/tournament-analytics";
import AppSelect from "../ui/AppSelect";

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
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [editor, setEditor] = useState<PlayoffEditorState>(defaultEditorState);
  const [rulesPdfUrl, setRulesPdfUrl] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getTournamentSettings(tournamentId);
      setEditor(parseFromSettings(settings));
      setRulesPdfUrl(settings.rulesPdfUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la configuración de playoffs.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
  const normalizedHandicapTopSeed = Math.max(1, Math.floor(editor.handicapTopSeed));
  const normalizedHandicapBottomSeed = Math.max(1, Math.floor(editor.handicapBottomSeed));
  const normalizedSemiBestOf = toOddBestOf(editor.semiBestOf);
  const normalizedFinalsBestOf = toOddBestOf(editor.finalsBestOf);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTournamentSettings({
        tournamentId,
        seasonType: editor.seasonType,
        playoffFormat: finalFormat,
        rulesPdfUrl,
      });
      toast.success("Configuración de playoffs guardada.");
      setConfirmGenerateOpen(false);
      setRefreshToken((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePlayoffs(tournamentId);
      toast.success("Playoffs generados correctamente.");
      setConfirmGenerateOpen(false);
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
    <div className="space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-[16px] border border-[hsl(var(--border)/0.82)] bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2)/0.44)_100%)] shadow-[0_1px_0_hsl(var(--border)/0.32)]">
        <div className="pointer-events-none h-0.5 bg-[linear-gradient(90deg,#0ea5e9,rgba(14,165,233,0.08),#f59e0b)]" />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/24 bg-[#f59e0b]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b45309] dark:text-[#fcd34d]">
                Postseason Design
              </div>
              <h3 className="mt-3 text-lg font-bold tracking-tight sm:text-xl">Configuración de playoffs</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Ajusta cómo la temporada regular alimenta la llave final. La generación usa la tabla oficial para sembrar y
                luego aplica reglas diferenciadas por serie.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-[#38bdf8]/24 bg-[#0ea5e9]/10 px-3 py-1 text-[#0369a1] dark:text-[#7dd3fc]">
                  Siembra desde regular season
                </span>
                <span className="rounded-full border border-[#f59e0b]/24 bg-[#f59e0b]/10 px-3 py-1 text-[#b45309] dark:text-[#fcd34d]">
                  Bracket configurable
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <article className="rounded-[14px] border border-[#38bdf8]/24 bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(14,165,233,0.04))] px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0369a1] dark:text-[#7dd3fc]">Fase regular</p>
                <p className="mt-1 text-base font-semibold">Top 4</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">La tabla define cruces y ventaja inicial.</p>
              </article>
              <article className="rounded-[14px] border border-[#f59e0b]/24 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(245,158,11,0.04))] px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b45309] dark:text-[#fcd34d]">Serie 1vN</p>
                <p className="mt-1 text-base font-semibold">{normalizedHandicapTopSeed}-{normalizedHandicapBottomSeed}</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Handicap para abrir la llave.</p>
              </article>
              <article className="rounded-[14px] border border-[#fb923c]/24 bg-[linear-gradient(180deg,rgba(249,115,22,0.14),rgba(249,115,22,0.04))] px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c2410c] dark:text-[#fdba74]">Serie 2v3</p>
                <p className="mt-1 text-base font-semibold">Best of {normalizedSemiBestOf}</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Cruce más parejo del cuadro.</p>
              </article>
              <article className="rounded-[14px] border border-[#22c55e]/24 bg-[linear-gradient(180deg,rgba(34,197,94,0.14),rgba(34,197,94,0.04))] px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#15803d] dark:text-[#86efac]">Finals</p>
                <p className="mt-1 text-base font-semibold">Best of {normalizedFinalsBestOf}</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Definición del campeón.</p>
              </article>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-3">
              <article className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#38bdf8]/24 bg-[#0ea5e9]/10 text-[#0369a1] dark:text-[#7dd3fc]">
                    <ChartBarIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Fuente competitiva</p>
                    <p className="text-xs text-[hsl(var(--text-subtle))]">Cómo se habilita la fase final</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="flex min-h-[52px] items-center gap-3 rounded-[12px] border bg-[hsl(var(--surface-2)/0.58)] px-3 py-3">
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
                    <div>
                      <span className="block text-sm font-medium">Habilitar playoffs</span>
                      <span className="text-xs text-[hsl(var(--text-subtle))]">
                        Activa la fase de eliminación para este torneo.
                      </span>
                    </div>
                  </label>

                  <label className="rounded-[12px] border bg-[hsl(var(--surface-2)/0.58)] px-3 py-3 text-sm">
                    <span className="font-medium">Tipo de temporada</span>
                    <AppSelect
                      value={editor.seasonType}
                      onChange={(event) =>
                        setEditor((prev) => ({
                          ...prev,
                          seasonType: event.target.value as "regular_only" | "regular_plus_playoffs",
                        }))
                      }
                      className="select-base mt-2"
                    >
                      <option value="regular_plus_playoffs">Regular + Playoffs</option>
                      <option value="regular_only">Solo Regular</option>
                    </AppSelect>
                  </label>
                </div>
              </article>

              <article className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#f59e0b]/24 bg-[#f59e0b]/10 text-[#b45309] dark:text-[#fcd34d]">
                    <SparklesIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Lectura final del formato</p>
                    <p className="text-xs text-[hsl(var(--text-subtle))]">Resumen del cuadro que vas a generar</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <p className="rounded-[12px] border bg-[hsl(var(--surface-2)/0.58)] px-3 py-2.5">
                    Seed #1 vs Seed #4 con ventaja inicial <span className="font-semibold text-[hsl(var(--foreground))]">{normalizedHandicapTopSeed}-{normalizedHandicapBottomSeed}</span>.
                  </p>
                  <p className="rounded-[12px] border bg-[hsl(var(--surface-2)/0.58)] px-3 py-2.5">
                    Seed #2 vs Seed #3 en <span className="font-semibold text-[hsl(var(--foreground))]">Best of {normalizedSemiBestOf}</span>.
                  </p>
                  <p className="rounded-[12px] border bg-[hsl(var(--surface-2)/0.58)] px-3 py-2.5">
                    Final configurada como <span className="font-semibold text-[hsl(var(--foreground))]">Best of {normalizedFinalsBestOf}</span>.
                  </p>
                </div>
              </article>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] px-4 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#38bdf8]/24 bg-[#0ea5e9]/10 text-[#0369a1] dark:text-[#7dd3fc]">
                    <ChartBarIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">1vN: victorias top seed</span>
                </div>
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
                  className="input-base mt-3 w-full"
                />
              </label>

              <label className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] px-4 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#fb923c]/24 bg-[#f97316]/10 text-[#c2410c] dark:text-[#fdba74]">
                    <BoltIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">1vN: victorias seed bajo</span>
                </div>
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
                  className="input-base mt-3 w-full"
                />
              </label>

              <label className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] px-4 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#f59e0b]/24 bg-[#f59e0b]/10 text-[#b45309] dark:text-[#fcd34d]">
                    <TrophyIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">Serie 2v3 (Best Of)</span>
                </div>
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
                  className="input-base mt-3 w-full"
                />
              </label>

              <label className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] px-4 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#22c55e]/24 bg-[#22c55e]/10 text-[#15803d] dark:text-[#86efac]">
                    <TrophyIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">Finals (Best Of)</span>
                </div>
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
                  className="input-base mt-3 w-full"
                />
              </label>
            </div>
          </div>

          {!editor.enabled || editor.seasonType === "regular_only" ? (
            <div className="rounded-[14px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2)/0.62)] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
              {editor.seasonType === "regular_only"
                ? "La temporada está en modo solo regular. El botón para generar playoffs permanecerá deshabilitado."
                : "Los playoffs están desactivados. Puedes guardar la configuración sin generar cruces."}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              El bracket se genera con la tabla regular vigente y crea series más calendario base.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-secondary w-full sm:w-auto"
              >
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
                Guardar configuración
              </button>
              <button
                type="button"
                onClick={() => setConfirmGenerateOpen(true)}
                disabled={generating || !editor.enabled || editor.seasonType === "regular_only"}
                className="btn-primary w-full sm:w-auto disabled:opacity-60"
              >
                <BoltIcon className="w-4 h-4" />
                Generar Playoffs
              </button>
            </div>
          </div>

          {confirmGenerateOpen ? (
            <div className="space-y-3 rounded-[14px] border border-[#f59e0b]/24 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04))] p-4">
              <p className="text-sm text-[hsl(var(--foreground))]">
                Se crearán series y partidos de playoffs usando la siembra final del torneo.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmGenerateOpen(false)}
                  className="btn-secondary w-full sm:w-auto"
                  disabled={generating}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-primary w-full sm:w-auto disabled:opacity-60"
                >
                  {generating ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BoltIcon className="w-4 h-4" />}
                  Confirmar generación
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <TournamentPlayoffOverview key={refreshToken} tournamentId={tournamentId} />
    </div>
  );
};

export default TournamentPlayoffConfig;
