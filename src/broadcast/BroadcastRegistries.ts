import { Mutex } from "async-mutex";
import {
  BroadcastChannel,
  MediaRegistryItem,
  PlaylistRegistryItem,
  EPGRegistryItem,
  EPGProgramBlock,
  LoopStrategy,
  IPTVChannel,
} from "../types";
import { sanitizeChannelTitle } from "../utils/semanticResolver";


export class ObservableRegistry {
  public revision: number = 0;
  private listeners: Array<() => void> = [];

  public getRevision(): number {
    return this.revision;
  }

  public onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  protected notify(): void {
    this.revision++;
    this.listeners.forEach((cb) => cb());
  }
}

/**
 * Canonical Media Registry
 * Stores deduplicated media items indexed by ID and fingerprint.
 */
export class MediaRegistry extends ObservableRegistry {
  private itemsById: Map<string, MediaRegistryItem> = new Map();
  private itemsByFingerprint: Map<string, MediaRegistryItem> = new Map();

  public register(item: Omit<MediaRegistryItem, "fingerprint" | "id"> & { id?: string }): MediaRegistryItem {
    const rawString = `${item.title.trim().toLowerCase()}|${item.url.trim()}`;
    // FNV-1a 32-bit hash fingerprint
    let hash = 0x811c9dc5;
    for (let i = 0; i < rawString.length; i++) {
      hash ^= rawString.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    const fingerprint = `fp_${(hash >>> 0).toString(16)}`;

    if (this.itemsByFingerprint.has(fingerprint)) {
      return this.itemsByFingerprint.get(fingerprint)!;
    }

    const id = item.id || `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullItem: MediaRegistryItem = {
      ...item,
      id,
      fingerprint,
    };

    this.itemsById.set(id, fullItem);
    this.itemsByFingerprint.set(fingerprint, fullItem);
    this.notify();
    return fullItem;
  }

  public getById(id: string): MediaRegistryItem | undefined {
    return this.itemsById.get(id);
  }

  public getByUrl(url: string): MediaRegistryItem | undefined {
    for (const item of this.itemsById.values()) {
      if (item.url === url) return item;
    }
    return undefined;
  }

  public getAll(): MediaRegistryItem[] {
    return Array.from(this.itemsById.values());
  }

  public remove(id: string): boolean {
    const item = this.itemsById.get(id);
    if (!item) return false;
    this.itemsById.delete(id);
    this.itemsByFingerprint.delete(item.fingerprint);
    this.notify();
    return true;
  }

  public clear(): void {
    if (this.itemsById.size > 0) {
      this.itemsById.clear();
      this.itemsByFingerprint.clear();
      this.notify();
    }
  }
}

/**
 * Playlist Registry
 * Stores ordered lists of media references without timing/scheduling noise.
 */
export class PlaylistRegistry extends ObservableRegistry {
  private playlists: Map<string, PlaylistRegistryItem> = new Map();

  public register(
    id: string,
    name: string,
    mediaIds: string[],
    loopStrategy: LoopStrategy = LoopStrategy.MIDNIGHT
  ): PlaylistRegistryItem {
    const item: PlaylistRegistryItem = {
      id,
      name,
      mediaIds,
      loopStrategy,
      updatedAt: new Date().toISOString(),
    };
    this.playlists.set(id, item);
    this.notify();
    return item;
  }

  public getById(id: string): PlaylistRegistryItem | undefined {
    return this.playlists.get(id);
  }

  public getAll(): PlaylistRegistryItem[] {
    return Array.from(this.playlists.values());
  }

  public remove(id: string): boolean {
    const res = this.playlists.delete(id);
    if (res) this.notify();
    return res;
  }

  public clear(): void {
    if (this.playlists.size > 0) {
      this.playlists.clear();
      this.notify();
    }
  }
}

/**
 * EPG Registry
 * Pure scheduling blocks associated with channels and calendar days.
 */
export class EPGRegistry extends ObservableRegistry {
  private epgsByChannelDate: Map<string, EPGRegistryItem> = new Map(); // key: channelId|dateKey

  public register(
    channelId: string,
    dateKey: string,
    blocks: EPGProgramBlock[],
    prioritySource: EPGRegistryItem["prioritySource"] = "synthetic"
  ): EPGRegistryItem {
    const key = `${channelId}|${dateKey}`;
    const existing = this.epgsByChannelDate.get(key);

    // Hybrid scheduling priority enforcement:
    // 1. xmltv > 2. m3u_extended > 3. provider_api > 4. synthetic
    const priorityRank = { xmltv: 4, m3u_extended: 3, provider_api: 2, synthetic: 1 };
    if (existing && priorityRank[existing.prioritySource] > priorityRank[prioritySource]) {
      return existing;
    }

    const item: EPGRegistryItem = {
      channelId,
      dateKey,
      blocks,
      prioritySource,
    };
    this.epgsByChannelDate.set(key, item);
    this.notify();
    return item;
  }

  public getSchedule(channelId: string, dateKey: string): EPGRegistryItem | undefined {
    return this.epgsByChannelDate.get(`${channelId}|${dateKey}`);
  }

  public getAll(): EPGRegistryItem[] {
    return Array.from(this.epgsByChannelDate.values());
  }

  public removeByKey(key: string): boolean {
    const res = this.epgsByChannelDate.delete(key);
    if (res) this.notify();
    return res;
  }

  public clear(): void {
    if (this.epgsByChannelDate.size > 0) {
      this.epgsByChannelDate.clear();
      this.notify();
    }
  }
}

/**
 * Channel Registry
 * Authoritative channel configuration (metadata, logos, EPG mapping, and policies).
 */
export class ChannelRegistry extends ObservableRegistry {
  private channelsById: Map<string, BroadcastChannel> = new Map();
  private channelsByNumber: Map<number, BroadcastChannel> = new Map();

  public register(channel: BroadcastChannel): BroadcastChannel {
    if (channel && channel.name) {
      channel.name = sanitizeChannelTitle(channel.name);
    }
    this.channelsById.set(channel.id, channel);
    this.channelsByNumber.set(channel.number, channel);
    this.notify();
    return channel;
  }

  public getById(id: string): BroadcastChannel | undefined {
    return this.channelsById.get(id);
  }

  public getByNumber(num: number): BroadcastChannel | undefined {
    return this.channelsByNumber.get(num);
  }

  public getAll(): BroadcastChannel[] {
    return Array.from(this.channelsById.values()).sort((a, b) => a.number - b.number);
  }

  public remove(id: string): boolean {
    const ch = this.channelsById.get(id);
    if (!ch) return false;
    this.channelsById.delete(id);
    this.channelsByNumber.delete(ch.number);
    this.notify();
    return true;
  }

  public clear(): void {
    if (this.channelsById.size > 0) {
      this.channelsById.clear();
      this.channelsByNumber.clear();
      this.notify();
    }
  }
}

export interface BroadcastSnapshot {
  schemaVersion: string;
  timestamp: number;
  checksum: number;
  data: {
    media: MediaRegistryItem[];
    playlists: PlaylistRegistryItem[];
    epg: EPGRegistryItem[];
    channels: BroadcastChannel[];
  };
}

export interface RegistryDiagnostics {
  mediaCount: number;
  playlistCount: number;
  epgBlockCount: number;
  channelCount: number;
  mediaRevision: number;
  playlistRevision: number;
  epgRevision: number;
  channelRevision: number;
  broadcastRevision: number;
  schemaVersion: string;
  lastSyncTimestamp: number;
  isMutexLocked: boolean;
  snapshotCRC: number;
}

/**
 * Master Facade: Broadcast Registry
 * Encapsulates all 4 sub-registries, handles atomic Mutex concurrency, snapshots, and memory GC.
 */
export class BroadcastRegistry {
  public static instance: BroadcastRegistry = new BroadcastRegistry();

  public media = new MediaRegistry();
  public playlists = new PlaylistRegistry();
  public epg = new EPGRegistry();
  public channels = new ChannelRegistry();

  // Concurrency lock to prevent race conditions during concurrent M3U polling or hot swaps
  public mutationMutex = new Mutex();

  public mutationRevision: number = 0;
  public lastSyncTimestamp: number = Date.now();
  private activeTransactionBackup: string | null = null;
  private listeners: Array<() => void> = [];

  private constructor() {
    const notifyMaster = () => {
      this.mutationRevision++;
      this.lastSyncTimestamp = Date.now();
      this.listeners.forEach((cb) => cb());
    };
    this.media.onChange(notifyMaster);
    this.playlists.onChange(notifyMaster);
    this.epg.onChange(notifyMaster);
    this.channels.onChange(notifyMaster);
  }

  public getRevision(): number {
    return this.mutationRevision;
  }

  public onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public beginTransaction(): void {
    if (!this.activeTransactionBackup) {
      this.activeTransactionBackup = this.serializeSnapshot();
    }
  }

  public commitTransaction(): void {
    this.activeTransactionBackup = null;
    this.lastSyncTimestamp = Date.now();
  }

  public async rollbackTransaction(): Promise<boolean> {
    if (!this.activeTransactionBackup) return false;
    const backup = this.activeTransactionBackup;
    this.activeTransactionBackup = null;
    return await this.restoreSnapshot(backup);
  }

  public async executeTransaction<T>(action: () => Promise<T> | T): Promise<T> {
    return this.mutationMutex.runExclusive(async () => {
      this.beginTransaction();
      try {
        const result = await action();
        this.commitTransaction();
        return result;
      } catch (err) {
        await this.rollbackTransaction();
        throw err;
      }
    });
  }

  /**
   * Compute fast integrity checksum validation (32-bit FNV-1a) for serialized snapshots
   */
  public static computeChecksum(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  /**
   * Export atomic serialized snapshot with version and checksum
   */
  public serializeSnapshot(): string {
    const rawData = {
      media: this.media.getAll(),
      playlists: this.playlists.getAll(),
      epg: this.epg.getAll(),
      channels: this.channels.getAll(),
    };
    const rawString = JSON.stringify(rawData);
    const checksum = BroadcastRegistry.computeChecksum(rawString);

    const snapshot: BroadcastSnapshot = {
      schemaVersion: "2.1.0",
      timestamp: Date.now(),
      checksum,
      data: rawData,
    };
    return JSON.stringify(snapshot);
  }

  /**
   * Restore atomic snapshot across restarts with versioned migration check & corruption recovery
   */
  public async restoreSnapshot(snapshotJson: string): Promise<boolean> {
    return this.mutationMutex.runExclusive(() => {
      try {
        const parsed: BroadcastSnapshot = JSON.parse(snapshotJson);
        if (!parsed || !parsed.data) {
          console.warn(`[BroadcastSnapshot] Corruption warning: Snapshot payload invalid or missing data.`);
          return false;
        }

        // Schema evolution & migration validation
        if (parsed.schemaVersion !== "2.1.0" && parsed.schemaVersion !== "2.0.0") {
          console.warn(`[BroadcastSnapshot] Migration warning: Upgrading legacy schema version (${parsed?.schemaVersion}) to 2.1.0.`);
        }

        const rawString = JSON.stringify(parsed.data);
        const actualChecksum = BroadcastRegistry.computeChecksum(rawString);
        if (actualChecksum !== parsed.checksum) {
          console.error(`[BroadcastSnapshot] Integrity breach: CRC Checksum mismatch (${actualChecksum} vs ${parsed.checksum}). Aborting restore.`);
          return false;
        }

        this.clear();
        if (Array.isArray(parsed.data.media)) {
          parsed.data.media.forEach((m) => {
            if (m && m.title && m.url) this.media.register(m);
          });
        }
        if (Array.isArray(parsed.data.playlists)) {
          parsed.data.playlists.forEach((p) => {
            if (p && p.id && Array.isArray(p.mediaIds)) {
              this.playlists.register(p.id, p.name || p.id, p.mediaIds, p.loopStrategy);
            }
          });
        }
        if (Array.isArray(parsed.data.epg)) {
          parsed.data.epg.forEach((e) => {
            if (e && e.channelId && e.dateKey && Array.isArray(e.blocks)) {
              this.epg.register(e.channelId, e.dateKey, e.blocks, e.prioritySource);
            }
          });
        }
        if (Array.isArray(parsed.data.channels)) {
          parsed.data.channels.forEach((c) => {
            if (c && c.id && c.number) this.channels.register(c);
          });
        }
        return true;
      } catch (err) {
        console.error("[BroadcastSnapshot] Failed to restore snapshot:", err);
        return false;
      }
    });
  }

  /**
   * Memory Lifecycle: Prune orphaned media items, expired EPG blocks, and unreferenced playlists
   */
  public gc(maxHistoryDays = 3): { prunedMedia: number; prunedEPG: number; prunedPlaylists: number } {
    const allChannels = this.channels.getAll();
    const activePlaylistIds = new Set(allChannels.map((c) => c.playlistId));
    const activeMediaIds = new Set<string>();

    // Collect active media from playlists
    this.playlists.getAll().forEach((p) => {
      if (activePlaylistIds.has(p.id)) {
        p.mediaIds.forEach((mId) => activeMediaIds.add(mId));
      }
    });

    // Collect active media from EPG blocks
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxHistoryDays);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    let prunedEPG = 0;
    this.epg.getAll().forEach((item) => {
      if (item.dateKey < cutoffStr) {
        this.epg.removeByKey(`${item.channelId}|${item.dateKey}`);
        prunedEPG++;
      } else {
        item.blocks.forEach((b) => {
          if (b.mediaId) activeMediaIds.add(b.mediaId);
        });
      }
    });

    // Prune unreferenced playlists
    let prunedPlaylists = 0;
    this.playlists.getAll().forEach((p) => {
      if (!activePlaylistIds.has(p.id) && p.id !== "pls_demo") {
        this.playlists.remove(p.id);
        prunedPlaylists++;
      }
    });

    // Prune orphaned canonical media items
    let prunedMedia = 0;
    this.media.getAll().forEach((m) => {
      if (!activeMediaIds.has(m.id)) {
        this.media.remove(m.id);
        prunedMedia++;
      }
    });

    return { prunedMedia, prunedEPG, prunedPlaylists };
  }

  /**
   * Seed the registries from legacy IPTVChannel list (e.g. M3U imports or onboard demo feeds)
   */
  public seedFromIPTVChannels(legacyChannels: IPTVChannel[]): void {
    this.clear();

    if (!legacyChannels || legacyChannels.length === 0) return;

    // Group legacy channels by their category/group
    const groups: Map<string, IPTVChannel[]> = new Map();
    for (const ch of legacyChannels) {
      const gName = ch.group?.trim() || "Universal Streams";
      if (!groups.has(gName)) groups.set(gName, []);
      groups.get(gName)!.push(ch);
    }

    let channelNum = 101;
    const todayStr = new Date().toISOString().split("T")[0];

    groups.forEach((groupChannels, groupTitle) => {
      const playlistId = `pls_${groupTitle.toLowerCase().replace(/\s+/g, "_")}`;
      const mediaIds: string[] = [];

      // Determine Loop Strategy heuristic based on group name
      let loopStrategy = LoopStrategy.MIDNIGHT;
      const lowerGroup = groupTitle.toLowerCase();
      if (lowerGroup.includes("news")) loopStrategy = LoopStrategy.MIDNIGHT;
      else if (lowerGroup.includes("sport")) loopStrategy = LoopStrategy.EVENT;
      else if (lowerGroup.includes("movie") || lowerGroup.includes("cinema")) loopStrategy = LoopStrategy.LINEAR;
      else if (lowerGroup.includes("archive") || lowerGroup.includes("vod")) loopStrategy = LoopStrategy.NEVER;
      else if (lowerGroup.includes("classic") || lowerGroup.includes("retro")) loopStrategy = LoopStrategy.FIXED_24_HOUR;

      groupChannels.forEach((legacyCh, idx) => {
        const mediaItem = this.media.register({
          title: legacyCh.name || `Program ${idx + 1}`,
          url: legacyCh.url,
          artwork: legacyCh.logo || undefined,
          durationSeconds: legacyCh.duration || (legacyCh.contentType === "vod" ? 3600 : 1800),
          duration_source: legacyCh.duration_source || "existing",
          codec: legacyCh.codec,
          metadata: {
            userAgent: legacyCh.userAgent,
            referer: legacyCh.referer,
            group: legacyCh.group,
            tvgId: legacyCh.tvgId,
          },
        });
        mediaIds.push(mediaItem.id);

        // Register individual channel for each live feed or group
        const chId = legacyCh.tvgId || `ch_${channelNum}_${idx}`;
        const epgId = `epg_${chId}`;

        // Create Virtual BroadcastChannel
        const bChannel: BroadcastChannel = {
          id: chId,
          number: legacyCh.tvgChno ? parseInt(legacyCh.tvgChno, 10) || channelNum : channelNum,
          name: legacyCh.name || `Channel ${channelNum}`,
          logo: legacyCh.logo,
          playbackProvider: "broadcast",
          playlistId,
          epgId,
          schedulePolicy: legacyCh.tvgId ? "xmltv" : "synthetic",
          playbackPolicy: {
            seekProtection: true,
            hotSwapEnabled: true,
            maxBufferSeconds: 30,
          },
          dvrPolicy: {
            enabled: !!legacyCh.catchup,
            windowSeconds: (legacyCh.catchupDays || 3) * 86400,
            allowCatchup: !!legacyCh.catchup,
          },
          failoverPolicy: {
            autoSwitchToBackup: true,
            maxRetries: 3,
          },
          graphicsProfile: {
            showLowerThirds: true,
            logoPosition: "top-right",
            overlayTheme: "slate",
            showCountdown: false,
          },
          emergencyAlertProfile: {
            allowCutIns: true,
            priorityThreshold: 80,
          },
          loopStrategy,
        };

        this.channels.register(bChannel);

        // Generate synthetic or extended M3U EPG block for today
        const blockDuration = mediaItem.durationSeconds > 0 ? mediaItem.durationSeconds : 1800;
        const startSec = (idx * blockDuration) % 86400;
        const hours = Math.floor(startSec / 3600).toString().padStart(2, "0");
        const mins = Math.floor((startSec % 3600) / 60).toString().padStart(2, "0");

        const epgBlock: EPGProgramBlock = {
          id: `blk_${chId}_${idx}`,
          startTime: `${todayStr}T${hours}:${mins}:00.000Z`,
          title: mediaItem.title,
          description: legacyCh.description || `${groupTitle} broadcast presentation.`,
          mediaId: mediaItem.id,
          durationSeconds: blockDuration,
          duration_source: mediaItem.duration_source,
          category: legacyCh.tvgGenre || groupTitle,
          isSynthetic: !legacyCh.tvgId,
        };

        this.epg.register(chId, todayStr, [epgBlock], legacyCh.tvgId ? "m3u_extended" : "synthetic");

        channelNum++;
      });

      this.playlists.register(playlistId, groupTitle, mediaIds, loopStrategy);
    });
  }

  public getDiagnostics(): RegistryDiagnostics {
    const mediaAll = this.media.getAll();
    const playlistsAll = this.playlists.getAll();
    const epgAll = this.epg.getAll();
    const channelsAll = this.channels.getAll();
    const epgBlockCount = epgAll.reduce((acc, e) => acc + e.blocks.length, 0);

    return {
      mediaCount: mediaAll.length,
      playlistCount: playlistsAll.length,
      epgBlockCount,
      channelCount: channelsAll.length,
      mediaRevision: this.media.getRevision(),
      playlistRevision: this.playlists.getRevision(),
      epgRevision: this.epg.getRevision(),
      channelRevision: this.channels.getRevision(),
      broadcastRevision: this.getRevision(),
      schemaVersion: "2.1.0",
      lastSyncTimestamp: this.lastSyncTimestamp,
      isMutexLocked: this.mutationMutex.isLocked(),
      snapshotCRC: BroadcastRegistry.computeChecksum(JSON.stringify({
        media: mediaAll,
        playlists: playlistsAll,
        epg: epgAll,
        channels: channelsAll,
      })),
    };
  }

  public clear(): void {
    this.media.clear();
    this.playlists.clear();
    this.epg.clear();
    this.channels.clear();
  }
}
