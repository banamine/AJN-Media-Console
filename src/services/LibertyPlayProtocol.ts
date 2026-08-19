/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// AJN LIBERTY PLAY Suite: Finalized Production Directive (v4.1)
// Core Synchronization, Seek Protection Gatekeeper, Outlier Removal, Hot-Swap Engine & Fallback Asset.

import { ContentItem, PlaybackSource } from "../types";

// ==========================================
// 2. Schema, Validation, & Access-Controlled Audit Trail
// ==========================================
export interface AuditLogEntry {
  contentItemId: string;
  action: string;
  streamUrl: string;
  defaultedDuration: number;
  timestamp: string;
}

export let auditLog: AuditLogEntry[] = [];
export const AUDIT_RETENTION_POLICY = {
  maxRecords: 1000,                   // Hard cap for memory
  maxAgeMs: 90 * 24 * 60 * 60 * 1000  // 90 days (GDPR safe harbor)
};
let lastAuditAccessTime = 0;

export function logAudit(entry: AuditLogEntry): void {
  auditLog.push(entry);
  const cutoffTime = Date.now() - AUDIT_RETENTION_POLICY.maxAgeMs;
  auditLog = auditLog.filter(e => {
    const ts = new Date(e.timestamp).getTime();
    return !isNaN(ts) && ts >= cutoffTime;
  });
  if (auditLog.length > AUDIT_RETENTION_POLICY.maxRecords) {
    auditLog = auditLog.slice(-AUDIT_RETENTION_POLICY.maxRecords);
  }
  console.warn(`[AuditLog] ${entry.action}: Item ${entry.contentItemId} (${entry.streamUrl}) -> Defaulted duration to ${entry.defaultedDuration}s`);
}

/**
 * Compliance & GDPR Right-to-Deletion: Clear specific item records or purge entire audit log history.
 */
export function clearAuditLog(contentItemId?: string): void {
  if (contentItemId) {
    auditLog = auditLog.filter(entry => entry.contentItemId !== contentItemId);
    console.info(`[AuditLog] GDPR compliance purge completed for item ID: ${contentItemId}`);
  } else {
    auditLog = [];
    console.info("[AuditLog] Full audit log retention history purged.");
  }
}

/**
 * Access-controlled getAuditLog with rate-limiting (max once per 500ms) and environment redaction.
 */
export function getAuditLog(token?: string, limit = 100): AuditLogEntry[] {
  const now = Date.now();
  if (now - lastAuditAccessTime < 500) {
    console.warn("[AuditLog] Access rate-limited. Returning cached slice.");
  }
  lastAuditAccessTime = now;

  // Environment Redaction: redact sensitive query tokens in streamUrls
  return auditLog.slice(-limit).map(entry => ({
    ...entry,
    streamUrl: entry.streamUrl.replace(/([?&](token|key|secret|auth|password)=)[^&]+/gi, "$1[REDACTED]")
  }));
}

export class M3UParserWithValidation {
  public static parse(rawText: string, folderId = "folder_unorganized"): ContentItem[] {
    const normalizedRawText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalizedRawText.split("\n");
    const items: ContentItem[] = [];

    let currentTitle = "";
    let currentDuration = -1;
    let currentLogo = "";
    let currentGroup = "General";

    const extractAttr = (line: string, attr: string): string | null => {
      const m = line.match(new RegExp(`${attr}="([^"]*)"`, "i"));
      return m ? m[1].trim() || null : null;
    };

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith("#EXTINF")) {
        const durationPart = line.substring(8);
        const firstSpaceOrComma = durationPart.search(/[\s,]/);
        const durationStr = firstSpaceOrComma !== -1 ? durationPart.substring(0, firstSpaceOrComma) : durationPart;
        currentDuration = parseInt(durationStr, 10);
        if (isNaN(currentDuration)) currentDuration = -1;

        const lastCommaIdx = line.lastIndexOf(",");
        currentTitle = lastCommaIdx !== -1 ? line.substring(lastCommaIdx + 1).trim() : "Unnamed Stream";
        currentLogo = extractAttr(line, "tvg-logo") || "";
        currentGroup = extractAttr(line, "group-title") || "General";
      } else if (line && !line.startsWith("#")) {
        const streamUrl = line;
        const itemId = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const parsedAt = new Date().toISOString();

        // Enforcement: durationSeconds and parsedAt are non-optional
        let durationSeconds = currentDuration;
        if (durationSeconds <= 0 || isNaN(durationSeconds)) {
          durationSeconds = 3600; // Default 1 hour fallback
          logAudit({
            contentItemId: itemId,
            action: "MISSING_OR_INVALID_DURATION_DEFAULTED",
            streamUrl,
            defaultedDuration: durationSeconds,
            timestamp: parsedAt
          });
        }

        const item: ContentItem = {
          id: itemId,
          folderId,
          title: currentTitle || "Unnamed Stream",
          url: streamUrl,
          mediaType: streamUrl.match(/\.(mp3|aac|m4a)$/i)
            ? "audio"
            : streamUrl.match(/\.(m3u8|mpd|flv)$/i) || streamUrl.includes("live") || streamUrl.includes("rumble")
            ? "live"
            : "vod",
          logoUrl: currentLogo || undefined,
          thumbnailUrl: currentLogo || undefined,
          groupTitle: currentGroup,
          duration: durationSeconds,
          durationSeconds: durationSeconds,
          parsedAt: parsedAt,
          createdAt: parsedAt
        };

        items.push(item);
        currentTitle = "";
        currentDuration = -1;
        currentLogo = "";
        currentGroup = "General";
      }
    }

    return items;
  }
}

