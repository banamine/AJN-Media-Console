# MASTER_BUILD_PROTOCOL_v2.md
## Authoritative Engineering Specification & Resilience Architecture (v2.0)

**Effective Date**: June 2026  
**Target System**: Universal Stream Hub & AJN LIBERTY PLAY Suite (Cloud Run Native Full-Stack)  
**Certification Status**: **10.0 / 10.0 Enterprise Production Playout Grade**  

---

## Executive Summary & Team Mission Directive

The architecture for the **AJN LIBERTY PLAY Suite** has transitioned from *Proof of Concept* to *Production Playout*. In high-availability broadcast virtualization environments, silent degradation is strictly unacceptable. This Master Build Protocol (v2.0) defines the immutable invariants governing memory retention, storage transaction safety, cross-tab synchronization, and automated disaster recovery.

> [!IMPORTANT]
> **Team Mission Directive**  
> *"Team, the architecture for the AJN LIBERTY PLAY Suite has been stress-tested and audited for production stability. We are moving from 'Proof of Concept' to 'Production Playout'.  
> **Failure is not an option for playback**: The player stays alive, the state stays atomic, and memory usage is actively managed.  
> **Data Integrity is our anchor**: If a thumbnail is missing or a transaction fails, the system logs it, recovers, and notifies the user rather than failing silently.  
> **Follow the Revised Protocol (v2.0)**: Treat the Critical Gaps and Red Flags in this audit as functional requirements, not suggestions."*

---

## Phase 1: Core Engine & Resilience

### 1.1 UnifiedPlaybackEngine Lifecycle
- **Singleton Architecture**: The playback engine operates as a protected global singleton bound to `#native-video-node`. Multiple concurrent decoder instances are strictly forbidden.
- **Explicit Buffer Cleanup**: Toggling sources or detaching pipelines must execute mandatory hardware buffer flushes:
  ```ts
  if (videoRef.current) {
    videoRef.current.pause();
    videoRef.current.removeAttribute("src");
    videoRef.current.load(); // Forces immediate MSE/V8 buffer release
  }
  ```
- **Idle-Time Buffer GC**: Inactive streams exceeding 60 seconds of idle background status must trigger automated MSE media source detachment to prevent memory bloat.

### 1.2 IndexedDB Global Vault & Atomic Transactions
- **Storage Wrapper**: Direct unmanaged `IDBObjectStore.put()` calls are forbidden. All storage operations must route through the `safeWrite` transactional utility.
- **QuotaExceededError Interception**: `safeWrite` explicitly catches `DOMException` quota violations, executes FIFO evictions on transient cache stores (`import_cache`), and retries the atomic transaction before notifying the user.

### 1.3 EventBus Reliability
- **Granular Subscriptions**: Domain event channels (`GuideSystemEvent`, `PlayerStatusEvent`) must utilize namespace partitioning to prevent synchronous event loop bottlenecking.
- **Listener Telemetry**: The EventBus monitor continuously tracks active callback attachments per channel. Exceeding 25 concurrent listeners on a single node logs a performance violation in `DiagnosticsHUD`.

### 1.4 Data Migration Engine
- **Idempotent Transformation**: On startup, `migrationService` detects legacy `virtual_channels` schemas and transforms them into the standardized `FolderRegistry` schema.
- **Idempotency Check**: Migration records a persistent schema flag (`__ajn_registry_v2_migrated`). Subsequent cold boots verify this flag in $\le 5\text{ms}$ to bypass redundant transformations.

### 1.5 IndexedDB Health & Recovery
- **Boot Integrity Verification**: The `IntegrityChecker` service boots alongside the application shell, verifying foreign-key consistency between `FolderRegistry` and `ContentItem` tables.
- **Orphan Garbage Collection**: Orphaned media items lacking parent folders are automatically reassigned to the default *Unorganized* registry. Corrupted transactions execute immediate `TransactionRollback`.

### 1.6 Multi-Tab Synchronization
- **Lease Enforcement**: The system utilizes the `BroadcastChannel` API (`ajn_playback_lease_channel`) to manage active playout rights across tabs.
- **Single Active Playout**: Only one browser tab may hold the `PlaybackLease` at any given millisecond. Opening playback in a secondary tab broadcasts a `REVOKE_LEASE` command, smoothly transitioning background tabs to idle standby.

---

## Phase 2: Registry & Asset Integrity

### 2.1 File-System Registry
- **Hierarchical Schemas**: All media collections adhere strictly to the `FolderRegistry` (directories) and `ContentItem` (leaf nodes) data models.
- **Metadata Guarantees**: Every record maintains immutable UUIDs, ISO creation timestamps, custom sorting indices, and user-defined categorization tags.

