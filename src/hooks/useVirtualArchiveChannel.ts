import { useState, useEffect } from "react";
import { IPTVChannel } from "../types";
import { parseM3UPlaylistAsync } from "../services/PlaylistVault";
import { getDBValue, putsDBValue } from "../services/IndexedDB";
import { getArchiveThumbnail } from "../utils/thumbnailHelper";
import { MasterPlaylistEpisode } from "../services/VirtualChannelEngine";

class SimpleRateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private activeRequests = 0;
  private maxConcurrent = 1;

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
        }, 500);
      }
    }
  }
}

const outboundRateLimiter = new SimpleRateLimiter();

export function useVirtualArchiveChannel(m3uUrl: string, staggerOffsetPercent: number) {
  const [episodes, setEpisodes] = useState<MasterPlaylistEpisode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadM3U() {
      if (!m3uUrl) {
        setEpisodes([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      const cacheKey = `m3u_cache_${m3uUrl}`;
      const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

      try {
        // 1. Try to read from IndexedDB cache
        const cached = await getDBValue<{ text: string; cachedAt: number }>("import_cache", cacheKey);
        
        let m3uText = "";
        if (cached && Date.now() - cached.cachedAt < cacheTTL) {
          m3uText = cached.text;
        } else {
          // 2. Fetch from network via the Rate Limiter proxy
          m3uText = await outboundRateLimiter.enqueue(async () => {
            const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(m3uUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
              throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            const text = await response.text();
            
            // Save to IndexedDB cache
            await putsDBValue("import_cache", {
              key: cacheKey,
              text,
              cachedAt: Date.now()
            });

            return text;
          });
        }

        if (!isMounted) return;

        // 3. Parse and Map to episodes
        const parsedChannels = await parseM3UPlaylistAsync(m3uText, m3uUrl);
        const eps: MasterPlaylistEpisode[] = parsedChannels.map((ch, idx) => {
          const duration = ch.duration && ch.duration > 0 ? ch.duration : 1800; // default 30 mins if none
          const cleanTitle = ch.name || `Segment ${idx + 1}`;
          
          return {
            id: `${m3uUrl}-ep-${idx}`,
            title: cleanTitle,
            durationInSeconds: duration,
            url: ch.url,
            thumbnail: ch.logo || getArchiveThumbnail("Archive", cleanTitle),
            plot: ch.description || `Archived segment: ${cleanTitle}.`,
            genre: "Archive",
            rating: "TV-14"
          };
        });

        setEpisodes(eps);
        setError(null);
      } catch (err: any) {
        console.error(`[useVirtualArchiveChannel] Error loading "${m3uUrl}":`, err);
        if (isMounted) {
          setError(err.message || "Failed to load channel playlist");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadM3U();

    return () => {
      isMounted = false;
    };
  }, [m3uUrl]);

  const totalDuration = episodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
  const staggerOffsetSeconds = Math.floor(staggerOffsetPercent * totalDuration);

  return {
    episodes,
    totalDuration,
    loading,
    error,
    staggerOffsetSeconds
  };
}