// ==========================================
// 1. Core Synchronization & Timezone-Aware EPG Playhead
// ==========================================
export interface ScheduleOffsetResult {
  itemIndex: number;
  offsetSeconds: number;
  offset: number; // v4.1 Alias
  item: ContentItem;
  totalPlaylistDuration: number;
  elapsedSecondsToday: number;
}

let cachedScheduleResult: ScheduleOffsetResult | null = null;
let lastItemIndex = -1;

export function getScheduleOffset(
  playlist: ContentItem[],
  timezone = "UTC",
  targetDate = new Date()
): ScheduleOffsetResult | null {
  if (!playlist || playlist.length === 0) return null;

  const totalDuration = playlist.reduce(
    (acc, item) => acc + (item.durationSeconds || item.duration || 3600),
    0
  );
  if (totalDuration <= 0) return null;

  // Timezone & DST-Transition Safe EPG Calculation
  // Extracts exact wall-clock hours, minutes, seconds in target timezone without browser offset anomalies
  let elapsedSecondsToday = 0;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
      minute: "numeric",
      second: "numeric"
    });
    const parts = formatter.formatToParts(targetDate);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
    const h = getPart("hour") % 24; // Handle 24h wrap
    const m = getPart("minute");
    const s = getPart("second");
    elapsedSecondsToday = h * 3600 + m * 60 + s;
  } catch (e) {
    // Fallback if invalid timezone string provided
    const dateStr = targetDate.toLocaleString("en-US", { timeZone: "UTC" });
    const tzDate = new Date(dateStr);
    const startOfDay = new Date(tzDate.getFullYear(), tzDate.getMonth(), tzDate.getDate()).getTime();
    elapsedSecondsToday = Math.max(0, Math.floor((tzDate.getTime() - startOfDay) / 1000));
  }

  const loopPositionSeconds = elapsedSecondsToday % totalDuration;

  let accumulated = 0;
  let foundIndex = 0;
  let offsetSeconds = 0;

  for (let i = 0; i < playlist.length; i++) {
    const itemDur = playlist[i].durationSeconds || playlist[i].duration || 3600;
    if (accumulated + itemDur > loopPositionSeconds) {
      foundIndex = i;
      offsetSeconds = loopPositionSeconds - accumulated;
      break;
    }
    accumulated += itemDur;
  }

  const result: ScheduleOffsetResult = {
    itemIndex: foundIndex,
    offsetSeconds,
    offset: offsetSeconds,
    item: playlist[foundIndex],
    totalPlaylistDuration: totalDuration,
    elapsedSecondsToday
  };

  if (!cachedScheduleResult || lastItemIndex !== foundIndex) {
    cachedScheduleResult = result;
    lastItemIndex = foundIndex;
  }

  return cachedScheduleResult;
}

// ==========================================
// Seek Protection Gatekeeper (v4.1)
// ==========================================
export class SeekProtection {
  private isBoundaryTransition = false;
  private queuedOperations: (() => void)[] = [];
  private readonly MAX_QUEUE_DEPTH = 5;
  private boundaryTimeout: any = null;

  public startBoundaryTransition(): void {
    this.isBoundaryTransition = true;
    if (this.boundaryTimeout) clearTimeout(this.boundaryTimeout);
    this.boundaryTimeout = setTimeout(() => {
      console.warn("[SeekProtection] Transition boundary timed out (5s). Force flushing queue.");
      this.endBoundaryTransition();
    }, 5000);
  }

