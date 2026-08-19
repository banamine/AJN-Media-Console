/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IPTVChannel {
  name: string;
  logo: string | null;
  url: string;
  group: string;           // Parsed from group-title attribute in M3U #EXTINF line
  tvgId?: string;          // tvg-id
  tvgName?: string;        // tvg-name (canonical name for EPG)
  tvgChno?: string;        // tvg-chno (channel number)
  tvgLanguage?: string;    // tvg-language (ISO 639-1)
  tvgCountry?: string;     // tvg-country (ISO 3166-1 alpha-2)
  tvgGenre?: string;       // tvg-genre
  resolution?: string;     // resolution attribute
  bitrate?: string;        // bitrate (kbps)
  codec?: string;          // codec
  userAgent?: string;      // user-agent / http-user-agent
  referer?: string;        // referer / http-referrer
  auth?: string;           // auth token
  catchup?: string;        // catchup type (flussonic, vod, http)
  catchupDays?: number;    // catchup-days
  duration?: number;       // parsed from #EXTINF duration field: -1 for live, positive integer for VOD seconds
  duration_source?: "probed" | "estimated" | "failed" | "existing";
  description?: string;    // description
  status?: string;         // status (online/offline)
  _cyrillicTitle?: boolean; // internal: true if original display name was purely Cyrillic
  _inferredLanguage?: string; // internal: language code set by heuristic, not attribute
  showName?: string;
  contentType?: "live" | "vod" | "radio";
  category?: string[];
  dateKey?: string;       // YYYY-MM-DD
  playCount?: number;
  lastPlayed?: string;
  active?: boolean;
  isPermanent?: boolean;
}

export interface PlaybackHistoryItem {
  id: string;
  type: "stream" | "archive";
  name: string;
  url: string;
  playedAt: string;
}

export interface ArchiveEpisode {
  id: string;
  title: string;
  videoUrl: string;
  pubDate: string;
  dateKey: string; // YYYY-MM-DD
  show: string;    // 'War Room' | 'Sunday Night Live' | 'Alex Jones Show'
  hour: string;    // 'Hour 1', 'Hour 2', 'Hour 3', 'Full Show'
}

export interface TimeRangeMetadata {
  hex: string;
  rgb: string;
  name: string;
  icon: string;
}

export type ColorScheme = Record<string, TimeRangeMetadata>;

export interface M3UPlaylistVersion {
  versionId: string;
  timestamp: string;
  checksum: string;
  content: string;
  channelCount: number;
}

export interface M3UPlaylist {
  id: string;
  name: string;
  url?: string;
  fallbackUrls?: string[]; // Backup URLs to poll if primary fails
  content?: string;
  checksum?: string;
  importedAt: string;
  channelCount: number;
  isCustom?: boolean;
  history?: M3UPlaylistVersion[]; // Retains last 5-10 versions for rollback
}

export interface BroadcastDaySchedule {
  dateKey: string; // YYYY-MM-DD
  note?: string;
  dayStart?: string; // e.g., "06:00" EPG boundary
  rules?: string;
  scheduleItems: {
    id: string;
    time: string; // e.g. "12:00"
    title: string;
    channelUrl?: string;
    description?: string;
  }[];
}

export interface TVShowSeries {
  id: string;
  name: string;
  season?: number;
  description?: string;
  categories?: string[];
  banner?: string;
  episodes: {
    id: string;
    title: string;
    url: string;
    episodeNumber?: number;
    duration?: string;
    playCount?: number;
    dateKey?: string;
  }[];
}

export interface WatchedFolder {
  id: string;
  path: string;
  lastScanned?: string;
  autoPoll?: boolean;
  fileCount?: number;
  status?: string;
}

export interface PlaybackSource {
  id?: string;
  type: "iptv" | "archive" | "uploads" | "direct" | "unknown";
  url: string;
  title: string;
  duration?: number;
}

export type PlayerState =
  | "idle"
  | "mounting"
  | "attaching"
  | "loading"
  | "ready"
  | "playing"
  | "buffering"
  | "recovering"
  | "ended"
  | "error";

export interface PlayerDiagnostics {
  streamType: "auto" | "hls" | "native" | string;
  feedSourceUsed: string;
  lastErrorDetails?: string;
  videoRefMounted: boolean;
  recoveryAttempts?: number;
}

export interface PlayerError {
  code: string;
  message: string;
  details?: string;
}

export interface PlayerStore {
  state: PlayerState;

  source?: PlaybackSource;

  currentUrl?: string;
  currentTitle?: string;
  channelId?: string;
  isBackupPlayback?: boolean;

  duration: number;
  currentTime: number;

  volume: number;
  isMuted: boolean;

  diagnostics: PlayerDiagnostics;

  error?: PlayerError;
}

export interface SiriusTrack {
  title: string;
  artist: string;
  url: string;
  backups: string[];
}

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export interface AudioTrack {
  id?: string;
  title: string;
  artist: string;
  url: string;
  backups?: string[];
  length?: number;
  sourceType?: string; // e.g. 'pls' | 'm3u' | 'sirius'
}

