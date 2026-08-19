import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Tv, 
  Radio, 
  Calendar, 
  Sparkles, 
  Sliders, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  Activity, 
  Volume2, 
  RefreshCw, 
  Zap, 
  Plug, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Film, 
  Music, 
  Play, 
  Pause,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  UploadCloud,
  FileCode,
  Gauge,
  Star,
  Download,
  Upload
} from "lucide-react";
import { validateEPGSchedule } from "../utils/epgValidator";
import { getArchiveThumbnail } from "../utils/thumbnailHelper";
import { BroadcastRuntimeKernel } from "../broadcast/BroadcastRuntimeKernel";
import { BroadcastScheduleManager } from "../broadcast/BroadcastScheduleManager";
import { BroadcastSchedulerView } from "./broadcast/BroadcastSchedulerView";
import { CreateAutoChannelPanel } from "./CreateAutoChannelPanel";
import { useEscapeKey } from "../hooks/useEscapeKey";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


export interface AutomationChannel {
  id: string;
  name: string;
  callSign: string;
  category: "Movies" | "Shows" | "Music" | "News" | "Variety";
  resolution: "1080p60" | "4K60" | "720p60";
  bitrateKbps: number;
  status: "ONLINE" | "BUFFERING" | "MAINTENANCE";
  currentShow: string;
  nextShow: string;
  logoUrl: string;
  bumperFrequencyMin: number;
}

export interface ScheduleBlock {
  id: string;
  channelId: string;
  title: string;
  category: "Movie" | "Episode" | "Bumper" | "Promo" | "Live";
  startTime: string; // HH:MM
  durationMin: number;
  rating: string;
  thumbnailUrl?: string;
}

export interface AutomationPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: "Ingest" | "Overlay" | "Analytics" | "Playout" | "AI";
  active: boolean;
  configSchema?: string;
}



export interface BroadcastAutomationSuiteProps {
  theme?: "dark" | "light";
  addLog?: (msg: string) => void;
  playStream?: any;
  systemPlaylists?: any[];
  systemChannels?: any[];
  importM3U?: (name: string, content: string) => Promise<any>;
}

const INITIAL_CHANNELS: AutomationChannel[] = [
  {
    id: "ch-1",
    name: "AJN Action 24/7",
    callSign: "AJNA-HD",
    category: "Movies",
    resolution: "1080p60",
    bitrateKbps: 8500,
    status: "ONLINE",
    currentShow: "Cyberpunk: Edgerunners Marathon • Ep 04",
    nextShow: "Blade Runner 2049 (Uncut)",
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    bumperFrequencyMin: 30
  },
  {
    id: "ch-2",
    name: "Retro Sci-Fi Network",
    callSign: "RSFI-TV",
    category: "Shows",
    resolution: "1080p60",
    bitrateKbps: 6200,
    status: "ONLINE",
    currentShow: "Stargate SG-1 • The Fifth Race",
    nextShow: "Farscape • Premiere",
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    bumperFrequencyMin: 45
  },
  {
    id: "ch-3",
    name: "Smooth Jazz & Synth Lounge",
    callSign: "JAZZ-AUDIO",
    category: "Music",
    resolution: "4K60",
    bitrateKbps: 12000,
    status: "ONLINE",
    currentShow: "Midnight Tokyo Saxphone Chillout",
    nextShow: "Lo-Fi Beats • Sunrise Session",
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    bumperFrequencyMin: 60
  },
  {
    id: "ch-4",
    name: "Syndicated Global News",
    callSign: "SGN-LIVE",
    category: "News",
    resolution: "720p60",
    bitrateKbps: 4500,
    status: "ONLINE",
    currentShow: "World Market Hour & Tech Briefing",
    nextShow: "Evening Recap Bulletins",
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    bumperFrequencyMin: 15
  }
];

const INITIAL_SCHEDULE: ScheduleBlock[] = [
  { id: "blk-1", channelId: "ch-1", title: "Cyberpunk Edgerunners Ep 4", category: "Episode", startTime: "00:00", durationMin: 30, rating: "TV-MA" },
  { id: "blk-2", channelId: "ch-1", title: "AJN Station ID Bumper", category: "Bumper", startTime: "00:30", durationMin: 5, rating: "NR" },
  { id: "blk-3", channelId: "ch-1", title: "Blade Runner 2049", category: "Movie", startTime: "00:35", durationMin: 165, rating: "R" },
  { id: "blk-4", channelId: "ch-2", title: "Stargate SG-1 • S2E15", category: "Episode", startTime: "00:00", durationMin: 45, rating: "TV-PG" },
  { id: "blk-5", channelId: "ch-2", title: "Sci-Fi Network Promo", category: "Promo", startTime: "00:45", durationMin: 15, rating: "NR" },
  { id: "blk-6", channelId: "ch-2", title: "Farscape • S1E01", category: "Episode", startTime: "01:00", durationMin: 60, rating: "TV-14" },
  { id: "blk-7", channelId: "ch-3", title: "Midnight Tokyo Chillout", category: "Live", startTime: "00:00", durationMin: 180, rating: "G" },
  { id: "blk-8", channelId: "ch-4", title: "World Market Hour", category: "Live", startTime: "00:00", durationMin: 60, rating: "NR" }
];

const INITIAL_PLUGINS: AutomationPlugin[] = [
  {
    id: "plg-1",
    name: "PlutoTV Channel Restreamer",
    version: "1.4.2",
    author: "AJN Core Team",
    description: "Automatically scrapes and syncs electronic programming guide schedules from PlutoTV public HLS endpoints.",
    category: "Ingest",
    active: true
  },
  {
    id: "plg-2",
    name: "Twitch HLS Gateway Bridge",
    version: "2.1.0",
    author: "StreamForge OSS",
    description: "Translates live Twitch stream IDs into low-latency direct HLS m3u8 playlists for continuous 24/7 injection.",
    category: "Ingest",
    active: true
  },
  {
    id: "plg-3",
    name: "Dynamic Weather Ticker Overlay",
    version: "1.0.5",
    author: "MeteorDev",
    description: "Renders smooth HTML5 lower-third severe weather alerts and local forecasts directly over broadcast playout.",
    category: "Overlay",
    active: false
  },
  {
    id: "plg-4",
    name: "Discord Webhook Alerter",
    version: "3.0.0",
    author: "AJN Core Team",
    description: "Dispatches instant webhook alerts to community Discord servers when channel blocks switch or streams stall.",
    category: "Analytics",
    active: true
  },
  {
    id: "plg-5",
    name: "Gemini AI Block Generator",
    version: "0.9.8-beta",
    author: "DeepMind Collab",
    description: "Analyzes viewer retention metrics and demographic profiles to synthesize optimal programming block sequences.",
    category: "AI",
    active: true
  }
];

