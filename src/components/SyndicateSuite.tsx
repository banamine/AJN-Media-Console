/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FolderPlus, Scan, Trash2, Calendar, Library, Tv, FileCode, Check, 
  Layers, ChevronLeft, ChevronRight, Play, Eye, Settings, RefreshCw, 
  Clock, Plus, Info, ListCollapse, PlusCircle, LayoutGrid, CheckSquare
} from "lucide-react";
import { usePlaylistVault } from "../hooks/usePlaylistVault";
import { useBroadcastDay } from "../hooks/useBroadcastDay";
import { useSeries } from "../hooks/useSeries";
import { useFolderWatcher } from "../hooks/useFolderWatcher";
import { IPTVChannel, BroadcastDaySchedule, TVShowSeries } from "../types";

interface SyndicateSuiteProps {
  currentUrl?: string;
  theme?: string;
  onPlayChannel: (url: string, name: string) => void;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  showToast: (msg: string) => void;
}

export function SyndicateSuite({
  currentUrl,
  theme = "dark",
  onPlayChannel,
  selectedDate,
  onSelectDate,
  showToast,
}: SyndicateSuiteProps) {
  // Pull our custom hooks
    const getRollingDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -1; i <= 2; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };
  const dateWindow = getRollingDates();
  const defaultDate = dateWindow[1];
  
  const actualDate = selectedDate || defaultDate;
  
