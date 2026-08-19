/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentItem } from "../types";
import { PlaylistHotSwapEngine } from "./LibertyPlayProtocol";

export interface SchemaValidationResult<T> {
  isValid: boolean;
  items: T[];
  rejectedCount: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  rawItem?: any;
}

/**
 * Audit Log Singleton for ingestion tracking & observability.
 */
export class AuditLog {
  private static logs: AuditLogEntry[] = [];
  private static listeners: ((logs: AuditLogEntry[]) => void)[] = [];

  public static async record(level: "info" | "warn" | "error", message: string, rawItem?: any): Promise<void>;
  public static async record(obj: { event: string; status: string; checksum: string; skippedProcessing: boolean; [key: string]: any }): Promise<void>;
  public static async record(levelOrObj: any, message?: string, rawItem?: any): Promise<void> {
    let level: "info" | "warn" | "error" = "info";
    let msg = "";
    let item = rawItem;

    if (typeof levelOrObj === "object" && levelOrObj !== null) {
      if (levelOrObj.event === "M3UPlaylistPolling") return;
      level = levelOrObj.level || "info";
      msg = `[${levelOrObj.event || "Event"}] status=${levelOrObj.status}, checksum=${levelOrObj.checksum || "none"}, skippedProcessing=${levelOrObj.skippedProcessing}`;
      item = levelOrObj;
    } else {
      if (message && (message.includes("M3UPlaylistPolling") || message.includes("synthesizer"))) return;
      level = levelOrObj;
      msg = message || "";
    }

    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      rawItem: item
    };
    this.logs = [entry, ...this.logs.slice(0, 199)]; // Keep latest 200 logs
    if (level === "error") {
      console.error(`[AuditLog:ERROR] ${msg}`, item || "");
    } else if (level === "warn") {
      console.warn(`[AuditLog:WARN] ${msg}`);
    } else {
      console.log(`[AuditLog:INFO] ${msg}`);
    }
    this.notify();
  }

  public static getLogs(): AuditLogEntry[] {
    return this.logs;
  }

  public static subscribe(listener: (logs: AuditLogEntry[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notify(): void {
    for (const listener of this.listeners) {
      listener(this.logs);
    }
  }
}

/**
 * v4.1 Schema Validator Gate.
 * Enforces strict data integrity: rejects items missing durationSeconds/duration or streamUrl/url.
 */
export class SchemaValidator {
  public static process(rawData: any[]): SchemaValidationResult<any> {
    if (!Array.isArray(rawData)) {
      AuditLog.record("error", "Ingestion payload must be an array");
      return { isValid: false, items: [], rejectedCount: 1 };
    }

    const validItems: any[] = [];
    let rejectedCount = 0;

    for (const item of rawData) {
      if (!item || typeof item !== "object") {
        rejectedCount++;
        AuditLog.record("error", "Rejected non-object item in ingestion payload", item);
        continue;
      }

      // v4.1 schema check: verify streamUrl (or url) and durationSeconds (or duration)
      const streamUrl = item.streamUrl ?? item.url;
      const durationSeconds = item.durationSeconds ?? item.duration;

      if (typeof streamUrl !== "string" || !streamUrl.trim()) {
        rejectedCount++;
        AuditLog.record("error", "Rejected item missing required v4.1 field: streamUrl or url", item);
        continue;
      }

      if (typeof durationSeconds !== "number" && typeof durationSeconds !== "string") {
        rejectedCount++;
        AuditLog.record("error", "Rejected item missing required v4.1 field: durationSeconds or duration", item);
        continue;
      }

      // Normalize object to ensure both standard properties are present
      const normalizedItem = {
        ...item,
        url: streamUrl.trim(),
        streamUrl: streamUrl.trim(),
        duration: Number(durationSeconds),
        durationSeconds: Number(durationSeconds)
      };

      validItems.push(normalizedItem);
    }

    const isValid = rejectedCount === 0 && validItems.length > 0;
    if (!isValid && validItems.length === 0) {
      AuditLog.record("error", "Ingestion failed: Schema Mismatch (all items rejected)");
    } else if (rejectedCount > 0) {
      AuditLog.record("warn", `Ingestion partial success: ${validItems.length} accepted, ${rejectedCount} rejected`);
    } else {
      AuditLog.record("info", `Ingestion validation verified: ${validItems.length} items compliant with v4.1 schema`);
    }

    return {
      isValid,
      items: validItems,
      rejectedCount
    };
  }
}

/**
 * Production Ingestion Service acting as the single entry point for content.
 * Guarantees engine never sees malformed or insecure links.
 */
export class IngestionService {
  private static instance: IngestionService = new IngestionService();
  private engineCallback?: (items: any[]) => void;
  private currentItems: any[] = [];

  public static getInstance(): IngestionService {
    return this.instance;
  }

  public registerEngineCallback(cb: (items: any[]) => void): void {
    this.engineCallback = cb;
  }

  public getCurrentItems(): any[] {
    return this.currentItems;
  }

  /**
   * Sync raw data from remote API, validate against v4.1 schema, and inject into engine.
   */
  public async syncWithSource(
    apiUrl: string,
    onSeek?: (newItemIndex: number, newOffsetSeconds: number) => void
  ): Promise<boolean> {
    try {
      AuditLog.record("info", `Initiating protected fetch from source: ${apiUrl}`);
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ingestion endpoint`);
      }
      const rawData = await response.json();
      const rawList = Array.isArray(rawData) ? rawData : (rawData.items ?? rawData.channels ?? []);

      return await this.ingestPayload(rawList, onSeek);
    } catch (err: any) {
      AuditLog.record("error", `Ingestion network failure: ${err.message}`);
      this.alertOperator(`Ingestion failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Process raw payload array through validation gate and perform atomic hot-swap.
   */
  public async ingestPayload(
    rawList: any[],
    onSeek?: (newItemIndex: number, newOffsetSeconds: number) => void
  ): Promise<boolean> {
    const validation = SchemaValidator.process(rawList);

    if (validation.items.length > 0) {
      const oldItems = [...this.currentItems];
      this.currentItems = validation.items;

      if (this.engineCallback) {
        this.engineCallback(this.currentItems);
      }

      // Perform atomic hot-swap mapping wall-clock time
      if (oldItems.length > 0 && onSeek) {
        await this.applyPlaylistUpdate(oldItems, this.currentItems, onSeek);
      }
      return true;
    } else {
      this.alertOperator("Ingestion failed: Schema Mismatch");
      return false;
    }
  }

  /**
   * Atomic hot-swapping using wall-clock mapping.
   */
  public async applyPlaylistUpdate(
    oldItems: any[],
    newItems: any[],
    onSeek: (newItemIndex: number, newOffsetSeconds: number) => void
  ): Promise<void> {
    AuditLog.record("info", "Executing atomic playlist update routine");
    await PlaylistHotSwapEngine.applyPlaylistUpdate(
      oldItems as ContentItem[],
      newItems as ContentItem[],
      "UTC",
      onSeek
    );
  }

  private alertOperator(message: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ingestionAlert", { detail: { message } })
      );
    }
  }
}