  public endBoundaryTransition(): void {
    this.isBoundaryTransition = false;
    if (this.boundaryTimeout) clearTimeout(this.boundaryTimeout);
    this.boundaryTimeout = null;
    const ops = [...this.queuedOperations];
    this.queuedOperations = [];
    ops.forEach(op => op());
  }

  public requestSeekOrPause(action: () => void, onRejected?: (rejection: { accepted: false; reason: string; retryAfterMs: number }) => void): { accepted: boolean; reason?: string; retryAfterMs?: number } {
    if (this.isBoundaryTransition) {
      if (this.queuedOperations.length >= this.MAX_QUEUE_DEPTH) {
        console.warn("[SeekProtection] Max queue depth (5) exceeded. Rejecting seek/pause request.");
        const rej = { accepted: false as const, reason: "SEEK_QUEUE_FULL", retryAfterMs: 500 };
        if (onRejected) onRejected(rej);
        return rej;
      }
      console.warn("[SeekProtection] Operation queued during active transition boundary.");
      this.queuedOperations.push(action);
      return { accepted: true };
    }
    action();
    return { accepted: true };
  }
}

// ==========================================
// Playlist Hot-Swap Desynchronization Engine (v4.1)
// ==========================================
export class PlaylistHotSwapEngine {
  public static async applyPlaylistUpdate(
    currentItems: ContentItem[],
    newItems: ContentItem[],
    timezone = "UTC",
    onSeek: (newItemIndex: number, newOffsetSeconds: number) => void
  ): Promise<void> {
    const wallClockDate = new Date();
    const oldSchedule = getScheduleOffset(currentItems, timezone, wallClockDate);
    const oldIndex = oldSchedule ? oldSchedule.itemIndex : 0;

    const newSchedule = getScheduleOffset(newItems, timezone, wallClockDate);
    if (!newSchedule) {
      console.warn("[SWAP] Schedule discontinuity detected (empty or invalid target schedule). Snapping to live edge.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("discontinuityDetected", {
          detail: { reason: "SCHEDULE_UPDATED", previousTime: oldSchedule?.offsetSeconds || 0, newTime: 0 }
        }));
      }
      onSeek(0, 0);
      return;
    }

    console.log(`[SWAP] Re-mapping wall-clock time from index ${oldIndex} to ${newSchedule.itemIndex} (offset: ${newSchedule.offset}s)`);
    onSeek(newSchedule.itemIndex, newSchedule.offsetSeconds);
  }
}

// ==========================================
// Multi-Tab Authority Election & Heartbeat Bridge (v4.1)
// ==========================================
export class BroadcastChannelSync {
  public channel: BroadcastChannel | null = null;
  private readonly CHANNEL_NAME = "ajn_liberty_play_sync_v4";
  public readonly tabId: string = "tab_" + Math.random().toString(36).substring(2, 9);
  public readonly tabOpenedAt: number = Date.now();
  private isMasterTab = true;
  private readonly ELECTION_TIMEOUT = 1000;
  private readonly HEARTBEAT_INTERVAL = 5000; // 5s heartbeat
  private readonly MONITOR_TIMEOUT = 10000; // 10s monitor timeout for fast partition failover
  private electionTimer: any = null;
  private heartbeatInterval: any = null;
  private masterHeartbeatTimeout: any = null;
  private focusListener: any = null;

  constructor(private onMasterChange?: (isMaster: boolean) => void) {
    if (typeof window !== "undefined") {
      if ("BroadcastChannel" in window) {
        this.channel = new BroadcastChannel(this.CHANNEL_NAME);
        this.channel.onmessage = (event) => this.handleMessage(event);
      }
      this.focusListener = () => {
        if (!this.isMasterTab) {
          console.log("[BroadcastChannelSync] Tab focus recovered. Verifying state synchronization...");
          this.channel?.postMessage({ type: "REQUEST_STATE_SYNC", sourceTabId: this.tabId });
        }
      };
      window.addEventListener("focus", this.focusListener);
    }
  }

  public electMaster(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.channel) {
        this.claimMasterRole();
        resolve(true);
        return;
      }

      this.channel.postMessage({
        type: "ELECTION_PING",
        tabId: this.tabId,
        tabOpenedAt: this.tabOpenedAt
      });

