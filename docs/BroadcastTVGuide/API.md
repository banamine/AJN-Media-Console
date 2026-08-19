# Broadcast TV Guide: Public API Specification

## Overview
The `BroadcastTVGuideAPI` defines the formal TypeScript public contract exposed by the Electronic Program Guide (EPG) subsystem. All interactions from Master Control dashboards, automated schedulers, and third-party plugins MUST negotiate state strictly through this interface.

---

## Authoritative Contract: `BroadcastTVGuideAPI`

```typescript
import { GuideViewport, GuideProgram } from "./guideSpecification";

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
  /**
   * Initializes database stores, worker pools, and loads initial grid state.
   */
  loadGuide(): Promise<void>;

  /**
   * Forces synchronous upstream re-ingestion from all registered providers.
   * @param forceClearCache If true, bypasses IndexedDB TTL and purges local caches.
   */
  refreshGuide(forceClearCache?: boolean): Promise<void>;

  /**
   * Smoothly animates virtual grid horizontal scrollbar to current system UTC time.
   */
  goToNow(): void;

  /**
   * Navigates horizontal timeline to midnight UTC of specified target calendar date.
   */
  goToDate(date: Date): void;

  /**
   * Updates visible viewport boundaries and triggers overscan pre-rendering.
   */
  setViewport(viewport: GuideViewport): void;

  /**
   * Smoothly scrolls vertical container to center target channel ID.
   */
  scrollToChannel(channelId: string): void;

  /**
   * Executes sub-200ms hybrid Trie/Fuzzy index query returning matching programs.
   */
  search(query: string, filters?: SearchFilters): Promise<GuideProgram[]>;

  /**
   * Applies live state filtering across genre rails, provider tags, and parental ratings.
   */
  filter(filters: GuideFilters): void;

  /**
   * Highlights target program block and dispatches selection telemetry.
   */
  selectProgram(programId: string): void;

  /**
   * Immediately engages Master Control Playout engine for target program stream.
   */
  playProgram(programId: string): void;

  /**
   * Tears down workers, aborts active network requests, and cleans up DOM observers.
   */
  dispose(): void;
}
```

---

## Usage Guidelines & Invariants

1. **Deterministic Initialization**: Calling `loadGuide()` multiple times is idempotent. If the guide is already loaded, it immediately resolves.
2. **Playout Interception**: Calling `playProgram(id)` automatically coordinates with the `ChannelManager` and dispatches a `ProgramPlaying` telemetry event.
3. **Memory Lifecycle**: When unmounting or switching operator consoles, calling `dispose()` is strictly mandatory to prevent background worker leakages.