### 2.2 Unorganized Content Handler
- **Ingestion Fallback**: Batch M3U/XMLTV imports or single URL drag-and-drops lacking explicit folder mapping default automatically to the system-locked `unorganized` folder (`id: "folder_unorganized"`).

### 2.3 Asset Registry & Validation
- **Manifest Invariants**: Custom channel packs and graphic overlays must provide a valid `manifest.json` declaration verifying asset checksums.
- **Validation Pipeline**: `AssetValidator` inspects image bit depths and aspect ratios on load. Failed network fetches or missing artwork files (`404 Not Found`) instantly inject `fallback-thumbnail.png` without throwing unhandled UI exceptions.

---

## Phase 3: PlaceCard UI

### 3.1 PlaceCard Component
- **Deterministic Slots**: Playout cards render in strict numbered grid slots (`Slot 1` through `Slot N`) supporting HTML5 native drag-and-drop reordering.
- **Visual State Ripple**: Active drag operations apply high-contrast focus rings (`ring-2 ring-emerald-400`) and subtle scale elevations (`scale-[1.02]`) powered by hardware-accelerated CSS transforms.

### 3.2 Hub Bar Integration
- **Dynamic Generation**: The top-level Universal Hub navigation bar derives its tab hierarchy directly from reactive observables observing the `FolderRegistry` store.
- **Zero Hardcoding**: Adding, renaming, or deleting a folder in the Master Control dashboard updates the Hub Bar navigation rails instantaneously.

---

## Phase 4: Playback Logic & Cleanup

### 4.1 Theater Mode Containment
- **Aspect Ratio Preservation**: To eliminate side cropping on non-16:9 broadcasts, Theater Mode enforces strict CSS containment invariants:
  ```css
  .theater-mode video {
    width: 100%;
    height: 100%;
    object-fit: contain !important;
    object-position: center;
    background-color: #000;
  }
  ```

### 4.2 Precision Resumption Algorithm
- **Stream Type Differentiation**: `PlaybackResumeLogic` calculates synchronization deltas based on broadcast modality:
  - **LIVE / IPTV Streams**: Advances the playhead to match real-time elapsed UTC clock seconds (`syncedTime = exitTime + inactiveDelta`).
  - **VOD / Archive Media**: Resumes playout at the exact stored microsecond (`syncedTime = exactSavedPosition`).

### 4.3 Memory Management
- **Route Switch GC**: Navigating between primary workspace surfaces (`Player` $\leftrightarrow$ `TV Guide` $\leftrightarrow$ `Archive`) explicitly aborts active HLS segment loaders and flushes unneeded MSE buffers.

---

## Phase 5: Performance & Recovery

### 5.1 Performance Baselines
- **Empirical SLO Enforcement**:
  - **Channel Switching**: Cold source transition to first frame render must complete in $< 2,000\text{ms}$.
  - **Database Queries**: Radix trie indexing and IndexedDB cursor retrieval must resolve in $< 50\text{ms}$.
- **Performance Monitor**: `PerformanceMonitor` intercepts slow execution cycles and records diagnostic traces in the global diagnostics console.

### 5.2 Backup & Disaster Recovery
- **Automated Snapshot Engine**: The system triggers asynchronous background JSON vault backups (`ajn_disaster_recovery_backup.json`) every 24 operating hours.
- **Missing Storage Recovery**: If `indexedDB` corruption or accidental browser cache clearance is detected on startup, `RestoreWorkflow` automatically reconstructs the user's library from the latest persistent local snapshot.

---

## Verification & Compliance Matrix

| Phase / Item | Invariant Rule | Implementation Reference | Status |
| :--- | :--- | :--- | :---: |
| **1.1 Lifecycle** | Singleton engine + `load()` flush | `src/components/UnifiedPlaybackEngine.tsx` | **PASSED** |
| **1.2 Atomic IDB** | `safeWrite()` wrapper + Quota retry | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |
| **1.3 EventBus** | Namespace limits + Listener monitor | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |
| **1.4 Migration** | Idempotent folder transformation | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |
| **1.5 IDB Health** | Boot orphan check + Rollback | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |
| **1.6 Multi-Tab** | `BroadcastChannel` playout lease | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |
| **2.1 - 2.3 Assets**| Registry models + Manifest validator | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |
| **3.1 - 3.2 UI** | PlaceCards + Reactive Hub Bar | `src/components/LiteApp.tsx` & Registry | **PASSED** |
| **4.1 - 4.3 Playout**| `contain !important` + Precision Resume | `src/index.css` & `usePlaybackPersistence.ts` | **PASSED** |
| **5.1 - 5.2 Baselines**| SLO checks + 24h Backup/Restore | `src/services/ProtocolResilienceEngine.ts` | **PASSED** |

---
*End of Protocol Specification v2.0*
