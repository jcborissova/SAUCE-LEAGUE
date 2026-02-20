import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import StatPill from "../components/ui/StatPill";
import Badge from "../components/ui/Badge";
import { useRole } from "../contexts/RoleContext";
import { supabase } from "../lib/supabase";
import {
  getLeaders,
  getTournamentSettings,
  getTournamentAnalyticsSnapshot,
  getTournamentResultsOverview,
  getTournamentResultsSummary,
} from "../services/tournamentAnalytics";
import type { TournamentLeaderRow, TournamentResultSummary } from "../types/tournament-analytics";
import { TOURNAMENT_RULES_PDF_URL } from "../constants/tournamentRules";
import leaguesHomeImage from "../assets/home/leagues-home.jpg";
import matchesHomeImage from "../assets/home/matches-home.jpg";

type TeamStandingSummary = {
  teamId: number;
  name: string;
  pj: number;
  pg: number;
  pp: number;
  winPct: number;
};

type TournamentHomeLeader = {
  name: string;
  teamName: string | null;
  totalPoints: number;
  ppp: number;
  gamesPlayed: number;
};

type TournamentHomeInsight = {
  tournamentId: string;
  tournamentName: string;
  generatedAt: string;
  headline: string;
  leaderLine: string;
  teamsLine: string;
  playfulLine: string;
  challengeLine: string;
  leader: TournamentHomeLeader | null;
  bestTeam: TeamStandingSummary | null;
  worstTeam: TeamStandingSummary | null;
  rulesPdfUrl: string;
  resultsSummary: TournamentResultSummary;
  stats: Array<{ label: string; value: string }>;
};

const getDaySeed = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return date.getFullYear() * 1000 + dayOfYear;
};

const getStringSeed = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const pickBySeed = <T,>(items: T[], seed: number, offset = 0): T => {
  return items[(seed + offset) % items.length];
};

const formatPct = (value: number) => `${(value * 100).toFixed(1)}%`;

const sortStandings = (rows: TeamStandingSummary[]) => {
  return [...rows].sort((a, b) => {
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (a.pp !== b.pp) return a.pp - b.pp;
    return a.name.localeCompare(b.name);
  });
};

const loadStandingsFromView = async (tournamentId: string): Promise<TeamStandingSummary[] | null> => {
  const { data, error } = await supabase
    .from("tournament_regular_standings")
    .select("team_id, team_name, games_played, wins, losses, win_pct")
    .eq("tournament_id", tournamentId);

  if (error) return null;

  return (data || []).map((row) => ({
    teamId: Number(row.team_id),
    name: String(row.team_name),
    pj: Number(row.games_played ?? 0),
    pg: Number(row.wins ?? 0),
    pp: Number(row.losses ?? 0),
    winPct: Number(row.win_pct ?? 0),
  }));
};

const loadStandingsFallback = async (tournamentId: string): Promise<TeamStandingSummary[]> => {
  const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
    supabase
      .from("matches")
      .select("team_a, team_b, winner_team")
      .eq("tournament_id", tournamentId)
      .not("winner_team", "is", null),
  ]);

  if (teamsError) throw new Error(teamsError.message);
  if (matchesError) throw new Error(matchesError.message);

  const grouped = new Map<string, TeamStandingSummary>();

  (teams || []).forEach((team) => {
    grouped.set(team.name, {
      teamId: Number(team.id),
      name: String(team.name),
      pj: 0,
      pg: 0,
      pp: 0,
      winPct: 0,
    });
  });

  (matches || []).forEach((match) => {
    const teamA = grouped.get(String(match.team_a));
    const teamB = grouped.get(String(match.team_b));
    if (!teamA || !teamB) return;

    teamA.pj += 1;
    teamB.pj += 1;

    if (match.winner_team === match.team_a) {
      teamA.pg += 1;
      teamB.pp += 1;
    } else if (match.winner_team === match.team_b) {
      teamB.pg += 1;
      teamA.pp += 1;
    }
  });

  return Array.from(grouped.values()).map((team) => ({
    ...team,
    winPct: team.pj > 0 ? team.pg / team.pj : 0,
  }));
};

const loadTeamStandings = async (tournamentId: string): Promise<TeamStandingSummary[]> => {
  const fromView = await loadStandingsFromView(tournamentId);
  if (fromView) return fromView;
  return loadStandingsFallback(tournamentId);
};

