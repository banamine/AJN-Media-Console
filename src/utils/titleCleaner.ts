import { safeLocalStorage } from "../utils/safeStorage";
export interface TitleCleanerOptions {
  enableRussianRegex?: boolean;
  enableWesternRegex?: boolean;
}

function getOptions(options?: TitleCleanerOptions) {
  if (options) return options;
  if (typeof window !== "undefined") {
    return {
      enableRussianRegex: safeLocalStorage.getItem("ajn_enable_russian_regex") !== "false",
      enableWesternRegex: safeLocalStorage.getItem("ajn_enable_western_regex") !== "false",
    };
  }
  return { enableRussianRegex: true, enableWesternRegex: true };
}

export function formatCleanShowTitle(rawPath: string): string {
  if (!rawPath) return "";
  let decoded = rawPath;
  try { decoded = decodeURIComponent(rawPath); } catch (e) {}
  return decoded
    // Remove folder prefix like "📻 m3u split shows 2026-08-05 (1)/split shows/"
    .replace(/^.*?m3u[ _]split[ _]shows[ _]\d{4}-\d{2}-\d{2}\s*\(\d+\)[/\\_]+(?:split[ _]shows[/\\_]+)?/i, '')
    // Remove trailing file extensions if present
    .replace(/\.m3u$/i, '')
    // Clean trailing dashes or awkward symbols
    .replace(/\s*-\s*$/, '')
    .trim();
}

export function cleanChannelName(name: string): string {
  if (!name) return "";
  let cleanedName = name.trim();
  const strippedPrefix = cleanedName.replace(/^(?:Канал|KaHan|Kahan|AJN)\b(?:\s*\d+)?\s*[-–—:]*\s*/gi, "").trim();
  if (strippedPrefix) {
    cleanedName = strippedPrefix;
  } else {
    cleanedName = cleanedName.replace(/\b(?:Канал|KaHan|Kahan|AJN)\b/gi, "").trim();
  }
  cleanedName = cleanedName.replace(/_/g, " ");
  cleanedName = cleanedName.replace(/^[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"|~\\/<>]+|[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"|~\\/<>]+$/g, "").trim();
  return cleanedName.replace(/\s+/g, " ").trim();
}

export function cleanTitle(title: string, options?: TitleCleanerOptions): string {
  const opts = getOptions(options);
  if (!title) return "";

  let cleaned = title.trim();

  if (opts.enableRussianRegex) {
    // 1. Strip all leading variations of KaHan / Канал / AJN and timestamps
    const prefixRegex = /^(?:Канал|KaHan|Kahan|AJN)[\s\-_/:]*(?:\d+)?[\s\-_–—:]*/gi;
    cleaned = cleaned.replace(prefixRegex, "").trim();
    
    // Remove common Russian M3U tags
    const ruTags = [
       /\(РУС\)/gi, /\(ENG\)/gi, /\bсезон\b/gi, /\bсерия\b/gi,
       /\[ru\]/gi, /\[en\]/gi
    ];
    for (const tag of ruTags) {
       cleaned = cleaned.replace(tag, "");
    }
  } else {
    const prefixRegex = /^(?:AJN)[\s\-_/:]*(?:\d+)?[\s\-_–—:]*/gi;
    cleaned = cleaned.replace(prefixRegex, "").trim();
  }

  // 2. Extract Russian / Cyrillic specific title patterns with attention to detail
  // If the title starts with Russian text followed by a slash or dash, sometimes it's metadata.
  // We'll leave Cyrillic intact but strip out typical M3U garbage.
  cleaned = cleaned.replace(/_/g, " ");

  // 3. Remove common video extensions and M3U markers
  const extensions = [
    /\.mp4$/i, /\.mkv$/i, /\.ts$/i, /\.m3u8$/i, /\.m3u$/i, /\.avi$/i, /\.flv$/i, 
    /\.webm$/i, /\.mov$/i, /\.wmv$/i, /\.mpg$/i, /\.mpeg$/i, /\.m4v$/i
  ];
  for (const ext of extensions) {
    cleaned = cleaned.replace(ext, "");
  }

  // 4. Remove quality tags, codecs, and common release suffixes
  const tags = [
    /\b1080p\b/i, /\b720p\b/i, /\b480p\b/i, /\b4k\b/i, /\b2k\b/i,
    /\bhd\b/i, /\bsd\b/i, /\bfhd\b/i, /\buhd\b/i,
    /\bx264\b/i, /\bx265\b/i, /\bh264\b/i, /\bh265\b/i, /\bhevc\b/i,
    /\baac\b/i, /\bmp3\b/i, /\bweb-dl\b/i, /\bhdrip\b/i, /\bbluray\b/i,
    /\bwebrip\b/i, /\bxvid\b/i, /\bcamrip\b/i, /\btelesync\b/i
  ];
  for (const tag of tags) {
    cleaned = cleaned.replace(tag, "");
  }

  // 5. Fix common English & Russian misspellings or anomalies
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
    [/\bAlex\s+Jonse\b/gi, "Alex Jones"],
    // Russian common corrections in M3U rips
    [/\bНОВОСТИ\b/gi, "Новости"], 
    [/\bРОССИЯ\b/gi, "Россия"]
  ];
  
  if (opts.enableRussianRegex || opts.enableWesternRegex) {
    for (const [regex, rep] of misspellings) {
      cleaned = cleaned.replace(regex, rep);
    }
  }

  // 6. Normalize structural symbols and dates (e.g. "JULY - 07 - 2026" -> "JULY-07-2026")
  cleaned = cleaned.replace(/\s*-\s*/g, "-");
  
  // 7. Remove any trailing or leading garbage punctuation (excluding Cyrillic characters)
  cleaned = cleaned.replace(/^[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"~\\/<>]+|[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"~\\/<>]+$/g, "");

  // 8. Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // If after all this the string is empty, return a generic fallback
  if (!cleaned) return "Unknown Title";

  return cleaned;
}

