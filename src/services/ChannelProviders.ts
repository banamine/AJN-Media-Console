import { validateStreamURL } from "../utils/categoryParser";
import { fetchArchiveCollectionFiles, parseArchiveManifest, parseSemanticDate } from "../utils/semanticResolver";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


export interface PlaybackAction {
  action: "embed" | "external";
  url: string;
  title: string;
  seekPosition?: number;
}

export interface ChannelMetadata {
  title: string;
  category: string;
  thumbnail?: string;
  episodes?: any[];
}

export interface ChannelProvider {
  validate(source: string): Promise<boolean>;
  getPlaybackAction(channel: any, block?: any): PlaybackAction;
  getMetadata(channel: any, muxFiles?: Record<string, string[]>): Promise<ChannelMetadata>;
  checkHealth?(source: string): Promise<{ isLive: boolean; message: string }>;
}

export class RSSChannelProvider implements ChannelProvider {
  async validate(source: string): Promise<boolean> {
    if (!source || !source.startsWith("http")) return false;
    try {
      const response = await fetch(source, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  getPlaybackAction(channel: any, block?: any): PlaybackAction {
    return {
      action: "embed",
      url: block?.episode?.url || channel.source,
      title: block ? `${channel.name} · ${block.episode.title}` : channel.name,
      seekPosition: block?.seekPositionAtStart || 0
    };
  }

  async getMetadata(channel: any): Promise<ChannelMetadata> {
    const source = channel.source;
    let xmlText = "";
    let episodes: any[] = [];

    // Attempt to fetch via proxy first if it's the AJN feed
    const isAJN = source && (source.includes("alexjones.media") || source.includes("ajn"));
    if (isAJN) {
      try {
        const res = await fetch(BACKEND_URL + "/api/ajn-archive");
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (data.success && data.episodes?.length > 0) {
              episodes = data.episodes
                .filter((ep: any) => {
                const channelNameLower = channel.name.toLowerCase();
                if ((channelNameLower.includes("warroom") || channelNameLower.includes("war room")) && ep.show !== "War Room") {
                  return false;
                }
                return true;
              })
              .map((ep: any) => {
                const pubDate = ep.pubDate ? new Date(ep.pubDate) : new Date();
                const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                const properDateFormatted = pubDate.toLocaleDateString('en-US', dateOpts);
                const properTimeFormatted = pubDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                return {
                  id: ep.videoUrl,
                  title: ep.title,
                  durationInSeconds: 3600, // Standard Hour blocks
                  url: ep.videoUrl,
                  thumbnail: channel.logo || "https://archive.org/download/daily-highlights/lmbsa.png",
                  plot: `Original Airing: ${properDateFormatted} at ${properTimeFormatted}. Mode: RSS Syndicated Playout.`,
                  genre: ep.show || "News",
                  rating: "TV-14",
                  properDateFormatted,
                  properHour: ep.hour || "Full Show",
                  pubDate: ep.pubDate
                };
              });
            }
          }
        }
      } catch (err) {
        console.warn("RSS Provider proxy fetch failed, trying CORS fallback:", err);
      }
    }

    if (episodes.length === 0 && source) {
      // Fallback direct/CORS parsing
      try {
        const url = `/api/stream-proxy?url=${encodeURIComponent(source)}`;
        const response = await fetch(url);
        if (response.ok) {
          xmlText = await response.text();
        }
      } catch (err) {
        console.error("CORS fetch failed for RSS:", err);
      }

      if (!xmlText) {
        try {
          const response = await fetch(source);
          if (response.ok) xmlText = await response.text();
        } catch {}
      }

      if (xmlText) {
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
          const itemContent = match[1];

          let title = "";
          const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
          if (titleMatch) title = titleMatch[1].trim();

          let videoUrl = "";
          const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]+)"/);
          if (enclosureMatch) videoUrl = enclosureMatch[1].trim();

          if (!videoUrl || (!videoUrl.includes(".m4v") && !videoUrl.includes(".mp4") && !videoUrl.includes(".mp3"))) {
            continue;
          }

          let pubDateStr = "";
          const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
          if (pubDateMatch) pubDateStr = pubDateMatch[1].trim();

          const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
          const year = pubDate.getFullYear();
          const month = String(pubDate.getMonth() + 1).padStart(2, "0");
          const day = String(pubDate.getDate()).padStart(2, "0");
          const dateKey = `${year}-${month}-${day}`;

          const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
          const properDateFormatted = pubDate.toLocaleDateString('en-US', dateOpts);
          const properTimeFormatted = pubDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

          let show = "Alex Jones Show";
          const titleLower = title.toLowerCase();
          if (titleLower.includes("war room") || titleLower.includes("warroom")) {
            show = "War Room";
          } else if (titleLower.includes("sunday night") || titleLower.includes("snl")) {
            show = "Sunday Night Live";
          }

          let hour = "Full Show";
          const hourMatch = title.match(/Hr\s*(\d)/i) || title.match(/Hour\s*(\d)/i) || title.match(/Part\s*(\d)/i);
          if (hourMatch) {
            hour = `Hour ${hourMatch[1]}`;
          }

          // If channel name contains "warroom" or "war room", filter out other shows
          const channelNameLower = channel.name.toLowerCase();
          if ((channelNameLower.includes("warroom") || channelNameLower.includes("war room")) && show !== "War Room") {
            continue;
          }

          episodes.push({
            id: videoUrl,
            title,
            durationInSeconds: 3600,
            url: videoUrl,
            thumbnail: channel.logo,
            plot: `Original Airing: ${properDateFormatted} at ${properTimeFormatted}. Mode: RSS Syndicated Playout.`,
            genre: show,
            rating: "TV-14",
            properDateFormatted,
            properHour: hour,
            pubDate: pubDate.toISOString()
          });
        }
      }
    }

    return {
      title: channel.name,
      category: channel.category || "News",
      thumbnail: channel.logo,
      episodes: episodes.length > 0 ? episodes : undefined
    };
  }
}

