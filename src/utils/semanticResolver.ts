/**
 * Semantic Date Resolver Utility
 * Extracts chronological patterns from filenames and maps them into EPG-ready timelines.
 */

import { getDBValue, putsDBValue } from "../services/IndexedDB";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


export interface SemanticMediaItem {
  id: string;
  displayDate: string;
  dateKey: string; // YYYY-MM-DD
  title: string;
  url: string;
  duration: number; // in seconds
  channelId: number;
}

/**
 * Universally and dynamically cleans filenames/titles to form pristine broadcast labels.
 * If YYYYMMDD date structure is present, formats exactly as requested:
 * e.g. "AJN 2026-07-03- FRIDAY ALEX-Hour 1"
 */
export function cleanBroadcastTitle(fileName: string): string {
  if (!fileName) return "Idle Streaming Pipeline";
  
  // Remove file extensions (e.g. .mp4, .mp3, .mov, etc.)
  let baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, "").trim();

  // Strip common prefixes like VIDEO-, AUDIO-, CLIP- at the beginning to allow date extraction
  baseName = baseName.replace(/^(?:VIDEO|AUDIO|CLIP|RAW|MP4|EP)[_\-\s]+/i, "");

  // Strip KaHan/Канал prefixes and delimiters (e.g. "KaHan 192 - David Knight" -> "David Knight")
  const strippedPrefix = baseName.replace(/^(?:Канал|KaHan|Kahan)\b(?:\s*\d+)?\s*[-–—:]*\s*/gi, "").trim();
  if (strippedPrefix) {
    baseName = strippedPrefix;
  } else {
    baseName = baseName.replace(/\b(?:Канал|KaHan|Kahan)\b/gi, "").trim();
  }

  // If already matches our exact beautiful formatted pattern, return as is
  if (/^AJN\s+.*?\d{4}-\d{2}-\d{2}-/i.test(baseName)) {
    return baseName;
  }

  // Try to extract YYYYMMDD date prefix
  let year = "";
  let month = "";
  let day = "";
  let weekdayStr = "";
  let remaining = baseName;

  const dateMatch = baseName.match(/^(\d{4})[_-]?(\d{2})[_-]?(\d{2})[_\-\s]*(?:([a-zA-Z]{3,10})[_\-\s]*)?(.*)$/);
  if (dateMatch) {
    year = dateMatch[1];
    month = dateMatch[2];
    day = dateMatch[3];
    weekdayStr = dateMatch[4] || "";
    remaining = dateMatch[5] || "";
  } else {
    // Try YYYY-MM-DD format
    const dateMatchAlt = baseName.match(/^(\d{4})-(\d{2})-(\d{2})[_\-\s]*(?:([a-zA-Z]{3,10})[_\-\s]*)?(.*)$/);
    if (dateMatchAlt) {
      year = dateMatchAlt[1];
      month = dateMatchAlt[2];
      day = dateMatchAlt[3];
      weekdayStr = dateMatchAlt[4] || "";
      remaining = dateMatchAlt[5] || "";
    }
  }

  if (year && month && day) {
    const mNum = parseInt(month, 10);
    const dNum = parseInt(day, 10);
    const yNum = parseInt(year, 10);
    const dateObj = new Date(yNum, mNum - 1, dNum);
    const isValid = !isNaN(dateObj.getTime()) && dateObj.getFullYear() === yNum && (dateObj.getMonth() + 1) === mNum;

    // Determine weekday in uppercase
    let finalWeekday = "DAY";
    if (isValid) {
      finalWeekday = dateObj.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    } else if (weekdayStr) {
      const dayMap: Record<string, string> = {
        "mon": "MONDAY", "tue": "TUESDAY", "wed": "WEDNESDAY", "thu": "THURSDAY", "fri": "FRIDAY", "sat": "SATURDAY", "sun": "SUNDAY",
        "monday": "MONDAY", "tuesday": "TUESDAY", "wednesday": "WEDNESDAY", "thursday": "THURSDAY", "friday": "FRIDAY", "saturday": "SATURDAY", "sunday": "SUNDAY"
      };
      finalWeekday = dayMap[weekdayStr.toLowerCase()] || weekdayStr.toUpperCase();
    }

    let showTitle = remaining.trim();

    // Standardize Hour/HR designations to "Hour X"
    showTitle = showTitle.replace(/\b(?:HR|HOUR)[_\-\s]*(\d+)\b/gi, "Hour $1");
    showTitle = showTitle.replace(/\bHour\s+0+(\d+)\b/gi, "Hour $1");
    showTitle = showTitle.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();

    // Check if we have a general show title + Hour X
    const generalHourMatch = showTitle.match(/^(.*?)\s*hour\s+(\d+)$/i);
    if (generalHourMatch) {
      const mainShowName = generalHourMatch[1].trim().toUpperCase();
      const hourNum = generalHourMatch[2];
      if (mainShowName === "ALEX") {
        showTitle = `ALEX-Hour ${hourNum}`;
      } else if (mainShowName === "WAR ROOM") {
        showTitle = `WAR ROOM -Hour ${hourNum}`;
      } else {
        showTitle = `${mainShowName} -Hour ${hourNum}`;
      }
    } else {
      showTitle = showTitle.toUpperCase();
    }

    // Determine brand prefix
    let brand = "AJN";
    if (showTitle.toUpperCase().includes("WAR ROOM")) {
      brand = "AJN WAR ROOM";
    }

    return `${brand}  ${year}-${month}-${day}- ${finalWeekday}  ${showTitle}`;
  }

  // Fallback cleanup (no date matched)
  let cleanFallback = baseName;
  cleanFallback = cleanFallback.replace(/\b(?:HR|HOUR)[_\-\s]*(\d+)\b/gi, "Hour $1");
  cleanFallback = cleanFallback.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();

  // If it's a system message, known IPTV stream name, or has specific uppercase keywords
  const lowerFallback = cleanFallback.toLowerCase();
  const isSystemOrIPTV = 
    lowerFallback.includes("manual feed") || 
    lowerFallback.includes("no active channel") || 
    lowerFallback.includes("idle") ||
    (!lowerFallback.includes("alex") && 
     !lowerFallback.includes("war room") && 
     !lowerFallback.includes("infowars") && 
     !lowerFallback.includes("david knight") && 
     !lowerFallback.includes("cocoanut"));

  if (isSystemOrIPTV) {
    return cleanFallback.replace(/\b\w/g, c => c.toUpperCase());
  }

  return `AJN  ${cleanFallback.toUpperCase()}`;
}

