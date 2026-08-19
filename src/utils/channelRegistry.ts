export interface ChannelEntry {
  title: string;
  type: string;
  url?: string;
  urlPattern?: string;
  backupUrl?: string;
  hours?: number[];
  dateFormat?: string;
  parser: string;
  fallbackBehavior: string;
  filePattern?: string;
  // NEW: optional per-weekday override. Keys are 0=Sun..6=Sat.
  // If present, this takes priority over the flat urlPattern/hours for that day.
  weekdaySegments?: Record<number, { pattern: string; hours?: number[] }>;
}

export const CHANNEL_REGISTRY: Record<string, ChannelEntry> = {
  "AJN Live": {
    title: "AJN Live",
    type: "live_hls",
    url: "https://rumble.com/embed/v79lfxq/?pub=15son",
    parser: "m3u8",
    fallbackBehavior: "none"
  },

  "Warroom": {
    title: "Warroom",
    type: "archive-hourly",
    urlPattern: "https://ajn.archives.pub/hourly-m4v/{DATE}_WarRoom-Hr{HOUR}.m4v",
    hours: [1, 2, 3],
    dateFormat: "YYYYMMDD_Ddd",
    parser: "direct-m4v",
    fallbackBehavior: "48h-window"
    // No Sat/Sun WarRoom segments exist in the source feed — leave unset for those days.
  },

  "AJN Hourly": {
    title: "AJN Hourly",
    type: "archive-hourly",
    // Mon-Fri default: 4 hours, not 3 — Hr4 was being silently dropped.
    urlPattern: "https://ajn.archives.pub/hourly-m4v/{DATE}_Alex-Hr{HOUR}.m4v",
    hours: [1, 2, 3, 4],
    dateFormat: "YYYYMMDD_Ddd",
    parser: "direct-m4v",
    fallbackBehavior: "48h-window",
    weekdaySegments: {
      // Sunday: Alex-Hr1-2 only, plus a separate SundayLive block
      0: { pattern: "https://ajn.archives.pub/hourly-m4v/{DATE}_Alex-Hr{HOUR}.m4v", hours: [1, 2] },
      // Saturday: single special segment, no hour suffix at all
      6: { pattern: "https://ajn.archives.pub/hourly-m4v/{DATE}_Alex-Special.m4v" }
    }
  },

  // NEW: Sunday-only companion block that was previously unmodeled entirely.
  "AJN Sunday Live": {
    title: "AJN Sunday Live",
    type: "archive-hourly",
    urlPattern: "https://ajn.archives.pub/hourly-m4v/{DATE}_SundayLive-Hr{HOUR}.m4v",
    hours: [1, 2],
    dateFormat: "YYYYMMDD_Ddd",
    parser: "direct-m4v",
    fallbackBehavior: "48h-window"
    // Only ever populate/query this on Sundays (targetDate.getDay() === 0) in the caller.
  },

  "Big Western Zone": {
    title: "Big Western Zone",
    type: "m3u-playlist",
    url: "https://archive.org/download/daily-highlights/BIG%20WESTERN%20ZONE.m3u",
    parser: "m3u",
    fallbackBehavior: "static"
  },

  "INFOWARS Special Report": {
    title: "INFOWARS Special Report",
    type: "archive-vod",
    url: "https://archive.org/download/20101113-alex-cocoanut-oct-24",
    parser: "archive-directory",
    fallbackBehavior: "static"
  },

  "INFOWARS Nightly News": {
    title: "INFOWARS Nightly News",
    type: "archive-vod",
    url: "https://archive.org/download/infowars-nightly-news-sd",
    parser: "archive-directory",
    fallbackBehavior: "static"
  },

  "Comedy Collection": {
    title: "Comedy Collection",
    type: "archive-vod",
    url: "https://archive.org/download/comedy-collection",
    parser: "archive-directory",
    filePattern: "*.mp4",
    fallbackBehavior: "static"
  }
};
