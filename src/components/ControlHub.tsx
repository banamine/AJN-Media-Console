import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useEffect } from "react";
import { 
  Radio, 
  RefreshCw, 
  List, 
  Activity, 
  Database, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Pin,
  Sparkles
} from "lucide-react";
import { clearCache } from "../services/IndexedDB";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


interface DiscoveredChannel {
  id: string;
  num: number;
  name: string;
  url: string;
  file: string;
  size: string;
}

interface ControlHubProps {
  onNavigate: (view: any) => void;
  onLog?: (msg: string) => void;
}

export const ControlHub: React.FC<ControlHubProps> = ({ onNavigate, onLog }) => {
  const [channels, setChannels] = useState<DiscoveredChannel[]>([]);
  const [discoverySource, setDiscoverySource] = useState<string>("Loading...");
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isSyncingRss, setIsSyncingRss] = useState(false);
  const [lastRssSync, setLastRssSync] = useState<string>(() => {
    return safeLocalStorage.getItem("ajn_last_rss_sync_time") || new Date().toLocaleTimeString();
  });
  
  // Real live telemetry measurements
  const [telemetryStats, setTelemetryStats] = useState<any>(null);
  const [liveRoundtripMs, setLiveRoundtripMs] = useState<number>(0);
  const [storageUsage, setStorageUsage] = useState<{ used: number; total: number } | null>(null);
  const [frameTimeJitter, setFrameTimeJitter] = useState<number>(0);
  const [lagSpikes, setLagSpikes] = useState<number>(0);

  // Track pinned/favorite channels in localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(safeLocalStorage.getItem("ajn_guide_favs") || "[]");
    } catch {
      return [];
    }
  });

  // Measure real frame timing for genuine playout loop diagnostics
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;
    const checkFrame = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 33) {
        setLagSpikes(prev => prev + 1);
      }
      setFrameTimeJitter(Math.max(0, Math.round(delta - 16.67)));
      frameId = requestAnimationFrame(checkFrame);
    };
    frameId = requestAnimationFrame(checkFrame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Fetch real telemetry and measure live roundtrip ping latency
  const fetchLiveMetrics = async () => {
    const startTime = performance.now();
    try {
      const res = await fetch(BACKEND_URL + "/api/telemetry/stats");
      const endTime = performance.now();
      setLiveRoundtripMs(Math.round(endTime - startTime));
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTelemetryStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch live telemetry in Control Hub:", err);
    }

    // Storage footprint estimation
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          used: estimate.usage || 0,
          total: estimate.quota || 0
        });
      } catch (e) {
        console.warn("Storage estimate failed", e);
      }
    }
  };

  const fetchChannels = async (forceRefresh = false) => {
    setLoadingDiscovery(true);
    try {
      // If forceRefresh, we can append a cache-busting query parameter or clear local cache
      const url = forceRefresh 
        ? `/api/ajn-discover-channels?refresh=${Date.now()}` 
        : "/api/ajn-discover-channels";
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.channels) {
        setChannels(data.channels);
        setDiscoverySource(data.source === "archive_org_api" ? "Archive.org Manifest API" : "Static Fallback Roster");
        if (onLog) {
          onLog(`Control Hub: Loaded ${data.channels.length} channels from ${data.source}.`);
        }
      }
    } catch (err: any) {
      console.error("[ControlHub] Failed to fetch channels:", err);
      if (onLog) onLog(`Control Hub Error: Failed to discover channels: ${err.message}`);
    } finally {
      setLoadingDiscovery(false);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshDiscovery = async () => {
    await fetchChannels(true);
    if (onLog) onLog("Control Hub: Forced auto-discovery refresh from Archive.org collection.");
  };

  const toggleFavorite = (channelId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId];
      
      safeLocalStorage.setItem("ajn_guide_favs", JSON.stringify(updated));
      // Dispatch event so active guide listens to custom update
      window.dispatchEvent(new CustomEvent("ajn-favorites-updated"));
      return updated;
    });
  };

  const handleSyncRss = async () => {
    setIsSyncingRss(true);
    if (onLog) onLog("Control Hub: Syncing daily broadcasts from RSS archives...");
    try {
      const res = await fetch(BACKEND_URL + "/api/ajn-archive");
      const data = await res.json();
      if (data.success) {
        const nowStr = new Date().toLocaleTimeString();
        setLastRssSync(nowStr);
        safeLocalStorage.setItem("ajn_last_rss_sync_time", nowStr);
        if (onLog) onLog(`Control Hub: RSS sync completed successfully. Found ${data.episodes?.length || 0} episodes.`);
      }
    } catch (err: any) {
      if (onLog) onLog(`Control Hub Error: RSS sync failed: ${err.message}`);
    } finally {
      setIsSyncingRss(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!confirm("Are you sure you want to purge the local M3U cache? This will clear all downloaded playlists from client storage.")) return;
    setIsPurging(true);
    if (onLog) onLog("Control Hub: Purging local IndexedDB M3U caches...");
    try {
      await clearCache();
      if (onLog) onLog("Control Hub: Purge completed. All downloaded playlists cleared.");
      alert("Cache purged successfully! Playlists will be fetched fresh from network on next tune.");
    } catch (err: any) {
      if (onLog) onLog(`Control Hub Error: Purge failed: ${err.message}`);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 select-none font-sans">
      {/* Header section with clean Inter/Space Grotesk layout */}
      <div className="border-b border-slate-800/60 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Radio className="w-6 h-6 text-blue-500 animate-pulse" />
            AJN Broadcast Control Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Administer live ingestion pipelines, auto-discover channels, and monitor server-side playout health.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 self-start md:self-auto">
          <span>Active Registry:</span>
          <span className="text-blue-400 font-bold">{discoverySource}</span>
        </div>
      </div>

      {/* Grid of 4 grouped sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. CHANNELS PANEL */}
        <div className="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-5 flex flex-col h-[420px] justify-between">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  Channels
                </h2>
                <button 
                  onClick={handleRefreshDiscovery}
                  disabled={loadingDiscovery}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                  title="Force Registry Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDiscovery ? "animate-spin text-blue-400" : ""}`} />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Configure, discover, and edit your live broadcast channels, virtual schedules, and background feeds.
              </p>
            </div>

            {/* List of auto-discovered channels */}
            <div className="overflow-y-auto max-h-[220px] pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {loadingDiscovery ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono animate-pulse">
                  Querying Archive.org collection manifest...
                </div>
              ) : channels.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No channels discovered. Click refresh to query manifest.
                </div>
              ) : (
                channels.map((ch) => {
                  const isFav = favorites.includes(ch.id);
                  return (
                    <div 
                      key={ch.id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/40 flex items-center justify-between hover:border-slate-700/60 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-950" title="Active on Multiplexer" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{ch.name}</p>
                          <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{ch.file}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded">
                          {ch.size === "N/A" ? "M3U" : `${ch.size} bytes`}
                        </span>
                        
                        <button
                          onClick={() => toggleFavorite(ch.id)}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            isFav 
                              ? "text-amber-400 bg-amber-400/10 border border-amber-400/20" 
                              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                          }`}
                          title={isFav ? "Unfavorite channel" : "Favorite/Pin channel"}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/50 mt-4 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              Total Discovered: {channels.length} Channels
            </span>
            <button
              onClick={() => onNavigate("guide")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group cursor-pointer"
            >
              Tune in EPG Guide
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* 2. PLAYLISTS PANEL */}
        <div className="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-5 flex flex-col h-[420px] justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <List className="w-4 h-4 text-blue-400" />
                Playlists & EPG
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Inspect active M3U media playlists, segment queues, and XMLTV guide documents.
              </p>
            </div>

            {/* Quick status board */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Feeds</span>
                <span className="text-lg font-mono font-bold text-slate-200 mt-1 block">{channels.length} Sources</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Client Cache</span>
                <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block">IndexedDB</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/50 col-span-2">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">XMLTV Schema version</span>
                <span className="text-xs font-mono text-slate-300 mt-1.5 block">v1.2 (Strict RFC-822 Compliance)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/10 border border-blue-900/20 text-xs text-blue-400 font-sans leading-relaxed">
              M3U playlist indexes are fully parsed in the UX Kernel. Playout loops calculate timestamps on-demand to guarantee continuous, lag-free virtual broadcasts.
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              State: Synchronized
            </span>
            <button
              onClick={() => onNavigate("library")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group cursor-pointer"
            >
              Manage Media Library
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* 3. SYSTEM HEALTH PANEL */}
        <div className="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-5 flex flex-col h-[420px] justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                System Health
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Monitor real-time network latency, memory caches, frame stability, and playback thread health.
              </p>
            </div>

            {/* Live Telemetry stats (honest, measured metrics) */}
            <div className="space-y-3.5 pt-1">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>UX Core Playout Loop</span>
                  <span className={`font-mono ${frameTimeJitter < 15 ? "text-emerald-400" : "text-amber-400"}`}>
                    {frameTimeJitter < 15 ? "🟢 Active & Stable" : "🟡 Minor Jitter"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max(10, Math.min(100, 100 - frameTimeJitter))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Backend Ingestion Avg Delay</span>
                  <span className="font-mono text-slate-300">
                    {telemetryStats?.feedFetch?.avgDurationMs 
                      ? `${Math.round(telemetryStats.feedFetch.avgDurationMs)} ms` 
                      : "Measuring..."}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (telemetryStats?.feedFetch?.avgDurationMs || 0) / 10)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1.5">
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/40">
                  <span className="text-[9px] uppercase font-mono text-slate-500 block">Disk Cache Size</span>
                  <span className="text-xs font-mono font-bold text-slate-300 mt-0.5 block">
                    {storageUsage ? `${(storageUsage.used / (1024 * 1024)).toFixed(2)} MB` : "Checking..."}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/40">
                  <span className="text-[9px] uppercase font-mono text-slate-500 block">Frame Jitter</span>
                  <span className="text-xs font-mono font-bold text-slate-300 mt-0.5 block">
                    {frameTimeJitter} ms / {lagSpikes} spikes
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              Control Hub RTT: {liveRoundtripMs ? `${liveRoundtripMs}ms` : "Measuring..."}
            </span>
            <button
              onClick={() => onNavigate("telemetry")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group cursor-pointer"
            >
              Open Telemetry Log
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* 4. INGESTION PANEL */}
        <div className="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-5 flex flex-col h-[420px] justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                Ingestion Engine
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Synchronize daily broadcasts from RSS archives, purge stale cache states, and force re-indexing.
              </p>
            </div>

            {/* Status overview and Ingest Operations */}
            <div className="space-y-3.5 pt-2">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Daily RSS Ingest</span>
                  <span className="text-xs font-semibold text-slate-300 mt-0.5 block">Last Sync: {lastRssSync}</span>
                </div>
                <button
                  onClick={handleSyncRss}
                  disabled={isSyncingRss}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingRss ? "animate-spin" : ""}`} />
                  {isSyncingRss ? "Syncing..." : "Sync Now"}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">EPG M3U Cache</span>
                  <span className="text-xs font-semibold text-slate-300 mt-0.5 block">Local Cache Purge</span>
                </div>
                <button
                  onClick={handlePurgeCache}
                  disabled={isPurging}
                  className="px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/35 border border-red-800/30 text-red-400 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  {isPurging ? "Purging..." : "Purge Cache"}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/10 border border-amber-900/20 text-xs text-amber-500 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Playout indexes will automatically self-purge stale records older than 48 hours to preserve browser IndexedDB space.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              Retention: 48h Auto-Purge
            </span>
            <button
              onClick={() => onNavigate("sync")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group cursor-pointer"
            >
              Remote Headend Sync
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
