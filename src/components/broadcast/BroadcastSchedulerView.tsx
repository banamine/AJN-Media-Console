import { safeLocalStorage } from "../../utils/safeStorage";
import React, { useState, useMemo } from "react";
import { 
  Calendar, Clock, Trash2, Plus, Zap, AlertTriangle, 
  Tv, Headphones, Layers, Play, CheckCircle2, Search,
  ChevronLeft, ChevronRight, Sparkles, Filter, RefreshCw, Grid, List, 
  PlusCircle, Settings, ShieldAlert, Wrench, ArrowRight, X
} from "lucide-react";
import { ScheduleBlock, AutomationChannel } from "../BroadcastAutomationSuite";
import { getArchiveThumbnail } from "../../utils/thumbnailHelper";

interface BroadcastSchedulerViewProps {
  channels: AutomationChannel[];
  schedule: ScheduleBlock[];
  setSchedule: (newData: ScheduleBlock[] | ((prev: ScheduleBlock[]) => ScheduleBlock[])) => void;
  systemPlaylists?: any[];
  systemChannels?: any[];
  isLight?: boolean;
  addLog?: (msg: string) => void;
}

interface DraggableMedia {
  id: string;
  title: string;
  durationMin: number;
  category: "Movie" | "Episode" | "Bumper" | "Promo" | "Live";
  thumbnailUrl?: string;
  rating: string;
  sourceType: "Preset" | "SystemPlaylist" | "SystemChannel";
}

// ---------------- Helper Functions for Playout Times & Collisions ----------------
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

