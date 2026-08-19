export interface MediaAsset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  provider: string;
  collection: string;
  genre: string;
  year: number;
  runtime: number; // in minutes
  resolution: "1080p" | "4K" | "720p" | "480p";
  codec: string;
  audioCodec: string;
  language: string;
  rating: string;
  poster: string;
  backdrop: string;
  thumbnail: string;
  checksum: string;
  playCount: number;
  lastPlayed: string;
  favorite: boolean;
  tags: string[];
  lufs: number; // e.g. -14.2
  healthScore: number; // 0 - 100
  isMissingArtwork?: boolean;
  isDuplicate?: boolean;
  isCorrupted?: boolean;
}

export interface VirtualChannel {
  number: number;
  id: string;
  name: string;
  callSign: string;
  category: "News" | "Westerns" | "Classic TV" | "Sci-Fi" | "Kids" | "Movies" | "Music" | "Special Events";
  currentProgram: string;
  nextProgram: string;
  status: "ONLINE" | "FAILOVER" | "MAINTENANCE" | "BUFFERING";
  bitrateKbps: number;
  viewerCount: number;
  logoUrl: string;
  streamUrl: string;
}

export interface ChannelBranding {
  channelId: string;
  logoUrl: string;
  watermarkText: string;
  watermarkPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  stationIdUrl: string;
  introUrl: string;
  outroUrl: string;
  lowerThirdStyle: "modern-glass" | "classic-solid" | "cyber-neon" | "minimal-dark";
  sponsorOverlayUrl: string;
  themePrimaryColor: string;
  themeSecondaryColor: string;
  fontHeading: "Space Grotesk" | "Inter" | "JetBrains Mono" | "Outfit";
  fontBody: "Inter" | "JetBrains Mono" | "Roboto";
  transitionEffect: "crossfade" | "dip-to-black" | "wipe-right" | "glitch-cut";
}

export interface GraphicsOverlay {
  id: string;
  name: string;
  type: "breaking_news" | "ticker" | "weather" | "countdown" | "clock" | "sports_score" | "program_title" | "sponsor" | "lower_third";
  active: boolean;
  channelId: string; // "ALL" or specific channel ID
  templateData: {
    headline?: string;
    subtext?: string;
    items?: string[];
    temperature?: string;
    condition?: string;
    targetTimestamp?: number;
    teamA?: { name: string; score: number };
    teamB?: { name: string; score: number };
    sponsorName?: string;
    bgAccent?: string;
  };
}

export interface AutomationRule {
  id: string;
  channelId: string; // "ALL" or specific channel ID
  name: string;
  type: "avoid_repeat" | "reserve_slot" | "station_id_top" | "promo_interval" | "gap_filler" | "content_rating";
  enabled: boolean;
  config: {
    windowHours?: number;
    targetSlot?: string; // e.g. "20:00-22:00"
    intervalMin?: number;
    maxRating?: string;
    priority?: number;
  };
}

export interface QCIssue {
  id: string;
  assetId: string;
  assetTitle: string;
  issueType: "missing_thumb" | "missing_meta" | "broken_media" | "offline_stream" | "duplicate" | "bad_duration" | "unsupported_codec" | "audio_norm";
  severity: "low" | "medium" | "high";
  description: string;
  detectedAt: string;
  resolved: boolean;
}

export interface BroadcastLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "AUTO" | "RECOVERY" | "AUDIT";
  category: string;
  message: string;
  channelId: string;
  programTitle?: string;
}

export interface AutomationPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: "Ingest" | "Overlay" | "Analytics" | "Playout" | "AI";
  active: boolean;
  configSchema?: string;
}

export interface RecoveryState {
  autoRecoverEnabled: boolean;
  fallbackMediaUrl: string;
  activeFailoversCount: number;
  lastRecoveryTimestamp: string;
  simulatedOutageType: "none" | "provider_disconnect" | "network_jitter" | "cache_corrupt" | "stream_stall";
}

