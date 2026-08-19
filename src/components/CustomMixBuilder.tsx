import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useMemo, useEffect } from "react";
import { IPTVChannel } from "../types";
import { buildM3U, triggerClientDownload, ExportEpisode } from "../utils/exportUtils";
import { 
  Search, 
  CheckSquare, 
  Square, 
  Download, 
  Trash2, 
  Plus, 
  Layers, 
  Sparkles, 
  Save, 
  FolderOpen,
  Filter,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface CustomMixBuilderProps {
  channels: IPTVChannel[];
  theme: "light" | "dark";
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
}

interface SavedMix {
  id: string;
  name: string;
  urls: string[];
  createdAt: string;
}

export function CustomMixBuilder({ channels, theme, addLog }: CustomMixBuilderProps) {
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL_GROUPS");
  const [playlistName, setPlaylistName] = useState("My Custom Mix");
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>([]);
  const [newMixSaveName, setNewMixSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load Saved Mix Templates from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_iptv_custom_mixes");
      if (saved) {
        setSavedMixes(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load saved mixes", e);
    }
  }, []);

  // Save to LocalStorage helper
  const persistSavedMixes = (mixes: SavedMix[]) => {
    try {
      safeLocalStorage.setItem("ajn_iptv_custom_mixes", JSON.stringify(mixes));
      setSavedMixes(mixes);
    } catch (e) {
      console.error("Failed to persist saved mixes", e);
    }
  };

  // Extract unique group names for filter dropdown
  const uniqueGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const ch of channels) {
      if (ch.group) groups.add(ch.group);
    }
    return Array.from(groups).sort();
  }, [channels]);

  // Filter channels based on search query & group dropdown
  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = selectedGroup === "ALL_GROUPS" || ch.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchQuery, selectedGroup]);

  // Toggle selection of single URL
  const toggleSelectUrl = (url: string) => {
    setSelectedUrls(prev => {
      if (prev.includes(url)) {
        return prev.filter(u => u !== url);
      } else {
        return [...prev, url];
      }
    });
  };

  // Toggle all visible filtered channels
  const handleToggleSelectAllFiltered = () => {
    const visibleUrls = filteredChannels.map(ch => ch.url);
    const allVisibleSelected = visibleUrls.every(url => selectedUrls.includes(url));

    if (allVisibleSelected) {
      // Remove all visible URLs from selection
      setSelectedUrls(prev => prev.filter(url => !visibleUrls.includes(url)));
      addLog(`Deselected ${visibleUrls.length} filtered channels.`, "info");
    } else {
      // Add all missing visible URLs to selection
      setSelectedUrls(prev => {
        const union = new Set([...prev, ...visibleUrls]);
        return Array.from(union);
      });
      addLog(`Selected all ${visibleUrls.length} filtered channels.`, "info");
    }
  };

  // Clear selections entirely
  const handleClearAllSelections = () => {
    setSelectedUrls([]);
    addLog("Custom Mix canvas selection cleared.", "info");
  };

  // Compile and trigger browser download of custom M3U
  const handleExportCustomMix = () => {
    if (selectedUrls.length === 0) {
      addLog("Cannot export: Please select at least one channel for the custom mix.", "warning");
      return;
    }

    const selectedChannels = channels.filter(ch => selectedUrls.includes(ch.url));
    const exportList: ExportEpisode[] = selectedChannels.map(ch => ({
      title: ch.name,
      url: ch.url,
      duration: ch.duration !== undefined ? ch.duration : -1,
      groupTitle: ch.group || "Custom Mix",
      tvgLogo: ch.logo || "",
      tvgId: ch.tvgId,
      tvgName: ch.tvgName,
      tvgChno: ch.tvgChno,
      tvgLanguage: ch.tvgLanguage,
      tvgCountry: ch.tvgCountry,
      tvgGenre: ch.tvgGenre,
      userAgent: ch.userAgent,
      referer: ch.referer,
      catchup: ch.catchup,
      catchupDays: ch.catchupDays,
      resolution: ch.resolution,
      bitrate: ch.bitrate,
      codec: ch.codec
    }));

    const cleanPlaylistTitle = playlistName.trim() || "AJN Custom Mix";
    const m3uContent = buildM3U(exportList, cleanPlaylistTitle, false);
    const fileName = `${cleanPlaylistTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_mix.m3u`;

    triggerClientDownload(m3uContent, fileName, "audio/x-mpegurl;charset=utf-8");
    addLog(`Successfully compiled and exported "${cleanPlaylistTitle}" M3U containing ${selectedChannels.length} channels.`, "info");
  };

  // Save current selection template
  const handleSaveMixTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMixSaveName.trim()) return;
    if (selectedUrls.length === 0) {
      addLog("Cannot save mix template: selection is empty.", "warning");
      return;
    }

    const newMix: SavedMix = {
      id: `mix-${Date.now()}`,
      name: newMixSaveName.trim(),
      urls: [...selectedUrls],
      createdAt: new Date().toLocaleDateString()
    };

    const updated = [newMix, ...savedMixes];
    persistSavedMixes(updated);
    addLog(`Temporary Mix Selection Template "${newMix.name}" saved! Quick retrieval active.`, "info");
    setNewMixSaveName("");
    setShowSaveDialog(false);
  };

  // Load a saved mix template
  const handleLoadMixTemplate = (mix: SavedMix) => {
    // Validate how many loaded URLs exist in our current channel pool
    const validUrls = mix.urls.filter(url => channels.some(ch => ch.url === url));
    setSelectedUrls(validUrls);
    setPlaylistName(mix.name);
    addLog(`Loaded Selection Template "${mix.name}"! Recovered ${validUrls.length} of ${mix.urls.length} channels.`, "info");
  };

  // Delete a saved mix template
  const handleDeleteMixTemplate = (id: string, name: string) => {
    const updated = savedMixes.filter(m => m.id !== id);
    persistSavedMixes(updated);
    addLog(`Selection Template "${name}" deleted.`, "info");
  };

  // Check if all visible channels are checked
  const isAllFilteredChecked = useMemo(() => {
    if (filteredChannels.length === 0) return false;
    return filteredChannels.every(ch => selectedUrls.includes(ch.url));
  }, [filteredChannels, selectedUrls]);

  return (
    <div className={`border rounded-2xl p-5 md:p-6 transition-all duration-300 ${
      theme === "light" 
        ? "bg-[#FCFDFE] border-slate-200 text-slate-800"
        : "bg-[#090C15] border-slate-800/80 text-slate-350"
    }`} id="custom-mix-builder-card">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-dashed border-slate-800/40 mb-5">
        <div>
          <h3 className="text-sm font-black tracking-wider uppercase text-indigo-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> Custom Mix Channel Assembler
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Check individual stream records from your active catalog to stitch together a custom playback sequence M3U.
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-semibold">SELECTED POOL:</span>
          <span className="text-xs font-mono font-black px-3 py-1 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 animate-bounce">
            {selectedUrls.length} / {channels.length}
          </span>
        </div>
      </div>

      {/* Grid Layout: Config Inputs on Left, Selection List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Hand: Controls & Saved Templates (Col-span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Metadata Section */}
          <div className={`p-4 rounded-2xl space-y-3.5 border ${
            theme === "light" ? "bg-slate-50 border-slate-150" : "bg-slate-950/40 border-slate-850"
          }`}>
            <span className="text-[9px] font-mono font-extrabold text-indigo-400 uppercase tracking-wider block">Mix Configuration</span>
            
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 uppercase">PLAYLIST FILE NAME</label>
              <input
                type="text"
                placeholder="My custom feed list"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full bg-[#1A1F2C]/40 text-xs border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-550 focus:border-indigo-500 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExportCustomMix}
                disabled={selectedUrls.length === 0}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono font-bold text-[11px] uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-3.5 h-3.5" /> Compile & Download Mix
              </button>

              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                disabled={selectedUrls.length === 0}
                className="w-full py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-400 disabled:bg-slate-955 disabled:text-slate-700 font-mono text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" /> Save template profile
              </button>
            </div>
          </div>

          {/* Quick template Save overlay dialog inside Sidebar */}
          {showSaveDialog && (
            <form onSubmit={handleSaveMixTemplate} className="space-y-3 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/20 animate-fade-in">
              <span className="text-[9px] font-mono font-bold text-indigo-400 block uppercase">Save Selection Template</span>
              <input
                type="text"
                required
                placeholder="e.g. News & Weather, Sports Setup"
                value={newMixSaveName}
                onChange={(e) => setNewMixSaveName(e.target.value)}
                className="w-full bg-slate-950 text-xs border border-slate-800 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="px-2.5 py-1 text-[9.5px] font-mono text-slate-400 hover:bg-slate-800/40 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-[9.5px] font-mono bg-indigo-600 text-white hover:bg-indigo-500 rounded-md font-bold"
                >
                  Save Mix
                </button>
              </div>
            </form>
          )}

          {/* Quick Retrieval Selections Shelf */}
          <div className={`p-4 rounded-2xl flex-1 min-h-[160px] flex flex-col border ${
            theme === "light" ? "bg-slate-50 border-slate-150" : "bg-slate-950/40 border-slate-850"
          }`}>
            <span className="text-[9px] font-mono font-extrabold text-blue-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" /> SAVED MIX TEMPLATES ({savedMixes.length})
            </span>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 max-h-[220px] scrollbar-thin scrollbar-track-transparent">
              {savedMixes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <span className="text-[10px] font-mono text-slate-500 italic">No saved selection templates. Mark checkboxes and save selection templates on the left for swift retrieval.</span>
                </div>
              ) : (
                savedMixes.map(mix => (
                  <div 
                    key={mix.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900/45 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 transition-all cursor-pointer group"
                    onClick={() => handleLoadMixTemplate(mix)}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-300 truncate leading-tight">{mix.name}</div>
                      <div className="text-[9px] font-mono text-slate-500 mt-0.5">{mix.urls.length} channels • {mix.createdAt}</div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMixTemplate(mix.id, mix.name);
                      }}
                      className="p-1 rounded hover:bg-red-950/20 text-slate-500 hover:text-red-500 shrink-0 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Wipe Saved Template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Hand: Channel Picker Table (Col-span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-3.5">
          
          {/* Filters shelf */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            
            {/* Search Filter */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lookup channels by name or URL keywords..."
                className="w-full bg-slate-950/60 border border-slate-850 text-xs rounded-xl pl-9 pr-3.5 py-2 text-white placeholder-slate-550 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Group category filter */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3" /> GROUP
              </span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 font-mono outline-none cursor-pointer w-full sm:w-48 whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <option value="ALL_GROUPS">All Groups Categories</option>
                {uniqueGroups.map(gp => (
                  <option key={gp} value={gp}>{gp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Select Tool links */}
          <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-slate-800/10">
            <span className="text-slate-500">
              Showing <span className="text-slate-300 font-bold">{filteredChannels.length}</span> matching stream sources
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSelectAllFiltered}
                disabled={filteredChannels.length === 0}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase cursor-pointer"
              >
                {isAllFilteredChecked ? "[ ] Deselect visible" : "[x] Select visible"}
              </button>

              <span className="text-slate-800/60 font-mono">|</span>

              <button
                type="button"
                onClick={handleClearAllSelections}
                disabled={selectedUrls.length === 0}
                className="text-[10px] text-red-400 hover:text-rose-300 font-bold uppercase cursor-pointer disabled:opacity-30"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Core scroll grid list of channels */}
          <div className="flex-1 min-h-0 overflow-y-auto max-h-[350px] space-y-1.5 pr-1.5 scrollbar-thin scrollbar-track-transparent">
            {filteredChannels.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/10 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-7 h-7 text-slate-600 animate-pulse" />
                <span className="text-xs font-mono text-slate-500">No channels match current query constraints. Try shifting keywords.</span>
              </div>
            ) : (
              filteredChannels.map((chan) => {
                const isSelected = selectedUrls.includes(chan.url);
                return (
                  <div
                    key={chan.url}
                    onClick={() => toggleSelectUrl(chan.url)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-indigo-600/5 border-indigo-500/20 hover:bg-indigo-650/10" 
                        : "bg-slate-900/10 border-slate-850 hover:bg-slate-900/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      {/* Interactive checkbox selector */}
                      <button
                        type="button"
                        className={`p-1 rounded-md shrink-0 border ${
                          isSelected ? "border-indigo-500 text-indigo-400 bg-indigo-500/10" : "border-slate-700 text-slate-500"
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200 truncate pr-0.5">{chan.name}</span>
                          {chan.group && (
                            <span className="text-[8px] font-mono uppercase bg-slate-800 text-slate-500 font-bold px-1 py-0.5 rounded border border-slate-750">
                              {chan.group}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-mono text-slate-500 truncate leading-relaxed mt-0.5" title={chan.url}>
                          {chan.url}
                        </p>
                      </div>
                    </div>

                    {/* Meta indicator status */}
                    <div className="shrink-0 flex items-center">
                      <span className="text-[9px] font-mono py-0.5 px-2 bg-slate-900 text-slate-400 rounded-full">
                        {chan.duration !== undefined && chan.duration > 0 ? "VOD" : "LIVE"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
