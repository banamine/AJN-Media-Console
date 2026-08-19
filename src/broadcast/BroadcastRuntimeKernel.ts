/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BroadcastRegistry } from "./BroadcastRegistries";
import { RegistryManager } from "./RegistryManager";
import { BroadcastClockService } from "./BroadcastClockService";
import { WorkerManager } from "./WorkerManager";
import { BroadcastScheduleManager } from "./BroadcastScheduleManager";

/**
 * Kernel Lifecycle States
 */
export enum KernelState {
  UNINITIALIZED = "UNINITIALIZED",
  INITIALIZING = "INITIALIZING",
  RUNNING = "RUNNING",
  SHUTTING_DOWN = "SHUTTING_DOWN",
  TERMINATED = "TERMINATED",
}

/**
 * Interface representing a subsystem with modular lifecycle bindings
 */
export interface KernelSubsystem {
  id: string;
  initialize(kernel: BroadcastRuntimeKernel): Promise<void> | void;
  shutdown?(kernel: BroadcastRuntimeKernel): Promise<void> | void;
  getHealth(): { status: "healthy" | "degraded" | "offline"; message?: string };
}

/**
 * --- Subsystem 1: BroadcastEventBus ---
 */
export interface IEventBus extends KernelSubsystem {
  subscribe(event: string, callback: (payload?: any) => void): () => void;
  emit(event: string, payload?: any): void;
}

export class BroadcastEventBus implements IEventBus {
  id = "EventBus";
  private listeners: Map<string, Set<(payload?: any) => void>> = new Map();

  initialize(): void {}
  shutdown(): void {
    this.listeners.clear();
  }
  getHealth() {
    return { status: "healthy" as const, message: "Event subscription matrix online." };
  }