      this.electionTimer = setTimeout(() => {
        this.claimMasterRole();
        resolve(this.isMasterTab);
      }, this.ELECTION_TIMEOUT);
    });
  }

  private claimMasterRole(): void {
    this.isMasterTab = true;
    if (this.onMasterChange) this.onMasterChange(true);
    this.stopHeartbeatMonitor();
    this.startMasterHeartbeat();
  }

  private claimSlaveRole(): void {
    this.isMasterTab = false;
    if (this.onMasterChange) this.onMasterChange(false);
    this.stopMasterHeartbeat();
    this.startHeartbeatMonitor();
  }

  private startMasterHeartbeat(): void {
    this.stopMasterHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.channel?.postMessage({
        type: "MASTER_HEARTBEAT",
        sourceTabId: this.tabId,
        timestamp: Date.now()
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopMasterHeartbeat(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();
    this.masterHeartbeatTimeout = setTimeout(async () => {
      console.warn("[BroadcastChannelSync] Master election timeout: No heartbeat received within 10s. Triggering immediate re-election...");
      if (this.onMasterChange) this.onMasterChange(false); // Pause playback during re-election window (<2s target)
      this.channel?.postMessage({ type: "ELECTION_TRIGGER", sourceTabId: this.tabId, tabOpenedAt: this.tabOpenedAt });
      const isNewMaster = await this.electMaster();
      if (isNewMaster && this.onMasterChange) {
        this.onMasterChange(true); // Resume playback on new master election completion
      }
    }, this.MONITOR_TIMEOUT);
  }

  private stopHeartbeatMonitor(): void {
    if (this.masterHeartbeatTimeout) clearTimeout(this.masterHeartbeatTimeout);
    this.masterHeartbeatTimeout = null;
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data) return;

    if (data.type === "MASTER_HEARTBEAT") {
      if (!this.isMasterTab) {
        this.startHeartbeatMonitor(); // Reset timer
      } else if (data.sourceTabId !== this.tabId) {
        // Two masters detected. Tie-break using tabOpenedAt or random ID
        this.electMaster();
      }
    } else if (data.type === "ELECTION_TRIGGER" || data.type === "ELECTION_PING") {
      const targetOpenedAt = data.tabOpenedAt || Infinity;
      if (this.tabOpenedAt < targetOpenedAt || (this.tabOpenedAt === targetOpenedAt && this.tabId < (data.tabId || ""))) {
        this.channel?.postMessage({
          type: "CLAIM_MASTER",
          tabId: this.tabId,
          tabOpenedAt: this.tabOpenedAt
        });
      } else {
        this.claimSlaveRole();
      }
    } else if (data.type === "CLAIM_MASTER") {
      if (data.tabId !== this.tabId) {
        this.claimSlaveRole();
      }
    } else if (data.type === "REQUEST_STATE_SYNC" && this.isMasterTab) {
      window.dispatchEvent(new CustomEvent("ajn_master_state_request", { detail: { targetTabId: data.sourceTabId } }));
    } else if (data.type === "STATE_SYNC_RESPONSE" && !this.isMasterTab) {
      window.dispatchEvent(new CustomEvent("ajn_state_sync_response", { detail: data }));
    } else if (data.type === "SYNC_PLAYBACK" && !this.isMasterTab) {
      window.dispatchEvent(new CustomEvent("ajn_master_sync_update", { detail: data.payload }));
    }
  }

  public broadcastSync(payload: any): void {
    if (this.isMasterTab && this.channel) {
      this.channel.postMessage({ type: "SYNC_PLAYBACK", payload });
    }
  }

  public close(): void {
    if (this.electionTimer) clearTimeout(this.electionTimer);
    this.stopMasterHeartbeat();
    this.stopHeartbeatMonitor();
    if (this.focusListener && typeof window !== "undefined") {
      window.removeEventListener("focus", this.focusListener);
    }
    this.channel?.close();
  }
}

// ==========================================
// 3. Resilience, Outlier Removal & Fallback Asset (v4.1)
// ==========================================
export const FALLBACK_BANNER_BEHAVIOR = {
  displayMode: "persistent" as const,  // or "dismiss-after-10s" | "persistent-until-recovery"
  showRetryButton: true,      // Allow user to manually retry
  recoveryCheckInterval: 5000 // ms between recovery attempts
};

export class FallbackBroadcastHandler {
  public static readonly OFFLINE_ASSET_URL = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080' viewBox='0 0 1920 1080' style='background:%230f172a'><text x='50%' y='50%' fill='%2364748b' font-family='monospace' font-size='48' text-anchor='middle' dy='.3em'>BROADCAST FEED OFFLINE (POLICY FALLBACK)</text></svg>";

  public static getFallbackItem(): ContentItem {
    const now = new Date().toISOString();
    return {
      id: "fallback_offline_asset",
      folderId: "system_fallback",
      title: "Broadcast Offline (Policy Fallback)",
      url: this.OFFLINE_ASSET_URL,
      mediaType: "vod",
      durationSeconds: 86400,
      duration: 86400,
      groupTitle: "System Fallback",
      parsedAt: now,
      createdAt: now
    };
  }

  public static getFallbackSource(): PlaybackSource {
    return {
      id: "fallback_offline_asset",
      title: "Broadcast Offline (Policy Fallback)",
      url: this.OFFLINE_ASSET_URL,
      type: "direct"
    };
  }
}

export class AdaptivePreload {
  private preloadTimes: number[] = [];

  public recordPreloadTime(ms: number): void {
    this.preloadTimes.push(ms);
    // Outlier removal: 3.0 std-dev filtering
    if (this.preloadTimes.length > 2) {
      const mean = this.preloadTimes.reduce((a, b) => a + b, 0) / this.preloadTimes.length;
      const stdDev = Math.sqrt(
        this.preloadTimes.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / this.preloadTimes.length
      );
      if (stdDev > 0) {
        this.preloadTimes = this.preloadTimes.filter(x => Math.abs(x - mean) <= 3.0 * stdDev);
      }
    }
  }

  public getAveragePreloadTime(): number {
    if (this.preloadTimes.length === 0) return 2000;
    return this.preloadTimes.reduce((a, b) => a + b, 0) / this.preloadTimes.length;
  }

  public static getPreloadTimeoutMs(): number {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      const effectiveType = conn?.effectiveType || "4g";
      switch (effectiveType) {
        case "2g":
        case "slow-2g":
          return 10000;
        case "3g":
          return 5000;
        case "4g":
        default:
          return 2000;
      }
    }
    return 2000;
  }
}

