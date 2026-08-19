# Service Level Objectives & Performance Engineering Specification

This document establishes measurable Service Level Objectives (SLOs), strict memory runtime budgets, leak audit guardrails, and automated profiling protocols.

---

## 1. Measurable Engineering Targets (SLO Matrix)

The application is benchmarked against rigorous performance targets across all supported target hardware platforms:

| Metric Category | Target SLO | Warning Threshold | Critical Abort Threshold | Measurement Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Cold Startup Latency** | `< 2.0 seconds` | `> 2.5 seconds` | `> 4.0 seconds` | Navigation Start to DOM Interactive (`window.performance`) |
| **Warm Cache Startup** | `< 800 ms` | `> 1.2 seconds` | `> 2.0 seconds` | Page Hydration from IndexedDB Cache |
| **10k Playlist Import** | `< 2.0 seconds` | `> 3.5 seconds` | `> 6.0 seconds` | Lexer initiation to IndexedDB commit completion |
| **Layout Mode Switch** | `< 150 ms` | `> 250 ms` | `> 500 ms` | Click event to CSS layout recalculation complete |
| **Search Filter Latency** | `< 25 ms` | `> 50 ms` | `> 100 ms` | Input keystroke to virtualized list re-render |
| **Theme Switch Animation**| `< 50 ms` | `> 100 ms` | `> 200 ms` | CSS variable swap across DOM tree |
| **8-Hour Memory Growth**| `< 10% delta`| `> 20% delta` | `> 40% delta` | Continuous HLS playback JS heap delta |
| **Idle CPU Utilization** | `< 5% core` | `> 10% core` | `> 25% core` | Chrome DevTools Performance Monitor (10s idle window)|
| **Production Bundle** | `< 1.5 MB gzip` | `> 1.8 MB gzip` | `> 2.5 MB gzip` | Webpack / Vite Rollup Bundle Analyzer Report |

---

## 2. Comprehensive Memory Leak Audit & Guardrails

Streaming applications process gigabytes of binary video data per hour. Unreferenced objects cause fatal memory pressure. The codebase enforces strict lifecycle cleanup rules:

### 1. MediaSource & SourceBuffer Management
* **Risk**: Orphaned `MediaSource` instances attached to unmounted `<video>` tags prevent garbage collection of entire video segment buffers.
* **Guardrail**: On component unmount, custom hooks (`usePlayer`) explicitly call `hls.destroy()`, remove event listeners, and set `videoElement.src = ""` and `videoElement.load()`.

### 2. AudioContext & Web Audio DSP Nodes
* **Risk**: Creating new `AudioContext` instances on track change without closing previous contexts exceeds hardware audio sink limits (typically 6 concurrent contexts).
* **Guardrail**: A single global `AudioContext` singleton is maintained inside `useAudioController`. Gain nodes and AnalyserNodes are disconnected (`node.disconnect()`) prior to re-routing.

### 3. RequestAnimationFrame (RAF) & Canvas Loops
* **Risk**: Infinite RAF loops inside `AudioDashboard` visualizers continue executing in background tabs, consuming CPU cycles and battery.
* **Guardrail**: All RAF loops check document visibility (`document.hidden`). When unmounted or hidden, animation handles are explicitly canceled via `cancelAnimationFrame(rafRef.current)`.

### 4. Intervals, Timeouts & Folder Watchers
* **Risk**: Polling timers (`setInterval`) in `HeaderClock` and `FolderWatcher` continue firing after view unmounts.
* **Guardrail**: All intervals are bound to `useEffect` cleanup return functions.

### 5. Blob & Object URL Revocation
* **Risk**: `URL.createObjectURL(blob)` created during playlist export or import remains in browser memory until document unload.
* **Guardrail**: Every generated object URL is tracked and explicitly released via `URL.revokeObjectURL(url)` immediately after download initiation or image decoding.

### 6. Observers & AbortControllers
* **Risk**: `ResizeObserver` and `IntersectionObserver` instances on `TrackList` virtual tables leak DOM node references.
* **Guardrail**: Observers call `.disconnect()` on teardown. Outbound network fetch requests pass `signal: abortController.signal`, aborting dangling streams on navigation.

---

## 3. Profiling & Verification Protocols

To verify compliance with the 8-Hour Playback Memory SLO (`< 10% growth`), QA engineering executes the following automated Puppeteer profiling script:

```ts
// Automated QA Heap Profiling Gate
async function runMemoryAudit(page) {
  await page.goto("http://localhost:3000");
  await page.click("#load-default-playlist");
  await page.click(".track-play-btn");
  
  // Baseline Heap Snapshot
  const baseMetrics = await page.metrics();
  const initialHeap = baseMetrics.JSHeapUsedSize;
  
  // Simulate 8 Hours of Playback (Fast-forward simulated HLS segments)
  await simulateContinuousPlayback(page, 8 * 3600);
  
  // Final Heap Snapshot
  const finalMetrics = await page.metrics();
  const finalHeap = finalMetrics.JSHeapUsedSize;
  
  const growthPercent = ((finalHeap - initialHeap) / initialHeap) * 100;
  assert(growthPercent < 10.0, `Memory Leak Detected: Heap grew by ${growthPercent}%`);
}
```
