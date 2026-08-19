/**
 * Authoritative Enterprise Engineering Specification & Public API Contracts
 * for the BroadcastTVGuide Module (Master Specification v10.0)
 * 
 * Protected Core Component — Adheres strictly to 10/10 audit standards,
 * TypeScript strict mode, zero memory leak invariants, and Dual Runtime execution.
 */

// ============================================================================
// PROMPT 1: FORMAL DATA MODELS
// ============================================================================

/**
 * Playback source format metadata for program transmission.
 */
export interface PlaybackSourceMetadata {
  streamUrl: string;
  protocol: "hls" | "dash" | "mp4" | "rtmp" | "iframe" | "shoutcast";
  drmProtected?: boolean;
  licenseUrl?: string;
  maxBitrateKbps?: number;
  audioChannels?: "stereo" | "surround-5.1" | "atmos" | "mono";
}

/**
 * Formal contract for an individual Electronic Program Guide (EPG) program item.
 * 
 * Constraints:
 * - `duration` MUST exactly equal (`endTime` - `startTime`) in milliseconds.
 * - If `live` is true, `recordingAllowed` MUST be false (live broadcasts cannot be pre-recorded).
 */
export interface GuideProgram {
  /** Unique UUID identifier across all EPG namespaces */
  id: string;
  /** Primary display title */
  title: string;
  /** Detailed HTML/Plaintext synopsis (MUST be DOMPurify sanitized) */
  description: string;
  /** ISO 8601 UTC timestamp string for program initiation */
  startTime: string;
  /** ISO 8601 UTC timestamp string for program termination */
  endTime: string;
  /** Calculated exact duration in milliseconds */
  duration: number;
  /** Primary taxonomic genre classification */
  genre: "News" | "Movies" | "Sports" | "Sci-Fi" | "Kids" | "Documentary" | "Music" | "Drama" | "Special";
  /** Upstream content syndication origin */
  provider: "iptv" | "archive" | "ajn-local" | "syndicate" | "youtube";
  /** High-resolution promotional poster or thumbnail URI */
  artwork: string;
  /** Executable playback transport descriptor */
  playbackSource: PlaybackSourceMetadata;
  /** Flag indicating if cloud DVR capture is legally/technically permitted */
  recordingAllowed: boolean;
  /** True if broadcast is happening in real-time */
  live: boolean;
  /** True if this is a first-run broadcast debut */
  premiere: boolean;
  /** True if this broadcast is a syndicated encore replay */
  repeat: boolean;
  /** Content rating descriptor (e.g., TV-MA, PG-13) */
  parentalRating?: string;
  /** Data contract schema revision */
  schemaVersion: "v1" | "v2" | "v3";
}

/**
 * Formal contract for a broadcast channel row within the EPG grid matrix.
 */
export interface GuideChannel {
  /** Immutable internal station identifier */
  id: string;
  /** Human-readable station call sign or moniker */
  name: string;
  /** Virtual channel slot number (e.g., 404, 101) */
  numericChannel: number;
  /** Station branding emblem URL */
  logo: string;
  /** Content distribution provider namespace */
  provider: "iptv" | "archive" | "ajn-local" | "shoutcast";
  /** Operator toggle to omit station from standard rendering */
  hidden: boolean;
  /** User favorite status indicator */
  favorite: boolean;
  /** Maximum parental advisory threshold */
  parentalRating: "TV-Y" | "TV-G" | "TV-PG" | "TV-14" | "TV-MA" | "UR";
  /** Native video transmission tier */
  streamQuality: "SD" | "HD" | "FHD" | "UHD-4K";
  /** Primary audio dialect ISO 639-1 code */
  language: string;
  /** Broadcast territory ISO 3166-1 alpha-2 code */
  region: string;
}

/**
 * Daily sequential program schedule for a specific channel.
 */
export interface GuideSchedule {
  channelId: string;
  calendarDate: string; // YYYY-MM-DD
  programs: GuideProgram[];
  lastSynced: string; // ISO 8601 UTC
}

/**
 * Full 24-hour broadcast cycle across all active channels.
 */
