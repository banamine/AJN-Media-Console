import { AudioTrack } from "../types";

export interface ParsedTrackInfo {
  artist: string;
  title: string;
  trackNumber?: number;
  year?: string;
}

/**
 * Intelligently extracts artist and title from a filename/string
 */
export function extractTitleFromFilename(filename: string): ParsedTrackInfo {
  if (!filename) {
    return { artist: "Unknown Artist", title: "Unknown Track" };
  }

  // Remove file extension (e.g. .mp3, .wav, .m4a, etc.)
  const withoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  
  // Split on " - " or long dash
  const parts = withoutExt.split(/\s+(?:-|–|—)\s+/);
  
  if (parts.length >= 3) {
    const firstPart = parts[0].trim();
    const possibleTrackNum = parseInt(firstPart, 10);
    if (!isNaN(possibleTrackNum) && /^\d+$/.test(firstPart)) {
      return {
        trackNumber: possibleTrackNum,
        artist: parts[1].trim() || "Unknown Artist",
        title: parts.slice(2).join(" - ").trim(),
      };
    } else {
      return {
        artist: firstPart || "Unknown Artist",
        title: parts.slice(1).join(" - ").trim(),
      };
    }
  } else if (parts.length === 2) {
    const firstPart = parts[0].trim();
    const secondPart = parts[1].trim();
    const possibleTrackNum = parseInt(firstPart, 10);
    
    if (!isNaN(possibleTrackNum) && /^\d+$/.test(firstPart)) {
      return {
        trackNumber: possibleTrackNum,
        artist: "Unknown Artist",
        title: secondPart,
      };
    } else {
      return {
        artist: firstPart || "Unknown Artist",
        title: secondPart,
      };
    }
  } else {
    // Single part
    // Check for "01. Title" or similar track number prefix
    const dotMatch = withoutExt.match(/^(\d+)\s*\.\s*(.+)$/);
    if (dotMatch) {
      return {
        trackNumber: parseInt(dotMatch[1], 10),
        artist: "Unknown Artist",
        title: dotMatch[2].trim(),
      };
    }
    return {
      artist: "Unknown Artist",
      title: withoutExt.trim(),
    };
  }
}

/**
 * Parses PLS playlist file content
 */
export function parsePLS(content: string): AudioTrack[] {
  if (!content) return [];

  const tracksMap: { [key: number]: Partial<AudioTrack> } = {};
  const lines = content.split(/\r?\n/);

  let hasPlaylistHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue; // Comment or empty

    if (trimmed.toLowerCase() === "[playlist]") {
      hasPlaylistHeader = true;
      continue;
    }

    const equalsIdx = trimmed.indexOf("=");
    if (equalsIdx === -1) continue;

    const key = trimmed.substring(0, equalsIdx).trim().toLowerCase();
    const value = trimmed.substring(equalsIdx + 1).trim();

    // Match fileX, titleX, lengthX
    const match = key.match(/^(file|title|length)(\d+)$/);
    if (match) {
      const type = match[1];
      const index = parseInt(match[2], 10);

      if (!tracksMap[index]) {
        tracksMap[index] = {};
      }

      if (type === "file") {
        tracksMap[index].url = value;
      } else if (type === "title") {
        const parsed = extractTitleFromFilename(value);
        tracksMap[index].title = parsed.title;
        tracksMap[index].artist = parsed.artist;
      } else if (type === "length") {
        const len = parseInt(value, 10);
        tracksMap[index].length = isNaN(len) ? -1 : len;
      }
    }
  }

  const tracks: AudioTrack[] = [];
  const sortedIndices = Object.keys(tracksMap)
    .map(Number)
    .sort((a, b) => a - b);

  for (const index of sortedIndices) {
    const data = tracksMap[index];
    if (data.url) {
      let title = data.title || "";
      let artist = data.artist || "";

      if (!title) {
        // Fallback to filename
        let filename = "";
        try {
          const urlObj = new URL(data.url);
          const pathname = decodeURIComponent(urlObj.pathname);
          filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        } catch (_) {
          const lastSlash = data.url.lastIndexOf("/");
          if (lastSlash !== -1) {
            filename = data.url.substring(lastSlash + 1);
          } else {
            filename = data.url;
          }
        }

        if (filename) {
          const parsed = extractTitleFromFilename(filename);
          title = parsed.title || `Track ${index}`;
          if (!artist || artist === "Unknown Artist") {
            artist = parsed.artist;
          }
        } else {
          title = `Track ${index}`;
        }
      }

      tracks.push({
        title,
        artist: artist || "Unknown Artist",
        url: data.url,
        length: data.length !== undefined ? data.length : -1,
        sourceType: "pls",
      });
    }
  }

  return tracks;
}

/**
 * Generates a valid PLS playlist string
 */
export function exportToPLS(tracks: AudioTrack[], name?: string): string {
  const lines: string[] = ["[playlist]"];

  tracks.forEach((track, idx) => {
    const num = idx + 1;
    lines.push(`File${num}=${track.url}`);
    
    const trackLabel = track.artist && track.artist !== "Unknown Artist"
      ? `${track.artist} - ${track.title}` 
      : track.title;
    lines.push(`Title${num}=${trackLabel}`);
    
    if (track.artist && track.artist !== "Unknown Artist") {
      lines.push(`Artist${num}=${track.artist}`);
    }
    if ((track as any).genre) {
      lines.push(`Genre${num}=${(track as any).genre}`);
    }
    
    lines.push(`Length${num}=${track.length !== undefined ? track.length : -1}`);
  });

  lines.push(`NumberOfEntries=${tracks.length}`);
  lines.push("Version=2");

  return lines.join("\r\n");
}

export async function fetchAndParseM3U(m3uUrl: string): Promise<string[]> {
  try {
    const fetchUrl = m3uUrl.startsWith('http') && !m3uUrl.includes('/api/stream-proxy') 
       ? `/api/stream-proxy?url=${encodeURIComponent(m3uUrl)}` 
       : m3uUrl;
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get("content-type");
    if ((contentType && contentType.includes("application/json")) || m3uUrl.toLowerCase().endsWith(".json")) {
      const data = await response.json();
      const arr = Array.isArray(data) ? data : (data.episodes || data.channels || [data]);
      if (Array.isArray(arr)) {
        return arr.map((item: any) => item.url || item.videoUrl || item.streamUrl || item).filter((u: any) => typeof u === "string");
      }
      return [];
    }

    const text = await response.text();
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      try {
         const data = JSON.parse(text);
         const arr = Array.isArray(data) ? data : (data.episodes || data.channels || [data]);
         if (Array.isArray(arr)) {
           return arr.map((item: any) => item.url || item.videoUrl || item.streamUrl || item).filter((u: any) => typeof u === "string");
         }
      } catch (e) {}
    }
    
    // Split by line, filter out comments/metadata, and ignore empty lines
    const playlistUrls = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        if (!line.match(/^(https?|rtmp|rtsp|mms):\/\//i) && !line.startsWith("file://")) {
           try {
             return new URL(line, m3uUrl).toString();
           } catch(e) {}
        }
        return line;
      });
      
    return playlistUrls;
  } catch (error) {
    console.warn("Failed to parse M3U/JSON:", error);
    return []; // Triggers fallback logic
  }
}