const toLeaderInsight = (row: TournamentLeaderRow | undefined): TournamentHomeLeader | null => {
  if (!row) return null;

  return {
    name: row.name,
    teamName: row.teamName,
    totalPoints: row.totals.points,
    ppp: row.perGame.ppg,
    gamesPlayed: row.gamesPlayed,
  };
};

const toGeneratedDate = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return formatter.format(date);
};

const buildTournamentInsight = ({
  tournamentId,
  tournamentName,
  leaderRow,
  standings,
  summary,
  rulesPdfUrl,
}: {
  tournamentId: string;
  tournamentName: string;
  leaderRow: TournamentLeaderRow | undefined;
  standings: TeamStandingSummary[];
  summary: TournamentResultSummary;
  rulesPdfUrl: string | null;
}): TournamentHomeInsight => {
  const now = new Date();
  const seed = getDaySeed(now) + getStringSeed(tournamentId);
  const leader = toLeaderInsight(leaderRow);
  const sortedStandings = sortStandings(standings);
  const bestTeam = sortedStandings[0] ?? null;
  const worstTeam = sortedStandings.length > 1 ? sortedStandings[sortedStandings.length - 1] : null;

  const leaderName = leader?.name ?? "Sin líder confirmado";
  const bestName = bestTeam?.name ?? "tabla sin datos";
  const worstName = worstTeam?.name ?? "sin fondo definido";

  const headlineOptions = [
    `Radar de jornada: ${leaderName} marca el ritmo y la tabla se aprieta.`,
    `Reporte Sauce League: ${bestName} llega sólido y la pelea por escalar está viva.`,
    `Lectura rápida: hay margen para sorpresas si cierran bien el último cuarto.`,
    `Panorama del torneo: liderazgo claro arriba y presión total en la parte baja.`,
  ];

  const playfulOptions = [
    leader
      ? `Jocoso del día: ${leader.name} anda en modo microondas con ${leader.ppp.toFixed(1)} PPP.`
      : "Jocoso del día: el líder está escondido, pero la próxima carga de stats lo delata.",
    `Termómetro de camerino: ${bestName} está fino, ${worstName} promete remontada con música de película.`,
    `Dato picante: promedio de ${summary.avgPoints.toFixed(1)} puntos por juego, hoy no se baja el ritmo.`,
    `Reporte de pasillo: si no cierran rebote, la tabla te pasa factura en 24 horas.`,
  ];

  const challengeOptions = [
    bestTeam && worstTeam
      ? `Distancia entre cima y fondo: ${(Math.max(0, bestTeam.winPct - worstTeam.winPct) * 100).toFixed(1)} pts de win%.`
      : "El reto del día: convertir cada posesión en puntos seguros para mover la tabla.",
    leader
      ? `${leader.name} suma ${leader.totalPoints} puntos totales; el reto es bajarlo del trono.`
      : "No hay líder de puntos definitivo todavía: gran oportunidad para romper la tabla.",
    `Se han jugado ${summary.playedMatches} partidos, con ${summary.matchesWithStats} cargados con estadísticas completas.`,
    "La lectura premium sigue simple: defensa, rebote y ejecución en cierre.",
  ];

  const leaderLine = leader
    ? `${leader.name}${leader.teamName ? ` (${leader.teamName})` : ""} lidera en puntos con ${leader.totalPoints} totales y ${leader.ppp.toFixed(1)} PPP en ${leader.gamesPlayed} juego(s).`
    : "Todavía no hay líder de puntos disponible. Sube resultados con estadísticas para activar este ranking.";

  const teamsLine =
    bestTeam && worstTeam
      ? `${bestTeam.name} es el mejor equipo hasta ahora (${bestTeam.pg}-${bestTeam.pp}, ${formatPct(bestTeam.winPct)}). ${worstTeam.name} va último (${worstTeam.pg}-${worstTeam.pp}, ${formatPct(worstTeam.winPct)}).`
      : bestTeam
      ? `${bestTeam.name} lidera la tabla con ${formatPct(bestTeam.winPct)} de victorias.`
      : "Aún no hay suficientes resultados para definir mejor y peor equipo.";

  return {
    tournamentId,
    tournamentName,
    generatedAt: toGeneratedDate(now),
    headline: pickBySeed(headlineOptions, seed),
    leaderLine,
    teamsLine,
    playfulLine: pickBySeed(playfulOptions, seed, 3),
    challengeLine: pickBySeed(challengeOptions, seed, 5),
    leader,
    bestTeam,
    worstTeam,
    rulesPdfUrl: rulesPdfUrl ?? TOURNAMENT_RULES_PDF_URL,
    resultsSummary: summary,
    stats: [
      { label: "Partidos", value: String(summary.playedMatches) },
      { label: "Puntos totales", value: String(summary.totalPoints) },
      { label: "PPP líder", value: leader ? leader.ppp.toFixed(1) : "--" },
      { label: "Mejor win%", value: bestTeam ? formatPct(bestTeam.winPct) : "--" },
    ],
  };
};

