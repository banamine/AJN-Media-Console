import { DaumPlaylistAdapter } from "../features/iptv/adapters/DaumPlaylistAdapter";
import { IPTVChannel } from "../types";

// Extracted from archiveUtils.ts
function extractIdentifier(url: string): string | null {
  const match = url.trim().match(/archive\.org\/(?:download|details)\/([^/?#]+)(?:\/([^?#]+))?/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

// Extracted and refactored from titleCleaner.ts
function formatCleanShowTitle(rawPath: string): string {
  if (!rawPath) return "";
  let decoded = rawPath;
  try { decoded = decodeURIComponent(rawPath); } catch (e) {}
  return decoded
    .replace(/^.*?m3u[ _]split[ _]shows[ _]\d{4}-\d{2}-\d{2}\s*\(\d+\)[/\\_]+(?:split[ _]shows[/\\_]+)?/i, '')
    .replace(/\.m3u$/i, '')
    .replace(/\s*-\s*$/, '')
    .trim();
}

function cleanTitle(title: string): string {
  if (!title) return "";
  let cleaned = formatCleanShowTitle(title.trim());

  // Strip all leading variations
  const prefixRegex = /^(?:Канал|KaHan|Kahan|AJN)[\s\-_/:]*(?:\d+)?[\s\-_–—:]*/gi;
  cleaned = cleaned.replace(prefixRegex, "").trim();
  
  const ruTags = [/\(РУС\)/gi, /\(ENG\)/gi, /\bсезон\b/gi, /\bсерия\b/gi, /\[ru\]/gi, /\[en\]/gi];
  for (const tag of ruTags) cleaned = cleaned.replace(tag, "");

  cleaned = cleaned.replace(/_/g, " ");

  const extensions = [/\.mp4$/i, /\.mkv$/i, /\.ts$/i, /\.m3u8$/i, /\.m3u$/i, /\.avi$/i, /\.flv$/i, /\.webm$/i, /\.mov$/i, /\.wmv$/i, /\.mpg$/i, /\.mpeg$/i, /\.m4v$/i];
  for (const ext of extensions) cleaned = cleaned.replace(ext, "");

  const tags = [/\b1080p\b/i, /\b720p\b/i, /\b480p\b/i, /\b4k\b/i, /\b2k\b/i, /\bhd\b/i, /\bsd\b/i, /\bfhd\b/i, /\buhd\b/i, /\bx264\b/i, /\bx265\b/i, /\bh264\b/i, /\bh265\b/i, /\bhevc\b/i, /\baac\b/i, /\bmp3\b/i, /\bweb-dl\b/i, /\bhdrip\b/i, /\bbluray\b/i, /\bwebrip\b/i, /\bxvid\b/i, /\bcamrip\b/i, /\btelesync\b/i];
  for (const tag of tags) cleaned = cleaned.replace(tag, "");

  const misspellings: [RegExp, string][] = [
    [/\bThrsday\b/gi, "Thursday"], [/\bThurday\b/gi, "Thursday"], [/\bWaroom\b/gi, "Warroom"], [/\bWensday\b/gi, "Wednesday"], [/\bWednesdy\b/gi, "Wednesday"], [/\bTusday\b/gi, "Tuesday"], [/\bFrday\b/gi, "Friday"], [/\bSaturdy\b/gi, "Saturday"], [/\bSundy\b/gi, "Sunday"], [/\bMondy\b/gi, "Monday"], [/\bAlx\s+Jons\b/gi, "Alex Jones"], [/\bAlex\s+Jonse\b/gi, "Alex Jones"], [/\bНОВОСТИ\b/gi, "Новости"], [/\bРОССИЯ\b/gi, "Россия"]
  ];
  for (const [regex, rep] of misspellings) cleaned = cleaned.replace(regex, rep);

  cleaned = cleaned.replace(/\s*-\s*/g, "-");
  cleaned = cleaned.replace(/^[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"~\\/<>]+|[\s\-_–—:;|.,+*#@!%?^&()\[\]{}'"~\\/<>]+$/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned || "Unknown Title";
}

function extractSeriesName(title: string, defaultGroup: string): string {
  // Use faster string split method as requested instead of complex regex
  const seriesPartByDate = title.split(/[-_]\s*\d/)[0].trim();
  let seriesPart = "";

  if (seriesPartByDate && seriesPartByDate !== title) {
    seriesPart = seriesPartByDate;
  } else {
     // match season/ep
     const parts = title.split(/[-_.]\s*(?:[Ss]\d{1,3}\s*[Ee]\d{1,4}|\d{1,2}x\d{1,3}|Season\s*\d+\s*Episode\s*\d+|Ep(?:isode)?\s*\d+|\d{1,3}\s*сезон|\d{1,4}\s*серия)/i);
     if (parts.length > 1) {
         seriesPart = parts[0].trim();
     } else if (title.includes(" - ")) {
        const hyphenParts = title.split(" - ");
        if (hyphenParts.length > 1 && hyphenParts[0].length > 2 && hyphenParts[0].split(" ").length <= 5) {
          seriesPart = hyphenParts[0].trim();
        }
     }
  }

  if (seriesPart) {
    seriesPart = seriesPart.replace(/[-_.\s]+$/, '');
    if (defaultGroup && defaultGroup !== "Uncategorized") {
      if (defaultGroup.toLowerCase() === seriesPart.toLowerCase()) return defaultGroup;
      return `${defaultGroup} / ${seriesPart}`;
    }
    return seriesPart;
  }
  return defaultGroup || "Uncategorized";
}

self.onmessage = async (e: MessageEvent<{ rawContent: string, baseUrl?: string }>) => {
  const { rawContent, baseUrl } = e.data;
  const channels = parseM3UPlaylistString(rawContent, baseUrl);
  
  try {
    // Attempt to sync to IndexedDB directly from the worker to save main thread time
    if (self.indexedDB) {
      const dbRequest = self.indexedDB.open("AJN_IPTV_DATABASE");
      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        // Verify store exists
        if (db.objectStoreNames.contains("channels")) {
          const transaction = db.transaction("channels", "readwrite");
          const store = transaction.objectStore("channels");
          
          // Deduplicate
          const seenUrls = new Set<string>();
          const uniqueChannels: IPTVChannel[] = [];
          for (let i = channels.length - 1; i >= 0; i--) {
            const chan = channels[i];
            if (chan.url && !seenUrls.has(chan.url)) {
              seenUrls.add(chan.url);
              uniqueChannels.unshift(chan);
            }
          }

          // We use small chunks to not block the worker thread entirely
          const chunkSize = 1000;
          for (let i = 0; i < uniqueChannels.length; i += chunkSize) {
            const chunk = uniqueChannels.slice(i, i + chunkSize);
            for (const c of chunk) {
               store.put(c);
            }
          }
          
          transaction.oncomplete = () => {
            self.postMessage({ channels: uniqueChannels, syncComplete: true });
          };
          transaction.onerror = () => {
             self.postMessage({ channels: uniqueChannels, syncComplete: false, error: "Transaction error" });
          };
        } else {
           self.postMessage({ channels, syncComplete: false, error: "Store not found" });
        }
      };
      dbRequest.onerror = () => {
        self.postMessage({ channels, syncComplete: false, error: "DB open error" });
      };
    } else {
      // Deduplicate for non-IndexedDB environments as well
      const seenUrls = new Set<string>();
      const uniqueChannels: IPTVChannel[] = [];
      for (let i = channels.length - 1; i >= 0; i--) {
        const chan = channels[i];
        if (chan.url && !seenUrls.has(chan.url)) {
          seenUrls.add(chan.url);
          uniqueChannels.unshift(chan);
        }
      }
      self.postMessage({ channels: uniqueChannels, syncComplete: false, error: "IndexedDB not available in worker" });
    }
  } catch (err) {
    self.postMessage({ channels, syncComplete: false, error: err instanceof Error ? err.message : String(err) });
  }
};

function parseM3UPlaylistString(rawContent: string, baseUrl?: string): IPTVChannel[] {
  const trimmed = rawContent.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : (data.episodes || data.channels || [data]);
      if (Array.isArray(arr)) {
         return arr.map((c: any, i: number) => ({
           name: c.name || c.title || `Channel ${i+1}`,
           url: c.url || c.videoUrl || c.streamUrl || "",
           logo: c.logo || c.thumbnailUrl || null,
           group: c.group || c.category || "JSON Import",
           duration: typeof c.duration === "number" ? c.duration : -1,
           contentType: c.contentType || "vod"
         })).filter((c: any) => c.url) as IPTVChannel[];
      }
    } catch (e) {}
  }
  if (rawContent.match(/^\d+\*file\*/m) || rawContent.match(/^\d+\*title\*/m)) {
    const dpl = DaumPlaylistAdapter.parse(rawContent);
    return dpl.map(c => ({
      name: c.name,
      url: c.streamUrl,
      logo: c.thumbnailUrl || null,
      group: c.category || "General",
      duration: -1
    })) as IPTVChannel[];
  }

  const lines = rawContent.split(/\r?\n/);
  const channels: IPTVChannel[] = [];
  let currentChannel: Partial<IPTVChannel> | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF:")) {
      currentChannel = {};
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
      const tvgChnoMatch = line.match(/tvg-chno="([^"]+)"/);
      const tvgLanguageMatch = line.match(/tvg-language="([^"]+)"/);
      const tvgCountryMatch = line.match(/tvg-country="([^"]+)"/);
      const tvgGenreMatch = line.match(/tvg-genre="([^"]+)"/);

      currentChannel.logo = logoMatch ? logoMatch[1] : null;
      currentChannel.group = groupMatch ? groupMatch[1] : "Uncategorized";
      currentChannel.tvgId = tvgIdMatch ? tvgIdMatch[1] : undefined;
      currentChannel.tvgName = tvgNameMatch ? tvgNameMatch[1] : undefined;
      currentChannel.tvgChno = tvgChnoMatch ? tvgChnoMatch[1] : undefined;
      currentChannel.tvgLanguage = tvgLanguageMatch ? tvgLanguageMatch[1] : undefined;
      currentChannel.tvgCountry = tvgCountryMatch ? tvgCountryMatch[1] : undefined;
      currentChannel.tvgGenre = tvgGenreMatch ? tvgGenreMatch[1] : undefined;

      const durMatch = line.match(/#EXTINF:(-?\d+)/);
      if (durMatch) {
        currentChannel.duration = parseInt(durMatch[1], 10);
      } else {
        currentChannel.duration = -1;
      }

      const commaIndex = line.lastIndexOf(",");
      if (commaIndex !== -1) {
        currentChannel.name = line.substring(commaIndex + 1).trim() || "Unnamed Channel";
      } else {
        currentChannel.name = "Unnamed Channel";
      }

      const nameL = currentChannel.name.toLowerCase();
      if (nameL.includes("radio") || nameL.includes("podcast") || currentChannel.group.toLowerCase().includes("radio")) {
        currentChannel.contentType = "radio";
      } else if (currentChannel.duration && currentChannel.duration > 0) {
        currentChannel.contentType = "vod";
      } else {
        currentChannel.contentType = "live";
      }
      currentChannel.playCount = 0;
      currentChannel.category = [currentChannel.group];
    } else if (line.startsWith("#") && !line.startsWith("#EXTINF:")) {
      continue;
    } else {
      if (currentChannel) {
        currentChannel.url = line;
        
        if (baseUrl && !line.match(/^(https?|rtmp|rtsp|mms):\/\//i) && !line.startsWith("file://")) {
           try {
             currentChannel.url = new URL(line, baseUrl).toString();
           } catch(e) {}
        }
        
        const finalUrl = currentChannel.url;

        if (finalUrl.match(/^(https?|rtmp|rtsp|mms):\/\//i)) {
          const isIA = finalUrl.includes("archive.org/");
          const isFilterable = isIA && (
            finalUrl.endsWith(".xml") ||
            finalUrl.endsWith("_ia.mp4") ||
            finalUrl.endsWith(".mkv") ||
            finalUrl.endsWith("_meta.xml") ||
            finalUrl.endsWith("_files.xml") ||
            finalUrl.endsWith("_meta.sqlite") ||
            finalUrl.endsWith("_archive.torrent")
          );
          if (!isFilterable) {
            let nameStr = currentChannel.name || "";
            if (finalUrl.includes("archive.org/") && (!nameStr || nameStr === "Unnamed Channel")) {
               const identifier = extractIdentifier(finalUrl);
               if (identifier) {
                 nameStr = identifier.replace(/[-_]/g, " ");
               }
            }
            nameStr = cleanTitle(nameStr);
            if (nameStr) {
               currentChannel.name = nameStr;
               const rawGroup = currentChannel.group || "Uncategorized";
               currentChannel.group = extractSeriesName(nameStr, rawGroup);
               currentChannel.category = [currentChannel.group];
            }
            channels.push(currentChannel as IPTVChannel);
          }
        }
        currentChannel = null;
      }
    }
  }
  return channels;
}