export class IACollectionChannelProvider implements ChannelProvider {
  async validate(source: string): Promise<boolean> {
    return !!(source && source.trim().length > 0);
  }

  getPlaybackAction(channel: any, block?: any): PlaybackAction {
    return {
      action: "embed",
      url: block?.episode?.url || "",
      title: block ? `${channel.name} · ${block.episode.title}` : channel.name,
      seekPosition: block?.seekPositionAtStart || 0
    };
  }

  async getMetadata(channel: any, muxFiles?: Record<string, string[]>): Promise<ChannelMetadata> {
    if (channel.source && channel.source.endsWith(".json")) {
      try {
        const fetchUrl = channel.source.startsWith("http") || channel.source.startsWith("/") ? channel.source : `https://archive.org/download/daily-highlights/${channel.source}`;
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            const epsData = Array.isArray(data) ? data : (data.episodes || []);
            const eps = epsData.map((item: any, idx: number) => {
            const resolved = parseSemanticDate(item.title || "");
            
            const dateKey = resolved.success ? resolved.dateKey : (item.dateKey || item.importedAt?.split('T')[0] || "2025-01-01");
            const cleanTitle = resolved.success ? resolved.cleanTitle : (item.title || `Episode ${idx + 1}`);
            const displayTitle = resolved.success ? resolved.readableDate : cleanTitle;

            let properDateFormatted = "Unknown Date";
            if (dateKey) {
              try {
                const d = new Date(dateKey + "T12:00:00");
                const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                properDateFormatted = d.toLocaleDateString('en-US', dateOpts);
              } catch (e) {}
            }

            return {
              id: item.id || `${channel.channelId}-ep-${idx}`,
              title: displayTitle,
              durationInSeconds: item.duration || 3600,
              url: item.url,
              thumbnail: item.tvgLogo || channel.logo,
              plot: item.description || `Archive Segment: ${cleanTitle}. Original Air Date: ${properDateFormatted}.`,
              genre: "Archive",
              rating: "TV-14",
              properDateFormatted,
              properHour: "Archive Segment"
            };
          });

          // Sort chronologically if possible
          eps.sort((a: any, b: any) => {
             const da = new Date(a.properDateFormatted).getTime() || 0;
             const db = new Date(b.properDateFormatted).getTime() || 0;
             return da - db;
          });

          return {
            title: channel.name,
            category: channel.category || "Archive",
            thumbnail: channel.logo,
            episodes: eps
          };
          }
        }
      } catch (err) {
        console.warn("[IACollectionChannelProvider] Failed to fetch JSON source:", err);
      }
    }

    let files = muxFiles ? muxFiles[channel.channelId] : [];
    if (!files || files.length === 0) {
      // Direct load if possible
      try {
        files = await fetchArchiveCollectionFiles(channel.source);
      } catch (e) {
        console.error("Failed to load IA files inside provider:", e);
      }
    }

    const parsed = parseArchiveManifest(files || [], channel.source, channel.num);
    const getArchiveThumb = (id: string, fileId: string) => {
      return `https://archive.org/services/img/${id}`;
    };

    const episodes = parsed.map(item => {
      // Format proper date (e.g. June 29, 2026) and hour (e.g. Hour 1)
      const dateKey = item.dateKey; // YYYY-MM-DD
      let properDateFormatted = "Unknown Date";
      if (dateKey) {
        const d = new Date(dateKey + "T12:00:00");
        const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        properDateFormatted = d.toLocaleDateString('en-US', dateOpts);
      }

      return {
        id: item.id,
        title: item.displayDate || item.title,
        durationInSeconds: item.duration,
        url: item.url,
        thumbnail: getArchiveThumb(channel.source || "infowars-nightly-news-sd", item.id),
        plot: `Chrono Segment: ${item.displayDate}. Resolved via Semantic Date Resolver. Original Air Date: ${properDateFormatted}.`,
        genre: "Archive",
        rating: "TV-14",
        properDateFormatted,
        properHour: "Archive Segment"
      };
    });

    return {
      title: channel.name,
      category: channel.category || "Archive",
      thumbnail: channel.logo,
      episodes: episodes.length > 0 ? episodes : undefined
    };
  }
}