/**
 * Parses Internet Archive file names (e.g., "20110901_Thu_NightlyNews.mp4")
 * and extracts semantic dates and titles.
 */
export const parseSemanticDate = (fileName: string): { 
  success: boolean; 
  year: string; 
  month: string; 
  day: string; 
  dayName: string; 
  readableDate: string; 
  dateKey: string; 
  cleanTitle: string; 
} => {
  // Normalize by stripping video/audio prefixes and replacing KaHan misspelling
  let normalized = fileName;
  normalized = normalized.replace(/^(?:VIDEO|AUDIO|CLIP|RAW|MP4|EP)[_\-\s]+/i, "");
  normalized = normalized.replace(/\b(?:Канал|KaHan|Kahan)\b(?:\s*\d+)?\s*[-–—:]*\s*/gi, "");

  // Regex to capture YYYYMMDD and the Title.
  const match = normalized.match(/(\d{4})(\d{2})(\d{2})(?:[_-]([A-Za-z]+))?[_-](.+)\./) || 
                normalized.match(/(\d{4})(\d{2})(\d{2})_([A-Za-z]+)_?(.*?)\./) ||
                normalized.match(/(\d{4})(\d{2})(\d{2})_?([A-Za-z]+)?_?(.*?)$/);

  if (!match) {
    const fallbackTitle = cleanBroadcastTitle(fileName);
    return {
      success: false,
      year: "",
      month: "",
      day: "",
      dayName: "",
      readableDate: fallbackTitle,
      dateKey: "",
      cleanTitle: fallbackTitle
    };
  }

  const [_, year, month, day, dayNameRaw = "Day"] = match;
  
  const cleanTitle = cleanBroadcastTitle(fileName);
  const dateKey = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

  return {
    success: true,
    year,
    month,
    day,
    dayName: dayNameRaw,
    readableDate: cleanTitle,
    dateKey,
    cleanTitle
  };
};

/**
 * Parses raw Internet Archive files array (or standard file lists) and transforms them
 * into beautifully sequenced EPG items with Timeline Stitching.
 */