const { 
    channels, playlists, importM3U, removePlaylist, addCustomChannel, incrementChannelPlay, reloadVault 
  } = usePlaylistVault();

  const {
    schedules, currentSchedule, activeDateKey, selectDateKey, saveDaySchedule, reloadBroadcastDay
  } = useBroadcastDay(actualDate);

  const {
    seriesList, createGroupedSeries, removeSeries, reloadSeries, getNextEpisode, getPreviousEpisode, loadSeriesDetails
  } = useSeries();

  const {
    folders, activeScanId, watchPath, unwatchPath, scanFolder, reloadFolders
  } = useFolderWatcher();

  // Component local states
  const [activeSubSection, setActiveSubSection] = useState<"vault" | "broadcast" | "series" | "watcher">("vault");
  
  // Custom stream state
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customGroup, setCustomGroup] = useState("Custom Streams");

  // New Series state
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesSeason, setNewSeriesSeason] = useState(2026);
  const [selectedEpUrls, setSelectedEpUrls] = useState<string[]>([]);

  // New Watched Folder state
  const [newFolderPath, setNewFolderPath] = useState("");
  const [watchAutoPoll, setWatchAutoPoll] = useState(false);

  // New EPG Schedule item
  const [schedTime, setSchedTime] = useState("10:00");
  const [schedTitle, setSchedTitle] = useState("");
  const [schedUrl, setSchedUrl] = useState("");

  // Sync date key selection if selectedDate changes from parent
  useEffect(() => {
    if (actualDate) {
      selectDateKey(actualDate);
    }
  }, [actualDate, selectDateKey]);

  // Handle adding custom channel stream
  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName || !customUrl) {
      showToast("NAME AND URL ARE REQUIRED");
      return;
    }
    try {
      const newChan: IPTVChannel = {
        name: customName,
        url: customUrl,
        logo: null,
        group: customGroup || "Custom Streams",
        contentType: "live",
        playCount: 0,
        category: [customGroup || "Custom Streams"],
      };
      await addCustomChannel(newChan);
      setCustomName("");
      setCustomUrl("");
      showToast("CUSTOM STREAM ADDED TO VAULT");
    } catch (err) {
      showToast("FAILED TO ADD CUSTOM FEED");
    }
  };

  // Handle watched folder registry creation
  const handleWatchFolderReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderPath) return;
    try {
      await watchPath(newFolderPath, watchAutoPoll);
      setNewFolderPath("");
      showToast("MONITORED FOLDER REGISTERED");
    } catch (err) {
      showToast("ERROR WATCHING FOLDER");
    }
  };

  // Run on-demand scan
  const handleOnDemandScan = async (folderId: string) => {
    showToast("SCANNING SIMULATED DIRECTORY...");
    const added = await scanFolder(folderId);
    if (added.length > 0) {
      showToast(`SCAN MAPPED ${added.length} ASSETS SUCCESSFULLY`);
      reloadVault();
    } else {
      showToast("SCAN RETRIEVED ZERO AUDIO/VIDEO PACKS");
    }
  };

  // Add EPG schedule item for the active broadcast day
  const handleAddScheduleItem = async () => {
    if (!schedTitle) return;
    
    const baseSchedule: BroadcastDaySchedule = currentSchedule || {
      dateKey: activeDateKey,
      dayStart: "06:00",
      note: "Syndicate Schedule Log",
      rules: "Custom Broadcast Timing Rules",
      scheduleItems: [],
    };

    const newItem = {
      id: `sch-item-${Date.now()}`,
      time: schedTime,
      title: schedTitle,
      channelUrl: schedUrl || undefined,
    };

    // Keep items sorted by time
    const updatedItems = [...baseSchedule.scheduleItems, newItem].sort((a, b) => 
      a.time.localeCompare(b.time)
    );

    const updatedSchedule: BroadcastDaySchedule = {
      ...baseSchedule,
      scheduleItems: updatedItems,
    };

    await saveDaySchedule(updatedSchedule);
    setSchedTitle("");
    setSchedUrl("");
    showToast("ADDED PROGRAM TO BROADCAST INDEX");
  };

  // Compile selected channels into a Serial TV Show
  const handleCompileSeries = async () => {
    if (!newSeriesName) {
      showToast("ENTER A NAME FOR THE SERIES");
      return;
    }
    if (selectedEpUrls.length === 0) {
      showToast("SELECT AT LEAST ONE CHANNEL TO BUNDLE");
      return;
    }

    const epsToBundle = channels
      .filter(ch => selectedEpUrls.includes(ch.url))
      .map(ch => ({
        title: ch.name,
        url: ch.url,
      }));

    try {
      await createGroupedSeries(newSeriesName, newSeriesSeason, epsToBundle);
      setNewSeriesName("");
      setSelectedEpUrls([]);
      showToast("TV SERIES COMPILED WITH ACTIVE EPISODES");
    } catch (err) {
      showToast("FAILED TO COMPILE SERIES");
    }
  };

  const toggleSelectEpUrl = (url: string) => {
    setSelectedEpUrls(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  // Helper: Next/Previous controls matching current playing URL
  const handlePrevEpClick = async (seriesId: string) => {
    if (!currentUrl) return;
    const prev = await getPreviousEpisode(seriesId, currentUrl);
    if (prev) {
      onPlayChannel(prev.url, prev.title);
      await incrementChannelPlay(prev.url);
      showToast(`PLAYING PREVIOUS EPISODE: ${prev.title}`);
    } else {
      showToast("ALREADY ON FIRST INDEXED EPISODE");
    }
  };

  const handleNextEpClick = async (seriesId: string) => {
    if (!currentUrl) return;
    const next = await getNextEpisode(seriesId, currentUrl);
    if (next) {
      onPlayChannel(next.url, next.title);
      await incrementChannelPlay(next.url);
      showToast(`PLAYING NEXT EPISODE: ${next.title}`);
    } else {
      showToast("ALREADY ON LATEST INDEXED EPISODE");
    }
  };

  // Dynamic background style matching high contrast theme rule
  const panelBg = theme === "light" 
    ? "bg-white border-slate-200 text-slate-800" 
    : "bg-[#090d14]/95 border-slate-850 text-slate-200";

  const itemBorder = theme === "light" ? "border-slate-100" : "border-slate-800/60";

  return (
    <div className={`p-4 border rounded-2xl flex flex-col gap-4 ${panelBg} shadow-2xl backdrop-blur-md`}>
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-500 animate-pulse" />
          <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-slate-300">
            TV Syndication & IDB Engine
          </span>
        </div>
        <button 
          onClick={() => {
            reloadVault();
            reloadBroadcastDay();
            reloadSeries();
            reloadFolders();
            showToast("INDEXED DATA RE-SYNCHRONIZED");
          }}
          className="p-1 hover:text-white rounded text-slate-400 transition-all cursor-pointer"
          title="Force reload all stores from IndexedDB Database"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs navigation */}
      <div className="grid grid-cols-4 bg-slate-900/90 p-0.5 rounded-xl border border-slate-800/30 text-[9.5px] font-mono font-bold">
        <button
          onClick={() => setActiveSubSection("vault")}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${activeSubSection === "vault" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
        >
          📂 Vault ({playlists.length})
        </button>
        <button
          onClick={() => setActiveSubSection("broadcast")}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${activeSubSection === "broadcast" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
        >
          📅 EPG Day
        </button>
        <button
          onClick={() => setActiveSubSection("series")}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${activeSubSection === "series" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
        >
          🎬 Series ({seriesList.length})
        </button>
        <button
          onClick={() => setActiveSubSection("watcher")}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${activeSubSection === "watcher" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
        >
          📡 Sentinel
        </button>
      </div>

      {/* 1. PLAYLIST VAULT ACTIVE SUBSECTION */}
      {activeSubSection === "vault" && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          {/* Add custom feed */}
          <form onSubmit={handleAddCustom} className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/30 flex flex-col gap-2">
            <span className="text-[9.5px] font-mono font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3 h-3 text-blue-500" /> Save Custom Stream Feed
            </span>
            <input 
              type="text" 
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. AJ Live Syndication Backup" 
              className="text-[11px] font-mono p-1.5 bg-slate-950 border border-slate-800/60 rounded text-slate-300 w-full focus:outline-none focus:border-blue-500"
            />
            <input 
              type="text" 
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="e.g. https://domain.com/feed.m3u8" 
              className="text-[11px] font-mono p-1.5 bg-slate-950 border border-slate-800/60 rounded text-slate-300 w-full focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-between items-center mt-1">
              <input 
                type="text" 
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="Category (e.g. News)" 
                className="text-[11px] font-mono p-1 bg-slate-950 border border-slate-800/30 rounded text-slate-400 max-w-[130px] focus:outline-none"
              />
              <button 
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9.5px] font-mono font-black rounded-xl transition-all cursor-pointer"
              >
                ADD TO STORE
              </button>
            </div>
          </form>

          {/* List of active lists */}
          <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-1">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold mb-1">
              Imported Playlists ({playlists.length})
            </span>
            {playlists.length === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 italic">No custom templates or external playlists loaded in IndexedDB. Use custom forms to build registries.</span>
            ) : (
              playlists.map((pl) => (
                <div key={pl.id} className="flex items-center justify-between p-2 bg-slate-900/65 rounded-xl border border-slate-805 text-slate-300 font-mono text-[10.5px]">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-blue-400 truncate max-w-[170px]">{pl.name}</span>
                    <span className="text-[8.5px] text-slate-500">{pl.channelCount} Streams • {new Date(pl.importedAt).toLocaleDateString()}</span>
                  </div>
                  <button 
                    onClick={() => {
                      removePlaylist(pl.id);
                      showToast("PRUNED M3U VAULT METADATA");
                    }}
                    className="p-1 hover:text-red-500 text-slate-500 transition-all cursor-pointer"
                    title="Remove M3U Playlist Database Entry"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. BROADCAST DAY AGENDA */}
      {activeSubSection === "broadcast" && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          
          {/* EPG Day Info Header */}
          <div className="flex flex-col p-2.5 bg-slate-900/30 border border-slate-800 hover:border-slate-750 transition-all rounded-xl font-mono">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> TV DAY LOG: {activeDateKey}
              </span>
              <span className="text-[9px] text-blue-500 font-bold px-1.5 py-0.5 bg-blue-900/10 border border-blue-900/20 rounded-md">
                06:00 AM START
              </span>
            </div>
            <span className="text-[9.5px] text-slate-500 mt-1">Rule: Items playing between 12:00 AM and 05:59 AM map under previous late-night roster.</span>
          </div>

          {/* Scheduled programs list */}
          <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">
              Daily Program Lineup ({currentSchedule?.scheduleItems.length || 0})
            </span>
            {!currentSchedule || currentSchedule.scheduleItems.length === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 italic">No segments scheduled for today. Fill program bar to schedule feeds.</span>
            ) : (
              currentSchedule.scheduleItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-2 bg-slate-900/50 rounded-xl border border-slate-805 font-mono text-[10.5px]">
                  <div className="flex items-start gap-2.5">
                    <span className="text-blue-400 font-black text-[10px] text-right w-[40px] pt-0.5">{item.time}</span>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-200">{item.title}</span>
                      <span className="text-[8.5px] text-slate-500">{item.description || "Syndicated broadcast feed segment"}</span>
                    </div>
                  </div>
                  {item.channelUrl && (
                    <button 
                      onClick={() => onPlayChannel(item.channelUrl!, item.title)}
                      className="p-1 hover:text-white text-slate-400 transition-all cursor-pointer"
                      title="Direct Play scheduled TV feed"
                    >
                      <Play className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add schedule item */}
          <div className="bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-xl flex flex-col gap-2">
            <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-wide">
              ⚡ Build EPG Schedule Item
            </span>
            <div className="grid grid-cols-3 gap-2">
              <input 
                type="time" 
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="text-[11px] font-mono p-1 bg-slate-950 border border-slate-800 rounded text-slate-300 w-full"
              />
              <input 
                type="text" 
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                placeholder="Show / Program Title" 
                className="text-[11px] font-mono p-1 bg-slate-950 border border-slate-800 rounded text-slate-300 col-span-2 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={schedUrl}
                onChange={(e) => setSchedUrl(e.target.value)}
                placeholder="Target Feed Link / URL (Optional)" 
                className="text-[10px] font-mono p-1 bg-slate-950 border border-slate-800 rounded text-slate-400 w-full focus:outline-none"
              />
              <button 
                onClick={handleAddScheduleItem}
                className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9.5px] font-mono font-black rounded-xl transition-all cursor-pointer shrink-0"
              >
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SHOW SERIES GROUPING DIVISION */}
      {activeSubSection === "series" && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          
          {/* Active Series browsers */}
          <div className="flex flex-col gap-2 max-h-[145px] overflow-y-auto pr-1">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">
              Show / Seasons Collection Library
            </span>
            {seriesList.length === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 italic">No Serial TV groupings configured. Group channels below to establish play lists.</span>
            ) : (
              seriesList.map((ser) => {
                // Check if current playing url belongs to this series
                const activeEpIndex = ser.episodes.findIndex(ep => ep.url === currentUrl);
                const isPlayingThisSeries = activeEpIndex !== -1;

                return (
                  <div key={ser.id} className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-805 font-mono text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-blue-400 text-[11px]">{ser.name} (Season {ser.season})</span>
                        <span className="text-[8.5px] text-slate-500 font-bold uppercase">{ser.episodes.length} Episodes • {ser.categories?.join(", ")}</span>
                      </div>
                      <button 
                        onClick={() => {
                          removeSeries(ser.id);
                          showToast("SHOW SERIES BUNDLE DISMANTLED");
                        }}
                        className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer"
                        title="Dismantle show series configuration"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Sequential Episode Nav with next/prev buttons */}
                    <div className="flex justify-between items-center gap-1.5 mt-2 bg-slate-950 p-1 rounded-md border border-slate-900/40">
                      <button
                        onClick={() => handlePrevEpClick(ser.id)}
                        disabled={!isPlayingThisSeries || activeEpIndex === 0}
                        className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] transition-all cursor-pointer ${
                          isPlayingThisSeries && activeEpIndex > 0
                            ? "hover:bg-slate-800 text-slate-300" 
                            : "text-slate-600 cursor-not-allowed"
                        }`}
                        title="Skip backward to previous episode"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="text-[9px] text-slate-500 truncate max-w-[140px] font-black uppercase">
                        {isPlayingThisSeries 
                          ? `EP ${activeEpIndex + 1}: ${ser.episodes[activeEpIndex].title}` 
                          : "IDLE SERIAL SATELLITE"
                        }
                      </span>
                      <button
                        onClick={() => handleNextEpClick(ser.id)}
                        disabled={!isPlayingThisSeries || activeEpIndex === ser.episodes.length - 1}
                        className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] transition-all cursor-pointer ${
                          isPlayingThisSeries && activeEpIndex < ser.episodes.length - 1
                            ? "hover:bg-slate-800 text-slate-300"
                            : "text-slate-600 cursor-not-allowed"
                        }`}
                        title="Skip forward to next episode"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Builder area */}
          <div className="bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/40 flex flex-col gap-2">
            <span className="text-[9.5px] font-mono font-black text-slate-400 uppercase tracking-wide flex items-center gap-1">
              🎬 Bundle Active Streams Into TV Show Series
            </span>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder="e.g. Alex Jones Special Investigations" 
                className="text-[11px] font-mono p-1 bg-slate-950 border border-slate-800/60 rounded text-slate-300 w-full focus:outline-none"
              />
              <input 
                type="number" 
                value={newSeriesSeason}
                onChange={(e) => setNewSeriesSeason(parseInt(e.target.value, 10))}
                className="text-[11px] font-mono p-1 bg-slate-950 border border-slate-800/60 rounded text-slate-300 w-[60px]"
                title="Season number"
              />
            </div>

            {/* List of channels to select */}
            <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto bg-slate-950/60 border border-slate-900 rounded-xl p-1.5 font-mono">
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Select streams ({selectedEpUrls.length} chosen):</span>
              {channels.map((chan) => (
                <button
                  key={chan.url}
                  onClick={() => toggleSelectEpUrl(chan.url)}
                  className={`flex items-center gap-1.5 p-1 rounded-md text-left text-[10px] w-full transition-all cursor-pointer ${
                    selectedEpUrls.includes(chan.url) ? "bg-blue-950 border border-blue-900 text-slate-200" : "hover:bg-slate-900 text-slate-400"
                  }`}
                >
                  <div className={`w-3 h-3 rounded flex items-center justify-center border text-[8px] ${selectedEpUrls.includes(chan.url) ? "border-blue-500 bg-blue-600 text-white" : "border-slate-805"}`}>
                    {selectedEpUrls.includes(chan.url) && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span className="truncate max-w-[210px]">{chan.name}</span>
                </button>
              ))}
            </div>

            <button 
              onClick={handleCompileSeries}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono font-black uppercase rounded-xl cursor-pointer tracking-wider shrink-0 transition-all"
            >
              COMPILE TV SERIES BUNDLE
            </button>
          </div>
        </div>
      )}

      {/* 4. SENTINEL FOLDER WATCH DIVISION */}
      {activeSubSection === "watcher" && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          
          {/* Quick monitoring creation */}
          <form onSubmit={handleWatchFolderReg} className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/30 flex flex-col gap-2">
            <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              📡 Sentinel Folder Patrol Register
            </span>
            <input 
              type="text" 
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              placeholder="Virtual Path: e.g. /nas/shares/iptv_news" 
              className="text-[11px] font-mono p-1.5 bg-slate-950 border border-slate-800/60 rounded text-slate-300 w-full focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 cursor-pointer text-slate-400 font-mono text-[9.5px]">
                <input 
                  type="checkbox" 
                  checked={watchAutoPoll}
                  onChange={(e) => setWatchAutoPoll(e.target.checked)}
                  className="rounded border-slate-800"
                />
                Activate Auto-Poll Sentinel
              </label>
              <button 
                type="submit"
                className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9.5px] font-mono font-black rounded-xl cursor-pointer transition-all"
              >
                PATROL PATH
              </button>
            </div>
          </form>

          {/* List of active folders */}
          <div className="flex flex-col gap-2 max-h-[170px] overflow-y-auto pr-1">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">
              Monitored Sentinel Path Logs ({folders.length})
            </span>
            {folders.length === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 italic">No folder monitoring patrols listed.</span>
            ) : (
              folders.map((fld) => (
                <div key={fld.id} className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-805 font-mono text-[10.5px] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-400 truncate max-w-[170px]">{fld.path}</span>
                    <button 
                      onClick={() => {
                        unwatchPath(fld.id);
                        showToast("PATROL SENTINEL DISENGAGED");
                      }}
                      className="text-slate-500 hover:text-red-400 cursor-pointer p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold border-t border-slate-900/40 pt-1.5">
                    <span>STATUS: {fld.status || "Monitoring"}</span>
                    <span>FILES: {fld.fileCount || 0}</span>
                  </div>
                  <div className="flex gap-2.5 mt-0.5">
                    <button 
                      onClick={() => handleOnDemandScan(fld.id)}
                      disabled={activeScanId === fld.id}
                      className="w-full py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 rounded text-slate-300 text-[9.5px] font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Scan className={`w-3 h-3 ${activeScanId === fld.id ? "animate-spin text-blue-500" : ""}`} /> 
                      {activeScanId === fld.id ? "SCANNING..." : "SCAN ON DEMAND"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. ADVANCED EPG CALENDAR ENHANCEMENTS WIDGET */}
      <div className="border-t border-slate-850 pt-2.5 mt-1">
        <span className="text-[9px] font-mono font-black text-slate-400 tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-400" /> Integrated EPG Day Grid Metrics
        </span>
        
        {/* Dynamic calendar visual highlights */}
        <div className="bg-slate-900/40 p-2 border border-slate-800/40 rounded-xl flex flex-col gap-2 font-mono">
          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>📅 Broadcast Log List</span>
            <span className="text-[9px] text-slate-500 font-black">INDEXED DB BOUND</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[8.5px]">
            {dateWindow.map((dateVal) => {
              const countForDate = schedules.find(s => s.dateKey === dateVal)?.scheduleItems?.length || 0;
              const isSelected = activeDateKey === dateVal;

              return (
                <button
                  key={dateVal}
                  onClick={() => {
                    selectDateKey(dateVal);
                    if (onSelectDate) onSelectDate(dateVal);
                    showToast(`SWITCHED CALENDAR TO BROADCAST DAY: ${dateVal}`);
                  }}
                  className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isSelected 
                      ? "bg-blue-600/90 border-blue-500 text-white" 
                      : "bg-slate-950/70 border-slate-850 hover:border-slate-755 text-slate-400"
                  }`}
                >
                  <span className="font-extrabold">{dateVal.substring(5)}</span>
                  <span className={`text-[8px] mt-0.5 px-1 rounded-full font-black ${
                    isSelected 
                      ? "bg-blue-900/30 text-blue-100" 
                      : countForDate > 0 ? "bg-green-950/40 text-green-400" : "bg-slate-900 text-slate-600"
                  }`}>
                    {countForDate > 0 ? `${countForDate} EPG` : "0 EPG"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
