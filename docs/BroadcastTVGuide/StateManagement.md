# Broadcast TV Guide: State Management Specification

## Overview
The EPG subsystem relies on an Observable Event-Driven state architecture that separates immutable cached schedule stores from volatile user interaction states.

---

## State Partitioning

### 1. Durable Domain State (IndexedDB + In-Memory Store)
Contains authoritative program metadata ingested from upstream providers.
- **Storage**: In-memory Map (`channelId -> GuideSchedule`) backed by IndexedDB persistence.
- **Mutability**: Strictly immutable. Upstream sync operations replace entire day partitions.

### 2. Transient UI State (React Local State / Ref)
Contains high-frequency operator interaction data that must never trigger heavy store re-renders.
- Hovered program IDs.
- Active drag-to-schedule coordinates.
- Transient tooltip positions.
- Immediate scroll coordinates.

---

## Event Bus & Subscriber System (`GuideSystemEvent`)

All cross-module mutations propagate through strongly typed system events.

```typescript
export interface GuideLoadedEvent {
  type: "GuideLoaded";
  timestamp: string;
  totalChannels: number;
  totalPrograms: number;
  cacheHit: boolean;
}

export interface GuideRefreshStartedEvent {
  type: "GuideRefreshStarted";
  timestamp: string;
  trigger: "manual" | "ttl-expired" | "websocket-push";
}

export interface GuideRefreshCompletedEvent {
  type: "GuideRefreshCompleted";
  timestamp: string;
  durationMs: number;
  updatedProgramsCount: number;
}

export interface GuideErrorEvent {
  type: "GuideError";
  timestamp: string;
  code: "PROVIDER_TIMEOUT" | "MALFORMED_XMLTV" | "IDB_QUOTA_EXCEEDED" | "WORKER_CRASH";
  message: string;
  recoverable: boolean;
}

export interface ProgramSelectedEvent {
  type: "ProgramSelected";
  timestamp: string;
  program: GuideProgram;
  channel: GuideChannel;
}

export interface ProgramPlayingEvent {
  type: "ProgramPlaying";
  timestamp: string;
  programId: string;
  channelId: string;
  playbackSource: PlaybackSourceMetadata;
}

export interface ScheduleChangedEvent {
  type: "ScheduleChanged";
  timestamp: string;
  channelId: string;
  calendarDate: string;
  newPrograms: GuideProgram[];
}

export interface ViewportChangedEvent {
  type: "ViewportChanged";
  timestamp: string;
  viewport: GuideViewport;
}

export interface FilterChangedEvent {
  type: "FilterChanged";
  timestamp: string;
  activeFilters: GuideFilters;
}

export interface SearchCompletedEvent {
  type: "SearchCompleted";
  timestamp: string;
  query: string;
  resultsCount: number;
  latencyMs: number;
}

export type GuideSystemEvent = 
  | GuideLoadedEvent
  | GuideRefreshStartedEvent
  | GuideRefreshCompletedEvent
  | GuideErrorEvent
  | ProgramSelectedEvent
  | ProgramPlayingEvent
  | ScheduleChangedEvent
  | ViewportChangedEvent
  | FilterChangedEvent
  | SearchCompletedEvent;

export interface GuideEventSubscriber {
  onEvent(event: GuideSystemEvent): void;
}
```

---

## Synchronization Sequence

```
[Upstream Provider Push / Polling]
               │
               ▼
[Web Worker: SAX Parse & Normalize]
               │
               ▼
[Master Store: Update GuideDay Partition]
               │
               ├──────────────────────────────────┐
               ▼                                  ▼
[Dispatch: ScheduleChangedEvent]     [Async IndexedDB Write]
               │
               ▼
[Subscribers: Rerender Virtual Rows]
```
