# Broadcast TV Guide: Universal Source Normalization & Virtual Playout Specification (v10.5)

## Executive Summary
To elevate the `BroadcastTVGuide` from a mere static Electronic Program Guide (EPG) viewer into an enterprise-grade **Universal Playout & Broadcast Scheduler Engine**, a foundational **Normalization Layer** decouples upstream content discovery from UI rendering. 

Under this architecture, the TV Guide operates oblivious to whether media originated from traditional IPTV feeds, XMLTV files, Archive.org collections, YouTube channels, Rumble feeds, local storage directories, RSS syndication, or audio podcasts. Every heterogeneous source is converted into a standardized `NormalizedMediaAsset`, allowing the `SchedulerEngine` to synthesize continuous 24/7 virtual broadcast schedules with emergency breaking news preemption.

---

## Authoritative Pipeline Topology

```
[Any Heterogeneous Upstream Source]
                 │
                 ▼  (Raw API JSON / RSS / M3U / HTML)
┌────────────────────────────────────────────────────────┐
│ Universal Source Adapters (Web Worker Pool)            │
│  ├── Harvest: Discover Playlists, Videos & Livestreams │
│  └── Normalize: Convert to NormalizedMediaAsset        │
└──────────────────────────┬─────────────────────────────┘
                           │ (Normalized Media Assets)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Scheduler Engine (Virtual Playout Synthesizer)         │
│  ├── Synthesize 24/7 Loops (LoopMode: infinite_24_7) │
│  ├── Stitch Mixed Multi-Provider Content Pools         │
│  └── Execute Breaking News / Live Stream Preemption    │
└──────────────────────────┬─────────────────────────────┘
                           │ (Authoritative GuideDay Matrix)
                           ▼
┌────────────────────────────────────────────────────────┐
│ BroadcastTVGuide (Windowed 2D GPU Compositor)          │
└──────────────────────────┬─────────────────────────────┘
                           │ (PlayProgram Playout Command)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Universal Master Playout Engine (HLS / MP4 / iFrame)   │
└────────────────────────────────────────────────────────┘
```

---

## Heterogeneous Upstream Source Capability Matrix

| Source Category | Code Descriptor | Can Populate Channels? | Can Populate Schedule? | Normalization Strategy |
| :--- | :--- | :---: | :---: | :--- |
| **Traditional XMLTV EPG** | `xmltv_epg` | ✅ Yes | ✅ Yes | Direct deterministic parsing of `<channel>` and `<programme>` elements. |
| **IPTV M3U Playlist** | `iptv_m3u` | ✅ Yes | ⚠️ Limited | Extracts `#EXTINF` station titles/logos; maps to existing XMLTV ID or triggers VOD loop synthesis. |
| **Archive.org Collection** | `archive_org` | ✅ Yes | ⚠️ Generated | Queries Advanced Search API for collection metadata; synthesizes continuous virtual linear TV channels. |
| **YouTube Channel** | `youtube_channel` | ✅ Yes | ⚠️ Generated | Harvests channel uploads/playlists/livestreams; calculates sequential time blocks from video durations. |
| **Rumble Channel** | `rumble_channel` | ✅ Yes | ⚠️ Generated | Harvests channel VODs and active livestream status; synthesizes linear timeline. |
| **Local Media Folders** | `local_media_folder`| ✅ Yes | ⚠️ Generated | Reads HTML5 video metadata or folder manifests; builds scheduled playlist rotation. |
| **RSS Syndication** | `rss_syndication` | ✅ Yes | ⚠️ Generated | Parses enclosure tags and pubDates; schedules chronologically. |
| **Podcast Audio Feed** | `podcast_feed` | ✅ Yes | ⚠️ Generated | Parses iTunes audio duration tags; builds virtual radio broadcast channel. |

---

## Answers to Key Architectural Governance Questions

### 1. Is the TV Guide supposed to represent only live television or everything?
**Authoritative Mandate**: It represents **EVERYTHING**. Traditional linear television channels, Archive.org feature film collections, YouTube video essays, Rumble livestreams, local MP4 archives, and audio podcasts coexist seamlessly inside the unified 2D virtualized grid matrix.

### 2. Is every source converted into a "Virtual Channel"?
**Authoritative Mandate**: **YES**. Every ingested source is mapped to an immutable `GuideChannel` slot. For example:
- **Channel 101**: *Classic Westerns* (Origin: Archive.org Feature Films)
- **Channel 102**: *Global News* (Origin: Rumble & YouTube Live Feeds)
- **Channel 103**: *Local Cinema* (Origin: Local Media Folder Storage)

### 3. Should the SchedulerEngine generate missing schedules?
**Authoritative Mandate**: **YES**. When an upstream source (such as an M3U playlist or Archive.org collection) provides a list of VOD assets without linear broadcast timestamps, the `SchedulerEngine` automatically calculates sequential blocks starting from midnight UTC:
$$T_{\text{next}} = T_{\text{current}} + \text{Asset.exactDurationMs}$$

### 4. Should channels be continuous (24/7)?
**Authoritative Mandate**: Configurable per channel via `ScheduleSynthesisRule.loopMode`. The default enterprise behavior is **`infinite_24_7`**, which seamlessly wraps the playlist back to the initial asset upon reaching the end of the collection, ensuring uninterrupted 365-day broadcast automation.

### 5. Should live streams interrupt scheduled playback?
**Authoritative Mandate**: **YES**. Governed by `BreakingPreemptionPolicy`. When a monitored YouTube channel, Rumble feed, or RTMP ingress detects an active `isRealTimeLive === true` broadcast debut:
1. The `SchedulerEngine` immediately injects a high-priority emergency preemption block into the active `GuideSchedule`.
2. Master Playout auto-switches to the live transport stream.
3. Upon broadcast cessation, playout automatically falls back to the scheduled linear programming timeline.

### 6. Should one guide contain multiple providers?
**Authoritative Mandate**: **YES**. Heterogeneous providers are completely abstracted behind the `UniversalSourceAdapter` interface. The virtualized rendering engine receives only standardized `GuideProgram` contracts.

### 7. Should automation operators be able to build custom mixed channels?
**Authoritative Mandate**: **YES**. Operators utilize `CustomVirtualChannelBuilder` to author hybrid broadcast stations combining weighted pools from disparate origins (e.g., 60% Archive.org movies + 30% YouTube video essays + 10% station ID bumpers).

### 8. Should the guide regenerate automatically upon upstream mutations?
**Authoritative Mandate**: **YES**. Source adapters run background polling or webhook listeners. When a new Rumble upload or RSS enclosure is published, the background worker recalculates the affected day partition and dispatches a `ScheduleChangedEvent` over the internal event bus, updating the UI instantaneously without page reloads.

---

## Universal Source Adapter SDK Contract

```typescript
import { UpstreamSourceType, RawUpstreamAsset, NormalizedMediaAsset } from "./guideSpecification";

export interface UniversalSourceAdapter {
  readonly sourceType: UpstreamSourceType;
  readonly canPopulateChannels: boolean;
  readonly canPopulateSchedule: boolean;
  
  /** Discovers and harvests un-normalized payloads from external APIs */
  harvestAssets(sourceConfig: Record<string, string>): Promise<RawUpstreamAsset[]>;
  
  /** Transforms raw assets into strictly verified NormalizedMediaAsset invariants */
  normalize(rawAssets: RawUpstreamAsset[]): Promise<NormalizedMediaAsset[]>;
}
```
