import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SiriusTrack, RadioStation, AudioTrack } from "../types";
import { safeLocalStorage } from "../utils/safeStorage";
import { usePlaybackSettings } from "./usePlaybackSettings";
import { useMediaSession } from "./useMediaSession";
import { wakeAudioChannel } from "../utils/audioUtils";
import { registerVideo } from "../utils/videoRef";

export interface AudioControllerProps {
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
  initialPlaylist?: SiriusTrack[];
}

export function useAudioController({ addLog, initialPlaylist }: AudioControllerProps) {
  const defaultPlaylist: SiriusTrack[] = initialPlaylist || [
    {
      title: "Sirius",
      artist: "The Alan Parsons Project",
      url: "https://ia902907.us.archive.org/31/items/capture-25-april-2026-03-06-58-pm-00000/The%20Alan%20Parsons%20Project%20-%20Sirius%20%28Official%20Audio%29.mp3",
      backups: [
        "https://archive.org/download/the-alan-parsons-project-sirius_202111/The%20Alan%20Parsons%20Project%20-%20Sirius.mp3",
        "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/The%20Alan%20Parsons%20Project%20-%20Sirius%20(Official%20Audio).mp3"
      ]
    },
    {
      title: "Ace of Spades",
      artist: "LMBSA",
      url: "https://ia902907.us.archive.org/31/items/capture-25-april-2026-03-06-58-pm-00000/LMBSA%20-%20Ace%20of%20Spades.mp3",
      backups: [
        "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/Motorhead%20-%20Ace%20Of%20Spades%20(Official%20Audio).mp3",
        "https://archive.org/download/motorhead-ace-of-spades-official-audio/Motorhead%20-%20Ace%20Of%20Spades%20%28Official%20Audio%29.mp3"
      ]
    },
    {
      title: "Remember the Fallen",
      artist: "LMBSA",
      url: "https://ia902907.us.archive.org/31/items/capture-25-april-2026-03-06-58-pm-00000/Remember%20the%20Fallen.mp3",
      backups: [
        "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/Sodom%20-%20Remember%20The%20Fallen%20(Official%20Audio).mp3",
        "https://archive.org/download/sodom-remember-the-fallen-official-audio/Sodom%20-%20Remember%20The%20Fallen%20%28Official%20Audio%29.mp3"
      ]
    }
  ];

  const { settings, updateSettings } = usePlaybackSettings();
  const { autoAdvance, loopPlaylist, shuffleMode } = settings;

  const [queue, setQueueState] = useState<AudioTrack[]>(() => {
    return defaultPlaylist.map(t => ({
      title: t.title,
      artist: t.artist,
      url: t.url,
      backups: t.backups,
      sourceType: "sirius"
    }));
  });

  const siriusPlaylist = queue;

  const [currentSiriusTrackIndex, setCurrentSiriusTrackIndex] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_current_track_index");
    if (saved) {
      const idx = parseInt(saved, 10);
      if (idx >= 0 && idx < defaultPlaylist.length) return idx;
    }
    return 0;
  });

  const [playedIndices, setPlayedIndices] = useState<number[]>([]);

  const queueProgress = useMemo(() => {
    return {
      played: playedIndices.length,
      total: queue.length
    };
  }, [playedIndices.length, queue.length]);

  // Load persisted states or fallback to defaults
  const [siriusPreset, setSiriusPresetState] = useState<"neutral" | "heavy" | "vocal" | "metal">(() => {
    return (safeLocalStorage.getItem("sirius_preset") as any) || "neutral";
  });
  const [siriusLowBass, setSiriusLowBassState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_low_bass");
    return saved ? parseInt(saved, 10) : 50;
  });
  const [siriusBass, setSiriusBassState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_bass");
    return saved ? parseInt(saved, 10) : 50;
  });
  const [siriusVocalMid, setSiriusVocalMidState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_vocal_mid");
    return saved ? parseInt(saved, 10) : 50;
  });
  const [siriusHighMid, setSiriusHighMidState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_high_mid");
    return saved ? parseInt(saved, 10) : 50;
  });
  const [siriusTreble, setSiriusTrebleState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_treble");
    return saved ? parseInt(saved, 10) : 50;
  });
  const [siriusPlaybackRate, setSiriusPlaybackRateState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_playback_rate");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [siriusVisualizerMode, setSiriusVisualizerModeState] = useState<"eq" | "wave" | "fire" | "matrix">(() => {
    return (safeLocalStorage.getItem("sirius_visualizer_mode") as any) || "eq";
  });
  const [siriusAudioVolume, setSiriusAudioVolumeState] = useState<number>(() => {
    const saved = safeLocalStorage.getItem("sirius_audio_volume");
    return saved ? parseFloat(saved) : 0.45;
  });
  const [isSiriusMuted, setIsSiriusMutedState] = useState<boolean>(() => {
    return safeLocalStorage.getItem("sirius_muted") === "true";
  });
  const [isSiriusLooping, setIsSiriusLoopingState] = useState<boolean>(() => {
    return safeLocalStorage.getItem("sirius_looping") === "true";
  });

  const [activeRadioStation, setActiveRadioStation] = useState<RadioStation | null>(null);
  const [isSiriusOverlayOpen, setIsSiriusOverlayOpen] = useState(true);
  const [isSiriusPlaying, setIsSiriusPlaying] = useState(false);
  const [siriusCurrentTime, setSiriusCurrentTime] = useState(0);
  const [siriusDuration, setSiriusDuration] = useState(0);

  // Audio Output Device Selection States (Prompt 3)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedSinkId, setSelectedSinkIdState] = useState<string>(() => {
    return safeLocalStorage.getItem("ajn_selected_sink_id") || "";
  });

  // References
  const siriusAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);

  if (!siriusAudioRef.current && typeof window !== "undefined") {
    const audio = new Audio();
    audio.volume = siriusAudioVolume;
    audio.muted = isSiriusMuted;
    audio.crossOrigin = "anonymous";
    siriusAudioRef.current = audio;
  }
  
  useEffect(() => {
    if (siriusAudioRef.current && !audioCleanupRef.current) {
      // Audio needs to be exclusive so playing it pauses Video and playing Video pauses Audio
      audioCleanupRef.current = registerVideo(siriusAudioRef.current, { exclusive: true });
    }
    return () => {
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
        audioCleanupRef.current = null;
      }
    };
  }, []);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const siriusAudioCtxRef = useRef<AudioContext | null>(null);
  const siriusAnalyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const siriusCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const siriusTabCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const siriusCanvasHeightsRef = useRef<number[]>(new Array(120).fill(0));
  const siriusPeakHeightsRef = useRef<number[]>(new Array(120).fill(0));
  const siriusPeakDecayRef = useRef<number[]>(new Array(120).fill(0));
  const siriusPhaseRef = useRef<number>(0);
  const siriusBackupIndexRef = useRef<number>(-1);
  const lastSavedPositionTimeRef = useRef<number>(0);
  const prevDevicesRef = useRef<MediaDeviceInfo[]>([]);

  // Wrapped State Setters that also persist to localStorage
  const setSiriusPreset = useCallback((preset: "neutral" | "heavy" | "vocal" | "metal") => {
    setSiriusPresetState(preset);
    safeLocalStorage.setItem("sirius_preset", preset);
  }, []);

  const setSiriusLowBass = useCallback((val: number) => {
    setSiriusLowBassState(val);
    safeLocalStorage.setItem("sirius_low_bass", val.toString());
  }, []);

  const setSiriusBass = useCallback((val: number) => {
    setSiriusBassState(val);
    safeLocalStorage.setItem("sirius_bass", val.toString());
  }, []);

  const setSiriusVocalMid = useCallback((val: number) => {
    setSiriusVocalMidState(val);
    safeLocalStorage.setItem("sirius_vocal_mid", val.toString());
  }, []);

  const setSiriusHighMid = useCallback((val: number) => {
    setSiriusHighMidState(val);
    safeLocalStorage.setItem("sirius_high_mid", val.toString());
  }, []);

  const setSiriusTreble = useCallback((val: number) => {
    setSiriusTrebleState(val);
    safeLocalStorage.setItem("sirius_treble", val.toString());
  }, []);

  const setSiriusPlaybackRate = useCallback((rate: number) => {
    setSiriusPlaybackRateState(rate);
    safeLocalStorage.setItem("sirius_playback_rate", rate.toString());
    if (siriusAudioRef.current) {
      siriusAudioRef.current.playbackRate = rate;
    }
  }, []);

  const setSiriusVisualizerMode = useCallback((mode: "eq" | "wave" | "fire" | "matrix") => {
    setSiriusVisualizerModeState(mode);
    safeLocalStorage.setItem("sirius_visualizer_mode", mode);
  }, []);

  const setSiriusAudioVolume = useCallback((vol: number) => {
    setSiriusAudioVolumeState(vol);
    safeLocalStorage.setItem("sirius_audio_volume", vol.toString());
    if (siriusAudioRef.current) {
      siriusAudioRef.current.volume = vol;
    }
  }, []);

  const setIsSiriusMuted = useCallback((muted: boolean) => {
    setIsSiriusMutedState(muted);
    safeLocalStorage.setItem("sirius_muted", muted ? "true" : "false");
    if (siriusAudioRef.current) {
      siriusAudioRef.current.muted = muted;
    }
  }, []);

  const setIsSiriusLooping = useCallback((loop: boolean) => {
    setIsSiriusLoopingState(loop);
    safeLocalStorage.setItem("sirius_looping", loop ? "true" : "false");
  }, []);

  // Control Actions
  const playSiriusTrack = useCallback((index: number) => {
    setActiveRadioStation(null);
    siriusBackupIndexRef.current = -1;
    setCurrentSiriusTrackIndex(index);
    safeLocalStorage.setItem("sirius_current_track_index", index.toString());
  }, []);

  const stopSiriusMusic = useCallback(() => {
    console.trace("stopSiriusMusic called");
    if (siriusAudioRef.current) {
      siriusAudioRef.current.pause();
    }
    setIsSiriusPlaying(false);
    addLog("Synthesizer console paused.");
  }, [addLog]);

  const startSiriusMusic = useCallback(async () => {
    // Bluetooth latency wake (Prompt 6)
    await wakeAudioChannel();

    if (siriusAudioRef.current) {
      if (activeRadioStation) {
        // Reload live stream to prevent stuck buffers after pause
        siriusAudioRef.current.src = activeRadioStation.url;
        siriusAudioRef.current.load();
      }
      try {
        await siriusAudioRef.current.play();
        setIsSiriusPlaying(true);
        addLog("Synthesizer console active.");
      } catch (e) {
        addLog("Audio play blocked by browser. Click the play button.", "warning");
      }
    }
  }, [addLog, activeRadioStation]);

  const playRadioStation = useCallback(async (stationId: string, name: string, url: string, icon: string) => {
    stopSiriusMusic();

    // Bluetooth latency wake (Prompt 6)
    await wakeAudioChannel();

    setActiveRadioStation({ id: stationId, name, url, icon });

    const audio = siriusAudioRef.current;
    if (audio) {
      addLog(`Connecting to Live Radio Broadcast: '${name}' via ${url}...`, "info");
      
      // Init real audio context
      if (!siriusAudioCtxRef.current) {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          siriusAudioCtxRef.current = new AudioContext();
          siriusAnalyserRef.current = siriusAudioCtxRef.current.createAnalyser();
          siriusAnalyserRef.current.fftSize = 256;
          sourceNodeRef.current = siriusAudioCtxRef.current.createMediaElementSource(audio);
          sourceNodeRef.current.connect(siriusAnalyserRef.current);
          siriusAnalyserRef.current.connect(siriusAudioCtxRef.current.destination);
        } catch (e) {
          console.error("Audio Context Init Failed", e);
        }
      }
      if (siriusAudioCtxRef.current?.state === "suspended") {
        siriusAudioCtxRef.current.resume();
      }
      
      audio.loop = false;
      audio.src = url;
      audio.load();
      audio.play()
        .then(() => {
          setIsSiriusPlaying(true);
          addLog(`Connected successfully. Broadcasting: '${name}' live.`, "info");
        })
        .catch(() => {
          addLog(`Broadcast stream connection pending interaction. Click Play.`, "warning");
        });
    }
  }, [addLog, stopSiriusMusic]);

  const setQueue = useCallback((tracks: AudioTrack[]) => {
    setQueueState(tracks);
    setPlayedIndices([]);
    setCurrentSiriusTrackIndex(0);
    addLog(`Queue reset with ${tracks.length} tracks. Starting playback from inception.`, "info");
  }, [addLog]);

  const toggleShuffle = useCallback(() => {
    const modes: ('off' | 'random' | 'fair')[] = ['off', 'random', 'fair'];
    const nextIdx = (modes.indexOf(shuffleMode) + 1) % modes.length;
    updateSettings({ shuffleMode: modes[nextIdx] });
    setPlayedIndices([]);
    addLog(`Sequence mode updated: ${modes[nextIdx].toUpperCase()}`, "info");
  }, [shuffleMode, updateSettings, addLog]);

  const toggleLoop = useCallback(() => {
    updateSettings({ loopPlaylist: !loopPlaylist });
    addLog(`Loop mode updated: ${!loopPlaylist ? "ON" : "OFF"}`, "info");
  }, [loopPlaylist, updateSettings, addLog]);

  const playTrack = useCallback((index: number) => {
    if (index < 0 || index >= queue.length) return;
    setPlayedIndices([index]);
    playSiriusTrack(index);
  }, [queue.length, playSiriusTrack]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (shuffleMode === "random") {
      const idx = Math.floor(Math.random() * queue.length);
      playTrack(idx);
      addLog(`Random Auto-Play: Switched to track '${queue[idx].title}'`, "info");
    } else if (shuffleMode === "fair") {
      const unplayed = queue.map((_, i) => i).filter(i => !playedIndices.includes(i));
      if (unplayed.length === 0) {
        if (loopPlaylist) {
          const nextIdx = Math.floor(Math.random() * queue.length);
          setPlayedIndices([nextIdx]);
          playSiriusTrack(nextIdx);
          addLog(`Fair Cycle Reset: Auto-advancing to '${queue[nextIdx].title}' (1/${queue.length})`, "info");
        } else {
          stopSiriusMusic();
          addLog(`Fair Playback Cycle: Completed all ${queue.length} tracks. Stopped.`, "info");
        }
      } else {
        const nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)];
        setPlayedIndices(prev => [...prev, nextIdx]);
        playSiriusTrack(nextIdx);
        addLog(`Fair Shuffle Auto-Play: Selected '${queue[nextIdx].title}' (${playedIndices.length + 1}/${queue.length})`, "info");
      }
    } else {
      const nextIndex = currentSiriusTrackIndex + 1;
      if (nextIndex >= queue.length) {
        if (loopPlaylist) {
          playTrack(0);
          addLog(`Loop Active: Back to first track '${queue[0].title}'`, "info");
        } else {
          stopSiriusMusic();
          addLog(`Linear Playback Completed: Reached end of playlist.`, "info");
        }
      } else {
        playTrack(nextIndex);
        addLog(`Auto-Advancing Track: '${queue[nextIndex].title}'`, "info");
      }
    }
  }, [queue, shuffleMode, playedIndices, loopPlaylist, currentSiriusTrackIndex, playTrack, playSiriusTrack, addLog, stopSiriusMusic]);

  const prevTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (shuffleMode === "fair") {
      if (playedIndices.length > 1) {
        const nextPlayed = [...playedIndices];
        nextPlayed.pop();
        const prevIdx = nextPlayed[nextPlayed.length - 1];
        setPlayedIndices(nextPlayed);
        playSiriusTrack(prevIdx);
        addLog(`Fair Cycle Backtrack: Returned to '${queue[prevIdx].title}'`, "info");
      } else {
        const prevIndex = (currentSiriusTrackIndex - 1 + queue.length) % queue.length;
        playTrack(prevIndex);
        addLog(`Fair Backtrack: Switched to previous track '${queue[prevIndex].title}'`, "info");
      }
    } else if (shuffleMode === "random") {
      const prevIndex = Math.floor(Math.random() * queue.length);
      playTrack(prevIndex);
      addLog(`Random Backtrack: Switched to random track '${queue[prevIndex].title}'`, "info");
    } else {
      let prevIndex = currentSiriusTrackIndex - 1;
      if (prevIndex < 0) {
        prevIndex = loopPlaylist ? queue.length - 1 : 0;
      }
      playTrack(prevIndex);
      addLog(`Manual Backward Jump: Track '${queue[prevIndex].title}'`, "info");
    }
  }, [queue, shuffleMode, playedIndices, currentSiriusTrackIndex, playTrack, playSiriusTrack, loopPlaylist, addLog]);

  const handleSiriusNext = nextTrack;
  const handleSiriusPrev = prevTrack;

  // Register video for mutual exclusion and sync play state
  useEffect(() => {
    const audio = siriusAudioRef.current;
    if (!audio) return;

    const cleanupRegister = registerVideo(audio);

    const handlePlay = () => setIsSiriusPlaying(true);
    const handlePause = () => setIsSiriusPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      cleanupRegister();
    };
  }, []);

  // Track ended event listener for auto-advance support
  useEffect(() => {
    const audio = siriusAudioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (autoAdvance) {
        nextTrack();
      } else {
        setIsSiriusPlaying(false);
        addLog("Track ended. Auto-advance is disabled.", "info");
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  }, [autoAdvance, nextTrack, addLog]);

  const handleSiriusReplay = useCallback(() => {
    addLog("Custom Deck: Restart current track from inception", "info");
    if (siriusAudioRef.current) {
      siriusAudioRef.current.currentTime = 0;
      siriusAudioRef.current.play().catch(() => {});
      setIsSiriusPlaying(true);
    }
  }, [addLog]);

  const handleSiriusSeek = useCallback((timeVal: number) => {
    setSiriusCurrentTime(timeVal);
    if (siriusAudioRef.current) {
      siriusAudioRef.current.currentTime = timeVal;
      
      // Persist the seek position immediately
      const track = siriusPlaylist[currentSiriusTrackIndex];
      if (track) {
        safeLocalStorage.setItem(`sirius_pos_${track.url}`, timeVal.toString());
      }
    }
  }, [currentSiriusTrackIndex, siriusPlaylist]);

  // Media Session Integration (Prompts 1, 2)
  const handleMediaPlay = useCallback(() => {
    startSiriusMusic();
  }, [startSiriusMusic]);

  const handleMediaPause = useCallback(() => {
    stopSiriusMusic();
  }, [stopSiriusMusic]);

  const { setMetadata, setPlaybackState } = useMediaSession({
    onPlay: handleMediaPlay,
    onPause: handleMediaPause,
    onNextTrack: nextTrack,
    onPreviousTrack: prevTrack,
    onSeekTo: handleSiriusSeek,
  });

  // Keep Media Session metadata in sync (Prompt 2)
  useEffect(() => {
    if (activeRadioStation) {
      setMetadata({
        title: activeRadioStation.name,
        artist: "Live Radio Broadcast",
        album: "AJN Live Radio",
        artwork: activeRadioStation.icon ? [{ src: activeRadioStation.icon, sizes: "128x128" }] : undefined,
      });
    } else {
      const track = siriusPlaylist[currentSiriusTrackIndex];
      if (track) {
        setMetadata({
          title: track.title,
          artist: track.artist,
          album: "Sirius Deck",
        });
      }
    }
  }, [currentSiriusTrackIndex, siriusPlaylist, activeRadioStation, setMetadata]);

  // Keep Media Session playback state in sync (Prompt 1)
  useEffect(() => {
    setPlaybackState(isSiriusPlaying ? "playing" : "paused");
  }, [isSiriusPlaying, setPlaybackState]);

  // Audio Output Routing method (Prompt 3)
  const setAudioOutputDevice = useCallback(async (sinkId: string) => {
    setSelectedSinkIdState(sinkId);
    safeLocalStorage.setItem("ajn_selected_sink_id", sinkId);
    
    const audio = siriusAudioRef.current;
    if (audio && "setSinkId" in HTMLMediaElement.prototype) {
      try {
        await (audio as any).setSinkId(sinkId);
        addLog(`Audio output successfully routed to device: ${sinkId || "Default"}`, "info");
      } catch (err: any) {
        console.error("Error setting audio sink ID:", err);
        addLog(`Failed to route audio to selected device: ${err.message}`, "error");
      }
    } else if (audio) {
      addLog("Audio Output Devices API (setSinkId) is not supported in this browser.", "warning");
    }
  }, [addLog]);

  // Device Change Awareness (Prompt 4 - Auto Pause on Bluetooth Disconnection)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    const handleDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === "audiooutput");
        
        // Check if any previously present Bluetooth device is now missing
        const disconnectedBluetooth = prevDevicesRef.current.some(prevDev => {
          const isBt = prevDev.label && (
            prevDev.label.toLowerCase().includes("bluetooth") ||
            prevDev.label.toLowerCase().includes("wireless") ||
            prevDev.label.toLowerCase().includes("headset") ||
            prevDev.label.toLowerCase().includes("airpods") ||
            prevDev.label.toLowerCase().includes("buds")
          );
          if (!isBt) return false;
          // Device is no longer in current list
          return !outputs.some(currDev => currDev.deviceId === prevDev.deviceId || currDev.label === prevDev.label);
        });

        if (disconnectedBluetooth && isSiriusPlaying) {
          stopSiriusMusic();
          addLog("Audio device disconnected. Playback paused.", "warning");
        }

        prevDevicesRef.current = outputs;
        setAudioDevices(outputs);
      } catch (err) {
        console.warn("Error handling device change:", err);
      }
    };

    // Initialize list of outputs
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const outputs = devices.filter(d => d.kind === "audiooutput");
        prevDevicesRef.current = outputs;
        setAudioDevices(outputs);
      })
      .catch(() => {});

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [isSiriusPlaying, stopSiriusMusic, addLog]);

  // Handle Audio Session Conflicts / Interruption (Prompt 5)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("audioSession" in navigator)) return;
    const audioSession = (navigator as any).audioSession;
    if (!audioSession) return;

    const handleStateChange = () => {
      if (audioSession.state === "interrupted" && isSiriusPlaying) {
        stopSiriusMusic();
        addLog("Audio session interrupted by system priority. Playback paused.", "warning");
      }
    };

    try {
      audioSession.addEventListener("statechange", handleStateChange);
    } catch (e) {
      console.warn("Could not register audioSession event listener:", e);
    }

    return () => {
      try {
        audioSession.removeEventListener("statechange", handleStateChange);
      } catch (e) {
        // Suppress
      }
    };
  }, [isSiriusPlaying, stopSiriusMusic, addLog]);

  // Set initial output sinkId when audio ref mounts/renders (Prompt 3)
  useEffect(() => {
    const audio = siriusAudioRef.current;
    if (audio && selectedSinkId && "setSinkId" in HTMLMediaElement.prototype) {
      (audio as any).setSinkId(selectedSinkId).catch((err: any) => {
        console.warn("Failed to apply persisted output device sinkId on load:", err);
      });
    }
  }, [selectedSinkId]);

  // Handle source synchronization & loadedmetadata
  useEffect(() => {
    if (activeRadioStation) return;

    const audio = siriusAudioRef.current;
    if (!audio) return;

    const track = siriusPlaylist[currentSiriusTrackIndex];
    if (!track) return;

    addLog(`Loading synthesize track: '${track.artist} - ${track.title}'...`, "info");
      if (!siriusAudioCtxRef.current) {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          siriusAudioCtxRef.current = new AudioContext();
          siriusAnalyserRef.current = siriusAudioCtxRef.current.createAnalyser();
          siriusAnalyserRef.current.fftSize = 256;
          sourceNodeRef.current = siriusAudioCtxRef.current.createMediaElementSource(audio);
          sourceNodeRef.current.connect(siriusAnalyserRef.current);
          siriusAnalyserRef.current.connect(siriusAudioCtxRef.current.destination);
        } catch (e) {
          console.error("Audio Context Init Failed", e);
        }
      }
      if (siriusAudioCtxRef.current?.state === "suspended") {
        siriusAudioCtxRef.current.resume();
      }
    
    // Set standard audio attributes
    
    audio.loop = false;
    audio.volume = siriusAudioVolume;
    audio.muted = isSiriusMuted;

    audio.src = track.url;
    audio.load();

    const handleLoadedMetadata = () => {
      addLog(`Native player initialized. Performing audio-restoration lookup...`, "info");
      
      // Load and restore saved position for this track
      const savedPosStr = safeLocalStorage.getItem(`sirius_pos_${track.url}`);
      let resumeTime = 0;
      if (savedPosStr) {
        resumeTime = parseFloat(savedPosStr);
        if (resumeTime < 0 || isNaN(resumeTime) || (audio.duration && resumeTime >= audio.duration - 2) || resumeTime > 99999) {
          resumeTime = 0;
        }
      }

      // Default skip for Sirius Intro
      if (resumeTime === 0 && track.title === "Sirius" && track.artist === "The Alan Parsons Project") {
        resumeTime = 30;
      }

      setTimeout(() => {
        if (siriusAudioRef.current) {
          siriusAudioRef.current.currentTime = resumeTime;
          siriusAudioRef.current.playbackRate = siriusPlaybackRate;
          siriusAudioRef.current.play()
            .then(() => {
              setIsSiriusPlaying(true);
              addLog(`Synthesizer Sound: '${track.artist} - ${track.title}' is active`, "info");
            })
            .catch(() => {
              addLog("Autoplay paused. Audio controller initialised, ready for tactile cue.", "warning");
            });
        }
      }, 300);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [currentSiriusTrackIndex, siriusPlaylist, activeRadioStation, addLog]);

  // Synchronize playback rate and EQ states when audio is running
  useEffect(() => {
    const audio = siriusAudioRef.current;
    if (audio) {
      if (!activeRadioStation) {
        audio.playbackRate = siriusPlaybackRate;
      } else {
        audio.playbackRate = 1.0;
      }
    }
  }, [siriusPlaybackRate, activeRadioStation]);

  // Periodically persist playback position
  useEffect(() => {
    const audio = siriusAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const curTime = audio.currentTime;
      setSiriusCurrentTime(curTime);

      const track = siriusPlaylist[currentSiriusTrackIndex];
      if (track && !activeRadioStation) {
        const now = Date.now();
        if (now - lastSavedPositionTimeRef.current >= 2000) {
          safeLocalStorage.setItem(`sirius_pos_${track.url}`, curTime.toString());
          lastSavedPositionTimeRef.current = now;
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [currentSiriusTrackIndex, siriusPlaylist, activeRadioStation]);

  // Preload next track
  useEffect(() => {
    if (typeof window === "undefined" || !queue || queue.length === 0) return;

    // Find the next track index
    let nextIndex = -1;
    if (shuffleMode === "random") {
      nextIndex = (currentSiriusTrackIndex + 1) % queue.length;
    } else if (shuffleMode === "fair") {
      const unplayed = queue.map((_, i) => i).filter(i => !playedIndices.includes(i));
      if (unplayed.length > 0) {
        nextIndex = unplayed[0];
      } else if (loopPlaylist) {
        nextIndex = 0;
      }
    } else {
      nextIndex = currentSiriusTrackIndex + 1;
      if (nextIndex >= queue.length && loopPlaylist) {
        nextIndex = 0;
      }
    }

    if (nextIndex >= 0 && nextIndex < queue.length && nextIndex !== currentSiriusTrackIndex) {
      const nextTrack = queue[nextIndex];
      if (nextTrack && nextTrack.url) {
        if (!preloadAudioRef.current) {
          preloadAudioRef.current = new Audio();
        }
        preloadAudioRef.current.src = nextTrack.url;
        preloadAudioRef.current.preload = "auto";
        preloadAudioRef.current.load();
        console.log(`[Audio Preloader] Preloaded track index ${nextIndex}: "${nextTrack.title}" (${nextTrack.url})`);
      }
    }
  }, [currentSiriusTrackIndex, queue, shuffleMode, playedIndices, loopPlaylist]);

  // 120-bar visualization loop effect
  useEffect(() => {
    let animationId: number;
    const canvas = siriusCanvasRef.current || siriusTabCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas sizing resolution
    const width = 480;
    const height = 80;
    canvas.width = width;
    canvas.height = height;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let dataArray = new Uint8Array(120);
      if (siriusAnalyserRef.current && isSiriusPlaying && !isSiriusMuted) {
        const bufferLength = siriusAnalyserRef.current.frequencyBinCount;
        const rawData = new Uint8Array(bufferLength);
        siriusAnalyserRef.current.getByteFrequencyData(rawData);
        
        // Map 128 bins to 120 bars
        for (let i = 0; i < 120; i++) {
          dataArray[i] = rawData[i] || 0;
        }
      }

      const numBars = 120;
      const gap = 1;
      const barWidth = (width - (numBars - 1) * gap) / numBars;

      ctx.beginPath();
      for (let i = 0; i < numBars; i++) {
        const val = dataArray[i];
        const percent = val / 255;
        let targetHeight = percent * (height - 5);
        if (targetHeight < 2.5) targetHeight = 2.5;

        const curHeight = siriusCanvasHeightsRef.current[i] * 0.7 + targetHeight * 0.3;
        siriusCanvasHeightsRef.current[i] = curHeight;

        if (curHeight > siriusPeakHeightsRef.current[i]) {
          siriusPeakHeightsRef.current[i] = curHeight;
          siriusPeakDecayRef.current[i] = 0;
        } else {
          siriusPeakDecayRef.current[i] += 0.085;
          siriusPeakHeightsRef.current[i] -= siriusPeakDecayRef.current[i];
          if (siriusPeakHeightsRef.current[i] < 0) {
            siriusPeakHeightsRef.current[i] = 0;
          }
        }

        const xPos = i * (barWidth + gap);
        if (siriusVisualizerMode === "wave") {
          const centerY = height / 2;
          const halfH = curHeight / 2;
          ctx.rect(xPos, centerY - halfH, barWidth, curHeight || 1);
        } else {
          ctx.rect(xPos, height - curHeight, barWidth, curHeight);
        }
      }

      let gradient = ctx.createLinearGradient(0, height, 0, 0);
      if (siriusVisualizerMode === "fire") {
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.8)");
        gradient.addColorStop(0.5, "rgba(249, 115, 22, 0.9)");
        gradient.addColorStop(1, "rgba(254, 240, 138, 1)");
      } else if (siriusVisualizerMode === "wave") {
        gradient.addColorStop(0, "rgba(6, 182, 212, 0.8)");
        gradient.addColorStop(0.5, "rgba(14, 165, 233, 0.95)");
        gradient.addColorStop(1, "rgba(186, 232, 255, 1)");
      } else if (siriusVisualizerMode === "matrix") {
        gradient.addColorStop(0, "rgba(34, 197, 94, 0.8)");
        gradient.addColorStop(0.8, "rgba(74, 222, 128, 1)");
      } else {
        gradient.addColorStop(0, "rgba(21, 128, 61, 0.8)");
        gradient.addColorStop(0.65, "rgba(34, 197, 94, 0.95)");
        gradient.addColorStop(1, "rgba(220, 252, 231, 1)");
      }
      ctx.fillStyle = gradient;
      ctx.fill();

      // Peaks
      if (siriusVisualizerMode !== "matrix") {
        ctx.fillStyle = siriusVisualizerMode === "fire" ? "#fef08a" : siriusVisualizerMode === "wave" ? "#22d3ee" : "#ffffff";
        ctx.beginPath();
        for (let i = 0; i < numBars; i++) {
          const peakHeight = siriusPeakHeightsRef.current[i];
          if (peakHeight > 2.5) {
            const xPos = i * (barWidth + gap);
            if (siriusVisualizerMode === "wave") {
              const centerY = height / 2;
              ctx.rect(xPos, centerY - (peakHeight / 2) - 1.2, barWidth, 1.2);
              ctx.rect(xPos, centerY + (peakHeight / 2), barWidth, 1.2);
            } else {
              ctx.rect(xPos, height - peakHeight - 2, barWidth, 1.2);
            }
          }
        }
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [currentSiriusTrackIndex, isSiriusPlaying, siriusVisualizerMode, siriusAudioVolume, isSiriusMuted]);

  return {
    siriusAudioCtxRef,
    siriusAnalyserRef,
    // Refs
    audioRef: siriusAudioRef,
    canvasRef: siriusCanvasRef,
    tabCanvasRef: siriusTabCanvasRef,

    // Playlist / Stream States
    siriusPlaylist,
    currentSiriusTrackIndex,
    activeRadioStation,
    isSiriusOverlayOpen,
    isSiriusPlaying,
    siriusCurrentTime,
    siriusDuration,

    // Audio Control States
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

    // Bluetooth / Audio Output features
    audioDevices,
    selectedSinkId,
    setAudioOutputDevice,

    // State Setters
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
    setIsSiriusOverlayOpen,
    setIsSiriusPlaying,
    setSiriusCurrentTime,
    setSiriusDuration,
    setActiveRadioStation,

    // Control Methods
    playSiriusTrack,
    playRadioStation,
    startSiriusMusic,
    stopSiriusMusic,
    handleSiriusNext,
    handleSiriusPrev,
    handleSiriusReplay,
    handleSiriusSeek,
    siriusBackupIndexRef,

    // Queue / Extended functionality
    currentTrackIndex: currentSiriusTrackIndex,
    queue,
    playedIndices,
    queueProgress,
    playTrack,
    nextTrack,
    prevTrack,
    toggleShuffle,
    toggleLoop,
    setQueue,
    settings,
    updateSettings
  };
}
