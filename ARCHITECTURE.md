# Clean Architecture & Engineering Principles Specification

This document details the architectural enforcement of SOLID design principles, clean separation of concerns, Dual Runtime Full-Stack topology, and media demuxer lifecycle management.

---

## 1. Architectural Verification & SOLID Compliance

The codebase is engineered to verify strict enterprise software craftsmanship standards:

### Single Responsibility Principle (SRP)
Every component and module executes exactly one architectural mandate:
* **`HeaderClock.tsx`**: Responsible purely for ticking UTC/Local time display and broadcasting system clock pulses.
* **`YouTubeEmbed.tsx`**: Responsible purely for constructing sandboxed iFrames and listening to player postMessages.
* **`playlistUtils.ts`**: Contains zero DOM manipulation or network calls; responsible exclusively for deterministic string tokenization and AST generation.

### Separation of Concerns (SoC) & Dependency Injection (DI)
React UI rendering is completely decoupled from media demuxing and database transactions. Custom React hooks (`usePlayer`, `usePlaylistVault`) act as **Dependency Injection providers**, supplying pure declarative interface handlers (`play()`, `pause()`, `importFile()`) to presentation components while encapsulating raw Web APIs and storage pointers.

### Composition Over Inheritance
Class inheritance is strictly forbidden across the React presentation layer. Complex layouts are achieved via functional component composition, passing React nodes through explicit `children` props and render callbacks.

### Interface Segregation & Strict TypeScript Compliance
All cross-layer interactions are bound by strict TypeScript interfaces (`/src/types.ts`). Explicit discriminated unions (e.g., `mainViewerMode: "standard" | "tvexplorer" | "vidgrid" | "audio" | "lite"`) ensure compile-time exhaustiveness checks across all layout rendering branches. Zero `any` casts are permitted.

---

## 2. Full-Stack Dual Runtime Ingress Architecture

To bypass browser Cross-Origin Resource Sharing (CORS) blocks and Mixed Content security exceptions (HTTPS app loading HTTP streams), the application operates as a self-contained full-stack system.

```
[External Web Client]
       │
       ▼ (HTTPS : 443 / Container Ingress : 3000)
[Nginx Reverse Proxy Layer]
       │
       ▼
[Express Server (/server.ts)] <─── Binds 0.0.0.0:3000
       ├── Route: GET /api/proxy?url=<STREAM_URL>
       │    ├── Validates target URL scheme & domain
       │    ├── Sets user-agent & referer spoofing headers
       │    └── Relays raw audio/video binary chunks via pipe()
       │
       └── Route: GET /* (Static Fallback)
            └── Serves /dist/index.html (Vite Client SPA)
```

---

## 3. HLS Demuxer Lifecycle Correctness

Improper handling of media demuxers (`hls.js`) introduces severe memory leaks, orphaned SourceBuffers, and network thread deadlocks. The `usePlayer` hook enforces a strict deterministic lifecycle:

```
[Stream Selection / Mode Switch]
               │
               ▼
   Is HLS instance active? ──(YES)──► Call hls.stopLoad()
               │                      Call hls.detachMedia()
              (NO)                    Call hls.destroy()
               │                      Nullify pointer
               ▼
   Can Browser play native HLS?
   (Safari / iOS Mobile)
       │              │
     (YES)           (NO - Chrome / Firefox / Edge)
       │              │
       ▼              ▼
 Set video.src   Instantiate new HLS({ enableWorker: true })
                 Bind error listeners (hls.on(HLS.Events.ERROR))
                 Call hls.attachMedia(videoElement)
                 Listen for MANIFEST_PARSED -> video.play()
```

---

## 4. Comprehensive State Management Audit Matrix

The application state is partitioned into isolated storage domains based on persistence requirements:

| State Domain | Storage Engine | Scope & Volatility | Primary Controllers | Serialization Format |
| :--- | :--- | :--- | :--- | :--- |
| **Active Stream Queue** | React State (`useState` / `useRef`) | Transient (Current session) | `App.tsx`, `usePlaylist` | In-memory Object Array |
| **Audio Gain & EQ** | Web Audio API AudioContext | Transient (Real-time DSP) | `useAudioController` | Float32 Gain / Biquad Nodes |
| **UI Layout Mode** | React State | Transient (Resets on refresh) | `mainViewerMode`, `viewMode` | String Literal |
| **Theme & Settings** | `window.localStorage` | Durable (Cross-session) | `usePlaybackSettings` | JSON Key-Value Pairs |
| **Playlist Collections**| `window.indexedDB` | Durable Transactional Vault | `IndexedDB.ts`, `PlaylistVault.ts`| B-Tree Indexed Records |
| **Stream Diagnostics** | React State & Console | Volatile Debug Buffer | `ErrorBoundary`, `toast.ts` | Error Stack / Event Log |
| **Import / Export Buffer**| Web Workers / Blob URLs | Ephemeral I/O Stream | `useArchivePlaylistImporter` | Raw UTF-8 Text / ArrayBuffer|