export class YouTubeChannelProvider implements ChannelProvider {
  async validate(source: string): Promise<boolean> {
    return !!(source && (source.includes("youtube.com") || source.includes("youtu.be")));
  }

  getPlaybackAction(channel: any, block?: any): PlaybackAction {
    return {
      action: "embed",
      url: block?.episode?.url || channel.source,
      title: block ? `${channel.name} · ${block.episode.title}` : channel.name
    };
  }

  async getMetadata(channel: any): Promise<ChannelMetadata> {
    // Generate YouTube default schedule loops
    const episodes = [
      {
        id: `${channel.channelId}-yt1`,
        title: `${channel.name} - Featured Stream`,
        durationInSeconds: 7200,
        url: channel.source,
        thumbnail: channel.logo,
        plot: "Synchronized YouTube media portal feed.",
        genre: "YouTube",
        rating: "TV-G",
        properDateFormatted: "Daily Broadcast",
        properHour: "Continuous Loop"
      }
    ];

    return {
      title: channel.name,
      category: channel.category || "YouTube",
      thumbnail: channel.logo,
      episodes
    };
  }
}

export class RumbleChannelProvider implements ChannelProvider {
  async validate(source: string): Promise<boolean> {
    if (!source || !source.includes("rumble.com")) return false;
    try {
      const response = await fetch(BACKEND_URL + `/api/rumble/oembed?url=${encodeURIComponent(source)}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getPlaybackAction(channel: any, block?: any): PlaybackAction {
    let targetUrl = block?.episode?.url || channel.source || "";
    if (block?.episode?.embed_url) {
      targetUrl = block.episode.embed_url;
    } else {
      const liveEmbed = targetUrl.replace('/v/', '/embed/live/');
      const vodEmbed = targetUrl.replace('/v/', '/embed/');
      targetUrl = channel.isLiveMode ? liveEmbed : vodEmbed;
    }
    return {
      action: "embed",
      url: targetUrl,
      title: block ? `${channel.name} · ${block.episode.title}` : channel.name
    };
  }

  async checkHealth(source: string): Promise<{ isLive: boolean; message: string }> {
    if (!source) {
      return { isLive: false, message: "No source URL provided" };
    }
    try {
      const response = await fetch(BACKEND_URL + `/api/rumble/oembed?url=${encodeURIComponent(source)}`);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const result = await response.json();
          if (result.success && result.data) {
            return {
              isLive: result.data.isLive !== false,
              message: result.data.isLive ? "Active Live Stream" : "Stream is VOD (Offline)"
            };
          }
        }
      }
      return { isLive: false, message: "Unreachable (Temporarily Unreachable)" };
    } catch (err) {
      return { isLive: false, message: `Health check failed: ${(err as Error).message}` };
    }
  }

  async getMetadata(channel: any): Promise<ChannelMetadata> {
    try {
      const response = await fetch(BACKEND_URL + `/api/rumble/oembed?url=${encodeURIComponent(channel.source)}`);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const result = await response.json();
          if (result.success && result.data) {
            const item = result.data;
            const episodes = [
            {
              id: `${channel.channelId}-rumble1`,
              title: item.title,
              durationInSeconds: item.duration || 7200,
              url: channel.source,
              embed_url: item.embed_url,
              thumbnail: item.thumbnail_url || channel.logo,
              plot: `Standardized Metadata resolution via Rumble OEmbed Parser. Mode: ${item.isLive ? "Live Transmission" : "VOD Playout"}.`,
              genre: "Rumble",
              rating: "TV-14",
              properDateFormatted: item.isLive ? "Active Live Stream" : "Saved Video on Demand",
              properHour: "Spotlight Stream"
            }
          ];

          return {
            title: item.title || channel.name,
            category: channel.category || "Rumble",
            thumbnail: item.thumbnail_url || channel.logo,
            episodes
          };
          }
        }
      }
    } catch (err) {
      console.error("Failed to load Rumble metadata via server endpoint:", err);
    }

    const episodes = [
      {
        id: `${channel.channelId}-rumble-fallback`,
        title: channel.name || "Rumble Live Broadcast",
        durationInSeconds: 7200,
        url: channel.source,
        thumbnail: channel.logo || "https://archive.org/download/daily-highlights/lmbsa.png",
        plot: "Rumble feed source broadcast. Fallback metadata resolution is active. Double-click or click play to view the broadcast.",
        genre: channel.category || "Rumble",
        rating: "TV-14",
        properDateFormatted: "Active Playout",
        properHour: "Rumble Stream"
      }
    ];

    return {
      title: channel.name,
      category: channel.category || "Rumble",
      thumbnail: channel.logo,
      episodes
    };
  }
}

export class DefaultChannelProvider implements ChannelProvider {
  async validate(source: string): Promise<boolean> {
    const res = await validateStreamURL(source, "default");
    return res.valid;
  }

  getPlaybackAction(channel: any, block?: any): PlaybackAction {
    return {
      action: "embed",
      url: block?.episode?.url || channel.source,
      title: block ? `${channel.name} · ${block.episode.title}` : channel.name,
      seekPosition: block?.seekPositionAtStart || 0
    };
  }

  async getMetadata(channel: any): Promise<ChannelMetadata> {
    const episodes = [
      {
        id: `${channel.channelId}-def1`,
        title: `${channel.name} Live Feed`,
        durationInSeconds: 5400,
        url: channel.source,
        thumbnail: channel.logo,
        plot: "Direct live network transmission feed.",
        genre: channel.category || "News",
        rating: "TV-14",
        properDateFormatted: "Live stream airing",
        properHour: "Continuous Playout"
      }
    ];

    return {
      title: channel.name,
      category: channel.category || "News",
      thumbnail: channel.logo,
      episodes
    };
  }
}

export class ChannelProviderFactory {
  private static providers: Record<string, ChannelProvider> = {
    "default": new DefaultChannelProvider(),
    "custom_m3u": new DefaultChannelProvider(),
    "live_hls": new DefaultChannelProvider(),
    "ia_collection": new IACollectionChannelProvider(),
    "youtube": new YouTubeChannelProvider(),
    "rumble": new RumbleChannelProvider(),
    "rss": new RSSChannelProvider()
  };

  public static getProvider(type: string): ChannelProvider {
    return this.providers[type] || this.providers["default"];
  }

  public static registerProvider(type: string, provider: ChannelProvider) {
    this.providers[type] = provider;
  }
}