export interface GuideDay {
  calendarDate: string;
  schedules: Record<string, GuideSchedule>; // channelId -> GuideSchedule
  totalProgramsCount: number;
}

/**
 * Currently rendered viewport boundary for virtualized window calculation.
 */
export interface GuideViewport {
  startDate: string; // ISO 8601 UTC start of visible horizontal timeline
  endDate: string;   // ISO 8601 UTC end of visible horizontal timeline
  startChannelIndex: number; // Topmost visible vertical channel row index
  endChannelIndex: number;   // Bottommost visible vertical channel row index
  zoomResolutionMinutes: 15 | 30 | 60 | 120; // Time axis column width scale
}


// ============================================================================
// PROMPT 2: PUBLIC API & COMPONENT CONTRACTS
// ============================================================================

export interface GuideFilters {
  genres?: string[];
  providers?: string[];
  onlyFavorites?: boolean;
  onlyLive?: boolean;
  onlyPremieres?: boolean;
  maxParentalRating?: string;
  minQuality?: "SD" | "HD" | "FHD" | "UHD-4K";
}

export interface SearchFilters {
  genre?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  includePlot?: boolean;
  includeActors?: boolean;
}

/**
 * Authoritative Public API contract exposed by the BroadcastTVGuide subsystem.
 */
export interface BroadcastTVGuideAPI {
  /** Initializes database stores, workers, and loads initial grid state */
  loadGuide(): Promise<void>;
  /** Forces synchronous upstream re-ingestion from all registered providers */
  refreshGuide(forceClearCache?: boolean): Promise<void>;
  /** Smoothly scrolls virtual grid horizontal scrollbar to current system UTC time */
  goToNow(): void;
  /** Navigates horizontal timeline to midnight UTC of specified target date */
  goToDate(date: Date): void;
  /** Updates visible viewport boundaries and triggers overscan pre-rendering */
  setViewport(viewport: GuideViewport): void;
  /** Smoothly scrolls vertical container to center target station ID */
  scrollToChannel(channelId: string): void;
  /** Executes sub-200ms Trie/Tf-Idf index query returning matching programs */
  search(query: string, filters?: SearchFilters): Promise<GuideProgram[]>;
  /** Applies live state filtering across genre rails and provider tags */
  filter(filters: GuideFilters): void;
  /** Highlights target program block and dispatches selection telemetry */
  selectProgram(programId: string): void;
  /** Immediately engages Master Control Playout for target program stream */
  playProgram(programId: string): void;
  /** Tears down workers, aborts network relays, and cleans up DOM observers */
  dispose(): void;
}


// ============================================================================
// PROMPT 5: EVENT CONTRACTS & PROPAGATION
// ============================================================================

export interface GuideLoadedEvent {
  type: "GuideLoaded";
  timestamp: string;
  totalChannels: number;
  totalPrograms: number;
  cacheHit: boolean;
}

export interface GuideRefreshStartedEvent {
  type: "GuideRefreshStarted";
  timestamp: string;
  trigger: "manual" | "ttl-expired" | "websocket-push";
}

export interface GuideRefreshCompletedEvent {
  type: "GuideRefreshCompleted";
  timestamp: string;
  durationMs: number;
  updatedProgramsCount: number;
}

export interface GuideErrorEvent {
  type: "GuideError";
  timestamp: string;
  code: "PROVIDER_TIMEOUT" | "MALFORMED_XMLTV" | "IDB_QUOTA_EXCEEDED" | "WORKER_CRASH";
  message: string;
  recoverable: boolean;
}

export interface ProgramSelectedEvent {
  type: "ProgramSelected";
  timestamp: string;
  program: GuideProgram;
  channel: GuideChannel;
}

export interface ProgramPlayingEvent {
  type: "ProgramPlaying";
  timestamp: string;
  programId: string;
  channelId: string;
  playbackSource: PlaybackSourceMetadata;
}

export interface ScheduleChangedEvent {
  type: "ScheduleChanged";
  timestamp: string;
  channelId: string;
  calendarDate: string;
  newPrograms: GuideProgram[];
}

