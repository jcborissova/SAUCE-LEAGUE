import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link, Navigate, useParams } from "react-router-dom";

import TournamentTeamsConfig from "./TournamentTeamsConfig";
import TournamentScheduleConfig from "./TournamentScheduleConfig";
import TournamentResultsConfig from "./TournamentResultsConfig";
import TournamentPlayoffConfig from "./TournamentPlayoffConfig";
import TournamentRulesConfig from "./TournamentRulesConfig";
import SegmentedControl from "../ui/SegmentedControl";
import { supabase } from "../../lib/supabase";

type ConfigTabKey = "teams" | "schedule" | "results" | "playoffs" | "rules";

const CONFIG_TABS: Array<{ value: ConfigTabKey; label: string; helper: string }> = [
  { value: "teams", label: "Equipos", helper: "Define equipos y asigna jugadores de forma rápida." },
  { value: "schedule", label: "Calendario", helper: "Genera y guarda el calendario oficial del torneo." },
  { value: "results", label: "Resultados", helper: "Carga ganadores y estadísticas por partido." },
  { value: "playoffs", label: "Playoffs", helper: "Configura formato y genera cruces finales." },
  { value: "rules", label: "Reglamento", helper: "Asocia el PDF de reglas específico del torneo." },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TournamentConfigPage: React.FC = () => {
  const { id: tournamentId } = useParams();
  const hasValidTournamentId = Boolean(tournamentId && UUID_PATTERN.test(tournamentId));
  const [tournamentName, setTournamentName] = useState("Sauce League");
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [tournamentFound, setTournamentFound] = useState<boolean | null>(null);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ConfigTabKey>("teams");

  useEffect(() => {
    if (!hasValidTournamentId || !tournamentId) {
      setTournamentLoading(false);
      setTournamentFound(false);
      setTournamentName("Sauce League");
      return;
    }

    let cancelled = false;

    const loadTournament = async () => {
      setTournamentLoading(true);
      setTournamentFound(null);

      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select("id, name")
          .eq("id", tournamentId)
          .maybeSingle();

        if (cancelled) return;
        if (!error && data?.id) {
          setTournamentName(data.name || "Sauce League");
          setTournamentFound(true);
        } else {
          setTournamentName("Sauce League");
          setTournamentFound(false);
        }
      } catch {
        if (cancelled) return;
        setTournamentName("Sauce League");
        setTournamentFound(false);
      } finally {
        if (!cancelled) setTournamentLoading(false);
      }
    };

    loadTournament();

    return () => {
      cancelled = true;
    };
  }, [hasValidTournamentId, tournamentId]);

  useEffect(() => {
    if (activeTab !== "teams") {
      setGlobalLoading(false);
    }
  }, [activeTab]);

  const activeTabMeta = useMemo(
    () => CONFIG_TABS.find((tab) => tab.value === activeTab),
    [activeTab]
  );

  if (!tournamentId || !hasValidTournamentId) {
    return <Navigate to="/404" replace />;
  }

  if (tournamentFound === false) {
    return <Navigate to="/404" replace />;
  }

  if (tournamentLoading || tournamentFound === null) {
    return (
      <div className="w-full py-12 flex items-center justify-center">
        <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <header className="w-full">
        <div className="overflow-hidden border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))] shadow-[0_1px_0_hsl(var(--border)/0.35)]">
          <div className="h-0.5 bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--chart-2)))]" />
          <div className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--text-subtle))]">Configuración</p>
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{tournamentName}</h1>
              <p className="text-sm text-[hsl(var(--text-subtle))]">
                Administra equipos, calendario, resultados, playoffs y reglamento.
              </p>
            </div>
            <Link
              to="/tournaments"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-[6px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Volver a torneos
            </Link>
          </div>
        </div>
      </header>

      <section className="app-card space-y-4 p-4 sm:p-5">
        <div className="border-b border-[hsl(var(--border)/0.75)] pb-3 sm:pb-4">
          <SegmentedControl
            options={CONFIG_TABS.map((item) => ({ value: item.value, label: item.label }))}
            value={activeTab}
            onChange={(value) => setActiveTab(value as ConfigTabKey)}
            scrollable
          />
          <p className="mt-2 text-xs text-[hsl(var(--text-subtle))]">{activeTabMeta?.helper}</p>
        </div>

        <div className="relative pb-1 pt-2 sm:pt-3">
          {activeTab === "teams" ? <TournamentTeamsConfig tournamentId={tournamentId} setGlobalLoading={setGlobalLoading} /> : null}
          {activeTab === "schedule" ? <TournamentScheduleConfig tournamentId={tournamentId} /> : null}
          {activeTab === "results" ? <TournamentResultsConfig tournamentId={tournamentId} /> : null}
          {activeTab === "playoffs" ? <TournamentPlayoffConfig tournamentId={tournamentId} /> : null}
          {activeTab === "rules" ? <TournamentRulesConfig tournamentId={tournamentId} /> : null}

          {globalLoading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[hsl(var(--background)/0.74)] backdrop-blur-[1px]">
              <ArrowPathIcon className="h-9 w-9 animate-spin text-[hsl(var(--primary))]" />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default TournamentConfigPage;
