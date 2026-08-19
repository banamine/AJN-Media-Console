/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * BroadcastClockService
 * single authoritative time source for schedule alignment, timezone offsets,
 * UTC synchronization, and DST calculations across the entire broadcast platform.
 */
export class BroadcastClockService {
  private static _instance: BroadcastClockService | null = null;

  // Active timezone offset in minutes relative to UTC (defaults to local system offset)
  private timezoneOffsetMinutes: number = -new Date().getTimezoneOffset();

  // Network time synchronization drift/skew offset in milliseconds (localTime + drift = syncTime)
  private clockDriftMs: number = 0;

  // Track state of automatic background synchronization
  private lastSyncTimestamp: number = 0;
  private isSynchronizing: boolean = false;

  public static get instance(): BroadcastClockService {
    if (!this._instance) {
      this._instance = new BroadcastClockService();
    }
    return this._instance;
  }

  private constructor() {
    // Perform initial local synchronization setup
    this.lastSyncTimestamp = Date.now();
  }

  /**
   * Return the authoritative UTC timestamp (in milliseconds)
   * adjusted by the network time drift calculation.
   */
  public getUtcTimeMs(): number {
    return Date.now() + this.clockDriftMs;
  }

  /**
   * Return the authoritative Local/Target Broadcast Time in milliseconds
   * adjusted by both network sync drift AND the active timezone offset.
   */
  public getBroadcastTimeMs(): number {
    const utcTime = this.getUtcTimeMs();
    // Add timezone offset (converted from minutes to milliseconds)
    return utcTime + this.timezoneOffsetMinutes * 60 * 1000;
  }

  /**
   * Helper to fetch current timestamp in seconds (authoritative broadcast time)
   */
  public getBroadcastTimeSeconds(): number {
    return Math.floor(this.getBroadcastTimeMs() / 1000);
  }

  /**
   * Get current timezone offset configuration in minutes
   */
  public getTimezoneOffset(): number {
    return this.timezoneOffsetMinutes;
  }

  /**
   * Dynamically override/set the target timezone offset in minutes
   */
  public setTimezoneOffset(offsetMinutes: number): void {
    this.timezoneOffsetMinutes = offsetMinutes;
  }

  /**
   * Directly inject/adjust the clock drift factor in milliseconds
   */
  public setClockDrift(driftMs: number): void {
    this.clockDriftMs = driftMs;
    this.lastSyncTimestamp = Date.now();
  }

  /**
   * Get currently computed clock drift in milliseconds
   */
  public getClockDrift(): number {
    return this.clockDriftMs;
  }

  /**
   * Check if Daylight Saving Time (DST) is active for a given timestamp/date
   * under the current system/configured offset context.
   */
  public isDSTActive(dateInput?: Date | number): boolean {
    const targetDate = dateInput ? new Date(dateInput) : new Date(this.getBroadcastTimeMs());
    
    // Determine standard/winter offset vs summer offset for local comparison
    const jan = new Date(targetDate.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(targetDate.getFullYear(), 6, 1).getTimezoneOffset();
    
    // If offsets differ, region has DST.
    // The date is in DST if its offset matches the summer (minimum) offset.
    const maxOffset = Math.max(jan, jul);
    return targetDate.getTimezoneOffset() < maxOffset;
  }

  /**
   * Retrieve DST transition boundaries for a given year.
   * Assumes US standard rules as a robust default (Spring forward second Sunday in March,
   * Fall back first Sunday in November) but calculates them deterministically.
   */
  public getDSTTransitionDates(year: number): { start: Date; end: Date } {
    // March DST Start: 2nd Sunday in March at 02:00 AM
    let marchSundayCount = 0;
    let dstStartDay = 1;
    for (let day = 1; day <= 31; day++) {
      const d = new Date(year, 2, day);
      if (d.getDay() === 0) { // Sunday
        marchSundayCount++;
        if (marchSundayCount === 2) {
          dstStartDay = day;
          break;
        }
      }
    }
    const dstStart = new Date(year, 2, dstStartDay, 2, 0, 0);

    // November DST End: 1st Sunday in November at 02:00 AM
    let dstEndDay = 1;
    for (let day = 1; day <= 30; day++) {
      const d = new Date(year, 10, day);
      if (d.getDay() === 0) { // Sunday
        dstEndDay = day;
        break;
      }
    }
    const dstEnd = new Date(year, 10, dstEndDay, 2, 0, 0);

    return { start: dstStart, end: dstEnd };
  }

  /**
   * Synchronize local system clock with an authoritative network server/endpoint
   * to compute and eliminate local computer clock skew.
   */
  public async syncWithNetworkTime(timeServerUrl: string = "/api/health"): Promise<boolean> {
    if (this.isSynchronizing) return false;
    this.isSynchronizing = true;

    try {
      const startRequest = performance.now();
      const response = await fetch(timeServerUrl);
      const endRequest = performance.now();
      
      const latencyMs = (endRequest - startRequest) / 2;

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        
        // Extract server timestamp from payload if present (else use response Header date)
        let serverTimeMs = data.timestamp || data.serverTime;
        if (!serverTimeMs) {
          const dateHeader = response.headers.get("Date");
          if (dateHeader) {
            serverTimeMs = new Date(dateHeader).getTime();
          }
        }

        if (serverTimeMs) {
          // Adjust server timestamp with estimated half-roundtrip network latency
          const adjustedServerTime = serverTimeMs + latencyMs;
          const localNow = Date.now();
          this.clockDriftMs = adjustedServerTime - localNow;
          this.lastSyncTimestamp = localNow;
          this.isSynchronizing = false;
          return true;
        }
      }
    } catch (err) {
      console.warn("[BroadcastClock] Failed to contact time synchronization endpoint. Falling back to local NTP estimations.", err);
    }

    // Graceful fallback synchronization estimate
    this.clockDriftMs = 0;
    this.lastSyncTimestamp = Date.now();
    this.isSynchronizing = false;
    return false;
  }

  /**
   * Formats a millisecond timestamp into standard human-readable broadcast format
   */
  public formatToBroadcastTime(timestamp?: number): string {
    const timeMs = timestamp !== undefined ? timestamp : this.getBroadcastTimeMs();
    const date = new Date(timeMs);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    
    const offsetSign = this.timezoneOffsetMinutes >= 0 ? "+" : "-";
    const offsetHours = String(Math.floor(Math.abs(this.timezoneOffsetMinutes) / 60)).padStart(2, "0");
    const offsetMins = String(Math.abs(this.timezoneOffsetMinutes) % 60).padStart(2, "0");
    const tzString = `UTC${offsetSign}${offsetHours}:${offsetMins}`;

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (${tzString})`;
  }

  /**
   * Fetch diagnostics data for the clock service
   */
  public getDiagnostics() {
    return {
      timezoneOffsetMinutes: this.timezoneOffsetMinutes,
      clockDriftMs: this.clockDriftMs,
      lastSyncTimestamp: this.lastSyncTimestamp,
      isDSTActive: this.isDSTActive(),
      currentUtcTime: new Date(this.getUtcTimeMs()).toISOString(),
      currentBroadcastTimeFormatted: this.formatToBroadcastTime()
    };
  }
}

// Single authoritative clock instance export
export const broadcastClock = BroadcastClockService.instance;