export interface ViewportChangedEvent {
  type: "ViewportChanged";
  timestamp: string;
  viewport: GuideViewport;
}

export interface FilterChangedEvent {
  type: "FilterChanged";
  timestamp: string;
  activeFilters: GuideFilters;
}

export interface SearchCompletedEvent {
  type: "SearchCompleted";
  timestamp: string;
  query: string;
  resultsCount: number;
  latencyMs: number;
}

export type GuideSystemEvent = 
  | GuideLoadedEvent
  | GuideRefreshStartedEvent
  | GuideRefreshCompletedEvent
  | GuideErrorEvent
  | ProgramSelectedEvent
  | ProgramPlayingEvent
  | ScheduleChangedEvent
  | ViewportChangedEvent
  | FilterChangedEvent
  | SearchCompletedEvent;

export interface GuideEventSubscriber {
  onEvent(event: GuideSystemEvent): void;
}


// ============================================================================
// PROMPT 6: PLUGIN LIFECYCLE & SDK
// ============================================================================

/**
 * Enterprise Plugin SDK interface for third-party guide augmentations.
 */
export interface GuidePlugin {
  /** Unique plugin bundle namespace */
  readonly id: string;
  /** Display label */
  readonly name: string;
  /** Semver string */
  readonly version: string;
  
  /** Called when plugin is registered into Master Control Host */
  initialize(api: BroadcastTVGuideAPI): void | Promise<void>;
  /** Triggered upon successful EPG grid hydration */
  onGuideLoaded(summary: { channels: number; programs: number }): void;
  /** Triggered whenever virtualized grid scrolling crosses window thresholds */
  onViewportChanged(viewport: GuideViewport): void;
  /** Intercepts user click interaction on any program block */
  onProgramClicked(program: GuideProgram, channel: GuideChannel): boolean | void; // return true to prevent default playout
  /** Triggered when real-time schedule mutates */
  onScheduleUpdated(day: GuideDay): void;
  /** Invoked during system shutdown to release unmanaged memory */
  destroy(): void;
}


// ============================================================================
// PROMPT 8: TELEMETRY & DIAGNOSTICS
// ============================================================================

export interface GuideTelemetryMetrics {
  guideOpenTimeMs: number;
  guideRefreshTimeMs: number;
  searchLatencyMs: number;
  providerFailureRatePercent: number;
  droppedFramesPerMin: number;
  averageVisibleRows: number;
  memoryHeapUsedMB: number;
  scrollFPS: number;
  cacheHitRatioPercent: number;
  pluginLoadTimeMs: number;
}

export interface DiagnosticsHealthReport {
  subsystem: "BroadcastTVGuide";
  status: "NOMINAL" | "DEGRADED" | "CRITICAL" | "OFFLINE";
  uptimeSeconds: number;
  lastError?: string;
  metrics: GuideTelemetryMetrics;
}


// ============================================================================
// PROMPT 9: PERSISTENCE & SESSION RECOVERY
// ============================================================================

/**
 * Durable state schema persisted across browser restarts in IndexedDB.
 */
export interface GuidePersistedState {
  version: number;
  lastSelectedChannelId: string | null;
  lastSelectedProgramId: string | null;
  zoomResolutionMinutes: 15 | 30 | 60 | 120;
  activeFilters: GuideFilters;
  favoriteChannelIds: string[];
  layoutDensity: "compact" | "cozy" | "spacious";
  timestamp: number;
}


// ============================================================================
// PROMPT 11: BACKGROUND WORKERS
// ============================================================================

export type WorkerTaskType = 
  | "PARSE_XMLTV" 
  | "BUILD_SEARCH_INDEX" 
  | "MERGE_SCHEDULES" 
  | "DECODE_ARTWORK" 
  | "NORMALIZE_PROVIDER";

export interface GuideWorkerTask<T = any> {
  taskId: string;
  taskType: WorkerTaskType;
  payload: T;
  priority: "high" | "normal" | "low";
}

