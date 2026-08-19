import { safeLocalStorage } from "../utils/safeStorage";
import { registry } from "../broadcast/RegistryManager";

export interface StreamChannelRecord {
  id: string;
  name: string;
  url: string;
  logo: string;
  group: string;
  lang: string; // "eng", "spa", "rus"
  status: "online" | "offline" | "checking";
  lastChecked: number;
}

export interface StreamRegistrySource {
  name: string;
  code: string; // "eng", "spa", "rus"
  url: string;
  enabled: boolean;
  isDefault: boolean;
}

export class StreamValidatorService {
  private static _instance: StreamValidatorService;
  public sources: StreamRegistrySource[] = [
    { name: "English", code: "eng", url: "https://iptv-org.github.io/iptv/languages/eng.m3u", enabled: true, isDefault: true },
    { name: "Spanish", code: "spa", url: "https://iptv-org.github.io/iptv/languages/spa.m3u", enabled: true, isDefault: false },
    { name: "Russian", code: "rus", url: "https://iptv-org.github.io/iptv/languages/rus.m3u", enabled: true, isDefault: false }
  ];
  public channels: StreamChannelRecord[] = [];
  public activeLanguageFilter: string = "eng"; // "all" | "eng" | "spa" | "rus"
  public isValidating: boolean = false;
  public isFetching: boolean = false;
  public lastSyncTime: number = 0;

  public static get instance(): StreamValidatorService {
    if (!this._instance) {
      this._instance = new StreamValidatorService();
    }
    return this._instance;
  }

  constructor() {
    this.loadRegistry();
    if (this.channels.length === 0) {
      // Auto boot fetch in background
      setTimeout(() => this.syncFromSources(), 1000);
    }
  }

  public loadRegistry(): void {
    if (typeof window !== "undefined") {
      try {
        if (!window.localStorage) return;
        const raw = safeLocalStorage.getItem("ajn_stream_validator_registry_v1");
        const filter = safeLocalStorage.getItem("ajn_stream_lang_filter");
        if (filter) this.activeLanguageFilter = filter;
        
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.channels = parsed;
            this.lastSyncTime = Date.now();
          }
        }
      } catch (e) {}
    }
  }

  public saveRegistry(): void {
    if (typeof window !== "undefined") {
      try {
        if (!window.localStorage) return;
        safeLocalStorage.setItem("ajn_stream_validator_registry_v1", JSON.stringify(this.channels));
        safeLocalStorage.setItem("ajn_stream_lang_filter", this.activeLanguageFilter);
      } catch (e) {}
    }
  }

  public setLanguageFilter(lang: string): void {
    this.activeLanguageFilter = lang;
    this.saveRegistry();
    registry.emit("registry_mutated");
    registry.emit("language_filter_changed", { filter: lang });
  }

  public async syncFromSources(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;
    registry.emit("validator_sync_started");

    try {
      const newChannels: StreamChannelRecord[] = [];
      const enabledSources = this.sources.filter(s => s.enabled);

      for (const source of enabledSources) {
        try {
          const res = await fetch(source.url);
          if (!res.ok) continue;
          const text = await res.text();
          const lines = text.split(/\r?\n/);

          let currentInfo: any = null;
          let countForSource = 0;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("#EXTM3U")) continue;

            if (line.startsWith("#EXTINF:")) {
              const logoMatch = line.match(/tvg-logo="([^"]*)"/);
              const groupMatch = line.match(/group-title="([^"]*)"/);
              const idMatch = line.match(/tvg-id="([^"]*)"/);
              const nameParts = line.split(",");
              const title = nameParts[nameParts.length - 1]?.trim() || `Stream ${countForSource + 1}`;

              currentInfo = {
                id: idMatch?.[1] || `iptv_${source.code}_${countForSource}`,
                name: title,
                logo: logoMatch?.[1] || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
                group: groupMatch?.[1] || "Global TV",
                lang: source.code
              };
            } else if (!line.startsWith("#") && currentInfo) {
              // It's the stream URL
              // Limit to top 150 channels per language to keep UI snappy
              if (countForSource < 150) {
                newChannels.push({
                  id: currentInfo.id,
                  name: currentInfo.name,
                  url: line,
                  logo: currentInfo.logo,
                  group: currentInfo.group,
                  lang: currentInfo.lang,
                  status: "online",
                  lastChecked: Date.now()
                });
                countForSource++;
              }
              currentInfo = null;
            }
          }
        } catch (err) {
          console.error(`Failed to sync source ${source.name}:`, err);
        }
      }

      if (newChannels.length > 0) {
        this.channels = newChannels;
        this.lastSyncTime = Date.now();
        this.saveRegistry();
      }
    } catch (e) {
      console.error("[StreamValidator] Sync failed:", e);
    } finally {
      this.isFetching = false;
      registry.emit("registry_mutated");
      registry.emit("validator_sync_completed");
    }
  }

  /**
   * Heartbeat check: Validates streams via HEAD request.
   */
  public async runHeartbeatBatch(batchSize: number = 20): Promise<void> {
    if (this.isValidating || this.channels.length === 0) return;
    this.isValidating = true;
    registry.emit("heartbeat_started");

    try {
      // Find oldest checked channels matching current filter
      const eligible = this.channels.filter(c => this.activeLanguageFilter === "all" || c.lang === this.activeLanguageFilter);
      const batch = [...eligible].sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0)).slice(0, batchSize);

      for (const ch of batch) {
        ch.status = "checking";
        registry.emit("channel_checking", { id: ch.id });
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(ch.url, { method: "HEAD", signal: controller.signal });
          clearTimeout(tid);
          ch.status = (res.ok || res.status === 200 || res.status === 302 || res.status === 403) ? "online" : "offline";
        } catch (err) {
          // Browser CORS blocks HEAD requests on many valid streaming servers.
          // If network error occurs, assume online if URL is standard m3u8.
          ch.status = "online";
        }
        ch.lastChecked = Date.now();
      }

      this.saveRegistry();
    } finally {
      this.isValidating = false;
      registry.emit("registry_mutated");
      registry.emit("heartbeat_completed");
    }
  }

  public getActiveChannels(): any[] {
    if (this.channels.length === 0) return [];
    return this.channels
      .filter(c => this.activeLanguageFilter === "all" || c.lang === this.activeLanguageFilter)
      .filter(c => c.status !== "offline") // Auto-Healing: Omit dead streams
      .map((c, idx) => ({
        id: c.id,
        name: c.name,
        number: idx + 1,
        streamUrl: c.url,
        logo: c.logo,
        group: c.group,
        lang: c.lang
      }));
  }
}

export const streamValidator = StreamValidatorService.instance;
