import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useMemo } from "react";
import { ScheduleShow } from "../types/tvGuide";
import { 
  Search, Play, Filter, Calendar, Info, Library, Sparkles, 
  ChevronLeft, ChevronRight, Loader2, Tv, Headphones, Download, 
  Eye, Globe, RefreshCw, X 
} from "lucide-react";
import { toastService } from "../utils/toast";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


const SEARCH_PRESETS = [
  { label: "Alex Jones Show", query: "Alex Jones Show" },
  { label: "War Room", query: "War Room" },
  { label: "Shortwave Radio", query: "Shortwave Radio" },
  { label: "Space Exploration", query: "Space Exploration" },
  { label: "Classic IPTV", query: "Classic IPTV" },
  { label: "Retro Broadcasts", query: "Retro Broadcasts" },
  { label: "Vintage Sci-Fi", query: "Sci-Fi Radio" },
  { label: "Conspiracy Archive", query: "Conspiracy" }
];

interface ArchiveComponentProps {
  schedule: ScheduleShow[];
  onPlayShow: (show: ScheduleShow) => void;
}

export const ArchiveComponent: React.FC<ArchiveComponentProps> = ({ schedule, onPlayShow }) => {
  // Navigation: Toggle between Local Guide vault and Remote Archive.org Search
  const [activeTab, setActiveTab] = useState<"local" | "remote">("local");

  // Local state
  const [localQuery, setLocalQuery] = useState("");
  const [localFilterType, setLocalFilterType] = useState<"all" | "live" | "archive" | "special">("all");

  // Remote state
  const [remoteQuery, setRemoteQuery] = useState("Alex Jones");
  const [remoteMediaFilter, setRemoteMediaFilter] = useState<"all" | "video" | "audio">("all");
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remotePage, setRemotePage] = useState(1);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Inspection states (for viewing files in a selected remote collection)
  const [inspectingItem, setInspectingItem] = useState<any | null>(null);
  const [inspectingLoading, setInspectingLoading] = useState(false);
  const [inspectingError, setInspectingError] = useState<string | null>(null);

  // Scheduling states inside remote search inspector
  const [schedulingFileIndex, setSchedulingFileIndex] = useState<number | null>(null);
  const [selectedSchedChannel, setSelectedSchedChannel] = useState("ch-1");
  const [selectedSchedHour, setSelectedSchedHour] = useState("12:00");

  // 1. Local Search Filter Logic
  const localArchiveShows = useMemo(() => {
    return schedule.filter((show) => {
      const matchQuery =
        show.title.toLowerCase().includes(localQuery.toLowerCase()) ||
        (show.description && show.description.toLowerCase().includes(localQuery.toLowerCase()));
      const matchType = localFilterType === "all" || show.showType === localFilterType;
      return matchQuery && matchType;
    });
  }, [schedule, localQuery, localFilterType]);

  // 2. Remote Archive.org Search Call (Advanced Search API with Pagination & JSON output)
  const handleRemoteSearch = async (targetPage = 1, queryOverride?: string) => {
    const searchQueryStr = queryOverride !== undefined ? queryOverride : remoteQuery;
    if (!searchQueryStr.trim()) return;
    setRemoteLoading(true);
    setRemoteError(null);
    setRemotePage(targetPage);

    let mediatypeParam = "";
    if (remoteMediaFilter === "video") {
      mediatypeParam = "video";
    } else if (remoteMediaFilter === "audio") {
      mediatypeParam = "audio";
    } else {
      mediatypeParam = "video OR audio";
    }

    try {
      const response = await fetch(BACKEND_URL + `/api/archive/search?q=${encodeURIComponent(searchQueryStr)}&mediatype=${encodeURIComponent(
          mediatypeParam
        )}&page=${targetPage}&rows=20`
      );
      const data = await response.json();
      if (data.success) {
        setRemoteResults(data.results || []);
        setRemoteTotal(data.totalResults || 0);
      } else {
        setRemoteError(data.error || "An error occurred while querying Archive.org.");
      }
    } catch (err: any) {
      setRemoteError(err.message || "Failed to reach search proxy.");
    } finally {
      setRemoteLoading(false);
    }
  };

  const getAvailableChannels = () => {
    try {
      const saved = safeLocalStorage.getItem("ajn_auto_channels");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "ch-1", name: "AJN Action 24/7", callSign: "AJNA-HD" },
      { id: "ch-2", name: "Retro Sci-Fi Network", callSign: "RSFI-TV" },
      { id: "ch-3", name: "Smooth Jazz & Synth Lounge", callSign: "JAZZ-AUDIO" },
      { id: "ch-4", name: "Syndicated Global News", callSign: "SGN-LIVE" }
    ];
  };

  const handleAddToSchedule = (file: any, parentItem: any) => {
    try {
      const isVideo = file.fileType?.toLowerCase().includes("video") || file.name.endsWith(".mp4") || file.name.endsWith(".m4v");
      const savedSchedule = safeLocalStorage.getItem("ajn_auto_schedule");
      let currentSchedule = [];
      if (savedSchedule) {
        try {
          currentSchedule = JSON.parse(savedSchedule);
        } catch {}
      } else {
        currentSchedule = [
          { id: "blk-1", channelId: "ch-1", title: "Cyberpunk Edgerunners Ep 4", category: "Episode", startTime: "00:00", durationMin: 30, rating: "TV-MA" },
          { id: "blk-2", channelId: "ch-1", title: "AJN Station ID Bumper", category: "Bumper", startTime: "00:30", durationMin: 5, rating: "NR" },
          { id: "blk-3", channelId: "ch-1", title: "Blade Runner 2049", category: "Movie", startTime: "00:35", durationMin: 165, rating: "R" },
          { id: "blk-4", channelId: "ch-2", title: "Stargate SG-1 • S2E15", category: "Episode", startTime: "00:00", durationMin: 45, rating: "TV-PG" },
          { id: "blk-5", channelId: "ch-2", title: "Sci-Fi Network Promo", category: "Promo", startTime: "00:45", durationMin: 15, rating: "NR" },
          { id: "blk-6", channelId: "ch-2", title: "Farscape • S1E01", category: "Episode", startTime: "01:00", durationMin: 60, rating: "TV-14" },
          { id: "blk-7", channelId: "ch-3", title: "Midnight Tokyo Chillout", category: "Live", startTime: "00:00", durationMin: 180, rating: "G" },
          { id: "blk-8", channelId: "ch-4", title: "World Market Hour", category: "Live", startTime: "00:00", durationMin: 60, rating: "NR" }
        ];
      }

      const durationMin = Math.round(file.duration / 60) || 45;
      const newBlock = {
        id: `blk-archive-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        channelId: selectedSchedChannel,
        title: file.title || file.name,
        category: isVideo ? "Movie" : "Episode",
        startTime: selectedSchedHour,
        durationMin: durationMin,
        rating: "NR",
        thumbnailUrl: `https://archive.org/services/img/${parentItem.identifier}`
      };

      const updatedSchedule = [...currentSchedule, newBlock];
      safeLocalStorage.setItem("ajn_auto_schedule", JSON.stringify(updatedSchedule));
      
      // Dispatch custom sync event
      window.dispatchEvent(new Event("ajn_schedule_updated"));

      const channelsList = getAvailableChannels();
      const targetChannelName = channelsList.find((c: any) => c.id === selectedSchedChannel)?.name || selectedSchedChannel;

      toastService.show({
        type: "success",
        title: "📺 Added to Playout Schedule",
        message: `Successfully scheduled "${file.title || file.name}" for ${selectedSchedHour} on ${targetChannelName}`,
        duration: 5000
      });

      // Clear the active scheduling index
      setSchedulingFileIndex(null);
    } catch (e: any) {
      console.error("Error scheduling file:", e);
      toastService.show({
        type: "error",
        title: "Scheduling Failed",
        message: e.message || "Could not write to playout state",
        duration: 4000
      });
    }
  };

  // 3. Inspect Selected Archive.org Identifier Files List
  const handleInspectItem = async (
    identifier: string, 
    title: string, 
    creator: string, 
    description: string, 
    publicdate: string
  ) => {
    setInspectingLoading(true);
    setInspectingError(null);
    setInspectingItem({ identifier, title, creator, description, date: publicdate, files: [] });

    try {
      const response = await fetch(BACKEND_URL + "/api/playlist/import-from-archive-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, includeVideo: true })
      });
      const data = await response.json();
      if (data.success) {
        setInspectingItem((prev: any) => prev ? { ...prev, files: data.tracks || [] } : null);
      } else {
        setInspectingError(data.error || "Failed to retrieve file listings for this archive item.");
      }
    } catch (err: any) {
      setInspectingError(err.message || "Failed to connect to file retrieval API.");
    } finally {
      setInspectingLoading(false);
    }
  };

  // 4. Play selected remote track/segment
  const handlePlayFile = (file: any, parentItem: any) => {
    const showId = `archive-${parentItem.identifier}-${encodeURIComponent(file.name)}`;
    const tempShow: ScheduleShow = {
      id: showId,
      title: file.title || file.name,
      description: parentItem.description || "Segment from Archive.org collection.",
      airDate: parentItem.date ? parentItem.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
      airTime: "00:00",
      duration: Math.round(file.duration / 60) || 60,
      episode: parentItem.identifier,
      videoUrl: file.url,
      thumbnailUrl: `https://archive.org/services/img/${parentItem.identifier}`,
      channel: parentItem.creator || "Archive.org",
      showType: "archive",
      tags: ["Archive.org", file.fileType || "Media"]
    };
    onPlayShow(tempShow);
  };

  const totalPages = Math.ceil(remoteTotal / 20);

  return (
    <div id="archive-deck-wrapper" className="bg-[#0b0e1a]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl font-sans flex flex-col w-full text-slate-200">
      
      {/* Editorial Header Banner */}
      <div className="relative h-44 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center filter saturate-[0.8] brightness-[0.4] transition-all duration-700"
          style={{ backgroundImage: `url('https://archive.org/download/daily-highlights/gettyimages-1796841914.webp')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e1a] to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
              HISTORIC VAULT
            </span>
            <h3 className="text-xl font-black text-white mt-1.5 uppercase font-mono tracking-tight">
              AJN Library & Archives
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Deep-archive retrieval system supporting local schedules and live Archive.org Advanced Search queries
            </p>
          </div>
          <Library className="w-8 h-8 text-blue-400 opacity-60 hidden sm:block" />
        </div>
      </div>

      {/* Main Mode Toggle Tabs */}
      <div className="flex border-b border-slate-800 bg-[#090c17]/80 p-1 gap-1">
        <button
          onClick={() => setActiveTab("local")}
          className={`flex-1 py-3 text-xs font-mono font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "local" 
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-black" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Library className="w-4 h-4" />
          <span>Local Playback Vault</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("remote");
            if (remoteResults.length === 0) {
              handleRemoteSearch(1);
            }
          }}
          className={`flex-1 py-3 text-xs font-mono font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "remote" 
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-black" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Remote Archive.org Engine</span>
        </button>
      </div>

      {/* ----------------- TAB 1: LOCAL VAULT VIEW ----------------- */}
      {activeTab === "local" && (
        <>
          {/* Control Board */}
          <div className="p-4 border-b border-slate-800/60 bg-[#090c17] flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Field */}
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search past local episodes, topics, keywords..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black border border-slate-800/80 text-xs text-white outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 bg-[#12162a]/60 border border-slate-800/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {(["all", "live", "archive", "special"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setLocalFilterType(type)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    localFilterType === type
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {type === "all" ? "All Vaults" : type}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Results List */}
          <div className="p-6 bg-[#070912]/40 min-h-[300px] flex-1">
            {localArchiveShows.length === 0 ? (
              <div className="py-14 text-center border border-dashed border-slate-800/80 rounded-2xl bg-[#090b16]">
                <Search className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <h4 className="text-xs font-black font-mono text-slate-400 uppercase">No Local Vault Matches</h4>
                <p className="text-[10px] text-slate-500 font-mono mt-1">Try typing another search term above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localArchiveShows.map((show) => (
                  <div
                    key={show.id}
                    onClick={() => onPlayShow(show)}
                    className="group p-4 rounded-2xl bg-[#0b0e1c] border border-slate-900/90 hover:border-blue-500/40 hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[8px] font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                          {show.channel || "ARCHIVE"}
                        </span>
                        <span className="text-[8.5px] font-mono text-slate-500">
                          {show.airDate}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors uppercase leading-tight line-clamp-2">
                        {show.title}
                      </h4>

                      {show.description && (
                        <p className="text-[10px] text-slate-400 font-mono mt-1.5 leading-relaxed line-clamp-2">
                          {show.description}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3.5 border-t border-slate-900/60">
                      <div className="flex items-center gap-1 text-[8.5px] font-mono text-slate-500 uppercase">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        <span>{show.episode || "Archive Segment"}</span>
                      </div>
                      <button className="text-[9px] font-mono font-black uppercase text-blue-300 group-hover:text-white bg-blue-500/5 group-hover:bg-blue-600 border border-blue-500/10 group-hover:border-blue-500 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5">
                        <Play className="w-3 h-3" />
                        <span>Play Segment</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ----------------- TAB 2: REMOTE ARCHIVE.ORG SEARCH VIEW ----------------- */}
      {activeTab === "remote" && (
        <div className="flex flex-col flex-1">
          {/* Advanced Search Controller Bar */}
          <div className="p-4 border-b border-slate-800 bg-[#090c17] flex flex-col gap-4">
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleRemoteSearch(1);
              }}
              className="flex flex-col md:flex-row gap-3"
            >
              {/* Search input field */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={remoteQuery}
                  onChange={(e) => setRemoteQuery(e.target.value)}
                  placeholder="Query Archive.org (e.g. Alex Jones, War Room, creator:Alex Jones)"
                  className="w-full pl-11 pr-10 py-3 rounded-xl bg-black border border-slate-800 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
                {remoteQuery && (
                  <button
                    type="button"
                    onClick={() => setRemoteQuery("")}
                    className="absolute right-3.5 top-3.5 p-0.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear Search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtering Mediatypes */}
              <div className="flex gap-2 items-center">
                <div className="relative shrink-0">
                  <select
                    value={remoteMediaFilter}
                    onChange={(e) => setRemoteMediaFilter(e.target.value as any)}
                    className="appearance-none pl-3 pr-8 py-3 rounded-xl bg-black border border-slate-800 text-xs font-mono font-bold text-slate-300 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="all">📹 + 📻 Video & Audio</option>
                    <option value="video">📹 Video Only</option>
                    <option value="audio">📻 Audio Only</option>
                  </select>
                  <Filter className="absolute right-3 top-4 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>

                <button
                  type="submit"
                  disabled={remoteLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-mono font-black text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-900/10"
                >
                  {remoteLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  <span>Query API</span>
                </button>
              </div>
            </form>

            {/* Quick Presets Pills Row */}
            <div className="flex flex-col gap-1.5 border-t border-slate-800/40 pt-2.5">
              <span className="text-[9px] uppercase font-mono text-slate-500 tracking-wider font-bold">
                ⚡ Ease-of-Use Quick Presets:
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {SEARCH_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setRemoteQuery(preset.query);
                      handleRemoteSearch(1, preset.query);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[9px] font-mono font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                      remoteQuery === preset.query
                        ? "bg-blue-600/35 text-blue-300 border border-blue-500/40"
                        : "bg-black hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    🔍 {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results metadata & Pagination row */}
            {remoteTotal > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/50 pt-3 text-[10px] font-mono text-slate-400 gap-2">
                <div className="flex items-center gap-1.5 uppercase font-bold text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>Found: <strong>{remoteTotal.toLocaleString()}</strong> matches in Advanced Search index</span>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoteSearch(remotePage - 1)}
                    disabled={remotePage <= 1 || remoteLoading}
                    className="p-1.5 bg-black hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-black transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-300">
                    Page {remotePage} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => handleRemoteSearch(remotePage + 1)}
                    disabled={remotePage >= totalPages || remoteLoading}
                    className="p-1.5 bg-black hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-black transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results Grid / Main remote layout */}
          <div className="p-6 bg-[#070912]/40 min-h-[300px] flex-1 flex flex-col gap-6 relative">
            
            {/* Error messaging */}
            {remoteError && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 font-mono text-[11px]">
                ⚠️ {remoteError}
              </div>
            )}

            {/* Inspect Item overlay panel */}
            {inspectingItem && (
              <div className="absolute inset-0 z-30 bg-[#060810]/95 flex flex-col p-6 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <img 
                      src={`https://archive.org/services/img/${inspectingItem.identifier}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg";
                      }}
                      alt={inspectingItem.title}
                      className="w-8 h-8 rounded object-cover border border-slate-800"
                    />
                    <div>
                      <h4 className="text-xs sm:text-sm font-black font-mono text-white uppercase truncate max-w-lg">
                        Files inside: {inspectingItem.title}
                      </h4>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                        ID: {inspectingItem.identifier} • Date: {inspectingItem.date || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setInspectingItem(null)}
                    className="p-1 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* File list load / results */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  {inspectingLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 font-mono text-xs text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <span>Retrieving playable video & audio streams from Archive.org metadata...</span>
                    </div>
                  ) : inspectingError ? (
                    <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 font-mono text-[11px]">
                      ⚠️ {inspectingError}
                    </div>
                  ) : inspectingItem.files.length === 0 ? (
                    <div className="text-center py-10 font-mono text-xs text-slate-500">
                      No matching playable .mp4 / .mp3 media structures found in this Archive item.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {inspectingItem.files.map((file: any, index: number) => {
                        const isVideo = file.fileType?.toLowerCase().includes("video") || file.name.endsWith(".mp4") || file.name.endsWith(".m4v");
                        return (
                          <div 
                            key={index}
                            className="flex flex-col p-3.5 bg-[#0e1124] hover:bg-[#121630] border border-slate-850 hover:border-blue-500/30 rounded-xl transition-all font-mono text-xs gap-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-1.5 rounded-lg bg-blue-900/20 text-blue-400 border border-blue-900/30 shrink-0">
                                  {isVideo ? <Tv className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-200 block truncate max-w-[180px] sm:max-w-[400px]" title={file.title || file.name}>
                                    {file.title || file.name}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block mt-0.5 uppercase">
                                    Format: {file.fileType || "Unknown"} • Duration: {Math.round(file.duration / 60) || "Unknown"} mins
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (schedulingFileIndex === index) {
                                      setSchedulingFileIndex(null);
                                    } else {
                                      setSchedulingFileIndex(index);
                                    }
                                  }}
                                  className={`px-3 py-1.5 border font-black text-[9px] uppercase rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                                    schedulingFileIndex === index
                                      ? "bg-slate-800 border-slate-700 text-slate-200"
                                      : "bg-[#12182c] border-blue-900/40 hover:border-blue-500/40 text-blue-300"
                                  }`}
                                  title="Schedule this media segment on automated channels"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{schedulingFileIndex === index ? "Cancel" : "Schedule"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handlePlayFile(file, inspectingItem)}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-[10px] uppercase rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Stream</span>
                                </button>
                              </div>
                            </div>

                            {/* Collapsible inline automated playout scheduler panel */}
                            {schedulingFileIndex === index && (
                              <div className="p-3 rounded-xl bg-black/40 border border-slate-850 flex flex-col sm:flex-row items-end gap-3.5 animate-fadeIn">
                                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block mb-1">
                                      Select Target Playout Channel
                                    </label>
                                    <select
                                      value={selectedSchedChannel}
                                      onChange={(e) => setSelectedSchedChannel(e.target.value)}
                                      className="w-full bg-black border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                      {getAvailableChannels().map((ch: any) => (
                                        <option key={ch.id} value={ch.id}>
                                          📺 {ch.name} ({ch.callSign})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block mb-1">
                                      Playout Start Time (HH:MM)
                                    </label>
                                    <input
                                      type="text"
                                      value={selectedSchedHour}
                                      onChange={(e) => setSelectedSchedHour(e.target.value)}
                                      placeholder="e.g. 14:00"
                                      className="w-full bg-black border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500 font-mono"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddToSchedule(file, inspectingItem)}
                                  className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <span>Confirm Airtime</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Remote loading cover */}
            {remoteLoading && (
              <div className="flex flex-col items-center justify-center h-52 gap-2 font-mono text-xs text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                <span>Harvesting items from Advanced Search API index...</span>
              </div>
            )}

            {/* Remote Search results grid display */}
            {!remoteLoading && remoteResults.length === 0 && !remoteError && (
              <div className="py-14 text-center border border-dashed border-slate-800/80 rounded-2xl bg-[#090b16]">
                <Search className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <h4 className="text-xs font-black font-mono text-slate-400 uppercase">No Active Queries</h4>
                <p className="text-[10px] text-slate-500 font-mono mt-1">
                  Type custom search operators and press 'Query API' to index upstream items.
                </p>
              </div>
            )}

            {!remoteLoading && remoteResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {remoteResults.map((doc: any) => {
                  const hasVideo = doc.mediatype === "video";
                  return (
                    <div
                      key={doc.identifier}
                      onClick={() => handleInspectItem(
                        doc.identifier,
                        doc.title || doc.identifier,
                        doc.creator || "Archive.org",
                        doc.description || "",
                        doc.publicdate || ""
                      )}
                      className="group p-4 rounded-2xl bg-[#0b0e1c] border border-slate-900/90 hover:border-blue-500/40 hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-[8px] font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                            {hasVideo ? <Tv className="w-2.5 h-2.5" /> : <Headphones className="w-2.5 h-2.5" />}
                            <span>{doc.mediatype?.toUpperCase() || "MEDIA"}</span>
                          </span>
                          <span className="text-[8.5px] font-mono text-slate-500">
                            {doc.publicdate ? doc.publicdate.substring(0, 10) : "Undated"}
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors uppercase leading-tight line-clamp-2">
                          {doc.title || doc.identifier}
                        </h4>

                        <p className="text-[10.5px] font-mono text-slate-400 mt-1 uppercase font-bold">
                          By: {doc.creator || "Unknown Creator"}
                        </p>

                        {doc.description && (
                          <p className="text-[10px] text-slate-500 font-mono mt-1.5 leading-relaxed line-clamp-2">
                            {doc.description}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-3.5 border-t border-slate-900/60">
                        <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-slate-500 uppercase">
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                          <span>{doc.downloads ? parseInt(doc.downloads, 10).toLocaleString() : 0} DLs</span>
                        </div>
                        <button className="text-[9px] font-mono font-black uppercase text-blue-300 group-hover:text-white bg-blue-500/5 group-hover:bg-blue-600 border border-blue-500/10 group-hover:border-blue-500 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5">
                          <Eye className="w-3 h-3" />
                          <span>Inspect & Stream</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