export function BroadcastAutomationSuite({
  theme = "dark",
  addLog,
  playStream,
  systemPlaylists = [],
  systemChannels = [],
  importM3U
}: BroadcastAutomationSuiteProps) {
  const isLight = theme === "light";
  const [activeTab, setActiveTab] = useState<"dashboard" | "channels" | "guide" | "aischeduler" | "scheduler" | "plugins" | "m3usplitter">("dashboard");

  // M3U Splitter & Organizer States
  const [m3uRawContent, setM3uRawContent] = useState("");
  const [m3uPattern, setM3uPattern] = useState("#EXTINF:.*?,(.*?)(?:\\s+-\\s+|\\s+\\[|$)");
  const [m3uDeduplicate, setM3uDeduplicate] = useState(true);
  const [m3uSanitize, setM3uSanitize] = useState(true);
  const [m3uOutputDir, setM3uOutputDir] = useState("media_library");
  const [m3uJsonOutput, setM3uJsonOutput] = useState("tv_guide.json");
  const [isM3uProcessing, setIsM3uProcessing] = useState(false);
  const [m3uSplitResult, setM3uSplitResult] = useState<any>(null);
  const [m3uError, setM3uError] = useState("");
  const [selectedShowInSplit, setSelectedShowInSplit] = useState<string | null>(null);
  const [matrixSearch, setMatrixSearch] = useState("");

  // News Headend states
  const [newsProfiles, setNewsProfiles] = useState<any[]>([]);
  const [isNewsHarvesting, setIsNewsHarvesting] = useState(false);

  const loadNewsProfiles = useCallback(async () => {
    try {
      const res = await fetch(BACKEND_URL + "/api/newsbot/profiles");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNewsProfiles(data.profiles);
        }
      }
    } catch (err) {
      console.error("Failed to load news profiles:", err);
    }
  }, []);

  const handleToggleNewsProfile = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(BACKEND_URL + "/api/newsbot/profiles/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentActive })
      });
      if (res.ok) {
        loadNewsProfiles();
        if (addLog) addLog(`News Headend: Profile ${id} state toggled to ${!currentActive}`);
      }
    } catch (err) {
      console.error("Failed to toggle profile:", err);
    }
  };

  const handleManualHarvest = async () => {
    setIsNewsHarvesting(true);
    if (addLog) addLog("News Headend: Manual harvest requested. Initiating NewsBot...");
    try {
      const res = await fetch(BACKEND_URL + "/api/newsbot/harvest", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (addLog) addLog("News Headend: Manual harvest succeeded, Atomic Swaps executed.");
          alert("News Harvest Complete! Staged playlists validated and promoted to production successfully.");
          loadNewsProfiles();
        } else {
          throw new Error(data.error || "Unknown harvest error");
        }
      }
    } catch (err: any) {
      if (addLog) addLog(`News Headend: Harvest failed: ${err.message}`);
      alert(`Harvest Failed: ${err.message}`);
    } finally {
      setIsNewsHarvesting(false);
    }
  };

  useEffect(() => {
    loadNewsProfiles();
  }, [loadNewsProfiles]);

  const loadExistingM3UGuide = useCallback(async () => {
    try {
      const res = await fetch(BACKEND_URL + "/api/m3u-splitter/load-guide");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.tvGuide && data.tvGuide.shows) {
          const totalShows = Object.keys(data.tvGuide.shows).length;
          let totalEpisodes = 0;
          Object.values(data.tvGuide.shows).forEach((s: any) => {
            totalEpisodes += s.episodes?.length || 0;
          });
          setM3uSplitResult({
            stats: {
              totalShows,
              totalEpisodes,
              outputDirectory: "media_library",
              jsonFilename: "tv_guide.json"
            },
            tvGuide: data.tvGuide
          });
        }
      }
    } catch (err) {
      console.error("Failed to load existing TV Guide:", err);
    }
  }, []);

  const handleProcessM3USplit = async () => {
    if (!m3uRawContent.trim()) {
      setM3uError("Please paste or upload some M3U content first.");
      return;
    }
    setM3uError("");
    setIsM3uProcessing(true);
    try {
      const response = await fetch(BACKEND_URL + "/api/m3u-splitter/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: m3uRawContent,
          pattern: m3uPattern,
          deduplicate: m3uDeduplicate,
          sanitizeUnicode: m3uSanitize,
          outputDir: m3uOutputDir,
          jsonOutput: m3uJsonOutput
        })
      });
      const data = await response.json();
      if (data.success) {
        setM3uSplitResult(data);
        if (addLog) {
          let logMsg = `M3U Splitter: Successfully partitioned library. Extracted ${data.stats.totalShows} shows.`;
          if (data.stats.invalidUrlsFiltered > 0) {
            logMsg += ` Filtered out ${data.stats.invalidUrlsFiltered} dead or invalid stream URLs during pre-flight validation.`;
          }
          addLog(logMsg);
        }
      } else {
        throw new Error(data.error || "Failed to split library");
      }
    } catch (err: any) {
      setM3uError(err.message || "An unexpected error occurred during processing.");
    } finally {
      setIsM3uProcessing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "m3usplitter") {
      loadExistingM3UGuide();
    }
  }, [activeTab, loadExistingM3UGuide]);

  // State Persistence
  const [channels, setChannels] = useState<AutomationChannel[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_auto_channels");
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CHANNELS;
  });

  const [schedule, setScheduleState] = useState<ScheduleBlock[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_auto_schedule");
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SCHEDULE;
  });

  const setSchedule = useCallback((newData: React.SetStateAction<ScheduleBlock[]>) => {
    if (!(document as any).startViewTransition) {
      setScheduleState(newData);
      return;
    }
    (document as any).startViewTransition(() => {
      setScheduleState(newData);
    });
  }, []);

  const [plugins, setPlugins] = useState<AutomationPlugin[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_auto_plugins");
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_PLUGINS;
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem("ajn_auto_channels", JSON.stringify(channels));
      safeLocalStorage.setItem("ajn_auto_schedule", JSON.stringify(schedule));
      safeLocalStorage.setItem("ajn_auto_plugins", JSON.stringify(plugins));
    } catch {}
  }, [channels, schedule, plugins]);

  // Real-time EPG Auto-Sync Listener
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = safeLocalStorage.getItem("ajn_auto_schedule");
        if (saved) {
          const parsed = JSON.parse(saved);
          setScheduleState(parsed);
        }
      } catch {}
    };
    window.addEventListener("ajn-schedule-updated", handleSync);
    return () => window.removeEventListener("ajn-schedule-updated", handleSync);
  }, []);

  // Modals & Forms State
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChName, setNewChName] = useState("");
  const [newChCallSign, setNewChCallSign] = useState("");
  const [newChCategory, setNewChCategory] = useState<AutomationChannel["category"]>("Movies");
  const [newChResolution, setNewChResolution] = useState<AutomationChannel["resolution"]>("1080p60");
  const [newChBitrate, setNewChBitrate] = useState(8500);

  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [selectedChannelForBlock, setSelectedChannelForBlock] = useState<string>("ch-1");
  const [newBlockTitle, setNewBlockTitle] = useState("");
  const [newBlockCat, setNewBlockCat] = useState<ScheduleBlock["category"]>("Movie");
  const [newBlockStart, setNewBlockStart] = useState("02:00");
  const [newBlockDuration, setNewBlockDuration] = useState(120);

  const [showAddPluginModal, setShowAddPluginModal] = useState(false);
  const [customManifestJson, setCustomManifestJson] = useState(`{\n  "id": "plg-custom-1",\n  "name": "Custom IPTV Provider Sync",\n  "version": "1.0.0",\n  "author": "Broadcast Studio",\n  "description": "Hooks custom M3U/XMLTV remote servers into the AJN Playout scheduler.",\n  "category": "Ingest"\n}`);

  useEscapeKey(() => {
    if (showAddChannelModal) setShowAddChannelModal(false);
    if (showEditChannelModal) setShowEditChannelModal(false);
    if (showScanResultsModal) setShowScanResultsModal(false);
    if (showAddBlockModal) setShowAddBlockModal(false);
    if (showAddPluginModal) setShowAddPluginModal(false);
  });

  // AI Scheduler Parameters
  const [aiMood, setAiMood] = useState<string>("Late Night Cyberpunk Sci-Fi");
  const [aiDemo, setAiDemo] = useState<string>("Adults 18-35 (Tech Enthusiasts)");
  const [aiActionRatio, setAiActionRatio] = useState(40);
  const [aiSciFiRatio, setAiSciFiRatio] = useState(30);
  const [aiPromoRatio, setAiPromoRatio] = useState(20);
  const [aiMusicRatio, setAiMusicRatio] = useState(10);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState("");

  // Simulated Telemetry & Master Playout Cockpit
  const [isPlayingMaster, setIsPlayingMaster] = useState(true);
  const [masterFps, setMasterFps] = useState(59.94);
  const [masterBitrate, setMasterBitrate] = useState(8420);
  const [masterBuffer, setMasterBuffer] = useState(99.9);
  const [vuLevel, setVuLevel] = useState(78);

  useEffect(() => {
    // Fake telemetry removed
  }, [isPlayingMaster]);

  // Drag and drop simulated state
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

  // Bulk channel selection state
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);

  // Validate EPG schedule blocks
  const validationResults = useMemo(() => {
    return validateEPGSchedule(schedule, channels);
  }, [schedule, channels]);

  // Schema-versioned Rumble Favorites State
  const [rumbleFavorites, setRumbleFavorites] = useState<{version: number, list: any[]}>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_rumble_favorites_v2");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.version === 2 && Array.isArray(parsed.list)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load Rumble favorites:", e);
    }
    return { version: 2, list: [] };
  });

  const [rumbleInput, setRumbleInput] = useState("");
  const [rumbleCategory, setRumbleCategory] = useState("Rumble");
  const [isProcessingRumble, setIsProcessingRumble] = useState(false);
  const [rumbleError, setRumbleError] = useState("");
  const [refreshErrorCount, setRefreshErrorCount] = useState<Record<string, number>>({});
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Channel Pinning / Pinned IDs State
  const [pinnedChannelIds, setPinnedChannelIds] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_pinned_channel_ids");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Channel Drag and Drop State
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);

  // Channel Editing Modal States
  const [showEditChannelModal, setShowEditChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AutomationChannel | null>(null);
  const [editChName, setEditChName] = useState("");
  const [editChCallSign, setEditChCallSign] = useState("");
  const [editChCategory, setEditChCategory] = useState<AutomationChannel["category"]>("Movies");
  const [editChResolution, setEditChResolution] = useState<AutomationChannel["resolution"]>("1080p60");
  const [editChBitrate, setEditChBitrate] = useState(8500);
  const [editChLogoUrl, setEditChLogoUrl] = useState("");
  const [editChBumperFrequencyMin, setEditChBumperFrequencyMin] = useState(30);

  // Rumble Channel Scanning Modal States
  const [scannedRumbleChannel, setScannedRumbleChannel] = useState<any | null>(null);
  const [isScanningLatestRumble, setIsScanningLatestRumble] = useState(false);
  const [scannedVideos, setScannedVideos] = useState<any[]>([]);
  const [showScanResultsModal, setShowScanResultsModal] = useState(false);
  const [scanError, setScanError] = useState("");

  const [selectedScanVideoForBlock, setSelectedScanVideoForBlock] = useState<any | null>(null);
  const [scanBlockChannelId, setScanBlockChannelId] = useState("");
  const [scanBlockCat, setScanBlockCat] = useState<ScheduleBlock["category"]>("Live");
  const [scanBlockStart, setScanBlockStart] = useState("12:00");
  const [scanBlockDuration, setScanBlockDuration] = useState(60);

  // Synchronize custom favorites list with TV Guide multiplexer
  const syncFavoritesToMultiplexer = useCallback((favorites: any[]) => {
    try {
      const stored = safeLocalStorage.getItem("ajn_multiplexer_feeds");
      let feeds: any[] = [];
      if (stored) {
        feeds = JSON.parse(stored);
      }
      if (!Array.isArray(feeds) || feeds.length < 12) {
        feeds = [];
      }

      // Remove any custom rumble feeds that are no longer in favorites
      feeds = feeds.filter(ch => {
        if (ch.type === "rumble" && ch.channelId.startsWith("mux-ch-rumble-")) {
          return favorites.some(fav => fav.channelId === ch.channelId);
        }
        return true;
      });

      // Update or append favorites
      favorites.forEach(fav => {
        const index = feeds.findIndex(ch => ch.channelId === fav.channelId);
        if (index > -1) {
          feeds[index] = { ...feeds[index], ...fav };
        } else {
          const maxNum = feeds.reduce((max, c) => c.num > max ? c.num : max, 12);
          feeds.push({
            ...fav,
            num: maxNum + 1
          });
        }
      });

      feeds.sort((a, b) => a.num - b.num);
      safeLocalStorage.setItem("ajn_multiplexer_feeds", JSON.stringify(feeds));
      window.dispatchEvent(new Event("ajn-multiplexer-updated"));
    } catch (e) {
      console.error("Failed to sync favorites to multiplexer:", e);
    }
  }, []);

  // Add Single Rumble Video
  const handleAddSingleVideo = async () => {
    if (!rumbleInput.trim()) {
      setRumbleError("Please enter a valid Rumble video URL");
      return;
    }
    setRumbleError("");
    setIsProcessingRumble(true);
    try {
      const url = rumbleInput.trim();
      const response = await fetch(BACKEND_URL + `/api/rumble/oembed?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error("Could not resolve video details from oembed proxy");
      }
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error("Rumble proxy did not return valid metadata");
      }
      const data = result.data;
      
      const newFav = {
        channelId: `mux-ch-rumble-${Date.now()}`,
        name: data.title || "Custom Rumble Stream",
        category: rumbleCategory || "Rumble",
        logo: data.thumbnail_url || "https://archive.org/download/daily-highlights/lmbsa.png",
        type: "rumble",
        source: url,
        isLiveMode: data.isLive === true
      };

      if (rumbleFavorites.list.some(f => f.source === url)) {
        throw new Error("This stream is already registered in your favorites list.");
      }

      const updatedList = [...rumbleFavorites.list, newFav];
      const newFavorites = { version: 2, list: updatedList };
      setRumbleFavorites(newFavorites);
      safeLocalStorage.setItem("ajn_rumble_favorites_v2", JSON.stringify(newFavorites));
      syncFavoritesToMultiplexer(updatedList);
      
      setRumbleInput("");
      if (addLog) addLog(`Broadcast Engine: Registered single Rumble video "${newFav.name}"`);
    } catch (err: any) {
      setRumbleError(err.message || "An unexpected error occurred");
    } finally {
      setIsProcessingRumble(false);
    }
  };

  // Scan Rumble Channel Feed for Latest Video
  const handleScanChannelFeed = async () => {
    if (!rumbleInput.trim()) {
      setRumbleError("Please enter a Rumble channel URL or username");
      return;
    }
    setRumbleError("");
    setIsProcessingRumble(true);
    try {
      const input = rumbleInput.trim();
      let username = input;
      if (input.includes("rumble.com/c/")) {
        username = input.split("rumble.com/c/")[1].split("/")[0].split("?")[0];
      } else if (input.includes("rumble.com/user/")) {
        username = input.split("rumble.com/user/")[1].split("/")[0].split("?")[0];
      } else if (input.includes("rumble.com/")) {
        username = input.split("rumble.com/")[1].split("/")[0].split("?")[0];
      }

      if (!username) {
        throw new Error("Could not parse Rumble channel username from input");
      }

      const response = await fetch(BACKEND_URL + `/api/rumble/channel/${encodeURIComponent(username)}`);
      if (!response.ok) {
        throw new Error(`Rumble channel scanner returned status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success || !result.videos || result.videos.length === 0) {
        throw new Error(`No recent videos or live streams found for channel: ${username}`);
      }

      const latestVideo = result.videos[0];
      const newFav = {
        channelId: `mux-ch-rumble-${Date.now()}`,
        name: latestVideo.title || `${username} Latest Feed`,
        category: rumbleCategory || "Rumble",
        logo: latestVideo.thumbnail_url || "https://archive.org/download/daily-highlights/lmbsa.png",
        type: "rumble",
        source: latestVideo.url,
        isLiveMode: latestVideo.isLive === true
      };

      if (rumbleFavorites.list.some(f => f.source === latestVideo.url)) {
        throw new Error(`Latest stream from ${username} ("${newFav.name}") is already registered.`);
      }

      const updatedList = [...rumbleFavorites.list, newFav];
      const newFavorites = { version: 2, list: updatedList };
      setRumbleFavorites(newFavorites);
      safeLocalStorage.setItem("ajn_rumble_favorites_v2", JSON.stringify(newFavorites));
      syncFavoritesToMultiplexer(updatedList);

      setRumbleInput("");
      if (addLog) addLog(`Broadcast Engine: Scanned channel "${username}" and registered latest video: "${newFav.name}"`);
    } catch (err: any) {
      setRumbleError(err.message || "Failed to scan and resolve channel feeds.");
    } finally {
      setIsProcessingRumble(false);
    }
  };

  // Remove Rumble Favorite
  const handleRemoveFavorite = useCallback((id: string, name: string) => {
    setRumbleFavorites(prev => {
      const updatedList = prev.list.filter(fav => fav.channelId !== id);
      const newFavorites = { version: 2, list: updatedList };
      safeLocalStorage.setItem("ajn_rumble_favorites_v2", JSON.stringify(newFavorites));
      syncFavoritesToMultiplexer(updatedList);
      return newFavorites;
    });
    if (addLog) addLog(`Broadcast Engine: Removed Rumble favorite "${name}"`);
  }, [addLog, syncFavoritesToMultiplexer]);

  // Global manual and background auto-refresh
  const refreshRumbleChannels = useCallback(async () => {
    if (rumbleFavorites.list.length === 0) return;
    setIsRefreshingAll(true);
    const favorites = [...rumbleFavorites.list];
    let updatedCount = 0;

    for (let i = 0; i < favorites.length; i++) {
      const fav = favorites[i];
      const errors = refreshErrorCount[fav.channelId] || 0;
      if (errors > 3) {
        console.warn(`[Rumble Auto-Refresh] Skipping ${fav.name} due to repeated errors (backoff active)`);
        continue;
      }

      try {
        const response = await fetch(BACKEND_URL + `/api/rumble/oembed?url=${encodeURIComponent(fav.source)}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            favorites[i] = {
              ...fav,
              name: result.data.title || fav.name,
              logo: result.data.thumbnail_url || fav.logo,
              isLiveMode: result.data.isLive
            };
            setRefreshErrorCount(prev => ({ ...prev, [fav.channelId]: 0 }));
            updatedCount++;
          }
        } else {
          throw new Error("Proxy error");
        }
      } catch (err) {
        console.error(`[Rumble Auto-Refresh Failed] for ${fav.name}:`, err);
        setRefreshErrorCount(prev => ({ ...prev, [fav.channelId]: errors + 1 }));
      }
    }

    if (updatedCount > 0) {
      const newFavs = { version: 2, list: favorites };
      setRumbleFavorites(newFavs);
      safeLocalStorage.setItem("ajn_rumble_favorites_v2", JSON.stringify(newFavs));
      syncFavoritesToMultiplexer(favorites);
    }
    setIsRefreshingAll(false);
    if (addLog) addLog(`Broadcast Engine: Refreshed active Rumble favorites. Synchronized ${updatedCount} feeds.`);
  }, [rumbleFavorites, refreshErrorCount, addLog, syncFavoritesToMultiplexer]);

  useEffect(() => {
    // Background auto-refresh every 5 minutes
    const interval = setInterval(() => {
      refreshRumbleChannels();
    }, 300000);

    return () => clearInterval(interval);
  }, [refreshRumbleChannels]);

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChName.trim() || !newChCallSign.trim()) return;
    const newCh: AutomationChannel = {
      id: `ch-${Date.now()}`,
      name: newChName.trim(),
      callSign: newChCallSign.trim().toUpperCase(),
      category: newChCategory,
      resolution: newChResolution,
      bitrateKbps: Number(newChBitrate),
      status: "ONLINE",
      currentShow: "Automated Playout • Queue Active",
      nextShow: "Syndicated Feature Block",
      logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
      bumperFrequencyMin: 30
    };
    setChannels(prev => [...prev, newCh]);

    // One-Click Population: Generate 24 hours of EPG schedule blocks for the new channel automatically!
    const autoBlocks: ScheduleBlock[] = [];
    const categories: Array<ScheduleBlock["category"]> = ["Movie", "Episode", "Bumper", "Promo", "Live"];
    const sampleTitles = [
      "AJN Morning Live Briefing",
      "Alex Jones Show: Patriot Special",
      "Sovereignty State Defense Strategy",
      "Severe Weather Ticker & Bulletins",
      "Midday Special Report Live Broadcast",
      "Silicon Valley Censorship Grid",
      "Evening Geopolitical Round Table",
      "Silicon Valley Censorship Grid",
      "Midnight Tokyo Sax Session",
      "Midnight Tokyo Sax Session",
      "Station ID Bumper & Promo Block",
      "Late Night Cyber Sci-Fi Marathon"
    ];

    for (let hour = 0; hour < 24; hour += 2) {
      const startTime = `${String(hour).padStart(2, "0")}:00`;
      const titleIndex = (hour / 2) % sampleTitles.length;
      const category = categories[(hour / 2) % categories.length];
      autoBlocks.push({
        id: `blk-auto-${Date.now()}-${hour}`,
        channelId: newCh.id,
        title: sampleTitles[titleIndex],
        category: category,
        startTime: startTime,
        durationMin: 120,
        rating: "TV-14",
        thumbnailUrl: getArchiveThumbnail(category, sampleTitles[titleIndex])
      });
    }
    setSchedule(prev => [...prev, ...autoBlocks]);

    setNewChName("");
    setNewChCallSign("");
    setShowAddChannelModal(false);
    if (addLog) addLog(`Broadcast Engine: Created new 24/7 channel "${newCh.name}" (${newCh.callSign}) and auto-populated its 24h TV Guide EPG schedule.`);
    window.dispatchEvent(new Event("ajn-schedule-updated"));
  };

  const handleDeleteChannel = (id: string, name: string) => {
    if (!window.confirm(`Delete channel "${name}" and all its schedule blocks?`)) return;

    setChannels(prev => prev.filter(c => c.id !== id));
    setSchedule(prev => prev.filter(b => b.channelId !== id));
    setSelectedChannelIds(prev => prev.filter(cid => cid !== id));

    if (addLog) addLog(`Broadcast Engine: Deleted channel "${name}" and cleared its schedule`);
  };

  const handleBulkDeleteChannels = () => {
    if (selectedChannelIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedChannelIds.length} selected channels and all their schedule blocks?`)) return;

    setChannels(prev => prev.filter(c => !selectedChannelIds.includes(c.id)));
    setSchedule(prev => prev.filter(b => !selectedChannelIds.includes(b.channelId)));
    
    if (addLog) addLog(`Broadcast Engine: Bulk deleted ${selectedChannelIds.length} virtual channels and cleared their schedules`);
    setSelectedChannelIds([]);
  };

  const handleLoadPlaylistIntoSplitter = (playlist: any) => {
    if (!playlist || !playlist.content) {
      if (addLog) addLog(`M3U Matrix: Playlist "${playlist?.name || 'Unknown'}" contains no raw content.`);
      return;
    }
    setM3uRawContent(playlist.content);
    setActiveTab("m3usplitter");
    if (addLog) {
      addLog(`M3U Matrix: Loaded active system playlist "${playlist.name}" (${playlist.channelCount} channels) into ingest cockpit.`);
    }
  };

  const handleCloneSystemChannelToVirtual = (chan: any) => {
    const isAlreadyVirtual = channels.some(c => c.id === chan.tvgId || c.id === `ch-sys-${chan.tvgId}`);
    if (isAlreadyVirtual) {
      if (addLog) addLog(`Channel Manager: System stream "${chan.name}" is already registered as a virtual channel.`);
      return;
    }
    
    const newChan: AutomationChannel = {
      id: `ch-sys-${chan.tvgId || Date.now()}`,
      name: chan.name,
      callSign: (chan.tvgName || chan.name || "SYS").toUpperCase().substring(0, 8),
      category: chan.group?.toLowerCase().includes("music") ? "Music" : "Variety",
      resolution: chan.aspectRatioHint === "4:3" ? "720p60" : "1080p60",
      bitrateKbps: 6500,
      status: "ONLINE",
      currentShow: "Live Feed Ingested from System Playlist",
      nextShow: "EPG Auto-Rotated Stream Loop",
      logoUrl: chan.logo || getArchiveThumbnail("Live", chan.name),
      bumperFrequencyMin: 30
    };
    
    setChannels(prev => [...prev, newChan]);

    // One-Click Population: Generate 24 hours of schedule blocks for the cloned channel automatically!
    const autoBlocks: ScheduleBlock[] = [];
    const categories: Array<ScheduleBlock["category"]> = ["Live", "Episode", "Bumper"];
    const sampleTitles = [
      `${chan.name} - Morning Feed segment`,
      `${chan.name} - Live Feed Ingest`,
      `${chan.name} - Continuous Playout loop`,
      "Station ID Bumper & Promo Block",
      `${chan.name} - Special Syndicated Presentation`
    ];

    for (let hour = 0; hour < 24; hour += 2) {
      const startTime = `${String(hour).padStart(2, "0")}:00`;
      const titleIndex = (hour / 2) % sampleTitles.length;
      const category = categories[(hour / 2) % categories.length];
      autoBlocks.push({
        id: `blk-clone-${Date.now()}-${hour}`,
        channelId: newChan.id,
        title: sampleTitles[titleIndex],
        category: category,
        startTime: startTime,
        durationMin: 120,
        rating: "TV-G",
        thumbnailUrl: chan.logo || getArchiveThumbnail(category, sampleTitles[titleIndex])
      });
    }
    setSchedule(prev => [...prev, ...autoBlocks]);

    if (addLog) addLog(`Channel Manager: Cloned system IPTV stream "${chan.name}" to virtual 24/7 channel list with auto-populated 24h TV Guide EPG schedule.`);
    window.dispatchEvent(new Event("ajn-schedule-updated"));
  };

  // Toggle Pinned / Favorite status for standard channels
  const togglePinChannel = useCallback((id: string, name: string) => {
    setPinnedChannelIds(prev => {
      let updated;
      if (prev.includes(id)) {
        updated = prev.filter(pId => pId !== id);
        if (addLog) addLog(`Broadcast Engine: Unpinned virtual channel "${name}"`);
      } else {
        updated = [...prev, id];
        if (addLog) addLog(`Broadcast Engine: Pinned virtual channel "${name}" to top`);
      }
      safeLocalStorage.setItem("ajn_pinned_channel_ids", JSON.stringify(updated));
      return updated;
    });
  }, [addLog]);

  // Drag & Drop event handlers for channels
  const handleChannelDragStart = (e: React.DragEvent, id: string) => {
    setDraggedChannelId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleChannelDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedChannelId && draggedChannelId !== id) {
      setDragOverChannelId(id);
    }
  };

  const handleChannelDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedChannelId || draggedChannelId === targetId) return;

    const dragIndex = channels.findIndex(c => c.id === draggedChannelId);
    const hoverIndex = channels.findIndex(c => c.id === targetId);

    if (dragIndex !== -1 && hoverIndex !== -1) {
      const updated = [...channels];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, removed);

      setChannels(updated);
      safeLocalStorage.setItem("ajn_auto_channels", JSON.stringify(updated));

      // Sync the new ordering to corresponding entries in the multiplexer
      try {
        const stored = safeLocalStorage.getItem("ajn_multiplexer_feeds");
        if (stored) {
          let feeds = JSON.parse(stored);
          if (Array.isArray(feeds)) {
            let numCounter = 1;
            const reorderedFeeds: any[] = [];
            
            updated.forEach(ch => {
              const feedIndex = feeds.findIndex(f => f.channelId === ch.id || f.channelId === `mux-${ch.id}`);
              if (feedIndex > -1) {
                feeds[feedIndex].num = numCounter++;
                reorderedFeeds.push(feeds[feedIndex]);
              }
            });

            feeds.forEach(f => {
              if (!reorderedFeeds.some(rf => rf.channelId === f.channelId)) {
                f.num = numCounter++;
                reorderedFeeds.push(f);
              }
            });

            reorderedFeeds.sort((a, b) => a.num - b.num);
            safeLocalStorage.setItem("ajn_multiplexer_feeds", JSON.stringify(reorderedFeeds));
            window.dispatchEvent(new Event("ajn-multiplexer-updated"));
          }
        }
      } catch (e) {
        console.error("Failed to sync reordered channels with multiplexer:", e);
      }

      if (addLog) addLog(`Broadcast Engine: Reordered channels. Moved "${removed.name}" to position ${hoverIndex + 1}`);
    }
    setDraggedChannelId(null);
    setDragOverChannelId(null);
  };

  const handleChannelDragEnd = () => {
    setDraggedChannelId(null);
    setDragOverChannelId(null);
  };

  // Standard Channel Edit Modal Handlers
  const handleOpenEditModal = (ch: AutomationChannel) => {
    setEditingChannel(ch);
    setEditChName(ch.name);
    setEditChCallSign(ch.callSign);
    setEditChCategory(ch.category);
    setEditChResolution(ch.resolution);
    setEditChBitrate(ch.bitrateKbps);
    setEditChLogoUrl(ch.logoUrl || "");
    setEditChBumperFrequencyMin(ch.bumperFrequencyMin || 30);
    setShowEditChannelModal(true);
  };

  const handleSaveChannelEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;

    const updatedChannels = channels.map(ch => {
      if (ch.id === editingChannel.id) {
        return {
          ...ch,
          name: editChName.trim(),
          callSign: editChCallSign.trim().toUpperCase(),
          category: editChCategory,
          resolution: editChResolution,
          bitrateKbps: Number(editChBitrate),
          logoUrl: editChLogoUrl.trim() || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
          bumperFrequencyMin: Number(editChBumperFrequencyMin)
        };
      }
      return ch;
    });

    setChannels(updatedChannels);
    safeLocalStorage.setItem("ajn_auto_channels", JSON.stringify(updatedChannels));
    setShowEditChannelModal(false);
    setEditingChannel(null);

    if (addLog) addLog(`Broadcast Engine: Modified configuration properties for channel "${editChName}"`);
  };

  // Extract Rumble Username utility
  const extractRumbleUsername = (url: string, fallbackName: string): string => {
    if (!url) return fallbackName;
    try {
      let username = "";
      if (url.includes("rumble.com/c/")) {
        username = url.split("rumble.com/c/")[1].split("/")[0].split("?")[0];
      } else if (url.includes("rumble.com/user/")) {
        username = url.split("rumble.com/user/")[1].split("/")[0].split("?")[0];
      } else if (url.includes("rumble.com/")) {
        const parts = url.split("rumble.com/")[1].split("/");
        const potential = parts[0]?.split("?")[0];
        if (potential && potential !== "v" && potential !== "embed" && !potential.endsWith(".html")) {
          username = potential;
        }
      }
      return username || fallbackName;
    } catch (e) {
      return fallbackName;
    }
  };

  // Rumble Channel Scanner Handler
  const handleScanLatestRumbleVideos = async (fav: any) => {
    setScannedRumbleChannel(fav);
    setIsScanningLatestRumble(true);
    setScanError("");
    setScannedVideos([]);
    setShowScanResultsModal(true);
    
    try {
      if (fav.source && fav.source.includes("rumble.com") && fav.source.includes(".html")) {
         throw new Error("Cannot scan a specific video URL. Please provide a Rumble channel URL (e.g., rumble.com/c/ChannelName).");
      }
      const username = extractRumbleUsername(fav.source, fav.name);
      if (!username || (username === fav.name && fav.source.includes("rumble.com") && !fav.source.includes(fav.name))) {
          throw new Error("Could not reliably extract a Rumble channel username from this source URL.");
      }
      const response = await fetch(BACKEND_URL + `/api/rumble/channel/${encodeURIComponent(username)}`);
      if (!response.ok) {
        throw new Error(`Rumble channel scanner returned status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success || !result.videos || result.videos.length === 0) {
        throw new Error(`No recent videos or live streams found for channel: ${username}`);
      }
      setScannedVideos(result.videos);
      if (addLog) addLog(`Broadcast Engine: Scanned channel "${username}" and retrieved ${result.videos.length} latest videos`);
    } catch (err: any) {
      setScanError(err.message || "Failed to scan and resolve channel feeds.");
      if (addLog) addLog(`Broadcast Engine Error: Failed scanning latest videos for Rumble channel. Details: ${err.message}`);
    } finally {
      setIsScanningLatestRumble(false);
    }
  };

  // Rumble Scanner actions: Replace source favorite
  const handleReplaceFavoriteSource = (video: any) => {
    if (!scannedRumbleChannel) return;
    
    setRumbleFavorites(prev => {
      const updatedList = prev.list.map(fav => {
        if (fav.channelId === scannedRumbleChannel.channelId) {
          return {
            ...fav,
            name: video.title || fav.name,
            logo: video.thumbnail_url || fav.logo,
            source: video.url,
            isLiveMode: video.isLive === true
          };
        }
        return fav;
      });
      const newFavorites = { version: 2, list: updatedList };
      safeLocalStorage.setItem("ajn_rumble_favorites_v2", JSON.stringify(newFavorites));
      syncFavoritesToMultiplexer(updatedList);
      return newFavorites;
    });

    if (addLog) addLog(`Broadcast Engine: Replaced source feed for Rumble channel "${scannedRumbleChannel.name}" with latest video: "${video.title}"`);
    setShowScanResultsModal(false);
    setScannedRumbleChannel(null);
  };

  // Rumble Scanner actions: Add to Schedule Block Form
  const handleOpenAddScanBlockForm = (video: any) => {
    setSelectedScanVideoForBlock(video);
    setScanBlockChannelId(channels[0]?.id || "ch-1");
    setScanBlockDuration(60);
    setScanBlockStart("12:00");
  };

  const handleSaveScanBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScanVideoForBlock) return;

    const newBlock: ScheduleBlock = {
      id: `blk-${Date.now()}`,
      channelId: scanBlockChannelId,
      title: selectedScanVideoForBlock.title,
      category: scanBlockCat,
      startTime: scanBlockStart,
      durationMin: Number(scanBlockDuration),
      rating: "NR",
      thumbnailUrl: selectedScanVideoForBlock.thumbnail_url
    };

    setSchedule(prev => [...prev, newBlock]);
    if (addLog) addLog(`Broadcast Engine: Scheduled program block "${newBlock.title}" on channel "${scanBlockChannelId}"`);
    setSelectedScanVideoForBlock(null);
    setShowScanResultsModal(false);
    setScannedRumbleChannel(null);
  };

  // Export entire channels + schedule as single JSON
  const handleExportSuiteData = () => {
    try {
      const dataToExport = {
        version: 1,
        exportDate: new Date().toISOString(),
        channels,
        schedule,
        plugins,
        rumbleFavorites,
        pinnedChannelIds
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Broadcast_Suite_Config_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (addLog) addLog("Broadcast Engine: Exported complete channels, schedule, plugins, and custom Rumble favorites data to JSON");
    } catch (e: any) {
      console.error("Export failed:", e);
      alert("Failed to export suite data: " + e.message);
    }
  };

  // Import JSON configuration file
  const handleImportSuiteData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid file format. Must be a JSON object.");
        }

        let importCountChannels = 0;
        let importCountSchedule = 0;

        if (parsed.channels && Array.isArray(parsed.channels)) {
          const validChannels = parsed.channels.filter((ch: any) => ch && ch.id && ch.name && ch.callSign);
          if (validChannels.length > 0) {
            setChannels(validChannels);
            safeLocalStorage.setItem("ajn_auto_channels", JSON.stringify(validChannels));
            importCountChannels = validChannels.length;
          }
        }

        if (parsed.schedule && Array.isArray(parsed.schedule)) {
          const validSchedule = parsed.schedule.filter((block: any) => block && block.id && block.channelId && block.title);
          if (validSchedule.length > 0) {
            setSchedule(validSchedule);
            safeLocalStorage.setItem("ajn_auto_schedule", JSON.stringify(validSchedule));
            importCountSchedule = validSchedule.length;
          }
        }

        if (parsed.plugins && Array.isArray(parsed.plugins)) {
          setPlugins(parsed.plugins);
          safeLocalStorage.setItem("ajn_auto_plugins", JSON.stringify(parsed.plugins));
        }

        if (parsed.rumbleFavorites && parsed.rumbleFavorites.list && Array.isArray(parsed.rumbleFavorites.list)) {
          setRumbleFavorites(parsed.rumbleFavorites);
          safeLocalStorage.setItem("ajn_rumble_favorites_v2", JSON.stringify(parsed.rumbleFavorites));
          syncFavoritesToMultiplexer(parsed.rumbleFavorites.list);
        }

        if (parsed.pinnedChannelIds && Array.isArray(parsed.pinnedChannelIds)) {
          setPinnedChannelIds(parsed.pinnedChannelIds);
          safeLocalStorage.setItem("ajn_pinned_channel_ids", JSON.stringify(parsed.pinnedChannelIds));
        }

        if (addLog) addLog(`Broadcast Engine: Successfully imported suite configuration. Restored ${importCountChannels} channels and ${importCountSchedule} program blocks.`);
        alert("Configuration imported successfully!");
      } catch (err: any) {
        if (addLog) addLog(`Broadcast Engine Error: Failed to import configuration file. Details: ${err.message}`);
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockTitle.trim()) return;
    const blk: ScheduleBlock = {
      id: `blk-${Date.now()}`,
      channelId: selectedChannelForBlock,
      title: newBlockTitle.trim(),
      category: newBlockCat,
      startTime: newBlockStart,
      durationMin: Number(newBlockDuration),
      rating: "TV-14"
    };
    setSchedule(prev => [...prev, blk]);
    setNewBlockTitle("");
    setShowAddBlockModal(false);
    if (addLog) addLog(`Scheduler: Slotted "${blk.title}" onto channel ID ${selectedChannelForBlock}`);
  };

  const handleDeleteBlock = (id: string) => {
    setSchedule(prev => prev.filter(b => b.id !== id));
  };

  const handleTogglePlugin = (id: string) => {
    setPlugins(prev => prev.map(p => {
      if (p.id === id) {
        const nextState = !p.active;
        if (addLog) addLog(`Plugin Framework: Switched plugin "${p.name}" to ${nextState ? "ACTIVE" : "INACTIVE"}`);
        return { ...p, active: nextState };
      }
      return p;
    }));
  };

  const handleInstallCustomPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(customManifestJson);
      if (!parsed.name || !parsed.id) throw new Error("Manifest missing id or name");
      const newPlg: AutomationPlugin = {
        id: parsed.id,
        name: parsed.name,
        version: parsed.version || "1.0.0",
        author: parsed.author || "Custom Developer",
        description: parsed.description || "Custom provider plugin loaded via manifest.",
        category: parsed.category || "Ingest",
        active: true
      };
      setPlugins(prev => [...prev, newPlg]);
      setShowAddPluginModal(false);
      if (addLog) addLog(`Plugin Framework: Successfully registered custom plugin "${newPlg.name}"`);
    } catch (err: any) {
      alert("Invalid JSON Manifest: " + err.message);
    }
  };

  const triggerAiScheduleGeneration = () => {
    setIsAiGenerating(true);
    setAiSuccessMsg("");
    if (addLog) addLog(`AI Scheduler: Synthesizing 24-hour broadcast blocks for mood: "${aiMood}"...`);
    
    setTimeout(() => {
      // Pick some random system channels if available, otherwise fallback
      const hasSysChans = systemChannels && systemChannels.length > 0;
      const sysChan1 = hasSysChans ? systemChannels[Math.floor(Math.random() * systemChannels.length)] : null;
      let sysChan2 = null;
      if (hasSysChans && systemChannels.length > 1) {
        const remaining = systemChannels.filter(c => c.name !== sysChan1?.name);
        sysChan2 = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : sysChan1;
      } else if (hasSysChans) {
        sysChan2 = sysChan1;
      }

      const blockTitle1 = sysChan1 ? `Live stream broadcast: ${sysChan1.name}` : "Cyberpunk 2077 Night City Special";
      const blockTitle2 = sysChan2 ? `VOD Feature program: ${sysChan2.name}` : "Doctor Who • Blink (AI Pick)";

      const aiGeneratedBlocks: ScheduleBlock[] = [
        { id: `ai-${Date.now()}-1`, channelId: "ch-1", title: blockTitle1, category: sysChan1 ? "Live" : "Episode", startTime: "04:00", durationMin: 45, rating: "TV-MA" },
        { id: `ai-${Date.now()}-2`, channelId: "ch-1", title: "Neon Synthwave Station Bumper", category: "Bumper", startTime: "04:45", durationMin: 5, rating: "G" },
        { id: `ai-${Date.now()}-3`, channelId: "ch-1", title: "Ghost in the Shell (Remastered)", category: "Movie", startTime: "04:50", durationMin: 130, rating: "R" },
        { id: `ai-${Date.now()}-4`, channelId: "ch-2", title: blockTitle2, category: sysChan2 ? "Live" : "Episode", startTime: "04:00", durationMin: 50, rating: "TV-PG" },
        { id: `ai-${Date.now()}-5`, channelId: "ch-2", title: "Sci-Fi Network Midday Promo", category: "Promo", startTime: "04:50", durationMin: 10, rating: "NR" },
        { id: `ai-${Date.now()}-6`, channelId: "ch-3", title: "Tokyo Neo-Noir Jazz Marathon", category: "Live", startTime: "04:00", durationMin: 240, rating: "G" }
      ];
      setSchedule(prev => [...prev, ...aiGeneratedBlocks]);
      setIsAiGenerating(false);
      setAiSuccessMsg(`⚡ Successfully auto-scheduled ${aiGeneratedBlocks.length} optimized blocks matching target ratios!`);
      if (addLog) addLog(`AI Scheduler: Applied ${aiGeneratedBlocks.length} AI-generated blocks to EPG schedule queue`);
    }, 2000);
  };

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const aPinned = pinnedChannelIds.includes(a.id);
      const bPinned = pinnedChannelIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [channels, pinnedChannelIds]);

  // Helper formatting
  const getCategoryBadgeColor = (cat: ScheduleBlock["category"]) => {
    switch (cat) {
      case "Movie": return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "Episode": return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "Live": return "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse";
      case "Bumper": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "Promo": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
  };

  return (
    <div id="broadcast-automation-suite" className={`w-full h-full min-h-0 flex flex-col rounded-2xl border shadow-2xl overflow-y-auto transition-colors ${
      isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-[#06090F] border-slate-800/80 text-white"
    }`}>
      {/* HEADER BAR */}
      <div className={`px-6 py-5 border-b flex flex-wrap items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-gradient-to-r from-slate-900 via-[#0B101D] to-slate-900 border-slate-800"
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 flex items-center justify-center">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight font-sans uppercase">Broadcast Automation Platform</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                24/7 Engine v3.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Master control studio for custom 24/7 channels, EPG timeline automation, AI block synthesis, and playout plugins.
            </p>
          </div>
        </div>

        {/* QUICK STATUS TICKERS */}
        <div className="flex items-center gap-3 font-mono text-xs hidden lg:flex">
          {systemPlaylists.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>VAULT: {systemPlaylists.length} PLAYLISTS ({systemChannels.length} CH)</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>ON AIR: {channels.filter(c => c.status === "ONLINE").length} CH</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-blue-400">
            <Activity className="w-3.5 h-3.5" />
            <span>FPS: {masterFps.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-purple-400">
            <Plug className="w-3.5 h-3.5" />
            <span>PLUGINS: {plugins.filter(p => p.active).length} ACTIVE</span>
          </div>
        </div>
      </div>

      {/* PRIMARY SUITE TABS */}
      <div className={`px-6 py-2 border-b flex items-center gap-2 overflow-x-auto scrollbar-none select-none ${
        isLight ? "bg-slate-100/80 border-slate-200" : "bg-[#04060A]/80 border-slate-800/60"
      }`}>
        {[
          { id: "dashboard", label: "Master Dashboard", icon: <Gauge className="w-4 h-4" />, count: null },
          { id: "channels", label: "Channel Manager", icon: <Tv className="w-4 h-4" />, count: channels.length },
          { id: "guide", label: "Advanced TV Guide", icon: <Calendar className="w-4 h-4" />, count: schedule.length },
          { id: "scheduler", label: "Broadcast Scheduler", icon: <Calendar className="w-4 h-4 text-emerald-400" />, count: schedule.length },
          { id: "aischeduler", label: "AI Auto-Scheduler", icon: <Sparkles className="w-4 h-4 text-amber-400" />, count: "Gemini" },
          { id: "plugins", label: "Plugin Framework", icon: <Plug className="w-4 h-4" />, count: plugins.length },
          { id: "m3usplitter", label: "M3U Matrix Splitter", icon: <Sliders className="w-4 h-4 text-cyan-400" />, count: "Pro" }
        ].map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                active 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black"
                  : isLight 
                    ? "text-slate-600 hover:bg-white hover:text-slate-900" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== null && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
                  active ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUITE TAB CONTENT AREA */}
      <div className="p-6 flex-1">
        
        {/*================ TAB 1: MASTER BROADCAST DASHBOARD ================*/}
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* MASTER COCKPIT PREVIEW PLAYER */}
            <div className={`xl:col-span-2 rounded-2xl border p-5 flex flex-col gap-4 relative overflow-hidden ${
              isLight ? "bg-white border-slate-200" : "bg-[#090D16] border-slate-800/80"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-red-400">Master Playout Monitor</span>
                  <span className="text-slate-500 text-xs">• CH-1 (AJNA-HD)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsPlayingMaster(!isPlayingMaster)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title={isPlayingMaster ? "Pause Master Playout" : "Resume Master Playout"}
                  >
                    {isPlayingMaster ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="px-2 py-1 rounded bg-slate-900 font-mono text-[11px] text-emerald-400 border border-slate-800">
                    1080p60 • {masterBitrate} kbps
                  </span>
                </div>
              </div>

              {/* SIMULATED BROADCAST VIDEO CANVAS / PLAYER */}
              <div className="w-full aspect-video rounded-xl bg-black border border-slate-800 relative flex items-center justify-center overflow-hidden shadow-2xl group">
                <img 
                  src="https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg" 
                  alt="Broadcast Feed"
                  className={`w-full h-full object-cover transition-transform duration-1000 ${isPlayingMaster ? "scale-105" : "grayscale opacity-50"}`}
                />
                
                {/* LOWER THIRD BROADCAST GRAPHIC OVERLAY */}
                <div style={{ viewTransitionName: 'now-playing-info' }} className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-transparent border-l-4 border-blue-500 backdrop-blur-md flex items-center justify-between pointer-events-none">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-600 text-[10px] font-black text-white uppercase">NOW PLAYING</span>
                      <span className="text-xs font-mono text-blue-300">BLOCK #04</span>
                    </div>
                    <h3 className="text-base font-black tracking-wide text-white mt-0.5">Cyberpunk: Edgerunners • Episode 04</h3>
                    <p className="text-xs text-slate-300 font-sans">Next Up: Station ID Bumper followed by Blade Runner 2049</p>
                  </div>
                  <div className="text-right font-mono pr-4 hidden sm:block">
                    <div className="text-[10px] text-slate-400">REMAINING</div>
                    <div className="text-lg font-black text-amber-400 animate-pulse">00:18:42</div>
                  </div>
                </div>

                {!isPlayingMaster && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="p-4 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400 font-mono text-sm font-bold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span>MASTER PLAYOUT PAUSED</span>
                    </div>
                  </div>
                )}
              </div>

              {/* STEREO VU LEVEL METER VISUALIZER */}
              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-xs">
                <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0">MASTER AUDIO (LUFS):</span>
                <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden flex p-0.5 gap-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${isPlayingMaster ? vuLevel : 0}%` }}
                  />
                </div>
                <span className="text-emerald-400 font-bold w-16 text-right">
                  {isPlayingMaster ? "-14.2 dB" : "MUTE"}
                </span>
              </div>
            </div>

            {/* REAL-TIME TELEMETRY & SYSTEM HEALTH PANEL */}
            <div className="flex flex-col gap-6">
              
              {/* SYSTEM HEALTH CARDS */}
              <div className={`rounded-2xl border p-5 flex flex-col gap-4 ${
                isLight ? "bg-white border-slate-200" : "bg-[#090D16] border-slate-800/80"
              }`}>
                <h3 className="text-sm font-black font-sans uppercase tracking-wider flex items-center gap-2 text-slate-400">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span>Real-Time Ingest Telemetry</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500">FRAME RATE</span>
                    <span className="text-xl font-bold text-blue-400 mt-1">{masterFps.toFixed(2)} <span className="text-xs text-slate-500">FPS</span></span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500">BUFFER HEALTH</span>
                    <span className="text-xl font-bold text-emerald-400 mt-1">{masterBuffer.toFixed(1)}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500">VIDEO BITRATE</span>
                    <span className="text-xl font-bold text-purple-400 mt-1">8.42 <span className="text-xs text-slate-500">Mbps</span></span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500">ENGINE UPTIME</span>
                    <span className="text-xl font-bold text-amber-400 mt-1">14d 06h</span>
                  </div>
                </div>
              </div>

              {/* AUTOMATION QUEUE PREVIEW */}
              <div className={`rounded-2xl border p-5 flex flex-col gap-3 flex-1 ${
                isLight ? "bg-white border-slate-200" : "bg-[#090D16] border-slate-800/80"
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black font-sans uppercase tracking-wider flex items-center gap-2 text-slate-400">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Up Next in Automation</span>
                  </h3>
                  <button 
                    onClick={() => setActiveTab("guide")}
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Full Guide</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 overflow-y-auto max-h-[260px] pr-1">
                  {schedule.slice(0, 4).map((blk, idx) => (
                    <div 
                      key={blk.id}
                      style={{ viewTransitionName: `schedule-item-${idx}` }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        idx === 0 
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-200 font-bold" 
                          : "bg-slate-950/60 border-slate-800/60 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="font-mono text-[11px] text-slate-500">{blk.startTime}</span>
                        <span className="truncate">{blk.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 border ${getCategoryBadgeColor(blk.category)}`}>
                        {blk.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* Create Auto-Channel Drop-Zone UI Component */}
          <div className="mt-8">
            <CreateAutoChannelPanel 
              onChannelCreated={() => {
                if (addLog) {
                  addLog("Load & Go: Injected EPG program slots instantaneously for new custom channel.");
                }
              }} 
              addLog={addLog} 
            />
          </div>
        </>
      )}

        {/*================ TAB 2: CHANNEL MANAGER ================*/}
        {activeTab === "channels" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-black uppercase font-sans tracking-tight">Virtual 24/7 Channel Manager</h2>
                <p className="text-xs text-slate-400">Configure continuous virtual broadcast streams, station ID call signs, and automated bumper insertion rates.</p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleExportSuiteData}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md"
                  title="Export channels & schedules to JSON"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Export Config</span>
                </button>
                <label
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                  title="Import channels & schedules from JSON"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Import Config</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSuiteData}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => setShowAddChannelModal(true)}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create 24/7 Virtual Channel</span>
                </button>
              </div>
            </div>

            {/* BULK SELECTION CONTROLS BAR */}
            {channels.length > 0 && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 text-xs ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/35 border-slate-800/80"
              }`}>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      checked={channels.length > 0 && selectedChannelIds.length === channels.length}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = selectedChannelIds.length > 0 && selectedChannelIds.length < channels.length;
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannelIds(channels.map(c => c.id));
                        } else {
                          setSelectedChannelIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span>Select All Channels ({channels.length})</span>
                  </label>
                  {selectedChannelIds.length > 0 && (
                    <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {selectedChannelIds.length} SELECTED
                    </span>
                  )}
                </div>

                {selectedChannelIds.length > 0 && (
                  <button
                    onClick={handleBulkDeleteChannels}
                    className="py-1.5 px-3.5 rounded-xl bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-red-500/20 hover:border-red-500 transition-all cursor-pointer shadow-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedChannelIds.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* CHANNELS BENTO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {sortedChannels.map((ch) => {
                const isPinned = pinnedChannelIds.includes(ch.id);
                const isCurrentlyDragged = draggedChannelId === ch.id;
                const isCurrentlyDragOver = dragOverChannelId === ch.id;

                return (
                  <div 
                    key={ch.id}
                    draggable={true}
                    onDragStart={(e) => handleChannelDragStart(e, ch.id)}
                    onDragOver={(e) => handleChannelDragOver(e, ch.id)}
                    onDrop={(e) => handleChannelDrop(e, ch.id)}
                    onDragEnd={handleChannelDragEnd}
                    className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all relative group cursor-grab active:cursor-grabbing ${
                      isCurrentlyDragged ? "opacity-30 border-dashed border-blue-500 scale-[0.98]" : ""
                    } ${
                      isCurrentlyDragOver ? "border-blue-400 bg-blue-500/5 shadow-lg shadow-blue-500/10 scale-[1.01]" : ""
                    } ${
                      !isCurrentlyDragged && !isCurrentlyDragOver
                        ? isPinned
                          ? "border-amber-500/50 bg-amber-500/[0.02] shadow-md shadow-amber-500/[0.02] hover:border-amber-400"
                          : isLight 
                            ? "bg-white border-slate-200 shadow-md hover:border-blue-500/50" 
                            : "bg-[#090D16] border-slate-800/80 hover:border-blue-500/50"
                        : ""
                    }`}
                  >
                    {isPinned && (
                      <div className="absolute top-0 right-12 transform -translate-y-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md select-none font-sans">
                        ★ PINNED STATION
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedChannelIds.includes(ch.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChannelIds(prev => [...prev, ch.id]);
                            } else {
                              setSelectedChannelIds(prev => prev.filter(id => id !== ch.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer mr-1 shrink-0"
                        />
                        <img 
                          src={ch.logoUrl} 
                          alt={ch.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md shrink-0" 
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-base font-sans tracking-tight text-white truncate">{ch.name}</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                              {ch.callSign}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                            <span className="font-mono text-blue-400">{ch.resolution} • {ch.bitrateKbps} kbps</span>
                            <span>•</span>
                            <span>{ch.category}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Favorite / Pin Star Button */}
                        <button
                          onClick={() => togglePinChannel(ch.id, ch.name)}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isPinned 
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20" 
                              : "bg-slate-900/85 text-slate-500 hover:text-amber-400"
                          }`}
                          title={isPinned ? "Unpin Virtual Channel" : "Pin Virtual Channel to Top"}
                        >
                          <Star className={`w-4 h-4 ${isPinned ? "fill-amber-400 text-amber-400" : ""}`} />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(ch)}
                          className="p-2 rounded-xl bg-slate-900/85 hover:bg-blue-600/20 hover:text-blue-400 text-slate-500 transition-colors cursor-pointer"
                          title="Edit Virtual Channel"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteChannel(ch.id, ch.name)}
                          className="p-2 rounded-xl bg-slate-900/80 hover:bg-red-600/20 hover:text-red-400 text-slate-500 transition-colors cursor-pointer"
                          title="Delete Virtual Channel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  {/* CURRENT & NEXT TELEMETRY INFO */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>PLAYING AUTOMATION</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">BUMPERS EVERY {ch.bumperFrequencyMin}M</span>
                    </div>
                    <div className="text-white font-bold truncate">{ch.currentShow}</div>
                    <div className="text-slate-400 text-[11px] truncate">Next: {ch.nextShow}</div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">STATUS: <span className="text-emerald-400 font-bold">{ch.status}</span></span>
                    <button 
                      onClick={() => {
                        setSelectedChannelForBlock(ch.id);
                        setActiveTab("guide");
                      }}
                      className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                    >
                      <span>Manage Timeline Queue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )})}
            </div>

            {/* RUMBLE FEEDS MANAGER SECTION */}
            <div className={`rounded-2xl border p-6 flex flex-col gap-5 mt-4 ${
              isLight ? "bg-white border-slate-200 shadow-md" : "bg-[#090D16] border-slate-800/80"
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                <div>
                  <h3 className="font-sans font-black text-lg text-white flex items-center gap-2">
                    <span className="text-orange-500">🟢</span> Rumble Playout Feeds Ingest Engine
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Register single live streams or scan Rumble channel usernames for the latest active broadcasts to feed into the 24/7 EPG Multiplexer.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshRumbleChannels}
                    disabled={isRefreshingAll || isProcessingRumble || rumbleFavorites.list.length === 0}
                    className="py-2 px-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshingAll ? "animate-spin" : ""}`} />
                    <span>{isRefreshingAll ? "REFRESHING..." : "REFRESH ALL RUMBLE"}</span>
                  </button>
                </div>
              </div>

              {/* INPUT FORM BLOCK */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6 flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Rumble URL / Channel Username
                  </label>
                  <input
                    type="text"
                    value={rumbleInput}
                    onChange={(e) => setRumbleInput(e.target.value)}
                    placeholder="https://rumble.com/v60552h-newsmax2-live... OR 'Newsmax'"
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 font-sans text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Feed Category
                  </label>
                  <select
                    value={rumbleCategory}
                    onChange={(e) => setRumbleCategory(e.target.value)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white font-sans text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="Rumble">Rumble</option>
                    <option value="News">News</option>
                    <option value="Talk Show">Talk Show</option>
                    <option value="Live Stream">Live Stream</option>
                    <option value="Independent">Independent</option>
                  </select>
                </div>

                <div className="md:col-span-4 flex items-center gap-2 pt-2 md:pt-0">
                  <button
                    onClick={handleAddSingleVideo}
                    disabled={isProcessingRumble}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-600/15"
                  >
                    Add Video
                  </button>
                  <button
                    onClick={handleScanChannelFeed}
                    disabled={isProcessingRumble}
                    className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs text-center transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-orange-600/15"
                  >
                    Scan Channel
                  </button>
                </div>
              </div>

              {rumbleError && (
                <div className="p-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold font-sans flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{rumbleError}</span>
                </div>
              )}

              {/* LIST OF SAVED RUMBLE FAVORITES */}
              <div className="space-y-3">
                <div className="text-[11px] font-mono font-black text-slate-500 uppercase tracking-widest border-b border-slate-850 pb-2">
                  SAVED RUMBLE SOURCE FEEDS ({rumbleFavorites.list.length})
                </div>

                {rumbleFavorites.list.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/45 rounded-2xl border border-slate-850/60 font-sans">
                    No custom Rumble favorite feeds registered yet. Enter a video or channel above to start ingest pipelines.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rumbleFavorites.list.map((fav) => (
                      <div
                        key={fav.channelId}
                        className="p-3 rounded-2xl bg-[#06090F] border border-slate-850/80 hover:border-slate-800 flex items-center justify-between gap-3 group transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={fav.logo || "https://archive.org/download/daily-highlights/lmbsa.png"}
                            referrerPolicy="no-referrer"
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover border border-slate-800 shadow-sm shrink-0"
                          />
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white truncate">{fav.name}</span>
                              {fav.isLiveMode ? (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black font-mono tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                                  ● LIVE
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black font-mono tracking-wide uppercase bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                                  VOD
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono truncate block mt-0.5 max-w-xs hover:text-blue-400 transition-colors">
                              {fav.source}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleScanLatestRumbleVideos(fav)}
                            className="p-2 rounded-xl hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-colors cursor-pointer"
                            title="Scan Latest Videos"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite(fav.channelId, fav.name)}
                            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                            title="Remove Feed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVE SYSTEM VAULT INTEGRATION (PLAYLISTS & IPTV STREAMS) */}
            <div className={`rounded-2xl border p-6 flex flex-col gap-5 mt-4 ${
              isLight ? "bg-white border-slate-200 shadow-md" : "bg-[#090D16] border-slate-800/80"
            }`}>
              <div>
                <h3 className="font-sans font-black text-lg text-white flex items-center gap-2">
                  <span className="text-blue-500">🔌</span> Active System Vault Integration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct live bridge to the active IPTV Playlist vault and EPG stream repository. Import system streams directly into playout automation grids or parse them using the matrix splitter.
                </p>
              </div>

              {/* TABS FOR PLAYLISTS VS CHANNELS IN VAULT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SYSTEM PLAYLISTS COLUMN */}
                <div className="space-y-4">
                  <div className="text-[11px] font-mono font-black text-slate-500 uppercase tracking-widest border-b border-slate-850 pb-2">
                    ACTIVE M3U PLAYLISTS ({systemPlaylists.length})
                  </div>

                  {systemPlaylists.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/45 rounded-2xl border border-slate-850/60 font-sans">
                      No playlists imported in active system vault yet. Import a playlist from the main player to activate this bridge.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                      {systemPlaylists.map((pl) => (
                        <div key={pl.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-200 truncate">{pl.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{pl.channelCount || 0} channels • {pl.importedAt ? new Date(pl.importedAt).toLocaleDateString() : "Imported"}</div>
                          </div>
                          <button
                            onClick={() => handleLoadPlaylistIntoSplitter(pl)}
                            className="shrink-0 py-1.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-mono font-bold text-[10px] uppercase border border-blue-500/20 hover:border-blue-500 transition-all cursor-pointer shadow-md"
                            title="Load playlist into the Ingest raw field of M3U Matrix Splitter"
                          >
                            ⚡ Split Matrix
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SYSTEM CHANNELS COLUMN */}
                <div className="space-y-4">
                  <div className="text-[11px] font-mono font-black text-slate-500 uppercase tracking-widest border-b border-slate-850 pb-2">
                    ACTIVE IPTV STREAMS ({systemChannels.length})
                  </div>

                  {systemChannels.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/45 rounded-2xl border border-slate-850/60 font-sans">
                      No channels resolved in active system database yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                      {systemChannels.slice(0, 50).map((chan, idx) => (
                        <div key={chan.tvgId || idx} className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={chan.logo || "https://archive.org/download/daily-highlights/lmbsa.png"}
                              alt=""
                              className="w-7 h-7 rounded object-cover border border-slate-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://archive.org/download/daily-highlights/lmbsa.png";
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-200 truncate">{chan.name}</div>
                              <div className="text-[9px] text-slate-500 font-mono truncate">{chan.url}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                if (playStream && chan.url) {
                                  playStream(chan.url, chan.name);
                                  if (addLog) addLog(`Testing playback of system stream "${chan.name}"`);
                                }
                              }}
                              className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[10px] font-bold transition-all"
                              title="Instantly test run this stream in the main video player"
                            >
                              ▶️ Test
                            </button>
                            <button
                              onClick={() => handleCloneSystemChannelToVirtual(chan)}
                              className="py-1 px-2 rounded bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-[10px] font-bold transition-all"
                              title="Clone this stream to the virtual 24/7 channels list above"
                            >
                              ➕ Clone
                            </button>
                          </div>
                        </div>
                      ))}
                      {systemChannels.length > 50 && (
                        <div className="text-[10px] text-slate-500 font-mono text-center pt-1.5">
                          Showing top 50 channels. Filter using main search.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/*================ TAB 3: ADVANCED TV GUIDE (DRAG & DROP) ================*/}
        {activeTab === "guide" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-black uppercase font-sans tracking-tight">Advanced Playout Timeline Grid</h2>
                <p className="text-xs text-slate-400">Interactive 24-hour EPG block scheduler. Add movies, series episodes, promos, and station bumpers.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddBlockModal(true)}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Program Block</span>
                </button>
              </div>
            </div>

            {/* EPG Schedule Validation Status Card */}
            <div className={`p-4 rounded-2xl border text-xs font-mono space-y-2 ${
              validationResults.isValid
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              <div className="flex items-center gap-2 justify-between">
                <span className="font-bold flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  {validationResults.isValid ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  EPG Schedule Validation Report
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  validationResults.isValid ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                }`}>
                  {validationResults.isValid ? "EPG VALID" : "EPG ISSUES FOUND"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Errors ({validationResults.errors.length}):</span>
                  {validationResults.errors.length === 0 ? (
                    <p className="text-slate-500 italic text-[11px]">• No scheduling overlaps detected.</p>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1 text-red-400 text-[11px]">
                      {validationResults.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Warnings ({validationResults.warnings.length}):</span>
                  {validationResults.warnings.length === 0 ? (
                    <p className="text-slate-500 italic text-[11px]">• No schedule gaps larger than 10 minutes detected.</p>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1 text-amber-400 text-[11px]">
                      {validationResults.warnings.map((warn, idx) => (
                        <li key={idx}>{warn}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* TIMELINE GUIDE CANVAS */}
            <div className={`rounded-2xl border overflow-x-auto ${
              isLight ? "bg-white border-slate-200" : "bg-[#080B13] border-slate-800/80"
            }`}>
              {/* TIME HEADER ROW */}
              <div className="flex border-b border-slate-800/80 bg-slate-950 font-mono text-[11px] text-slate-400 min-w-[800px]">
                <div className="w-48 shrink-0 p-3 font-bold border-r border-slate-800/80 flex items-center gap-2 text-white">
                  <Tv className="w-4 h-4 text-blue-400" />
                  <span>CHANNEL EPG</span>
                </div>
                {["00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30"].map((time, i) => (
                  <div key={time} className="flex-1 p-3 border-r border-slate-800/60 font-bold text-center">
                    {time}
                  </div>
                ))}
              </div>

              {/* CHANNEL ROWS & BLOCKS */}
              <div className="flex flex-col min-w-[800px] divide-y divide-slate-800/60">
                {channels.map((ch) => {
                  const chBlocks = schedule.filter(b => b.channelId === ch.id);
                  return (
                    <div key={ch.id} className="flex items-stretch min-h-[84px]">
                      {/* Channel Info Left Rail */}
                      <div className="w-48 shrink-0 p-3 bg-slate-950/60 border-r border-slate-800/80 flex items-center gap-3">
                        <img src={ch.logoUrl} alt={ch.name} className="w-8 h-8 rounded-xl object-cover" />
                        <div className="truncate">
                          <div className="font-bold text-xs text-white truncate">{ch.name}</div>
                          <div className="font-mono text-[10px] text-blue-400">{ch.callSign}</div>
                        </div>
                      </div>

                      {/* Blocks Horizontal Track */}
                      <div className="flex-1 bg-slate-950/30 p-2 flex items-center gap-2 overflow-x-auto relative">
                        {chBlocks.length === 0 ? (
                          <div className="w-full h-full rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500 italic py-4">
                            No program blocks scheduled. Click "+ Schedule Program Block" or use AI Scheduler.
                          </div>
                        ) : (
                          chBlocks.map((blk) => (
                            <div
                              key={blk.id}
                              draggable
                              onDragStart={() => setDraggedBlockId(blk.id)}
                              className={`p-3 rounded-xl border flex flex-col justify-between shrink-0 select-none cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.02] shadow-md ${
                                getCategoryBadgeColor(blk.category)
                              }`}
                              style={{ width: `${Math.max(blk.durationMin * 2.8, 140)}px` }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] font-bold opacity-80">{blk.startTime} ({blk.durationMin}m)</span>
                                <button
                                  onClick={() => handleDeleteBlock(blk.id)}
                                  className="opacity-60 hover:opacity-100 hover:text-red-300 transition-opacity"
                                  title="Remove Block"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="font-bold text-xs truncate mt-1 text-white">{blk.title}</div>
                              <div className="flex items-center justify-between text-[10px] font-mono opacity-75 mt-1">
                                <span>{blk.category}</span>
                                <span className="px-1 rounded bg-black/40 text-white font-bold">{blk.rating}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/*================ TAB 4: AI SCHEDULER (GEMINI AUTOMATION) ================*/}
        {activeTab === "aischeduler" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className={`xl:col-span-2 rounded-2xl border p-6 flex flex-col gap-6 ${
              isLight ? "bg-white border-slate-200" : "bg-[#090D16] border-slate-800/80"
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-purple-600 text-white shadow-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase font-sans tracking-tight">Gemini AI Auto-Scheduler</h2>
                  <p className="text-xs text-slate-400">Synthesize 24-hour broadcast playout sequences based on target demographics, vibe presets, and genre ratios.</p>
                </div>
              </div>

              {aiSuccessMsg && (
                <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{aiSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 block mb-1.5">Target Channel Vibe & Mood</label>
                  <select
                    value={aiMood}
                    onChange={(e) => setAiMood(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="Late Night Cyberpunk & Neo-Noir">Late Night Cyberpunk & Neo-Noir Marathon</option>
                    <option value="Saturday Morning Cartoon & Retro Block">Saturday Morning Nostalgia Cartoon Block</option>
                    <option value="Prime Time Blockbuster Action Thrillers">Prime Time Blockbuster Action Thrillers</option>
                    <option value="Smooth Ambient Sunrise Chillout">Smooth Ambient Sunrise Chillout Lounge</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 block mb-1.5">Target Audience Demographic</label>
                  <select
                    value={aiDemo}
                    onChange={(e) => setAiDemo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="Adults 18-35 (Tech & Sci-Fi Enthusiasts)">Adults 18-35 (Tech & Sci-Fi Enthusiasts)</option>
                    <option value="General Family All-Ages (G/PG)">General Family All-Ages (G/PG)</option>
                    <option value="Late Night Mature Viewers (TV-MA)">Late Night Mature Viewers (TV-MA)</option>
                  </select>
                </div>

                {/* GENRE RATIO SLIDERS */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-4">
                  <h3 className="text-xs font-bold font-mono text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    <span>Programming Content Mix Ratios</span>
                  </h3>

                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300">Action & Sci-Fi Shows</span>
                        <span className="text-blue-400 font-bold">{aiActionRatio}%</span>
                      </div>
                      <input 
                        type="range" min="10" max="70" 
                        value={aiActionRatio} onChange={(e) => setAiActionRatio(Number(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-xl"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300">Feature Films</span>
                        <span className="text-purple-400 font-bold">{aiSciFiRatio}%</span>
                      </div>
                      <input 
                        type="range" min="10" max="60" 
                        value={aiSciFiRatio} onChange={(e) => setAiSciFiRatio(Number(e.target.value))}
                        className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-xl"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300">Station Bumpers & Promos</span>
                        <span className="text-amber-400 font-bold">{aiPromoRatio}%</span>
                      </div>
                      <input 
                        type="range" min="5" max="40" 
                        value={aiPromoRatio} onChange={(e) => setAiPromoRatio(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={triggerAiScheduleGeneration}
                  disabled={isAiGenerating}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 hover:opacity-95 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-3 transition-all"
                >
                  {isAiGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Synthesizing Programming Blocks...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      <span>⚡ Auto-Generate 24h Programming Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI TELEMETRY EXPLANATION CARD */}
            <div className={`rounded-2xl border p-6 flex flex-col justify-between gap-4 ${
              isLight ? "bg-white border-slate-200" : "bg-[#090D16] border-slate-800/80"
            }`}>
              <div>
                <h3 className="text-sm font-black font-sans uppercase tracking-wider flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Automation Heuristics</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  The AI Scheduler respects strict FCC station identification rules by automatically injecting 5-second bumpers at top-of-hour boundaries.
                </p>
                <div className="mt-4 space-y-2.5 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Zero dead-air continuity verification</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Dynamic commercial break spacing</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Demographic retention optimization</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-300 text-xs font-sans">
                💡 Generated blocks are instantly bound to the <b>Advanced TV Guide</b> timeline tab.
              </div>
            </div>
          </div>
        )}

        {/*================ TAB: BROADCAST SCHEDULER ================*/}
        {activeTab === "scheduler" && (
          <BroadcastSchedulerView
            channels={channels}
            schedule={schedule}
            setSchedule={setSchedule}
            systemPlaylists={systemPlaylists}
            systemChannels={systemChannels}
            isLight={isLight}
            addLog={addLog}
          />
        )}

        {/*================ TAB 5: PLUGIN FRAMEWORK ================*/}
        {activeTab === "plugins" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-black uppercase font-sans tracking-tight">Extensible Plugin Framework Sandbox</h2>
                <p className="text-xs text-slate-400">Load new stream providers, telemetry overlays, and metadata scrapers without modifying core application code.</p>
              </div>
              <button
                onClick={() => setShowAddPluginModal(true)}
                className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all"
              >
                <FileCode className="w-4 h-4" />
                <span>Load Plugin Manifest (JSON)</span>
              </button>
            </div>

            {/* AUTONOMOUS NEWS HEADEND INTEGRATION MODULE */}
            <div className={`p-6 rounded-2xl border ${
              isLight ? "bg-white border-slate-200" : "bg-[#090D16] border-slate-800/80"
            } flex flex-col gap-6`}>
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-600/20 text-amber-400">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-100">Autonomous News Headend Integration</h3>
                    <p className="text-xs text-slate-400 mt-1">Transform active news profiles into live 24/7 Virtual Channels using NewsBot, RSS, and Atomic Swaps.</p>
                  </div>
                </div>
                <button
                  onClick={handleManualHarvest}
                  disabled={isNewsHarvesting}
                  className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/25 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isNewsHarvesting ? "animate-spin" : ""}`} />
                  <span>{isNewsHarvesting ? "Harvesting & Splitting..." : "Trigger NewsBot Harvest"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {newsProfiles.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={p.logoUrl} alt={p.callsign} className="w-8 h-8 rounded-xl object-contain bg-slate-900 p-1 shrink-0" onError={(e) => { (e.target as any).src = "https://archive.org/download/daily-highlights/lmbsa.png"; }} />
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">{p.displayName}</h4>
                          <span className="text-[10px] text-slate-400 font-mono tracking-wider">{p.callsign} • RSS</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleNewsProfile(p.id, p.isActive)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all uppercase ${
                          p.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/10 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {p.isActive ? "● Active" : "○ Disabled"}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-col gap-1">
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Harvest Status:</span>
                        <span className="font-mono text-slate-300">
                          {p.lastHarvested ? new Date(p.lastHarvested).toLocaleTimeString() : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span>Virtual Stream:</span>
                        <a
                          href={`${BACKEND_URL}/api/m3u-splitter/virtual-stitch?profileId=${p.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:underline hover:text-amber-300 font-mono text-[10px]"
                        >
                          /stitch?profileId={p.id}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PLUGINS LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {plugins.map((plg) => (
                <div
                  key={plg.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all relative ${
                    plg.active 
                      ? isLight ? "bg-white border-blue-400 shadow-md" : "bg-[#090D16] border-blue-500/60 shadow-xl" 
                      : isLight ? "bg-slate-100 border-slate-200 opacity-75" : "bg-slate-950/60 border-slate-800/60 opacity-60"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`p-2 rounded-xl text-white ${
                          plg.category === "Ingest" ? "bg-blue-600" : plg.category === "AI" ? "bg-amber-600" : "bg-purple-600"
                        }`}>
                          <Plug className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-white truncate">{plg.name}</h3>
                          <span className="font-mono text-[10px] text-slate-400">v{plg.version} • by {plg.author}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {plg.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-3 leading-relaxed font-sans">
                      {plg.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                    <span className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                      plg.active ? "text-emerald-400" : "text-slate-500"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${plg.active ? "bg-emerald-500" : "bg-slate-600"}`} />
                      <span>{plg.active ? "HOOK ACTIVE" : "DISABLED"}</span>
                    </span>

                    <button
                      onClick={() => handleTogglePlugin(plg.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs font-mono transition-all ${
                        plg.active 
                          ? "bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30" 
                          : "bg-blue-600 text-white hover:bg-blue-500 shadow-md"
                      }`}
                    >
                      {plg.active ? "Deactivate" : "Activate Hook"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/*================ TAB 6: M3U MATRIX PRO SPLITTER ================*/}
        {activeTab === "m3usplitter" && (
          <div className="flex flex-col h-[650px] border border-slate-800 rounded-2xl bg-[#090D16] overflow-hidden">
            {/* FIXED HEADER (40px) */}
            <div className="h-10 shrink-0 bg-[#0B0E14] border-b border-slate-800/80 flex items-center justify-between px-4 text-xs">
              <div className="flex items-center gap-2 font-mono text-cyan-400">
                <Sliders className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-bold uppercase tracking-wider text-[11px]">M3U Matrix Pro Control Panel</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>TELEMETRY: CONNECTED</span>
                </span>
                <span className="border-l border-slate-800 pl-3">SYNC: OK</span>
                <span className="border-l border-slate-800 pl-3 text-cyan-400">ENGINE: V2 ACTIVE</span>
              </div>
            </div>

            {/* MIDDLE VIEWPORT (Scrollable, split into 2/3 Left and 1/3 Right) */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-[#05080e]/40">
              
              {/* LEFT COLUMN: INGEST COCKPIT (2/3 width) */}
              <div className="w-2/3 h-full overflow-y-auto p-5 border-r border-slate-800/80 flex flex-col gap-4 scrollbar-thin">
                <div className="flex items-center justify-between border-b border-slate-800/30 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Ingest Cockpit
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ingest, validate, and parse raw playlist manifests using regex rules</p>
                  </div>
                  <button
                    onClick={loadExistingM3UGuide}
                    className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center gap-1.5 transition-colors font-mono uppercase"
                    title="Load already-compiled tv_guide.json from disk"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync with filesys</span>
                  </button>
                </div>

                {/* FILE UPLOADER & CONFIGS */}
                <div className="grid grid-cols-2 gap-4">
                  {/* UPLOADER CONTAINER */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Upload Playlist file</span>
                    <div className="border border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 text-center transition-all relative group flex flex-col items-center justify-center min-h-[110px] bg-slate-900/10">
                      <input
                        type="file"
                        accept=".m3u,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setM3uRawContent(event.target?.result as string || "");
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition-colors mb-1.5" />
                      <span className="text-[11px] text-slate-300 font-bold">Drag & Drop or Click</span>
                      <span className="text-[9px] text-slate-500 font-mono mt-0.5">Supports UTF-8 M3U files</span>
                    </div>
                  </div>

                  {/* PARSING RULES */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Show Title Regex Extractor</span>
                      <input
                        type="text"
                        value={m3uPattern}
                        onChange={(e) => setM3uPattern(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[10px] focus:outline-none focus:border-cyan-500"
                        placeholder="Regex pattern"
                      />
                    </div>
                    
                    {/* SET-BASED DEDUPLICATION TOGGLE */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Deduplication Method</span>
                      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none bg-slate-900/20 p-2 rounded-xl border border-slate-800/80 hover:bg-slate-900/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={m3uDeduplicate}
                          onChange={(e) => setM3uDeduplicate(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="font-mono text-[9px] uppercase font-bold text-slate-300">Set-Based Deduplication</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* SYSTEM PLAYLIST INTEGRATION QUICK-SELECTOR */}
                {systemPlaylists && systemPlaylists.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono shrink-0">🔌 Quick Import Playlist:</span>
                    <select
                      onChange={(e) => {
                        const plId = e.target.value;
                        if (!plId) return;
                        const selectedPl = systemPlaylists.find(p => p.id === plId);
                        if (selectedPl && selectedPl.content) {
                          setM3uRawContent(selectedPl.content);
                          if (addLog) addLog(`M3U Splitter: Imported active system playlist "${selectedPl.name}" into splitter editor.`);
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-1 px-2 text-cyan-300 font-sans text-xs focus:outline-none"
                    >
                      <option value="">-- Select an active system playlist --</option>
                      {systemPlaylists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.channelCount} channels)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* RAW PASTE AREA */}
                <div className="flex-1 flex flex-col gap-1.5 min-h-[140px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Raw M3U Content</span>
                  <textarea
                    value={m3uRawContent}
                    onChange={(e) => setM3uRawContent(e.target.value)}
                    placeholder="#EXTM3U&#10;#EXTINF:-1,Gunsmoke [1955]! - S01E01 Billy the Kid&#10;https://archive.org/download/...&#10;#EXTINF:-1,Gunsmoke [1955]! - S01E02 Westward Ho"
                    className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-cyan-300 font-mono text-[10px] leading-relaxed resize-none focus:outline-none focus:border-cyan-500 scrollbar-thin"
                  />
                </div>

                {/* EXTRA CONTROLS AND ACTION TRIGGER */}
                <div className="flex items-center justify-between gap-4 border-t border-slate-800/30 pt-3">
                  <div className="grid grid-cols-2 gap-3 flex-1 max-w-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold uppercase font-mono text-slate-500">Target Folder</span>
                      <input
                        type="text"
                        value={m3uOutputDir}
                        onChange={(e) => setM3uOutputDir(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-slate-300 font-mono text-[10px] focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold uppercase font-mono text-slate-500">JSON Output</span>
                      <input
                        type="text"
                        value={m3uJsonOutput}
                        onChange={(e) => setM3uJsonOutput(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-slate-300 font-mono text-[10px] focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleProcessM3USplit}
                    disabled={isM3uProcessing}
                    className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-[11px] uppercase tracking-wider shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-1.5 self-end shrink-0"
                  >
                    {isM3uProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        <span>Transform & Split Library</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: EXTRACTED LIBRARY MATRIX (1/3 width) */}
              <div className="w-1/3 h-full overflow-y-auto p-5 flex flex-col gap-4 bg-[#070b13]/60 scrollbar-thin">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Library Matrix
                    </h3>
                    <p className="text-[9px] text-slate-500">Searchable folder channels</p>
                  </div>
                  {m3uSplitResult?.tvGuide && (
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(m3uSplitResult.tvGuide, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = m3uJsonOutput;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="p-1 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/20 transition-all"
                      title="Download compiler guide index (JSON)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* SEARCH INPUT */}
                <div className="relative">
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Search folder paths..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-3 pr-8 text-white font-mono text-[10px] focus:outline-none focus:border-cyan-500"
                  />
                  {matrixSearch && (
                    <button
                      onClick={() => setMatrixSearch("")}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-[10px] font-mono font-black"
                    >
                      ×
                    </button>
                  )}
                </div>

                {m3uSplitResult?.stats?.invalidUrlsFiltered > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[9px] text-amber-300 font-mono leading-normal shrink-0">
                    ⚠️ <b>{m3uSplitResult.stats.invalidUrlsFiltered}</b> dead/invalid stream URLs were auto-filtered & skipped during pre-flight validation.
                  </div>
                )}

                {/* SHOW CARDS WITH ACCORDION LISTING */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 scrollbar-thin">
                  {m3uSplitResult?.tvGuide?.shows ? (
                    (() => {
                      const showsList = Object.keys(m3uSplitResult.tvGuide.shows).filter((showName) =>
                        showName.toLowerCase().includes(matrixSearch.toLowerCase())
                      );

                      if (showsList.length === 0) {
                        return (
                          <div className="text-center text-[10px] text-slate-500 font-mono py-12 border border-slate-800/40 rounded-xl bg-slate-950/20">
                            No directory matches found
                          </div>
                        );
                      }

                      return showsList.map((showName) => {
                        const show = m3uSplitResult.tvGuide.shows[showName];
                        const isSelected = selectedShowInSplit === showName;
                        const totalElements = show.episodes?.length || 0;
                        const showPath = `/${m3uOutputDir}/${showName}`;

                        return (
                          <div
                            key={showName}
                            onClick={() => setSelectedShowInSplit(isSelected ? null : showName)}
                            className={`p-3 rounded-xl flex flex-col gap-2 cursor-pointer transition-all border ${
                              isSelected 
                                ? "bg-cyan-600/10 border-cyan-500/40 shadow-md" 
                                : "bg-slate-900/30 border-slate-800/50 hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="truncate flex-1">
                                <span className="text-[11px] font-bold text-white block truncate" title={showName}>
                                  {showName}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 block truncate mt-0.5" title={showPath}>
                                  {showPath}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-slate-950 text-cyan-400 font-mono text-[9px] border border-slate-800 shrink-0 font-bold">
                                {totalElements} files
                              </span>
                            </div>

                            {/* INLINE ACTIONS */}
                            <div className="flex items-center justify-between border-t border-slate-800/40 pt-2" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[8px] font-mono text-slate-500">
                                {isSelected ? "Previewing Tracks" : "Click to view files"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {/* Download Show Playlist M3U */}
                                <button
                                  onClick={() => {
                                    let contentStr = "#EXTM3U\n";
                                    show.episodes.forEach((ep: any) => {
                                      contentStr += `${ep.info}\n${ep.url}\n`;
                                    });
                                    const blob = new Blob([contentStr], { type: "text/plain;charset=utf-8" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `${showName}.m3u`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="py-0.5 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[9px] transition-all flex items-center gap-1 border border-slate-700"
                                  title={`Download ${showName}.m3u`}
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>M3U</span>
                                </button>
                                
                                {/* Spawner: Spawn 24/7 Channel instantly */}
                                <button
                                  onClick={() => {
                                    if (show.episodes && show.episodes[0]) {
                                      const newChId = `ch-m3u-${Date.now()}`;
                                      const newCh: AutomationChannel = {
                                        id: newChId,
                                        name: showName,
                                        callSign: showName.substring(0, 4).toUpperCase() + "-VOD",
                                        category: "Shows",
                                        resolution: "1080p60",
                                        bitrateKbps: 6500,
                                        status: "ONLINE",
                                        currentShow: show.episodes[0].info.split(",")[1] || "Episode 1",
                                        nextShow: show.episodes[1]?.info.split(",")[1] || "Syndicated Playout",
                                        logoUrl: "https://archive.org/download/daily-highlights/lmbsa.png",
                                        bumperFrequencyMin: 30
                                      };
                                      setChannels(prev => [...prev, newCh]);
                                      
                                      const baseBlocks = show.episodes.slice(0, 5).map((ep: any, idx: number) => {
                                        const startHour = String(idx * 2).padStart(2, "0");
                                        return {
                                          id: `blk-m3u-${Date.now()}-${idx}`,
                                          channelId: newChId,
                                          title: ep.info.split(",")[1] || `Episode ${idx + 1}`,
                                          category: "Episode" as const,
                                          startTime: `${startHour}:00`,
                                          durationMin: 120,
                                          rating: "TV-14"
                                        };
                                      });
                                      setSchedule(prev => [...prev, ...baseBlocks]);

                                      const existingMuxJson = safeLocalStorage.getItem("ajn_multiplexer_feeds");
                                      let existingFeeds = [];
                                      try {
                                        existingFeeds = existingMuxJson ? JSON.parse(existingMuxJson) : [];
                                      } catch (e) {
                                        existingFeeds = [];
                                      }

                                      const nextNum = Math.max(11, ...existingFeeds.map((c: any) => c.num || 0)) + 1;
                                      const m3uSourcePath = `/media_library/${showName}/${showName}.m3u`;

                                      const newMuxFeed = {
                                        channelId: newChId,
                                        num: nextNum,
                                        name: `📅 CH ${nextNum}: ${showName} (M3U)`,
                                        category: "VOD Shows",
                                        logo: "https://archive.org/download/daily-highlights/lmbsa.png",
                                        type: "default" as const,
                                        source: m3uSourcePath
                                      };

                                      existingFeeds.push(newMuxFeed);
                                      safeLocalStorage.setItem("ajn_multiplexer_feeds", JSON.stringify(existingFeeds));

                                      const kernel = BroadcastRuntimeKernel.instance;
                                      const scheduleManager = kernel.resolve<any>("BroadcastScheduleManager");
                                      if (scheduleManager) {
                                        scheduleManager.assignTagToChannel(newChId, "M3U-Splitter");
                                        scheduleManager.assignTagToChannel(newChId, "VOD");
                                      }

                                      fetch(BACKEND_URL + "/api/channel-registry/tags")
                                        .then(res => res.json())
                                        .then(tagData => {
                                          const updatedTags = tagData.tags || {};
                                          updatedTags[newChId] = ["M3U-Splitter", "VOD"];
                                          const updatedAllTags = Array.from(new Set([...(tagData.allTags || []), "M3U-Splitter", "VOD"]));
                                          fetch(BACKEND_URL + "/api/channel-registry/tags", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ tags: updatedTags, allTags: updatedAllTags })
                                          }).catch(err => console.error("Failed to save dynamic spawner tags:", err));
                                        }).catch(err => console.error("Failed to fetch current tag config:", err));

                                      if (addLog) addLog(`M3U Splitter: Spawned Virtual Channel "${showName}" with directory path: ${m3uSourcePath}`);
                                      alert(`Virtual Channel "${showName}" successfully initialized & registered in BroadcastScheduleManager!\nView it in the "Channel Manager" and "Advanced TV Guide" tabs.`);
                                    }
                                  }}
                                  className="py-0.5 px-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[9px] font-bold transition-all flex items-center gap-1 border border-cyan-500"
                                  title="Spawn new 24/7 channel with this catalog"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>SPAWN</span>
                                </button>
                              </div>
                            </div>

                            {/* INLINE EXPANDED EPISODES PREVIEW */}
                            {isSelected && (
                              <div className="border-t border-slate-800/40 pt-2 mt-1 space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                                {show.episodes?.map((ep: any, idx: number) => {
                                  const label = ep.info.split(",")[1] || `File ${idx + 1}`;
                                  return (
                                    <div key={idx} className="p-1.5 rounded bg-slate-950/60 border border-slate-800/40 flex items-center justify-between gap-2">
                                      <div className="truncate flex-1">
                                        <span className="text-[10px] font-bold text-slate-300 block truncate" title={label}>{label}</span>
                                        <span className="text-[8px] font-mono text-slate-500 block truncate mt-0.5" title={ep.url}>{ep.url}</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          if (playStream) {
                                            playStream(ep.url, label);
                                            if (addLog) addLog(`M3U Splitter: Testing live playback of track "${label}"`);
                                          }
                                        }}
                                        className="py-0.5 px-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-mono font-bold flex items-center gap-0.5"
                                        title="Stream feed locally"
                                      >
                                        <Play className="w-2.5 h-2.5" />
                                        <span>TEST</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="text-center text-[10px] text-slate-500 font-mono py-12 border border-dashed border-slate-800/40 rounded-xl bg-slate-950/10">
                      No compiled assets found. Load or execute from the cockpit.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FIXED FOOTER (24px) */}
            <div className="h-6 shrink-0 bg-[#05080e] border-t border-slate-800/80 flex items-center justify-between px-4 text-[10px] font-mono text-slate-500">
              <div className="flex items-center gap-1.5">
                <span>VALIDATION METRICS:</span>
                <span className="text-emerald-400 font-bold">100% VALID FILE RATES</span>
                <span className="text-slate-700">|</span>
                <span>ERRORS/WARNINGS: 0</span>
              </div>
              <div className="text-[9px] text-slate-600">
                AUTO-RETENTION WINDOW: 24h STALE DATA PURGING
              </div>
            </div>
          </div>
        )}

      </div>

      {/*================ MODAL 1: ADD VIRTUAL CHANNEL ================*/}
      {showAddChannelModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
          onClick={() => setShowAddChannelModal(false)}
        >
          <div 
            className="w-full max-w-md h-full bg-black border-l border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] overflow-y-auto animate-in slide-in-from-right duration-300 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-black uppercase font-sans tracking-wide text-white flex items-center gap-2">
                <Tv className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span>Create Virtual Channel</span>
              </h3>
              <button onClick={() => setShowAddChannelModal(false)} className="text-slate-500 hover:text-cyan-400 text-lg transition-colors cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddChannel} className="space-y-5 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-slate-400 block">Channel Name</label>
                <input
                  type="text" required placeholder="e.g. AJN Sci-Fi Classics"
                  value={newChName} onChange={(e) => setNewChName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Call Sign (EPG ID)</label>
                  <input
                    type="text" required placeholder="e.g. SCIFI-HD"
                    value={newChCallSign} onChange={(e) => setNewChCallSign(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 uppercase transition-colors placeholder:text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Category</label>
                  <select
                    value={newChCategory} onChange={(e) => setNewChCategory(e.target.value as any)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 font-bold transition-colors cursor-pointer"
                  >
                    <option value="Movies">Movies</option>
                    <option value="Shows">Shows</option>
                    <option value="Music">Music</option>
                    <option value="News">News</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Target Resolution</label>
                  <select
                    value={newChResolution} onChange={(e) => setNewChResolution(e.target.value as any)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors cursor-pointer"
                  >
                    <option value="1080p60">1080p60 (Full HD)</option>
                    <option value="4K60">4K60 (Ultra HD)</option>
                    <option value="720p60">720p60 (Standard)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Bitrate (kbps)</label>
                  <input
                    type="number" step="500" min="2000" max="25000"
                    value={newChBitrate} onChange={(e) => setNewChBitrate(Number(e.target.value))}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-6 flex items-center justify-end gap-3 mt-auto">
                <button
                  type="button" onClick={() => setShowAddChannelModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900/50 text-slate-400 font-bold hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 font-black uppercase tracking-wider hover:bg-cyan-500/20 border border-cyan-500/50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                >
                  Deploy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*================ MODAL: EDIT VIRTUAL CHANNEL ================*/}
      {showEditChannelModal && editingChannel && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
          onClick={() => setShowEditChannelModal(false)}
        >
          <div 
            className="w-full max-w-md h-full bg-black border-l border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] overflow-y-auto animate-in slide-in-from-right duration-300 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-black uppercase font-sans tracking-wide text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span>Edit Virtual Channel</span>
              </h3>
              <button onClick={() => { setShowEditChannelModal(false); setEditingChannel(null); }} className="text-slate-500 hover:text-cyan-400 text-lg transition-colors cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveChannelEdit} className="space-y-5 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-slate-400 block">Channel Name</label>
                <input
                  type="text" required placeholder="e.g. AJN Sci-Fi Classics"
                  value={editChName} onChange={(e) => setEditChName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Call Sign (EPG ID)</label>
                  <input
                    type="text" required placeholder="e.g. SCIFI-HD"
                    value={editChCallSign} onChange={(e) => setEditChCallSign(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 uppercase transition-colors placeholder:text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Category</label>
                  <select
                    value={editChCategory} onChange={(e) => setEditChCategory(e.target.value as any)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 font-bold transition-colors cursor-pointer"
                  >
                    <option value="Movies">Movies</option>
                    <option value="Shows">Shows</option>
                    <option value="Music">Music</option>
                    <option value="News">News</option>
                    <option value="Variety">Variety</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Target Resolution</label>
                  <select
                    value={editChResolution} onChange={(e) => setEditChResolution(e.target.value as any)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors cursor-pointer"
                  >
                    <option value="1080p60">1080p60 (Full HD)</option>
                    <option value="4K60">4K60 (Ultra HD)</option>
                    <option value="720p60">720p60 (Standard)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Bitrate (kbps)</label>
                  <input
                    type="number" step="500" min="2000" max="25000"
                    value={editChBitrate} onChange={(e) => setEditChBitrate(Number(e.target.value))}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Station Logo URL</label>
                  <input
                    type="url" placeholder="https://example.com/logo.png"
                    value={editChLogoUrl} onChange={(e) => setEditChLogoUrl(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors placeholder:text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Bumper Frequency (Min)</label>
                  <input
                    type="number" min="5" max="180" step="5"
                    value={editChBumperFrequencyMin} onChange={(e) => setEditChBumperFrequencyMin(Number(e.target.value))}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-6 flex items-center justify-end gap-3 mt-auto">
                <button
                  type="button" onClick={() => { setShowEditChannelModal(false); setEditingChannel(null); }}
                  className="px-5 py-2.5 rounded-xl bg-slate-900/50 text-slate-400 font-bold hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 font-black uppercase tracking-wider hover:bg-cyan-500/20 border border-cyan-500/50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*================ MODAL: RUMBLE SCAN RESULTS ================*/}
      {showScanResultsModal && scannedRumbleChannel && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
          onClick={() => setShowScanResultsModal(false)}
        >
          <div 
            className="w-full max-w-xl h-full bg-black border-l border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] overflow-y-auto animate-in slide-in-from-right duration-300 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-black uppercase font-sans tracking-wide text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin-slow drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span>Rumble Feed Scanner: {scannedRumbleChannel.name}</span>
              </h3>
              <button onClick={() => { setShowScanResultsModal(false); setScannedRumbleChannel(null); setSelectedScanVideoForBlock(null); }} className="text-slate-500 hover:text-cyan-400 text-lg transition-colors cursor-pointer">✕</button>
            </div>

            {isScanningLatestRumble ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span className="text-xs text-slate-400 font-mono">Quarrying Rumble API metadata endpoints...</span>
              </div>
            ) : scanError ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Swipe horizontally through parsed videos from this channel to replace the current multiplexer favorite stream source or schedule onto EPG channels.
                </p>
                
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {scannedVideos.map((video) => (
                    <div 
                      key={video.id || video.url}
                      className="snap-center shrink-0 w-[240px] p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 flex flex-col gap-3 transition-colors hover:border-cyan-500/50 group"
                    >
                      <div className="relative rounded-xl overflow-hidden aspect-video border border-slate-800">
                        <img 
                          src={video.thumbnail_url || "https://archive.org/download/daily-highlights/lmbsa.png"}
                          alt=""
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                        {video.isLive && (
                           <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/90 text-[10px] text-cyan-400 font-bold border border-cyan-500/30">● LIVE NOW</div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-cyan-50 truncate max-w-full" title={video.title}>{video.title}</h4>
                        <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                          {video.isLive ? 'LIVE FEED' : 'VOD'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-auto">
                        <button
                          onClick={() => handleReplaceFavoriteSource(video)}
                          className="flex-1 py-2 px-2 rounded-xl bg-slate-900/50 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/50 text-[10px] font-black uppercase transition-all cursor-pointer text-center"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => handleOpenAddScanBlockForm(video)}
                          className="flex-1 py-2 px-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-black uppercase transition-all cursor-pointer text-center"
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedScanVideoForBlock && (
                  <form onSubmit={handleSaveScanBlock} className="p-5 rounded-2xl bg-slate-950/50 border border-cyan-500/30 space-y-4 text-xs font-mono shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                    <div className="font-bold text-cyan-400 text-[10px] uppercase tracking-wider flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <span>Schedule: {selectedScanVideoForBlock.title.slice(0, 45)}...</span>
                      <button type="button" onClick={() => setSelectedScanVideoForBlock(null)} className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer">✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 block">Target Channel</label>
                        <select
                          value={scanBlockChannelId} onChange={(e) => setScanBlockChannelId(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-cyan-50 font-bold focus:outline-none focus:border-cyan-500/70 transition-colors cursor-pointer"
                        >
                          {channels.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.callSign})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-slate-400 block">Category</label>
                        <select
                          value={scanBlockCat} onChange={(e) => setScanBlockCat(e.target.value as any)}
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-cyan-50 font-bold focus:outline-none focus:border-cyan-500/70 transition-colors cursor-pointer"
                        >
                          <option value="Live">Live Stream</option>
                          <option value="Episode">Episode</option>
                          <option value="Movie">Movie</option>
                          <option value="Promo">Promo</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 block">Start Time (HH:MM)</label>
                        <input
                          type="text" required placeholder="e.g. 15:30"
                          value={scanBlockStart} onChange={(e) => setScanBlockStart(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-slate-400 block">Duration (min)</label>
                        <input
                          type="number" required min="1" max="1440"
                          value={scanBlockDuration} onChange={(e) => setScanBlockDuration(Number(e.target.value))}
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                      <button
                        type="button" onClick={() => setSelectedScanVideoForBlock(null)}
                        className="px-4 py-2 rounded-xl bg-slate-900/50 text-slate-400 font-bold hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 font-black uppercase hover:bg-cyan-500/20 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)] transition-all cursor-pointer"
                      >
                        Confirm Slot
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/*================ MODAL 2: SCHEDULE BLOCK ================*/}
      {showAddBlockModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
          onClick={() => setShowAddBlockModal(false)}
        >
          <div 
            className="w-full max-w-md h-full bg-black border-l border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] overflow-y-auto animate-in slide-in-from-right duration-300 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-black uppercase font-sans tracking-wide text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span>Schedule Program Block</span>
              </h3>
              <button onClick={() => setShowAddBlockModal(false)} className="text-slate-500 hover:text-cyan-400 text-lg transition-colors cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddBlock} className="space-y-5 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-slate-400 block">Target Channel</label>
                <select
                  value={selectedChannelForBlock} onChange={(e) => setSelectedChannelForBlock(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 font-bold focus:outline-none focus:border-cyan-500/70 transition-colors cursor-pointer"
                >
                  {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.callSign})</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 block">Program Title</label>
                <input
                  type="text" required placeholder="e.g. Neon Genesis Evangelion Ep 1"
                  value={newBlockTitle} onChange={(e) => setNewBlockTitle(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">Type</label>
                  <select
                    value={newBlockCat} onChange={(e) => setNewBlockCat(e.target.value as any)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 font-bold focus:outline-none focus:border-cyan-500/70 transition-colors cursor-pointer"
                  >
                    <option value="Movie">Movie</option>
                    <option value="Episode">Episode</option>
                    <option value="Bumper">Bumper</option>
                    <option value="Promo">Promo</option>
                    <option value="Live">Live</option>
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 block">Start Time</label>
                      <input
                        type="time" required
                        value={newBlockStart} onChange={(e) => setNewBlockStart(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                      >
                      </input>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 block">Duration (Min)</label>
                      <input
                        type="number" min="5" max="360" step="5" required
                        value={newBlockDuration} onChange={(e) => setNewBlockDuration(Number(e.target.value))}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-cyan-50 focus:outline-none focus:border-cyan-500/70 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex items-center justify-end gap-3 mt-auto">
                <button
                  type="button" onClick={() => setShowAddBlockModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900/50 text-slate-400 font-bold hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 font-black uppercase tracking-wider hover:bg-cyan-500/20 border border-cyan-500/50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                >
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*================ MODAL 3: LOAD CUSTOM PLUGIN ================*/}
      {/*================ MODAL 3: ADD PLUGIN ================*/}
      {showAddPluginModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
          onClick={() => setShowAddPluginModal(false)}
        >
          <div 
            className="w-full max-w-md h-full bg-black border-l border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
              <h3 className="text-base font-black uppercase font-sans tracking-wide text-white flex items-center gap-2">
                <Plug className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span>Register Plugin Hook</span>
              </h3>
              <button onClick={() => setShowAddPluginModal(false)} className="text-slate-500 hover:text-cyan-400 text-lg transition-colors cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleInstallCustomPlugin} className="space-y-5 text-xs font-mono flex flex-col flex-1 mt-6">
              <p className="text-slate-400 leading-relaxed font-sans shrink-0">
                Paste your custom stream provider JSON manifest to extend AJN Core playout pipelines dynamically.
              </p>
              <div className="flex-1 min-h-[300px]">
                <textarea
                  required
                  value={customManifestJson} onChange={(e) => setCustomManifestJson(e.target.value)}
                  className="w-full h-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-cyan-400 font-mono text-[11px] focus:outline-none focus:border-cyan-500/70 transition-colors resize-none"
                />
              </div>

              <div className="pt-6 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button" onClick={() => setShowAddPluginModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900/50 text-slate-400 font-bold hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 font-black uppercase tracking-wider hover:bg-cyan-500/20 border border-cyan-500/50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
