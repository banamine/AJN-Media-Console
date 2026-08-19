/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";

const TELEMETRY_DB_PATH = path.join(process.cwd(), "telemetry_db.json");

export interface TelemetryEvent {
  id: string;
  eventType: "feed_fetch_success" | "feed_fetch_failure" | "playback_start" | "playback_complete" | "playback_error" | "playback_buffering" | "user_engagement_click" | "simulate_outage_toggle";
  timestamp: string;
  sessionId: string;
  streamUrl?: string;
  streamTitle?: string;
  broadcaster?: string;
  duration?: number; // duration in seconds (for playback) or milliseconds (for fetches)
  errorCode?: string;
  errorMessage?: string;
  fallbackUsed?: boolean;
  itemCount?: number;
  userAgent?: string;
  ipAddress?: string;
}

interface TelemetrySchema {
  events: TelemetryEvent[];
  isOutageSimulated: boolean;
}

let dbInMemory: TelemetrySchema = {
  events: [],
  isOutageSimulated: false
};

export async function initTelemetryDatabase() {
  if (fs.existsSync(TELEMETRY_DB_PATH)) {
    try {
      const fileData = fs.readFileSync(TELEMETRY_DB_PATH, "utf8");
      const parsed = JSON.parse(fileData);
      dbInMemory = {
        events: parsed.events || [],
        isOutageSimulated: parsed.isOutageSimulated || false
      };
      console.log(`[Telemetry Database] Loaded ${dbInMemory.events.length} telemetry events. Outage simulation is ${dbInMemory.isOutageSimulated ? "ON" : "OFF"}.`);
    } catch (err: any) {
      console.error("[Telemetry Database] Error reading telemetry_db.json, reinitializing empty:", err.message);
      dbInMemory = { events: [], isOutageSimulated: false };
    }
  } else {
    dbInMemory = { events: [], isOutageSimulated: false };
  }
  saveTelemetryDatabase();
}

export function saveTelemetryDatabase() {
  // DB writes disabled as requested
}

export function logTelemetryEvent(event: Omit<TelemetryEvent, "id" | "timestamp"> & { timestamp?: string }) {
  const newEvent: TelemetryEvent = {
    ...event,
    id: `telemetry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: event.timestamp || new Date().toISOString()
  };

  dbInMemory.events.push(newEvent);

  // Keep sliding window of latest 5,000 events to manage disk space & memory
  if (dbInMemory.events.length > 5000) {
    dbInMemory.events = dbInMemory.events.slice(-5000);
  }

  saveTelemetryDatabase();
  return newEvent;
}

export function getTelemetryEvents(): TelemetryEvent[] {
  return dbInMemory.events;
}

export function isOutageSimulated(): boolean {
  return dbInMemory.isOutageSimulated;
}

export function setOutageSimulation(active: boolean) {
  dbInMemory.isOutageSimulated = active;
  saveTelemetryDatabase();
  console.log(`[Telemetry Database] Outage simulation toggled to: ${active}`);
}

export function clearTelemetryEvents() {
  dbInMemory.events = [];
  saveTelemetryDatabase();
}

/**
 * Aggregates statistics directly from telemetry events
 */
export function getTelemetryStats() {
  const events = dbInMemory.events;
  const totalEvents = events.length;

  // Filter feed fetch events
  const fetchEvents = events.filter(e => e.eventType === "feed_fetch_success" || e.eventType === "feed_fetch_failure");
  const fetchSuccessCount = fetchEvents.filter(e => e.eventType === "feed_fetch_success").length;
  const fetchFailureCount = fetchEvents.filter(e => e.eventType === "feed_fetch_failure").length;
  const feedFetchRate = fetchEvents.length > 0 ? (fetchSuccessCount / fetchEvents.length) * 100 : 100;

  // Average fetch duration
  const successFetches = fetchEvents.filter(e => e.eventType === "feed_fetch_success" && e.duration !== undefined);
  const avgFetchDurationMs = successFetches.length > 0 
    ? successFetches.reduce((acc, curr) => acc + (curr.duration || 0), 0) / successFetches.length 
    : 0;

  // Playback events
  const playbackErrors = events.filter(e => e.eventType === "playback_error");
  const playbackStarts = events.filter(e => e.eventType === "playback_start");
  const playbackCompletes = events.filter(e => e.eventType === "playback_complete");
  const playbackBuffering = events.filter(e => e.eventType === "playback_buffering");

  const totalPlaybackAttempts = playbackStarts.length;
  const playbackErrorCount = playbackErrors.length;
  const playbackSuccessRate = totalPlaybackAttempts > 0 
    ? ((totalPlaybackAttempts - playbackErrorCount) / totalPlaybackAttempts) * 100 
    : 100;

  // Fallback activation count (where feed fetch failed or fallbackUsed was explicitly logged)
  const fallbackActivations = events.filter(e => e.fallbackUsed === true).length;

  // User engagement (show clicks)
  const showClicksMap: Record<string, number> = {};
  const showEngagement: Array<{ name: string; clicks: number }> = [];

  events.forEach(e => {
    if (e.eventType === "user_engagement_click" && e.broadcaster) {
      showClicksMap[e.broadcaster] = (showClicksMap[e.broadcaster] || 0) + 1;
    } else if (e.eventType === "playback_start" && e.broadcaster) {
      showClicksMap[e.broadcaster] = (showClicksMap[e.broadcaster] || 0) + 1;
    }
  });

  Object.entries(showClicksMap).forEach(([name, clicks]) => {
    showEngagement.push({ name, clicks });
  });
  showEngagement.sort((a, b) => b.clicks - a.clicks);

  // Playback duration by stream
  const watchDurationsMap: Record<string, number> = {};
  const watchDurationsList: Array<{ title: string; totalWatchTimeSec: number }> = [];
  
  events.forEach(e => {
    if (e.eventType === "playback_complete" && e.streamTitle && e.duration !== undefined) {
      watchDurationsMap[e.streamTitle] = (watchDurationsMap[e.streamTitle] || 0) + e.duration;
    }
  });

  Object.entries(watchDurationsMap).forEach(([title, totalWatchTimeSec]) => {
    watchDurationsList.push({ title, totalWatchTimeSec });
  });
  watchDurationsList.sort((a, b) => b.totalWatchTimeSec - a.totalWatchTimeSec);

  // Hourly breakdowns
  const hourlyDataMap: Record<number, { hour: number; events: number; errors: number }> = {};
  for (let i = 0; i < 24; i++) {
    hourlyDataMap[i] = { hour: i, events: 0, errors: 0 };
  }

  events.forEach(e => {
    const hour = new Date(e.timestamp).getHours();
    if (hourlyDataMap[hour]) {
      hourlyDataMap[hour].events++;
      if (e.eventType === "playback_error" || e.eventType === "feed_fetch_failure") {
        hourlyDataMap[hour].errors++;
      }
    }
  });

  const hourlyBreakdown = Object.values(hourlyDataMap);

  return {
    totalEvents,
    feedFetch: {
      total: fetchEvents.length,
      success: fetchSuccessCount,
      failure: fetchFailureCount,
      rate: feedFetchRate,
      avgDurationMs: avgFetchDurationMs,
      fallbackActivations
    },
    playback: {
      attempts: totalPlaybackAttempts,
      errors: playbackErrorCount,
      successRate: playbackSuccessRate,
      completes: playbackCompletes.length,
      bufferingEvents: playbackBuffering.length
    },
    showEngagement,
    watchDurationsList,
    hourlyBreakdown,
    isOutageSimulated: dbInMemory.isOutageSimulated
  };
}