export interface AudioPlaylist {
  id: string;
  name: string;
  tracks: AudioTrack[];
  createdAt: string;
  updatedAt: string;
  folder?: string;
}

export interface PlaybackSettings {
  autoAdvance: boolean;
  loopPlaylist: boolean;
  shuffleMode: 'off' | 'random' | 'fair';
  sortPreference?: string;
}

export interface QueueState {
  played: number;
  total: number;
}

export interface MusicTrack extends AudioTrack {
  genre?: string;
  year?: number;
  album?: string;
  isFavorite?: boolean;
  dateAdded: string;
  part?: number;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  description?: string;
  tracks: string[]; // List of track IDs
  createdAt: string;
  updatedAt: string;
  isSystem?: boolean; // e.g., "Favorites" is system
  thumbnailUrl?: string;
  venue?: string;
  date?: string;
  artist?: string;
  format?: string;
  isSmart?: boolean;
  rules?: {
    field: string;
    operator: string;
    value: string;
  }[];
}

export interface MediaProviderContract {
  id: string;
  name: string;
  providerType: "iptv" | "archive" | "uploads" | "audio";
  supportsSearch: boolean;
  supportsCategories: boolean;
  supportsFavorites: boolean;
  supportsHistory: boolean;
  supportsResume: boolean;
  supportsEPG: boolean;
  supportsThumbnails: boolean;

  loadLibrary(): Promise<UnifiedMediaItem[]>;
  refresh(): Promise<void>;
  search(query: string): Promise<UnifiedMediaItem[]>;
  loadItem(id: string): Promise<UnifiedMediaItem | null>;
  play(item: UnifiedMediaItem): void;
  getThumbnail(item: UnifiedMediaItem): string;
  getMetadata(item: UnifiedMediaItem): Record<string, any>;
  export(format: string): Promise<Blob>;
  import(file: File): Promise<void>;
}

export interface ProviderSessionState {
  providerId: "iptv" | "archive" | "uploads";
  selectedCollection?: string;
  selectedCategory?: string;
  selectedItem?: string;
  searchQuery: string;
  sortMode: string;
  filterMode?: string;
  scrollPosition: number;
}

export interface UnifiedMediaItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string | null;
  provider: "iptv" | "archive" | "uploads" | string;
  mediaType: "live" | "vod" | "audio" | string;
  url: string;
  duration?: number;
  duration_source?: "probed" | "estimated" | "failed" | "existing";
  resolution?: string;
  bitrate?: string;
  codec?: string;
  badges?: string[];
  favorite?: boolean;
  watched?: boolean;
  live?: boolean;
  progress?: number;
  category?: string[];
  metadata?: Record<string, any>;
}

export interface FolderRegistry {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  sortIndex: number;
  isSystemLocked?: boolean; // true for "folder_unorganized"
  tags?: string[];
}

export interface ContentItem {
  id: string;
  folderId: string;
  slotNumber?: number; // numbered slot 1..N
  title: string;
  url: string;
  mediaType: "live" | "vod" | "audio";
  thumbnailUrl?: string;
  logoUrl?: string;
  groupTitle?: string;
  duration?: number;
  duration_source?: "probed" | "estimated" | "failed" | "existing";
  durationSeconds: number;
  parsedAt: string;
  createdAt: string;
  checksum?: string;
  hasConflict?: boolean;
  backupUrl?: string;
  sourcePriority?: string[];
  conflictSources?: { id: string; name: string; url: string; priority: number }[];
  preferredUrl?: string;
  fileCount?: number;
  files?: { title: string; url: string; durationSeconds: number }[];
}

export interface PlaceCardSlot {
  slotNumber: number; // 1 through N
  contentItem?: ContentItem;
}

export interface GlobalSnapshot {
  url: string;
  title: string;
  seekPosition: number;
  exitTime: number;
}

// ============================================================================
// PROVIDER-BASED BROADCAST OS ORCHESTRATION & DATA MODEL REFACTOR
// ============================================================================

export enum LoopStrategy {
  LIVE_EDGE = "LIVE_EDGE",
  MIDNIGHT = "MIDNIGHT",
  FIXED_12_HOUR = "FIXED_12_HOUR",
  FIXED_24_HOUR = "FIXED_24_HOUR",
  LINEAR = "LINEAR",
  EVENT = "EVENT",
  NEVER = "NEVER",
}

export interface ChannelHealth {
  status: "online" | "degraded" | "offline" | "recovering";
  lastSeen: string;
  latency: number;
  errors: number;
  uptime: number;
  lastRecovery?: string;
}

