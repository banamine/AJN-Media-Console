# Playback Lifecycle State Machine Specification

This document establishes the formal finite state machine (FSM) governing media playback, buffering recovery heuristics, seek stabilization, and viewport expansion transitions.

---

## 1. Complete Playback State Diagram

Every media element instance strictly adheres to the following transition lifecycle. Asynchronous operations are bounded by strict timeout thresholds.

```
                      +------------------+
                      |       IDLE       |
                      +--------+---------+
                               |
                   [Load Stream Request]
                               |
                               v
                      +------------------+
                      |     LOADING      | <---+
                      +--------+---------+     |
                               |               |
                   [Manifest Demux Success]    |
                               |               |
                               v               |
                      +------------------+     | [Network Drop /
                      |    ATTACHING     |     |  Stall > 5000ms]
                      +--------+---------+     |
                               |               |
                     [SourceBuffer Open]       |
                               |               |
                               v               |
                      +------------------+     |
             +------> |    BUFFERING     | ----+
             |        +--------+---------+
             |                 |
             |       [Buffer Health >= 3s]
             |                 |
             |                 v
             |        +------------------+
             |        |      READY       |
             |        +--------+---------+
             |                 |
      [Stall Detected]         | [AutoPlay / User Play]
             |                 v
             |        +------------------+
             +------- |     PLAYING      | <---+
                      +--------+---------+     |
                               |               |
                    [User Seek / Pause]        |
                               |               |
                               v               |
                      +------------------+     | [Seek Resolved /
                      | SEEKING / PAUSED | ----+  Resume Play]
                      +--------+---------+
                               |
                        [Stream EOF]
                               |
                               v
                      +------------------+
                      |      ENDED       |
                      +--------+---------+
                               |
                      [Component Unmount]
                               |
                               v
                      +------------------+
                      |    DESTROYED     |
                      +------------------+
```

---

## 2. State Transition Handler Formal Table

| Source State | Trigger Event | Allowed Target State | Required Action & Resource Cleanup | Guard Condition | Logging Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `IDLE` | `LOAD_URL` | `LOADING` | Reset error counters; initialize URL CORS proxy resolver. | Valid URL scheme (`http`, `https`) | `INFO` |
| `LOADING` | `MANIFEST_PARSED`| `ATTACHING` | Instantiate MSE SourceBuffers; bind HTMLMediaElement. | Demuxer valid | `DEBUG` |
| `LOADING` | `ERROR_TIMEOUT` | `IDLE` / `RECOVERING`| Abort network fetch; emit toast warning; try next proxy. | Retries `< 3` | `ERROR` |
| `ATTACHING` | `BUFFER_UPDATE` | `BUFFERING` | Allocate memory ring buffer; request initial media chunks.| MSE readyState > 0| `TRACE` |
| `BUFFERING` | `CAN_PLAY` | `READY` | Clear buffering spinner UI; evaluate autoplay permissions. | Buffer `>= 3.0s` | `INFO` |
| `READY` | `PLAY_COMMAND` | `PLAYING` | Invoke `video.play()`; start RAF spectrum visualizer loop. | User gesture or unmuted | `INFO` |
| `PLAYING` | `STALL_DETECTED`| `BUFFERING` | Pause rendering clock; retain current video frame. | Network throughput drop | `WARNING` |
| `PLAYING` | `SEEK_COMMAND` | `SEEKING` | Flush SourceBuffer ahead of playhead; request new range.| Valid duration | `DEBUG` |
| `SEEKING` | `SEEK_COMPLETE` | `PLAYING` | Re-align audio sync clock; resume normal playback. | Buffer refilled | `DEBUG` |
| `PLAYING` | `PAUSE_COMMAND` | `PAUSE` | Halt audio context progression; freeze canvas visualizer.| None | `INFO` |
| `ANY` | `UNMOUNT` | `DESTROYED` | **CRITICAL CLEANUP**: Terminate Web Workers, cancel RAF loops, revoke object URLs, detach HLS. | Immediate execution | `DEBUG` |

---

## 3. Error Recovery & Buffer Stall Heuristics

When a network anomaly interrupts streaming, the engine executes automated self-healing protocols without user intervention:

### Level 1: Transient Buffer Starvation (Stall `< 3000ms`)
* **Symptom**: Playhead reaches end of buffered range.
* **Action**: Transition `PLAYING -> BUFFERING`. Retain existing TCP connection. Increase requested HLS chunk prefetch window from 3 segments to 6 segments.

### Level 2: Manifest Demux Abort / HTTP 403 Forbidden
* **Symptom**: CDN rejects direct browser request due to missing referer or CORS headers.
* **Action**: Intercept `HLS.Events.ERROR` (Fatal Network Error). Automatically rewrite stream URL through internal Express CORS relay: `https://<APP_HOST>/api/proxy?url=<ENCODED_RAW_URL>`. Reload demuxer.

### Level 3: Unrecoverable Media Decoder Crash (Retries `>= 3`)
* **Symptom**: Hardware video decoder rejects malformed HLS AVC segment.
* **Action**: Destroy MSE HLS demuxer completely. Fallback to direct `<video src="...">` native HTML5 playback or notify user via non-blocking diagnostic toast.

---

## 4. Viewport Expansion Animation Transitions

When the user clicks the **Theater Mode** toggle button on `#gold-info-bar`, layout state transitions are synchronized with CSS transitions to avoid frame stutter:

```ts
// App.tsx State Switch Transition
const toggleTheaterMode = () => {
  setViewMode((prev) => (prev === "theater" ? "standard" : "theater"));
};
```

* **Standard Viewport**: Container constrained to `max-w-5xl aspect-video rounded-[32px] p-8`.
* **Theater Viewport**: Viewport expands seamlessly to full container dimensions `max-w-none h-full rounded-none aspect-auto border-0 p-0` utilizing hardware-accelerated CSS classes (`transition-all duration-500 ease-in-out`).
