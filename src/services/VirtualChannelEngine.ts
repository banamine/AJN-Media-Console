import { broadcastClock } from "../broadcast";

export interface MasterPlaylistEpisode {
  id: string;
  title: string;
  durationInSeconds: number;
  url: string;
  thumbnail: string;
  plot: string;
  genre: string;
  rating: string;
  properHour?: string;
  properDateFormatted?: string;
}

export interface MasterPlaylist {
  id: string;
  name: string;
  category: string;
  logo: string;
  episodes: MasterPlaylistEpisode[];
  totalLoopDurationInSeconds: number;
}

export interface VirtualChannel {
  id: string;
  num: number;
  name: string;
  title?: string;
  logo: string;
  category: string;
  m3uRef: string;
  offsetIndex: number;
  url: string;
  channelId?: string;
  type?: string;
  source?: string;
  persistence?: string;
  isLiveMode?: boolean;
  staggerOffsetSeconds?: number;
  isPermanent?: boolean;
}

function cleanChannelDisplayTitle(raw: string): string {
  if (!raw) return 'Unknown Channel';
  return raw
    // Remove everything up to and including "/split shows/" or "/split_shows/" (case-insensitive)
    .replace(/^.*[\/\\]split[ _]shows[\/\\]/i, '')
    // Remove leading emojis like 📻 or 📺 and extra spaces
    .replace(/^[\u2000-\u3300\uD83C-\uD83E\uDC00-\uDFFF\s]+/g, '')
    // Remove trailing file extensions like .m3u
    .replace(/\.m3u$/i, '')
    // Clean up trailing hyphens or underscores
    .replace(/[-_]+$/, '')
    .trim();
}

export interface StreamState {
  channelId: string;
  playingEpisode: MasterPlaylistEpisode;
  seekPosition: number;
  effectiveTime: number;
  remainingDuration: number;
  totalDuration: number;
}

export interface VirtualProgramBlock {
  id: string;
  episode: MasterPlaylistEpisode;
  startTimeSec: number;
  durationSec: number;
  seekPositionAtStart: number;
  isLiveNow: boolean;
  bleedSec: number;
}

export const STATIC_BACKUP_STREAM_URL = "";
const DEFAULT_THUMB = "https://archive.org/download/daily-highlights/lmbsa.png";

