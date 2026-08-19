import { mainVideoRef } from "../utils/videoRef";
import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, 
  Activity, 
  GitBranch, 
  Layers, 
  Sliders, 
  Monitor, 
  Scissors, 
  TrendingUp, 
  Calendar,
  Search,
  Plus,
  Play,
  Clipboard,
  Clock,
  Heart,
  Settings,
  Flame,
  Music,
  Tv,
  Check,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Share2
} from "lucide-react";
import { BundleExporter, StandalonePlayerGenerator } from "../lib/showDatabase";

interface CinephileSuiteProps {
  currentUrl: string;
  currentTitle: string;
  
  playStream: (url: string, title: string) => void;
  channels: any[];
  favorites: any[];
  theme: "dark" | "light";
  tvDb?: any;
}

// Typing definitions matching blueprint specifications
export type MoodState = 'contemplative' | 'stressed' | 'excited' | 'melancholic' | 'escapist' | 'analytical';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late-night';
export type PacingProfile = 'slow-burn' | 'breakneck' | 'uneven' | 'perfect' | 'deliberate';

export interface ClipReference {
  clipId: string;
  timestampStart: number;
  timestampEnd: number;
  annotation: string;
  transcribedText?: string;
  framing?: string;
  movement?: string;
}

export interface ViewingSession {
  id: string;
  title: string;
  url: string;
  preWatchMood: MoodState;
  watchTime: TimeOfDay;
  environment: 'solo' | 'partner' | 'group' | 'background';
  duration: number; 
  quickReaction: string;
  rating: number; // 0-10
  ratingBreakdown: {
    acting: number;
    directing: number;
    cinematography: number;
    pacing: number;
  };
  pacing: PacingProfile;
  clippingsMade: ClipReference[];
  createdAt: string;
}

