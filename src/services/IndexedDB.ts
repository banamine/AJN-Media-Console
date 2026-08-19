/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPTVChannel, PlaybackHistoryItem, M3UPlaylist, BroadcastDaySchedule, TVShowSeries, WatchedFolder } from "../types";
import { safeLocalStorage } from "../utils/safeStorage";

const DB_NAME = "AJN_IPTV_DATABASE";
const DB_VERSION = 5;

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === "undefined") {
        throw new Error("Window is not defined");
      }
      let idxDB: IDBFactory | null = null;
      try {
        idxDB = window.indexedDB;
      } catch (e) {
        throw new Error("IndexedDB property access blocked by sandbox policy");
      }
      if (!idxDB) {
        throw new Error("IndexedDB is not supported on this platform");
      }
      const request = idxDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error || new Error("IDB Request Error"));
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
      const db = request.result;

      // Channels store
      if (!db.objectStoreNames.contains("channels")) {
        db.createObjectStore("channels", { keyPath: "url" });
      }

      // Playlists store
      if (!db.objectStoreNames.contains("playlists")) {
        db.createObjectStore("playlists", { keyPath: "id" });
      }

      // Broadcast Days / Schedules store
      if (!db.objectStoreNames.contains("broadcastDays")) {
        db.createObjectStore("broadcastDays", { keyPath: "dateKey" });
      }

      // TV Shows and Series grouping store
      if (!db.objectStoreNames.contains("series")) {
        db.createObjectStore("series", { keyPath: "id" });
      }

      // Mock Local Virtual watched folders
      if (!db.objectStoreNames.contains("watchedFolders")) {
        db.createObjectStore("watchedFolders", { keyPath: "id" });
      }

      // Playback History store
      if (!db.objectStoreNames.contains("history")) {
        db.createObjectStore("history", { keyPath: "id" });
      }

      // Custom favorites store
      if (!db.objectStoreNames.contains("favorites")) {
        db.createObjectStore("favorites", { keyPath: "url" });
      }

      // Film Cinephile Journals store
      if (!db.objectStoreNames.contains("journals")) {
        db.createObjectStore("journals", { keyPath: "id" });
      }

      // General settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // Audio playlists store
      if (!db.objectStoreNames.contains("audio_playlists")) {
        db.createObjectStore("audio_playlists", { keyPath: "id" });
      }

      // Music Library and Playlists stores
      if (!db.objectStoreNames.contains("music_library")) {
        db.createObjectStore("music_library", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("music_playlists")) {
        db.createObjectStore("music_playlists", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("import_cache")) {
        db.createObjectStore("import_cache", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("folders")) {
        db.createObjectStore("folders", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("contentItems")) {
        db.createObjectStore("contentItems", { keyPath: "id" });
      }
    };
    } catch (err) {
      reject(err);
    }
  });
}

// Low-level helper: Get a value from a store
export async function getDBValue<T = any>(storeName: string, key: any): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IDB Request Error"));
  });
}

// Low-level helper: Get all values from a store in a chunked manner
export async function getAllDBValues<T = any>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  const results: T[] = [];
  let lastKey: any = null;
  const CHUNK_SIZE = 250;

  while (true) {
    const chunk = await new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      
      const request = lastKey 
        ? store.openCursor(IDBKeyRange.lowerBound(lastKey, true)) 
        : store.openCursor();
        
      const currentChunk: T[] = [];
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          currentChunk.push(cursor.value);
          lastKey = cursor.key;
          count++;
          
          if (count < CHUNK_SIZE) {
            cursor.continue();
          } else {
            resolve(currentChunk);
          }
        } else {
          resolve(currentChunk);
        }
      };
      
      request.onerror = () => reject(request.error || new Error("IDB Request Error"));
    });

    if (chunk.length === 0) {
      break;
    }
    
    results.push(...chunk);
    
    // Yield to the main thread to prevent UI freezing
    await new Promise(r => setTimeout(r, 0));
  }

  return results;
}

// Low-level helper: Put a value into a store
export async function putsDBValue<T = any>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("IDB Request Error"));
  });
}

// Low-level helper: Bulk put values into a store using chunked transactions to avoid blocking main thread
export async function bulkPutsDBValues<T = any>(storeName: string, values: T[]): Promise<void> {
  if (!values || values.length === 0) return;
  const db = await openDatabase();
  
  const CHUNK_SIZE = 500;
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IDB Bulk Put Error"));
      
      for (const value of chunk) {
        store.put(value);
      }
    });
    
    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
  }
}

// Low-level helper: Delete a value from a store
export async function deleteDBValue(storeName: string, key: any): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("IDB Request Error"));
  });
}

// Low-level helper: Clear an entire store
export async function clearObjectStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("IDB Request Error"));
  });
}

