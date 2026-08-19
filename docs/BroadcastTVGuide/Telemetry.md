# Broadcast TV Guide: Telemetry & Ingestion Diagnostics Manual

## 1. System Overview
The Broadcast TV Guide features a resilient, zero-interruption video playback pipeline coupled with a real-time, low-overhead Telemetry & Monitoring engine. It tracks proxy ingest performance, client decoder health, stream buffers, and user engagement metrics.

```
                    ┌──────────────────────────────┐
                    │      Alex Jones Hourly       │
                    │        RSS feed XML          │
                    └──────────────┬───────────────┘
                                   │
                           [Proxy Ingestion]
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      server.js / server.ts   ├──────► [Store JSON event log]
                    │      Ingestion Middleware    │
                    └──────────────┬───────────────┘
                                   │
                    (Proxy Success │ (Failover/Outage)
                    or Failover)   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      LiteApp UI Client       │
                    │      Playback Controller     │
                    └──────────────┬───────────────┘
                                   │
                    [Send Batch    │ (Playback Starts, Errors,
                    Client Events] │  Aspect/Resolution detection)
                                   ▼
                    ┌──────────────────────────────┐
                    │    POST /api/telemetry       │
                    │   Telemetry Ingestion API    │
                    └──────────────────────────────┘
```

---

## 2. Ingestion & Proxy Router
Both `server.js` (Node environment target) and `server.ts` integrate a safety proxy wrapper for `/api/ajn-archive` to intercept and analyze Alex Jones hourly show feeds:
- **Performance Logging**: Captures processing latency (`duration` in ms), count of returned items, and date classifications.
- **Failover Security**: Upon request timeouts or remote server failures, the proxy logs a `feed_fetch_failure` event with `fallbackUsed: true` and gracefully routes pre-compiled, highly resilient static backup show files. This prevents any UI blank screen.

---

## 3. Database Schema & Sliding Window Storage
All system-wide events are persisted locally using a sliding window buffer inside `telemetry_db.json`.

### 3.1 Schema Definition
Each event adheres to the following structured telemetry model:
```typescript
export interface TelemetryEvent {
  id: string;              // Unique UUID or high-entropy transaction ID
  eventType: string;       // e.g., "feed_fetch_success", "feed_fetch_failure", "playback_start", "playback_error", "playback_success"
  sessionId: string;       // Client-generated unique session ID
  timestamp: string;       // ISO 8601 Timestamp
  duration?: number;       // Elapsed time in ms (fetch network latency or buffering)
  itemCount?: number;      // Count of parsed episodes (feed specific)
  fallbackUsed?: boolean;  // Flag if backup media was automatically directed
  streamUrl?: string;      // Current streaming media target URL
  streamTitle?: string;    // Stream display title
  errorMessage?: string;   // Structured error details (Network, format, codec, decoding)
  errorCode?: number;      // Native HTML5 Video element media error code (1-4)
  resolution?: string;     // Auto-detected video bounds (e.g. 1920x1080)
  aspectRatio?: string;    // Classified aspect ratio (e.g., 16:9, 4:3)
  ipAddress?: string;      // Client remote IP
  userAgent?: string;      // Client user-agent string
}
```

### 3.2 Sliding Window Constraint
To prevent database bloating and conserve disk space under heavy polling, the telemetry storage layer enforces a strict sliding window limit:
- **Capacity limit**: **5,000 events max**.
- **Eviction strategy**: FIFO (First-In, First-Out). When the array length exceeds 5,000, oldest entries are automatically deleted on new ingestion transactions.

---

## 4. API Endpoint Matrix

### 4.1 POST `/api/telemetry`
Receives batched performance and playback status arrays from the client.
- **Payload format**: `TelemetryEvent[]` or single `TelemetryEvent`.
- **Response**: `{ success: true, count: number }`

### 4.2 GET `/api/telemetry/stats`
Compiles real-time metrics and aggregated telemetry analytics.
- **Aggregated Output includes**:
  - `totalCount`: Aggregate event volume in-buffer.
  - `feedUptimePercentage`: Success rate of proxy feed fetches.
  - `playbackUptimePercentage`: Ratio of successful full loads to error attempts.
  - `popularShows`: Sorted list of most clicked shows / hourly archives.
  - `recentEvents`: Array of the 20 most recent events.

### 4.3 POST `/api/telemetry/simulate-outage`
Enables operational testing of backup stream triggers.
- **Payload format**: `{ active: boolean }`
- **Response**: `{ success: true, isOutageSimulated: boolean }`

### 4.4 POST `/api/telemetry/clear`
Completely empties the telemetry database buffer.
- **Response**: `{ success: true }`

---

## 5. Resiliency Testing & Outage Simulation Suite
Operational readiness requires routine simulation testing of failover logic. The system provides a specialized Outage Simulation switch directly on the **Telemetry Control Center**:
1. **Enable Stress Test**: Clicking the "Simulate RSS Outage" button sends a request to the server to activate the simulated outage flag.
2. **Ingress Interception**: The `/api/ajn-archive` route intercepts this flag and immediately throws a simulated fetch error.
3. **Playout Transition**: The system transitions immediately to backup streams, logging `feed_fetch_failure` with `fallbackUsed: true` to the telemetry sliding database.
4. **Validation**: The operator checks the real-time event log to confirm the error event has been recorded and that the client video player is successfully playing backup archive files without disruption.

---

## 6. Executive PDF Report System
The companion Telemetry Dashboard features a client-side Audit Report Generator powered by `jsPDF`:
- **Lightweight compilation**: Zero server-side overhead; compiles and saves the PDF on-the-fly.
- **Professional Grid Layout**: Embeds precise lines, custom palettes, executive summaries, feed fetch success ratios, and tabular log details.
- **Auto-generated recommendations**: Dynamically assesses current system uptime and appends concrete troubleshooting or operational actions (e.g., warning operators of active stress test toggles).

---

## 7. Maintenance & Backup Upgrades

### 7.1 Updating Pre-Compiled Backup Streams
When pre-compiled static backups need to be refreshed (e.g., when newer segments become available), developers can update the `BACKUP_EPISODES` array defined at the top of:
- `/server.js` (around line 860)
- `/server.ts` (around line 1780)

Ensure backup files use reliable, high-availability public URLs like archive.org or dedicated AJN static archives.

### 7.2 Database Recovery
If `telemetry_db.json` or `telemetry_db_ts.json` becomes corrupt:
1. Delete the corrupted JSON file.
2. Hit any telemetry route or restart the server.
3. The storage module will automatically re-create the file, initialize an empty schema, and restore normal operational services.