const MASTER_TEMPLATES: Omit<MasterPlaylist, "totalLoopDurationInSeconds">[] = [
  {
    id: "pl-news-1",
    name: "AJN 24/7 Live News Desk",
    category: "News",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "nw-1", title: "Morning War Room Briefing", durationInSeconds: 1800, url: "", thumbnail: DEFAULT_THUMB, plot: "Comprehensive geopolitical breakdown and daily strategic analysis.", genre: "News", rating: "TV-14" },
      { id: "nw-2", title: "Midday Special Report", durationInSeconds: 1200, url: "", thumbnail: DEFAULT_THUMB, plot: "Breaking developments from the international economic front.", genre: "News", rating: "TV-14" },
      { id: "nw-3", title: "Evening Geopolitical Round", durationInSeconds: 2400, url: "", thumbnail: DEFAULT_THUMB, plot: "Expert panel analyzing global treaties and sovereignty impacts.", genre: "News", rating: "TV-PG" },
      { id: "nw-4", title: "Nightly Dispatch Digest", durationInSeconds: 1500, url: "", thumbnail: DEFAULT_THUMB, plot: "Recap of daily news highlights and uncensored commentary.", genre: "News", rating: "TV-14" }
    ]
  },
  {
    id: "pl-warroom-2",
    name: "War Room Strategic Playout",
    category: "Geopolitics",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "wr-1", title: "Globalist Takedown Hour 1", durationInSeconds: 3600, url: "", thumbnail: DEFAULT_THUMB, plot: "Deep dive into international regulatory capture and response tactics.", genre: "Geopolitics", rating: "TV-MA" },
      { id: "wr-2", title: "Sovereignty Defense Strategy", durationInSeconds: 2700, url: "", thumbnail: DEFAULT_THUMB, plot: "Constitutional protections and state-level resistance strategies.", genre: "Geopolitics", rating: "TV-14" },
      { id: "wr-3", title: "War Room Intelligence Vault", durationInSeconds: 4200, url: "", thumbnail: DEFAULT_THUMB, plot: "Classified briefings and insider whistle-blower interviews.", genre: "Geopolitics", rating: "TV-MA" }
    ]
  },
  {
    id: "pl-classic-3",
    name: "Alex Jones Classic Vault",
    category: "Archive",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "cl-1", title: "Bohemian Grove Exposé (1999)", durationInSeconds: 5400, url: "", thumbnail: DEFAULT_THUMB, plot: "Groundbreaking investigative infiltration of secret elite societies.", genre: "Archive", rating: "TV-MA" },
      { id: "cl-2", title: "Police State 2000 Documentary", durationInSeconds: 4800, url: "", thumbnail: DEFAULT_THUMB, plot: "Prophetic exploration of surveillance grid expansion.", genre: "Archive", rating: "TV-14" },
      { id: "cl-3", title: "The Obama Deception (2009)", durationInSeconds: 6600, url: "", thumbnail: DEFAULT_THUMB, plot: "Investigation into Wall Street and central banking control.", genre: "Archive", rating: "TV-14" }
    ]
  },
  {
    id: "pl-docs-4",
    name: "Censored Documentaries",
    category: "Documentary",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "dc-1", title: "The Great Reset Unmasked", durationInSeconds: 3200, url: "", thumbnail: DEFAULT_THUMB, plot: "Analyzing world economic forums and central bank digital currencies.", genre: "Documentary", rating: "TV-PG" },
      { id: "dc-2", title: "Medical Freedom Chronicles", durationInSeconds: 4500, url: "", thumbnail: DEFAULT_THUMB, plot: "Independent physicians discuss informed consent and health autonomy.", genre: "Documentary", rating: "TV-14" },
      { id: "dc-3", title: "Silicon Valley Censorship Grid", durationInSeconds: 2900, url: "", thumbnail: DEFAULT_THUMB, plot: "Algorithm manipulation and information suppression deep dive.", genre: "Documentary", rating: "TV-PG" }
    ]
  },
  {
    id: "pl-liberty-5",
    name: "Constitutional Law Showcase",
    category: "Civics",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "lb-1", title: "Bill of Rights Masterclass", durationInSeconds: 2400, url: "", thumbnail: DEFAULT_THUMB, plot: "Understanding the original intent and judicial precedents of amendments 1-10.", genre: "Civics", rating: "TV-G" },
      { id: "lb-2", title: "Federalism vs Centralization", durationInSeconds: 1800, url: "", thumbnail: DEFAULT_THUMB, plot: "Historical debate on state sovereignty versus federal overreach.", genre: "Civics", rating: "TV-PG" }
    ]
  },
  {
    id: "pl-econ-6",
    name: "Economic Survival Hub",
    category: "Economics",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "ec-1", title: "Precious Metals & De-Dollarization", durationInSeconds: 2100, url: "", thumbnail: DEFAULT_THUMB, plot: "How BRICS nations and monetary policy shifts affect personal wealth.", genre: "Economics", rating: "TV-G" },
      { id: "ec-2", title: "Off-Grid Agriculture & Homesteading", durationInSeconds: 3000, url: "", thumbnail: DEFAULT_THUMB, plot: "Food security, heirloom seeds, and independent farming techniques.", genre: "Economics", rating: "TV-G" }
    ]
  },
  {
    id: "pl-health-7",
    name: "Bio-Shield Health Hour",
    category: "Health",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "hl-1", title: "Nutritional Vitality Protocol", durationInSeconds: 1500, url: "", thumbnail: DEFAULT_THUMB, plot: "Trace minerals, antioxidants, and cellular detoxification strategies.", genre: "Health", rating: "TV-G" },
      { id: "hl-2", title: "Electromagnetic Hygiene Guide", durationInSeconds: 1900, url: "", thumbnail: DEFAULT_THUMB, plot: "Mitigating non-ionizing radiation and optimizing circadian rhythms.", genre: "Health", rating: "TV-PG" }
    ]
  },
  {
    id: "pl-conspiracy-8",
    name: "Classified Investigation Desk",
    category: "Investigations",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "cs-1", title: "UAP Disclosure & Black Projects", durationInSeconds: 3800, url: "", thumbnail: DEFAULT_THUMB, plot: "Declassified pentagon documents and aerospace propulsion patents.", genre: "Investigations", rating: "TV-14" },
      { id: "cs-2", title: "GEO-Engineering & Climate Weather", durationInSeconds: 4100, url: "", thumbnail: DEFAULT_THUMB, plot: "Stratospheric aerosol injection and cloud seeding modification.", genre: "Investigations", rating: "TV-14" }
    ]
  },
  {
    id: "pl-global-9",
    name: "International Intelligence Desk",
    category: "World",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "gl-1", title: "European Farmer Protests Live", durationInSeconds: 2200, url: "", thumbnail: DEFAULT_THUMB, plot: "On-the-ground coverage of agricultural regulations resistance.", genre: "World", rating: "TV-14" },
      { id: "gl-2", title: "Eurasian Energy Corridor Analysis", durationInSeconds: 2600, url: "", thumbnail: DEFAULT_THUMB, plot: "Pipeline geopolitics and liquefied natural gas supply chain shifts.", genre: "World", rating: "TV-PG" }
    ]
  },
  {
    id: "pl-tech-10",
    name: "Cyber-Threat & AI Watch",
    category: "Technology",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "tc-1", title: "Autonomous Drone Warfare Frontiers", durationInSeconds: 3100, url: "", thumbnail: DEFAULT_THUMB, plot: "AI targeting algorithms and battlefield robotics evolution.", genre: "Technology", rating: "TV-MA" },
      { id: "tc-2", title: "Decentralized Mesh Networks", durationInSeconds: 1700, url: "", thumbnail: DEFAULT_THUMB, plot: "Building censorship-resistant peer-to-peer communication infrastructures.", genre: "Technology", rating: "TV-G" }
    ]
  },
  {
    id: "pl-culture-11",
    name: "Free Speech Culture War",
    category: "Culture",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "cu-1", title: "The Battle for Academia", durationInSeconds: 2800, url: "", thumbnail: DEFAULT_THUMB, plot: "Campus free speech debates and ideological conformity challenges.", genre: "Culture", rating: "TV-14" },
      { id: "cu-2", title: "Independent Media Renaissance", durationInSeconds: 2500, url: "", thumbnail: DEFAULT_THUMB, plot: "Podcasters and citizen journalists bypassing legacy networks.", genre: "Culture", rating: "TV-PG" }
    ]
  },
  {
    id: "pl-nightly-12",
    name: "Midnight Vault Playout Loop",
    category: "Late Night",
    logo: DEFAULT_THUMB,
    episodes: [
      { id: "nt-1", title: "Uncut Open Phones Midnight Round", durationInSeconds: 7200, url: "", thumbnail: DEFAULT_THUMB, plot: "Live callers from across the world sharing eyewitness reports.", genre: "Late Night", rating: "TV-MA" },
      { id: "nt-2", title: "Late Night Mystery Soundtracks", durationInSeconds: 3600, url: "", thumbnail: DEFAULT_THUMB, plot: "Ambient synth and atmospheric frequencies for night researchers.", genre: "Late Night", rating: "TV-G" }
    ]
  }
];

