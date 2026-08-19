import { mainVideoRef, registerVideo } from "../utils/videoRef";
import React, { useEffect, useState, useRef } from 'react';
import { telemetry, logUserAction, generateCorrelationId, monitorVideoStalls } from "../telemetry/playbackTelemetry";
import { Tv, Mic2, Play, Pause, Square, SkipBack, SkipForward, Volume2, Info, ListVideo } from 'lucide-react';
import './PodcastTuner.css';

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


export function PodcastTuner({ audioController }: { audioController?: any }) {
  const [stations, setStations] = useState<any[]>([]);
  const [currentStation, setCurrentStation] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const correlationId = useRef(generateCorrelationId()).current;
  const autoRetryCountRef = useRef(0);
  const loadTimeoutRef = useRef<number | null>(null);
  const hlsRef = useRef<any>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

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
    let unmountMonitor: (() => void) | undefined;
    if (video && correlationId) {
      unmountMonitor = monitorVideoStalls(video, correlationId, "PodcastTuner");
    }
    return () => {
      if (unmountMonitor) unmountMonitor();
      if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
      if (hlsRef.current) {
        telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'hls_detach', payload: {} });
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      lastLoadedUrlRef.current = null;
      if (video) {
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {});
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [correlationId, currentStation]);

  useEffect(() => {
    // Pause main background player to prevent collisions
    const mainVideo = mainVideoRef.current as HTMLVideoElement;
    if (mainVideo && !mainVideo.paused) {
      mainVideo.pause();
    }

    fetch(BACKEND_URL + '/api/tuner/stations').then(r => r.json()).then(data => {
      setStations(data);
      if (data.length > 0) {
        setCurrentStation(data[0]);
      }
    });
  }, []);

  const setupLocalAnalyser = () => {
    if (!videoRef.current) return;
    if (!localAudioCtxRef.current) {
      localAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (!localAnalyserRef.current) {
      localAnalyserRef.current = localAudioCtxRef.current.createAnalyser();
      localAnalyserRef.current.fftSize = 256;
    }
    if (!localSourceRef.current) {
      localSourceRef.current = localAudioCtxRef.current.createMediaElementSource(videoRef.current);
      localSourceRef.current.connect(localAnalyserRef.current);
      localAnalyserRef.current.connect(localAudioCtxRef.current.destination);
    }
    if (localAudioCtxRef.current.state === 'suspended') {
      localAudioCtxRef.current.resume();
    }
  };

  const startVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let analyser = currentStation?.medium === 'video' ? localAnalyserRef.current : audioController?.siriusAnalyserRef?.current;
    
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      // Cinematic glowing wave
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];
        const y = height - (barHeight / 255) * height;
        ctx.lineTo(x, y);
        x += barWidth;
      }
      ctx.lineTo(width, height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(255, 106, 51, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 106, 51, 0.05)');
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 106, 51, 1)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    draw();
  };

  useEffect(() => {
    if (isPlaying && currentStation) {
      const url = currentStation.latest_audio_url;
      if (currentStation.medium === 'video' && videoRef.current) {
        audioController?.stopSiriusMusic?.();
        
        const video = videoRef.current;
        setupLocalAnalyser();

        if (lastLoadedUrlRef.current === url) {
           video.play().catch(e => {
             console.error("Playback error:", e);
             setIsPlaying(false);
           });
           startVisualizer();
           return;
        }

        lastLoadedUrlRef.current = url;

        if (hlsRef.current) {
          telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'hls_detach', payload: { url } });
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const isHls = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');

        if (!isHls) {
          if (video.src !== url) {
             video.src = url;
             video.load();
          }
          telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'native_load', payload: { url } });
          video.play().catch(e => {
            console.error("Playback error:", e);
            telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'native_error', payload: { error: e.message } });
            setIsPlaying(false);
          });
        } else {
          // HLS setup
          import("hls.js").then((HlsModule) => {
            const Hls = HlsModule.default;
            if (Hls.isSupported()) {
              const hls = new Hls({ lowLatencyMode: true });
              hlsRef.current = hls;
              
              telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'hls_attach', payload: { url } });
              hls.attachMedia(video);
              
              hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(url);
              });
              
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => {
                   console.error("HLS Playback error:", e);
                   setIsPlaying(false);
                });
              });
              
              hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
                if (data && data.fatal) {
                  telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'hls_fatal_error', payload: { details: data.details, type: data.type } });
                  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    hls.startLoad();
                  } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                  } else {
                    hls.destroy();
                    setIsPlaying(false);
                  }
                }
              });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
               telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'native_load', payload: { url } });
               video.src = url;
               video.load();
               video.play().catch(e => {
                 console.error("Native HLS Playback error:", e);
                 telemetry.trackEvent({ correlationId, emittedBy: 'PodcastTuner', category: 'PLAYER_LIFECYCLE', type: 'native_error', payload: { error: e.message } });
                 setIsPlaying(false);
               });
            }
          }).catch(err => {
            console.warn("Failed to load hls.js for podcast tuner:", err);
          });
        }
        
        startVisualizer();
      } else {
        if (videoRef.current) videoRef.current.pause();
        audioController?.playRadioStation?.(
          currentStation.podcast_id.toString(), 
          currentStation.title, 
          url, 
          currentStation.image_url
        );
        startVisualizer();
      }
    } else {
      if (currentStation?.medium === 'video' && videoRef.current) {
        videoRef.current.pause();
      } else {
        if (currentStation?.podcast_id && audioController?.activeRadioStation?.id === currentStation.podcast_id.toString()) {
          audioController?.stopSiriusMusic?.();
        }
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, currentStation]);

  // Sync state if audioController pauses/plays externally or fails to play
  useEffect(() => {
    if (currentStation?.medium !== 'video' && audioController?.activeRadioStation?.id === currentStation?.podcast_id.toString()) {
      if (isPlaying && !audioController.isSiriusPlaying) {
        setIsPlaying(false);
      } else if (!isPlaying && audioController.isSiriusPlaying) {
        setIsPlaying(true);
      }
    }
  }, [audioController?.isSiriusPlaying, audioController?.activeRadioStation, currentStation, isPlaying]);

  const currentMediaUrl = currentStation?.latest_audio_url || "";
  
  const filteredStations = stations.filter(st => st.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex-1 w-full h-full flex flex-col md:flex-row" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar - Stations List */}
      <div className="w-full md:w-80 border-r border-[var(--border)] flex flex-col bg-[var(--surface-1)] shrink-0 z-10 h-[40vh] md:h-full">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-[var(--text-1)] font-bold text-lg mb-2">Podcast Library</h2>
          <input 
            type="text" 
            placeholder="Search channels..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {filteredStations.map(st => (
            <div 
              key={st.podcast_id}
              onClick={() => { setCurrentStation(st); setIsPlaying(true); }}
              className={`flex items-center gap-3 p-3 border-b border-[var(--border)] cursor-pointer transition-colors ${
                currentStation?.podcast_id === st.podcast_id 
                  ? 'bg-[var(--surface-3)] border-l-4 border-l-[var(--accent)]' 
                  : 'hover:bg-[var(--surface-2)] border-l-4 border-l-transparent'
              }`}
            >
              {st.image_url ? (
                <img src={st.image_url} alt={st.title} className="w-12 h-12 rounded object-cover shadow-sm bg-black" />
              ) : (
                <div className="w-12 h-12 rounded bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-3)]">
                  {st.medium === 'video' ? <Tv size={20}/> : <Mic2 size={20}/>}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[var(--text-1)] text-sm font-semibold truncate">{st.title}</div>
                <div className="text-[var(--text-3)] text-xs mt-0.5 flex gap-2">
                  <span className="uppercase">{st.medium || 'AUDIO'}</span>
                  <span>{st.episode_count ? `${st.episode_count} eps` : ''}</span>
                </div>
              </div>
              {currentStation?.podcast_id === st.podcast_id && isPlaying && (
                <div className="flex items-center justify-center w-6 h-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Player Area - Concept A: Cinematic Dark Theme */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Abstract Background Glow based on Image */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none blur-[100px] flex items-center justify-center">
          {currentStation?.image_url ? (
            <img src={currentStation.image_url} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[var(--accent)]"></div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center z-10 p-6 xl:p-12 gap-8 relative h-full">
          {/* Main Album Art Container */}
          <div id="ajn-podcast-player-frame" className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ease-out bg-black flex items-center justify-center border border-[var(--border)]
            ${isPlaying ? 'shadow-[0_0_50px_rgba(255,106,51,0.25)] scale-100' : 'scale-95 grayscale-[30%] opacity-80'}`}
            style={{ width: 'min(400px, 80vw)', height: 'min(400px, 80vw)' }}
          >
            {currentStation?.medium === 'video' ? (
               <video
                 ref={setVideoRef}
                 
                 crossOrigin="anonymous"
                 className="w-full h-full object-cover bg-black"
                 controls={false}
                 autoPlay={isPlaying}
               />
            ) : currentStation?.image_url ? (
               <img src={currentStation.image_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
            ) : (
               <Mic2 size={64} className="text-[var(--text-3)]" />
            )}
            
            {/* Live Badge */}
            <div className="absolute top-4 left-4 bg-[var(--surface-1)]/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-[var(--border)]">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] animate-pulse' : 'bg-gray-500'}`}></span>
              {currentStation?.medium === 'video' ? 'VIDEO STREAM' : 'AUDIO FEED'}
            </div>
          </div>

          {/* Metadata & Controls */}
          <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-6">
            
            <div className="space-y-2">
              <h1 className="text-2xl md:text-4xl font-bold text-[var(--text-1)] tracking-tight">
                {currentStation?.title || 'Select a Podcast'}
              </h1>
              <p className="text-sm md:text-base text-[var(--text-2)] max-w-xl mx-auto line-clamp-2 leading-relaxed">
                {currentStation?.short_summary || currentStation?.description || 'No metadata available.'}
              </p>
            </div>

            {/* Play Controls - Accent Orange */}
            <div className="flex items-center gap-6 pt-4 z-20">
              <button 
                className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-all border border-[var(--border)]"
                onClick={() => setIsPlaying(false)}
              >
                <Square size={20} className="fill-current" />
              </button>
              
              <button 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white transition-all shadow-[0_0_0_1px_rgba(255,106,51,0.35),0_0_24px_rgba(255,106,51,0.15)] hover:shadow-[0_0_0_1px_rgba(255,106,51,0.5),0_0_40px_rgba(255,106,51,0.3)] hover:scale-105 active:scale-95"
                style={{ backgroundColor: 'var(--accent)' }}
                onClick={() => {
                  logUserAction(!isPlaying ? 'play_clicked' : 'pause_clicked', { url: currentStation?.latest_audio_url }, 'PodcastTuner', correlationId);
                  if (!isPlaying) {
                    setupLocalAnalyser();
                    if (localAudioCtxRef.current?.state === 'suspended') {
                      localAudioCtxRef.current.resume();
                    }
                  }
                  setIsPlaying(!isPlaying);
                }}
              >
                {isPlaying ? <Pause size={32} className="fill-current" /> : <Play size={32} className="fill-current ml-1" />}
              </button>

              <button 
                className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-all border border-[var(--border)]"
                onClick={() => {}}
              >
                <SkipForward size={20} className="fill-current" />
              </button>
            </div>

          </div>
        </div>

        {/* Waveform Visualizer at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none opacity-60 z-0 mask-image-bottom">
          <canvas ref={canvasRef} width={1200} height={128} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
