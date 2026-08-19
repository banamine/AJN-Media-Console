/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlaylistVault, parseM3UPlaylistAsync } from "./PlaylistVault";
import { AuditLog } from "./IngestionService";
import { M3UPlaylist } from "../types";

/**
 * Compute SHA-256 hash of a string
 */
export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto?.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      console.warn("crypto.subtle failed, falling back to simple hash", e);
    }
  }
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Fetch with exponential backoff and retry
 */
export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const fetchUrl = url.startsWith('http') ? `/api/stream-proxy?url=${encodeURIComponent(url)}` : url;
      const response = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(`HTTP 429`);
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = (lastError.message.includes('429') ? 5000 : initialDelay) * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Fetch failed after ${maxRetries} retries: ${lastError?.message}`);
}

type PollingListener = () => void;

class PlaylistPollingServiceClass {
  private worker: Worker | null = null;
  private listeners: Set<PollingListener> = new Set();
  private intervalMs: number = 43200000; // 12 hours
  private isPollingActive: boolean = false;

  /**
   * Subscribes to playlist updates. Whenever a polling completes with changes,
   * listeners are notified to trigger UI state updates.
   */
  public subscribe(listener: PollingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("Error in PlaylistPollingService listener:", e);
      }
    });
  }

  /**
   * Starts the background Web Worker for periodic updates.
   */
  public startPolling(customIntervalMs?: number): void {
    if (this.isPollingActive) return;
    this.intervalMs = customIntervalMs || 43200000;

    const workerCode = `
      let intervalId = null;

      self.onmessage = function(e) {
        const { action, intervalMs } = e.data;
        if (action === "start") {
          if (intervalId) clearInterval(intervalId);
          
          // Trigger initial poll immediately
          self.postMessage({ type: "poll" });

          intervalId = setInterval(() => {
            self.postMessage({ type: "poll" });
          }, intervalMs || 43200000);
        } else if (action === "stop") {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        if (e.data?.type === "poll") {
          this.pollAllPlaylists();
        }
      };

      this.worker.postMessage({ action: "start", intervalMs: this.intervalMs });
      this.isPollingActive = true;
      console.log(`[PlaylistPollingService] Background worker started. Interval: ${this.intervalMs}ms`);
    } catch (e) {
      console.error("[PlaylistPollingService] Failed to initialize Web Worker", e);
      // Fallback: Use standard setInterval if web workers are restricted/unavailable
      this.isPollingActive = true;
      this.pollAllPlaylists();
      const intervalId = setInterval(() => {
        if (!this.isPollingActive) {
          clearInterval(intervalId);
          return;
        }
        this.pollAllPlaylists();
      }, this.intervalMs);
    }
  }

  /**
   * Stops the background polling worker.
   */
  public stopPolling(): void {
    this.isPollingActive = false;
    if (this.worker) {
      this.worker.postMessage({ action: "stop" });
      this.worker.terminate();
      this.worker = null;
    }
    console.log("[PlaylistPollingService] Background polling stopped.");
  }

  /**
   * Core logic to fetch, compare checksums, and update playlists.
   */
  public async pollAllPlaylists(): Promise<void> {
    try {
      const playlists = await PlaylistVault.getPlaylists();
      const remotePlaylists = playlists.filter((p) => p.url && p.url.trim() !== "");

      if (remotePlaylists.length === 0) {
        console.log("[PlaylistPollingService] No remote M3U playlists found to update.");
        return;
      }

      console.log(`[PlaylistPollingService] Polling ${remotePlaylists.length} playlists...`);
      let hasAnyChange = false;

      for (const pl of remotePlaylists) {
        if (!pl.url) continue;
        let fetchedContent = "";
        let finalUrlUsed = pl.url;
        let usedFallback = false;

        try {
          // Attempt primary URL
          try {
            fetchedContent = await fetchWithRetry(pl.url);
          } catch (primaryErr: any) {
            console.warn(`[PlaylistPollingService] Primary URL failed for "${pl.name}": ${primaryErr.message}. Trying fallbacks...`);
            await AuditLog.record("warn", `PlaylistPollingService: Primary URL failed for "${pl.name}". Trying backup fallback chain...`);
            
            if (pl.fallbackUrls && pl.fallbackUrls.length > 0) {
              for (const fbUrl of pl.fallbackUrls) {
                if (!fbUrl || fbUrl.trim() === "") continue;
                try {
                  fetchedContent = await fetchWithRetry(fbUrl);
                  finalUrlUsed = fbUrl;
                  usedFallback = true;
                  break; // Found working fallback!
                } catch (fbErr: any) {
                  console.warn(`[PlaylistPollingService] Fallback URL failed for "${pl.name}": ${fbUrl}. Error: ${fbErr.message}`);
                }
              }
            }

            if (!fetchedContent) {
              throw new Error(`Primary and all fallback URLs failed: ${primaryErr.message}`);
            }
          }

          if (usedFallback) {
            await AuditLog.record("info", `PlaylistPollingService: Fallback successfully resolved playlist "${pl.name}" via backup source: ${finalUrlUsed}`);
          }

          const previousPlaylist = await PlaylistVault.getPlaylist(pl.id);
          const newChecksum = await sha256(fetchedContent);
          const previousChecksum = previousPlaylist?.checksum || null;

          if (newChecksum === previousChecksum) {
            // No change in content, but update importedAt to avoid timestamp staleness
            if (previousPlaylist) {
              const updatedPlaylist: M3UPlaylist = {
                ...previousPlaylist,
                importedAt: new Date().toISOString()
              };
              await PlaylistVault.savePlaylist(updatedPlaylist);
            }
            await AuditLog.record({
              event: "M3UPlaylistPolling",
              status: "no_change",
              checksum: newChecksum,
              skippedProcessing: true,
            });
            hasAnyChange = true; // Trigger UI update to refresh the last checked timestamp
            continue; // Early exit
          }

          // We have a change! Parse and process
          const parsed = await parseM3UPlaylistAsync(fetchedContent, pl.url);
          if (parsed.length === 0) {
            await AuditLog.record("warn", `Polling: No valid channels found in update for "${pl.name}"`);
            continue;
          }

          // Clean up channel names matching app design
          const cleanedParsed = parsed.map((chan) => {
            let cleaned = (chan.name || "").trim();
            const strippedPrefix = cleaned.replace(/^(?:Канал|KaHan|Kahan)\b(?:\s*\d+)?\s*[-–—:]*\s*/gi, "").trim();
            if (strippedPrefix) {
              cleaned = strippedPrefix;
            } else {
              cleaned = cleaned.replace(/\b(?:Канал|KaHan|Kahan)\b/gi, "").trim();
            }

            cleaned = cleaned.replace(/_/g, " ");
            cleaned = cleaned.replace(/^[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"|~\\/<>]+|[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"|~\\/<>]+$/g, "").trim();
            cleaned = cleaned.replace(/\s+/g, " ").trim();

            return {
              ...chan,
              name: cleaned || chan.name,
            };
          });

          // Write updated channels to IndexedDB
          await PlaylistVault.addAndSyncChannels(cleanedParsed);

          // Construct historical snapshot from the current (soon-to-be previous) state
          const historyList = previousPlaylist?.history || [];
          if (previousPlaylist && previousPlaylist.content && previousPlaylist.checksum) {
            const historyEntry = {
              versionId: `v_${Date.now()}`,
              timestamp: previousPlaylist.importedAt || new Date().toISOString(),
              checksum: previousPlaylist.checksum,
              content: previousPlaylist.content,
              channelCount: previousPlaylist.channelCount || 0
            };
            historyList.unshift(historyEntry);
            if (historyList.length > 8) {
              historyList.pop(); // Keep only latest 8 versions
            }
          }

          // Update playlist metadata inside DB
          const updatedPlaylist: M3UPlaylist = {
            ...pl,
            content: fetchedContent,
            checksum: newChecksum,
            channelCount: cleanedParsed.length,
            importedAt: new Date().toISOString(),
            history: historyList
          };
          await PlaylistVault.savePlaylist(updatedPlaylist);

          await AuditLog.record("info", `PlaylistPollingService: Successfully updated "${pl.name}" with ${cleanedParsed.length} channels.`);
          hasAnyChange = true;
        } catch (err: any) {
          const errorMessage = err?.message || (typeof err === "string" ? err : "Unknown error");
          await AuditLog.record("error", `PlaylistPollingService: Failed to update playlist "${pl.name}". Error: ${errorMessage}`);
        }
        
        // Wait 2 seconds before fetching the next playlist to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (hasAnyChange) {
        this.notify();
      }
    } catch (e: any) {
      console.error("[PlaylistPollingService] Error during poll:", e);
    }
  }
}

export const PlaylistPollingService = new PlaylistPollingServiceClass();