export interface ReleaseMetrics {
  version: string;
  buildHash: string;
  uptimeSeconds: number;
  memoryUsageMB: number;
  gpuUsagePercent: number;
  avgSwitchLatencyMs: number;
  stabilityScore: number;
}

export const INITIAL_VIRTUAL_CHANNELS: VirtualChannel[] = [
  {
    number: 101,
    id: "vch-101",
    name: "AJN News",
    callSign: "AJNN-HD",
    category: "News",
    currentProgram: "AJN Live News Broadcast",
    nextProgram: "AJN Special Report",
    status: "ONLINE",
    bitrateKbps: 6500,
    viewerCount: 1420,
    logoUrl: "https://archive.org/download/daily-highlights/emegency.png",
    streamUrl: ""
  },
  {
    number: 102,
    id: "vch-102",
    name: "AJN War Room",
    callSign: "AJN-WR",
    category: "News",
    currentProgram: "War Room Hour 1",
    nextProgram: "War Room Hour 2",
    status: "ONLINE",
    bitrateKbps: 5200,
    viewerCount: 890,
    logoUrl: "https://archive.org/download/daily-highlights/warroom.png",
    streamUrl: "https://archive.org/download/infowars-war-room-2023-sd/20231010_Tue_WarRoom_Hour1.mp4"
  },
  {
    number: 103,
    id: "vch-103",
    name: "AJN Retro",
    callSign: "AJNC-RETRO",
    category: "Classic TV",
    currentProgram: "Bohemian Grove Exposé (1999)",
    nextProgram: "The Obama Deception",
    status: "ONLINE",
    bitrateKbps: 4800,
    viewerCount: 2150,
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    streamUrl: "https://archive.org/download/infowars-police-state-docs/19991001_Fri_BohemianGroveExpose.mp4"
  },
  {
    number: 104,
    id: "vch-104",
    name: "AJN Prime Time",
    callSign: "AJN-PRIME",
    category: "News",
    currentProgram: "AJN Prime Time Live Archive",
    nextProgram: "AJN Nightly News",
    status: "ONLINE",
    bitrateKbps: 8500,
    viewerCount: 3410,
    logoUrl: "https://archive.org/download/daily-highlights/web%20app1.png",
    streamUrl: "https://archive.org/download/infowars-daily-calendar/20260819_Wed_AJNPrimeTimeLive.mp4"
  },
  {
    number: 105,
    id: "vch-105",
    name: "AJN Nightly News",
    callSign: "AJN-NIGHT",
    category: "News",
    currentProgram: "Nightly News Sept 11",
    nextProgram: "Classic Docs Block",
    status: "ONLINE",
    bitrateKbps: 5500,
    viewerCount: 1680,
    logoUrl: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
    streamUrl: "https://archive.org/download/infowars-nightly-news-sd/20260819_Wed_NightlyNews_Sept11.mp4"
  },
  {
    number: 106,
    id: "vch-106",
    name: "AJN Documentaries",
    callSign: "AJN-DOCS",
    category: "Classic TV",
    currentProgram: "Police State 2000",
    nextProgram: "Bohemian Grove Exposé",
    status: "ONLINE",
    bitrateKbps: 9200,
    viewerCount: 4120,
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    streamUrl: "https://archive.org/download/infowars-police-state-docs/20000512_Fri_PoliceState2000.mp4"
  },
  {
    number: 107,
    id: "vch-107",
    name: "AJN Archives",
    callSign: "AJN-ARCH",
    category: "Classic TV",
    currentProgram: "InfoWars Classic Hour 1",
    nextProgram: "InfoWars Classic Hour 2",
    status: "ONLINE",
    bitrateKbps: 12000,
    viewerCount: 950,
    logoUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    streamUrl: "https://archive.org/download/alex-jones-infowars-archives/19980401_Wed_InfoWarsClassic_Hour1.mp4"
  },
  {
    number: 108,
    id: "vch-108",
    name: "AJN Special Events",
    callSign: "AJNX-LIVE",
    category: "Special Events",
    currentProgram: "AJN Live Special Broadcast",
    nextProgram: "AJN System Loop",
    status: "FAILOVER",
    bitrateKbps: 7800,
    viewerCount: 5840,
    logoUrl: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
    streamUrl: "https://rumble.com/embed/v79lfxq/?pub=15son"
  }
];

