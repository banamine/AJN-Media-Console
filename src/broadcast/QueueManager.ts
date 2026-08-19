import { registry } from "./RegistryManager";
import { ThumbnailFactory, CogViewStyle } from "../components/broadcast/ThumbnailFactory";
import { BroadcastRegistry } from "./BroadcastRegistries";
import { QueuePersister } from "./QueuePersister";

export interface GenerationJob {
  id: string;
  showId: string;
  title: string;
  style: CogViewStyle;
  customPrompt?: string;
  controlHintPath?: string;
  priority: number; // Lower number = higher priority
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  addedAt: number;
}

/**
 * QueueManager: Traffic Controller for GPU Thumbnail & Poster Playout Generation.
 * Serializes jobs one-by-one to prevent GPU memory starvation / OOM errors.
 */
export class QueueManager {
  private static _instance: QueueManager;
  private jobs: Map<string, GenerationJob> = new Map();
  private queue: string[] = []; // Job IDs ordered by priority
  private activeJobId: string | null = null;
  private isProcessing: boolean = false;
  private persister: QueuePersister = new QueuePersister();

  public static get instance(): QueueManager {
    if (!this._instance) {
      this._instance = new QueueManager();
    }
    return this._instance;
  }

  constructor() {
    const restored = this.persister.load();
    if (restored && restored.jobs) {
      for (const j of restored.jobs) {
        this.jobs.set(j.id, j as GenerationJob);
      }
      this.queue = restored.queueIds.filter((id) => {
        const job = this.jobs.get(id);
        return job && job.status === "pending";
      });
      this.sortQueue();
      setTimeout(() => this.processNext(), 500);
    }

    // AI Pipeline Stand-Down: Automatic enqueueing disabled
    // registry.subscribe("registry_mutated", () => {
    //   this.enqueueMissingThumbnails("CINEMATIC");
    // });
  }

  /**
   * Enqueue a new generation task
   */
  public addJob(
    showId: string,
    style: CogViewStyle = "CINEMATIC",
    customPrompt?: string,
    priority: number = 1,
    controlHintPath?: string
  ): GenerationJob {
    // Check if already in queue
    const existingId = this.queue.find((id) => this.jobs.get(id)?.showId === showId);
    if (existingId) {
      const existing = this.jobs.get(existingId)!;
      return existing;
    }

    const showMeta = registry.getShow(showId);
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const job: GenerationJob = {
      id: jobId,
      showId,
      title: showMeta?.title || showId,
      style,
      customPrompt,
      controlHintPath,
      priority,
      status: "pending",
      addedAt: Date.now(),
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    this.sortQueue();

    this.broadcastState();
    this.processNext();

    return job;
  }

  /**
   * Batch enqueue missing thumbnails across the entire registry
   */
  public enqueueMissingThumbnails(style: CogViewStyle = "CINEMATIC"): number {
    const allMedia = BroadcastRegistry.instance.media.getAll();
    let count = 0;

    for (const item of allMedia) {
      if (!item.artwork || item.artwork.trim() === "") {
        this.addJob(item.id, style, undefined, 2);
        count++;
      }
    }

    return count;
  }

  /**
   * Retry a failed job
   */
  public retryJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "failed") return;

    job.status = "pending";
    job.error = undefined;
    if (!this.queue.includes(jobId)) {
      this.queue.push(jobId);
    }
    this.sortQueue();
    this.broadcastState();
    this.processNext();
  }

  /**
   * Remove or cancel job
   */
  public cancelJob(jobId: string): void {
    if (this.activeJobId === jobId) {
      // Cannot cancel actively running synchronous task easily, but can mark
    }
    this.queue = this.queue.filter((id) => id !== jobId);
    this.jobs.delete(jobId);
    this.broadcastState();
  }

  /**
   * Clear all completed jobs from history
   */
  public clearCompleted(): void {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === "completed") {
        this.jobs.delete(id);
      }
    }
    this.broadcastState();
  }

  public getSnapshot() {
    const pendingCount = this.queue.length;
    const activeJob = this.activeJobId ? this.jobs.get(this.activeJobId) || null : null;
    const allJobs = Array.from(this.jobs.values()).sort((a, b) => b.addedAt - a.addedAt);
    const failedJobs = allJobs.filter((j) => j.status === "failed");

    return {
      pendingCount,
      activeJob,
      allJobs,
      failedJobs,
      queueLength: pendingCount + (activeJob ? 1 : 0),
    };
  }

  private sortQueue(): void {
    this.queue.sort((aId, bId) => {
      const a = this.jobs.get(aId)!;
      const b = this.jobs.get(bId)!;
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.addedAt - b.addedAt;
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const nextId = this.queue.shift();
    if (!nextId) {
      this.isProcessing = false;
      return;
    }

    const job = this.jobs.get(nextId);
    if (!job) {
      this.isProcessing = false;
      this.processNext();
      return;
    }

    this.activeJobId = job.id;
    job.status = "processing";
    this.broadcastState();

    registry.trigger_mutation("queue_processing_started", { show_id: job.showId, jobId: job.id });

    try {
      const showMeta = registry.getShow(job.showId);
      await ThumbnailFactory.generate(
        job.showId,
        {
          id: job.showId,
          title: job.title,
          genre: showMeta?.genre,
          description: showMeta?.description,
        },
        undefined,
        job.style,
        job.customPrompt,
        job.controlHintPath
      );

      job.status = "completed";
      registry.trigger_mutation("queue_job_completed", { show_id: job.showId, jobId: job.id });
    } catch (err: any) {
      console.error(`[QueueManager] Job failed for ${job.showId}:`, err);
      job.status = "failed";
      job.error = err?.message || "Generation error occurred";
      registry.trigger_mutation("queue_job_failed", {
        show_id: job.showId,
        jobId: job.id,
        error: job.error,
      });
    } finally {
      this.activeJobId = null;
      this.isProcessing = false;
      this.broadcastState();
      // Yield slightly before processing next
      setTimeout(() => this.processNext(), 150);
    }
  }

  private broadcastState(): void {
    const snap = this.getSnapshot();
    registry.trigger_mutation("queue_updated", snap);
    this.persister.save(Array.from(this.jobs.values()) as any, this.queue);
  }
}

export const queueManager = QueueManager.instance;