const minutesToTime = (mins: number): string => {
  const normalized = (mins + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Check if two interval spans overlap (supporting 24h timeline wrap-around)
const checkIntervalOverlap = (s1: number, d1: number, s2: number, d2: number): boolean => {
  const getIntervals = (s: number, d: number) => {
    const e = s + d;
    if (e <= 1440) {
      return [{ start: s, end: e }];
    } else {
      return [
        { start: s, end: 1440 },
        { start: 0, end: e % 1440 }
      ];
    }
  };

  const ints1 = getIntervals(s1, d1);
  const ints2 = getIntervals(s2, d2);

  for (const r1 of ints1) {
    for (const r2 of ints2) {
      if (Math.max(r1.start, r2.start) < Math.min(r1.end, r2.end)) {
        return true;
      }
    }
  }
  return false;
};

export function BroadcastSchedulerView({
  channels,
  schedule,
  setSchedule,
  systemPlaylists = [],
  systemChannels = [],
  isLight = false,
  addLog
}: BroadcastSchedulerViewProps) {
  // Selected virtual channel to schedule for
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || "ch-1");
  
  // Tab/Mode: "daily" (24-hour timeline) vs "weekly" (7-day block matrix) vs "queue" (chronological conflict manager)
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "queue">("daily");
  
  // Selected Day for Daily view: 0 = Mon, 1 = Tue, ..., 6 = Sun
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  
  // Library search and filtering
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "video" | "audio" | "bumper">("all");

  // Conflict resolution strategy and auto-correct settings
  const [resolutionStrategy, setResolutionStrategy] = useState<"crop" | "shift" | "remove">("crop");
  const [autoCorrectOnDrop, setAutoCorrectOnDrop] = useState<boolean>(true);

  // Editing modal state or inline state for manual fine-tuning
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editDuration, setEditDuration] = useState(30);

  // --- Automation Suite Left Sidebar Sub-tabs ---
  const [sidebarTab, setSidebarTab] = useState<"library" | "smart" | "templates" | "history">("library");

  // --- Templates & Presets ---
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; blocks: ScheduleBlock[] }>>(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_schedule_templates");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "tpl-scifi",
        name: "Retro Sci-Fi Marathon Format",
        blocks: [
          { id: "tpl-sf-1", channelId: "", title: "Stargate SG-1 Special Marathon", category: "Episode", startTime: "08:00", durationMin: 120, rating: "TV-PG" },
          { id: "tpl-sf-2", channelId: "", title: "Sci-Fi Station Promo Block", category: "Promo", startTime: "10:00", durationMin: 15, rating: "G" },
          { id: "tpl-sf-3", channelId: "", title: "Blade Runner 2049 Feature", category: "Movie", startTime: "10:15", durationMin: 180, rating: "R" },
          { id: "tpl-sf-4", channelId: "", title: "Cyberpunk Nightscape Special", category: "Live", startTime: "14:00", durationMin: 240, rating: "TV-MA" }
        ]
      },
      {
        id: "tpl-news",
        name: "Continuous Live News Format",
        blocks: [
          { id: "tpl-nw-1", channelId: "", title: "AJN Morning Live Briefing", category: "Live", startTime: "06:00", durationMin: 120, rating: "TV-PG" },
          { id: "tpl-nw-2", channelId: "", title: "World Financial Recap Bulletin", category: "Live", startTime: "08:00", durationMin: 60, rating: "NR" },
          { id: "tpl-nw-3", channelId: "", title: "Independent Media Roundtable", category: "Episode", startTime: "09:00", durationMin: 180, rating: "TV-14" },
          { id: "tpl-nw-4", channelId: "", title: "War Room Tactical Broadcast", category: "Live", startTime: "12:00", durationMin: 240, rating: "TV-MA" }
        ]
      },
      {
        id: "tpl-chill",
        name: "Late Night Chill Lounge Format",
        blocks: [
          { id: "tpl-ch-1", channelId: "", title: "Midnight Tokyo Jazz Session", category: "Live", startTime: "00:00", durationMin: 180, rating: "G" },
          { id: "tpl-ch-2", channelId: "", title: "Lo-Fi Beats & Chill Ambient", category: "Live", startTime: "03:00", durationMin: 240, rating: "G" },
          { id: "tpl-ch-3", channelId: "", title: "Station Bumper & ID Loop", category: "Bumper", startTime: "07:00", durationMin: 15, rating: "G" }
        ]
      }
    ];
  });
  const [newTemplateName, setNewTemplateName] = useState("");

  // --- History & Rollbacks ---
  const [history, setHistory] = useState<Array<{ id: string; name: string; timestamp: string; schedule: ScheduleBlock[] }>>(() => {
    try {
      const saved = safeLocalStorage.getItem("ajn_schedule_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // --- Batch Operations ---
  const [batchSelectedChannels, setBatchSelectedChannels] = useState<string[]>([]);
  const [batchSelectedShows, setBatchSelectedShows] = useState<string[]>([]);
  const [batchStartTime, setBatchStartTime] = useState("09:00");
  const [batchSuccessMsg, setBatchSuccessMsg] = useState("");

  // --- Smart Time-Slot Recommender Logic ---
  const smartSuggestions = useMemo(() => {
    const emptyHours: number[] = [];
    for (let h = 0; h < 24; h += 2) {
      const prefix = String(h).padStart(2, "0") + ":";
      const hasBlock = schedule.some(b => b.channelId === selectedChannelId && b.startTime.startsWith(prefix));
      if (!hasBlock) {
        emptyHours.push(h);
      }
    }

    const suggestions: Array<{ hour: number; label: string; reason: string; recCategory: string; recShowTitle: string }> = [];
    emptyHours.slice(0, 3).forEach(h => {
      let label = "";
      let reason = "";
      let recCategory = "Live";
      let recShowTitle = "";

      if (h >= 0 && h < 6) {
        label = `${String(h).padStart(2, "0")}:00 (Late Night)`;
        reason = "Optimal for ambient chill soundscapes, mystery documentaries, or late-night loops to keep stream active.";
        recCategory = "Live";
        recShowTitle = "Midnight Tokyo Sax Session";
      } else if (h >= 6 && h < 12) {
        label = `${String(h).padStart(2, "0")}:00 (Morning Peak)`;
        reason = "Highly recommended for live morning news briefings, daily updates, or fresh series episodes.";
        recCategory = "Live";
        recShowTitle = "AJN Nightly News Broadcast";
      } else if (h >= 12 && h < 18) {
        label = `${String(h).padStart(2, "0")}:00 (Afternoon Transition)`;
        reason = "Best slot for mid-day talk shows, promotional bumpers, or syndicated series blocks.";
        recCategory = "Episode";
        recShowTitle = "Alex Jones Show: Patriot Special";
      } else {
        label = `${String(h).padStart(2, "0")}:00 (Prime Time)`;
        reason = "Prime engagement slot. Optimal for premium uncut documentaries or action movies.";
        recCategory = "Movie";
        recShowTitle = "Retro Cyber Sci-Fi Marathon";
      }

      suggestions.push({ hour: h, label, reason, recCategory, recShowTitle });
    });

    return suggestions;
  }, [schedule, selectedChannelId]);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // 1. Synthesize a list of Draggable Library Items
  const presetLibraryItems: DraggableMedia[] = [
    {
      id: "lib-preset-1",
      title: "AJN Nightly News Broadcast",
      durationMin: 30,
      category: "Episode",
      thumbnailUrl: getArchiveThumbnail("Episode", "AJN Nightly News Broadcast"),
      rating: "NR",
      sourceType: "Preset"
    },
    {
      id: "lib-preset-2",
      title: "Alex Jones Show: Patriot Special",
      durationMin: 180,
      category: "Live",
      thumbnailUrl: getArchiveThumbnail("Live", "Alex Jones Show: Patriot Special"),
      rating: "TV-14",
      sourceType: "Preset"
    },
    {
      id: "lib-preset-3",
      title: "Station ID Bumper & Promo Block",
      durationMin: 5,
      category: "Bumper",
      thumbnailUrl: getArchiveThumbnail("Bumper", "Station ID Bumper & Promo Block"),
      rating: "G",
      sourceType: "Preset"
    },
    {
      id: "lib-preset-4",
      title: "Retro Cyber Sci-Fi Marathon",
      durationMin: 120,
      category: "Movie",
      thumbnailUrl: getArchiveThumbnail("Movie", "Retro Cyber Sci-Fi Marathon"),
      rating: "R",
      sourceType: "Preset"
    },
    {
      id: "lib-preset-5",
      title: "Midnight Tokyo Sax Session",
      durationMin: 60,
      category: "Episode",
      thumbnailUrl: getArchiveThumbnail("Episode", "Midnight Tokyo Sax Session"),
      rating: "G",
      sourceType: "Preset"
    },
    {
      id: "lib-preset-6",
      title: "Severe Weather Ticker & Bulletins",
      durationMin: 15,
      category: "Promo",
      thumbnailUrl: getArchiveThumbnail("Promo", "Severe Weather Ticker & Bulletins"),
      rating: "NR",
      sourceType: "Preset"
    }
  ];

  // Map system channels into draggable items
  const systemChannelDraggables: DraggableMedia[] = useMemo(() => {
    return systemChannels.map((ch, idx) => ({
      id: `lib-sys-ch-${ch.tvgId || idx}`,
      title: ch.name || "IPTV Live Stream",
      durationMin: 60, 
      category: "Live" as const,
      thumbnailUrl: ch.logo || "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
      rating: "NR",
      sourceType: "SystemChannel" as const
    }));
  }, [systemChannels]);

  // Map system playlists into draggable items (entire playlists)
  const systemPlaylistDraggables: DraggableMedia[] = useMemo(() => {
    return systemPlaylists.map((pl) => ({
      id: `lib-sys-pl-${pl.id}`,
      title: `Playlist: ${pl.name}`,
      durationMin: Math.min(240, (pl.channelCount || 1) * 30), 
      category: "Episode" as const,
      thumbnailUrl: "https://archive.org/download/daily-highlights/web%20app1.png",
      rating: "TV-PG",
      sourceType: "SystemPlaylist" as const
    }));
  }, [systemPlaylists]);

  // Combine and filter library
  const filteredLibrary = useMemo(() => {
    const combined = [...presetLibraryItems, ...systemPlaylistDraggables, ...systemChannelDraggables];
    return combined.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
                            item.category.toLowerCase().includes(librarySearch.toLowerCase());
      
      if (libraryFilter === "all") return matchesSearch;
      if (libraryFilter === "bumper") return matchesSearch && item.category === "Bumper";
      if (libraryFilter === "video") return matchesSearch && (item.category === "Movie" || item.category === "Episode");
      if (libraryFilter === "audio") return matchesSearch && item.category === "Live";
      return matchesSearch;
    });
  }, [librarySearch, libraryFilter, systemChannelDraggables, systemPlaylistDraggables]);

  // ---------------- COLLISION DETECTION ENGINE ----------------
  // Get all blocks on the selected channel mapped to their minutes ranges
  const channelBlocks = useMemo(() => {
    return schedule
      .filter(b => b.channelId === selectedChannelId)
      .map(b => {
        const start = timeToMinutes(b.startTime);
        return {
          ...b,
          start,
          end: start + b.durationMin
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [schedule, selectedChannelId]);

  // Find all block IDs that overlap with any other block
  const overlappingBlockIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < channelBlocks.length; i++) {
      for (let j = i + 1; j < channelBlocks.length; j++) {
        const a = channelBlocks[i];
        const b = channelBlocks[j];
        if (checkIntervalOverlap(a.start, a.durationMin, b.start, b.durationMin)) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [channelBlocks]);

  // ---------------- AUTO-RESOLVE CONFLICTS LOGIC ----------------
  const autoResolveConflicts = (strategy: "crop" | "shift" | "remove") => {
    if (channelBlocks.length <= 1) return;

    setSchedule(prev => {
      const otherChannelsSchedule = prev.filter(b => b.channelId !== selectedChannelId);
      const sorted = [...prev.filter(b => b.channelId === selectedChannelId)]
        .map(b => ({ ...b, start: timeToMinutes(b.startTime) }))
        .sort((a, b) => a.start - b.start);

      if (strategy === "remove") {
        const resolved: typeof sorted = [];
        for (const item of sorted) {
          let hasConflict = false;
          for (const added of resolved) {
            if (checkIntervalOverlap(added.start, added.durationMin, item.start, item.durationMin)) {
              hasConflict = true;
              break;
            }
          }
          if (!hasConflict) {
            resolved.push(item);
          }
        }
        return [...otherChannelsSchedule, ...resolved.map(({ start, ...rest }) => rest)];
      }

      if (strategy === "crop") {
        const resolved = [...sorted];
        for (let i = 0; i < resolved.length; i++) {
          for (let j = i + 1; j < resolved.length; j++) {
            const a = resolved[i];
            const b = resolved[j];
            if (checkIntervalOverlap(a.start, a.durationMin, b.start, b.durationMin)) {
              if (b.start > a.start) {
                const newDuration = b.start - a.start;
                resolved[i] = {
                  ...a,
                  durationMin: Math.max(1, newDuration)
                };
              } else {
                resolved[i] = {
                  ...a,
                  durationMin: 1
                };
              }
            }
          }
        }
        return [...otherChannelsSchedule, ...resolved.map(({ start, ...rest }) => rest)];
      }

      if (strategy === "shift") {
        const resolved = [...sorted];
        for (let i = 0; i < resolved.length - 1; i++) {
          const a = resolved[i];
          const b = resolved[i + 1];
          const aEnd = a.start + a.durationMin;
          if (checkIntervalOverlap(a.start, a.durationMin, b.start, b.durationMin)) {
            const newStart = aEnd % 1440;
            resolved[i + 1] = {
              ...b,
              start: newStart,
              startTime: minutesToTime(newStart)
            };
          }
        }
        return [...otherChannelsSchedule, ...resolved.map(({ start, ...rest }) => rest)];
      }

      return prev;
    });

    if (addLog) {
      addLog(`Broadcast Scheduler: Auto-resolved playout collisions on channel "${selectedChannelId}" using strategy: ${strategy.toUpperCase()}`);
    }
  };

  // Helper trigger to auto resolve if option is checked
  const triggerPostChangeAutoCorrect = () => {
    if (autoCorrectOnDrop) {
      // Defer slightly to allow setSchedule state to merge cleanly
      setTimeout(() => {
        autoResolveConflicts(resolutionStrategy);
      }, 50);
    }
  };

  // ---------------- EVENT HANDLERS ----------------
  const handleDragStart = (e: React.DragEvent, item: DraggableMedia) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnSlot = (e: React.DragEvent, hour: number, dayName?: string) => {
    e.preventDefault();
    try {
      const itemDataRaw = e.dataTransfer.getData("application/json");
      if (!itemDataRaw) return;
      const mediaItem = JSON.parse(itemDataRaw) as DraggableMedia;

      const formattedHour = String(hour).padStart(2, "0") + ":00";
      
      const newBlock: ScheduleBlock = {
        id: `scheduled-${Date.now()}`,
        channelId: selectedChannelId,
        title: mediaItem.title,
        category: mediaItem.category,
        startTime: formattedHour,
        durationMin: mediaItem.durationMin,
        rating: mediaItem.rating,
        thumbnailUrl: mediaItem.thumbnailUrl
      };

      setSchedule(prev => {
        // Remove direct duplicates starting at exact same time, but allow overlapping to trigger warning/autocorrect
        const cleanList = prev.filter(b => !(b.channelId === selectedChannelId && b.startTime === formattedHour));
        return [...cleanList, newBlock].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      if (addLog) {
        addLog(`Broadcast Scheduler: Added "${mediaItem.title}" (${mediaItem.durationMin}m) at ${formattedHour}.`);
      }

      triggerPostChangeAutoCorrect();
    } catch (err) {
      console.error("Failed to parse dragged schedule item", err);
    }
  };

  const handleRemoveBlock = (blockId: string, title: string) => {
    setSchedule(prev => prev.filter(b => b.id !== blockId));
    if (addLog) {
      addLog(`Broadcast Scheduler: Removed scheduled block "${title}".`);
    }
  };

  const handleQuickAddBlock = (hour: number) => {
    const formattedHour = String(hour).padStart(2, "0") + ":00";
    const promptTitle = window.prompt("Enter Scheduled Show/Stream Title:", "Automated Live Relay");
    if (!promptTitle) return;

    const newBlock: ScheduleBlock = {
      id: `scheduled-${Date.now()}`,
      channelId: selectedChannelId,
      title: promptTitle,
      category: "Live",
      startTime: formattedHour,
      durationMin: 60,
      rating: "TV-G"
    };

    setSchedule(prev => {
      const cleanList = prev.filter(b => !(b.channelId === selectedChannelId && b.startTime === formattedHour));
      return [...cleanList, newBlock].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    if (addLog) addLog(`Broadcast Scheduler: Manually scheduled "${promptTitle}" at ${formattedHour}.`);
    triggerPostChangeAutoCorrect();
  };

  const handleClearChannelSchedule = () => {
    if (!window.confirm("Clear all scheduled playout blocks for this channel? This cannot be undone.")) return;
    setSchedule(prev => prev.filter(b => b.channelId !== selectedChannelId));
    if (addLog) addLog(`Broadcast Scheduler: Cleared all playout blocks for channel ID: ${selectedChannelId}`);
  };

  const handleAutofillSchedule = () => {
    if (!window.confirm("Autofill empty hourly slots with random high-quality program blocks?")) return;
    
    setSchedule(prev => {
      let updated = prev.filter(b => b.channelId !== selectedChannelId);

      for (let hour = 0; hour < 24; hour += 2) {
        const formattedHour = String(hour).padStart(2, "0") + ":00";
        const randomPreset = presetLibraryItems[Math.floor(Math.random() * presetLibraryItems.length)];
        
        updated.push({
          id: `autofill-${Date.now()}-${hour}`,
          channelId: selectedChannelId,
          title: randomPreset.title,
          category: randomPreset.category,
          startTime: formattedHour,
          durationMin: 120,
          rating: randomPreset.rating,
          thumbnailUrl: randomPreset.thumbnailUrl
        });
      }

      return updated.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    if (addLog) addLog(`Broadcast Scheduler: Auto-filled the 24h playout timetable for channel ID: ${selectedChannelId}`);
  };

  // Helper to map scheduled blocks for a specific hour
  const getBlockForHour = (hour: number) => {
    const formattedHourPrefix = String(hour).padStart(2, "0") + ":";
    return schedule.find(b => b.channelId === selectedChannelId && b.startTime.startsWith(formattedHourPrefix));
  };

  // Inline Fine-Tuning controls
  const handleStartEditing = (block: ScheduleBlock) => {
    setEditingBlockId(block.id);
    setEditStartTime(block.startTime);
    setEditDuration(block.durationMin);
  };

  const handleSaveInlineEdit = (blockId: string) => {
    setSchedule(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          startTime: editStartTime,
          durationMin: editDuration
        };
      }
      return b;
    }));
    setEditingBlockId(null);
    if (addLog) addLog(`Broadcast Scheduler: Fine-tuned scheduled block time/duration.`);
    triggerPostChangeAutoCorrect();
  };

  return (
    <div id="broadcast-scheduler-container" className="grid grid-cols-1 xl:grid-cols-4 gap-6 select-none animate-fadeIn">
      
      {/* ===================== LEFT SIDEBAR: AUTOMATION OPERATIONS HUB ===================== */}
      <div className={`xl:col-span-1 rounded-2xl border p-4 flex flex-col gap-4 h-[850px] overflow-hidden ${
        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#090D16] border-slate-800/80 text-slate-100"
      }`}>
        {/* Hub Tab Selection */}
        <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-850 shrink-0">
          {[
            { id: "library", label: "Library" },
            { id: "smart", label: "Smart & Batch" },
            { id: "templates", label: "Templates" },
            { id: "history", label: "History" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id as any)}
              className={`flex-1 py-1.5 text-[8.5px] font-mono font-bold uppercase rounded-lg transition-all cursor-pointer ${
                sidebarTab === tab.id
                  ? "bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT: LIBRARY */}
        {sidebarTab === "library" && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-200">Drag Playout Library</h3>
            </div>

            {/* Library Filters */}
            <div className="flex flex-col gap-2 shrink-0">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search library, channels..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-black/50 border border-slate-800 text-[10px] outline-none focus:border-emerald-500 font-mono text-white"
                />
                {librarySearch && (
                  <button
                    type="button"
                    onClick={() => setLibrarySearch("")}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear library filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Category Buttons */}
              <div className="flex gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-850">
                {(["all", "video", "audio", "bumper"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLibraryFilter(cat)}
                    className={`flex-1 py-1 text-[9px] font-mono font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      libraryFilter === cat 
                        ? "bg-emerald-600 text-white font-black shadow" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Items list */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin">
              {filteredLibrary.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-850 rounded-xl text-[10px] font-mono text-slate-500 bg-black/10">
                  No matching assets
                </div>
              ) : (
                filteredLibrary.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    className="group p-3 rounded-xl bg-black/40 border border-slate-850 hover:border-emerald-500/40 hover:bg-slate-950/80 transition-all cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 shadow-sm hover:shadow-emerald-500/5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-600/10 group-hover:bg-emerald-500 transition-colors" />
                    
                    <div className="flex items-center gap-2.5 min-w-0 pl-1">
                      {item.thumbnailUrl ? (
                        <img 
                          src={item.thumbnailUrl} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getArchiveThumbnail(item.category, item.title);
                          }}
                          className="w-8 h-8 rounded object-cover border border-slate-800" 
                          alt="" 
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-mono text-[9px]">
                          {item.category[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-[10px] font-black text-slate-200 truncate uppercase leading-tight group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-tight">
                          {item.durationMin}m • {item.category} • <span className="text-emerald-500/80">{item.sourceType}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 p-1 rounded-lg bg-slate-900 border border-slate-850 group-hover:bg-emerald-900/10 group-hover:border-emerald-500/20 text-slate-500 group-hover:text-emerald-400 transition-all">
                      <Grid className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* AUTOMATION COLLISION DETECTOR OPTIONS PANEL */}
            <div className="p-4 rounded-xl bg-[#140b0d]/70 border border-red-900/30 text-slate-200 flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-2 text-red-400">
                <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-xs font-black font-mono uppercase tracking-wider">Collision Engine</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Auto-Correct Overlaps</label>
                  <input
                    type="checkbox"
                    checked={autoCorrectOnDrop}
                    onChange={(e) => setAutoCorrectOnDrop(e.target.checked)}
                    className="w-3.5 h-3.5 text-red-500 bg-slate-900 border-slate-800 rounded focus:ring-red-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-slate-400 uppercase">Resolution Strategy</label>
                  <select
                    value={resolutionStrategy}
                    onChange={(e) => {
                      setResolutionStrategy(e.target.value as any);
                      if (autoCorrectOnDrop) {
                        autoResolveConflicts(e.target.value as any);
                      }
                    }}
                    className="w-full bg-black border border-slate-800 text-[10px] font-mono px-2 py-1.5 rounded-lg text-slate-300 outline-none focus:border-red-500"
                  >
                    <option value="crop">📐 Crop Preceding Item</option>
                    <option value="shift">⏱️ Shift Succeeding Block</option>
                    <option value="remove">❌ Remove Overlapping Item</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => autoResolveConflicts(resolutionStrategy)}
                className="w-full py-2 bg-red-950/40 hover:bg-red-900/30 border border-red-500/40 hover:border-red-500 text-red-400 hover:text-white font-mono font-black text-[9px] uppercase rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Manually Force Resolve</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB CONTENT: SMART & BATCH */}
        {sidebarTab === "smart" && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Smart Suggestions */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">Smart Slot Recommender</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Detecting empty air-time slots for "{channels.find(c => c.id === selectedChannelId)?.name || "channel"}" and recommending optimal genres.
              </p>
              {smartSuggestions.length === 0 ? (
                <div className="p-3 text-center border border-dashed border-slate-800 rounded-xl text-[10px] text-slate-500 font-mono italic">
                  No empty slots found. Schedule is fully packed!
                </div>
              ) : (
                <div className="space-y-2">
                  {smartSuggestions.map((sug, i) => (
                    <div 
                      key={i} 
                      className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/10 hover:border-amber-500/40 transition-all flex flex-col gap-1 text-[10px]"
                    >
                      <div className="flex items-center justify-between font-mono font-bold text-amber-400">
                        <span>⏰ {sug.label}</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] uppercase font-black">{sug.recCategory}</span>
                      </div>
                      <p className="text-slate-400 text-[9px] leading-relaxed mt-0.5">{sug.reason}</p>
                      <button
                        onClick={() => {
                          const newBlock: ScheduleBlock = {
                            id: `smart-${Date.now()}-${i}`,
                            channelId: selectedChannelId,
                            title: sug.recShowTitle,
                            category: sug.recCategory as any,
                            startTime: `${String(sug.hour).padStart(2, "0")}:00`,
                            durationMin: 120,
                            rating: "TV-14",
                            thumbnailUrl: getArchiveThumbnail(sug.recCategory, sug.recShowTitle)
                          };
                          setSchedule(prev => [...prev, newBlock]);
                          if (addLog) addLog(`Smart Suggestion: Auto-scheduled "${sug.recShowTitle}" at ${sug.label} on current channel.`);
                          triggerPostChangeAutoCorrect();
                          window.dispatchEvent(new Event("ajn-schedule-updated"));
                        }}
                        className="w-full mt-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black font-mono font-bold text-[9px] uppercase tracking-wider transition-all"
                      >
                        Apply Recommended Slot
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Batch Scheduling */}
            <div className="space-y-3 mt-2 border-t border-slate-800 pt-4 shrink-0">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 font-mono">Batch Playout Operations</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Schedule a show across multiple channels simultaneously to optimize playout syndication.
              </p>

              {/* Channel checklist */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">1. Select Target Channels</label>
                <div className="p-2 bg-black/60 rounded-xl border border-slate-850 max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {channels.map(ch => (
                    <label key={ch.id} className="flex items-center gap-2 text-[10px] text-slate-300 font-mono cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={batchSelectedChannels.includes(ch.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchSelectedChannels(prev => [...prev, ch.id]);
                          } else {
                            setBatchSelectedChannels(prev => prev.filter(id => id !== ch.id));
                          }
                        }}
                        className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
                      />
                      <span>{ch.name} ({ch.callSign})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Show Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">2. Select Playout Asset</label>
                <select
                  value={batchSelectedShows[0] || ""}
                  onChange={(e) => setBatchSelectedShows([e.target.value])}
                  className="w-full bg-black border border-slate-800 text-[10px] font-mono px-2 py-1.5 rounded-lg text-slate-300 outline-none focus:border-cyan-500 text-white"
                >
                  <option value="">-- Choose Show --</option>
                  {presetLibraryItems.map(item => (
                    <option key={item.id} value={item.title}>{item.title} ({item.durationMin}m)</option>
                  ))}
                </select>
              </div>

              {/* Starting Time */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">3. Starting Playout Hour</label>
                <input
                  type="time"
                  value={batchStartTime}
                  onChange={(e) => setBatchStartTime(e.target.value)}
                  className="w-full bg-black border border-slate-800 text-[10px] font-mono px-2 py-1.5 rounded-lg text-slate-300 outline-none focus:border-cyan-500 text-white"
                />
              </div>

              {/* Submit button */}
              <button
                disabled={batchSelectedChannels.length === 0 || !batchSelectedShows[0]}
                onClick={() => {
                  const showTitle = batchSelectedShows[0];
                  const matchingPreset = presetLibraryItems.find(p => p.title === showTitle);
                  const duration = matchingPreset ? matchingPreset.durationMin : 60;
                  const category = matchingPreset ? matchingPreset.category : "Live";
                  const rating = matchingPreset ? matchingPreset.rating : "NR";

                  const newBlocks: ScheduleBlock[] = batchSelectedChannels.map(chId => ({
                    id: `batch-${Date.now()}-${chId}`,
                    channelId: chId,
                    title: showTitle,
                    category: category as any,
                    startTime: batchStartTime,
                    durationMin: duration,
                    rating: rating,
                    thumbnailUrl: getArchiveThumbnail(category, showTitle)
                  }));

                  setSchedule(prev => [...prev, ...newBlocks]);
                  
                  if (addLog) {
                    addLog(`Batch Playout: Scheduled "${showTitle}" on ${batchSelectedChannels.length} channels at ${batchStartTime} simultaneously.`);
                  }

                  // Clear states & show notification
                  setBatchSelectedChannels([]);
                  setBatchSuccessMsg("Batch Playout Programmed Successfully!");
                  setTimeout(() => setBatchSuccessMsg(""), 3000);
                  triggerPostChangeAutoCorrect();
                  window.dispatchEvent(new Event("ajn-schedule-updated"));
                }}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-mono font-bold text-[10px] uppercase tracking-wider transition-all shadow-md shadow-cyan-600/10 cursor-pointer disabled:cursor-not-allowed"
              >
                🚀 Launch Batch Playout
              </button>

              {batchSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono text-center">
                  ✅ {batchSuccessMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: TEMPLATES */}
        {sidebarTab === "templates" && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 font-mono">EPG Template Formats</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Save or load pre-configured EPG formats onto the active channel.
              </p>

              {/* Standard Templates / Custom Templates */}
              <div className="space-y-2">
                {templates.map(tpl => (
                  <div key={tpl.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col gap-1.5">
                    <div className="font-bold text-[11px] text-purple-400">{tpl.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                      📦 Contains {tpl.blocks.length} Program Blocks
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => {
                          const blocksWithChId = tpl.blocks.map(b => ({
                            ...b,
                            id: `block-tpl-applied-${Date.now()}-${Math.random()}`,
                            channelId: selectedChannelId
                          }));
                          
                          if (window.confirm(`Apply template "${tpl.name}" to the current channel? This will merge with existing schedule blocks.`)) {
                            setSchedule(prev => [...prev, ...blocksWithChId]);
                            if (addLog) addLog(`EPG Template: Applied "${tpl.name}" to current channel.`);
                            triggerPostChangeAutoCorrect();
                            window.dispatchEvent(new Event("ajn-schedule-updated"));
                          }
                        }}
                        className="flex-1 py-1 px-2 rounded bg-purple-500/10 hover:bg-purple-500 hover:text-black text-purple-400 font-bold text-[9px] uppercase tracking-wider font-mono transition-all cursor-pointer"
                      >
                        Apply Format
                      </button>
                      <button
                        onClick={() => {
                          if (tpl.id.startsWith("tpl-")) {
                            alert("Core pre-built templates cannot be deleted!");
                            return;
                          }
                          const updated = templates.filter(t => t.id !== tpl.id);
                          setTemplates(updated);
                          safeLocalStorage.setItem("ajn_schedule_templates", JSON.stringify(updated));
                        }}
                        className="p-1 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 text-xs transition-colors cursor-pointer"
                        title="Delete custom template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save current schedule as template */}
              <div className="space-y-2.5 mt-4 border-t border-slate-800 pt-4">
                <h5 className="text-[10px] font-bold uppercase text-slate-300 font-mono">Save Current as Template</h5>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template Name (e.g. Summer Format)"
                  className="w-full px-2.5 py-1.5 bg-black border border-slate-800 text-[10px] font-mono rounded-lg outline-none focus:border-purple-500 text-white"
                />
                <button
                  disabled={!newTemplateName.trim()}
                  onClick={() => {
                    const chBlocks = schedule.filter(b => b.channelId === selectedChannelId);
                    if (chBlocks.length === 0) {
                      alert("Current channel schedule has no blocks to save!");
                      return;
                    }
                    const cleanBlocks = chBlocks.map(({ id, channelId, ...rest }) => ({
                      ...rest,
                      id: `tpl-blk-${Math.random()}`,
                      channelId: ""
                    }));

                    const newTpl = {
                      id: `custom-tpl-${Date.now()}`,
                      name: newTemplateName.trim(),
                      blocks: cleanBlocks as any
                    };

                    const updated = [...templates, newTpl];
                    setTemplates(updated);
                    safeLocalStorage.setItem("ajn_schedule_templates", JSON.stringify(updated));
                    setNewTemplateName("");
                    if (addLog) addLog(`EPG Template: Saved current EPG layout as template: "${newTpl.name}"`);
                  }}
                  className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-mono font-bold text-[9px] uppercase tracking-wider transition-all disabled:cursor-not-allowed cursor-pointer"
                >
                  💾 Save Active Format
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: HISTORY */}
        {sidebarTab === "history" && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">History & Snapshots</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Save system restore point snapshots of active schedules to instantly roll back if needed.
              </p>

              <button
                onClick={() => {
                  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const pointName = `Playout Backup (${dateStr} ${nowStr})`;
                  
                  const newSnapshot = {
                    id: `snap-${Date.now()}`,
                    name: pointName,
                    timestamp: new Date().toISOString(),
                    schedule: [...schedule]
                  };

                  const updated = [newSnapshot, ...history];
                  setHistory(updated);
                  safeLocalStorage.setItem("ajn_schedule_history", JSON.stringify(updated));
                  if (addLog) addLog(`History Manager: Created schedule snapshot restore point: "${pointName}"`);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                📸 Create Snapshot Point
              </button>

              <div className="space-y-2 mt-4 border-t border-slate-800 pt-4">
                <h5 className="text-[10px] font-bold uppercase text-slate-300 font-mono">Restore Points ({history.length})</h5>
                {history.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl text-[10px] text-slate-500 font-mono italic">
                    No snapshots created yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map(snap => (
                      <div key={snap.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col gap-1.5">
                        <div className="font-bold text-[10px] text-slate-200">{snap.name}</div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          📅 {new Date(snap.timestamp).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">
                          📦 {snap.schedule.length} Program Blocks Saved
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to restore to snapshot "${snap.name}"? This will overwrite the current EPG schedule.`)) {
                                setSchedule(snap.schedule);
                                if (addLog) addLog(`History Manager: Successfully rolled back EPG schedule to: "${snap.name}"`);
                                window.dispatchEvent(new Event("ajn-schedule-updated"));
                              }
                            }}
                            className="flex-1 py-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-400 font-bold text-[9px] uppercase tracking-wider font-mono transition-all cursor-pointer"
                          >
                            Rollback
                          </button>
                          <button
                            onClick={() => {
                              const updated = history.filter(h => h.id !== snap.id);
                              setHistory(updated);
                              safeLocalStorage.setItem("ajn_schedule_history", JSON.stringify(updated));
                            }}
                            className="p-1 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 text-xs transition-colors cursor-pointer"
                            title="Delete snapshot"
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
          </div>
        )}
      </div>

      {/* ===================== RIGHT SECTION: INTERACTIVE SCHEDULER CALENDAR ===================== */}
      <div className={`xl:col-span-3 rounded-2xl border p-6 flex flex-col gap-6 h-[850px] overflow-hidden ${
        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#090D16] border-slate-800/80 text-slate-100"
      }`}>
        
        {/* UPPER CONTROLS GRID */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          
          {/* Target Channel Selector */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <label className="text-[9px] uppercase font-mono tracking-widest text-slate-400 block mb-0.5">Automated Channel</label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="bg-black border border-slate-800 rounded-lg px-3 py-1 text-xs font-black text-slate-200 outline-none focus:border-emerald-500 cursor-pointer"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>📺 {c.name} ({c.callSign})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Operations & View Mode */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Autofill / Operations */}
            <div className="flex gap-2">
              <button
                onClick={handleAutofillSchedule}
                className="px-3 py-1.5 text-[9px] font-mono font-black uppercase rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="Autofill the schedule with items"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Autofill</span>
              </button>
              <button
                onClick={handleClearChannelSchedule}
                className="px-3 py-1.5 text-[9px] font-mono font-black uppercase rounded-lg border border-red-500/30 text-red-400 hover:bg-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="Clear all scheduling blocks for selected channel"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Playout</span>
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex gap-1 p-1 bg-black rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode("daily")}
                className={`px-2.5 py-1 text-[9px] font-mono font-black uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === "daily" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <List className="w-3 h-3" />
                <span>Daily</span>
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`px-2.5 py-1 text-[9px] font-mono font-black uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === "weekly" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Grid className="w-3 h-3" />
                <span>Weekly</span>
              </button>
              <button
                onClick={() => setViewMode("queue")}
                className={`px-2.5 py-1 text-[9px] font-mono font-black uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === "queue" ? "bg-red-650 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Queue ({channelBlocks.length})</span>
              </button>
            </div>
          </div>

        </div>

        {/* COLLISION ALERT NOTIFICATION BANNER */}
        {overlappingBlockIds.size > 0 && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-[#1e0a0d] text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-pulse shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-red-400">Playout Conflict Warn: Overlapping Playouts Detected</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {overlappingBlockIds.size} scheduled blocks are currently overlapping on this channel, which may cause broadcast stutter.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => autoResolveConflicts(resolutionStrategy)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-mono font-black text-[9px] uppercase rounded-lg transition-all shadow-md shadow-red-950/20 cursor-pointer flex items-center gap-1"
              >
                <Wrench className="w-3 h-3" />
                <span>Auto-Correct Now</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------- VIEW MODE 1: DAILY TIMELINE WITH DROP SLOTS ------------------- */}
        {viewMode === "daily" && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Day Selector Row */}
            <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-slate-850 shrink-0">
              <button 
                onClick={() => setSelectedDayIndex(prev => (prev === 0 ? 6 : prev - 1))}
                className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-850 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black font-mono uppercase text-emerald-400 tracking-wider">
                📅 {daysOfWeek[selectedDayIndex]} Schedule Grid (Continuous Playout)
              </span>
              <button 
                onClick={() => setSelectedDayIndex(prev => (prev === 6 ? 0 : prev + 1))}
                className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-850 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* List of 24 hours */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
              {Array.from({ length: 12 }, (_, i) => i * 2).map((hour) => {
                const block = getBlockForHour(hour);
                const formattedHour = String(hour).padStart(2, "0") + ":00";
                const isConflicted = block ? overlappingBlockIds.has(block.id) : false;
                
                return (
                  <div
                    key={hour}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("border-emerald-500", "bg-emerald-600/5");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("border-emerald-500", "bg-emerald-600/5");
                    }}
                    onDrop={(e) => {
                      e.currentTarget.classList.remove("border-emerald-500", "bg-emerald-600/5");
                      handleDropOnSlot(e, hour, daysOfWeek[selectedDayIndex]);
                    }}
                    className={`group border rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-all min-h-[64px] ${
                      isConflicted 
                        ? "border-red-500/50 bg-[#1b080b]/80 hover:bg-[#200a0e]/90" 
                        : "border-slate-850 bg-[#0b0f1a]/60 hover:bg-[#101424]/80"
                    }`}
                  >
                    {/* Time boundary tag */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <Clock className={`w-4 h-4 transition-colors ${isConflicted ? "text-red-400" : "text-slate-500 group-hover:text-emerald-400"}`} />
                      <span className={`text-[11px] font-mono font-black w-12 ${isConflicted ? "text-red-300" : "text-slate-300"}`}>{formattedHour}</span>
                      <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded uppercase ${
                        isConflicted ? "border-red-500/20 text-red-400" : "border-slate-850 text-slate-500"
                      }`}>
                        {hour < 12 ? "AM Playout" : "PM Playout"}
                      </span>
                    </div>

                    {/* Playout block content or drop zone placeholder */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      {block ? (
                        <>
                          {/* Live logo indicator */}
                          <img
                            src={block.thumbnailUrl || getArchiveThumbnail(block.category, block.title)}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-slate-800"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getArchiveThumbnail(block.category, block.title);
                            }}
                          />
                          <div className="min-w-0">
                            <span className={`text-xs font-black uppercase truncate block ${isConflicted ? "text-red-200" : "text-slate-100"}`}>
                              {block.title}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 uppercase flex items-center gap-2 mt-0.5">
                              <span className={isConflicted ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                                {block.category}
                              </span>
                              <span>•</span>
                              <span className={isConflicted ? "text-red-300 font-bold" : ""}>{block.durationMin} mins</span>
                              <span>•</span>
                              <span className="text-slate-500">{block.rating || "NR"}</span>
                              {isConflicted && (
                                <span className="text-red-400 font-bold animate-pulse px-1 bg-red-950/40 rounded border border-red-500/20 text-[8.5px]">
                                  ⚠️ CONFLICT
                                </span>
                              )}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] font-mono text-slate-500 uppercase border border-dashed border-slate-850 px-4 py-2.5 rounded-xl w-full text-center group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition-all bg-black/10">
                          Empty air space. Drop a playout block here to automate broadcast.
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      {block ? (
                        <>
                          <button
                            onClick={() => handleStartEditing(block)}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-[9px] font-mono font-bold text-slate-300 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveBlock(block.id, block.title)}
                            className="p-2 bg-slate-900 border border-slate-800 hover:border-red-500/40 hover:bg-red-900/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Remove Scheduled Block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleQuickAddBlock(hour)}
                          className="p-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-emerald-900/10 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[9px] font-mono font-bold uppercase"
                          title="Quick manual add block"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Schedule</span>
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------- VIEW MODE 2: WEEKLY GRID BLOCK MATRIX ------------------- */}
        {viewMode === "weekly" && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Matrix column layout */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[800px] h-full flex flex-col">
                {/* Header row with days of the week */}
                <div className="grid grid-cols-7 gap-2 border-b border-slate-850 pb-2 mb-2 text-center text-[10px] font-mono font-black uppercase tracking-wider text-slate-400 shrink-0">
                  {daysOfWeek.map((day) => (
                    <div key={day} className="py-1 bg-black/30 rounded-lg border border-slate-850">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Grid cells */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {Array.from({ length: 6 }, (_, i) => i * 4).map((hour) => {
                    const formattedHour = String(hour).padStart(2, "0") + ":00";
                    return (
                      <div key={hour} className="grid grid-cols-7 gap-2 min-h-[90px]">
                        {daysOfWeek.map((day, dIdx) => {
                          const block = getBlockForHour(hour);
                          const isConflicted = block ? overlappingBlockIds.has(block.id) : false;
                          
                          return (
                            <div
                              key={day}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.add("border-emerald-500", "bg-emerald-500/5");
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove("border-emerald-500", "bg-emerald-500/5");
                              }}
                              onDrop={(e) => {
                                e.currentTarget.classList.remove("border-emerald-500", "bg-emerald-500/5");
                                handleDropOnSlot(e, hour, day);
                              }}
                              className={`group border p-2.5 flex flex-col justify-between gap-1 transition-all relative rounded-xl ${
                                isConflicted 
                                  ? "border-red-500 bg-[#220a0e] hover:bg-[#2b0c12]" 
                                  : "border-slate-850 bg-black/25 hover:bg-[#0c0f1d]"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[8px] font-mono text-slate-500">
                                <span className={isConflicted ? "text-red-400" : ""}>{formattedHour}</span>
                                {isConflicted ? (
                                  <span className="text-red-400 font-bold">CONFLICT</span>
                                ) : (
                                  <span className="opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity">DROP</span>
                                )}
                              </div>

                              {block ? (
                                <div className="text-[9px] leading-tight">
                                  <div className={`font-black uppercase truncate block ${isConflicted ? "text-red-200" : "text-slate-200"}`} title={block.title}>
                                    {block.title}
                                  </div>
                                  <div className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">
                                    {block.category} • {block.durationMin}m
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[8px] font-mono text-slate-600 uppercase text-center py-2 italic">
                                  Empty Slot
                                </div>
                              )}

                              {block && (
                                <button
                                  onClick={() => handleRemoveBlock(block.id, block.title)}
                                  className="absolute bottom-1 right-1 p-1 bg-slate-900 border border-slate-800 hover:border-red-500 hover:bg-red-900/20 text-slate-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------- VIEW MODE 3: QUEUE CHRONOLOGICAL MANAGE OVERLAPS ------------------- */}
        {viewMode === "queue" && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-slate-850 shrink-0">
              <span className="text-xs font-bold font-mono text-slate-300 uppercase">
                Active Playout Timeline Queue ({channelBlocks.length} Scheduled Blocks)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Sorted chronologically. Overlapping conflicts are listed in sequence.
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin">
              {channelBlocks.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-850 rounded-2xl bg-black/10 text-slate-500 font-mono text-xs uppercase">
                  No shows currently scheduled in playout queue
                </div>
              ) : (
                channelBlocks.map((item, idx) => {
                  const isConflicted = overlappingBlockIds.has(item.id);
                  const nextItem = channelBlocks[idx + 1];
                  const endsAtTime = minutesToTime(item.end);
                  const hasGapToNext = nextItem && nextItem.start > item.end;
                  const gapDuration = nextItem ? nextItem.start - item.end : 0;

                  return (
                    <div key={item.id} className="space-y-2">
                      <div className={`p-4 rounded-xl border transition-all ${
                        isConflicted 
                          ? "border-red-500/50 bg-[#1e0a0d] hover:bg-[#250d11]" 
                          : "border-slate-850 bg-[#0d101f] hover:bg-[#11152a]"
                      }`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg border font-mono text-xs font-bold text-center shrink-0 w-16 ${
                              isConflicted ? "bg-red-950/40 border-red-500/30 text-red-400" : "bg-slate-900 border-slate-800 text-slate-300"
                            }`}>
                              {item.startTime}
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <div className="p-2 rounded-lg border bg-slate-900 border-slate-800 font-mono text-xs text-slate-300 text-center shrink-0 w-16">
                              {endsAtTime}
                            </div>

                            <div className="min-w-0 pl-1">
                              <h4 className={`text-xs font-black uppercase truncate max-w-sm ${isConflicted ? "text-red-200" : "text-slate-100"}`}>
                                {item.title}
                              </h4>
                              <p className="text-[9px] font-mono text-slate-500 mt-0.5 uppercase tracking-tight">
                                Duration: <strong className="text-slate-300">{item.durationMin} mins</strong> • Category: <strong className="text-emerald-400">{item.category}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {isConflicted && (
                              <span className="text-[9px] font-mono font-black uppercase tracking-wider text-red-400 bg-red-900/20 border border-red-500/30 px-2 py-1 rounded animate-pulse">
                                ⚠️ Overlap Collision
                              </span>
                            )}
                            <button
                              onClick={() => handleStartEditing(item)}
                              className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-[10px] font-mono font-bold rounded"
                            >
                              Fine-Tune
                            </button>
                            <button
                              onClick={() => handleRemoveBlock(item.id, item.title)}
                              className="p-1.5 bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-red-950/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* Display warning or spacer between items */}
                      {hasGapToNext && (
                        <div className="text-center py-1.5 bg-[#0a110f] border border-[#142d22] rounded-lg text-[#3cd070] font-mono text-[9px] uppercase tracking-widest">
                          🛡️ Air space clear: {gapDuration} minutes buffer time
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* INLINE TIME ADJUSTMENT MODAL OVERLAY */}
        {editingBlockId && (
          <div className="absolute inset-0 bg-[#06080e]/95 z-40 flex items-center justify-center p-6 animate-fadeIn">
            <div className="w-full max-w-md bg-[#0a0d18] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Settings className="w-4.5 h-4.5" />
                  <span className="text-xs font-black font-mono uppercase tracking-wider">Playout Fine-Tuner</span>
                </div>
                <button
                  onClick={() => setEditingBlockId(null)}
                  className="text-slate-400 hover:text-white font-mono text-[11px] uppercase border border-slate-800 px-2 py-0.5 rounded"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Start Time (HH:MM)</label>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    placeholder="e.g. 14:30"
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Playout Duration: {editDuration} mins</label>
                  <input
                    type="range"
                    min="5"
                    max="480"
                    step="5"
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 bg-black rounded"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-slate-500 mt-1">
                    <span>5 mins</span>
                    <span>4 hours</span>
                    <span>8 hours</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => handleSaveInlineEdit(editingBlockId)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-black text-xs uppercase rounded-xl transition-all shadow-lg shadow-emerald-950/20"
                >
                  Save Playout Block
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