export const INITIAL_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: "ast-001",
    title: "Cyberpunk: Edgerunners • Ep 04",
    subtitle: "Lucky You",
    description: "David joins the crew on a high-stakes heist inside a corporate research lab.",
    provider: "Studio Trigger Archive",
    collection: "Cyberpunk Season 1",
    genre: "Sci-Fi / Anime",
    year: 2022,
    runtime: 24,
    resolution: "1080p",
    codec: "H.264 / AVC",
    audioCodec: "AAC 5.1",
    language: "English / Japanese",
    rating: "TV-MA",
    poster: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    backdrop: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    thumbnail: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    checksum: "a8f9c2d1e4b7a0f39c8e1d2b4a5c6f7e",
    playCount: 142,
    lastPlayed: "2026-08-25T18:30:00Z",
    favorite: true,
    tags: ["cyberpunk", "anime", "heist", "action"],
    lufs: -14.1,
    healthScore: 98
  },
  {
    id: "ast-002",
    title: "Blade Runner 2049",
    subtitle: "Director's Cut Showcase",
    description: "Officer K uncovers a long-buried secret that has the potential to plunge society into chaos.",
    provider: "Warner Broadcast Vault",
    collection: "Sci-Fi Classics",
    genre: "Neo-Noir / Sci-Fi",
    year: 2017,
    runtime: 163,
    resolution: "4K",
    codec: "HEVC / H.265",
    audioCodec: "Dolby Atmos",
    language: "English",
    rating: "R",
    poster: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    backdrop: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    thumbnail: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    checksum: "9b3c1a8e2f4d7b0c5a6e8f1d3b2c4a5e",
    playCount: 89,
    lastPlayed: "2026-08-24T21:00:00Z",
    favorite: true,
    tags: ["cyberpunk", "noir", "masterpiece"],
    lufs: -15.8,
    healthScore: 100
  },
  {
    id: "ast-003",
    title: "Frontier Legends • High Noon Trail",
    subtitle: "Restored Reel 3",
    description: "Classic western confrontation restored from 35mm master negatives.",
    provider: "AJN Heritage Reel",
    collection: "Western Anthology",
    genre: "Western",
    year: 1968,
    runtime: 52,
    resolution: "1080p",
    codec: "H.264",
    audioCodec: "AC3 Mono",
    language: "English",
    rating: "TV-PG",
    poster: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    backdrop: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    thumbnail: "", // Missing thumbnail intentionally for QC test
    checksum: "c4d2e1a9b8f7c6e5a4d3b2c1f0e9d8c7",
    playCount: 310,
    lastPlayed: "2026-08-26T01:15:00Z",
    favorite: false,
    tags: ["western", "classic", "restored"],
    lufs: -18.4, // Audio normalization warning
    healthScore: 68,
    isMissingArtwork: true
  },
  {
    id: "ast-004",
    title: "Midnight Tokyo Chillout Lounge",
    subtitle: "Continuous Ambient Stream",
    description: "Relaxing saxphone loops and synth pads set against rain-soaked neon street visuals.",
    provider: "SynthWave Records Ingest",
    collection: "24/7 Audio Decks",
    genre: "Ambient / Jazz",
    year: 2025,
    runtime: 180,
    resolution: "4K",
    codec: "AV1",
    audioCodec: "FLAC 96kHz",
    language: "Instrumental",
    rating: "G",
    poster: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    backdrop: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    thumbnail: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    checksum: "1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c",
    playCount: 1240,
    lastPlayed: "2026-08-26T00:00:00Z",
    favorite: true,
    tags: ["chillout", "jazz", "lofi", "tokyo"],
    lufs: -13.9,
    healthScore: 99
  },
  {
    id: "ast-005",
    title: "Frontier Legends • High Noon Trail (Copy)",
    subtitle: "Unverified Ingest Duplicate",
    description: "Duplicate file detected in FTP dropzone folder watch.",
    provider: "Unknown Ingest",
    collection: "Unsorted",
    genre: "Western",
    year: 1968,
    runtime: 52,
    resolution: "720p",
    codec: "MPEG-2",
    audioCodec: "MP2",
    language: "English",
    rating: "NR",
    poster: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    backdrop: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    thumbnail: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
    checksum: "c4d2e1a9b8f7c6e5a4d3b2c1f0e9d8c7",
    playCount: 0,
    lastPlayed: "Never",
    favorite: false,
    tags: ["duplicate", "unverified"],
    lufs: -21.0,
    healthScore: 42,
    isDuplicate: true,
    isCorrupted: false
  }
];

