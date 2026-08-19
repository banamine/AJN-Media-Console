import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useEffect, useRef } from 'react';

// Deterministic custom vector assets to maintain brand consistency without network dependencies
export const BACKUP_THUMBNAILS = [
  // AJN Broadcast SVG Fallback (Deep indigo/violet themed)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="400" height="225" style="background:%2305070f;font-family:sans-serif;"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e1b4b"/><stop offset="100%" stop-color="%23311042"/></linearGradient></defs><rect width="400" height="225" fill="url(%23g1)"/><circle cx="200" cy="100" r="35" fill="%234338ca" opacity="0.3"/><circle cx="200" cy="100" r="25" fill="%236366f1" opacity="0.6"/><polygon points="193,88 213,100 193,112" fill="%23ffffff"/><text x="200" y="165" fill="%23a5b4fc" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="1">AJN RESOURCE HUB</text><text x="200" y="185" fill="%236366f1" font-size="10" font-family="monospace" text-anchor="middle">LIVE FEED STREAM</text></svg>`,

  // InfoWars Red Slate SVG Fallback (Red/crimson high contrast themed)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="400" height="225" style="background:%230c0404;font-family:sans-serif;"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23450a0a"/><stop offset="100%" stop-color="%23180202"/></linearGradient></defs><rect width="400" height="225" fill="url(%23g2)"/><circle cx="200" cy="100" r="35" fill="%23b91c1c" opacity="0.3"/><circle cx="200" cy="100" r="25" fill="%23ef4444" opacity="0.6"/><polygon points="193,88 213,100 193,112" fill="%23ffffff"/><text x="200" y="165" fill="%23fca5a5" font-size="14" font-weight="black" text-anchor="middle" letter-spacing="1.5">INFOWARS BROADCAST</text><text x="200" y="185" fill="%23ef4444" font-size="10" font-family="monospace" text-anchor="middle">ARCHIVE RECORDING</text></svg>`,

  // War Room Slate Gold SVG Fallback (Slate/amber themed)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="400" height="225" style="background:%23090d16;font-family:sans-serif;"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23111827"/><stop offset="100%" stop-color="%231f2937"/></linearGradient></defs><rect width="400" height="225" fill="url(%23g3)"/><circle cx="200" cy="100" r="35" fill="%23d97706" opacity="0.2"/><circle cx="200" cy="100" r="25" fill="%23f59e0b" opacity="0.5"/><polygon points="193,88 213,100 193,112" fill="%23ffffff"/><text x="200" y="165" fill="%23fde047" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="1">WAR ROOM TRANSMISSION</text><text x="200" y="185" fill="%23ca8a04" font-size="10" font-family="monospace" text-anchor="middle">ONLINE BROADCAST FEED</text></svg>`
];

export const getDeterministicBackup = (seed: string): string => {
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BACKUP_THUMBNAILS[hash % BACKUP_THUMBNAILS.length];
};

interface ArchiveThumbnailProps {
  src: string;
  alt: string;
  refreshTrigger: number; // Monotonically increasing timestamp/counter from parent
  className?: string;
  episodeUrl?: string; // Optional raw Internet Archive download URL
  isVisible?: boolean; // Optional external viewport visibility prop
}

export function resolveThumbnail(episodeUrl: string): string | null {
  if (!episodeUrl) return null;
  if (episodeUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) {
    return null;
  }
  try {
    let urlStr = episodeUrl;
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      if (urlStr.startsWith('//')) {
        urlStr = 'https:' + urlStr;
      } else {
        urlStr = 'https://archive.org' + (urlStr.startsWith('/') ? '' : '/') + urlStr;
      }
    }
    const url = new URL(urlStr);
    if (!url.hostname.includes('archive.org')) {
      return null;
    }
    
    // Path: /download/collection-id/file-name.mp4
    const parts = url.pathname.split('/').filter(p => p); 
    if (parts.length < 3 || parts[0] !== 'download') {
      return null;
    }
    const collectionId = parts[1];
    const fileNameWithExt = parts[2];
    
    // Remove extension
    const fileName = fileNameWithExt.replace(/\.[^/.]+$/, "");

    // IA Pattern: /download/[collection-id]/[collection-id].thumbs/[file-name]_thumb.jpg
    return `https://archive.org/download/${collectionId}/${collectionId}.thumbs/${fileName}_thumb.jpg`;
  } catch (e) {
    return null; 
  }
}

const getSegmentColor = (seed: string): string => {
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hues = [220, 240, 260, 280, 201, 318]; // indigo/violet/fuchsia/sky, matches the cosmic slate aesthetic
  const color1 = `hsl(${hues[hash % hues.length]}, 55%, 12%)`;
  const color2 = `hsl(${hues[(hash + 1) % hues.length]}, 45%, 6%)`;
  return `linear-gradient(135deg, ${color1}, ${color2})`;
};

