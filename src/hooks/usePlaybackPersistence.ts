import { mainVideoRef } from "../utils/videoRef";
import { useEffect, useRef } from "react";
import { playoutStore } from "../utils/playoutStore";

export function usePlaybackPersistence(
  activeRouteOrTab: string,
  url: string,
  title: string,
  
) {
  const activeRouteRef = useRef(activeRouteOrTab);
  const prevRouteRef = useRef(activeRouteOrTab);
  const urlRef = useRef(url);
  const titleRef = useRef(title);
  const vaultIntervalRef = useRef<NodeJS.Timeout | null>(null);

  activeRouteRef.current = activeRouteOrTab;
  urlRef.current = url;
  titleRef.current = title;

  // Broadcaster Resume on Shell Mount (Runs once)
  useEffect(() => {
    const savedState = playoutStore.getSnapshot();
    if (savedState && savedState.url === url && (mainVideoRef.current as HTMLVideoElement)) {
      const elapsedSinceExit = (Date.now() - savedState.exitTime) / 1000;
      const resumePos = savedState.seekPosition + elapsedSinceExit;
      if ((mainVideoRef.current as HTMLVideoElement).duration && resumePos < (mainVideoRef.current as HTMLVideoElement).duration) {
        (mainVideoRef.current as HTMLVideoElement).currentTime = resumePos;
      } else if (!isNaN(resumePos) && isFinite(resumePos) && resumePos > 0) {
        (mainVideoRef.current as HTMLVideoElement).currentTime = resumePos;
      }
      (mainVideoRef.current as HTMLVideoElement).play().catch(() => {});
    }
  }, []);

  // Resource Cleanup: Global Snapshot Vault Interval & Lifecycle Cleanup
  useEffect(() => {
    const clearVaultInterval = () => {
      if (vaultIntervalRef.current) {
        clearInterval(vaultIntervalRef.current);
        vaultIntervalRef.current = null;
      }
    };

    const saveCurrentState = () => {
      const v = (mainVideoRef.current as HTMLVideoElement);
      const curUrl = urlRef.current;
      if (v && curUrl) {
        playoutStore.saveSnapshot({
          url: curUrl,
          title: titleRef.current || "",
          seekPosition: v.currentTime || 0,
          exitTime: Date.now(),
        });
      }
    };

    // Start vault interval if on active playback route
    const isPlayerRoute = activeRouteOrTab === "player" || activeRouteOrTab === "live";
    if (isPlayerRoute && url) {
      clearVaultInterval();
      vaultIntervalRef.current = setInterval(() => {
        const v = (mainVideoRef.current as HTMLVideoElement);
        if (v && !v.paused && urlRef.current) {
          playoutStore.saveSnapshot({
            url: urlRef.current,
            title: titleRef.current || "",
            seekPosition: v.currentTime || 0,
            exitTime: Date.now(),
          });
        }
      }, 3000);
    } else {
      clearVaultInterval();
    }

    // App Close / Page Unload cleanup to prevent IndexedDB memory leaks
    const handleBeforeUnload = () => {
      clearVaultInterval();
      saveCurrentState();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", clearVaultInterval);

    return () => {
      clearVaultInterval();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", clearVaultInterval);
    };
  }, [activeRouteOrTab, url]);

  // Tab Focus Recovery: Tab Focus & Visibility Change Sync
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      const v = (mainVideoRef.current as HTMLVideoElement);
      const curUrl = urlRef.current;
      const curRoute = activeRouteRef.current;
      const isPlayerRoute = curRoute === "player" || curRoute === "live";

      if (document.visibilityState === "hidden") {
        // Tab inactive / hidden -> record exit snapshot
        if (v && curUrl) {
          playoutStore.saveSnapshot({
            url: curUrl,
            title: titleRef.current || "",
            seekPosition: v.currentTime || 0,
            exitTime: Date.now(),
          });
        }
      } else if (document.visibilityState === "visible" || document.hasFocus()) {
        // Browser regained focus after inactivity -> trigger playhead sync
        if (isPlayerRoute && v && curUrl) {
          const snapshot = playoutStore.getSnapshot();
          if (snapshot && snapshot.url === curUrl) {
            const inactiveSeconds = (Date.now() - snapshot.exitTime) / 1000;
            if (inactiveSeconds > 1.0) {
              const syncedPos = snapshot.seekPosition + inactiveSeconds;
              if (v.duration && syncedPos < v.duration) {
                v.currentTime = syncedPos;
              } else if (!isNaN(syncedPos) && isFinite(syncedPos) && syncedPos > 0) {
                v.currentTime = syncedPos;
              }
            }
            if (v.src && v.currentSrc !== "" && !v.src.endsWith(window.location.host + "/")) v.play().catch(() => {});
          } else if (v.paused && v.src && v.currentSrc !== "" && !v.src.endsWith(window.location.host + "/")) {
            v.play().catch(() => {});
          }
        }
      }
    };

    const handleWindowBlur = () => {
      const v = (mainVideoRef.current as HTMLVideoElement);
      const curUrl = urlRef.current;
      if (v && curUrl) {
        playoutStore.saveSnapshot({
          url: curUrl,
          title: titleRef.current || "",
          seekPosition: v.currentTime || 0,
          exitTime: Date.now(),
        });
      }
    };

    const handleWindowFocus = () => {
      handleVisibilityOrFocus();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  // Navigation surface transitions (Route switching sync)
  useEffect(() => {
    if (prevRouteRef.current !== activeRouteOrTab) {
      const v = (mainVideoRef.current as HTMLVideoElement);
      if (v && url) {
        const isNowPlayer = activeRouteOrTab === "player" || activeRouteOrTab === "live";
        if (isNowPlayer) {
          const snapshot = playoutStore.getSnapshot();
          if (snapshot && snapshot.url === url) {
            const elapsedSeconds = (Date.now() - snapshot.exitTime) / 1000;
            const resumePos = snapshot.seekPosition + elapsedSeconds;
            if (v.duration && resumePos < v.duration) {
              v.currentTime = resumePos;
            } else if (!isNaN(resumePos) && isFinite(resumePos) && resumePos > 0) {
              v.currentTime = resumePos;
            }
            if (v.src && v.currentSrc !== "" && !v.src.endsWith(window.location.host + "/")) v.play().catch(() => {});
          } else if (v.paused && v.src && v.currentSrc !== "" && !v.src.endsWith(window.location.host + "/")) {
            v.play().catch(() => {});
          }
        } else {
          v.pause();
          playoutStore.saveSnapshot({
            url,
            title: title || "",
            seekPosition: v.currentTime || 0,
            exitTime: Date.now(),
          });
        }
      }
      prevRouteRef.current = activeRouteOrTab;
    }
  }, [activeRouteOrTab, url, title]);
}

