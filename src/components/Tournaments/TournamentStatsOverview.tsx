import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  EyeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { ArrowPathIcon, FireIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { toPng } from "html-to-image";

import {
  getAnalyticsDashboardKpis,
  getBattleData,
  getLeaders,
  getMvpRaceFast,
  getTournamentPlayerDetailFast,
  getTournamentPlayerLinesFast,
  listTournamentPlayers,
} from "../../services/tournamentAnalytics";
import type {
  BattleDimensionKey,
  BattleMetric,
  BattlePlayerResult,
  BattleSummary,
  PlayerStatsLine,
  TournamentAnalyticsKpi,
  TournamentLeaderRow,
  TournamentPhaseFilter,
  MvpBreakdownRow,
} from "../../types/tournament-analytics";
import { abbreviateLeaderboardName, getPlayerInitials } from "../../utils/player-display";
import {
  deriveFallbackBattleGrade,
  derivePlayerGradeFromProfile,
  type PlayerGradeDisplay,
} from "../../utils/player-grade";
import { supabase } from "../../lib/supabase";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import LoadingSpinner from "../LoadingSpinner";
import AppSelect from "../ui/AppSelect";
import PlayerAnalyticsModal, { type PlayerAnalyticsDetail } from "./analytics/PlayerAnalyticsModal";
import sauceLeagueLogoMark from "../../assets/sauce-league-logo-mark.png";

type StatsFocus =
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "pra"
  | "most_improved"
  | "defensive"
  | "mvp"
  | "duel";
type PerGameMetricKey = "ppg" | "rpg" | "apg" | "spg" | "bpg";

type FullLeaderItem = {
  playerId: number;
  name: string;
  photo?: string | null;
  teamName: string | null;
  valuePrimaryText: string;
  valueSecondaryText?: string;
  helperText: string;
};

const PHASE_OPTIONS: Array<{ value: TournamentPhaseFilter; label: string }> = [
  { value: "regular", label: "Temporada regular" },
  { value: "playoffs", label: "Playoffs" },
  { value: "all", label: "Todas las fases" },
];

const FOCUS_OPTIONS: Array<{ value: Exclude<StatsFocus, "duel">; label: string }> = [
  { value: "points", label: "Puntos" },
  { value: "rebounds", label: "Rebotes" },
  { value: "assists", label: "Asistencias" },
  { value: "steals", label: "Robos" },
  { value: "blocks", label: "Tapones" },
  { value: "pra", label: "PRA" },
  { value: "most_improved", label: "Más mejorado" },
  { value: "defensive", label: "Líder defensivo" },
  { value: "mvp", label: "MVP" },
];

const focusMeta: Record<
  Exclude<StatsFocus, "mvp" | "duel" | "defensive" | "pra" | "most_improved">,
  {
    title: string;
    tabLabel: string;
    metricLabel: string;
    metric: "points" | "rebounds" | "assists" | "steals" | "blocks";
    perGameKey: PerGameMetricKey;
    totalKey: "points" | "rebounds" | "assists" | "steals" | "blocks";
  }
> = {
  points: {
    title: "Líderes de puntos",
    tabLabel: "Puntos",
    metricLabel: "PPP",
    metric: "points",
    perGameKey: "ppg",
    totalKey: "points",
  },
  rebounds: {
    title: "Líderes de rebotes",
    tabLabel: "Rebotes",
    metricLabel: "RPP",
    metric: "rebounds",
    perGameKey: "rpg",
    totalKey: "rebounds",
  },
  assists: {
    title: "Líderes de asistencias",
    tabLabel: "Asistencias",
    metricLabel: "APP",
    metric: "assists",
    perGameKey: "apg",
    totalKey: "assists",
  },
  steals: {
    title: "Líderes de robos",
    tabLabel: "Robos",
    metricLabel: "SPG",
    metric: "steals",
    perGameKey: "spg",
    totalKey: "steals",
  },
  blocks: {
    title: "Líderes de tapones",
    tabLabel: "Tapones",
    metricLabel: "BPG",
    metric: "blocks",
    perGameKey: "bpg",
    totalKey: "blocks",
  },
};

type DuelPlayerOption = {
  playerId: number;
  name: string;
  photo: string | null;
  teamName: string | null;
};

type DuelResult = {
  players: BattlePlayerResult[];
  summary: BattleSummary;
};

type DuelMetricMeta = {
  label: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
};

type DuelDimensionMeta = {
  key: BattleDimensionKey;
  label: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const DUEL_UNASSIGNED_TEAM = "__duel_unassigned_team__";
const DUEL_SHARE_EXPORT_SCALE = 3;
const DUEL_SHARE_IMAGE_CACHE = new Map<string, string>();
const STORAGE_PUBLIC_MARKER = "/storage/v1/object/public/";

const getDuelTeamKey = (teamName: string | null | undefined): string => {
  const normalized = (teamName ?? "").trim();
  return normalized.length > 0 ? normalized : DUEL_UNASSIGNED_TEAM;
};

const getDuelTeamLabel = (teamKey: string): string =>
  teamKey === DUEL_UNASSIGNED_TEAM ? "Sin equipo" : teamKey;

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toFileSafeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const waitForImagesReady = async (root: HTMLElement): Promise<void> => {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        })
    )
  );
};

const waitForNextFrame = async (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const ensureImageLoaded = async (image: HTMLImageElement): Promise<void> => {
  if (image.complete) return;
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
  });
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Invalid image payload"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to process image blob."));
    reader.readAsDataURL(blob);
  });

