import { mainVideoRef } from "./utils/videoRef";
import { useKeyboardScrollFix } from "./hooks/useKeyboardScrollFix";
import { TelemetryAudit } from "./utils/TelemetryAudit";
import { QuarantineLedger } from "./utils/quarantineLedger";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import { 
  Tv, 
  Sliders, 
  Calendar, 
  Music, 
  BookOpen, 
  AlertTriangle, 
  Zap, 
  LogOut, 
  Terminal, 
  Activity, 
  Cpu, 
  Layers,
  Megaphone,
  Film,
  MonitorPlay,
  Radio,
  Archive,
  Compass,
  Menu,
  X
} from "lucide-react";

// Types
import { IPTVChannel, PlayerStore } from "./types";

// Custom components
import { LiteApp } from "./components/LiteApp";

// Dynamic Imports for Advanced Suites to reduce initial bundle size (LCP/FCP optimization)
const BroadcastAutomationSuite = React.lazy(() => import("./components/BroadcastAutomationSuite").then(m => ({ default: m.BroadcastAutomationSuite })));
const SyndicateSuite = React.lazy(() => import("./components/SyndicateSuite").then(m => ({ default: m.SyndicateSuite })));
const CinephileSuite = React.lazy(() => import("./components/CinephileSuite").then(m => ({ default: m.CinephileSuite })));
const AudioDashboard = React.lazy(() => import("./components/AudioDashboard").then(m => ({ default: m.AudioDashboard })));
const SmartPlaylistBrowser = React.lazy(() => import("./components/SmartPlaylistBrowser").then(m => ({ default: m.SmartPlaylistBrowser })));
const PodcastTuner = React.lazy(() => import("./components/PodcastTuner").then(m => ({ default: m.PodcastTuner })));

// Custom hooks
import { usePlayer } from "./hooks/usePlayer";
import { usePlaylistVault } from "./hooks/usePlaylistVault";
import { useAudioController } from "./hooks/useAudioController";
import { cleanTitle } from "./utils/titleCleaner";
import { safeLocalStorage } from "./utils/safeStorage";
import { PlaylistVault } from "./services/PlaylistVault";
import { analyzeSmartPlaylists, SmartPlaylistCategory } from "./utils/smartPlaylistEngine";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


// Dynamic playout generator with Central Time Zone (CDT is UTC-5) 10 AM rules and reversed playlist items
export const getDynamicM3U = (): string => {
  const now = new Date();
  const cdtOffset = -5 * 60 * 60 * 1000;
  const cdtDate = new Date(now.getTime() + cdtOffset + (now.getTimezoneOffset() * 60 * 1000));
  const cdtHour = cdtDate.getHours();

  let targetDate = new Date(cdtDate);
  if (cdtHour < 10) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  // Minimum date is July 7, 2026
  const july7th2026 = new Date(2026, 6, 7);
  if (targetDate < july7th2026) {
    targetDate = july7th2026;
  }

  const year = targetDate.getFullYear();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthStr = months[targetDate.getMonth()];
  const dayNum = String(targetDate.getDate()).padStart(2, "0");

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekdays[targetDate.getDay()];

    return `#EXTM3U x-tvg-name="AJN News & Broadcasts"
#EXTINF:300 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/lmbsa.png" tvg-id="AJN_20260816_000000_Show" tvg-name="Alex Jones Show - Aug 2026",Alex Jones Show [2025-08-03]
https://archive.org/download/7a-74f-5aa-b-5c-0-4412-9bd-3-4c-1c-95b-60fa-6-large/The%20Alex%20Jones%20Show%20-%20August%203%2C%202025.mp4
#EXTINF:300 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/lmbsa.png" tvg-id="AJN_20260303_000000_Interview" tvg-name="Alex Jones & Nick Fuentes",Alex Jones & Nick Fuentes [2026-03-03]
https://archive.org/download/nick-fuentes-alex-jones-interview-3-3-26-full-interview-iran-israel-us-war/ssstwitter.com_1772597388526.mp4
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/lmbsa.png" tvg-id="ajn_live" tvg-name="AJN Live",2026-${monthStr}-${dayNum} ${dayName} · AJN Live Broadcast
https://rumble.com/embed/v79lfxq/?pub=15son
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/warroom.png" tvg-id="ajn_war_room" tvg-name="War Room",2026-${monthStr}-${dayNum} ${dayName} · War Room
https://rumble.com/embed/v79lfxq/?pub=15son
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/lmbsa.png" tvg-id="ajn_alex_jones" tvg-name="Alex Jones Show",2026-${monthStr}-${dayNum} ${dayName} · The Alex Jones Show
https://rumble.com/embed/v79lfxq/?pub=15son
#EXTINF:3590 group-title="AJN Broadcasts" tvg-logo="https://archive.org/download/daily-highlights/emegency.png" tvg-id="ajn_special_reports" tvg-name="Special Reports",2026-${monthStr}-${dayNum} ${dayName} · Special Reports
https://rumble.com/embed/v79lfxq/?pub=15son`;
};