export interface GuideWorkerResponse<R = any> {
  taskId: string;
  success: boolean;
  result?: R;
  error?: string;
  executionTimeMs: number;
}


// ============================================================================
// PROMPT 12: SEARCH INDEX CONFIGURATION
// ============================================================================

export interface WeightedField {
  fieldName: keyof GuideProgram;
  weight: number; // e.g., title: 10, description: 5, genre: 2
}

export interface SearchIndexConfig {
  algorithm: "MiniSearch Hybrid Trie" | "Fuse.js Fuzzy";
  indexedFields: WeightedField[];
  fuzzyDistance: number; // Levenshtein max edits (0 to 3)
  stopWords: string[];
  maxResultLimit: number;
}


// ============================================================================
// PROMPT 15: ENTERPRISE FEATURES (TRANSACTIONS, UNDO/REDO, AUDIT)
// ============================================================================

export interface AuditLogEntry {
  transactionId: string;
  operatorId: string;
  action: "SCHEDULE_PROGRAM" | "MOVE_BLOCK" | "OVERRIDE_METADATA" | "EMERGENCY_PREEMPT";
  timestamp: string;
  targetChannelId: string;
  previousState: Partial<GuideProgram> | null;
  newState: Partial<GuideProgram> | null;
  reason?: string;
}

export interface TransactionalCommand {
  id: string;
  description: string;
  execute(): Promise<void>;
  undo(): Promise<void>;
}


// ============================================================================
// PROMPT 17: VERSIONED DATA CONTRACTS & MIGRATION
// ============================================================================

export interface VersionedDataContract<V = "v1" | "v2" | "v3"> {
  schemaVersion: V;
  payload: any;
}

export interface DataMigrationAdapter {
  fromVersion: string;
  toVersion: string;
  migrate(oldPayload: any): GuideProgram;
}


// ============================================================================
// UNIVERSAL SOURCE NORMALIZATION & VIRTUAL PLAYOUT SCHEDULER (MASTER ARCHITECTURE v10.5)
// ============================================================================

/**
 * Supported heterogeneous upstream source categories across the broadcast enterprise.
 */
export type UpstreamSourceType = 
  | "xmltv_epg"
  | "iptv_m3u"
  | "archive_org"
  | "youtube_channel"
  | "rumble_channel"
  | "local_media_folder"
  | "rss_syndication"
  | "podcast_feed";

/**
 * Raw un-normalized media asset payload harvested from any heterogeneous upstream source.
 */
export interface RawUpstreamAsset {
  externalId: string;
  sourceType: UpstreamSourceType;
  rawTitle: string;
  rawSynopsis?: string;
  durationMs?: number; // Optional; derived or synthesized if missing
  publishedAt?: string; // ISO 8601 UTC
  mediaUri: string;
  thumbnailUri?: string;
  isLiveStream?: boolean;
  rawTags?: string[];
}

/**
 * Authoritative Normalized Media Asset standardized across all provider boundaries.
 */
export interface NormalizedMediaAsset {
  assetId: string; // Internal UUID
  canonicalTitle: string;
  sanitizedDescription: string;
  exactDurationMs: number;
  genreClassification: GuideProgram["genre"];
  transport: PlaybackSourceMetadata;
  posterArtwork: string;
  premiereDate: string;
  isRealTimeLive: boolean;
  providerOrigin: UpstreamSourceType;
}

/**
 * Universal Source Adapter contract. Every provider MUST implement this interface
 * to transform raw external feeds into standardized NormalizedMediaAsset items.
 */
export interface UniversalSourceAdapter {
  readonly sourceType: UpstreamSourceType;
  readonly canPopulateChannels: boolean;
  readonly canPopulateSchedule: boolean;
  
  /** Discovers and extracts raw items from external URI or token */
  harvestAssets(sourceConfig: Record<string, string>): Promise<RawUpstreamAsset[]>;
  
  /** Normalizes raw items into strictly validated NormalizedMediaAsset structures */
  normalize(rawAssets: RawUpstreamAsset[]): Promise<NormalizedMediaAsset[]>;
}

/**
 * Virtual 24/7 Schedule Synthesis configuration for non-EPG VOD libraries.
 */
