import { safeLocalStorage } from "../utils/safeStorage";
import { putsDBValue, getDBValue } from "../services/IndexedDB";

export interface PlayoutSnapshot {
  url: string;
  title: string;
  seekPosition: number;
  exitTime: number;
}

class PlayoutStore {
  private snapshot: PlayoutSnapshot | null = null;

  saveSnapshot(snapshot: PlayoutSnapshot) {
    this.snapshot = snapshot;
    try {
      safeLocalStorage.setItem("ajn_playout_snapshot", JSON.stringify(snapshot));
    } catch (e) {}
    // Save to IndexedDB vault
    putsDBValue("settings", { key: "global_playout_snapshot", value: snapshot }).catch(() => {});
  }

  getSnapshot(): PlayoutSnapshot | null {
    if (this.snapshot) return this.snapshot;
    try {
      const stored = safeLocalStorage.getItem("ajn_playout_snapshot");
      if (stored) {
        this.snapshot = JSON.parse(stored);
        return this.snapshot;
      }
    } catch (e) {}
    return null;
  }

  async loadSnapshotFromVault(): Promise<PlayoutSnapshot | null> {
    const snap = this.getSnapshot();
    if (snap) return snap;
    try {
      const stored = await getDBValue("settings", "global_playout_snapshot");
      if (stored && stored.value) {
        this.snapshot = stored.value;
        return this.snapshot;
      }
    } catch (e) {}
    return null;
  }
}

export const playoutStore = new PlayoutStore();
