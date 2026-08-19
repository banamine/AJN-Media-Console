import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { parseM3UPlaylistAsync } from "../services/PlaylistVault";
import { getDBValue, putsDBValue } from "../services/IndexedDB";
import { getArchiveThumbnail } from "../utils/thumbnailHelper";
import { QuarantineLedger } from "../utils/quarantineLedger";
import { MasterPlaylistEpisode } from "../services/VirtualChannelEngine";

export interface ChannelConfig {
  id: string;
  name: string;
  url: string;
  staggerOffsetPercent: number;
  category?: string;
}

export interface VirtualChannelState {
  episodes: MasterPlaylistEpisode[];
  totalDuration: number;
  loading: boolean;
  error: string | null;
  staggerOffsetSeconds: number;
}

export type VirtualChannelsMap = Record<string, VirtualChannelState>;

class SimpleRateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private activeRequests = 0;
  private maxConcurrent = 2; // Allow slightly more concurrency for bulk but limit pace

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrapped = async () => {
        this.activeRequests++;
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeRequests--;
          this.processNext();
        }
      };
      this.queue.push(wrapped);
      this.processNext();
    });
  }

  private processNext() {
    if (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        setTimeout(() => {
          next();
        }, 300); // 300ms spacing
      }
    }
  }
}

const outboundRateLimiter = new SimpleRateLimiter();

export function useVirtualArchiveChannels(
  rawConfigs: ChannelConfig[],
  prioritizedIds: Set<string> = new Set()
) {
  const configs = useMemo(() => {
    return rawConfigs.filter(cfg => !QuarantineLedger.isQuarantined(cfg.id));
  }, [rawConfigs]);

  const [states, setStates] = useState<VirtualChannelsMap>(() => {
    const initial: VirtualChannelsMap = {};
    configs.forEach((cfg) => {
      initial[cfg.id] = {
        episodes: [],
        totalDuration: 0,
        loading: false,
        error: null,
        staggerOffsetSeconds: 0,
      };
    });
    return initial;
  });

  const configsRef = useRef(configs);
  configsRef.current = configs;

  const loadingInProgress = useRef<Set<string>>(new Set());

  const loadChannelPlaylist = useCallback(async (cfg: ChannelConfig) => {
    if (loadingInProgress.current.has(cfg.id)) return;
    loadingInProgress.current.add(cfg.id);

    setStates((prev) => ({
      ...prev,
      [cfg.id]: {
        ...prev[cfg.id],
        loading: true,
        error: null,
      },
    }));

    const cacheKey = `m3u_cache_${cfg.url}`;
    const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

    try {
      // 1. Try to read from IndexedDB cache
      let m3uText = "";
      let cached: any = null;
      try {
        cached = await getDBValue<{ text: string; cachedAt: number }>("import_cache", cacheKey);
      } catch (e) {
        console.warn("[useVirtualArchiveChannels] IndexedDB read failed, falling back to fetch:", e);
      }

      if (cached && Date.now() - cached.cachedAt < cacheTTL) {
        m3uText = cached.text;
      } else {
        // 2. Fetch from network via rate limiter
        m3uText = await outboundRateLimiter.enqueue(async () => {
          const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(cfg.url)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          const text = await response.text();

          // Save to IndexedDB cache asynchronously
          try {
            await putsDBValue("import_cache", {
              key: cacheKey,
              text,
              cachedAt: Date.now(),
            });
          } catch (e) {
            console.warn("[useVirtualArchiveChannels] IndexedDB write failed:", e);
          }

          return text;
        });
      }

      // 3. Parse and Map to episodes
      const parsedChannels = await parseM3UPlaylistAsync(m3uText, cfg.url);
      const episodes: MasterPlaylistEpisode[] = parsedChannels.map((ch, idx) => {
        const duration = ch.duration && ch.duration > 0 ? ch.duration : 1800; // default 30 mins
        const cleanTitle = ch.name || `Segment ${idx + 1}`;

        return {
          id: `${cfg.id}-ep-${idx}`,
          title: cleanTitle,
          durationInSeconds: duration,
          url: ch.url,
          thumbnail: ch.logo || getArchiveThumbnail("Archive", cleanTitle),
          plot: ch.description || `Archived segment: ${cleanTitle}.`,
          genre: "Archive",
          rating: "TV-14",
        };
      });

      const totalDuration = episodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
      const staggerOffsetSeconds = Math.floor(cfg.staggerOffsetPercent * totalDuration);

      setStates((prev) => ({
        ...prev,
        [cfg.id]: {
          episodes,
          totalDuration,
          loading: false,
          error: null,
          staggerOffsetSeconds,
        },
      }));
    } catch (err: any) {
      console.warn(`[useVirtualArchiveChannels] Failed to load ${cfg.id}:`, err.message || err);
      setStates((prev) => ({
        ...prev,
        [cfg.id]: {
          ...prev[cfg.id],
          loading: false,
          error: err.message || "Failed to load channel",
        },
      }));
    } finally {
      loadingInProgress.current.delete(cfg.id);
    }
  }, []);

  // Update initial states structure when configs list changes
  useEffect(() => {
    setStates((prev) => {
      const next = { ...prev };
      let changed = false;
      configs.forEach((cfg) => {
        if (!next[cfg.id]) {
          next[cfg.id] = {
            episodes: [],
            totalDuration: 0,
            loading: false,
            error: null,
            staggerOffsetSeconds: 0,
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [configs]);

  // Load channels based on priority (visible/tuned)
  useEffect(() => {
    configs.forEach((cfg) => {
      const state = states[cfg.id];
      const hasEpisodes = state && state.episodes.length > 0;
      const isPriority = prioritizedIds.has(cfg.id);

      if (isPriority && !hasEpisodes && !state?.loading) {
        loadChannelPlaylist(cfg);
      }
    });
  }, [configs, prioritizedIds, states, loadChannelPlaylist]);

  return {
    states,
    loadChannel: useCallback((id: string) => {
      const cfg = configsRef.current.find((c) => c.id === id);
      if (cfg) {
        loadChannelPlaylist(cfg);
      }
    }, [loadChannelPlaylist]),
  };
}
