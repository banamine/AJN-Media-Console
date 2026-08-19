import { PlaylistVault } from "./PlaylistVault";
import { putsDBValue } from "./IndexedDB";
import { IPTVChannel } from "../types";

export class PlaylistHealthChecker {
  private isChecking = false;

  public async runHealthCheck(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;
    console.log("[PlaylistHealthChecker] Starting background stream probe...");

    try {
      const channels = await PlaylistVault.getChannels();
      for (const ch of channels) {
        if (!ch.url) continue;

        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(ch.url, { method: "HEAD", signal: controller.signal });
          clearTimeout(tid);

          if (res.status === 404) {
            ch.active = false;
            ch.status = "offline";
            console.warn(`[PlaylistHealthChecker] Dead link detected (404): ${ch.name} -> ${ch.url}`);
          } else {
            ch.active = true;
            ch.status = "online";
          }
        } catch (err) {
          // Network errors or CORS blocking HEAD requests
          // Assume active unless explicit 404 response received
          ch.active = true;
          ch.status = "online";
        }

        try {
          await putsDBValue("channels", ch);
        } catch (e) {}
      }
    } catch (err) {
      console.error("[PlaylistHealthChecker] Probe failed:", err);
    } finally {
      this.isChecking = false;
      console.log("[PlaylistHealthChecker] Health check completed.");
    }
  }
}

export const playlistHealthChecker = new PlaylistHealthChecker();
