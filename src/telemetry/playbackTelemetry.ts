import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type TelemetryCategory = 'SOURCE_RESOLUTION' | 'PLAYER_LIFECYCLE' | 'USER_ACTION' | 'CROSS_CHECK';

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  emittedBy: string;
  category: TelemetryCategory;
  type: string;
  payload: any;
  correlationId?: string;
}

interface TelemetryDB extends DBSchema {
  events: {
    key: string;
    value: TelemetryEvent;
    indexes: { 'by-timestamp': number };
  };
}

class PlaybackTelemetry {
  private buffer: TelemetryEvent[] = [];
  private readonly BUFFER_SIZE = 500;
  private dbPromise: Promise<IDBPDatabase<TelemetryDB>> | null = null;
  private flushInterval: any;
  private sessionId: string;

  // State for cross-checks
  private activeStreams: Map<string, { correlationId: string; timestamp: number; url: string; label?: string }> = new Map();

  constructor() {
    this.sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);
    this.initDB();
    this.startFlushInterval();
  }

  private async initDB() {
    if (typeof window !== 'undefined') {
      try {
        this.dbPromise = openDB<TelemetryDB>('playback-telemetry-db', 1, {
          upgrade(db) {
            const store = db.createObjectStore('events', { keyPath: 'id' });
            store.createIndex('by-timestamp', 'timestamp');
          },
        });
      } catch (e) {
        console.error("Failed to initialize telemetry DB", e);
      }
    }
  }

  private startFlushInterval() {
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), 10000); // Flush every 10 seconds
    }
  }

  public trackEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp' | 'sessionId'>) {
    const fullEvent: TelemetryEvent = {
      ...event,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.runCrossChecks(fullEvent);

    this.buffer.push(fullEvent);
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush();
    }
    
    // In development mode, you might want to log to console
    if (process.env.NODE_ENV === 'development') {
        // console.log(`[Telemetry] ${fullEvent.category}:${fullEvent.type}`, fullEvent);
    }
  }

  private runCrossChecks(event: TelemetryEvent) {
    if (event.category === 'PLAYER_LIFECYCLE' && event.type === 'url_resolved') {
      const payload = event.payload;
      const ingestMetadata = payload?.ingest_metadata;
      if (ingestMetadata && payload?.finalUrl) {
         // store ingest metadata to cross-check later
         const streamMeta = this.activeStreams.get(payload.finalUrl) || { correlationId: event.correlationId || '', timestamp: event.timestamp, url: payload.finalUrl, label: ingestMetadata.title || ingestMetadata.channel };
         streamMeta.label = ingestMetadata.title || ingestMetadata.channel;
         this.activeStreams.set(payload.finalUrl, streamMeta);
      }
    }

    // Cross-check: duplicate attach
    if (event.category === 'PLAYER_LIFECYCLE' && event.type === 'hls_attach') {
      const url = event.payload?.url;
      if (url) {
        if (this.activeStreams.has(url)) {
          const prev = this.activeStreams.get(url);
          if (prev?.correlationId && prev.correlationId !== event.correlationId) {
             this.trackEvent({
               emittedBy: 'TelemetryBus',
               category: 'CROSS_CHECK',
               type: 'duplicate_attach_detected',
               payload: {
                 url,
                 previousCorrelationId: prev.correlationId,
                 newCorrelationId: event.correlationId,
               },
             });
          }
        }
        const existing = this.activeStreams.get(url);
        this.activeStreams.set(url, { correlationId: event.correlationId || '', timestamp: event.timestamp, url, label: existing?.label });
      }
    }
    
    // Cross-check: label url mismatch
    if (event.category === 'PLAYER_LIFECYCLE' && (event.type === 'hls_manifest_parsed' || event.type === 'native_load')) {
       const url = event.payload?.url;
       if (url) {
          const streamMeta = this.activeStreams.get(url);
          if (streamMeta && streamMeta.label) {
             // In a real scenario we'd extract the title from manifest ID3 or native metadata.
             // Here we simulate a mismatch if the URL clearly implies a different channel than the label
             const urlLower = url.toLowerCase();
             const labelLower = streamMeta.label.toLowerCase();
             
             let detectedChannel = "";
             if (urlLower.includes("fox")) detectedChannel = "fox";
             if (urlLower.includes("cnn")) detectedChannel = "cnn";
             if (urlLower.includes("bbc")) detectedChannel = "bbc";
             if (urlLower.includes("newsmax")) detectedChannel = "newsmax";
             if (urlLower.includes("aj") || urlLower.includes("infowars") || urlLower.includes("banned")) detectedChannel = "infowars";
             
             if (detectedChannel && !labelLower.includes(detectedChannel)) {
                if (!(streamMeta as any).mismatchFired) {
                   (streamMeta as any).mismatchFired = true;
                   this.trackEvent({
                     emittedBy: 'TelemetryBus',
                     category: 'CROSS_CHECK',
                     type: 'label_url_mismatch',
                     payload: {
                       expectedLabel: streamMeta.label,
                       detectedChannel: detectedChannel,
                       url: url
                     },
                   });
                }
             }
          }
       }
    }

    if (event.category === 'PLAYER_LIFECYCLE' && event.type === 'hls_detach') {
      const url = event.payload?.url;
      if (url) {
        this.activeStreams.delete(url);
      }
    }
    
    if (event.category === 'CROSS_CHECK') {
      console.warn(`[TELEMETRY CROSS CHECK VIOLATION] ${event.type}`, event);
    }
  }

  public async flush() {
    if (this.buffer.length === 0 || !this.dbPromise) return;

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      const db = await this.dbPromise;
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      for (const event of eventsToFlush) {
        await store.put(event);
      }
      await tx.done;

      // Keep only last 5000 events to prevent db growing too large
      await this.enforceDbLimit();
    } catch (e) {
      console.error('Failed to flush telemetry events', e);
      // Put them back in the buffer if flush failed, but keep buffer size bounded
      this.buffer = [...eventsToFlush, ...this.buffer].slice(-this.BUFFER_SIZE);
    }
  }

  private async enforceDbLimit() {
    if (!this.dbPromise) return;
    const LIMIT = 5000;
    try {
        const db = await this.dbPromise;
        const count = await db.count('events');
        if (count > LIMIT) {
            const tx = db.transaction('events', 'readwrite');
            const index = tx.store.index('by-timestamp');
            let cursor = await index.openCursor();
            let toDelete = count - LIMIT;
            
            while (cursor && toDelete > 0) {
                await cursor.delete();
                cursor = await cursor.continue();
                toDelete--;
            }
            await tx.done;
        }
    } catch (e) {
        console.error('Failed to enforce db limit', e);
    }
  }

  public async getHistory(): Promise<TelemetryEvent[]> {
    await this.flush();
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    return db.getAllFromIndex('events', 'by-timestamp');
  }

  public async clearHistory(): Promise<void> {
    this.buffer = [];
    this.activeStreams.clear();
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    const tx = db.transaction('events', 'readwrite');
    await tx.objectStore('events').clear();
    await tx.done;
  }
}