/**
 * Extracts a series/show name from a cleaned title based on common VOD naming conventions.
 * This prevents thousands of VODs from clustering in a single generic group.
 */
export function extractSeriesName(title: string, defaultGroup: string, options?: TitleCleanerOptions): string {
  const opts = getOptions(options);
  let seriesPart = "";

  if (opts.enableWesternRegex) {
    // Regex to match Season/Episode markers like S01E01, 1x01, Season 1 Ep 2, Ep 05
    const seRegex = /(.+?)(?:\s*(?:-|_|\.)\s*)?(?:[Ss]\d{1,3}\s*[Ee]\d{1,4}|\d{1,2}x\d{1,3}|Season\s*\d+\s*Episode\s*\d+|Ep(?:isode)?\s*\d+)/i;
    
    // Regex to match Date formats often used in daily shows: 2026-07-20, 07-20-2026, etc.
    const dateRegex = /(.+?)(?:\s*(?:-|_)\s*)?(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/i;

    const seMatch = title.match(seRegex);
    const dateMatch = title.match(dateRegex);

    if (seMatch && seMatch[1]) {
      seriesPart = seMatch[1];
    } else if (dateMatch && dateMatch[1]) {
      seriesPart = dateMatch[1];
    }
  }

  if (opts.enableRussianRegex && !seriesPart) {
     // match "Title - 1 сезон 2 серия"
     const ruSeRegex = /(.+?)(?:\s*(?:-|_|\.)\s*)?(?:\d{1,3}\s*сезон|\d{1,4}\s*серия)/i;
     const ruMatch = title.match(ruSeRegex);
     if (ruMatch && ruMatch[1]) {
        seriesPart = ruMatch[1];
     }
  }

  if (!seriesPart && title.includes(" - ")) {
    // Fallback: Split by ' - ' and assume the first part is the show name
    const parts = title.split(" - ");
    if (parts.length > 1 && parts[0].length > 2 && parts[0].split(" ").length <= 5) {
      seriesPart = parts[0];
    }
  }

  if (seriesPart) {
    seriesPart = seriesPart.trim().replace(/[-_.\s]+$/, '');
    // If we successfully found a series name, append it to the default group for a hierarchical category
    // e.g. "Western" -> "Western / Bonanza"
    if (defaultGroup && defaultGroup !== "Uncategorized") {
      // Don't duplicate if defaultGroup already equals seriesPart
      if (defaultGroup.toLowerCase() === seriesPart.toLowerCase()) {
        return defaultGroup;
      }
      return `${defaultGroup} / ${seriesPart}`;
    }
    return seriesPart;
  }

  // If we couldn't parse a series, just return the default group
  return defaultGroup || "Uncategorized";
}