export function createMasterPlaylistStore(
  inputPlaylistsOrChannels: any[] = [],
  externalArchives: any[] = []
): Record<string, MasterPlaylist> {
  // 1. Gather base episodes from MASTER_TEMPLATES
  const baseEpisodes: MasterPlaylistEpisode[] = MASTER_TEMPLATES.flatMap(p => p.episodes);

  // 2. Flatten input playlists or convert IPTV channels
  const iptvEpisodes: MasterPlaylistEpisode[] = [];
  inputPlaylistsOrChannels.forEach((ch: any, idx: number) => {
    if (ch && ch.episodes && Array.isArray(ch.episodes)) {
      iptvEpisodes.push(...ch.episodes);
    } else if (ch && ch.url) {
      const dur = (ch.duration && ch.duration > 0) ? ch.duration : [1200, 1800, 2400, 3600][idx % 4];
      iptvEpisodes.push({
        id: `ext-iptv-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        title: ch.name || `Live Broadcast #${idx + 1}`,
        durationInSeconds: dur,
        url: ch.url,
        thumbnail: ch.logo || DEFAULT_THUMB,
        plot: ch.group ? `Continuous programming feed from ${ch.group} category.` : "Direct live IPTV transmission.",
        genre: ch.group || "Variety",
        rating: "TV-14"
      });
    }
  });

  // 3. Convert externalArchives
  const archiveEpisodes: MasterPlaylistEpisode[] = [];
  externalArchives.forEach((arch: any, idx: number) => {
    const url = arch && (arch.videoUrl || arch.url);
    if (!url) return;
    archiveEpisodes.push({
      id: `ext-arch-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      title: arch.title || arch.show || `Archive Feature #${idx + 1}`,
      durationInSeconds: 3600,
      url: url,
      thumbnail: arch.thumbnail || DEFAULT_THUMB,
      plot: "Restored digital vault media broadcast.",
      genre: "Archive VOD",
      rating: "TV-PG"
    });
  });

  // 4. Combine all into globalEpisodePool
  const globalEpisodePool: MasterPlaylistEpisode[] = [
    ...baseEpisodes,
    ...iptvEpisodes,
    ...archiveEpisodes
  ];

  if (globalEpisodePool.length === 0) {
    globalEpisodePool.push({
      id: "default-fallback",
      title: "Default Transmission Feed",
      durationInSeconds: 3600,
      url: STATIC_BACKUP_STREAM_URL,
      thumbnail: DEFAULT_THUMB,
      plot: "Continuous 24/7 test transmission.",
      genre: "Variety",
      rating: "TV-G"
    });
  }

  const totalDuration = globalEpisodePool.reduce((acc, ep) => acc + (ep.durationInSeconds || 3600), 0);

  const unifiedStore: Record<string, MasterPlaylist> = {
    "global-unified-pool": {
      id: "global-unified-pool",
      name: "Global Master Mix",
      category: "Variety",
      logo: "/assets/global-logo.png",
      episodes: globalEpisodePool,
      totalLoopDurationInSeconds: totalDuration
    }
  };

  return unifiedStore;
}
/**
 * Refactored: Distributes virtual channels with independent, genre-filtered randomization
 */