export interface BroadcastChannel {
  id: string;
  number: number;
  name: string;
  logo?: string | null;
  playbackProvider: "broadcast" | "global_demo" | "direct" | string;
  playlistId: string;
  epgId: string;
  priority?: number; // Integer 1-100
  playbackConfig?: {
    urls?: string[];
    codecs?: string;
    streamSource?: "youtube" | "rumble" | "m3u" | "direct" | "xmltv" | string;
    streamUrl?: string;
  };
  channelMetadata?: {
    title?: string;
    tags?: string[];
    genres?: string[];
    callsign?: string;
    description?: string;
  };
  userState?: {
    lastPlayed?: string;
    watchDurationSeconds?: number;
    isFavorite?: boolean;
    customCollections?: string[];
    healthStatus?: string;
  };
  health?: ChannelHealth;
  schedulePolicy?: "xmltv" | "m3u_extended" | "provider_api" | "synthetic";
  playbackPolicy?: {
    seekProtection: boolean;
    hotSwapEnabled: boolean;
    maxBufferSeconds?: number;
  };
  dvrPolicy?: {
    enabled: boolean;
    windowSeconds: number;
    allowCatchup: boolean;
  };
  failoverPolicy?: {
    autoSwitchToBackup: boolean;
    maxRetries: number;
    backupPlaylistId?: string;
  };
  graphicsProfile?: {
    showLowerThirds: boolean;
    logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "hidden";
    overlayTheme: "slate" | "neon" | "monochrome" | "retro";
    showCountdown: boolean;
  };
  emergencyAlertProfile?: {
    allowCutIns: boolean;
    priorityThreshold: number;
  };
  loopStrategy: LoopStrategy;
}

export interface MediaRegistryItem {
  id: string; // Canonical unique ID or fingerprint
  url: string;
  codec?: string;
  durationSeconds: number; // -1 for live stream
  duration_source?: "probed" | "estimated" | "failed" | "existing";
  artwork?: string;
  title: string;
  metadata?: Record<string, any>;
  fingerprint: string;
}

export interface PlaylistRegistryItem {
  id: string;
  name: string;
  mediaIds: string[]; // references MediaRegistryItem.id
  loopStrategy: LoopStrategy;
  updatedAt: string;
}

export interface EPGProgramBlock {
  id: string;
  startTime: string; // ISO timestamp or HH:MM
  title: string;
  description?: string;
  mediaId?: string; // canonical reference to MediaRegistryItem
  durationSeconds: number;
  duration_source?: "probed" | "estimated" | "failed" | "existing";
  category?: string;
  isSynthetic?: boolean;
}

export interface EPGRegistryItem {
  channelId: string;
  dateKey: string; // YYYY-MM-DD
  blocks: EPGProgramBlock[];
  prioritySource: "xmltv" | "m3u_extended" | "provider_api" | "synthetic";
}

export interface ResolvedChannelPlayback {
  channel: BroadcastChannel;
  currentProgram: EPGProgramBlock | null;
  nextProgram: EPGProgramBlock | null;
  media: MediaRegistryItem | null;
  playbackOffsetSeconds: number;
  resolvedTimestamp: number;
  graphicsProfile?: BroadcastChannel["graphicsProfile"];
  emergencyAlertActive?: boolean;
}

// ==========================================
// AUTONOMOUS NEWS HEADEND INTEGATION TYPES & SCHEMAS
// ==========================================

export interface NewsProfile {
  id: string;
  callsign: string;
  displayName: string;
  logoUrl?: string | null;
  rssUrl?: string | null;
  isActive: boolean;
  lastHarvested?: string | null; // Nullable last harvested datetime/text
}

export interface NewsEpisode {
  id: string;
  profileId?: string | null; // linked to originating news_profile.id
  title: string;
  url: string;
  timestamp: number;
}

/**
 * Validation schema checker for NewsProfile objects.
 * Guarantees strict type-safety and conformance.
 */
export function validateNewsProfile(data: any): data is NewsProfile {
  if (!data || typeof data !== "object") return false;
  if (typeof data.id !== "string" || !data.id.trim()) return false;
  if (typeof data.callsign !== "string" || !data.callsign.trim()) return false;
  if (typeof data.displayName !== "string" || !data.displayName.trim()) return false;
  if (data.logoUrl !== undefined && data.logoUrl !== null && typeof data.logoUrl !== "string") return false;
  if (data.rssUrl !== undefined && data.rssUrl !== null && typeof data.rssUrl !== "string") return false;
  if (typeof data.isActive !== "boolean") return false;
  if (data.lastHarvested !== undefined && data.lastHarvested !== null && typeof data.lastHarvested !== "string") return false;
  return true;
}

/**
 * Validation schema checker for Episode objects.
 * Guarantees strict type-safety and conformance.
 */
export function validateNewsEpisode(data: any): data is NewsEpisode {
  if (!data || typeof data !== "object") return false;
  if (typeof data.id !== "string" || !data.id.trim()) return false;
  if (data.profileId !== undefined && data.profileId !== null && typeof data.profileId !== "string") return false;
  if (typeof data.title !== "string") return false;
  if (typeof data.url !== "string" || !data.url.startsWith("http")) return false;
  if (typeof data.timestamp !== "number") return false;
  return true;
}