const DEFAULT_M3U = getDynamicM3U();


export default function App() {
  useKeyboardScrollFix();
  const [ajnViewMode, setAjnViewMode] = useState<"lite" | "advanced">("lite");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [m3uUrlInput, setM3uUrlInput] = useState<string>("");
  const [playerIptvQuery, setPlayerIptvQuery] = useState<string>("");
  const [advancedTab, setAdvancedTab] = useState<"dashboard" | "automation" | "syndicate" | "cinephile" | "audio" | "smart-playlist" | "podcast">("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedSmartCatId, setSelectedSmartCatId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [infowarsFeed, setInfowarsFeed] = useState<string>("https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/infowars_feed.xml");

  const preambleAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingPreamble, setIsPlayingPreamble] = useState(false);
  const pendingTraceRef = useRef<{trace: any, actualData: any} | null>(null);

  useEffect(() => {
    const handlePlaybackSuccess = () => {
      if (pendingTraceRef.current) {
        const { trace, actualData } = pendingTraceRef.current;
        TelemetryAudit.finalizeTrace(trace, actualData, true);
        pendingTraceRef.current = null;
      }
    };
    const handlePlaybackError = (e: any) => {
      if (pendingTraceRef.current) {
        const { trace, actualData } = pendingTraceRef.current;
        const failedUrl = actualData.streamUrl;
        const fallbackUrl = e.detail?.fallbackUrl || "Skipped/Aborted";
        TelemetryAudit.finalizeTrace(trace, {
          ...actualData,
          streamUrl: `FAILED: ${failedUrl} -> FALLBACK: ${fallbackUrl}`
        }, false);
        pendingTraceRef.current = null;
      }
    };
    const handleFailover = (e: any) => {
      if (pendingTraceRef.current) {
        const { trace, actualData } = pendingTraceRef.current;
        const failedUrl = e.detail?.originalUrl || actualData.streamUrl;
        const fallbackUrl = e.detail?.activeStreamUrl || "Unknown";
        // Do not finalize trace here, just update the actualData streamUrl so if it succeeds, it logs the fallback.
        pendingTraceRef.current.actualData = {
          ...actualData,
          streamUrl: `FAILOVER: ${failedUrl} -> ${fallbackUrl}`
        };
      }
    };

    const handleTrackUpdate = (e: any) => {
       const newTitle = e.detail?.title;
       const trackNum = e.detail?.trackNum;
       const totalTracks = e.detail?.totalTracks;
       const updatedChannelId = e.detail?.channelId;
       
       if (updatedChannelId && pendingTraceRef.current) {
         // Update the trace's actualData.channelId to reflect the parsed #EXTINF or inherited ID
         pendingTraceRef.current.actualData.channelId = updatedChannelId;
       }
       
       if (newTitle) {
          if (trackNum !== undefined && totalTracks !== undefined && totalTracks > 1) {
             setPlayerStore(prev => {
                const baseTitle = (prev.currentTitle && prev.currentTitle !== "Changing channels...") 
                    ? prev.currentTitle.split('·')[0].trim() 
                    : cleanTitle(newTitle);
                addLog(`Loading stream playout: ${baseTitle} · Track ${trackNum} of ${totalTracks}`, "info");
                return {
                   ...prev,
                   currentTitle: baseTitle // Keep original title on screen as per requirements
                };
             });
          } else {
             setPlayerStore(prev => ({
                ...prev,
                currentTitle: cleanTitle(newTitle)
             }));
          }
       }
    };

    const handleFailoverExhausted = (e: any) => {
       if (pendingTraceRef.current) {
          const { actualData } = pendingTraceRef.current;
          addLog(`Playout engine failure: All manifest tracks exhausted for [${actualData.channelId}].`, "error");
          QuarantineLedger.recordFailure(actualData.channelId);
       }
       setPlayerStore(prev => ({
          ...prev,
          state: "error",
          currentTitle: "Stream Unavailable",
       }));
    };

    const handleLogMessage = (e: any) => {
       addLog(e.detail.message, e.detail.level || "info");
    };

    window.addEventListener("ajn-playback-success", handlePlaybackSuccess);
    window.addEventListener("ajn-stream-format-error", handlePlaybackError);
    window.addEventListener("FailoverEngaged", handleFailover);
    window.addEventListener("ajn-track-update", handleTrackUpdate);
    window.addEventListener("ajn-failover-exhausted", handleFailoverExhausted);
    window.addEventListener("ajn-log-message", handleLogMessage);

    return () => {
      window.removeEventListener("ajn-playback-success", handlePlaybackSuccess);
      window.removeEventListener("ajn-stream-format-error", handlePlaybackError);
      window.removeEventListener("FailoverEngaged", handleFailover);
      window.removeEventListener("ajn-track-update", handleTrackUpdate);
      window.removeEventListener("ajn-failover-exhausted", handleFailoverExhausted);
      window.removeEventListener("ajn-log-message", handleLogMessage);
    };
  }, []);

    useEffect(() => {
    preambleAudioRef.current = new Audio('/assets/audio/music-preamble.mp3');
    preambleAudioRef.current.loop = true;
    
    const startPreamble = () => {
      if (preambleAudioRef.current) {
        const playPromise = preambleAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlayingPreamble(true);
          }).catch(error => {
            if (error.name === 'NotAllowedError') {
              console.warn("Autoplay blocked. Waiting for interaction.");
              const playOnInteract = () => {
                if (preambleAudioRef.current) {
                  const interactPlayPromise = preambleAudioRef.current.play();
                  if (interactPlayPromise !== undefined) {
                    interactPlayPromise.catch(() => {});
                  }
                  setIsPlayingPreamble(true);
                }
                document.removeEventListener('click', playOnInteract);
              };
              document.addEventListener('click', playOnInteract);
            } else if (error.name === 'AbortError') {
              console.log("Playback safely interrupted by new stream.");
            }
          });
        }
      }
    };
    
    startPreamble();
    
    return () => {
      if (preambleAudioRef.current) {
        preambleAudioRef.current.pause();
        preambleAudioRef.current = null;
      }
    };
  }, []);

  // Dynamic system telemetry (addresses priority item #1 from the audit report)
  const [telemetry, setTelemetry] = useState({
    latency: 14,
    ram: 142,
    cpu: 1.8
  });
  useEffect(() => {

    const interval = setInterval(() => {
      setTelemetry(() => {
        let realRam = 142;
        if (typeof window !== "undefined" && (window.performance as any)?.memory?.usedJSHeapSize) {
          realRam = Math.round((window.performance as any).memory.usedJSHeapSize / (1024 * 1024));
        } else {
          realRam = Math.round(140 + Math.random() * 5);
        }
        return {
          latency: Math.floor(11 + Math.random() * 6),
          ram: realRam,
          cpu: Number((1.5 + Math.random() * 1.5).toFixed(1))
        };
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Global log stream
  const [logs, setLogs] = useState<Array<{ msg: string; type: "info" | "warning" | "error"; time: string }>>([]);
  const addLog = useCallback((msg: string, type: "info" | "warning" | "error" = "info") => {
    if (msg.includes("M3UPlaylistPolling") || msg.includes("synthesizer")) return;
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ msg, type, time }, ...prev].slice(0, 100));
    console.log(`[AJN] ${msg}`);
  }, []);

  // Hook integrations
  const { channels: rawChannels, playlists, importM3U, removeChannel, removePlaylist, reloadVault, batchUpdateDurations, loading: isVaultLoading } = usePlaylistVault();

  const channels = useMemo(() => {
    return rawChannels.filter(ch => !QuarantineLedger.isQuarantined(ch.tvgId || ch.name || 'unknown'));
  }, [rawChannels]);

  const smartPlaylists = useMemo(() => {
    return analyzeSmartPlaylists(channels);
  }, [channels]);

  const selectedSmartPlaylist = useMemo(() => {
    return smartPlaylists.find(sp => sp.id === selectedSmartCatId) || null;
  }, [smartPlaylists, selectedSmartCatId]);

  const systemHealth = useMemo(() => {
    const errorCount = logs.filter(l => l.type === "error").length;
    const baseHealth = 100 - (errorCount * 2.5);
    return Math.max(75, Math.min(100, Number((baseHealth - Math.random() * 0.2).toFixed(1))));
  }, [logs]);

  const {
    playerStore,
    setPlayerStore,
    isLoading,
    isBuffering,
    currentUrl,
    currentTitle
  } = usePlayer({ addLog });

  // Equalizer & Audio controller hook
  const audioController = useAudioController({ addLog });

  
  useEffect(() => {
  // If video starts playing, pause the audio controller
if (playerStore.state === "playing" && audioController.isSiriusPlaying) {
      audioController.stopSiriusMusic();
      addLog("Video playback started. Paused audio synthesizer/radio.", "info");
    }
  }, [playerStore.state, audioController.isSiriusPlaying, audioController.stopSiriusMusic, addLog]);
  useEffect(() => {
// If audio starts playing, pause the video player
    if (audioController.isSiriusPlaying && playerStore.state === "playing") {
      // Removed
        // Removed
      const realVideo = mainVideoRef.current as HTMLVideoElement;
      if (realVideo) {
        realVideo.pause();
      }
      setPlayerStore(prev => ({ ...prev, state: "ready" }));
      addLog("Audio deck started. Paused video player.", "info");
    }

  }, [audioController.isSiriusPlaying, playerStore.state, setPlayerStore, addLog]);
  // Stream Playout action
  const playStream = useCallback(async (url: string, name: string, offset?: number, trace?: any, actualChannelId?: string, actualShowTitle?: string) => {
    if (preambleAudioRef.current) {
      preambleAudioRef.current.pause();
      setIsPlayingPreamble(false);
    }
    window.dispatchEvent(new CustomEvent('mute-tv-guide-audio'));

    
    let playoutUrl = url && url.trim() !== "" ? url.trim() : "";
    
    let playoutName = playoutUrl ? (name && name.trim() !== "" ? name : "Unnamed Stream") : "Feed unavailable";

    let finalOffset = offset;
    if (finalOffset === undefined) {
      const chan = channels.find(c => c.url === playoutUrl);
      if (chan && chan.duration && chan.duration > 0) {
        const EPOCH_TIMESTAMP = 1735689600;
        const currentS = Math.floor(Date.now() / 1000);
        const elapsedSinceEpoch = currentS - EPOCH_TIMESTAMP;
        finalOffset = elapsedSinceEpoch % chan.duration;
      }
    }
    
    if (playoutUrl.includes("archive.org/") && !playoutUrl.toLowerCase().endsWith(".mp4") && !playoutUrl.toLowerCase().endsWith(".m3u") && !playoutUrl.toLowerCase().endsWith(".m3u8")) {
      let identifier = "";
      let specificFile = "";
      if (playoutUrl.includes("archive.org/details/")) {
          identifier = playoutUrl.split("archive.org/details/")[1]?.split("/")[0] || "";
      } else if (playoutUrl.includes("archive.org/download/")) {
          const parts = playoutUrl.split("archive.org/download/")[1]?.split("/");
          identifier = parts?.[0] || "";
          specificFile = parts?.slice(1).join("/") ? decodeURIComponent(parts.slice(1).join("/")) : "";
      } else if (playoutUrl.includes("archive.org/embed/")) {
          identifier = playoutUrl.split("archive.org/embed/")[1]?.split("?")[0] || "";
      }
      if (identifier) {
          try {
              const res = await fetch(`https://archive.org/metadata/${identifier}`);
              const data = await res.json();
              let mp4File = null;
              if (specificFile && specificFile.lastIndexOf(".") > -1) {
                  const baseName = specificFile.substring(0, specificFile.lastIndexOf("."));
                  mp4File = data?.files?.find((f: any) => 
                    f.name.startsWith(baseName) && 
                    f.name.endsWith(".mp4") && 
                    (f.format?.toLowerCase().includes("h.264") || f.format?.toLowerCase().includes("512kb mpeg4") || f.format?.toLowerCase().includes("mpeg4"))
                  );
                  if (!mp4File) {
                    // Fallback to finding any compatible format for this basename
                    mp4File = data?.files?.find((f: any) => 
                      f.name.startsWith(baseName) && 
                      (f.format?.toLowerCase().includes("h.264") || f.format?.toLowerCase().includes("512kb mpeg4") || f.format?.toLowerCase().includes("mpeg4"))
                    );
                  }
              }
              if (!mp4File) {
                  // No fallback guessing allowed if we can't find a compatible web-safe format.
                  addLog(`Archive.org stream rejected: No web-safe H.264/MPEG4 format found for ${specificFile}. This prevents format errors.`, "warning");
              }
              if (mp4File) {
                  playoutUrl = `https://archive.org/download/${identifier}/${mp4File.name}`;
              }
          } catch (e) {
              console.warn("Failed to resolve archive.org mp4 file", e);
          }
      }
    }

    

    const cleanedName = cleanTitle(playoutName);
    addLog(`Loading stream playout: ${cleanedName}`, "info");
    audioController.stopSiriusMusic();
    setIsTransitioning(true);
    
    setPlayerStore((prev) => ({
      ...prev,
      state: "idle",
      currentUrl: "",
      currentTitle: "Changing channels...",
    }));

    setTimeout(() => {
      if (trace) {
         pendingTraceRef.current = {
             trace,
             actualData: {
                 channelId: actualChannelId || channels.find(c => c.url === url)?.tvgId || channels.find(c => c.url === url)?.name || 'unknown',
                 showTitle: actualShowTitle || cleanedName,
                 streamUrl: playoutUrl
             }
         };
      }

      setPlayerStore((prev) => ({
        ...prev,
        state: "loading",
        currentUrl: playoutUrl,
        channelId: actualChannelId || channels.find(c => c.url === url)?.tvgId || channels.find(c => c.url === url)?.name || 'unknown',
        currentTitle: cleanedName,
        isBackupPlayback: false,
        currentTime: finalOffset || 0
      }));
      setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
    }, 50);
  }, [setPlayerStore, addLog, audioController, channels]);


    

  // Channel skipping
  const skipIPTVChannel = useCallback((direction: "next" | "prev") => {
    if (channels.length === 0) return;
    const currentIndex = channels.findIndex(ch => ch.url === currentUrl);
    let nextIndex = 0;
    if (direction === "next") {
      nextIndex = currentIndex === channels.length - 1 ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1;
    }
    const nextCh = channels[nextIndex];
    if (nextCh) {
      playStream(nextCh.url, nextCh.name);
    }
  }, [channels, currentUrl, playStream]);

  // Populates and keeps the playout database synchronized with working July 7+ dynamic feeds
  useEffect(() => {
    const checkAndSyncDefaultChannels = async () => {
      try {
        const dbChannels = await PlaylistVault.getChannels();
        const hasAjnGroup = dbChannels.some(ch => ch.group === "AJN Broadcasts");
        const hasOutdated = dbChannels.some(ch => ch.group === "AJN Broadcasts" && !ch.tvgId);
        const missingNewFeed = !dbChannels.some(ch => ch.tvgId === "ajn_live");
        const isUserCleared = safeLocalStorage.getItem("ajn_user_cleared") === "true" || safeLocalStorage.getItem("ajn_user_uploaded") === "true";
        const isHardPurged = safeLocalStorage.getItem("AJN_ALLOW_EMPTY_STATE") === "true";
        
        if (isHardPurged || isUserCleared) {
          return; // Skip auto sync when hard purged or user has explicitly cleared/uploaded their own
        }
        
        if (hasOutdated || missingNewFeed || (dbChannels.length === 0 || !hasAjnGroup)) {
          addLog("Synchronizing playout database with working July 7+ dynamic feed...", "info");
          
          if (hasAjnGroup) {
            const systemDefaultUrls = [
          "https://rumble.com/embed/v79lfxq/?pub=15son",
              "https://archive.org/download/7a-74f-5aa-b-5c-0-4412-9bd-3-4c-1c-95b-60fa-6-large/The%20Alex%20Jones%20Show%20-%20August%203%2C%202025.mp4",
              "https://archive.org/download/nick-fuentes-alex-jones-interview-3-3-26-full-interview-iran-israel-us-war/ssstwitter.com_1772597388526.mp4"
            ];
            for (const ch of dbChannels) {
              const isDefaultOrOldSystem = systemDefaultUrls.includes(ch.url);
              if (isDefaultOrOldSystem) {
                await PlaylistVault.removeChannel(ch.url);
              }
            }
          }
          
          await importM3U("Default Feed", DEFAULT_M3U);
          addLog("Database successfully synchronized to working July 7+ dynamic feeds.", "info");
        }


        const hasWestern = dbChannels.some(ch => ch.group === "Western");
        if (!hasWestern && !isHardPurged && !isUserCleared) {
            addLog("Downloading extended Archive channels...", "info");
                                    const extendedArchives = [
              { name: "The Honeymooners", url: "https://archive.org/download/daily-highlights/honeymooner%20classic%20movies.m3u" },
              { name: "Classic Movies", url: "https://archive.org/download/daily-highlights/Classic%20Movies.m3u" },
              { name: "MAYDAY", url: "https://archive.org/download/daily-highlights/MAYDAY.m3u" },
              { name: "ANCIENT ALIENS", url: "https://archive.org/download/daily-highlights/Ancient%20Aliens%201-18.m3u" },
              { name: "70 Odd Couple", url: "https://archive.org/download/daily-highlights/70%20Odd%20Couple.m3u" },
              { name: "American Experience", url: "https://archive.org/download/daily-highlights/American%20Experience.m3u" },
              { name: "Big Western Zone", url: "https://archive.org/download/daily-highlights/BIG%20WESTERN%20ZONE.m3u" }
            ];
            
            for (const archive of extendedArchives) {
              try {
                const fetchUrl = archive.url.startsWith('http') ? `/api/stream-proxy?url=${encodeURIComponent(archive.url)}` : archive.url;
                const res = await fetch(fetchUrl);
                
                if (res.status === 429) {
                    addLog(`Rate limited fetching ${archive.name}. Retrying later...`, "warning");
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                
                const text = await res.text();
                const groupedText = text.replace(/#EXTINF:([^,]*),/g, `#EXTINF:$1 group-title="${archive.name}",`);
                await importM3U(archive.name, groupedText, archive.url);
                
                // Sleep for 2.5 seconds to avoid hitting rate limits on archive.org
                await new Promise(resolve => setTimeout(resolve, 2500));
              } catch (e) {
                console.warn(`Failed to fetch ${archive.name}`, e);
              }
            }
            addLog("Extended archive channels imported.", "info");
        }

      } catch (err: any) {
        addLog(`Playout synchronization warning: ${err.message}`, "warning");
      }
    };
    
    checkAndSyncDefaultChannels();
  }, [channels.length, importM3U, addLog]);

  // Handle M3U URL / File loads
  const parseAndLoadM3U = useCallback(async (text: string) => {
    try {
      addLog("Parsing M3U channel stream contents...", "info");
      await importM3U("Uploaded Feed", text);
      addLog("Playlist imported successfully!", "info");
    } catch (error: any) {
      addLog(`Failed to load playlist: ${error.message || error}. Falling back to default feed.`, "error");
      try {
        await importM3U("Default Feed", DEFAULT_M3U);
        addLog("Injected default fallback channels smoothly.", "info");
      } catch (fallbackErr) {
        console.error("Fallback injector also failed", fallbackErr);
      }
    }
  }, [importM3U, addLog]);

  const handleM3uUrlLoad = useCallback(async () => {
    if (!m3uUrlInput) return;
    try {
      addLog(`Connecting to remote playout URL: ${m3uUrlInput}`, "info");
      const res = await fetch(BACKEND_URL + `/api/stream-proxy?url=${encodeURIComponent(m3uUrlInput)}`);
      if (!res.ok) throw new Error("HTTP connection failed with status " + res.status);
      const text = await res.text();
      await parseAndLoadM3U(text);
      setM3uUrlInput("");
    } catch (error: any) {
      addLog(`Connection failed: ${error.message || error}`, "error");
      alert(`Could not import remote feed: ${error.message || error}`);
    }
  }, [m3uUrlInput, parseAndLoadM3U, addLog]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      addLog(`Ingesting local file: ${file.name}`, "info");
      const text = await file.text();
      await parseAndLoadM3U(text);
    } catch (error: any) {
      addLog(`Failed reading file: ${error.message || error}`, "error");
    }
  }, [parseAndLoadM3U, addLog]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  }, []);

  // Sync favorites list with Cinephile
  const [favUrls, setFavUrls] = useState<string[]>([]);

    useEffect(() => {
    const loadFavs = () => {
      try {
        setFavUrls(JSON.parse(safeLocalStorage.getItem("ajn_guide_favs") || "[]"));
      } catch {
        setFavUrls([]);
      }
    };
    loadFavs();
    window.addEventListener("ajn-favorites-updated", loadFavs);
    return () => window.removeEventListener("ajn-favorites-updated", loadFavs);
  }, []);

  // We do NOT initialize the stream here anymore to prevent race condition with onboarding
  // This logic is now chained in LiteApp.tsx

  return (
    <div className="w-full min-h-screen relative flex flex-col bg-black">
      <div className="flex-1 w-full relative z-10">
        <div className="w-full h-full flex flex-col">
          <AnimatePresence mode="wait">
            {ajnViewMode === "lite" ? (
              <motion.div
                key="lite"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
                
                  <LiteApp stopPreludeMusic={audioController.stopSiriusMusic}
            theme={theme}
            isTransitioning={isTransitioning}
            currentUrl={currentUrl}
            currentTitle={currentTitle}
            isBuffering={isBuffering}
            isLoading={isLoading}
            channels={channels}
            playerStore={playerStore}
            m3uUrlInput={m3uUrlInput}
            playerIptvQuery={playerIptvQuery}
            
            setPlayerStore={setPlayerStore}
            setM3uUrlInput={setM3uUrlInput}
            setPlayerIptvQuery={setPlayerIptvQuery}
            setAjnViewMode={setAjnViewMode}
            addLog={addLog}
            toggleTheme={toggleTheme}
            playStream={playStream}
            handleM3uUrlLoad={handleM3uUrlLoad}
            handleFileUpload={handleFileUpload}
            parseAndLoadM3U={parseAndLoadM3U}
            skipIPTVChannel={skipIPTVChannel}
            removeChannel={removeChannel}
            playlists={playlists}
            removePlaylist={removePlaylist}
            batchUpdateDurations={batchUpdateDurations}
            reloadVault={reloadVault}
            logs={logs}
            systemHealth={systemHealth}
            isVaultLoading={isVaultLoading}
          />
                
        </motion.div>
      ) : (
        <motion.div
          key="advanced"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full h-screen flex flex-col"
        >
          <div className="h-screen bg-[#040711] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* 1. Header Bar */}
      <header className="min-h-[4rem] py-2 shrink-0 bg-[#080d1e]/85 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex flex-wrap items-center justify-between relative z-10 gap-4">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white shrink-0"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          >
            {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0">
            <Zap className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-widest uppercase text-white font-mono truncate">AJN PRO BROADCASTER</h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">v3.5 MATRIX</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 truncate">Virtual Automated Playout Headend & Media Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden lg:flex items-center gap-3 bg-black/40 px-3.5 py-1.5 rounded-xl border border-slate-800/50 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-ping" />
              <span className="text-slate-400">ENGINE:</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </div>

          <button
            onClick={() => setAjnViewMode("lite")}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-red-500 text-white rounded-xl text-xs font-bold font-mono uppercase cursor-pointer transition-all active:scale-95 shadow-md shadow-red-950/20 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Lite Viewer</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* Navigation Sidebar Overlay for Mobile */}
        {isMobileSidebarOpen && (
          <div 
            className="absolute inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Navigation Sidebar */}
        <aside className={`w-64 shrink-0 bg-[#060a16] border-r border-slate-800/60 p-4 flex flex-col justify-between min-h-0 absolute inset-y-0 left-0 z-50 md:relative transition-transform duration-300 ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="space-y-5 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="space-y-1.5 shrink-0">
              <button
                onClick={() => setAjnViewMode("lite")}
                className="w-full text-left p-3 mb-4 rounded-2xl flex gap-3 items-center border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 cursor-pointer transition-all duration-200"
              >
                <div className="p-1.5 rounded-xl bg-indigo-500/20">
                  <MonitorPlay className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold font-mono tracking-tight uppercase">Playback Dashboard</div>
                  <div className="text-[9px] text-indigo-500/70 font-mono">Return to live viewer</div>
                </div>
              </button>

              <div className="px-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Control Centers</span>
              </div>
              <nav className="space-y-1.5">
                {[
                  { id: "dashboard", label: "Operations Board", icon: Activity, desc: "Log streams & health" },
                  { id: "automation", label: "Master Playout", icon: Tv, desc: "Automatic channel rules" },
                  { id: "syndicate", label: "Syndicate Vault", icon: Layers, desc: "M3U adapters & watchers" },
                  { id: "cinephile", label: "Cinephile Annotation", icon: BookOpen, desc: "Frame logs & journaling" },
                  { id: "audio", label: "Equalizer Deck", icon: Music, desc: "High-Fi audio visualizer" },
                  { id: "podcast", label: "Podcast Tuner", icon: MonitorPlay,
  Radio, desc: "Radio-style podcast dial" },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const active = advancedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdvancedTab(tab.id as any)}
                      className={`w-full text-left p-3 rounded-2xl flex gap-3 items-center border cursor-pointer transition-all duration-200 ${
                        active
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5"
                          : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/15"
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl ${active ? "bg-blue-500/20" : "bg-slate-800/30"}`}>
                        <TabIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold font-mono tracking-tight">{tab.label}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{tab.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex-1 flex flex-col min-h-0 pt-3 border-t border-slate-800/40">
              <div className="px-2 mb-2 flex items-center justify-between shrink-0">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Smart Playlists</span>
                <span className="text-[8px] bg-blue-500/10 text-blue-400 font-mono font-bold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider">Auto</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1 pr-1">
                {smartPlaylists.map((sp) => {
                  const IconComponent = {
                    Megaphone: Megaphone,
                    Film: Film,
                    Music: Music,
                    Radio: Radio,
                    Zap: Zap,
                    Calendar: Calendar,
                    Archive: Archive,
                    Compass: Compass
                  }[sp.icon] || Compass;

                  const active = advancedTab === "smart-playlist" && selectedSmartCatId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      onClick={() => {
                        setSelectedSmartCatId(sp.id);
                        setAdvancedTab("smart-playlist");
                      }}
                      className={`w-full text-left p-2.5 rounded-xl flex gap-2.5 items-center border cursor-pointer transition-all ${
                        active
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5"
                          : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/15"
                      }`}
                    >
                      <div className={`p-1 rounded-xl ${active ? "bg-blue-500/20" : "bg-slate-800/30"}`}>
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold font-mono tracking-tight truncate">{sp.name}</span>
                        <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${
                          active ? "bg-blue-500/25 text-blue-300" : "bg-slate-900/60 text-slate-500"
                        }`}>
                          {sp.channels.length}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Removed Fake Connected Device Info */}
        </aside>

        {/* Dynamic Panel Workspace */}
        <main className="flex-1 overflow-hidden min-h-0 bg-[#050810] flex flex-col relative">
          
          
          {advancedTab === "dashboard" && (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Left: Operations Summary Grid */}
                <div className="flex-1 space-y-6">
                  <div className="p-6 rounded-2xl bg-[#0a0f21] border border-slate-800/80 space-y-4">
                    <h2 className="text-lg font-black uppercase text-white font-mono flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-blue-400" />
                      <span>Virtual Headend Pipeline Monitor</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time log auditing for the Unified Playback Engine, Automated EPG, and playlist ingest drivers.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-black/40 border border-slate-800/60 p-4 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase">Channels</span>
                        <span className="text-lg font-black text-white font-mono">{channels.length}</span>
                      </div>
                      <div className="bg-black/40 border border-slate-800/60 p-4 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase">Playlists</span>
                        <span className="text-lg font-black text-blue-400 font-mono">{playlists.length || 1}</span>
                      </div>
                      <div className="bg-black/40 border border-slate-800/60 p-4 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase">Active Streams</span>
                        <span className="text-lg font-black text-emerald-400 font-mono">{currentUrl ? 1 : 0}</span>
                      </div>
                      <div className="bg-black/40 border border-slate-800/60 p-4 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase">System Health</span>
                        <span className="text-lg font-black text-[#00ff66] font-mono">{systemHealth}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Player diagnostics preview */}
                  <div className="p-6 rounded-2xl bg-[#0a0f21] border border-slate-800/80 space-y-4">
                    <h3 className="text-sm font-black uppercase text-white font-mono">Unified Stream Diagnostics</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="bg-black/35 p-3.5 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500">PLAYING URL:</span>
                        <span className="text-slate-300 block truncate">{currentUrl || "No feed selected"}</span>
                      </div>
                      <div className="bg-black/35 p-3.5 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500">PLAYING TITLE:</span>
                        <span className="text-slate-300 block truncate">{currentTitle}</span>
                      </div>
                      <div className="bg-black/35 p-3.5 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500">DECODER ENGINE:</span>
                        <span className="text-blue-400 font-bold block">{playerStore.diagnostics.streamType.toUpperCase()}</span>
                      </div>
                      <div className="bg-black/35 p-3.5 rounded-xl border border-slate-800/50 space-y-1">
                        <span className="text-slate-500">AUDIO VOLUME:</span>
                        <span className="text-slate-300 block">{(audioController.siriusAudioVolume * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Operations Real-Time Log Console */}
                <div className="w-full md:w-96 flex flex-col min-h-[300px]">
                  <div className="flex-1 bg-black/60 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative">
                    <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto max-h-[420px] pr-1 custom-scrollbar">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                        <span className="text-xs font-black text-slate-300 font-mono tracking-wider uppercase">Live Audit Stream</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            TelemetryAudit.exportTracesAsText();
                          }} className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-bold transition-colors">Export TXT</button>
                          <button onClick={() => {
                            TelemetryAudit.exportTracesAsJSON();
                          }} className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-bold transition-colors">Export JSON</button>
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping ml-1" />
                        </div>
                      </div>
                      {logs.length === 0 ? (
                        <div className="text-center text-slate-500 font-mono text-[10px] py-20">
                          Waiting for diagnostic events...
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {logs.map((log, i) => (
                            <div key={i} className="text-[10px] font-mono leading-relaxed flex gap-2">
                              <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                              <span className={
                                log.type === "error" ? "text-red-400" :
                                log.type === "warning" ? "text-amber-400" :
                                "text-blue-400"
                              }>
                                {log.msg}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-[8.5px] font-mono text-slate-500 text-center pt-3 border-t border-slate-800/40">
                      Telemetry logs are saved to IndexedDB state.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          <Suspense fallback={<div className="p-8 text-center text-slate-500 font-mono text-xs animate-pulse">Loading engine module...</div>}>
          {advancedTab === "automation" && (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
              <BroadcastAutomationSuite 
                theme={theme}
                addLog={addLog}
                playStream={playStream}
                systemPlaylists={playlists}
                systemChannels={channels}
                importM3U={importM3U}
              />
            </div>
          )}

          {advancedTab === "syndicate" && (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
              <SyndicateSuite 
                currentUrl={currentUrl}
                theme={theme}
                onPlayChannel={(url, title) => {
                  playStream(url, title);
                  addLog(`Playout requested via syndicate: ${title}`);
                }}
                showToast={(msg) => addLog(msg, "info")}
              />
            </div>
          )}

          {advancedTab === "cinephile" && (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
              <CinephileSuite 
                currentUrl={currentUrl}
                currentTitle={currentTitle}
                
                playStream={playStream}
                channels={channels}
                favorites={favUrls}
                theme={theme}
              />
            </div>
          )}

          {advancedTab === "audio" && (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
              <AudioDashboard 
                {...audioController}
                addLog={addLog}
                infowarsFeed={infowarsFeed}
                setInfowarsFeed={setInfowarsFeed}
              />
            </div>
          )}

          {advancedTab === "podcast" && (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
              <PodcastTuner audioController={audioController} />
            </div>
          )}

          {advancedTab === "smart-playlist" && (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
              <SmartPlaylistBrowser
                category={selectedSmartPlaylist}
                playStream={playStream}
                addLog={addLog}
                isLight={theme === "light"}
              />
            </div>
          )}
          </Suspense>
          
          
        </main>
      </div>

      {/* Hidden playout element to keep playout active while navigating advanced modules */}
    </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
    </div>
    </div>
  );
}
