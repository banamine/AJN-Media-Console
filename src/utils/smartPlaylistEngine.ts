import { IPTVChannel } from "../types";

export interface SmartPlaylistCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // Icon identifier for rendering (e.g., "Radio", "Tv", "Music", "Clock")
  type: "genre" | "frequency";
  channels: IPTVChannel[];
}

/**
 * Evaluates a list of IPTV channels and automatically groups them into Smart Playlists
 * based on semantic analysis of titles, groups, durations, and broadcast properties.
 */
export function analyzeSmartPlaylists(channels: IPTVChannel[]): SmartPlaylistCategory[] {
  const categories: Record<string, Omit<SmartPlaylistCategory, "channels"> & { matchFn: (ch: IPTVChannel) => boolean }> = {
    // GENRES
    "genre-news": {
      id: "genre-news",
      name: "News & Commentary",
      description: "Direct alerts, independent analysis, and live global reports",
      icon: "Megaphone",
      type: "genre",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""} ${ch.tvgGenre || ""}`.toLowerCase();
        return /\b(news|crosstalk|broadcast|warroom|war room|report|journal|breaking|daily|politics|commentary|infowars|press|radio|opinion)\b/i.test(text);
      }
    },
    "genre-cinema": {
      id: "genre-cinema",
      name: "Cinema & Shows",
      description: "Long-form films, episodic series, and entertainment channels",
      icon: "Film",
      type: "genre",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""} ${ch.tvgGenre || ""}`.toLowerCase();
        return /\b(movie|series|episode|show|cinema|drama|documentary|film|cartoon|tv|theatre|acting|fiction)\b/i.test(text);
      }
    },
    "genre-music": {
      id: "genre-music",
      name: "Music & Ambient",
      description: "Synthwave loops, high-fidelity concerts, and audio backdrops",
      icon: "Music",
      type: "genre",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""} ${ch.tvgGenre || ""}`.toLowerCase();
        return /\b(music|synthwave|ambient|jazz|soundtrack|concert|song|lofi|beat|melody|fm|audio|hifi)\b/i.test(text);
      }
    },

    // FREQUENCIES
    "freq-live": {
      id: "freq-live",
      name: "24/7 Live Feeds",
      description: "Non-stop continuous streams broadcasting without interruption",
      icon: "Radio",
      type: "frequency",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""}`.toLowerCase();
        // Live channels, or group matches live, or explicitly states 24/7
        return /\b(live|24\/7|continuous|constant|non-stop|feed|stream|active|realtime)\b/i.test(text) || 
               ch.group === "Live Channels";
      }
    },
    "freq-clips": {
      id: "freq-clips",
      name: "Short-Form Clips",
      description: "Bumper inserts, promotional teasers, and high-frequency updates",
      icon: "Zap",
      type: "frequency",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""}`.toLowerCase();
        // Channels with short durations (approx <= 15m/900s) or name attributes
        const isShortDuration = (ch as any).duration && (ch as any).duration <= 900;
        return isShortDuration || 
               /\b(clip|teaser|promo|bumper|snippet|highlight|short|segment|spot|break)\b/i.test(text) ||
               text.includes("crosstalk");
      }
    },
    "freq-scheduled": {
      id: "freq-scheduled",
      name: "Daily Program Blocks",
      description: "Scheduled daily programs, episodic series, and hourly runs",
      icon: "Calendar",
      type: "frequency",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""}`.toLowerCase();
        // Standard program blocks like "Hour 1", "Wed", weekday names, or date tokens
        return /\b(hour|daily|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekly)\b/i.test(text) ||
               /\b(202[4-9]-\w{3}-\d{2})\b/i.test(text); // Date format like "2026-Jul-08"
      }
    },
    "freq-archive": {
      id: "freq-archive",
      name: "On-Demand Archives",
      description: "Cold-storage database playbacks and deep history vaults",
      icon: "Archive",
      type: "frequency",
      matchFn: (ch) => {
        const text = `${ch.name} ${ch.group || ""}`.toLowerCase();
        return /\b(archive|vod|history|recorded|backup|vault|retro|classic|old|past)\b/i.test(text);
      }
    }
  };

  // Convert categories object to array with matching channels populated
  const smartCategories: SmartPlaylistCategory[] = Object.keys(categories).map((key) => {
    const cat = categories[key];
    const matchedChannels = channels.filter(cat.matchFn);
    
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      type: cat.type,
      channels: matchedChannels
    };
  });

  // Create an "Uncategorized" playlist for anything that didn't match any of the above
  const matchedUrls = new Set(smartCategories.flatMap(c => c.channels.map(ch => ch.url)));
  const uncategorizedChannels = channels.filter(ch => !matchedUrls.has(ch.url));

  if (uncategorizedChannels.length > 0) {
    smartCategories.push({
      id: "genre-uncategorized",
      name: "Other Channels",
      description: "Remaining uncategorized streams and system references",
      icon: "Compass",
      type: "genre",
      channels: uncategorizedChannels
    });
  }

  return smartCategories;
}
