import { mainVideoRef } from "../utils/videoRef";
import { safeLocalStorage } from "../utils/safeStorage";
import { TelemetryAudit } from "../utils/TelemetryAudit";
import { AJN_LOGO_URL } from "../utils/constants";
import { safePlay } from "../utils/safePlay";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import RumbleControlBar from "./RumbleControlBar";
import { telemetry } from "../telemetry/playbackTelemetry";
import { 
  Zap, 
  Moon, 
  Sun, 
  Radio, 
  Tv, 
  ChevronLeft, 
  ChevronRight, 
  VolumeX, 
  Volume2, 
  Search, 
  Folder, 
  RefreshCw,
  Pause,
  Play,
  Shuffle,
  Repeat,
  Home,
  Film,
  Star,
  Settings as SettingsIcon,
  Maximize,
  Minimize,
  ExternalLink,
  CheckCircle,
  ArrowRight,
  Layers,
  List,
  Compass,
  FileText,
  Youtube,
  Video,
  Rss,
  Mic,
  HardDrive,
  Grid,
  Trash2,
  AlertTriangle,
  Calendar,
  Activity,
  X,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { IPTVChannel, PlayerStore, M3UPlaylist } from "../types";
import { PlaylistVault } from "../services/PlaylistVault";
import { PlaylistEditor } from "./PlaylistEditor";
import { HeaderClock } from "./HeaderClock";
import { StatusIndicatorBar } from "./StatusIndicatorBar";
// import { GenerationQueueMonitor } from "./broadcast/GenerationQueueMonitor";
import { PlayoutBridgeStatusPanel } from "./broadcast/PlayoutBridgeStatusPanel";
import { BroadcastTVGuide } from "./BroadcastTVGuide";
import { TVGuideDashboard } from "./TVGuideDashboard";
import { RemoteHeadendSyncPanel } from "./broadcast/RemoteHeadendSyncPanel";
import { SmartVideoEngine } from "./SmartVideoEngine";
import { isRumbleUrl, getRumbleEmbedUrl, isYouTubeUrl, getYouTubeEmbedUrl } from "../utils/urlUtils";
import { usePlaybackPersistence } from "../hooks/usePlaybackPersistence";
import { sessionRecoveryService } from "../services/SessionRecoveryService";
import { PlaceCardGrid } from "./PlaceCard/PlaceCardGrid";
import { ArchiveHub } from "./ArchiveHub";
import { FolderSidebar } from "./FolderSidebar/FolderSidebar";
import { TelemetryDashboard } from "./TelemetryDashboard";
import { cleanTitle } from "../utils/titleCleaner";
import { QuadPlayerTemplate } from "./QuadPlayerTemplate";
import { VideoPlayer } from "./VideoPlayer";
import { ControlHub } from "./ControlHub";
import { PlaybackCircuitBreaker } from "../utils/PlaybackCircuitBreaker";
import { generateDayWindow } from "../utils/urlConstructor";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


const archiveBreaker = new PlaybackCircuitBreaker(3, 15000);
// This build was compiled for the static GitHub Pages deployment
// (VITE_STATIC_DEMO=true is set only in .github/workflows/deploy.yml).
// Pages serves pre-built static files with no Express backend, so every
// feature that routes through server.ts (/api/stream-proxy, Rumble
// ingestion, /api/sync/push, the podcast tuner API, news harvest) is
// structurally unavailable here -- not a bug, just this build target.
// See README.md "Deployment Targets" for the full writeup.
const IS_STATIC_DEMO_BUILD = (import.meta as any).env?.VITE_STATIC_DEMO === "true";

function StaticDemoBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="w-full shrink-0 z-[110] bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-[11px] md:text-xs font-mono px-4 py-2 flex items-center justify-between gap-3">
      <span className="leading-relaxed">
        <strong className="font-bold">Static preview build.</strong> This GitHub Pages deployment has no backend, so proxy-routed streams (M3U/IPTV imports, Rumble ingestion, cross-device sync) won't load here. For the full app, use the hosted deployment.
      </span>
      <button
        onClick={onDismiss}
        className="shrink-0 px-2 py-1 rounded-md border border-amber-500/40 hover:bg-amber-500/20 transition-colors uppercase tracking-wide text-[10px] font-bold cursor-pointer"
      >
        Dismiss
      </button>
    </div>
  );
}


const getDynamicM3U = (): string => {
  const now = new Date();
  const cdtOffset = -5 * 60 * 60 * 1000;
  const cdtDate = new Date(now.getTime() + cdtOffset + (now.getTimezoneOffset() * 60 * 1000));
  const cdtHour = cdtDate.getHours();

  let targetDate = new Date(cdtDate);
  if (cdtHour < 10) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  // Minimum date is August 1, 2026
  const august1st2026 = new Date(2026, 7, 1);
  if (targetDate < august1st2026) {
    targetDate = august1st2026;
  }

  const year = targetDate.getFullYear();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthStr = months[targetDate.getMonth()];
  const dayNum = String(targetDate.getDate()).padStart(2, "0");

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekdays[targetDate.getDay()];

    return `#EXTM3U x-tvg-name="AJN News & Broadcasts"
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="${AJN_LOGO_URL}" tvg-name="AJN Live",2026-${monthStr}-${dayNum} ${dayName} · AJN Live Broadcast
https://rumble.com/embed/v79lfxq/?pub=15son
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/warroom.png" tvg-name="War Room",2026-${monthStr}-${dayNum} ${dayName} · War Room
https://rumble.com/embed/v79lfxq/?pub=15son
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="${AJN_LOGO_URL}" tvg-name="Alex Jones Show",2026-${monthStr}-${dayNum} ${dayName} · The Alex Jones Show
https://rumble.com/embed/v79lfxq/?pub=15son
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/emegency.png" tvg-name="Special Reports",2026-${monthStr}-${dayNum} ${dayName} · Special Reports
https://rumble.com/embed/v79lfxq/?pub=15son`;
};

const DEFAULT_M3U = getDynamicM3U();

interface SessionState {
  url: string;
  name: string;
  currentTime?: number;
  duration?: number;
  timestamp: number;
  isAudioOnly?: boolean;
}

export interface LiteAppProps {
  theme: "dark" | "light";
  isTransitioning: boolean;
  currentUrl: string;
  currentTitle: string;
  isBuffering: boolean;
  isLoading: boolean;
  channels: IPTVChannel[];
  playerStore: PlayerStore;
  m3uUrlInput: string;
  playerIptvQuery: string;
  
  setPlayerStore: React.Dispatch<React.SetStateAction<PlayerStore>>;
  setM3uUrlInput: (v: string) => void;
  setPlayerIptvQuery: (v: string) => void;
  setAjnViewMode: (v: "lite" | "advanced") => void;
  addLog: (msg: string, type?: "info" | "warning" | "error") => void;
  toggleTheme: () => void;
  playStream: (url: string, name: string, offset?: number, trace?: any, actualChannelId?: string, actualShowTitle?: string) => void;
  handleM3uUrlLoad: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  parseAndLoadM3U: (text: string) => void;
  skipIPTVChannel: (direction: "next" | "prev") => void;
  removeChannel?: (url: string) => void;
  playlists?: M3UPlaylist[];
  removePlaylist?: (id: string) => Promise<void>;
  batchUpdateDurations?: (updates: { id: string, duration: number | null, duration_source: "probed" | "estimated" | "failed" | "existing" }[]) => Promise<void>;
  reloadVault?: () => Promise<void>;
  logs?: any[];
  systemHealth?: number;
  isVaultLoading?: boolean;
  stopPreludeMusic?: () => void;
}

