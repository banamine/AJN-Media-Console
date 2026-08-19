import React, { useCallback, useState, useRef } from "react";
import { 
  SkipBack, 
  Pause, 
  Play, 
  Square, 
  SkipForward, 
  Repeat, 
  VolumeX, 
  Volume2,
  Sliders,
  SlidersHorizontal,
  Settings,
  Upload,
  Link as LinkIcon,
  FileDown,
  Trash2,
  ListMusic,
  Shuffle,
  Compass,
  Folder,
  Share2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { SiriusTrack, RadioStation, AudioTrack } from "../types";
import { RadioStationIcon } from "./RadioStationIcon";
import { TrackList } from "./TrackList";
import { useAudioPlaylist } from "../hooks/useAudioPlaylist";
import { exportToPLS } from "../utils/playlistUtils";
import { usePlaybackSettings } from "../hooks/usePlaybackSettings";

export interface AudioDashboardProps {
  // Refs (passed as callbacks or handled separately, we can bind canvasRef or expose elements)
  tabCanvasRef: React.RefObject<HTMLCanvasElement | null>;

  // Track / Stream States
  siriusPlaylist: AudioTrack[];
  currentSiriusTrackIndex: number;
  activeRadioStation: RadioStation | null;
  isSiriusPlaying: boolean;
  siriusCurrentTime: number;
  siriusDuration: number;

  // Audio Control States
  siriusPreset: "neutral" | "heavy" | "vocal" | "metal";
  siriusLowBass: number;
  siriusBass: number;
  siriusVocalMid: number;
  siriusHighMid: number;
  siriusTreble: number;
  siriusPlaybackRate: number;
  siriusVisualizerMode: "eq" | "wave" | "fire" | "matrix";
  siriusAudioVolume: number;
  isSiriusMuted: boolean;
  isSiriusLooping: boolean;

  // State Setters
  setSiriusPreset: (preset: "neutral" | "heavy" | "vocal" | "metal") => void;
  setSiriusLowBass: (val: number) => void;
  setSiriusBass: (val: number) => void;
  setSiriusVocalMid: (val: number) => void;
  setSiriusHighMid: (val: number) => void;
  setSiriusTreble: (val: number) => void;
  setSiriusPlaybackRate: (rate: number) => void;
  setSiriusVisualizerMode: (mode: "eq" | "wave" | "fire" | "matrix") => void;
  setSiriusAudioVolume: (vol: number) => void;
  setIsSiriusMuted: (muted: boolean) => void;
  setIsSiriusLooping: (loop: boolean) => void;

  // Control Actions
  playSiriusTrack: (index: number) => void;
  playRadioStation: (stationId: string, name: string, url: string, icon: string) => void;
  startSiriusMusic: () => void;
  stopSiriusMusic: () => void;
  handleSiriusNext: () => void;
  handleSiriusPrev: () => void;
  handleSiriusSeek: (val: number) => void;
  setQueue: (tracks: AudioTrack[]) => void;

  // Custom logging
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
  infowarsFeed: string;
  setInfowarsFeed: (url: string) => void;

  // Bluetooth / Audio Output features
  audioDevices?: MediaDeviceInfo[];
  selectedSinkId?: string;
  setAudioOutputDevice?: (sinkId: string) => void;
}

const EQ_MIN = 0;
const EQ_MAX = 100;
const VOLUME_MIN = 0;
const VOLUME_MAX = 1;
const VOLUME_STEP = 0.05;
const RATE_MIN = 0.5;
const RATE_MAX = 2.0;
const RATE_STEP = 0.05;

export const AudioDashboard: React.FC<AudioDashboardProps> = React.memo(({
  tabCanvasRef,
  siriusPlaylist,
  currentSiriusTrackIndex,
  activeRadioStation,
  isSiriusPlaying,
  siriusCurrentTime,
  siriusDuration,
  siriusPreset,
  siriusLowBass,
  siriusBass,
  siriusVocalMid,
  siriusHighMid,
  siriusTreble,
  siriusPlaybackRate,
  siriusVisualizerMode,
  siriusAudioVolume,
  isSiriusMuted,
  isSiriusLooping,
  setSiriusPreset,
  setSiriusLowBass,
  setSiriusBass,
  setSiriusVocalMid,
  setSiriusHighMid,
  setSiriusTreble,
  setSiriusPlaybackRate,
  setSiriusVisualizerMode,
  setSiriusAudioVolume,
  setIsSiriusMuted,
  setIsSiriusLooping,
  playSiriusTrack,
  playRadioStation,
  startSiriusMusic,
  stopSiriusMusic,
  handleSiriusNext,
  handleSiriusPrev,
  handleSiriusSeek,
  setQueue,
  addLog,
  infowarsFeed,
  setInfowarsFeed,
  audioDevices = [],
  selectedSinkId = "",
  setAudioOutputDevice
}) => {

  const {
    audioPlaylists,
    currentPlaylistId,
    selectPlaylist,
    savePlaylist,
    deletePlaylist,
    getCurrentPlaylist,
    loadPLS,
    loadPLSFile,
    loadM3UAsAudio,
    enriching,
    enrichProgress,
    enrichPlaylistMetadata,
    plsImporting,
    plsImportProgress,
    plsImportStatus,
    updatePlaylistFolder,
  } = useAudioPlaylist();

  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const groupedPlaylists = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    audioPlaylists.forEach((pl) => {
      const folderName = pl.folder || "Uncategorized";
      if (!groups[folderName]) groups[folderName] = [];
      groups[folderName].push(pl);
    });
    return groups;
  }, [audioPlaylists]);

  // Deep-linking Shared Playlist Importer
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importPlParam = params.get("importPlaylist");
    if (importPlParam) {
      try {
        const json = decodeURIComponent(escape(atob(importPlParam)));
        const data = JSON.parse(json);
        if (data && data.n && Array.isArray(data.t)) {
          const tracks = data.t.map((item: any) => ({
            title: item[0],
            artist: item[1],
            url: item[2],
            length: item[3],
          }));
          const sharedPl = {
            id: "shared-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
            name: data.n + " (Shared)",
            tracks,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          savePlaylist(sharedPl);
          selectPlaylist(sharedPl.id);
          setQueue(sharedPl.tracks);
          addLog(`Imported shared playlist "${sharedPl.name}" with ${sharedPl.tracks.length} tracks!`, "info");
          
          // Clean URL query parameters
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      } catch (err) {
        console.error("Failed to import shared playlist:", err);
        addLog("Failed to import shared playlist: Invalid or corrupted data.", "error");
      }
    }
  }, []);

  const handleSharePlaylist = (pl: any) => {
    try {
      const compactTracks = pl.tracks.map((t: any) => [t.title, t.artist, t.url, t.length || 0]);
      const data = { n: pl.name, t: compactTracks };
      const json = JSON.stringify(data);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?importPlaylist=${encodeURIComponent(base64)}`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        addLog(`Shareable link for playlist "${pl.name}" copied to clipboard!`, "info");
        alert(`Shareable link for playlist "${pl.name}" copied to clipboard!`);
      }).catch(() => {
        addLog(`Failed to copy link automatically. Share URL: ${shareUrl}`, "warning");
      });
    } catch (err) {
      console.error("Failed to generate share link:", err);
      addLog("Failed to generate share link.", "error");
    }
  };

  const handleMoveToFolder = (pl: any) => {
    const folderName = prompt(`Enter folder name for "${pl.name}" (or leave empty to remove from folder):`, pl.folder || "");
    if (folderName !== null) {
      updatePlaylistFolder(pl.id, folderName.trim());
      addLog(`Playlist "${pl.name}" moved to folder "${folderName.trim() || "Uncategorized"}"`, "info");
    }
  };

  const { settings, updateSettings } = usePlaybackSettings();
  const { autoAdvance, loopPlaylist, shuffleMode } = settings;

  const [plsUrl, setPlsUrl] = useState("");
  const [activeAudioTab, setActiveAudioTab] = useState<"Visualiser" | "EQ" | "Effects" | "Settings">("Visualiser");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTrack = siriusPlaylist[currentSiriusTrackIndex];

  const activeDevice = audioDevices.find((d) => d.deviceId === selectedSinkId);
  const isBluetoothActive = !!(activeDevice && (
    activeDevice.label.toLowerCase().includes("bluetooth") ||
    activeDevice.label.toLowerCase().includes("wireless") ||
    activeDevice.label.toLowerCase().includes("headset") ||
    activeDevice.label.toLowerCase().includes("airpods") ||
    activeDevice.label.toLowerCase().includes("buds")
  ));

  const handleLowBassChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSiriusLowBass(val);
    setSiriusPreset("neutral");
  }, [setSiriusLowBass, setSiriusPreset]);

  const handleBassChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSiriusBass(val);
    setSiriusPreset("neutral");
  }, [setSiriusBass, setSiriusPreset]);

  const handleVocalMidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSiriusVocalMid(val);
    setSiriusPreset("neutral");
  }, [setSiriusVocalMid, setSiriusPreset]);

  const handleHighMidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSiriusHighMid(val);
    setSiriusPreset("neutral");
  }, [setSiriusHighMid, setSiriusPreset]);

  const handleTrebleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSiriusTreble(val);
    setSiriusPreset("neutral");
  }, [setSiriusTreble, setSiriusPreset]);

  const handleDeckVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSiriusAudioVolume(val);
    if (isSiriusMuted && val > 0) {
      setIsSiriusMuted(false);
    }
  }, [setSiriusAudioVolume, isSiriusMuted, setIsSiriusMuted]);

  const handleMasterGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSiriusAudioVolume(val);
  }, [setSiriusAudioVolume]);

  const handlePlaybackRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rateVal = parseFloat(e.target.value);
    setSiriusPlaybackRate(rateVal);
    addLog(`Synthesizer speed rate adjusted warp: ${rateVal.toFixed(2)}x`);
  }, [setSiriusPlaybackRate, addLog]);

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value;
    if (preset === "neutral") {
      setSiriusLowBass(50);
      setSiriusBass(50);
      setSiriusVocalMid(55);
      setSiriusHighMid(50);
      setSiriusTreble(50);
      setSiriusPreset("neutral");
      addLog("Equalizer set to: STUDIO NEUTRAL");
    } else if (preset === "heavy") {
      setSiriusLowBass(90);
      setSiriusBass(80);
      setSiriusVocalMid(40);
      setSiriusHighMid(50);
      setSiriusTreble(60);
      setSiriusPreset("heavy");
      addLog("Equalizer loaded: BASS BOOSTER");
    } else if (preset === "vocal") {
      setSiriusLowBass(35);
      setSiriusBass(40);
      setSiriusVocalMid(85);
      setSiriusHighMid(75);
      setSiriusTreble(50);
      setSiriusPreset("vocal");
      addLog("Equalizer loaded: VOCAL ENHANCER (Sodom)");
    } else if (preset === "metal") {
      setSiriusLowBass(85);
      setSiriusBass(60);
      setSiriusVocalMid(45);
      setSiriusHighMid(75);
      setSiriusTreble(90);
      setSiriusPreset("metal");
      addLog("Equalizer loaded: METAL COIL (Motörhead)");
    }
  }, [setSiriusLowBass, setSiriusBass, setSiriusVocalMid, setSiriusHighMid, setSiriusTreble, setSiriusPreset, addLog]);

  const handleInfowarsFeedChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setInfowarsFeed(val);
    addLog(`Infowars feed changed: ${val === "https://stream.alexjones.media/alexjonesshow.mp3" ? "Alex Jones Show" : "War Room"}`);
    if (activeRadioStation?.id === "infowars") {
      playRadioStation("infowars", "Infowars Network", val, "assets/INFOWARS 1.jpg");
    }
  }, [setInfowarsFeed, activeRadioStation, playRadioStation, addLog]);

  const handleLoadPlsUrl = async () => {
    if (!plsUrl) return;
    addLog(`Loading PLS playlist from URL...`, "info");
    const pl = await loadPLS(plsUrl);
    if (pl) {
      setQueue(pl.tracks);
      addLog(`Loaded PLS from url. Playlist: "${pl.name}" contains ${pl.tracks.length} tracks.`, "info");
      setPlsUrl("");
    } else {
      addLog(`Failed to parse PLS from URL: ${plsUrl}`, "error");
    }
  };

  const handleLoadPlsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addLog(`Reading local PLS file: ${file.name}...`, "info");
    const pl = await loadPLSFile(file);
    if (pl) {
      setQueue(pl.tracks);
      addLog(`Successfully imported PLS: "${pl.name}" with ${pl.tracks.length} tracks.`, "info");
    } else {
      addLog(`Failed to parse local PLS file. Ensure it is valid PLS format.`, "error");
    }
  };

  const handleExportPlaylist = () => {
    if (!siriusPlaylist || siriusPlaylist.length === 0) {
      addLog("Cannot export: Active queue is empty.", "warning");
      return;
    }
    const plsContent = exportToPLS(siriusPlaylist);
    const blob = new Blob([plsContent], { type: "audio/x-scpls" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ajn_playlist_${Date.now()}.pls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog("Active audio queue successfully exported to PLS format.", "info");
  };

  const handleSelectLoadedPlaylist = (playlist: any) => {
    selectPlaylist(playlist.id);
    setQueue(playlist.tracks);
    addLog(`Switched active queue to stored playlist: "${playlist.name}"`, "info");
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSiriusSeek(parseFloat(e.target.value));
  };

  // Keyboard accessibility handler for Volume
  const handleVolumeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      
      const val = Math.min(1.0, siriusAudioVolume + 0.05);
      setSiriusAudioVolume(val);
      addLog(`Master Gain adjusted via keyboard: ${Math.round(val * 100)}%`, "info");
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      
      const val = Math.max(0.0, siriusAudioVolume - 0.05);
      setSiriusAudioVolume(val);
      addLog(`Master Gain adjusted via keyboard: ${Math.round(val * 100)}%`, "info");
    }
  };

  // Keyboard accessibility helper for Equalizer faders
  const makeEqKeyDownHandler = (
    currentVal: number, 
    setter: (val: number) => void, 
    label: string
  ) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        
        const nextVal = Math.min(100, currentVal + 5);
        setter(nextVal);
        setSiriusPreset("neutral");
        addLog(`EQ ${label} adjusted via keyboard: ${nextVal}dB`, "info");
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        
        const nextVal = Math.max(0, currentVal - 5);
        setter(nextVal);
        setSiriusPreset("neutral");
        addLog(`EQ ${label} adjusted via keyboard: ${nextVal}dB`, "info");
      }
    };
  };

  return (
    <div id="audio-synthesizer-deck-container" className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-6 select-none animate-fadeIn">
      {/* Title Section */}
      <h1 className="sr-only">Acoustic Audio Synthesizer Deck</h1>
      <div id="deck-structural-header-panel" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span role="img" aria-label="Synthesizer keyboard">🎹</span> AJN Preamble Synthesizer Console
          </h2>
          <p className="text-xs text-slate-500 font-medium font-sans mt-1">
            Fine-tune studio preambles, configure virtual equalizer presets, and monitor active 120-frequency spectrum curves.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {isBluetoothActive && (
            <div 
              className="bg-blue-900/30 border border-blue-500/25 rounded-full px-3.5 py-1.5 font-mono text-[10px] font-bold text-blue-400 flex items-center gap-1.5 animate-pulse"
              title={`Active output routed over Bluetooth: ${activeDevice?.label}`}
            >
              <span>🎧</span> BLUETOOTH
            </div>
          )}
          <div 
            id="sirius-connection-status-pill"
            className="bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 font-mono text-xs font-bold text-slate-400"
            aria-live="polite"
          >
            STATUS: {activeRadioStation ? `🔴 LIVE: ${activeRadioStation.name.toUpperCase()}` : (isSiriusPlaying ? "📡 BROADCASTING AUDIO" : "⏸️ PRE-LOADED STAGE")}
          </div>
        </div>
      </div>

      {/* Sticky Sub-Tab Bar */}
      <div id="audio-dashboard-subtabs-sticky-wrapper" className="sticky top-0 z-10 bg-[#050608]/90 backdrop-blur-md border-b border-slate-800/80 -mx-6 md:-mx-8 px-6 md:px-8 py-3 mb-6 flex gap-2.5 overflow-x-auto scrollbar-none items-center">
        {(["Visualiser", "EQ", "Effects", "Settings"] as const).map((tab) => {
          const isActive = activeAudioTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveAudioTab(tab);
                addLog(`Switched Audio sub-workspace to: ${tab.toUpperCase()}`);
              }}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isActive
                  ? "bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/15"
                  : "bg-slate-900 border border-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-850"
              }`}
            >
              {tab === "Visualiser" && <Sliders className="w-3.5 h-3.5" />}
              {tab === "EQ" && <SlidersHorizontal className="w-3.5 h-3.5" />}
              {tab === "Effects" && <Compass className="w-3.5 h-3.5" />}
              {tab === "Settings" && <Settings className="w-3.5 h-3.5 animate-spin-slow" />}
              {tab}
            </button>
          );
        })}
      </div>

      {/* Main hardware deck controls */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Visualizer and primary playback (Left 2 columns) */}
        <div className="xl:col-span-2 space-y-6">
          
          {activeAudioTab === "Visualiser" && (
            /* Glowing Equalizer Screen display */
            <div id="spectrum-analyser-glowing-screen" className="bg-[#050608] rounded-2xl border border-slate-800/80 p-6 flex flex-col gap-4 relative shadow-2xl shadow-black/85">
            
            {/* Retro console title line */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="font-mono text-[10px] font-bold text-blue-500 tracking-widest uppercase">REAL-TIME MULTI-BAND ACOUSTIC SPECTROGRAM</span>
              </div>
              <div className="flex items-center gap-1.5" role="group" aria-label="Visualizer Mode Controls">
                {(["eq", "wave", "fire", "matrix"] as const).map((m) => (
                  <button
                    key={m}
                    id={`viz-mode-btn-${m}`}
                    onClick={() => {
                      setSiriusVisualizerMode(m);
                      addLog(`Visualizer mode cycled: ${m.toUpperCase()}`);
                    }}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded cursor-pointer font-mono border transition-all ${
                      siriusVisualizerMode === m 
                        ? "bg-blue-600/10 border-blue-500 text-blue-400 font-black" 
                        : "bg-slate-900 border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                    aria-pressed={siriusVisualizerMode === m}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="h-40 rounded-2xl bg-[#040609] border border-slate-905 flex items-stretch overflow-hidden relative shadow-inner">
              <canvas 
                ref={tabCanvasRef}
                className="w-full h-full block"
                aria-label="Continuous frequency spectrogram graph output"
              />
            </div>

            {/* Compact track progress seek bar */}
            <div className="space-y-1.5 font-mono text-xs text-slate-500">
              <div id="deck-playhead-meta-line" className="flex justify-between items-center text-[10px] font-bold">
                {activeRadioStation ? (
                  <>
                    <span className="text-red-500 animate-pulse flex items-center gap-1.5 select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      🔴 LIVE REAL-TIME BROADCAST COUPLER
                    </span>
                    <span className="text-slate-400">UNRESTRICTED HEURISTIC STREAM BANDWIDTH</span>
                  </>
                ) : (
                  <>
                    <span>ELAPSED PLAYTIME: {new Date(siriusCurrentTime * 1005).toISOString().substring(14, 19)}</span>
                    <span>DURATION: {new Date(siriusDuration * 1005).toISOString().substring(14, 19)}</span>
                  </>
                )}
              </div>
              {!activeRadioStation ? (
                <div className="flex items-center gap-2">
                  <span className="sr-only">Seek playhead timeline:</span>
                  <input
                    type="range"
                    id="deck-audio-seek-slider"
                    min="0"
                    max={siriusDuration || 100}
                    step="1"
                    value={siriusCurrentTime}
                    onChange={handleSeekChange}
                    className="w-full h-1 bg-slate-800 rounded-xl appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all font-mono"
                    aria-label="Acoustic track seek timeline position slider"
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={siriusDuration || 100}
                    aria-valuenow={siriusCurrentTime}
                  />
                </div>
              ) : (
                <div className="h-1 bg-gradient-to-r from-blue-500/20 via-blue-500 to-indigo-505/20 rounded-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-blue-500/40 animate-pulse" />
                </div>
              )}
            </div>

            {/* Integrated Tactile Broadcast Control Deck */}
            <div id="integrated-tactile-playback-deck" className="mt-2 bg-slate-950/40 rounded-2xl border border-slate-900 p-4 shadow-xl select-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                
                {/* 1. Track / Stream Metadata display */}
                <div className="flex items-center gap-3 min-w-0 justify-center md:justify-start text-left">
                  <div className="relative">
                    <div className={`w-9 h-9 rounded-full border border-slate-800 bg-[#080B10] flex items-center justify-center relative shadow-md overflow-hidden ${isSiriusPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "4s" }}>
                      <span className="text-xs select-none">💿</span>
                    </div>
                    {isSiriusPlaying && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-400"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[8px] font-black tracking-widest font-mono px-1.5 py-0.5 rounded leading-none ${
                        activeRadioStation 
                          ? "bg-red-500/10 text-red-400 border border-red-500/10 animate-pulse" 
                          : "bg-blue-600/10 text-blue-400 border border-blue-500/15"
                      }`}>
                        {activeRadioStation ? "LIVE STATION" : "SYNTH TRACK"}
                      </span>
                      {isSiriusMuted && (
                        <span className="text-[8px] font-black tracking-widest font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/10 leading-none">MUTED</span>
                      )}
                    </div>
                    <h4 className="text-[11px] font-bold text-slate-200 mt-1 overflow-x-auto whitespace-nowrap scrollbar-none max-w-[280px] min-w-0 pr-1" title={activeRadioStation ? activeRadioStation.name : (currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : "No Track Selected")}>
                      {activeRadioStation 
                        ? activeRadioStation.name 
                        : (currentTrack ? `${currentTrack.artist} · ${currentTrack.title}` : "No Track Selected")}
                    </h4>
                  </div>
                </div>

                {/* 2. Interactive Audio Playback Controls */}
                <div className="flex items-center justify-center gap-2.5" role="group" aria-label="Audio Playback Machine Controls">
                  {/* Previous button */}
                  <button
                    onClick={handleSiriusPrev}
                    id="deck-btn-prev"
                    disabled={!!activeRadioStation}
                    className={`p-2 rounded-xl border border-transparent cursor-pointer transition-all active:scale-95 flex items-center justify-center ${
                      activeRadioStation 
                        ? "opacity-25 cursor-not-allowed bg-slate-900/10 text-slate-600" 
                        : "bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                    title="Previous Synthesizer Selection"
                    aria-label="Previous Synthesizer Selection"
                  >
                    <SkipBack className="w-3.5 h-3.5 fill-current" />
                  </button>

                  {/* Play / Pause Toggle button */}
                  {isSiriusPlaying ? (
                    <button
                      onClick={stopSiriusMusic}
                      id="deck-btn-pause"
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-full shadow-md shadow-blue-950/40 transition-all flex items-center justify-center cursor-pointer border border-blue-500"
                      title="Pause Playback"
                      aria-label="Pause Playback"
                    >
                      <Pause className="w-4 h-4 fill-white" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (activeRadioStation || currentTrack) {
                          startSiriusMusic();
                          addLog("Synthesizer console started.");
                        } else {
                          addLog("No tracks in queue to play.", "warning");
                        }
                      }}
                      id="deck-btn-play"
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-full shadow-md shadow-blue-950/40 transition-all flex items-center justify-center cursor-pointer border border-blue-500"
                      title="Resume Playback"
                      aria-label="Resume Playback"
                    >
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </button>
                  )}

                  {/* Stop button */}
                  <button
                    onClick={() => {
                      stopSiriusMusic();
                      handleSiriusSeek(0);
                      addLog("Synthesizer console playhead stopped and reset.");
                    }}
                    id="deck-btn-stop"
                    className="p-2 rounded-xl border border-slate-800/85 bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                    title="Stop & Reset"
                    aria-label="Stop Playback & Reset Playhead"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>

                  {/* Next button */}
                  <button
                    onClick={handleSiriusNext}
                    id="deck-btn-next"
                    disabled={!!activeRadioStation}
                    className={`p-2 rounded-xl border border-transparent cursor-pointer transition-all active:scale-95 flex items-center justify-center ${
                      activeRadioStation 
                        ? "opacity-25 cursor-not-allowed bg-slate-900/10 text-slate-600" 
                        : "bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                    title="Next Synthesizer Selection"
                    aria-label="Next Synthesizer Selection"
                  >
                    <SkipForward className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>

                {/* 3. Output Volume, Looping & Muting Cluster */}
                <div className="flex items-center justify-center md:justify-end gap-3" role="group" aria-label="Audio Output Aux Attributes">
                  {/* Loop Mode toggle */}
                  <button
                    onClick={() => {
                      setIsSiriusLooping(!isSiriusLooping);
                      addLog(`Synth dynamic looping cycled: ${!isSiriusLooping ? "ACTIVE" : "INACTIVE"}`);
                    }}
                    id="deck-btn-loop"
                    className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                      isSiriusLooping 
                        ? "bg-blue-600/15 border-blue-500/30 text-blue-400" 
                        : "bg-slate-900/55 border-slate-800/80 text-slate-500 hover:text-slate-400"
                    }`}
                    title={`Continuous Loop Mode: ${isSiriusLooping ? "ENABLED" : "DISABLED"}`}
                    aria-label={`Continuous Loop Mode: ${isSiriusLooping ? "ENABLED" : "DISABLED"}`}
                    aria-pressed={isSiriusLooping}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>

                  {/* Mute Toggle */}
                  <button
                    onClick={() => {
                      setIsSiriusMuted(!isSiriusMuted);
                      addLog(`Synth output audio stream state: ${!isSiriusMuted ? "MUTED" : "UNMUTED"}`);
                    }}
                    id="deck-btn-mute"
                    className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                      isSiriusMuted 
                        ? "bg-red-500/15 border-red-500/30 text-red-400" 
                        : "bg-slate-900/55 border-slate-800/80 text-slate-400 hover:text-white"
                    }`}
                    title={isSiriusMuted ? "Unmute Audio" : "Mute Audio"}
                    aria-label={isSiriusMuted ? "Unmute Audio" : "Mute Audio"}
                    aria-pressed={isSiriusMuted}
                  >
                    {isSiriusMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-400" />}
                  </button>

                  {/* Real-time volume stream controller */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/30 px-2 py-1 rounded-xl border border-slate-900">
                    <span className="sr-only">Machine Master Gain Volume slider:</span>
                    <input 
                      type="range" min={VOLUME_MIN} max={VOLUME_MAX} step={VOLUME_STEP}
                      id="deck-volume-fader-input"
                      value={isSiriusMuted ? 0 : siriusAudioVolume}
                      onChange={handleDeckVolumeChange}
                      onKeyDown={handleVolumeKeyDown}
                      className="w-14 md:w-16 h-1 bg-slate-800 rounded-xl appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all font-mono"
                      title={`Interactive Volume Level: ${Math.round((isSiriusMuted ? 0 : siriusAudioVolume) * 100)}%. Focus and use arrow keys to adjust.`}
                      aria-label="Synthesizer audio volume level fader control slider"
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((isSiriusMuted ? 0 : siriusAudioVolume) * 100)}
                    />
                    <span className="text-[9px] font-mono font-bold text-slate-400 w-6 text-right select-none leading-none">
                      {Math.round((isSiriusMuted ? 0 : siriusAudioVolume) * 100)}%
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>
          )}

          {activeAudioTab === "EQ" && (
            <>
              {/* Faders / Synth Hardware Equalizer Simulator */}
              <div id="equalizer-hardware-chassis" className="bg-[#06080C] border border-slate-800 rounded-2xl p-6 space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" /> STUDIO HARDWARE EQUALIZER CONTROLS & faders
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
              
              {/* Fader 1 */}
              <div className="flex flex-col items-center gap-2 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
                <label htmlFor="eq-fader-low-bass" className="text-[9px] font-bold text-slate-500 font-mono">100Hz BASS</label>
                <input 
                  type="range" 
                  id="eq-fader-low-bass"
                  min={EQ_MIN} max={EQ_MAX} 
                  value={siriusLowBass}
                  onChange={handleLowBassChange}
                  onKeyDown={makeEqKeyDownHandler(siriusLowBass, setSiriusLowBass, "100Hz Bass")}
                  className="h-28 appearance-none bg-slate-800 w-1 rounded-xl cursor-pointer accent-blue-500"
                  style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                  aria-label="Sub bass hardware equalizer fader"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={siriusLowBass}
                />
                <span className="text-xs font-mono text-slate-400 font-bold">{siriusLowBass}dB</span>
              </div>

              {/* Fader 2 */}
              <div className="flex flex-col items-center gap-2 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
                <label htmlFor="eq-fader-bass" className="text-[9px] font-bold text-slate-500 font-mono">400Hz LOW-MID</label>
                <input 
                  type="range" 
                  id="eq-fader-bass"
                  min={EQ_MIN} max={EQ_MAX} 
                  value={siriusBass}
                  onChange={handleBassChange}
                  onKeyDown={makeEqKeyDownHandler(siriusBass, setSiriusBass, "400Hz Low-mid")}
                  className="h-28 appearance-none bg-slate-800 w-1 rounded-xl cursor-pointer accent-blue-500"
                  style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                  aria-label="Mid-bass studio hardware equalizer fader"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={siriusBass}
                />
                <span className="text-xs font-mono text-slate-400 font-bold">{siriusBass}dB</span>
              </div>

              {/* Fader 3 */}
              <div className="flex flex-col items-center gap-2 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
                <label htmlFor="eq-fader-vocal-mid" className="text-[9px] font-bold text-slate-500 font-mono">1KHz VOC_MID</label>
                <input 
                  type="range" 
                  id="eq-fader-vocal-mid"
                  min={EQ_MIN} max={EQ_MAX} 
                  value={siriusVocalMid}
                  onChange={handleVocalMidChange}
                  onKeyDown={makeEqKeyDownHandler(siriusVocalMid, setSiriusVocalMid, "1KHz Vocal-mid")}
                  className="h-28 appearance-none bg-slate-800 w-1 rounded-xl cursor-pointer accent-blue-500"
                  style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                  aria-label="Vocal mid frequency hardware equalizer fader"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={siriusVocalMid}
                />
                <span className="text-xs font-mono text-slate-400 font-bold">{siriusVocalMid}dB</span>
              </div>

              {/* Fader 4 */}
              <div className="flex flex-col items-center gap-2 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
                <label htmlFor="eq-fader-high-mid" className="text-[9px] font-bold text-slate-500 font-mono">4KHz HIGH_MID</label>
                <input 
                  type="range" 
                  id="eq-fader-high-mid"
                  min={EQ_MIN} max={EQ_MAX} 
                  value={siriusHighMid}
                  onChange={handleHighMidChange}
                  onKeyDown={makeEqKeyDownHandler(siriusHighMid, setSiriusHighMid, "4KHz High-mid")}
                  className="h-28 appearance-none bg-slate-800 w-1 rounded-xl cursor-pointer accent-blue-500"
                  style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                  aria-label="High mid frequency hardware equalizer fader"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={siriusHighMid}
                />
                <span className="text-xs font-mono text-slate-400 font-bold">{siriusHighMid}dB</span>
              </div>

              {/* Fader 5 */}
              <div className="flex flex-col items-center gap-2 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/40">
                <label htmlFor="eq-fader-treble" className="text-[9px] font-bold text-slate-500 font-mono">16KHz TREBLE</label>
                <input 
                  type="range" 
                  id="eq-fader-treble"
                  min={EQ_MIN} max={EQ_MAX} 
                  value={siriusTreble}
                  onChange={handleTrebleChange}
                  onKeyDown={makeEqKeyDownHandler(siriusTreble, setSiriusTreble, "16KHz Treble")}
                  className="h-28 appearance-none bg-slate-800 w-1 rounded-xl cursor-pointer accent-blue-500"
                  style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                  aria-label="High treble air hardware equalizer fader"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={siriusTreble}
                />
                <span className="text-xs font-mono text-slate-400 font-bold">{siriusTreble}dB</span>
              </div>

            </div>
          </div>

          {/* Preset Quick Loader card */}
          <div id="equalizer-presets-panel" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="space-y-1.5">
              <label htmlFor="preset-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                ACOUSTIC EQUALIZER PRESETS
              </label>
              <select
                id="preset-select"
                value={siriusPreset}
                onChange={handlePresetChange}
                className="w-full py-2.5 px-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:border-blue-500 outline-none cursor-pointer font-bold tracking-tight uppercase"
              >
                <option value="neutral">Studio Neutral</option>
                <option value="heavy">Bass Booster</option>
                <option value="vocal">Vocal Enhance</option>
                <option value="metal">Metal Coil</option>
              </select>
            </div>
          </div>
          </>
          )}

          {activeAudioTab === "Effects" && (
            /* Volume Slider & Playback Rate Track parameters */
            <div id="deck-speed-gain-chassis" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">SIGNAL SPEEDS & volume</label>
              <div className="space-y-4">
                
                {/* Master Synth Volume slider */}
                <div className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Master Synth volume:</span>
                    <span className="font-bold text-blue-400 font-mono">{Math.round(siriusAudioVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" min={VOLUME_MIN} max={VOLUME_MAX} step={VOLUME_STEP}
                    id="deck-config-master-gain-slider"
                    value={siriusAudioVolume}
                    onChange={handleMasterGainChange}
                    onKeyDown={handleVolumeKeyDown}
                    className="w-full h-1.5 bg-slate-800 rounded-full cursor-pointer accent-blue-500"
                    aria-label="Studio master gain slider control"
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(siriusAudioVolume * 100)}
                  />
                </div>

                {/* Speed Playback speed rate controller */}
                <div className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Playback Warp Speed:</span>
                    <span className="font-bold text-indigo-400 font-mono">
                      {activeRadioStation ? "1.00x (LOCKED)" : `${siriusPlaybackRate.toFixed(2)}x`}
                    </span>
                  </div>
                  <input 
                    type="range" min={RATE_MIN} max={RATE_MAX} step={RATE_STEP}
                    id="deck-config-warp-playback-rate-slider"
                    value={activeRadioStation ? 1.0 : siriusPlaybackRate}
                    disabled={!!activeRadioStation}
                    onChange={handlePlaybackRateChange}
                    className={`w-full h-1.5 rounded-full cursor-pointer accent-indigo-500 ${
                      activeRadioStation ? "opacity-30 cursor-not-allowed bg-slate-850" : "bg-slate-800"
                    }`}
                    aria-label="Synthesizer audio playback speed controller slider warp"
                    role="slider"
                    aria-valuemin={50}
                    aria-valuemax={200}
                    aria-valuenow={activeRadioStation ? 100 : Math.round(siriusPlaybackRate * 100)}
                  />
                </div>

              </div>
            </div>
          )}

          {activeAudioTab === "Settings" && (
            <>
              {/* Playback Sequence & Machine Settings */}
              <div id="deck-playback-settings-panel" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-blue-500 animate-spin" style={{ animationDuration: "12s" }} /> PLAYBACK SEQUENCE CONTROLLER
                </label>
                
                <div className="space-y-4 font-sans">
                  {/* Shuffle mode */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 font-mono block">SHUFFLE SEQUENCE STATE:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["off", "random", "fair"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            updateSettings({ shuffleMode: mode });
                            addLog(`Shuffle mode changed to: ${mode.toUpperCase()}`, "info");
                          }}
                          className={`py-1.5 text-[9px] font-mono font-bold border rounded-xl transition-all cursor-pointer ${
                            shuffleMode === mode
                              ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-sm"
                              : "bg-slate-900 border-transparent text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {mode === "off" ? "LINEAR-OFF" : mode === "random" ? "RANDOM-MIX" : "FAIR-ROBIN"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Auto-Advance queue</span>
                      <span className="text-[10px] text-slate-500">Sequences when track finishes</span>
                    </div>
                    <button
                      onClick={() => {
                        updateSettings({ autoAdvance: !autoAdvance });
                        addLog(`Auto-advance set to: ${!autoAdvance ? "ON" : "OFF"}`);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoAdvance ? "bg-blue-600" : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          autoAdvance ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Loop Playlist</span>
                      <span className="text-[10px] text-slate-500">Loops full queue on finish</span>
                    </div>
                    <button
                      onClick={() => {
                        updateSettings({ loopPlaylist: !loopPlaylist });
                        addLog(`Playlist loop set to: ${!loopPlaylist ? "ON" : "OFF"}`);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        loopPlaylist ? "bg-blue-600" : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          loopPlaylist ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                </div>
              </div>

              {/* Audio Output Device Router / Bluetooth Controller (Prompt 3) */}
              <div id="deck-audio-device-router-panel" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-500" /> AUDIO HARDWARE OUTPUT ROUTER
                </label>
                
                <div className="space-y-3.5 font-sans">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 font-mono block">SELECT OUTPUT DESTINATION:</span>
                    {audioDevices.length === 0 ? (
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                        No external audio output devices detected, or device permissions pending. Play audio first to grant browser permissions.
                      </p>
                    ) : (
                      <select
                        id="audio-output-device-select"
                        value={selectedSinkId}
                        onChange={(e) => {
                          if (setAudioOutputDevice) {
                            setAudioOutputDevice(e.target.value);
                          }
                        }}
                        className="w-full py-2.5 px-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:border-blue-500 outline-none cursor-pointer font-bold font-mono tracking-tight text-xs uppercase"
                      >
                        <option value="">System Default Output</option>
                        {audioDevices.map((device) => {
                          const isBluetooth = device.label.toLowerCase().includes("bluetooth") ||
                            device.label.toLowerCase().includes("wireless") ||
                            device.label.toLowerCase().includes("headset") ||
                            device.label.toLowerCase().includes("airpods") ||
                            device.label.toLowerCase().includes("buds");
                          return (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Device (${device.deviceId.slice(0, 8)}...)`} {isBluetooth ? "🎧 [BT]" : ""}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  {/* Bluetooth Latency Wake Assistant */}
                  <div className="border-t border-slate-900 pt-3.5 space-y-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Bluetooth Wake Assist</span>
                      <span className="text-[10px] text-slate-500 leading-normal">
                        Pre-loads silent sub-frequencies to wake connection channels and avoid truncated streams.
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        const { wakeAudioChannel } = await import("../utils/audioUtils");
                        await wakeAudioChannel();
                        addLog("Sent silence wake-signal to Bluetooth channel.", "info");
                      }}
                      className="w-full py-2 text-[10px] font-bold border border-slate-800 hover:border-blue-500/30 bg-slate-900 rounded-xl hover:bg-slate-850 hover:text-white transition-all text-slate-400 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      🔊 FORCE CHANNEL WAKE TEST
                    </button>
                  </div>
                </div>
              </div>

              {/* Stored Playlists & Importer */}
              <div id="deck-playlist-vault-panel" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-lg">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <ListMusic className="w-3.5 h-3.5 text-blue-500" /> PLAYLIST VAULT & IMPORTER
                </label>
                
                <div className="space-y-3 font-sans">
                  {/* File Upload Selector */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pls"
                      ref={fileInputRef}
                      onChange={handleLoadPlsFile}
                      className="hidden"
                      id="pls-file-uploader-input"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-1.5 text-xs font-bold border border-slate-800 bg-slate-900 rounded-xl hover:bg-slate-800 hover:text-white transition-all text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-500" /> IMPORT LOCAL .PLS
                    </button>

                    <button
                      onClick={handleExportPlaylist}
                      className="px-3 py-1.5 text-xs font-bold border border-slate-800 bg-slate-900 rounded-xl hover:bg-slate-800 text-blue-400 flex items-center justify-center gap-1 cursor-pointer"
                      title="Export Current Queue as PLS"
                    >
                      <FileDown className="w-3.5 h-3.5" /> EXPORT
                    </button>
                  </div>

                  {/* URL Link Input */}
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon className="h-3 w-3 text-slate-500" />
                      </span>
                      <input
                        type="url"
                        value={plsUrl}
                        onChange={(e) => setPlsUrl(e.target.value)}
                        placeholder="Paste PLS Stream URL..."
                        className="w-full bg-[#05070a] border border-slate-805 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-655 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                    <button
                      onClick={handleLoadPlsUrl}
                      className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                    >
                      LOAD
                    </button>
                  </div>

                  {/* Loaded Playlists List with Folders */}
                  {audioPlaylists.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-900">
                      <span className="text-[9px] font-bold text-slate-500 font-mono tracking-wider block">STORED VAULTS:</span>
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1" id="stored-vaults-folders">
                        {Object.entries(groupedPlaylists).map(([folderName, playlists]) => {
                          const isCollapsed = collapsedFolders[folderName];
                          return (
                            <div key={folderName} className="space-y-1">
                              {/* Folder Header */}
                              <div
                                onClick={() => setCollapsedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }))}
                                className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer text-[10px] font-mono font-bold text-slate-400 select-none"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                                  <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span className="truncate uppercase tracking-wider">{folderName}</span>
                                </div>
                                <span className="bg-slate-950 px-1.5 py-0.2 rounded-full text-[9px] text-slate-500">
                                  {playlists.length}
                                </span>
                              </div>

                              {/* Folder Playlists List */}
                              {!isCollapsed && (
                                <div className="pl-3.5 space-y-1 border-l border-slate-900/80 ml-2 pt-0.5 pb-1">
                                  {playlists.map((pl) => {
                                    const isSelected = currentPlaylistId === pl.id;
                                    return (
                                      <div
                                        key={pl.id}
                                        className={`flex items-center justify-between p-1.5 rounded-xl text-xs border transition-all ${
                                          isSelected 
                                            ? "bg-blue-600/[0.04] border-blue-500/20 text-blue-400" 
                                            : "bg-slate-900/20 border-transparent text-slate-400 hover:bg-slate-900/40"
                                        }`}
                                      >
                                        <div
                                          onClick={() => handleSelectLoadedPlaylist(pl)}
                                          className="flex-1 truncate font-medium cursor-pointer pr-1 select-none"
                                          title={pl.name}
                                        >
                                          📄 {pl.name} <span className="text-[9px] opacity-60 font-mono">({pl.tracks.length})</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleMoveToFolder(pl); }}
                                            className="text-slate-500 hover:text-indigo-450 p-0.5 rounded transition-all cursor-pointer"
                                            title="Assign to Folder"
                                          >
                                            <Folder className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSharePlaylist(pl); }}
                                            className="text-slate-500 hover:text-blue-400 p-0.5 rounded transition-all cursor-pointer"
                                            title="Share Playlist Link"
                                          >
                                            <Share2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id); }}
                                            className="text-slate-600 hover:text-rose-450 p-0.5 rounded transition-all cursor-pointer"
                                            title="Delete Playlist"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          )}

        </div>

        {/* Right controls and playlist (Right col) */}
        <div className="space-y-6">

          {/* LIVE RADIO BROADCASTS CARD */}
          <div id="live-radio-broadcasts-panel" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-lg">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              📡 LIVE RADIO BROADCASTS
            </label>
            
            <div className="space-y-2.5 font-sans" role="group" aria-label="Available Live Radio Streams">
              {/* No Agenda Live */}
              <div 
                onClick={() => playRadioStation("noagenda", "No Agenda Live", "https://listen.noagendastream.com/noagenda?type=.mp3", "https://archive.org/download/daily-highlights/lmbsa.png")}
                className={`p-3 border rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
                  activeRadioStation?.id === "noagenda" && isSiriusPlaying
                    ? "bg-rose-600/[0.08] border-red-500/45 text-white shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse" 
                    : "bg-slate-900/40 border-transparent hover:bg-slate-900/70 hover:border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <RadioStationIcon 
                    src="https://archive.org/download/daily-highlights/lmbsa.png" 
                    alt="No Agenda Album Art" 
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold leading-none truncate select-none">No Agenda Live</h4>
                    <p className="text-[10px] text-slate-500 font-medium truncate mt-1">Live Information Stream</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeRadioStation?.id === "noagenda" && isSiriusPlaying) {
                      stopSiriusMusic();
                    } else {
                      playRadioStation("noagenda", "No Agenda Live", "https://listen.noagendastream.com/noagenda?type=.mp3", "https://archive.org/download/daily-highlights/lmbsa.png");
                    }
                  }}
                  id="station-play-noagenda"
                  className={`p-2 rounded-full flex items-center justify-center shrink-0 ${
                    activeRadioStation?.id === "noagenda" && isSiriusPlaying ? "bg-rose-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
                  } text-white scale-90`}
                  aria-label={activeRadioStation?.id === "noagenda" && isSiriusPlaying ? "Pause No Agenda Live" : "Play No Agenda Live"}
                >
                  {activeRadioStation?.id === "noagenda" && isSiriusPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
                </button>
              </div>

              {/* Infowars Network */}
              <div 
                onClick={() => playRadioStation("infowars", "Infowars Network", infowarsFeed, "assets/INFOWARS 1.jpg")}
                className={`p-3 border rounded-2xl cursor-pointer transition-all flex flex-col gap-1.5 ${
                  activeRadioStation?.id === "infowars" && isSiriusPlaying
                    ? "bg-rose-600/[0.08] border-red-500/45 text-white shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse" 
                    : "bg-slate-900/40 border-transparent hover:bg-slate-900/70 hover:border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <RadioStationIcon 
                      src="assets/INFOWARS 1.jpg" 
                      alt="Infowars Channel Icon" 
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold leading-none truncate select-none">Infowars Network</h4>
                      <p className="text-[10px] text-slate-500 font-medium truncate mt-1">Global News Stream</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeRadioStation?.id === "infowars" && isSiriusPlaying) {
                        stopSiriusMusic();
                      } else {
                        playRadioStation("infowars", "Infowars Network", infowarsFeed, "assets/INFOWARS 1.jpg");
                      }
                    }}
                    id="station-play-infowars"
                    className={`p-2 rounded-full flex items-center justify-center shrink-0 ${
                      activeRadioStation?.id === "infowars" && isSiriusPlaying ? "bg-rose-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
                    } text-white scale-90`}
                    aria-label={activeRadioStation?.id === "infowars" && isSiriusPlaying ? "Pause Infowars Network" : "Play Infowars Network"}
                  >
                    {activeRadioStation?.id === "infowars" && isSiriusPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
                  </button>
                </div>
                
                <div className="flex items-center gap-2 pl-12" onClick={(e) => e.stopPropagation()}>
                  <label htmlFor="infowars-feed-selector" className="text-[10px] font-mono text-slate-500 font-bold uppercase select-none cursor-pointer">Feed Source:</label>
                  <select
                    id="infowars-feed-selector"
                    value={infowarsFeed}
                    className="bg-slate-950 border border-slate-850 text-[10px] text-slate-300 rounded px-2 py-0.5 font-sans font-bold focus:outline-none focus:border-blue-500/50 cursor-pointer select-none max-w-[150px] truncate"
                    onChange={handleInfowarsFeedChange}
                    aria-label="Select live Infowars audio stream broadcast source"
                  >
                    <option value="https://stream.alexjones.media/alexjonesshow.mp3">Alex Jones Show</option>
                    <option value="https://stream.alexjones.media/warroom/">War Room</option>
                  </select>
                </div>
              </div>

              {/* Blaze Media */}
              <div 
                onClick={() => playRadioStation("blaze", "Blaze Media", "https://15123.live.streamtheworld.com/BLZE_1AAC_SC?pname=live_profile&companionAds=false&dist=iheart&terminalId=159&deviceName=web-mobile&aw_0_1st.playerid=iHeartRadioWebPlayer&listenerId=&clientType=web&profileId=12489876887&aw_0_1st.skey=12489876887&host=webapp.US&playedFrom=157&stationid=4874&territory=US", "https://cdn.cookielaw.org/logos/08874449-6e54-49cf-b3a0-337a24296f63/c221a8f2-522c-4c4c-bf8e-e060089b7e57/e82b07ce-b61b-4a89-ad6f-b2a5c348aec6/Blaze_Media_Logo_-_2023.png")}
                className={`p-3 border rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
                  activeRadioStation?.id === "blaze" && isSiriusPlaying
                    ? "bg-rose-600/[0.08] border-red-500/45 text-white shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse" 
                    : "bg-slate-900/40 border-transparent hover:bg-slate-900/70 hover:border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <RadioStationIcon 
                    src="https://cdn.cookielaw.org/logos/08874449-6e54-49cf-b3a0-337a24296f63/c221a8f2-522c-4c4c-bf8e-e060089b7e57/e82b07ce-b61b-4a89-ad6f-b2a5c348aec6/Blaze_Media_Logo_-_2023.png" 
                    alt="Blaze Media Logo" 
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold leading-none truncate select-none">Blaze Media</h4>
                    <p className="text-[10px] text-slate-500 font-medium truncate mt-1">Blaze Television Network</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeRadioStation?.id === "blaze" && isSiriusPlaying) {
                      stopSiriusMusic();
                    } else {
                      playRadioStation("blaze", "Blaze Media", "https://15123.live.streamtheworld.com/BLZE_1AAC_SC?pname=live_profile&companionAds=false&dist=iheart&terminalId=159&deviceName=web-mobile&aw_0_1st.playerid=iHeartRadioWebPlayer&listenerId=&clientType=web&profileId=12489876887&aw_0_1st.skey=12489876887&host=webapp.US&playedFrom=157&stationid=4874&territory=US", "https://cdn.cookielaw.org/logos/08874449-6e54-49cf-b3a0-337a24296f63/c221a8f2-522c-4c4c-bf8e-e060089b7e57/e82b07ce-b61b-4a89-ad6f-b2a5c348aec6/Blaze_Media_Logo_-_2023.png");
                    }
                  }}
                  id="station-play-blaze"
                  className={`p-2 rounded-full flex items-center justify-center shrink-0 ${
                    activeRadioStation?.id === "blaze" && isSiriusPlaying ? "bg-rose-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
                  } text-white scale-90`}
                  aria-label={activeRadioStation?.id === "blaze" && isSiriusPlaying ? "Pause Blaze Media" : "Play Blaze Media"}
                >
                  {activeRadioStation?.id === "blaze" && isSiriusPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
                </button>
              </div>

            </div>
          </div>

          {/* Active Play Queue Tracks */}
          <div id="deck-active-playlist-tracks" className="bg-[#06080C] border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-lg flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center justify-between">
              <span>🎚️ HARDWARE AUD-DECK QUEUE</span>
              {shuffleMode !== "off" && (
                <span className="text-blue-500 text-[9px] animate-pulse">
                  {shuffleMode === "fair" ? "● SHUFFLE FAIR" : "● SHUFFLE RANDOM"}
                </span>
              )}
            </label>

            {plsImporting && (
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl p-3 animate-fadeIn">
                <div className="flex items-center justify-between text-[10px] font-mono text-indigo-400 mb-1.5 font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    IMPORTING LARGE PLS PLAYLIST
                  </span>
                  <span>{plsImportProgress}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${plsImportProgress}%` }}
                  ></div>
                </div>
                <p className="text-[9px] font-mono text-slate-500 mt-1">{plsImportStatus}</p>
              </div>
            )}
            
            <TrackList
              tracks={siriusPlaylist}
              currentTrackIndex={currentSiriusTrackIndex}
              isPlaying={isSiriusPlaying}
              addLog={addLog}
              playlistId={currentPlaylistId || undefined}
              enrichPlaylistMetadata={enrichPlaylistMetadata}
              enriching={enriching}
              enrichProgress={enrichProgress}
              onPlayTrack={(index) => {
                playSiriusTrack(index);
                addLog(`Decoupled selector cue: play item ${index + 1} ('${siriusPlaylist[index]?.title}')`, "info");
              }}
            />
          </div>

        </div>

      </div>

    </div>
  );
});
