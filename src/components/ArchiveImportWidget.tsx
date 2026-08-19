import React, { useState, useEffect } from "react";
import { MusicTrack } from "../types";
import { useArchivePlaylistImporter } from "../hooks/useArchivePlaylistImporter";
import { 
  getDBValue, 
  putsDBValue, 
  clearObjectStore, 
  getCachedImport, 
  getAllDBValues 
} from "../services/IndexedDB";
import { detectArchiveUrlType, extractIdentifier } from "../utils/archiveUtils";
import { 
  Download, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Music,
  ChevronRight,
  Trash2,
  Info,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toastService } from "../utils/toast";

interface ArchiveImportWidgetProps {
  theme: "light" | "dark";
  allTracks: MusicTrack[];
  addTracks: (tracks: MusicTrack[]) => Promise<void>;
  createPlaylist: (name: string, description?: string, trackIds?: string[]) => any;
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
  onImportSuccess?: (playlistId: string) => void;
}

export function ArchiveImportWidget({
  theme,
  allTracks,
  addTracks,
  createPlaylist,
  addLog,
  onImportSuccess
}: ArchiveImportWidgetProps) {
  const [urlInput, setUrlInput] = useState("");
  const [showNotification, setShowNotification] = useState(false);
  const [lastImportedName, setLastImportedName] = useState("");
  const [preferredFormat, setPreferredFormat] = useState<"all" | "mp3" | "flac">("all");
  const [importDestination, setImportDestination] = useState<"music" | "tv_guide">("music");

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState("");

  // Cache display states
  const [cacheSize, setCacheSize] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [urlInCache, setUrlInCache] = useState(false);
  const [cachedTrackNum, setCachedTrackNum] = useState<number | null>(null);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  const {
    isLoading,
    progress,
    thumbnailUrl,
    playlistName,
    error,
    importPlaylist,
    cancelImport
  } = useArchivePlaylistImporter({
    allTracks,
    addTracks,
    createPlaylist,
    addLog,
    onSuccess: onImportSuccess
  });

  // Query entire cache stats on mount or when library changes
  const fetchCacheInfo = async () => {
    try {
      const cachedItems = await getAllDBValues<{ key: string; playlistId: string; importedAt: string; trackCount: number }>("import_cache");
      setCacheSize(cachedItems.length);
      if (cachedItems.length > 0) {
        const timestamps = cachedItems
          .map(item => new Date(item.importedAt).getTime())
          .filter(t => !isNaN(t));
        if (timestamps.length > 0) {
          const maxTime = Math.max(...timestamps);
          setLastSyncTime(
            new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
            " " + 
            new Date(maxTime).toLocaleDateString()
          );
        } else {
          setLastSyncTime(null);
        }
      } else {
        setLastSyncTime(null);
      }
    } catch (err) {
      console.error("Failed to load cache info:", err);
    }
  };

  useEffect(() => {
    fetchCacheInfo();
  }, [allTracks]);

  // Live url check inside IndexedDB cache on typing
  useEffect(() => {
    const checkCache = async () => {
      const trimmed = urlInput.trim();
      if (!trimmed) {
        setUrlInCache(false);
        setCachedTrackNum(null);
        return;
      }
      try {
        const cached = await getCachedImport(trimmed);
        if (cached) {
          setUrlInCache(true);
          setCachedTrackNum(cached.trackCount);
        } else {
          setUrlInCache(false);
          setCachedTrackNum(null);
        }
      } catch {
        setUrlInCache(false);
        setCachedTrackNum(null);
      }
    };
    checkCache();
  }, [urlInput, allTracks]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.includes("http") && !cleanUrl.includes("archive.org")) {
      handleSearch();
      return;
    }

    if (importDestination === "tv_guide") {
      const id = extractIdentifier(cleanUrl);
      if (!id) {
        toastService.show({
          type: "error",
          title: "❌ Invalid URL",
          message: "Could not parse details page identifier. Please paste a valid Archive.org details URL.",
          duration: 4000
        });
        return;
      }

      const displayName = id.replace(/[-_]+/g, " ").toUpperCase();
      window.dispatchEvent(new CustomEvent("ajn-register-channel-trigger", {
        detail: {
          name: displayName,
          source: id,
          type: "ia_collection",
          category: "Archive",
          behavior: "binge"
        }
      }));

      setUrlInput("");
      return;
    }

    try {
      await importPlaylist(cleanUrl, false, preferredFormat);
      setTimeout(() => {
        const currentPlName = playlistName || "Archive Playlist";
        setLastImportedName(currentPlName);
        setShowNotification(true);
        setUrlInput("");
        fetchCacheInfo();
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
      }, 500);
    } catch (err) {
      // Handled in hook
    }
  };

  const handleSetSampleUrl = () => {
    setUrlInput("https://archive.org/details/america-4th-of-july-1978-universal-amphitheatre-kwst");
  };

  const handleSearch = async () => {
    const query = urlInput.trim();
    if (!query) return;
    setIsSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const res = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+AND+mediatype:audio&fl[]=identifier,title,creator,year,downloads&sort[]=downloads+desc&output=json&rows=10`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.response?.docs || []);
    } catch (err: any) {
      setSearchError(err.message || "Failed to search Archive.org");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurgeData = async () => {
    try {
      // 1. Clear import_cache store completely
      await clearObjectStore("import_cache");

      // 2. Filter out Archive.org tracks from music_library ("all")
      const libraryRecord = await getDBValue<{ key: string; value: MusicTrack[] }>("music_library", "all");
      if (libraryRecord && libraryRecord.value) {
        const remainingTracks = libraryRecord.value.filter(
          (t) => !t.id?.startsWith("track-arch-") && !t.url?.includes("archive.org/")
        );
        await putsDBValue("music_library", { key: "all", value: remainingTracks });
      }

      // 3. Filter out Archive.org playlists from music_playlists ("all")
      const playlistsRecord = await getDBValue<{ key: string; value: any[] }>("music_playlists", "all");
      if (playlistsRecord && playlistsRecord.value) {
        const remainingPlaylists = playlistsRecord.value.filter((p) => {
          const isArchiveDesc = p.description?.includes("Archive.org");
          const hasArchiveTracks = p.tracks?.some((tid: string) => tid.startsWith("track-arch-"));
          return !isArchiveDesc && !hasArchiveTracks;
        });
        await putsDBValue("music_playlists", { key: "all", value: remainingPlaylists });
      }

      addLog("Successfully purged all Archive.org playlist, track, and cache records.", "info");
      toastService.showImportSuccess("Cache & Library Purged", 0);
      
      // Update cache counts in state
      setCacheSize(0);
      setLastSyncTime(null);
      setUrlInCache(false);
      setCachedTrackNum(null);
      setShowConfirmPurge(false);

      // Trigger standard soft reload to synchronize active library views
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      addLog(`Failed to purge Archive data: ${err.message}`, "error");
    }
  };

  return (
    <div 
      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
        theme === "light" 
          ? "bg-white border-slate-200 shadow-sm" 
          : "bg-slate-900/40 backdrop-blur-md border-slate-800/80"
      }`}
      id="archive-import-widget"
    >
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-blue-500 flex items-center gap-2">
            <Music className="w-3.5 h-3.5" /> Archive.org Collection Importer
          </h4>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Import whole public domain live music series, audio books, or concerts by pasting details page URLs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSetSampleUrl}
          className="text-[10px] font-mono px-2 py-0.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 rounded border border-blue-500/20 cursor-pointer"
          title="Insert sample concert identifier"
        >
          Seeding Sample
        </button>
      </div>

      <form onSubmit={handleImport} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste archive.org item URL or M3U link..."
            disabled={isLoading}
            className={`w-full text-xs font-mono pr-8 pl-3 py-2 border rounded-xl outline-none transition-all placeholder:text-slate-600 ${
              theme === "light"
                ? "bg-slate-50 border-slate-300 text-slate-800 focus:border-blue-500"
                : "bg-slate-950/45 border-slate-800/60 text-slate-300 focus:border-blue-500/80"
            }`}
            required
          />
          {urlInput && !isLoading && (
            <button
              type="button"
              onClick={() => setUrlInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Routing Destination Selector */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-mono font-bold uppercase text-slate-500">
            Routing Destination
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setImportDestination("music")}
              className={`flex-1 select-none text-[10px] font-mono font-semibold uppercase py-1.5 px-2.5 rounded-xl border transition-all cursor-pointer ${
                importDestination === "music"
                  ? "bg-blue-600/15 border-blue-500 text-blue-400 font-bold shadow-sm"
                  : theme === "light"
                  ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  : "bg-slate-950/30 border-slate-800/60 text-slate-400 hover:bg-slate-900/40"
              }`}
            >
              🎵 Music Library
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setImportDestination("tv_guide")}
              className={`flex-1 select-none text-[10px] font-mono font-semibold uppercase py-1.5 px-2.5 rounded-xl border transition-all cursor-pointer ${
                importDestination === "tv_guide"
                  ? "bg-indigo-600/15 border-indigo-500 text-indigo-400 font-bold shadow-sm"
                  : theme === "light"
                  ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  : "bg-slate-950/30 border-slate-800/60 text-slate-400 hover:bg-slate-900/40"
              }`}
            >
              📺 TV Guide EPG Row
            </button>
          </div>
        </div>

        {/* Preferred Format Selector */}
        {importDestination === "music" && (
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold uppercase text-slate-500">
              Preferred Format (Optional)
            </label>
            <div className="flex gap-2">
              {(["all", "mp3", "flac"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setPreferredFormat(fmt)}
                  className={`flex-1 select-none text-[10px] font-mono font-semibold uppercase py-1.5 px-2.5 rounded-xl border transition-all cursor-pointer ${
                    preferredFormat === fmt
                      ? "bg-blue-600/15 border-blue-500 text-blue-400 font-bold shadow-sm"
                      : theme === "light"
                      ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      : "bg-slate-950/30 border-slate-800/60 text-slate-400 hover:bg-slate-900/40"
                  }`}
                >
                  {fmt === "all" ? "All Formats" : fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live URL status and info tooltips */}
        <AnimatePresence>
          {urlInCache && (
            <motion.div key="urlInCache-anim-1" 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] text-emerald-500 font-mono flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 w-fit"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Already in local cache ({cachedTrackNum} tracks found)</span>
            </motion.div>
          )}

          {urlInput && !urlInCache && detectArchiveUrlType(urlInput) !== "unknown" && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] text-blue-500 font-mono flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1.5 rounded-xl border border-blue-500/20 w-fit"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Uncached item ready for fetching</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-[10px] text-slate-500 leading-normal bg-slate-500/5 p-2 rounded-xl border border-slate-500/10 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-400">Supported Formats:</span> Paste any details page link (e.g., <code className="text-blue-400">archive.org/details/america-4th-of-july-1978</code>) or a live streaming M3U link to auto-compile track assets. Or type a keyword to search Archive.org.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {!isLoading ? (
            <button
              type="submit"
              disabled={isSearching}
              className={`flex-1 select-none flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-xl shadow transition-colors cursor-pointer ${
                urlInput && !urlInput.includes("http") && !urlInput.includes("archive.org")
                  ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white" 
                  : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white"
              }`}
            >
              {isSearching ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...</>
              ) : urlInput && !urlInput.includes("http") && !urlInput.includes("archive.org") ? (
                <><Search className="w-3.5 h-3.5" /> Search Archive</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Start Import</>
              )}
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                <div className="flex-1 bg-slate-800/30 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-500 shrink-0 w-8 text-right">
                  {progress}%
                </span>
              </div>
              <button
                type="button"
                onClick={cancelImport}
                className="select-none flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 bg-rose-600/10 hover:bg-rose-600/25 text-red-500 border border-red-500/20 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancel Stream
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1">
          {searchResults.map((res: any) => (
            <div 
              key={res.identifier}
              onClick={() => setUrlInput(`https://archive.org/details/${res.identifier}`)}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                theme === "light"
                  ? "bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-white"
                  : "bg-slate-950/40 border-slate-800/60 hover:border-blue-500/50 hover:bg-slate-900/60"
              }`}
            >
              <div className="text-xs font-bold text-blue-500 mb-0.5 line-clamp-1">{res.title}</div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{res.creator || "Unknown Creator"}</span>
                <span>{res.year || "Unknown Year"} • {res.downloads?.toLocaleString()} views</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notifications and status messages */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div key="error-anim-2"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`mt-3 p-3 rounded-xl flex items-start gap-2.5 text-xs font-medium border ${
              theme === "light"
                ? "bg-rose-50/50 border-rose-200 text-rose-700"
                : "bg-red-950/15 border-red-900/30 text-red-400"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1 leading-normal">{error}</div>
          </motion.div>
        )}

        {showNotification && ( <motion.div key="notification-toast"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-3 p-3 rounded-xl border flex items-center gap-3 ${
              theme === "light"
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                : "bg-emerald-950/15 border-emerald-900/30 text-emerald-400"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div className="flex-1 text-xs">
              <span className="font-bold">Import Complete:</span> Playlist{" "}
              <span className="underline italic">"{lastImportedName || playlistName}"</span> was successfully synchronized.
            </div>
            {thumbnailUrl && (
              <img 
                src={thumbnailUrl} 
                alt="Playlist logo"
                className="w-10 h-10 object-cover rounded-md border border-slate-800/40 shadow shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
          </motion.div>
        )}

        {isLoading && progress > 0 && progress < 100 && ( <motion.div key="loading-progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2.5 flex items-center gap-2 text-[10px] font-mono text-slate-500"
          >
            <ChevronRight className="w-3 h-3 text-blue-500 animate-pulse" />
            <span>Streaming and parsing {progress > 85 ? "mapping layouts..." : "accumulating track assets..."}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cache metrics & Purge Controls */}
      <div className="border-t border-slate-800/20 mt-4 pt-3.5">
        {showConfirmPurge ? ( <motion.div key="confirm-purge" 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2 text-xs"
          >
            <p className="font-bold text-red-500 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 shrink-0" /> Purge Archive.org Collections?
            </p>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              This will permanently delete all imported Archive.org playlists and corresponding audio tracks from your library and wipe the database import cache. This action is irreversible.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmPurge(false)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeData}
                className="px-2.5 py-1 text-[11px] font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl cursor-pointer"
              >
                Yes, Purge Everything
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center justify-between text-[11px]">
            <div className="text-slate-500 font-mono">
              Cache: <span className="text-slate-300 font-bold">{cacheSize}</span> items 
              {lastSyncTime && <span className="text-slate-600"> • Last sync: {lastSyncTime}</span>}
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmPurge(true)}
              className="text-red-500/80 hover:text-red-400 font-mono text-[10px] bg-red-500/5 hover:bg-red-500/10 px-2 py-0.5 rounded border border-red-500/10 transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear Cache & Purge Library
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