export function generateVirtualChannels(store: Record<string, MasterPlaylist>): VirtualChannel[] {
  const master = store["global-unified-pool"];
  const virtualChannels: VirtualChannel[] = [];
  
  const TOTAL_VIRTUAL_CHANNELS = 180;
  
  const AJN_HUB_NAMES = [
    "🌐 AJN WARROOM VOD RSS Archive",
    "🚀 AJN Today Hub",
    "📅 AJN Archive Dates Hub",
    "🚨 AJN Special Coverage",
    "⚡ AJN Breaking News",
    "🎙️ AJN Daily Segments"
  ];

  const CATEGORIES = [
    "News", "Geopolitics", "Archive", "Documentary", "Civics", 
    "Economics", "Health", "Investigations", "World", "Technology", 
    "Late Night", "Movies", "Shows", "Music", "Variety"
  ];

  let currentChIndex = 1;

  if (master && master.episodes) {
    // 1. Extract Split Shows 1 & 2 Series
    const splitSeriesMap = new Map<string, MasterPlaylistEpisode[]>();
    for (const ep of master.episodes) {
      if (ep.genre.startsWith("Split Shows 1 / ") || ep.genre.startsWith("Split Shows 2 / ")) {
        const seriesName = ep.genre.split(" / ")[1] || ep.genre;
        if (!splitSeriesMap.has(seriesName)) {
           splitSeriesMap.set(seriesName, []);
        }
        splitSeriesMap.get(seriesName)!.push(ep);
      }
    }

    for (const [seriesName, eps] of splitSeriesMap.entries()) {
      const vaultRef = `vch-${currentChIndex}-vault`;
      const sortedEps = eps.sort((a,b) => a.title.localeCompare(b.title));
      const totalDuration = sortedEps.reduce((acc, ep) => acc + (ep.durationInSeconds || 3600), 0);
      
      const cleanedName = cleanChannelDisplayTitle(seriesName);

      store[vaultRef] = {
        id: vaultRef,
        name: `${cleanedName} Vault`,
        category: "Shows",
        logo: sortedEps[0]?.thumbnail || DEFAULT_THUMB,
        episodes: sortedEps, // SEQUENTIAL!
        totalLoopDurationInSeconds: totalDuration
      };

      virtualChannels.push({
        id: `vch-${currentChIndex}`,
        num: currentChIndex,
        name: cleanedName,
        title: cleanedName,
        logo: sortedEps[0]?.thumbnail || DEFAULT_THUMB,
        category: "Shows",
        m3uRef: vaultRef,
        offsetIndex: 0,
        url: sortedEps[0]?.url || STATIC_BACKUP_STREAM_URL,
        type: "series_channel"
      });
      currentChIndex++;
    }

    // 2. Movies
    const movieEps = master.episodes.filter(ep => ep.genre.startsWith("Classic & Documentary Movies"));
    if (movieEps.length > 0) {
      const vaultRef = `vch-${currentChIndex}-vault`;
      const sortedEps = movieEps.sort((a,b) => a.title.localeCompare(b.title));
      const totalDuration = sortedEps.reduce((acc, ep) => acc + (ep.durationInSeconds || 3600), 0);
      
      store[vaultRef] = {
        id: vaultRef,
        name: `Classic & Documentary Movies Vault`,
        category: "Movies",
        logo: sortedEps[0]?.thumbnail || DEFAULT_THUMB,
        episodes: sortedEps,
        totalLoopDurationInSeconds: totalDuration
      };

      virtualChannels.push({
        id: `vch-${currentChIndex}`,
        num: currentChIndex,
        name: "Classic & Documentary Movies",
        logo: sortedEps[0]?.thumbnail || DEFAULT_THUMB,
        category: "Movies",
        m3uRef: vaultRef,
        offsetIndex: 0,
        url: sortedEps[0]?.url || STATIC_BACKUP_STREAM_URL,
        type: "series_channel"
      });
      currentChIndex++;
    }
  }

  // 3. Fill remaining virtual channels
  const remainingChannels = Math.max(0, TOTAL_VIRTUAL_CHANNELS - (currentChIndex - 1));
  for (let i = 0; i < remainingChannels; i++) {
    let name = `Channel ${currentChIndex}`;
    let category = "Variety";

    if (i < AJN_HUB_NAMES.length) {
      name = AJN_HUB_NAMES[i];
      category = "AJN Hub";
    } else {
      const cat = CATEGORIES[(i - AJN_HUB_NAMES.length) % CATEGORIES.length];
      name = `${cat} Network CH ${currentChIndex}`;
      category = cat;
    }
    
    // Per-Channel Playlist Vault logic
    let channelEpisodes: MasterPlaylistEpisode[] = [];
    if (master && master.episodes) {
      if (category === "AJN Hub") {
        channelEpisodes = master.episodes.filter(ep => ep.genre === "Archive VOD" || ep.genre === "Archive" || ep.genre === "News");
      } else {
        channelEpisodes = master.episodes.filter(ep => ep.genre.toLowerCase().includes(category.toLowerCase()) || ep.genre === "Variety" || category === "Variety");
      }
      
      if (channelEpisodes.length === 0) {
        channelEpisodes = [...master.episodes];
      }
    }
    
    // Independent Randomization for this specific channel queue
    if (channelEpisodes.length > 0) {
      const arr = [...channelEpisodes];
      for (let k = arr.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [arr[k], arr[j]] = [arr[j], arr[k]];
      }
      channelEpisodes = arr;
    }

    const vaultRef = `vch-${currentChIndex}-vault`;
    const totalDuration = channelEpisodes.reduce((acc, ep) => acc + (ep.durationInSeconds || 3600), 0);

    store[vaultRef] = {
      id: vaultRef,
      name: `${name} Vault`,
      category: category,
      logo: master ? master.logo : DEFAULT_THUMB,
      episodes: channelEpisodes,
      totalLoopDurationInSeconds: totalDuration
    };

    const firstEp = channelEpisodes[0];
    const rawUrl = firstEp ? firstEp.url : STATIC_BACKUP_STREAM_URL;
    const url = rawUrl && rawUrl.trim() !== "" ? rawUrl : STATIC_BACKUP_STREAM_URL;
    const logo = firstEp && firstEp.thumbnail ? firstEp.thumbnail : (master ? master.logo : DEFAULT_THUMB);

    virtualChannels.push({
      id: `vch-${currentChIndex}`,
      num: currentChIndex,
      name,
      logo,
      category,
      m3uRef: vaultRef,
      offsetIndex: 0,
      url
    });
    
    currentChIndex++;
  }

  return virtualChannels;
}

