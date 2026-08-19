/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useCallback } from 'react';

// Shared module-level database connection manager to prevent lifecycle leakage
let sharedDbInstance: IDBDatabase | null = null;
let dbConnectionPromise: Promise<IDBDatabase> | null = null;

async function getClosedLoopDatabase(): Promise<IDBDatabase> {
  if (sharedDbInstance) return sharedDbInstance;
  if (dbConnectionPromise) return dbConnectionPromise;

  dbConnectionPromise = new Promise((resolve, reject) => {
    try {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB is not supported in this environment"));
        return;
      }
      const request = indexedDB.open('AJN_IPTV_DATABASE', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { autoIncrement: true });
        }
      };
      request.onsuccess = () => {
        sharedDbInstance = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });

  return dbConnectionPromise;
}

export const useTelemetry = (streamUrl: string, streamName: string) => {
  const eventQueueRef = useRef<any[]>([]);

  // Defer offline persistence engine execution out of high-priority UI cycles
  const commitToOfflineStorage = useCallback((events: any[]) => {
    const executeWrite = async () => {
      try {
        const db = await getClosedLoopDatabase();
        const tx = db.transaction(['events'], 'readwrite');
        const store = tx.objectStore('events');
        events.forEach(event => store.add({ ...event, streamUrl, streamName }));
      } catch (err) {
        console.error('Offline buffer extraction failure:', err);
      }
    };

    if (typeof window !== "undefined" && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => executeWrite());
    } else {
      setTimeout(() => executeWrite(), 1);
    }
  }, [streamUrl, streamName]);

  // Ensure clean teardown if needed (or keep shared instance alive safely)
  useEffect(() => {
    return () => {
      // Clear local operational queues on unmount
      eventQueueRef.current = [];
    };
  }, []);

  return { commitToOfflineStorage };
};