export const ArchiveThumbnail: React.FC<ArchiveThumbnailProps> = ({
  src,
  alt,
  refreshTrigger,
  className = "w-full h-full object-cover rounded-xl",
  episodeUrl,
  isVisible
}) => {
  const [isInViewport, setIsInViewport] = useState<boolean>(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [loadState, setLoadState] = useState<'loading' | 'level1_ia' | 'level1_src' | 'level2_backup' | 'level3_fallback'>('loading');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [resizeMode, setResizeMode] = useState<string>('cover');

  useEffect(() => {
    const updateResizeMode = () => {
      const saved = safeLocalStorage.getItem('placecard_resize_mode') || 'cover';
      setResizeMode(saved);
    };
    updateResizeMode();
    window.addEventListener('placecard-settings-updated', updateResizeMode);
    return () => {
      window.removeEventListener('placecard-settings-updated', updateResizeMode);
    };
  }, []);

  // Dynamic Viewport Detection (Zero flicker, lazy loader observer)
  useEffect(() => {
    if (isVisible !== undefined) {
      setIsInViewport(isVisible);
      return;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect(); // Clean-up immediately once visible
        }
      },
      { rootMargin: '120px' } // Pre-emptive viewport trigger for smoother transition
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  // Handle source construction upon viewport intersection
  useEffect(() => {
    if (!isInViewport) {
      setLoadState('loading');
      setIsLoaded(false);
      setCurrentSrc('');
      return;
    }

    setIsLoaded(false);

    const resolvedIA = episodeUrl ? resolveThumbnail(episodeUrl) : null;
    
    const appendCacheBuster = (urlStr: string) => {
      if (refreshTrigger > 0) {
        const parts = urlStr.split('?');
        const basePath = parts[0];
        const existingParams = parts[1] ? `${parts[1]}&` : '';
        return `${basePath}?${existingParams}t_refresh=${refreshTrigger}`;
      }
      return urlStr;
    };

    if (resolvedIA) {
      setLoadState('level1_ia');
      setCurrentSrc(appendCacheBuster(resolvedIA));
    } else if (src) {
      setLoadState('level1_src');
      setCurrentSrc(appendCacheBuster(src));
    } else {
      const seed = alt || episodeUrl || src || 'fallback';
      const backup = getDeterministicBackup(seed);
      setLoadState('level2_backup');
      setCurrentSrc(backup);
    }
  }, [isInViewport, episodeUrl, src, refreshTrigger, alt]);

  // Resilient Error Cascade Handler (No broken image indicators allowed)
  const handleError = () => {
    setIsLoaded(false);
    const seed = alt || episodeUrl || src || 'fallback';
    
    const appendCacheBuster = (urlStr: string) => {
      if (refreshTrigger > 0) {
        const parts = urlStr.split('?');
        const basePath = parts[0];
        const existingParams = parts[1] ? `${parts[1]}&` : '';
        return `${basePath}?${existingParams}t_refresh=${refreshTrigger}`;
      }
      return urlStr;
    };

    if (loadState === 'level1_ia') {
      // Predictive IA thumbnail failed -> Try standard show logo
      if (src) {
        setLoadState('level1_src');
        setCurrentSrc(appendCacheBuster(src));
      } else {
        // No standard logo -> Try Level 2 deterministic backup
        const backup = getDeterministicBackup(seed);
        setLoadState('level2_backup');
        setCurrentSrc(backup);
      }
    } else if (loadState === 'level1_src') {
      // Standard show logo failed -> Try Level 2 deterministic backup
      const backup = getDeterministicBackup(seed);
      setLoadState('level2_backup');
      setCurrentSrc(backup);
    } else if (loadState === 'level2_backup') {
      // Level 2 backup failed (e.g. invalid asset or network error) -> Fallback to Level 3 pure CSS
      setLoadState('level3_fallback');
      setCurrentSrc('');
    }
  };

  const gradientBackground = getSegmentColor(alt || src || 'fallback');

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#0a0d1a] overflow-hidden rounded-xl flex items-center justify-center aspect-[16/9]"
      style={{ aspectRatio: "16/9" }}
    >
      {/* Level 3 CSS Fallback: Render beautifully customized metadata card */}
      {loadState === 'level3_fallback' && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center transition-all duration-300 border border-indigo-500/20 text-indigo-300"
          style={{ background: gradientBackground }}
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mb-1 border border-indigo-500/20">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold tracking-tight text-white mb-0.5 max-w-full truncate px-1 font-sans">{alt}</span>
          <span className="text-[8px] uppercase font-mono text-indigo-400/60 tracking-wider">Play Segment</span>
        </div>
      )}

      {/* Loader Frame (Pre-emptive state, subtle animated skeleton) */}
      {!isLoaded && loadState !== 'level3_fallback' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#11162d] via-[#1a2040] to-[#11162d] animate-pulse flex items-center justify-center">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-sans font-semibold">Loading...</span>
        </div>
      )}

      {/* Live Image node with native performance tuning & transition opacity controls */}
      {currentSrc && loadState !== 'level3_fallback' && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectFit: 'cover' }}
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
        />
      )}
    </div>
  );
};
