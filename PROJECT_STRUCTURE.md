# Repository Discovery & Baseline Project Structure Specification

This authoritative document defines the complete physical filesystem layout, component hierarchy, React rendering tree, hook dependency graph, and service abstraction layer for the **Universal Stream Hub & Broadcast Suite**.

---

## 1. Complete Filesystem Tree

```
/ (Workspace Root)
├── .env.example                # Required server/client environment credentials schema
├── .gitignore                  # VCS exclusion rules for build artifacts & modules
├── ARCHITECTURE_NOTES.md       # Architectural decision records (ADRs) & notes
├── README.md                   # Master engineering specification entry point
├── PROJECT_STRUCTURE.md        # Physical tree & component hierarchy blueprint
├── DEPENDENCY_GRAPH.md         # Module import topology & bundling boundaries
├── ARCHITECTURE.md             # Clean architecture, SRP, IoC & Dual Runtime design
├── STATE_MACHINE.md            # Formal playback lifecycle & transition handlers
├── DATA_FLOW.md                # Ingestion pipeline, CORS proxy & serialization flow
├── PERFORMANCE.md              # Latency SLOs, memory budget & profiling gates
├── SECURITY.md                 # DOM sanitization, CSP, regex safety & sandbox limits
├── TEST_PLAN.md                # Automated CI pipeline & Release Readiness Gate
├── AUDIT_REPORT.md             # Comprehensive memory & performance audit verification
├── ROADMAP.md                  # Enterprise release milestones & feature evolution
├── CONTRIBUTING.md             # Developer onboarding & code craftsmanship standards
├── index.html                  # Browser DOM mounting entry point
├── metadata.json               # Platform manifest & major capability declarations
├── package.json                # Project dependencies, scripts & container bindings
├── package-lock.json           # Deterministic dependency lockfile
├── server.ts                   # Express CORS reverse proxy & production static server
├── tsconfig.json               # TypeScript strict compilation ruleset
├── vite.config.ts              # Vite bundling & Tailwind plugin configuration
└── src/
    ├── main.tsx                # React DOM root hydration & Error Boundary wrapper
    ├── App.tsx                 # Master state controller & layout switcher
    ├── index.css               # Tailwind CSS imports & global theme variables
    ├── types.ts                # Global domain interfaces, enums & type contracts
    ├── test-parser.ts          # CLI validation harness for playlist lexers
    ├── assets/                 # Static graphical assets & default fallbacks
    ├── components/             # Modular UI view layers & presentation components
    │   ├── ArchiveHub.tsx               # Vault explorer & collection management view
    │   ├── ArchiveImportWidget.tsx      # Drag-and-drop playlist ingestion dropzone
    │   ├── ArchiveThumbnail.tsx         # Lazy-loaded media preview card
    │   ├── AudioDashboard.tsx           # High-fidelity audio visualizer & EQ controls
    │   ├── BatchImportWidget.tsx        # Multi-file concurrent playlist importer
    │   ├── CinephileSuite.tsx           # Cinema theater viewing interface & OSD
    │   ├── CustomMixBuilder.tsx         # Interactive playlist sequence editor
    │   ├── ErrorBoundary.tsx            # Runtime crash recovery & diagnostics UI
    │   ├── HeaderClock.tsx              # Synchronized UTC/Local broadcast chronometer
    │   ├── LazyChannelLogo.tsx          # Resilient network icon loader with fallbacks
    │   ├── LiteApp.tsx                  # Ultra-low overhead mobile/embedded interface
    │   ├── MusicLibraryView.tsx         # Hierarchical audio artist/album catalog
    │   ├── PlaylistCard.tsx             # Interactive stream card with PLS/M3U badges
    │   ├── RadioStationIcon.tsx         # Vector audio waveform badge indicator
    │   ├── SyndicateSuite.tsx           # Multi-channel IPTV grid layout controller
    │   ├── TrackList.tsx                # Virtualized playlist item rendering table
    │   ├── TrackRegistrationModal.tsx   # Manual stream URL metadata entry dialog
    │   └── YouTubeEmbed.tsx             # Sandboxed iFrame media player wrapper
    ├── hooks/                  # Encapsulated state controllers & lifecycle logic
    │   ├── useArchivePlaylistImporter.ts # PLS/M3U background file parsing hook
    │   ├── useAudioController.ts         # Web Audio API EQ & gain node manager
    │   ├── useAudioPlaylist.ts           # Sequential audio queue & shuffle controller
    │   ├── useBroadcastDay.ts            # EPG time-slot calculation hook
    │   ├── useFolderWatcher.ts           # IndexedDB directory synchronization hook
    │   ├── useMediaSession.ts            # OS-level lockscreen/hardware media binding
    │   ├── useMusicLibrary.ts            # Audio track indexing & search filtering hook
    │   ├── useMusicPlayer.ts             # Dedicated HTMLAudioElement lifecycle hook
    │   ├── useMusicPlaylists.ts          # Audio playlist persistence controller
    │   ├── usePlaybackSettings.ts        # LocalStorage user preference synchronizer
    │   ├── usePlayer.ts                  # HLS/HTMLMediaElement universal stream hook
    │   ├── usePlaylistVault.ts           # IndexedDB collection transaction hook
    │   └── useSeries.ts                  # Episodic broadcast sequence resolver
    ├── services/               # Persistent data engines & background workers
    │   ├── BroadcastDay.ts               # EPG schedule modeling engine
    │   ├── FolderWatcher.ts              # Virtual file system monitoring daemon
    │   ├── IndexedDB.ts                  # Drizzle/Native IndexedDB storage wrapper
    │   ├── PlaylistVault.ts              # Encrypted local collection storage engine
    │   └── Series.ts                     # Series grouping & metadata aggregation service
    ├── utils/                  # Pure deterministic algorithmic helper modules
    │   ├── archiveUtils.ts               # Collection export formatting & normalization
    │   ├── audioUtils.ts                 # FFT audio frequency analysis calculation
    │   ├── exportUtils.ts                # Multi-format (M3U, PLS, JSON, PLS) generator
    │   ├── playlistUtils.ts              # Linear token lexer & AST parser for M3U/PLS
    │   ├── safeStorage.ts                # Quota-checked LocalStorage wrapper
    │   ├── toast.ts                      # Non-blocking transient notification dispatcher
    │   └── urlUtils.ts                   # Stream scheme detection & CORS proxy router
    └── lib/                    # Core infrastructure utilities
        └── showDatabase.ts               # Embedded relational database query helper
```

