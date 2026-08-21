import React, { useState, useEffect, useRef } from "react";

interface LazyChannelLogoProps {
  src: string;
  alt?: string;
  className?: string; // Standardized sizing and styles can be customized or default
  fallbackSrc?: string;
}

// Module-level cache to permanently remember broken image URLs across mounts, re-renders, and virtualized list recycling
const failedImageUrls = new Set<string>();

export function LazyChannelLogo({
  src,
  alt = "",
  className = "w-8 h-8 rounded-xl border border-slate-800 object-contain bg-[#1a1a1a]",
  fallbackSrc = "https://archive.org/download/daily-highlights/lmbsa.png",
}: LazyChannelLogoProps) {
  const isKnownBroken = failedImageUrls.has(src);
  const [isLoaded, setIsLoaded] = useState(isKnownBroken);
  const [isInView, setIsInView] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(
    isKnownBroken ? fallbackSrc : null
  );
  const elementRef = useRef<HTMLDivElement>(null);

  // Handle src changes and crossfade reset for both on-screen and off-screen states
  useEffect(() => {
    if (failedImageUrls.has(src)) {
      if (currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
        setIsLoaded(true);
      }
      return;
    }

    if (src !== currentSrc) {
      setIsLoaded(false);
      if (isInView) {
        setCurrentSrc(src);
      }
    }
  }, [src, isInView, currentSrc, fallbackSrc]);

  // IntersectionObserver lifecycle fully decoupled from src (empty dependency array)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        rootMargin: "400px 0px", // prefetch 400px off-screen to eliminate pop-in and flashing on scroll/recycling
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
  }, []);

  return (
    <div 
      ref={elementRef} 
      className={`relative overflow-hidden shrink-0 ${className} flex items-center justify-center bg-[#1a1a1a]`}
    >
      {/* Smooth dark placeholder background to prevent white flashes during recycling */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center" aria-hidden="true" />
      )}

      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-contain transition-opacity duration-200 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            e.currentTarget.onerror = null;
            failedImageUrls.add(src);
            setCurrentSrc(fallbackSrc);
            setIsLoaded(true);
          }}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
