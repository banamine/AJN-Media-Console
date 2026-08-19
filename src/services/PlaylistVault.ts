/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPTVChannel, M3UPlaylist } from "../types";
import { putsDBValue, getAllDBValues, getDBValue, deleteDBValue, clearObjectStore, bulkPutsDBValues } from "./IndexedDB";
import { DaumPlaylistAdapter } from "../features/iptv/adapters/DaumPlaylistAdapter";
import { sanitizeCyrillicTitle } from "../utils/exportUtils";
import { cleanTitle, extractSeriesName } from "../utils/titleCleaner";
import { detectArchiveUrlType, extractIdentifier } from "../utils/archiveUtils";

import { parseM3UPlaylistAsync } from "../utils/m3uWorkerWrapper";
export { parseM3UPlaylistAsync };
export class PlaylistVault {
  // Sync all parsed M3U channels into the persistent store using rapid bulk batch transactions
  static async addAndSyncChannels(newChannels: IPTVChannel[]): Promise<void> {
    if (!newChannels || newChannels.length === 0) return;
    
    // De-duplicate in-memory before bulk save
    const seenUrls = new Set<string>();
    const uniqueChannels: IPTVChannel[] = [];
    for (let i = newChannels.length - 1; i >= 0; i--) {
      const chan = newChannels[i];
      if (chan.url) {
        if (!seenUrls.has(chan.url)) {
          seenUrls.add(chan.url);
          uniqueChannels.unshift(chan);
        }
      }
    }
    
    await bulkPutsDBValues("channels", uniqueChannels);
  }

  // Get all active channels (metadata only)
  static async getChannels(): Promise<IPTVChannel[]> {
    const all = await getAllDBValues<IPTVChannel>("channels");
    
    return new Promise((resolve) => {
      const results: IPTVChannel[] = [];
      const CHUNK_SIZE = 500;
      let i = 0;
      
      const processChunk = () => {
        const end = Math.min(i + CHUNK_SIZE, all.length);
        for (; i < end; i++) {
          const ch = all[i];
          results.push({
            name: ch.name || "Unnamed Channel",
            logo: ch.logo,
            url: ch.url,
            group: ch.group || "General",
            contentType: ch.contentType,
            playCount: ch.playCount || 0,
            lastPlayed: ch.lastPlayed,
            category: ch.category,
            duration: ch.duration,
            duration_source: ch.duration_source,
          });
        }
        
        if (i < all.length) {
          setTimeout(processChunk, 0);
        } else {
          resolve(results);
        }
      };
      
      processChunk();
    });
  }

  // Get full channel details on-demand
  static async getChannelDetails(url: string): Promise<IPTVChannel | undefined> {
    return await getDBValue<IPTVChannel>("channels", url);
  }

  // Clear all channels except permanent ones
  static async clearAllChannels(): Promise<void> {
    try {
      const all = await getAllDBValues<IPTVChannel>("channels");
      const permanents = all.filter(ch => ch.isPermanent);
      await clearObjectStore("channels");
      if (permanents.length > 0) {
        await bulkPutsDBValues("channels", permanents);
        console.log(`[PlaylistVault] Cleared channels database while preserving ${permanents.length} permanent channels.`);
      }
    } catch (e) {
      console.error("[PlaylistVault] Error during clearAllChannels:", e);
      await clearObjectStore("channels");
    }
  }

  // Increment individual playcount tracking record
  static async incrementPlayCount(url: string): Promise<void> {
    try {
      const existing = await getDBValue<IPTVChannel>("channels", url);
      if (existing) {
        existing.playCount = (existing.playCount || 0) + 1;
        await putsDBValue("channels", existing);
        console.log(`[PlaylistVault] Channel playcount for ${existing.name} incremented to ${existing.playCount}`);
      }
    } catch (e) {
      console.error("[PlaylistVault] Error during playcount update:", e);
    }
  }

  // Save an individual custom channel
  static async saveCustomChannel(channel: IPTVChannel): Promise<void> {
    await putsDBValue("channels", channel);
  }

  // Delete individual custom stream channel, protecting permanent ones
  static async removeChannel(url: string): Promise<void> {
    try {
      const existing = await getDBValue<IPTVChannel>("channels", url);
      if (existing && existing.isPermanent) {
        console.log(`[PlaylistVault] Prevented deletion of permanent channel: ${existing.name}`);
        return;
      }
    } catch (e) {
      console.error("[PlaylistVault] Error checking permanent status on removeChannel:", e);
    }
    await deleteDBValue("channels", url);
  }

  // Save imported Playlist header
  static async savePlaylist(playlist: M3UPlaylist): Promise<void> {
    await putsDBValue("playlists", playlist);
  }

  // Get an individual playlist by ID
  static async getPlaylist(id: string): Promise<M3UPlaylist | null> {
    const playlists = await this.getPlaylists();
    return playlists.find(p => p.id === id) || null;
  }

  // Rollback a playlist to a specific past version from history
  static async rollbackPlaylist(id: string, versionId: string): Promise<void> {
    const pl = await this.getPlaylist(id);
    if (!pl || !pl.history) throw new Error("Playlist or history not found");
    const ver = pl.history.find(v => v.versionId === versionId);
    if (!ver) throw new Error("Version not found in history");

    // Re-import channels of this historical version
    const parsed = await parseM3UPlaylistAsync(ver.content, pl.url);
    await this.addAndSyncChannels(parsed);

    // Update current playlist metadata with the rolled back state
    pl.content = ver.content;
    pl.checksum = ver.checksum;
    pl.channelCount = ver.channelCount;
    pl.importedAt = new Date().toISOString();

    await this.savePlaylist(pl);
  }

  // Get all registered Playlists
  static async getPlaylists(): Promise<M3UPlaylist[]> {
    return await getAllDBValues<M3UPlaylist>("playlists");
  }

  // Delete individual M3U Playlist meta and associated items if wanted
  static async removePlaylist(id: string): Promise<void> {
    try {
      const pl = await this.getPlaylist(id);
      if (pl && pl.content) {
        const parsed = await parseM3UPlaylistAsync(pl.content, pl.url);
        for (const ch of parsed) {
          if (ch.url) {
            await this.removeChannel(ch.url);
          }
        }
      }
    } catch (e) {
      console.error("[PlaylistVault] Error while removing associated playlist channels:", e);
    }
    await deleteDBValue("playlists", id);
  }
}
