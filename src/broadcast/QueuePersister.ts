import { safeLocalStorage } from "../utils/safeStorage";
/**
 * Write-Ahead Queue Persister
 * Serializes queue state to disk/journal for crash recovery and state idempotency.
 */

export interface SerializedJob {
  id: string;
  showId: string;
  title: string;
  style: any;
  customPrompt?: string;
  controlHintPath?: string;
  priority: number;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  addedAt: number;
}

export class QueuePersister {
  private storageKey: string;

  constructor(storageKey: string = "broadcast_queue_journal_state_v1") {
    this.storageKey = storageKey;
  }

  /**
   * Save journal log of active and pending jobs
   */
  public save(jobs: SerializedJob[], queueIds: string[]): void {
    try {
      const payload = {
        jobs,
        queueIds,
        savedAt: Date.now(),
        version: "10.0"
      };
      if (typeof window !== "undefined" && window.localStorage) {
        safeLocalStorage.setItem(this.storageKey, JSON.stringify(payload));
      }
    } catch (err) {
      console.error("[QueuePersister] Write-ahead log failure:", err);
    }
  }

  /**
   * Load journal log from storage on cold boot / crash recovery
   */
  public load(): { jobs: SerializedJob[]; queueIds: string[] } | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = safeLocalStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.jobs)) {
            // On crash recovery: any job stuck in 'processing' must revert to 'pending'
            const restoredJobs = parsed.jobs.map((job: SerializedJob) => {
              if (job.status === "processing") {
                return { ...job, status: "pending" };
              }
              return job;
            });
            return {
              jobs: restoredJobs,
              queueIds: parsed.queueIds || []
            };
          }
        }
      }
    } catch (err) {
      console.error("[QueuePersister] Crash recovery read failure:", err);
    }
    return null;
  }

  /**
   * Clear journal log
   */
  public clear(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        safeLocalStorage.removeItem(this.storageKey);
      }
    } catch (e) {}
  }
}