// One-time legacy localStorage data migration to IndexedDB
export async function migrateLegacyLocalStorage(): Promise<boolean> {
  const isMigrated = safeLocalStorage.getItem("ajn_indexeddb_migrated");
  if (isMigrated === "true") {
    return false;
  }

  try {
    console.log("[IndexedDB Migration] Starting migration of local data...");

    // 1. Channels
    const legacyChannelsRaw = safeLocalStorage.getItem("ajn_iptv_channels");
    if (legacyChannelsRaw) {
      try {
        const legacyChannels: IPTVChannel[] = JSON.parse(legacyChannelsRaw);
        for (const chan of legacyChannels) {
          if (chan.url) {
            await putsDBValue("channels", chan);
          }
        }
        console.log(`[IndexedDB Migration] Migrated ${legacyChannels.length} channels`);
      } catch (err) {
        console.error("Failed to migrate channels:", err);
      }
    }

    // 2. Favorites
    const legacyFavoritesRaw = safeLocalStorage.getItem("ajn_iptv_favorites");
    if (legacyFavoritesRaw) {
      try {
        const legacyFavs: string[] = JSON.parse(legacyFavoritesRaw);
        // Find existing channels that are favorites, or just store a fallback object
        for (const favUrl of legacyFavs) {
          await putsDBValue("favorites", { url: favUrl, addedAt: new Date().toISOString() });
        }
        console.log(`[IndexedDB Migration] Migrated ${legacyFavs.length} favorites`);
      } catch (err) {
        console.error("Failed to migrate favorites:", err);
      }
    }

    // 3. Playback History
    const legacyHistoryRaw = safeLocalStorage.getItem("ajn_iptv_history");
    if (legacyHistoryRaw) {
      try {
        const legacyHistory: PlaybackHistoryItem[] = JSON.parse(legacyHistoryRaw);
        for (const hist of legacyHistory) {
          if (hist.id) {
            await putsDBValue("history", hist);
          }
        }
        console.log(`[IndexedDB Migration] Migrated ${legacyHistory.length} history items`);
      } catch (err) {
        console.error("Failed to migrate history:", err);
      }
    }

    // 4. Cinephile Tasting Journals
    const legacyJournalsRaw = safeLocalStorage.getItem("ajn_cinephile_journals");
    if (legacyJournalsRaw) {
      try {
        const legacyJournals = JSON.parse(legacyJournalsRaw);
        if (Array.isArray(legacyJournals)) {
          for (const journ of legacyJournals) {
            if (journ.id) {
              await putsDBValue("journals", journ);
            }
          }
          console.log(`[IndexedDB Migration] Migrated ${legacyJournals.length} cinephile tasting journals`);
        }
      } catch (err) {
        console.error("Failed to migrate cinephile journals:", err);
      }
    }

    // 5. Video Resume Positions
    const legacyPositionsRaw = safeLocalStorage.getItem("ajn_video_positions");
    if (legacyPositionsRaw) {
      try {
        const legacyPositions = JSON.parse(legacyPositionsRaw);
        if (typeof legacyPositions === "object" && legacyPositions !== null) {
          for (const key of Object.keys(legacyPositions)) {
            await putsDBValue("settings", { key: `video_pos_${key}`, value: legacyPositions[key] });
          }
        }
        console.log("[IndexedDB Migration] Migrated video resume positions");
      } catch (err) {
        console.error("Failed to migrate video positions:", err);
      }
    }

    // 6. General Settings
    const legacySettingsRaw = safeLocalStorage.getItem("ajn_iptv_settings");
    if (legacySettingsRaw) {
      try {
        const legacySettings = JSON.parse(legacySettingsRaw);
        if (legacySettings && typeof legacySettings === "object") {
          for (const key of Object.keys(legacySettings)) {
            await putsDBValue("settings", { key: `setting_${key}`, value: legacySettings[key] });
          }
        }
        console.log("[IndexedDB Migration] Migrated general settings");
      } catch (err) {
        console.error("Failed to migrate settings:", err);
      }
    }

    // Mark as completed
    safeLocalStorage.setItem("ajn_indexeddb_migrated", "true");
    console.log("[IndexedDB Migration] Local storage migration successfully completed!");
    return true;
  } catch (error) {
    console.error("[IndexedDB Migration] Failed to carry out migration:", error);
    return false;
  }
}

// Cache-aware helper functions for import cache
export async function getCachedImport(url: string): Promise<{ playlistId: string; importedAt: string; trackCount: number } | null> {
  try {
    const cached = await getDBValue<{ key: string; playlistId: string; importedAt: string; trackCount: number }>("import_cache", url);
    if (cached) {
      return {
        playlistId: cached.playlistId,
        importedAt: cached.importedAt,
        trackCount: cached.trackCount
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch cached import:", err);
    return null;
  }
}

export async function setCachedImport(url: string, playlistId: string, trackCount: number = 0): Promise<void> {
  try {
    await putsDBValue("import_cache", {
      key: url,
      playlistId,
      importedAt: new Date().toISOString(),
      trackCount
    });
  } catch (err) {
    console.error("Failed to store cache import:", err);
  }
}

export async function clearCache(): Promise<void> {
  try {
    await clearObjectStore("import_cache");
    console.log("Import cache successfully cleared!");
  } catch (err) {
    console.error("Failed to clear import cache:", err);
  }
}
