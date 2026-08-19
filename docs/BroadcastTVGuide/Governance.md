# Broadcast TV Guide: Governance, Automation & Certification Specification (v11.0)

## Executive Summary
As the `BroadcastTVGuide` operates as an enterprise-grade **Broadcast Automation Platform**, rigorous architectural governance invariants are required. This specification defines the formal compliance guardrails governing multi-source ingestion, metadata enrichment, rule-based playout scheduling, and provider certification.

---

## 1. Preemption Priority Hierarchy
To manage concurrent live stream debuts and breaking news interrupts deterministically across 8 heterogeneous sources, emergency preemption is strictly ordered by `PreemptionPriorityTier`:

```typescript
export type PreemptionPriorityTier = 
  | "CRITICAL_EMERGENCY_ALERT" // National EAS / Emergency Override (Highest)
  | "HIGH_BREAKING_NEWS"       // Real-time Breaking News Debuts
  | "MEDIUM_SCHEDULED_LIVE"    // Planned Sports / Premiere Livestreams
  | "LOW_NORMAL_LINEAR";       // Standard VOD Schedule Automation (Lowest)
```

### Preemption Rules
1. **Higher Preempts Lower**: An incoming event with tier $T_{\text{in}}$ immediately preempts active playback $T_{\text{curr}}$ if and only if $T_{\text{in}} > T_{\text{curr}}$.
2. **Mutual Exclusion**: Equal tier live debuts undergo deterministic arbitration based on channel priority slot weights.

---

## 2. Provider Capability Matrix
Rather than relying on brittle source-specific special cases, UI components and the `SchedulerEngine` query standardized `ProviderCapabilities`:

```typescript
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
```

---

## 3. Metadata Confidence Model
Upstream sources expose varying degrees of structured metadata. The system assigns empirical confidence scores (`0.0` to `1.0`) to dictate downstream enrichment behavior:

| Origin Source | Typical Confidence | Enrichment Mandate |
| :--- | :---: | :--- |
| **Traditional XMLTV EPG** (`xmltv_epg`) | `1.00` | None (Authoritative) |
| **IPTV M3U Feed** (`iptv_m3u`) | `0.95` | Artwork resolution & EPG matching |
| **Archive.org VOD** (`archive_org`) | `0.85` | Synopsis sanitization & duration check |
| **YouTube Channel** (`youtube_channel`) | `0.70` | Genre classification & AI transcript extraction |
| **RSS Enclosure Feed** (`rss_syndication`) | `0.60` | Thumbnail generation & title normalization |
| **Local Folder Storage** (`local_media_folder`) | `0.40` | Full 7-stage metadata synthesis |

---

## 4. Multi-Stage Enrichment Pipeline
Raw ingestion is never the final step. Un-normalized items flow through a 7-stage asynchronous Web Worker pipeline:

```
[1. INGESTION] ---> [2. NORMALIZATION] ---> [3. METADATA_ENRICHMENT]
                                                       │
                                                       ▼
[6. GENRE_CLASSIFICATION] <--- [5. TRANSCRIPT_GEN] <--- [4. ARTWORK_RESOLUTION]
           │
           ▼
[7. SCHEDULE_SYNTHESIS] ---> (Commit to Master IndexedDB GuideDay Matrix)
```

---

## 5. Rule-Based Scheduling Policies
Beyond static sequential playback, virtual broadcast channels execute declarative `BroadcastSchedulingRule` automation:
- **`sequential`**: Linear collection traversal.
- **`random` / `weighted_random`**: Shuffle playout based on popularity ratings.
- **`block_programming`**: Time-gated thematic blocks (e.g. 06:00–12:00 Kids Cartoons, 18:00–24:00 Classic Drama).
- **`genre_rotation`**: Balanced distribution across multi-genre VOD pools.
- **`no_repeat_window`**: Enforces zero repeat broadcasts within configurable windows (e.g. 48 hours).

---

## 6. Persistent Canonical Asset Identity
External URLs expire or shift across CDN nodes. The platform maintains immutable `CanonicalAssetIdentity` records:

```typescript
export interface CanonicalAssetIdentity {
  canonicalAssetId: string; // SHA-256 content hash or stable internal UUID
  providerAliases: Partial<Record<UpstreamSourceType, string>>;
  deduplicationHash: string;
  firstHarvestedAt: string;
}
```

---

## 7. Operational State Machine
The overall automation health reports through strict finite state transitions:

```
 [PROVIDER_OFFLINE] ──(connect)──> [SYNCHRONIZING] ───> [READY]
         ▲                                                │
         │ (fatal I/O)                                    │ (degraded I/O)
         │                                                ▼
   [RECOVERING] <──────(watchdog fix)─────────────── [DEGRADED]
```

---

## 8. Provider Certification Manifest & Compliance Tests
Every new provider adapter MUST pass automated CI certification asserting 100% adherence to `ProviderCertificationManifest` criteria:
1. **Normalization Strictness**: Zero leakage of raw provider SDK objects into UI components.
2. **Metadata Confidence Threshold**: Guaranteed calculation of exact millisecond durations.
3. **Error Recovery SLO**: Automatic reconnect within $<3\text{ seconds}$.
4. **Performance Under 200ms**: Search indexing and Trie synchronization compliance.
5. **DOMPurify Sanitization**: Mandatory HTML stripping on all synopsis fields.
6. **Zero Memory Leak Teardown**: Complete `dispose()` cleanup of background workers.
