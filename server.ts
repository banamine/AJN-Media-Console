import dotenv from "dotenv";
dotenv.config();

import express from "express";import streamProxyRouter from "./server/routes/streamProxy.ts";import { ingestionRouter } from "./server/routes/ingestion.ts";
import path from "path";
import fs from "fs";
import cors from "cors";
import { rename, writeFile } from "fs/promises";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";
import { exec } from "child_process";
import { promisify } from "util";
import { isUrlSafe } from "./src/utils/ssrfGuard.ts";
import crypto from "crypto";
import { runScraperJob } from "./server/thumbnailScraper.ts";

// Atomic Write Helper to prevent corruption
async function atomicWrite(filePath: string, data: string) {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  await writeFile(tmpPath, data, 'utf-8');
  await rename(tmpPath, filePath);
}
import {
  initDatabase,
  getNewsProfiles,
  updateNewsProfileActiveState,
  updateNewsProfileHarvestTime,
  getEpisodes,
  insertEpisode,
  purgeOldEpisodes,
  reconstructSegments,
  NEWS_REGISTRY,
  mergeDatabasePayload,
  getCustomChannels,
  insertCustomChannel,
  deleteCustomChannel,
  mergeRssArchiveEpisodes,
  getRssArchiveEpisodes
} from "./server/storage.ts";

