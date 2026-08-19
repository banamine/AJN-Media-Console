/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaProviderContract, ProviderSessionState, UnifiedMediaItem, IPTVChannel, ArchiveEpisode } from "../types";
import { DaumPlaylistAdapter } from "../features/iptv/adapters/DaumPlaylistAdapter";

export class IPTVProvider implements MediaProviderContract {
  id = "iptv";
  name = "IPTV Channels";
  providerType: "iptv" = "iptv";
  supportsSearch = true;
  supportsCategories = true;
  supportsFavorites = true;
  supportsHistory = true;
  supportsResume = false;
  supportsEPG = true;
  supportsThumbnails = true;

  private channels: IPTVChannel[] = [];
  private onPlayCallback?: (url: string, title: string) => void;

  constructor(channels: IPTVChannel[], onPlay?: (url: string, title: string) => void) {
    this.channels = channels;
    this.onPlayCallback = onPlay;
  }

  async loadLibrary(): Promise<UnifiedMediaItem[]> {
    return this.channels.map((c, idx) => ({
      id: `iptv-${idx}-${c.name}`,
      title: c.name,
      subtitle: c.group || "Live Channel",
      description: c.description || `Live stream channel: ${c.name}`,
      thumbnail: c.logo || null,
      provider: "iptv",
      mediaType: "live",
      url: c.url,
      duration: -1,
      resolution: c.resolution,
      badges: ["LIVE", c.group].filter(Boolean) as string[],
      live: true,
      category: c.category || [c.group].filter(Boolean),
      metadata: { ...c }
    }));
  }

  async refresh(): Promise<void> {
    // No-op for in-memory channels
  }

  async search(query: string): Promise<UnifiedMediaItem[]> {
    const lib = await this.loadLibrary();
    const q = query.toLowerCase();
    return lib.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    );
  }

  async loadItem(id: string): Promise<UnifiedMediaItem | null> {
    const lib = await this.loadLibrary();
    return lib.find(item => item.id === id) || null;
  }

  play(item: UnifiedMediaItem): void {
    if (this.onPlayCallback) {
      this.onPlayCallback(item.url, item.title);
    }
  }

  getThumbnail(item: UnifiedMediaItem): string {
    return item.thumbnail || "https://archive.org/download/daily-highlights/lmbsa.png";
  }

  getMetadata(item: UnifiedMediaItem): Record<string, any> {
    return item.metadata || {};
  }

  async export(): Promise<Blob> {
    const content = "#EXTM3U\n" + this.channels.map(c => `#EXTINF:-1 group-title="${c.group}",${c.name}\n${c.url}`).join("\n");
    return new Blob([content], { type: "audio/x-mpegurl" });
  }

  async import(): Promise<void> {
    // Handled via BatchImportWidget
  }
}

export class ArchiveProvider implements MediaProviderContract {
  id = "archive";
  name = "Internet Archive Vault";
  providerType: "archive" = "archive";
  supportsSearch = true;
  supportsCategories = true;
  supportsFavorites = true;
  supportsHistory = true;
  supportsResume = true;
  supportsEPG = false;
  supportsThumbnails = true;

  private episodes: ArchiveEpisode[] = [];
  private onPlayCallback?: (url: string, title: string) => void;

  constructor(episodes: ArchiveEpisode[], onPlay?: (url: string, title: string) => void) {
    this.episodes = episodes;
    this.onPlayCallback = onPlay;
  }

  async loadLibrary(): Promise<UnifiedMediaItem[]> {
    return this.episodes.map((ep) => ({
      id: `archive-${ep.id}`,
      title: ep.title,
      subtitle: `${ep.show} (${ep.hour})`,
      description: `Published on ${ep.pubDate}`,
      thumbnail: null,
      provider: "archive",
      mediaType: "vod",
      url: ep.videoUrl,
      duration: 3600,
      badges: ["VOD", ep.show, ep.hour],
      live: false,
      category: [ep.show],
      metadata: { ...ep }
    }));
  }

  async refresh(): Promise<void> {}

  async search(query: string): Promise<UnifiedMediaItem[]> {
    const lib = await this.loadLibrary();
    const q = query.toLowerCase();
    return lib.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle?.toLowerCase().includes(q)
    );
  }

  async loadItem(id: string): Promise<UnifiedMediaItem | null> {
    const lib = await this.loadLibrary();
    return lib.find(item => item.id === id) || null;
  }

  play(item: UnifiedMediaItem): void {
    if (this.onPlayCallback) {
      this.onPlayCallback(item.url, item.title);
    }
  }

  getThumbnail(item: UnifiedMediaItem): string {
    return item.thumbnail || "https://archive.org/download/daily-highlights/lmbsa.png";
  }

  getMetadata(item: UnifiedMediaItem): Record<string, any> {
    return item.metadata || {};
  }

  async export(): Promise<Blob> {
    const content = JSON.stringify(this.episodes, null, 2);
    return new Blob([content], { type: "application/json" });
  }

  async import(): Promise<void> {}
}

export class MediaProviderService {
  private sessions: Record<string, ProviderSessionState> = {
    iptv: {
      providerId: "iptv",
      searchQuery: "",
      sortMode: "default",
      scrollPosition: 0
    },
    archive: {
      providerId: "archive",
      searchQuery: "",
      sortMode: "date-desc",
      scrollPosition: 0
    },
    uploads: {
      providerId: "uploads",
      searchQuery: "",
      sortMode: "default",
      scrollPosition: 0
    }
  };

  getSession(providerId: "iptv" | "archive" | "uploads"): ProviderSessionState {
    return this.sessions[providerId] || {
      providerId,
      searchQuery: "",
      sortMode: "default",
      scrollPosition: 0
    };
  }

  saveSession(providerId: "iptv" | "archive" | "uploads", state: Partial<ProviderSessionState>): void {
    if (this.sessions[providerId]) {
      this.sessions[providerId] = { ...this.sessions[providerId], ...state };
    }
  }
}

export const mediaProviderService = new MediaProviderService();

export const loadPlaylist = async (fileType: string, content: string) => {
  switch (fileType.toLowerCase()) {
    case "dpl":
      const channels = DaumPlaylistAdapter.parse(content);
      return channels;
    case "m3u8":
    case "m3u":
      return [];
    default:
      throw new Error(`Unsupported format: ${fileType}`);
  }
};
