import { safeLocalStorage } from "../utils/safeStorage";
import { AJN_LOGO_URL } from "../utils/constants";
import { cleanChannelName } from "../utils/titleCleaner";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { IPTVChannel, M3UPlaylist } from "../types";
import { PlaylistVault, parseM3UPlaylistAsync } from "../services/PlaylistVault";
import { PlaylistPollingService } from "../services/PlaylistPollingService";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


export function usePlaylistVault() {
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [playlists, setPlaylists] = useState<M3UPlaylist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      console.warn('[System Boot] Failsafe timer triggered: Forcing interface mount.');
    }, 3000);
    return () => clearTimeout(safetyTimeout);
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      // 1. Get the user's custom channels from IndexedDB (source of truth for user uploads)
      const localChannels = await PlaylistVault.getChannels();
      
      // 2. Fetch the real archive shows from `/api/ajn-archive`
      let archiveChannels: IPTVChannel[] = [];
      try {
        const response = await fetch(BACKEND_URL + "/api/ajn-archive");
        if (response.ok) {
          const result = await response.json();
          if (result && result.success && Array.isArray(result.episodes)) {
            archiveChannels = result.episodes.map((ep: any, index: number) => ({
              name: ep.title || `${ep.show} - ${ep.hour}`,
              url: ep.videoUrl,
              logo: AJN_LOGO_URL,
              group: "AJN Archives",
              tvgId: ep.id || `arch-${index}`,
              tvgName: ep.title || `${ep.show} - ${ep.hour}`,
              contentType: "vod",
              duration: 3600,
              active: true
            }));
          }
        }
      } catch (err) {
        console.warn("[PlaylistVault hook] Failed to fetch archive episodes.", err);
      }

      // 3. Filter local channels to exclude any old/outdated hardcoded default channels if the user wants only their uploaded ones
      // We also strictly filter out any demo video links like Buck Bunny or Tears of Steel
      const userUploadedChannels = localChannels.filter(ch => 
        ch.group !== "Default Feed" && 
        ch.group !== "AJN Broadcasts" &&
        !ch.url.includes("commondatastorage") &&
        !ch.url.includes("tears-of-steel") &&
        !ch.url.includes("BigBuckBunny")
      );

      let finalChannels: IPTVChannel[] = [];

      if (userUploadedChannels.length > 0) {
        // If the user has custom uploaded channels, they are the primary channels
        finalChannels = [...userUploadedChannels];
      } else {
        // Fallback to a single clean real live channel if absolutely no user channels exist
        finalChannels = [
          {
            name: "AJN Live News Broadcast",
            url: "",
            logo: AJN_LOGO_URL,
            group: "Live Channels",
            tvgId: "live-main",
            tvgName: "AJN Live Broadcast",
            contentType: "live",
            duration: -1,
            active: true
          }
        ];
      }

      // 4. Always append the fetched real AJN Archive shows so they are available in the playdeck
      if (archiveChannels.length > 0) {
        finalChannels = [...finalChannels, ...archiveChannels];
      }

      const activePlaylists = await PlaylistVault.getPlaylists();
      setChannels(finalChannels);
      setPlaylists(activePlaylists);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load playlist vault data");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and subscribe to updates from background polling service
  useEffect(() => {
    fetchAllData();
    const unsubscribe = PlaylistPollingService.subscribe(() => {
      fetchAllData();
    });
    PlaylistPollingService.startPolling();
    return () => {
      unsubscribe();
    };
  }, [fetchAllData]);

  // Add individual custom stream
  const addCustomChannel = useCallback(async (chan: IPTVChannel) => {
    try {
      const cleanedName = cleanChannelName(chan.name || "");

      const cleanedChan = {
        ...chan,
        name: cleanedName || chan.name
      };

      await PlaylistVault.saveCustomChannel(cleanedChan);
      await fetchAllData();
    } catch (e: any) {
      console.error("Failed to append custom channel:", e);
      throw e;
    }
  }, [fetchAllData]);

  // Delete channel
  const removeChannel = useCallback(async (url: string) => {
    try {
      await PlaylistVault.removeChannel(url);
      await fetchAllData();
    } catch (e: any) {
      console.error("Failed to delete channel:", e);
    }
  }, [fetchAllData]);

  // Import raw M3U string payload
  const importM3U = useCallback(async (name: string, content: string, url?: string) => {
    try {
      const parsed = await parseM3UPlaylistAsync(content, url);
      if (parsed.length === 0) {
        throw new Error("No channels found or format was incorrect M3U payload");
      }

      // If it is a user upload, clear old channels entirely so we only load the newest files from the user
      const isUserFeed = name === "Uploaded Feed" || name === "User Upload" || name.toLowerCase().includes("upload") || name.toLowerCase().includes("custom");
      if (isUserFeed) {
        await PlaylistVault.clearAllChannels();
        safeLocalStorage.setItem("ajn_user_cleared", "true");
        safeLocalStorage.setItem("ajn_user_uploaded", "true");
      }

      // Automatically strip 'Канал' prefix and any junk characters from channel names
      const cleanedParsed = parsed.map(chan => {
        const cleaned = cleanChannelName(chan.name || "");
        
        return {
          ...chan,
          name: cleaned || chan.name
        };
      });

      await PlaylistVault.addAndSyncChannels(cleanedParsed);

      // Check if this URL or Name is already registered to perform an Upsert instead of duplicate Insert
      const existingPlaylists = await PlaylistVault.getPlaylists();
      let playlistId = `pl-${Date.now()}`;
      if (url) {
        const existing = existingPlaylists.find(p => p.url === url);
        if (existing && existing.id) {
          playlistId = existing.id;
        }
      } else if (name) {
        const existing = existingPlaylists.find(p => p.name === name);
        if (existing && existing.id) {
          playlistId = existing.id;
        }
      }

      const playlistMeta: M3UPlaylist = {
        id: playlistId,
        name,
        url,
        content,
        importedAt: new Date().toISOString(),
        channelCount: cleanedParsed.length,
        isCustom: true,
      };

      await PlaylistVault.savePlaylist(playlistMeta);
      await fetchAllData();
      return cleanedParsed;
    } catch (e: any) {
      console.error("Failed to import M3U file:", e);
      throw e;
    }
  }, [fetchAllData]);

  // Delete an imported playlist
  const removePlaylist = useCallback(async (id: string) => {
    try {
      await PlaylistVault.removePlaylist(id);
      await fetchAllData();
    } catch (e: any) {
      console.error("Failed to delete playlist:", e);
    }
  }, [fetchAllData]);

  const batchUpdateDurations = useCallback(async (updates: { id: string, duration: number | null, duration_source: "probed" | "estimated" | "failed" | "existing" }[]) => {
    try {
      const dbPromises = updates.map(async (u) => {
         const existing = await PlaylistVault.getChannelDetails(u.id);
         if (existing) {
            existing.duration = u.duration !== null ? u.duration : undefined;
            existing.duration_source = u.duration_source;
            await PlaylistVault.saveCustomChannel(existing);
         }
      });
      await Promise.all(dbPromises);
      await fetchAllData();
    } catch (e: any) {
      console.error("Failed to update channel durations:", e);
      throw e;
    }
  }, [fetchAllData]);

  // Track playback and increment play statistical counter
  const incrementChannelPlay = useCallback(async (url: string) => {
    try {
      await PlaylistVault.incrementPlayCount(url);
      // Quiet reload of state without triggers
      const latest = await PlaylistVault.getChannels();
      setChannels(latest);
    } catch (e) {
      console.error(e);
    }
  }, []);

  return {
    channels,
    playlists,
    loading,
    error,
    addCustomChannel,
    removeChannel,
    importM3U,
    removePlaylist,
    incrementChannelPlay,
    batchUpdateDurations,
    reloadVault: fetchAllData,
  };
}