export interface ScheduleSynthesisRule {
  channelId: string;
  loopMode: "infinite_24_7" | "single_pass_terminate" | "shuffle_block";
  defaultFillerDurationMs: number;
  insertIdentEveryMs?: number; // Station ID insertion frequency
  allowOverlapPreemption: boolean;
}

/**
 * Breaking News / Live Stream emergency preemption policy.
 */
export interface BreakingPreemptionPolicy {
  policyId: string;
  targetChannelIds: string[] | "*"; // Apply to specific channels or all
  triggerSourceTypes: UpstreamSourceType[];
  autoSwitchOnLiveStart: boolean;
  returnToScheduledOnLiveEnd: boolean;
  preemptionIdentUri?: string; // Transition bumper video
}

/**
 * Custom Multi-Provider Virtual Channel definition authored by automation operators.
 */
export interface CustomVirtualChannelBuilder {
  channelId: string;
  displayName: string;
  numericSlot: number;
  channelLogo: string;
  synthesizedScheduleRules: ScheduleSynthesisRule;
  breakingPolicy?: BreakingPreemptionPolicy;
  /** Ordered list of asset queries or mixed upstream collection origins */
  contentPools: {
    sourceType: UpstreamSourceType;
    originIdentifier: string; // e.g. Archive collection ID or YouTube Channel ID
    weightRatio: number;
  }[];
}


// ============================================================================
// ENTERPRISE GOVERNANCE, AUTOMATION POLICIES & COMPLIANCE CONTRACTS (v11.0)
// ============================================================================

/**
 * Deterministic Preemption Priority hierarchy for emergency broadcast override.
 */
export type PreemptionPriorityTier = 
  | "CRITICAL_EMERGENCY_ALERT" // EAS / National Emergency Override
  | "HIGH_BREAKING_NEWS"       // Real-time Breaking News Debuts
  | "MEDIUM_SCHEDULED_LIVE"    // Planned Sports / Premiere Livestreams
  | "LOW_NORMAL_LINEAR";       // Standard VOD Schedule Automation

/**
 * Enhanced Preemption Policy incorporating priority negotiation.
 */
export interface EnterprisePreemptionPolicy extends BreakingPreemptionPolicy {
  priorityTier: PreemptionPriorityTier;
  preemptLowerTiersOnly: boolean;
  maxInterruptDurationMs: number;
}

/**
 * Provider Capability Matrix defining feature support boundaries per source.
 */
export interface ProviderCapabilities {
  supportsLive: boolean;
  supportsSeek: boolean;
  supportsSubtitles: boolean;
  supportsThumbnails: boolean;
  supportsComments: boolean;
  supportsCaptions: boolean;
  supportsPlaylists: boolean;
  supportsScheduling: boolean;
  supportsMetadataRefresh: boolean;
}

/**
 * Empirical Confidence Scoring for ingested metadata quality assurance.
 */
export interface MetadataConfidenceDescriptor {
  /** Normalized score from 0.0 (untrusted folder name) to 1.0 (verified XMLTV) */
  confidenceScore: number;
  originSource: UpstreamSourceType;
  requiresEnrichment: boolean;
  missingAttributes: string[];
}

/**
 * Multi-Stage Enrichment Pipeline execution phases.
 */
export type EnrichmentPipelineStage = 
  | "INGESTION"
  | "NORMALIZATION"
  | "METADATA_ENRICHMENT"
  | "ARTWORK_RESOLUTION"
  | "TRANSCRIPT_GENERATION"
  | "GENRE_CLASSIFICATION"
  | "SCHEDULE_SYNTHESIS";

/**
 * Advanced Rule-Based Scheduling Automation contracts.
 */
export type SchedulingRuleType = 
  | "sequential"
  | "random"
  | "weighted_random"
  | "block_programming"
  | "time_of_day"
  | "genre_rotation"
  | "no_repeat_window";