---

## 2. Component Hierarchy & View Routing

The application utilizes a single-screen layout architecture controlled by explicit state mode switches (`mainViewerMode` and `viewMode`).

```
[ErrorBoundary]
 └── [main.tsx]
      └── [App.tsx] (Master Orchestrator)
           ├── [HeaderClock]             # Persistent Top Application Bar
           ├── Navigation Toolbar          # Mode Switch Buttons (Standard | IPTV | Grid | Audio | Lite)
           ├── Workspace Layout Container  # Dynamic Viewport Switcher
           │    ├── VIEW: "standard"
           │    │    ├── [YouTubeEmbed] / HTMLMediaElement
           │    │    └── #gold-info-bar    # OSD Context Menu & Theater Toggle
           │    ├── VIEW: "theater"
           │    │    └── Fullscreen Viewport Expansion (p-0 max-w-none)
           │    ├── VIEW: "tvexplorer"
           │    │    └── [CinephileSuite]  # Classic EPG Guide & Player
           │    ├── VIEW: "vidgrid"
           │    │    └── [SyndicateSuite]  # Concurrent Multi-Stream Mosaic
           │    ├── VIEW: "audio"
           │    │    ├── [AudioDashboard]  # Web Audio Spectrum Visualizer
           │    │    ├── [MusicLibraryView]# Catalog Browser
           │    │    └── [TrackList]       # Active Queue
           │    └── VIEW: "lite"
           │         └── [LiteApp]         # Minimalist Fallback Player
           └── Management Drawer / Modals
                ├── [ArchiveHub]           # Vault Browser
                ├── [BatchImportWidget]    # Ingestion Dropzone
                └── [TrackRegistrationModal]
```

---

## 3. Hook Dependency & Injection Graph

Hooks serve as the primary Inversion of Control (IoC) boundary, separating DOM components from raw browser APIs and storage engines.

```
+-----------------------------------------------------------------------------------+
|                                PRESENTATION LAYER                                 |
|   App.tsx  |  CinephileSuite.tsx  |  SyndicateSuite.tsx  |  AudioDashboard.tsx    |
+-----+-------------------+-------------------+-------------------+-----------------+
      |                   |                   |                   |
      v                   v                   v                   v
+-----------------------------------------------------------------------------------+
|                              CUSTOM STATE HOOK LAYER                              |
|                                                                                   |
|  [usePlayer] <─────────────── [useMediaSession]                                   |
|       │                             │                                             |
|       ├──> Manages HLS.js           └──> Binds navigator.mediaSession             |
|       └──> Binds HTMLVideoElement                                                 |
|                                                                                   |
|  [useAudioController] <────── [useMusicPlayer] <─────── [useAudioPlaylist]        |
|       │                             │                          │                  |
|       └──> Web Audio Gain/FFT       └──> HTMLAudioElement      └──> Queue State   |
|                                                                                   |
|  [useArchivePlaylistImporter] <─── [usePlaylistVault] <─── [useFolderWatcher]     |
|       │                                  │                        │               |
|       └──> Invokes playlistUtils         └──> Transaction Hook    └──> Sync Daemon|
+------------------------------------------+------------------------+---------------+
                                           |                        |
                                           v                        v
+-----------------------------------------------------------------------------------+
|                            SERVICE & PERSISTENCE LAYER                            |
|                                                                                   |
|  PlaylistVault.ts  <──────>  IndexedDB.ts  <──────>  FolderWatcher.ts             |
|  Series.ts         <──────>  BroadcastDay.ts                                      |
+-----------------------------------------------------------------------------------+
```

---

## 4. Service Abstraction Layer

All stateful storage operations and background timers are isolated inside standalone service singletons:

1. **`IndexedDB.ts`**: Implements asynchronous transactional storage for stream catalogs, EPG caches, and playback bookmarks. Guarantees atomic writes and schema versioning.
2. **`PlaylistVault.ts`**: High-level repository pattern wrapping `IndexedDB.ts`. Manages user custom mix collections, import deduplication, and export serialization.
3. **`FolderWatcher.ts`**: Background synchronization engine that checks local storage quotas and monitors external file changes.
4. **`BroadcastDay.ts` & `Series.ts`**: Time-series calculation engines responsible for mapping continuous stream URLs into structured 24-hour programming blocks.