const resolveImageUrl = (source: string): string => {
  try {
    const resolved = new URL(source, window.location.origin);
    if (window.location.protocol === "https:" && resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    return resolved.toString();
  } catch {
    return source;
  }
};

const parseStorageObjectFromUrl = (
  source: string
): { bucket: string; objectPath: string } | null => {
  const trimmed = source.trim();
  if (!trimmed) return null;

  const readFromPath = (path: string) => {
    const markerIndex = path.indexOf(STORAGE_PUBLIC_MARKER);
    if (markerIndex < 0) return null;
    const remainder = path.slice(markerIndex + STORAGE_PUBLIC_MARKER.length);
    const firstSlashIndex = remainder.indexOf("/");
    if (firstSlashIndex <= 0) return null;
    const bucket = remainder.slice(0, firstSlashIndex).trim();
    const objectPath = decodeURIComponent(remainder.slice(firstSlashIndex + 1));
    if (!bucket || !objectPath) return null;
    return { bucket, objectPath };
  };

  try {
    return readFromPath(new URL(trimmed).pathname);
  } catch {
    return readFromPath(trimmed);
  }
};

const fetchImageDataUrlFromStorageDownload = async (source: string): Promise<string | null> => {
  const parsed = parseStorageObjectFromUrl(source);
  if (!parsed) return null;

  try {
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .download(parsed.objectPath);
    if (error || !data) return null;
    return await readBlobAsDataUrl(data);
  } catch {
    return null;
  }
};

const fetchImageDataUrl = async (source: string): Promise<string | null> => {
  const resolved = resolveImageUrl(source);
  if (!resolved || resolved.startsWith("data:")) return resolved || null;
  const cached = DUEL_SHARE_IMAGE_CACHE.get(resolved);
  if (cached) return cached;

  try {
    const response = await fetch(resolved, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await readBlobAsDataUrl(blob);
    DUEL_SHARE_IMAGE_CACHE.set(resolved, dataUrl);
    return dataUrl;
  } catch {
    const downloadDataUrl = await fetchImageDataUrlFromStorageDownload(resolved);
    if (!downloadDataUrl) return null;
    DUEL_SHARE_IMAGE_CACHE.set(resolved, downloadDataUrl);
    return downloadDataUrl;
  }
};

const readImageElementAsDataUrl = (image: HTMLImageElement): string | null => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  try {
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};

const inlineShareCardImages = async (root: HTMLElement): Promise<() => void> => {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return () => undefined;

  const restoreCallbacks: Array<() => void> = [];

  await Promise.all(
    images.map(async (image) => {
      await ensureImageLoaded(image);

      const source = image.currentSrc || image.src;
      if (!source || source.startsWith("data:")) return;

      const dataUrl = (await fetchImageDataUrl(source)) ?? readImageElementAsDataUrl(image);
      if (!dataUrl) return;

      const originalSrc = image.getAttribute("src");
      const originalSrcSet = image.getAttribute("srcset");
      const originalCrossOrigin = image.getAttribute("crossorigin");

      image.setAttribute("src", dataUrl);
      image.removeAttribute("srcset");

      restoreCallbacks.push(() => {
        if (originalSrc !== null) image.setAttribute("src", originalSrc);
        else image.removeAttribute("src");

        if (originalSrcSet !== null) image.setAttribute("srcset", originalSrcSet);
        else image.removeAttribute("srcset");

        if (originalCrossOrigin !== null) image.setAttribute("crossorigin", originalCrossOrigin);
        else image.removeAttribute("crossorigin");
      });
    })
  );

  return () => {
    restoreCallbacks.forEach((restore) => restore());
  };
};

const phaseLabel = (phase: TournamentPhaseFilter): string => {
  if (phase === "regular") return "Temporada regular";
  if (phase === "playoffs") return "Playoffs";
  return "Todas las fases";
};

const DUEL_METRICS: BattleMetric[] = [
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "pra",
  "fg_pct",
  "topg",
];

const DUEL_DIMENSIONS: DuelDimensionMeta[] = [
  { key: "scoring", label: "Anotación" },
  { key: "creation", label: "Creación" },
  { key: "defense", label: "Defensa" },
  { key: "control", label: "Control" },
  { key: "impact", label: "Impacto total" },
];

const DUEL_METRIC_META: Record<BattleMetric, DuelMetricMeta> = {
  ppg: {
    label: "PPP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  rpg: {
    label: "RPP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  apg: {
    label: "APP",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  spg: {
    label: "ROB",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  bpg: {
    label: "BLK",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  pra: {
    label: "PRA",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
  },
  fg_pct: {
    label: "FG%",
    higherIsBetter: true,
    format: (value) => `${value.toFixed(1)}%`,
  },
  topg: {
    label: "PÉRD",
    higherIsBetter: false,
    format: (value) => value.toFixed(1),
  },
};

const getDuelRatio = (
  leftValue: number,
  rightValue: number,
  higherIsBetter: boolean
): { leftRatio: number; rightRatio: number } => {
  if (higherIsBetter) {
    const leftScore = Math.max(0, leftValue);
    const rightScore = Math.max(0, rightValue);
    const total = leftScore + rightScore;
    if (total === 0) return { leftRatio: 50, rightRatio: 50 };
    return { leftRatio: (leftScore / total) * 100, rightRatio: (rightScore / total) * 100 };
  }

  const epsilon = 0.25;
  const leftScore = 1 / (Math.max(0, leftValue) + epsilon);
  const rightScore = 1 / (Math.max(0, rightValue) + epsilon);
  const total = leftScore + rightScore;
  if (total === 0) return { leftRatio: 50, rightRatio: 50 };
  return { leftRatio: (leftScore / total) * 100, rightRatio: (rightScore / total) * 100 };
};

const TournamentStatsOverview: React.FC<{ tournamentId: string; embedded?: boolean; mode?: "default" | "duel" }> = ({
  tournamentId,
  embedded = false,
  mode = "default",
}) => {
  const isDuelMode = mode === "duel";
  const [phase, setPhase] = useState<TournamentPhaseFilter>("regular");
  const [focus, setFocus] = useState<StatsFocus>(isDuelMode ? "duel" : "points");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<TournamentAnalyticsKpi[]>([]);
  const [pointsLeaders, setPointsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [reboundsLeaders, setReboundsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [assistsLeaders, setAssistsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [stealsLeaders, setStealsLeaders] = useState<TournamentLeaderRow[]>([]);
  const [blocksLeaders, setBlocksLeaders] = useState<TournamentLeaderRow[]>([]);
  const [defensiveLeaders, setDefensiveLeaders] = useState<TournamentLeaderRow[]>([]);
  const [praLeaders, setPraLeaders] = useState<TournamentLeaderRow[]>([]);
  const [mostImprovedLeaders, setMostImprovedLeaders] = useState<TournamentLeaderRow[]>([]);
  const [mvpRows, setMvpRows] = useState<MvpBreakdownRow[]>([]);

  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [fullLeadersLoading, setFullLeadersLoading] = useState(false);
  const [fullLeadersError, setFullLeadersError] = useState<string | null>(null);
  const [fullLeadersRows, setFullLeadersRows] = useState<TournamentLeaderRow[]>([]);
  const [fullLeadersKey, setFullLeadersKey] = useState<string | null>(null);
  const [playerDirectoryOpen, setPlayerDirectoryOpen] = useState(false);
  const [playerDirectoryLoading, setPlayerDirectoryLoading] = useState(false);
  const [playerDirectoryError, setPlayerDirectoryError] = useState<string | null>(null);
  const [playerDirectoryRows, setPlayerDirectoryRows] = useState<DuelPlayerOption[]>([]);
  const [playerDirectoryQuery, setPlayerDirectoryQuery] = useState("");

  const [duelPlayers, setDuelPlayers] = useState<DuelPlayerOption[]>([]);
  const [duelPlayersLoading, setDuelPlayersLoading] = useState(false);
  const [duelLoading, setDuelLoading] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);
  const [duelPhaseLines, setDuelPhaseLines] = useState<PlayerStatsLine[]>([]);
  const [duelTeamA, setDuelTeamA] = useState<string>("");
  const [duelTeamB, setDuelTeamB] = useState<string>("");
  const [duelPlayerA, setDuelPlayerA] = useState<number | "">("");
  const [duelPlayerB, setDuelPlayerB] = useState<number | "">("");
  const [duelResult, setDuelResult] = useState<DuelResult | null>(null);
  const [duelShareLoading, setDuelShareLoading] = useState(false);
  const [duelShareError, setDuelShareError] = useState<string | null>(null);
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
  const duelShareCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadKpis = async () => {
      try {
        const nextKpis = await getAnalyticsDashboardKpis(tournamentId);
        if (!cancelled) {
          setKpis(nextKpis);
        }
      } catch {
        if (!cancelled) {
          setKpis([]);
        }
      }
    };

    loadKpis();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    playerDetailCacheRef.current.clear();
    setPlayerDetail(null);
    setPlayerDetailError(null);
    setPlayerDetailOpen(false);
    setLastSelectedPlayer(null);
    setPlayerDirectoryOpen(false);
    setPlayerDirectoryRows([]);
    setPlayerDirectoryQuery("");
    setPlayerDirectoryError(null);
    setDuelPhaseLines([]);
  }, [tournamentId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [points, rebounds, assists, steals, blocks, pra, mostImproved, defensive, mvp] = await Promise.all([
          getLeaders({ tournamentId, phase, metric: "points", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "rebounds", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "assists", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "steals", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "blocks", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "pra", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "most_improved", limit: 10 }),
          getLeaders({ tournamentId, phase, metric: "defensive_impact", limit: 10 }),
          getMvpRaceFast({
            tournamentId,
            phase: phase === "all" ? "regular" : phase === "playoffs" ? "playoffs" : "regular",
          }),
        ]);

        if (cancelled) return;

        setPointsLeaders(points);
        setReboundsLeaders(rebounds);
        setAssistsLeaders(assists);
        setStealsLeaders(steals);
        setBlocksLeaders(blocks);
        setPraLeaders(pra);
        setMostImprovedLeaders(mostImproved);
        setDefensiveLeaders(defensive);
        setMvpRows(mvp);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las estadísticas.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tournamentId, phase]);

  useEffect(() => {
    if (!fullViewOpen && !playerDirectoryOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (playerDetailOpen) return;
      if (playerDirectoryOpen) {
        setPlayerDirectoryOpen(false);
        return;
      }
      if (fullViewOpen) {
        setFullViewOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [fullViewOpen, playerDirectoryOpen, playerDetailOpen]);

  useEffect(() => {
    if (isDuelMode) {
      if (focus !== "duel") setFocus("duel");
      return;
    }

    if (focus === "duel") setFocus("points");
  }, [focus, isDuelMode]);

  useEffect(() => {
    if (focus !== "duel") return;

    let cancelled = false;
    const loadDuelPlayers = async () => {
      setDuelPlayersLoading(true);
      setDuelError(null);

      try {
        const [rows, phaseLines] = await Promise.all([
          listTournamentPlayers(tournamentId, phase),
          getTournamentPlayerLinesFast(tournamentId, phase).catch(() => [] as PlayerStatsLine[]),
        ]);
        if (cancelled) return;

        setDuelPlayers(rows);
        setDuelPhaseLines(phaseLines);
        const availableIds = new Set(rows.map((player) => player.playerId));

        setDuelPlayerA((prev) => (typeof prev === "number" && availableIds.has(prev) ? prev : ""));
        setDuelPlayerB((prev) => (typeof prev === "number" && availableIds.has(prev) ? prev : ""));
        setDuelResult(null);
      } catch (err) {
        if (!cancelled) {
          setDuelPlayers([]);
          setDuelPhaseLines([]);
          setDuelError(err instanceof Error ? err.message : "No se pudieron cargar jugadores para el duelo.");
        }
      } finally {
        if (!cancelled) setDuelPlayersLoading(false);
      }
    };

    loadDuelPlayers();

    return () => {
      cancelled = true;
    };
  }, [focus, tournamentId, phase]);

  useEffect(() => {
    if (!playerDirectoryOpen) return;

    let cancelled = false;
    const loadPlayerDirectory = async () => {
      setPlayerDirectoryLoading(true);
      setPlayerDirectoryError(null);

      try {
        const rows = await listTournamentPlayers(tournamentId, phase);
        if (!cancelled) {
          setPlayerDirectoryRows(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setPlayerDirectoryRows([]);
          setPlayerDirectoryError(err instanceof Error ? err.message : "No se pudo cargar el directorio de jugadores.");
        }
      } finally {
        if (!cancelled) {
          setPlayerDirectoryLoading(false);
        }
      }
    };

    loadPlayerDirectory();

    return () => {
      cancelled = true;
    };
  }, [playerDirectoryOpen, tournamentId, phase]);

  const hasContent = useMemo(
    () =>
      pointsLeaders.length > 0 ||
      reboundsLeaders.length > 0 ||
      assistsLeaders.length > 0 ||
      stealsLeaders.length > 0 ||
      blocksLeaders.length > 0 ||
      praLeaders.length > 0 ||
      mostImprovedLeaders.length > 0 ||
      defensiveLeaders.length > 0 ||
      mvpRows.length > 0,
    [
      pointsLeaders.length,
      reboundsLeaders.length,
      assistsLeaders.length,
      stealsLeaders.length,
      blocksLeaders.length,
      praLeaders.length,
      mostImprovedLeaders.length,
      defensiveLeaders.length,
      mvpRows.length,
    ]
  );

  const previewRows = useMemo(() => {
    if (focus === "points") return pointsLeaders;
    if (focus === "rebounds") return reboundsLeaders;
    if (focus === "assists") return assistsLeaders;
    if (focus === "steals") return stealsLeaders;
    if (focus === "blocks") return blocksLeaders;
    if (focus === "pra") return praLeaders;
    if (focus === "most_improved") return mostImprovedLeaders;
    if (focus === "defensive") return defensiveLeaders;
    return [];
  }, [
    focus,
    pointsLeaders,
    reboundsLeaders,
    assistsLeaders,
    stealsLeaders,
    blocksLeaders,
    praLeaders,
    mostImprovedLeaders,
    defensiveLeaders,
  ]);

  const hasFocusContent = useMemo(() => {
    if (focus === "mvp") return mvpRows.length > 0;
    if (focus === "duel") return duelPlayers.length >= 2;
    return previewRows.length > 0;
  }, [focus, previewRows.length, mvpRows.length, duelPlayers.length]);

  const previewMvpRows = useMemo(() => mvpRows.slice(0, 10), [mvpRows]);

  const focusTitle = useMemo(() => {
    if (focus === "mvp") return "Carrera MVP";
    if (focus === "duel") return "Duelo 1v1";
    if (focus === "pra") return "Líderes de PRA";
    if (focus === "most_improved") return "Jugador más mejorado";
    if (focus === "defensive") return "Líder defensivo";
    return focusMeta[focus].title;
  }, [focus]);

  const fullViewTitle = useMemo(() => {
    if (focus === "mvp") return "Ranking MVP completo";
    if (focus === "duel") return "Ranking completo";
    if (focus === "pra") return "Líderes de PRA (Ranking completo)";
    if (focus === "most_improved") return "Jugador más mejorado (Temporada regular)";
    if (focus === "defensive") return "Líder defensivo (Ranking completo)";
    return `${focusMeta[focus].title} (Ranking completo)`;
  }, [focus]);

  const fullViewValueLabel = useMemo(() => {
    if (focus === "mvp") return "Score";
    if (focus === "duel") return "Valor";
    if (focus === "pra") return "PRA/PJ";
    if (focus === "most_improved") return "Score MIP";
    if (focus === "defensive") return "D-Impact";
    return focusMeta[focus].metricLabel;
  }, [focus]);

  const fullViewSecondaryLabel = useMemo(() => {
    if (focus === "mvp" || focus === "duel") return undefined;
    if (focus === "pra") return "PRA Total";
    if (focus === "most_improved") return "Δ VAL";
    if (focus === "defensive") return "ROB/TAP";
    return "Total";
  }, [focus]);

  const fullViewInfoNote = useMemo(() => {
    if (focus === "pra") {
      return "PRA por partido = puntos + rebotes + asistencias - pérdidas. Ajusta el volumen ofensivo por el costo de perder posesiones.";
    }
    if (focus === "most_improved") {
      return "MIP se calcula solo en temporada regular. Score MIP combina: salto de valoración (inicio vs cierre), tendencia positiva por juego, ajuste de eficiencia (TS%) y control de pérdidas. El algoritmo favorece arranques flojos con mejora sostenida, no solo picos aislados.";
    }
    if (focus === "defensive") {
      return "D-Impact/PJ = (1.4 x ROB/PJ) + (1.8 x TAP/PJ) + (0.35 x REB/PJ) - (0.15 x FALTAS/PJ). Mide acciones defensivas directas y su consistencia.";
    }
    return undefined;
  }, [focus]);

  const openFullLeaders = async () => {
    setFullViewOpen(true);
    setFullLeadersError(null);

    if (focus === "mvp" || focus === "duel") return;

    const metric =
      focus === "defensive"
        ? "defensive_impact"
        : focus === "pra"
          ? "pra"
          : focus === "most_improved"
            ? "most_improved"
          : focusMeta[focus].metric;
    const nextKey = `${tournamentId}:${phase}:${metric}`;
    if (fullLeadersKey === nextKey && fullLeadersRows.length > 0) return;

    setFullLeadersLoading(true);
    setFullLeadersRows([]);

    try {
      const rows = await getLeaders({
        tournamentId,
        phase,
        metric,
        limit: 500,
      });
      setFullLeadersRows(rows);
      setFullLeadersKey(nextKey);
    } catch (err) {
      setFullLeadersError(err instanceof Error ? err.message : "No se pudo cargar el ranking completo.");
    } finally {
      setFullLeadersLoading(false);
    }
  };

  const retryFullLeaders = async () => {
    if (focus === "mvp" || focus === "duel") return;
    setFullLeadersKey(null);
    await openFullLeaders();
  };

  const fullRows = useMemo<FullLeaderItem[]>(() => {
    if (focus === "mvp") {
      return mvpRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        photo: row.photo ?? null,
        teamName: row.teamName,
        valuePrimaryText: row.finalScore.toFixed(3),
        helperText: `PJ ${row.gamesPlayed} · Elegible`,
      }));
    }

    if (focus === "duel") {
      return [];
    }

    if (focus === "most_improved") {
      return fullLeadersRows.map((row) => {
        const delta = row.mostImproved?.valuationDelta ?? 0;
        return {
          playerId: row.playerId,
          name: row.name,
          photo: row.photo ?? null,
          teamName: row.teamName,
          valuePrimaryText: row.value.toFixed(2),
          valueSecondaryText: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`,
          helperText: row.mostImproved?.explanation ?? `PJ ${row.gamesPlayed} · Progresión sostenida`,
        };
      });
    }

    if (focus === "pra") {
      return fullLeadersRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        photo: row.photo ?? null,
        teamName: row.teamName,
        valuePrimaryText: row.value.toFixed(1),
        valueSecondaryText: `${(
          row.totals.points + row.totals.rebounds + row.totals.assists - row.totals.turnovers
        ).toFixed(0)}`,
        helperText: `PJ ${row.gamesPlayed}`,
      }));
    }

    if (focus === "defensive") {
      return fullLeadersRows.map((row) => ({
        playerId: row.playerId,
        name: row.name,
        photo: row.photo ?? null,
        teamName: row.teamName,
        valuePrimaryText: row.value.toFixed(2),
        valueSecondaryText: `ROB ${row.perGame.spg.toFixed(1)} · TAP ${row.perGame.bpg.toFixed(1)}`,
        helperText: `PJ ${row.gamesPlayed}`,
      }));
    }

    const metricInfo = focusMeta[focus];
    return fullLeadersRows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      photo: row.photo ?? null,
      teamName: row.teamName,
      valuePrimaryText: row.perGame[metricInfo.perGameKey].toFixed(1),
      valueSecondaryText: String(row.totals[metricInfo.totalKey]),
      helperText: `PJ ${row.gamesPlayed}`,
    }));
  }, [focus, mvpRows, fullLeadersRows]);

  const filteredPlayerDirectoryRows = useMemo(() => {
    const query = normalizeText(playerDirectoryQuery);
    if (!query) return playerDirectoryRows;

    return playerDirectoryRows.filter((player) => {
      const searchable = normalizeText(`${player.name} ${player.teamName ?? ""}`);
      return searchable.includes(query);
    });
  }, [playerDirectoryQuery, playerDirectoryRows]);

  const duelPlayerById = useMemo(() => {
    const map = new Map<number, DuelPlayerOption>();
    duelPlayers.forEach((player) => {
      map.set(player.playerId, player);
    });
    return map;
  }, [duelPlayers]);

  const duelTeamOptions = useMemo(() => {
    const map = new Map<string, string>();
    duelPlayers.forEach((player) => {
      const teamKey = getDuelTeamKey(player.teamName);
      if (!map.has(teamKey)) {
        map.set(teamKey, getDuelTeamLabel(teamKey));
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "es", { sensitivity: "base" }));
  }, [duelPlayers]);

  const duelPlayersForTeamA = useMemo(() => {
    const rows = duelPlayers.filter((player) =>
      duelTeamA ? getDuelTeamKey(player.teamName) === duelTeamA : true
    );

    return rows.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  }, [duelPlayers, duelTeamA]);

  const duelPlayersForTeamB = useMemo(() => {
    const rows = duelPlayers.filter((player) =>
      duelTeamB ? getDuelTeamKey(player.teamName) === duelTeamB : true
    );

    return rows.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  }, [duelPlayers, duelTeamB]);

  const duelPlayerAInfo =
    typeof duelPlayerA === "number" ? duelPlayerById.get(duelPlayerA) ?? null : null;
  const duelPlayerBInfo =
    typeof duelPlayerB === "number" ? duelPlayerById.get(duelPlayerB) ?? null : null;

  useEffect(() => {
    if (focus !== "duel") return;

    const teamValues = duelTeamOptions.map((team) => team.value);
    if (teamValues.length === 0) {
      if (duelTeamA !== "") setDuelTeamA("");
      if (duelTeamB !== "") setDuelTeamB("");
      return;
    }

    const teamFromPlayerA = duelPlayerAInfo ? getDuelTeamKey(duelPlayerAInfo.teamName) : "";
    const teamFromPlayerB = duelPlayerBInfo ? getDuelTeamKey(duelPlayerBInfo.teamName) : "";

    const nextTeamA = teamFromPlayerA || (teamValues.includes(duelTeamA) ? duelTeamA : teamValues[0]) || "";
    const fallbackTeamB = teamValues.find((teamValue) => teamValue !== nextTeamA) ?? nextTeamA;
    const nextTeamB =
      teamFromPlayerB || (teamValues.includes(duelTeamB) ? duelTeamB : fallbackTeamB) || "";

    if (nextTeamA !== duelTeamA) setDuelTeamA(nextTeamA);
    if (nextTeamB !== duelTeamB) setDuelTeamB(nextTeamB);
  }, [focus, duelTeamOptions, duelPlayerAInfo, duelPlayerBInfo, duelTeamA, duelTeamB]);

  useEffect(() => {
    if (focus !== "duel") return;

    const validIds = new Set(duelPlayersForTeamA.map((player) => player.playerId));
    setDuelPlayerA((previous) => (typeof previous === "number" && validIds.has(previous) ? previous : ""));
  }, [focus, duelPlayersForTeamA]);

  useEffect(() => {
    if (focus !== "duel") return;

    const validIds = new Set(duelPlayersForTeamB.map((player) => player.playerId));
    setDuelPlayerB((previous) => (typeof previous === "number" && validIds.has(previous) ? previous : ""));
  }, [focus, duelPlayersForTeamB]);

  useEffect(() => {
    if (focus !== "duel") return;
    if (typeof duelPlayerA !== "number" || typeof duelPlayerB !== "number") return;
    if (duelPlayerA === duelPlayerB) setDuelPlayerB("");
  }, [focus, duelPlayerA, duelPlayerB]);

  const canCompareDuel =
    typeof duelPlayerA === "number" &&
    typeof duelPlayerB === "number" &&
    duelPlayerA !== duelPlayerB;

  const duelRows = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return [];

    const [leftPlayer, rightPlayer] = duelResult.players;

    return DUEL_METRICS.map((metric) => {
      const meta = DUEL_METRIC_META[metric];
      const leftValue = leftPlayer.metrics[metric];
      const rightValue = rightPlayer.metrics[metric];
      const leaders = duelResult.summary.perMetricLeader[metric] ?? [];
      const winnerId = leaders.length === 1 ? leaders[0] : null;

      return {
        metric,
        meta,
        leftPlayer,
        rightPlayer,
        leftValue,
        rightValue,
        winnerId,
        ratio: getDuelRatio(leftValue, rightValue, meta.higherIsBetter),
        valueGap: Math.abs(leftValue - rightValue),
      };
    });
  }, [duelResult]);

  useEffect(() => {
    setDuelShareError(null);
  }, [duelResult, phase]);

  const duelInsight = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2 || duelRows.length === 0) return null;

    const [leftPlayer, rightPlayer] = duelResult.players;
    const leftWins = duelResult.summary.categoryWins[leftPlayer.playerId] ?? 0;
    const rightWins = duelResult.summary.categoryWins[rightPlayer.playerId] ?? 0;
    const leftBattleIndex = duelResult.summary.battleIndexByPlayer[leftPlayer.playerId] ?? leftWins * 10;
    const rightBattleIndex = duelResult.summary.battleIndexByPlayer[rightPlayer.playerId] ?? rightWins * 10;
    const battleGap = Math.abs(leftBattleIndex - rightBattleIndex);

    const winner =
      battleGap < 1 ? null : leftBattleIndex > rightBattleIndex ? leftPlayer : rightPlayer;
    const loser =
      winner === null ? null : winner.playerId === leftPlayer.playerId ? rightPlayer : leftPlayer;

    const dominantMetric =
      [...duelRows]
        .sort(
          (a, b) =>
            Math.abs(b.ratio.leftRatio - b.ratio.rightRatio) -
            Math.abs(a.ratio.leftRatio - a.ratio.rightRatio)
        )
        .find((row) => row.winnerId !== null) ?? null;

    const closestMetric =
      [...duelRows].sort((a, b) => Math.abs(a.leftValue - a.rightValue) - Math.abs(b.leftValue - b.rightValue))[0] ??
      null;
    const dominantDimension =
      DUEL_DIMENSIONS.map((dimension) => {
        const leftScore =
          duelResult.summary.dimensionScoresByPlayer[leftPlayer.playerId]?.[dimension.key] ?? 50;
        const rightScore =
          duelResult.summary.dimensionScoresByPlayer[rightPlayer.playerId]?.[dimension.key] ?? 50;
        const gap = Math.abs(leftScore - rightScore);
        return {
          ...dimension,
          gap,
          winnerId:
            gap < 1
              ? null
              : leftScore > rightScore
                ? leftPlayer.playerId
                : rightPlayer.playerId,
        };
      })
        .sort((a, b) => b.gap - a.gap)
        .find((dimension) => dimension.winnerId !== null) ?? null;

    const revengeMetric =
      winner && loser
        ? [...duelRows]
            .filter((row) => row.winnerId === loser.playerId)
            .sort((a, b) => Math.abs(a.leftValue - a.rightValue) - Math.abs(b.leftValue - b.rightValue))[0] ?? null
        : null;

    const winnerWins = winner ? duelResult.summary.categoryWins[winner.playerId] ?? 0 : leftWins;
    const loserWins = loser ? duelResult.summary.categoryWins[loser.playerId] ?? 0 : rightWins;

    return {
      winner,
      loser,
      winnerWins,
      loserWins,
      winnerBattleIndex:
        winner?.playerId === leftPlayer.playerId
          ? leftBattleIndex
          : winner?.playerId === rightPlayer.playerId
            ? rightBattleIndex
            : null,
      loserBattleIndex:
        loser?.playerId === leftPlayer.playerId
          ? leftBattleIndex
          : loser?.playerId === rightPlayer.playerId
            ? rightBattleIndex
            : null,
      battleGap,
      dominantMetric,
      dominantDimension,
      closestMetric,
      revengeMetric,
    };
  }, [duelResult, duelRows]);

  const duelDimensionSummary = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return [];

    const [leftPlayer, rightPlayer] = duelResult.players;

    const leftDimensionScores = duelResult.summary.dimensionScoresByPlayer[leftPlayer.playerId] ?? null;
    const rightDimensionScores = duelResult.summary.dimensionScoresByPlayer[rightPlayer.playerId] ?? null;
    const summaryDimensionWinners = duelResult.summary.dimensionWinners ?? null;

    return DUEL_DIMENSIONS.map((dimension) => {
      const leftScore = leftDimensionScores?.[dimension.key] ?? 50;
      const rightScore = rightDimensionScores?.[dimension.key] ?? 50;
      const gap = Math.abs(leftScore - rightScore);
      const winnerFromSummary = summaryDimensionWinners?.[dimension.key] ?? null;
      const winnerId =
        winnerFromSummary !== null
          ? winnerFromSummary
          : gap < 1
            ? null
            : leftScore > rightScore
              ? leftPlayer.playerId
              : rightPlayer.playerId;

      return {
        ...dimension,
        leftScore: round2(leftScore),
        rightScore: round2(rightScore),
        gap: round2(gap),
        winnerId,
      };
    });
  }, [duelResult]);

  const duelStory = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2 || !duelInsight) return "";

    const [leftPlayer, rightPlayer] = duelResult.players;
    const leftBattleIndex = duelResult.summary.battleIndexByPlayer[leftPlayer.playerId] ?? 50;
    const rightBattleIndex = duelResult.summary.battleIndexByPlayer[rightPlayer.playerId] ?? 50;
    const leftWins = duelResult.summary.categoryWins[leftPlayer.playerId] ?? 0;
    const rightWins = duelResult.summary.categoryWins[rightPlayer.playerId] ?? 0;
    const categoryDiff = Math.abs(leftWins - rightWins);
    const battleGap = duelInsight.battleGap;
    const dominantDimension = duelInsight.dominantDimension?.label ?? "impacto general";

    if (battleGap < 1) {
      return `Empate real por índice (${leftBattleIndex.toFixed(1)} - ${rightBattleIndex.toFixed(1)}). Esto se decide en la próxima cancha.`;
    }

    const winner = leftBattleIndex > rightBattleIndex ? leftPlayer.name : rightPlayer.name;
    const loser = leftBattleIndex > rightBattleIndex ? rightPlayer.name : leftPlayer.name;

    if (battleGap >= 10) {
      return `${winner} se adueñó del duelo con un índice de +${battleGap.toFixed(1)}. Dominó ${dominantDimension.toLowerCase()}.`;
    }

    if (battleGap >= 5) {
      return `${winner} ganó con control y lectura. Ventaja clara en ${dominantDimension.toLowerCase()}.`;
    }

    if (categoryDiff >= 2) {
      return `${winner} ganó por detalles de ejecución. ${loser} está cerca y tiene ruta de revancha.`;
    }

    return `${winner} inclinó una batalla cerrada por margen corto (${battleGap.toFixed(1)}).`;
  }, [duelInsight, duelResult]);

  const duelBanter = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2 || !duelInsight) return "";

    if (!duelInsight.winner || !duelInsight.loser) {
      if (!duelInsight.closestMetric) {
        return "Esto está empate full. Aquí nadie se puede dormir.";
      }
      const row = duelInsight.closestMetric;
      return `Duelo en tabla: ${row.meta.label} quedó en milímetros. Esto pide segunda vuelta.`;
    }

    const margin = duelInsight.winnerWins - duelInsight.loserWins;
    const dominantLabel =
      duelInsight.dominantDimension?.label ?? duelInsight.dominantMetric?.meta.label ?? "el ritmo general";
    const battleGap = duelInsight.battleGap;
    const seed =
      ((duelInsight.winner.playerId + duelInsight.loser.playerId + duelInsight.winnerWins + margin) % 3 + 3) % 3;

    if (seed === 0) {
      return `${duelInsight.winner.name} salió prendido y marcó territorio en ${dominantLabel} (índice +${battleGap.toFixed(1)}).`;
    }
    if (seed === 1) {
      return `Sin bulto: ${duelInsight.winner.name} inclinó la balanza en ${dominantLabel} y ganó ${duelInsight.winnerWins}-${duelInsight.loserWins}.`;
    }
    return `Partidazo de ${duelInsight.winner.name}: controló ${dominantLabel} y cerró con +${battleGap.toFixed(1)} en índice.`;
  }, [duelInsight, duelResult]);

  const duelSharePlayers = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return null;
    return {
      left: duelResult.players[0],
      right: duelResult.players[1],
    };
  }, [duelResult]);

  const duelPhaseLineByPlayerId = useMemo(() => {
    const map = new Map<number, PlayerStatsLine>();
    duelPhaseLines.forEach((line) => {
      map.set(line.playerId, line);
    });
    return map;
  }, [duelPhaseLines]);

  const duelShareGrades = useMemo(() => {
    if (!duelSharePlayers) return null;
    const peers = duelPhaseLines;
    const resolveGrade = (player: BattlePlayerResult): PlayerGradeDisplay => {
      const line = duelPhaseLineByPlayerId.get(player.playerId) ?? null;
      const profileGrade = derivePlayerGradeFromProfile(line, peers);
      if (profileGrade) return profileGrade;
      return deriveFallbackBattleGrade(player);
    };
    return {
      left: resolveGrade(duelSharePlayers.left),
      right: resolveGrade(duelSharePlayers.right),
    };
  }, [duelSharePlayers, duelPhaseLines, duelPhaseLineByPlayerId]);
  const duelKeyMetricRows = useMemo(() => {
    const keyMetrics = new Set<BattleMetric>(["ppg", "rpg", "apg", "fg_pct", "topg"]);
    return duelRows.filter((row) => keyMetrics.has(row.metric));
  }, [duelRows]);
  const duelAdvantagesByPlayer = useMemo(() => {
    if (!duelResult || duelResult.players.length !== 2) return null;
    const [leftPlayer, rightPlayer] = duelResult.players;

    const getTopAdvantages = (playerId: number) =>
      duelRows
        .filter((row) => row.winnerId === playerId)
        .sort((a, b) => b.valueGap - a.valueGap)
        .slice(0, 2);

    return {
      left: getTopAdvantages(leftPlayer.playerId),
      right: getTopAdvantages(rightPlayer.playerId),
    };
  }, [duelResult, duelRows]);

  const handleCompareDuel = async () => {
    if (!canCompareDuel) {
      setDuelError("Selecciona dos jugadores distintos para comparar.");
      return;
    }

    setDuelLoading(true);
    setDuelError(null);

    try {
      const data = await getBattleData({
        tournamentId,
        playerIds: [duelPlayerA, duelPlayerB],
        metrics: DUEL_METRICS,
        phase,
      });
      setDuelResult(data);
    } catch (err) {
      setDuelResult(null);
      setDuelError(err instanceof Error ? err.message : "No se pudo generar la comparación.");
    } finally {
      setDuelLoading(false);
    }
  };

  const handleSwapDuelSides = () => {
    setDuelTeamA(duelTeamB);
    setDuelTeamB(duelTeamA);
    setDuelPlayerA(duelPlayerB);
    setDuelPlayerB(duelPlayerA);
    setDuelResult(null);
    setDuelError(null);
    setDuelShareError(null);
  };

  const handleDownloadDuelShareCard = async () => {
    if (!duelResult || duelResult.players.length !== 2) {
      setDuelShareError("Genera un duelo válido antes de descargar la tarjeta.");
      return;
    }

    const shareCardNode = duelShareCardRef.current;
    if (!shareCardNode) {
      setDuelShareError("No se pudo preparar la tarjeta visual para descarga.");
      return;
    }

    const [leftPlayer, rightPlayer] = duelResult.players;
    const leftLabel = toFileSafeName(abbreviateLeaderboardName(leftPlayer.name, 20));
    const rightLabel = toFileSafeName(abbreviateLeaderboardName(rightPlayer.name, 20));
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let restoreInlineImages: (() => void) | null = null;

    try {
      setDuelShareLoading(true);
      setDuelShareError(null);

      if ("fonts" in document) {
        await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
      }
      restoreInlineImages = await inlineShareCardImages(shareCardNode);
      await waitForNextFrame();
      await waitForImagesReady(shareCardNode);
      await waitForNextFrame();

      const dataUrl = await toPng(shareCardNode, {
        cacheBust: true,
        pixelRatio: DUEL_SHARE_EXPORT_SCALE,
        includeQueryParams: true,
        fetchRequestInit: {
          mode: "cors",
          credentials: "omit",
        },
        backgroundColor: "#0f172a",
      });

      const link = document.createElement("a");
      link.download = `duelo-${leftLabel}-vs-${rightLabel}-${dateStamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setDuelShareError("No se pudo generar la imagen. Intenta nuevamente.");
    } finally {
      restoreInlineImages?.();
      setDuelShareLoading(false);
    }
  };

  const mvpDetailPhase: TournamentPhaseFilter = phase === "playoffs" ? "playoffs" : "regular";
  const detailPhaseForFocus: TournamentPhaseFilter = focus === "most_improved" ? "regular" : phase;

  const openPlayerDetail = async (
    playerId: number,
    selectedPhase: TournamentPhaseFilter,
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
      const [playerDetailData, phaseLines] = await Promise.all([
        getTournamentPlayerDetailFast({
          tournamentId,
          playerId,
          phase: selectedPhase,
          forceRefresh: Boolean(options?.forceRefresh),
        }),
        getTournamentPlayerLinesFast(tournamentId, selectedPhase),
      ]);
      const line = playerDetailData.line;

      const games = playerDetailData.games
        .map((item) => ({
          ...item,
          pra: round2(item.points + item.rebounds + item.assists - item.turnovers),
        }));

      let mvpRow: MvpBreakdownRow | null = null;
      if (selectedPhase !== "all") {
        try {
          const mvpRows = await getMvpRaceFast({
            tournamentId,
            phase: selectedPhase,
            eligibilityRate: 0.3,
          });
          mvpRow = mvpRows.find((row) => row.playerId === playerId) ?? null;
        } catch {
          mvpRow = null;
        }
      }

      const nextDetail: PlayerAnalyticsDetail = {
        phase: selectedPhase,
        line,
        games,
        mvpRow,
        phaseLines,
      };

      playerDetailCacheRef.current.set(cacheKey, nextDetail);

      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(nextDetail);
    } catch (err) {
      if (playerDetailRequestRef.current !== requestId) return;
      setPlayerDetail(null);
      setPlayerDetailError(
        err instanceof Error ? err.message : "No se pudo cargar el detalle del jugador."
      );
    } finally {
      if (playerDetailRequestRef.current === requestId) {
        setPlayerDetailLoading(false);
      }
    }
  };

  const retryPlayerDetail = () => {
    if (!lastSelectedPlayer) return;
    void openPlayerDetail(lastSelectedPlayer.playerId, lastSelectedPlayer.phase, {
      forceRefresh: true,
    });
  };

  return (
    <section className="space-y-4">
      {!embedded ? (
        <header className="space-y-1">
          <h3 className="text-xl font-bold sm:text-2xl">{isDuelMode ? "Duelo de jugadores" : "Estadísticas"}</h3>
          {isDuelMode ? (
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Compara dos jugadores cara a cara con resultado final y lectura rápida.
            </p>
          ) : (
            <p className="text-sm text-[hsl(var(--text-subtle))]">
              Vista simplificada para revisar líderes y carrera MVP sin ruido visual.
            </p>
          )}
        </header>
      ) : (
        <p className="text-sm text-[hsl(var(--text-subtle))]">
          {isDuelMode ? "Modo duelo: comparación directa entre dos jugadores." : "Estadísticas clave del torneo en formato simple."}
        </p>
      )}

      <div className={`grid gap-2 ${isDuelMode ? "grid-cols-1 sm:max-w-xs" : "grid-cols-1 sm:grid-cols-2"}`}>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Fase</span>
          <AppSelect
            value={phase}
            onChange={(event) => setPhase(event.target.value as TournamentPhaseFilter)}
            className="input-base"
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={`phase-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </label>

        {!isDuelMode ? (
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">Métrica</span>
            <AppSelect
              value={focus}
              onChange={(event) => setFocus(event.target.value as Exclude<StatsFocus, "duel">)}
              className="input-base"
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={`focus-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </label>
        ) : null}
      </div>

      {!isDuelMode ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPlayerDirectoryOpen(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Buscar jugador
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      ) : null}

      {error ? (
        <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      {!loading && !hasContent && focus !== "duel" ? (
        <EmptyState
          title="Sin estadísticas disponibles"
          description="Carga resultados de partidos para ver líderes del torneo."
        />
      ) : null}

      {!loading && (hasContent || focus === "duel") ? (
        <>
          {!isDuelMode && kpis.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.slice(0, 4).map((kpi) => (
                <article key={kpi.id} className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{kpi.label}</p>
                  <p className="text-sm font-bold sm:text-base">{kpi.value}</p>
                  <p className="truncate text-xs text-[hsl(var(--text-subtle))]">{kpi.helper}</p>
                </article>
              ))}
            </div>
          ) : null}

          {focus === "duel" ? (
            <SectionCard
              title="Duelo 1v1"
              description="Compara dos jugadores en todas las métricas clave con un veredicto claro."
              className="!overflow-visible"
              actions={
                <button
                  type="button"
                  onClick={handleCompareDuel}
                  disabled={!canCompareDuel || duelLoading}
                  className="btn-primary min-h-[36px] px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {duelLoading ? "Comparando..." : "Comparar ahora"}
                </button>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <article className="rounded-lg border bg-[hsl(var(--surface-1))] p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Lado A
                    </p>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Equipo</span>
                      <AppSelect
                        value={duelTeamA}
                        onChange={(event) => {
                          setDuelTeamA(String(event.target.value));
                          setDuelPlayerA("");
                        }}
                        className="input-base"
                      >
                        <option value="">Seleccionar equipo</option>
                        {duelTeamOptions.map((teamOption) => (
                          <option key={`duel-team-a-${teamOption.value}`} value={teamOption.value}>
                            {teamOption.label}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Jugador</span>
                      <AppSelect
                        value={duelPlayerA}
                        onChange={(event) => setDuelPlayerA(event.target.value ? Number(event.target.value) : "")}
                        className="input-base"
                        disabled={!duelTeamA || duelPlayersForTeamA.length === 0}
                      >
                        <option value="">{duelTeamA ? "Seleccionar jugador" : "Elige equipo primero"}</option>
                        {duelPlayersForTeamA.map((player) => (
                          <option
                            key={`duel-a-${player.playerId}`}
                            value={player.playerId}
                            disabled={duelPlayerB === player.playerId}
                          >
                            {player.name}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                  </article>

                  <article className="rounded-lg border bg-[hsl(var(--surface-1))] p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                      Lado B
                    </p>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Equipo</span>
                      <AppSelect
                        value={duelTeamB}
                        onChange={(event) => {
                          setDuelTeamB(String(event.target.value));
                          setDuelPlayerB("");
                        }}
                        className="input-base"
                      >
                        <option value="">Seleccionar equipo</option>
                        {duelTeamOptions.map((teamOption) => (
                          <option key={`duel-team-b-${teamOption.value}`} value={teamOption.value}>
                            {teamOption.label}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Jugador</span>
                      <AppSelect
                        value={duelPlayerB}
                        onChange={(event) => setDuelPlayerB(event.target.value ? Number(event.target.value) : "")}
                        className="input-base"
                        disabled={!duelTeamB || duelPlayersForTeamB.length === 0}
                      >
                        <option value="">{duelTeamB ? "Seleccionar jugador" : "Elige equipo primero"}</option>
                        {duelPlayersForTeamB.map((player) => (
                          <option
                            key={`duel-b-${player.playerId}`}
                            value={player.playerId}
                            disabled={duelPlayerA === player.playerId}
                          >
                            {player.name}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                  </article>
                </div>

                <div className="space-y-2 rounded-lg border bg-[hsl(var(--surface-2)/0.62)] p-3">
                  <p className="text-xs text-[hsl(var(--text-subtle))]">
                    Modo jocoso activado:{" "}
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {duelPlayerAInfo?.name ?? "Selecciona jugador A"}
                    </span>{" "}
                    vs{" "}
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {duelPlayerBInfo?.name ?? "Selecciona jugador B"}
                    </span>
                    .
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleSwapDuelSides}
                      disabled={!canCompareDuel}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[hsl(var(--surface-2))] disabled:opacity-60"
                    >
                      <ArrowsRightLeftIcon className="h-4 w-4 text-[hsl(var(--chart-5))]" />
                      Intercambiar lados
                    </button>
                    <div className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2 text-xs text-[hsl(var(--text-subtle))]">
                      Duelo normal: selecciona tus dos jugadores y presiona <span className="font-semibold">Comparar ahora</span>.
                    </div>
                  </div>
                </div>

                {duelPlayersLoading ? <LoadingSpinner label="Cargando jugadores para duelo" /> : null}
                {duelError ? (
                  <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                    {duelError}
                  </div>
                ) : null}

                {duelResult && duelResult.players.length === 2 ? (
                  <div className="space-y-3">
                    <article className="rounded-lg border bg-[hsl(var(--surface-2)/0.72)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1 text-sm font-semibold">
                          <FireIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                          {duelResult.summary.overallWinnerName
                            ? `Ganador: ${duelResult.summary.overallWinnerName}`
                            : "Empate técnico"}
                        </p>
                        <p className="text-xs text-[hsl(var(--text-subtle))]">Fase: {phase}</p>
                      </div>
                      <p className="mt-1 text-xs text-[hsl(var(--text-subtle))]">{duelStory}</p>
                      {duelBanter ? (
                        <p className="mt-1 rounded-md border bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                          {duelBanter}
                        </p>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {duelResult.players.map((player) => (
                          <div
                            key={`duel-score-${player.playerId}`}
                            className="rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-2"
                          >
                            <p className="flex min-w-0 items-center gap-2 text-xs text-[hsl(var(--text-subtle))]">
                              {player.photo ? (
                                <img
                                  src={player.photo}
                                  alt={player.name}
                                  className="h-6 w-6 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                />
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))] text-[10px]">
                                  {getPlayerInitials(player.name)}
                                </span>
                              )}
                              <span className="truncate" title={player.name}>
                                {abbreviateLeaderboardName(player.name, 18)}
                              </span>
                            </p>
                            <p className="text-lg font-black tabular-nums">
                              {duelResult.summary.categoryWins[player.playerId] ?? 0}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--text-subtle))]">categorías ganadas</p>
                            <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--primary))]">
                              Índice {(
                                duelResult.summary.battleIndexByPlayer[player.playerId] ??
                                duelResult.summary.categoryWins[player.playerId] * 10
                              ).toFixed(1)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </article>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                            <SparklesIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                            Tarjeta para redes
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDownloadDuelShareCard()}
                            disabled={duelShareLoading}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[hsl(var(--surface-2))] disabled:opacity-60"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            {duelShareLoading ? "Generando..." : "Descargar imagen"}
                          </button>
                        </div>

                        <div className="flex justify-center">
                          <div className="w-full">
                            <div
                              ref={duelShareCardRef}
                              className="relative w-full overflow-hidden rounded-[28px] border border-white/20 bg-[linear-gradient(156deg,#081224_0%,#14376f_49%,#36152f_100%)] p-4 text-white shadow-[0_36px_78px_-34px_rgba(2,6,23,0.95)] sm:p-5"
                            >
                              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.34),transparent_34%),radial-gradient(circle_at_86%_14%,rgba(239,68,68,0.28),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.5),transparent_48%)]" />

                              {duelSharePlayers ? (
                                <div className="relative flex h-full flex-col gap-3 sm:gap-3.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <img
                                        src={sauceLeagueLogoMark}
                                        alt="Sauce League"
                                        className="h-7 w-7 rounded-md object-contain"
                                        onError={(event) => {
                                          if (event.currentTarget.src.endsWith("/sauce-league-logo-mark.png")) return;
                                          event.currentTarget.src = "/sauce-league-logo-mark.png";
                                        }}
                                        crossOrigin="anonymous"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">
                                          Sauce League
                                        </p>
                                        <p className="truncate text-[10px] font-semibold text-white/92">Battle Card</p>
                                      </div>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-white/18 bg-black/25 px-2 py-0.5 text-[9px] font-semibold text-white/76">
                                      {phaseLabel(phase)}
                                    </span>
                                  </div>

                                  <div className="rounded-2xl border border-white/12 bg-black/26 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-3.5 sm:py-3.5">
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                                      <div className="text-center">
                                        <div className="relative mx-auto mb-1.5 h-[clamp(5rem,22vw,6rem)] w-[clamp(5rem,22vw,6rem)]">
                                          <div
                                            className={`relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border bg-white/10 ${
                                              duelShareGrades?.left.ringClassName ?? "border-white/28"
                                            }`}
                                          >
                                            <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-xl font-black">
                                              {getPlayerInitials(duelSharePlayers.left.name)}
                                            </span>
                                            {duelSharePlayers.left.photo ? (
                                              <img
                                                src={duelSharePlayers.left.photo}
                                                alt={duelSharePlayers.left.name}
                                                className="relative z-[1] h-full w-full object-cover"
                                                onError={(event) => {
                                                  event.currentTarget.style.display = "none";
                                                }}
                                                crossOrigin="anonymous"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : null}
                                          </div>
                                          {duelShareGrades?.left ? (
                                            <span
                                              className={`pointer-events-none absolute bottom-0 right-0 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-black shadow-[0_10px_18px_-12px_rgba(0,0,0,0.9)] ${duelShareGrades.left.badgeClassName}`}
                                            >
                                              {duelShareGrades.left.grade}
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="truncate text-[15px] font-bold leading-tight sm:text-base" title={duelSharePlayers.left.name}>
                                          {abbreviateLeaderboardName(duelSharePlayers.left.name, 14)}
                                        </p>
                                        <p className="truncate text-[10px] text-white/72">{duelSharePlayers.left.teamName ?? "Sin equipo"}</p>
                                        <p className="mt-0.5 text-[10px] font-semibold text-[#93c5fd]">
                                          Índice {(duelResult.summary.battleIndexByPlayer[duelSharePlayers.left.playerId] ?? 50).toFixed(1)}
                                        </p>
                                      </div>

                                      <div className="flex flex-col items-center">
                                        <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-[radial-gradient(circle_at_24%_22%,rgba(148,197,255,0.58),rgba(30,58,138,0.66)_48%,rgba(15,23,42,0.98)_100%)] shadow-[0_14px_24px_-14px_rgba(59,130,246,0.66)] sm:h-[3.125rem] sm:w-[3.125rem]">
                                          <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/18" />
                                          <span className="pointer-events-none absolute left-1/2 top-[6px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/52 blur-[0.3px]" />
                                          <span className="relative text-[25px] font-black leading-none tracking-[0.02em] text-white/95 sm:text-[26px]">
                                            VS
                                          </span>
                                        </div>
                                        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/66">
                                          Cancha
                                        </span>
                                      </div>

                                      <div className="text-center">
                                        <div className="relative mx-auto mb-1.5 h-[clamp(5rem,22vw,6rem)] w-[clamp(5rem,22vw,6rem)]">
                                          <div
                                            className={`relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border bg-white/10 ${
                                              duelShareGrades?.right.ringClassName ?? "border-white/28"
                                            }`}
                                          >
                                            <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-xl font-black">
                                              {getPlayerInitials(duelSharePlayers.right.name)}
                                            </span>
                                            {duelSharePlayers.right.photo ? (
                                              <img
                                                src={duelSharePlayers.right.photo}
                                                alt={duelSharePlayers.right.name}
                                                className="relative z-[1] h-full w-full object-cover"
                                                onError={(event) => {
                                                  event.currentTarget.style.display = "none";
                                                }}
                                                crossOrigin="anonymous"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : null}
                                          </div>
                                          {duelShareGrades?.right ? (
                                            <span
                                              className={`pointer-events-none absolute bottom-0 right-0 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-black shadow-[0_10px_18px_-12px_rgba(0,0,0,0.9)] ${duelShareGrades.right.badgeClassName}`}
                                            >
                                              {duelShareGrades.right.grade}
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="truncate text-[15px] font-bold leading-tight sm:text-base" title={duelSharePlayers.right.name}>
                                          {abbreviateLeaderboardName(duelSharePlayers.right.name, 14)}
                                        </p>
                                        <p className="truncate text-[10px] text-white/72">{duelSharePlayers.right.teamName ?? "Sin equipo"}</p>
                                        <p className="mt-0.5 text-[10px] font-semibold text-[#fca5a5]">
                                          Índice {(duelResult.summary.battleIndexByPlayer[duelSharePlayers.right.playerId] ?? 50).toFixed(1)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                <div className="rounded-xl border border-white/14 bg-white/[0.10] px-3 py-3">
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">Resultado inteligente</p>
                                  <p className="mt-1 line-clamp-1 text-[14px] font-semibold leading-tight">
                                    {duelResult.summary.overallWinnerName
                                      ? `Ganador: ${abbreviateLeaderboardName(duelResult.summary.overallWinnerName, 24)}`
                                      : "Empate técnico"}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[10px] text-white/76">
                                    {duelInsight?.dominantDimension
                                      ? `Se decidió en ${duelInsight.dominantDimension.label.toLowerCase()} (brecha ${duelInsight.dominantDimension.gap.toFixed(1)}).`
                                      : "Duelo parejo en todas las dimensiones."}
                                  </p>
                                </div>

                                {duelDimensionSummary.length > 0 ? (
                                  <div className="rounded-xl border border-white/14 bg-black/24 px-3 py-3 sm:px-3.5 sm:py-3.5">
                                    <div className="mb-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.13em] text-white/76 sm:mb-2.5 sm:text-[10px]">
                                      <span>Mapa de estilos</span>
                                      <span>Escala 0-100</span>
                                    </div>
                                    <div className="mb-2 grid grid-cols-2 gap-1.5 text-[9px] sm:mb-2.5 sm:text-[10px]">
                                      <div className="inline-flex min-w-0 items-center gap-1 truncate rounded-full border border-[#60a5fa]/42 bg-[#1d4ed8]/25 px-2 py-0.5 font-semibold text-[#bfdbfe]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
                                        {abbreviateLeaderboardName(duelSharePlayers.left.name, 10)}
                                      </div>
                                      <div className="inline-flex min-w-0 items-center justify-end gap-1 truncate rounded-full border border-[#f87171]/42 bg-[#b91c1c]/26 px-2 py-0.5 font-semibold text-[#fecaca]">
                                        {abbreviateLeaderboardName(duelSharePlayers.right.name, 10)}
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      {duelDimensionSummary.map((dimension) => {
                                        const leaderTone =
                                          dimension.winnerId === null
                                            ? "text-white/68"
                                            : dimension.winnerId === duelSharePlayers.left.playerId
                                              ? "text-[#93c5fd]"
                                              : "text-[#fca5a5]";

                                        return (
                                          <div key={`share-dimension-${dimension.key}`} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2 text-[10px]">
                                              <span className="truncate font-semibold text-white/92">{dimension.label}</span>
                                              <span className={`shrink-0 font-semibold tabular-nums ${leaderTone}`}>
                                                <span className="sm:hidden">
                                                  {`${dimension.leftScore.toFixed(0)}-${dimension.rightScore.toFixed(0)} · b${dimension.gap.toFixed(0)}`}
                                                </span>
                                                <span className="hidden sm:inline">{`brecha ${dimension.gap.toFixed(0)}`}</span>
                                              </span>
                                            </div>
                                            <div className="relative h-2 overflow-hidden rounded-full bg-white/14">
                                              <span
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1d4ed8] via-[#3b82f6] to-[#7dd3fc]"
                                                style={{ width: `${dimension.leftScore}%` }}
                                              />
                                              <span
                                                className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#991b1b] via-[#dc2626] to-[#fb7185]"
                                                style={{ width: `${dimension.rightScore}%` }}
                                              />
                                            </div>
                                            <div className="hidden items-center justify-between text-[9px] font-semibold tabular-nums text-white/82 sm:flex">
                                              <span className="text-[#bfdbfe]">{dimension.leftScore.toFixed(0)}</span>
                                              <span className="text-white/62">vs</span>
                                              <span className="text-[#fecaca]">{dimension.rightScore.toFixed(0)}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}

                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {duelShareError ? (
                          <p className="text-xs text-[hsl(var(--destructive))]">{duelShareError}</p>
                        ) : null}
                      </div>

                    <article className="rounded-lg border bg-[hsl(var(--surface-2)/0.72)] p-3">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                            Resumen comparativo
                          </p>
                          <span className="text-[11px] text-[hsl(var(--text-subtle))]">
                            {duelRows.length} métricas evaluadas
                          </span>
                        </div>

                        {duelInsight ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <article className="rounded-lg border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Resultado</p>
                              <p className="text-xs font-semibold">
                                {duelInsight.winner
                                  ? abbreviateLeaderboardName(duelInsight.winner.name, 18)
                                  : "Empate técnico"}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--text-subtle))]">
                                Categorías {duelInsight.winnerWins} - {duelInsight.loserWins}
                              </p>
                            </article>
                            <article className="rounded-lg border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Índice</p>
                              <p className="text-xs font-semibold tabular-nums">
                                {duelInsight.winnerBattleIndex !== null && duelInsight.loserBattleIndex !== null
                                  ? `${duelInsight.winnerBattleIndex.toFixed(1)} vs ${duelInsight.loserBattleIndex.toFixed(1)}`
                                  : "Sin diferencia"}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--text-subtle))]">Margen {duelInsight.battleGap.toFixed(1)}</p>
                            </article>
                            <article className="rounded-lg border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">Dominio principal</p>
                              <p className="text-xs font-semibold">
                                {duelInsight.dominantDimension?.label ?? duelInsight.dominantMetric?.meta.label ?? "Sin dominio"}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--text-subtle))]">
                                {duelInsight.dominantDimension
                                  ? `Brecha ${duelInsight.dominantDimension.gap.toFixed(1)}`
                                  : "Sin brecha marcada"}
                              </p>
                            </article>
                          </div>
                        ) : null}

                        {duelKeyMetricRows.length > 0 ? (
                          <div className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
                            {duelKeyMetricRows.map((row, index) => {
                              const leftWinsMetric = row.winnerId === row.leftPlayer.playerId;
                              const rightWinsMetric = row.winnerId === row.rightPlayer.playerId;
                              const leftTone = leftWinsMetric ? "text-[#60a5fa]" : "text-[hsl(var(--text-subtle))]";
                              const rightTone = rightWinsMetric ? "text-[#f87171]" : "text-[hsl(var(--text-subtle))]";

                              return (
                                <div
                                  key={`duel-summary-row-${row.metric}`}
                                  className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 ${
                                    index < duelKeyMetricRows.length - 1 ? "border-b border-[hsl(var(--border)/0.7)]" : ""
                                  }`}
                                >
                                  <p className={`truncate text-right text-xs font-semibold tabular-nums ${leftTone}`}>
                                    {row.meta.format(row.leftValue)}
                                  </p>
                                  <div className="text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                                      {row.meta.label}
                                    </p>
                                    <p className="text-[10px] text-[hsl(var(--text-subtle))]">
                                      {row.meta.higherIsBetter ? "más alto" : "más bajo"}
                                    </p>
                                  </div>
                                  <p className={`truncate text-xs font-semibold tabular-nums ${rightTone}`}>
                                    {row.meta.format(row.rightValue)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {duelAdvantagesByPlayer ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <article className="rounded-lg border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                                Fortalezas {abbreviateLeaderboardName(duelResult.players[0]?.name ?? "Jugador A", 14)}
                              </p>
                              <p className="text-xs font-semibold">
                                {duelAdvantagesByPlayer.left.length > 0
                                  ? duelAdvantagesByPlayer.left.map((row) => row.meta.label).join(" · ")
                                  : "Sin ventaja clara en métricas clave"}
                              </p>
                            </article>
                            <article className="rounded-lg border bg-[hsl(var(--surface-1))] px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">
                                Fortalezas {abbreviateLeaderboardName(duelResult.players[1]?.name ?? "Jugador B", 14)}
                              </p>
                              <p className="text-xs font-semibold">
                                {duelAdvantagesByPlayer.right.length > 0
                                  ? duelAdvantagesByPlayer.right.map((row) => row.meta.label).join(" · ")
                                  : "Sin ventaja clara en métricas clave"}
                              </p>
                            </article>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title={focusTitle}
              description="Top 10 del torneo"
              actions={
                hasFocusContent ? (
                  <button
                    type="button"
                    onClick={openFullLeaders}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--surface-2))]"
                  >
                    Ver todo
                  </button>
                ) : undefined
              }
            >
              {focus === "mvp" ? (
                <div className="space-y-2">
                  <p className="rounded-lg border bg-[hsl(var(--surface-2)/0.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    MVP score = producción + eficiencia + impacto (PRA y VAL/PJ) + disponibilidad + récord del equipo.
                  </p>
                  {previewMvpRows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--text-subtle))]">No hay datos MVP para esta fase.</p>
                  ) : (
                    previewMvpRows.map((row, index) => (
                      <div
                        key={row.playerId}
                        className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-2 font-semibold">
                            {row.photo ? (
                              <img
                                src={row.photo}
                                alt={row.name}
                                className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                              />
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                {getPlayerInitials(row.name)}
                              </span>
                            )}
                            <span className="truncate" title={row.name}>
                              #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                            </span>
                          </p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{row.finalScore.toFixed(3)}</p>
                          <button
                            type="button"
                            onClick={() => void openPlayerDetail(row.playerId, mvpDetailPhase)}
                            className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                            title="Ver detalle del jugador"
                            aria-label={`Ver detalle de ${row.name}`}
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            Ver detalle
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {focus === "pra" || focus === "defensive" || focus === "most_improved" ? (
                    <p className="rounded-lg border bg-[hsl(var(--surface-2)/0.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {focus === "pra"
                        ? "PRA/PJ = puntos + rebotes + asistencias - pérdidas por juego. Es la referencia usada para medir volumen productivo neto."
                        : focus === "defensive"
                          ? "D-Impact/PJ = (1.4 x ROB/PJ) + (1.8 x TAP/PJ) + (0.35 x REB/PJ) - (0.15 x FALTAS/PJ)."
                          : "Más Mejorado usa solo temporada regular: compara inicio vs cierre, tendencia por juego y eficiencia (TS%) para premiar progreso sostenido."}
                    </p>
                  ) : null}
                  {previewRows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--text-subtle))]">No hay datos para esta métrica.</p>
                  ) : (
                    previewRows.map((row, index) => {
                      if (focus === "most_improved") {
                        return (
                          <div
                            key={row.playerId}
                            className="flex min-h-[92px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center gap-2 font-semibold">
                                {row.photo ? (
                                  <img
                                    src={row.photo}
                                    alt={row.name}
                                    className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                  />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                    {getPlayerInitials(row.name)}
                                  </span>
                                )}
                                <span className="truncate" title={row.name}>
                                  #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                                </span>
                              </p>
                              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {row.teamName ?? "Sin equipo"} · Regular
                              </p>
                              <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                                {row.mostImproved?.explanation ?? "Progresión sostenida durante la temporada regular."}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums">
                                Score MIP {row.value.toFixed(2)}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                Δ VAL {row.mostImproved ? `${row.mostImproved.valuationDelta >= 0 ? "+" : ""}${row.mostImproved.valuationDelta.toFixed(1)}` : "0.0"}
                              </p>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(row.playerId, "regular")}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                                title="Ver detalle del jugador"
                                aria-label={`Ver detalle de ${row.name}`}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver detalle
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (focus === "pra") {
                        return (
                          <div
                            key={row.playerId}
                            className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center gap-2 font-semibold">
                                {row.photo ? (
                                  <img
                                    src={row.photo}
                                    alt={row.name}
                                    className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                  />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                    {getPlayerInitials(row.name)}
                                  </span>
                                )}
                                <span className="truncate" title={row.name}>
                                  #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                                </span>
                              </p>
                              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums">
                                PRA/PJ {row.value.toFixed(1)}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                Total{" "}
                                {(
                                  row.totals.points +
                                  row.totals.rebounds +
                                  row.totals.assists -
                                  row.totals.turnovers
                                ).toFixed(0)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(row.playerId, detailPhaseForFocus)}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                                title="Ver detalle del jugador"
                                aria-label={`Ver detalle de ${row.name}`}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver detalle
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (focus === "defensive") {
                        return (
                          <div
                            key={row.playerId}
                            className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center gap-2 font-semibold">
                                {row.photo ? (
                                  <img
                                    src={row.photo}
                                    alt={row.name}
                                    className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                  />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                    {getPlayerInitials(row.name)}
                                  </span>
                                )}
                                <span className="truncate" title={row.name}>
                                  #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                                </span>
                              </p>
                              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums">
                                D-Impact {row.value.toFixed(2)}
                              </p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                ROB {row.perGame.spg.toFixed(1)} · TAP {row.perGame.bpg.toFixed(1)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void openPlayerDetail(row.playerId, detailPhaseForFocus)}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                                title="Ver detalle del jugador"
                                aria-label={`Ver detalle de ${row.name}`}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver detalle
                              </button>
                          </div>
                        </div>
                      );
                    }

                      const metricInfo = focusMeta[focus];
                      return (
                        <div
                          key={row.playerId}
                          className="flex min-h-[78px] items-center justify-between rounded-lg border bg-[hsl(var(--surface-2)/0.7)] px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="flex min-w-0 items-center gap-2 font-semibold">
                              {row.photo ? (
                                <img
                                  src={row.photo}
                                  alt={row.name}
                                  className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                                />
                              ) : (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                                  {getPlayerInitials(row.name)}
                                </span>
                              )}
                              <span className="truncate" title={row.name}>
                                #{index + 1} {abbreviateLeaderboardName(row.name, 20)}
                              </span>
                            </p>
                            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {row.teamName ?? "Sin equipo"} · PJ {row.gamesPlayed}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums">
                              {metricInfo.metricLabel} {row.perGame[metricInfo.perGameKey].toFixed(1)}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                              Total {row.totals[metricInfo.totalKey]}
                            </p>
                            <button
                              type="button"
                              onClick={() => void openPlayerDetail(row.playerId, detailPhaseForFocus)}
                              className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-1))]"
                              title="Ver detalle del jugador"
                              aria-label={`Ver detalle de ${row.name}`}
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              Ver detalle
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </SectionCard>
          )}
        </>
      ) : null}

      {fullViewOpen ? (
        <LeadersFullscreen
          title={fullViewTitle}
          valuePrimaryLabel={fullViewValueLabel}
          valueSecondaryLabel={fullViewSecondaryLabel}
          infoNote={fullViewInfoNote}
          rows={fullRows}
          loading={focus === "mvp" ? false : fullLeadersLoading}
          errorMessage={focus === "mvp" ? null : fullLeadersError}
          onBack={() => setFullViewOpen(false)}
          onRetry={focus === "mvp" ? undefined : retryFullLeaders}
          onPlayerSelect={(playerId) => {
            void openPlayerDetail(playerId, focus === "mvp" ? mvpDetailPhase : detailPhaseForFocus);
          }}
        />
      ) : null}

      {playerDirectoryOpen ? (
        <PlayersDirectoryFullscreen
          phase={phase}
          rows={filteredPlayerDirectoryRows}
          totalRows={playerDirectoryRows.length}
          loading={playerDirectoryLoading}
          errorMessage={playerDirectoryError}
          query={playerDirectoryQuery}
          onQueryChange={setPlayerDirectoryQuery}
          onBack={() => setPlayerDirectoryOpen(false)}
          onRetry={async () => {
            setPlayerDirectoryError(null);
            setPlayerDirectoryRows([]);
            setPlayerDirectoryLoading(true);
            try {
              const rows = await listTournamentPlayers(tournamentId, phase);
              setPlayerDirectoryRows(rows);
            } catch (err) {
              setPlayerDirectoryError(err instanceof Error ? err.message : "No se pudo cargar el directorio de jugadores.");
            } finally {
              setPlayerDirectoryLoading(false);
            }
          }}
          onPlayerSelect={(playerId) => {
            void openPlayerDetail(playerId, phase);
          }}
        />
      ) : null}

      <PlayerAnalyticsModal
        isOpen={playerDetailOpen}
        loading={playerDetailLoading}
        errorMessage={playerDetailError}
        detail={playerDetail}
        onClose={() => setPlayerDetailOpen(false)}
        onRetry={retryPlayerDetail}
      />
    </section>
  );
};

const PlayersDirectoryFullscreen = ({
  phase,
  rows,
  totalRows,
  loading,
  errorMessage,
  query,
  onQueryChange,
  onBack,
  onRetry,
  onPlayerSelect,
}: {
  phase: TournamentPhaseFilter;
  rows: DuelPlayerOption[];
  totalRows: number;
  loading: boolean;
  errorMessage: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onPlayerSelect: (playerId: number) => void;
}) => {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[70] bg-[hsl(var(--background))]">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b bg-[hsl(var(--surface-1))] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs sm:text-sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Volver
            </button>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold sm:text-base">Buscador de jugadores</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">
                {totalRows} jugadores · {phaseLabel(phase)}
              </p>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          <label className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="input-base w-full pl-9"
              placeholder="Buscar por nombre o equipo..."
            />
          </label>

          <p className="mt-2 text-xs text-[hsl(var(--text-subtle))]">
            Mostrando {rows.length} de {totalRows} jugadores.
          </p>

          {loading ? (
            <div className="mt-4">
              <LoadingSpinner label="Cargando directorio de jugadores" />
            </div>
          ) : errorMessage ? (
            <div className="mt-4 space-y-3">
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </div>
              <button className="btn-secondary" onClick={onRetry}>
                Reintentar
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-[hsl(var(--text-subtle))]">
              {hasQuery ? "No hay jugadores que coincidan con tu búsqueda." : "No hay jugadores registrados en esta fase."}
            </p>
          ) : (
            <section className="mt-4 overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
              <div className="divide-y">
                {rows.map((row) => (
                  <article key={row.playerId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-semibold">
                        {row.photo ? (
                          <img
                            src={row.photo}
                            alt={row.name}
                            className="h-8 w-8 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                            {getPlayerInitials(row.name)}
                          </span>
                        )}
                        <span className="truncate" title={row.name}>
                          {abbreviateLeaderboardName(row.name, 34)}
                        </span>
                      </p>
                      <p className="truncate pl-10 text-xs text-[hsl(var(--muted-foreground))]">{row.teamName ?? "Sin equipo"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlayerSelect(row.playerId)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-2))]"
                      title="Ver detalle del jugador"
                      aria-label={`Ver detalle de ${row.name}`}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Ver perfil
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

const LeadersFullscreen = ({
  title,
  valuePrimaryLabel,
  valueSecondaryLabel,
  infoNote,
  rows,
  loading,
  errorMessage,
  onBack,
  onRetry,
  onPlayerSelect,
}: {
  title: string;
  valuePrimaryLabel: string;
  valueSecondaryLabel?: string;
  infoNote?: string;
  rows: FullLeaderItem[];
  loading: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onRetry?: () => void;
  onPlayerSelect?: (playerId: number) => void;
}) => {
  const hasSecondary = Boolean(valueSecondaryLabel);
  const headerGridClass = hasSecondary
    ? "grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b bg-[hsl(var(--surface-2))] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]"
    : "grid grid-cols-[auto_1fr_auto] gap-3 border-b bg-[hsl(var(--surface-2))] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--text-subtle))]";
  const rowGridClass = hasSecondary
    ? "grid min-h-[74px] grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-sm"
    : "grid min-h-[74px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 text-sm";

  return (
    <div className="fixed inset-0 z-[70] bg-[hsl(var(--background))]">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b bg-[hsl(var(--surface-1))] px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs sm:text-sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Volver
            </button>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
              <p className="text-xs text-[hsl(var(--text-subtle))]">{rows.length} jugadores</p>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          {infoNote ? (
            <p className="mb-3 rounded-lg border bg-[hsl(var(--surface-2)/0.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
              {infoNote}
            </p>
          ) : null}
          {loading ? (
            <LoadingSpinner label="Cargando ranking completo" />
          ) : errorMessage ? (
            <div className="space-y-3">
              <div className="border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </div>
              {onRetry ? (
                <button className="btn-secondary" onClick={onRetry}>
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[hsl(var(--text-subtle))]">No hay jugadores para mostrar en este ranking.</p>
          ) : (
            <section className="overflow-hidden rounded-lg border bg-[hsl(var(--surface-1))]">
              <div className={headerGridClass}>
                <span>Rank</span>
                <span>Jugador</span>
                <span>{valuePrimaryLabel}</span>
                {hasSecondary ? <span>{valueSecondaryLabel}</span> : null}
              </div>
              <div className="divide-y">
                {rows.map((row, index) => (
                  <article key={row.playerId} className={rowGridClass}>
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-[hsl(var(--surface-2))] px-2 text-xs font-semibold">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-semibold">
                        {row.photo ? (
                          <img
                            src={row.photo}
                            alt={row.name}
                            className="h-7 w-7 rounded-full object-cover border border-[hsl(var(--border)/0.82)]"
                          />
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))] text-[10px]">
                            {getPlayerInitials(row.name)}
                          </span>
                        )}
                        <span className="truncate" title={row.name}>
                          {abbreviateLeaderboardName(row.name, 24)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {row.teamName ?? "Sin equipo"} · {row.helperText}
                      </p>
                      {onPlayerSelect ? (
                        <button
                          type="button"
                          onClick={() => onPlayerSelect(row.playerId)}
                          className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-[hsl(var(--surface-2))]"
                          title="Ver detalle del jugador"
                          aria-label={`Ver detalle de ${row.name}`}
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Ver detalle
                        </button>
                      ) : null}
                    </div>
                    <p className="text-right font-semibold tabular-nums">{row.valuePrimaryText}</p>
                    {hasSecondary ? (
                      <p className="text-right font-semibold tabular-nums">{row.valueSecondaryText ?? "-"}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentStatsOverview;
