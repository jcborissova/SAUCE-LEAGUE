import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, EyeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";

import {
  getTournamentPlayerDetailFast,
  getTournamentPlayerLinesFast,
} from "../../services/tournamentAnalytics";
import type { PlayerStatsLine, TournamentPhaseFilter } from "../../types/tournament-analytics";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import PlayerAnalyticsModal, { type PlayerAnalyticsDetail } from "./analytics/PlayerAnalyticsModal";
import type { Player } from "../../types/player";
import { derivePlayerGradeFromProfile, type PlayerGradeDisplay } from "../../utils/player-grade";
import { round2 } from "../../utils/tournament-stats";

type Team = {
  id: number;
  name: string;
  players: Player[];
};

type TournamentPlayersGalleryProps = {
  tournamentId: string;
  teams: Team[];
  loading?: boolean;
  statsPhase?: TournamentPhaseFilter;
  followedPlayerIds?: number[];
  onToggleFollowPlayer?: (playerId: number) => void;
};

type PlayersViewMode = "gallery" | "list";

type PlayerCardModel = {
  id: number;
  fullName: string;
  backJerseyName: string;
  photo?: string;
  role: string;
  jersey: string;
  teamId: number;
  teamName: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toSafeText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const compareByText = (a: unknown, b: unknown): number =>
  toSafeText(a).localeCompare(toSafeText(b), "es", { sensitivity: "base" });

const TournamentPlayersGallery: React.FC<TournamentPlayersGalleryProps> = ({
  tournamentId,
  teams,
  loading = false,
  statsPhase = "all",
  followedPlayerIds = [],
  onToggleFollowPlayer,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<PlayersViewMode>("gallery");
  const [phaseLines, setPhaseLines] = useState<PlayerStatsLine[]>([]);
  const [phaseLinesLoading, setPhaseLinesLoading] = useState(false);
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [playerDetailLoading, setPlayerDetailLoading] = useState(false);
  const [playerDetailError, setPlayerDetailError] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerAnalyticsDetail | null>(null);
  const [lastSelectedPlayer, setLastSelectedPlayer] = useState<{
    playerId: number;
    phase: TournamentPhaseFilter;
  } | null>(null);
  const playerDetailCacheRef = useRef(new Map<string, PlayerAnalyticsDetail>());
  const playerDetailRequestRef = useRef(0);

  useEffect(() => {
    if (teams.length === 0) {
      if (expandedTeamId !== null) setExpandedTeamId(null);
      return;
    }
    if (expandedTeamId === null) return;

    const exists = teams.some((team) => team.id === expandedTeamId);
    if (!exists) setExpandedTeamId(null);
  }, [teams, expandedTeamId]);

  useEffect(() => {
    playerDetailCacheRef.current.clear();
  }, [tournamentId, statsPhase]);

  useEffect(() => {
    let cancelled = false;
    setPhaseLinesLoading(true);

    getTournamentPlayerLinesFast(tournamentId, statsPhase)
      .then((rows) => {
        if (cancelled) return;
        setPhaseLines(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setPhaseLines([]);
      })
      .finally(() => {
        if (cancelled) return;
        setPhaseLinesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tournamentId, statsPhase]);

  const playerCards = useMemo<PlayerCardModel[]>(() => {
    const grouped = new Map<number, PlayerCardModel>();

    teams.forEach((team) => {
      team.players.forEach((player) => {
        const fullName = `${toSafeText(player.names)} ${toSafeText(player.lastnames)}`
          .replace(/\s+/g, " ")
          .trim();

        if (!grouped.has(player.id)) {
          grouped.set(player.id, {
            id: player.id,
            fullName: fullName || `Jugador ${player.id}`,
            backJerseyName: toSafeText(player.backjerseyname) || "Sin alias",
            photo: toSafeText(player.photo) || undefined,
            role: toSafeText(player.description) || "Jugador",
            jersey: Number.isFinite(Number(player.jerseynumber)) ? String(player.jerseynumber) : "--",
            teamId: team.id,
            teamName: toSafeText(team.name) || "Equipo sin nombre",
          });
        }
      });
    });

    return Array.from(grouped.values()).sort((a, b) => compareByText(a.fullName, b.fullName));
  }, [teams]);

  const playersByTeam = useMemo(() => {
    const map = new Map<number, PlayerCardModel[]>();
    playerCards.forEach((player) => {
      const list = map.get(player.teamId) ?? [];
      list.push(player);
      map.set(player.teamId, list);
    });
    return map;
  }, [playerCards]);

  const playerGradeById = useMemo(() => {
    const map = new Map<number, PlayerGradeDisplay>();
    if (phaseLines.length === 0) return map;

    phaseLines.forEach((line) => {
      const grade = derivePlayerGradeFromProfile(line, phaseLines);
      if (grade) {
        map.set(line.playerId, grade);
      }
    });

    return map;
  }, [phaseLines]);

  const followedPlayerSet = useMemo(
    () => new Set(followedPlayerIds),
    [followedPlayerIds]
  );

  const openPlayerDetail = async (
    playerId: number,
    selectedPhase: TournamentPhaseFilter = statsPhase,
    options?: { forceRefresh?: boolean }
  ) => {
    const requestId = playerDetailRequestRef.current + 1;
    playerDetailRequestRef.current = requestId;

    setLastSelectedPlayer({ playerId, phase: selectedPhase });
    setPlayerDetailOpen(true);
    setPlayerDetailError(null);
    setPlayerDetailLoading(true);

    const cacheKey = `${tournamentId}:${selectedPhase}:${playerId}`;
    const useCache = !options?.forceRefresh;

    if (useCache) {
      const cached = playerDetailCacheRef.current.get(cacheKey);
      if (cached) {
        setPlayerDetail(cached);
        setPlayerDetailLoading(false);
        return;
      }
    }

    try {
      const [playerDetailData, lines] = await Promise.all([
        getTournamentPlayerDetailFast({
          tournamentId,
          playerId,
          phase: selectedPhase,
          forceRefresh: Boolean(options?.forceRefresh),
        }),
        selectedPhase === statsPhase && phaseLines.length > 0 && !options?.forceRefresh
          ? Promise.resolve(phaseLines)
          : getTournamentPlayerLinesFast(tournamentId, selectedPhase),
      ]);

      const games = playerDetailData.games.map((item) => ({
        ...item,
        pra: round2(item.points + item.rebounds + item.assists - item.turnovers),
      }));

      const nextDetail: PlayerAnalyticsDetail = {
        phase: selectedPhase,
        line: playerDetailData.line,
        games,
        mvpRow: null,
        phaseLines: lines,
      };

      playerDetailCacheRef.current.set(cacheKey, nextDetail);

      if (playerDetailRequestRef.current !== requestId) return;
      if (selectedPhase === statsPhase) {
        setPhaseLines(lines);
      }
      setPlayerDetail(nextDetail);
    } catch (error) {
      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(null);
      setPlayerDetailError(
        error instanceof Error ? error.message : "No se pudo cargar el detalle del jugador."
      );
    } finally {
      if (playerDetailRequestRef.current === requestId) {
        setPlayerDetailLoading(false);
      }
    }
  };

  const retryPlayerDetail = () => {
    if (!lastSelectedPlayer) return;
    void openPlayerDetail(lastSelectedPlayer.playerId, lastSelectedPlayer.phase, { forceRefresh: true });
  };

  const query = normalizeText(searchTerm);

  if (loading) return <LoadingSpinner label="Cargando jugadores" />;

  if (teams.length === 0) {
    return (
      <EmptyState
        title="No hay equipos vinculados"
        description="Primero agrega equipos y jugadores en la configuración del torneo."
      />
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-xl font-bold sm:text-2xl">Equipos del torneo</h3>
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          Abre un equipo para ver su plantilla; puedes dejar todos cerrados.
        </p>
        {phaseLinesLoading ? (
          <p className="text-xs text-[hsl(var(--text-subtle))]">Calculando nivel de jugadores...</p>
        ) : null}
      </header>

      <div className="rounded-[10px] border bg-[hsl(var(--surface-1))] p-3 shadow-[0_1px_0_hsl(var(--border)/0.28)] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-[360px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-subtle))]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar jugador"
              className="input-base pl-9"
            />
          </label>

          <div
            className="inline-flex w-full rounded-[10px] border bg-[hsl(var(--surface-2)/0.52)] p-1 sm:w-auto"
            role="group"
            aria-label="Modo de vista de jugadores"
          >
            <button
              type="button"
              onClick={() => setViewMode("gallery")}
              className={`min-h-[34px] flex-1 rounded-[8px] px-3 text-xs font-semibold sm:flex-none ${
                viewMode === "gallery"
                  ? "bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground))] shadow-[0_1px_0_hsl(var(--border)/0.32)]"
                  : "text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--surface-1)/0.65)]"
              }`}
              aria-pressed={viewMode === "gallery"}
            >
              Galería
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`min-h-[34px] flex-1 rounded-[8px] px-3 text-xs font-semibold sm:flex-none ${
                viewMode === "list"
                  ? "bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground))] shadow-[0_1px_0_hsl(var(--border)/0.32)]"
                  : "text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--surface-1)/0.65)]"
              }`}
              aria-pressed={viewMode === "list"}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {teams
          .slice()
          .sort((a, b) => compareByText(a.name, b.name))
          .map((team) => {
            const allPlayers = playersByTeam.get(team.id) ?? [];
            const visiblePlayers = allPlayers.filter((player) =>
              query.length === 0 ? true : normalizeText(player.fullName).includes(query)
            );
            const expanded = expandedTeamId === team.id;

            return (
              <article key={team.id} className="overflow-hidden rounded-[10px] border bg-[hsl(var(--surface-1))] shadow-[0_1px_0_hsl(var(--border)/0.25)]">
                <button
                  type="button"
                  onClick={() => setExpandedTeamId(expanded ? null : team.id)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2)/0.72)] ${
                    expanded ? "bg-[hsl(var(--surface-2)/0.55)]" : ""
                  }`}
                  aria-expanded={expanded}
                  aria-controls={`team-panel-${team.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold sm:text-base">{team.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {visiblePlayers.length} de {allPlayers.length} jugadores
                    </p>
                  </div>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform duration-[var(--motion-tab)] ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded ? (
                  <div id={`team-panel-${team.id}`} className="border-t bg-[hsl(var(--surface-2)/0.52)] px-3 py-3">
                    {visiblePlayers.length === 0 ? (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin coincidencias para este equipo.</p>
                    ) : viewMode === "gallery" ? (
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                        {visiblePlayers.map((player) => {
                          const grade = playerGradeById.get(player.id) ?? null;
                          const isFollowing = followedPlayerSet.has(player.id);

                          return (
                          <article key={player.id} className="overflow-hidden rounded-[10px] border bg-[hsl(var(--surface-1))]">
                            <div className="relative aspect-[4/5] bg-[hsl(var(--surface-2))] sm:aspect-[3/4] lg:aspect-[4/5]">
                              {player.photo ? (
                                <img
                                  src={player.photo}
                                  alt={player.fullName}
                                  className="h-full w-full object-cover object-[center_18%]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <UserCircleIcon className="h-14 w-14 text-[hsl(var(--text-subtle))]" />
                                </div>
                              )}
                              <div className="absolute inset-x-2 top-2 flex items-start justify-between">
                                {grade ? (
                                  <span
                                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 px-1 text-[11px] font-black shadow-[0_8px_14px_-10px_rgba(0,0,0,0.9)] ${grade.badgeClassName}`}
                                    title={`Nivel ${grade.grade}`}
                                  >
                                    {grade.grade}
                                  </span>
                                ) : (
                                  <span className="h-6 w-6" aria-hidden="true" />
                                )}
                                <span className="rounded-[6px] border border-white/35 bg-black/45 px-2 py-1 text-xs font-bold text-white">
                                  #{player.jersey}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1.5 p-2.5 sm:p-3">
                              <h4 className="line-clamp-2 text-sm font-semibold leading-tight">{player.fullName}</h4>
                              <p className="text-xs text-[hsl(var(--text-subtle))]">{player.role}</p>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(player.id)}
                                className="btn-secondary min-h-[30px] w-full px-2.5 py-1.5 text-xs"
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver detalle
                              </button>
                              {onToggleFollowPlayer ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleFollowPlayer(player.id)}
                                  className={`w-full rounded-[8px] border px-2.5 py-1.5 text-xs font-semibold ${
                                    isFollowing
                                      ? "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]"
                                      : "border-[hsl(var(--border))] text-[hsl(var(--text-subtle))]"
                                  }`}
                                >
                                  {isFollowing ? "Siguiendo" : "Seguir"}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        )})}
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {visiblePlayers.map((player) => {
                          const grade = playerGradeById.get(player.id) ?? null;
                          const isFollowing = followedPlayerSet.has(player.id);

                          return (
                          <li
                            key={player.id}
                            className="flex items-center gap-3 rounded-[10px] border bg-[hsl(var(--surface-1))] px-3 py-2.5"
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-[hsl(var(--surface-2))]">
                              {player.photo ? (
                                <img src={player.photo} alt={player.fullName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <UserCircleIcon className="h-6 w-6 text-[hsl(var(--text-subtle))]" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold sm:text-base">{player.fullName}</p>
                              <p className="truncate text-xs text-[hsl(var(--text-subtle))] sm:text-sm">
                                Espalda: {player.backJerseyName}
                              </p>
                            </div>

                            <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
                              <div className="flex min-w-[92px] items-center justify-between gap-2">
                                {grade ? (
                                  <span
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-black ${grade.badgeClassName}`}
                                    title={`Nivel ${grade.grade}`}
                                  >
                                    {grade.grade}
                                  </span>
                                ) : (
                                  <span className="h-6 w-6" aria-hidden="true" />
                                )}
                                <span className="inline-flex min-w-[52px] items-center justify-center rounded-[8px] border bg-[hsl(var(--surface-2))] px-2 py-1 text-xs font-bold tabular-nums">
                                  #{player.jersey}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(player.id)}
                                className="btn-secondary min-h-[28px] px-2 py-1 text-[11px]"
                              >
                                <EyeIcon className="h-3 w-3" />
                                Ver detalle
                              </button>
                              {onToggleFollowPlayer ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleFollowPlayer(player.id)}
                                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                    isFollowing
                                      ? "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]"
                                      : "border-[hsl(var(--border))] text-[hsl(var(--text-subtle))]"
                                  }`}
                                >
                                  {isFollowing ? "Siguiendo" : "Seguir"}
                                </button>
                              ) : null}
                            </div>
                          </li>
                        )})}
                      </ul>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
      </div>

      <PlayerAnalyticsModal
        isOpen={playerDetailOpen}
        loading={playerDetailLoading}
        errorMessage={playerDetailError}
        detail={playerDetail}
        selectedPhase={lastSelectedPlayer?.phase ?? playerDetail?.phase ?? statsPhase}
        onPhaseChange={(selectedPhase) => {
          const playerId = lastSelectedPlayer?.playerId ?? playerDetail?.line.playerId;
          if (!playerId) return;
          void openPlayerDetail(playerId, selectedPhase);
        }}
        onClose={() => setPlayerDetailOpen(false)}
        onRetry={retryPlayerDetail}
      />
    </section>
  );
};

export default TournamentPlayersGallery;