export function getChannelSegmentDuration(episode: MasterPlaylistEpisode, channel: VirtualChannel): number {
  const baseDur = episode.durationInSeconds || 1800;
  // If it's a live channel, custom auto-channel, or permanent placeholder, keep exact duration
  if (
    channel.id === "live-ajn" || 
    channel.id === "live-warroom" || 
    channel.type === "drop_go" || 
    channel.type === "series_channel" || 
    channel.id.startsWith("drop-go-") ||
    channel.id.startsWith("discovered-") ||
    baseDur >= 86400
  ) {
    return baseDur;
  }
  // Generate a predictable seed/factor based on channel number and episode title/ID hash
  const chSeed = channel.num || 1;
  const epSeed = episode.id ? episode.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  // Map seeds to a deterministic variation percentage between -15% and +15%
  // Ensure we vary the virtual segment length so every row has a slightly different rhythm.
  const percentVar = (((chSeed * 17 + epSeed * 31) % 30) - 15) / 100; // -15% to +15%
  const variedDur = Math.round(baseDur * (1 + percentVar));
  // Keep it within a sane range (at least 300 seconds (5 mins))
  return Math.max(300, variedDur);
}

export function getCurrentStreamState(
  channel: VirtualChannel,
  currentTimestamp: number,
  epochTimestamp: number,
  masterStore: Record<string, MasterPlaylist>
): StreamState {
  const playlist = masterStore[channel.m3uRef];
  if (!playlist || !playlist.episodes || playlist.episodes.length === 0) {
    const fallbackEp: MasterPlaylistEpisode = {
      id: `${channel.id}-fallback`,
      title: `${channel.name} Feed`,
      durationInSeconds: 3600,
      url: channel.url && channel.url.trim() !== "" ? channel.url : STATIC_BACKUP_STREAM_URL,
      thumbnail: channel.logo || DEFAULT_THUMB,
      plot: "Continuous 24/7 broadcast transmission.",
      genre: channel.category || "Broadcast",
      rating: "TV-14"
    };
    return {
      channelId: channel.id,
      playingEpisode: fallbackEp,
      seekPosition: 0,
      effectiveTime: 0,
      remainingDuration: 3600,
      totalDuration: 3600
    };
  }

  // Map playlist episodes to varied durations for this channel to dynamically stagger the grid beautifully
  let totalLoop = 0;
  const channelEpisodes = playlist.episodes.map(ep => {
    const variedDur = getChannelSegmentDuration(ep, channel);
    totalLoop += variedDur;
    return { ...ep, durationInSeconds: variedDur };
  });

  // Calculate timeShift: sum of durations before offsetIndex using varied durations
  let timeShift = 0;
  const targetIdx = ((channel.offsetIndex % channelEpisodes.length) + channelEpisodes.length) % channelEpisodes.length;
  for (let i = 0; i < targetIdx; i++) {
    timeShift += channelEpisodes[i].durationInSeconds;
  }

  const deltaT = Math.floor(currentTimestamp - epochTimestamp);
  const stagger = channel.staggerOffsetSeconds || 0;
  let effectiveTime = (deltaT + timeShift + stagger) % totalLoop;
  if (effectiveTime < 0) {
    effectiveTime += totalLoop;
  }

  let runningSum = 0;
  let playingEpisode = channelEpisodes[0];
  let seekPosition = 0;

  for (const ep of channelEpisodes) {
    if (effectiveTime < runningSum + ep.durationInSeconds) {
      playingEpisode = ep;
      seekPosition = Math.floor(effectiveTime - runningSum);
      break;
    }
    runningSum += ep.durationInSeconds;
  }

  const remainingDuration = Math.max(0, playingEpisode.durationInSeconds - seekPosition);

  return {
    channelId: channel.id,
    playingEpisode,
    seekPosition,
    effectiveTime,
    remainingDuration,
    totalDuration: playingEpisode.durationInSeconds
  };
}

