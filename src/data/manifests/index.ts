import { createRumbleChannel, validateChannelManifests } from "../../utils/rumbleFactory";

const AJN_LIVE = createRumbleChannel({
  channelId: "ch-ajn-live",
  num: 1,
  name: "AJN Live",
  category: "Live Channels",
  logo: "https://archive.org/download/daily-highlights/lmbsa.png",
  rumbleEmbedId: "v79lfxq",
  pub: "15son",
  description: "AJN Live Continuous Broadcast"
});

const AJN_SPECIAL_REPORTS = {
  channelId: "ch-ajn-special-reports",
  num: 7,
  name: "AJN Special Reports",
  category: "Live Channels",
  logo: "https://archive.org/download/daily-highlights/emegency.png",
  type: "rss",
  source: "https://rss.alexjones.media/SpecialReports.xml",
  description: "AJN Special Reports"
};

const WARROOM = {
  channelId: "ch-warroom",
  num: 2,
  name: "Warroom",
  category: "Live Channels",
  logo: "https://archive.org/download/daily-highlights/warroom.png",
  type: "rss",
  source: "https://rss.alexjones.media/WarRoom.xml",
  description: "War Room with Harrison Smith"
};

const AJN_HOURLY = {
  channelId: "ch-ajn-hourly",
  num: 3,
  name: "AJN Hourly",
  category: "Live Channels",
  logo: "https://archive.org/download/daily-highlights/lmbsa.png",
  type: "rss",
  source: "https://rss.alexjones.media/AJNHourlyVideo.xml",
  description: "Network Feed Hourly Video"
};

const AJN_SUNDAY_LIVE = {
  channelId: "ch-ajn-sunday-live",
  num: 4,
  name: "AJN Sunday Live",
  category: "Live Channels",
  logo: "https://archive.org/download/daily-highlights/emegency.png",
  type: "rss",
  source: "https://rss.alexjones.media/SundayLive.xml",
  description: "Sunday Night Live"
};

const ARCHIVE_CHANNEL = {
  channelId: "ch-archive",
  num: 5,
  name: "Archive Channel",
  category: "Archive",
  logo: "https://archive.org/download/daily-highlights/lmbsa.png",
  type: "ia_collection",
  source: "https://archive.org/details/daily-highlights",
  description: "AJN Archives"
};

const SURVIVAL = createRumbleChannel({
  channelId: "ch-survival",
  num: 6,
  name: "Survival Impossible Odds",
  category: "Documentary",
  logo: "https://archive.org/download/daily-highlights/lmbsa.png",
  rumbleEmbedId: "v72y52a",
  pub: "15son",
  sourcePageUrl: "https://rumble.com/v754t2i-i-shouldnt-be-alive.html",
  description: "Survival Against Impossible Odds Documentary Series",
});

const HONEYMOONERS = {
  id: "the-honeymooners-classic",
  title: "The Honeymooners",
  category: "Classic TV / Movies",
  streamUrl: "https://archive.org/download/daily-highlights/honeymooner%20classic%20movies.m3u",
  manifestFallbackUrl: "https://archive.org/download/daily-highlights/honey%20mooners%20classic%20movies.json",
  provider: "Archive.org (Daily Highlights)"
};

export const DefaultChannelManifests = [
  AJN_LIVE,
  WARROOM,
  AJN_HOURLY,
  AJN_SUNDAY_LIVE,
  ARCHIVE_CHANNEL,
  SURVIVAL,
  HONEYMOONERS,
  AJN_SPECIAL_REPORTS
];

if (import.meta.env?.DEV) {
  const warnings = validateChannelManifests(DefaultChannelManifests);
  warnings.forEach((w) => console.warn(`[Channel Manifest] ${w}`));
}

export const LiveChannelManifests: any[] = [];
