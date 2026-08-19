import { mainVideoRef, registerVideo } from "../../utils/videoRef";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import { ContentItem } from "../../types";
import { X, Play, Pause, AlertTriangle, RefreshCw, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { evaluateFailover } from "../../utils/failoverManager";
import { safeLocalStorage } from "../../utils/safeStorage";
import { telemetry, logUserAction, generateCorrelationId, monitorVideoStalls } from "../../telemetry/playbackTelemetry";

interface MatrixPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ContentItem | null;
  stopPreludeMusic?: () => void;
}

export const MatrixPlayerModal: React.FC<MatrixPlayerModalProps> = ({
  isOpen,
  onClose,
  item,
  stopPreludeMusic
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEscapeKey(() => {
    if (isOpen) {
      logUserAction('modal_closed', { item: item?.id }, 'MatrixPlayerModal', correlationId);
      onClose();
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Source list and priority handling
  const [activeUrl, setActiveUrl] = useState<string>("");
  const loadTimeoutRef = useRef<number | null>(null);
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([]);
  const [playoutLogs, setPlayoutLogs] = useState<{ time: string; msg: string; type: "info" | "error" | "success" }[]>([]);
  const [hasFailedOver, setHasFailedOver] = useState(false);
  const [isIframeFallback, setIsIframeFallback] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);

  const correlationId = useMemo(() => generateCorrelationId(), [item?.id, activeUrl, retryCount]);

  // Setup logging helper
  const addLog = (msg: string, type: "info" | "error" | "success" = "info") => {
    const time = new Date().toLocaleTimeString();
    setPlayoutLogs((prev) => [...prev, { time, msg, type }].slice(-10));
  };

  // Get list of URLs in order of priority
  const getSourcesInPriority = (srcItem: ContentItem | null): string[] => {
    if (!srcItem) return [];
    const urls: string[] = [];

    // 1. User preference / preferredUrl
    const localOverride = safeLocalStorage.getItem(`pref_source_${srcItem.id}`);
    if (localOverride) {
      urls.push(localOverride);
    } else if (srcItem.preferredUrl) {
      urls.push(srcItem.preferredUrl);
    }

    // 2. Primary stream URL
    if (srcItem.url && !urls.includes(srcItem.url)) {
      urls.push(srcItem.url);
    }

    // 3. Backup URL
    if (srcItem.backupUrl && !urls.includes(srcItem.backupUrl)) {
      urls.push(srcItem.backupUrl);
    }

    // 4. Source Priority definitions
    if (srcItem.sourcePriority) {
      srcItem.sourcePriority.forEach((pUrl) => {
        if (pUrl && !urls.includes(pUrl)) {
          urls.push(pUrl);
        }
      });
    }

    // 5. Conflict sources
    if (srcItem.conflictSources) {
      // Sort by priority descending
      const sorted = [...srcItem.conflictSources].sort((a, b) => b.priority - a.priority);
      sorted.forEach((cs) => {
        if (cs.url && !urls.includes(cs.url)) {
          urls.push(cs.url);
        }
      });
    }

    return urls;
  };

  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      containerRef.current.parentElement?.focus();
      
      // Pause main background player to prevent collisions
      const mainVideo = mainVideoRef.current as HTMLVideoElement;
      if (mainVideo && !mainVideo.paused) {
        mainVideo.pause();
      }
    }
  }, [isOpen]);

  // Initialize stream url state when modal is opened or item changes
  useEffect(() => {
    if (isOpen && item) {
      const priorityUrls = getSourcesInPriority(item);
      setAttemptedUrls([]);
      setHasFailedOver(false);
      setPlayoutLogs([]);
      setCurrentTime(0);
      setDuration(0);

      if (priorityUrls.length > 0) {
        const primary = priorityUrls[0];
        
        telemetry.trackEvent({
          correlationId: undefined, // this is a new run, we can just omit correlationId if we don't have it initialized yet, or use generic
          emittedBy: 'MatrixPlayerModal',
          category: 'PLAYER_LIFECYCLE',
          type: 'url_resolved',
          payload: { 
              finalUrl: primary, 
              ingest_metadata: {
                  title: item.title,
                  id: item.id
              }
          }
        });

        setActiveUrl(primary);
        addLog(`Initiating playout for "${item.title}"`, "info");
        addLog(`Selected primary stream source: ${primary.slice(0, 60)}...`, "info");
      } else {
        setActiveUrl("");
        addLog("No valid streams found in this source profile.", "error");
      }
    }
  }, [isOpen, item]);

  useEffect(() => {
    let unmountMonitor: (() => void) | undefined;
    if (videoRef.current && correlationId) {
      unmountMonitor = monitorVideoStalls(videoRef.current, correlationId, "MatrixPlayerModal");
    }
    return () => {
      if (unmountMonitor) unmountMonitor();
    };
  }, [correlationId]);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  };

  useEffect(() => {
    if (videoElement) {
      const cleanup = registerVideo(videoElement);
      return cleanup;
    }
    return undefined;
  }, [videoElement]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      telemetry.trackEvent({
        correlationId,
        emittedBy: 'MatrixPlayerModal',
        category: 'PLAYER_LIFECYCLE',
        type: 'video_unmount_cleanup',
        payload: { url: activeUrl }
      });
      if (video) {
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {});
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    }
  }, [activeUrl, correlationId]);

  // Load and play whenever active URL changes
  useEffect(() => {
    if (!isOpen || !activeUrl) return;

    const video = videoRef.current;
    if (!video) return;

    telemetry.trackEvent({ correlationId, emittedBy: 'MatrixPlayerModal', category: 'PLAYER_LIFECYCLE', type: 'native_load', payload: { url: activeUrl } });
    addLog(`Loading source: ${activeUrl.slice(0, 50)}...`, "info");
    video.removeAttribute("src");
    video.load();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          addLog("Stream playout established successfully", "success");
        })
        .catch((err) => {
          telemetry.trackEvent({ correlationId, emittedBy: 'MatrixPlayerModal', category: 'PLAYER_LIFECYCLE', type: 'native_error', payload: { error: err.message, code: err.name } });
          console.warn("[MatrixPlayer] Autoplay prevented or load error:", err);
          addLog(`Playback authorization deferred: ${err.message || "Awaiting action"}`, "info");
        });
    }

    return () => {
      if (loadTimeoutRef && loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
      // Hardware MSE/V8 Buffer clean and reset to prevent memory leaks
      video.pause();
      video.removeAttribute("src");
      video.load();
      setIsPlaying(false);
    };
  }, [activeUrl, isOpen, correlationId]);

  // Sync volume & mute properties
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Playback Control Handlers
  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      logUserAction('pause_clicked', { url: activeUrl }, 'MatrixPlayerModal', correlationId);
      video.pause();
      setIsPlaying(false);
      addLog("Playout paused by operator command", "info");
    } else {
      logUserAction('play_clicked', { url: activeUrl }, 'MatrixPlayerModal', correlationId);
      video.play().then(() => {
        setIsPlaying(true);
        addLog("Playout resumed", "info");
      }).catch((e) => {
        addLog(`Play failed: ${e.message}`, "error");
      });
    }
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    logUserAction('seek', { url: activeUrl, time: nextTime }, 'MatrixPlayerModal', correlationId);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    addLog(`Seeked ${seconds > 0 ? `+${seconds}` : seconds}s to ${Math.floor(nextTime)}s`, "info");
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    logUserAction('fullscreen_toggled', { url: activeUrl, fullscreen: !document.fullscreenElement }, 'MatrixPlayerModal', correlationId);
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        addLog(`Fullscreen escalation rejected: ${err.message}`, "error");
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      return;
    }
    switch (e.code) {
      case "Space":
        handleTogglePlay();
        break;
      case "ArrowLeft":
        handleSeek(-10);
        break;
      case "ArrowRight":
        handleSeek(10);
        break;
      case "KeyF":
        toggleFullscreen();
        break;
    }
  };

  // Error recovery / Failover Engine
  const handleVideoError = () => {
    if (!item) return;

    addLog(`PL_ERR: Stream failed or was blocked on URL: ${activeUrl.slice(0, 45)}...`, "error");

    const allSources = getSourcesInPriority(item);
    const videoNode = videoRef.current;
    
    telemetry.trackEvent({ correlationId, emittedBy: 'MatrixPlayerModal', category: 'PLAYER_LIFECYCLE', type: 'native_error', payload: { error: videoNode?.error?.message || 'unknown', code: videoNode?.error?.code } });

    const action = evaluateFailover({
      url: activeUrl,
      errorObj: videoNode?.error,
      currentTime: videoNode?.currentTime || 0,
      availableSources: allSources
    });

    if (action.action === "next_source" && action.nextUrl) {
      setAttemptedUrls((prev) => [...prev, activeUrl]);
      setHasFailedOver(true);
      addLog(`[FAILOVER ACTIVATED] Switching to backup source`, "error");
      setActiveUrl(action.nextUrl);
    } else {
      addLog("PL_CRITICAL: Playout exhausted. All prioritized backup sources failed.", "error");
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    addLog("Playout reached logical stream boundary (ended)", "info");
  };

  if (!isOpen || !item) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={() => {
        logUserAction('modal_closed', { item: item.id }, 'MatrixPlayerModal', correlationId);
        onClose();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-4xl bg-[#090e18] border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-2xl h-[85vh] max-h-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="px-5 py-4 bg-[#0d1525]/90 border-b border-slate-800/60 flex items-center justify-between z-10 shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-widest uppercase block mb-0.5">
              📺 THE "MATRIX" MASTER PLAYER
            </span>
            <h3 className="text-white text-sm font-sans font-black truncate">{item.title}</h3>
          </div>

          <button
            onClick={() => {
              logUserAction('modal_closed', { item: item.id }, 'MatrixPlayerModal', correlationId);
              // On close, pause video and set src to empty to prevent audio leak
              const video = videoRef.current;
              if (video) {
                video.pause();
                video.removeAttribute("src");
                video.load();
              }
              onClose();
            }}
            className="p-1.5 rounded-full bg-slate-900/80 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition cursor-pointer border border-slate-800"
            title="Terminate Playout and Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WORKSPACE AREA */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
          
          {/* PLAYOUT MONITOR CANVASES */}
          <div id="ajn-matrix-player-frame" className="relative flex-1 bg-black aspect-video flex items-center justify-center min-h-[220px] md:min-h-[380px]">
            {isIframeFallback || activeUrl.includes('iframe=true') ? (
              <iframe
                src={activeUrl}
                className="w-full h-full object-contain bg-black rounded-lg shadow-2xl border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
              />
            ) : (
            <video
              ref={setVideoRef}
              playsInline
              autoPlay
              onPlay={() => { if (stopPreludeMusic) stopPreludeMusic(); }}
              muted={isMuted}
              className="w-full h-full object-contain bg-black rounded-lg shadow-2xl"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlaying={(e) => {
                telemetry.trackEvent({ correlationId, emittedBy: 'MatrixPlayerModal', category: 'PLAYER_LIFECYCLE', type: 'frame_rendering_started', payload: { currentTime: e.currentTarget.currentTime } });
              }}
              onWaiting={(e) => {
                telemetry.trackEvent({ correlationId, emittedBy: 'MatrixPlayerModal', category: 'PLAYER_LIFECYCLE', type: 'playback_stalled', payload: { bufferedEnd: e.currentTarget.buffered.length ? e.currentTarget.buffered.end(0) : 0 } });
              }}
              onDurationChange={(e) => setDuration(e.currentTarget.duration)}
              onEnded={handleEnded}
              onError={handleVideoError}
            >
              {activeUrl && activeUrl.trim() !== "" && (
                <>
                  <source src={activeUrl} type={activeUrl.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
                  {activeUrl.endsWith('.mp4') && <source src={activeUrl.replace('.mp4', '.webm')} type="video/webm" />}
                  <p>Your browser does not support the video tag.</p>
                </>
              )}
            </video>
            )}

            {/* Playout Failover Alert overlay */}
            {hasFailedOver && (
              <div className="absolute top-3 left-3 bg-red-950/90 border border-red-500/30 px-2.5 py-1 rounded text-[10px] font-mono text-red-400 flex items-center gap-1.5 shadow-md">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                <span>PRIMARY OUTAGE: FAILOVER ACTIVE</span>
              </div>
            )}

            {/* Quick overlay HUD for current time */}
            <div className="absolute bottom-3 left-3 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300">
              {Math.floor(currentTime)}s / {duration ? `${Math.floor(duration)}s` : "LIVE EDGE"}
            </div>
          </div>

          {/* SIDEBAR LOGS & CHANNELS */}
          <div className="w-full md:w-72 shrink-0 bg-[#070b13] border-t md:border-t-0 md:border-l border-slate-800/80 flex flex-col min-h-0 p-4 gap-3">
            <div className="border-b border-slate-800/60 pb-2 shrink-0">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Playout Stream Pipeline</span>
            </div>

            {/* Source Priority Cards */}
            <div className="space-y-1.5 overflow-y-auto max-h-[120px] md:max-h-none md:flex-1 min-h-0 pr-1">
              {getSourcesInPriority(item).map((u, idx) => {
                const isCurrent = u === activeUrl;
                const wasAttempted = attemptedUrls.includes(u);
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border text-[10px] font-mono flex flex-col gap-1 transition-all ${
                      isCurrent
                        ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300 shadow-sm"
                        : wasAttempted
                        ? "bg-red-950/20 border-red-900/30 text-red-400"
                        : "bg-slate-900/40 border-slate-800/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold uppercase text-[9px] tracking-wider">
                        {idx === 0 ? "★ Primary Source" : `🔗 Priority Backup #${idx}`}
                      </span>
                      {isCurrent && (
                        <span className="flex h-1.5 w-1.5 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <span className="truncate break-all leading-tight text-slate-300">{u}</span>
                  </div>
                );
              })}
            </div>

            {/* Playout System Log console */}
            <div className="flex-1 md:h-36 flex flex-col border border-slate-800/60 bg-slate-950 rounded-xl overflow-hidden p-2.5 min-h-[100px]">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-1 border-b border-slate-900 pb-1">
                SYSTEM CONSOLE LOGS
              </span>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 font-mono text-[9px] leading-tight select-text no-scrollbar">
                {playoutLogs.map((log, lidx) => (
                  <div key={lidx} className="flex gap-1.5">
                    <span className="text-slate-600 font-normal">{log.time}</span>
                    <span
                      className={
                        log.type === "error"
                          ? "text-red-400 font-bold"
                          : log.type === "success"
                          ? "text-emerald-400 font-bold"
                          : "text-slate-300"
                      }
                    >
                      {log.msg}
                    </span>
                  </div>
                ))}
                {playoutLogs.length === 0 && (
                  <div className="text-slate-600 text-center py-4 italic">Awaiting playout telemetry logs...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM HUD CONTROLS */}
        <div className="px-5 py-3.5 bg-[#0d1525]/90 border-t border-slate-800/60 flex items-center justify-between z-10 shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlay}
              className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isPlaying
                  ? "bg-amber-600/10 border-amber-500/30 text-amber-400 hover:bg-amber-600/20"
                  : "bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
              }`}
              title={isPlaying ? "Pause Playback" : "Resume Playback"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => handleSeek(-10)}
              className="px-2.5 py-2 text-[10px] font-mono text-slate-400 hover:text-white border border-slate-800 rounded-xl hover:bg-slate-900 transition"
              title="Rewind 10 seconds"
            >
              -10s
            </button>
            <button
              onClick={() => handleSeek(10)}
              className="px-2.5 py-2 text-[10px] font-mono text-slate-400 hover:text-white border border-slate-800 rounded-xl hover:bg-slate-900 transition"
              title="Forward 10 seconds"
            >
              +10s
            </button>
          </div>

          {/* Keyboard mapping cheat-sheet helper HUD */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[9px] text-slate-500 bg-[#06080C] px-3 py-1.5 rounded-xl border border-slate-800/60 shrink-0">
            <span>[Space] Play/Pause</span>
            <span className="text-slate-800">•</span>
            <span>[←/→] Seek</span>
            <span className="text-slate-800">•</span>
            <span>[F] Fullscreen</span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Audio Controls */}
            <button
              onClick={() => {
                logUserAction('mute_toggled', { url: activeUrl, muted: !isMuted }, 'MatrixPlayerModal', correlationId);
                setIsMuted(!isMuted);
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition rounded-xl"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                const nextVol = parseFloat(e.target.value);
                setVolume(nextVol);
                setIsMuted(nextVol === 0);
              }}
              className="w-16 accent-emerald-500 h-1 bg-slate-800 rounded-xl appearance-none cursor-pointer"
            />
            
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 transition rounded-xl ml-1"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