export const telemetry = new PlaybackTelemetry();

// Helpers
export function traceSourceStep(correlationId: string, payload: any, emittedBy: string = 'unknown') {
  telemetry.trackEvent({
    correlationId,
    emittedBy,
    category: 'SOURCE_RESOLUTION',
    type: payload.step,
    payload,
  });
}

export function logUserAction(action: string, payload: any, emittedBy: string = 'unknown', correlationId?: string) {
  telemetry.trackEvent({
    correlationId,
    emittedBy,
    category: 'USER_ACTION',
    type: action,
    payload,
  });
}

export function generateCorrelationId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);
}

export function monitorVideoStalls(videoElement: HTMLVideoElement, correlationId: string, emittedBy: string) {
  let lastTime = -1;
  let stallCount = 0;
  let checkInterval: any;

  const startMonitor = () => {
    if (checkInterval) clearInterval(checkInterval);
    lastTime = videoElement.currentTime;
    stallCount = 0;
    
    checkInterval = setInterval(() => {
      // Only monitor if we are actively supposed to be playing
      if (!videoElement.paused && !videoElement.ended && videoElement.readyState > 0) {
        if (videoElement.currentTime === lastTime) {
          stallCount++;
          // 2 ticks of 1 second = 2 seconds
          if (stallCount === 2) {
            telemetry.trackEvent({
              correlationId,
              emittedBy,
              category: 'PLAYER_LIFECYCLE',
              type: 'playback_stalled',
              payload: { 
                 bufferedEnd: videoElement.buffered.length ? videoElement.buffered.end(videoElement.buffered.length - 1) : 0, 
                 heuristic: true 
              }
            });
          }
        } else {
          stallCount = 0;
        }
        lastTime = videoElement.currentTime;
      }
    }, 1000);
  };

  const stopMonitor = () => {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  };

  videoElement.addEventListener('playing', startMonitor);
  videoElement.addEventListener('pause', stopMonitor);
  videoElement.addEventListener('ended', stopMonitor);
  videoElement.addEventListener('error', stopMonitor);
  videoElement.addEventListener('waiting', stopMonitor); // If native waiting fires, we don't need heuristic

  return () => {
    stopMonitor();
    videoElement.removeEventListener('playing', startMonitor);
    videoElement.removeEventListener('pause', stopMonitor);
    videoElement.removeEventListener('ended', stopMonitor);
    videoElement.removeEventListener('error', stopMonitor);
    videoElement.removeEventListener('waiting', stopMonitor);
  };
}
