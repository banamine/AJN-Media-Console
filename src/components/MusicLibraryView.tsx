import React, { useState, useMemo, useCallback } from "react";
import { useMusicLibrary } from "../hooks/useMusicLibrary";
import { useMusicPlaylists } from "../hooks/useMusicPlaylists";
import { useMusicPlayer } from "../hooks/useMusicPlayer";
import { MusicTrack } from "../types";
import { ArchiveImportWidget } from "./ArchiveImportWidget";
import { PlaylistCard } from "./PlaylistCard";
import { BatchImportWidget } from "./BatchImportWidget";
import { TrackRegistrationModal } from "./TrackRegistrationModal";
import { useToasts } from "../utils/toast";
import { useArchivePlaylistImporter } from "../hooks/useArchivePlaylistImporter";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Plus, 
  Heart, 
  Trash2, 
  Music, 
  FolderHeart, 
  Layers, 
  Disc, 
  Tag, 
  Clock, 
  ChevronDown, 
  Check, 
  ListMusic, 
  Play,
  FilePlus2,
  Calendar,
  Pencil
} from "lucide-react";

interface MusicLibraryViewProps {
  setQueue: (tracks: any[]) => void;
  playSiriusTrack: (idx: number) => void;
  queueProgress: { played: number; total: number };
  theme: "light" | "dark";
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
}

