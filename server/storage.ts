/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";

const DB_PATH = path.join(process.cwd(), "server_db.json");

export interface NewsProfile {
  id: string;
  callsign: string;
  displayName: string;
  logoUrl?: string | null;
  rssUrl?: string | null;
  isActive: boolean;
  lastHarvested?: string | null;
}

export interface Episode {
  id: string;
  profileId?: string | null;
  title: string;
  url: string;
  timestamp: number;
  poster_art?: string | null;
  backdrop_thumb?: string | null;
}

export const NEWS_REGISTRY: Record<string, { displayName: string; logoUrl: string; rssUrl: string }> = {
  bbc: {
    displayName: "BBC News Channel",
    logoUrl: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/bbc_logo.png",
    rssUrl: "https://rss.alexjones.media/AJNHourlyVideo.xml"
  },
  cnn: {
    displayName: "CNN News Channel",
    logoUrl: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/cnn_logo.png",
    rssUrl: "https://rss.alexjones.media/AJNHourlyVideo.xml"
  },
  fox: {
    displayName: "Fox News Channel",
    logoUrl: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/fox_logo.png",
    rssUrl: "https://rss.alexjones.media/AJNHourlyVideo.xml"
  }
};

interface DatabaseSchema {
  news_profiles: NewsProfile[];
  episodes: Episode[];
  custom_channels: any[];
  rss_archive_episodes: any[];
}

let dbInMemory: DatabaseSchema = {
  news_profiles: [],
  episodes: [],
  custom_channels: [],
  rss_archive_episodes: []
};

export async function initDatabase() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileData = fs.readFileSync(DB_PATH, "utf8");
      const parsed = JSON.parse(fileData);
      dbInMemory = {
        news_profiles: parsed.news_profiles || [],
        episodes: parsed.episodes || [],
        custom_channels: parsed.custom_channels || [],
        rss_archive_episodes: parsed.rss_archive_episodes || []
      };
      console.log(`[Database] Loaded ${dbInMemory.news_profiles.length} profiles, ${dbInMemory.episodes.length} episodes, and ${dbInMemory.custom_channels?.length || 0} custom channels from JSON storage.`);
    } catch (err: any) {
      console.error("[Database] Error reading server_db.json, reinitializing empty:", err.message);
      dbInMemory = { news_profiles: [], episodes: [], custom_channels: [], rss_archive_episodes: [] };
    }
  } else {
    dbInMemory = { news_profiles: [], episodes: [], custom_channels: [], rss_archive_episodes: [] };
  }

  seedDefaultProfiles();
  saveDatabase();
}

