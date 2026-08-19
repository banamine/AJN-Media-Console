# Broadcast TV Guide: Data Models Specification

## Overview
This specification details the authoritative data contracts governing channels, schedule blocks, viewport calculations, and stream metadata within the EPG subsystem.

---

## Authoritative TypeScript Interfaces

### 1. Playback Transport Descriptor (`PlaybackSourceMetadata`)
Defines the technical transmission specifications required by the Master Playout Engine.

```typescript
export interface PlaybackSourceMetadata {
  /** Upstream transmission endpoint URL */
  streamUrl: string;
  /** Transport protocol container specification */
  protocol: "hls" | "dash" | "mp4" | "rtmp" | "iframe" | "shoutcast";
  /** True if stream requires Widevine/FairPlay/PlayReady DRM negotiation */
  drmProtected?: boolean;
  /** Authorization license server proxy endpoint */
  licenseUrl?: string;
  /** Maximum encoded ceiling bitrate in kilobits per second */
  maxBitrateKbps?: number;
  /** Audio channel configuration */
  audioChannels?: "stereo" | "surround-5.1" | "atmos" | "mono";
}
```

---

### 2. Program Schedule Contract (`GuideProgram`)
Represents a single broadcast event on the timeline.

> [!IMPORTANT]
> **Audit Invariants:**
> - `duration` MUST exactly equal (`new Date(endTime).getTime() - new Date(startTime).getTime()`).
> - If `live === true`, `recordingAllowed` MUST equal `false`. Live broadcasts cannot be pre-recorded.
> - `description` MUST undergo strict `DOMPurify.sanitize()` prior to UI mounting.

```typescript
export interface GuideProgram {
  /** Unique UUID identifier across all EPG namespaces */
  id: string;
  /** Primary display title */
  title: string;
  /** Detailed HTML/Plaintext synopsis (sanitized) */
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
```

---

### 3. Channel Matrix Row Contract (`GuideChannel`)

```typescript
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
```

---

### 4. Partitioned Grid Stores (`GuideSchedule` & `GuideDay`)

```typescript
export interface GuideSchedule {
  channelId: string;
  calendarDate: string; // YYYY-MM-DD
  programs: GuideProgram[];
  lastSynced: string; // ISO 8601 UTC
}

export interface GuideDay {
  calendarDate: string;
  schedules: Record<string, GuideSchedule>; // channelId -> GuideSchedule
  totalProgramsCount: number;
}
```

---

### 5. Viewport Boundary Window (`GuideViewport`)

```typescript
export interface GuideViewport {
  startDate: string; // ISO 8601 UTC start of visible horizontal timeline
  endDate: string;   // ISO 8601 UTC end of visible horizontal timeline
  startChannelIndex: number; // Topmost visible vertical channel row index
  endChannelIndex: number;   // Bottommost visible vertical channel row index
  zoomResolutionMinutes: 15 | 30 | 60 | 120; // Time axis column width scale
}
```