export const INITIAL_BRANDING_PACKAGES: Record<string, ChannelBranding> = {
  "vch-101": {
    channelId: "vch-101",
    logoUrl: "https://archive.org/download/daily-highlights/emegency.png",
    watermarkText: "AJN NEWS LIVE",
    watermarkPosition: "top-right",
    stationIdUrl: "AJN News Network • Trust & Speed",
    introUrl: "https://assets.ajn.player/intros/news-world-spin.mp4",
    outroUrl: "https://assets.ajn.player/outros/news-credits.mp4",
    lowerThirdStyle: "modern-glass",
    sponsorOverlayUrl: "Presented by Global Bloomberg Tech",
    themePrimaryColor: "#2563eb",
    themeSecondaryColor: "#1e40af",
    fontHeading: "Space Grotesk",
    fontBody: "Inter",
    transitionEffect: "wipe-right"
  },
  "vch-104": {
    channelId: "vch-104",
    logoUrl: "https://archive.org/download/daily-highlights/web%20app1.png",
    watermarkText: "AJN SCI-FI 4K",
    watermarkPosition: "bottom-right",
    stationIdUrl: "AJN Quantum Sci-Fi • The Future is Now",
    introUrl: "https://assets.ajn.player/intros/scifi-warp.mp4",
    outroUrl: "https://assets.ajn.player/outros/scifi-grid.mp4",
    lowerThirdStyle: "cyber-neon",
    sponsorOverlayUrl: "Sponsored by Cyberdyne Systems",
    themePrimaryColor: "#9333ea",
    themeSecondaryColor: "#581c87",
    fontHeading: "Outfit",
    fontBody: "JetBrains Mono",
    transitionEffect: "glitch-cut"
  }
};

export const INITIAL_OVERLAYS: GraphicsOverlay[] = [
  {
    id: "ovl-1",
    name: "Global Breaking News Strip",
    type: "breaking_news",
    active: true,
    channelId: "vch-101",
    templateData: {
      headline: "BREAKING: ORBITAL COMMISSIONS ANNOUNCE NEW LUNAR DATA RELAY AGREEMENT",
      subtext: "Markets respond with +2.4% tech sector gain in early Asian trading session.",
      bgAccent: "#dc2626"
    }
  },
  {
    id: "ovl-2",
    name: "Severe Weather Alert Banner",
    type: "weather",
    active: true,
    channelId: "ALL",
    templateData: {
      temperature: "74°F / 23°C",
      condition: "Severe Thunderstorm Watch in effect for Metro Districts until 04:00 UTC",
      bgAccent: "#d97706"
    }
  },
  {
    id: "ovl-3",
    name: "Top of Hour Station Clock",
    type: "clock",
    active: true,
    channelId: "ALL",
    templateData: {}
  },
  {
    id: "ovl-4",
    name: "Championship E-Sports Ticker",
    type: "ticker",
    active: false,
    channelId: "vch-108",
    templateData: {
      items: [
        "AJN Invitational Grand Finals • Team Apex vs CyberDynasty • Game 3 starting in 15 mins",
        "Prize Pool: $500,000 USD • MVP Voting Open via Companion App"
      ],
      bgAccent: "#059669"
    }
  }
];

