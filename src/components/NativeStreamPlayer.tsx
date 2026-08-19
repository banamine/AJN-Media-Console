import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface StreamPlayerProps {
  manifestUrl: string;
}

export const NativeStreamPlayer: React.FC<StreamPlayerProps> = ({ manifestUrl }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<string>('INITIALIZING');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !manifestUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const proxyManifestUrl = `/api/v1/stream/live.m3u8?url=${encodeURIComponent(manifestUrl)}`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hlsRef.current = hls;

      hls.loadSource(proxyManifestUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('PLAYING');
        video.muted = true;
        video.play().catch((err) => console.warn('[Player] Autoplay deferred:', err));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setStatus('ERROR');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyManifestUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch((err) => console.warn('[Player] Safari autoplay deferred:', err));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [manifestUrl]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
      />
      {status === 'INITIALIZING' && (
        <div className="absolute font-mono text-xs text-green-400 animate-pulse">
          CONNECTING TO STREAM GATEWAY...
        </div>
      )}
    </div>
  );
};
