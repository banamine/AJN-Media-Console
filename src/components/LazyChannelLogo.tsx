import React, { useState, useEffect, useRef } from "react";

interface LazyChannelLogoProps {
  src: string;
  alt?: string;
  className?: string; // Standardized sizing and styles can be customized or default
  fallbackSrc?: string;
}

export function LazyChannelLogo({
  src,
  alt = "",
  className = "w-8 h-8 rounded-xl border border-slate-800 object-contain bg-[#050608]",
  fallbackSrc = "https://archive.org/download/daily-highlights/lmbsa.png",
}: LazyChannelLogoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state on search or catalog changes
    setIsLoaded(false);
    setIsInView(false);
    setCurrentSrc(null);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "80px", // prefetch when item is within 80px of view
        threshold: 0.01,
      }
    );

    const currentElem = elementRef.current;
    if (currentElem) {
      observer.observe(currentElem);
    }

    return () => {
      observer.disconnect();
    };
  }, [src]);

  useEffect(() => {
    if (isInView && src) {
      setCurrentSrc(src);
    }
  }, [isInView, src]);

  return (
    <div 
      ref={elementRef} 
      className={`relative overflow-hidden shrink-0 ${className} flex items-center justify-center`}
    >
      {/* CSS-Based Skeleton Loader State (Pulsing backplate + minimalist indicator) */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center" aria-hidden="true">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-ping" />
        </div>
      )}

      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-contain transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            e.currentTarget.onerror = null;
            setCurrentSrc(fallbackSrc);
            setIsLoaded(true);
          }}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
