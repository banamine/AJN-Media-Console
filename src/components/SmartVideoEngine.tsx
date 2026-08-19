import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { PlaybackCircuitBreaker } from '../utils/PlaybackCircuitBreaker';
import { Volume2, List, Play, ChevronLeft, ChevronRight, Shuffle, Menu, X, RefreshCw, Radio, MonitorOff, Film } from 'lucide-react';
import { generateDayWindow } from '../utils/urlConstructor';

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');

export interface Track {
  id: string;
  title: string;
  url: string;
}

interface SmartVideoEngineProps {
  url: string;
  fallbackUrl?: string;
  onPlaying?: () => void;
  onError?: (msg?: string) => void;
}

// Multi-Pass Regex Sanitization Pipeline
export function sanitizeTrackTitle(rawTitle: string, url: string): string {
  let cleaned = rawTitle
    .replace(/^(?:Канал|KaHan|Kahan|AJN)[\s\-_/:]*(?:\d+)?[\s\-_–—:]*/gi, '')
    .replace(/\.[^/.]+$/, '')
    .replace(/_/g, ' ')
    .trim();

  if (!cleaned || cleaned.toLowerCase().includes('unknown')) {
    const segments = url.split('/');
    const fallback = segments[segments.length - 1] || 'Episode';
    cleaned = decodeURIComponent(fallback.replace(/\.[^/.]+$/, ''));
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

const ITEM_HEIGHT = 48; // Fixed row height in pixels
const VISIBLE_COUNT = 15; // Number of items rendered in DOM viewport

import { useRumbleAutoUpdater } from '../hooks/useRumbleAutoUpdater';

export const SmartVideoEngine: React.FC<SmartVideoEngineProps> = ({ url: initialUrl, fallbackUrl, onPlaying: onPlayingCallback, onError }) => {
  const url = useRumbleAutoUpdater(initialUrl);
  const [internalFallbackUrl, setInternalFallbackUrl] = useState<string | null>(null);
  const activeUrl = internalFallbackUrl || url;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<string>('AWAITING SIGNAL');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const breakerRef = useRef(new PlaybackCircuitBreaker(3, 12000));
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  // M3U Playlist State
  const [sequentialPlaylist, setSequentialPlaylist] = useState<Track[]>([]);
  const [activeQueue, setActiveQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [currentResolvedUrl, setCurrentResolvedUrl] = useState<string | null>(null);

  // Virtual Scrolling State
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Rumble Iframe Heartbeat State
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset internal fallback if the parent changes the primary url
  useEffect(() => {
    setInternalFallbackUrl(null);
  }, [url]);

  // Parse URL to check if it's an M3U playlist
  useEffect(() => {
    let isMounted = true;
    
    if (!activeUrl) {
      setCurrentResolvedUrl(null);
      setSequentialPlaylist([]);
      setActiveQueue([]);
      return;
    }

    const fetchM3u = async () => {
      // If it ends with .m3u, we fetch and parse it as a playlist
      if (activeUrl.toLowerCase().endsWith('.m3u')) {
         setStatus('PARSING PLAYLIST...');
         try {
           const fetchUrl = activeUrl.startsWith('http') && !activeUrl.includes('/api/stream-proxy')
             ? `${BACKEND_URL}/api/stream-proxy?url=${encodeURIComponent(activeUrl)}`
             : activeUrl;
           
           const res = await fetch(fetchUrl);
           const text = await res.text();
           const lines = text.split(/\r?\n/);
           const parsedTracks: Track[] = [];
           
           for (let i = 0; i < lines.length; i++) {
             const line = lines[i].trim();
             
             // Parse EXTINF metadata
             if (line.startsWith('#EXTINF:')) {
               const rawTitle = line.split(',')[1] || '';
               let trackUrl = lines[i + 1]?.trim();
               
               if (trackUrl && !trackUrl.startsWith('#')) {
                 if (!trackUrl.match(/^(https?|rtmp|rtsp|mms):\/\//i) && !trackUrl.startsWith("file://")) {
                    try { trackUrl = new URL(trackUrl, activeUrl).toString(); } catch(e) {}
                 }
                 const finalTitle = sanitizeTrackTitle(rawTitle, trackUrl);
                 parsedTracks.push({ id: `track-${i}`, title: finalTitle, url: trackUrl });
               }
             } else if (!line.startsWith('#') && line.length > 0) {
               let trackUrl = line;
               if (!trackUrl.match(/^(https?|rtmp|rtsp|mms):\/\//i) && !trackUrl.startsWith("file://")) {
                  try { trackUrl = new URL(trackUrl, activeUrl).toString(); } catch(e) {}
               }
               if (i === 0 || !lines[i-1].trim().startsWith('#EXTINF:')) {
                 const fallbackTitle = sanitizeTrackTitle("Untitled Track", trackUrl);
                 parsedTracks.push({ id: `track-${i}`, title: fallbackTitle, url: trackUrl });
               }
             }
           }
           
           if (isMounted) {
             if (parsedTracks.length > 0) {
                // Link Validator: Quick health check
                setStatus('VALIDATING MEDIA...');
                try {
                  const checkUrl = parsedTracks[0].url.startsWith('http') && !parsedTracks[0].url.includes('/api/stream-proxy')
                    ? `${BACKEND_URL}/api/stream-proxy?url=${encodeURIComponent(parsedTracks[0].url)}`
                    : parsedTracks[0].url;
                  
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 6000);
                  
                  const checkRes = await fetch(checkUrl, { 
                    method: 'GET',
                    headers: { 'Range': 'bytes=0-100' },
                    signal: controller.signal 
                  });
                  clearTimeout(timeoutId);
                  
                  if (checkRes.body && checkRes.body.cancel) checkRes.body.cancel().catch(() => {});
                  else controller.abort();
                  
                   if (!checkRes.ok && checkRes.status !== 206) {
                      console.warn(`Playlist validator advisory: Non-200 response. Proceeding anyway.`);
                  }
                } catch (healthErr) {
                  console.warn(`Playlist validation ping failed, proceeding with native engine:`, healthErr);
                }
             
                if (isMounted) {
                  setSequentialPlaylist(parsedTracks);
                  setActiveQueue(parsedTracks);
                  setCurrentTrackIndex(0);
                  setCurrentResolvedUrl(parsedTracks[0].url);
                }
             } else {
                setStatus('EMPTY PLAYLIST');
             }
           }
         } catch (err) {
           if (isMounted) {
             setStatus('FAILED TO PARSE PLAYLIST');
             setCurrentResolvedUrl(activeUrl); // fallback
           }
         }
      } else {
         setSequentialPlaylist([]);
         setActiveQueue([]);
         setCurrentTrackIndex(0);
         setCurrentResolvedUrl(activeUrl);
      }
    };
    fetchM3u();
    return () => { isMounted = false; };
  }, [activeUrl]);

  useEffect(() => {
    let isMounted = true;
    
    if (!currentResolvedUrl || !currentResolvedUrl.includes('rumble.com/embed/')) {
      if (iframeTimeoutRef.current) {
        clearTimeout(iframeTimeoutRef.current);
        iframeTimeoutRef.current = null;
      }
      return;
    }

    setStatus('AWAITING RUMBLE HEARTBEAT...');
    
    const triggerError = (msg: string) => {
      if (breakerRef.current.recordFailure()) {
        if (isMounted) setStatus(`TRIPPED: ${msg}`);
        if (fallbackUrl) {
           if (isMounted) {
             setInternalFallbackUrl(fallbackUrl);
             setStatus(`FALLBACK ENGAGED`);
           }
        } else if (onError) {
           onError(msg);
        }
      } else {
        if (isMounted) setStatus(`RECOVERING: ${msg}`);
        // Force iframe reload by appending a dummy parameter
        setCurrentResolvedUrl(prev => prev ? `${prev}${prev.includes('?') ? '&' : '?'}retry=${Date.now()}` : prev);
      }
    };

    // 1. Start the timer (e.g. 8s)
    if (iframeTimeoutRef.current) clearTimeout(iframeTimeoutRef.current);
    iframeTimeoutRef.current = setTimeout(() => {
      triggerError('IFRAME_TIMEOUT');
    }, 8000);

    // 2. Listen for postMessage heartbeat
    const onMessage = (event: MessageEvent) => {
      // Rumble player sends messages containing video data
      if (event.data && typeof event.data === 'string' && event.data.includes('Rumble')) {
        // We received something from Rumble, it's alive!
        if (iframeTimeoutRef.current) {
          clearTimeout(iframeTimeoutRef.current);
          iframeTimeoutRef.current = null;
        }
        if (isMounted && status !== 'PLAYING') {
          setStatus('PLAYING');
          if (onPlayingCallback) onPlayingCallback();
          breakerRef.current.reset();
        }
      } else if (event.data && typeof event.data === 'object' && event.source === iframeRef.current?.contentWindow) {
        if (iframeTimeoutRef.current) {
          clearTimeout(iframeTimeoutRef.current);
          iframeTimeoutRef.current = null;
        }
        if (isMounted && status !== 'PLAYING') {
          setStatus('PLAYING');
          if (onPlayingCallback) onPlayingCallback();
          breakerRef.current.reset();
        }
      }
    };

    window.addEventListener('message', onMessage);

    return () => {
      isMounted = false;
      if (iframeTimeoutRef.current) clearTimeout(iframeTimeoutRef.current);
      window.removeEventListener('message', onMessage);
    };
  }, [currentResolvedUrl, onError, onPlayingCallback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentResolvedUrl || currentResolvedUrl.includes('rumble.com/embed/')) return;

    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let isMounted = true;
    setStatus('ANALYZING PROTOCOL...');

    const triggerError = (msg: string) => {
      if (breakerRef.current.recordFailure()) {
        if (isMounted) setStatus(`TRIPPED: ${msg}`);
        if (onError) onError(msg);
      } else {
        if (isMounted) setStatus(`RECOVERING: ${msg}`);
        if (hlsRef.current) hlsRef.current.recoverMediaError();
      }
    };

    const handlePlayError = (e: any) => {
      if (e.name === 'NotAllowedError') {
        if (isMounted) setAutoplayBlocked(true);
        video.muted = true;
        video.play().catch(() => {});
      }
    };

    const onPlaying = () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      breakerRef.current.reset();
      if (isMounted && status !== 'PLAYING') setStatus('PLAYING');
      if (onPlayingCallback) onPlayingCallback();
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onPlaying);

    const onStalled = () => {
      if (!isMounted) return;
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => triggerError('STUCK_BUFFERING'), 5000);
    };

    const onNativeError = () => {
      const err = video.error;
      triggerError(err ? `NATIVE_ERROR_${err.code}` : 'UNKNOWN_NATIVE_ERROR');
    };
    
    // Auto-advance activeQueue
    const onEnded = () => {
      if (activeQueue.length > 1) {
        const nextIndex = (currentTrackIndex + 1) % activeQueue.length;
        setCurrentTrackIndex(nextIndex);
        setCurrentResolvedUrl(activeQueue[nextIndex].url);
      }
    };

    video.addEventListener('waiting', onStalled);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('error', onNativeError);
    video.addEventListener('ended', onEnded);

    const initializePlayout = async () => {
      let targetStream = currentResolvedUrl;

      try {
        if (targetStream.includes('rumble.com/embed/')) {
          setStatus('EXTRACTING RUMBLE HLS TOKENS...');
          const match = targetStream.match(/\/embed\/([^\/?]+)/);
          const videoId = match ? match[1] : null;
          
          if (videoId) {
            const res = await fetch(BACKEND_URL + `/api/rumble/stream-data/${videoId}`);
            if (res.ok) {
              const payload = await res.json();
              if (payload.success && payload.data?.u?.hls?.url) {
                targetStream = payload.data.u.hls.url;
              } else if (payload.success && payload.data?.u?.mp4?.['480']?.url) {
                targetStream = payload.data.u.mp4['480'].url;
              }
            }
          }
        }

        if (!isMounted) return;
        const isFlatFile = targetStream.toLowerCase().includes('.m4v') || targetStream.toLowerCase().includes('.mp4');

        if (
          targetStream.includes('.m3u8') && 
          targetStream.startsWith('http') && 
          !targetStream.includes('rumble.com') &&
          !isFlatFile
        ) {
          setStatus('ROUTING THROUGH CORS GATEWAY...');
          targetStream = `/api/v1/stream/live.m3u8?url=${encodeURIComponent(targetStream)}`;
        }

        if (!isMounted) return;

        setStatus('BUFFERING...');
        
        if (targetStream.includes('.m3u8') && Hls.isSupported() && !isFlatFile) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(targetStream);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (isMounted) setStatus('PLAYING');
            video.muted = true; 
            video.play().catch(handlePlayError);
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              if (isMounted) setStatus(`ENGINE ERROR: ${data.type}`);
              hls.stopLoad();
              hls.detachMedia();
              hls.destroy();
              hlsRef.current = null;
              triggerError(data.type);
            }
          });
        } else {
          video.src = targetStream;
          video.onloadedmetadata = () => {
            if (isMounted) setStatus('PLAYING');
            video.muted = true;
            video.play().catch(handlePlayError);
          };
        }
      } catch (err: any) {
        if (isMounted) setStatus(`PIPELINE FAILURE: ${err.message}`);
      }
    };

    initializePlayout();

    return () => {
      isMounted = false;
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onPlaying);
      video.removeEventListener('waiting', onStalled);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('error', onNativeError);
      video.removeEventListener('ended', onEnded);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [currentResolvedUrl, currentTrackIndex, activeQueue.length]);

  const toggleShuffle = () => {
    if (!isShuffle) {
      if (activeQueue.length <= 1) return;
      const currentTrack = activeQueue[currentTrackIndex];
      const remaining = sequentialPlaylist.filter(t => t.id !== currentTrack.id);
      
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      
      const newQueue = [currentTrack, ...remaining];
      setActiveQueue(newQueue);
      setCurrentTrackIndex(0);
      setIsShuffle(true);
    } else {
      const currentTrack = activeQueue[currentTrackIndex];
      setActiveQueue(sequentialPlaylist);
      const originalIndex = sequentialPlaylist.findIndex(t => t.id === currentTrack.id);
      setCurrentTrackIndex(Math.max(0, originalIndex));
      setIsShuffle(false);
    }
  };

  const virtualWindow = useMemo(() => {
    const start = Math.max(0, scrollOffset - 2); 
    const end = Math.min(activeQueue.length, start + VISIBLE_COUNT + 4);
    return {
      items: activeQueue.slice(start, end),
      startIndex: start,
      topPadding: start * ITEM_HEIGHT,
      bottomPadding: Math.max(0, (activeQueue.length - end) * ITEM_HEIGHT)
    };
  }, [activeQueue, scrollOffset]);

  if (!url) return null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-xl border border-slate-800/80 shadow-[0_0_20px_rgba(0,0,0,0.6)] flex">
      <div className={`relative flex-1 ${activeQueue.length > 0 ? 'md:border-r md:border-slate-800/80' : ''}`}>
        {currentResolvedUrl && currentResolvedUrl.includes('rumble.com/embed/') ? (
          <iframe
            ref={iframeRef}
            src={currentResolvedUrl}
            className="w-full h-full border-0 z-10"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <video 
             ref={videoRef} 
             className="w-full h-full object-contain z-10 !block !visible" 
             controls 
             playsInline 
           />
        )}
              
        {autoplayBlocked && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
            <button
              onClick={() => {
                if (videoRef.current) {
                  setAutoplayBlocked(false);
                  setTimeout(() => {
                    if (videoRef.current) {
                      videoRef.current.muted = false;
                      videoRef.current.play().catch(() => {});
                    }
                  }, 50);
                }
              }}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-2)] text-white font-mono text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-[var(--shadow-glow)]"
            >
              <Volume2 className="w-5 h-5" />
              Click to Unmute & Play
            </button>
          </div>
        )}
        
        {/* Persistent 3-Way Control Strip for Rumble Embeds */}
        {url.includes('rumble.com') && (
           <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
             <button
               onClick={() => {
                 setInternalFallbackUrl(null);
                 setStatus('AWAITING RUMBLE HEARTBEAT...');
                 breakerRef.current.reset();
                 setCurrentResolvedUrl(prev => prev ? `${prev.split('&retry=')[0]}&retry=${Date.now()}` : prev);
               }}
               className={`flex items-center gap-1.5 px-3 py-1.5 border font-mono text-[10px] font-bold uppercase tracking-wider rounded transition-all shadow-lg backdrop-blur ${
                 internalFallbackUrl === null
                   ? 'bg-blue-600 border-blue-500 text-white'
                   : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/50 text-slate-300'
               }`}
               title="Watch live Rumble embed"
             >
               <Radio className="w-3.5 h-3.5" />
               Live
             </button>
             
             <button
               onClick={() => {
                 setInternalFallbackUrl('about:blank');
                 setStatus('EMBED CLOSED');
               }}
               className={`flex items-center gap-1.5 px-3 py-1.5 border font-mono text-[10px] font-bold uppercase tracking-wider rounded transition-all shadow-lg backdrop-blur ${
                 internalFallbackUrl === 'about:blank'
                   ? 'bg-red-600 border-red-500 text-white'
                   : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/50 text-slate-300'
               }`}
               title="Close video embed"
             >
               <MonitorOff className="w-3.5 h-3.5" />
               Close
             </button>
             
             <button
               onClick={() => {
                 const vodUrl = generateDayWindow("AJN Hourly", new Date())[0];
                 if (vodUrl) {
                   setInternalFallbackUrl(vodUrl);
                   setStatus('SWITCHED TO VOD');
                 }
               }}
               className={`flex items-center gap-1.5 px-3 py-1.5 border font-mono text-[10px] font-bold uppercase tracking-wider rounded transition-all shadow-lg backdrop-blur ${
                 internalFallbackUrl && internalFallbackUrl !== 'about:blank'
                   ? 'bg-orange-600 border-orange-500 text-white'
                   : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/50 text-slate-300'
               }`}
               title="Switch to native HTML5 VOD playback"
             >
               <Film className="w-3.5 h-3.5" />
               Switch to VOD
             </button>
           </div>
        )}

        {/* Frosted Glass Diagnostic Overlay */}
        <div 
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md tuning-overlay-selector transition-opacity duration-300"
          style={{ 
             opacity: (status !== 'PLAYING' && !(currentResolvedUrl && currentResolvedUrl.includes('rumble.com/embed/'))) ? 1 : 0, 
             pointerEvents: (status !== 'PLAYING' && !(currentResolvedUrl && currentResolvedUrl.includes('rumble.com/embed/'))) ? 'auto' : 'none' 
           }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-blue-400 font-mono text-xs tracking-[0.2em] animate-pulse uppercase">
              {status}
            </span>
          </div>
        </div>

        {/* Hamburger to open drawer */}
        {activeQueue.length > 0 && !isDrawerOpen && (
          <button 
            onClick={() => setIsDrawerOpen(true)}
            onMouseEnter={() => setIsDrawerOpen(true)}
            className="absolute top-4 right-4 z-40 p-2 bg-black/60 backdrop-blur rounded-lg border border-white/20 text-white shadow-lg cursor-pointer hover:bg-black/80 transition-all"
            title="Open Playlist Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {/* Playlist UI Sidebar / Drawer */}
      {activeQueue.length > 0 && (
        <div 
          onMouseLeave={() => setIsDrawerOpen(false)}
          className={`
          absolute top-0 right-0 h-full z-40 transition-transform duration-300 shadow-2xl
          ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
          w-72 md:w-64 flex-shrink-0 bg-[#0a0f21]/95 backdrop-blur border-l border-slate-800/80 flex flex-col overflow-hidden
        `}>
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest font-mono">
                       {isShuffle ? 'Shuffled Queue' : 'Playlist'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleShuffle}
                        className={`p-1.5 rounded transition-colors ${isShuffle ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
                        title="Toggle Shuffle"
                    >
                        <Shuffle className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={() => setIsDrawerOpen(false)}
                        className="md:hidden p-1.5 text-slate-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="flex items-center justify-between bg-black/20 rounded border border-slate-800/50 p-1">
                <button 
                    onClick={() => {
                        if (currentTrackIndex > 0) {
                            setCurrentTrackIndex(currentTrackIndex - 1);
                            setCurrentResolvedUrl(activeQueue[currentTrackIndex - 1].url);
                        }
                    }}
                    disabled={currentTrackIndex === 0}
                    className="p-1 text-slate-400 hover:text-white rounded transition-colors disabled:opacity-30"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-slate-500 w-full text-center">
                    {currentTrackIndex + 1} / {activeQueue.length}
                </span>
                <button 
                    onClick={() => {
                        if (currentTrackIndex < activeQueue.length - 1) {
                            setCurrentTrackIndex(currentTrackIndex + 1);
                            setCurrentResolvedUrl(activeQueue[currentTrackIndex + 1].url);
                        } else {
                            setCurrentTrackIndex(0);
                            setCurrentResolvedUrl(activeQueue[0].url);
                        }
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
          </div>
          
          <div 
             className="flex-1 overflow-y-auto relative custom-scrollbar"
             onScroll={(e) => {
               const scrollTop = e.currentTarget.scrollTop;
               setScrollOffset(Math.floor(scrollTop / ITEM_HEIGHT));
             }}
          >
            <div style={{ height: `${activeQueue.length * ITEM_HEIGHT}px`, position: 'relative' }}>
              <div style={{ transform: `translateY(${virtualWindow.topPadding}px)` }}>
                {virtualWindow.items.map((track, idx) => {
                  const absoluteIdx = virtualWindow.startIndex + idx;
                  const isActive = absoluteIdx === currentTrackIndex;
                  return (
                    <div 
                      key={absoluteIdx}
                      style={{ height: `${ITEM_HEIGHT}px` }}
                      className="px-2 py-1"
                    >
                      <button
                        onClick={() => {
                          setCurrentTrackIndex(absoluteIdx);
                          setCurrentResolvedUrl(track.url);
                          if (window.innerWidth < 768) setIsDrawerOpen(false);
                        }}
                        className={`w-full h-full text-left rounded-lg cursor-pointer flex items-center gap-2 transition-all px-2 ${
                          isActive 
                            ? "bg-blue-600/20 border border-blue-500/30 text-blue-300" 
                            : "text-slate-400 hover:bg-slate-800/50 border border-transparent"
                        }`}
                      >
                        <div className="flex-shrink-0 w-4 flex justify-center opacity-60">
                          {isActive ? <Play className="w-3 h-3 text-blue-400 fill-current" /> : <span className="text-[9px] font-mono">{absoluteIdx + 1}.</span>}
                        </div>
                        <span className="text-[11px] font-sans font-medium truncate flex-1 text-left">
                          {track.title}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