const Home: React.FC = () => {
  const { role } = useRole();

  if (role === "visor") {
    return <TournamentModeHome />;
  }

  return <AdminModeHome />;
};

const TournamentModeHome = () => {
  const [insight, setInsight] = useState<TournamentHomeInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data: tournaments, error } = await supabase
          .from("tournaments")
          .select("id, name")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw new Error(error.message);

        const currentTournament = tournaments?.[0];
        if (!currentTournament) {
          if (!cancelled) setInsight(null);
          return;
        }

        const tournamentId = String(currentTournament.id);
        const tournamentName = String(currentTournament.name ?? "Torneo activo");

        const [leaderResult, snapshotResult, matchesResult, standingsResult, settingsResult] = await Promise.allSettled([
          getLeaders({ tournamentId, phase: "regular", metric: "points", limit: 1 }),
          getTournamentAnalyticsSnapshot(tournamentId, "regular"),
          getTournamentResultsOverview(tournamentId),
          loadTeamStandings(tournamentId),
          getTournamentSettings(tournamentId),
        ]);

        const leaders = leaderResult.status === "fulfilled" ? leaderResult.value : [];
        const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
        const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
        const standings =
          standingsResult.status === "fulfilled"
            ? standingsResult.value
            : snapshot
            ? Object.entries(snapshot.teamFactors).map(([name, winPct], index) => ({
                teamId: index + 1,
                name,
                pj: 0,
                pg: 0,
                pp: 0,
                winPct: Number(winPct ?? 0),
              }))
            : [];

        const rulesPdfUrl =
          settingsResult.status === "fulfilled" ? settingsResult.value.rulesPdfUrl : null;

        const summary = getTournamentResultsSummary(matches);
        const nextInsight = buildTournamentInsight({
          tournamentId,
          tournamentName,
          leaderRow: leaders[0],
          standings,
          summary,
          rulesPdfUrl,
        });

        if (!cancelled) setInsight(nextInsight);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el panel informativo del torneo.");
          setInsight(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const heroTitle = insight?.tournamentName ?? "Sauce League Live";
  const heroHeadline = insight?.headline ?? "Generando lectura del torneo...";
  const heroPlayfulLine = insight?.playfulLine ?? "Preparando datos atractivos del torneo.";
  const heroGeneratedAt = insight?.generatedAt ?? "hoy";

  const heroStats = useMemo(() => {
    if (insight) return insight.stats;
    return [
      { label: "Partidos", value: "--" },
      { label: "Puntos totales", value: "--" },
      { label: "PPP líder", value: "--" },
      { label: "Mejor win%", value: "--" },
    ];
  }, [insight]);

  return (
    <PageShell>
      <section className="overflow-hidden border bg-[hsl(var(--surface-1))]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">Modo torneo</Badge>
              <Badge>Insights generados</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{heroTitle}</h1>
              <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
                Panel informativo del torneo con líder de puntos, lectura de equipos y datos jocosos en lenguaje simple.
              </p>
            </div>

            <div className="border-l-2 border-[hsl(var(--primary)/0.55)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">
                Generado para hoy
              </p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] sm:text-[15px]">
                {heroGeneratedAt}: {heroHeadline}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {heroStats.map((item) => (
                <StatPill key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
                Ver torneo
              </Link>
              <Link to="/matches" className="btn-secondary w-full sm:w-auto">
                Ver resultados
              </Link>
              <button
                type="button"
                onClick={() => setRefreshTick((value) => value + 1)}
                className="btn-secondary w-full sm:w-auto"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>
          </div>

          <div className="border-t bg-[hsl(var(--surface-2)/0.56)] p-3 sm:p-4 lg:border-l lg:border-t-0">
            <div className="grid h-full grid-cols-1 gap-2 sm:gap-3">
              <article className="relative col-span-2 min-h-[148px] overflow-hidden border sm:min-h-[170px]">
                <img
                  src={matchesHomeImage}
                  alt="Seguimiento de jornada del torneo"
                  loading="eager"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/80">Reporte rápido</p>
                  <p className="text-base font-bold sm:text-xl">{heroPlayfulLine}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <section key={index} className="app-card animate-pulse p-5">
              <div className="h-4 w-28 bg-[hsl(var(--surface-3))]" />
              <div className="mt-3 h-3 w-full bg-[hsl(var(--surface-3))]" />
              <div className="mt-2 h-3 w-4/5 bg-[hsl(var(--surface-3))]" />
            </section>
          ))}
        </section>
      ) : null}

      {!loading && errorMessage ? (
        <SectionCard title="Panel informativo no disponible" description="No se pudo cargar el resumen del torneo en este momento.">
          <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{errorMessage}</p>
            <button className="btn-secondary w-full sm:w-auto" onClick={() => setRefreshTick((value) => value + 1)}>
              Reintentar
            </button>
          </div>
        </SectionCard>
      ) : null}

      {!loading && !errorMessage && !insight ? (
        <SectionCard title="Sin torneos disponibles" description="Crea o habilita un torneo para mostrar el panel informativo.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
              Ver torneos
            </Link>
          </div>
        </SectionCard>
      ) : null}

      {!loading && !errorMessage && insight ? (
        <>
          <section className="grid gap-3 lg:grid-cols-3">
            <SectionCard title="Líder en puntos" description="Quién está mandando en anotación">
              <div className="space-y-2">
                <p className="text-sm text-[hsl(var(--text-strong))]">{insight.leaderLine}</p>
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  Partidos con stats: {insight.resultsSummary.matchesWithStats} de {insight.resultsSummary.playedMatches}
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Mejor y peor equipo" description="Lectura clara de la tabla regular">
              <div className="space-y-2">
                <p className="text-sm text-[hsl(var(--text-strong))]">{insight.teamsLine}</p>
                <p className="text-xs text-[hsl(var(--text-subtle))]">{insight.challengeLine}</p>
              </div>
            </SectionCard>

            <SectionCard title="Lectura jocosa" description="Contenido generado para animar la competencia">
              <div className="space-y-2">
                <p className="text-sm text-[hsl(var(--text-strong))]">{insight.playfulLine}</p>
                <p className="text-xs text-[hsl(var(--text-subtle))]">
                  Promedio general: {insight.resultsSummary.avgPoints.toFixed(1)} puntos por partido.
                </p>
              </div>
            </SectionCard>
          </section>

          <SectionCard title="Acceso de consulta" description="Solo vistas de seguimiento del torneo">
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-[var(--radius)] border bg-[hsl(var(--surface-2)/0.65)] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(var(--primary))]" />
                <p>
                  Este home en modo torneo muestra información real + textos generados. Para ver todo el detalle oficial entra al módulo de torneos.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link to={`/tournaments/view/${insight.tournamentId}`} className="btn-primary w-full sm:w-auto">
                  Abrir torneo actual
                </Link>
                <Link to="/tournaments" className="btn-secondary w-full sm:w-auto">
                  Ver todos los torneos
                </Link>
                <a href={insight.rulesPdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full sm:w-auto">
                  <DocumentTextIcon className="h-4 w-4" />
                  Reglamento
                </a>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </PageShell>
  );
};