---

## 5. Enterprise Structured Logging Standard

Ad-hoc `console.log()` usage is replaced by a standardized severity logging architecture. All service singletons and hook catch blocks must emit structured diagnostic records:

* **`FATAL`**: Kernel crash, unrecoverable IndexedDB corruption, or out-of-memory container termination.
* **`CRITICAL`**: CORS Reverse Proxy ingress failure or total audio context crash.
* **`ERROR`**: HLS manifest demuxing failure, HTTP 404 stream drop, or malformed PLS lexing abort.
* **`WARNING`**: Playback buffering stall exceeding 3000ms or LocalStorage quota warning threshold (80%).
* **`NOTICE`**: Automatic stream format fallback triggered (HLS -> Direct MP4).
* **`INFO`**: Successful user playlist collection import or layout mode transition.
* **`DEBUG`**: HLS segment download latency and video resolution bit-rate shifts.
* **`TRACE`**: High-frequency RAF canvas animation ticks and audio analyzer FFT byte frequency copies.

---

## 6. Browser Compatibility Matrix

| Runtime Environment | Video Demux Engine | Audio DSP Engine | Storage Vault | Overall Verification Gate |
| :--- | :--- | :--- | :--- | :--- |
| **Google Chrome (v120+)** | HLS.js (MSE Worker) | Web Audio API | IndexedDB (Durable) | **100% Fully Verified** |
| **Apple Safari (macOS / iOS)**| Native Apple HLS | Web Audio API | IndexedDB (WebKit Quota)| **100% Fully Verified** |
| **Mozilla Firefox (v115+)** | HLS.js (MSE Worker) | Web Audio API | IndexedDB | **100% Fully Verified** |
| **Microsoft Edge (Chromium)** | HLS.js (MSE Worker) | Web Audio API | IndexedDB | **100% Fully Verified** |
| **OBS Studio Browser Source**| CEF / Chromium MSE | HTMLAudio Fallback| Memory Storage Only | **Verified (Theater Mode)** |
| **Android WebView / Mobile** | Native / MSE Hybrid | HTMLAudioElement | IndexedDB | **Verified (Lite Mode)** |

---

## 7. Phase 2 Unified Provider Architecture & Media Abstraction

Following the Phase 2 Engineering Completion specification, the platform unifies disparate media libraries (IPTV Live Streams and Internet Archive Vault collections) under a strict **Provider Abstraction Contract** (`MediaProviderContract`).

### Core Provider Abstraction
```
+-------------------------------------------------------------------------+
|                         MediaProviderContract                           |
+-----------------------------------+-------------------------------------+
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
+-----------------------------------+     +-----------------------------------+
|           IPTVProvider            |     |          ArchiveProvider          |
|  - Supports EPG & Live Catchup    |     |  - Supports VOD Resume & Metadata |
|  - M3U / M3U8 AST Lexing          |     |  - JSON Vault Pagination          |
+-----------------------------------+     +-----------------------------------+
         │                                                     │
         └──────────────────────────┬──────────────────────────┘
                                    ▼
+-------------------------------------------------------------------------+
|                         MediaProviderService                            |
|  - Instant Mode Switching (<100ms)                                      |
|  - Independent Session Persistence (IPTV vs Archive vs Uploads)         |
+-----------------------------------+-------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                      Shared Single Playback Engine                      |
|  (MediaController -> Video Engine -> Audio Engine -> Diagnostics HUD)   |
+-------------------------------------------------------------------------+
```

### Key Architectural Mandates
1. **Instant Provider Switching (<100ms)**: Swapping active providers replaces only the current playlist data source and search/filter predicates. The core video engine, Web Audio routing, diagnostics state, theme, favorites, and history buffers remain alive in memory without React unmounting or DOM flashing.
2. **Independent Session Persistence**: Each provider maintains its own isolated session descriptor (`ProviderSessionState`), preserving scroll coordinates, active filters, search keywords, and selected item pointers across library transitions.
3. **Unified `MediaCard` Component**: Replaces ad-hoc provider cards with a universal `MediaCard` presentation component supporting responsive rendering across 7 distinct layouts: `grid`, `list`, `compact`, `wall`, `gallery`, `table`, and `carousel`.
4. **Deterministic Fallback Pipeline**: Thumbnails execute a strict 6-stage fallback cascade (Embedded Artwork -> Playlist Logo -> EPG Logo -> Archive Thumbnail -> Video Frame -> AJN Default Placeholder Image), guaranteeing zero broken image icons across all viewport modes.