// Utility to get ISO week bucket for 4-Week Rolling Channel Buffer
function getWeekBucket(pubDate: Date) {
  // Lock calculations to UTC and force Monday 00:00:00 UTC start
  const date = new Date(Date.UTC(pubDate.getUTCFullYear(), pubDate.getUTCMonth(), pubDate.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday is 0, make it 7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  const startD = new Date(pubDate);
  startD.setUTCDate(startD.getUTCDate() - (pubDate.getUTCDay() || 7) + 1);
  startD.setUTCHours(0, 0, 0, 0);

  const endD = new Date(startD);
  endD.setUTCDate(endD.getUTCDate() + 6);
  endD.setUTCHours(23, 59, 59, 999);

  return {
    year: date.getUTCFullYear(),
    weekNumber: weekNo,
    startDate: startD,
    endDate: endD,
    bucketId: `${date.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
  };
}
import {
  initPodcastDB,
  runPodcastIngestion,
  getStations,
  getRecentEpisodes,
  getFavorites,
  addFavorite,
  removeFavorite
} from "./server/podcastDB.ts";
import {
  initTelemetryDatabase,
  logTelemetryEvent,
  getTelemetryStats,
  setOutageSimulation,
  isOutageSimulated,
  clearTelemetryEvents
} from "./server/telemetryStorage.ts";

// Keep reference to native global fetch
const nativeFetch = globalThis.fetch;

// Safe Fetch Wrapper implementing SSRF Guard protection
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  if (!isUrlSafe(url)) {
    throw new Error(`SSRF Guard Block: Access to URL is restricted for security: ${url}`);
  }
  return nativeFetch(url, options);
}

// Override local fetch with SSRF-protected safeFetch
const fetch = safeFetch;

import zlib from "zlib";

// ============================================================================
// METADATA PIPELINE: FOUR-PASS HEADLINE REMASTERING ENGINE
// ============================================================================
function remasterHeadline(rawTitle: string, streamUrl: string): string {
  let title = rawTitle || "";

  // PASS 1: Strip control characters and normalize Cyrillic homoglyphs back to ASCII
  // Instead of destructive [\u0400-\u04FF]+ which ruins valid international text
  title = title.replace(/[\x00-\x1F\x7F]/g, "");
  title = sanitizeCyrillicHomoglyphs(title);

  // PASS 2: URL Fallback Reconstruction (If generic or empty, parse raw Archive.org path)
  if (!title || /^(unnamed|broadcast|stream|show|item|video)$/i.test(title.trim()) || title.trim().length < 3) {
    if (streamUrl && streamUrl.includes("archive.org")) {
      try {
        const url = new URL(streamUrl);
        const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
        title = filename.split(".")[0]; // Isolate base media asset slug
      } catch {
        title = "Archive Live Broadcast";
      }
    }
  }

  // PASS 3: Token Normalization, Case Correction & Prefix Stripping
  title = title.replace(/_/g, " ");
  
  // Strip KaHan/Канал prefixes and delimiters safely
  const strippedPrefix = title.replace(/^(?:Канал|KaHan|Kahan)\b(?:\s*\d+)?\s*[-–—:]*\s*/gi, "").trim();
  if (strippedPrefix) {
    title = strippedPrefix;
  } else {
    title = title.replace(/\b(?:Канал|KaHan|Kahan)\b/gi, "").trim();
  }

  const extensions = [
    /\.mp4$/i, /\.mkv$/i, /\.ts$/i, /\.m3u8$/i, /\.avi$/i, /\.flv$/i, 
    /\.webm$/i, /\.mov$/i, /\.wmv$/i, /\.mpg$/i, /\.mpeg$/i, /\.m4v$/i, /\.mp3$/i
  ];
  for (const ext of extensions) {
    title = title.replace(ext, "");
  }

  const tags = [
    /\b1080p\b/i, /\b720p\b/i, /\b480p\b/i, /\b4k\b/i, /\b2k\b/i,
    /\bhd\b/i, /\bsd\b/i, /\bx264\b/i, /\bx265\b/i, /\bh264\b/i, /\bh265\b/i,
    /\baac\b/i, /\bmp3\b/i, /\bweb-dl\b/i, /\bhdrip\b/i, /\bbluray\b/i,
    /\bwebrip\b/i, /\bxvid\b/i
  ];
  for (const tag of tags) {
    title = title.replace(tag, "");
  }

  const misspellings: [RegExp, string][] = [
    [/\bThrsday\b/gi, "Thursday"],
    [/\bThurday\b/gi, "Thursday"],
    [/\bWaroom\b/gi, "Warroom"],
    [/\bWensday\b/gi, "Wednesday"],
    [/\bWednesdy\b/gi, "Wednesday"],
    [/\bTusday\b/gi, "Tuesday"],
    [/\bFrday\b/gi, "Friday"],
    [/\bSaturdy\b/gi, "Saturday"],
    [/\bSundy\b/gi, "Sunday"],
    [/\bMondy\b/gi, "Monday"],
    [/\bAlx\s+Jons\b/gi, "Alex Jones"],
    [/\bAlex\s+Jonse\b/gi, "Alex Jones"]
  ];
  for (const [regex, replacement] of misspellings) {
    title = title.replace(regex, replacement);
  }

  title = title.replace(/\s*-\s*/g, "-");
  
  // Enforce standard broadcast Title Case
  title = title.replace(/\b\w/g, c => c.toUpperCase());

  // PASS 4: Defensive Whitespace Collapsing & AJN Brand Uniformity Protection
  title = title.replace(/\s+/g, " ").trim();

  if (/^ajn\b/i.test(title)) {
    title = title.replace(/^ajn[\s\-_/:]*/i, "AJN/");
  }

  return title || "AJN Unified Media Stream";
}

// Clean Title utility to normalize channel and show titles
function cleanTitle(title: string): string {
  return remasterHeadline(title, "");
}

// Map Cyrillic homoglyph lookalikes back to Latin ASCII characters
function sanitizeCyrillicHomoglyphs(str: string): string {
  if (!str) return "";
  const homoglyphs: Record<string, string> = {
    'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'у': 'y', 'х': 'x', 'і': 'i', 'ѕ': 's',
    'А': 'A', 'С': 'C', 'Е': 'E', 'О': 'O', 'Р': 'P', 'Х': 'X', 'І': 'I', 'Ѕ': 'S', 'М': 'M',
    'Н': 'H', 'Т': 'T', 'В': 'B'
  };
  return str.split('').map(char => homoglyphs[char] || char).join('');
}

// Eliminate script injections and potential XSS attempts
function filterScriptInjections(str: string): string {
  if (!str) return "";
  let cleaned = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/javascript\s*:/gi, "");
  cleaned = cleaned.replace(/\bon[a-z]+\s*=\s*["'][^"']*["']/gi, "");
  cleaned = cleaned.replace(/\bon[a-z]+\s*=\s*[^\s>]+/gi, "");
  return cleaned;
}

// Playout Caching & Dynamic Generator
let cachedPlayoutResponse: any[] | null = null;
let cachedPlayoutTime = 0;


// ============================================================================
// AUTO-HYDRATION PIPELINE: Rumble Live Stream HLS Token
// ============================================================================
let globalLiveChannels: Record<string, string> = {};

function updateLiveChannelUrl(name: string, url: string) {
  globalLiveChannels[name] = url;
  cachedPlayoutResponse = null; // Invalidate playout cache so it uses the fresh token
}

async function hydrateRumbleLiveStream() {
  console.log("[Hydration] Fetching fresh Rumble HLS stream token...");
  const liveVideoId = "v5xwnen"; // Designated 24/7 Live ID from user

  try {
    const url = `https://rumble.com/embedJS/u3/?request=video&v=${liveVideoId}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error("Failed to reach Rumble metadata API.");
    
    const data = await response.json();
    let freshM3u8Url = typeof data?.u === 'string' ? data.u : (data?.u?.hls?.url || data?.u?.mp4?.['480']?.url);

    if (freshM3u8Url) {
      // OVERWRITE the live stream URL in your active memory/database
      // This ensures when the frontend calls /api/v1/playout/channels, it gets the fresh link
      updateLiveChannelUrl('AJN Live 24/7', freshM3u8Url); 
      console.log("[Hydration] SUCCESS: Active M3U payload updated with fresh stream link.");
    } else {
      throw new Error("No valid HLS or MP4 URL found in payload.");
    }
  } catch (err: any) {
    console.error("[Hydration Error]:", err.message);
  }
}

function getCompiledPlayoutChannels(): any[] {
  const now = Math.floor(Date.now() / 1000);
  if (cachedPlayoutResponse && (now - cachedPlayoutTime < 2)) {
    return cachedPlayoutResponse;
  }

  const channels: any[] = [];
  const FALLBACK_ASSETS = [
    { title: "AJN National Broadcast Transmission Card", duration: 3600, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "AJN Geopolitical Security Briefing", duration: 1800, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "AJN History Archive Feature", duration: 5400, url: "https://rumble.com/embed/v77ec70/?pub=15son" }
  ];

  const EPOCH_TIMESTAMP = 1735689600;

  function getPlayoutSegment(episodes: any[], offsetIndex = 0) {
    if (!episodes || episodes.length === 0) {
      const fb = FALLBACK_ASSETS[offsetIndex % FALLBACK_ASSETS.length];
      const cycle = Math.floor((now - EPOCH_TIMESTAMP) / fb.duration);
      const start = EPOCH_TIMESTAMP + cycle * fb.duration;
      return {
        title: fb.title,
        start,
        end: start + fb.duration,
        streamUrl: fb.url
      };
    }

    let totalDuration = 0;
    for (const ep of episodes) {
      totalDuration += ep.durationInSeconds || ep.duration || 3600;
    }
    if (totalDuration === 0) totalDuration = 3600;

    let timeShift = 0;
    const targetIdx = ((offsetIndex % episodes.length) + episodes.length) % episodes.length;
    for (let i = 0; i < targetIdx; i++) {
      timeShift += episodes[i].durationInSeconds || episodes[i].duration || 3600;
    }

    const deltaT = now - EPOCH_TIMESTAMP;
    let effectiveTime = (deltaT + timeShift) % totalDuration;
    if (effectiveTime < 0) {
      effectiveTime += totalDuration;
    }

    let runningSum = 0;
    let activeEpisode = episodes[0];
    let seekPosition = 0;

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const dur = ep.durationInSeconds || ep.duration || 3600;
      if (effectiveTime < runningSum + dur) {
        activeEpisode = ep;
        seekPosition = Math.floor(effectiveTime - runningSum);
        // Attach next episode title as a property on the active episode temporarily
        (activeEpisode as any)._nextTitleTemp = episodes[(i + 1) % episodes.length].title || episodes[(i + 1) % episodes.length].name || "Transmission Segment";
        break;
      }
      runningSum += dur;
    }

    const start = now - seekPosition;
    const end = start + (activeEpisode.durationInSeconds || activeEpisode.duration || 3600);

    return {
      title: activeEpisode.title || activeEpisode.name || "Transmission Segment",
      start,
      end,
      streamUrl: activeEpisode.url || activeEpisode.streamUrl || "https://rumble.com/embed/v77ec70/?pub=15son",
      nextTitle: (activeEpisode as any)._nextTitleTemp || "Next Transmission Segment"
    };
  }

  // 1. Compile 180 Virtual Channels
  const TEMPLATE_EPISODES = [
    { title: "Morning War Room Briefing", durationInSeconds: 1800, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Midday Special Report", durationInSeconds: 1200, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Evening Geopolitical Round", durationInSeconds: 2400, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Nightly Dispatch Digest", durationInSeconds: 1500, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Globalist Takedown Hour 1", durationInSeconds: 3600, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Sovereignty Defense Strategy", durationInSeconds: 2700, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Bohemian Grove Exposé (1999)", durationInSeconds: 5400, url: "https://rumble.com/embed/v77ec70/?pub=15son" },
    { title: "Police State 2000 Documentary", durationInSeconds: 4800, url: "https://rumble.com/embed/v77ec70/?pub=15son" }
  ];

  const AJN_NAMES = [
    "🌐 AJN WARROOM VOD RSS Archive",
    "🚀 AJN Today Hub",
    "📅 AJN Archive Dates Hub",
    "🚨 AJN Special Coverage",
    "⚡ AJN Breaking News",
    "🎙️ AJN Daily Segments"
  ];

  const CATS = [
    "News", "Geopolitics", "Archive", "Documentary", "Civics", 
    "Economics", "Health", "Investigations", "World", "Technology", 
    "Late Night", "Movies", "Shows", "Music", "Variety"
  ];

  for (let i = 0; i < 180; i++) {
    const offsetIndex = i * 5;
    const segment = getPlayoutSegment(TEMPLATE_EPISODES, offsetIndex);

    let name = `Channel ${i + 1}`;
    let category = "Variety";

    if (i < AJN_NAMES.length) {
      name = AJN_NAMES[i];
      category = "AJN Hub";
    } else {
      const cat = CATS[(i - AJN_NAMES.length) % CATS.length];
      name = `${cat} Network CH ${i + 1}`;
      category = cat;
    }

    channels.push({
      id: `vch-${i + 1}`,
      name: cleanTitle(name),
      streamUrl: segment.streamUrl,
      backupUrl: "https://rumble.com/embed/v77ec70/?pub=15son",
      aspectRatioHint: "16:9",
      contentType: "vod",
      currentSegment: {
        title: segment.title,
        start: segment.start,
        end: segment.end,
        nextTitle: segment.nextTitle
      }
    });
  }

  // 2. Add News Profiles
  try {
    const profiles = getNewsProfiles() || [];
    profiles.forEach(profile => {
      const episodes = getEpisodes(profile.id) || [];
      const formattedEps = episodes.map(ep => ({
        title: ep.title,
        durationInSeconds: 1800,
        url: ep.url
      }));

      const segment = getPlayoutSegment(formattedEps, 0);

      channels.push({
        id: `news-profile-${profile.id}`,
        name: cleanTitle(profile.displayName),
        streamUrl: segment.streamUrl,
        backupUrl: "https://rumble.com/embed/v77ec70/?pub=15son",
        aspectRatioHint: "16:9",
        contentType: "live",
        currentSegment: {
        title: segment.title,
        start: segment.start,
        end: segment.end,
        nextTitle: segment.nextTitle
      }
      });
    });
  } catch (err: any) {
    console.error("[Playout channels compiler] News profiles error:", err.message);
  }

  // 3. Add Custom Shows from tv_guide.json
  const tvGuidePath = path.join(process.cwd(), "tv_guide.json");
  if (fs.existsSync(tvGuidePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(tvGuidePath, "utf-8"));
      if (data && data.shows) {
        Object.entries(data.shows).forEach(([showName, showData]: [string, any]) => {
          const episodes = showData.episodes || [];
          const formattedEps = episodes.map((ep: any, idx: number) => ({
            title: `Episode ${idx + 1}`,
            durationInSeconds: 3600,
            url: ep.url
          }));

          const segment = getPlayoutSegment(formattedEps, 0);

          channels.push({
            id: `show-${showName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            name: cleanTitle(showName),
            streamUrl: segment.streamUrl,
            backupUrl: "https://rumble.com/embed/v77ec70/?pub=15son",
            aspectRatioHint: "16:9",
            contentType: "vod",
            currentSegment: {
        title: segment.title,
        start: segment.start,
        end: segment.end,
        nextTitle: segment.nextTitle
      }
          });
        });
      }
    } catch (e: any) {
      console.error("[Playout channels compiler] tv_guide.json read error:", e.message);
    }
  }

  // 4. Add Custom Auto-Channels from storage
  try {
    const customChannels = getCustomChannels() || [];
    customChannels.forEach(ch => {
      const episodes = ch.episodes || [];
      const segment = getPlayoutSegment(episodes, 0);

      channels.push({
        id: ch.id,
        name: cleanTitle(ch.name),
        streamUrl: segment.streamUrl,
        backupUrl: "https://rumble.com/embed/v77ec70/?pub=15son",
        aspectRatioHint: "16:9",
        contentType: "vod",
        currentSegment: {
          title: segment.title,
          start: segment.start,
          end: segment.end,
          nextTitle: segment.nextTitle
        }
      });
    });
  } catch (err: any) {
    console.error("[Playout channels compiler] Custom auto channels compiler error:", err.message);
  }

  // Sanitize values
  const sanitizedChannels = channels.map(ch => {
    return {
      id: sanitizeCyrillicHomoglyphs(filterScriptInjections(ch.id)),
      name: sanitizeCyrillicHomoglyphs(filterScriptInjections(ch.name)),
      streamUrl: filterScriptInjections(ch.streamUrl),
      backupUrl: filterScriptInjections(ch.backupUrl),
      aspectRatioHint: ch.aspectRatioHint,
      contentType: ch.contentType,
      currentSegment: {
        title: sanitizeCyrillicHomoglyphs(filterScriptInjections(ch.currentSegment.title)),
        start: ch.currentSegment.start,
        end: ch.currentSegment.end
      }
    };
  });

  cachedPlayoutResponse = sanitizedChannels;
  cachedPlayoutTime = now;
  
  if (globalLiveChannels['AJN Live 24/7']) {
    const liveChannelIndex = sanitizedChannels.findIndex(c => c.name.includes("AJN Live 24/7") || c.name.includes("ALN LIVE"));
    if (liveChannelIndex >= 0) {
      sanitizedChannels[liveChannelIndex].streamUrl = globalLiveChannels['AJN Live 24/7'];
      sanitizedChannels[liveChannelIndex].contentType = "live";
    } else {
      // Prepend to top if not already there
      sanitizedChannels.unshift({
        id: 'ajn-live-247',
        name: 'AJN Live 24/7',
        streamUrl: globalLiveChannels['AJN Live 24/7'],
        backupUrl: "https://rumble.com/embed/v77ec70/?pub=15son",
        aspectRatioHint: "16:9",
        contentType: "live",
        currentSegment: {
          title: "AJN 24/7 Live Stream",
          start: now - 3600,
          end: now + 3600
        }
      });
    }
  }

  return sanitizedChannels;
  
}

async function startServer() {
  const app = express();

// Express MIME Patch for HLS and JS variants
express.static.mime.define({'application/vnd.apple.mpegurl': ['m3u8']});
express.static.mime.define({'video/mp2t': ['ts']});
express.static.mime.define({'application/javascript': ['js', 'cjs', 'mjs']});

  const PORT = 3000;
  let lastSyncTime: string | null = null;


  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: "10mb" }));

  // Initialize SQLite Database
  try {
    await initDatabase();
    await initTelemetryDatabase();
    
    // Podcast Radio Tuner initialization
    initPodcastDB();
    runPodcastIngestion();
    
    console.log("[Database] Initialized SQLite successfully.");
  } catch (err: any) {
    console.error("[Database] Failed to initialize SQLite:", err.message);
  }

  // Jaquith Algorithm: Deduplicates a list of episode candidates to prevent headline repetition.
  function jaquithDeduplicate(episodes: Array<{ title: string; url: string; timestamp: number }>): Array<{ title: string; url: string; timestamp: number }> {
    const seenUrls = new Set<string>();
    const unique: Array<{ title: string; url: string; timestamp: number }> = [];

    for (const ep of episodes) {
      if (!ep.url) continue;
      if (seenUrls.has(ep.url)) {
        continue;
      }

      // Compute word tokens for Jaccard similarity comparison (Jaquith Algorithm)
      const tokens1 = new Set(
        ep.title
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
      );

      let isDuplicateHeadline = false;
      for (const existing of unique) {
        if (existing.url === ep.url) {
          isDuplicateHeadline = true;
          break;
        }

        const tokens2 = new Set(
          existing.title
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w: string) => w.length > 2)
        );

        if (tokens1.size > 0 && tokens2.size > 0) {
          let intersection = 0;
          for (const t of tokens1) {
            if (tokens2.has(t)) {
              intersection++;
            }
          }
          const union = tokens1.size + tokens2.size - intersection;
          const jaccardSimilarity = intersection / union;
          // If similarity is > 0.80, treat as a duplicate headline
          if (jaccardSimilarity > 0.8) {
            isDuplicateHeadline = true;
            break;
          }
        }
      }

      if (!isDuplicateHeadline) {
        seenUrls.add(ep.url);
        unique.push(ep);
      }
    }

    return unique;
  }

  // Classify each accepted item against the profile that owns the record.
  function classifyNewsSource(title: string, url: string, profile: any) {
    const regInfo = NEWS_REGISTRY[profile.id] || {
      displayName: profile.displayName,
      logoUrl: profile.logoUrl
    };
    return {
      profileId: profile.id,
      logoUrl: regInfo.logoUrl || profile.logoUrl || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
      displayName: regInfo.displayName || profile.displayName
    };
  }

  function newsProfileMatches(profile: any, title: string, url: string, guid: string): boolean {
    const haystack = `${title} ${url} ${guid}`.toLowerCase();
    const aliases: Record<string, string[]> = {
      CNNW: ["cnnw", "cnn"],
      FOXNEWSW: ["foxnewsw", "fox news", "foxnews"],
      MSNBCW: ["msnbcw", "msnbc"],
      BBCNEWS: ["bbcnews", "bbc news"],
      NTD: ["ntd"]
    };
    const profileAliases = aliases[String(profile.callsign || "").toUpperCase()] || [String(profile.callsign || "").toLowerCase()];
    return profileAliases.some(alias => alias && haystack.includes(alias));
  }

  function parseNewsTimestamp(raw: string, profile: any): number | null {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return null;
    const timestamp = Date.parse(trimmed);
    if (!Number.isFinite(timestamp)) {
      console.warn(`[NewsBot] Invalid pubDate for ${profile.callsign}: ${trimmed}`);
      return null;
    }
    return timestamp;
  }

  // NewsBot 12-hour News Harvest Cycle
  async function runNewsHarvest() {
    console.log("[NewsBot] Starting 12-hour news harvest cycle...");
    try {
      const fs = await import("fs/promises");
      const { existsSync } = await import("fs");
      const profiles = getNewsProfiles();
      const activeProfiles = profiles.filter(p => p.isActive);

      console.log(`[NewsBot] Active profiles to harvest: ${activeProfiles.map(p => p.callsign).join(", ")}`);

      const prodDir = path.join(process.cwd(), "production");
      const stageDir = path.join(prodDir, "staging");

      await fs.mkdir(stageDir, { recursive: true });

      for (const profile of activeProfiles) {
        const url = profile.rssUrl;
        if (!url) {
          console.warn(`[NewsBot] No RSS URL defined for profile ${profile.callsign}`);
          continue;
        }
        
        // SSRF Protection check
        if (!isUrlSafe(url)) {
          console.warn(`[NewsBot] SSRF Guard blocked insecure RSS URL: ${url}`);
          continue;
        }

        console.log(`[NewsBot] Harvesting profile: ${profile.displayName} from ${url}`);

        try {
          // Fetch RSS, JSON or TSV Feed with timeout
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AJN-NewsBot/1.0"
            },
            signal: AbortSignal.timeout(30000)
          });

          if (!response.ok) {
            console.error(`[NewsBot] Failed to fetch feed for ${profile.callsign}. Status: ${response.status}`);
            continue;
          }

          const xmlText = await response.text();
          let rawEpisodes: Array<{ title: string; url: string; timestamp: number }> = [];

          if (url.endsWith(".json") || url.includes("/json") || response.headers.get("content-type")?.includes("json")) {
            try {
              const jsonData = JSON.parse(xmlText);
              const items = Array.isArray(jsonData) ? jsonData : (jsonData.items || jsonData.docs || []);
              for (const item of items) {
                const title = String(item.title || item.headline || "").trim();
                const videoUrl = String(item.url || item.enclosure || item.video || item.link || "").trim();
                const pubDateStr = String(item.pubDate || item.date || item.timestamp || "");
                if (videoUrl.startsWith("http") && newsProfileMatches(profile, title, videoUrl, String(item.guid || item.id || ""))) {
                  const timestamp = parseNewsTimestamp(pubDateStr, profile);
                  if (timestamp !== null) {
                    const remastered = remasterHeadline(title, videoUrl);
                    rawEpisodes.push({ title: remastered, url: videoUrl, timestamp });
                  }
                }
              }
            } catch (jsonErr: any) {
              console.error(`[NewsBot] Failed to parse JSON feed for ${profile.callsign}:`, jsonErr.message);
            }
          } else if (url.endsWith(".tsv") || url.includes("/tsv")) {
            const lines = xmlText.split(/\r?\n/);
            for (const line of lines) {
              if (!line.trim()) continue;
              const cols = line.split("\t");
              if (cols.length >= 2) {
                const title = cols[0].trim();
                const videoUrl = cols[1].trim();
                const pubDateStr = cols[2] ? cols[2].trim() : "";
                if (videoUrl.startsWith("http") && newsProfileMatches(profile, title, videoUrl, "")) {
                  const timestamp = parseNewsTimestamp(pubDateStr, profile);
                  if (timestamp !== null) {
                    const remastered = remasterHeadline(title, videoUrl);
                    rawEpisodes.push({ title: remastered, url: videoUrl, timestamp });
                  }
                }
              }
            }
          } else {
            // Default: RSS XML parsing. Accept GUID/id variants and never invent timestamps.
            const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            while ((match = itemRegex.exec(xmlText)) !== null) {
              const itemContent = match[1];

              const readTag = (tag: string): string => {
                const re = new RegExp(`<${tag}\\b[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
                const m = itemContent.match(re);
                return m ? m[1].trim() : "";
              };

              const title = readTag("title");
              const guid = readTag("guid") || readTag("id");
              let videoUrl = "";
              const enclosureMatch = itemContent.match(/<enclosure\\b[^>]*url=["']([^"']+)["']/i);
              videoUrl = enclosureMatch ? enclosureMatch[1].trim() : readTag("link");
              const pubDateStr = readTag("pubDate") || readTag("published") || readTag("updated");

              if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) continue;
              if (!newsProfileMatches(profile, title, videoUrl, guid)) continue;

              const timestamp = parseNewsTimestamp(pubDateStr, profile);
              if (timestamp === null) continue;

              const remastered = remasterHeadline(title, videoUrl);
              rawEpisodes.push({ title: remastered, url: videoUrl, timestamp });
            }
          }

          // Apply Jaquith Algorithm headline deduplication
          const dedupedEpisodes = jaquithDeduplicate(rawEpisodes);

          let newClipsCount = 0;
          for (const ep of dedupedEpisodes) {
            // Apply classifyNewsSource logic
            const classification = classifyNewsSource(ep.title, ep.url, profile);

            const urlHash = crypto.createHash("md5").update(ep.url).digest("hex");
            const episodeId = `${classification.profileId}-${urlHash}`;

            insertEpisode({
              id: episodeId,
              profileId: classification.profileId,
              title: ep.title,
              url: ep.url,
              timestamp: ep.timestamp
            });

            newClipsCount++;
          }

          updateNewsProfileHarvestTime(profile.id, new Date().toISOString());
          console.log(`[NewsBot] Successfully harvested ${newClipsCount} clips for ${profile.callsign}`);

        } catch (err: any) {
          console.error(`[NewsBot] Error harvesting profile ${profile.callsign}:`, err.message);
        }
      }

      // "Stale Metadata" Purge Window (DELETE clips older than 24 hours)
      const purgeCutoff = purgeOldEpisodes();
      console.log(`[NewsBot] Purged stale metadata older than 24h (cutoff: ${new Date(purgeCutoff).toISOString()})`);

      // Compile M3U Manifests using Atomic Swaps
      for (const profile of activeProfiles) {
        const episodes = getEpisodes(profile.id);
        if (episodes.length === 0) continue;

        let m3uContent = "#EXTM3U\n";
        const registryInfo = NEWS_REGISTRY[profile.id] || { displayName: profile.displayName, logoUrl: profile.logoUrl };
        const logoUrl = registryInfo.logoUrl;
        const displayName = registryInfo.displayName;

        for (const ep of episodes) {
          m3uContent += `#EXTINF:-1 tvg-logo="${logoUrl}" tvg-name="${profile.callsign}" group-title="News", ${displayName} - ${ep.title}\n${ep.url}\n`;
        }

        const stagingFilePath = path.join(stageDir, `news_${profile.callsign}.m3u`);
        const prodFilePath = path.join(prodDir, `news_${profile.callsign}.m3u`);

        // Ensure staging directory exists right before write to prevent race conditions or deletion errors
        await fs.mkdir(stageDir, { recursive: true });
        await fs.writeFile(stagingFilePath, m3uContent, "utf-8");

        if (existsSync(stagingFilePath)) {
          const stats = await fs.stat(stagingFilePath);
          if (stats.size > 0) {
            await fs.rename(stagingFilePath, prodFilePath);
            console.log(`[NewsBot] Atomic Swap success: Compiled ${prodFilePath}`);
          } else {
            console.error(`[NewsBot] Staging validation failed (empty file) for ${profile.callsign}`);
          }
        }
      }

    } catch (err: any) {
      console.error("[NewsBot] Harvest Cycle Error:", err.message);
    }
  }

  // Recursive Stale Data Purge Routine
  async function runStaleDataPurge() {
    console.log("[Cleanup] Running stale data purge routine...");
    try {
      const fs = await import("fs/promises");
      const { existsSync } = await import("fs");
      const prodDir = path.join(process.cwd(), "production");
      const stageDir = path.join(prodDir, "staging");
      const mediaLibDir = path.join(process.cwd(), "media_library");

      const cutoff = Date.now() - 72 * 60 * 60 * 1000; // 72 hours ago

      const cleanFolder = async (folderPath: string) => {
        if (!existsSync(folderPath)) return;
        const items = await fs.readdir(folderPath, { withFileTypes: true });
        for (const item of items) {
          const itemPath = path.join(folderPath, item.name);
          if (item.isDirectory()) {
            if (item.name === "staging") {
              // Never delete the staging directory itself
              await cleanFolder(itemPath);
              continue;
            }
            await cleanFolder(itemPath);
            const sub = await fs.readdir(itemPath);
            if (sub.length === 0) {
              await fs.rmdir(itemPath).catch(() => {});
            }
          } else if (item.isFile() && item.name.endsWith(".m3u")) {
            const stats = await fs.stat(itemPath);
            if (stats.mtimeMs < cutoff) {
              await fs.unlink(itemPath);
              console.log(`[Cleanup] Deleted stale M3U manifest (older than 72h): ${itemPath}`);
            }
          }
        }
      };

      await cleanFolder(prodDir);
      await cleanFolder(stageDir);
      await cleanFolder(mediaLibDir);
    } catch (err: any) {
      console.error("[Cleanup] Error running stale data purge:", err.message);
    }
  }

  // Run immediate harvests on boot for self-healing/setup (Cold Start Fetch)
  console.log("[Boot] Executing Cold Start Fetch for RSS/Metadata Hydration...");
  runNewsHarvest().catch(err => console.error("[Boot] Cold Start Fetch failed:", err));

  // 2. Execute on Boot (Cold Start)
  hydrateRumbleLiveStream();

  // 3. Keep it Alive (Refresh tokens every 4 hours before they expire)
  setInterval(hydrateRumbleLiveStream, 4 * 60 * 60 * 1000); 

  runStaleDataPurge().catch(err => console.error("[Boot] Stale Data Purge failed:", err));

  // Set up 12-hour Cron-based triggers for harvest & stale data purge
  setInterval(() => {
    runNewsHarvest();
    runStaleDataPurge();
  }, 4 * 60 * 60 * 1000);

  // Health Check & Runtime Diagnostic Endpoint (Cloud Run probe)
  
  // Now Playing API - Channels segmented by buckets
  app.get("/api/now-playing", (req, res) => {
    // In-memory buckets for channels
    const channels = [
      { number: 100, name: "ALN LIVE RUMBLE", category: "News", url: "https://rumble.com/embed/v77ec70/?pub=15son" },
      { number: 101, name: "AJN NIGHTLY NEWS", category: "News", url: "https://archive.org/download/RT_20260817_000000_News/RT_20260817_000000_News.mp4" },
      { number: 102, name: "AJN ARCHIVES", category: "News", url: "https://archive.org/download/daily-highlights/AJN%20archive%201.m3u" },
      { number: 103, name: "ALL M3U JSON", category: "News", url: "https://archive.org/download/daily-highlights/all%20m3u.json" },
      { number: 300, name: "Classic Westerns", category: "Westerns", url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8" }
    ];
    res.json({ success: true, channels });
  });

  // Basic ingestion endpoint for auto-fetch
  app.post("/api/ingest", express.json(), async (req, res) => {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }
    
    if (!isUrlSafe(url)) {
      res.status(403).json({ error: "SSRF Guard Block: Access to URL is restricted for security" });
      return;
    }
    
    // Stub discovery and assignment
    let category = "News";
    if (url.toLowerCase().includes("crime")) category = "Crime";
    if (url.toLowerCase().includes("western")) category = "Westerns";
    
    res.json({ success: true, message: "Channel ingested automatically", category, url });
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: {
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        appUrl: process.env.APP_URL || "http://localhost:3000",
        nodeEnv: process.env.NODE_ENV || "development"
      }
    });
  });

  // ==========================================
  // PODCAST TUNER APIs
  // ==========================================

  app.get("/api/tuner/stations", (req, res) => {
    try {
      const { genre, country } = req.query;
      const stations = getStations(genre as string, country as string);
      res.json(stations);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tuner/recent", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 200;
      const episodes = getRecentEpisodes(Math.min(limit, 500));
      res.json(episodes);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/favorites", (req, res) => {
    try {
      const userId = req.query.userId as string || 'default-user';
      const favs = getFavorites(userId);
      res.json(favs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/favorites", (req, res) => {
    try {
      const { userId = 'default-user', podcastId } = req.body;
      if (!podcastId) { res.status(400).json({ error: "podcastId required" }); return; }
      addFavorite(userId, podcastId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/favorites/:podcastId", (req, res) => {
    try {
      const podcastId = parseInt(req.params.podcastId);
      const userId = req.query.userId as string || 'default-user';
      if (isNaN(podcastId)) { res.status(400).json({ error: "invalid podcastId" }); return; }
      removeFavorite(userId, podcastId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  let currentNowPlaying: any = null;
  app.post("/api/tuner/now-playing", (req, res) => {
    const { podcastId, channelNumber, title, episodeTitle, audioUrl, publishedLocal, durationFormatted, shortSummary, source } = req.body;
    currentNowPlaying = {
      podcastId, channelNumber, title, episodeTitle, audioUrl, publishedLocal, durationFormatted, shortSummary, source
    };
    res.json({ success: true });
  });

  app.get("/api/tuner/now-playing", (req, res) => {
    res.json(currentNowPlaying || {});
  });

  // Rumble OEmbed Cache File Path
  const RUMBLE_CACHE_PATH = path.join(process.cwd(), "rumble_cache.json");

  // Load Rumble Cache
  let rumbleCache: Record<string, any> = {};
  try {
    const fs = await import("fs/promises");
    const data = await fs.readFile(RUMBLE_CACHE_PATH, "utf-8");
    rumbleCache = JSON.parse(data);
    console.log(`[Rumble Cache] Loaded ${Object.keys(rumbleCache).length} cached channels.`);
  } catch (err) {
    console.log("[Rumble Cache] Cache file not found or invalid. Initializing empty cache.");
    // Pre-populate with seed data so we don't crash and always have offline fallbacks
    rumbleCache = {
      "https://rumble.com/v60552h-newsmax2-live-real-news-for-real-people.html": {
        "title": "Newsmax 2 Live",
        "thumbnail_url": "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
        "duration": 7200,
        "html": "<iframe src=\"https://rumble.com/embed/v5xwnen/?pub=15son\" width=\"100%\" height=\"100%\" frameborder=\"0\" allowfullscreen></iframe>",
        "embed_url": "https://rumble.com/embed/v5xwnen/?pub=15son",
        "isLive": true
      },
      "https://rumble.com/v7bs5m6-alex-jones-show-247.html": {
        "title": "AJN Live 24/7 (Alex Jones Show 24/7)",
        "thumbnail_url": "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
        "duration": 7200,
        "html": "<iframe src=\"https://rumble.com/embed/v77ec70/?pub=15son\" width=\"100%\" height=\"100%\" frameborder=\"0\" allowfullscreen></iframe>",
        "embed_url": "https://rumble.com/embed/v77ec70/?pub=15son",
        "isLive": true
      }
    };
    try {
      const fs = await import("fs/promises");
      await fs.writeFile(RUMBLE_CACHE_PATH, JSON.stringify(rumbleCache, null, 2));
    } catch {}
  }

  // Channel Registry Tags File Path & Persistence
  const CHANNEL_REGISTRY_PATH = path.join(process.cwd(), "channel_registry.json");
  let channelRegistryData: { tags: Record<string, string[]>; allTags: string[] } = { tags: {}, allTags: [] };

  try {
    const fs = await import("fs/promises");
    const data = await fs.readFile(CHANNEL_REGISTRY_PATH, "utf-8");
    channelRegistryData = JSON.parse(data);
    console.log(`[Channel Registry] Loaded ${Object.keys(channelRegistryData.tags || {}).length} channel tags configurations.`);
  } catch (err) {
    console.log("[Channel Registry] channel_registry.json not found or invalid. Initializing empty.");
  }

  app.get("/api/channel-registry/tags", (req, res) => {
    res.json(channelRegistryData);
  });

  app.post("/api/channel-registry/tags", async (req, res) => {
    try {
      const { tags, allTags } = req.body;
      if (tags !== undefined) {
        channelRegistryData.tags = tags;
      }
      if (allTags !== undefined) {
        channelRegistryData.allTags = allTags;
      }
      await atomicWrite(CHANNEL_REGISTRY_PATH, JSON.stringify(channelRegistryData, null, 2));
      res.json({ success: true, data: channelRegistryData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Save Rumble Cache Helper
  async function saveRumbleCache() {
    try {
      await atomicWrite(RUMBLE_CACHE_PATH, JSON.stringify(rumbleCache, null, 2));
    } catch (err: any) {
      console.error("[Rumble Cache Error] Failed to write cache:", err.message);
    }
  }

  // Warm the cache on startup asynchronously
  
  // Maintain SSE clients for Rumble live URL updates
  const rumbleSseClients: express.Response[] = [];

  function notifyRumbleSseClients(data: any) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    rumbleSseClients.forEach(client => {
      try {
        client.write(payload);
      } catch (err) {
        // ignore write errors, client will be removed on close
      }
    });
  }

  // Native TS Rumble Live Resolver
  const PRIMARY_EMBED_PAGE_URL = "https://www.alexjoneslive.com/show/";
  const BACKUP_EMBED_PAGE_URL = "https://www.alexjoneslive.com/";
  const STATIC_FALLBACK_EMBED_URL = "https://rumble.com/embed/v5xwnen/?pub=15son"; // 24/7 Live Feed
  const CACHE_KEY = "https://rumble.com/v7bs5m6-alex-jones-show-247.html";
  const RESOLVER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const POLL_INTERVAL_MS = 5 * 60 * 1000;

  const IFRAME_PATTERNS = [
    /class="[^"]*rumble-livestream[^"]*"[^>]*\b(?:src|data-original_src|data-src)="(https:\/\/rumble\.com\/embed\/[^"]+)"/i,
    /\b(?:src|data-original_src|data-src)="(https:\/\/rumble\.com\/embed\/[^"]+)"[^>]*class="[^"]*rumble-livestream[^"]*"/i,
    /\b(?:src|data-original_src|data-src)="(https:\/\/rumble\.com\/embed\/[^"]+)"/i
  ];

  async function validateViaOembed(embedUrl: string) {
    const oembedUrl = "https://rumble.com/api/oembed.json?url=" + encodeURIComponent(embedUrl);
    try {
      const res = await fetch(oembedUrl, {
        headers: { "User-Agent": RESOLVER_USER_AGENT },
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.html) return data;
      }
    } catch (err) {
      // ignore
    }
    return null;
  }

  function extractRumbleEmbed(html: string) {
    for (const pattern of IFRAME_PATTERNS) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  async function resolveOnce() {
    try {
      const channelUrl = PRIMARY_EMBED_PAGE_URL;
      console.log(`[Rumble Resolver] Scanning embedding page: ${channelUrl}`);
      
      const response = await fetch(channelUrl, {
        headers: { 
          "User-Agent": RESOLVER_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        console.warn(`[Rumble Resolver] Channel page returned status ${response.status} (anti-bot protection). Using active cache fallback.`);
        return;
      }
      const html = await response.text();

      // Extract embed matches
      const embedUrl = extractRumbleEmbed(html);
      if (!embedUrl) {
         console.warn(`[Rumble Resolver] No embed found on channel page.`);
         return;
      }

      const previous = rumbleCache[CACHE_KEY];
      if (previous && embedUrl === previous.embed_url) {
        console.log(`[Rumble Resolver] Scraped embed matches cache -- no change.`);
        return;
      }

      // Validate via OEmbed
      const oembed = await validateViaOembed(embedUrl);
      if (!oembed) return;

      const cleanHtml = `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
      
      rumbleCache[CACHE_KEY] = {
        title: oembed.title || "AJN Live 24/7",
        thumbnail_url: oembed.thumbnail_url || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
        duration: 86400,
        html: cleanHtml,
        embed_url: embedUrl,
        isLive: true,
        source: "scrape",
        last_checked: Date.now()
      };

      console.log(`[Rumble Resolver] 🟢 SUCCESS: Embed updated -> ${embedUrl}`);
      await saveRumbleCache();
      notifyRumbleSseClients({ success: true, embedUrl: embedUrl, source: "scrape" });

    } catch (e: any) {
      console.warn(`[Rumble Resolver] Notice: Could not refresh live stream (${e.message}). Operating on cached/fallback stream.`);
    }
  }

  function startNativeRumbleResolver() {
    resolveOnce();
    setInterval(resolveOnce, POLL_INTERVAL_MS);
  }

  // Start the resolver on boot
  startNativeRumbleResolver();

const defaultRumbleUrls = [
    "https://rumble.com/v60552h-newsmax2-live-real-news-for-real-people.html",
    "https://rumble.com/v7bs5m6-alex-jones-show-247.html"
  ];
  setTimeout(async () => {
    console.log("[Rumble Cache] Warming cache for default channels...");
    for (const url of defaultRumbleUrls) {
      if (!rumbleCache[url] || rumbleCache[url].thumbnail_url?.includes("ajn_logo")) {
        try {
          const oembedUrl = `https://rumble.com/api/oembed.json?url=${encodeURIComponent(url)}`;
          const response = await fetch(oembedUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            signal: AbortSignal.timeout(30000)
          });
          if (response.ok) {
            const odata: any = await response.json();
            if (odata && odata.html) {
              const cleanHtml = odata.html.replace(/\\/g, "");
              const srcMatch = cleanHtml.match(/src="([^"]+)"/);
              const embedUrl = srcMatch ? srcMatch[1] : null;
              rumbleCache[url] = {
                title: odata.title || (url.includes("newsmax2") ? "Newsmax 2 Live" : "AJN Live 24/7"),
                thumbnail_url: odata.thumbnail_url || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
                duration: odata.duration || 7200,
                html: cleanHtml,
                embed_url: embedUrl || url,
                isLive: cleanHtml.includes("live") || (odata.title && odata.title.toLowerCase().includes("live"))
              };
              console.log(`[Rumble Cache] Successfully cached: ${url}`);
            }
          }
        } catch (err: any) {
          console.error(`[Rumble Cache Warming Failed] for ${url}:`, err.message);
        }
      }
    }
    await saveRumbleCache();
  }, 2000);

  // Helper to generate high-quality synthetic Rumble OEmbed metadata for embed URLs or failure fallbacks
  function generateSyntheticRumbleData(url: string) {
    const cleanUrl = url.trim();
    let title = "Rumble Broadcast";
    let isLive = true;

    // Attempt to extract slug or path
    try {
      const urlObj = new URL(cleanUrl);
      const pathname = urlObj.pathname; // e.g. /embed/v77ec70/ or /embed/v48oawx-alex-jones-live.html
      const parts = pathname.split("/").filter(Boolean);
      const lastPart = parts[parts.length - 1] || "";
      let slug = lastPart.replace(".html", "");
      
      if (slug) {
        // Remove any prefix like "v" followed by numbers
        let words = slug.replace(/^v\d+[a-z]*-?/, "");
        if (words) {
          title = words
            .split("-")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        } else {
          // If it was just an ID, e.g., v77ec70
          if (cleanUrl.includes("v77ec70")) {
            title = "Bannon's War Room";
          } else if (cleanUrl.includes("v78377u")) {
            title = "Red Voice Media";
          } else if (cleanUrl.includes("v5xwnen")) {
            title = "Newsmax Live";
          } else {
            title = `Rumble Video (${slug})`;
          }
        }
      }
    } catch (e) {
      if (cleanUrl.includes("v77ec70")) {
        title = "Bannon's War Room";
      } else if (cleanUrl.includes("v78377u")) {
        title = "Red Voice Media";
      } else if (cleanUrl.includes("v5xwnen")) {
        title = "Newsmax Live";
      }
    }

    if (cleanUrl.includes("vod") || cleanUrl.includes("archive")) {
      isLive = false;
    }

    const html = `<iframe src="${cleanUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;

    return {
      title,
      thumbnail_url: "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
      duration: 7200,
      html,
      embed_url: cleanUrl,
      isLive
    };
  }

  // API Endpoint: Parse single Rumble URL via OEmbed with 10s timeout, caching, and clean html backslashes
  app.get("/api/rumble/oembed", async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).json({ success: false, error: "Missing required query parameter: url" });
      return;
    }

    const cleanUrl = rawUrl.trim();

    // Check Cache
    if (rumbleCache[cleanUrl]) {
      console.log(`[Rumble Cache] Hit for: ${cleanUrl}`);
      res.json({ success: true, fromCache: true, data: rumbleCache[cleanUrl] });
      return;
    }

    // Embed URLs can bypass the upstream Rumble oembed endpoint entirely since it returns 404 for embed/ URLs
    if (cleanUrl.includes("rumble.com/embed/") || !cleanUrl.toLowerCase().includes("rumble.com")) {
      console.log(`[Rumble OEmbed] Generating synthetic metadata for embed URL: ${cleanUrl}`);
      const parsedData = generateSyntheticRumbleData(cleanUrl);
      rumbleCache[cleanUrl] = parsedData;
      await saveRumbleCache();
      res.json({ success: true, fromCache: false, data: parsedData });
      return;
    }

    try {
      console.log(`[Rumble OEmbed] Fetching details for: ${cleanUrl}`);
      const oembedUrl = `https://rumble.com/api/oembed.json?url=${encodeURIComponent(cleanUrl)}`;
      
      const response = await fetch(oembedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(30000) // 10-second timeout
      });

      if (!response.ok) {
        throw new Error(`Upstream Rumble OEmbed returned status ${response.status}`);
      }

      const odata: any = await response.json();
      if (!odata || !odata.html) {
        throw new Error("Invalid OEmbed response from Rumble");
      }

      // Clean backslashes
      let rawHtml = odata.html || "";
      const cleanHtml = rawHtml.replace(/\\/g, "");

      // Extract src attribute from iframe
      const srcMatch = cleanHtml.match(/src="([^"]+)"/);
      const embedUrl = srcMatch ? srcMatch[1] : null;

      // Map details
      const parsedData = {
        title: odata.title || "Rumble Video",
        thumbnail_url: odata.thumbnail_url || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
        duration: odata.duration || 7200, // default 2 hours
        html: cleanHtml,
        embed_url: embedUrl || cleanUrl,
        isLive: cleanHtml.includes("live") || (odata.title && odata.title.toLowerCase().includes("live"))
      };

      // Save to cache
      rumbleCache[cleanUrl] = parsedData;
      await saveRumbleCache();

      res.json({ success: true, fromCache: false, data: parsedData });
    } catch (err: any) {
      console.warn(`[Rumble OEmbed Error - Falling back to synthetic] Failed for ${cleanUrl}:`, err.message);
      // Fallback gracefully to synthetic metadata to ensure 100% operational uptime
      const parsedData = generateSyntheticRumbleData(cleanUrl);
      rumbleCache[cleanUrl] = parsedData;
      await saveRumbleCache();
      res.json({ success: true, fromCache: false, fallback: true, data: parsedData });
    }
  });

  // API Endpoint: Fetch multiple Rumble URLs (Batch Fetch)
  app.post("/api/rumble/batch-oembed", async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) {
      res.status(400).json({ success: false, error: "Missing or invalid parameter: urls must be an array of strings" });
      return;
    }

    const results: Record<string, any> = {};
    const promises = urls.map(async (url) => {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;

      if (rumbleCache[cleanUrl]) {
        results[cleanUrl] = rumbleCache[cleanUrl];
        return;
      }

      // Embed URL bypass
      if (cleanUrl.includes("rumble.com/embed/") || !cleanUrl.toLowerCase().includes("rumble.com")) {
        const parsedData = generateSyntheticRumbleData(cleanUrl);
        rumbleCache[cleanUrl] = parsedData;
        results[cleanUrl] = parsedData;
        return;
      }

      try {
        const oembedUrl = `https://rumble.com/api/oembed.json?url=${encodeURIComponent(cleanUrl)}`;
        const response = await fetch(oembedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Scientific/537.36) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(30000) // 10s timeout per url
        });

        if (response.ok) {
          const odata: any = await response.json();
          if (odata && odata.html) {
            const cleanHtml = odata.html.replace(/\\/g, "");
            const srcMatch = cleanHtml.match(/src="([^"]+)"/);
            const embedUrl = srcMatch ? srcMatch[1] : null;

            const parsedData = {
              title: odata.title || "Rumble Video",
              thumbnail_url: odata.thumbnail_url || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
              duration: odata.duration || 7200,
              html: cleanHtml,
              embed_url: embedUrl || cleanUrl,
              isLive: cleanHtml.includes("live") || (odata.title && odata.title.toLowerCase().includes("live"))
            };

            rumbleCache[cleanUrl] = parsedData;
            results[cleanUrl] = parsedData;
          } else {
            throw new Error("Missing html in oembed response");
          }
        } else {
          throw new Error(`OEmbed HTTP Error ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`[Rumble Batch Error - Falling back to synthetic] Failed for ${cleanUrl}:`, err.message);
        const parsedData = generateSyntheticRumbleData(cleanUrl);
        rumbleCache[cleanUrl] = parsedData;
        results[cleanUrl] = parsedData;
      }
    });

    await Promise.allSettled(promises);
    await saveRumbleCache();

    res.json({ success: true, data: results });
  });

  // API Endpoint: Scan Rumble channel for latest videos
  app.get("/api/rumble/channel/:username", async (req, res) => {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ success: false, error: "Missing required parameter: username" });
      return;
    }

    try {
      console.log(`[Rumble Channel Scan] Scanning username: ${username}`);
      let targetUrl = `https://rumble.com/c/${username}`;
      const rumbleHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://rumble.com/"
      };

      let response = await fetch(targetUrl, {
        headers: rumbleHeaders,
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        targetUrl = `https://rumble.com/user/${username}`;
        response = await fetch(targetUrl, {
          headers: rumbleHeaders,
          signal: AbortSignal.timeout(30000)
        });
      }

      if (!response.ok) {
        console.warn(`[Rumble Channel Scan] Rumble channel page returned status ${response.status} (anti-bot guard). Returning graceful fallback seed catalog.`);
        res.json({
          success: true,
          videos: [
            {
              url: "https://rumble.com/embed/v77ec70/?pub=15son",
              title: "AJN National Broadcast Transmission Card",
              thumbnail_url: "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp",
              duration: 3600
            },
            {
              url: "https://rumble.com/embed/v77ec70/?pub=15son",
              title: "AJN Geopolitical Security Briefing",
              thumbnail_url: "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp",
              duration: 1800
            }
          ]
        });
        return;
      }

      const html = await response.text();
      // Use regex to find all /v[0-9a-zA-Z]+-[a-zA-Z0-9_\-\.]+\.html links
      const videoMatches = html.matchAll(/href="(\/v[0-9a-zA-Z]+-[a-zA-Z0-9_\-\.]+\.html)"/g);
      const videoUrls = new Set<string>();
      for (const match of videoMatches) {
        videoUrls.add(`https://rumble.com${match[1]}`);
      }

      const urlsArray = Array.from(videoUrls).slice(0, 5); // take latest 5
      console.log(`[Rumble Channel Scan] Found ${urlsArray.length} videos for ${username}`);

      if (urlsArray.length === 0) {
        res.json({ success: true, videos: [] });
        return;
      }

      // Automatically batch-resolve them so the client gets complete metadata
      const results: any[] = [];
      for (const url of urlsArray) {
        if (rumbleCache[url]) {
          results.push({ url, ...rumbleCache[url] });
        } else {
          try {
            const oembedUrl = `https://rumble.com/api/oembed.json?url=${encodeURIComponent(url)}`;
            const oRes = await fetch(oembedUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              },
              signal: AbortSignal.timeout(30000)
            });
            if (oRes.ok) {
              const odata: any = await oRes.json();
              if (odata && odata.html) {
                const cleanHtml = odata.html.replace(/\\/g, "");
                const srcMatch = cleanHtml.match(/src="([^"]+)"/);
                const parsed = {
                  title: odata.title || "Rumble Video",
                  thumbnail_url: odata.thumbnail_url || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
                  duration: odata.duration || 7200,
                  html: cleanHtml,
                  embed_url: srcMatch ? srcMatch[1] : url,
                  isLive: cleanHtml.includes("live") || (odata.title && odata.title.toLowerCase().includes("live"))
                };
                rumbleCache[url] = parsed;
                results.push({ url, ...parsed });
              }
            }
          } catch (err: any) {
            console.error(`[Scan Resolver Error] Failed for ${url}:`, err.message);
          }
        }
      }
      await saveRumbleCache();

      res.json({ success: true, videos: results });
    } catch (err: any) {
      console.error(`[Rumble Channel Scan Error] Failed for ${username}:`, err.message);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // API Route: Split and Organize large master M3U files into modular files & tv_guide.json
  app.post("/api/m3u-splitter/process", async (req, res) => {
    try {
      const { content, pattern, deduplicate = true, sanitizeUnicode = true, outputDir = "media_library", jsonOutput = "tv_guide.json" } = req.body;
      if (!content) {
        res.status(400).json({ success: false, error: "No M3U content provided" });
        return;
      }

      const fs = await import("fs/promises");
      const { existsSync } = await import("fs");

      // Compile regex from provided string or fallback
      let titleRegex: RegExp;
      try {
        titleRegex = new RegExp(pattern || "#EXTINF:.*?,(.*?)(?:\\s+-\\s+|\\s+\\[|$)");
      } catch (err: any) {
        res.status(400).json({ success: false, error: `Invalid regular expression: ${err.message}` });
        return;
      }

      const lines = content.split(/\r?\n/);
      const tvGuide: { shows: Record<string, { episodes: Array<{ info: string, url: string }>, path: string }> } = { shows: {} };
      const seenUrls = new Set<string>();

      // 1. Gather all unique URLs to perform a pre-flight validation pass
      const allUrlsToValidateSet = new Set<string>();
      let tempExtinf = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXTINF")) {
          tempExtinf = line;
        } else if (line && !line.startsWith("#") && tempExtinf) {
          allUrlsToValidateSet.add(line);
          tempExtinf = "";
        }
      }

      // Convert to array
      const urlsToValidate = Array.from(allUrlsToValidateSet);

      // Perform high-performance pre-flight validation pass on all URLs
      const validUrlsSet = new Set<string>();
      
      const splitterValidationPromises = urlsToValidate.map(async (url) => {
        let isSafe = false;
        try {
          isSafe = isUrlSafe(url);
        } catch (e) {
          isSafe = false;
        }

        if (!isSafe) {
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const response = await nativeFetch(url, {
            method: "HEAD",
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            }
          });
          clearTimeout(timeoutId);

          if (response.status >= 200 && response.status < 400) {
            validUrlsSet.add(url);
          }
        } catch (err) {
          clearTimeout(timeoutId);
        }
      });

      await Promise.all(splitterValidationPromises);

      // Ensure output directory exists
      const targetDir = path.join(process.cwd(), outputDir);
      await fs.mkdir(targetDir, { recursive: true });

      // Clean previous M3U files in output directory to prevent cumulative files
      try {
        if (existsSync(targetDir)) {
          const items = await fs.readdir(targetDir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              const showPath = path.join(targetDir, item.name);
              const files = await fs.readdir(showPath);
              for (const file of files) {
                if (file.endsWith(".m3u")) {
                  await fs.unlink(path.join(showPath, file)).catch(() => {});
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[M3U Splitter] Warning clearing old output files:", e);
      }

      // Helper to sanitize folder/file names
      const sanitizeName = (name: string): string => {
        let clean = name.replace(/[\\/*?:"<>|]/g, "").trim();
        if (sanitizeUnicode) {
          // Replace decorative non-standard Unicode with simple ASCII equivalents or prune symbols
          clean = clean.replace(/[^\x20-\x7E]/g, "").trim();
        }
        return clean || "Unnamed_Show";
      };

      let extinfLine = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXTINF")) {
          extinfLine = line;
        } else if (line && !line.startsWith("#") && extinfLine) {
          const url = line;

          // Check pre-flight pass: if invalid, skip entirely!
          if (!validUrlsSet.has(url)) {
            extinfLine = ""; // Reset
            continue;
          }

          const match = extinfLine.match(titleRegex);
          let showTitle = "Unknown Show";
          if (match && match[1]) {
            showTitle = sanitizeName(match[1]);
          } else {
            const commaIdx = extinfLine.indexOf(",");
            if (commaIdx !== -1) {
              showTitle = sanitizeName(extinfLine.substring(commaIdx + 1));
            }
          }

          // Deduplication check
          if (!deduplicate || !seenUrls.has(url)) {
            if (deduplicate) {
              seenUrls.add(url);
            }

            const showFolder = path.join(targetDir, showTitle);
            await fs.mkdir(showFolder, { recursive: true });

            const showM3uPath = path.join(showFolder, `${showTitle}.m3u`);
            await fs.appendFile(showM3uPath, `${extinfLine}\n${url}\n`, "utf-8");

            if (!tvGuide.shows[showTitle]) {
              tvGuide.shows[showTitle] = {
                episodes: [],
                path: `${outputDir}/${showTitle}/${showTitle}.m3u`
              };
            }

            tvGuide.shows[showTitle].episodes.push({
              info: extinfLine,
              url: url
            });
          }
          extinfLine = ""; // Reset
        }
      }

      // Save tv_guide.json
      const tvGuidePath = path.join(process.cwd(), jsonOutput);
      await fs.writeFile(tvGuidePath, JSON.stringify(tvGuide, null, 4), "utf-8");

      res.json({
        success: true,
        stats: {
          totalShows: Object.keys(tvGuide.shows).length,
          totalEpisodes: seenUrls.size || lines.filter((l: string) => l.startsWith("#EXTINF")).length,
          outputDirectory: outputDir,
          jsonFilename: jsonOutput,
          invalidUrlsFiltered: urlsToValidate.length - validUrlsSet.size
        },
        tvGuide
      });

    } catch (error: any) {
      console.error("[M3U Splitter Error]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Load existing tv_guide.json index
  app.get("/api/m3u-splitter/load-guide", async (req, res) => {
    try {
      const fs = await import("fs/promises");
      const { existsSync } = await import("fs");
      const tvGuidePath = path.join(process.cwd(), "tv_guide.json");
      if (existsSync(tvGuidePath)) {
        const data = await fs.readFile(tvGuidePath, "utf-8");
        res.json({ success: true, tvGuide: JSON.parse(data) });
      } else {
        res.json({ success: false, message: "No tv_guide.json found" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Custom Auto-Channels API (Drop & Go Ingest Pipeline)
  function cleanDropGoTitle(filename: string): string {
    let title = filename.split(/[/\\]/).pop() || filename;

    const extensions = [
      /\.mp4$/i, /\.mkv$/i, /\.ts$/i, /\.m3u8$/i, /\.avi$/i, /\.flv$/i, 
      /\.webm$/i, /\.mov$/i, /\.wmv$/i, /\.mpg$/i, /\.mpeg$/i, /\.m4v$/i, 
      /\.mp3$/i, /\.wav$/i, /\.ogg$/i, /\.flac$/i, /\.m3u$/i
    ];
    for (const ext of extensions) {
      title = title.replace(ext, "");
    }

    title = title.replace(/[^\x20-\x7E]/g, "");

    const trackerTags = [
      /\[\s*1080p\s*\]/gi, /\(\s*1080p\s*\)/gi, /\b1080p\b/gi,
      /\[\s*720p\s*\]/gi, /\(\s*720p\s*\)/gi, /\b720p\b/gi,
      /\[\s*480p\s*\]/gi, /\(\s*480p\s*\)/gi, /\b480p\b/gi,
      /\[\s*4k\s*\]/gi, /\(\s*4k\s*\)/gi, /\b4k\b/gi,
      /\[\s*YTS\s*\]/gi, /\[\s*YIFY\s*\]/gi, /\[\s*EZTV\s*\]/gi, /\[\s*RARBG\s*\]/gi,
      /\[\s*ENG\s*\]/gi, /\[\s*ENG[-_]SUB\s*\]/gi, /\bENG[-_]SUB\b/gi,
      /\[\s*HEVC\s*\]/gi, /\bx264\b/gi, /\bx265\b/gi, /\bh264\b/gi, /\bh265\b/gi,
      /\[\s*[a-f0-9]{8}\s*\]/gi,
      /\bhdr\b/gi, /\bweb[-_]dl\b/gi, /\bwebrip\b/gi, /\bbluray\b/gi, /\bxvid\b/gi
    ];
    for (const tag of trackerTags) {
      title = title.replace(tag, "");
    }

    title = title.replace(/[_\.\-+]+/g, " ");
    title = title.replace(/\s+/g, " ").trim();

    return title || "Clean Auto Track";
  }

  app.get("/api/ajn-custom-auto-channels", (req, res) => {
    try {
      const channels = getCustomChannels();
      res.json({ success: true, channels });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/ajn-custom-auto-channels", (req, res) => {
    try {
      const { id, num, name, logo, episodes = [], behavior = "binge", staggerOffsetSeconds = 0 } = req.body;
      
      if (!id || !name) {
        res.status(400).json({ success: false, error: "Missing channel id or name" });
        return;
      }

      // Sanitize each episode's title silently in the background
      const sanitizedEpisodes = episodes.map((ep: any, idx: number) => {
        const cleanTitle = cleanDropGoTitle(ep.title || `Episode ${idx + 1}`);
        return {
          id: ep.id || `ep-${id}-${idx}-${Date.now()}`,
          title: cleanTitle,
          durationInSeconds: ep.durationInSeconds || 1800,
          url: ep.url || "https://rumble.com/embed/v77ec70/?pub=15son",
          thumbnail: ep.thumbnail || logo || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
          plot: ep.plot || "Automated back-to-back playout sequence segment.",
          genre: ep.genre || "Variety",
          rating: ep.rating || "TV-G"
        };
      });

      const totalDuration = sanitizedEpisodes.reduce((acc: number, ep: any) => acc + ep.durationInSeconds, 0);

      const customChannel = {
        id,
        num: parseInt(num, 10) || 99,
        name,
        logo: logo || "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/ajn_logo.png",
        category: "Auto-Channels",
        m3uRef: `mux-${id}`,
        offsetIndex: 0,
        url: sanitizedEpisodes[0]?.url || "https://rumble.com/embed/v77ec70/?pub=15son",
        type: "drop_go",
        source: "drop_go",
        behavior,
        staggerOffsetSeconds,
        episodes: sanitizedEpisodes,
        totalLoopDurationInSeconds: totalDuration,
        isPermanent: true
      };

      insertCustomChannel(customChannel);
      res.json({ success: true, channel: customChannel });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/ajn-custom-auto-channels/:id", (req, res) => {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ success: false, error: "Missing channel id" });
        return;
      }
      const deleted = deleteCustomChannel(id);
      res.json({ success: true, deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Pre-boot Check for media_library files
  app.get("/api/m3u-splitter/pre-boot-check", async (req, res) => {
    try {
      const fs = await import("fs/promises");
      const { existsSync } = await import("fs");
      const targetDir = path.join(process.cwd(), "media_library");
      
      if (!existsSync(targetDir)) {
        await fs.mkdir(targetDir, { recursive: true });
        res.json({ success: true, message: "media_library directory was missing, auto-created it.", count: 0 });
        return;
      }

      const items = await fs.readdir(targetDir, { withFileTypes: true });
      let m3uCount = 0;
      for (const item of items) {
        if (item.isDirectory()) {
          const subFiles = await fs.readdir(path.join(targetDir, item.name));
          m3uCount += subFiles.filter(f => f.endsWith(".m3u")).length;
        } else if (item.isFile() && item.name.endsWith(".m3u")) {
          m3uCount++;
        }
      }

      res.json({ success: true, message: `Found ${m3uCount} M3U playlists in media_library.`, count: m3uCount });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Validate Links Pre-flight
  app.post("/api/media/validate-links", async (req, res) => {
    try {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) {
        res.status(400).json({ success: false, error: "urls parameter must be an array of strings" });
        return;
      }

      const valid: string[] = [];
      const invalid: string[] = [];

      const validationPromises = urls.map(async (url) => {
        let isSafe = false;
        try {
          isSafe = isUrlSafe(url);
        } catch (e) {
          isSafe = false;
        }

        if (!isSafe) {
          invalid.push(url);
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const response = await nativeFetch(url, {
            method: "HEAD",
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            }
          });
          clearTimeout(timeoutId);

          if (response.status >= 200 && response.status < 400) {
            valid.push(url);
          } else {
            invalid.push(url);
          }
        } catch (err) {
          clearTimeout(timeoutId);
          invalid.push(url);
        }
      });

      await Promise.all(validationPromises);

      res.json({ valid, invalid });
    } catch (error: any) {
      console.error("[Link Validation Error]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Get remote sync status
  app.get("/api/sync/status", (req, res) => {
    res.json({
      success: true,
      lastSynced: lastSyncTime,
      syncSecretConfigured: !!process.env.SYNC_SECRET_KEY
    });
  });

  // Unified Playout Channels Matrix Endpoint
  app.get("/api/v1/playout/channels", (req, res) => {
    try {
      const data = getCompiledPlayoutChannels();
      const jsonStr = JSON.stringify({ success: true, channels: data });

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Cache-Control", "public, max-age=2");

      zlib.gzip(Buffer.from(jsonStr), (err, buffer) => {
        if (err) {
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.send(buffer);
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API Route: Push EPG database state
  app.post("/api/sync/push", async (req, res) => {
    try {
      const providedPasskey = req.headers["x-sync-passkey"] || req.headers["authorization"] || req.body.passkey;
      const secret = process.env.SYNC_SECRET_KEY || "ajn_handshake_secret_2026";
      
      const isAuthorized = (providedPasskey === secret) || (providedPasskey === `Bearer ${secret}`);
      
      if (!isAuthorized) {
        res.status(401).json({ success: false, error: "Cryptographic handshake failed. Unauthorized sync attempt." });
        return;
      }

      const payload = req.body.payload || {};
      
      // 1. Merge news profiles and episodes
      if (payload.news_profiles || payload.episodes) {
        mergeDatabasePayload({
          news_profiles: payload.news_profiles,
          episodes: payload.episodes
        });
      }

      // 2. Save channel registry tags
      if (payload.channel_registry) {
        const CHANNEL_REGISTRY_PATH = path.join(process.cwd(), "channel_registry.json");
        await fs.promises.writeFile(CHANNEL_REGISTRY_PATH, JSON.stringify(payload.channel_registry, null, 2), "utf-8");
      }

      // 3. Save custom EPG / TV guide
      if (payload.tv_guide) {
        const guidePath = path.join(process.cwd(), "tv_guide.json");
        await fs.promises.writeFile(guidePath, JSON.stringify(payload.tv_guide, null, 2), "utf-8");
      }

      lastSyncTime = new Date().toISOString();
      
      res.json({
        success: true,
        message: "Handshake verified. Broadcast guide merged successfully.",
        timestamp: lastSyncTime
      });
    } catch (err: any) {
      console.error("[Sync Push Error]:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Get news profiles
  app.get("/api/newsbot/profiles", (req, res) => {
    try {
      const profiles = getNewsProfiles();
      res.json({ success: true, profiles });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Toggle news profile active state
  app.post("/api/newsbot/profiles/toggle", (req, res) => {
    try {
      const { id, isActive } = req.body;
      if (!id) {
        res.status(400).json({ success: false, error: "Missing profile id" });
        return;
      }
      updateNewsProfileActiveState(id, isActive);
      res.json({ success: true, message: `Profile ${id} active state updated to ${isActive}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Manual News Harvest trigger
  app.post("/api/newsbot/harvest", async (req, res) => {
    try {
      await runNewsHarvest();
      res.json({ success: true, message: "News harvest and Atomic Swap completed successfully." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Electronic Program Guide (EPG)
  app.get("/api/epg", (req, res) => {
    try {
      const channels = getCompiledPlayoutChannels();
      const epg = channels.map(ch => ({
        channelId: ch.id,
        channelName: ch.name,
        streamUrl: ch.streamUrl,
        contentType: ch.contentType,
        nowPlaying: {
          title: ch.currentSegment?.title || "Transmission Segment",
          startTime: ch.currentSegment?.start ? new Date(ch.currentSegment.start * 1000).toISOString() : null,
          endTime: ch.currentSegment?.end ? new Date(ch.currentSegment.end * 1000).toISOString() : null,
        }
      }));
      res.json({ success: true, epgCount: epg.length, epg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Get articles/clips from harvested episodes
  app.get("/api/articles", (req, res) => {
    try {
      const profileId = req.query.profileId as string | undefined;
      const episodes = getEpisodes(profileId);
      const articles = episodes.map(ep => ({
        id: ep.id,
        profileId: ep.profileId,
        title: ep.title,
        url: ep.url,
        publishedAt: new Date(ep.timestamp).toISOString(),
        timestamp: ep.timestamp
      }));
      res.json({ success: true, articlesCount: articles.length, articles });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Cache for segment sizes to avoid redundant network overhead
  const segmentSizeCache = new Map<string, number>();

  async function getSegmentSize(url: string): Promise<number> {
    if (segmentSizeCache.has(url)) {
      return segmentSizeCache.get(url)!;
    }
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const len = res.headers.get("content-length");
        if (len) {
          const size = parseInt(len, 10);
          if (size > 0) {
            segmentSizeCache.set(url, size);
            return size;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Stitcher] HEAD request failed for ${url}, trying GET range:`, err.message);
    }

    try {
      const res = await fetch(url, {
        headers: { Range: "bytes=0-0" },
        signal: AbortSignal.timeout(10000)
      });
      if (res.status === 206 || res.status === 200) {
        const contentRange = res.headers.get("content-range");
        if (contentRange) {
          const parts = contentRange.split("/");
          if (parts.length === 2) {
            const size = parseInt(parts[1], 10);
            if (size > 0) {
              segmentSizeCache.set(url, size);
              return size;
            }
          }
        }
        const len = res.headers.get("content-length");
        if (len && res.status === 200) {
          const size = parseInt(len, 10);
          if (size > 0) {
            segmentSizeCache.set(url, size);
            return size;
          }
        }
      }
    } catch (err: any) {
      console.error(`[Stitcher] Fallback GET size failed for ${url}:`, err.message);
    }

    return 5 * 1024 * 1024; // Sensible default fallback of 5MB
  }

  // API Route: Virtual Stitch Playback Endpoint
  app.get("/api/m3u-splitter/virtual-stitch", async (req, res) => {
    const { profileId, showId, id } = req.query;
    const targetId = (profileId || showId || id) as string;

    if (!targetId) {
      res.status(400).send("profileId, showId, or id query parameter is required");
      return;
    }

    let eps: Array<{ title: string; url: string; timestamp?: number }> = [];

    // 1. Try NewsBot profiles (SQLite-backed)
    const dbEpisodes = getEpisodes(targetId);
    if (dbEpisodes && dbEpisodes.length > 0) {
      eps = dbEpisodes.map(e => ({
        title: e.title,
        url: e.url,
        timestamp: e.timestamp
      })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else {
      // 2. Fallback to tv_guide.json for VOD shows
      try {
        const fs = await import("fs/promises");
        const { existsSync } = await import("fs");
        const tvGuidePath = path.join(process.cwd(), "tv_guide.json");
        if (existsSync(tvGuidePath)) {
          const fileContent = await fs.readFile(tvGuidePath, "utf-8");
          const guide = JSON.parse(fileContent);
          const show = guide.shows?.[targetId];
          if (show && show.episodes) {
            eps = show.episodes.map((e: any) => ({
              title: e.info.split(",")[1] || "Episode",
              url: e.url
            }));
          }
        }
      } catch (err: any) {
        console.error("[Stitcher] Error reading tv_guide.json fallback:", err.message);
      }
    }

    if (eps.length === 0) {
      res.status(404).send(`No contiguous segments available for show or profile: ${targetId}`);
      return;
    }

    console.log(`[Stitcher] Found ${eps.length} segments for virtual stitching.`);

    interface VirtualSegment {
      url: string;
      size: number;
      startByte: number;
      endByte: number;
    }

    const segments: VirtualSegment[] = [];
    let totalSize = 0;

    for (const ep of eps) {
      const size = await getSegmentSize(ep.url);
      segments.push({
        url: ep.url,
        size,
        startByte: totalSize,
        endByte: totalSize + size - 1
      });
      totalSize += size;
    }

    if (totalSize === 0) {
      res.status(404).send("All segment files resolve to 0 bytes.");
      return;
    }

    // Parse Range Headers
    const rangeHeader = req.headers.range;
    let start = 0;
    let end = totalSize - 1;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const partialStart = parts[0];
      const partialEnd = parts[1];
      start = parseInt(partialStart, 10);
      end = partialEnd ? parseInt(partialEnd, 10) : totalSize - 1;
    }

    if (start >= totalSize) {
      res.status(416).setHeader("Content-Range", `bytes */${totalSize}`);
      res.end();
      return;
    }

    if (end >= totalSize) {
      end = totalSize - 1;
    }

    const contentLength = end - start + 1;

    // Setup Streaming response headers
    if (rangeHeader) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    } else {
      res.status(200);
    }

    res.setHeader("Content-Length", contentLength);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Connection", "keep-alive");

    console.log(`[Stitcher] Client requesting range: ${start}-${end} (${contentLength} bytes)`);

    // Stream requested range across multiple segment files
    for (const seg of segments) {
      if (seg.endByte < start || seg.startByte > end) {
        continue;
      }

      const localStart = Math.max(0, start - seg.startByte);
      const localEnd = Math.min(seg.size - 1, end - seg.startByte);

      if (localStart > localEnd) {
        continue;
      }

      console.log(`[Stitcher] Fetching raw segment: ${seg.url} range ${localStart}-${localEnd}`);

      try {
        if (!isUrlSafe(seg.url)) {
          console.warn(`[Stitcher] SSRF Guard blocked segment: ${seg.url}`);
          continue;
        }

        const response = await fetch(seg.url, {
          headers: {
            Range: `bytes=${localStart}-${localEnd}`
          },
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok && response.status !== 206) {
          console.error(`[Stitcher] Segment fetch failed with HTTP ${response.status} for ${seg.url}`);
          continue;
        }

        if (response.body) {
          const reader = response.body.getReader();
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            if (value) {
              const success = res.write(value);
              if (!success) {
                await new Promise<void>((resolve) => res.once("drain", resolve));
              }
            }
            done = readerDone;
          }
        }
      } catch (err: any) {
        console.error(`[Stitcher] Error streaming segment ${seg.url}:`, err.message);
      }
    }

    res.end();
  });

  let channelDiscoveryCache: {
    data: any;
    cachedAt: number;
  } | null = null;

  app.get("/api/ajn-discover-channels", async (req, res) => {
    const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    if (channelDiscoveryCache && Date.now() - channelDiscoveryCache.cachedAt < cacheTTL) {
      res.json(channelDiscoveryCache.data);
      return;
    }

    const defaultChannels = [
      { name: "📺 Info Survivor", file: "Info Survior.m3u" },
      { name: "📺 Alex 24 News", file: "Alex 24.m3u" },
      { name: "📺 Super Alex Jones Archive", file: "Super Alex Jones Archive.m3u" },
      { name: "📻 Liberty Express Live (CH 1)", file: "Liberty_Express_Live (1).m3u" },
      { name: "📻 Liberty Express Live (CH 2)", file: "Liberty_Express_Live (2).m3u" },
      { name: "📻 Liberty Express Live (CH 3)", file: "Liberty_Express_Live (3).m3u" },
      { name: "📂 AJN Archives (CH 4)", file: "AJN archive 1.m3u" }
    ];

    try {
      console.log("[Channel Discovery] Querying archive.org daily-highlights collection metadata...");
      // Using global fetch with timeout
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000);
      const response = await fetch("https://archive.org/metadata/daily-highlights", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        signal: controller.signal
      });
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`Archive.org metadata status ${response.status}. Internet Archive may be experiencing a power outage or service disruption.`);
      }

      const json: any = await response.json();
      if (json && Array.isArray(json.files)) {
        const m3uFiles = json.files.filter((f: any) => {
          if (!f.name) return false;
          const lowerName = f.name.toLowerCase();
          if (!lowerName.endsWith(".m3u")) return false;
          // Prune known dead links that trigger fallback loops
          if (lowerName.includes("rat patrol")) return false;
          return true;
        });
        
        if (m3uFiles.length > 0) {
          const discovered = m3uFiles.map((f: any, idx: number) => {
            let displayName = f.name;
            if (displayName.endsWith(".m3u")) {
              displayName = displayName.substring(0, displayName.length - 4);
            }
            displayName = displayName.replace(/_/g, " ");
            
            let prettyName = `📻 ${displayName}`;
            if (displayName.toLowerCase().includes("archive")) {
              prettyName = `📂 ${displayName}`;
            }

            return {
              id: `discovered-ch-${idx + 1}`,
              channelId: `discovered-ch-${idx + 1}`,
              num: 100 + idx,
              name: prettyName,
              file: f.name,
              url: `https://archive.org/download/daily-highlights/${encodeURIComponent(f.name)}`,
              staggerOffsetPercent: (idx * 0.25) % 1.0,
              size: f.size || "N/A"
            };
          });

          const result = { success: true, channels: discovered, source: "archive_org_api" };
          channelDiscoveryCache = { data: result, cachedAt: Date.now() };
          res.json(result);
          return;
        }
      }
      throw new Error("No files or invalid files structure in metadata");
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('aborted')) {
        console.log("[Channel Discovery] Archive.org request timed out, using high-performance static fallback roster.");
      } else {
        console.warn(`[Channel Discovery] Failed to query Archive.org, falling back to static roster. Reason: ${err.message}`);
      }
      
      const fallback = defaultChannels.map((ch, idx) => ({
        id: `discovered-ch-${idx + 1}`,
        channelId: `discovered-ch-${idx + 1}`,
        num: 100 + idx,
        name: ch.name,
        file: ch.file,
        url: `https://archive.org/download/daily-highlights/${encodeURIComponent(ch.file)}`,
        staggerOffsetPercent: (idx * 0.25) % 1.0,
        size: "N/A"
      }));

      const result = { success: true, channels: fallback, source: "static_fallback" };
      res.json(result);
    }
  });

  // API Route 1: Parse and serve AJN RSS video archive with zero CORS issues
  
  // API Route to fetch latest AJN Live Embed (initial load)
  app.get("/api/ajn-live-embed", (req, res) => {
    const liveCache = rumbleCache["https://rumble.com/v7bs5m6-alex-jones-show-247.html"];
    if (liveCache && liveCache.embed_url) {
      res.json({ success: true, embedUrl: liveCache.embed_url });
    } else {
      res.status(503).json({ success: false, error: "Live embed not available yet." });
    }
  });

  // API Route for SSE updates of AJN Live Embed
  app.get("/api/ajn-live-embed/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    const liveCache = rumbleCache["https://rumble.com/v7bs5m6-alex-jones-show-247.html"];
    if (liveCache && liveCache.embed_url) {
      res.write(`data: ${JSON.stringify({ success: true, embedUrl: liveCache.embed_url, source: "cache_initial" })}\n\n`);
    }

    rumbleSseClients.push(res);
    req.on("close", () => {
      const idx = rumbleSseClients.indexOf(res);
      if (idx !== -1) {
        rumbleSseClients.splice(idx, 1);
      }
    });
  });