const AdminModeHome = () => {
  return (
    <PageShell>
      <section className="overflow-hidden border bg-[hsl(var(--surface-1))]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">Temporada activa</Badge>
              <Badge>Control central</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Sauce League</h1>
              <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
                Gestiona ligas y torneos de baloncesto con un flujo operativo claro: quintetos, marcador en vivo, resultados y líderes.
              </p>
            </div>

            <div className="border-l-2 border-[hsl(var(--primary)/0.55)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-subtle))]">Objetivo</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] sm:text-[15px]">
                Estandarizar la operación del torneo en un panel móvil-first, minimizando pasos para registrar partidos y tomar decisiones rápidas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatPill label="Roster" value="24" />
              <StatPill label="Partidos" value="132" />
              <StatPill label="Ligas" value="4" />
              <StatPill label="Torneos" value="2" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link to="/tournaments" className="btn-primary w-full sm:w-auto">
                Ver torneo
              </Link>
              <Link to="/leagues" className="btn-secondary w-full sm:w-auto">
                Gestionar liga
              </Link>
            </div>
          </div>

          <div className="border-t bg-[hsl(var(--surface-2)/0.56)] p-3 sm:p-4 lg:border-l lg:border-t-0">
            <div className="grid h-full grid-cols-2 gap-2 sm:gap-3">
              <article className="relative col-span-2 min-h-[148px] overflow-hidden border sm:min-h-[170px]">
                <img
                  src={leaguesHomeImage}
                  alt="Vista de gestión de ligas"
                  loading="eager"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/80">Operación</p>
                  <p className="text-base font-bold sm:text-xl">Control total de liga en tiempo real</p>
                </div>
              </article>

              <article className="relative min-h-[104px] overflow-hidden border sm:min-h-[128px]">
                <img src={matchesHomeImage} alt="Calendario y resultados" loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/12 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                  <p className="text-xs font-semibold">Resultados</p>
                </div>
              </article>

              <article className="grid min-h-[104px] place-content-center border bg-[hsl(var(--surface-1))] p-3 text-center sm:min-h-[128px]">
                <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--text-subtle))]">Experiencia</p>
                <p className="mt-1 text-sm font-semibold sm:text-base">Simple, rápida y profesional</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Pensada para organizar torneos sin fricción.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HomeFeatureTile
          icon={<UserGroupIcon className="h-6 w-6" />}
          title="Jugadores"
          text="Registro, edición, búsqueda y control de roster."
          link="/players"
          cta="Abrir jugadores"
          visualStyle="data"
        />
        <HomeFeatureTile
          icon={<TrophyIcon className="h-6 w-6" />}
          title="Ligas"
          text="Gestión de cola, quintetos, invitados y partido actual."
          link="/leagues"
          cta="Abrir ligas"
          imageSrc={leaguesHomeImage}
          imageAlt="Panel de ligas"
          visualStyle="image"
        />
        <HomeFeatureTile
          icon={<CalendarDaysIcon className="h-6 w-6" />}
          title="Torneos"
          text="Calendario, resultados, posiciones y analíticas del torneo."
          link="/tournaments"
          cta="Abrir torneos"
          imageSrc={matchesHomeImage}
          imageAlt="Panel de torneos y partidos"
          visualStyle="image"
        />
      </section>
    </PageShell>
  );
};

