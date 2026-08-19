import { useState, useEffect } from "react";
import { BroadcastRegistry } from "./BroadcastRegistries";
import { MediaRegistryItem } from "../types";

/**
 * Global Registry Auto-Sync Framework
 * Plan #1: Observer Pattern & EventBus integration
 */

// 1. The EventEmitter Logic
export type EventListenerCallback = (data?: any) => void;

export class EventEmitter {
  private _listeners: Map<string, EventListenerCallback[]> = new Map();

  /**
   * Register a callback function to be invoked when an event triggers.
   */
  public subscribe(eventName: string, callback: EventListenerCallback): () => void {
    const list = this._listeners.get(eventName) || [];
    if (!list.includes(callback)) {
      list.push(callback);
      this._listeners.set(eventName, list);
    }
    return () => this.unsubscribe(eventName, callback);
  }

  /**
   * Remove a callback function from the event list.
   */
  public unsubscribe(eventName: string, callback: EventListenerCallback): void {
    const list = this._listeners.get(eventName);
    if (list) {
      this._listeners.set(eventName, list.filter(c => c !== callback));
    }
  }

  /**
   * Broadcast an event to all subscribers.
   * Executed on a copy of listeners outside any mutex lock to prevent deadlocks
   * if callbacks attempt to read the registry simultaneously.
   */
  public emit(eventName: string, data?: any): void {
    const callbacks = [...(this._listeners.get(eventName) || [])];
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (err) {
        console.error(`[RegistryEmitter] Error in subscriber for '${eventName}':`, err);
      }
    }
  }
}

// 2. Integration into RegistryManager
export class RegistryManager extends EventEmitter {
  public registryPath: string;
  private static _singleton: RegistryManager;

  public static get instance(): RegistryManager {
    if (!this._singleton) {
      this._singleton = new RegistryManager("./registry.json");
    }
    return this._singleton;
  }

  constructor(registryPath: string = "./registry.json") {
    super();
    this.registryPath = registryPath;

    // Bridge BroadcastRegistry mutations into global bus
    BroadcastRegistry.instance.onChange(() => {
      this.emit("registry_mutated", {
        revision: BroadcastRegistry.instance.getRevision(),
        timestamp: BroadcastRegistry.instance.lastSyncTimestamp
      });
    });
  }

  /**
   * Updates media asset thumbnail and emits event outside the lock.
   */
  public update_thumbnail(show_id: string, thumbnail_path: string, style: string = "cinematic"): void {
    this.updateThumbnail(show_id, thumbnail_path, style);
  }

  public updateThumbnail(showId: string, thumbnailPath: string, style: string = "cinematic"): void {
    const bRegistry = BroadcastRegistry.instance;

    // 1. Update the Data (Atomic update inside registry structure)
    const allMedia = bRegistry.media.getAll();
    const mediaItem = bRegistry.media.getById(showId) || allMedia.find(m => m.title === showId || m.id === showId);
    
    if (mediaItem) {
      mediaItem.artwork = thumbnailPath;
      if (!mediaItem.metadata) mediaItem.metadata = {};
      mediaItem.metadata.thumbnail = thumbnailPath;
      mediaItem.metadata.poster = thumbnailPath;
      mediaItem.metadata.style = style;
      bRegistry.media.register(mediaItem);
    }

    // 2. Emit the event (Outside the lock!)
    const eventPayload = {
      show_id: showId,
      showId: showId,
      path: thumbnailPath,
      style: style
    };

    this.emit("thumbnail_generated", eventPayload);
    this.emit("thumbnail_ready", eventPayload);
  }

  /**
   * Fetch Show metadata by ID or title
   */
  public get_show(showId: string): any {
    return this.getShow(showId);
  }