export const LiteApp = React.memo(function LiteApp({
  theme,
  isTransitioning,
  currentUrl,
  currentTitle,
  isBuffering,
  isLoading,
  channels,
  playerStore,
  m3uUrlInput,
  playerIptvQuery,
  
  setPlayerStore,
  setM3uUrlInput,
  setPlayerIptvQuery,
  setAjnViewMode,
  addLog,
  toggleTheme,
  playStream,
  handleM3uUrlLoad,
  handleFileUpload,
  parseAndLoadM3U,
  removeChannel,
  playlists,
  removePlaylist,
  batchUpdateDurations,
  reloadVault,
  logs = [],
  systemHealth = 99.8,
  isVaultLoading = false,
  stopPreludeMusic
}: LiteAppProps) {
  const isPlaying = playerStore.state === "playing";
  const lastTimeUpdateRef = useRef(0);
  

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [showExpertMode, setShowExpertMode] = useState<boolean>(() => {
    // P2 FIX: Studio Mode is dev-only. Gate the read side too, not just the
    // toggle UI, so a leftover/forced "ajn_show_expert_mode" localStorage
    // value (e.g. set via devtools, or left over from a dev build on the
    // same origin) can't unlock expert tooling in a production build.
    if (process.env.NODE_ENV === "production") return false;
    try {
      return safeLocalStorage.getItem("ajn_show_expert_mode") === "true";
    } catch {
      return false;
    }
  });

  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState<boolean>(false);
  const [showStaticDemoBanner, setShowStaticDemoBanner] = useState<boolean>(() => {
    if (!IS_STATIC_DEMO_BUILD) return false;
    try {
      return safeLocalStorage.getItem("ajn_static_demo_banner_dismissed") !== "true";
    } catch {
      return true;
    }
  });

  const dismissStaticDemoBanner = useCallback(() => {
    setShowStaticDemoBanner(false);
    try {
      safeLocalStorage.setItem("ajn_static_demo_banner_dismissed", "true");
    } catch {}
  }, []);


  const toggleExpertMode = useCallback(() => {
    setShowExpertMode(prev => {
      const next = !prev;
      try {
        safeLocalStorage.setItem("ajn_show_expert_mode", String(next));
      } catch {}
      addLog(`Studio Mode (Expert Tools): ${next ? "ENABLED" : "DISABLED"}`, "info");
      return next;
    });
  }, [addLog]);

  // First-interaction unmuter trigger
  const handleFirstInteractionUnmute = useCallback(() => {
    if (playerStore.isMuted) {
      setPlayerStore(prev => ({
        ...prev,
        isMuted: false
      }));
      addLog("[Silent Start] User interacted with the document. Unmuting channel stream playout.", "info");
    }
  }, [playerStore.isMuted, setPlayerStore, addLog]);

  // Synchronize playerStore.isMuted with the video element
  useEffect(() => {
    const video = mainVideoRef.current;
    if (video) {
      video.muted = playerStore.isMuted;
    }
  }, [playerStore.isMuted]);

  // Get currently active channel type
  const currentChannel = useMemo(() => {
    return channels.find(ch => ch.url === currentUrl) || null;
  }, [channels, currentUrl]);

  const sessionId = React.useMemo(() => `session-${Math.random().toString(36).substring(2, 11)}`, []);

  // Mini-Player Drag State
  const [miniPos, setMiniPos] = React.useState({ x: 0, y: 0 });
  const [isDraggingMini, setIsDraggingMini] = React.useState(false);
  const dragStartRef = React.useRef({ startX: 0, startY: 0, mouseX: 0, mouseY: 0, vw: 0, vh: 0, rectWidth: 0, rectHeight: 0 });

  React.useEffect(() => {
    if (!isDraggingMini) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStartRef.current.mouseX;
      const dy = clientY - dragStartRef.current.mouseY;
      
      const rawX = dragStartRef.current.startX + dx;
      const rawY = dragStartRef.current.startY + dy;
      
      const { vw, vh, rectWidth, rectHeight } = dragStartRef.current;
      if (rectWidth > 0 && rectHeight > 0) {
        const padding = 12;
        
        const baseLeft = vw - rectWidth - 24;
        const baseTop = vh - rectHeight - 24;
        
        const targetLeft = baseLeft + rawX;
        const targetTop = baseTop + rawY;
        
        const boundedLeft = Math.max(padding, Math.min(vw - rectWidth - padding, targetLeft));
        const boundedTop = Math.max(padding, Math.min(vh - rectHeight - padding, targetTop));
        
        setMiniPos({
          x: boundedLeft - baseLeft,
          y: boundedTop - baseTop
        });
      } else {
        setMiniPos({ x: rawX, y: rawY });
      }
    };
    const handleEnd = () => {
      setIsDraggingMini(false);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDraggingMini]);

  const sendClientTelemetry = React.useCallback((eventType: string, details: any = {}) => {
    const payload = {
      eventType,
      sessionId,
      timestamp: new Date().toISOString(),
      streamUrl: currentUrl || "",
      streamTitle: currentTitle || "",
      ...details
    };

    fetch(BACKEND_URL + "/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.warn("[Telemetry Cache] Offline or api unreachable, failed to send client event:", eventType, err);
    });
  }, [sessionId, currentUrl, currentTitle]);

  const handleResetDemoChannels = useCallback(async () => {
    if (window.confirm("Are you sure you want to reset all channels to the default demo feed? This will clear other channels.")) {
      try {
        safeLocalStorage.removeItem("ajn_user_cleared");
        await PlaylistVault.clearAllChannels();
        if (playlists && removePlaylist) {
          for (const pl of playlists) {
            await removePlaylist(pl.id);
          }
        }
        await parseAndLoadM3U(DEFAULT_M3U);
        addLog("Database successfully reset to working July 7+ dynamic feeds.", "info");
      } catch (e: any) {
        addLog(`Reset failed: ${e.message}`, "error");
      }
    }
  }, [playlists, removePlaylist, parseAndLoadM3U, addLog]);

  const handlePurgePlayoutDatabase = useCallback(async () => {
    if (window.confirm("Are you sure you want to completely purge all channels and playlists? This will leave your player blank until you import a new feed.")) {
      try {
        setIsPurging(true);
        safeLocalStorage.setItem("ajn_user_cleared", "true");
        await PlaylistVault.clearAllChannels();
        if (playlists && removePlaylist) {
          for (const pl of playlists) {
            await removePlaylist(pl.id);
          }
        }
        if (reloadVault) {
          await reloadVault();
        }
        addLog("Playout database fully purged. All channels and playlists deleted.", "info");
      } catch (e: any) {
        addLog(`Purge failed: ${e.message}`, "error");
      } finally {
        setIsPurging(false);
      }
    }
  }, [playlists, removePlaylist, reloadVault, addLog]);

  const handleAbsoluteReset = useCallback(async () => {
    if (!window.confirm("Are you sure you want to completely purge the workspace? This will clear all streams, remove the demo guides, and reset the platform to a blank slate.")) {
      return;
    }

    try {
      setIsPurging(true);
      // 1. Dispatch diagnostic notification to telemetry server before wiping state configurations
      sendClientTelemetry('APP_HARD_PURGE', {
        playerState: 'stopped',
        errorMessage: 'User initiated total system reset. Purging all cached feeds and structures.'
      });
      
      // 2. Clear out local client memory caches and lock the bypass flag
      safeLocalStorage.setItem('AJN_ALLOW_EMPTY_STATE', 'true');
      safeLocalStorage.setItem('ajn_user_cleared', 'true');
      safeLocalStorage.removeItem('CURRENT_PLAYLIST_URL');
      safeLocalStorage.removeItem('LAST_PLAYED_STREAM');
      safeLocalStorage.removeItem('ajn_last_session');
      
      // 3. Force state elements to release memory streams
      await PlaylistVault.clearAllChannels();
      if (playlists && removePlaylist) {
        for (const pl of playlists) {
          await removePlaylist(pl.id);
        }
      }
      
      setPlayerStore(prev => ({
        ...prev,
        state: "idle",
        currentUrl: "",
        currentTitle: "No Active Stream",
        currentTime: 0
      }));

      if (reloadVault) {
        await reloadVault();
      }

      setIsHardPurged(true);

      // 5. Purge client-side offline IndexedDB records
      const dbRequest = indexedDB.open('TelemetryDB', 1);
      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        if (db.objectStoreNames && db.objectStoreNames.contains('events')) {
          const tx = db.transaction(['events'], 'readwrite');
          tx.objectStore('events').clear();
          console.log('IndexedDB offline telemetry buffers flushed clean.');
        }
      };

      addLog("Application fully reset. All playlists, demo paths, and buffers removed.", "info");
      alert('Application fully reset. All playlists, demo paths, and buffers removed.');
    } catch (error) {
      console.error('Error executing hard reset:', error);
    } finally {
      setIsPurging(false);
    }
  }, [playlists, removePlaylist, reloadVault, setPlayerStore, addLog, sendClientTelemetry]);


  const [detectedAspectRatio, setDetectedAspectRatio] = useState<string>("Unknown");
  const [videoResolution, setVideoResolution] = useState<string>("");
  const [aspectFittingMode, setAspectFittingMode] = useState<"auto" | "contain" | "stretch" | "cover">("auto");

  // Clear playback error states and aspect ratio metadata when URL changes
  useEffect(() => {
    setDetectedAspectRatio("Unknown");
    setVideoResolution("");
    
    if (currentUrl) {
      sendClientTelemetry("playback_start", {
        streamUrl: currentUrl,
        streamTitle: currentTitle
      });
    }
  }, [currentUrl, currentTitle, sendClientTelemetry]);

  // Handle video element's onLoadedMetadata event to auto-detect aspect ratio

  // Section 6 & 8: Persistent Settings Contracts
  const [defaultStartupView, setDefaultStartupView] = useState<"home" | "guide" | "player" | "library">(
    () => (safeLocalStorage.getItem("ajn_startup_view") as any) || "home"
  );
  const [layoutTemplate, setLayoutTemplate] = useState<"classic" | "modern" | "broadcast" | "obs" | "compact" | "quad">(
    () => (safeLocalStorage.getItem("ajn_layout_template") as any) || "broadcast"
  );
  const [isTheatreMode, setIsTheatreMode] = useState<boolean>(
    () => safeLocalStorage.getItem("ajn_theatre_mode") === "true"
  );
  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(
    () => safeLocalStorage.getItem("ajn_audio_only") === "true"
  );
  
  const [enableRussianRegex, setEnableRussianRegex] = useState<boolean>(
    () => safeLocalStorage.getItem("ajn_enable_russian_regex") !== "false"
  );
  
  const [enableWesternRegex, setEnableWesternRegex] = useState<boolean>(
    () => safeLocalStorage.getItem("ajn_enable_western_regex") !== "false"
  );

  const toggleTheatreMode = useCallback(() => {
    setIsTheatreMode(prev => {
      const next = !prev;
      addLog(`Theatre Mode: ${next ? "ENABLED" : "DISABLED"}`);
      return next;
    });
  }, [addLog]);

  const toggleAudioOnly = useCallback(() => {
    setIsAudioOnly(prev => {
      const next = !prev;
      addLog(`Audio-Only Mode: ${next ? "ENABLED" : "DISABLED"}`);
      return next;
    });
  }, [addLog]);

  // Section 4 & 16: Primary Navigation Model Contract
  const [isHardPurged, setIsHardPurged] = useState<boolean>(() => {
    return safeLocalStorage.getItem('AJN_ALLOW_EMPTY_STATE') === 'true';
  });
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const [activeNav, setActiveNav] = useState<"home" | "guide" | "command" | "player" | "library" | "favorites" | "search" | "matrix" | "settings" | "sync" | "ajn-hub" | "telemetry" | "control-hub">(
    () => {
      if (safeLocalStorage.getItem("ajn_theatre_mode") === "true") return "player";
      const startPref = safeLocalStorage.getItem("ajn_startup_view") as any;
      return startPref || "home";
    }
  );
  const [selectedMatrixFolder, setSelectedMatrixFolder] = useState("all");

  // Global Persistent Playback Hook (Decouples player from UI navigation routes)
  usePlaybackPersistence(activeNav, currentUrl, currentTitle);

  // Track Native PiP State
  const [isNativePiP, setIsNativePiP] = React.useState(false);

  // Handle PiP Cleanup on Unmount
  useEffect(() => {
    return () => {
      const video = mainVideoRef.current;
      if (video && document.pictureInPictureElement === video) {
        document.exitPictureInPicture().catch((err) => {
          console.error("[PiP Cleanup] Failed to exit PiP on unmount:", err);
        });
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, []);

  // Exit PiP whenever the current source moves off VideoPlayer entirely
  useEffect(() => {
    const usingVideoPlayer = currentUrl && !isRumbleUrl(currentUrl) && !isYouTubeUrl(currentUrl);
    if (!usingVideoPlayer && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
  }, [currentUrl]);

  // Handle returning from Native PiP
  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video) return;
    
    const handleEnterPiP = () => setIsNativePiP(true);
    const handleLeavePiP = () => {
      setIsNativePiP(false);
      setMiniPos({ x: 0, y: 0 });
      if (activeNav !== "player") {
        setActiveNav("player");
      }
    };
    
    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);
    
    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [activeNav]);

  // Dynamic AJN Hub Archive Episodes State and Fetching Hook
  const [ajnEpisodes, setAjnEpisodes] = useState<any[]>([]);
  const [loadingAjn, setLoadingAjn] = useState<boolean>(false);
  const [nowPlayingChannels, setNowPlayingChannels] = useState<{name: string, url: string, number: number, category: string}[]>([]);

  useEffect(() => {
    fetch(BACKEND_URL + "/api/now-playing").then(r => {
      const contentType = r.headers.get("content-type") || "";
      if (r.ok && contentType.includes("application/json")) {
        return r.json();
      }
      return {};
    }).then((d: any) => setNowPlayingChannels(d.channels || [])).catch(e => console.warn(e));
  }, []);

  useEffect(() => {
    let active = true;
    const loadAjnEpisodes = async () => {
      setLoadingAjn(true);
      try {
        const res = await fetch(BACKEND_URL + "/api/ajn-archive");
        if (res.ok) {
          const data = await res.json();
          if (active && data.success && data.episodes) {
            setAjnEpisodes(data.episodes);
          }
        }
      } catch (err) {
        console.error("Failed to load AJN archive episodes in LiteApp (Internet Archive may be experiencing a power outage causing service disruptions):", err);
      } finally {
        if (active) setLoadingAjn(false);
      }
    };
    loadAjnEpisodes();
    return () => {
      active = false;
    };
  }, []);

  const resolvedAjnHubSegments = useMemo(() => {
    if (!ajnEpisodes || ajnEpisodes.length === 0) {
      return [];
    }

    const now = new Date();
    const recentWindowAgo = new Date(now.getTime() - 120 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const filtered = ajnEpisodes.filter(ep => {
      const pubDate = new Date(ep.pubDate);
      const isRecentWindow = pubDate >= recentWindowAgo;
      const titleLower = ep.title.toLowerCase();
      const showLower = (ep.show || "").toLowerCase();
      const isSundayShow = (showLower.includes("sunday") || titleLower.includes("sunday")) && pubDate >= oneWeekAgo;
      return isRecentWindow || isSundayShow;
    });

    // Sort descending by pubDate (newest first)
    filtered.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return filtered.map((ep, index) => {
      let defaultThumb = "https://archive.org/download/daily-highlights/lmbsa.png";
      const showLower = (ep.show || "").toLowerCase();
      if (showLower.includes("war")) {
        defaultThumb = "https://archive.org/download/daily-highlights/warroom.png";
      } else if (showLower.includes("alex")) {
        defaultThumb = "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp";
      } else if (showLower.includes("sunday")) {
        defaultThumb = "https://archive.org/download/daily-highlights/emegency.png";
      }

      // Display Day String (Today, Yesterday, or the date)
      const epDate = new Date(ep.pubDate);
      const today = now.toISOString().split('T')[0];
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];
      
      let displayDayStr = ep.dateKey;
      if (ep.dateKey === today) displayDayStr = "Today";
      else if (ep.dateKey === yesterday) displayDayStr = "Yesterday";
      else {
        // e.g. "Sunday"
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        displayDayStr = days[epDate.getDay()];
      }

      return {
        id: `seg-ajn-${index}-${ep.dateKey}`,
        title: `${ep.show || "AJN Broadcast"} - ${ep.hour || "Full Show"} (${displayDayStr})`,
        timestampLabel: ep.hour || "Full Show",
        duration: "1:00:00",
        thumbnailUrl: defaultThumb,
        broadcaster: (ep.show || "AJN").toUpperCase(),
        videoUrl: ep.videoUrl
      };
    });
  }, [ajnEpisodes]);


  // Synchronized Playhead and Resume Progress Convergence
  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video || !currentUrl) return;

    let hasSynced = false;

    const handleSeekOnLoad = () => {
      if (hasSynced) return;
      try {
        let seekPos = 0;

        // 1. Check ajn_video_positions for specific URL
        const savedJSON = safeLocalStorage.getItem("ajn_video_positions");
        if (savedJSON) {
          const saved = JSON.parse(savedJSON);
          if (typeof saved[currentUrl] === "number") {
            seekPos = saved[currentUrl];
          }
        }

        // 2. Fallback check for Channel 1 specific temporary playhead sync
        if (currentUrl.includes("infowars") || currentUrl.includes("warroom") || currentTitle.includes("CH 1") || currentTitle.includes("AJN / Warroom")) {
          const ch1Seek = safeLocalStorage.getItem("ajn_playback_ch1_seek_pos");
          const ch1Url = safeLocalStorage.getItem("ajn_playback_ch1_last_url");
          const ch1Timestamp = safeLocalStorage.getItem("ajn_playback_ch1_timestamp");
          
          if (ch1Seek && ch1Url === currentUrl && ch1Timestamp) {
            const elapsed = Math.floor(Date.now() / 1000) - Number(ch1Timestamp);
            seekPos = Number(ch1Seek) + elapsed;
          }
        }

        // Ensure we're targeting the correct source to prevent premature seek
        if (video.currentSrc && !video.currentSrc.includes("localhost") && !video.currentSrc.includes(window.location.host)) {
           // We're good to seek
        }

        if (seekPos > 0 && video.readyState >= 1) {
          hasSynced = true;
          if (video.duration && seekPos < video.duration) {
            video.currentTime = seekPos;
            addLog(`[Playout Convergence] Synced playhead to seek position: ${Math.round(seekPos)}s / ${Math.round(video.duration)}s`, "info");
          } else {
            video.currentTime = seekPos;
            addLog(`[Playout Convergence] Synced playhead to raw seek position: ${Math.round(seekPos)}s`, "info");
          }
        }
      } catch (err) {
        console.error("[Playout Convergence] Error seeking playhead:", err);
      }
    };

    video.addEventListener("loadedmetadata", handleSeekOnLoad);
    video.addEventListener("canplay", handleSeekOnLoad);
    
    // Only fire immediately if it's actually loaded a valid external source (not empty or stale localhost)
    if (video.readyState >= 1 && video.currentSrc && !video.currentSrc.endsWith(window.location.host + "/")) {
      handleSeekOnLoad();
    }
    
    return () => {
      video.removeEventListener("loadedmetadata", handleSeekOnLoad);
      video.removeEventListener("canplay", handleSeekOnLoad);
    };
  }, [currentUrl, currentTitle,  addLog]);

  // Section 7 & 12: Startup Flow & First-Run Wizard
  const [lastSession, setLastSession] = useState<SessionState | null>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_last_session");
      if (!stored) return null;
      const parsed: SessionState = JSON.parse(stored);
      // Validate structure before using
      if (!parsed.url || !parsed.name) {
        safeLocalStorage.removeItem("ajn_last_session");
        return null;
      }
      
      // Strip start parameter if it's a live broadcast
      const isLive = !parsed.duration;
      if (isLive && parsed.url) {
        parsed.url = parsed.url.replace(/([?&])start=\d+(&|$)/, (match, p1, p2) => p2 === '&' ? p1 : '');
      }

      // Valid if less than 12 hours old
      if (Date.now() - parsed.timestamp < 12 * 3600 * 1000) return parsed;
      return null;
    } catch (err) {
      console.warn("Failed to resume last channel, falling back to TV Guide", err);
      safeLocalStorage.removeItem("ajn_last_session");
      return null;
    }
  });

      const [showWizard, setShowWizard] = useState<boolean>(false);

  useEffect(() => {
    const hasCompletedOnboarding = safeLocalStorage.getItem('ajn_onboarding_complete') === 'true';
    
    if (!hasCompletedOnboarding) {
      setShowWizard(true);
      return;
    }

    setShowWizard(false);
    
    if (lastSession && !currentUrl) {
      addLog(`[Session Restore] Resuming last channel: ${lastSession.name}`, "info");
      playStream(lastSession.url, lastSession.name, lastSession.currentTime);
    }
  }, []);

  // Favorites store
  const [favUrls, setFavUrls] = useState<string[]>(() => {
    try {
      return JSON.parse(safeLocalStorage.getItem("ajn_fav_urls") || "[]");
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavUrls(prev => {
      const next = prev.includes(url) ? prev.filter(x => x !== url) : [...prev, url];
      safeLocalStorage.setItem("ajn_fav_urls", JSON.stringify(next));
      return next;
    });
  }, []);

  // Dynamic HLS playout support for the native video element
  useEffect(() => {
    if (currentUrl && currentTitle) {
      const sess: SessionState = {
        url: currentUrl,
        name: currentTitle,
        currentTime: playerStore.currentTime,
        duration: playerStore.duration,
        timestamp: Date.now(),
        isAudioOnly: isAudioOnly
      };
      safeLocalStorage.setItem("ajn_last_session", JSON.stringify(sess));
      
      // Throttle React state update to once every 5 seconds to prevent continuous re-rendering lag
      const lastUpdate = (window as any).__ajn_last_session_update_time || 0;
      const now = Date.now();
      if (now - lastUpdate > 5000 || !lastSession || lastSession.url !== currentUrl || lastSession.isAudioOnly !== isAudioOnly) {
        setLastSession(sess);
        (window as any).__ajn_last_session_update_time = now;
      }
    }
  }, [currentUrl, currentTitle, playerStore.currentTime, playerStore.duration, lastSession, isAudioOnly]);

  // Save persistent settings
  useEffect(() => {
    safeLocalStorage.setItem("ajn_startup_view", defaultStartupView);
  }, [defaultStartupView]);

  useEffect(() => {
    safeLocalStorage.setItem("ajn_layout_template", layoutTemplate);
  }, [layoutTemplate]);

  // Scroll main content into view when navigation changes
  useEffect(() => {
    if (activeNav !== "home" && activeNav !== "player") {
      const el = document.getElementById("nav-content-area") || document.getElementById("unified-player-app");
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [activeNav]);

  // Section 5 & UX Kernel: Guardrail Runtime Layer & Self-Healing Enforcement
  useEffect(() => {
    // Block the auto-injection process if a wipe operation is actively executing
    if (isPurging) return;

    // Intercept 1: Blank screen prevention (noContentLoaded)
    if (channels.length === 0 && !isLoading) {
      if (isHardPurged) {
        console.log("Rule A Override: Pristine zero-state preserved by user request.");
      } else if ((import.meta as any).env.DEV && safeLocalStorage.getItem("ajn_user_cleared") !== "true" && safeLocalStorage.getItem("ajn_user_uploaded") !== "true") {
        parseAndLoadM3U(DEFAULT_M3U);
        addLog("UX Guardrail Intercept: Zero channels detected. Auto-injected Demo Channels.", "warning");
      }
    }
    // Intercept 2: Invalid route protection (noActiveRoute)
    const validRoutes = ["home", "guide", "command", "player", "library", "favorites", "search", "matrix", "settings", "sync", "ajn-hub"];
    if (!validRoutes.includes(activeNav)) {
      setActiveNav("home");
      addLog(`UX Guardrail Intercept: Invalid route (${activeNav}) detected. Forced safe jump to Home.`, "warning");
    }
      }, [channels.length, isLoading, activeNav, lastSession, currentUrl, parseAndLoadM3U, addLog, isHardPurged, isPurging]);

  useEffect(() => {
    safeLocalStorage.setItem("ajn_theatre_mode", isTheatreMode ? "true" : "false");
  }, [isTheatreMode]);

  useEffect(() => {
    safeLocalStorage.setItem("ajn_audio_only", isAudioOnly ? "true" : "false");
  }, [isAudioOnly]);

  useEffect(() => {
    safeLocalStorage.setItem("ajn_enable_russian_regex", enableRussianRegex ? "true" : "false");
  }, [enableRussianRegex]);

  useEffect(() => {
    safeLocalStorage.setItem("ajn_enable_western_regex", enableWesternRegex ? "true" : "false");
  }, [enableWesternRegex]);

  // Modal ESC Key Handling
  useEscapeKey(() => {
    if (showWizard) {
      safeLocalStorage.setItem("ajn_onboarding_complete", "true");
      setShowWizard(false);
      
    }
      });

  // Lazy loading configurations for content grids
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [isLazyLoading, setIsLazyLoading] = useState(false);

  // Sidebar compact TV Guide channel deck configuration
  const [activeDeckTab, setActiveDeckTab] = useState<'all' | 'segmented' | 'full' | 'archives' | 'other' | 'fav'>('all');
  const [deckLimit, setDeckLimit] = useState(5);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isFixingDurations, setIsFixingDurations] = useState(false);
  const [fixProgress, setFixProgress] = useState<{current: number, total: number} | null>(null);

  const toggleGroupCollapse = useCallback((groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  }, []);

  // Player looping and shuffling controls
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [loopMode, setLoopMode] = useState(true);
  const [shuffleMode, setShuffleMode] = useState<'none' | 'random' | 'fair'>('none');
  const [playedUrls, setPlayedUrls] = useState<string[]>([]);

  const filteredChannels = useMemo(() => {
    return channels.filter(ch => 
      ch.name.toLowerCase().includes(playerIptvQuery.toLowerCase()) || 
      (ch.group && ch.group.toLowerCase().includes(playerIptvQuery.toLowerCase()))
    );
  }, [channels, playerIptvQuery]);

  const { segmentedChannels, fullLengthChannels, archiveChannels, otherChannels } = useMemo(() => {
    const archives = filteredChannels.filter(ch => ch.group === "AJN Archives");
    const nonArchives = filteredChannels.filter(ch => ch.group !== "AJN Archives");

    const segmented = nonArchives.filter(ch => ch.duration === 300 || ch.name.includes("CrossTalk") || ch.name.includes("News ["));
    const fullLength = nonArchives.filter(ch => ch.duration === 3590 || ch.name.includes("Hour") || ch.name.includes("Alex Jones Show") || ch.name.includes("War Room"));
    const others = nonArchives.filter(ch => !segmented.includes(ch) && !fullLength.includes(ch));
    return {
      segmentedChannels: segmented,
      fullLengthChannels: fullLength,
      archiveChannels: archives,
      otherChannels: others
    };
  }, [filteredChannels]);

  const favoriteChannels = useMemo(() => {
    return channels.filter(ch => favUrls.includes(ch.url));
  }, [channels, favUrls]);

  useEffect(() => {
    setVisibleLimit(12);
    setDeckLimit(5);
    setPlayedUrls([]);
  }, [playerIptvQuery, channels, activeDeckTab]);

  const handleFixDurations = useCallback(async () => {
    if (!batchUpdateDurations) return;
    
    // Find missing or estimated
    const missing = channels.filter(ch => ch.duration === null || ch.duration === undefined || ch.duration_source === "estimated" || ch.duration_source === "failed");
    if (missing.length === 0) {
       addLog("All channels have probed or existing durations.", "info");
       return;
    }

    setIsFixingDurations(true);
    setFixProgress({ current: 0, total: missing.length });

    try {
       const CONCURRENCY = 50; // batch size for API
       let totalProcessed = 0;
       
       for (let i = 0; i < missing.length; i += CONCURRENCY) {
          const batch = missing.slice(i, i + CONCURRENCY);
          const reqItems = batch.map(ch => ({ id: ch.url, url: ch.url }));
          
          try {
             const res = await fetch(BACKEND_URL + "/api/probe-duration", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ items: reqItems, timeout: 15 })
             });
             const data = await res.json();
             
             if (data.success && data.results) {
               await batchUpdateDurations(data.results);
             }
          } catch (e: any) {
             console.error("Batch duration fix failed:", e);
          }
          
          totalProcessed += batch.length;
          setFixProgress({ current: Math.min(totalProcessed, missing.length), total: missing.length });
       }
       addLog(`Completed duration probing for ${missing.length} items.`, "info");
    } finally {
       setIsFixingDurations(false);
       setFixProgress(null);
    }
  }, [channels, batchUpdateDurations, addLog]);

  // Section 13.1: One-Click Go Live Control
  const handleGoLive = useCallback(() => {
    setActiveNav("player");
    const video = mainVideoRef.current;
    if (video) {
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        video.currentTime = video.duration;
      }
      if (playerStore.state !== "playing") {
        safePlay(video);
      }
    }
    addLog("NOW Jump: Synchronized playhead to live broadcast edge.");
  }, [ playerStore.state, addLog]);

  const playNextChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const currentIndex = filteredChannels.findIndex(ch => ch.url === currentUrl);

    if (shuffleMode !== 'none') {
      if (shuffleMode === 'fair') {
        const unplayed = filteredChannels.filter(ch => !playedUrls.includes(ch.url));
        if (unplayed.length === 0) {
          if (loopMode) {
            const nextCh = filteredChannels.find(ch => ch.url !== currentUrl) || filteredChannels[0];
            setPlayedUrls([nextCh.url]);
            playStream(nextCh.url, nextCh.name);
          }
        } else {
          const randomCh = unplayed[Math.floor(Math.random() * unplayed.length)];
          setPlayedUrls(prev => [...prev, randomCh.url]);
          playStream(randomCh.url, randomCh.name);
        }
      } else {
        const otherChannels = filteredChannels.filter(ch => ch.url !== currentUrl);
        const sourceList = otherChannels.length > 0 ? otherChannels : filteredChannels;
        const randomCh = sourceList[Math.floor(Math.random() * sourceList.length)];
        playStream(randomCh.url, randomCh.name);
      }
    } else {
      let nextIndex = currentIndex !== -1 ? currentIndex + 1 : 0;
      if (nextIndex >= filteredChannels.length) {
        if (loopMode) {
          const nextCh = filteredChannels[0];
          playStream(nextCh.url, nextCh.name);
        }
      } else {
        const nextCh = filteredChannels[nextIndex];
        playStream(nextCh.url, nextCh.name);
      }
    }
  }, [filteredChannels, currentUrl, shuffleMode, playedUrls, loopMode, playStream]);

  useEffect(() => {
    const handleFormatError = (e: any) => {
       addLog(`Format error on URL: ${e.detail.url}. Stream unavailable.`, "error");
    };
    window.addEventListener("ajn-stream-format-error", handleFormatError);
    return () => window.removeEventListener("ajn-stream-format-error", handleFormatError);
  }, [addLog]);

  // Wall-Clock Boundary Polling (Primary Transition Trigger)
  const activeHourRef = useRef(new Date().getHours());
  useEffect(() => {
    if (!currentUrl || !autoAdvance) return;

    const boundaryCheck = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Check if wall-clock time has crossed the top of the hour boundary
      if (currentHour !== activeHourRef.current) {
        activeHourRef.current = currentHour;
        
        // Decouple transition timing from raw video duration and anchor to deterministic clock
        const isScheduledBlock = currentTitle.includes("Hour") || currentTitle.includes("AJN") || currentTitle.includes("War Room") || currentTitle.includes("Alex Jones");
        if (isScheduledBlock) {
           addLog(`[Wall-Clock Trigger] Top of the hour boundary crossed (${currentHour}:00). Auto-advancing to next scheduled block...`, "info");
           playNextChannel();
        }
      }
    }, 1000);

    return () => clearInterval(boundaryCheck);
  }, [currentUrl, currentTitle, autoAdvance, playNextChannel, addLog]);

  const playPrevChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const currentIndex = filteredChannels.findIndex(ch => ch.url === currentUrl);
    let prevIndex = currentIndex !== -1 ? currentIndex - 1 : filteredChannels.length - 1;
    if (prevIndex < 0) prevIndex = loopMode ? filteredChannels.length - 1 : 0;
    const prevCh = filteredChannels[prevIndex];
    if (prevCh) playStream(prevCh.url, prevCh.name);
  }, [filteredChannels, currentUrl, loopMode, playStream]);

  // Seek handler for fullscreen video
  const toggleFullscreen = () => {
    const el = document.getElementById("unified-player-app");
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (mainVideoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await mainVideoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        addLog(`Native PiP error: ${(err as Error).message}`, "error");
      }
    } else {
      addLog("Native Picture-in-Picture is not supported in this browser.", "warning");
    }
  };

  return (
    <div
      id="unified-player-app"
      onPointerDown={handleFirstInteractionUnmute}
      className={`min-h-screen flex flex-col font-sans transition-all duration-300 antialiased select-none ${theme === "light" ? "text-slate-800 bg-slate-50" : "text-slate-200 bg-[#000000]"}`}
    >
      {showStaticDemoBanner && <StaticDemoBanner onDismiss={dismissStaticDemoBanner} />}

      {/* P0 fix: this was min-h-screen (a floor, no ceiling) with no overflow
          constraint, so the whole page could grow past the viewport whenever
          any deeply-nested content overflowed. Now locked to the viewport
          (h-screen + overflow-hidden) so only elements that explicitly opt
          into overflow-y-auto can ever scroll. */}
      
      {/* Dynamic Stream Pipeline Transition Guard */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-[#06080C]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 select-none transition-all duration-300">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#000205] to-[#000102] pointer-events-none" />
          <div className="relative flex flex-col items-center max-w-sm text-center space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full" />
              <div className="absolute w-16 h-16 border-4 border-t-indigo-500 border-r-cyan-500 rounded-full animate-spin" />
              <div className="absolute w-10 h-10 bg-indigo-950/40 rounded-full flex items-center justify-center border border-indigo-500/30 text-indigo-400 font-mono text-[10px] font-black animate-pulse">
                TV
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black tracking-widest text-slate-100 uppercase font-mono">
                TUNING BROADCAST CHANNEL
              </h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-wide leading-relaxed max-w-[280px]">
                Aligning audio/video decoder streams and buffering live satellite chunks...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section 12: First-Run Wizard Overlay */}
      <AnimatePresence>
      {showWizard && (
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`w-full max-w-md rounded-2xl border p-6 space-y-6 shadow-2xl ${theme === "light" ? "bg-white border-slate-200" : "bg-[#0B0E14] border-blue-500/30 shadow-blue-950/50"}`}
          >
            <div className="flex items-center gap-3 border-b border-slate-800/40 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/40 font-black text-xl">
                📺
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight uppercase text-white">AJN Liberty Play</h2>
                <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Master UX Onboarding Wizard</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
              <p>Welcome to the modernized television-first broadcast console. Designed for zero configuration and instant playout.</p>
              
              <div className="p-3.5 rounded-2xl bg-black/40 border border-slate-800 space-y-3">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">Unified Source Matrix</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> M3U Playlists</div>
                  <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> XMLTV Guide</div>
                  <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> YouTube Live</div>
                  <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Rumble Embeds</div>
                  <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Archive.org Vault</div>
                  <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> RSS / Podcasts</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-100 font-mono text-xs">✔ Ready for Playback</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  safeLocalStorage.setItem("ajn_onboarding_complete", "true");
                  setShowWizard(false);
                  
                }}
                className="w-1/3 py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 cursor-pointer rounded-2xl text-xs font-black tracking-widest text-slate-300 uppercase font-mono transition-all"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  safeLocalStorage.setItem("ajn_onboarding_complete", "true");
                  setShowWizard(false);
                  
                  if ((import.meta as any).env.DEV) {
                    parseAndLoadM3U(DEFAULT_M3U);
                  }
                  setActiveNav("guide");
                  addLog("Onboarding Wizard completed: TV Guide launched.");
                }}
                className="w-2/3 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 cursor-pointer rounded-2xl text-xs font-black tracking-widest text-white shadow-lg shadow-blue-900/40 uppercase font-mono flex items-center justify-center gap-2 transition-all"
              >
                <span>Launch TV Guide</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      

      {/* GLOBAL TOP NAVIGATION SHELL (Section 4 & Section 16) */}
      <header className={`min-h-[4.5rem] py-2 px-4 lg:px-6 flex flex-wrap items-center justify-between border-b shrink-0 z-[100] select-none gap-4 overflow-x-auto transition-colors ${theme === "light" ? "border-slate-200 bg-white/95 shadow-sm" : "border-slate-800/60 bg-[#06080C]/95 shadow-lg"}`}>
        
        {/* Brand Surface */}
        <div 
          onClick={() => setActiveNav("home")}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-950 font-black text-lg border border-blue-400/20">
            📺
          </div>
          <div className="hidden sm:block">
            <h1 className={`text-xs font-black tracking-tight uppercase leading-none ${theme === "light" ? "text-slate-900" : "text-white"}`}>
              AJN LIBERTY PLAY
            </h1>
            <span className="text-[8px] font-mono uppercase tracking-widest text-blue-500 font-bold">TV-First OS • v12.5</span>
          </div>
        </div>

        {/* Section 4.1 Required Global Navigation Items (1-Click Global Contract) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile Menu Button */}
          <div className="relative md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 sm:p-2 bg-slate-800/50 hover:bg-slate-700 text-white rounded-xl border border-slate-700 flex items-center gap-1.5"
            >
              <List className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Menu</span>
            </button>
            
            {mobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <div className="fixed top-18 left-4 right-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[110] flex flex-col py-2 max-h-[75vh] overflow-y-auto overscroll-contain">
                {[
                  { id: "home", label: "Home", icon: Home },
                  { id: "guide", label: "Guide", icon: Tv },
                  { id: "control-hub", label: "Control Hub", icon: Activity, expert: true },
                  { id: "command", label: "Command", icon: Calendar, devOnly: true, expert: true },
                  { id: "player", label: "Player", icon: Play },
                  { id: "ajn-hub", label: "AJN Hub", icon: HardDrive, expert: true },
                  { id: "matrix", label: "Matrix", icon: Grid, devOnly: true, expert: true },
                  { id: "sync", label: "Sync", icon: Zap, devOnly: true, expert: true },
                  { id: "library", label: "Library", icon: List },
                  { id: "favorites", label: "Favs", icon: Star },
                  { id: "search", label: "Search", icon: Search },
                  { id: "telemetry", label: "Telemetry", icon: Activity, devOnly: true, expert: true },
                  { id: "settings", label: "Settings", icon: SettingsIcon }
                ].filter(item => {
                  const isDevOnly = item.devOnly && !(import.meta as any).env.DEV;
                  if (isDevOnly) return false;
                  if (item.expert && !showExpertMode) return false;
                  return true;
                }).map(item => {
                  const IconComp = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveNav(item.id as any);
                        setMobileMenuOpen(false);
                      }}
                      className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-3 cursor-pointer text-left ${
                        isActive
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <IconComp className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              </>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1 sm:gap-2 overflow-x-auto py-1.5 px-2.5 sm:px-4 rounded-2xl bg-black/20 border border-slate-800/40 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full max-w-none lg:max-w-4xl mx-2">
            {[
              { id: "home", label: "Home", icon: Home },
              { id: "guide", label: "Guide", icon: Tv },
              { id: "control-hub", label: "Control Hub", icon: Activity, expert: true },
              { id: "command", label: "Command", icon: Calendar, devOnly: true, expert: true },
              { id: "player", label: "Player", icon: Play },
              { id: "ajn-hub", label: "AJN Hub", icon: HardDrive, expert: true },
              { id: "matrix", label: "Matrix", icon: Grid, devOnly: true, expert: true },
              { id: "sync", label: "Sync", icon: Zap, devOnly: true, expert: true },
              { id: "library", label: "Library", icon: List },
              { id: "favorites", label: "Favs", icon: Star },
              { id: "search", label: "Search", icon: Search },
              { id: "telemetry", label: "Telemetry", icon: Activity, devOnly: true, expert: true },
              { id: "settings", label: "Settings", icon: SettingsIcon }
            ].filter(item => {
              const isDevOnly = item.devOnly && !(import.meta as any).env.DEV;
              if (isDevOnly) return false;
              if (item.expert && !showExpertMode) return false;
              return true;
            }).map(item => {
              const IconComp = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id as any);
                    if (item.id === "guide") addLog("TV Guide Priority: Opened first-class live guide.");
                    if (item.id === "command") addLog("AJN Command Center: Opened standalone operations board.");
                    if (item.id === "sync") addLog("Remote Headend Sync: Opened transmission console.");
                    if (item.id === "telemetry") addLog("System Diagnostics: Opened real-time Telemetry Dashboard.");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 select-none ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                  title={`Switch to ${item.label}`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section 6 & 13: Explicit Theatre Mode Controls & Go Live Shortcut */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Section 13.1 One-Click Return to Live */}
          <button
            onClick={handleGoLive}
            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-[10px] font-black tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            title="NOW Jump: Jump straight to active live broadcast stream"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping block" />
            <span>NOW • LIVE</span>
          </button>

          {/* Section 6.1 Theatre Mode Toggle */}
          <button
            onClick={toggleTheatreMode}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
              isTheatreMode
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-md shadow-amber-950/30"
                : "bg-slate-800/30 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Toggle Theatre Mode (Persists across sessions)"
          >
            <Maximize className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isTheatreMode ? "THEATRE ON" : "THEATRE"}</span>
          </button>

          {/* Section 6.2 Audio Only Toggle */}
          <button
            onClick={toggleAudioOnly}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
              isAudioOnly
                ? "bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-md shadow-blue-950/30"
                : "bg-slate-800/30 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Toggle Audio Only Mode (Saves bandwidth & persists across sessions)"
          >
            <Radio className={`w-3.5 h-3.5 ${isAudioOnly && isPlaying ? "animate-pulse text-blue-400" : ""}`} />
            <span className="hidden sm:inline">{isAudioOnly ? "AUDIO ONLY ON" : "AUDIO ONLY"}</span>
          </button>

          {/* Studio Mode Switch */}
          {process.env.NODE_ENV !== "production" && ( /* P2 FIX: Hidden from production */ 
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-800/10 border border-slate-800/30 select-none">
              <span className="text-[9px] font-mono font-bold text-slate-400">STUDIO MODE</span>
              <button
                onClick={toggleExpertMode}
                className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer outline-none relative flex items-center ${
                  showExpertMode ? "bg-blue-600" : "bg-slate-700"
                }`}
                title="Toggle Studio (Expert) Mode"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    showExpertMode ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Studio Deck Button */}
          {showExpertMode && (
            <button
              onClick={() => setShowDiagnosticsDrawer(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold flex items-center gap-1.5 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer"
              title="Open Real-time Telemetry and Advanced Controls"
            >
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>STUDIO DECK</span>
            </button>
          )}

          {/* <GenerationQueueMonitor /> */}
          {showExpertMode && <PlayoutBridgeStatusPanel />}
          {showExpertMode && <StatusIndicatorBar theme={theme} />}
          <HeaderClock />

          <button 
            onClick={toggleTheme}
            className={`p-2 border rounded-xl cursor-pointer transition-all active:scale-95 ${theme === "light" ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-amber-500" : "bg-slate-800/30 hover:bg-slate-800 border-slate-800/50 text-slate-400 hover:text-white"}`}
            title="Toggle Theme"
          >
            {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT BODY CONTAINER */}
      <main id="nav-content-area" className="flex-1 relative flex flex-col bg-inherit focus:outline-none" tabIndex={0}>
        
        {isVaultLoading ? (
          <div className="w-full flex flex-col items-center justify-center min-h-[400px] w-full">
            <div className="flex flex-col items-center max-w-sm text-center space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
                <div className="absolute w-16 h-16 border-4 border-t-blue-500 rounded-full animate-spin" />
              </div>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">Initializing Stream Engine...</p>
            </div>
          </div>
        ) : channels.length === 0 && isHardPurged ? (
          <div className="w-full flex flex-col items-center justify-center min-h-[400px] border border-dashed border-slate-800 rounded-2xl bg-black/50 p-8 text-center max-w-4xl mx-auto my-6 w-[calc(100%-2rem)]">
            <p className="text-red-400 font-mono mb-4 text-sm tracking-wider uppercase font-bold">
              [SYSTEM SLATE: PRISTINE ZERO-STATE ACTIVE]
            </p>
            <h3 className="text-xl font-black uppercase text-white mb-2">System Cleared</h3>
            <p className="text-slate-400 text-xs max-w-md mb-6 leading-relaxed">
              All active video streams, configurations, and baseline demonstration routes have been completely purged from memory. The playout core is completely unmounted.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={async () => {
                  safeLocalStorage.removeItem('AJN_ALLOW_EMPTY_STATE');
                  safeLocalStorage.removeItem('ajn_user_cleared');
                  setIsHardPurged(false); // Triggers the default Guardrail check to re-inject demo feeds
                  if (reloadVault) {
                    await reloadVault();
                  }
                  addLog("Zero-state cleared. Auto-injecting Default Demo channels.", "info");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-600/30 active:scale-95 cursor-pointer animate-fadeIn"
              >
                Load Default Demo Feeds
              </button>
              
              <button
                onClick={async () => {
                  const url = prompt("Enter custom M3U playlist URL:");
                  if (url && url.trim()) {
                    try {
                      addLog(`Connecting to remote playout URL: ${url}`, "info");
                      const res = await fetch(BACKEND_URL + `/api/stream-proxy?url=${encodeURIComponent(url)}`);
                      if (!res.ok) throw new Error("HTTP connection failed with status " + res.status);
                      const text = await res.text();
                      await parseAndLoadM3U(text);
                      safeLocalStorage.removeItem('AJN_ALLOW_EMPTY_STATE');
                      safeLocalStorage.removeItem('ajn_user_cleared');
                      setIsHardPurged(false);
                      if (reloadVault) {
                        await reloadVault();
                      }
                      addLog("Custom playlist imported successfully!", "info");
                    } catch (error: any) {
                      addLog(`Connection failed: ${error.message || error}`, "error");
                      alert(`Could not import remote feed: ${error.message || error}`);
                    }
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer active:scale-95"
              >
                Import Custom M3U Playlist
              </button>
            </div>
          </div>
        ) : (
          <>
          {activeNav === "home" && (
            <div className="w-full p-6 lg:p-10 max-w-6xl mx-auto w-full space-y-8 animate-fadeIn">
            
            <div className="space-y-2 border-b border-slate-800/40 pb-6">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-bold block">First Launch Experience • Section 3</span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">AJN Liberty Play</h2>
              <p className="text-xs text-slate-400 max-w-xl">
                Enterprise broadcast core underneath, television simplicity on the surface. Select a primary channel surface below to begin instant playback.
              </p>
            </div>

            {/* First Screen Rule Action Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Primary Live Feed Card */}
              <div 
                onClick={() => {
                  
                  setActiveNav("player");
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { 
                    
                    setActiveNav("player");
                  }
                }}
                role="button"
                tabIndex={0}
                className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-all duration-[var(--dur-med)] ease-[var(--ease-standard)] group flex flex-col shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-glow)]"
              >
                {/* Image Area */}
                <div className="relative w-full aspect-video bg-[var(--surface-2)] overflow-hidden">
                  <img src="https://archive.org/download/daily-highlights/gettyimages-1796841914.webp" alt="AJN Live Feed" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent opacity-90" />
                  
                  {/* Badge */}
                  <div className="absolute top-[var(--space-3)] left-[var(--space-3)]">
                    <span className="text-[var(--text-xs)] font-bold px-[var(--space-2)] py-[var(--space-1)] bg-[var(--live)] text-[#000] rounded-sm uppercase tracking-widest inline-flex items-center gap-1.5 shadow-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> LIVE NOW
                    </span>
                  </div>
                </div>

                {/* Metadata & Action */}
                <div className="p-[var(--space-4)] flex items-center justify-between">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-[var(--text-lg)] font-bold uppercase text-[var(--text-1)] truncate">AJN Live Feed</h3>
                    <p className="text-[var(--text-sm)] text-[var(--text-3)] truncate mt-[var(--space-1)]">Watch the 24/7 Official Broadcast</p>
                  </div>
                  <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--accent)] group-hover:bg-[var(--accent-2)] flex items-center justify-center text-white shrink-0 transition-colors">
                    <Play className="w-5 h-5 fill-white" />
                  </div>
                </div>
              </div>
              {/* TV Guide Card (Primary First-Class Surface) */}
              <div 
                onClick={() => setActiveNav("guide")}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { 
                    setActiveNav("guide");
                  }
                }}
                role="button"
                tabIndex={0}
                className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-blue-500/60 cursor-pointer transition-all group flex items-center justify-between shadow-lg"
              >
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-widest">PRIMARY DISCOVERY</span>
                  <h3 className="text-lg font-black uppercase text-white group-hover:text-blue-400 transition-colors">📺 TV Guide</h3>
                  <p className="text-xs font-mono text-slate-400">Open Live 24/7 Electronic Program Guide</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-blue-600 flex items-center justify-center text-slate-300 group-hover:text-white transition-all shrink-0">
                  <Tv className="w-6 h-6" />
                </div>
              </div>

              {/* Command Center Card (AJN Command Center - standalone) */}
              <div 
                onClick={() => setActiveNav("command")}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                     
                    setActiveNav("command");
                  }
                }}
                role="button"
                tabIndex={0}
                className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition-all group flex items-center justify-between shadow-lg"
              >
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest">COMMAND & SCHEDULING</span>
                  <h3 className="text-lg font-black uppercase text-white group-hover:text-indigo-400 transition-colors">📅 Command Center</h3>
                  <p className="text-xs font-mono text-slate-400">Browse and program calendar-based schedule shows</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-indigo-600 flex items-center justify-center text-slate-300 group-hover:text-white transition-all shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>

              {/* Open Playlist Pipeline Card (Section 11) */}
              <div 
                onClick={() => setActiveNav("library")}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                     
                    setActiveNav("library");
                  }
                }}
                role="button"
                tabIndex={0}
                className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition-all group flex items-center justify-between shadow-lg"
              >
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest">SECTION 11 IMPORT</span>
                  <h3 className="text-lg font-black uppercase text-white group-hover:text-cyan-400 transition-colors">📁 Open Playlist</h3>
                  <p className="text-xs font-mono text-slate-400">M3U • XMLTV • Archive • YouTube • Rumble</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-cyan-600 flex items-center justify-center text-slate-300 group-hover:text-white transition-all shrink-0">
                  <Folder className="w-6 h-6" />
                </div>
              </div>

              {/* Media Library Card */}
              <div 
                onClick={() => setActiveNav("library")}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                     
                    setActiveNav("library");
                  }
                }}
                role="button"
                tabIndex={0}
                className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-emerald-500/60 cursor-pointer transition-all group flex items-center justify-between shadow-lg"
              >
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest">VOD & RECORDINGS</span>
                  <h3 className="text-lg font-black uppercase text-white group-hover:text-emerald-400 transition-colors">🎬 Media Library</h3>
                  <p className="text-xs font-mono text-slate-400">Explore saved streams and recorded shows</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-emerald-600 flex items-center justify-center text-slate-300 group-hover:text-white transition-all shrink-0">
                  <Film className="w-6 h-6" />
                </div>
              </div>

              {/* Settings Card */}
              <div 
                onClick={() => setActiveNav("settings")}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                     
                    setActiveNav("settings");
                  }
                }}
                role="button"
                tabIndex={0}
                className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-slate-400 cursor-pointer transition-all group flex items-center justify-between shadow-lg md:col-span-2"
              >
                <div className="space-y-1">
                  <h3 className="text-base font-black uppercase text-white group-hover:text-slate-200 transition-colors">⚙ Settings & Advanced Deck</h3>
                  <p className="text-xs font-mono text-slate-400">Configure Default Startup View, Layout Templates, and unlock Professional Broadcaster Engine</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        )}

        {/* SURFACE 2: TV GUIDE (Section 5 First-Class Surface - High-tech TV Guide) */}
        <div className={`flex-1 min-h-0 flex flex-col bg-[#0B0E14] ${activeNav === "guide" ? "" : "hidden"}`}>
          <BroadcastTVGuide stopPreludeMusic={stopPreludeMusic}
            theme={theme}
            channels={channels}
            onSelectStream={({ url, title, seekPosition, trace, channelId, showTitle }) => {
              playStream(url, title, seekPosition, trace, channelId, showTitle);
              setActiveNav("player");
            }}
          />
        </div>

        {/* SURFACE 2.5: COMMAND CENTER (AJN Command Center - standalone) */}
        {activeNav === "command" && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#0B0E14]">
            <TVGuideDashboard
              onPlayMainStream={(url, title) => {
                playStream(url, title);
                setActiveNav("player");
              }}
            />
          </div>
        )}

        {/* SURFACE 3: PLAYER SURFACE (Section 8 & Section 9 & Theatre Mode) */}
        {activeNav === "player" && layoutTemplate === "quad" ? (
          <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden relative p-4 gap-4 bg-black ${isTheatreMode ? "inset-0 z-40 fixed theater-mode" : ""}`}>
             <QuadPlayerTemplate channels={channels} onPlayStream={(url, title) => { playStream(url, title); setLayoutTemplate("broadcast"); }} addLog={addLog} />
          </div>
        ) : (
          !showWizard && (
            <div 
              id="vid_main_player"
              className={`player-Rumble-cls ${
              activeNav === "player"
                ? `flex-1 flex flex-col lg:flex-row overflow-hidden relative p-4 gap-4 bg-black ${isTheatreMode ? "inset-0 z-40 fixed theater-mode" : ""}`
                : currentUrl 
                  ? `fixed shadow-2xl rounded-2xl overflow-hidden border border-slate-700 flex flex-col bg-black transition-opacity duration-300 ${isNativePiP ? "opacity-0 pointer-events-none -z-50" : "z-[100]"}`
                  : "opacity-0 pointer-events-none absolute w-px h-px overflow-hidden -z-50"
              }
            `}
              style={activeNav !== "player" ? { 
                width: "320px", 
                height: "220px", 
                bottom: isNativePiP ? "-1000px" : "24px", 
                right: isNativePiP ? "-1000px" : "24px", 
                transform: isNativePiP ? "none" : `translate(${miniPos.x}px, ${miniPos.y}px)`,
                cursor: isDraggingMini ? "grabbing" : "grab"
              } : undefined}
            >
            
            {/* Main Player Display Box */}
            <div className="flex-1 relative bg-black rounded-2xl overflow-hidden border border-slate-800 flex flex-col shadow-2xl min-w-0 min-h-0">
              
              {/* Top Header Bar for Current Segment metadata sync */}
              <div 
                className={`px-4 py-3 bg-[#0B0E14] border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0 select-none ${activeNav !== "player" ? `bg-black/95 py-2 px-3 ${isDraggingMini ? "cursor-grabbing" : "cursor-grab"}` : ""}`}
                onMouseDown={(e) => {
                  if (activeNav !== "player") {
                    setIsDraggingMini(true);
                    const player = document.getElementById("vid_main_player");
                    dragStartRef.current = {
                      startX: miniPos.x,
                      startY: miniPos.y,
                      mouseX: e.clientX,
                      mouseY: e.clientY,
                      vw: window.innerWidth,
                      vh: window.innerHeight,
                      rectWidth: player ? player.getBoundingClientRect().width : 0,
                      rectHeight: player ? player.getBoundingClientRect().height : 0
                    };
                  }
                }}
                onTouchStart={(e) => {
                  if (activeNav !== "player") {
                    setIsDraggingMini(true);
                    const player = document.getElementById("vid_main_player");
                    dragStartRef.current = {
                      startX: miniPos.x,
                      startY: miniPos.y,
                      mouseX: e.touches[0].clientX,
                      mouseY: e.touches[0].clientY,
                      vw: window.innerWidth,
                      vh: window.innerHeight,
                      rectWidth: player ? player.getBoundingClientRect().width : 0,
                      rectHeight: player ? player.getBoundingClientRect().height : 0
                    };
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {activeNav === "player" ? (
                    <>
                      <div className="px-2 py-0.5 rounded-md bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[9px] font-mono font-bold uppercase tracking-wider shrink-0">
                        Current Segment
                      </div>
                      <div className="h-3 w-px bg-slate-800 shrink-0" />
                    </>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  )}
                  <span className={`text-xs font-black text-slate-200 truncate font-mono ${activeNav !== "player" ? "text-[10px]" : ""}`}>
                    {currentTitle || (() => {
                      const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
                      return `Daily master playout files can play in the Daily Master Playout. EPG logs for ${dateStr}: 11:00 60 min Infowars Live Hour 1, Alex Jones Show Hour 1, live commentary on geopolitical breaking events and intelligence summaries. Geopolitics Hour 1 through all hours, and then War Room all hours play here. Daily files load and play daily files only. The date-of or day-before files are loaded to run. It can play the files here`;
                    })()}
                  </span>
                </div>
                
                {currentUrl && (
                  <div className="flex items-center gap-2 shrink-0">
                    {activeNav !== "player" ? (
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => {
                            setMiniPos({ x: 0, y: 0 });
                            setActiveNav("player");
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Restore Full Player"
                          className="player-close-btn p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Maximize className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            setMiniPos({ x: 0, y: 0 });
                            setPlayerStore((prev) => ({
                              ...prev,
                              state: "idle",
                              currentUrl: "",
                              currentTitle: ""
                            }));
                            addLog("[Playout Engine] Closed Picture-in-Picture window and stopped playback.", "info");
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Close Player"
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      (() => {
                        const activeCh = channels.find(ch => ch.url === currentUrl);
                        const isSegmented = activeCh?.duration === 300 || currentTitle.includes("CrossTalk") || currentTitle.includes("News [");
                        const isFullLength = activeCh?.duration === 3590 || currentTitle.includes("Hour") || currentTitle.includes("Alex Jones Show") || currentTitle.includes("War Room");
                        
                        if (isFullLength) {
                          return (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono font-bold uppercase">
                              🎬 Full Broadcast (~60m)
                            </span>
                          );
                        } else if (isSegmented) {
                          return (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase">
                              ✂️ Segmented Clip (5m)
                            </span>
                          );
                        } else {
                          const durSec = activeCh?.duration || playerStore.duration || 0;
                          if (durSec > 0) {
                            const m = Math.floor(durSec / 60);
                            return (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-mono font-bold uppercase">
                                📡 VOD ({m}m)
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-mono font-bold uppercase">
                              📡 LIVE STREAM
                            </span>
                          );
                        }
                      })()
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex-1 relative bg-black flex items-center justify-center">
                {currentUrl ? (
                  <>
                    {/* Visual Indicator: Cyberpunk Audio Active Badge */}
                    {isAudioOnly && (
                      <div className="absolute top-4 right-4 z-30 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-black tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-950/40 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                        <span>AUDIO ACTIVE</span>
                      </div>
                    )}

                    {/* High-Fidelity Audio-Only Studio Dashboard */}
                    {isAudioOnly && (
                      <div className="absolute inset-0 bg-[#06080C] flex flex-col items-center justify-center p-6 text-center select-none z-10">
                        {/* Space Grid radial background */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/15 via-[#07090e] to-black pointer-events-none" />
                        
                        <div className="relative z-10 space-y-6 max-w-md w-full">
                          {/* Spin vinyl visualization */}
                          <div className="relative w-32 h-32 flex items-center justify-center mx-auto mb-2">
                            <div className={`w-32 h-32 rounded-full border-4 border-slate-800/80 bg-black flex items-center justify-center relative shadow-black/80 shadow-2xl ${isPlaying ? "animate-spin-vinyl" : ""}`}>
                              <div className="absolute inset-2 rounded-full border border-slate-800/30" />
                              <div className="absolute inset-4 rounded-full border border-slate-800/20" />
                              <div className="absolute inset-6 rounded-full border border-slate-800/10" />
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 border border-slate-900 flex items-center justify-center font-black text-[10px] text-white shadow-inner tracking-wider">
                                AJN_LP
                              </div>
                            </div>
                            {/* Stylus needle decoration */}
                            <div className="absolute -top-1 right-1 w-6 h-12 origin-top rotate-[25deg] pointer-events-none">
                              <div className="w-1 h-10 bg-slate-500 rounded-full relative">
                                <div className="w-2 h-2 bg-slate-400 border border-slate-600 rounded absolute -bottom-1 -left-0.5" />
                              </div>
                            </div>
                          </div>

                          {/* Soundwave Spectrogram (10-Band Animated Waves) */}
                          <div className="flex items-center justify-center gap-1.5 h-10 w-full select-none">
                            <div className={`w-1.5 h-6 bg-blue-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-1" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-8 bg-indigo-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-2" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-10 bg-cyan-400/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-3" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-7 bg-indigo-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-4" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-5 bg-blue-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-5" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-8 bg-indigo-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-2" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-10 bg-cyan-400/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-3" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-7 bg-indigo-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-4" : "scale-y-[0.3]"}`} />
                            <div className={`w-1.5 h-6 bg-blue-500/80 rounded-full origin-bottom ${isPlaying ? "animate-wave-1" : "scale-y-[0.3]"}`} />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-mono tracking-widest text-blue-400 font-extrabold uppercase bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                              ⚡ AUDIO-ONLY TRANSMISSION
                            </span>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight max-w-sm truncate pt-2">
                              {currentTitle}
                            </h3>
                            <p className="text-[10px] font-mono text-slate-500 max-w-xs mx-auto leading-normal">
                              Bandwidth optimization buffer active. Fluidly toggle to video view instantly anytime.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Keep player node in memory but visually hidden/scaled down when isAudioOnly is true */}
                    <div className={`w-full h-full flex items-center justify-center relative ${isAudioOnly ? "absolute opacity-0 pointer-events-none w-px h-px overflow-hidden" : ""}`}>
                      {playerStore.state === "error" && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-6 text-center space-y-4">
                          <button
                            onClick={() => setPlayerStore(prev => ({ ...prev, state: "idle" }))}
                            className="absolute top-4 right-4 text-white/50 hover:text-white pointer-events-auto"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                          <AlertTriangle className="w-16 h-16 text-red-500 animate-pulse" />
                          <div className="space-y-2">
                            <h4 className="text-sm font-black text-red-400 uppercase tracking-widest font-mono">
                              STREAM UNAVAILABLE
                            </h4>
                            <p className="text-xs text-slate-400 font-mono leading-normal max-w-md">
                              ${playerStore.error?.message || "Stream unavailable: All manifest tracks exhausted for this channel."}
                            </p>
                          </div>
                        </div>
                      )}
                      {!currentUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#06080C] border border-slate-800/80 rounded-2xl p-6 text-center space-y-4 z-20">
                          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-2xl shadow-inner animate-pulse">
                            📺
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                              AWAITING BROADCAST SIGNAL
                            </h4>
                            <p className="text-[10px] text-slate-600 font-mono leading-normal max-w-xs">
                              Select a channel from the Live Channels Deck or explore the TV Guide schedule to begin playout.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {currentUrl && (
                        <SmartVideoEngine 
                          url={currentUrl} 
                          onPlaying={() => {
                            if (playerStore.state !== "playing") {
                              setPlayerStore(prev => ({ ...prev, state: "playing" }));
                            }
                          }}
                          onError={(msg) => {
                            const currentCh = channels.find(ch => ch.url === currentUrl);
                            const vodUrl = currentCh && currentCh.name === "AJN Live"
                              ? generateDayWindow("AJN Hourly", new Date())[0]
                              : undefined;
                            if (vodUrl) {
                              playStream(vodUrl, "AJN Hourly (Live Fallback)");
                              addLog(`[Fallback] Rumble embed failed (${msg}). Falling back to VOD: ${vodUrl}`);
                            } else {
                              const errMsg = msg || "Unknown playback failure";
                              addLog(`[SmartVideoEngine] Playback failed for "${currentTitle}": ${errMsg}`, "error");
                              setPlayerStore(prev => ({
                                ...prev,
                                state: "error",
                                error: { code: "PLAYBACK_FAILED", message: errMsg }
                              }));
                            }
                          }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 font-mono">
                    <Radio className="w-10 h-10 text-blue-500 animate-pulse" />
                    <p className="text-xs font-bold text-white uppercase tracking-wider">NO CHANNEL SELECTED</p>
                    <button 
                      onClick={() => setActiveNav("guide")}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl uppercase cursor-pointer"
                    >
                      Open TV Guide
                    </button>
                  </div>
                )}

                {(isBuffering || isLoading) && !isRumbleUrl(currentUrl) && !isYouTubeUrl(currentUrl) && (
                  <div id="player-loading-spinner" className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 pointer-events-none">
                    <div className="flex flex-col items-center space-y-2 font-mono text-xs text-blue-400">
                      <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                      <span>TUNING...</span>
                    </div>
                  </div>
                )}

                {/* BACKUP STREAM BADGE */}
                {playerStore.isBackupPlayback && (
                  <div className="absolute top-4 right-4 z-20 pointer-events-none bg-red-600/90 text-white px-3 py-1.5 rounded-xl border border-red-500 flex items-center gap-2 shadow-2xl backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider">Offline - Playing Backup</span>
                  </div>
                )}
              </div>

              {/* Aspect Ratio & Signal Optimizer Sub-Bar */}
              {currentUrl && !isAudioOnly && activeNav === "player" && (
                <div className="px-4 py-3 bg-[#0B0E14]/95 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 select-none shrink-0 font-mono text-[10px]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>Auto-Detect Active</span>
                    </div>
                    <div className="h-4 w-px bg-slate-800/80 hidden sm:block" />
                    <div className="text-slate-400">
                      <span className="text-slate-500 font-bold uppercase mr-1">Signal:</span>
                      <span className="text-slate-200 font-bold bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/30 text-emerald-400">
                        {videoResolution || "Analyzing..."}
                      </span>
                    </div>
                    <div className="text-slate-400">
                      <span className="text-slate-500 font-bold uppercase mr-1">Aspect:</span>
                      <span className="text-slate-200 font-bold bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/30 text-blue-400">
                        {detectedAspectRatio}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-bold uppercase mr-1">Optimization Mode:</span>
                    <div className="bg-[#06080C] border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5">
                      <button
                        onClick={() => {
                          setAspectFittingMode("auto");
                          addLog(`[Aspect Optimizer] Active view set to Auto-Optimize (Aspect preserved with black bars if standard/vertical).`, "info");
                        }}
                        className={`px-2.5 py-1 rounded font-bold uppercase transition-all cursor-pointer ${
                          aspectFittingMode === "auto" 
                            ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        }`}
                        title="Optimize based on metadata automatically"
                      >
                        Auto-Optimize
                      </button>

                      <button
                        onClick={() => {
                          setAspectFittingMode("contain");
                          addLog(`[Aspect Optimizer] Active view set to Letterbox/Pillarbox (Strict original ratio with black bars).`, "info");
                        }}
                        className={`px-2.5 py-1 rounded font-bold uppercase transition-all cursor-pointer ${
                          aspectFittingMode === "contain" 
                            ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        }`}
                        title="Strict original ratio with black bars (Letterbox/Pillarbox)"
                      >
                        Black Bars
                      </button>

                      <button
                        onClick={() => {
                          setAspectFittingMode("stretch");
                          addLog(`[Aspect Optimizer] Active view set to Stretch to Fill (Fills player container by stretching).`, "info");
                        }}
                        className={`px-2.5 py-1 rounded font-bold uppercase transition-all cursor-pointer ${
                          aspectFittingMode === "stretch" 
                            ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        }`}
                        title="Stretches source to fit the widescreen player box"
                      >
                        Stretch
                      </button>

                      <button
                        onClick={() => {
                          setAspectFittingMode("cover");
                          addLog(`[Aspect Optimizer] Active view set to Zoom & Crop (Fills player box completely, preserving ratio but cropping).`, "info");
                        }}
                        className={`px-2.5 py-1 rounded font-bold uppercase transition-all cursor-pointer ${
                          aspectFittingMode === "cover" 
                            ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        }`}
                        title="Crops outer parts of the video to fill the screen without distortion"
                      >
                        Crop
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Player Overlay Shortcuts Rail (Section 5.1 & 6.1) */}
              <div className={`p-4 bg-[#06080C]/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 select-none shrink-0 ${activeNav !== "player" ? "p-1.5 bg-black/95 gap-1.5 border-t border-slate-800/50" : ""}`}>
                {activeNav === "player" && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-mono text-blue-500 uppercase font-bold block">NOW PLAYING</span>
                      <h3 className="text-xs font-black text-white uppercase truncate">{currentTitle || "Idle Broadcast Node"}</h3>
                    </div>
                  </div>
                )}

                <div className={`flex items-center gap-2 ${activeNav !== "player" ? "w-full justify-center gap-3 py-1" : ""}`}>
                  {activeNav === "player" && (
                    <button
                      onClick={() => setActiveNav("guide")}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono uppercase flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                    >
                      <Tv className="w-4 h-4" />
                      <span>Go to Guide</span>
                    </button>
                  )}

                  <button
                    onClick={playPrevChannel}
                    className={`bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer ${activeNav !== "player" ? "p-1.5 rounded-xl" : "p-2.5"}`}
                    title="Previous Channel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const v = mainVideoRef.current;
                      if (!v) return;
                      if (isPlaying) v.pause();
                      else safePlay(v);
                    }}
                    className={`bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer shadow-md ${activeNav !== "player" ? "p-1.5 rounded-xl animate-pulse" : "p-2.5"}`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={playNextChannel}
                    className={`bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer ${activeNav !== "player" ? "p-1.5 rounded-xl" : "p-2.5"}`}
                    title="Next Channel"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {activeNav === "player" && (
                    <>
                      <button
                        onClick={togglePiP}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer ml-2"
                        title="Picture-in-Picture Toggle"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                          <rect x="13" y="12" width="6" height="4" rx="1" ry="1"></rect>
                        </svg>
                      </button>
                      <button
                        onClick={toggleFullscreen}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer ml-2"
                        title="Fullscreen Toggle"
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Channel Rail (Hidden in Theatre Mode or mobile or PIP mode) */}
            {!isTheatreMode && activeNav === "player" && (
              <div className="w-full lg:w-80 shrink-0 bg-[#0B0E14] border border-slate-800 rounded-2xl p-4 flex flex-col min-h-0 gap-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-wider">
                      {currentUrl ? "Now Playing Deck" : "Live Channels Deck"}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full font-bold">
                    {currentUrl ? "1" : channels.length}
                  </span>
                </div>

                {!currentUrl && (
                  <>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={playerIptvQuery}
                        onChange={(e) => setPlayerIptvQuery(e.target.value)}
                        placeholder="Filter channels..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black border border-slate-800 text-white outline-none focus:border-blue-500 transition-colors placeholder-slate-600"
                      />
                    </div>

                    {/* Micro Category Selector Tabs to save massive vertical space */}
                    <div className="grid grid-cols-6 gap-1 p-1 bg-black/60 rounded-xl border border-slate-800/60">
                      {(["all", "segmented", "full", "archives", "other", "fav"] as const).map((tab) => {
                        const active = activeDeckTab === tab;
                        let label = "";
                        let tooltip = "";
                        if (tab === "all") { label = "ALL"; tooltip = "All feeds"; }
                        else if (tab === "segmented") { label = "CLIPS"; tooltip = "Short segments"; }
                        else if (tab === "full") { label = "SHOWS"; tooltip = "Full broadcasts"; }
                        else if (tab === "archives") { label = "ARCHIVES"; tooltip = "AJN Archive shows"; }
                        else if (tab === "other") { label = "LIVE"; tooltip = "Live streams"; }
                        else { label = "★"; tooltip = "Favorites"; }

                        return (
                          <button
                            key={tab}
                            onClick={() => {
                              setActiveDeckTab(tab);
                              setDeckLimit(5);
                            }}
                            title={tooltip}
                            className={`py-1 text-[8px] font-mono font-black uppercase rounded-xl transition-all cursor-pointer ${
                              active
                                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner"
                                : "text-slate-500 hover:text-slate-300 border border-transparent hover:bg-slate-800/30"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Fix Durations Button */}
                    <div className="flex justify-between items-center mt-2 px-1">
                       <span className="text-[9px] text-slate-500 font-mono">
                         {channels.filter(ch => ch.duration === null || ch.duration === undefined || ch.duration_source === "estimated" || ch.duration_source === "failed").length} unverified durations
                       </span>
                       <button
                         onClick={handleFixDurations}
                         disabled={isFixingDurations || !batchUpdateDurations}
                         className="px-2 py-1 text-[9px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1"
                       >
                         {isFixingDurations ? (
                           <>
                             <div className="w-2 h-2 rounded-full border border-t-transparent border-white animate-spin"></div>
                             {fixProgress ? `Fixing ${fixProgress.current}/${fixProgress.total}...` : 'Fixing...'}
                           </>
                         ) : 'Fix Durations'}
                       </button>
                    </div>
                  </>
                )}

                {/* Scrollable Channels Mini EPG List */}
                <div 
                  className="w-full space-y-2 pr-1 min-h-0 custom-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24"
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    requestAnimationFrame(() => {
                      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                        const currentListLength = (() => {
                          if (activeDeckTab === "all") return filteredChannels.length;
                          if (activeDeckTab === "segmented") return segmentedChannels.length;
                          if (activeDeckTab === "full") return fullLengthChannels.length;
                          if (activeDeckTab === "archives") return archiveChannels.length;
                          if (activeDeckTab === "other") return otherChannels.length;
                          if (activeDeckTab === "fav") return favoriteChannels.length;
                          return 0;
                        })();
                        if (deckLimit < currentListLength) {
                          setDeckLimit(prev => Math.min(prev + 12, currentListLength));
                        }
                      }
                    });
                  }}
                >

                  {(() => {
                    // Filter based on active tab
                    let currentList: IPTVChannel[] = [];
                    if (activeDeckTab === "all") {
                      currentList = filteredChannels;
                    } else if (activeDeckTab === "segmented") {
                      currentList = segmentedChannels;
                    } else if (activeDeckTab === "full") {
                      currentList = fullLengthChannels;
                    } else if (activeDeckTab === "archives") {
                      currentList = archiveChannels;
                    } else if (activeDeckTab === "other") {
                      currentList = otherChannels;
                    } else if (activeDeckTab === "fav") {
                      currentList = favoriteChannels;
                    }
                    
                    if (currentUrl) {
                      currentList = currentList.filter(ch => ch.url === currentUrl);
                      if (currentList.length === 0) {
                        const playingCh = channels.find(ch => ch.url === currentUrl);
                        if (playingCh) {
                           currentList = [playingCh];
                        } else {
                           currentList = [{
                             name: currentTitle || "Active Media Stream",
                             url: currentUrl,
                             logo: null,
                             group: "Now Playing"
                           }];
                        }
                      }
                    }

                    if (currentList.length === 0) {
                      return (
                        <div className="p-8 text-center text-slate-500 font-mono text-[10px] rounded-2xl border border-dashed border-slate-800/50 bg-black/20">
                          {activeDeckTab === "fav" ? "No favorited channels yet. Click the star icon on any channel to save it." : "No matching channels found."}
                        </div>
                      );
                    }

                    const slicedList = currentList.slice(0, deckLimit);

                    // Group slicedList dynamically by 'group-title' (ch.group)
                    const grouped: Record<string, IPTVChannel[]> = {};
                    slicedList.forEach(ch => {
                      const gName = ch.group || "Uncategorized";
                      if (!grouped[gName]) {
                        grouped[gName] = [];
                      }
                      grouped[gName].push(ch);
                    });

                    return (
                      <div className="space-y-3">
                        {Object.entries(grouped).map(([groupName, groupChannels]) => {
                          const isCollapsed = !!collapsedGroups[groupName];

                          return (
                            <div key={groupName} className="space-y-2">
                              {/* Group Header Button */}
                              <button
                                onClick={() => toggleGroupCollapse(groupName)}
                                className="w-full flex items-center justify-between p-2 rounded-xl bg-[#111625]/60 hover:bg-[#111625]/80 border border-slate-800/60 hover:border-slate-700/80 transition-all cursor-pointer text-left select-none"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`} />
                                  <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-wider truncate">
                                    {groupName}
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full font-bold">
                                  {groupChannels.length}
                                </span>
                              </button>

                              {/* Group Channels List */}
                              {!isCollapsed && (
                                <div className="space-y-2 pl-2">
                                  {groupChannels.map((ch, idx) => {
                                    const active = ch.url === currentUrl;
                                    
                                    // 1. Determine dynamic channel number display
                                    const chNo = ch.tvgChno ? ch.tvgChno.padStart(2, "0") : String(idx + 1).padStart(2, "0");
                                    
                                    // 2. Generate stable, deterministic Now Playing EPG program metadata based on channel name
                                    const safeName = ch.name || "";
                                    let hash = 0;
                                    for (let i = 0; i < safeName.length; i++) {
                                      hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
                                    }
                                    const stableSeed = Math.abs(hash);
                                    const shows = [
                                      "Prime Time Briefing Live",
                                      "Strategic Intelligence Report",
                                      "Historical Playout Watch",
                                      "Global Analysis Hour",
                                      "Special Broadcast Desk",
                                      "Patriot Media Special",
                                      "Intelligence War Room Archive",
                                      "Chrono Archive Playout",
                                      "Geopolitical Roundtable"
                                    ];
                                    const backendSeg = (ch as any).currentSegment;
                                    const programTitle = backendSeg?.title || shows[stableSeed % shows.length];
                                    const nextProgramTitle = backendSeg?.nextTitle || shows[(stableSeed + 1) % shows.length];
                                    
                                    // Determine stable progress percent based on minute of hour
                                    const currentMin = new Date().getMinutes();
                                    const progDuration = (stableSeed % 2 === 0) ? 30 : 60;
                                    const elapsed = currentMin % progDuration;
                                    let progressPercent = Math.max(12, Math.min(95, Math.floor((elapsed / progDuration) * 100)));
                                    if (backendSeg && backendSeg.start && backendSeg.end) {
                                      const nowSec = Math.floor(Date.now() / 1000);
                                      const dur = backendSeg.end - backendSeg.start;
                                      const elapsedSec = Math.max(0, nowSec - backendSeg.start);
                                      progressPercent = Math.max(5, Math.min(95, Math.floor((elapsedSec / dur) * 100)));
                                    }

                                    // Color palette indicators based on channel category/tab
                                    const barColor = ch.duration === 300 
                                      ? "bg-[#00ff66]" 
                                      : (ch.duration === 3590 || ch.name.includes("Hour") || ch.name.includes("War Room"))
                                        ? "bg-blue-400"
                                        : "bg-purple-500";

                                    const isChFav = favUrls.includes(ch.url);

                                    return (
                                      <div
                                        key={`${ch.url}-${idx}`}
                                        onClick={() => playStream(ch.url, ch.name)}
                                        className={`w-full group text-left p-2.5 rounded-2xl flex gap-2.5 border transition-all duration-200 cursor-pointer relative select-none ${
                                          active
                                            ? "bg-blue-900/15 border-blue-500/60 shadow-lg shadow-blue-900/10"
                                            : "bg-[#111625]/40 border-slate-800/60 hover:bg-[#111625]/60 hover:border-slate-700/80"
                                        }`}
                                      >
                                        {/* Left Channel badge box */}
                                        <div className="flex flex-col items-center justify-center shrink-0 w-11 bg-black/40 border border-slate-800/80 rounded-xl py-1 px-1.5 text-center min-h-[44px]">
                                          <span className={`text-[10px] font-mono font-black ${active ? "text-blue-400" : "text-slate-400"}`}>
                                            {chNo}
                                          </span>
                                          <span className={`text-[7px] font-mono font-bold uppercase tracking-wider scale-[0.9] mt-0.5 ${
                                            ch.duration === 300 ? "text-[#00ff66]" : "text-blue-400"
                                          }`}>
                                            {ch.duration === 300 ? "Clip" : "Live"}
                                          </span>
                                        </div>

                                        {/* Middle channel guide content */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className={`text-[11px] font-bold truncate flex items-center gap-1.5 ${active ? "text-blue-300" : "text-white group-hover:text-blue-400 transition-colors"}`}>
                                              <span>{cleanTitle(ch.name)}</span>
                                              {(ch.duration === null || ch.duration === undefined || ch.duration_source === "estimated" || ch.duration_source === "failed") && (
                                                <span title="Unverified duration" className="text-slate-500 font-mono text-[9px] px-1 bg-slate-800/50 rounded">—</span>
                                              )}
                                            </span>
                                          </div>

                                          <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 animate-pulse shrink-0" />
                                            <span>{programTitle}</span>
                                          </div>

                                          {/* Mini EPG progress bar */}
                                          <div className="w-full bg-slate-900/80 rounded-full h-[3px] mt-1.5 overflow-hidden">
                                            <div 
                                              className={`h-full rounded-full ${barColor} transition-all duration-1000`}
                                              style={{ width: `${progressPercent}%` }}
                                            />
                                          </div>

                                          <div className="text-[8px] font-mono text-slate-500 truncate mt-1">
                                            Next: {nextProgramTitle}
                                          </div>
                                        </div>

                                        {/* Right interactive Actions */}
                                        <div className="flex flex-col items-center justify-between shrink-0 gap-1.5">
                                          <div className="flex flex-col gap-1 items-center">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isChFav) {
                                                  setFavUrls(prev => prev.filter(u => u !== ch.url));
                                                } else {
                                                  setFavUrls(prev => [...prev, ch.url]);
                                                }
                                              }}
                                              title={isChFav ? "Remove from Favorites" : "Add to Favorites"}
                                              className="p-1 hover:bg-slate-800/60 rounded-xl text-slate-500 hover:text-amber-400 transition-all cursor-pointer"
                                            >
                                              <Star className={`w-3 h-3 ${isChFav ? "text-amber-400 fill-amber-400" : ""}`} />
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Are you sure you want to delete "${ch.name}"?`)) {
                                                  removeChannel?.(ch.url);
                                                }
                                              }}
                                              title="Delete Channel"
                                              className="p-1 hover:bg-slate-800/60 rounded-xl text-slate-500 hover:text-red-400 transition-all cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>

                                          {active ? (
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                                          ) : (
                                            <Play className="w-2.5 h-2.5 text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Lazy Load controller */}
                        {currentList.length > deckLimit && (
                          <div className="pt-2 pb-2 text-center text-[9px] font-mono text-slate-500 animate-pulse">
                            ▼ Scroll down to auto-load more...
                          </div>
                        )}

                        <div className="text-center text-[8.5px] font-mono text-slate-500 pt-1">
                          Showing {Math.min(deckLimit, currentList.length)} of {currentList.length} Channels
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
          )
        )}
        {/* SURFACE 4: LIBRARY & UNIFIED IMPORT PIPELINE (Section 11) */}
        {activeNav === "library" && (
          <div className="w-full p-6 max-w-6xl mx-auto w-full space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-black uppercase text-white">📁 Unified Content Pipeline</h2>
              <p className="text-xs text-slate-400 font-mono">Supported Sources: M3U • XMLTV • Archive.org • YouTube • Rumble • Local Folders • RSS</p>
            </div>

            {/* Section 11.2 Supported Sources Picker */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "M3U Playlist", icon: List, desc: "Standard IPTV feeds" },
                { label: "XMLTV Guide", icon: FileText, desc: "Structured EPG metadata" },
                { label: "Archive.org", icon: HardDrive, desc: "Public domain VOD vault" },
                { label: "YouTube Live", icon: Youtube, desc: "Embed broadcast streams" },
                { label: "Rumble Feeds", icon: Video, desc: "Decentralized video links" },
                { label: "Local Folders", icon: Folder, desc: "Offline media directories" },
                { label: "RSS Feeds", icon: Rss, desc: "News & podcast tickers" },
                { label: "Podcasts", icon: Mic, desc: "Audio broadcast feeds" }
              ].map((srcItem, i) => {
                const SrcIcon = srcItem.icon;
                return (
                  <div key={i} className="p-4 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-blue-500 cursor-pointer transition-all space-y-2 group">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <SrcIcon className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase">{srcItem.label}</h4>
                    <p className="text-[10px] text-slate-500 font-mono">{srcItem.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Title Cleaning Configuration */}
            <div className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black uppercase text-white font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Advanced Import Processing
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  Toggle dynamic regex rules when parsing new M3U files to auto-group specific VOD layouts.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-3 cursor-pointer group p-3 border border-slate-800 rounded-xl bg-black hover:border-slate-600 transition-all">
                  <input
                    type="checkbox"
                    checked={enableWesternRegex}
                    onChange={(e) => setEnableWesternRegex(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 bg-slate-900 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider group-hover:text-white transition-colors">Western / Standard Grouping</span>
                    <span className="text-[9px] text-slate-500 font-mono">Extracts S01E05 or dates from titles to bundle them into shows.</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group p-3 border border-slate-800 rounded-xl bg-black hover:border-slate-600 transition-all">
                  <input
                    type="checkbox"
                    checked={enableRussianRegex}
                    onChange={(e) => setEnableRussianRegex(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 bg-slate-900 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider group-hover:text-white transition-colors">Cyrillic & Russian Cleanup</span>
                    <span className="text-[9px] text-slate-500 font-mono">Strips tags like "серия", "сезон", "(РУС)", and standardizes prefixes.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* M3U Input Board */}
            <div className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-white font-mono">Quick URL Ingestion</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={m3uUrlInput}
                  onChange={(e) => setM3uUrlInput(e.target.value)}
                  placeholder="Paste M3U or XMLTV link address..."
                  className="flex-1 px-4 py-3 rounded-xl bg-black border border-slate-800 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
                <button
                  onClick={handleM3uUrlLoad}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl font-mono uppercase cursor-pointer transition-all active:scale-95 shadow-lg"
                >
                  Import Feed
                </button>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs font-mono text-slate-400">
                <label className="cursor-pointer hover:text-blue-400 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-500" />
                  <span>Upload local file (.m3u, .dpl, .xml, .txt)</span>
                  <input type="file" accept=".m3u,.m3u8,.dpl,.txt,.xml,.json" onChange={handleFileUpload} className="hidden" />
                </label>
                <div className="flex gap-4">
                  <button onClick={handleResetDemoChannels} className="text-emerald-400 hover:underline cursor-pointer">
                    ↺ Reset Demo Channels
                  </button>
                  <button onClick={handlePurgePlayoutDatabase} className="text-red-400 hover:underline cursor-pointer">
                    🗑 Purge All Channels & Playlists
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Playlist Code Editor & History Manager */}
            <PlaylistEditor
              theme={theme}
              playlists={playlists || []}
              channels={channels}
              reloadVault={reloadVault || (async () => {})}
              addLog={addLog}
            />
          </div>
        )}

        {/* SURFACE 5: FAVORITES */}
        {activeNav === "favorites" && (
          <div className="w-full p-6 max-w-6xl mx-auto w-full space-y-4">
            <h2 className="text-xl font-black uppercase text-white border-b border-slate-800 pb-4">⭐ Favorite Channels</h2>
            {favoriteChannels.length === 0 ? (
              <div className="p-12 text-center font-mono text-xs text-slate-500">No favorite channels starred yet. Click the star icon on any channel in the TV Guide to add it here.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {favoriteChannels.map((ch, idx) => {
                  const active = ch.url === currentUrl;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => { playStream(ch.url, ch.name); setActiveNav("player"); }} 
                      className="group p-4 rounded-2xl bg-[#0B0E14] border border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer flex items-center justify-between transition-all select-none"
                    >
                      <span className={`text-[11px] font-bold truncate ${active ? "text-blue-300" : "text-white group-hover:text-blue-400 transition-colors"}`}>
                        {cleanTitle(ch.name)}
                      </span>
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SURFACE 6: SEARCH */}
        {activeNav === "search" && (
          <div className="w-full p-6 max-w-4xl mx-auto w-full space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-4" />
              <input
                type="text"
                value={playerIptvQuery}
                onChange={(e) => setPlayerIptvQuery(e.target.value)}
                placeholder="Instant fuzzy search channels & programs..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#0B0E14] border border-slate-800 text-sm text-white outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="space-y-2 pt-2">
              {filteredChannels.slice(0, 30).map((ch, idx) => {
                const active = ch.url === currentUrl;
                return (
                  <div 
                    key={idx} 
                    onClick={() => { playStream(ch.url, ch.name); setActiveNav("player"); }} 
                    className="group p-3.5 rounded-2xl bg-[#0B0E14] hover:bg-blue-600/10 border border-slate-800/80 hover:border-blue-500/40 cursor-pointer flex items-center justify-between transition-all select-none"
                  >
                    <span className={`text-[11px] font-bold truncate ${active ? "text-blue-300" : "text-white group-hover:text-blue-400 transition-colors"}`}>
                      {cleanTitle(ch.name)}
                    </span>
                    <span className="text-[10px] font-mono text-blue-400 uppercase">{ch.group}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SURFACE 6.5: PLACECARD MATRIX & VAULT REGISTRY */}
        {activeNav === "matrix" && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative w-full bg-[#06080C]">
            <FolderSidebar
              selectedFolderId={selectedMatrixFolder}
              onSelectFolder={setSelectedMatrixFolder}
            />
            <PlaceCardGrid stopPreludeMusic={stopPreludeMusic}
              selectedFolderId={selectedMatrixFolder}
              onPlayStream={(url, title) => {
                playStream(url, title);
                setActiveNav("player");
              }}
            />
          </div>
        )}

        {/* SURFACE 6.6: AJN ARCHIVE HUB & POSTERS DECK */}
        {activeNav === "ajn-hub" && (
          <div className="w-full p-6 max-w-6xl mx-auto w-full space-y-6 animate-fadeIn">
            <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black uppercase text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-blue-400" />
                  AJN Archive Hub
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Access the high-density archive recordings and interactive VOD assets.
                </p>
              </div>
              
              {/* Dynamic Resizing Controller */}
              <div className="bg-[#0B0E14] border border-blue-500/20 px-4 py-2.5 rounded-2xl flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-mono text-blue-300 uppercase font-bold">Image Sizing & Fit:</span>
                <div className="flex gap-1.5">
                  {["cover", "contain", "fill"].map((fit) => {
                    const isSaved = (safeLocalStorage.getItem("placecard_resize_mode") || "cover") === fit;
                    return (
                      <button
                        key={fit}
                        onClick={() => {
                          safeLocalStorage.setItem("placecard_resize_mode", fit);
                          window.dispatchEvent(new Event("placecard-settings-updated"));
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                          isSaved
                            ? "bg-blue-600 text-white shadow"
                            : "bg-black/40 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-900"
                        }`}
                      >
                        {fit}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Embed the custom ArchiveHub */}
            <ArchiveHub
              segments={resolvedAjnHubSegments}
              /*
                {
                  id: "seg-warroom",
                  title: "War Room Live - Patriotic Fire Transmission",
                  timestampLabel: "Hour 1",
                  duration: "58:40",
                  thumbnailUrl: "https://archive.org/download/daily-highlights/warroom.png",
                  broadcaster: "AJN WAR ROOM",
                  videoUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr1.mp4"
                },
                {
                  id: "seg-alexjones",
                  title: "The Alex Jones Show - High-Intensity Geopolitical Debate",
                  timestampLabel: "Hour 2",
                  duration: "1:02:15",
                  thumbnailUrl: "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp",
                  broadcaster: "INFOWARS",
                  videoUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr2.mp4"
                },
                {
                  id: "seg-live",
                  title: "Emergency Live Transmission Feed - Studio A Main",
                  timestampLabel: "Live Clip",
                  duration: "05:00",
                  thumbnailUrl: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
                  broadcaster: "AJN MAIN FEED",
                  videoUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr3.mp4"
                },
                {
                  id: "seg-emergency",
                  title: "Primary Alert Broadcast - SCTE-35 Spliced Network Feed",
                  timestampLabel: "EAS Protocol",
                  duration: "15:22",
                  thumbnailUrl: "https://archive.org/download/daily-highlights/emegency.png",
                  broadcaster: "AJN SYSTEM NETWORK",
                  videoUrl: "https://archive.org/download/RT_20260817_000000_News/RT_20260817_000000_News.mp4"
                },
                {
                  id: "seg-classic",
                  title: "Classic Historical Vault Playout - Retro Broadcast Collection",
                  timestampLabel: "Archive",
                  duration: "45:10",
                  thumbnailUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
                  broadcaster: "AJN ARCHIVE",
                  videoUrl: "https://archive.org/download/01-tv-fighting-crime/COLUMBO.S01E01-Perscription%20Murder.mp4"
                },
                {
                  id: "seg-highlights",
                  title: "Daily Highlights Reel - Multi-Stream Compilation",
                  timestampLabel: "Summary",
                  duration: "25:30",
                  thumbnailUrl: "https://archive.org/download/daily-highlights/web%20app1.png",
                  broadcaster: "AJN MEDIA DESK",
                  videoUrl: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4"
                }
              */
              onSelectSegment={(seg) => {
                playStream(seg.videoUrl || "", seg.title);
                setActiveNav("player");
              }}
            />

            {/* Placement & Description Documentation Box */}
            <div className="p-5 rounded-2xl bg-[#0B0E14] border border-slate-800/80 space-y-3">
              <h3 className="text-xs font-black text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Archived Image Resource Directory (Placement & Mapping Guide)
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                The application relies on official, pre-scaled Internet Archive assets from the <strong>daily-highlights</strong> collection for thematic consistency. Below is the mapping of where these graphics are utilized and displayed in the system:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-[10px] font-mono pt-1">
                {/*
                  {
                    name: "War Room Poster",
                    url: "https://archive.org/download/daily-highlights/warroom.png",
                    videoUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr1.mp4",
                    videoTitle: "War Room Live - Hour 1",
                    desc: "Alex Jones War Room Daily Broadcasts template backdrop.",
                    placement: "PlaceCard Slots (War Room VODs) & AJN Hub Segment 1 Poster"
                  },
                  {
                    name: "Alex Jones Poster",
                    url: "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp",
                    videoUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr2.mp4",
                    videoTitle: "The Alex Jones Show - Hour 2",
                    desc: "Main Infowars & Patriot Media banner asset.",
                    placement: "PlaceCard Slots (Alex Jones VODs) & AJN Hub Segment 2 Poster"
                  },
                  {
                    name: "Live Transmission",
                    url: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
                    videoUrl: "https://ajn.archives.pub/hourly-mp4/HD/Alex-Mon-Hr3.mp4",
                    videoTitle: "Emergency Live Transmission - Hour 3",
                    desc: "General live broadcast signal illustration.",
                    placement: "PlaceCard Slots (Live/Streams) & AJN Hub Segment 3 Backdrop"
                  },
                  {
                    name: "Emergency Broadcast",
                    url: "https://archive.org/download/daily-highlights/emegency.png",
                    videoUrl: "https://archive.org/download/RT_20260817_000000_News/RT_20260817_000000_News.mp4",
                    videoTitle: "Primary EAS Alert Broadcast Feed",
                    desc: "SCTE-35 Spliced Network Feed placeholder image.",
                    placement: "PlaceCard Slots (Emergency/Alerts) & AJN Hub Segment 4 Poster"
                  },
                  {
                    name: "Classic Archive",
                    url: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
                    videoUrl: "https://archive.org/download/01-tv-fighting-crime/COLUMBO.S01E01-Perscription%20Murder.mp4",
                    videoTitle: "Classic Historical Playout - Columbo",
                    desc: "Historical & Classic episodes fallback backdrop.",
                    placement: "PlaceCard Slots (Archive VODs) & AJN Hub Segment 5 Poster"
                  },
                  {
                    name: "Daily Highlights",
                    url: "https://archive.org/download/daily-highlights/web%20app1.png",
                    videoUrl: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
                    videoTitle: "Daily Highlights Compilation - Classic TV",
                    desc: "Daily Show Highlights cover graphic.",
                    placement: "PlaceCard Slots (Clips/Daily) & AJN Hub Segment 6 Poster"
                  }
                ]*/
                [
                  {
                    name: "War Room Poster",
                    url: "https://archive.org/download/daily-highlights/warroom.png",
                    videoUrl: resolvedAjnHubSegments[0].videoUrl,
                    videoTitle: resolvedAjnHubSegments[0].title,
                    desc: "Alex Jones War Room Daily Broadcasts template backdrop.",
                    placement: "PlaceCard Slots (War Room VODs) & AJN Hub Segment 1 Poster"
                  },
                  {
                    name: "Alex Jones Poster",
                    url: "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp",
                    videoUrl: resolvedAjnHubSegments[1].videoUrl,
                    videoTitle: resolvedAjnHubSegments[1].title,
                    desc: "Main Infowars & Patriot Media banner asset.",
                    placement: "PlaceCard Slots (Alex Jones VODs) & AJN Hub Segment 2 Poster"
                  },
                  {
                    name: "Live Transmission",
                    url: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
                    videoUrl: resolvedAjnHubSegments[2].videoUrl,
                    videoTitle: resolvedAjnHubSegments[2].title,
                    desc: "General live broadcast signal illustration.",
                    placement: "PlaceCard Slots (Live/Streams) & AJN Hub Segment 3 Backdrop"
                  },
                  {
                    name: "Emergency Broadcast",
                    url: "https://archive.org/download/daily-highlights/emegency.png",
                    videoUrl: resolvedAjnHubSegments[3].videoUrl,
                    videoTitle: resolvedAjnHubSegments[3].title,
                    desc: "SCTE-35 Spliced Network Feed placeholder image.",
                    placement: "PlaceCard Slots (Emergency/Alerts) & AJN Hub Segment 4 Poster"
                  },
                  {
                    name: "Classic Archive",
                    url: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
                    videoUrl: resolvedAjnHubSegments[4].videoUrl,
                    videoTitle: resolvedAjnHubSegments[4].title,
                    desc: "Historical & Classic episodes fallback backdrop.",
                    placement: "PlaceCard Slots (Archive VODs) & AJN Hub Segment 5 Poster"
                  },
                  {
                    name: "Daily Highlights",
                    url: "https://archive.org/download/daily-highlights/web%20app1.png",
                    videoUrl: resolvedAjnHubSegments[5].videoUrl,
                    videoTitle: resolvedAjnHubSegments[5].title,
                    desc: "Daily Show Highlights cover graphic.",
                    placement: "PlaceCard Slots (Clips/Daily) & AJN Hub Segment 6 Poster"
                  }
                ].map((meta, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-black/40 border border-slate-800/80 space-y-1.5 hover:border-slate-700/80 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">{meta.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            playStream(meta.videoUrl, meta.videoTitle);
                            setActiveNav("player");
                          }}
                          className="text-[9px] bg-blue-500/20 hover:bg-blue-500 hover:text-white border border-blue-500/30 text-blue-400 font-bold px-2 py-0.5 rounded transition-all cursor-pointer"
                        >
                          Play Segment
                        </button>
                        <a 
                          href={meta.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[9px] text-slate-400 hover:text-white hover:underline"
                        >
                          Image URL
                        </a>
                      </div>
                    </div>
                    <p className="text-slate-400 text-[9px] leading-snug">{meta.desc}</p>
                    <div className="pt-1 text-[9px] text-blue-300">
                      <strong>Used In:</strong> {meta.placement}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SURFACE 7: SETTINGS & PROGRESSIVE DISCLOSURE (Section 8, 10, 14, 15) */}
        {activeNav === "settings" && (
          <div className="w-full p-6 lg:p-10 max-w-4xl mx-auto w-full space-y-8 animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black uppercase text-white">⚙ UX Settings & Progressive Disclosure</h2>
              <p className="text-xs text-slate-400">Section 15: Complexity is never removed — only hidden until needed.</p>
            </div>

            {/* Section 8.1 User Configurable Startup Target */}
            <div className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-white font-mono">Default Startup Target View (Section 8.1)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "home", label: "Home Dashboard" },
                  { id: "guide", label: "TV Guide" },
                  { id: "player", label: "Player Console" },
                  { id: "library", label: "Media Library" }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setDefaultStartupView(opt.id as any);
                      addLog(`Startup preference updated: ${opt.label}`);
                    }}
                    className={`p-3 rounded-xl border text-xs font-mono font-bold cursor-pointer transition-all ${
                      defaultStartupView === opt.id
                        ? "bg-blue-600 border-blue-500 text-white shadow-md"
                        : "bg-black/30 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 10 Template Layout System */}
            <div className="p-6 rounded-2xl bg-[#0B0E14] border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-white font-mono">Template Layout System (Section 10)</h3>
              <p className="text-[10px] text-slate-400 font-mono">Layout changes visual structure only, never feature availability.</p>
              <div className="flex flex-wrap gap-2.5">
                {["Classic", "Modern", "Broadcast", "OBS", "Compact", "Quad"].map((lOpt) => (
                  <button
                    key={lOpt}
                    onClick={() => {
                      setLayoutTemplate(lOpt.toLowerCase() as any);
                      addLog(`Layout template active: ${lOpt}`);
                    }}
                    className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold cursor-pointer transition-all ${
                      layoutTemplate === lOpt.toLowerCase()
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md"
                        : "bg-black/30 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {lOpt}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 14.3 Advanced Deck Progressive Disclosure */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-[#0E121C] to-blue-950/30 border border-blue-500/30 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-amber-400 animate-pulse shrink-0" />
                <div>
                  <h3 className="text-base font-black uppercase text-white">Advanced Broadcaster Console (Section 14.3)</h3>
                  <p className="text-xs text-slate-400 font-mono">Unlock full Master Control Playout, Weighted Scheduling, and Background SAX Ingestion</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAjnViewMode("advanced");
                  addLog("Progressive Disclosure: Unlocked professional master control deck.");
                }}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 cursor-pointer rounded-2xl text-xs font-black tracking-widest text-white uppercase font-mono shadow-lg transition-all"
              >
                Launch Configuration Workspace ⚡
              </button>
            </div>

            {/* Factory Reset */}
            <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <h3 className="text-base font-black uppercase text-white">Factory Reset</h3>
                  <p className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wide">⚠️ Reset App to Default</p>
                  <p className="text-xs text-slate-400 font-mono">Clears all corrupted states and reloads the application. Use this escape hatch if the UI acts strangely.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to completely reset the application to its default state?")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full py-3.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/30 text-red-100 rounded-2xl text-xs font-black tracking-widest uppercase font-mono shadow-lg transition-all cursor-pointer"
              >
                Reset App to Default
              </button>
            </div>

            {/* Total Purge Workspace */}
            {(import.meta as any).env.DEV && (
            <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <h3 className="text-base font-black uppercase text-white">Total Purge Workspace</h3>
                  <p className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wide">⚠️ System Reset Escape Hatch</p>
                  <p className="text-xs text-slate-400 font-mono">Systematically wipe state memory, clear local storage flags, delete cached items, and reset the platform to a pristine blank slate.</p>
                </div>
              </div>
              <button
                onClick={handleAbsoluteReset}
                className="w-full py-3.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/30 text-red-100 rounded-2xl text-xs font-black tracking-widest uppercase font-mono shadow-lg transition-all cursor-pointer"
              >
                ⚠️ TOTAL PURGE WORKSPACE
              </button>
            </div>
            )}

            {/* Re-run Onboarding Wizard */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800/80">
              <span className="text-xs font-mono text-slate-500">Need to reset onboarding demo channels?</span>
              <button onClick={() => setShowWizard(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-mono rounded-xl cursor-pointer">
                Re-run First-Run Wizard
              </button>
            </div>
          </div>
        )}

        {activeNav === "control-hub" && (
          <div className="w-full p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            <ControlHub onNavigate={setActiveNav} onLog={addLog} />
          </div>
        )}

        {activeNav === "sync" && (
          <div className="w-full p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            <RemoteHeadendSyncPanel 
              theme={theme}
              addLog={addLog}
              channels={channels}
              playlists={[]}
              importM3U={async (name, content) => {
                parseAndLoadM3U(content);
              }}
            />
          </div>
        )}

        {activeNav === "telemetry" && (
          <div className="w-full p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            <TelemetryDashboard addLog={addLog} />
          </div>
        )}

          </>
        )}
      </main>

      {/* STUDIO DECK SIDE DRAWER OVERLAY */}
      <AnimatePresence>
        {showDiagnosticsDrawer && (
          <div className="fixed inset-0 z-50 overflow-hidden select-none">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDiagnosticsDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-over Drawer Panel */}
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-screen max-w-md bg-[#0B0E14]/95 border-l border-slate-800/80 p-6 flex flex-col h-full shadow-2xl relative"
                style={{ backdropFilter: "blur(12px)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
                    <div>
                      <h3 className="text-sm font-black uppercase text-white font-mono tracking-wider">Studio Control Deck</h3>
                      <p className="text-[9px] font-mono text-slate-500 uppercase">AJN Live Stream Telemetry & Audit</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDiagnosticsDrawer(false)}
                    className="p-1.5 hover:bg-slate-800/60 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content Area (Scrollable) */}
                <div className="w-full py-5 space-y-6 min-h-0 custom-scrollbar pr-1">
                  
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">Telemetry</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        TelemetryAudit.exportTracesAsText();
                      }} className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-bold transition-colors">Export TXT</button>
                      <button onClick={() => {
                        TelemetryAudit.exportTracesAsJSON();
                      }} className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-bold transition-colors">Export JSON</button>
                    </div>
                  </div>

                  {/* System Core Diagnostics */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">System Playout Metrics</span>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500 text-[9px] uppercase">Engine Status</span>
                        <span className="text-emerald-400 font-black flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          ONLINE
                        </span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500 text-[9px] uppercase">System Health</span>
                        <span className="text-blue-400 font-black">{systemHealth.toFixed(1)}%</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500 text-[9px] uppercase">Stream Decoders</span>
                        <span className="text-indigo-400 font-black">{playerStore.diagnostics.streamType.toUpperCase()}</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500 text-[9px] uppercase">Latency</span>
                        <span className="text-amber-400 font-black">14ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Segment Playout State */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block font-bold">Active Playout State</span>
                    <div className="bg-black/30 border border-slate-800/50 rounded-xl p-3.5 space-y-3 font-mono text-[11px]">
                      <div className="space-y-0.5">
                        <span className="text-slate-500 text-[9px]">NOW PLAYING:</span>
                        <span className="text-white font-black block truncate">{currentTitle}</span>
                      </div>
                      <div className="h-px bg-slate-800/40" />
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-slate-500 block">PLAYBACK STATE:</span>
                          <span className="text-indigo-300 font-bold uppercase">{playerStore.state}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">MUTED STATE:</span>
                          <span className={playerStore.isMuted ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                            {playerStore.isMuted ? "MUTED (SILENT)" : "UNMUTED"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live System Activity Log Stream */}
                  <div className="space-y-2.5 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block font-bold">Live Audit Stream</span>
                      <span className="text-[8px] font-mono text-slate-500">REAL-TIME</span>
                    </div>
                    <div className="bg-black/50 border border-slate-800/90 rounded-xl p-4 h-60 overflow-y-auto space-y-2 custom-scrollbar flex-1 min-h-[160px]">
                      {logs.length === 0 ? (
                        <div className="text-center text-slate-500 font-mono text-[10px] py-14">
                          Waiting for diagnostic events...
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {logs.map((log, i) => (
                            <div key={i} className="text-[9px] font-mono leading-relaxed flex gap-2">
                              <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                              <span className={
                                log.type === "error" ? "text-red-400 font-semibold" :
                                log.type === "warning" ? "text-amber-400 font-semibold" :
                                "text-blue-400"
                              }>
                                {log.msg}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual Controls */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block font-bold">Diagnostics Action Hub</span>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setPlayerStore(prev => ({ ...prev, isMuted: !prev.isMuted }));
                          addLog(`[Diagnostics] Toggled Mute status via Studio Deck.`);
                        }}
                        className="w-full py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[10px] font-mono font-bold cursor-pointer transition-all uppercase"
                      >
                        {playerStore.isMuted ? "🔈 Unmute Playout" : "🔇 Mute Playout"}
                      </button>
                      <button
                        onClick={() => {
                          if (currentUrl) {
                            playStream(currentUrl, currentTitle);
                            addLog(`[Diagnostics] Re-initialized active decoder stream pipeline.`);
                          }
                        }}
                        className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl text-[10px] font-mono font-bold cursor-pointer transition-all uppercase"
                      >
                        ⚡ Re-align Audio/Video Decoder
                      </button>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="border-t border-slate-800/80 pt-4 shrink-0 text-center text-[9px] font-mono text-slate-500">
                  AJN Liberty Play Studio Diagnostics Console
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
});
