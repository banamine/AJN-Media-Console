/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback } from "react";

export interface MediaSessionMetadata {
  title: string;
  artist?: string;
  album?: string;
  artwork?: { src: string; sizes: string; type?: string }[];
}

interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onSeekTo?: (time: number) => void;
}

export function useMediaSession(handlers: MediaSessionHandlers) {
  const setMetadata = useCallback((metadata: MediaSessionMetadata) => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: metadata.title,
        artist: metadata.artist || "AJN Liberty Play",
        album: metadata.album || "Sirius Deck",
        artwork: metadata.artwork || [
          {
            src: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
            sizes: "128x128",
            type: "image/jpeg",
          },
        ],
      });
    } catch (err) {
      console.error("Error setting media session metadata:", err);
    }
  }, []);

  const clearMetadata = useCallback(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = null;
  }, []);

  const setPlaybackState = useCallback((state: "playing" | "paused" | "none") => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch (err) {
      console.error("Error setting media session playback state:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const ms = navigator.mediaSession;

    try {
      if (handlers.onPlay) {
        ms.setActionHandler("play", handlers.onPlay);
      } else {
        ms.setActionHandler("play", null);
      }

      if (handlers.onPause) {
        ms.setActionHandler("pause", handlers.onPause);
      } else {
        ms.setActionHandler("pause", null);
      }

      if (handlers.onNextTrack) {
        ms.setActionHandler("nexttrack", handlers.onNextTrack);
      } else {
        ms.setActionHandler("nexttrack", null);
      }

      if (handlers.onPreviousTrack) {
        ms.setActionHandler("previoustrack", handlers.onPreviousTrack);
      } else {
        ms.setActionHandler("previoustrack", null);
      }

      if (handlers.onSeekTo) {
        ms.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined && handlers.onSeekTo) {
            handlers.onSeekTo(details.seekTime);
          }
        });
      } else {
        ms.setActionHandler("seekto", null);
      }
    } catch (err) {
      console.error("Error setting media session action handlers:", err);
    }

    return () => {
      if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
      const cleanMs = navigator.mediaSession;
      try {
        cleanMs.setActionHandler("play", null);
        cleanMs.setActionHandler("pause", null);
        cleanMs.setActionHandler("previoustrack", null);
        cleanMs.setActionHandler("nexttrack", null);
        cleanMs.setActionHandler("seekto", null);
      } catch (err) {
        console.error("Error clearing media session action handlers:", err);
      }
    };
  }, [handlers]);

  return { setMetadata, clearMetadata, setPlaybackState };
}