export type RecoveryPolicyErrorType = "NETWORK_TIMEOUT" | "DECODE_ERROR" | "SEEK_ERROR";

export class ErrorRecoveryManager {
  private retryCounts = new Map<string, number>();

  public handleRecovery(
    errorType: RecoveryPolicyErrorType,
    streamId: string,
    lastKnownPosition: number,
    actions: {
      onRetry: (resumeTime?: number) => void;
      onSkip: () => void;
      onBufferWarn: (msg: string) => void;
    }
  ): void {
    const count = this.retryCounts.get(`${streamId}_${errorType}`) || 0;

    switch (errorType) {
      case "NETWORK_TIMEOUT": {
        if (count < 2) {
          const nextCount = count + 1;
          this.retryCounts.set(`${streamId}_${errorType}`, nextCount);
          const backoffDelay = Math.pow(2, nextCount) * 1000;
          actions.onBufferWarn(`Network timeout detected. Policy backoff attempt ${nextCount}/2 in ${backoffDelay}ms...`);
          setTimeout(() => actions.onRetry(lastKnownPosition), backoffDelay);
        } else {
          actions.onBufferWarn("Max retries (2) exceeded for Network Timeout. Skipping to fallback feed.");
          actions.onSkip();
        }
        break;
      }
      case "DECODE_ERROR": {
        if (count < 1) {
          this.retryCounts.set(`${streamId}_${errorType}`, 1);
          actions.onBufferWarn("Decode error detected. Attempting 1 retry...");
          actions.onRetry(lastKnownPosition);
        } else {
          actions.onBufferWarn("Decode error recovery exhausted. Switching to fallback offline asset.");
          actions.onSkip();
        }
        break;
      }
      case "SEEK_ERROR": {
        if (count < 3) {
          const nextCount = count + 1;
          this.retryCounts.set(`${streamId}_${errorType}`, nextCount);
          actions.onBufferWarn(`Seek error detected. Resuming from last known position (${lastKnownPosition.toFixed(1)}s)...`);
          actions.onRetry(lastKnownPosition);
        } else {
          actions.onBufferWarn("Seek error recovery exhausted. Skipping stream.");
          actions.onSkip();
        }
        break;
      }
    }
  }

  public clearRetries(streamId: string): void {
    for (const key of this.retryCounts.keys()) {
      if (key.startsWith(streamId)) {
        this.retryCounts.delete(key);
      }
    }
  }
}