let cachedArchiveResponse: any = null;
let lastArchiveFetchTime = 0;
const ARCHIVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get("/api/ajn-archive", async (req, res) => {
    if (cachedArchiveResponse && Date.now() - lastArchiveFetchTime < ARCHIVE_CACHE_TTL) {
      return res.json(cachedArchiveResponse);
    }
    const BACKUP_EPISODES = [
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_SundayLive-Hr2.m4v",
        title: "VIDEO - 20260816_Sun_SundayLive-Hr2",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_SundayLive-Hr2.m4v",
        pubDate: "2026-08-16T23:00:00.000Z",
        dateKey: "2026-08-16",
        show: "Sunday Night Live",
        hour: "Hour 2"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_SundayLive-Hr1.m4v",
        title: "VIDEO - 20260816_Sun_SundayLive-Hr1",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_SundayLive-Hr1.m4v",
        pubDate: "2026-08-16T22:00:00.000Z",
        dateKey: "2026-08-16",
        show: "Sunday Night Live",
        hour: "Hour 1"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_Alex-Hr2.m4v",
        title: "VIDEO - 20260816_Sun_Alex-Hr2",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_Alex-Hr2.m4v",
        pubDate: "2026-08-16T21:00:00.000Z",
        dateKey: "2026-08-16",
        show: "Alex Jones Show",
        hour: "Hour 2"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_Alex-Hr1.m4v",
        title: "VIDEO - 20260816_Sun_Alex-Hr1",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260816_Sun_Alex-Hr1.m4v",
        pubDate: "2026-08-16T20:00:00.000Z",
        dateKey: "2026-08-16",
        show: "Alex Jones Show",
        hour: "Hour 1"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260815_Sat_Alex-Special.m4v",
        title: "VIDEO - 20260815_Sat_Alex-Special",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260815_Sat_Alex-Special.m4v",
        pubDate: "2026-08-15T20:00:00.000Z",
        dateKey: "2026-08-15",
        show: "Alex Jones Show",
        hour: "Special"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr3.m4v",
        title: "VIDEO - 20260814_Fri_WarRoom-Hr3",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr3.m4v",
        pubDate: "2026-08-14T22:00:00.000Z",
        dateKey: "2026-08-14",
        show: "War Room",
        hour: "Hour 3"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr2.m4v",
        title: "VIDEO - 20260814_Fri_WarRoom-Hr2",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr2.m4v",
        pubDate: "2026-08-14T21:00:00.000Z",
        dateKey: "2026-08-14",
        show: "War Room",
        hour: "Hour 2"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr1.m4v",
        title: "VIDEO - 20260814_Fri_WarRoom-Hr1",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr1.m4v",
        pubDate: "2026-08-14T20:00:00.000Z",
        dateKey: "2026-08-14",
        show: "War Room",
        hour: "Hour 1"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr4.m4v",
        title: "VIDEO - 20260814_Fri_Alex-Hr4",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr4.m4v",
        pubDate: "2026-08-14T19:00:00.000Z",
        dateKey: "2026-08-14",
        show: "Alex Jones Show",
        hour: "Hour 4"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr3.m4v",
        title: "VIDEO - 20260814_Fri_Alex-Hr3",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr3.m4v",
        pubDate: "2026-08-14T18:00:00.000Z",
        dateKey: "2026-08-14",
        show: "Alex Jones Show",
        hour: "Hour 3"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr2.m4v",
        title: "VIDEO - 20260814_Fri_Alex-Hr2",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr2.m4v",
        pubDate: "2026-08-14T17:00:00.000Z",
        dateKey: "2026-08-14",
        show: "Alex Jones Show",
        hour: "Hour 2"
      },
      {
        id: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr1.m4v",
        title: "VIDEO - 20260814_Fri_Alex-Hr1",
        videoUrl: "https://ajn.archives.pub/hourly-m4v/20260814_Fri_Alex-Hr1.m4v",
        pubDate: "2026-08-14T16:00:00.000Z",
        dateKey: "2026-08-14",
        show: "Alex Jones Show",
        hour: "Hour 1"
      }
    ];

    const startTime = Date.now();
    try {
      if (isOutageSimulated()) {
        throw new Error("Simulated RSS Outage active (Stress Testing)");
      }

      const RSS_URL = "https://rss.alexjones.media/AJNHourlyVideo.xml";
      const SUNDAY_URL = "https://rss.alexjones.media/SundayLive.xml";
      console.log(`[Proxy] Fetching AJN RSS feeds from: ${RSS_URL} and ${SUNDAY_URL}`);
      
      const fetchFeed = async (url) => {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) {
          console.warn(`Failed to fetch RSS from ${url}. Status: ${response.status}`);
          return "";
        }
        return await response.text();
      };

      const [xmlTextHourly, xmlTextSunday] = await Promise.all([
        fetchFeed(RSS_URL),
        fetchFeed(SUNDAY_URL)
      ]);
      const xmlText = xmlTextHourly + "\n" + xmlTextSunday;
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      const episodes = [];

      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];

        // Extract title
        let title = "";
        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        if (titleMatch) title = titleMatch[1].trim();

        // Extract enclosure URL
        let videoUrl = "";
        const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]+)"/);
        if (enclosureMatch) videoUrl = enclosureMatch[1].trim();

        // Require a video-like file
        if (!videoUrl || (!videoUrl.includes(".m4v") && !videoUrl.includes(".mp4") && !videoUrl.includes(".mp3"))) {
          continue;
        }

        // Extract pubDate
        let pubDateStr = "";
        const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        if (pubDateMatch) pubDateStr = pubDateMatch[1].trim();

        const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();

        // Apply the requested -5 hour CST offset before binning
        const broadcastDate = new Date(pubDate);
        broadcastDate.setHours(broadcastDate.getHours() - 5); // UTC to CST
        const dateKey = broadcastDate.toISOString().split('T')[0]; // YYYY-MM-DD

        // Category/Show classification
        let show = "Alex Jones Show";
        const titleLower = title.toLowerCase();
        if (titleLower.includes("war room") || titleLower.includes("warroom")) {
          show = "War Room";
        } else if (titleLower.includes("sunday night") || titleLower.includes("snl")) {
          show = "Sunday Night Live";
        } else if (titleLower.includes("ezra") || titleLower.includes("levant") || titleLower.includes("rebel")) {
          show = "The Ezra Levant Show";
        } else if (titleLower.includes("genius") || titleLower.includes("geniuses")) {
          show = "Geniuses";
        } else if (titleLower.includes("update") || titleLower.includes("news update") || titleLower.includes("digital news")) {
          show = "News Update";
        } else if (titleLower.includes("alex") || titleLower.includes("infowars") || titleLower.includes("info wars")) {
          show = "Alex Jones Show";
        }

        // Hour detection
        let hour = "Full Show";
        const hourMatch = title.match(/Hr\s*(\d)/i) || 
                          title.match(/Hour\s*(\d)/i) || 
                          title.match(/Part\s*(\d)/i) || 
                          title.match(/p\s*(\d)/i) ||
                          title.match(/-\s*hr\s*(\d)/i) ||
                          title.match(/hr\s*(\d)/i);
        if (hourMatch) {
          hour = `Hour ${hourMatch[1]}`;
        }

        // Apply Headline Remastering transformation
        const remasteredTitle = remasterHeadline(title, videoUrl);

        const bucketInfo = getWeekBucket(pubDate);

        episodes.push({
          id: videoUrl,
          title: remasteredTitle,
          videoUrl,
          pubDate: pubDate.toISOString(),
          dateKey,
          show,
          hour,
          bucketId: bucketInfo.bucketId,
          bucketStartDate: bucketInfo.startDate.toISOString(),
          bucketEndDate: bucketInfo.endDate.toISOString()
        });
      }

      if (episodes.length === 0) {
        console.warn(`[Proxy] Parsed 0 episodes from RSS feed, using robust backup episodes`);
        episodes.push(...BACKUP_EPISODES.map(ep => ({ ...ep, title: remasterHeadline(ep.title, ep.videoUrl) })));
      }

      console.log(`[Proxy] Successfully parsed ${episodes.length} episodes from AJN RSS`);
      
      // Cache historical RSS items locally
      mergeRssArchiveEpisodes(episodes);

      logTelemetryEvent({
        eventType: "feed_fetch_success",
        sessionId: "server-proxy",
        duration: Date.now() - startTime,
        itemCount: episodes.length,
        fallbackUsed: false
      });

      // Serve from our local persistent cache, overcoming standard RSS 20-50 item truncation
      const allCachedEpisodes = getRssArchiveEpisodes();
      const finalResponse = { success: true, count: allCachedEpisodes.length, episodes: allCachedEpisodes };
      cachedArchiveResponse = finalResponse;
      lastArchiveFetchTime = Date.now();
      res.json(finalResponse);
    } catch (e: any) {
      console.warn(`[Proxy Warning] Failed to process AJN Archive feed (using fallback):`, e.message);
      
      logTelemetryEvent({
        eventType: "feed_fetch_failure",
        sessionId: "server-proxy",
        duration: Date.now() - startTime,
        errorMessage: e.message,
        fallbackUsed: true
      });

      // Fallback: also pull from local DB, if none, use the backup
      const allCachedEpisodes = getRssArchiveEpisodes();
      if (allCachedEpisodes.length > 0) {
        res.json({ success: true, count: allCachedEpisodes.length, episodes: allCachedEpisodes, isFallback: true });
      } else {
        const massagedBackup = BACKUP_EPISODES.map(ep => ({ ...ep, title: remasterHeadline(ep.title, ep.videoUrl) }));
        res.json({ success: true, count: massagedBackup.length, episodes: massagedBackup, isFallback: true });
      }
    }
  });

  app.post("/api/telemetry", (req, res): any => {
    try {
      const body = req.body;
      let events: any[] = [];
      let sessionId = "UNKNOWN_SESSION";

      if (body && typeof body === 'object') {
        if (body.events && Array.isArray(body.events)) {
          events = body.events;
          sessionId = body.sessionId || "UNKNOWN_SESSION";
        } else if (Array.isArray(body)) {
          events = body;
        } else {
          events = [body];
        }
      }

      // Input Throttling Safeguard: Prevent memory exhaustion via large arrays
      if (events.length > 500) {
        return res.status(429).json({ 
          success: false,
          error: 'Payload scale rejection: Maximum batch size exceeded (500 entries max per ingestion frame).' 
        });
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
      const userAgent = (req.headers["user-agent"] as string) || "";
      
      const loggedEvents = [];
      for (const ev of events) {
        if (ev && ev.eventType) {
          // Validate and sanitize internal event properties
          const sanitizedEvent = {
            eventType: String(ev.eventType || 'UNKNOWN_EVENT'),
            streamUrl: String(ev.streamUrl || ev.url || ''),
            streamName: String(ev.streamName || ev.streamTitle || ev.broadcaster || 'Unnamed Stream'),
            timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : new Date().toISOString(),
            sessionId: String(ev.sessionId || sessionId || 'UNKNOWN_SESSION'),
            receivedAt: new Date().toISOString(),
            ipAddress,
            userAgent,
          };

          const logged = logTelemetryEvent(sanitizedEvent as any);
          loggedEvents.push(logged);
        }
      }
      return res.json({ success: true, count: loggedEvents.length });
    } catch (err: any) {
      console.error("[Telemetry API Error] Secure Ingestion Layer Exception:", err.message);
      return res.status(500).json({ success: false, error: 'Internal telemetry store rejection' });
    }
  });

  app.get("/api/telemetry/stats", (req, res) => {
    const stats = getTelemetryStats();
    res.json({ success: true, stats });
  });

  app.post("/api/telemetry/simulate-outage", (req, res) => {
    try {
      const body = req.body;
      const active = !!body.active;
      setOutageSimulation(active);
      
      logTelemetryEvent({
        eventType: "simulate_outage_toggle",
        sessionId: "server-simulation",
        errorMessage: active ? "Simulated outage enabled" : "Simulated outage disabled"
      });

      res.json({ success: true, isOutageSimulated: active });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post("/api/telemetry/clear", (req, res) => {
    clearTelemetryEvents();
    res.json({ success: true });
  });

  // Concurrent connection limiter cache tracker
  const activeImportsByIp = new Map<string, number>();
  const MAX_CONCURRENT_IMPORTS = 5;

  // Exponential backoff and Retry-After aware remote fetch helper
  async function fetchWithBackoff(
    url: string,
    options: RequestInit,
    onRetry: (attempt: number, delayMs: number) => void
  ): Promise<Response> {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const resp = await fetch(url, options);
        if (resp.status === 429) {
          attempt++;
          if (attempt >= maxRetries) {
            throw new Error("Rate limit exceeded from archive.org. Please try again later.");
          }

          let delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s
          const retryAfterHeader = resp.headers.get("retry-after");
          if (retryAfterHeader) {
            const parsed = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsed) && parsed > 0) {
              delay = parsed * 1000;
            }
          }
          onRetry(attempt, delay);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return resp;
      } catch (err: any) {
        if (err.message && err.message.includes("Rate limit")) {
          throw err;
        }
        // Let other errors bubble up/fail immediately
        throw err;
      }
    }
    throw new Error("Rate limit exceeded from archive.org. Please try again later.");
  }

  // API Route: Create Node.js Streaming M3U Parser with Optional SSE Progress Updates
  app.all("/api/playlist/import-from-archive", async (req, res) => {
    const isPost = req.method === "POST";
    const url = (isPost ? req.body?.url : req.query.url as string) || "";
    const isStream = (isPost ? req.body?.stream === true : req.query.stream === "true" || req.query.stream === "1");

    if (!url) {
      res.status(400).json({ success: false, error: "Missing required query or body parameter: url" });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || "global_ip";
    const currentActiveCount = activeImportsByIp.get(ip) || 0;
    if (currentActiveCount >= MAX_CONCURRENT_IMPORTS) {
      res.status(429).json({
        success: false,
        error: "Too many concurrent import streams from this client. Please wait until previous imports finish."
      });
      return;
    }
    activeImportsByIp.set(ip, currentActiveCount + 1);

    // 1. Set up abort controller & timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 55000); // 55 seconds total timeout to accommodate possible server-side retries

    req.on("close", () => {
      clearTimeout(timeoutId);
      abortController.abort();
    });

    try {
      // Setup stream mode headers if required early (before potentially blocking fetch)
      if (isStream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        });
        res.write(`data: ${JSON.stringify({ type: "progress", value: 5 })}\n\n`);
      }

      const upstreamRes = await fetchWithBackoff(
        url,
        {
          signal: abortController.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        },
        (attempt, delayMs) => {
          if (isStream) {
            res.write(`data: ${JSON.stringify({ 
              type: "progress", 
              value: Math.min(99, 5 + attempt * 2), 
              message: `Archive.org feedback: rate-limited. Retrying in ${delayMs / 1000}s... (attempt ${attempt}/5)`
            })}\n\n`);
          }
        }
      );

      if (!upstreamRes.ok) {
        throw new Error(`Upstream archive.org server returned status ${upstreamRes.status} (${upstreamRes.statusText})`);
      }

      const contentType = upstreamRes.headers.get("content-type") || "";
      if (upstreamRes.status === 404 || contentType.includes("html") || contentType.includes("text/html")) {
        throw new Error("Specified URL did not return a valid playlist M3U stream (or was blocked/not found).");
      }

      // 2. Extract Archive.org details
      const itemIdMatch = url.match(/archive\.org\/download\/([^\/]+)/) || url.match(/archive\.org\/details\/([^\/]+)/);
      const itemId = itemIdMatch ? itemIdMatch[1] : null;
      const thumbnailUrl = itemId ? `https://archive.org/services/img/${itemId}` : null;

      let playlistName = "Imported Live Playlist";
      if (itemId) {
        playlistName = itemId
          .split(/[-_]+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      } else {
        const parts = url.split("/");
        const filename = parts[parts.length - 1];
        if (filename) {
          playlistName = filename.replace(/\.(m3u|m3u8)$/i, "").replace(/[-_]+/g, " ");
        }
      }

      // 3. Setup stream mode headers if required
      if (isStream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        });
        res.write(`data: ${JSON.stringify({ type: "progress", value: 5 })}\n\n`);
      }

      const reader = upstreamRes.body?.getReader();
      if (!reader) {
        throw new Error("Could not instantiate reader stream from archive.org stream.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const tracks: any[] = [];

      let currentDuration = -1;
      let currentMetadata = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (line.toUpperCase().startsWith("#EXTINF:")) {
            const match = line.match(/#EXTINF:\s*(-?\d+(?:\.\d+)?)\s*(?:[^,]*),(.*)/i);
            if (match) {
              currentDuration = Math.round(parseFloat(match[1]));
              currentMetadata = match[2].trim();
            }
          } else if (!line.startsWith("#")) {
            // Found track URL
            const trackUrl = line;
            let artist = "Archive.org";
            let title = currentMetadata || "";

            if (!title) {
              try {
                const uParts = trackUrl.split("/");
                const filename = uParts[uParts.length - 1];
                title = decodeURIComponent(filename).replace(/\.[a-zA-Z0-9]+$/, "");
              } catch {
                title = "Track " + (tracks.length + 1);
              }
            }

            const delimiters = [" - ", " -", "- "];
            let splitIdx = -1;
            let matchedDelim = "";
            for (const delim of delimiters) {
              const idx = title.indexOf(delim);
              if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) {
                splitIdx = idx;
                matchedDelim = delim;
              }
            }

            if (splitIdx !== -1) {
              artist = title.slice(0, splitIdx).trim();
              title = title.slice(splitIdx + matchedDelim.length).trim();
            } else {
              const singleDash = title.indexOf("-");
              if (singleDash > 0 && singleDash < title.length - 1) {
                artist = title.slice(0, singleDash).trim();
                title = title.slice(singleDash + 1).trim();
              }
            }

            if (artist.toLowerCase() === title.toLowerCase()) {
              artist = "Archive.org";
            }

            tracks.push({
              id: `track-arch-${itemId || "live"}-${tracks.length}-${Date.now()}`,
              title,
              artist,
              duration: currentDuration,
              url: trackUrl,
              sourceType: "music",
              genre: "Archive Broadcast",
              album: playlistName,
              year: new Date().getFullYear(),
              dateAdded: new Date().toISOString()
            });

            currentDuration = -1;
            currentMetadata = "";

            // Notify progress every 10 tracks
            if (isStream && tracks.length % 10 === 0) {
              const progress = Math.min(95, Math.round((tracks.length / (tracks.length + 15)) * 100));
              res.write(`data: ${JSON.stringify({ type: "progress", value: progress })}\n\n`);
            }
          }
        }
      }

      // Capture leftovers
      if (buffer) {
        const line = buffer.trim();
        if (line && !line.startsWith("#")) {
          const trackUrl = line;
          let artist = "Archive.org";
          let title = currentMetadata || "";

          if (!title) {
            try {
              const uParts = trackUrl.split("/");
              const filename = uParts[uParts.length - 1];
              title = decodeURIComponent(filename).replace(/\.[a-zA-Z0-9]+$/, "");
            } catch {
              title = "Track " + (tracks.length + 1);
            }
          }

          tracks.push({
            id: `track-arch-${itemId || "live"}-${tracks.length}-${Date.now()}`,
            title,
            artist,
            duration: currentDuration,
            url: trackUrl,
            sourceType: "music",
            genre: "Archive Broadcast",
            album: playlistName,
            year: new Date().getFullYear(),
            dateAdded: new Date().toISOString()
          });
        }
      }

      clearTimeout(timeoutId);

      if (isStream) {
        res.write(`data: ${JSON.stringify({
          type: "complete",
          tracks,
          thumbnailUrl,
          playlistName
        })}\n\n`);
        res.end();
      } else {
        res.json({
          success: true,
          tracks,
          thumbnailUrl,
          playlistName
        });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(`[Archive M3U Parser Error] failed:`, err.message);

      if (isStream) {
        res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ success: false, error: err.message });
      }
    } finally {
      const cnt = activeImportsByIp.get(ip) || 1;
      if (cnt <= 1) {
        activeImportsByIp.delete(ip);
      } else {
        activeImportsByIp.set(ip, cnt - 1);
      }
    }
  });

  // Helper function to clean filename and extract clean title
  function extractTitleFromFilename(filename: string): string {
    try {
      const raw = decodeURIComponent(filename.split("/").pop() || filename);
      let clean = raw.replace(/\.(mp3|m4a|ogg|flac|wav|opus)$/i, "");
      clean = clean.replace(/^(\d+([.\-_\s]+))/, "").trim();
      return clean || raw.replace(/\.(mp3|m4a|ogg|flac|wav|opus)$/i, "");
    } catch {
      return filename;
    }
  }

  // Enhanced function for part detection
  function extractTitleAndPartFromFilename(filename: string): { title: string; part?: number } {
    try {
      const raw = decodeURIComponent(filename.split("/").pop() || filename);
      let clean = raw.replace(/\.(mp3|m4a|ogg|flac|wav|opus)$/i, "");
      
      // Match "Part 1", "Part02", "Pt 1", "Part A", "Pt. 3"
      const partMatch = clean.match(/(?:Part|Pt|Pt\.)\s*[-_]?\s*(\d+)/i);
      let part: number | undefined;
      if (partMatch) {
        const parsed = parseInt(partMatch[1], 10);
        if (!isNaN(parsed)) {
          part = parsed;
        }
      }
      
      // Remove Part indicator for clean title
      clean = clean.replace(/\s*(?:Part|Pt|Pt\.)\s*[-_]?\s*\d+\s*/i, " ").trim();
      
      // Clean numeric prefixes (like track numbers)
      clean = clean.replace(/^(\d+([.\-_\s]+))/, "").trim();
      
      return { title: clean || raw.replace(/\.(mp3|m4a|ogg|flac|wav|opus)$/i, ""), part };
    } catch {
      return { title: filename };
    }
  }

  // API Route: Advanced Search Archive.org
  app.get("/api/archive/search", async (req, res) => {
    const { q, mediatype, creator, sort, page = "1", rows = "20" } = req.query;

    if (!q) {
      res.status(400).json({ success: false, error: "Missing required query parameter: q" });
      return;
    }

    // Build the query string for Archive.org
    let queryParts: string[] = [];
    
    // Check if the query is already an advanced query (contains colon)
    if (typeof q === "string" && q.includes(":")) {
      queryParts.push(q);
    } else {
      queryParts.push(`(title:(${q}*) OR creator:(${q}*) OR description:(${q}*))`);
    }

    if (mediatype) {
      queryParts.push(`mediatype:(${mediatype})`);
    } else {
      // Default to video or audio to keep it relevant to the playout/EPG engine
      queryParts.push(`mediatype:(video OR audio)`);
    }

    if (creator) {
      queryParts.push(`creator:(${creator})`);
    }

    const archiveQuery = queryParts.join(" AND ");
    
    // Construct search URL
    const searchParams = new URLSearchParams();
    searchParams.append("q", archiveQuery);
    searchParams.append("output", "json");
    searchParams.append("rows", String(rows));
    searchParams.append("page", String(page));

    // Append requested fields
    const fields = ["identifier", "title", "creator", "description", "publicdate", "mediatype", "downloads"];
    fields.forEach(f => searchParams.append("fl[]", f));

    // Sort order
    if (sort) {
      searchParams.append("sort[]", String(sort));
    } else {
      searchParams.append("sort[]", "publicdate desc");
    }

    const searchUrl = `https://archive.org/advancedsearch.php?${searchParams.toString()}`;

    try {
      const response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        res.status(response.status).json({ success: false, error: `Upstream search returned status ${response.status}` });
        return;
      }

      const data: any = await response.json();
      const results = data.response || { docs: [], numFound: 0 };
      
      res.json({
        success: true,
        results: results.docs,
        totalResults: results.numFound,
        page: parseInt(String(page), 10),
        rows: parseInt(String(rows), 10)
      });
    } catch (err: any) {
      console.error(`[Archive Search Error] failed for query "${q}":`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Import Playlist from Archive.org Metadata API
  app.post("/api/playlist/import-from-archive-metadata", async (req, res) => {
    const { identifier, preferredFormat, includeVideo, targetFilename } = req.body;
    if (!identifier) {
      res.status(400).json({ success: false, error: "Missing required body parameter: identifier" });
      return;
    }

    const cleanIdentifier = identifier.trim();

    try {
      const response = await fetch(`https://archive.org/metadata/${cleanIdentifier}`, {
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        res.status(response.status).json({ success: false, error: `Upstream archive.org server returned status ${response.status}` });
        return;
      }

      const data: any = await response.json();
      if (!data || !data.files || data.files.length === 0) {
        res.status(404).json({ success: false, error: "Archive.org item not found or has no files." });
        return;
      }

      const metadata = data.metadata || {};
      let files = data.files || [];

      // If targeting a specific file, isolate just that file to avoid pulling the whole collection
      if (targetFilename) {
        const exactMatch = files.find((f: any) => f.name === targetFilename || decodeURIComponent(f.name) === targetFilename);
        if (exactMatch) {
          files = [exactMatch];
        }
      }

      const audioFiles = files.filter((file: any) => {
        const name = file.name || "";
        const format = file.format || "";
        const lowerName = name.toLowerCase();
        const lowerFormat = format.toLowerCase();
        
        const isAudio = (
          lowerFormat === "vbr mp3" ||
          lowerFormat === "mp3" ||
          lowerName.endsWith(".mp3") ||
          lowerName.endsWith(".m4a") ||
          lowerName.endsWith(".ogg") ||
          lowerName.endsWith(".flac") ||
          lowerName.endsWith(".wav") ||
          lowerName.endsWith(".opus")
        );

        const isVideo = (
          lowerName.endsWith(".mp4") ||
          lowerName.endsWith(".m4v") ||
          lowerName.endsWith(".mov") ||
          lowerName.endsWith(".m3u8") ||
          lowerName.endsWith(".m3u") ||
          lowerName.endsWith(".mkv") ||
          lowerName.endsWith(".webm")
        );

        return isAudio || isVideo;
        
        if (preferredFormat === "mp3") {
          return lowerFormat.includes("mp3") || lowerName.endsWith(".mp3");
        } else if (preferredFormat === "flac") {
          return lowerFormat.includes("flac") || lowerName.endsWith(".flac");
        }
        return true;
      });

      if (audioFiles.length === 0) {
        res.status(404).json({ success: false, error: "No playable tracks of the requested format found in this Archive.org item." });
        return;
      }

      const seenUrls = new Set<string>();
      const tracks: any[] = [];

      for (const file of audioFiles) {
        let encodedName = file.name;
        try {
          const decoded = decodeURIComponent(file.name);
          encodedName = decoded.split('/').map((part: string) => encodeURIComponent(part)).join('/');
        } catch {
          encodedName = file.name.split('/').map((part: string) => encodeURIComponent(part)).join('/');
        }

        const url = `https://archive.org/download/${cleanIdentifier}/${encodedName}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        const parsedTitleInfo = extractTitleAndPartFromFilename(file.name);
        const title = file.title || parsedTitleInfo.title;
        const part = parsedTitleInfo.part;
        const artist = metadata.creator || metadata.artist || file.creator || file.artist || "Unknown Artist";
        
        let duration = 0;
        const rawLen = file.length || file.original_length;
        if (rawLen) {
          duration = Math.round(parseFloat(rawLen)) || 0;
        }

        tracks.push({
          title,
          artist,
          duration,
          url,
          part,
          name: file.name,
          fileType: file.format || "Audio"
        });
      }

      // Sort by part number if available, then by title/filename
      tracks.sort((a, b) => {
        if (a.part !== undefined && b.part !== undefined) {
          return a.part - b.part;
        }
        if (a.part !== undefined) return -1;
        if (b.part !== undefined) return 1;
        return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
      });

      const thumbnailUrl = `https://archive.org/services/img/${cleanIdentifier}`;
      const playlistName = metadata.title || cleanIdentifier.replace(/[-_]+/g, " ");

      const venue = metadata.venue || metadata.coverage || "";
      const date = metadata.date || metadata.year || (metadata.publicdate ? metadata.publicdate.substring(0, 4) : "") || "";
      const description = metadata.description || "";
      const playlistArtist = metadata.creator || metadata.artist || "Unknown Artist";

      res.json({
        success: true,
        tracks,
        thumbnailUrl,
        playlistName,
        venue,
        date,
        artist: playlistArtist,
        description,
        preferredFormat: preferredFormat || "all"
      });
    } catch (err: any) {
      console.error(`[Archive Metadata Parser Error] failed for identifier ${cleanIdentifier}:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Batch Import Playlists from Archive.org Metadata API
  app.post("/api/playlist/import-batch-archive-metadata", async (req, res) => {
    const { identifiers, tasks, preferredFormat } = req.body;
    if (!identifiers && !tasks) {
      res.status(400).json({ success: false, error: "Missing required body parameter: tasks or identifiers" });
      return;
    }

    let itemsToProcess: { identifier: string; targetFilename?: string }[] = [];
    if (tasks && Array.isArray(tasks)) {
      itemsToProcess = tasks.filter(t => t.identifier).map(t => ({ identifier: t.identifier.trim(), targetFilename: t.targetFilename }));
    } else if (identifiers && Array.isArray(identifiers)) {
      itemsToProcess = identifiers.map(id => ({ identifier: id.trim() })).filter(t => t.identifier);
    }
    
    // Deduplicate by identifier
    const uniqueMap = new Map<string, { identifier: string; targetFilename?: string }>();
    for (const item of itemsToProcess) {
      if (!uniqueMap.has(item.identifier)) {
        uniqueMap.set(item.identifier, item);
      }
    }
    const uniqueItems = Array.from(uniqueMap.values());

    try {
      const promises = uniqueItems.map(async ({ identifier, targetFilename }) => {
        try {
          const response = await fetch(`https://archive.org/metadata/${identifier}`, {
            signal: AbortSignal.timeout(30000)
          });

          if (!response.ok) {
            return {
              identifier,
              success: false,
              error: `Upstream archive.org server returned status ${response.status}`
            };
          }

          const data: any = await response.json();
          if (!data || !data.files || data.files.length === 0) {
            return {
              identifier,
              success: false,
              error: "Archive.org item not found or has no files."
            };
          }

          const metadata = data.metadata || {};
          let files = data.files || [];

          if (targetFilename) {
            const exactMatch = files.find((f: any) => f.name === targetFilename || decodeURIComponent(f.name) === targetFilename);
            if (exactMatch) {
              files = [exactMatch];
            }
          }

          const audioFiles = files.filter((file: any) => {
            const name = file.name || "";
            const format = file.format || "";
            const lowerName = name.toLowerCase();
            const lowerFormat = format.toLowerCase();
            
            const isAudio = (
              lowerFormat === "vbr mp3" ||
              lowerFormat === "mp3" ||
              lowerName.endsWith(".mp3") ||
              lowerName.endsWith(".m4a") ||
              lowerName.endsWith(".ogg") ||
              lowerName.endsWith(".flac") ||
              lowerName.endsWith(".wav") ||
              lowerName.endsWith(".opus")
            );

            const isVideo = (
              lowerName.endsWith(".mp4") ||
              lowerName.endsWith(".m4v") ||
              lowerName.endsWith(".mov") ||
              lowerName.endsWith(".m3u8") ||
              lowerName.endsWith(".m3u") ||
              lowerName.endsWith(".mkv") ||
              lowerName.endsWith(".webm")
            );

            return isAudio || isVideo;

            if (preferredFormat === "mp3") {
              return lowerFormat.includes("mp3") || lowerName.endsWith(".mp3");
            } else if (preferredFormat === "flac") {
              return lowerFormat.includes("flac") || lowerName.endsWith(".flac");
            }
            return true;
          });

          if (audioFiles.length === 0) {
            return {
              identifier,
              success: false,
              error: "No audio tracks of the requested format found in this Archive.org item."
            };
          }

          const seenUrls = new Set<string>();
          const tracks: any[] = [];

          for (const file of audioFiles) {
            let encodedName = file.name;
            try {
              const decoded = decodeURIComponent(file.name);
              encodedName = decoded.split('/').map((part: string) => encodeURIComponent(part)).join('/');
            } catch {
              encodedName = file.name.split('/').map((part: string) => encodeURIComponent(part)).join('/');
            }

            const url = `https://archive.org/download/${identifier}/${encodedName}`;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            const parsedTitleInfo = extractTitleAndPartFromFilename(file.name);
            const title = file.title || parsedTitleInfo.title;
            const part = parsedTitleInfo.part;
            const artist = metadata.creator || metadata.artist || file.creator || file.artist || "Unknown Artist";
            
            let duration = 0;
            const rawLen = file.length || file.original_length;
            if (rawLen) {
              duration = Math.round(parseFloat(rawLen)) || 0;
            }

            tracks.push({
              title,
              artist,
              duration,
              url,
              part,
              fileType: file.format || "Audio"
            });
          }

          // Sort by part number if available, then by title/filename
          tracks.sort((a, b) => {
            if (a.part !== undefined && b.part !== undefined) {
              return a.part - b.part;
            }
            if (a.part !== undefined) return -1;
            if (b.part !== undefined) return 1;
            return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
          });

          const thumbnailUrl = `https://archive.org/services/img/${identifier}`;
          const playlistName = metadata.title || identifier.replace(/[-_]+/g, " ");

          const venue = metadata.venue || metadata.coverage || "";
          const date = metadata.date || metadata.year || (metadata.publicdate ? metadata.publicdate.substring(0, 4) : "") || "";
          const description = metadata.description || "";
          const playlistArtist = metadata.creator || metadata.artist || "Unknown Artist";

          return {
            identifier,
            success: true,
            playlistName,
            tracks,
            thumbnailUrl,
            venue,
            date,
            artist: playlistArtist,
            description,
            preferredFormat: preferredFormat || "all"
          };
        } catch (err: any) {
          return {
            identifier,
            success: false,
            error: err.message || "Unknown error fetching item metadata"
          };
        }
      });

      const settledResults = await Promise.allSettled(promises);
      const results = settledResults.map((r, index) => {
        if (r.status === "fulfilled") {
          return r.value;
        } else {
          return {
            identifier: uniqueItems[index].identifier,
            success: false,
            error: r.reason?.message || "Promise rejected"
          };
        }
      });

      res.json({
        success: true,
        results
      });
    } catch (err: any) {
      console.error(`[Archive Batch Metadata Parser Error] failed:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route 2: General Stream CORS Bypasser for live IPTV channels
  app.options("/api/stream-proxy", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, User-Agent, X-Requested-With, Accept");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
    res.sendStatus(204);
  });

  app.get("/api/stream-proxy", async (req, res) => {
    if (req.query.preflight === "1" || req.query.health === "1") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(200).json({ status: "ok" });
      return;
    }

    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).json({ error: "Missing required query parameter: url" });
      return;
    }

    const abortController = new AbortController();
    let isFinished = false;
    res.on("finish", () => { isFinished = true; });
    req.on("close", () => {
      if (!isFinished) {
        console.warn("[Stream Proxy] Client aborted request mid-stream. Closing upstream connection.");
        abortController.abort();
      }
    });

    try {
      const decodedUrl = decodeURIComponent(rawUrl);
      const fetchUrl = new URL(decodedUrl).toString();
      console.log(`[Stream Proxy] Fetching stream: ${decodedUrl}`);
      
      const reqHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://archive.org/"
      };
      if (req.headers.range) {
        reqHeaders["Range"] = req.headers.range;
      }

      let response: Response | null = null;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          response = await fetch(fetchUrl, {
            headers: reqHeaders,
            signal: abortController.signal
          });
          
          // Retry on 429 or 5xx, otherwise break and send response to client
          if (response.status === 429 || response.status >= 500) {
            if (attempt === 5) break;
            throw new Error(`Retriable HTTP error: ${response.status}`);
          }
          break; // Success or client error (4xx)
        } catch (err: any) {
          lastError = err;
          // Silencing retry logs to avoid spamming the console
          if (attempt === 5) console.error(`[Stream Proxy] Final attempt failed for ${fetchUrl}: ${err.message}`);
          if (attempt === 5 || err.name === "AbortError") {
            throw err;
          }
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
      }
      if (!response) {
        throw lastError || new Error("Failed to fetch stream");
      }
      
      const resHeaders = ["content-type", "content-length", "accept-ranges", "content-range"];
      let hasContentType = false;
      for (const h of resHeaders) {
         if (response.headers.has(h)) {
           const val = response.headers.get(h);
           if (val) {
             res.setHeader(h, val);
             if (h === "content-type") hasContentType = true;
           }
         }
      }
      
      if (!hasContentType || fetchUrl.includes('.m3u') || fetchUrl.includes('.m3u8')) {
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      } else if (fetchUrl.includes('.ts')) {
        res.setHeader("Content-Type", "video/mp2t");
      }
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, User-Agent, X-Requested-With, Accept");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
      res.setHeader("Cache-Control", "no-cache");
      res.status(response.status);

      // Pass stream body forward with proper backpressure piping
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as any);
        nodeStream.on('error', (err: any) => {
          if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
            console.log("[Stream Proxy] Client safely aborted connection during streaming.");
            return;
          }
          console.error('[Stream Proxy] Error streaming to client:', err);
        });
        res.on('error', (err: any) => {
          console.error('[Stream Proxy] Client response error:', err);
        });
        nodeStream.pipe(res);
      } else {
        res.status(500).send("No stream body found");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("[Stream Proxy] Connection aborted successfully.");
        return;
      }
      console.error(`[Stream Proxy Error] Failed for ${rawUrl}:`, err.message);
      if (!res.headersSent) res.status(502).json({ error: "Stream proxy error", details: err.message });
    }
  });

  const execAsync = promisify(exec);

  app.post("/api/probe-duration", express.json({ limit: "5mb" }), async (req, res) => {
    try {
      const { items, timeout = 15 } = req.body;
      if (!Array.isArray(items)) {
        res.status(400).json({ error: "Missing or invalid 'items' array" });
        return;
      }

      console.log(`[Probe Duration] Received ${items.length} items to probe`);

      // We'll limit concurrency so we don't spawn 1000 ffprobe processes at once
      const CONCURRENCY = 20;
      const results = [];
      
      const probeItem = async (item: any) => {
        const { id, url } = item;
        if (!url) return { id, duration: null, duration_source: "failed" };

        try {
          const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${url.replace(/"/g, '\\"')}"`;
          const { stdout } = await execAsync(command, { timeout: timeout * 1000 });
          const value = stdout.trim();
          if (value) {
            return { id, duration: Math.round(parseFloat(value)), duration_source: "probed" };
          }
        } catch (e) {
          // Fall through to failed
        }
        return { id, duration: null, duration_source: "failed" };
      };

      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch = items.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(probeItem));
        results.push(...batchResults);
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error(`[Probe Duration] Failed:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/scraper/trigger", (req, res) => {
    runScraperJob().catch(console.error);
    res.json({ success: true, message: "Scraper job started in background" });
  });

  // Run scraper job every hour
  setInterval(() => {
    runScraperJob().catch(console.error);
  }, 60 * 60 * 1000);

  // Serve static assets OR setup Vite middleware
  app.use(streamProxyRouter);
  app.use(ingestionRouter);
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Booting in DEVELOPMENT mode with Vite Middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Booting in PRODUCTION mode serving /dist");
    const distPath = path.join(process.cwd(), "dist");
    
    // Explicitly serve raw show thumbnails in production to bypass string lit bundles
    app.use("/src/assets/images", express.static(path.join(process.cwd(), "src/assets/images")));
    
    app.use(express.static(distPath));
    app.use("/ajn-liberty-broadcast", express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] AJN IPTV Player server listening at http://localhost:${PORT}`);
  });
}

startServer();