export const INITIAL_RULES: AutomationRule[] = [
  {
    id: "rul-1",
    channelId: "ALL",
    name: "Anti-Repetition Guardrail",
    type: "avoid_repeat",
    enabled: true,
    config: { windowHours: 12, priority: 1 }
  },
  {
    id: "rul-2",
    channelId: "vch-106",
    name: "Prime-Time Movie Reservation",
    type: "reserve_slot",
    enabled: true,
    config: { targetSlot: "20:00-23:30", maxRating: "R", priority: 2 }
  },
  {
    id: "rul-3",
    channelId: "ALL",
    name: "Hourly Station ID Injection",
    type: "station_id_top",
    enabled: true,
    config: { intervalMin: 60, priority: 3 }
  },
  {
    id: "rul-4",
    channelId: "vch-105",
    name: "Kids Content Rating Enforcement",
    type: "content_rating",
    enabled: true,
    config: { maxRating: "TV-PG", priority: 1 }
  },
  {
    id: "rul-5",
    channelId: "ALL",
    name: "Emergency Schedule Gap Filler",
    type: "gap_filler",
    enabled: true,
    config: { priority: 5 }
  }
];

export const INITIAL_QC_ISSUES: QCIssue[] = [
  {
    id: "qc-1",
    assetId: "ast-003",
    assetTitle: "Frontier Legends • High Noon Trail",
    issueType: "missing_thumb",
    severity: "medium",
    description: "Asset is missing a promotional thumbnail image. EPG grid will render fallback gray placeholder.",
    detectedAt: "2026-08-26T01:12:00Z",
    resolved: false
  },
  {
    id: "qc-2",
    assetId: "ast-003",
    assetTitle: "Frontier Legends • High Noon Trail",
    issueType: "audio_norm",
    severity: "low",
    description: "Integrated loudness measured at -18.4 LUFS (Target is -14.0 LUFS). Stream dialogue may sound quiet compared to commercials.",
    detectedAt: "2026-08-26T01:12:05Z",
    resolved: false
  },
  {
    id: "qc-3",
    assetId: "ast-005",
    assetTitle: "Frontier Legends • High Noon Trail (Copy)",
    issueType: "duplicate",
    severity: "high",
    description: "Exact MD5 checksum match with ast-003. Redundant storage consuming 1.2 GB in dropzone.",
    detectedAt: "2026-08-26T01:20:00Z",
    resolved: false
  },
  {
    id: "qc-4",
    assetId: "ast-005",
    assetTitle: "Frontier Legends • High Noon Trail (Copy)",
    issueType: "unsupported_codec",
    severity: "medium",
    description: "Container uses legacy MPEG-2 / MP2 audio. May fail direct web browser HLS repackaging without transcoding.",
    detectedAt: "2026-08-26T01:20:02Z",
    resolved: false
  }
];

export const INITIAL_LOGS: BroadcastLog[] = [
  { id: "log-1", timestamp: "01:58:02", level: "INFO", category: "Playout", message: "Master Playout Engine synced frame cadence at 59.94 FPS.", channelId: "vch-101" },
  { id: "log-2", timestamp: "01:58:15", level: "AUTO", category: "Scheduler", message: "Rule [Anti-Repetition Guardrail] bypassed duplicate episode scheduling on ch-104.", channelId: "vch-104" },
  { id: "log-3", timestamp: "01:58:40", level: "INFO", category: "Ingest", message: "Folder Watch: Scanned 0 new files in /mnt/broadcast/incoming.", channelId: "ALL" },
  { id: "log-4", timestamp: "01:59:00", level: "AUTO", category: "Playout", message: "Top of Hour: Injected Station ID bumper [AJN Quantum Sci-Fi] on ch-104.", channelId: "vch-104" },
  { id: "log-5", timestamp: "01:59:22", level: "WARN", category: "QC", message: "Detected low LUFS (-18.4) on upcoming asset ast-003. Applying +4.2dB real-time gain boost.", channelId: "vch-102" },
  { id: "log-6", timestamp: "01:59:50", level: "RECOVERY", category: "Playout", message: "Failover Watchdog: Stream jitter on ch-108 recovered via secondary redundant HLS origin.", channelId: "vch-108" }
];

export * from "./guideSpecification";

