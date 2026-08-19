import { safeLocalStorage } from "../utils/safeStorage";
import { registry, RegistryManager } from "./RegistryManager";
import { streamValidator } from "../services/StreamValidator";

/**
 * BroadcastExporter: The Playout Bridge
 * Exports registry data into industry-standard M3U8 and XMLTV formats.
 * Auto-updates on registry changes via the EventEmitter.
 */
export class BroadcastExporter {
  private static _instance: BroadcastExporter;
  public registry: RegistryManager;
  public m3u8Content: string = "";
  public xmltvContent: string = "";
  public lastUpdated: number = 0;
  public m3u8BlobUrl: string = "";
  public xmltvBlobUrl: string = "";

  public static get instance(): BroadcastExporter {
    if (!this._instance) {
      this._instance = new BroadcastExporter(registry);
    }
    return this._instance;
  }

  constructor(reg: RegistryManager) {
    this.registry = reg;

    // Subscribe to registry changes to trigger auto-export
    this.registry.subscribe("registry_mutated", () => this.refreshManifests());
    this.registry.subscribe("thumbnail_generated", () => this.refreshManifests());
    this.registry.subscribe("thumbnail_ready", () => this.refreshManifests());

    // Initial sync
    this.refreshManifests();
  }

  public refreshManifests(data?: any): void {
    try {
      this._writeM3U();
      this._writeXMLTV();
      this.lastUpdated = Date.now();
      
      // Notify UI subscribers
      this.registry.emit("manifests_updated", {
        timestamp: this.lastUpdated,
        m3u8: this.m3u8Content,
        xmltv: this.xmltvContent
      });
    } catch (err) {
      console.error("[BroadcastExporter] Failed to update manifests:", err);
    }
  }

  private _writeM3U(): void {
    const lines: string[] = ["#EXTM3U"];
    const activeChs = streamValidator.getActiveChannels();

    if (activeChs && activeChs.length > 0) {
      for (const ch of activeChs) {
        const logo = ch.logo || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg";
        lines.push(`#EXTINF:-1 tvg-id="${ch.id}" tvg-logo="${logo}" group-title="${ch.group || "Live TV"}", ${ch.name}`);
        lines.push(ch.streamUrl);
      }
    } else {
      const channels = this.registry.get_all_channels();
      for (const ch of channels) {
        const shows = this.registry.get_shows_by_channel(ch.id);
        for (const show of shows) {
          const logo = show.thumbnail_path || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg";
          lines.push(`#EXTINF:-1 tvg-id="${ch.id}" tvg-logo="${logo}", ${ch.name || "Channel"} - ${show.title}`);
          lines.push(`https://stream.ajn-broadcast.io/live/${ch.id}/${show.id}/master.m3u8`);
        }
      }
    }

    this.m3u8Content = lines.join("\n");
    if (typeof window !== "undefined" && window.URL && window.Blob) {
      if (this.m3u8BlobUrl) URL.revokeObjectURL(this.m3u8BlobUrl);
      try {
        this.m3u8BlobUrl = URL.createObjectURL(new Blob([this.m3u8Content], { type: "text/plain;charset=utf-8" }));
        safeLocalStorage.setItem("ajn_stream_playlist_m3u8", this.m3u8Content);
      } catch (e) {}
    }
  }

  private _writeXMLTV(): void {
    const activeChs = streamValidator.getActiveChannels();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="AJN-Broadcast-Suite">\n`;

    if (activeChs && activeChs.length > 0) {
      for (const ch of activeChs) {
        xml += `  <channel id="${ch.id}">\n`;
        xml += `    <display-name lang="${ch.lang || "en"}">${this._escapeXml(ch.name || "Channel")}</display-name>\n`;
        xml += `  </channel>\n`;
      }
      const nowStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) + " +0000";
      const stopStr = new Date(Date.now() + 3600000 * 4).toISOString().replace(/[-:T]/g, "").slice(0, 14) + " +0000";
      for (const ch of activeChs) {
        const icon = ch.logo || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg";
        xml += `  <programme start="${nowStr}" stop="${stopStr}" channel="${ch.id}">\n`;
        xml += `    <title lang="${ch.lang || "en"}">${this._escapeXml(ch.name)}</title>\n`;
        xml += `    <desc lang="${ch.lang || "en"}">Verified live broadcast stream playout for ${this._escapeXml(ch.name)}.</desc>\n`;
        xml += `    <icon src="${this._escapeXml(icon)}" />\n`;
        xml += `  </programme>\n`;
      }
    } else {
      const channels = this.registry.get_all_channels();
      for (const ch of channels) {
        xml += `  <channel id="${ch.id}">\n`;
        xml += `    <display-name lang="en">${this._escapeXml(ch.name || "Channel")}</display-name>\n`;
        xml += `  </channel>\n`;
      }
      const nowStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) + " +0000";
      const stopStr = new Date(Date.now() + 3600000 * 4).toISOString().replace(/[-:T]/g, "").slice(0, 14) + " +0000";
      for (const ch of channels) {
        const shows = this.registry.get_shows_by_channel(ch.id);
        for (const show of shows) {
          const icon = show.thumbnail_path || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg";
          xml += `  <programme start="${nowStr}" stop="${stopStr}" channel="${ch.id}">\n`;
          xml += `    <title lang="en">${this._escapeXml(show.title)}</title>\n`;
          xml += `    <desc lang="en">${this._escapeXml(show.description || "")}</desc>\n`;
          xml += `    <icon src="${this._escapeXml(icon)}" />\n`;
          xml += `  </programme>\n`;
        }
      }
    }

    xml += `</tv>`;
    this.xmltvContent = xml;

    if (typeof window !== "undefined" && window.URL && window.Blob) {
      if (this.xmltvBlobUrl) URL.revokeObjectURL(this.xmltvBlobUrl);
      try {
        this.xmltvBlobUrl = URL.createObjectURL(new Blob([this.xmltvContent], { type: "text/plain;charset=utf-8" }));
        safeLocalStorage.setItem("ajn_stream_guide_xml", this.xmltvContent);
      } catch (e) {}
    }
  }

  private _escapeXml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  public triggerManualSync(): void {
    this.refreshManifests();
  }
}

export const broadcastExporter = BroadcastExporter.instance;
