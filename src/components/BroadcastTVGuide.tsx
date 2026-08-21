import { TelemetryAudit } from "../utils/TelemetryAudit";
import { QuarantineLedger } from "../utils/quarantineLedger";
import { TVGuideLayout } from "./guide/TVGuideLayout";
import { AJN_LOGO_URL } from "../utils/constants";
import { getArchiveThumbnail } from "../utils/thumbnailHelper";
import { useVirtualArchiveChannels } from "../hooks/useVirtualArchiveChannels";
import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from "react";
import { 
  Tv, 
  Search, 
  Play, 
  Clock, 
  Star, 
  Layers,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  Zap,
  Activity,
  Sliders,
  Globe,
  Radio,
  FileText,
  Plus,
  Trash2,
  Check,
  HelpCircle,
  Film,
  Calendar
} from "lucide-react";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { motion, AnimatePresence } from "motion/react";
import {
  createMasterPlaylistStore,
  generateVirtualChannels,
  getChannelScheduleInWindow,
  VirtualChannel,
  VirtualProgramBlock,
  MasterPlaylistEpisode,
  MasterPlaylist
} from "../services/VirtualChannelEngine";
import { fetchArchiveCollectionFiles, parseArchiveManifest } from "../utils/semanticResolver";
import { getAutomatedCategoryTags, validateStreamURL } from "../utils/categoryParser";
import { kernel, BroadcastScheduleManager } from "../broadcast";
import { toastService } from "../utils/toast";

import { ChannelProviderFactory, RumbleChannelProvider } from "../services/ChannelProviders";
import { cleanTitle } from "../utils/titleCleaner";
import { TVGuideDashboard } from "./TVGuideDashboard";
import { DefaultChannelManifests, LiveChannelManifests } from "../data/manifests";
import { ScheduleShow } from "../types/tvGuide";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


export interface MultiplexerChannelConfig {
  channelId: string;
  num: number;
  name: string;
  category: string;
  logo: string;
  type: "ia_collection" | "rumble" | "youtube" | "custom_m3u" | "default" | "rss" | "hls" | "live_hls" | "rumble_m3u";
  source: string;
  hlsSource?: string;
  displayMode?: "timeline" | "action";
  persistence?: "force-live" | "archive-if-ended";
  isLiveMode?: boolean;
  behavior?: "binge" | "shuffle" | "syndication";
  episodes?: any[];
  totalLoopDurationInSeconds?: number;
}

export interface BroadcastTVGuideProps {
  channels?: any[];
  archiveEpisodes?: any[];
  tvDb?: any;
  onSelectStream: (stream: { url: string; title: string; seekPosition?: number; isLiveNow?: boolean; channelId?: string; showTitle?: string; trace?: any }) => void;
  theme?: "dark" | "light";
  stopPreludeMusic?: () => void;
}

// Fixed epoch reference for continuous deterministic playout math (Jan 1, 2025 00:00:00 UTC)
const EPOCH_TIMESTAMP = 1735689600;

const FALLBACK_THUMBNAILS = [
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg", // TV news studio
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg", // Cyber hub satellite
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg", // Digital tech network
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg", // Robot intelligence
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg", // Retro newspaper press
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg", // Cyber defense console
  "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg"  // Deep space broadcast
];

const getStableFallbackThumb = (seed?: string): string => {
  if (!seed) return FALLBACK_THUMBNAILS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_THUMBNAILS.length;
  return FALLBACK_THUMBNAILS[index];
};

const EM_MAP: Record<string, string> = {
  "liberty express": "📻",
  "ajn archives": "📂",
  news: "📰",
  geopolitics: "🌐",
  warroom: "🌐",
  "war room": "🌐",
  archive: "🎞",
  documentary: "📽",
  documentaries: "📽",
  civics: "⚖",
  economics: "📈",
  econ: "📈",
  health: "🧬",
  investigations: "🔍",
  world: "🌍",
  technology: "🤖",
  tech: "🤖",
  "late night": "🌙",
  unconfigured: "⚙",
  variety: "🎭",
  western: "🤠",
  westerns: "🤠",
  comedy: "😂",
  sports: "⚽",
  music: "🎵",
  "special report": "🚨",
  "election 2020": "🗳️",
  "livestream": "📺",
  "war room archive": "📅",
  "classic docs": "🎬",
  "iptv": "🇺🇸",
  "embeds": "🥊",
  "david knight": "🎙️"
};

const getArchiveThumb = (collectionId: string, filename: string): string => {
  if (!filename) return AJN_LOGO_URL;
  
  // Handlers for daily-highlights collection which contains top-level pre-scaled thematic graphics
  if (collectionId === "daily-highlights") {
    return getArchiveThumbnail("", filename);
  }

  // Fallback pattern for standard collection thumbs subdirectories
  const baseName = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  return `https://archive.org/download/${collectionId}/${collectionId}.thumbs/${baseName}_thumb.jpg`;
};

const DEFAULT_CH1_FILES = [
  "20260819_Wed_AJNPrimeTimeLive.mp4",
  "20260818_Tue_AJNPrimeTimeLive.mp4",
  "20260817_Mon_AJNPrimeTimeLive.mp4",
  "20260816_Sun_AJNPrimeTimeLive.mp4"
];

const DEFAULT_CH3_FILES = [
  "20260819_Wed_NightlyNews_Sept11.mp4",
  "20260818_Tue_NightlyNews_Sept10.mp4",
  "20260817_Mon_NightlyNews_Sept9.mp4",
  "20260816_Sun_NightlyNews_Sept8.mp4"
];

const DEFAULT_CH7_FILES = [
  "20231010_Tue_WarRoom_Hour1.mp4",
  "20231011_Wed_WarRoom_Hour2.mp4",
  "20231012_Thu_WarRoom_Hour3.mp4",
  "20231013_Fri_WarRoom_Hour4.mp4"
];

const DEFAULT_CH8_FILES = [
  "19991001_Fri_BohemianGroveExpose.mp4",
  "20000512_Fri_PoliceState2000.mp4",
  "20090315_Sun_TheObamaDeception.mp4"
];

const DEFAULT_CH11_FILES = [
  "19980401_Wed_InfoWarsClassic_Hour1.mp4",
  "19980402_Thu_InfoWarsClassic_Hour2.mp4",
  "19980403_Fri_InfoWarsClassic_Hour3.mp4"
];

const ObservedRow: React.FC<{
  children: React.ReactNode;
  height: number;
  className?: string;
  isLight: boolean;
  id?: string;
}> = ({ children, height, className, isLight, id }) => {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInView(visible);
        if (id) {
          window.dispatchEvent(new CustomEvent("ajn-row-visibility", {
            detail: { id, isVisible: visible }
          }));
        }
      },
      {
        rootMargin: "350px 0px 350px 0px", // pre-render buffer above and below viewport
        threshold: 0.01,
      }
    );
    observer.observe(ref);
    return () => {
      observer.unobserve(ref);
      if (id) {
        window.dispatchEvent(new CustomEvent("ajn-row-visibility", {
          detail: { id, isVisible: false }
        }));
      }
    };
  }, [ref, id]);

  return (
    <div 
      ref={setRef} 
      style={{ height: `${height}px` }} 
      className={className}
    >
      {isInView ? children : (
        <div className={`w-full h-full rounded-2xl border ${
          isLight ? "bg-slate-100/30 border-slate-200/30" : "bg-[#090E19]/30 border-slate-900/30"
        } flex items-center justify-center`} />
      )}
    </div>
  );
};

const getPalette = (tag: string): string => {
  const t = tag.toLowerCase();
  if (t === "live") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (t === "news") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (t === "documentaries" || t === "documentary") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  if (t === "geopolitics") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (t === "archive") return "bg-teal-500/10 text-teal-400 border-teal-500/20";
  if (t === "tech") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  if (t === "econ") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (t === "health") return "bg-lime-500/10 text-lime-400 border-lime-500/20";
  return "bg-slate-800/80 text-slate-400 border-slate-700/50";
};