export function getChannelScheduleInWindow(
  channel: VirtualChannel,
  viewWindow: [number, number],
  epochTimestamp: number,
  masterStore: Record<string, MasterPlaylist>
): VirtualProgramBlock[] {
  const playlist = masterStore[channel.m3uRef];
  if (!playlist || !playlist.episodes || playlist.episodes.length === 0) return [];

  // Map playlist episodes to varied durations for this channel to guarantee absolute sync
  const channelEpisodes = playlist.episodes.map(ep => ({
    ...ep,
    durationInSeconds: getChannelSegmentDuration(ep, channel)
  }));

  const [winStart, winEnd] = viewWindow;
  const nowSec = broadcastClock.getBroadcastTimeSeconds();

  // Create a temporary playlist with the varied episodes so getCurrentStreamState works seamlessly
  const tempPlaylist: MasterPlaylist = {
    ...playlist,
    episodes: channelEpisodes,
    totalLoopDurationInSeconds: channelEpisodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0)
  };
  const tempStore = { ...masterStore, [channel.m3uRef]: tempPlaylist };

  const startState = getCurrentStreamState(channel, winStart, epochTimestamp, tempStore);

  const blocks: VirtualProgramBlock[] = [];
  let curTime = winStart - startState.seekPosition;
  
  let epIdx = channelEpisodes.findIndex(e => e.id === startState.playingEpisode.id);
  if (epIdx === -1) epIdx = 0;

  let isFirst = true;
  let maxBlocks = 500; // safety ceiling

  while (curTime < winEnd && maxBlocks > 0) {
    maxBlocks--;
    const ep = channelEpisodes[epIdx];
    const dur = Math.max(30, ep.durationInSeconds);
    const progEnd = curTime + dur;

    const bleedSec = isFirst ? Math.max(0, winStart - curTime) : 0;
    const isLiveNow = nowSec >= curTime && nowSec < progEnd;

    blocks.push({
      id: `${channel.id}-blk-${curTime}-${ep.id}`,
      episode: ep,
      startTimeSec: curTime,
      durationSec: dur,
      seekPositionAtStart: isLiveNow ? Math.max(0, nowSec - curTime) : 0,
      isLiveNow,
      bleedSec
    });

    curTime = progEnd;
    epIdx = (epIdx + 1) % channelEpisodes.length;
    isFirst = false;
  }

  return blocks;
}