export const parseArchiveManifest = (
  fileList: string[] = [],
  collectionId: string,
  channelId: number = 1,
  defaultDurationSec: number = 3600
): SemanticMediaItem[] => {
  const safeList = Array.isArray(fileList) ? fileList : [];
  
  // Extract baseId from collectionId if there is a slash
  const slashIdx = collectionId.indexOf("/");
  const baseId = slashIdx !== -1 ? collectionId.substring(0, slashIdx).trim() : collectionId;

  return safeList
    .filter(file => {
      const lower = file.toLowerCase();
      
      // Remove known dead links and obsolete references
      if (lower.includes("prisonplanet.tv-rants-remastered") || 
          lower.includes("alexrant") ||
          lower.includes("dn721808.ca.archive.org")) {
        return false;
      }

      return (
        lower.endsWith(".mp4") || 
        lower.endsWith(".m4v") || 
        lower.endsWith(".mp3") || 
        lower.endsWith(".m4a") ||
        lower.endsWith(".mov")
      );
    })
    .map(fileName => {
      const resolved = parseSemanticDate(fileName);
      if (!resolved.success) {
        const fallbackTitle = cleanBroadcastTitle(fileName);
        return {
          id: fileName,
          displayDate: fallbackTitle,
          dateKey: "2025-01-01",
          title: fallbackTitle,
          url: fileName.startsWith("http") ? fileName : encodeURI(`https://archive.org/download/${baseId}/${fileName}`),
          duration: defaultDurationSec,
          channelId
        };
      }

      return {
        id: fileName,
        displayDate: resolved.readableDate,
        dateKey: resolved.dateKey,
        title: resolved.cleanTitle,
        url: fileName.startsWith("http") ? fileName : encodeURI(`https://archive.org/download/${baseId}/${fileName}`),
        duration: defaultDurationSec,
        channelId
      };
    })
    // Sort chronologically based on their dateKey
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

/**
 * Fetches the files list of an Internet Archive collection identifier.
 * Uses a double-fallback system (Direct fetch with fallback to full-stack proxy).
 */
export async function fetchArchiveCollectionFiles(identifier: string): Promise<string[]> {
  const cleanId = identifier.trim();
  if (!cleanId) return [];

  // Check if identifier has a sub-path/folder
  const slashIdx = cleanId.indexOf("/");
  const baseId = slashIdx !== -1 ? cleanId.substring(0, slashIdx).trim() : cleanId;
  const subFolder = slashIdx !== -1 ? cleanId.substring(slashIdx + 1).trim() : "";

  let filesList: string[] = [];

  // Try local IndexedDB cache first to avoid slow network requests & CORS issues
  try {
    const cached = await getDBValue<{ key: string; files: string[]; cachedAt: number }>("import_cache", `archive_meta_${baseId}`);
    if (cached && cached.files && Array.isArray(cached.files) && cached.files.length > 0) {
      // 24-hour expiry cache to stay up to date but prevent constant reloading
      if (Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000) {
        console.log(`[SemanticResolver] Cache hit: retrieved ${cached.files.length} archive files list for "${baseId}"`);
        filesList = cached.files;
      }
    }
  } catch (err) {
    console.warn(`[SemanticResolver] Failed to query IndexedDB cache for "${baseId}":`, err);
  }

  if (filesList.length === 0) {
    // Try direct metadata fetch
    try {
      const res = await fetch(`https://archive.org/metadata/${baseId}`, {
        headers: {
          "Accept": "application/json"
        }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data && data.files && Array.isArray(data.files)) {
            filesList = data.files.map((f: any) => f.name || "");
          }
        }
      }
    } catch (err) {
      console.warn(`[SemanticResolver] Direct fetch of archive metadata for ${baseId} failed, trying full-stack proxy:`, err);
    }

    // Fallback to proxy API
    if (filesList.length === 0) {
      try {
        const res = await fetch(BACKEND_URL + `/api/playlist/import-from-archive-metadata`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ identifier: baseId, includeVideo: true })
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (data && data.tracks && Array.isArray(data.tracks)) {
              // Use name directly if present, otherwise extract from URL
              filesList = data.tracks.map((t: any) => {
                if (t.name) return t.name;
                try {
                  const parts = t.url.split("/");
                  return decodeURIComponent(parts[parts.length - 1]);
                } catch {
                  return t.title || "";
                }
              });
            }
          }
        }
      } catch (err) {
        console.error(`[SemanticResolver] Double fallback failed for ${baseId}:`, err);
      }
    }

    // Save successful response to IndexedDB cache
    if (filesList.length > 0) {
      try {
        await putsDBValue("import_cache", {
          key: `archive_meta_${baseId}`,
          files: filesList,
          cachedAt: Date.now()
        });
      } catch (cacheErr) {
        console.warn(`[SemanticResolver] Failed to save archive metadata to cache for "${baseId}":`, cacheErr);
      }
    }
  }

  // If there's a subFolder, filter the filesList to only include items belonging to that folder/path
  if (subFolder && filesList.length > 0) {
    const lowerSub = subFolder.toLowerCase();
    return filesList.filter(f => f.toLowerCase().includes(lowerSub));
  }

  return filesList;
}

/**
 * Strips special characters, brackets, and extra identifiers from Archive.org folder names
 * to output highly sanitized human-friendly Channel Titles (e.g. 'Gunsmoke [1955]!' -> 'Gunsmoke').
 */
export function sanitizeChannelTitle(folderName: string): string {
  if (!folderName) return "";
  
  let clean = folderName;

  // Remove brackets and parenthetical years/tags, e.g. [1955] or (1955)
  clean = clean.replace(/\[[^\]]*\]/g, "");
  clean = clean.replace(/\([^)]*\)/g, "");

  // Remove file extensions if any got in
  clean = clean.replace(/\.[a-zA-Z0-9]+$/, "");

  // Replace underscores and hyphens with spaces
  clean = clean.replace(/[_-]/g, " ");

  // Remove punctuation/symbols except alphanumeric characters and spaces
  clean = clean.replace(/[^a-zA-Z0-9\s]/g, "");

  // Clean up multiple spaces
  clean = clean.replace(/\s+/g, " ").trim();

  // Convert CamelCase to spaced words
  clean = clean.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Title-case the result
  clean = clean.replace(/\b\w/g, c => c.toUpperCase());

  return clean.trim() || folderName;
}


