/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SafeLocalStorage {
  private fallbackStore = new Map<string, string>();
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    try {
      if (typeof window === "undefined" || !("localStorage" in window) || window.localStorage === null) {
        return false;
      }
      const testKey = "__safe_storage_test__";
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  public getItem(key: string): string | null {
    if (this.isAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // Fallback to in-memory store
      }
    }
    return this.fallbackStore.has(key) ? this.fallbackStore.get(key) || null : null;
  }

  public setItem(key: string, value: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.fallbackStore.set(key, value);
  }

  public removeItem(key: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.fallbackStore.delete(key);
  }

  public clear(): void {
    if (this.isAvailable) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.fallbackStore.clear();
  }

  public get length(): number {
    if (this.isAvailable) {
      try {
        return window.localStorage.length;
      } catch (e) {
        // Fallback
      }
    }
    return this.fallbackStore.size;
  }

  public key(index: number): string | null {
    if (this.isAvailable) {
      try {
        return window.localStorage.key(index);
      } catch (e) {
        // Fallback
      }
    }
    const keys = Array.from(this.fallbackStore.keys());
    return keys[index] || null;
  }
}

export const safeLocalStorage = new SafeLocalStorage();
