import { useState, useEffect, useRef, useCallback } from "react";
import { PlayerStore, PlayerState } from "../types";
import { isRumbleUrl, isYouTubeUrl } from "../utils/urlUtils";
import { cleanTitle } from "../utils/titleCleaner";

export const VALID_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  idle: ["mounting", "attaching", "loading", "ready", "error", "idle"],
  mounting: ["attaching", "loading", "ready", "error", "idle", "mounting"],
  attaching: ["loading", "ready", "error", "idle", "attaching"],
  loading: ["ready", "playing", "error", "idle", "loading"],
  ready: ["playing", "loading", "error", "idle", "ready"],
  playing: ["buffering", "ready", "ended", "error", "idle", "playing"],
  buffering: ["playing", "recovering", "ready", "error", "idle", "buffering"],
  recovering: ["loading", "ready", "error", "idle", "recovering"],
  ended: ["playing", "loading", "ready", "idle", "ended"],
  error: ["idle", "loading", "mounting", "error"]
};

interface UsePlayerOptions {
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
}

export function usePlayer({ addLog }: UsePlayerOptions) {
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<any>(null);

  // Unified Player Store State implementation
  const [playerStore, setPlayerStore] = useState<PlayerStore>({
    state: "idle",
    currentUrl: "",
    currentTitle: "No Active Channel",
    duration: 0,
    currentTime: 0,
    volume: 0.85,
    isMuted: true,
    diagnostics: {
      streamType: "auto",
      feedSourceUsed: "Direct Express Proxy",
      videoRefMounted: false,
      recoveryAttempts: 0
    }
  });

  // Derived selectors
  const isEmbed = isRumbleUrl(playerStore.currentUrl) || isYouTubeUrl(playerStore.currentUrl);
  const isPlaying = playerStore.state === "playing" || isEmbed;
  const isLoading = !isEmbed && (playerStore.state === "loading" || playerStore.state === "mounting" || playerStore.state === "attaching" || playerStore.state === "recovering");
  const isBuffering = !isEmbed && playerStore.state === "buffering";
  const showSpinner = !isEmbed && (
    playerStore.state === "loading" ||
    playerStore.state === "mounting" ||
    playerStore.state === "attaching" ||
    playerStore.state === "recovering" ||
    playerStore.state === "buffering"
  );
  const showGatewayOverlay = !isEmbed && (
    playerStore.state === "loading" ||
    playerStore.state === "mounting" ||
    playerStore.state === "attaching" ||
    playerStore.state === "recovering" ||
    playerStore.state === "buffering"
  );

  const currentUrl = playerStore.currentUrl || "";
  const currentTitle = playerStore.currentTitle || "No Active Channel";
  const feedSourceUsed = playerStore.diagnostics.feedSourceUsed;
  const videoRefMounted = playerStore.diagnostics.videoRefMounted;
  const playerVolume = playerStore.volume;
  const isPlayerMuted = playerStore.isMuted;

  // Helpers to update unified player store state
  const setPlayerStatus = useCallback((status: "Idle" | "Loading" | "Playing" | "Paused" | "Error") => {
    setPlayerStore((prev) => {
      let nextState: PlayerState = "idle";
      if (status === "Idle") nextState = "idle";
      else if (status === "Loading") nextState = "loading";
      else if (status === "Playing") nextState = "playing";
      else if (status === "Paused") nextState = "ready";
      else if (status === "Error") nextState = "error";

      return {
        ...prev,
        state: nextState
      };
    });
  }, []);

  const setCurrentUrl = useCallback((url: string) => {
    setPlayerStore((prev) => {
      let type: "iptv" | "archive" | "uploads" | "direct" | "unknown" = "unknown";
      if (!url) type = "unknown";
      else if (url.includes("archive.org")) type = "archive";
      else if (url.includes("/api/stream-proxy") || url.includes(".m3u8") || url.includes("m3u8")) type = "iptv";
      else if (url.startsWith("blob:") || url.startsWith("data:")) type = "uploads";
      else if (url.includes("alexjones.media") || url.includes("infowars") || url.includes("gcnlive")) type = "direct";

      const newAttempts = prev.currentUrl === url ? prev.diagnostics.recoveryAttempts || 0 : 0;

      return {
        ...prev,
        state: !url ? "idle" : prev.state,
        currentUrl: url,
        diagnostics: {
          ...prev.diagnostics,
          recoveryAttempts: newAttempts
        },
        source: url
          ? {
              type,
              url,
              title: prev.currentTitle || ""
            }
          : undefined
      };
    });
  }, []);

  const setCurrentTitle = useCallback((title: string) => {
    const cleaned = cleanTitle(title);
    setPlayerStore((prev) => ({
      ...prev,
      currentTitle: cleaned,
      source: prev.source ? { ...prev.source, title: cleaned } : undefined
    }));
  }, []);

  const setFeedSourceUsed = useCallback((sourceStr: string) => {
    setPlayerStore((prev) => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        feedSourceUsed: sourceStr
      }
    }));
  }, []);

  const setVideoRefMounted = useCallback((mounted: boolean) => {
    setPlayerStore((prev) => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        videoRefMounted: mounted
      }
    }));
  }, []);

  const setPlayerVolume = useCallback((vol: number) => {
    setPlayerStore((prev) => ({
      ...prev,
      volume: vol
    }));
  }, []);

  const setIsPlayerMuted = useCallback((muted: boolean) => {
    setPlayerStore((prev) => ({
      ...prev,
      isMuted: muted
    }));
  }, []);

  // State audit logger with transition validation checks
  const lastStateRef = useRef<PlayerState>(playerStore.state);
  useEffect(() => {
    if (lastStateRef.current !== playerStore.state) {
      const from = lastStateRef.current;
      const to = playerStore.state;
      const allowed = VALID_TRANSITIONS[from]?.includes(to);
      const symbol = allowed ? "🔄" : "⚠️ [Illegal state transition!]";
      addLog(`[PlayerState Audit] ${symbol} ${from} -> ${to}`, allowed ? "info" : "warning");
      lastStateRef.current = to;
    }
  }, [playerStore.state, addLog]);

  // Reset retryCount on successful play
  useEffect(() => {
    if (playerStore.state === "playing") {
      setRetryCount(0);
    }
  }, [playerStore.state]);

  // Reset retryCount on URL changes
  useEffect(() => {
    setRetryCount(0);
  }, [playerStore.currentUrl]);

  // Loading timeout watchdog with retry logic
  useEffect(() => {
    if (isRumbleUrl(playerStore.currentUrl) || isYouTubeUrl(playerStore.currentUrl)) return;
    const isPending = ["mounting", "attaching", "loading", "recovering"].includes(playerStore.state);
    if (!isPending) return;

    const timeoutSec = 60; // Increased watchdog timeout to 60s
    const timer = setTimeout(() => {
      addLog(`[Watchdog] Player stayed stuck in '${playerStore.state}' state for > ${timeoutSec}s. Current State: ${playerStore.state}. URL: ${playerStore.currentUrl || "None"}. Title: ${playerStore.currentTitle || "None"}.`, "warning");
      
      const targetUrl = playerStore.currentUrl;
      
      // CRITICAL GUARDRAIL: If the target URL is empty, do not schedule retry loops
      if (!targetUrl || targetUrl.trim() === "") {
        console.warn("[Watchdog Malfunction] Stuck state detected, but target URL is empty. Canceling loop.");
        addLog("Watchdog intercepted null stream hang. Resetting media engine to idle safety card.", "warning");
        
        setPlayerStore(prev => ({ ...prev, state: "idle" }));
        return;
      }
      if (retryCount < 3) {
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);
        
        addLog(`[Watchdog] Stream is taking longer than expected... retrying (Attempt ${nextRetry}/3) with exponential backoff in ${5 * nextRetry}s.`, "warning");
        
        retryTimerRef.current = setTimeout(() => {
          const url = playerStore.currentUrl;
          const title = playerStore.currentTitle;
          
          addLog(`[Watchdog] Initiating auto-retry load for: ${title || "Active Stream"}`, "info");
          
          // Reset to idle to trigger cleanup
          setPlayerStore((prev) => ({
            ...prev,
            state: "idle",
            currentUrl: ""
          }));
          
          // Then load fresh
          setTimeout(() => {
            setPlayerStore((prev) => ({
              ...prev,
              state: "loading",
              currentUrl: url,
              currentTitle: title
            }));
          }, 100);
        }, 5000 * nextRetry);
      } else {
        addLog(`[Watchdog] All 3 retry attempts exhausted. Resetting to error state.`, "error");
        setPlayerStore((prev) => ({
          ...prev,
          state: "error",
          error: {
            code: "TIMEOUT_ERR",
            message: "Media connection gateway timed out after multiple retries"
          }
        }));
      }
    }, timeoutSec * 1000);

    return () => {
      clearTimeout(timer);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [playerStore.state, playerStore.currentUrl, playerStore.currentTitle, retryCount, addLog]);

  return {
    playerStore,
    setPlayerStore,
    isPlaying,
    isLoading,
    isBuffering,
    showSpinner,
    showGatewayOverlay,
    currentUrl,
    currentTitle,
    feedSourceUsed,
    videoRefMounted,
    playerVolume,
    isPlayerMuted,
    setPlayerStatus,
    setCurrentUrl,
    setCurrentTitle,
    setFeedSourceUsed,
    setVideoRefMounted,
    setPlayerVolume,
    setIsPlayerMuted,
    retryCount,
    setRetryCount
  };
}
