import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import {
  getTournamentSettings,
  saveTournamentSettings,
} from "../../services/tournamentAnalytics";
import type { TournamentSettings } from "../../types/tournament-analytics";
import {
  TOURNAMENT_RULES_PDF_URL,
  TOURNAMENT_RULES_TITLE,
} from "../../constants/tournamentRules";

type Props = {
  tournamentId: string;
};

const TournamentRulesConfig: React.FC<Props> = ({ tournamentId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TournamentSettings | null>(null);
  const [rulesUrlInput, setRulesUrlInput] = useState("");

  const normalizedRulesUrl = useMemo(() => {
    const value = rulesUrlInput.trim();
    return value.length > 0 ? value : null;
  }, [rulesUrlInput]);

  const resolvedRulesUrl = normalizedRulesUrl ?? TOURNAMENT_RULES_PDF_URL;
  const usingCustomRules = Boolean(normalizedRulesUrl);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const nextSettings = await getTournamentSettings(tournamentId);
      setSettings(nextSettings);
      setRulesUrlInput(nextSettings.rulesPdfUrl ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuración del reglamento.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const payload: TournamentSettings = {
        ...settings,
        rulesPdfUrl: normalizedRulesUrl,
      };

      await saveTournamentSettings(payload);
      setSettings(payload);
      toast.success("Reglamento del torneo actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el reglamento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="app-card space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-lg font-bold sm:text-xl">Reglamento del torneo</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Define un PDF específico por torneo. Si dejas el campo vacío, se usará el reglamento por defecto.
          </p>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-[hsl(var(--text-strong))]">URL del reglamento (PDF)</span>
          <input
            type="url"
            value={rulesUrlInput}
            onChange={(event) => setRulesUrlInput(event.target.value)}
            placeholder="https://..."
            className="input-base"
          />
          <p className="text-xs text-[hsl(var(--text-subtle))]">
            Actual: {usingCustomRules ? "Reglamento personalizado" : "Reglamento por defecto"}
          </p>
        </label>

        <div className="app-panel space-y-3 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-subtle))]">
            Vista previa / acceso rápido
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href={resolvedRulesUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full sm:w-auto">
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              Abrir PDF
            </a>
            <a href={resolvedRulesUrl} download className="btn-secondary w-full sm:w-auto">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Descargar
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setRulesUrlInput("")}
            className="btn-secondary w-full sm:w-auto"
            disabled={saving}
          >
            <DocumentTextIcon className="h-4 w-4" />
            Usar por defecto
          </button>
          <button type="button" onClick={handleSave} className="btn-primary w-full sm:w-auto" disabled={saving}>
            {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
            Guardar reglamento
          </button>
        </div>

        <p className="text-xs text-[hsl(var(--text-subtle))]">
          Título mostrado en la app: <span className="font-semibold">{TOURNAMENT_RULES_TITLE}</span>
        </p>
      </section>
    </div>
  );
};

export default TournamentRulesConfig;