const HomeFeatureTile = ({
  icon,
  title,
  text,
  link,
  cta,
  imageSrc,
  imageAlt,
  visualStyle,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  link: string;
  cta: string;
  imageSrc?: string;
  imageAlt?: string;
  visualStyle: "image" | "data";
}) => (
  <SectionCard className="space-y-0 overflow-hidden p-0">
    {visualStyle === "image" && imageSrc ? (
      <div className="relative h-36 w-full border-b sm:h-40">
        <img src={imageSrc} alt={imageAlt ?? title} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/18 to-transparent" />
        <div className="absolute bottom-2 left-3 inline-flex h-9 w-9 items-center justify-center border border-white/45 bg-black/28 text-white backdrop-blur-sm">
          {icon}
        </div>
      </div>
    ) : (
      <div className="border-b bg-[hsl(var(--surface-2)/0.85)] p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Activos</p>
            <p className="text-base font-bold tabular-nums">24</p>
          </div>
          <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Equipos</p>
            <p className="text-base font-bold tabular-nums">8</p>
          </div>
          <div className="border bg-[hsl(var(--surface-1))] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Invitados</p>
            <p className="text-base font-bold tabular-nums">5</p>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center border bg-[hsl(var(--surface-2))] text-[hsl(var(--primary))]">
          {icon}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{text}</p>
      <Link to={link} className="btn-secondary inline-flex min-w-[170px] gap-2">
        {cta}
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  </SectionCard>
);

export default Home;