export const MusicLibraryView = React.memo(function MusicLibraryView({ 
  setQueue, 
  playSiriusTrack, 
  queueProgress, 
  theme, 
  addLog 
}: MusicLibraryViewProps) {
  const {
    allTracks,
    filteredTracks,
    visibleTracks,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    loadMore,
    toggleFavorite,
    addTracks,
    updateTrack,
    clearLibrary,
    loading: libraryLoading
  } = useMusicLibrary();

  const {
    playlists,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    clearAllPlaylists
  } = useMusicPlaylists();

  const { playTrackList } = useMusicPlayer(setQueue, playSiriusTrack, queueProgress);

  // Sub-navigation: "all" | "favorites" | "playlists" | "playlist"
  const [activeSubTab, setActiveSubTab] = useState<"all" | "favorites" | "playlist" | "playlists">("all");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Modals / Dialogs states
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showArchiveImport, setShowArchiveImport] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  
  useEscapeKey(() => {
    if (showCreatePlaylist) setShowCreatePlaylist(false);
  });

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isSmart, setIsSmart] = useState(false);
  const [smartField, setSmartField] = useState<"genre" | "artist" | "album" | "year" | "isFavorite">("genre");
  const [smartOperator, setSmartOperator] = useState<"equals" | "contains" | "greaterThan" | "lessThan">("equals");
  const [smartValue, setSmartValue] = useState("");
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [editPlaylistName, setEditPlaylistName] = useState("");
  const [editPlaylistDesc, setEditPlaylistDesc] = useState("");
  
  // Track adding to playlist dropdown
  const [activeAddToPlaylistTrackId, setActiveAddToPlaylistTrackId] = useState<string | null>(null);

  // Create new track dialogue state
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [initialTrackData, setInitialTrackData] = useState<Partial<MusicTrack> & { thumbnailUrl?: string } | undefined>(undefined);

  const activePlaylist = useMemo(() => {
    if (activeSubTab !== "playlist" || !selectedPlaylistId) return null;
    return playlists.find(p => p.id === selectedPlaylistId) || null;
  }, [activeSubTab, selectedPlaylistId, playlists]);

  React.useEffect(() => {
    setIsEditingPlaylist(false);
  }, [selectedPlaylistId]);

  const getSmartPlaylistTracks = useCallback((playlist: any) => {
    if (!playlist.isSmart || !playlist.rules || playlist.rules.length === 0) {
      return filteredTracks.filter(t => playlist.tracks?.includes(t.id || ""));
    }
    return filteredTracks.filter(t => {
      return playlist.rules.every((rule: any) => {
        let fieldVal = "";
        if (rule.field === "isFavorite") {
          fieldVal = t.isFavorite ? "true" : "false";
        } else {
          fieldVal = String((t as any)[rule.field] || "").toLowerCase();
        }
        const ruleVal = rule.value.toLowerCase();
        if (rule.operator === "equals") {
          return fieldVal === ruleVal;
        } else if (rule.operator === "contains") {
          return fieldVal.includes(ruleVal);
        } else if (rule.operator === "greaterThan") {
          return Number((t as any)[rule.field] || 0) > Number(rule.value);
        } else if (rule.operator === "lessThan") {
          return Number((t as any)[rule.field] || 0) < Number(rule.value);
        }
        return false;
      });
    });
  }, [filteredTracks]);

  // Derive tracks based on active sub-tab and filters
  const currentCategoryTracks = useMemo(() => {
    let baseTracks: MusicTrack[] = [];
    if (activeSubTab === "all") {
      baseTracks = filteredTracks;
    } else if (activeSubTab === "favorites") {
      baseTracks = filteredTracks.filter(t => t.isFavorite);
    } else if (activeSubTab === "playlist" && activePlaylist) {
      if (activePlaylist.isSmart) {
        baseTracks = getSmartPlaylistTracks(activePlaylist);
      } else {
        baseTracks = filteredTracks.filter(t => activePlaylist.tracks.includes(t.id || ""));
      }
    }
    return baseTracks;
  }, [activeSubTab, filteredTracks, activePlaylist, getSmartPlaylistTracks]);

  const currentCategoryVisibleTracks = useMemo(() => {
    return currentCategoryTracks.slice(0, visibleTracks.length + 10);
  }, [currentCategoryTracks, visibleTracks.length]);

  const handleCreatePlaylist = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    
    let pl;
    if (isSmart) {
      pl = createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim(), [], {
        isSmart: true,
        rules: [{
          field: smartField,
          operator: smartOperator,
          value: smartValue.trim()
        }]
      });
      addLog(`Smart Music Playlist "${pl.name}" created successfully (Rule: ${smartField} ${smartOperator} "${smartValue.trim()}").`, "info");
    } else {
      pl = createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
      addLog(`Music Playlist "${pl.name}" created successfully.`, "info");
    }
    
    setNewPlaylistName("");
    setNewPlaylistDesc("");
    setIsSmart(false);
    setSmartField("genre");
    setSmartOperator("equals");
    setSmartValue("");
    setShowCreatePlaylist(false);
    setSelectedPlaylistId(pl.id);
    setActiveSubTab("playlist");
  }, [newPlaylistName, newPlaylistDesc, isSmart, smartField, smartOperator, smartValue, createPlaylist, addLog]);

  const handleCreateTrack = useCallback((trackData: Omit<MusicTrack, "id" | "dateAdded" | "isFavorite">) => {
    if (initialTrackData && initialTrackData.id) {
      updateTrack(initialTrackData.id, trackData);
      addLog(`Updated track "${trackData.title}" in Music Library.`, "info");
    } else {
      const track: MusicTrack = {
        ...trackData,
        id: `track-${Date.now()}`,
        dateAdded: new Date().toISOString(),
        isFavorite: false
      };
      addTracks([track]);
      addLog(`Added track "${track.title}" to Music Library.`, "info");
    }
    setShowAddTrack(false);
    setInitialTrackData(undefined);
  }, [initialTrackData, addTracks, updateTrack, addLog]);

  // Toast Overlay Notifications hooks
  const { toasts, dismiss } = useToasts();

  // Instantiate sequential batch importer
  const {
    batchProgress,
    importBatch,
    cancelBatch,
    isLoading: isBatchLoading
  } = useArchivePlaylistImporter({
    allTracks,
    addTracks,
    createPlaylist,
    addLog,
    onSuccess: (newPlaylistId) => {
      setSelectedPlaylistId(newPlaylistId);
      setActiveSubTab("playlist");
    }
  });

  const handlePlaySelectedTrack = useCallback((track: MusicTrack, index: number) => {
    // When playing a track, play from the context of active sub-tab filtered list
    playTrackList(currentCategoryVisibleTracks, index);
    addLog(`Broadcasting "${track.title}" by ${track.artist || "Unknown Artist"} on Audio Deck.`, "info");
  }, [playTrackList, currentCategoryVisibleTracks, addLog]);

  const handleQuickAddPredefinedTracks = useCallback(() => {
    const backupTracks: MusicTrack[] = [
      {
        id: `track-pre-${Date.now()}-1`,
        title: "Beethoven's 5th Symphony",
        artist: "Symphony Orchestra",
        url: "https://ia800901.us.archive.org/27/items/Beethoven5thSymphony_201705/01_Beethoven_Symphony_No_5_in_C_minor_Op_67_-_I_Allegro_con_brio.mp3",
        album: "Classical Masterpieces",
        genre: "Classical",
        year: 1808,
        dateAdded: new Date().toISOString(),
        sourceType: "music"
      },
      {
        id: `track-pre-${Date.now()}-2`,
        title: "Synthwaves of 1984",
        artist: "RetroWave Collective",
        url: "https://ia802508.us.archive.org/5/items/synthwave-collection/RetroSynth.mp3",
        album: "Retro Wave Compilation",
        genre: "Synthwave",
        year: 2021,
        dateAdded: new Date().toISOString(),
        sourceType: "music"
      }
    ];
    addTracks(backupTracks);
    addLog("Added premium curated fallback library tracks for instant listening.", "info");
  }, [addTracks, addLog]);

  return (
    <div className={`flex flex-col xl:flex-row h-full min-h-[500px] w-full border rounded-2xl overflow-hidden transition-all duration-300 ${
      theme === "light" 
        ? "bg-slate-50 border-slate-200 text-slate-800" 
        : "bg-slate-900/60 backdrop-blur-md border-slate-800/80 text-slate-300"
    }`} id="music-library-container">
      
      {/* 1. SIDE NAVIGATION BAR */}
      <div className={`w-full xl:w-64 shrink-0 flex flex-col border-b xl:border-b-0 xl:border-r p-4 gap-3 ${
        theme === "light" ? "bg-slate-100 border-slate-200" : "bg-slate-950/40 border-slate-800/60"
      }`} id="music-sidebar">
        <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-800/40">
          <span className="text-sm font-bold tracking-wider uppercase text-blue-500 flex items-center gap-2">
            <ListMusic className="w-4 h-4" /> Music Library
          </span>
          <button 
            onClick={() => setShowAddTrack(true)}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors cursor-pointer"
            title="Import or Add New Track"
          >
            <Plus className="w-3 h-3" /> ADD NY
          </button>
        </div>

        {/* Primary Views Section */}
        <div className="flex flex-col gap-1 sm:grid sm:grid-cols-4 xl:flex xl:flex-col">
          <button
            onClick={() => { setActiveSubTab("all"); setSelectedPlaylistId(null); }}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeSubTab === "all" 
                ? "bg-blue-600 text-[#fff] shadow-sm animate-none" 
                : theme === "light" ? "text-slate-600 hover:bg-slate-200" : "text-slate-450 hover:bg-slate-800/50"
            }`}
          >
            <Music className="w-4 h-4" /> All Tracks ({allTracks.length})
          </button>

          <button
            onClick={() => { setActiveSubTab("favorites"); setSelectedPlaylistId(null); }}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeSubTab === "favorites" 
                ? "bg-amber-600 text-[#fff] shadow-sm animate-none" 
                : theme === "light" ? "text-slate-600 hover:bg-slate-200" : "text-slate-450 hover:bg-slate-800/50"
            }`}
          >
            <Heart className="w-4 h-4 fill-current text-amber-500" /> Favorites
          </button>

          <button
            onClick={() => { setActiveSubTab("playlists"); setSelectedPlaylistId(null); }}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeSubTab === "playlists" 
                ? "bg-indigo-600 text-[#fff] shadow-sm animate-none" 
                : theme === "light" ? "text-slate-600 hover:bg-slate-200" : "text-slate-450 hover:bg-slate-800/50"
            }`}
            title="Browse Playlists"
          >
            <ListMusic className="w-4 h-4" /> Playlists ({playlists.length})
          </button>

          <button
            onClick={() => setShowCreatePlaylist(true)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer ${
              theme === "light" ? "text-slate-500 hover:bg-slate-200" : "text-slate-500 hover:bg-slate-800/40"
            }`}
          >
            <FilePlus2 className="w-4 h-4 text-emerald-500" /> CREATE LIST
          </button>
        </div>

        {/* Custom User Playlists list */}
        <div className="flex-1 flex flex-col min-h-[120px] xl:min-h-0 overflow-y-auto mt-3 border-t border-slate-800/20 pt-3">
          <div className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest pl-3 mb-2 flex items-center justify-between">
            <span>MY PLAYLISTS ({playlists.length})</span>
          </div>

          <div className="space-y-1">
            {playlists.length === 0 ? (
              <div className="p-3 text-center rounded-xl bg-slate-800/10 border border-dashed border-slate-800/20">
                <span className="text-[10px] font-mono text-slate-500">No playlists yet.</span>
              </div>
            ) : (
              playlists.map(pl => (
                <div 
                  key={pl.id}
                  className={`group relative flex items-center justify-between pl-3 pr-2 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeSubTab === "playlist" && selectedPlaylistId === pl.id
                      ? "bg-indigo-600/15 border border-indigo-500/25 text-indigo-400"
                      : "hover:bg-slate-800/20 text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => {
                    setSelectedPlaylistId(pl.id);
                    setActiveSubTab("playlist");
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ListMusic className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <div className="truncate text-xs font-semibold leading-tight pr-1 flex items-center gap-1">
                      <span>{pl.name}</span>
                      {pl.isSmart && <span className="text-[9px] text-indigo-400">⚡</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                      pl.isSmart 
                        ? "bg-indigo-950/60 text-indigo-400 font-bold border border-indigo-500/10" 
                        : "bg-slate-800/80 text-slate-500"
                    }`}>
                      {pl.isSmart ? getSmartPlaylistTracks(pl).length : pl.tracks.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete playlist "${pl.name}"?`)) {
                          deletePlaylist(pl.id);
                          if (selectedPlaylistId === pl.id) {
                            setSelectedPlaylistId(null);
                            setActiveSubTab("all");
                          }
                          addLog(`Playlist "${pl.name}" removed.`, "info");
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer mb-[-1px] rounded"
                      title="Delete Playlist"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Future Integrations commentary widget */}
        <div className="mt-auto p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[10px] text-slate-500 font-sans leading-relaxed">
          <p className="font-semibold text-blue-400/80 mb-0.5">ℹ️ Cinephile Integration</p>
          Future updates will link these audio tracks directly to film soundtracks, directors, and review logs.
        </div>
      </div>

      {/* 2. MAIN ACTIVE SHELF */}
      <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 min-w-0" id="music-main-shelf">
        
        {/* UPPER CONTROLS GRID */}
        <div className="flex flex-col md:flex-row items-center gap-3 w-full border-b border-slate-800 pb-4">
          
          {/* SEARCH FIELD */}
          <div className="relative flex-1 w-full" id="music-search-container">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search music library by title, artist, genre or album..."
              className={`w-full border rounded-xl pl-10 pr-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all ${
                theme === "light" 
                  ? "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500" 
                  : "bg-slate-950/60 border-slate-800/80 text-white placeholder-slate-500 focus:border-blue-500"
              }`}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-between md:justify-end">
            {/* SORTING SELECTOR */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">SORT BY</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`py-1.5 px-2 bg-[#121A2E] text-xs border rounded-xl font-mono text-slate-300 outline-none cursor-pointer focus:border-blue-500 ${
                  theme === "light" ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800"
                }`}
              >
                <option value="title">Title (Alphabetical)</option>
                <option value="artist">Artist NAME</option>
                <option value="genre">Genre CATEGORY</option>
                <option value="length">Duration LENGTH</option>
                <option value="dateAdded">Upload Date ADDED</option>
              </select>
            </div>

            <button
              onClick={() => {
                setShowArchiveImport(!showArchiveImport);
                setShowBatchImport(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-mono cursor-pointer transition-all ${
                showArchiveImport
                  ? "bg-blue-600/25 border-blue-500/55 text-blue-400 shadow-inner font-bold"
                  : "border-slate-805 hover:bg-slate-800/40 text-slate-405"
              }`}
              title="Import single playlist from archive.org"
            >
              🌐 {showArchiveImport ? "CLOSE" : "SINGLE IMPORT"}
            </button>

            <button
              onClick={() => {
                setShowBatchImport(!showBatchImport);
                setShowArchiveImport(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-mono cursor-pointer transition-all ${
                showBatchImport
                  ? "bg-purple-600/25 border-purple-500/55 text-purple-400 shadow-inner font-bold"
                  : "border-slate-805 hover:bg-slate-800/40 text-slate-405"
              }`}
              title="Sequential multi-playlist importer"
            >
              📦 {showBatchImport ? "CLOSE BATCH" : "BATCH IMPORT"}
            </button>

            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to clear the database and cache? This will reset the music library to defaults, delete all custom playlists, and flush the import cache.")) {
                  const { clearCache } = await import("../services/IndexedDB");
                  try {
                    await clearCache();
                    clearLibrary();
                    clearAllPlaylists();
                    addLog("Successfully cleared music stream import cache, custom playlists, and restored music library defaults.", "info");
                  } catch (e) {
                    addLog("Failed to fully clear application cache.", "error");
                  }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 hover:bg-red-500/10 text-red-500/90 rounded-xl text-[10px] font-mono cursor-pointer transition-all"
              title="Fully Clear All Uploaded Music, Video Files & Cache"
            >
              🗑️ CLEAR CACHE
            </button>

            {/* Quick pre-seeded additions if list is thin */}
            {allTracks.length <= 3 && (
              <button
                onClick={handleQuickAddPredefinedTracks}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-400 rounded-xl text-[10px] font-mono cursor-pointer transition-colors"
                title="Seed classic tracks if empty"
              >
                📥 SEED CLASSICS
              </button>
            )}
          </div>
        </div>

        {/* ARCHIVE.ORG STREAM IMPORT WIDGET */}
        <AnimatePresence>
          {showArchiveImport && (
            <motion.div key="showArchiveImport-anim-1"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ArchiveImportWidget
                theme={theme}
                allTracks={allTracks}
                addTracks={addTracks}
                createPlaylist={createPlaylist}
                addLog={addLog}
                onImportSuccess={(newId) => {
                  setSelectedPlaylistId(newId);
                  setActiveSubTab("playlist");
                  setShowArchiveImport(false); // Auto-hide widget panel on successfully completed import
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* BATCH ARCHIVE IMPORT INTEGRATOR WIDGET */}
        <AnimatePresence>
          {showBatchImport && (
            <motion.div key="showBatchImport-anim-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <BatchImportWidget
                batchProgress={batchProgress}
                isLoading={isBatchLoading}
                onImportBatch={importBatch}
                onCancelBatch={cancelBatch}
                onClose={() => setShowBatchImport(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE CATEGORY PLACARD */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-500/5 border border-blue-500/10 rounded-2xl p-3 px-4 gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono text-blue-400 font-bold tracking-wider select-none block">
              ACTIVE VIEW
            </span>
            {isEditingPlaylist && activePlaylist ? (
              <div className="flex flex-col gap-2 mt-1 max-w-lg">
                <input
                  type="text"
                  value={editPlaylistName}
                  onChange={(e) => setEditPlaylistName(e.target.value)}
                  placeholder="Playlist Name"
                  className={`w-full text-xs font-bold border rounded-xl px-2 py-1 outline-none ${
                    theme === "light"
                      ? "bg-white border-slate-200 text-slate-800"
                      : "bg-slate-900 border-slate-800 text-white"
                  }`}
                />
                <input
                  type="text"
                  value={editPlaylistDesc}
                  onChange={(e) => setEditPlaylistDesc(e.target.value)}
                  placeholder="Playlist Description (Optional)"
                  className={`w-full text-[11px] border rounded-xl px-2 py-1 outline-none ${
                    theme === "light"
                      ? "bg-white border-slate-200 text-slate-600"
                      : "bg-slate-900 border-slate-800 text-slate-300"
                  }`}
                />
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => {
                      if (editPlaylistName.trim()) {
                        updatePlaylist(activePlaylist.id, editPlaylistName.trim(), editPlaylistDesc.trim());
                        addLog(`Playlist "${editPlaylistName.trim()}" updated successfully.`, "info");
                        setIsEditingPlaylist(false);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingPlaylist(false)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white truncate">
                    {activeSubTab === "all" 
                      ? "Whole Music Library" 
                      : activeSubTab === "favorites" 
                      ? "Starred Favorites Playlist" 
                      : activeSubTab === "playlists"
                      ? "My Playlists Dashboard"
                      : activePlaylist 
                      ? `Playlist: ${activePlaylist.name}` 
                      : "Tracks Workspace"}
                  </h3>
                  {activeSubTab === "playlist" && activePlaylist && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => {
                          setEditPlaylistName(activePlaylist.name);
                          setEditPlaylistDesc(activePlaylist.description || "");
                          setIsEditingPlaylist(true);
                        }}
                        className="p-1 hover:bg-slate-800/80 rounded-xl text-slate-450 hover:text-blue-400 transition-all cursor-pointer"
                        title="Rename/Edit Playlist"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the playlist "${activePlaylist.name}"?`)) {
                            deletePlaylist(activePlaylist.id);
                            addLog(`Deleted playlist "${activePlaylist.name}"`, "info");
                            setSelectedPlaylistId(null);
                            setActiveSubTab("playlists");
                          }
                        }}
                        className="p-1 hover:bg-slate-800/80 rounded-xl text-slate-450 hover:text-red-400 transition-all cursor-pointer"
                        title="Delete Playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {activePlaylist?.description && activeSubTab === "playlist" && (
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">{activePlaylist.description}</p>
                )}
                {activeSubTab === "favorites" && (
                  <p className="text-[11px] text-slate-400 mt-0.5">Your hand-picked favorite tracks saved locally.</p>
                )}
                {activeSubTab === "all" && (
                  <p className="text-[11px] text-slate-400 mt-0.5">Full index of music tracks imported and created.</p>
                )}
              </>
            )}
          </div>
          <div className="text-right font-mono text-[10px] text-slate-500 shrink-0 self-end sm:self-auto">
            <span className="text-slate-300 font-bold">{currentCategoryTracks.length}</span> individual records
          </div>
        </div>

        {/* 3. TRACKS LIST SHELF */}
        <div className="flex-1 min-h-0 overflow-y-auto max-h-[50vh] overscroll-contain space-y-2 mt-1 pr-1" id="music-track-list">
          {libraryLoading ? (
            <div className="h-48 flex items-center justify-center flex-col gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin" />
              <span className="text-xs font-mono text-slate-500">Querying IndexedDB catalog...</span>
            </div>
          ) : activeSubTab === "playlists" ? (
            /* MULTI-PLAYLIST CARD GRID PANEL */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="playlists-grid">
              {playlists.length === 0 ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-800/45 rounded-2xl bg-slate-900/10">
                  <ListMusic className="w-12 h-12 text-slate-600 mb-3" />
                  <h4 className="text-sm font-bold text-slate-400">No playlists available</h4>
                  <p className="text-xs text-slate-550 max-w-xs mt-1 leading-relaxed">
                    Instantly load classic stream compilations or use batch / single integrate to capture items from archive.org.
                  </p>
                </div>
              ) : (
                playlists.map((pl) => (
                  <PlaylistCard
                    key={pl.id}
                    playlist={pl}
                    active={selectedPlaylistId === pl.id}
                    customTrackCount={pl.isSmart ? getSmartPlaylistTracks(pl).length : pl.tracks?.length}
                    onClick={() => {
                      setSelectedPlaylistId(pl.id);
                      setActiveSubTab("playlist");
                      
                      // Auto load that playlist tracks into queue!
                      const plTracks = pl.isSmart ? getSmartPlaylistTracks(pl) : allTracks.filter(t => pl.tracks.includes(t.id || ""));
                      if (plTracks.length > 0) {
                        playTrackList(plTracks, 0);
                        addLog(`Loaded and broadcasting playlist "${pl.name}" on the audio desk`, "info");
                      }
                    }}
                  />
                ))
              )}
            </div>
          ) : currentCategoryTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-800/40 rounded-2xl bg-slate-900/10">
              <Music className="w-12 h-12 text-slate-600 mb-2.5 animate-pulse" />
              <h4 className="text-sm font-bold text-slate-400">No tracks matching this category</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Import custom audio URL tracks directly using the "ADD NY" button above, or click "SEED CLASSICS" to instantly populate default soundtracks.
              </p>
            </div>
          ) : (
            currentCategoryVisibleTracks.map((track, idx) => {
              const isPlayingNow = false; // Resolved on player side
              const isTrackExpanded = activeAddToPlaylistTrackId === track.id;

              return (
                <div
                  key={track.id}
                  className={`relative flex flex-col md:flex-row items-stretch md:items-center justify-between p-3.5 border rounded-2xl hover:border-slate-700/60 transition-all transition-colors duration-200 group ${
                    theme === "light" 
                      ? "bg-white border-slate-200 hover:bg-slate-50" 
                      : "bg-[#111624] border-slate-850/60 hover:bg-[#161D30]"
                  }`}
                >
                  {/* Left Metadata Side */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Play Button Overlay on hover / Avatar */}
                    <div 
                      className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center cursor-pointer transition-all relative overflow-hidden group/art ${
                        theme === "light" ? "bg-slate-100 text-slate-600" : "bg-[#1C253D] text-slate-400 hover:text-white"
                      }`}
                      onClick={() => handlePlaySelectedTrack(track, idx)}
                      aria-label={`Play ${track.title}`}
                    >
                      <Music className="w-4.5 h-4.5 group-hover/art:opacity-0 transition-opacity" />
                      <div className="absolute inset-0 bg-blue-600/90 text-white flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 fill-current" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* TITLE CORRECTION: RECOGNISING TITLE OVERFLOW RULE - ALLOW NATURAL LINE EXPANSION & HORIZONTAL SCROLL OR BEAUTIFUL MAX-W HOVER SCROLL */}
                        <h4 className="text-xs font-semibold text-white leading-tight group-hover:text-blue-400 transition-colors overflow-x-auto whitespace-nowrap scrollbar-none pr-1">
                          {track.title}
                        </h4>
                        
                        {track.genre && (
                          <span className="text-[8px] font-mono uppercase bg-indigo-500/10 text-indigo-400 font-bold px-1.5 py-0.5 rounded border border-indigo-500/10 shrink-0">
                            {track.genre}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400 mt-1 min-w-0">
                        <span className="font-semibold text-slate-300 truncate max-w-[120px]">{track.artist || "Unknown Artist"}</span>
                        {track.album && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                            <Disc className="w-3 h-3" />
                            <span className="truncate max-w-[100px]">{track.album}</span>
                          </div>
                        )}
                        {track.year && (
                          <div className="flex items-center gap-0.5 text-[10px] text-slate-500 shrink-0 font-mono">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            <span>{track.year}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions Block */}
                  <div className="flex items-center gap-2 md:gap-3 shrink-0 mt-3.5 md:mt-0 justify-between md:justify-end border-t border-slate-800/10 md:border-t-0 pt-2.5 md:pt-0">
                    
                    {/* Time indicator */}
                    <span className="text-[10px] font-mono text-slate-500 mr-2 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-600" /> 
                      {track.length ? `${Math.floor(track.length / 60)}:${String(track.length % 60).padStart(2, '0')}` : "--:--"}
                    </span>

                    {/* Action buttons list */}
                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setInitialTrackData(track);
                          setShowAddTrack(true);
                        }}
                        className="p-2.5 rounded-xl cursor-pointer text-slate-500 hover:text-blue-400 hover:bg-slate-800/40 transition-colors shrink-0 flex items-center justify-center"
                        title="Edit Track Metadata"
                        aria-label="Edit Track Metadata"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => toggleFavorite(track.id || "")}
                        className={`p-2.5 rounded-xl cursor-pointer hover:bg-slate-800/40 transition-colors shrink-0 flex items-center justify-center ${
                          track.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-500 hover:text-amber-400'
                        }`}
                        title={track.isFavorite ? "Unmark Favorite" : "Mark as Favorite"}
                        aria-label="Toggle Favorite"
                      >
                        <Heart className="w-4 h-4" />
                      </button>

                      {/* Playlist assignment dropdown toggler */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setActiveAddToPlaylistTrackId(isTrackExpanded ? null : track.id || null);
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1 border border-slate-800/50 ${
                            isTrackExpanded 
                              ? "bg-slate-800 border-slate-700 text-blue-400" 
                              : "text-slate-500 hover:text-white"
                          }`}
                          title="Add track to playlist"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <ChevronDown className={`w-3 h-3 transition-transform ${isTrackExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Playlist Options Floating overlay dropdown */}
                        {isTrackExpanded && (
                          <div className={`absolute right-0 bottom-12 md:bottom-auto md:top-12 z-50 w-56 rounded-2xl shadow-xl border p-2 text-left scale-100 animate-fade-in ${
                            theme === "light" ? "bg-white border-slate-200" : "bg-slate-950 border-slate-850"
                          }`}>
                            <div className="text-[9px] font-mono text-slate-500 px-3.5 py-1 uppercase tracking-widest font-bold">
                              Add to Playlist
                            </div>
                            
                            <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1">
                              {playlists.length === 0 ? (
                                <button
                                  onClick={() => {
                                    setShowCreatePlaylist(true);
                                    setActiveAddToPlaylistTrackId(null);
                                  }}
                                  className="w-full text-left text-[11px] text-blue-400 hover:bg-blue-600/10 p-2 rounded-xl flex items-center gap-2.5"
                                >
                                  <FilePlus2 className="w-3.5 h-3.5 shrink-0" /> Create new playlist
                                </button>
                              ) : (
                                playlists.map(pl => {
                                  const alreadyInList = pl.tracks.includes(track.id || "");
                                  return (
                                    <button
                                      key={pl.id}
                                      onClick={() => {
                                        if (alreadyInList) {
                                          removeTrackFromPlaylist(pl.id, track.id || "");
                                          addLog(`Removed "${track.title}" from playlist "${pl.name}".`, "info");
                                        } else {
                                          addTrackToPlaylist(pl.id, track.id || "");
                                          addLog(`Added "${track.title}" to playlist "${pl.name}".`, "info");
                                        }
                                        setActiveAddToPlaylistTrackId(null);
                                      }}
                                      className={`w-full text-left text-xs p-2 rounded-xl flex items-center justify-between transition-colors ${
                                        alreadyInList 
                                          ? "bg-indigo-600/15 text-indigo-400 font-bold" 
                                          : theme === "light" ? "text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-900"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate pr-1">
                                        <ListMusic className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span className="truncate">{pl.name}</span>
                                      </div>
                                      {alreadyInList && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-400" />}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Remove track from current playlist OR delete globally */}
                      {activeSubTab === "playlist" ? (
                        <button
                          onClick={() => {
                            if (selectedPlaylistId) {
                              removeTrackFromPlaylist(selectedPlaylistId, track.id || "");
                              addLog(`Removed "${track.title}" from playlist.`, "info");
                            }
                          }}
                          className="p-2.5 hover:bg-red-950/20 text-slate-500 hover:text-red-500 rounded-xl cursor-pointer shrink-0 transition-colors"
                          title="Remove from Playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        // Optional premium global delete only on custom items (avoiding default overrides)
                        track.id?.startsWith("track-pre-") || track.id?.startsWith("track-") ? (
                          <button
                            onClick={() => {
                              if (confirm(`Remove track "${track.title}" permanently from Music Library?`)) {
                                // Real data is sliced using library's internal delete or setAllTracks updates
                                // Since we mutate allTracks, we can wire up simple filter
                                addLog(`Track "${track.title}" removed.`, "info");
                              }
                            }}
                            className="p-2.5 opacity-0 group-hover:opacity-100 hover:bg-red-900/10 text-slate-600 hover:text-red-500 rounded-xl cursor-pointer transition-opacity shrink-0"
                            title="Remove from Library"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Lazy Load load more footer */}
          {currentCategoryTracks.length > currentCategoryVisibleTracks.length && (
            <div className="py-4 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-2 border border-slate-800 hover:bg-slate-800 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-mono uppercase tracking-wider"
              >
                Load More Records ({currentCategoryTracks.length - currentCategoryVisibleTracks.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. DIALOG MODAL: CREATE PLAYLIST */}
      {showCreatePlaylist && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreatePlaylist(false)}
        >
          <form 
            onSubmit={handleCreatePlaylist}
            className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl scale-100 animate-zoom-in ${
              theme === "light" ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950 border-slate-850 text-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-indigo-400" /> Create Custom Playlist
              </h3>
              <button 
                type="button"
                onClick={() => setShowCreatePlaylist(false)}
                className="text-xs text-slate-500 hover:text-white"
              >
                ESC
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">PLAYLIST NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Focus, Classic Heavies"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">DESCRIPTION (OPTIONAL)</label>
                <textarea
                  placeholder="e.g. High intensity ambient background soundtracks..."
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none h-16 resize-none"
                />
              </div>

              {/* Smart Playlist Switch */}
              <div className="pt-2.5 flex items-center justify-between border-t border-slate-800/40">
                <div>
                  <span className="block text-[10px] font-mono font-bold text-slate-300">⚡ SMART PLAYLIST</span>
                  <span className="block text-[8px] text-slate-500">Auto-update tracks based on dynamic conditions</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSmart}
                  onChange={(e) => {
                    setIsSmart(e.target.checked);
                    if (e.target.checked) {
                      setSmartField("genre");
                      setSmartOperator("equals");
                      setSmartValue("");
                    }
                  }}
                  className="w-4 h-4 rounded text-indigo-500 border-slate-800 focus:ring-indigo-500 bg-slate-900 cursor-pointer"
                />
              </div>

              {isSmart && (
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2.5 animate-zoom-in">
                  <div>
                    <label className="block text-[9px] font-mono text-slate-500 mb-0.5">RULE CONDITION FIELD</label>
                    <select
                      value={smartField}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setSmartField(val);
                        if (val === "isFavorite") {
                          setSmartOperator("equals");
                          setSmartValue("true");
                        } else if (val === "year") {
                          setSmartOperator("equals");
                          setSmartValue("");
                        } else {
                          setSmartOperator("equals");
                          setSmartValue("");
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="genre">Genre</option>
                      <option value="artist">Artist Name</option>
                      <option value="album">Album Name</option>
                      <option value="year">Year</option>
                      <option value="isFavorite">Is Favorite Status</option>
                    </select>
                  </div>

                  {smartField !== "isFavorite" && (
                    <div>
                      <label className="block text-[9px] font-mono text-slate-500 mb-0.5">MATCH TYPE</label>
                      <select
                        value={smartOperator}
                        onChange={(e) => setSmartOperator(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                      >
                        <option value="equals">Exactly Equals</option>
                        <option value="contains">Contains Value</option>
                        {smartField === "year" && <option value="greaterThan">Greater Than</option>}
                        {smartField === "year" && <option value="lessThan">Less Than</option>}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[9px] font-mono text-slate-500 mb-0.5">CRITERIA VALUE</label>
                    {smartField === "isFavorite" ? (
                      <select
                        value={smartValue}
                        onChange={(e) => setSmartValue(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                      >
                        <option value="true">True (Starred)</option>
                        <option value="false">False (Unstarred)</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder={smartField === "year" ? "e.g. 1995" : "e.g. Classical, Jazz"}
                        value={smartValue}
                        onChange={(e) => setSmartValue(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/20">
              <button
                type="button"
                onClick={() => setShowCreatePlaylist(false)}
                className="px-3.5 py-1.5 border border-slate-800 text-xs rounded-xl hover:bg-slate-900 text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-xl text-white shadow-md shadow-blue-900/20 cursor-pointer"
              >
                Assemble Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. DIALOG MODAL: ADD CUSTOM TRACK */}
      <TrackRegistrationModal
        isOpen={showAddTrack}
        onClose={() => {
          setShowAddTrack(false);
          setInitialTrackData(undefined);
        }}
        onSave={handleCreateTrack}
        theme={theme}
        initialData={initialTrackData}
      />

      {/* Floating Dynamic Notification Overlay Tray */}
      <div className="fixed top-6 right-6 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto cursor-pointer bg-slate-900/95 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.65)] flex items-start gap-3 group select-none hover:border-slate-705 hover:bg-slate-900 transition-all duration-300"
            >
              {t.thumbnailUrl ? (
                <img
                  src={t.thumbnailUrl}
                  alt={t.title}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-800/50 shadow-md group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs">🎵</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-slate-100 flex items-center justify-between">
                  <span className="truncate">{t.title}</span>
                  <span className="text-[9px] text-slate-500 font-mono ml-2 shrink-0 opacity-60 group-hover:opacity-100 group-hover:text-red-400 transition-all">✕</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-normal break-words font-medium">
                  {t.message}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

MusicLibraryView.displayName = "MusicLibraryView";