export const BroadcastTVGuide = React.memo(function BroadcastTVGuide({
  channels = [],
  archiveEpisodes = [],
  onSelectStream,
  theme = "dark",
  stopPreludeMusic
}: BroadcastTVGuideProps) {
  const [discoveredChannels, setDiscoveredChannels] = useState<any[]>(() => [
    { id: "info-survivor", channelId: "info-survivor", num: 90, name: "📺 Info Survivor", url: "https://archive.org/download/daily-highlights/Info%20Survior.m3u", staggerOffsetPercent: 0.0, size: "N/A" },
    { id: "alex-24", channelId: "alex-24", num: 91, name: "📺 Alex 24 News", url: "https://archive.org/download/daily-highlights/Alex%2024.m3u", staggerOffsetPercent: 0.25, size: "N/A" },
    { id: "super-alex", channelId: "super-alex", num: 92, name: "📺 Super Alex Jones Archive", url: "https://archive.org/download/daily-highlights/Super%20Alex%20Jones%20Archive.m3u", staggerOffsetPercent: 0.5, size: "N/A" },
    { id: "liberty-express-1", channelId: "liberty-express-1", num: 100, name: "📻 Liberty Express Live (CH 1)", url: "https://archive.org/download/daily-highlights/Liberty_Express_Live (1).m3u", staggerOffsetPercent: 0.75, size: "N/A" },
    { id: "liberty-express-2", channelId: "liberty-express-2", num: 101, name: "📻 Liberty Express Live (CH 2)", url: "https://archive.org/download/daily-highlights/Liberty_Express_Live (2).m3u", staggerOffsetPercent: 0.0, size: "N/A" },
    { id: "liberty-express-3", channelId: "liberty-express-3", num: 102, name: "📻 Liberty Express Live (CH 3)", url: "https://archive.org/download/daily-highlights/Liberty_Express_Live (3).m3u", staggerOffsetPercent: 0.25, size: "N/A" },
    { id: "ajn-archives", channelId: "ajn-archives", num: 103, name: "📂 AJN Archives (CH 4)", url: "https://archive.org/download/daily-highlights/AJN archive 1.m3u", staggerOffsetPercent: 0.5, size: "N/A" }
  ]);
  const [discoverySource, setDiscoverySource] = useState<string>("static_init");

  const [rssEpisodes, setRssEpisodes] = useState<any[]>([]);

  useEffect(() => {
    fetch(BACKEND_URL + "/api/ajn-archive")
      .then((res) => {
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          return res.json();
        }
        return { success: false };
      })
      .then((data) => {
        if (data && data.success && data.episodes) {
          setRssEpisodes(data.episodes);
        }
      })
      .catch((err) => console.warn("Failed to fetch RSS archive for EPG:", err));
  }, []);

  useEffect(() => {
    fetch(BACKEND_URL + "/api/ajn-discover-channels")
      .then(res => {
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          return res.json();
        }
        return { success: false };
      })
      .then(data => {
        if (data.success && data.channels && data.channels.length > 0) {
          const idMap = new Map<string, number>();
          const mapped = data.channels.map((ch: any, index: number) => {
            let baseId = ch.file ? ch.file.replace(/\.m3u$/i, "").toLowerCase().replace(/[^a-z0-9\-]/g, "-") : ch.id;
            if (!baseId) baseId = `ch-${index}`;
            baseId = baseId.replace(/-+/g, "-").replace(/^-|-$/g, "");

            let uniqueId = baseId;
            if (idMap.has(baseId)) {
              const count = idMap.get(baseId)! + 1;
              idMap.set(baseId, count);
              uniqueId = `${baseId}-${count}`;
            } else {
              idMap.set(baseId, 1);
            }

            return {
              id: uniqueId,
              channelId: uniqueId,
              num: ch.num || (100 + index),
              name: ch.name,
              url: ch.url,
              staggerOffsetPercent: ch.staggerOffsetPercent || 0.0,
              size: ch.size || "N/A",
              file: ch.file
            };
          });
          setDiscoveredChannels(mapped);
          setDiscoverySource(data.source);
        }
      })
      .catch(err => console.warn("[BroadcastTVGuide] Failed to auto-discover channels:", err));
  }, []);

  const configs = useMemo(() => {
    return discoveredChannels
      .filter(ch => !QuarantineLedger.isQuarantined(ch.id))
      .map(ch => ({
      id: ch.id,
      name: ch.name,
      url: ch.url,
      staggerOffsetPercent: ch.staggerOffsetPercent
    }));
  }, [discoveredChannels]);

  // Dynamic state for tracked visible rows in viewport (IntersectionObserver)
  const [visibleRows, setVisibleRows] = useState<Set<string>>(new Set());

  const prioritizedIds = useMemo(() => {
    const ids = new Set<string>();
    visibleRows.forEach(id => ids.add(id));
    const lastChId = safeLocalStorage.getItem("ajn_last_channel_id");
    if (lastChId) {
      ids.add(lastChId);
    }
    return ids;
  }, [visibleRows]);

  const { states: archiveStates, loadChannel } = useVirtualArchiveChannels(configs, prioritizedIds);

  // Isolated Feed Multiplexer configuration state
  const [multiplexerChannels, setMultiplexerChannels] = useState<MultiplexerChannelConfig[]>(() => {
    const defaultFeeds: MultiplexerChannelConfig[] = DefaultChannelManifests.map(manifest => {
      // Re-apply dynamic logic like "" since JSON can't hold function calls
      if ((manifest as any).source === "") {
        return { ...manifest, source: "" } as unknown as MultiplexerChannelConfig;
      }
      return manifest as unknown as MultiplexerChannelConfig;
    });

    try { return defaultFeeds; } catch(e) { return defaultFeeds; }});

  const [customDropGoChannels, setCustomDropGoChannels] = useState<any[]>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_drop_go_channels");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = safeLocalStorage.getItem("ajn_drop_go_channels");
        if (stored) {
          setCustomDropGoChannels(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to sync custom drop-go channels:", e);
      }
    };
    window.addEventListener("ajn_auto_channels_updated", handleSync);
    return () => window.removeEventListener("ajn_auto_channels_updated", handleSync);
  }, []);

  const [viewMode, setViewMode] = useState<"timeline" | "calendar">(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_guide_view_mode");
      return (stored === "timeline" || stored === "calendar") ? stored : "timeline";
    } catch {
      return "timeline";
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_guide_view_mode", viewMode);
    } catch {}
  }, [viewMode]);

  const handleDownloadEpg = useCallback(() => {
    const listToExport = multiplexerChannels && multiplexerChannels.length > 0 ? multiplexerChannels : channels;
    const epgExport = {
      generator: "AJN Electronic Program Guide System v3.5",
      exportTime: new Date().toISOString(),
      timezone: "UTC",
      totalChannels: listToExport.length,
      channels: listToExport.map(ch => ({
        channelId: ch.channelId || ch.id || `mux-ch-${ch.num}`,
        channelNumber: ch.num || ch.number,
        channelName: ch.name,
        category: ch.category,
        logoUrl: ch.logo || ch.logoUrl,
        type: ch.type || "stream",
        sourceUrl: ch.source || ch.url,
        programSchedule: [
          {
            title: `${ch.name} Continuous Feed`,
            description: `24/7 deterministic playout loop and automated EPG scheduling.`,
            startTime: new Date().toISOString(),
            durationSeconds: 7200,
            timezoneRule: "UTC"
          }
        ]
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(epgExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ajn_epg_schedule_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [multiplexerChannels, channels]);

  const [muxFiles, setMuxFiles] = useState<Record<string, string[]>>({});
  const [loadingMux, setLoadingMux] = useState<Record<string, boolean>>({});
  const [muxEpisodes, setMuxEpisodes] = useState<Record<string, MasterPlaylistEpisode[] | undefined>>({});

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = safeLocalStorage.getItem("ajn_multiplexer_feeds");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setMultiplexerChannels(prev => {
              if (JSON.stringify(prev) !== stored) {
                return parsed;
              }
              return prev;
            });
          }
        }
      } catch (e) {
        console.error("Failed to sync multiplexer channels:", e);
      }
    };
    window.addEventListener("ajn-multiplexer-updated", handleSync);
    return () => window.removeEventListener("ajn-multiplexer-updated", handleSync);
  }, []);

  useEffect(() => {
    // Save multiplexer configuration
    safeLocalStorage.setItem("ajn_multiplexer_feeds", JSON.stringify(multiplexerChannels));

    // Fetch dynamic channel providers (IA collection or RSS)
    multiplexerChannels.forEach(ch => {
      const provider = ChannelProviderFactory.getProvider(ch.type);

      if (ch.type === "ia_collection" && ch.source && !muxFiles[ch.channelId] && !loadingMux[ch.channelId]) {
        setLoadingMux(prev => ({ ...prev, [ch.channelId]: true }));
        fetchArchiveCollectionFiles(ch.source).then(files => {
          if (files && files.length > 0) {
            setMuxFiles(prev => ({ ...prev, [ch.channelId]: files }));
            provider.getMetadata(ch, { [ch.channelId]: files }).then(meta => {
              if (meta.episodes && meta.episodes.length > 0) {
                setMuxEpisodes(prev => ({ ...prev, [ch.channelId]: meta.episodes }));
              }
            }).catch(e => console.error("Failed to parse IA metadata inside provider:", e));
          }
          setLoadingMux(prev => ({ ...prev, [ch.channelId]: false }));
        }).catch(err => {
          console.error(`Failed to fetch file list for ${ch.source}:`, err);
          setLoadingMux(prev => ({ ...prev, [ch.channelId]: false }));
        });
      } else if (ch.type === "rss" && ch.source && !muxEpisodes[ch.channelId] && !loadingMux[ch.channelId]) {
        setLoadingMux(prev => ({ ...prev, [ch.channelId]: true }));
        provider.getMetadata(ch).then(meta => {
          if (meta.episodes && meta.episodes.length > 0) {
            setMuxEpisodes(prev => ({ ...prev, [ch.channelId]: meta.episodes }));
          }
          setLoadingMux(prev => ({ ...prev, [ch.channelId]: false }));
        }).catch(err => {
          console.error(`Failed to fetch RSS metadata for ${ch.source}:`, err);
          setLoadingMux(prev => ({ ...prev, [ch.channelId]: false }));
        });
      } else if (ch.type === "rumble" && ch.source && !muxEpisodes[ch.channelId] && !loadingMux[ch.channelId]) {
        setLoadingMux(prev => ({ ...prev, [ch.channelId]: true }));
        provider.getMetadata(ch).then(meta => {
          if (meta.episodes && meta.episodes.length > 0) {
            setMuxEpisodes(prev => ({ ...prev, [ch.channelId]: meta.episodes }));
          }
          setLoadingMux(prev => ({ ...prev, [ch.channelId]: false }));
        }).catch(err => {
          console.error(`Failed to fetch Rumble metadata for ${ch.source}:`, err);
          setLoadingMux(prev => ({ ...prev, [ch.channelId]: false }));
        });
      }
    });
  }, [multiplexerChannels, muxFiles]);

  const refreshMuxChannel = useCallback(async (channelId: string) => {
    const ch = multiplexerChannels.find(c => c.channelId === channelId);
    if (!ch) return;
    setLoadingMux(prev => ({ ...prev, [channelId]: true }));
    try {
      const provider = ChannelProviderFactory.getProvider(ch.type);
      if (ch.type === "ia_collection") {
        const files = await fetchArchiveCollectionFiles(ch.source);
        if (files && files.length > 0) {
          setMuxFiles(prev => ({ ...prev, [channelId]: files }));
          const meta = await provider.getMetadata(ch, { [channelId]: files });
          if (meta.episodes) {
            setMuxEpisodes(prev => ({ ...prev, [channelId]: meta.episodes }));
            console.log(`[Multiplexer] Ingested ${meta.episodes.length} files via IA Provider for ${ch.name}`);
          }
        } else {
          alert(`No media files parsed or collection not found for: ${ch.source}`);
        }
      } else {
        const meta = await provider.getMetadata(ch);
        if (meta.episodes && meta.episodes.length > 0) {
          setMuxEpisodes(prev => ({ ...prev, [channelId]: meta.episodes }));
          console.log(`[Multiplexer] Ingested ${meta.episodes.length} episodes via Provider for ${ch.name}`);
        } else {
          alert(`Could not retrieve or parse metadata/episodes for: ${ch.source}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMux(prev => ({ ...prev, [channelId]: false }));
    }
  }, [multiplexerChannels, muxFiles]);

  const rollingWeekChannelsList = useMemo(() => {
    const list = [];
    // Start from current week
    let currentDate = new Date();
    // Round to start of current week (Monday)
    const day = currentDate.getDay() || 7;
    currentDate.setDate(currentDate.getDate() - day + 1);
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 4; i++) {
      const wStart = new Date(currentDate);
      wStart.setDate(currentDate.getDate() - i * 7);
      
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);

      const d = new Date(Date.UTC(wStart.getFullYear(), wStart.getMonth(), wStart.getDate()));
      const isoDay = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - isoDay);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

      const bucketId = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
      const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const label = `CH ${i + 1} — WEEK ${weekNo} (${wStart.toLocaleDateString("en-US", formatOptions)} - ${wEnd.toLocaleDateString("en-US", formatOptions)})`.toUpperCase();

      list.push({
        id: `rolling-week-${i}`,
        channelId: `rolling-week-${i}`,
        num: i + 3, // CH 3 to 6
        name: `📅 ${label}`,
        category: "Rolling RSS Archive",
        logo: AJN_LOGO_URL,
        m3uRef: `mux-rolling-week-${i}`,
        offsetIndex: 0,
        url: "",
        type: "weekly_rolling" as const,
        source: `rolling-week-${i}`,
        bucketId,
        wStart,
        wEnd
      });
    }
    return list;
  }, []);

  const virtualChannels = useMemo(() => {
    function cleanChannelDisplayTitle(raw: string): string {
      if (!raw) return 'Unknown Channel';
      return raw
        // Remove everything up to and including "/split shows/" or "/split_shows/" (case-insensitive)
        .replace(/^.*[\/\\]split[ _]shows[\/\\]/i, '')
        // Remove leading emojis like 📻 or 📺 and extra spaces
        .replace(/^[\u2000-\u3300\uD83C-\uD83E\uDC00-\uDFFF\s]+/g, '')
        // Remove trailing file extensions like .m3u
        .replace(/\.m3u$/i, '')
        // Clean up trailing hyphens or underscores
        .replace(/[-_]+$/, '')
        .trim();
    }

    const liveChannels = LiveChannelManifests.map(manifest => ({
      ...manifest,
      url: (manifest as any).url === "" ? "" : (manifest as any).url,
      source: (manifest as any).source === "" ? "" : (manifest as any).source,
      backupSource: (manifest as any).backupSource === "" ? "" : (manifest as any).backupSource
    }));

    const mappedArchiveChannels = discoveredChannels.map(ch => {
      const state = archiveStates[ch.id];
      const cleanedName = cleanChannelDisplayTitle(ch.name);
      return {
        id: ch.id,
        channelId: ch.id,
        num: ch.num,
        name: cleanedName,
        title: cleanedName,
        category: ch.name.toLowerCase().includes("archive") ? "AJN Archives" : "Liberty Express",
        logo: AJN_LOGO_URL,
        m3uRef: `mux-${ch.id}`,
        offsetIndex: 0,
        url: ch.url,
        type: "virtual_archive" as const,
        source: ch.url,
        isPermanent: true,
        staggerOffsetSeconds: state?.staggerOffsetSeconds || 0
      };
    });

    const mappedCustomChannels = customDropGoChannels.map(ch => {
      const cleanedName = cleanChannelDisplayTitle(ch.name);
      return {
        id: ch.id,
        channelId: ch.id,
        num: ch.num,
        name: cleanedName,
        title: cleanedName,
        category: "Auto-Channels",
        logo: ch.logo,
        m3uRef: `mux-${ch.id}`,
        offsetIndex: 0,
        url: ch.url || "",
        type: "drop_go" as const,
        source: "drop_go",
        isPermanent: true,
        staggerOffsetSeconds: ch.staggerOffsetSeconds || 0
      };
    });

    const mappedMultiplexer = multiplexerChannels.map(ch => {
      const cleanedName = cleanChannelDisplayTitle(ch.name);
      return {
        id: ch.channelId,
        channelId: ch.channelId,
        num: ch.num,
        name: cleanedName,
        title: cleanedName,
        category: ch.category || "Multiplexer",
        logo: ch.logo || AJN_LOGO_URL,
        m3uRef: `mux-${ch.channelId}`,
        offsetIndex: 0,
        url: ch.source || "",
        type: ch.type,
        source: ch.source,
        isPermanent: true,
        staggerOffsetSeconds: 0
      };
    });

    const rawChannels = [
      ...liveChannels,
      ...mappedMultiplexer,
      ...mappedCustomChannels,
      ...rollingWeekChannelsList,
      ...mappedArchiveChannels
    ];

    const assignChannelNumber = (channel: any, index: number): number => {
      const cat = (channel.category || "").toLowerCase();
      const id = (channel.id || "").toLowerCase();
      
      // Preserve explicit manual multiplexer numbers if they are single/double digit premium
      if (channel.num && channel.num < 100) return channel.num;
      
      if (cat.includes("classic") || cat.includes("liberty")) return 100 + index;
      if (cat.includes("news") || cat.includes("archive")) return 200 + index;
      if (cat.includes("day") || cat.includes("week") || cat.includes("month") || cat.includes("time") || id.includes("weekly")) return 300 + index;
      if (cat.includes("auto") || channel.type === "drop_go") return 400 + index;
      if (cat.includes("multiplexer")) return 500 + index;
      
      return 600 + index; // fallback
    };

    const usedNums = new Set<number>();
    
    const assignedChannels = rawChannels.map((ch, idx) => {
       let assigned = assignChannelNumber(ch, idx);
       while(usedNums.has(assigned)) {
          assigned++;
       }
       usedNums.add(assigned);
       return {
         ...ch,
         num: assigned
       };
    });

    return assignedChannels.sort((a, b) => a.num - b.num);
  }, [
    rollingWeekChannelsList,
    discoveredChannels,
    archiveStates,
    customDropGoChannels,
    multiplexerChannels
  ]);

  // 1. Initialize Master Playlist Store
  const masterStore = useMemo(() => {
    const store: Record<string, MasterPlaylist> = {};

    // 1. AJN Live Playlist
    store["mux-live-ajn"] = {
      id: "mux-live-ajn",
      name: "🔴 AJN Live",
      category: "Live Channels",
      logo: AJN_LOGO_URL,
      episodes: [
        {
          id: "live-ajn-ep",
          title: "AJN Live Broadcast Stream",
          durationInSeconds: 86400,
          url: "https://rumble.com/embed/v79lfxq/?pub=15son",
          thumbnail: AJN_LOGO_URL,
          plot: "Watch the AJN Live broadcast primary M3U playlist stream. If this M3U feed is offline, the system auto-detects and switches to the backup JSON embed (v7aj9au).",
          genre: "Live",
          rating: "TV-14"
        }
      ],
      totalLoopDurationInSeconds: 86400
    };

    // 2. Warroom Live Playlist
    store["mux-live-warroom"] = {
      id: "mux-live-warroom",
      name: "🔴 Warroom Live",
      category: "Live Channels",
      logo: AJN_LOGO_URL,
      episodes: [
        {
          id: "live-warroom-ep",
          title: "Warroom Live Stream",
          durationInSeconds: 86400,
          url: "",
          thumbnail: AJN_LOGO_URL,
          plot: "Harrison Smith, an 8th-generation Texan, hosts the show. It features political commentary, current events analysis, guest interviews, and listener calls.",
          genre: "Live",
          rating: "TV-14"
        }
      ],
      totalLoopDurationInSeconds: 86400
    };

    // Helper to generate full schedule for a rolling week channel
    const getEpisodesForBucket = (bucketId: string) => {
      const weekEpisodes = rssEpisodes.filter(ep => ep.bucketId === bucketId);
      if (weekEpisodes.length === 0) {
        // Fallback placeholder schedule
        return [
          {
            id: `empty-${bucketId}-ep1`,
            title: `AJN Archive Placeholder for ${bucketId}`,
            durationInSeconds: 10800,
            url: "",
            thumbnail: AJN_LOGO_URL,
            plot: `No specific archive files detected for this week. Looping generic playout broadcast.`,
            genre: "Archive",
            rating: "TV-14"
          }
        ];
      }

      // Sort
      weekEpisodes.sort((a, b) => {
        return new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime();
      });

      return weekEpisodes.map((ep, idx) => ({
        id: `ep-${ep.id || idx}-${bucketId}`,
        title: ep.title || `${ep.show} - ${ep.hour}`,
        durationInSeconds: 3600,
        url: ep.videoUrl || "",
        thumbnail: ep.thumbnailUrl || AJN_LOGO_URL,
        plot: ep.description || `${ep.show} ${ep.hour} from the central archive system.`,
        genre: "Archive",
        rating: "TV-14"
      }));
    };

    // 3. Weekly Rolling Playlist
    rollingWeekChannelsList.forEach(ch => {
      const episodes = getEpisodesForBucket(ch.bucketId);
      const totalDur = episodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
      store[ch.m3uRef] = {
        id: ch.m3uRef,
        name: ch.name,
        category: "Rolling RSS Archive",
        logo: ch.logo,
        episodes,
        totalLoopDurationInSeconds: totalDur
      };
    });

    // 5. Virtual Archive Playlists (Dynamic)
    discoveredChannels.forEach(ch => {
      const state = archiveStates[ch.id];
      store[`mux-${ch.id}`] = {
        id: `mux-${ch.id}`,
        name: ch.name,
        category: ch.name.toLowerCase().includes("archive") ? "AJN Archives" : "Liberty Express",
        logo: AJN_LOGO_URL,
        episodes: state?.episodes || [],
        totalLoopDurationInSeconds: state?.totalDuration || 0
      };
    });

    // 6. Custom Auto-Channels (Drop & Go)
    customDropGoChannels.forEach(ch => {
      store[`mux-${ch.id}`] = {
        id: `mux-${ch.id}`,
        name: ch.name,
        category: "Auto-Channels",
        logo: ch.logo,
        episodes: ch.episodes || [],
        totalLoopDurationInSeconds: ch.totalLoopDurationInSeconds || 0
      };
    });

    // 7. Multiplexer Channels (CH 1 to 12)
    multiplexerChannels.forEach(ch => {
      const eps = ch.episodes || muxEpisodes[ch.channelId] || [];
      const totalDur = eps.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
      store[`mux-${ch.channelId}`] = {
        id: `mux-${ch.channelId}`,
        name: ch.name,
        category: ch.category || "Multiplexer",
        logo: ch.logo || AJN_LOGO_URL,
        episodes: eps,
        totalLoopDurationInSeconds: totalDur
      };
    });

    return store;
  }, [
    rssEpisodes,
    rollingWeekChannelsList,
    discoveredChannels,
    archiveStates,
    customDropGoChannels,
    multiplexerChannels,
    muxEpisodes
  ]);


  // UI State
  const [showConsoleHeader, setShowConsoleHeader] = useState<boolean>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_show_console_header");
      return stored === "true"; // default to false
    } catch {
      return false;
    }
  });

  const [hideTacticalCommand, setHideTacticalCommand] = useState<boolean>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_hide_tactical_command");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const toggleConsoleHeader = useCallback(() => {
    setShowConsoleHeader(prev => {
      const newVal = !prev;
      try {
        safeLocalStorage.setItem("ajn_show_console_header", String(newVal));
      } catch {}
      return newVal;
    });
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_guide_selected_category");
      return stored || "all";
    } catch {
      return "all";
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_guide_selected_category", selectedCategory);
    } catch {}
  }, [selectedCategory]);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const [pxPerMin, setPxPerMin] = useState<number>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_guide_px_per_min");
      return stored ? parseInt(stored, 10) : 4;
    } catch {
      return 4;
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_guide_px_per_min", String(pxPerMin));
    } catch {}
  }, [pxPerMin]);
  
  // Custom states for 90-day density management and missing broadcast day filtering
  const [hideEmptyArchiveDays, setHideEmptyArchiveDays] = useState<boolean>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_guide_hide_empty_archive_days");
      return stored === "false" ? false : true; // default to true
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_guide_hide_empty_archive_days", String(hideEmptyArchiveDays));
    } catch {}
  }, [hideEmptyArchiveDays]);
  const [jumpDate, setJumpDate] = useState<string>("");
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    // Auto-expand current month by default
    const now = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;
    return { [currentMonthLabel]: true };
  });

  const getMonthName = useCallback((dateKey?: string) => {
    if (!dateKey) return "Unknown Month";
    const parts = dateKey.split("-");
    if (parts.length < 2) return "Unknown Month";
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[monthIndex] || "Unknown"} ${year}`;
  }, []);
  
  // Windowing state: [startTimeSec, endTimeSec]
  const [viewWindow, setViewWindow] = useState<[number, number]>(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    return [nowSec - 86400 * 2, nowSec + 86400 * 4]; // [Now - 2 days, Now + 4 days]
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(safeLocalStorage.getItem("ajn_guide_favs") || "[]");
    } catch {
      return [];
    }
  });

  const [selectedProgram, setSelectedProgram] = useState<{ block: VirtualProgramBlock; channel: VirtualChannel } | null>(null);


  useEffect(() => {
    const pendingChanges = new Map<string, boolean>();
    let timeoutId: any = null;

    const flushChanges = () => {
      setVisibleRows(prev => {
        const next = new Set(prev);
        let changed = false;
        pendingChanges.forEach((isVisible, id) => {
          if (isVisible) {
            if (!next.has(id)) {
              next.add(id);
              changed = true;
            }
          } else {
            if (next.has(id)) {
              next.delete(id);
              changed = true;
            }
          }
        });
        pendingChanges.clear();
        return changed ? next : prev;
      });
    };

    const handleVisibility = (e: any) => {
      const { id, isVisible } = e.detail;
      pendingChanges.set(id, isVisible);
      
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(flushChanges, 100);
    };

    window.addEventListener("ajn-row-visibility" as any, handleVisibility);
    return () => {
      window.removeEventListener("ajn-row-visibility" as any, handleVisibility);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Multiplexer configuration board state
  const [showMuxBoard, setShowMuxBoard] = useState(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_guide_show_mux_board");
      return stored === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_guide_show_mux_board", String(showMuxBoard));
    } catch {}
  }, [showMuxBoard]);

  const [customTagsRevision, setCustomTagsRevision] = useState(0);

  const scheduleManager = useMemo(() => {
    try {
      return kernel.getSubsystem<BroadcastScheduleManager>("BroadcastScheduleManager");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!scheduleManager) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = scheduleManager.subscribeToTags(() => {
        setCustomTagsRevision(prev => prev + 1);
      });
    } catch (e) {
      console.warn("[BroadcastTVGuide] Failed to subscribe to tags:", e);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [scheduleManager]);

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editType, setEditType] = useState<MultiplexerChannelConfig["type"]>("default");
  const [editCategory, setEditCategory] = useState("");
  const [editPersistence, setEditPersistence] = useState<"force-live" | "archive-if-ended">("force-live");
  const [editBehavior, setEditBehavior] = useState<"binge" | "shuffle" | "syndication">("binge");

  // Registration and validation state variables
  const [showRegModal, setShowRegModal] = useState(false);
  const [regName, setRegName] = useState("");
  const [regType, setRegType] = useState<MultiplexerChannelConfig["type"]>("default");
  const [regSource, setRegSource] = useState("");
  const [regCategory, setRegCategory] = useState("News");
  const [regPosition, setRegPosition] = useState<number>(12);
  const [regPersistence, setRegPersistence] = useState<"force-live" | "archive-if-ended">("force-live");
  const [regBehavior, setRegBehavior] = useState<"binge" | "shuffle" | "syndication">("binge");
  const [validationState, setValidationState] = useState<{ status: "idle" | "checking" | "valid" | "failed"; message?: string; thumbnail?: string }>({ status: "idle" });
  const [conflictState, setConflictState] = useState<{ active: boolean; existingChannel: MultiplexerChannelConfig } | null>(null);

  // Scraping progress
  const [isScraping, setIsScraping] = useState<Record<string, boolean>>({});
  const [scrapingProgress, setScrapingProgress] = useState<Record<string, number>>({});

  // Classic Videos captured playlist state
  const [showClassicPlaylist, setShowClassicPlaylist] = useState(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_guide_show_classic_playlist");
      return stored === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_guide_show_classic_playlist", String(showClassicPlaylist));
    } catch {}
  }, [showClassicPlaylist]);

  useEscapeKey(() => {
    if (showRegModal) setShowRegModal(false);
    if (showMuxBoard) setShowMuxBoard(false);
    if (showClassicPlaylist) setShowClassicPlaylist(false);
  });
  const [classicVideos, setClassicVideos] = useState<{ id: string; title: string; url: string; savedAt: string }[]>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_classic_videos");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Health check status states for registered Rumble channels
  const [healthStates, setHealthStates] = useState<Record<string, { isLive: boolean; message: string; lastChecked: string }>>({});

  // Export Function
  const exportRegistry = () => {
    const data = JSON.stringify(multiplexerChannels);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ajn_epg_registry.json";
    a.click();
  };

  // Import Function
  const importRegistry = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        // VALIDATION: Ensure the structure matches your registry expectations
        if (Array.isArray(imported)) {
          setMultiplexerChannels(imported);
          alert("Registry successfully imported.");
        }
      } catch { alert("Error: Invalid JSON structure"); }
    };
    reader.readAsText(file);
  };

  // Open Registration Modal Helper
  const openRegistrationModal = useCallback((num: number) => {
    setRegPosition(num);
    setRegCategory("News");
    setRegName("");
    setRegSource("");
    setValidationState({ status: "idle" });
    setShowRegModal(true);
  }, []);

  // Validate Source for Registration Form
  const handleValidateRegisterSource = useCallback(async () => {
    if (!regSource || !regSource.trim()) {
      setValidationState({ status: "failed", message: "Please enter a source URL or identifier" });
      return;
    }
    setValidationState({ status: "checking" });
    try {
      const res = await validateStreamURL(regSource, regType);
      if (res.valid) {
        setValidationState({ 
          status: "valid", 
          message: "Validation Succeeded! Source is active.", 
          thumbnail: res.temporaryThumbnail 
        });
      } else {
        setValidationState({ status: "failed", message: res.reason || "Validation failed" });
      }
    } catch (err: any) {
      setValidationState({ status: "failed", message: String(err.message || err) });
    }
  }, [regSource, regType]);

  // Central multiplexer save handler with automated Internet Archive scraping & EPG schedule loop generation
  const saveMultiplexerChannel = useCallback(async (
    channelId: string,
    num: number,
    name: string,
    type: string,
    source: string,
    category: string,
    persistence: string,
    behavior: "binge" | "shuffle" | "syndication" = "binge",
    isNew: boolean = false
  ) => {
    setIsScraping(prev => ({ ...prev, [channelId]: true }));
    setScrapingProgress(prev => ({ ...prev, [channelId]: 5 }));

    try {
      if (type === "ia_collection") {
        setScrapingProgress(prev => ({ ...prev, [channelId]: 20 }));
        const files = await fetchArchiveCollectionFiles(source);
        setScrapingProgress(prev => ({ ...prev, [channelId]: 50 }));

        if (!files || files.length === 0) {
          throw new Error(`No files found or collection offline for Internet Archive identifier: "${source}"`);
        }

        const parsed = parseArchiveManifest(files, source, num);
        setScrapingProgress(prev => ({ ...prev, [channelId]: 70 }));

        if (parsed.length === 0) {
          throw new Error(`Could not parse any media assets (.mp4, .mp3, etc.) from this collection.`);
        }

        const getArchiveThumb = (id: string, fileId: string) => {
          return `https://archive.org/services/img/${id}`;
        };

        let episodes = parsed.map((item, idx) => {
          const dateKey = item.dateKey;
          let properDateFormatted = "Unknown Date";
          if (dateKey) {
            const d = new Date(dateKey + "T12:00:00");
            const dateOpts: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
            properDateFormatted = d.toLocaleDateString("en-US", dateOpts);
          }

          return {
            id: item.id || `${channelId}-ep-${idx}`,
            title: item.displayDate || item.title,
            durationInSeconds: item.duration || 3600,
            url: item.url,
            thumbnail: getArchiveThumb(source, item.id),
            plot: `Chrono Segment: ${item.displayDate}. Resolved via Semantic Date Resolver. Original Air Date: ${properDateFormatted}.`,
            genre: "Archive",
            rating: "TV-14",
            properDateFormatted,
            properHour: "Archive Segment"
          };
        });

        if (behavior === "shuffle") {
          episodes = [...episodes].sort(() => Math.random() - 0.5);
        } else {
          episodes.sort((a, b) => (a.properDateFormatted || "").localeCompare(b.properDateFormatted || ""));
        }

        setScrapingProgress(prev => ({ ...prev, [channelId]: 85 }));

        let totalDuration = episodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
        let wheelEpisodes = [...episodes];
        if (totalDuration > 0) {
          let loopCounter = 1;
          const baseEpisodes = [...episodes];
          while (totalDuration < 86400) {
            wheelEpisodes = [
              ...wheelEpisodes,
              ...baseEpisodes.map(ep => ({
                ...ep,
                id: `${ep.id}-loop-${loopCounter}`,
                plot: `Automated Playout Slot (Loop ${loopCounter}). Behavior: ${behavior.toUpperCase()}`
              }))
            ];
            loopCounter++;
            totalDuration = wheelEpisodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
          }
        }

        setScrapingProgress(prev => ({ ...prev, [channelId]: 100 }));

        const newChObj: MultiplexerChannelConfig = {
          channelId,
          num,
          name,
          type: type as any,
          source,
          category,
          logo: validationState.thumbnail || getArchiveThumb(source, "logo"),
          persistence: persistence as any,
          behavior,
          episodes: wheelEpisodes,
          totalLoopDurationInSeconds: totalDuration,
          isLiveMode: true
        };

        setMultiplexerChannels(prev => {
          if (isNew) {
            const filtered = prev.filter(c => c.num !== num);
            return [...filtered, newChObj].sort((a, b) => a.num - b.num);
          } else {
            return prev.map(c => c.channelId === channelId ? newChObj : c);
          }
        });

        toastService.show({
          type: "success",
          title: "📡 Guide Channel Injected",
          message: `CH ${num} ("${name}") successfully injected into Guide. Loaded ${episodes.length} episodes into 24-hour loop playout.`,
          duration: 5000
        });

      } else {
        const newChObj: MultiplexerChannelConfig = {
          channelId,
          num,
          name,
          type: type as any,
          source,
          category,
          logo: validationState.thumbnail || AJN_LOGO_URL,
          persistence: persistence as any,
          isLiveMode: true
        };

        setMultiplexerChannels(prev => {
          if (isNew) {
            const filtered = prev.filter(c => c.num !== num);
            return [...filtered, newChObj].sort((a, b) => a.num - b.num);
          } else {
            return prev.map(c => c.channelId === channelId ? newChObj : c);
          }
        });

        toastService.show({
          type: "success",
          title: "📡 Guide Channel Injected",
          message: `CH ${num} ("${name}") successfully injected into Guide.`,
          duration: 5000
        });
      }

      setEditingChannelId(null);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ajn-multiplexer-updated"));
      }, 300);

    } catch (err: any) {
      console.error(err);
      toastService.show({
        type: "error",
        title: "❌ Scraping Failed",
        message: err.message || "Failed to compile 24-hour schedule for virtual channel.",
        duration: 5000
      });
    } finally {
      setIsScraping(prev => ({ ...prev, [channelId]: false }));
      setScrapingProgress(prev => ({ ...prev, [channelId]: 0 }));
    }
  }, [validationState.thumbnail, setMultiplexerChannels]);

  // Register New Channel
  const registerChannel = useCallback(async (forceOverwrite: boolean = false) => {
    const existing = multiplexerChannels.find(c => c.num === regPosition && c.source && c.source.trim() !== "");
    
    if (existing && !forceOverwrite) {
      setConflictState({ active: true, existingChannel: existing });
      return;
    }

    const channelId = `mux-ch-custom-${Date.now()}`;
    const name = regName || `CH ${regPosition}: Custom Channel`;
    const type = regType;
    const source = regSource;
    const category = regCategory;
    const persistence = regPersistence;
    const behavior = regBehavior;

    // Reset inputs
    setRegName("");
    setRegSource("");
    setRegType("default");
    setRegCategory("News");
    setRegPersistence("force-live");
    setRegBehavior("binge");
    setValidationState({ status: "idle" });
    setConflictState(null);
    setShowRegModal(false);

    // Call saveMultiplexerChannel to execute scraping and schedule compilation asynchronously
    saveMultiplexerChannel(channelId, regPosition, name, type, source, category, persistence, behavior, true);
  }, [regName, regSource, regType, regCategory, regPosition, regPersistence, regBehavior, multiplexerChannels, saveMultiplexerChannel]);

  // Push existing down during conflict resolution
  const pushDownChannels = useCallback(() => {
    const channelId = `mux-ch-custom-${Date.now()}`;
    const name = regName || `CH ${regPosition}: Custom Channel`;
    const type = regType;
    const source = regSource;
    const category = regCategory;
    const persistence = regPersistence;
    const behavior = regBehavior;

    setMultiplexerChannels(prev => {
      const updated = prev.map(c => {
        if (c.num >= regPosition) {
          return { ...c, num: c.num + 1 };
        }
        return c;
      });
      return updated;
    });

    // Reset inputs
    setRegName("");
    setRegSource("");
    setRegType("default");
    setRegCategory("News");
    setRegPersistence("force-live");
    setRegBehavior("binge");
    setValidationState({ status: "idle" });
    setConflictState(null);
    setShowRegModal(false);

    saveMultiplexerChannel(channelId, regPosition, name, type, source, category, persistence, behavior, true);
  }, [regName, regSource, regType, regCategory, regPosition, regPersistence, regBehavior, saveMultiplexerChannel]);


  // Real-time polling clock (seconds) - updates every 60 seconds
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    let lastTick = Date.now();

    const handleForceSync = () => {
      const currentNow = Math.floor(Date.now() / 1000);
      setNowSec(currentNow);
      setViewWindow([currentNow - 86400 * 2, currentNow + 86400 * 4]);
    };

    window.addEventListener("ajn-rss-updated" as any, handleForceSync);

    // Visibility-based drift correction (e.g. if tab is suspended, sleeping, or kept open > 24h)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleForceSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const timer = setInterval(() => {
      const nowMs = Date.now();
      handleForceSync();
      lastTick = nowMs;
    }, 60000);

    return () => {
      clearInterval(timer);
      window.removeEventListener("ajn-rss-updated" as any, handleForceSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleRemoteRegister = (e: CustomEvent<{
      name: string;
      source: string;
      type: MultiplexerChannelConfig["type"];
      category: string;
      behavior?: "binge" | "shuffle" | "syndication";
    }>) => {
      const data = e.detail;
      if (data && data.source) {
        // Automatically find next available position starting from CH 12
        let targetNum = 12;
        while (multiplexerChannels.some(c => c.num === targetNum && c.source && c.source.trim() !== "")) {
          targetNum++;
        }
        
        setRegName(data.name || "");
        setRegSource(data.source);
        setRegType(data.type || "default");
        setRegCategory(data.category || "News");
        setRegPosition(targetNum);
        setRegBehavior(data.behavior || "binge");
        
        // Open the modal pre-filled!
        setShowRegModal(true);
        
        toastService.show({
          type: "info",
          title: "📡 TV Guide Importer Routed",
          message: `Loaded "${data.name}" details. Ready to register at CH ${targetNum}.`,
          duration: 4000
        });
      }
    };
    
    window.addEventListener("ajn-register-channel-trigger" as any, handleRemoteRegister);
    return () => {
      window.removeEventListener("ajn-register-channel-trigger" as any, handleRemoteRegister);
    };
  }, [multiplexerChannels]);

  // Scrolling & Pruning state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeftPx, setScrollLeftPx] = useState<number>(0);
  const [containerWidthPx, setContainerWidthPx] = useState<number>(1200);

  const handleLeftScroll = useCallback(() => {
    if (!leftScrollRef.current || !scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = leftScrollRef.current.scrollTop;
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerWidthPx(entries[0].contentRect.width || 1200);
      }
    });
    observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Toggle favorite channel
  const toggleFav = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      safeLocalStorage.setItem("ajn_guide_favs", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("ajn-favorites-updated"));
      return next;
    });
  }, []);

  // Compute channel schedule blocks within active window tethered to real system clock
  const channelBlocksMap = useMemo(() => {
    const map: Record<string, VirtualProgramBlock[]> = {};
    for (const ch of virtualChannels) {
      const backendSeg = (ch as any).currentSegment;
      if (backendSeg) {
        map[ch.id] = [{
          id: `${ch.id}-blk-${backendSeg.start}`,
          episode: {
            id: `${ch.id}-ep-${backendSeg.start}`,
            title: backendSeg.title,
            durationInSeconds: backendSeg.end - backendSeg.start,
            url: ch.url || "",
            thumbnail: ch.logo || AJN_LOGO_URL,
            plot: "Ready-to-render synchronized live segment compiled by the high-performance Backend Playout Ingestion Engine.",
            genre: ch.category || "Variety",
            rating: "TV-14"
          },
          startTimeSec: backendSeg.start,
          durationSec: backendSeg.end - backendSeg.start,
          seekPositionAtStart: Math.max(0, nowSec - backendSeg.start),
          isLiveNow: nowSec >= backendSeg.start && nowSec < backendSeg.end,
          bleedSec: Math.max(0, viewWindow[0] - backendSeg.start)
        }];
      } else {
        map[ch.id] = getChannelScheduleInWindow(ch, viewWindow, EPOCH_TIMESTAMP, masterStore);
      }
    }
    return map;
  }, [virtualChannels, viewWindow, masterStore, nowSec]);

  // Archive and playlist utility actions
  const archiveVideo = useCallback((url: string, title: string) => {
    if (!url) return;
    setClassicVideos(prev => {
      if (prev.some(v => v.url === url)) {
        return prev;
      }
      const newVideo = {
        id: `archive-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        url,
        savedAt: new Date().toLocaleString()
      };
      const next = [newVideo, ...prev];
      safeLocalStorage.setItem("ajn_classic_videos", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeArchivedVideo = useCallback((id: string) => {
    setClassicVideos(prev => {
      const next = prev.filter(v => v.id !== id);
      safeLocalStorage.setItem("ajn_classic_videos", JSON.stringify(next));
      return next;
    });
  }, []);

  const archiveToPlaylist = useCallback((ch: MultiplexerChannelConfig) => {
    const blocks = channelBlocksMap[ch.channelId] || [];
    const curBlock = blocks.find(b => nowSec >= b.startTimeSec && nowSec < b.startTimeSec + b.durationSec) || blocks[0];
    const titleToSave = curBlock?.episode?.title || `${ch.name} - Captured Video`;
    archiveVideo(ch.source, titleToSave);
    
    // Add custom transient flash notification
    const flash = document.createElement("div");
    flash.className = "fixed top-4 right-4 bg-purple-600 text-white font-mono font-black text-xs px-4 py-2 rounded-xl shadow-2xl z-50 animate-pulse border border-purple-400";
    flash.innerText = `SAVED TO CLASSIC VIDEOS: ${titleToSave.toUpperCase()}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 2500);
  }, [channelBlocksMap, nowSec, archiveVideo]);

  const handleDeleteChannel = useCallback((channelId: string) => {
    const isDefault = [
      "mux-ch-1", "mux-ch-2", "mux-ch-3", "mux-ch-4", "mux-ch-5",
      "mux-ch-6", "mux-ch-7", "mux-ch-8", "mux-ch-9", "mux-ch-10", "mux-ch-11", "mux-ch-12"
    ].includes(channelId);

    setMultiplexerChannels(prev => {
      let next: MultiplexerChannelConfig[] = [];
      if (isDefault) {
        // Reset the default slot to empty
        next = prev.map(c => {
          if (c.channelId === channelId) {
            return {
              ...c,
              name: `Empty Slot ${c.num}`,
              source: "",
              category: "Unconfigured",
              type: "default",
              logo: AJN_LOGO_URL
            };
          }
          return c;
        });
      } else {
        // Completely remove the custom channel
        next = prev.filter(c => c.channelId !== channelId);
      }
      
      // Persist and sync
      safeLocalStorage.setItem("ajn_multiplexer_feeds", JSON.stringify(next));
      window.dispatchEvent(new Event("ajn-multiplexer-updated"));
      return next;
    });
  }, []);

  // Automated background Deep Health checks for registered Rumble streams
  const checkAllRumbleChannelsHealth = useCallback(async () => {
    const rumbleChannels = multiplexerChannels.filter(c => c.type === "rumble" && c.source);
    if (rumbleChannels.length === 0) return;

    const provider = ChannelProviderFactory.getProvider("rumble") as RumbleChannelProvider;
    if (!provider || typeof provider.checkHealth !== "function") return;

    for (const ch of rumbleChannels) {
      try {
        const res = await provider.checkHealth(ch.source);
        const lastCheckedStr = new Date().toLocaleTimeString();
        
        setHealthStates(prev => ({
          ...prev,
          [ch.channelId]: {
            isLive: res.isLive,
            message: res.message,
            lastChecked: lastCheckedStr
          }
        }));

        if (!res.isLive) {
          // If a reset (Offline/VOD state) is detected
          if (ch.persistence === "force-live") {
            console.warn(`[Health Check] Rumble Channel ${ch.num} is Offline/VOD. Force-Live active: automatically refresh.`);
            if ((ch as any).isLiveMode === false) {
              setMultiplexerChannels(prev => prev.map(c => c.channelId === ch.channelId ? { ...c, isLiveMode: true } : c));
            }
          } else if (ch.persistence === "archive-if-ended") {
            // "If the live stream resets to a VOD, the system captures the title and saves it into your 'Classic Video' playlist menu"
            if ((ch as any).isLiveMode !== false) {
              const blocks = channelBlocksMap[ch.channelId] || [];
              const curBlock = blocks.find(b => nowSec >= b.startTimeSec && nowSec < b.startTimeSec + b.durationSec) || blocks[0];
              const titleToSave = curBlock?.episode?.title || `${ch.name} - Archived Broadcast`;
              
              archiveVideo(ch.source, titleToSave);
              
              setMultiplexerChannels(prev => prev.map(c => c.channelId === ch.channelId ? { ...c, isLiveMode: false } : c));
            }
          }
        } else {
          // If it is live!
          if ((ch as any).isLiveMode === false) {
            setMultiplexerChannels(prev => prev.map(c => c.channelId === ch.channelId ? { ...c, isLiveMode: true } : c));
          }
        }
      } catch (err) {
        console.error(`[Health Check] Failed health check on channel ${ch.name}:`, err);
      }
    }
  }, [multiplexerChannels, channelBlocksMap, nowSec, archiveVideo]);

  // Keep health check callback in a ref to decouple dependencies and preserve stability of the interval
  const checkAllRumbleChannelsHealthRef = useRef(checkAllRumbleChannelsHealth);
  useEffect(() => {
    checkAllRumbleChannelsHealthRef.current = checkAllRumbleChannelsHealth;
  }, [checkAllRumbleChannelsHealth]);

  // Start automated 5-minute polling interval
  useEffect(() => {
    checkAllRumbleChannelsHealthRef.current();

    const interval = setInterval(() => {
      checkAllRumbleChannelsHealthRef.current();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  // Dynamically assign category tags using our automated metadata scanner
  const channelTagsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    virtualChannels.forEach(ch => {
      const blocks = channelBlocksMap[ch.id] || [];
      const eps = blocks.map(b => b.episode);
      const muxConfig = multiplexerChannels.find(m => m.channelId === ch.id);
      
      map[ch.id] = getAutomatedCategoryTags({
        name: ch.name,
        category: ch.category,
        url: ch.url,
        source: muxConfig?.source,
        type: muxConfig?.type,
        episodes: eps
      });
    });
    return map;
  }, [virtualChannels, channelBlocksMap, multiplexerChannels]);

  // Retrieve custom channel tags map from BroadcastScheduleManager
  const channelCustomTagsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!scheduleManager) return map;
    virtualChannels.forEach(ch => {
      map[ch.id] = scheduleManager.getChannelTags(ch.channelId || ch.id);
    });
    return map;
  }, [virtualChannels, scheduleManager, customTagsRevision]);

  // Dynamically generate category tabs by scanning all active channels and auto-detected tags
  const dynamicCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    
    virtualChannels.forEach(ch => {
      // Add primary category
      if (ch.category && ch.category.trim() && ch.category !== "Unconfigured" && ch.category !== "Unconfigured Slot") {
        categoriesSet.add(ch.category);
      }
      // Add automated tags
      const tags = channelTagsMap[ch.id] || [];
      tags.forEach(t => {
        if (t && t.trim() && t !== "Variety") {
          categoriesSet.add(t);
        }
      });
      // Add custom tags
      const customTags = channelCustomTagsMap[ch.id] || [];
      customTags.forEach(t => {
        if (t && t.trim()) {
          categoriesSet.add(t);
        }
      });
    });

    // Convert to list, sort alphabetically
    const sorted = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
    
    // Build category list: "all" first, "favorites" second, then dynamic ones
    const list = [
      { id: "all", label: "All Hub" },
      { id: "favorites", label: "★ Favs" }
    ];

    sorted.forEach(cat => {
      const lower = cat.toLowerCase();
      const emoji = EM_MAP[lower] || "📺";
      list.push({
        id: cat,
        label: `${emoji} ${cat}`
      });
    });

    return list;
  }, [virtualChannels, channelTagsMap, channelCustomTagsMap]);

  // Deferred search query for aggressive concurrent UI memoization
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filter channels based on category & search
  const filteredChannels = useMemo(() => {
    return virtualChannels.filter(ch => {
      // 1. Jump Date Filter
      if (jumpDate && (ch as any).dateKey) {
        if ((ch as any).dateKey !== jumpDate) return false;
      }
      
      // 2. Hide Empty Archive Days Filter
      if (hideEmptyArchiveDays && (ch as any).dateKey) {
        const hasRealEpisodes = rssEpisodes.some(ep => ep.dateKey === (ch as any).dateKey);
        if (!hasRealEpisodes) return false;
      }

      if (selectedCategory === "favorites" && !favorites.includes(ch.id)) return false;
      if (selectedCategory !== "all" && selectedCategory !== "favorites") {
        const autoTags = channelTagsMap[ch.id] || [];
        const customTags = channelCustomTagsMap[ch.id] || [];
        const matchesPrimary = ch.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesAutoTags = autoTags.some(t => {
          const tLower = t.toLowerCase();
          const selLower = selectedCategory.toLowerCase();
          return tLower === selLower || 
                 (selLower === "documentary" && tLower === "documentaries") ||
                 (selLower === "documentaries" && tLower === "documentary");
        });
        const matchesCustomTags = customTags.some(t => t.toLowerCase() === selectedCategory.toLowerCase());
        
        if (!matchesPrimary && !matchesAutoTags && !matchesCustomTags) return false;
      }
      if (deferredSearchQuery.trim()) {
        const q = deferredSearchQuery.toLowerCase();
        const autoTags = channelTagsMap[ch.id] || [];
        const customTags = channelCustomTagsMap[ch.id] || [];
        const chMatch = ch.name.toLowerCase().includes(q) || 
                        ch.category.toLowerCase().includes(q) ||
                        autoTags.some(t => t.toLowerCase().includes(q)) ||
                        customTags.some(t => t.toLowerCase().includes(q));
        const blocks = channelBlocksMap[ch.id] || [];
        const progMatch = blocks.some(b => b.episode.title.toLowerCase().includes(q) || b.episode.genre.toLowerCase().includes(q));
        if (!chMatch && !progMatch) return false;
      }
      return true;
    });
  }, [virtualChannels, selectedCategory, favorites, deferredSearchQuery, channelBlocksMap, channelTagsMap, channelCustomTagsMap, hideEmptyArchiveDays, jumpDate, rssEpisodes]);

  // Set initial default selected program
  useEffect(() => {
    if (!selectedProgram && filteredChannels.length > 0) {
      const firstCh = filteredChannels[0];
      const blocks = channelBlocksMap[firstCh.id] || [];
      const cur = blocks.find(b => nowSec >= b.startTimeSec && nowSec < b.startTimeSec + b.durationSec) || blocks[0];
      if (cur) {
        setSelectedProgram({ block: cur, channel: firstCh });
      }
    }
  }, [filteredChannels, channelBlocksMap, nowSec, selectedProgram]);

  // Horizontal infinite lazy loading expansion
  const handleScroll = useCallback(() => {
    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      // Batch DOM Reads inside rAF
      const { scrollLeft, scrollTop, clientWidth, scrollWidth } = scrollContainerRef.current;
      
      // State Updates
      setScrollLeftPx(scrollLeft);
      if (leftScrollRef.current) {
        leftScrollRef.current.scrollTop = scrollTop;
      }
      
      // If user scrolls within 800px of right edge, expand endTime by 4 hours
      if (scrollWidth > 0 && scrollLeft + clientWidth >= scrollWidth - 800) {
        setViewWindow(prev => [prev[0], prev[1] + 14400]);
      }
    });
  }, []);

  // Format timestamp in seconds to readable clock (e.g. "12:30 PM")
  const formatTimeSec = useCallback((timestampSec: number) => {
    const d = new Date(timestampSec * 1000);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m < 10 ? "0" : ""}${m} ${ampm}`;
  }, []);

  // Calculate timeline dimensions
  const winStart = viewWindow[0];
  const winEnd = viewWindow[1];
  const totalTimelineWidthPx = Math.floor(((winEnd - winStart) / 60) * pxPerMin);
  const nowLeftPx = ((nowSec - winStart) / 60) * pxPerMin;

  // Auto scroll to current time line on mount or reset
  const scrollToNow = useCallback(() => {
    if (scrollContainerRef.current) {
      const targetPx = Math.max(0, ((Math.floor(Date.now() / 1000) - winStart) / 60) * pxPerMin - 180);
      scrollContainerRef.current.scrollLeft = targetPx;
    }
  }, [winStart, pxPerMin]);

  useEffect(() => {
    scrollToNow();
  }, [pxPerMin]); // scroll when zoom changes

  // Generate 30-minute time header marker columns
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const firstMarkerSec = Math.floor(winStart / 1800) * 1800;
    let cur = firstMarkerSec;
    while (cur < winEnd) {
      markers.push(cur);
      cur += 1800;
    }
    return markers;
  }, [winStart, winEnd]);

  // Mid-Stream Playout Trigger action
  const triggerPlayout = useCallback((block: VirtualProgramBlock, channel: VirtualChannel, trace?: any) => {
    setSelectedProgram({ block, channel });
    const currentS = Math.floor(Date.now() / 1000);
    const isLive = currentS >= block.startTimeSec && currentS < block.startTimeSec + block.durationSec;
    const calculatedSeekPos = isLive ? Math.max(0, currentS - block.startTimeSec) : 0;

    // Sync calculated seek position into safeLocalStorage for auto-seek bridge
    try {
      const isChannelOne = channel.num === 1;
      const keyPrefix = isChannelOne ? "ajn_playback_ch1_" : `ajn_playback_ch${channel.num || "other"}_`;

      const savedJSON = safeLocalStorage.getItem("ajn_video_positions");
      const saved = savedJSON ? JSON.parse(savedJSON) : {};
      saved[`${channel.id}-${block.episode.url}`] = calculatedSeekPos;
      saved[block.episode.url] = calculatedSeekPos;
      safeLocalStorage.setItem("ajn_video_positions", JSON.stringify(saved));

      // Zero cross-contamination: Separate isolated state tracking from channel 1
      safeLocalStorage.setItem(`${keyPrefix}last_url`, block.episode.url);
      safeLocalStorage.setItem(`${keyPrefix}last_title`, block.episode.title);
      safeLocalStorage.setItem(`${keyPrefix}seek_pos`, String(calculatedSeekPos));
      safeLocalStorage.setItem(`${keyPrefix}timestamp`, String(Math.floor(Date.now() / 1000)));

      safeLocalStorage.setItem("ajn_last_channel_id", channel.id);
    } catch (err) {
      console.error("[VirtualChannelEngine] Failed to store seek position:", err);
    }

    onSelectStream({
      url: block.episode.url,
      title: `${channel.name} · ${block.episode.title || channel.name}`,
      seekPosition: calculatedSeekPos,
      isLiveNow: isLive,
      channelId: channel.id,
      showTitle: block.episode.title || channel.name,
      trace
    });
  }, [onSelectStream]);

  // Seamless Stitching: listen for video ended and play the next block in the current channel's schedule
  useEffect(() => {
    const handleStreamEnded = (e: any) => {
      if (!selectedProgram) return;
      const { channel, block } = selectedProgram;
      const blocks = channelBlocksMap[channel.id] || [];
      const currentIndex = blocks.findIndex(b => b.id === block.id);
      if (currentIndex !== -1 && currentIndex + 1 < blocks.length) {
        if (e && e.detail) {
          e.detail.handled = true;
        }
        const nextBlock = blocks[currentIndex + 1];
        console.log(`[BroadcastTVGuide] Stream ended. Auto-advancing to next segment: ${nextBlock.episode.title}`);
        triggerPlayout(nextBlock, channel);
      } else {
        console.warn("[BroadcastTVGuide] No next segment found for continuous playout.");
      }
    };
    window.addEventListener("ajn_stream_ended", handleStreamEnded as EventListener);
    return () => window.removeEventListener("ajn_stream_ended", handleStreamEnded as EventListener);
  }, [selectedProgram, channelBlocksMap, triggerPlayout]);

  const isLight = theme === "light";

  // Header date formatting logic
  const headerDate = new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  // Viewport DOM Pruning bounds (Buffer: 1 hour left, 4 hours right)
  const visibleStartSec = winStart + (scrollLeftPx / pxPerMin) * 60;
  const visibleEndSec = winStart + ((scrollLeftPx + containerWidthPx) / pxPerMin) * 60;
  const pruneStartSec = visibleStartSec - 3600;
  const pruneEndSec = visibleEndSec + 14400;

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden rounded-[32px] border select-none ${
      isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-[#080C14] border-slate-800 text-slate-200"
    }`}>
      {/* CSS STYLES FOR THE RADAR AND ROTATION ANIMATIONS */}
      <style>{`
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes radar-pulse {
          0% { transform: scale(0.92); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.55; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @keyframes spin-vinyl {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes blink-fast {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .animate-radar-sweep {
          animation: radar-sweep 6s linear infinite;
        }
        .animate-radar-pulse {
          animation: radar-pulse 4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        .animate-spin-vinyl {
          animation: spin-vinyl 15s linear infinite;
        }
        .animate-scanline {
          animation: scanline 8s linear infinite;
        }
        .animate-blink-fast {
          animation: blink-fast 1s ease-in-out infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* COMPACT TV GUIDE CONTROLS HEADER */}
      <div className={`p-4 border-b flex flex-col gap-4 shrink-0 relative overflow-hidden ${
        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#0A0F1D] border-slate-800/80 text-slate-200"
      }`}>
        {/* Category Filters */}
        <div 
          className="w-full relative z-10"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)"
          }}
        >
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap py-1 px-4">
            {dynamicCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  selectedCategory === cat.id
                    ? "bg-[#00ff66] text-black shadow-md shadow-[#00ff66]/20 font-black"
                    : isLight ? "bg-slate-200/80 text-slate-600 hover:bg-slate-300" : "bg-slate-900/90 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800/60"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Zoom, Jump to Date & Settings */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 bg-slate-900/10 p-2.5 rounded-2xl border border-slate-800/30">
          
          {/* Tactical Command Drawer Button */}
          <button
            onClick={() => {
              setHideTacticalCommand(prev => {
                const newVal = !prev;
                try {
                  safeLocalStorage.setItem("ajn_hide_tactical_command", String(newVal));
                } catch {}
                return newVal;
              });
            }}
            className={`px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              !hideTacticalCommand 
                ? "bg-[#00ff66] border-[#00ff66]/30 text-black font-black shadow-md shadow-[#00ff66]/20" 
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
            }`}
            title="Toggle Tactical Stream Command Drawer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TACTICAL COMMAND</span>
          </button>

          {/* Search Box - Anchored */}
          <div className={`flex items-center border rounded-xl px-3 py-1.5 gap-2 w-full sm:w-64 lg:w-48 xl:w-64 shrink-0 ${
            isLight ? "bg-slate-50 border-slate-300" : "bg-[#060911] border-slate-800"
          }`}>
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search active EPG..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs w-full focus:outline-none placeholder:text-slate-600 font-sans text-white"
            />
          </div>

          {/* Secondary Utilities - Grouped */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Jump to Date Picker */}
            <div className="flex items-center gap-2 bg-[#060911] border border-slate-800 rounded-xl px-2 py-1">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider hidden md:inline">Jump:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={jumpDate}
                  onChange={e => {
                    const val = e.target.value;
                    setJumpDate(val);
                    if (val) {
                      // Auto-expand the month for this date
                      const mLabel = getMonthName(val);
                      setExpandedMonths(prev => ({ ...prev, [mLabel]: true }));
                    }
                  }}
                  className="bg-transparent text-slate-300 text-xs focus:outline-none font-mono"
                />
                {jumpDate && (
                  <button
                    onClick={() => setJumpDate("")}
                    className="px-2 py-1 text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                    title="Clear Date Filter"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {/* Hide Empty Days Toggle */}
            <button
              onClick={() => setHideEmptyArchiveDays(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold flex items-center gap-2 transition-all cursor-pointer ${
                hideEmptyArchiveDays
                  ? "bg-[#00ff66]/10 border-[#00ff66]/30 text-[#00ff66]"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Filter out archive dates that have no parsed broadcasts from the feed"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${hideEmptyArchiveDays ? "bg-[#00ff66]" : "bg-slate-600"}`} />
              <span className="hidden md:inline">Hide Empty Archive: {hideEmptyArchiveDays ? "ON" : "OFF"}</span>
              <span className="md:hidden">Hide Empty</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-[#060911] p-0.5 shrink-0">
              <button
                onClick={() => setPxPerMin(prev => Math.max(2, prev - 1))}
                title="Zoom Out (Squeeze Timeline)"
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold px-1.5 text-slate-500">{pxPerMin}x</span>
              <button
                onClick={() => setPxPerMin(prev => Math.min(8, prev + 1))}
                title="Zoom In (Expand Timeline)"
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={scrollToNow}
              className="px-3 py-1.5 rounded-xl border bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30 hover:bg-[#00ff66] hover:text-black font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">NOW</span>
            </button>
            
            <button
              onClick={() => setShowMuxBoard(p => !p)}
              className={`px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                showMuxBoard 
                  ? "bg-blue-600 border-blue-400 text-white shadow-lg" 
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">FEEDS</span>
            </button>

            <button
              onClick={() => setViewMode(prev => prev === "timeline" ? "calendar" : "timeline")}
              className={`px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                viewMode === "calendar"
                  ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">CALENDAR</span>
            </button>
            <button
              onClick={() => setShowClassicPlaylist(p => !p)}
              className={`px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                showClassicPlaylist 
                  ? "bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/20" 
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Film className="w-3.5 h-3.5 text-purple-400" />
              <span>CLASSIC VIDEOS ({classicVideos.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE MULTIPLEXER BOARD */}
      {showMuxBoard && (
        <div className={`p-5 border-b space-y-4 shrink-0 overflow-y-auto max-h-[350px] no-scrollbar ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-[#0A0F1D] border-slate-800"
        }`}>
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between border-b border-slate-800/80 pb-4 gap-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400 font-mono shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase text-white font-mono">Isolated Multi-Feed Multiplexer Control Panel</h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Configure isolated virtual channels. Export/import custom lineups or register a new validated channel.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Add Custom Validated Channel */}
              <button
                onClick={() => {
                  setRegPosition(Math.max(12, multiplexerChannels.length + 1));
                  setShowRegModal(true);
                }}
                className="flex items-center gap-1.5 text-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold font-mono px-3 py-1.5 rounded-xl border border-blue-400/30 shadow-md transition-all cursor-pointer"
                title="Register a validated stream/VOD source at any channel position"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ REGISTER CHANNEL</span>
              </button>

              {/* JSON Export */}
              <button
                onClick={exportRegistry}
                className="flex items-center gap-1.5 text-[10px] bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold font-mono px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                title="Export entire channel lineup as JSON"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>EXPORT LINEUP</span>
              </button>

              {/* JSON Import */}
              <label className="flex items-center gap-1.5 text-[10px] bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold font-mono px-3 py-1.5 rounded-xl transition-all cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>IMPORT LINEUP</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importRegistry}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-1.5 text-[9px] text-amber-400 font-mono bg-amber-400/5 px-2.5 py-1 rounded-xl border border-amber-400/20 shrink-0 font-bold">
                <HelpCircle className="w-3 h-3 text-amber-400" />
                <span>Stitching Active</span>
              </div>
            </div>
          </div>

          {/* Custom Category & Tag Management Engine */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 w-full mb-2">
            <span className="text-[10px] font-mono font-black uppercase text-blue-400 shrink-0">Custom Tag Engine:</span>
            <div className="flex flex-wrap gap-1 items-center flex-1">
              {(scheduleManager?.getAllCustomTags() || []).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-xl bg-blue-950/50 border border-blue-850 text-[10px] text-blue-300 font-mono flex items-center gap-1.5 shadow-sm">
                  {tag}
                  <button
                    onClick={async () => {
                      if (confirm(`Delete the custom tag "${tag}"? This will remove it from all assigned channels.`)) {
                        await scheduleManager?.deleteCustomTag(tag);
                        setCustomTagsRevision(prev => prev + 1);
                      }
                    }}
                    className="hover:text-red-400 font-bold text-xs cursor-pointer px-0.5"
                    title="Delete custom tag"
                  >
                    ×
                  </button>
                </span>
              ))}
              
              <button
                onClick={() => {
                  const tag = prompt("Enter a new custom tag name:");
                  if (tag && tag.trim()) {
                    scheduleManager?.createCustomTag(tag.trim()).then(() => {
                      setCustomTagsRevision(prev => prev + 1);
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-950/40 hover:bg-[#00ff66] hover:text-black border border-slate-800 hover:border-slate-700 text-[9px] font-mono text-slate-300 transition-all cursor-pointer flex items-center gap-1 font-bold"
              >
                <Plus className="w-3 h-3" />
                <span>Create Custom Tag</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {multiplexerChannels.map(ch => {
              const isEditing = editingChannelId === ch.channelId;
              const isIAPending = loadingMux[ch.channelId];
              const fileCount = muxFiles[ch.channelId]?.length || ((import.meta as any).env.DEV ? (ch.channelId === "mux-ch-1" ? DEFAULT_CH1_FILES.length : ch.channelId === "mux-ch-3" ? DEFAULT_CH3_FILES.length : ch.channelId === "mux-ch-7" ? DEFAULT_CH7_FILES.length : ch.channelId === "mux-ch-8" ? DEFAULT_CH8_FILES.length : ch.channelId === "mux-ch-11" ? DEFAULT_CH11_FILES.length : 1) : 1);

              if (!ch.source || ch.source.trim() === "") {
                return (
                  <div key={ch.channelId} className="border border-dashed border-slate-700 rounded-2xl p-4 flex flex-col justify-between h-[155px] bg-[#0A0F1D]/40 hover:bg-[#0C1222]/80 hover:border-slate-600 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">
                        CH {ch.num}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600 font-bold uppercase tracking-wider">Empty Slot</span>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-[10px] text-slate-500 font-sans leading-relaxed">No streaming or VOD source coupled to this position</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setRegPosition(ch.num);
                        setRegCategory("News");
                        setRegName("");
                        setRegSource("");
                        setValidationState({ status: "idle" });
                        setShowRegModal(true);
                      }}
                      className="text-[9px] font-mono font-bold bg-blue-600/15 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20 hover:border-blue-500 py-1.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                    >
                      + Add New Channel
                    </button>
                  </div>
                );
              }

              return (
                <div key={ch.channelId} className={`p-4 rounded-2xl border transition-all ${
                  isEditing 
                    ? "bg-[#121A2E] border-blue-500 shadow-md shadow-blue-500/10" 
                    : isLight ? "bg-white border-slate-200" : "bg-[#0C1222] border-slate-800 hover:border-slate-700"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      CH {ch.num}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 capitalize">{ch.type.replace("_", " ")}</span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Feed Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-black border border-slate-800 text-xs font-mono text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Feed Type</label>
                        <select
                          value={editType}
                          onChange={e => setEditType(e.target.value as any)}
                          className="w-full px-2 py-1.5 rounded bg-black border border-slate-800 text-xs font-mono text-white outline-none focus:border-blue-500"
                        >
                          <option value="ia_collection">Internet Archive</option>
                          <option value="rumble">Rumble Embed</option>
                          <option value="youtube">YouTube Embed</option>
                          <option value="default">Direct Stream / Fallback</option>
                          <option value="rss">RSS Feed / Syndication</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Source / Identifier</label>
                        <input
                          type="text"
                          value={editSource}
                          onChange={e => setEditSource(e.target.value)}
                          placeholder={editType === "ia_collection" ? "e.g., infowars-nightly-news-sd" : "e.g., rumble embed link..."}
                          className="w-full px-2 py-1.5 rounded bg-black border border-slate-800 text-[10px] font-mono text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Category</label>
                        <input
                          type="text"
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-black border border-slate-800 text-xs font-mono text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      {editType === "rumble" && (
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Reset Persistence Policy</label>
                          <select
                            value={editPersistence}
                            onChange={e => setEditPersistence(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-black border border-slate-800 text-xs font-mono text-white outline-none focus:border-blue-500"
                          >
                            <option value="force-live">Force Live (Refresh live stream index)</option>
                            <option value="archive-if-ended">Archive If Ended (Auto-archive ended streams to Playlist)</option>
                          </select>
                        </div>
                      )}

                      {editType === "ia_collection" && (
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">EPG Playout Behavior</label>
                          <select
                            value={editBehavior}
                            onChange={e => setEditBehavior(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-black border border-slate-800 text-xs font-mono text-white outline-none focus:border-blue-500"
                          >
                            <option value="binge">Binge Mode (Sequential Loops)</option>
                            <option value="shuffle">Shuffle Mode (Randomized Loops)</option>
                          </select>
                        </div>
                      )}

                      {isScraping[ch.channelId] ? (
                        <div className="space-y-1.5 py-1">
                          <div className="flex items-center justify-between text-[8px] font-mono">
                            <span className="text-blue-400 font-bold animate-pulse">SCRAPING ARCHIVE...</span>
                            <span className="text-blue-400 font-bold">{scrapingProgress[ch.channelId]}%</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div 
                              className="bg-blue-500 h-full transition-all duration-300 shadow-md shadow-blue-500/50" 
                              style={{ width: `${scrapingProgress[ch.channelId]}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              saveMultiplexerChannel(
                                ch.channelId,
                                ch.num,
                                editName,
                                editType,
                                editSource,
                                editCategory,
                                editPersistence,
                                editBehavior
                              );
                            }}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded font-mono uppercase transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingChannelId(null)}
                            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[10px] rounded font-mono uppercase transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white font-sans line-clamp-1">{cleanTitle(ch.name)}</h4>
                      
                      {/* Channel Custom Tags */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {(scheduleManager?.getChannelTags(ch.channelId) || []).map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/80 text-[8px] text-blue-300 font-mono flex items-center gap-1">
                            {t}
                            <button
                              onClick={async () => {
                                await scheduleManager?.unassignTagFromChannel(ch.channelId, t);
                                setCustomTagsRevision(prev => prev + 1);
                              }}
                              className="hover:text-red-400 font-black cursor-pointer text-[10px] leading-none"
                              title="Remove Tag"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => {
                            const newTag = prompt(`Enter custom tag to assign to ${ch.name}:`);
                            if (newTag && newTag.trim()) {
                              scheduleManager?.assignTagToChannel(ch.channelId, newTag.trim()).then(() => {
                                setCustomTagsRevision(prev => prev + 1);
                              });
                            }
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-[8px] text-slate-400 hover:text-white font-mono flex items-center gap-0.5 transition-all cursor-pointer font-bold"
                          title="Assign tag"
                        >
                          + Tag
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 font-mono truncate" title={ch.source}>
                        Source: <span className="text-[#00ff66]">{ch.source || "Default demo feed"}</span>
                      </p>

                      {ch.type === "rumble" && (
                        <div className="text-[9px] font-mono flex items-center justify-between text-slate-500 bg-slate-950/20 px-1.5 py-0.5 rounded border border-slate-800/40">
                          <span>Reset Policy: <strong className="text-purple-400 font-bold">{ch.persistence === "archive-if-ended" ? "Archive" : "Force Live"}</strong></span>
                          {healthStates[ch.channelId] && (
                            <span className={healthStates[ch.channelId].isLive ? "text-emerald-400" : "text-amber-400"}>
                              {healthStates[ch.channelId].isLive ? "● Live" : "● Offline/VOD"}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                        <span>Items: <strong className="text-white">{fileCount}</strong></span>
                        <span className="text-slate-400 uppercase font-bold text-[9px]">{ch.category}</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setEditingChannelId(ch.channelId);
                            setEditName(ch.name);
                            setEditSource(ch.source);
                            setEditType(ch.type);
                            setEditCategory(ch.category);
                            setEditPersistence(ch.persistence || "force-live");
                            setEditBehavior(ch.behavior || "binge");
                          }}
                          className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded font-mono uppercase transition-colors"
                        >
                          Configure
                        </button>

                        {ch.source && ch.source.trim() !== "" && (
                          <button
                            onClick={() => archiveToPlaylist(ch)}
                            className="px-2.5 py-1 bg-purple-600/25 hover:bg-purple-600 text-purple-400 hover:text-white font-bold text-[10px] rounded font-mono uppercase transition-all cursor-pointer"
                            title="Capture current segment/VOD and save to Classic Videos captured playlist"
                          >
                            Archive
                          </button>
                        )}

                        {ch.type === "ia_collection" && (
                          <button
                            onClick={() => refreshMuxChannel(ch.channelId)}
                            disabled={isIAPending}
                            className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-bold text-[10px] rounded font-mono uppercase transition-all disabled:opacity-40"
                            title="Ingest and sync latest directory files"
                          >
                            <RefreshCw className={`w-3 h-3 ${isIAPending ? "animate-spin" : ""}`} />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete/clear CH ${ch.num} ("${ch.name}")?`)) {
                              handleDeleteChannel(ch.channelId);
                            }
                          }}
                          className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold text-[10px] rounded font-mono uppercase transition-all cursor-pointer"
                          title="Delete or clear this channel feed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-blue-950/20 rounded-2xl border border-blue-900/30 flex items-start gap-3 text-[11px] text-blue-300">
            <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Predictive Path Resolution & Timeline Stitching:</strong> When ingesting Internet Archive items,
              the resolver automatically maps raw download subpaths (such as <code className="bg-black/40 px-1 py-0.5 rounded text-amber-400">/download/collection-id/filename_thumb.jpg</code>) and maps file series chronologically based on their date tags.
              This guarantees persistent high-fidelity program scheduling in the EPG grid below.
            </div>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE CLASSIC VIDEOS PLAYLIST BOARD */}
      {showClassicPlaylist && (
        <div className={`p-5 border-b space-y-4 shrink-0 overflow-y-auto max-h-[350px] no-scrollbar ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-[#090C15] border-slate-800"
        }`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-purple-400 font-mono shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase text-white font-mono">Classic Videos Captured Playlist</h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Archived VOD segments captured automatically during live-to-VOD transitions or manually stored by you.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear your saved Classic Videos?")) {
                  setClassicVideos([]);
                  safeLocalStorage.removeItem("ajn_classic_videos");
                }
              }}
              className="text-[9px] font-mono font-bold bg-[#1d1020] hover:bg-[#341838] text-red-400 hover:text-white border border-red-500/20 px-3 py-1.5 rounded-xl transition-all uppercase"
            >
              Clear Playlist
            </button>
          </div>

          {classicVideos.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-850 rounded-2xl bg-black/10">
              <p className="text-xs text-slate-500 font-sans">No saved classic videos in your playlist archive.</p>
              <p className="text-[10px] text-slate-600 font-mono mt-1 uppercase">Click "ARCHIVE" on any active channel card or wait for a live stream reset to capture videos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {classicVideos.map(video => (
                <div key={video.id} className="p-4 rounded-2xl border border-slate-850 bg-slate-900/40 hover:bg-[#0E1526]/80 hover:border-purple-500/40 transition-all flex flex-col justify-between h-[130px]">
                  <div>
                    <h4 className="text-xs font-bold text-white font-sans line-clamp-2 leading-snug">{video.title}</h4>
                    <span className="text-[8px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded mt-1 inline-block uppercase font-bold">
                      Saved: {video.savedAt}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-850 mt-2">
                    <button
                      onClick={() => {
                        let defaultName = video.title || "Custom Classic Feed";
                        let defaultCategory = "Archive";
                        
                        if (defaultName.toLowerCase().includes("western") || defaultName.toLowerCase().includes("news")) {
                          defaultName = "Western Nightly News";
                          defaultCategory = "News";
                        } else if (defaultName.toLowerCase().includes("movie") || defaultName.toLowerCase().includes("film")) {
                          defaultCategory = "Movies";
                        }

                        const userTitle = window.prompt("Generated Title for new Channel (Override if needed):", `${defaultName} [${new Date().toLocaleDateString()}]`);
                        if (!userTitle) return;

                        const userCategory = window.prompt("Generated Theme/Category (Override if needed):", defaultCategory);
                        if (!userCategory) return;

                        // Find next number
                        const maxNum = multiplexerChannels.reduce((max, ch) => Math.max(max, ch.num || 0), 100);
                        const nextNum = maxNum + 1;
                        
                        const newChannel: MultiplexerChannelConfig = {
                          channelId: `mux-ch-classic-${Date.now()}`,
                          num: nextNum,
                          name: userTitle,
                          category: userCategory,
                          logo: AJN_LOGO_URL,
                          type: video.url.includes(".m3u") ? "custom_m3u" : video.url.includes(".m3u8") ? "hls" : "default",
                          source: video.url,
                          persistence: "force-live",
                          isLiveMode: true,
                          behavior: "binge"
                        };

                        setMultiplexerChannels(prev => [...prev, newChannel]);
                        const updated = classicVideos.filter(v => v.id !== video.id);
                        setClassicVideos(updated);
                        
                        alert(`Successfully mapped to Channel ${nextNum}: ${userTitle}`);
                      }}
                      className="flex-1 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded font-mono uppercase transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5 text-white" />
                      <span>Load Channel</span>
                    </button>
                    <button
                      onClick={() => removeArchivedVideo(video.id)}
                      className="px-2 py-1 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 font-bold text-[10px] rounded font-mono uppercase transition-colors cursor-pointer"
                      title="Remove from playlist"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      
      {/* VIRTUALIZED EPG GRID WORKSPACE REPLACED BY TVGuideLayout */}
      <div className="flex-1 min-h-0 h-full relative z-10 w-full overflow-hidden flex flex-col">
        <TVGuideLayout 
          channels={filteredChannels}
          triggerPlayout={triggerPlayout}
          masterStore={masterStore}
          channelBlocksMap={channelBlocksMap}
          nowSec={nowSec}
          onPlayShow={(show) => {
            if (stopPreludeMusic) stopPreludeMusic();
            onSelectStream({
              url: show.videoUrl,
              title: show.title,
              seekPosition: 0,
              isLiveNow: false
            });
          }}
        />
      </div>



      {/* FLOATING REGISTRATION MODAL */}
      <AnimatePresence>
      {showRegModal && (
        <motion.div key="showRegModal-anim-1" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[999] p-4"
          onClick={() => setShowRegModal(false)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="bg-[#0C1222] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col font-mono max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800/80 bg-[#090E19] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase text-white tracking-wider">
                  Tactical Registration Workspace
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowRegModal(false);
                  setConflictState(null);
                  setValidationState({ status: "idle" });
                }}
                className="text-slate-500 hover:text-white transition-colors font-bold text-xs"
              >
                [CLOSE]
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar text-xs">
              
              {/* Conflict State Panel */}
              {conflictState?.active ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                  <h4 className="text-amber-400 font-bold flex items-center gap-2 uppercase tracking-wide">
                    ⚠️ Channel Conflict Resolution Required
                  </h4>
                  <p className="text-slate-300 font-sans leading-relaxed text-[11px]">
                    Channel position <strong className="text-amber-400">CH {regPosition}</strong> is already allocated to: 
                    <span className="block mt-1 font-mono text-white bg-black/40 px-2 py-1 rounded">
                      "{conflictState.existingChannel.name}"
                    </span>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() => registerChannel(true)}
                      className="flex-1 py-2 bg-rose-600 hover:bg-red-500 text-white font-black rounded-xl transition-colors uppercase"
                    >
                      Overwrite Existing Feed
                    </button>
                    <button
                      type="button"
                      onClick={pushDownChannels}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-colors uppercase"
                    >
                      Push Down (Insert & Shift)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflictState(null)}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl transition-colors uppercase"
                    >
                      Change Position
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Grid Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-black block mb-1">Channel Position (CH #)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={regPosition}
                        onChange={e => setRegPosition(parseInt(e.target.value) || 12)}
                        className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs font-mono"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-black block mb-1">Channel Category</label>
                      <input
                        type="text"
                        value={regCategory}
                        onChange={e => setRegCategory(e.target.value)}
                        placeholder="e.g., News, Geopolitics"
                        className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-black block mb-1">Channel Name</label>
                    <input
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="e.g., Global Liberty Broadcast"
                      className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] text-slate-400 uppercase font-black block mb-1">Feed Type</label>
                      <select
                        value={regType}
                        onChange={e => setRegType(e.target.value as any)}
                        className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs"
                      >
                        <option value="default">Direct / HLS</option>
                        <option value="youtube">YouTube</option>
                        <option value="rumble">Rumble</option>
                        <option value="ia_collection">Archive.org</option>
                        <option value="rss">RSS Feed / Syndication</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400 uppercase font-black block mb-1">
                        {regType === "ia_collection" ? "Archive ID" : "Source Link / Embed URL"}
                      </label>
                      <input
                        type="text"
                        value={regSource}
                        onChange={e => {
                          setRegSource(e.target.value);
                          if (validationState.status === "valid") {
                            setValidationState({ status: "idle" });
                          }
                        }}
                        placeholder={
                          regType === "ia_collection" 
                            ? "e.g., infowars-nightly-news-sd" 
                            : "e.g., streaming URL or embed link"
                        }
                        className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {regType === "ia_collection" && (
                    <div className="p-3.5 bg-blue-950/20 border border-blue-500/20 rounded-2xl space-y-2">
                      <label className="text-[10px] text-blue-400 uppercase font-black block mb-1">
                        EPG Playout Behavior
                      </label>
                      <select
                        value={regBehavior}
                        onChange={e => setRegBehavior(e.target.value as any)}
                        className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs"
                      >
                        <option value="binge">Binge Mode (Sequential Loops)</option>
                        <option value="shuffle">Shuffle Mode (Randomized Loops)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 font-sans leading-snug">
                        Sequential plays episodes in chronological order, while Shuffle randomizes the playout sequence for each 24-hour cycle.
                      </p>
                    </div>
                  )}

                  {regType === "rumble" && (
                    <div className="p-3.5 bg-purple-950/20 border border-purple-500/20 rounded-2xl space-y-2">
                      <label className="text-[10px] text-purple-400 uppercase font-black block mb-1">
                        Reset Persistence Policy
                      </label>
                      <select
                        value={regPersistence}
                        onChange={e => setRegPersistence(e.target.value as any)}
                        className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500 text-xs"
                      >
                        <option value="force-live">Force Live (Refresh live stream index)</option>
                        <option value="archive-if-ended">Archive If Ended (Auto-archive ended streams to Playlist)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 font-sans leading-snug">
                        Decides how the stream manages live-to-VOD transitions on stream restart.
                      </p>
                    </div>
                  )}

                  {/* VALIDATION GATEKEEPER AREA */}
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                        Connectivity Gatekeeper
                      </span>
                      <button
                        type="button"
                        onClick={handleValidateRegisterSource}
                        disabled={validationState.status === "checking"}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] rounded-xl border border-blue-400/30 uppercase tracking-wide transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {validationState.status === "checking" ? "Verifying..." : "Validate Link"}
                      </button>
                    </div>

                    {validationState.status === "checking" && (
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Sending system HEAD pre-flight request...</span>
                      </div>
                    )}

                    {validationState.status === "valid" && (
                      <div className="space-y-3">
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-start gap-2 text-[10px]">
                          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                          <div>
                            <strong className="block uppercase font-black">Gatekeeper Cleared</strong>
                            <span>{validationState.message}</span>
                          </div>
                        </div>

                        {/* Resolved Thumbnail Preview */}
                        {validationState.thumbnail && (
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase text-slate-500 font-bold">Resolved Temporary Thumbnail:</span>
                            <div className="relative w-36 h-20 rounded-xl overflow-hidden border border-slate-800 bg-black/60 shadow-inner">
                              <img 
                                src={validationState.thumbnail} 
                                alt="Resolved Preview" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {validationState.status === "failed" && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex items-start gap-2 text-[10px]">
                        <HelpCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <div>
                          <strong className="block uppercase font-black">Gatekeeper Rejected</strong>
                          <span>{validationState.message}</span>
                        </div>
                      </div>
                    )}

                    {validationState.status === "idle" && (
                      <span className="block text-[10px] text-slate-500 italic">
                        Please validate the URL to clear the channel gatekeeper.
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-[#090E19] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowRegModal(false);
                  setConflictState(null);
                  setValidationState({ status: "idle" });
                }}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                CANCEL
              </button>
              
              <button
                type="button"
                onClick={() => registerChannel(false)}
                disabled={validationState.status !== "valid" || conflictState?.active}
                className={`px-5 py-2 font-mono font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wide cursor-pointer flex items-center gap-1.5 ${
                  validationState.status === "valid" && !conflictState?.active
                    ? "bg-[#00ff66] hover:bg-emerald-400 text-black shadow-[#00ff66]/10"
                    : "bg-slate-800 text-slate-500 border border-slate-700/30 cursor-not-allowed"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Register Feed</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* FLOATING TACTICAL STREAM COMMAND DRAWER */}
      {!hideTacticalCommand && (
        <motion.div
          key="tactical-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setHideTacticalCommand(true);
            try {
              safeLocalStorage.setItem("ajn_hide_tactical_command", "true");
            } catch {}
          }}
          className="fixed inset-0 bg-black z-[900] cursor-pointer backdrop-blur-sm"
        />
      )}

      {!hideTacticalCommand && (
        <motion.div
          key="tactical-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className={`fixed top-0 right-0 h-full w-full max-w-xl md:max-w-2xl z-[901] flex flex-col shadow-2xl border-l overflow-hidden ${
            isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#0A0F1D]/95 backdrop-blur-md border-slate-800/80 text-slate-200"
          }`}
        >
          {/* Subtle decorative scanline grid for tactical dashboard feel */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.05)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-25 animate-scanline" />

          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-800 bg-black/40 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00ff66] to-emerald-600 flex items-center justify-center shadow-lg shadow-[#00ff66]/15 border border-[#00ff66]/30">
                <Zap className="w-5 h-5 text-black fill-black" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-wider uppercase font-mono flex items-center gap-2 text-white">
                  TACTICAL COMMAND CONSOLE
                </h2>
                <div className="text-emerald-400 font-mono text-xs tracking-widest uppercase mt-0.5">
                  {headerDate}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setHideTacticalCommand(true);
                try {
                  safeLocalStorage.setItem("ajn_hide_tactical_command", "true");
                } catch {}
              }}
              className="text-slate-400 hover:text-white font-mono font-bold text-xs bg-slate-800/40 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/50 transition-all cursor-pointer"
            >
              [CLOSE]
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 no-scrollbar z-10">
            <div className="p-4 bg-red-600/10 text-red-400 border border-red-500/20 rounded-2xl flex items-center gap-2.5 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-bold uppercase tracking-wider">AJN DIRECT DEPLOYMENT ACTIVE</span>
              <span className="ml-auto text-slate-400 text-[10px]">VOD MODE</span>
            </div>

            {/* MASTER HUB PLAYHEAD (Central LP Node) */}
            <div className="bg-[#05080E]/95 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase block">Master Playhead Node</span>
              <div className="flex items-center gap-4">
                {/* Spinning Radar Disk */}
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-[#00ff66]/15 animate-radar-pulse" />
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-slate-900 via-zinc-950 to-slate-900 border border-slate-800 flex items-center justify-center relative shadow-lg overflow-hidden animate-spin-vinyl">
                    <div className="absolute inset-2 rounded-full border border-slate-800/40" />
                    <div className="absolute inset-4 rounded-full border border-slate-800/30" />
                    <div className="absolute inset-6 rounded-full border border-slate-800/20" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#00ff66]/70 transform origin-center -translate-x-1/2 rotate-45" />
                    <div className="w-3 h-3 rounded-full bg-red-600 border border-slate-900 z-10 shadow shadow-red-500/50" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-dashed border-[#00ff66]/30 animate-radar-sweep pointer-events-none" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-black text-slate-100 font-mono truncate uppercase">
                    {selectedProgram?.block?.episode?.title || "AJN MASTER STREAM HUB"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans mt-1">
                    Convergent destination for offline playout synchronization.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/50">
                <button
                  onClick={() => {
                    if (selectedProgram) {
                      triggerPlayout(selectedProgram.block, selectedProgram.channel);
                    } else {
                      const ch1 = virtualChannels.find(c => c.num === 1);
                      if (ch1) {
                        const blocks = channelBlocksMap[ch1.id] || [];
                        const cur = blocks[0];
                        if (cur) {
                          triggerPlayout(cur, ch1);
                        } else {
                          onSelectStream({
                            url: ch1.url,
                            title: ch1.name,
                            seekPosition: 0,
                            isLiveNow: true
                          });
                        }
                      }
                    }
                  }}
                  className="px-4 py-2 bg-[#00ff66] hover:bg-emerald-400 text-black font-mono font-black text-xs rounded-xl shadow-md hover:shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer uppercase"
                >
                  <Play className="w-3 h-3 fill-black text-black" />
                  <span>Launch Decoupled Stream</span>
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("ajn-toggle-preamble", { detail: { open: true } }));
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono font-bold text-xs rounded-xl border border-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Radio className="w-3 h-3 text-[#00ff66]" />
                  <span>Resume Preamble</span>
                </button>
              </div>
            </div>

            {/* INDEPENDENT INPUT FEED STATUS (Channels 1-5 Mapping) */}
            <div className="bg-[#05080E]/95 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase block">Independent Feed Resolver (CH 1-5)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 bg-black/45 p-3 rounded-xl border border-slate-800/50">
                  <span className="text-xs font-mono font-black text-slate-400 shrink-0">CH1</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono text-slate-200 font-bold truncate">Anchor Chrono VOD</div>
                    <div className="text-[9px] font-mono text-emerald-400 truncate uppercase mt-0.5">Semantic Resolver</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-black/45 p-3 rounded-xl border border-slate-800/50">
                  <span className="text-xs font-mono font-black text-slate-400 shrink-0">CH2</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono text-slate-200 font-bold truncate">Rumble Source</div>
                    <div className="text-[9px] font-mono text-red-500 truncate uppercase mt-0.5 animate-pulse flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" /> Live Embed
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-black/45 p-3 rounded-xl border border-slate-800/50">
                  <span className="text-xs font-mono font-black text-slate-400 shrink-0">CH3</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono text-slate-200 font-bold truncate">War Room IA</div>
                    <div className="text-[9px] font-mono text-[#00ff66] truncate uppercase mt-0.5">Continuous VOD</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-black/45 p-3 rounded-xl border border-slate-800/50">
                  <span className="text-xs font-mono font-black text-slate-400 shrink-0">CH4-5</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono text-slate-200 font-bold truncate">Multiplexer Feeds</div>
                    <div className="text-[9px] font-mono text-sky-400 truncate uppercase mt-0.5">Isolated States</div>
                  </div>
                </div>
              </div>
            </div>

            {/* REAL-TIME STREAM LATENCY & VIRTUALIZATION METRICS */}
            <div className="bg-[#05080E]/95 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">Tactical Node Diagnostics</span>
                <div className="flex items-center gap-1 text-[8px] font-mono bg-[#00ff66]/10 text-[#00ff66] px-1.5 py-0.5 rounded border border-[#00ff66]/20 font-black">
                  <span className="w-1 h-1 rounded-full bg-[#00ff66] animate-pulse" />
                  <span>VIRTUAL ACTIVE</span>
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs pt-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">Active Virtual Channels:</span>
                  <span className="text-white font-bold">{filteredChannels.length} <span className="text-[#00ff66] text-[9px]">(ROUTED)</span></span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">Multiplexer Instances:</span>
                  <span className="text-white font-bold">{multiplexerChannels.length} <span className="text-[#00ff66] text-[9px]">(ACTIVE)</span></span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">Schedule Blocks:</span>
                  <span className="text-white">{filteredChannels.reduce((acc, ch) => acc + ((ch as any).programs?.length || 0), 0)} <span className="text-slate-500">(MAPPED)</span></span>
                </div>
                <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800/50 text-[11px]">
                  <span className="text-slate-500">Viewport Virtualized Rows:</span>
                  <span className="text-[#00ff66] font-black uppercase">
                    {visibleRows.size} / {filteredChannels.length} in DOM
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK OPERATIONS WORKSPACE */}
            <div className="bg-[#05080E]/95 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase block">Diagnostics System Registry Operations</span>
              
              <div className="flex flex-col gap-2 font-mono text-xs">
                <button 
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("ajn-rss-updated"));
                    const flash = document.createElement("div");
                    flash.className = "fixed top-4 right-4 bg-[#00ff66] text-black font-mono font-black text-xs px-4 py-2 rounded shadow-2xl z-[999] animate-pulse";
                    flash.innerText = "FORCE SYNC DEPLOYED: DRIFT ALIGNED";
                    document.body.appendChild(flash);
                    setTimeout(() => flash.remove(), 2500);
                  }}
                  className="w-full flex items-center justify-between text-emerald-400 hover:text-[#00ff66] font-bold cursor-pointer transition-all bg-emerald-500/5 hover:bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/10 hover:border-emerald-500/30 text-left"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-[#00ff66]" />
                    <span>Force Sync Registry</span>
                  </span>
                  <span className="text-[10px] text-emerald-500">DRIFT ALIGN</span>
                </button>

                <button 
                  onClick={handleDownloadEpg}
                  className="w-full flex items-center justify-between text-blue-400 hover:text-blue-300 font-bold cursor-pointer transition-all bg-blue-500/5 hover:bg-blue-500/10 p-3 rounded-xl border border-blue-500/10 hover:border-blue-500/30 text-left"
                  title="Download structured EPG JSON for validation"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>Download EPG Manifest</span>
                  </span>
                  <span className="text-[10px] text-blue-500">JSON EXPORT</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* FLOATING DRAWER BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setHideTacticalCommand(prev => {
              const newVal = !prev;
              try {
                safeLocalStorage.setItem("ajn_hide_tactical_command", String(newVal));
              } catch {}
              return newVal;
            });
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0E1525] hover:bg-[#141D33] text-[#00ff66] border border-[#00ff66]/30 hover:border-[#00ff66]/60 rounded-full font-mono font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-2xl shadow-black/80 hover:shadow-[#00ff66]/10 cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff66] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff66]"></span>
          </span>
          <Zap className="w-3.5 h-3.5 text-[#00ff66] fill-[#00ff66]/20" />
          <span>Tactical Command</span>
        </button>
      </div>
    </div>
  );
});