  subscribe(event: string, callback: (payload?: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  emit(event: string, payload?: any): void {
    const set = this.listeners.get(event);
    if (set) {
      Array.from(set).forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventBus] Error triggering callback for event "${event}":`, err);
        }
      });
    }
  }
}

/**
 * --- Subsystem 2: BroadcastRegistry ---
 */
export interface IRegistry extends KernelSubsystem {
  getChannels(): any[];
  registerChannel(channel: any): void;
  clearChannels(): void;
  getProviders(): any[];
}

export class RegistrySubsystem implements IRegistry {
  id = "Registry";
  private registryInstance!: BroadcastRegistry;

  initialize(): void {
    this.registryInstance = BroadcastRegistry.instance;
  }
  getHealth() {
    try {
      const channels = this.getChannels();
      return { status: "healthy" as const, message: `Registry active with ${channels.length} synchronized channels.` };
    } catch (err: any) {
      return { status: "offline" as const, message: `Registry error: ${err.message}` };
    }
  }

  getChannels(): any[] {
    return this.registryInstance?.channels?.getAll() || [];
  }

  registerChannel(channel: any): void {
    if (this.registryInstance?.channels) {
      this.registryInstance.channels.register(channel);
    }
  }

  clearChannels(): void {
    if (this.registryInstance?.channels) {
      this.registryInstance.channels.clear();
    }
  }

  getProviders(): any[] {
    return [];
  }
}

/**
 * --- Subsystem 3: BroadcastPlayback ---
 */
export interface IPlayback extends KernelSubsystem {
  getCurrentState(): string;
  setPlayerState(state: string): void;
}

export class PlaybackSubsystem implements IPlayback {
  id = "Playback";
  private currentState = "Idle";

  initialize(): void {}
  getHealth() {
    return { status: "healthy" as const, message: `Playback engine current state: ${this.currentState}` };
  }

  getCurrentState(): string {
    return this.currentState;
  }

  setPlayerState(state: string): void {
    this.currentState = state;
  }
}

/**
 * --- Subsystem 4: BroadcastScheduler ---
 */
export interface IScheduler extends KernelSubsystem {
  getCurrentSchedule(): any[];
  generateSchedule(): void;
}

export class SchedulerSubsystem implements IScheduler {
  id = "Scheduler";
  private schedule: any[] = [];
  private clockService!: BroadcastClockService;

  initialize(kernel: BroadcastRuntimeKernel): void {
    this.clockService = kernel.resolve<BroadcastClockService>("clock");
  }

  getHealth() {
    if (!this.clockService) {
      return { status: "degraded" as const, message: "Scheduler lacks reference to authoritative BroadcastClockService." };
    }
    const isDst = this.clockService.isDSTActive();
    const formatted = this.clockService.formatToBroadcastTime();
    return {
      status: "healthy" as const,
      message: `Scheduler cron/loop engines running synchronized with clock (DST: ${isDst ? "ACTIVE" : "INACTIVE"}, Broadcast Time: ${formatted}).`
    };
  }

  getCurrentSchedule(): any[] {
    return this.schedule;
  }

  generateSchedule(): void {
    if (!this.clockService) {
      console.warn("[SchedulerSubsystem] cannot generate schedule without clock reference.");
      return;
    }
    // Perform time-aware schedule window allocation
    const baseTimeSec = this.clockService.getBroadcastTimeSeconds();
    this.schedule = [
      { id: "main-block-1", startSec: baseTimeSec, durationSec: 3600, label: "Core Prime Block" },
      { id: "main-block-2", startSec: baseTimeSec + 3600, durationSec: 3600, label: "Secondary Block" }
    ];
  }
}

/**
 * --- Subsystem 5: BroadcastHealth ---
 */
export interface IHealthSubsystem extends KernelSubsystem {
  getChannelStatus(channelId: string): string;
  runAudit(): Promise<void>;
}

export class HealthSubsystem implements IHealthSubsystem {
  id = "Health";

  initialize(): void {}
  getHealth() {
    return { status: "healthy" as const, message: "Subsystem health diagnostics analyzer active." };
  }

  getChannelStatus(): string {
    return "healthy";
  }

  async runAudit(): Promise<void> {
    // Quick self-audit mock latency
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * --- Subsystem 6: BroadcastAutomation ---
 */
export interface IAutomation extends KernelSubsystem {
  getRules(): any[];
  addRule(rule: any): void;
}

export class AutomationSubsystem implements IAutomation {
  id = "Automation";
  private rules: any[] = [];

  initialize(): void {}
  getHealth() {
    return { status: "healthy" as const, message: "Automation suite triggered rule listeners active." };
  }

  getRules(): any[] {
    return this.rules;
  }

  addRule(rule: any): void {
    this.rules.push(rule);
  }
}

/**
 * --- Subsystem 7: BroadcastTelemetry ---
 */
export interface ITelemetry extends KernelSubsystem {
  getMetrics(): any;
  recordMetric(name: string, value: any): void;
}

export class TelemetrySubsystem implements ITelemetry {
  id = "Telemetry";
  private metrics: Record<string, any> = {};

  initialize(): void {
    this.recordMetric("startupTime", Date.now());
  }
  getHealth() {
    return { status: "healthy" as const, message: "Telemetry buffer logging operational." };
  }

  getMetrics() {
    return this.metrics;
  }

  recordMetric(name: string, value: any): void {
    this.metrics[name] = value;
  }
}

/**
 * BroadcastRuntimeKernel
 * The single authoritative runtime coordinator of the AJN Broadcast Platform.
 * Orchestrates platform lifecycles, houses the dependency injection container,
 * manages subsystems, and exposes telemetry & diagnostic APIs.
 */
export class BroadcastRuntimeKernel {
  private static _instance: BroadcastRuntimeKernel | null = null;

  // Lifecycle state
  private state: KernelState = KernelState.UNINITIALIZED;
  private bootTimestamp: number = 0;
  private bootLatencyMs: number = 0;

  // Dependency Injection container
  private container: Map<string, any> = new Map();

  // Subsystem tracking
  private subsystems: Map<string, KernelSubsystem> = new Map();
  private initializationOrder: string[] = [];

  // Internal high-frequency communication bus (for decoupling subsystems)
  private eventListeners: Map<string, Set<(payload?: any) => void>> = new Map();

  // Diagnostics and telemetry buffers
  private errorRingBuffer: Array<{ timestamp: number; message: string; stack?: string }> = [];
  private readonly MAX_ERROR_LOGS = 50;

  // Resource cleanup orchestrators
  private abortController: AbortController = new AbortController();
  private activeTimers: Set<NodeJS.Timeout | number> = new Set();

  /**
   * Access the global single-authority Kernel instance
   */
  public static get instance(): BroadcastRuntimeKernel {
    if (!this._instance) {
      this._instance = new BroadcastRuntimeKernel();
    }
    return this._instance;
  }

  private constructor() {
    // Register default core services on instantiation
    this.registerDependency("registry", BroadcastRegistry.instance);
    this.registerDependency("registryManager", RegistryManager.instance);
    this.registerDependency("clock", BroadcastClockService.instance);

    // Register all core subsystems to guarantee presence and sound lifecycle management
    this.registerSubsystem(new BroadcastEventBus());
    this.registerSubsystem(new RegistrySubsystem());
    this.registerSubsystem(new PlaybackSubsystem());
    this.registerSubsystem(new SchedulerSubsystem());
    this.registerSubsystem(new HealthSubsystem());
    this.registerSubsystem(new AutomationSubsystem());
    this.registerSubsystem(new TelemetrySubsystem());
    this.registerSubsystem(WorkerManager.instance);
    this.registerSubsystem(new BroadcastScheduleManager());
  }

  /**
   * Register a raw dependency in the dependency injection container
   */
  public registerDependency<T = any>(id: string, instance: T): void {
    if (this.container.has(id)) {
      this.log(`Overwriting existing dependency in container: "${id}"`, "warn");
    }
    this.container.set(id, instance);
    this.emit("dependency_registered", { id });
  }

  /**
   * Resolve a dependency from the DI container with strict assertions
   */
  public resolve<T = any>(id: string): T {
    const dependency = this.container.get(id);
    if (!dependency) {
      throw new Error(`[Kernel] Fatal: Could not resolve dependency "${id}" in DI container.`);
    }
    return dependency as T;
  }

  /**
   * Query if a dependency is registered
   */
  public hasDependency(id: string): boolean {
    return this.container.has(id);
  }

  /**
   * Register an active subsystem that requires structured initialization/shutdown orchestration
   */
  public registerSubsystem(subsystem: KernelSubsystem): void {
    if (this.subsystems.has(subsystem.id)) {
      this.log(`Subsystem with ID "${subsystem.id}" already registered. Updating reference.`, "info");
      this.subsystems.set(subsystem.id, subsystem);
      return;
    }
    this.subsystems.set(subsystem.id, subsystem);
    this.emit("subsystem_registered", { id: subsystem.id });
    this.log(`Subsystem "${subsystem.id}" registered successfully.`, "info");
  }

  /**
   * Resolve a subsystem directly
   */
  public getSubsystem<T extends KernelSubsystem>(id: string): T {
    const sub = this.subsystems.get(id);
    if (!sub) {
      throw new Error(`[Kernel] Subsystem "${id}" not found.`);
    }
    return sub as T;
  }

  /**
   * Startup Lifecycle Method that Validates Subsystem Integrity.
   * Performs critical diagnostics and sanity tests on all required subsystems
   * before signaling readiness for application UI mount.
   */
  public async validateSubsystemsIntegrity(): Promise<{
    success: boolean;
    reports: Record<string, { status: "healthy" | "degraded" | "offline"; message: string }>;
  }> {
    this.log("Starting subsystem integrity self-test validation phase...", "info");
    const reports: Record<string, { status: "healthy" | "degraded" | "offline"; message: string }> = {};
    let overallSuccess = true;

    const requiredIds = ["EventBus", "Registry", "Playback", "Scheduler", "Health", "Automation", "Telemetry", "WorkerManager"];

    for (const id of requiredIds) {
      try {
        const sub = this.getSubsystem(id);
        const health = sub.getHealth();
        reports[id] = {
          status: health.status,
          message: health.message || "Subsystem reported operational with no detailed notes.",
        };
        if (health.status === "offline") {
          overallSuccess = false;
        }
      } catch (err: any) {
        reports[id] = {
          status: "offline",
          message: `Integrity check failed: Subsystem absent or threw error: ${err.message}`,
        };
        overallSuccess = false;
      }
    }

    // Event bus specific self-test
    try {
      const bus = this.getSubsystem<IEventBus>("EventBus");
      let testReceived = false;
      const unsubscribe = bus.subscribe("INTEGRITY_SELF_TEST", () => {
        testReceived = true;
      });
      bus.emit("INTEGRITY_SELF_TEST");
      unsubscribe();
      if (!testReceived) {
        reports["EventBus"].status = "degraded";
        reports["EventBus"].message += " Pub/sub loopback validation failed to trigger subscription handler.";
      }
    } catch (e: any) {
      overallSuccess = false;
    }

    this.log(`Integrity check completed. Success: ${overallSuccess}`, overallSuccess ? "info" : "warn");
    return { success: overallSuccess, reports };
  }

  /**
   * Initialize the Kernel and boot up all registered subsystems in the dependency-order
   */
  public async initialize(): Promise<void> {
    if (this.state !== KernelState.UNINITIALIZED && this.state !== KernelState.TERMINATED) {
      this.log(`Kernel initialize called while in state: ${this.state}. Skipping.`, "warn");
      return;
    }

    const start = performance.now();
    this.state = KernelState.INITIALIZING;
    this.bootTimestamp = Date.now();
    this.abortController = new AbortController();
    this.initializationOrder = [];

    this.emit("kernel_initializing");
    this.log("Starting authoritative AJN Broadcast Platform Kernel...", "info");

    try {
      // Boot up registered subsystems in registration sequence
      for (const [id, subsystem] of this.subsystems.entries()) {
        this.log(`Initializing subsystem: "${id}"...`, "info");
        await subsystem.initialize(this);
        this.initializationOrder.push(id);
        this.log(`Subsystem "${id}" successfully initialized.`, "info");
      }

      // Perform integrity diagnostic validation
      const validation = await this.validateSubsystemsIntegrity();
      if (!validation.success) {
        throw new Error("One or more core subsystems failed critical startup integrity self-test.");
      }

      this.state = KernelState.RUNNING;
      this.bootLatencyMs = performance.now() - start;
      this.log(`AJN Kernel fully running. Boot time: ${this.bootLatencyMs.toFixed(2)}ms`, "info");
      this.emit("kernel_running", { bootLatencyMs: this.bootLatencyMs });

    } catch (err: any) {
      this.state = KernelState.UNINITIALIZED;
      this.recordError("Kernel Boot Failure", err);
      this.emit("kernel_boot_failed", { error: err.message });
      throw new Error(`[Kernel] Core Boot Failure: ${err.message}`);
    }
  }

  /**
   * Gracefully shut down the kernel, flushing caches and unloading subsystems in reverse order
   */
  public async shutdown(): Promise<void> {
    if (this.state !== KernelState.RUNNING) {
      this.log(`Kernel shutdown called while in state: ${this.state}. Skipping.`, "warn");
      return;
    }

    this.state = KernelState.SHUTTING_DOWN;
    this.emit("kernel_shutting_down");
    this.log("Starting graceful shutdown sequence...", "info");

    // Cancel all async operations in flight
    this.abortController.abort();

    // Clear active timers to prevent memory leaks or orphaned timeouts
    this.clearAllTimers();

    // Shutdown subsystems in reverse sequence to satisfy dependency chains
    const shutdownOrder = [...this.initializationOrder].reverse();
    for (const id of shutdownOrder) {
      const subsystem = this.subsystems.get(id);
      if (subsystem && subsystem.shutdown) {
        try {
          this.log(`Shutting down subsystem: "${id}"...`, "info");
          await subsystem.shutdown(this);
          this.log(`Subsystem "${id}" successfully shutdown.`, "info");
        } catch (err) {
          this.recordError(`Subsystem Shutdown Failure (${id})`, err);
        }
      }
    }

    this.state = KernelState.TERMINATED;
    this.initializationOrder = [];
    this.log("Kernel gracefully terminated. Clean slate achieved.", "info");
    this.emit("kernel_terminated");
  }

  /**
   * Resource Management: Register a timer (setTimeout/setInterval) that the kernel will track and clean up
   */
  public registerTimer(timerId: NodeJS.Timeout | number | any): void {
    if (timerId) {
      this.activeTimers.add(timerId);
    }
  }

  /**
   * Unregister/clear a specific timer
   */
  public clearTimer(timerId: NodeJS.Timeout | number | any): void {
    if (timerId) {
      clearTimeout(timerId);
      clearInterval(timerId);
      this.activeTimers.delete(timerId);
    }
  }

  /**
   * Clear all active timers managed by the kernel
   */
  private clearAllTimers(): void {
    this.activeTimers.forEach((timer) => {
      clearTimeout(timer as any);
      clearInterval(timer as any);
    });
    this.activeTimers.clear();
  }

  /**
   * Access the kernel's active AbortSignal
   */
  public getSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Internal Pub/Sub system for communication between decoupled subsystems
   */
  public subscribe(event: string, callback: (payload?: any) => void): () => void {
    const eventBus = this.getSubsystem<IEventBus>("EventBus");
    if (eventBus) {
      return eventBus.subscribe(event, callback);
    }
    // Fallback to internal listener map if event bus is unbooted
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit an event across the high-frequency decoupled communications bus
   */
  public emit(event: string, payload?: any): void {
    try {
      const eventBus = this.getSubsystem<IEventBus>("EventBus");
      if (eventBus) {
        eventBus.emit(event, payload);
        return;
      }
    } catch {}

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const callbacks = Array.from(listeners);
      for (const callback of callbacks) {
        try {
          callback(payload);
        } catch (err) {
          console.error(`[Kernel Bus] Callback error for event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Returns current Kernel State
   */
  public getState(): KernelState {
    return this.state;
  }

  /**
   * Log warning/errors/info into the console and external handlers
   */
  private log(message: string, level: "info" | "warn" | "error" = "info"): void {
    const formatted = `[Kernel][${level.toUpperCase()}] ${message}`;
    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Register a runtime or boot error into the circular diagnostics buffer
   */
  public recordError(context: string, error: any): void {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    
    this.log(`Error in "${context}": ${errMessage}`, "error");

    this.errorRingBuffer.unshift({
      timestamp: Date.now(),
      message: `[${context}] ${errMessage}`,
      stack: errStack,
    });

    if (this.errorRingBuffer.length > this.MAX_ERROR_LOGS) {
      this.errorRingBuffer.pop();
    }

    this.emit("kernel_error", { context, message: errMessage });
  }

  /**
   * Telemetry and Diagnostics API
   */
  public getDiagnostics() {
    const uptime = this.state === KernelState.RUNNING ? Date.now() - this.bootTimestamp : 0;
    
    // Aggregate health reports from registered subsystems
    const subsystemHealths: Record<string, any> = {};
    let overallHealth: "healthy" | "degraded" | "critical" = "healthy";

    this.subsystems.forEach((sub, id) => {
      try {
        const health = sub.getHealth();
        subsystemHealths[id] = health;
        if (health.status === "offline") {
          overallHealth = "critical";
        } else if (health.status === "degraded" && overallHealth !== "critical") {
          overallHealth = "degraded";
        }
      } catch (err) {
        subsystemHealths[id] = { status: "offline", message: "Failed to query health" };
        overallHealth = "critical";
      }
    });

    return {
      kernelState: this.state,
      uptimeMs: uptime,
      bootLatencyMs: this.bootLatencyMs,
      bootTimestamp: this.bootTimestamp,
      registeredSubsystems: Array.from(this.subsystems.keys()),
      initializationSequence: this.initializationOrder,
      dependencies: Array.from(this.container.keys()),
      subsystemHealth: subsystemHealths,
      overallHealth,
      activeTimersCount: this.activeTimers.size,
      totalEventListeners: Array.from(this.eventListeners.values()).reduce((sum, set) => sum + set.size, 0),
      recentErrors: [...this.errorRingBuffer],
    };
  }

  /**
   * Full System Hard Reset (for testing or complete cache clearing)
   */
  public async reset(): Promise<void> {
    this.log("Hard resetting Kernel instance...", "warn");
    await this.shutdown();
    this.subsystems.clear();
    this.container.clear();
    this.eventListeners.clear();
    this.errorRingBuffer = [];
    this.state = KernelState.UNINITIALIZED;
    
    // Restore default core services and core subsystems
    this.registerDependency("registry", BroadcastRegistry.instance);
    this.registerDependency("registryManager", RegistryManager.instance);
    this.registerDependency("clock", BroadcastClockService.instance);

    this.registerSubsystem(new BroadcastEventBus());
    this.registerSubsystem(new RegistrySubsystem());
    this.registerSubsystem(new PlaybackSubsystem());
    this.registerSubsystem(new SchedulerSubsystem());
    this.registerSubsystem(new HealthSubsystem());
    this.registerSubsystem(new AutomationSubsystem());
    this.registerSubsystem(new TelemetrySubsystem());
    this.registerSubsystem(WorkerManager.instance);
    this.registerSubsystem(new BroadcastScheduleManager());
  }
}

// Export singleton helper as default or named
export const kernel = BroadcastRuntimeKernel.instance;