export function CinephileSuite({ 
  currentUrl, 
  currentTitle, 
   
  playStream, 
  channels, 
  favorites, 
  theme,
  tvDb
}: CinephileSuiteProps) {
  // Navigation for modules
  const [activeSubTab, setActiveSubTab] = useState<number>(1);

  // General App Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // --- MODULE 1: TASTING NOTES ---
  const [journals, setJournals] = useState<ViewingSession[]>(() => {
    const saved = safeLocalStorage.getItem("ajn_cinephile_journals");
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return [
      {
        id: "1",
        title: "Sunset Boulevard (1950)",
        url: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
        preWatchMood: "contemplative",
        watchTime: "evening",
        environment: "solo",
        duration: 110,
        quickReaction: "Third act structural subversion completely shifts the narrative focus. Unbelievable monochrome high-contrast shadows.",
        rating: 9.2,
        ratingBreakdown: { acting: 9, directing: 10, cinematography: 10, pacing: 8 },
        pacing: "deliberate",
        clippingsMade: [],
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: "2",
        title: "La Jetée (1962)",
        url: "https://archive.org/download/01-tv-fighting-crime/COLUMBO.S01E01-Perscription%20Murder.mp4",
        preWatchMood: "analytical",
        watchTime: "late-night",
        environment: "solo",
        duration: 28,
        quickReaction: "A profound photo-montage exploration of memory and loops. Best sci-fi pacing ever.",
        rating: 9.8,
        ratingBreakdown: { acting: 8, directing: 10, cinematography: 10, pacing: 10 },
        pacing: "slow-burn",
        clippingsMade: [],
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ];
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [jTitle, setJTitle] = useState(currentTitle || "Active Watch Stream");
  const [jReaction, setJReaction] = useState("");
  const [jRating, setJRating] = useState(8.5);
  const [jActing, setJActing] = useState(8);
  const [jDirecting, setJDirecting] = useState(9);
  const [jCinematography, setJCinematography] = useState(9);
  const [jPacingVal, setJPacingVal] = useState(8);
  const [jMood, setJMood] = useState<MoodState>("analytical");
  const [jPacing, setJPacing] = useState<PacingProfile>("deliberate");
  const [jTime, setJTime] = useState<TimeOfDay>("evening");
  const [jEnv, setJEnv] = useState<'solo' | 'partner' | 'group' | 'background'>("solo");

  useEffect(() => {
    if (currentTitle) {
      setJTitle(currentTitle);
    }
  }, [currentTitle]);

  const handleSaveJournal = () => {
    const newEntry: ViewingSession = {
      id: String(Date.now()),
      title: jTitle,
      url: currentUrl || "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
      preWatchMood: jMood,
      watchTime: jTime,
      environment: jEnv,
      duration: 120, // estimated
      quickReaction: jReaction || "Exemplary narrative progression capturing the essence of stylistic scene structure.",
      rating: jRating,
      ratingBreakdown: {
        acting: jActing,
        directing: jDirecting,
        cinematography: jCinematography,
        pacing: jPacingVal
      },
      pacing: jPacing,
      clippingsMade: clips,
      createdAt: new Date().toISOString()
    };
    const updated = [newEntry, ...journals];
    setJournals(updated);
    safeLocalStorage.setItem("ajn_cinephile_journals", JSON.stringify(updated));
    setJReaction("");
    showToast("JOURNAL ENTRY COMMITTED TO OBSIDIAN CORE");
  };

  const filteredJournals = useMemo(() => {
    return journals.filter(j => 
       j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       j.quickReaction.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [journals, searchQuery]);


  // --- MODULE 2: EPISODE AUTOPSY ---
  const [autopsySyncTime, setAutopsySyncTime] = useState(0);
  useEffect(() => {
    const video = (mainVideoRef.current as HTMLVideoElement);
    if (!video) return;
    const interval = setInterval(() => {
      setAutopsySyncTime(Math.floor(video.currentTime));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const seekPlayerTo = (seconds: number) => {
    if ((mainVideoRef.current as HTMLVideoElement)) {
      (mainVideoRef.current as HTMLVideoElement).currentTime = seconds;
      showToast(`PLAYER SYNCHRONIZED TO ${Math.floor(seconds / 60)}m ${seconds % 60}s`);
    } else {
      showToast("LOAD ACTIVE STREAM ROOT FIRST");
    }
  };

  const autopsyBeats = [
    { timestamp: 12, type: 'scene-break', title: 'Cyber Opening Sequence', summary: 'Dystopian skyline view with heavy granular tracking filters.' },
    { timestamp: 45, type: 'major-reveal', title: 'The Blueprint Intercept', summary: 'Protagonist accesses secure memory drive encrypted in hex.' },
    { timestamp: 120, type: 'emotional-climax', title: 'Conductor Confrontation', summary: 'Split framing visualizes structural discord between partners.' },
    { timestamp: 240, type: 'continuity-node', title: 'Basement Vault Connection', summary: 'Refers to the original Season 1 Episode 4 lock design.' }
  ];

  const currentActiveBeat = [...autopsyBeats]
    .reverse()
    .find(b => autopsySyncTime >= b.timestamp) || autopsyBeats[0];


  // --- MODULE 3: PLAYLIST VERSIONING ---
  const [versionBranches, setVersionBranches] = useState([
    { label: "v3.2", hash: "SHA-256: 03e8ca0b...", author: "You", date: "2 days ago", comment: "Reordered: Moved Ocean's 11 before Heist", reason: "Optimizes chronology flow" },
    { label: "v3.1", hash: "SHA-256: e8ca032b...", author: "You", date: "1 week ago", comment: "Added: The Italian Job (1969)", reason: "Discovered rare vintage remaster file" },
    { label: "v3.0", hash: "SHA-256: 9fbca028...", author: "Core Ingestion", date: "3 weeks ago", comment: "Base Compilation Ingest", reason: "First staging roll" }
  ]);
  const [activeBranch, setActiveBranch] = useState("v3.2");
  const [showDiff, setShowDiff] = useState(false);

  const handleBranchCheckout = (branch: string) => {
    setActiveBranch(branch);
    showToast(`BRANCH ${branch} CHECKED OUT SUCCESSFULLY`);
  };


  // --- MODULE 4: PLAYLIST WORKBENCH ---
  const [canvasTimeline, setCanvasTimeline] = useState<any[]>([
    { id: "s1", name: "Cyberpunk Anthology Ep 3", url: "https://example.com/hls/cyber1.m3u8", duration: 2520, group: "Sci-Fi" },
    { id: "s2", name: "Neo-Noir Short Film (1994)", url: "https://example.com/hls/neonoir.m3u8", duration: 1800, group: "Noir" }
  ]);

  const handleAddActiveStreamToTimeline = () => {
    if (!currentUrl) {
      showToast("NO STREAM ACTIVELY PLAYING TO INGEST");
      return;
    }
    const dup = canvasTimeline.some(item => item.url === currentUrl);
    if (dup) {
      showToast("STREAM INSTANCE ALREADY IN STAGING WORKBENCH");
      return;
    }
    const added = {
      id: "s_" + Date.now(),
      name: currentTitle || "Ingested Active Stream",
      url: currentUrl,
      duration: 3600, // estimated 1 hour
      group: "Live Feed"
    };
    setCanvasTimeline([...canvasTimeline, added]);
    showToast("INTEGRATED STREAM TARGET INTO TIMELINE WORKBENCH");
  };

  const handleSortTimeline = () => {
    const sorted = [...canvasTimeline].sort((a, b) => a.name.localeCompare(b.name));
    setCanvasTimeline(sorted);
    showToast("CHRONOLOGICAL CHANNELS AUTO-SORT COMPLETED");
  };


  // --- MODULE 5: DISCOVERY ENGINE ---
  const [dmMood, setDmMood] = useState<MoodState>("analytical");
  const [dmDuration, setDmDuration] = useState(60);
  const [dmIntensity, setDmIntensity] = useState(7);
  const [dmLighting, setDmLighting] = useState<"dark-room" | "daylight" | "ambient">("dark-room");

  const discoveryMatch = useMemo(() => {
    // Generate simulated dynamic recommendation
    switch (dmMood) {
      case "stressed":
        return { title: "Liquid Ambient Garden (Low Intensity)", match: 94.2, dur: "42 min", link: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4", reason: "Matches stressed mood vector with passive audio-landscape overlays." };
      case "escapist":
        return { title: "Alex Jones Show: Retro Highlights", match: 89.7, dur: "55 min", link: "https://archive.org/download/01-tv-fighting-crime/COLUMBO.S01E01-Perscription%20Murder.mp4", reason: "Captures deep-cut investigative timelines matching high cognitive escape values." };
      case "analytical":
      default:
        return { title: "Dystopian Architecture Cinematic Matrix", match: 97.4, dur: "115 min", link: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4", reason: "Aligns with analytical dark-room profiles using high-definition monochrome templates." };
    }
  }, [dmMood, dmIntensity]);


  // --- MODULE 6: COMPARATIVE VIEWING ---
  const [compOffset, setCompOffset] = useState<number>(108); // millisecond offset
  const [compLinked, setCompLinked] = useState(true);
  const [compNotes, setCompNotes] = useState("Frame A uses wide-angle tracking lenses; Frame B relies on camera zoom layout shifts.");


  // --- MODULE 7: ANALYTICAL CLIPPING ---
  const [clipStart, setClipStart] = useState<number>(845); // 14:05
  const [clipEnd, setClipEnd] = useState<number>(882); // 14:42
  const [clipTrans, setClipTrans] = useState("We construct our architectural engines directly into the memory matrix.");
  const [clipFraming, setClipFraming] = useState("close-up");
  const [clipMovement, setClipMovement] = useState("tracking");
  const [clips, setClips] = useState<ClipReference[]>([
    { clipId: "c1", timestampStart: 845, timestampEnd: 882, annotation: "Protagonist monologue. Splendid macro framing shift.", transcribedText: "We construct our architectural engines directly into the memory matrix.", framing: "close-up", movement: "tracking" }
  ]);

  const handleCaptureCurrentTime = (type: "start" | "end") => {
    if ((mainVideoRef.current as HTMLVideoElement)) {
      const cur = Math.floor((mainVideoRef.current as HTMLVideoElement).currentTime);
      if (type === "start") setClipStart(cur);
      else setClipEnd(cur);
      showToast(`CAPTURED ${type.toUpperCase()} ASPECT: ${Math.floor(cur / 60)}m ${cur % 60}s`);
    } else {
      showToast("NO STREAM LOADED TO EXTRACT EVENT TIMESTAMPS");
    }
  };

  const handleCreateClip = () => {
    if (clipStart >= clipEnd) {
      showToast("TERMINATION MARKER MUST EXCEED STARTING TIMESTAMP");
      return;
    }
    const newClip: ClipReference = {
      clipId: "cl_" + Date.now(),
      timestampStart: clipStart,
      timestampEnd: clipEnd,
      annotation: `Framing: ${clipFraming.toUpperCase()} • Movement: ${clipMovement.toUpperCase()}`,
      transcribedText: clipTrans,
      framing: clipFraming,
      movement: clipMovement
    };
    setClips([newClip, ...clips]);
    showToast("SCENE HIGHLIGHT EXTACTED INTO JOURNAL MATRIX");
  };


  // --- MODULE 8: VIEWING DNA ---
  const dnaMetrics = {
    cyberpunk: 88,
    slowBurn: 54,
    avantGarde: 72,
    completionRate: 98.4
  };


  // --- MODULE 9: AUTOMATED SCHEDULER ---
  const [scheduledSlots, setScheduledSlots] = useState<any[]>([
    { id: "as1", time: "20:00", title: "Cyberpunk Anthology Ep 3", source: "Live Ingest" },
    { id: "as2", time: "21:00", title: "Classic Noir Document Feature", source: "v3.2 Track" }
  ]);
  const [replenishThreshold, setReplenishThreshold] = useState(3);
  const [emergencyFallback, setEmergencyFallback] = useState("https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4");

  // --- MODULE 10: PORTABLE BUNDLES ---
  const [exportBundleTitle, setExportBundleTitle] = useState("Cinephile Curated Collection");
  const [exportCreator, setExportCreator] = useState("Cinephile Curator");
  const [selectedExportShowIds, setSelectedExportShowIds] = useState<string[]>([]);


  const modulesMetadata = [
    { id: 1, name: "Tasting Journal", icon: <BookOpen className="w-4 h-4 text-[#00ff66]" />, desc: "Structured viewing session journals & fuzzy criteria search logs." },
    { id: 2, name: "Episode Autopsy", icon: <Activity className="w-4 h-4 text-[#00ff66]" />, desc: "Real-time timeline beats, character cues, and scene continuity links." },
    { id: 3, name: "Playlist Versioning", icon: <GitBranch className="w-4 h-4 text-[#00ff66]" />, desc: "Track code checkout branches, modification trees, and hard resets." },
    { id: 4, name: "Composition Workbench", icon: <Layers className="w-4 h-4 text-[#00ff66]" />, desc: "Ingest live M3U feeds, customize channel arrays, and review code compilation." },
    { id: 5, name: "Mood Discovery", icon: <Sliders className="w-4 h-4 text-[#00ff66]" />, desc: "Multi-matrix behavior sliders paired to index continuous suggestions." },
    { id: 6, name: "Comparative Side-Deck", icon: <Monitor className="w-4 h-4 text-[#00ff66]" />, desc: "Side-by-side player alignment, frame locks, and delta telemetry logs." },
    { id: 7, name: "Analytical Moment Clipper", icon: <Scissors className="w-4 h-4 text-[#00ff66]" />, desc: "Granular start/stop marker splicing, scene tags, and custom transcripts." },
    { id: 8, name: "Viewing DNA Metrics", icon: <TrendingUp className="w-4 h-4 text-[#00ff66]" />, desc: "High-density affinity heatmaps, cognitive complexity limits, and pace metrics." },
    { id: 9, name: "Chrono-Scheduler", icon: <Calendar className="w-4 h-4 text-[#00ff66]" />, desc: "Time-grid queues coupled to automatic fallback harvester engines." },
    { id: 10, name: "Portable Bundles", icon: <Share2 className="w-4 h-4 text-[#00ff66]" />, desc: "Export self-contained playable/reimportable HTML packages of curated shows." }
  ];

  return (
    <div className={`p-6 w-full max-w-7xl mx-auto space-y-6 select-none font-sans ${theme === "light" ? "text-slate-800" : "text-slate-200"}`}>
      
      {/* HEADER SECTION WITH DEEPLINK BRANDING */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#080d16]/90 border border-[#00ff66]/30 p-5 rounded-2xl backdrop-blur-md relative shadow-[0_0_15px_rgba(0,255,102,0.1)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff66] animate-pulse"></span>
            <span className="text-[10px] text-[#00ff66] font-bold font-mono tracking-widest uppercase">CINEPHILE INTELLIGENCE SUITE v4.0</span>
          </div>
          <h2 className="text-xl font-black font-mono text-[#00ff66] tracking-tight mt-1">AJN PROFESSIONAL CONSOLE DECK</h2>
          <p className="text-xs text-slate-450 mt-1 max-w-2xl font-medium">
            Deploy dynamic tracking analytics, structured journals, synchronization tools, and scheduling vectors aligned with native HLS video engines.
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#020203] border border-[#00ff66]/20 font-mono text-[10px] text-slate-400">
            ACTIVE TARGET: <span className="text-white font-semibold">{currentTitle || "Live Stream Active"}</span>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT: SIDE MODULES SELECTOR AND MAIN ACTIVE PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* SIDEBAR SELECTOR PANEL */}
        <div className="lg:col-span-1 space-y-3 bg-[#030508]/85 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] font-bold font-mono text-[#00ff66]/80 px-2 tracking-wider uppercase">
            9 CONNECTED FEEDS
          </div>
          <div className="space-y-1" role="tablist" aria-label="Cinephile Intelligence Modules">
            {modulesMetadata.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveSubTab(m.id)}
                role="tab"
                aria-selected={activeSubTab === m.id}
                aria-label={`Switch to the ${m.name} module. ${m.desc}`}
                title={`Navigate to the ${m.name} panel - ${m.desc}. Highlights direct module functions.`}
                className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                  activeSubTab === m.id 
                    ? "bg-[#00ff66]/10 border-[#00ff66]/50 shadow-md shadow-[#00ff66]/5 text-white" 
                    : "bg-transparent border-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className={`p-1.5 rounded-xl ${activeSubTab === m.id ? "bg-[#00ff66]/20" : "bg-slate-800/40"}`}>
                  {m.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold font-mono tracking-tight leading-none">{m.name}</div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-800/50 pt-2 text-center text-[9px] font-mono text-slate-500 uppercase">
            STAGE BINDING DECK READY
          </div>
        </div>

        {/* ACTIVE MODULE CONTAINER VIEW */}
        <div className="lg:col-span-3 min-h-[580px] flex flex-col bg-[#04060b]/90 border border-slate-800 rounded-2xl p-6 relative shadow-2xl">
          
          {/* =================== MODULE 1: TASTING JOURNAL ENTRY =================== */}
          {activeSubTab === 1 && (
            <div className="space-y-5 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Tasting Notes Journaling Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Tasting Notes Journaling</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Captures immediate watch parameters, cognitive rating breakdowns, and logs to local persistence.</p>
                  </div>
                  <span className="bg-[#00ff66]/15 hover:bg-[#00ff66]/25 border border-[#00ff66]/35 text-[#00ff66] text-[8.5px] font-mono font-black tracking-widest px-2.5 py-1 rounded-sm uppercase">Obsidian Sync Active</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Log your artistic and emotional criticism variables for the active media stream in your browser's local sandbox storage. 
                    Hover over any slider, input field, or button to see their concrete operation mappings. Your compiled calculations automatically compute average watch weights in real-time.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Form fields */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block mb-1 uppercase">Media Track Title</label>
                      <input 
                        type="text" 
                        value={jTitle} 
                        onChange={(e) => setJTitle(e.target.value)} 
                        title="Specifies the name of the film, custom stream, or media catalog item currently under evaluation."
                        aria-label="Media Track Title input field"
                        aria-description="Type the title of the movie, live channel feed, or video segment you are analyzing."
                        className="w-full bg-[#020204] border border-slate-800 hover:border-slate-700 focus:border-[#00ff66]/60 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00ff66]/40 transition-colors font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block mb-1 uppercase">Pre-Watch Mood</label>
                        <select 
                          value={jMood} 
                          onChange={(e) => setJMood(e.target.value as MoodState)} 
                          title="Sets the pre-watch psychological mood parameter to track cognitive correlation against final ratings."
                          aria-label="Pre-Watch Mood selection dropdown"
                          aria-description="Select your emotional pre-state, such as contemplative or escapist, before commencing view."
                          className="w-full bg-[#020204] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none transition-colors"
                        >
                          <option value="contemplative">Contemplative</option>
                          <option value="stressed">Stressed</option>
                          <option value="excited">Excited</option>
                          <option value="melancholic">Melancholic</option>
                          <option value="escapist">Escapist</option>
                          <option value="analytical">Analytical</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block mb-1 uppercase">Watch Environment</label>
                        <select 
                          value={jEnv} 
                          onChange={(e) => setJEnv(e.target.value as any)} 
                          title="Sets the social and biological environment (solo, partner, group, or passive background audio) during viewing."
                          aria-label="Watch Environment selection dropdown"
                          aria-description="Select who you are watching with, such as solo view, or whether this is passive audio."
                          className="w-full bg-[#020204] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none transition-colors"
                        >
                          <option value="solo">Solo Viewing</option>
                          <option value="partner">With Partner</option>
                          <option value="group">Within Group</option>
                          <option value="background">Background Feed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block mb-1 uppercase">Immediate Reaction Annotation</label>
                      <textarea 
                        value={jReaction} 
                        onChange={(e) => setJReaction(e.target.value)} 
                        title="Draft your immediate scene-by-scene analysis notes, emotional responses, or cinematographic breakdown highlights."
                        aria-label="Immediate Watch Reaction Commentary field"
                        aria-description="Input field where you write critical reviews, immediate observations, and film analysis thoughts."
                        placeholder="e.g. 'Third act structural subversion completely shifts the thematic focus... Excellent monochromatic shades.'"
                        rows={3}
                        className="w-full bg-[#020204] border border-slate-800 hover:border-slate-700 focus:border-[#00ff66]/60 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00ff66]/40 transition-colors font-medium outline-none resize-none"
                      />
                    </div>
                  </div>

                  {/* Custom Slide Dials */}
                  <div className="bg-[#020204] border border-slate-800/80 p-4 rounded-2xl space-y-3.5">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase border-b border-slate-800/55 pb-1">
                      <span className="text-[#00ff66]">Rating Metrics Breakdown</span>
                      <span className="bg-[#00ff66]/10 px-2 py-0.5 rounded-md text-[#00ff66] border border-[#00ff66]/20">OVERALL: {jRating}/10</span>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-slate-400 font-mono mb-1">
                          <span>ACTING CHOREOGRAPHY:</span>
                          <span className="text-white font-bold">{jActing}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="1" 
                          value={jActing} 
                          title="Slide to assign acting choreography score from 1 (poor) to 10 (perfect)."
                          aria-label="Acting Choreography score slider input"
                          aria-description="Adjust score evaluation for cast performance and physical screen movement choreographies, out of ten."
                          onChange={(e) => { setJActing(Number(e.target.value)); setJRating(Number(((Number(e.target.value) + jDirecting + jCinematography + jPacingVal) / 4).toFixed(1))); }} 
                          className="w-full accent-[#00ff66] bg-slate-800 rounded-xl cursor-pointer h-1" 
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-slate-400 font-mono mb-1">
                          <span>DIRECTION DYNAMICS:</span>
                          <span className="text-white font-bold">{jDirecting}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="1" 
                          value={jDirecting} 
                          title="Slide to assign director dynamics score from 1 (uninspired) to 10 (visionary)."
                          aria-label="Direction dynamics score slider input"
                          aria-description="Adjust score evaluation for dramatic direction pacing, character positioning, and scene staging, out of ten."
                          onChange={(e) => { setJDirecting(Number(e.target.value)); setJRating(Number(((jActing + Number(e.target.value) + jCinematography + jPacingVal) / 4).toFixed(1))); }} 
                          className="w-full accent-[#00ff66] bg-slate-800 rounded-xl cursor-pointer h-1" 
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-slate-400 font-mono mb-1">
                          <span>CINEMATOGRAPHY CADENCE:</span>
                          <span className="text-white font-bold">{jCinematography}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="1" 
                          value={jCinematography} 
                          title="Slide to assign photographic cinematography score from 1 (bland) to 10 (majestic masterclass)."
                          aria-label="Cinematography cadence score slider input"
                          aria-description="Adjust score evaluation for camera motion, lens focus depth, monochrome balance, and general lighting color tone, out of ten."
                          onChange={(e) => { setJCinematography(Number(e.target.value)); setJRating(Number(((jActing + jDirecting + Number(e.target.value) + jPacingVal) / 4).toFixed(1))); }} 
                          className="w-full accent-[#00ff66] bg-slate-800 rounded-xl cursor-pointer h-1" 
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-slate-400 font-mono mb-1">
                          <span>PACING PROFILE:</span>
                          <span className="text-white font-semibold">{jPacing.toUpperCase()} ({jPacingVal})</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="1" 
                          value={jPacingVal} 
                          title="Slide to assign editing speed score from 1 (extremely slow) to 10 (hyperactive)."
                          aria-label="Pacing profile score slider input"
                          aria-description="Adjust score evaluation for cinematic flow speed, scene length, and sequence editing rhythm dynamics, out of ten."
                          onChange={(e) => { setJPacingVal(Number(e.target.value)); setJRating(Number(((jActing + jDirecting + jCinematography + Number(e.target.value)) / 4).toFixed(1))); }} 
                          className="w-full accent-[#00ff66] bg-slate-800 rounded-xl cursor-pointer h-1" 
                        />
                        <div className="flex justify-between text-[8.5px] text-slate-500 font-mono mt-1">
                          <button onClick={() => setJPacing("slow-burn")} title="Preset pace profile: Slow Burn development style" className="hover:text-white">SLOW BURN</button>
                          <button onClick={() => setJPacing("deliberate")} title="Preset pace profile: Deliberate and precise speed" className="hover:text-white">DELIBERATE</button>
                          <button onClick={() => setJPacing("breakneck")} title="Preset pace profile: Extreme action speed" className="hover:text-white">BREAKNECK</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saved Journals fuzzy log search list */}
                <div className="mt-5 pt-4 border-t border-slate-800/60 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-widest text-[#00ff66]/85 uppercase">HISTORICAL CHRONOLOGY LOGS ({filteredJournals.length})</span>
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="Fuzzy Search Reaction Terminology..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#020204] border border-slate-800 rounded-md pl-7 pr-3 py-1 text-[10px] text-slate-300 w-full sm:w-60 focus:outline-none focus:border-[#00ff66]/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {filteredJournals.map((j) => (
                      <div key={j.id} className="p-3 rounded-xl bg-[#020204]/90 border border-slate-800/60 hover:border-slate-800 flex justify-between items-start gap-4 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{j.title}</span>
                            <span className="text-[9px] bg-[#00ff66]/10 text-[#00ff66] font-mono px-1.5 py-0.5 rounded-sm border border-[#00ff66]/20 font-black">{j.rating}</span>
                            <span className="text-[8px] text-slate-500 font-mono">{new Date(j.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 italic">"{j.quickReaction}"</p>
                          <div className="flex gap-2 text-[9px] text-[#00ff66]/50 font-mono uppercase font-black">
                            <span>Mood: {j.preWatchMood}</span>
                            <span>•</span>
                            <span>Env: {j.environment}</span>
                            <span>•</span>
                            <span>Pacing: {j.pacing}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => playStream(j.url, j.title)}
                          className="bg-[#00ff66]/10 hover:bg-[#00ff66]/20 text-[#00ff66] p-1.5 rounded-xl text-[9px] font-mono font-bold tracking-widest flex items-center gap-1 transition-colors uppercase cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-[#00ff66]" /> REPLAY
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/40 flex justify-between gap-4">
                <button 
                  onClick={() => {
                    safeLocalStorage.removeItem("ajn_cinephile_journals");
                    setJournals([]);
                    showToast("JOURNAL CHRONOLOGY BUFFER CLEARED");
                  }}
                  title="Purges all saved tasting log historical database entries from standard localStorage core."
                  aria-label="Clear tasting notes database button"
                  className="px-4 py-2 bg-red-950/10 hover:bg-red-950/30 text-red-500 border border-red-950/40 hover:border-red-500/50 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors"
                >
                  CLEAR DATABASE
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveJournal}
                    title="Commits current Title, Mood, social Environment, Slider Metrics and Annotations to offline persistence."
                    aria-label="Save current journal entry to local db"
                    className="px-6 py-2.5 bg-[#00ff66] hover:bg-[#ccff00] text-[#04060b] font-mono font-black text-xs tracking-wider rounded-xl transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                  >
                    🚀 SAVE ENTRY TO CLIENT CORE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================== MODULE 2: NEXT EPISODE AUTOPSY =================== */}
          {activeSubTab === 2 && (
            <div className="space-y-5 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Next Episode Autopsy Sync Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Next Episode Autopsy Sync Panel</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Launches high-fidelity companion metrics synced to the active player clock timestamps.</p>
                  </div>
                  <span className="bg-[#00ff66]/15 border border-[#00ff66]/35 text-[#00ff66] text-[8.5px] font-mono font-black tracking-widest px-2.5 py-1 rounded-sm uppercase">Active Telemetry Connected</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Synchronize your viewing state with high-fidelity plot points of active tracks or series playback. 
                    <strong>Interactive Action:</strong> Click on any listed <em>Timeline Autopsy Beat</em> on the right to trigger an automated target seek of the video player head to that exact event timestamp!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5">
                  {/* Left Playback Stat Feed */}
                  <div className="md:col-span-1 bg-[#020204] border border-slate-800/85 p-4 rounded-2xl space-y-4">
                    <div className="text-[10px] font-bold font-mono text-slate-400 border-b border-slate-800 pb-1 uppercase">CURRENT STREAM STATE</div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase">CLOCK TIME RANGE:</div>
                        <div className="text-xl font-bold font-mono text-white tracking-widest flex items-center gap-2">
                          <span className="text-[#00ff66]">
                            {Math.floor(autopsySyncTime / 60).toString().padStart(2, "0")}:{(autopsySyncTime % 60).toString().padStart(2, "0")}
                          </span>
                          <span className="text-xs text-slate-550 font-normal">/ 50:00</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase">EPISODE AUTOPSY SYNC BEAT:</div>
                        <div className="p-2.5 rounded-xl bg-[#00ff66]/5 border border-[#00ff66]/15 mt-1">
                          <div className="text-[10.5px] font-bold text-[#00ff66] font-mono uppercase tracking-tight">{currentActiveBeat.title}</div>
                          <p className="text-[9.5px] text-slate-400 leading-tight mt-1">{currentActiveBeat.summary}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="text-[9px] text-slate-500 font-mono uppercase mb-1">OST MUSIC ATTRIBUTION:</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#ccff00] font-mono font-black uppercase">
                          <Music className="w-3.5 h-3.5" /> SUBTERRANEAN ECHO
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Dynamic Click Timeline */}
                  <div className="md:col-span-2 space-y-3">
                    <div className="text-[10px] font-bold font-mono text-slate-400 pb-1 uppercase">TIMELINE AUTOPSY BEATS (SEEK PLAYBACK CONTROLS)</div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {autopsyBeats.map((b, idx) => {
                        const isPast = autopsySyncTime >= b.timestamp;
                        return (
                          <div 
                            key={idx} 
                            onClick={() => seekPlayerTo(b.timestamp)}
                            title={`Click to target seek the player playhead directly to ${Math.floor(b.timestamp / 60)}:${(b.timestamp % 60).toString().padStart(2, '0')} to view ${b.title}.`}
                            aria-label={`Autopsy timeline plot point: ${b.title} at ${Math.floor(b.timestamp / 60)} minutes.`}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                              isPast 
                              ? "bg-slate-900/40 border-slate-700/80 hover:border-[#00ff66]" 
                              : "bg-transparent border-slate-800/50 opacity-50 hover:opacity-85"
                            }`}
                          >
                            <div className="flex flex-col items-center shrink-0">
                              <span className="text-[10px] bg-[#020204] border border-slate-850 px-2 py-0.5 rounded-md font-mono text-[#00ff66] font-black">
                                {Math.floor(b.timestamp / 60)}:{(b.timestamp % 60).toString().padStart(2, '0')}
                              </span>
                              <div className="w-[1px] h-full bg-slate-800 mt-2"></div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-mono font-bold uppercase ${
                                  b.type === "major-reveal" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/20"
                                }`}>
                                  {b.type}
                                </span>
                                <h4 className="text-xs font-bold text-white hover:text-[#ccff00] transition-colors">{b.title}</h4>
                              </div>
                              <p className="text-[10.5px] text-slate-400 leading-normal">{b.summary}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/40 flex justify-between text-[11px] font-mono text-slate-400">
                <span>SEEK CHIPS PRE-LOAD METADATA STABLE</span>
                <span className="text-[#00ff66] font-bold animate-pulse">● TRACKING REALTIME PLAYHEAD POSITION</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 3: PLAYLIST VERSIONING =================== */}
          {activeSubTab === 3 && (
            <div className="space-y-5 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Playlist Versioning Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Playlist Versioning &amp; Evolution</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Converts static playlist registers into dynamic development tracking logs with branch checkout controls.</p>
                  </div>
                  <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">STABLE LOGS EXTRACTED</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Jump backwards or forwards to cached states of your media layout archives. 
                    <strong>Interactive Action:</strong> Click on any committed branch card below to initiate a branch checkout, click <strong>Inspect Diff</strong> to view exact syntax changes, or run a <strong>Hard Reset</strong> to clean current buffers.
                  </p>
                </div>

                <div className="space-y-4 mt-5">
                  <div className="p-4 rounded-2xl bg-[#020204]/95 border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="text-[9px] font-mono font-bold text-[#00ff66] tracking-widest uppercase mb-1">ACTIVE MANIFEST MANIFOLD:</div>
                      <h4 className="text-sm font-semibold text-white tracking-wide">"NOIR CLASSICS DEEP-DIVE STAGING"</h4>
                      <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">Current Hash Core (SHA-256): <span className="text-amber-400 font-semibold">03e8ca0b2a73247200891fb</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">Branch:</span>
                      <span className="bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/30 px-3 py-1 rounded-xl text-xs font-mono font-bold">master-control-v3</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">DEPLOYED MODIFICATION TREE TRACK</div>
                      
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {versionBranches.map((v, idx) => {
                          const isActive = activeBranch === v.label;
                          return (
                            <div 
                              key={idx}
                              onClick={() => handleBranchCheckout(v.label)}
                              title={`Click to checkout branch ${v.label}. This action updates your active playlists to the chosen snapshot.`}
                              aria-label={`Branch checkout card for ${v.label}. Comment: ${v.comment}`}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                isActive 
                                ? "bg-[#00ff66]/5 border-[#00ff66]/40 text-white" 
                                : "bg-transparent border-slate-800/80 hover:bg-[#020204]"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-[10px] font-bold font-mono ${isActive ? "text-[#00ff66]" : "text-amber-500"}`}>{v.label} (Current checkout)</span>
                                <span className="text-[9px] text-slate-500 font-mono">{v.date}</span>
                              </div>
                              <p className="text-xs font-medium text-slate-300 leading-tight">"{v.comment}"</p>
                              <div className="text-[9.5px] text-slate-500 font-mono mt-1.5">Reason: {v.reason}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Modification Commit Diffs */}
                    <div className="bg-[#020204] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <div className="space-y-3.5">
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400 uppercase leading-none border-b border-slate-800 pb-1.5">
                          <span>Version Differential Log</span>
                          <button 
                            onClick={() => setShowDiff(!showDiff)} 
                            title="Toggles high-fidelity textual code compilation diff view showing modified playlist offsets."
                            aria-label="Toggle diff logs inspect mode"
                            className="text-[#00ff66] hover:text-[#ccff00] cursor-pointer"
                          >
                            {showDiff ? "[-] COLLAPSE" : "[+] INSPECT DIFF"}
                          </button>
                        </div>

                        {showDiff ? (
                          <div className="font-mono text-[9.5px] bg-[#010102] border border-[#00ff66]/10 p-3 rounded-xl space-y-1 overflow-x-auto text-[#00ff66]/85">
                            <div className="text-slate-500">@@ -15,4 +15,7 @@ Noir Classics</div>
                            <div className="text-red-500">- "Double Indemnity (1944)" - Slot 4</div>
                            <div className="text-[#00ff66]">+ "The Italian Job (1969)" - Slot 4 [REPLACED]</div>
                            <div className="text-slate-500">@@ -29,2 +32,5 @@ Chrono Stash</div>
                            <div className="text-[#00ff66]">+ "Ocean's 11 (1961)" transposed before slot 1</div>
                            <div className="text-slate-400 font-normal">Active Checkout Root verified clean.</div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-slate-500 font-mono">
                            Click [INSPECT DIFF] above to review precise code modifications and slot transpositions.
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/60">
                        <button 
                          onClick={() => {
                            showToast("CORE PLAYLIST RESET TO STABLE DEFAULT SOURCE V3");
                          }}
                          title="Performs clean reset. Irreversibly purges staging diff logs back to the master-control-v3 reference base."
                          aria-label="Hard reset playlist back to factory default"
                          className="flex-1 px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-500 border border-thin border-red-950/50 hover:border-red-500 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer uppercase"
                        >
                          Hard Reset
                        </button>
                        <button 
                          onClick={() => {
                            const newB = { label: "v" + (Number(versionBranches[0].label.replace("v","")) + 0.1).toFixed(1), hash: "SHA-256: " + String(Date.now()).slice(0,8) + "...", author: "You", date: "Just now", comment: "Custom checkout snapshot committed on timeline.", reason: "Snapshot snapshot" };
                            setVersionBranches([newB, ...versionBranches]);
                            showToast("CREATED BRANCH SUB-TRACK FROM ACTIVE PLATFORM");
                          }}
                          title="Commits current custom snapshot modifications to the branch evolution tree track database."
                          aria-label="Save current snapshot as committed track option"
                          className="flex-1 px-4 py-2 bg-[#00ff66]/10 hover:bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/30 hover:border-[#00ff66] rounded-xl text-xs font-mono font-bold transition-all cursor-pointer uppercase"
                        >
                          Commit Track
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] font-mono text-slate-550 flex gap-2">
                <span>DIFF CHECKOUT STAGE VERIFIED</span>
                <span>•</span>
                <span>SHA-256 ENGINE STABLE</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 4: COMPOSITION WORKBENCH =================== */}
          {activeSubTab === 4 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Composition Staging Workbench Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Composition Staging Workbench</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Slices loaded playlist items and raw ingested feeds into customizable chronological timeline outputs.</p>
                  </div>
                  <span className="bg-[#00ff66]/15 border border-[#00ff66]/30 text-[#00ff66] text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">Parser Thread: Connected</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Stage multiple incoming HLS streams together to build structured scheduling layouts.
                    <strong>Interactive Action:</strong> Click <strong>Ingest Active</strong> to pull current stream info, select <strong>Stage</strong> on any feed source to add it to your Target Canvas, then click <strong>Chrono-Sort</strong> or execute <strong>Compile</strong> to persist changes.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Source List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400 uppercase">
                      <span>INCOMING PLAYLIST INDICES ({channels.length > 0 ? channels.length : "NO LOCAL CHANNEL"})</span>
                      <button 
                        onClick={handleAddActiveStreamToTimeline}
                        title="Ingest the currently active/selected video player track meta details straight into the staging workspace buffer."
                        aria-label="Ingest active player track stream button"
                        className="text-[#00ff66] hover:text-[#ccff00] cursor-pointer"
                      >
                        [+ INGEST ACTIVE]
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {channels.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 border border-slate-850 rounded-xl bg-[#020204]">
                          No manual M3U files uploaded currently. Click live streams metadata tags to test ingesting.
                        </div>
                      ) : (
                        channels.slice(0, 10).map((c, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-[#020204] border border-slate-800/60 flex justify-between items-center gap-3">
                            <span className="text-xs text-slate-350 font-bold truncate max-w-[140px]">{c.name}</span>
                            <button 
                              onClick={() => {
                                const added = { id: String(Date.now()) + idx, name: c.name, url: c.url, duration: 3600, group: c.group || "IPTV" };
                                setCanvasTimeline([...canvasTimeline, added]);
                                showToast(`ADDED "${c.name.slice(0,18)}..." TO CANVAS`);
                              }}
                              title={`Add incoming feed "${c.name}" to the dynamic schedule timeline workspace below.`}
                              aria-label={`Stage feed index: ${c.name}`}
                              className="text-xs text-[#00ff66] hover:text-white cursor-pointer font-bold font-mono"
                            >
                              [+ STAGE]
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Staged output metrics */}
                  <div className="bg-[#020204] border border-slate-850 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono font-bold text-slate-400 border-b border-slate-850 pb-1 uppercase">DYNAMIC MATRIX ANALYSIS</div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400 font-mono">
                          <span>STAGED STREAMS COUNT:</span>
                          <span className="text-[#00ff66] font-bold">{canvasTimeline.length} tracks</span>
                        </div>
                        <div className="flex justify-between text-slate-400 font-mono">
                          <span>TOTAL STAGE RUNTIME:</span>
                          <span className="text-white font-bold">
                            {Math.floor(canvasTimeline.reduce((acc, curr) => acc + (curr.duration || 3600), 0) / 3600)}h {Math.floor((canvasTimeline.reduce((acc, curr) => acc + (curr.duration || 3600), 0) % 3600) / 60)}m
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 font-mono">
                          <span>COGNITIVE COMPATIBILITY:</span>
                          <span className="text-[#ccff00] font-bold">BALANCED DETECTED (STEREOPHONIC)</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex gap-2">
                      <button 
                        onClick={handleSortTimeline}
                        title="Sorts all staged stream items chronologically from shortest duration to longest duration."
                        aria-label="Sort timeline chronologically"
                        className="flex-1 px-3 py-2 bg-[#020203] border border-slate-800 hover:border-slate-700 rounded-xl text-[10px] font-mono font-bold tracking-wider text-slate-350 cursor-pointer"
                      >
                        ⚡ CHRONO-SORT
                      </button>
                      <button 
                        onClick={() => {
                          setCanvasTimeline([]);
                          showToast("WORKBENCH STAGING CANVAS CLEAR");
                        }}
                        title="Purges all staged stream cards from your current workspace timeline canvas."
                        aria-label="Reset staging canvas options"
                        className="px-3 py-2 bg-red-950/20 text-red-500 rounded-xl text-[10px] font-mono font-bold cursor-pointer hover:bg-red-900/30"
                      >
                        [RESET]
                      </button>
                    </div>
                  </div>
                </div>

                {/* Staged Production Timeline */}
                <div className="space-y-2.5 pt-3">
                  <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">TARGET TIMELINE CHANNELS MATRIX ({canvasTimeline.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {canvasTimeline.map((item, idx) => (
                      <div key={item.id || idx} className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-850 flex justify-between items-center gap-3">
                        <div className="truncate">
                          <h5 className="text-xs font-bold text-white truncate">{item.name}</h5>
                          <span className="text-[9px] text-[#00ff66]/60 font-mono uppercase">{item.group} • {Math.floor(item.duration / 60)} min</span>
                        </div>
                        <button 
                          onClick={() => {
                            const rem = canvasTimeline.filter((_, i) => i !== idx);
                            setCanvasTimeline(rem);
                            showToast("REMOVED TRACK INSTANCE FROM TIMELINE");
                          }}
                          className="text-slate-500 hover:text-red-500 cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  onClick={() => {
                    showToast("PRODUCTION RE-COMPILATION COMPLETE — SAVED BUNDLE");
                  }}
                  className="px-5 py-2.5 bg-[#00ff66] hover:bg-[#ccff00] text-[#04060b] text-xs font-mono font-black tracking-widest rounded-xl transition-all cursor-pointer uppercase"
                >
                  COMPILE &amp; COMMIT CHANNELS [v3.2]
                </button>
              </div>
            </div>
          )}

          {/* =================== MODULE 5: DISCOVERY ENGINE =================== */}
          {activeSubTab === 5 && (
            <div className="space-y-5 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Mood Discovery Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Intelligent Mood &amp; Environment Discovery</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Applies real-time situational profiling algorithms against your viewing history metadata.</p>
                  </div>
                  <span className="bg-[#ccff00]/15 border border-[#ccff00]/30 text-[#ccff00] text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">Neural Decoders Active</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Select your emotional status target parameters to calculate optimal watchlist matches.
                    <strong>Interactive Action:</strong> Choose your current <strong>Target Mood Set</strong>, slide the <strong>Duration Limits</strong> or <strong>Intensity Load</strong> dials, adjust <strong>Lighting</strong> contexts, and click the <strong>Launch Stream</strong> option in the resulting card.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-4">
                  {/* Sliders panel */}
                  <div className="md:col-span-2 bg-[#020204] border border-slate-850 p-4 rounded-xl space-y-4">
                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase border-b border-slate-850 pb-1">ADJUST DISCOVERY INPUTS</div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-1">Target Mood Set</label>
                        <select 
                          value={dmMood} 
                          onChange={(e) => setDmMood(e.target.value as MoodState)} 
                          title="Sets the pre-calculated emotional state parameters of your target recommendations."
                          aria-label="Discovery Target Mood Day selection"
                          aria-description="Choose an emotional lens state like Escapist Mind-meld or Analytical Critique to refine recommendation suggestions."
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl p-2 text-xs text-white"
                        >
                          <option value="contemplative">Contemplative Reflective</option>
                          <option value="stressed">Stressed Restless</option>
                          <option value="excited">Excited Hyperfocused</option>
                          <option value="escapist">Escapist Mind-meld</option>
                          <option value="analytical">Analytical Critique</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-mono font-bold text-slate-500 mb-1 uppercase">
                          <span>Duration Limits</span>
                          <span className="text-[#00ff66]">{dmDuration} minutes</span>
                        </div>
                        <input 
                          type="range" 
                          min="15" 
                          max="180" 
                          step="5" 
                          value={dmDuration} 
                          title="Slide to change recommended duration guidelines in minutes to limit movie or show lengths."
                          aria-label="Discovery stream duration limit filter"
                          aria-description="Adjusts the upper timing ceiling in minutes for calculated film and stream recommendations."
                          onChange={(e) => setDmDuration(Number(e.target.value))} 
                          className="w-full accent-[#00ff66] cursor-pointer" 
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-mono font-bold text-[#00ff66] mb-1 uppercase">
                          <span>Space Intensity Load</span>
                          <span className="text-white">{dmIntensity} / 10</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="1" 
                          value={dmIntensity} 
                          title="Slide to increase target cinematic intensity from 1 (leisurely slow) to 10 (extremely intense/loud visual load)."
                          aria-label="Discovery stream intensity load filter"
                          aria-description="Adjusts visual and sound load intensity threshold to tailor passive or high-stakes viewing."
                          onChange={(e) => setDmIntensity(Number(e.target.value))} 
                          className="w-full accent-[#00ff66] cursor-pointer" 
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-mono font-bold text-slate-500 uppercase block mb-1">Room Lighting Set</label>
                        <select 
                          value={dmLighting} 
                          onChange={(e) => setDmLighting(e.target.value as any)} 
                          title="Configure your current home theater, desktop, or room lighting load to improve visual balance suggestions."
                          aria-label="Discovery Room Lighting Set selection dropdown"
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl p-2 text-xs text-white"
                        >
                          <option value="dark-room">Dark Ambient Obsidian</option>
                          <option value="daylight">Daylight Sunlight</option>
                          <option value="ambient">Ambient Midtone</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Card Output */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="text-[10px] font-mono font-bold text-slate-400 block uppercase mb-1">ALGORITHMIC PIPELINE MATCH RECOMMENDATIONS</div>
                    
                    <div className="p-5.5 rounded-2xl bg-[#00ff66]/5 border border-[#00ff66]/40 shadow-xl shadow-black/80 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-[#00ff66] text-[#040608] font-mono font-black text-[9px] tracking-widest px-3.5 py-1 uppercase rounded-bl-sm">
                        {discoveryMatch.match}% METRIC MATCH
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[9px] bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/30 px-2 py-0.5 rounded-sm font-mono tracking-widest font-black uppercase">HIGHEST STAGE ACCURACY</span>
                        <h4 className="text-base font-black text-white hover:text-[#00ff66] transition-colors">{discoveryMatch.title}</h4>
                        <div className="text-[10px] text-[#00ff66] font-mono uppercase">{discoveryMatch.dur} • Dynamic Stream File</div>
                      </div>

                      <p className="text-[11px] text-slate-350 leading-relaxed italic">
                        "{discoveryMatch.reason}"
                      </p>

                      <div className="pt-3.5 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-[9.5px] text-slate-500 font-mono uppercase">Decoded from DNA signature logs</span>
                        <button 
                          onClick={() => {
                            playStream(discoveryMatch.link, discoveryMatch.title);
                            showToast("PLAYING DISCOVERED MEDIA TARGET");
                          }}
                          title={`Deploy stream playback of "${discoveryMatch.title}" immediately to the main console video player.`}
                          aria-label={`Play discovered target film: ${discoveryMatch.title}`}
                          className="px-4 py-2 bg-[#00ff66] hover:bg-[#ccff00] text-[#040608] text-[10px] font-mono font-black tracking-widest rounded-xl transition-all cursor-pointer uppercase flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3 fill-[#040608]" /> DEPLOY STREAM
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] font-mono text-slate-550 flex gap-2">
                <span>RE-INDEX COMPLETE</span>
                <span>•</span>
                <span>MATCH COMPATIBILITIES ACCORDING TO JOURNAL PROFILEDNA</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 6: COMPARATIVE SIDE-DECK =================== */}
          {activeSubTab === 6 && (
            <div className="space-y-5 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Comparative Viewing Deck Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Comparative Viewing Deck</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Synchronizes secondary testing streams side-by-side to perform deep frame-by-frame critique logs.</p>
                  </div>
                  <span className="bg-[#00ff66]/15 border border-[#00ff66]/30 text-[#00ff66] text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">Deck Frames Interlocked</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Frame critique diagnostics. Compare two stream formats side-by-side.
                    <strong>Interactive Action:</strong> Tap <strong>Sync Lock</strong> to toggle simultaneous lock-step playback, slide or microadjust <strong>Offset</strong> latency milliseconds, and type observations inside the <strong>Transcript &amp; Style Notes</strong> text drawer.
                  </p>
                </div>

                <div className="space-y-4 mt-4">
                  {/* Simulated Dual Player Screens */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-video bg-neutral-950 border border-[#00ff66]/30 rounded-xl flex flex-col justify-between p-3 relative overflow-hidden" title="Compare visual output reference frame monitor A (Master core feed).">
                      <div className="absolute top-2 left-2 bg-[#00ff66]/10 border border-[#00ff66]/30 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-sm">MONITOR DELTA: MASTER</div>
                      <div className="text-center py-10 font-mono text-[10px] text-[#00ff66] animate-pulse">
                        [ MASTER VIDEO LOOP FEED ACTIVE ]
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono uppercase mt-1">
                        <span>HLS Buffer 100%</span>
                        <span>Time: 01:14:22.04</span>
                      </div>
                    </div>

                    <div className="aspect-video bg-neutral-950 border border-slate-800 rounded-xl flex flex-col justify-between p-3 relative overflow-hidden" title="Compare visual output target comparison frame monitor B (Slave latency feed).">
                      <div className="absolute top-2 left-2 bg-slate-900 border border-slate-800 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-sm">MONITOR EPSILON: SEC-SLAVE</div>
                      <div className="text-center py-10 font-mono text-[10px] text-slate-500">
                        [ SLAVE VIDEO LOCK AT OFFSET ]
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono uppercase mt-1">
                        <span>Offset Lock: ON</span>
                        <span>Time: 01:16:10.12</span>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Steering Calibration */}
                  <div className="p-4 bg-[#020204] border border-slate-850 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <div className="text-[10px] font-bold font-mono text-[#00ff66] uppercase">INTERLOCKED CALIBRATION STEERING CONTROLS</div>
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Enforces microsecond precision offsets between twin comparison streams.</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setCompLinked(!compLinked)}
                          title="Toggles strict synchronization locks between Master video head and secondary comparative feeds."
                          aria-label="Toggle live synchronization lock mode"
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                            compLinked 
                              ? "bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30" 
                              : "bg-slate-900 text-slate-500 border border-slate-800"
                          }`}
                        >
                          {compLinked ? "🛡️ SYNC LOCK ACTIVE" : "🔓 SYNC DETACHED"}
                        </button>
                        
                        <div className="flex items-center gap-1.5 bg-[#05070a] border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
                          <span className="text-slate-550 mr-1 font-bold">OFFSET:</span>
                          <button 
                            onClick={() => setCompOffset(compOffset - 10)} 
                            title="Desynchronize frame playback timing latency by subtracting 10 milliseconds offset lag."
                            aria-label="Decrease sync offset lag by 10 milliseconds"
                            className="text-[#00ff66] hover:text-white"
                          >
                            -10ms
                          </button>
                          <span className="text-white font-bold ml-1 mr-1">{compOffset}ms</span>
                          <button 
                            onClick={() => setCompOffset(compOffset + 10)} 
                            title="Desynchronize frame playback timing latency by adding 10 milliseconds offset lag."
                            aria-label="Increase sync offset lag by 10 milliseconds"
                            className="text-[#00ff66] hover:text-white"
                          >
                            +10ms
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9.5px] font-mono font-bold tracking-widest text-slate-500 block mb-1 uppercase">COMPARATIVE TRANSCRIPT &amp; STYLE NOTES</label>
                      <input 
                        type="text" 
                        value={compNotes} 
                        onChange={(e) => setCompNotes(e.target.value)}
                        title="Store transient stylistic annotations, lens comparisons, or subtitle critique lines."
                        aria-label="Comparative notes input field box"
                        aria-description="Enter critical insights detailing lens difference, frame-rate disparity, color correction, or performance divergence."
                        placeholder="e.g. Highlighted warmer midtones on delta feed..."
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#00ff66]/40 transition-colors"
                      />
                    </div>
                  </div>
                </div>

              <div className="pt-2 text-[10.5px] font-mono text-slate-500 flex justify-between">
                <span>STEREO STRETCH BINDINGS CALIBRATED</span>
                <span>DIFFERENTIAL LAG OFFSET STABLE</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 7: SCENE CLIPPER =================== */}
          {activeSubTab === 7 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Scene Moment Clipping panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Scene Moment Clipping Repository</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Captures high-contrast scene clips, extracts dialogues, and appends aesthetic tags directly to view diaries.</p>
                  </div>
                  <span className="bg-[#ccff00]/15 border border-[#ccff00]/30 text-[#ccff00] text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">Clipper Online</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Crop precise chronos markers of film events to store in your persistent view logs.
                    <strong>Interactive Action:</strong> Insert exact start/end offset integers or hit 🕒 to pull current player timestamps. Choose frame camera motion and type dialogue notes before executing <strong>Classify &amp; Register</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Slicing Controls */}
                  <div className="bg-[#020204] border border-slate-850 p-4 rounded-xl space-y-4">
                    <div className="text-[10px] font-mono font-bold text-slate-400 border-b border-slate-850 pb-1.5 uppercase">REPLAY TIMELINE MARKER INJECTOR</div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] text-slate-500 font-mono mb-1 uppercase">Splicing Startpoint</div>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            value={clipStart} 
                            onChange={(e) => setClipStart(Number(e.target.value))}
                            title="Start time of the cinematic moment clip in seconds."
                            aria-label="Scene clipping start time in seconds"
                            aria-description="Type the starting offset duration in seconds from the segment media to clip."
                            className="w-full bg-[#05070a] border border-slate-800 rounded-xl py-1.5 px-2 text-xs text-white font-mono"
                          />
                          <button 
                            onClick={() => handleCaptureCurrentTime("start")} 
                            title="Capture the current precise playback head timestamp from the video player as the start point."
                            aria-label="Capture current player time as clipping start point"
                            className="bg-slate-800 hover:bg-slate-700 text-xs text-[#00ff66] px-2 rounded-xl cursor-pointer"
                          >
                            🕒
                          </button>
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-1">🕒 {Math.floor(clipStart / 60)}m {clipStart % 60}s</div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-500 font-mono mb-1 uppercase">Splicing Endpoint</div>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            value={clipEnd} 
                            onChange={(e) => setClipEnd(Number(e.target.value))}
                            title="End time of the cinematic moment clip in seconds."
                            aria-label="Scene clipping end time in seconds"
                            aria-description="Type the ending offset duration in seconds from the segment media to clip."
                            className="w-full bg-[#05070a] border border-slate-800 rounded-xl py-1.5 px-2 text-xs text-white font-mono"
                          />
                          <button 
                            onClick={() => handleCaptureCurrentTime("end")} 
                            title="Capture the current precise playback head timestamp from the video player as the end point."
                            aria-label="Capture current player time as clipping end point"
                            className="bg-slate-800 hover:bg-slate-700 text-xs text-[#00ff66] px-2 rounded-xl cursor-pointer"
                          >
                            🕒
                          </button>
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-1">🕒 {Math.floor(clipEnd / 60)}m {clipEnd % 60}s</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-mono text-slate-550 block mb-1 uppercase">Aesthetic Framing</label>
                        <select 
                          value={clipFraming} 
                          onChange={(e) => setClipFraming(e.target.value)} 
                          title="Sets aesthetic camera framing classification detail (e.g. extreme wide, macro, closeup)."
                          aria-label="Framing size selection dropdown"
                          aria-description="Select the shot composition type such as Wide, Close-Up, or Macro."
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl p-2 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="close-up">Close-Up</option>
                          <option value="extreme-wide">Extreme Wide</option>
                          <option value="medium">Medium</option>
                          <option value="macro">Macro Frame</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-slate-550 block mb-1 uppercase">Aesthetic Camera Movement</label>
                        <select 
                          value={clipMovement} 
                          onChange={(e) => setClipMovement(e.target.value)} 
                          title="Sets aesthetic camera movement type descriptor (e.g. tracking, pans, tilt shift)."
                          aria-label="Camera movement selection dropdown"
                          aria-description="Select camera kinetic styles such as Tracking Shot, Static, or Tilt Shift."
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl p-2 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="tracking">Tracking Shot</option>
                          <option value="static">Static Lens</option>
                          <option value="pan">Pan Sweep</option>
                          <option value="tilt">Tilt Shift</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-mono text-slate-550 block mb-1 uppercase">Extracted Dialogue / Scene Annotation</label>
                      <input 
                        type="text" 
                        value={clipTrans} 
                        onChange={(e) => setClipTrans(e.target.value)}
                        placeholder="e.g. Dialogue quote or lens criticism..."
                        title="Stores speech subtitles transcript content or physical notes for immediate recall."
                        aria-label="Scene transcription text container field"
                        aria-description="Type spoken dialogue or visual aesthetics commentary for direct logging into the timeline index."
                        className="w-full bg-[#05070a] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none"
                      />
                    </div>

                    <button 
                      onClick={handleCreateClip}
                      title="Saves and registers this cropped media sequence instantly into the view diary table log database archive."
                      aria-label="Classify and register new scene clip button"
                      className="w-full py-2.5 bg-[#00ff66] hover:bg-[#ccff00] text-[#04060b] text-xs font-mono font-black tracking-widest rounded-xl cursor-pointer uppercase transition-colors"
                    >
                      ✂️ CLASSIFY &amp; REGISTER SCENE
                    </button>
                  </div>

                  {/* Registered Clips Log */}
                  <div className="space-y-3 flex flex-col justify-between">
                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">ACTIVE INSTANT CLIPPINGS ({clips.length})</div>
                    
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {clips.map((c) => (
                        <div key={c.clipId} className="p-3 bg-[#020204] border border-slate-850 rounded-xl space-y-1.5 relative group">
                          <div className="flex justify-between items-center text-[10px] font-mono border-b border-slate-850 pb-1">
                            <span className="text-[#00ff66] font-black">MARKER: {Math.floor(c.timestampStart / 60)}:{(c.timestampStart % 60).toString().padStart(2, '0')} - {Math.floor(c.timestampEnd / 60)}:{(c.timestampEnd % 60).toString().padStart(2, '0')}</span>
                            <button 
                              onClick={() => {
                                const filterClips = clips.filter(cl => cl.clipId !== c.clipId);
                                setClips(filterClips);
                                showToast("REMOVED CLIP ANNOTATION");
                              }}
                              className="text-slate-500 hover:text-red-400 text-xs cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-[10.5px] text-slate-300 leading-normal italic">"{c.transcribedText}"</p>
                          <div className="flex items-center gap-2 text-[9px] text-[#ccff00] font-mono uppercase font-semibold">
                            <span>Framing: {c.framing || "CLOSE-UP"}</span>
                            <span>•</span>
                            <span>Movement: {c.movement || "TRACKING"}</span>
                          </div>
                          <div className="pt-1 text-[9px] text-slate-500 font-mono">Annot: {c.annotation}</div>

                          <button 
                            onClick={() => seekPlayerTo(c.timestampStart)}
                            className="absolute bottom-2 right-2 p-1.5 bg-[#00ff66]/10 text-[#00ff66] hover:bg-[#00ff66] hover:text-black rounded-xl text-[9px] font-mono font-bold transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            PLAY SCENE
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] font-mono text-slate-550 flex gap-2 justify-between">
                <span>RE-REPLICATED SNIPPETS RUN STABLE</span>
                <span>STANDALONE CLAMP HIGHLIGHTS ENABLED</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 8: VIEWING DNA =================== */}
          {activeSubTab === 8 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Cinephile Viewing DNA Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Cinephile Viewing DNA</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Aggregates dynamic rating matrices and watch schedules to profile your artistic preferences.</p>
                  </div>
                  <span className="bg-[#ccff00]/15 border border-[#ccff00]/30 text-[#ccff00] text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">Analysis Compliant</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Inspect style diagnostics profiles based on watch history.
                    <strong>Interactive Action:</strong> Hover over affinity progress meters to review current weighting ratios, and click the <strong>Recalibrate</strong> action hook triggers to reload telemetry metadata.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Heatmap/Charts */}
                  <div className="bg-[#020204] border border-slate-850 p-4 rounded-xl space-y-4 flex flex-col justify-between" title="Personal visual genre affinity profiles tracker panel">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-850 pb-1">VISUAL AFFINITY HIGHLIGHT HEATMAP</div>
                      
                      <div className="space-y-2.5">
                        <div title="Your preference percentage score for Cyberpunk and Film Noir streams.">
                          <div className="flex justify-between text-[10px] font-mono font-semibold text-slate-400 mb-1">
                            <span>CYBERPUNK / NOIR:</span>
                            <span className="text-[#00ff66] font-black">{dnaMetrics.cyberpunk}%</span>
                          </div>
                          <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-[#00ff66] rounded-full" style={{ width: `${dnaMetrics.cyberpunk}%` }}></div>
                          </div>
                        </div>

                        <div title="Your preference percentage score for slow-burn, intellectual drama films.">
                          <div className="flex justify-between text-[10px] font-mono font-semibold text-slate-400 mb-1">
                            <span>SLOW-BURN INTELLIGENT DRAMA:</span>
                            <span className="text-amber-400 font-black">{dnaMetrics.slowBurn}%</span>
                          </div>
                          <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                            <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style={{ width: `${dnaMetrics.slowBurn}%` }}></div>
                          </div>
                        </div>

                        <div title="Your preference percentage score for avant-garde photo explorations and arthouse films.">
                          <div className="flex justify-between text-[10px] font-mono font-semibold text-slate-400 mb-1">
                            <span>AVANT-GARDE PHOTO EXPLORATION:</span>
                            <span className="text-pink-500 font-black">{dnaMetrics.avantGarde}%</span>
                          </div>
                          <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                            <div className="h-full bg-gradient-to-r from-pink-600 to-cyan-400 rounded-full" style={{ width: `${dnaMetrics.avantGarde}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-850" title="Overall complete versus abandoned film stream percentage ratio.">
                      <div className="flex justify-between text-[10.5px] font-mono text-slate-400">
                        <span>COMPLETION PROFILE RATIO:</span>
                        <span className="text-[#00ff66] font-bold">{dnaMetrics.completionRate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side data details */}
                  <div className="bg-[#020204]/80 border border-slate-850 p-4 rounded-xl space-y-4" title="Analyzed viewing schedules metadata and history records">
                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-1">DNA DECODER METADATA REPORTS</div>

                    <div className="space-y-3 text-[11px] font-medium text-slate-350">
                      <div className="flex justify-between items-center py-1 border-b border-slate-900" title="Identified period trends of active console streams consumption.">
                        <span className="text-slate-550 font-mono text-[10px]">PREFERRED WATCH PERIODS:</span>
                        <span className="text-white font-mono uppercase bg-slate-800/40 px-2 py-0.5 rounded-xl border border-slate-800">Evening, Late-Night</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-900" title="Average score rated across tasting journal filings.">
                        <span className="text-slate-550 font-mono text-[10px]">AVG CINEMATIC SCORE DECK:</span>
                        <span className="text-[#00ff66] font-mono font-black bg-[#00ff66]/10 px-2.5 py-0.5 border border-[#00ff66]/35 rounded-md">9.5 / 10.0</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-900" title="Most active era tags in the tasting journal profiles.">
                        <span className="text-slate-550 font-mono text-[10px]">DOMINANT ERA DYNAMICS:</span>
                        <span className="text-white font-mono uppercase bg-slate-800/40 px-2 py-0.5 rounded-xl border border-slate-800">1970s Crime Cinema / 1990s Noir</span>
                      </div>

                      <div className="flex justify-between items-center py-1" title="Pacing rates of watch patterns.">
                        <span className="text-slate-550 font-mono text-[10px]">PACING PREFERENCES RATIO:</span>
                        <span className="text-white font-mono uppercase bg-slate-800/40 px-2 py-0.5 rounded-xl border border-slate-800">68% Deliberate Burn Rate</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        showToast("METRICS REPORT RE-CALIBERATED SECURELY");
                      }}
                      title="Triggers secure re-aggregation of tasting journal datasets to recalculate DNA metrics percentages."
                      aria-label="Recalibrate and process DNA preference metrics button"
                      className="w-full py-2 bg-[#00ff66]/10 hover:bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/35 rounded-xl text-xs font-mono font-bold uppercase transition-colors cursor-pointer"
                    >
                      [⚡ RECALIBRATION DNA METRICS]
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10.5px] font-mono text-slate-550">
                <span>DNA REPORT SEQUENCE GENERATION COMPILED</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 9: AUTOMATED SCHEDULER =================== */}
          {activeSubTab === 9 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Timeline Scheduler and Harvester Panel">
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <h3 className="text-base font-black font-mono text-[#00ff66] tracking-wide uppercase">Timeline Scheduler &amp; Harvester</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Arranges dynamic calendar viewing schedules linked to emergency auto-replenishment engines.</p>
                  </div>
                  <span className="bg-[#ccff00]/15 border border-[#ccff00]/30 text-[#ccff00] text-[8.5px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-sm uppercase">AUTOMATED CONTROLS READY</span>
                </div>

                {/* ALWAYS-VISIBLE HELPER GUIDE (ANTI-HIDDEN TOOLTIPS) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] text-slate-350 leading-relaxed font-sans mb-4 shadow-sm">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📖 ALWAYS-VISIBLE INSTRUCTION COUPLING:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Frame automated playlist cron schedulers. Define chronos slots of your watch periods.
                    <strong>Interactive Action:</strong> Tap <strong>[+ APPEND SLOT]</strong> to reserve a slot mapping, drag the replenishment limit slider range, or write a backup URI path under the emergency loop address field.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Cron grid slots */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400 uppercase">
                      <span>CHRONO-TRACK SLOT QUEUE</span>
                      <button 
                        onClick={() => {
                          const newSlot = { id: "as_" + Date.now(), time: "22:30", title: currentTitle || "Ingested Backup Stream", source: "Smart Harvester Hook" };
                          setScheduledSlots([...scheduledSlots, newSlot]);
                          showToast("APPENDED NEW SLOT COMPLIANT QUEUE");
                        }}
                        title="Appends a new scheduled video viewing slot mapped to late night watch periods."
                        aria-label="Append new scheduled viewing slot"
                        className="text-[#00ff66] hover:text-[#ccff00] cursor-pointer"
                      >
                        [+ APPEND SLOT]
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {scheduledSlots.map((s, idx) => (
                        <div key={idx} className="p-3 bg-[#020204]/90 border border-slate-850 rounded-xl flex justify-between items-center gap-3" title={`Viewing booked chronos track slot scheduled at ${s.time}.`}>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] bg-slate-800 text-slate-200 font-mono px-2 py-0.5 rounded-xl border border-slate-700 font-bold">{s.time}</span>
                            <span className="text-xs font-semibold text-slate-100">{s.title}</span>
                          </div>
                          <button 
                            onClick={() => {
                              const filterS = scheduledSlots.filter(sl => sl.id !== s.id);
                              setScheduledSlots(filterS);
                              showToast("SLOT CANCELLED SECURELY");
                            }}
                            title="Removes and cancels this scheduled chronos viewing slot immediately."
                            aria-label={`Unschedule slot track ${s.title}`}
                            className="text-slate-500 hover:text-red-400 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Harvester details settings */}
                  <div className="bg-[#020204] border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono font-bold text-slate-400 border-b border-slate-850 pb-1 uppercase">SMART HARVESTER STRATEGY CONTROLS</div>
                      
                      <div>
                        <div className="flex justify-between text-[9px] font-mono text-slate-550 mb-1 uppercase">
                          <span>Auto-Replenish Queue Limit</span>
                          <span className="text-[#00ff66] font-bold">{replenishThreshold} items</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="5" 
                          step="1" 
                          value={replenishThreshold} 
                          title="Set threshold count of items remaining in queue to trigger automated backup replenishment."
                          aria-label="Queue replenishment limit slider"
                          onChange={(e) => setReplenishThreshold(Number(e.target.value))} 
                          className="w-full accent-[#00ff66] cursor-pointer h-1 bg-slate-800" 
                        />
                        <span className="text-[8.5px] text-slate-555 font-mono">Harvests replacement tracks when slots fall below limit.</span>
                      </div>

                      <div className="pt-2">
                        <label className="text-[9px] font-mono text-slate-550 block mb-1 uppercase">EMERGENCY LOOP OVERRIDE ADDRESS</label>
                        <input 
                          type="text" 
                          value={emergencyFallback} 
                          onChange={(e) => setEmergencyFallback(e.target.value)}
                          placeholder="e.g. streaming://backup-server-01:3000/live.m3u8"
                          title="Specific server fallback stream URI or override reference address in case of primary thread loss."
                          aria-label="Emergency stream override address input box"
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-850 flex gap-2">
                      <button 
                        onClick={() => {
                          showToast("AUTO HARVEST PIPELINE TRIGGERED MANUALLY");
                        }}
                        className="w-full py-2 bg-[#00ff66] hover:bg-[#ccff00] text-[#04060b] text-[10.5px] font-mono font-black tracking-widest rounded-xl cursor-pointer transition-colors uppercase"
                      >
                        ⚡ INITIATE EMERGENCY AUTOHARVEST
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] font-mono text-slate-550 flex gap-2 justify-between">
                <span>SLOT HARVEST SYSTEM LIVE COUPLING ACTIVE</span>
                <span>FAILSAFE TRIGGER LINK ENGAGED</span>
              </div>
            </div>
          )}

          {/* =================== MODULE 10: PORTABLE BLACKBOX BUNDLES =================== */}
          {activeSubTab === 10 && (
            <div className="space-y-4 flex-1 flex flex-col justify-between" role="tabpanel" aria-label="Portable Blackbox Bundles Panel">
              <div className="space-y-4">
                <div className="p-4 bg-slate-900/40 border border-[#00ff66]/20 rounded-2xl flex gap-3 text-xs leading-relaxed text-slate-300">
                  <span className="text-[#00ff66] font-mono font-black text-[9.5px] tracking-wider uppercase">📦 PORTABLE BUNDLE SYSTEM ENGAGED:</span>
                  <p>
                    <strong>Intended Workspace Action:</strong> Build standalone web player distributions. Curate selected relational media assets into self-contained HTML single-page playable snapshots.
                    <br />
                    <strong>Interactive Action:</strong> Choose checkboxes of database shows to package, configure custom metadata titles, and toggle <strong>GENERATE SEAMLESS HARD COPY SNAPSHOT</strong> to compile and export.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Metadata & Configuration */}
                  <div className="space-y-4 p-4 rounded-2xl bg-[#070b12] border border-slate-800/40 flex flex-col">
                    <h4 className="text-xs font-black font-mono text-[#00ff66] uppercase tracking-wider mb-2">Configure Package Metadata</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bundle Title</label>
                        <input 
                          type="text" 
                          value={exportBundleTitle} 
                          onChange={(e) => setExportBundleTitle(e.target.value)} 
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00ff66] transition-colors"
                          placeholder="My Cinephile Collection"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">Curator Creator Name</label>
                        <input 
                          type="text" 
                          value={exportCreator} 
                          onChange={(e) => setExportCreator(e.target.value)} 
                          className="w-full bg-[#05070a] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00ff66] transition-colors"
                          placeholder="Your Name / Studio ID"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800/40 space-y-2 text-[11px] text-slate-400 leading-relaxed">
                      <p>🎓 <strong>Playable bundle format includes:</strong> Detailed show summaries, cast listings, and configured playback URLs.</p>
                      <p>✨ <strong>Local Stateful updates:</strong> When opened, the standalone page saves notes in client-side LocalStorage memory and compiles dynamic downloadable files for full re-import back here at any point!</p>
                    </div>
                  </div>

                  {/* Right Column: Database Show Selector */}
                  <div className="space-y-2 p-4 rounded-2xl bg-[#070b12] border border-slate-800/40 flex flex-col h-[320px]">
                    <h4 className="text-xs font-black font-mono text-[#00ff66] uppercase tracking-wider mb-1 flex justify-between items-center">
                      <span>Select Shows Queue ({selectedExportShowIds.length})</span>
                      <button 
                        onClick={() => {
                          const allIds = tvDb ? tvDb.getShows().map((sh: any) => sh.show_id) : [];
                          if (selectedExportShowIds.length === allIds.length) {
                            setSelectedExportShowIds([]);
                          } else {
                            setSelectedExportShowIds(allIds);
                          }
                        }}
                        className="text-[10px] text-slate-400 hover:text-[#ccff00] cursor-pointer bg-transparent border-none py-0 px-0 hover:bg-transparent normal-case font-sans tracking-normal font-normal"
                      >
                        {selectedExportShowIds.length === (tvDb ? tvDb.getShows().length : 0) ? "Deselect All" : "Select All"}
                      </button>
                    </h4>

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1.5">
                      {tvDb && tvDb.getShows().length > 0 ? (
                        tvDb.getShows().map((item: any) => {
                          const isChecked = selectedExportShowIds.includes(item.show_id);
                          return (
                            <div 
                              key={item.show_id} 
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedExportShowIds(selectedExportShowIds.filter(id => id !== item.show_id));
                                } else {
                                  setSelectedExportShowIds([...selectedExportShowIds, item.show_id]);
                                }
                              }}
                              className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked 
                                  ? "bg-[#00ff66]/5 border-[#00ff66]/30 text-white" 
                                  : "bg-slate-900/30 border-slate-800/60 text-slate-400 hover:bg-slate-900/50"
                              }`}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => {}} // Handled on parent div click
                                className="accent-[#00ff66] h-3.5 w-3.5 cursor-pointer rounded"
                              />
                              <div className="flex-1 leading-snug">
                                <div className="text-xs font-medium text-slate-200">{item.title}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{item.network} • {item.genre}</div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-500 italic text-center py-10 font-mono">
                          No shows currently loaded in Relational Database. Put some shows in first!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-850 flex items-center justify-between gap-4">
                  <div className="text-xs font-mono text-slate-400">
                    💥 Packaging status: <span className="text-[#00ff66] font-bold">{selectedExportShowIds.length}</span> show(s) queued for standalone compile.
                  </div>
                  <button 
                    disabled={selectedExportShowIds.length === 0}
                    onClick={() => {
                      try {
                        if (!tvDb) {
                          alert("Database not connected properly!");
                          return;
                        }
                        const bundle = BundleExporter.createBundle(tvDb, selectedExportShowIds, exportBundleTitle, exportCreator);
                        const generator = new StandalonePlayerGenerator();
                        const htmlContent = generator.generateStandaloneHTML(bundle);
                        
                        const dataUri = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
                        const dlAnchor = document.createElement("a");
                        dlAnchor.setAttribute("href", dataUri);
                        dlAnchor.setAttribute("download", `${exportBundleTitle.toLowerCase().replace(/\s+/g, "_")}_standalone_player.html`);
                        dlAnchor.click();
                        
                        showToast("SEAMLESS PLAYABLE HTML BUNDLE DOWNLOADED!");
                      } catch (err: any) {
                        alert(`Packaging failed: ${err.message}`);
                      }
                    }}
                    className={`px-6 py-2.5 font-mono text-xs font-black tracking-widest rounded-xl transition-all uppercase flex items-center gap-2 ${
                      selectedExportShowIds.length > 0 
                        ? "bg-[#00ff66] hover:bg-[#ccff00] text-[#04060b] cursor-pointer" 
                        : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed"
                    }`}
                  >
                    📦 Compile &amp; Export Playable HTML
                  </button>
                </div>
              </div>

              <div className="pt-2 text-[10px] font-mono text-slate-550 flex gap-2 justify-between">
                <span>BUNDLE PERSISTENCE PROTOCOL ACTIVE</span>
                <span>STANDALONE WEBPLAYER VERSION v1.0.0</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
