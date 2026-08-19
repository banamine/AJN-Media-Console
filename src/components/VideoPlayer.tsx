import React, { useEffect, useRef, useState, useMemo } from "react";
import { safePlay } from "../utils/safePlay";
import { registerVideo } from "../utils/videoRef";
import { evaluateFailover } from "../utils/failoverManager";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { telemetry, logUserAction, generateCorrelationId, monitorVideoStalls } from "../telemetry/playbackTelemetry";

import { forwardRef } from "react";

export interface VideoPlayerProps {
  url: string;
  channelId?: string;
  isMuted: boolean;
  initialTimeSec?: number;
  id?: string;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (msg: string) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  isExclusive?: boolean;
  onLog?: (msg: string, level?: "info" | "warning" | "error") => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ url, channelId, isMuted, initialTimeSec, id = "native-video-node", className = "w-full h-full object-contain", onPlay, onPause, onEnded, onError, onTimeUpdate, onDurationChange, isExclusive = true, onLog }, externalRef) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initialSeekDone = useRef(false);

  
  const setRefs = (node: HTMLVideoElement | null) => {
    const oldNode = internalVideoRef.current;
    
    // Clean up old event listeners if they exist
    if (oldNode) {
      oldNode.removeEventListener('play', forceUpdate);
      oldNode.removeEventListener('playing', forceUpdate);
      oldNode.removeEventListener('pause', forceUpdate);
      oldNode.removeEventListener('waiting', forceUpdate);
      oldNode.removeEventListener('canplay', forceUpdate);
    }
    
    internalVideoRef.current = node as HTMLVideoElement;
    
    if (node) {
      node.addEventListener('play', forceUpdate);
      node.addEventListener('playing', forceUpdate);
      node.addEventListener('pause', forceUpdate);
      node.addEventListener('waiting', forceUpdate);
      node.addEventListener('canplay', forceUpdate);
      
      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = registerVideo(node, { exclusive: isExclusive });
    } else {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
    
    if (typeof externalRef === 'function') {
      externalRef(node);
    } else if (externalRef) {
      externalRef.current = node;
    }
  };
  const forceUpdate = () => setVideoStateCounter(c => c + 1);
  const hlsRef = useRef<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [videoStateCounter, setVideoStateCounter] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  
  const correlationId = useMemo(() => generateCorrelationId(), [url, retryCount]);

  const autoRetryCountRef = useRef(0);
  const playlistContextRef = useRef<{ tracks: {url: string, title: string}[], currentIndex: number } | null>(null);
  const MAX_AUTO_RETRIES = 3;

  // Reset the counter whenever the source changes (new channel tuned in)
  useEffect(() => {
    autoRetryCountRef.current = 0;
    playlistContextRef.current = null;
    initialSeekDone.current = false;
    
  }, [url]);

  useEffect(() => {
    let unmountMonitor: (() => void) | undefined;
    if (internalVideoRef.current && correlationId) {
      unmountMonitor = monitorVideoStalls(internalVideoRef.current, correlationId, "VideoPlayer");
    }
    return () => {
      if (unmountMonitor) unmountMonitor();
    };
  }, [correlationId]);

  useEffect(() => {
    const video = internalVideoRef.current;
    return () => {
      if (hlsRef.current) {
        telemetry.trackEvent({
          correlationId,
          emittedBy: 'VideoPlayer',
          category: 'PLAYER_LIFECYCLE',
          type: 'hls_detach',
          payload: { url }
        });
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      telemetry.trackEvent({
        correlationId,
        emittedBy: 'VideoPlayer',
        category: 'PLAYER_LIFECYCLE',
        type: 'video_unmount_cleanup',
        payload: {}
      });
      if (video) {
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {});
        }
        if ((video as any)._skipTimeout) {
            clearTimeout((video as any)._skipTimeout);
            (video as any)._skipTimeout = null;
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [correlationId, url]);

  useEffect(() => {
    const video = internalVideoRef.current;
    if (!video || !url) return;
    
    setErrorMsg(null);
    video.muted = isMuted;
    
    let loadTimeout: number;

    const validateAndPlay = async () => {
      let secureUrl = typeof url === 'string' ? url.replace('http://', 'https://') : url;

      // Resolve static playlists (.m3u not m3u8, or .json) into mp4 URLs
      const urlSplit = secureUrl.split('?')[0].toLowerCase();
      if ((urlSplit.endsWith('.m3u') && !urlSplit.endsWith('.m3u8'))) {
         try {
           const { fetchAndParseM3U } = await import("../utils/m3uParser");
           const parsedTracks = await fetchAndParseM3U(secureUrl, channelId || secureUrl);
           if (parsedTracks.length > 0) {
              let currentIndex = 0;
              if (playlistContextRef.current && playlistContextRef.current.tracks.length === parsedTracks.length) {
                 currentIndex = playlistContextRef.current.currentIndex;
              }
              secureUrl = parsedTracks[currentIndex].url;
              playlistContextRef.current = { tracks: parsedTracks, currentIndex };
              
              if (typeof window !== "undefined") {
                 window.dispatchEvent(new CustomEvent('ajn-track-update', {
                    detail: { 
                      title: parsedTracks[currentIndex].title, 
                      url: secureUrl,
                      channelId: parsedTracks[currentIndex].channelId,
                      trackNum: currentIndex + 1,
                      totalTracks: parsedTracks.length
                    }
                 }));
              }
           }
         } catch (e: any) {
           console.warn("[VideoPlayer] Failed to resolve playlist url:", e);
           setErrorMsg(`Playlist offline or failed to load: ${e.message}`);
           return;
         }
      } else {
         playlistContextRef.current = null;
      }

      const handleAutoplayBlocked = () => {
        setAutoplayBlocked(true);
        if (video) {
          video.muted = true;
          video.play().catch(() => {});
        }
      };

      const finalUrlSplit = secureUrl.split('?')[0].toLowerCase();
      const isM3U = (finalUrlSplit.endsWith(".m3u8") || (finalUrlSplit.endsWith(".m3u") && !secureUrl.toLowerCase().includes("archive.org"))) && !finalUrlSplit.endsWith(".m4v") && !finalUrlSplit.endsWith(".mp4");

      // Validate stream and proxy if needed (only for M3U/HLS which require CORS for hls.js)
      if (isM3U && secureUrl.startsWith('http') && !secureUrl.includes('/api/stream-proxy')) {
         try {
           const res = await fetch(secureUrl, { method: 'HEAD' });
           if (!res.ok) {
              console.warn(`[Stream Validation] HEAD failed for ${secureUrl}. Using proxy.`);
              secureUrl = `/api/stream-proxy?url=${encodeURIComponent(secureUrl)}`;
           }
         } catch(e) {
           console.warn(`[Stream Validation] CORS/Network error for ${secureUrl}. Using proxy.`);
           secureUrl = `/api/stream-proxy?url=${encodeURIComponent(secureUrl)}`;
         }
      }

      telemetry.trackEvent({
        correlationId,
        emittedBy: 'VideoPlayer',
        category: 'PLAYER_LIFECYCLE',
        type: 'url_resolved',
        payload: { 
            finalUrl: secureUrl, 
            ingest_metadata: { url: url }
        }
      });
      
      console.log(`[Player] URL passed to native player: ${secureUrl}`);

      if (!isM3U) { 
         if (hlsRef.current) { 
           telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'hls_detach', payload: { url } });
           hlsRef.current.detachMedia(); 
           hlsRef.current.destroy(); 
           hlsRef.current = null; 
         } 
         telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'native_load', payload: { url: secureUrl } });
         video!.src = secureUrl; 
         video!.load(); 
         safePlay(video, handleAutoplayBlocked); 
         return;
      }

      if (hlsRef.current) {
        telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'hls_detach', payload: { url } });
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (false && video!.canPlayType("application/vnd.apple.mpegurl")) { // DEPRECATED BLOCK, see below
        telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'native_load', payload: { url: secureUrl } });
        video!.src = secureUrl;
        video!.load();
      } else {
        import("hls.js").then((HlsModule) => {
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            const hlsConfig: any = { lowLatencyMode: true };
            if (initialTimeSec !== undefined && initialTimeSec > 0) {
              hlsConfig.startPosition = initialTimeSec;
            }
            const hls = new Hls(hlsConfig);
            hlsRef.current = hls;
            
            telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'hls_attach', payload: { url: secureUrl } });
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
              hls.loadSource(secureUrl);
              
              // hls.js circuit breaker
              loadTimeout = window.setTimeout(() => {
                 console.warn("[Circuit Breaker] HLS.js load timed out.");
                 telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'hls_fatal_error', payload: { error: 'timeout' } });
                 setErrorMsg("Stream load timeout. Retrying...");
                 if (hlsRef.current) hlsRef.current.startLoad();
              }, 8000);
            });
            
            hls.on(Hls.Events.MANIFEST_PARSED, (_event: any, data: any) => {
              clearTimeout(loadTimeout);
              telemetry.trackEvent({ 
                  correlationId, 
                  emittedBy: 'VideoPlayer', 
                  category: 'PLAYER_LIFECYCLE', 
                  type: 'hls_manifest_parsed', 
                  payload: { 
                      url: secureUrl,
                      levels: data.levels?.map((l: any) => ({ bitrate: l.bitrate, width: l.width, height: l.height })),
                      audioTracks: data.audioTracks?.length
                  } 
              });
              safePlay(video, handleAutoplayBlocked);
            });
            
            hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
              if (data && data.fatal) {
                clearTimeout(loadTimeout);
                telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'hls_fatal_error', payload: { details: data.details, type: data.type } });
                console.error("HLS Fatal Error:", data);
                
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    if ((hls as any)._networkRetries > 2) {
                       console.warn("[Circuit Breaker] Network retry limit reached.");
                       hls.destroy();
                       const msg = "Network error: Stream unavailable";
                       setErrorMsg(msg);
                       if (onError) onError(msg);
                       return;
                    }
                    (hls as any)._networkRetries = ((hls as any)._networkRetries || 0) + 1;
                    hls.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                } else {
                    hls.destroy();
                    const msg = `HLS Error: ${data.details || "Stream unavailable"}`;
                    setErrorMsg(msg);
                    if (onError) onError(msg);
                }
              }
            });
          } else if (video && video.canPlayType("application/vnd.apple.mpegurl")) {
            telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'native_load', payload: { url: secureUrl } });
            video!.src = secureUrl;
            video!.load();
          }
        }).catch(err => {
          console.warn("Failed to load hls.js:", err);
        });
      }
    };

    validateAndPlay();

    return () => {
       if (loadTimeout) clearTimeout(loadTimeout);
       if (hlsRef.current) {
          telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'hls_detach', payload: { url } });
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
          hlsRef.current = null;
       }
    };
  }, [url, isMuted, retryCount, correlationId]);

  const video = internalVideoRef.current;
  const shouldShowErrorOverlay = errorMsg && (!video || video.paused || video.readyState < 2);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {url.includes('iframe=true') ? (
        <iframe
          src={url}
          className="w-full h-full border-0 z-10 relative bg-black"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
          width="100%"
          height="100%"
          onLoad={() => telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'iframe_loaded', payload: { url } })}
          onError={() => telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'iframe_error', payload: { url } })}
        />
      ) : (
      <video
        id={id}
        ref={setRefs}
        className={className}
        autoPlay
        playsInline
        controls={true}
        muted={isMuted}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={(e) => {
          if (playlistContextRef.current) {
            // Reset breaker state on successful track completion
            autoRetryCountRef.current = 0;
            
            // Advance to the next track if available
            if (playlistContextRef.current.currentIndex + 1 < playlistContextRef.current.tracks.length) {
                playlistContextRef.current.currentIndex += 1;
                setRetryCount(c => c + 1);
                return; // Do not bubble up until the entire playlist finishes
            }
          }
          if (onEnded) onEnded();
        }}
        onLoadedMetadata={(e) => {
          if (initialTimeSec !== undefined && !initialSeekDone.current && initialTimeSec > 0) {
            e.currentTarget.currentTime = initialTimeSec;
            initialSeekDone.current = true;
          }
        }}
        onTimeUpdate={(e) => {
          if (errorMsg) setErrorMsg(null);
          if (onTimeUpdate) onTimeUpdate(e.currentTarget.currentTime);
        }}
        onDurationChange={(e) => onDurationChange && onDurationChange(e.currentTarget.duration)}
        onCanPlay={(e) => {
          const videoElement = e.currentTarget;
          requestAnimationFrame(() => {
            const loadingSpinner = document.getElementById('player-loading-spinner');
            if (loadingSpinner) {
              loadingSpinner.style.display = 'none';
            }
            videoElement.play().catch(() => {});
          });
        }}
        onPlaying={(e) => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("ajn-playback-success"));
          }
          telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'frame_rendering_started', payload: { currentTime: e.currentTarget.currentTime } });
          setErrorMsg(null);
        }}
        onWaiting={(e) => {
          telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'playback_stalled', payload: { bufferedEnd: e.currentTarget.buffered.length ? e.currentTarget.buffered.end(0) : 0 } });
        }}
        onError={(e) => {
          const target = e.currentTarget;
          const err = target.error;
          // Guard: if we've already nuked the src, ignore subsequent error events
          if (!target.src || target.src === "" || target.currentSrc === "" || target.src.endsWith(window.location.host + "/")) return;
          
          telemetry.trackEvent({ correlationId, emittedBy: 'VideoPlayer', category: 'PLAYER_LIFECYCLE', type: 'native_error', payload: { error: err ? err.message : 'unknown', code: err?.code } });
          console.warn(`VideoPlayer playback error: ${err?.code} - ${err?.message} - URL: ${url}`);

          const action = evaluateFailover({
            url: target.currentSrc || target.src || url,
            errorObj: err,
            currentTime: target.currentTime,
            retryCount: autoRetryCountRef.current,
            availableSources: playlistContextRef.current ? playlistContextRef.current.tracks.map(t => t.url) : [target.currentSrc || target.src || url]
          });

          if (action.action === "retry") {
            autoRetryCountRef.current += 1;
            setTimeout(() => {
              target.load();
              target.currentTime = action.resumeFromSec || 0;
              target.play().catch(() => {});
            }, action.delayMs || 500);
            return;
          }
          
          if (action.action === "next_source" && playlistContextRef.current) {
            if (playlistContextRef.current.currentIndex + 1 < playlistContextRef.current.tracks.length) {
                if ((target as any)._skipTimeout) return;
                
                // Add a debounce to prevent rapid track skipping and allow node redirects to resolve cleanly
                (target as any)._skipTimeout = setTimeout(() => {
                    (target as any)._skipTimeout = null;
                    
                    if (!playlistContextRef.current) return;
                    
                    const oldIdx = playlistContextRef.current.currentIndex;
                    playlistContextRef.current.currentIndex += 1;
                    const newIdx = playlistContextRef.current.currentIndex;
                    
                    const advMsg = `[Playout Engine] Track ${oldIdx + 1} unplayable. Advancing to Track ${newIdx + 1} within playlist...`;
                    console.log(advMsg);
                    if (onLog) onLog(advMsg, "warning");
                    if (typeof window !== "undefined") {
                       window.dispatchEvent(new CustomEvent("ajn-log-message", { detail: { message: advMsg, level: "warning" } }));
                    }

                    autoRetryCountRef.current = 0;
                    setRetryCount(c => c + 1); // trigger re-render and re-run effect
                }, 1500);
                return;
            }
          }

          // Out of auto-retries, or a non-recoverable error code — show the manual UI
          const msg = "Stream unavailable for this show.";
          setErrorMsg(msg);
          target.pause();
          target.removeAttribute('src'); // Completely nuke the src to prevent browser retry loops
          target.load();

          if (playlistContextRef.current) {
             const exhaustMsg = `Playout engine failure: All manifest tracks exhausted for [${url}].`;
             console.log(exhaustMsg);
             if (onLog) onLog(exhaustMsg, "error");
             if (typeof window !== "undefined") {
                 window.dispatchEvent(new CustomEvent("ajn-failover-exhausted"));
             }
          } else {
             const haltMsg = `Playout engine failure: All manifest tracks exhausted for [${url}].`;
             if (onLog) onLog(haltMsg, "error");
             if (typeof window !== "undefined") {
                 window.dispatchEvent(new CustomEvent("ajn-failover-exhausted"));
             }
          }

          if (onLog) onLog("[Failover Engine] Playback halted. Displaying clean UI error banner.", "error");
          if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ajn-log-message", { detail: { message: "[Failover Engine] Playback halted. Displaying clean UI error banner.", level: "error" } }));
          }

          if (onError) onError(msg);
        }}
      />
      )}
      
      {autoplayBlocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center space-y-4">
          <button
            onClick={() => {
              if (internalVideoRef.current) {
                internalVideoRef.current.muted = false;
                internalVideoRef.current.play();
                setAutoplayBlocked(false);
              }
            }}
            className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-2)] text-white font-mono text-sm font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all shadow-[var(--shadow-glow)]"
          >
            Click to Unmute & Play
          </button>
        </div>
      )}

      {shouldShowErrorOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center space-y-4">
          <button
            onClick={() => setErrorMsg(null)}
            className="absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <AlertTriangle className="w-12 h-12 text-red-500 animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-white font-black text-sm uppercase tracking-widest font-mono">Stream Interrupted</h3>
            <p className="text-red-400 font-mono text-xs max-w-xs">{errorMsg}</p>
          </div>
          <button
            onClick={() => {
              logUserAction('retry_clicked', { url }, 'VideoPlayer', correlationId);
              setRetryCount(c => c + 1);
            }}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