  public getShow(showId: string): any {
    const allMedia = BroadcastRegistry.instance.media.getAll();
    const mediaItem = BroadcastRegistry.instance.media.getById(showId) || allMedia.find(m => m.title === showId || m.id === showId);
    
    if (mediaItem) {
      return {
        id: mediaItem.id,
        title: mediaItem.title,
        genre: mediaItem.metadata?.genre || "Broadcast Core",
        description: mediaItem.metadata?.description || `Authoritative broadcast presentation for ${mediaItem.title}.`,
        artwork: mediaItem.artwork
      };
    }

    return {
      id: showId,
      title: showId,
      genre: "Television Core",
      description: `Production broadcast master feed for ${showId}.`
    };
  }

  public get_all_channels(): any[] {
    const chs = BroadcastRegistry.instance.channels.getAll();
    if (chs.length === 0) {
      return [
        { id: "ch_1", name: "AJN Prime Broadcast", number: 1 },
        { id: "ch_2", name: "AJN Cinema HD", number: 2 },
        { id: "ch_3", name: "AJN News Live", number: 3 }
      ];
    }
    return chs;
  }

  public get_shows_by_channel(channelId: string): any[] {
    const allMedia = BroadcastRegistry.instance.media.getAll();
    if (allMedia.length === 0) {
      return [
        { id: "show_101", title: "Midnight Playout Special", description: "Authoritative broadcast master presentation.", thumbnail_path: "" },
        { id: "show_102", title: "Global Evening News", description: "World syndicate nightly news playout.", thumbnail_path: "" },
        { id: "show_103", title: "Classic Cinema Showcase", description: "Digitally restored cinematic master.", thumbnail_path: "" }
      ];
    }
    return allMedia.map(m => ({
      id: m.id,
      title: m.title,
      description: m.metadata?.description || `Authoritative broadcast feed for ${m.title}.`,
      thumbnail_path: m.artwork || m.metadata?.thumbnail || ""
    }));
  }

  public trigger_mutation(eventType: string, data?: any): void {
    this.emit(eventType, data);
  }
}

export const registry = RegistryManager.instance;

// Reactive UI Subscriber Hooks & Atomic Update Functions

/**
 * Subscriber Hook: useRegistrySync
 * Automatically subscribes/unsubscribes to global registry mutations.
 */
export function useRegistrySync() {
  const [revision, setRevision] = useState(() => BroadcastRegistry.instance.getRevision());
  const [timestamp, setTimestamp] = useState(() => BroadcastRegistry.instance.lastSyncTimestamp);

  useEffect(() => {
    const handleMutate = () => {
      setRevision(BroadcastRegistry.instance.getRevision());
      setTimestamp(BroadcastRegistry.instance.lastSyncTimestamp);
    };
    const unsub = registry.subscribe("registry_mutated", handleMutate);
    return () => unsub();
  }, []);

  return { revision, timestamp };
}

/**
 * Subscriber Hook: useRegistryEvent
 * Subscribes any React component to a specific event on the global Registry bus.
 */
export function useRegistryEvent<T = any>(eventName: string, callback: (data: T) => void) {
  useEffect(() => {
    const unsub = registry.subscribe(eventName, callback);
    return () => unsub();
  }, [eventName, callback]);
}

/**
 * The "Atomic Update" Function Hook: useAtomicShowThumbnail
 * Ensures that when an asset path is updated, ONLY the affected cell/card re-renders.
 */
export function useAtomicShowThumbnail(showId: string, initialPath?: string): string | undefined {
  const [path, setPath] = useState<string | undefined>(initialPath);

  useEffect(() => {
    setPath(initialPath);
  }, [initialPath]);

  useEffect(() => {
    const handleThumb = (data: any) => {
      if (data && (data.show_id === showId || data.showId === showId)) {
        setPath(data.path);
      }
    };
    const unsub1 = registry.subscribe("thumbnail_generated", handleThumb);
    const unsub2 = registry.subscribe("thumbnail_ready", handleThumb);
    return () => {
      unsub1();
      unsub2();
    };
  }, [showId]);

  return path;
}