function seedDefaultProfiles() {
  const defaults: NewsProfile[] = [
    { id: "bbc", callsign: "BBCNEWS", displayName: "BBC News", logoUrl: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/bbc_logo.png", rssUrl: "https://rss.alexjones.media/AJNHourlyVideo.xml", isActive: true, lastHarvested: null },
    { id: "cnn", callsign: "CNNNEWS", displayName: "CNN News", logoUrl: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/cnn_logo.png", rssUrl: "https://rss.alexjones.media/AJNHourlyVideo.xml", isActive: true, lastHarvested: null },
    { id: "fox", callsign: "FOXNEWSW", displayName: "Fox News", logoUrl: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/fox_logo.png", rssUrl: "https://rss.alexjones.media/AJNHourlyVideo.xml", isActive: true, lastHarvested: null }
  ];

  for (const p of defaults) {
    const exists = dbInMemory.news_profiles.some(existing => existing.id === p.id);
    if (!exists) {
      dbInMemory.news_profiles.push(p);
    }
  }
}

export function saveDatabase() {
  try {
    const data = JSON.stringify(dbInMemory, null, 2);
    fs.writeFileSync(DB_PATH, data, "utf8");
  } catch (err: any) {
    console.error("[Database] Failed to write database to disk:", err.message);
  }
}

export function getNewsProfiles(): NewsProfile[] {
  return dbInMemory.news_profiles;
}

export function updateNewsProfileActiveState(id: string, isActive: boolean) {
  const profile = dbInMemory.news_profiles.find(p => p.id === id);
  if (profile) {
    profile.isActive = isActive;
    saveDatabase();
  }
}

export function updateNewsProfileHarvestTime(id: string, timestamp: string) {
  const profile = dbInMemory.news_profiles.find(p => p.id === id);
  if (profile) {
    profile.lastHarvested = timestamp;
    saveDatabase();
  }
}

export function getEpisodes(profileId?: string): Episode[] {
  let list = dbInMemory.episodes;
  if (profileId) {
    list = list.filter(ep => ep.profileId === profileId);
  }
  return [...list].sort((a, b) => b.timestamp - a.timestamp);
}

export function insertEpisode(episode: Episode) {
  const index = dbInMemory.episodes.findIndex(ep => ep.id === episode.id);
  if (index >= 0) {
    dbInMemory.episodes[index] = episode;
  } else {
    dbInMemory.episodes.push(episode);
  }
  saveDatabase();
}

export function purgeOldEpisodes(): number {
  const cutoff = Date.now() - 4 * 7 * 24 * 60 * 60 * 1000; // 4 weeks ago
  const beforeCount = dbInMemory.episodes.length;
  dbInMemory.episodes = dbInMemory.episodes.filter(ep => ep.timestamp >= cutoff);
  const beforeArchiveCount = dbInMemory.rss_archive_episodes.length;
  dbInMemory.rss_archive_episodes = dbInMemory.rss_archive_episodes.filter(ep => {
    return new Date(ep.pubDate).getTime() >= cutoff;
  });
  if (dbInMemory.episodes.length !== beforeCount || dbInMemory.rss_archive_episodes.length !== beforeArchiveCount) {
    saveDatabase();
  }
  return cutoff;
}

export function mergeRssArchiveEpisodes(episodes: any[]) {
  let changed = false;
  for (const ep of episodes) {
    const idx = dbInMemory.rss_archive_episodes.findIndex(e => e.id === ep.id);
    if (idx >= 0) {
      dbInMemory.rss_archive_episodes[idx] = ep;
    } else {
      dbInMemory.rss_archive_episodes.push(ep);
      changed = true;
    }
  }
  if (changed) {
    saveDatabase();
  }
}

export function getRssArchiveEpisodes(): any[] {
  return [...dbInMemory.rss_archive_episodes].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

export function reconstructSegments(profileId: string, episodes: Episode[]) {
  const profileEpisodes = episodes
    .filter(ep => ep.profileId === profileId)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (profileEpisodes.length === 0) return null;

  const stitchUrl = `/api/m3u-splitter/virtual-stitch?profileId=${profileId}`;
  
  return {
    info: `#EXTINF:-1,${profileId.toUpperCase()} Virtual News Channel Live`,
    url: stitchUrl,
    episodes: profileEpisodes
  };
}

export function mergeDatabasePayload(payload: { news_profiles?: NewsProfile[]; episodes?: Episode[] }) {
  if (Array.isArray(payload.news_profiles)) {
    for (const np of payload.news_profiles) {
      const idx = dbInMemory.news_profiles.findIndex(p => p.id === np.id);
      if (idx >= 0) {
        dbInMemory.news_profiles[idx] = { ...dbInMemory.news_profiles[idx], ...np };
      } else {
        dbInMemory.news_profiles.push(np);
      }
    }
  }
  if (Array.isArray(payload.episodes)) {
    for (const ep of payload.episodes) {
      const idx = dbInMemory.episodes.findIndex(e => e.id === ep.id);
      if (idx >= 0) {
        dbInMemory.episodes[idx] = ep;
      } else {
        dbInMemory.episodes.push(ep);
      }
    }
  }
  saveDatabase();
}

export function getCustomChannels(): any[] {
  return dbInMemory.custom_channels || [];
}

export function insertCustomChannel(channel: any) {
  if (!dbInMemory.custom_channels) {
    dbInMemory.custom_channels = [];
  }
  const idx = dbInMemory.custom_channels.findIndex(ch => ch.id === channel.id);
  if (idx >= 0) {
    dbInMemory.custom_channels[idx] = channel;
  } else {
    dbInMemory.custom_channels.push(channel);
  }
  saveDatabase();
}

export function deleteCustomChannel(id: string): boolean {
  if (!dbInMemory.custom_channels) return false;
  const beforeLength = dbInMemory.custom_channels.length;
  dbInMemory.custom_channels = dbInMemory.custom_channels.filter(ch => ch.id !== id);
  if (dbInMemory.custom_channels.length !== beforeLength) {
    saveDatabase();
    return true;
  }
  return false;
}