export interface BroadcastSchedulingRule {
  ruleId: string;
  ruleType: SchedulingRuleType;
  parameters: {
    noRepeatWindowHours?: number;
    blockTimeRanges?: { startTime: string; endTime: string; targetGenre: GuideProgram["genre"] }[];
    genreWeights?: Partial<Record<GuideProgram["genre"], number>>;
  };
}

/**
 * Persistent Canonical Asset Identity decoupling external URLs from internal playout state.
 */
export interface CanonicalAssetIdentity {
  canonicalAssetId: string; // Stable UUID or Content SHA-256
  providerAliases: Partial<Record<UpstreamSourceType, string>>;
  deduplicationHash: string;
  firstHarvestedAt: string;
}

/**
 * Formal Operational State Machine transitions for Automation Health.
 */
export type OperationalState = 
  | "PROVIDER_OFFLINE"
  | "DEGRADED"
  | "RECOVERING"
  | "HEALTHY"
  | "SYNCHRONIZING"
  | "READY";

/**
 * Certification Checklist Contract for validating new Universal Source Adapters.
 */
export interface ProviderCertificationManifest {
  providerId: UpstreamSourceType;
  sdkVersion: string;
  certificationStatus: "CERTIFIED" | "PROVISIONAL" | "REJECTED";
  complianceMatrix: {
    normalizationStrictness: boolean;
    metadataConfidenceThreshold: boolean;
    errorRecoverySLO: boolean;
    performanceUnder200ms: boolean;
    domPurifySanitization: boolean;
    zeroMemoryLeakTeardown: boolean;
  };
}


// ============================================================================
// MASTER USER EXPERIENCE (UX), ONBOARDING & DISCOVERABILITY CONTRACTS (v12.0)
// ============================================================================

/**
 * Responsive Device Breakpoint tiers for adaptive UI density.
 */
export type DeviceLayoutTier = "desktop" | "laptop" | "tablet" | "phone";

/**
 * First-Class Discoverable Navigation primary actions.
 * Invariant: Every UI layout template MUST expose these exact actions in standard locations.
 */
export type PrimaryNavigationAction = 
  | "NAV_HOME_DASHBOARD"
  | "NAV_LIVE_GUIDE"
  | "NAV_MASTER_PLAYER"
  | "NAV_MEDIA_LIBRARY"
  | "NAV_FAVORITES"
  | "NAV_SEARCH"
  | "NAV_SETTINGS";

/**
 * Persistent Theatre & Viewport mode preferences stored in operator profile.
 */
export interface TheatreModePersistedState {
  isTheatreModeActive: boolean;
  isCompactModeActive: boolean;
  defaultLaunchDestination: PrimaryNavigationAction;
  rememberLastChannel: boolean;
}

/**
 * Authoritative Resume Watching session recovery record.
 */
export interface ResumeWatchingRecord {
  channelId: string;
  programId: string;
  programTitle: string;
  playbackPositionMs: number;
  totalDurationMs: number;
  lastWatchedAt: string; // ISO 8601 UTC
}

/**
 * Built-in Demo Channel descriptor for zero-config first-run exploration.
 */
export interface DemoChannelDescriptor {
  demoChannelId: string;
  title: string;
  tagline: string;
  genre: GuideProgram["genre"];
  synthesizedAssetCount: number;
  bannerArtworkUri: string;
}

/**
 * First-Run Wizard configuration contract.
 */
export interface FirstRunExperienceManifest {
  isFirstLaunchCompleted: boolean;
  selectedDefaultSource?: UpstreamSourceType | "demo_channels";
  availableDemoPools: DemoChannelDescriptor[];
  autoBuildGuideOnImport: boolean;
}

/**
 * Master UX SLO Assessment criteria ensuring parity with 10/10 Engineering Architecture.
 */
export interface UXQualityAssessment {
  easeOfUseNewUsersScore: number;       // Target: 10.0
  navigationDiscoverabilityScore: number; // Target: 10.0
  firstRunExperienceScore: number;      // Target: 10.0
  crossDeviceUXScore: number;           // Target: 10.0
  oneClickToLiveCompliant: boolean;     // Must be true
  theatreModeVisibleCompliant: boolean; // Must be true
}
