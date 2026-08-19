/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Check if the URL is a YouTube link.
 */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.includes("youtube.com/") ||
    lower.includes("youtu.be/") ||
    lower.includes("youtube-nocookie.com/")
  );
}

/**
 * Extract the YouTube video ID from various YouTube URL formats.
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Handle youtu.be/abc
  let match = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // Handle youtube.com/embed/abc, youtube.com/v/abc, youtube.com/shorts/abc, youtube.com/live/abc
  match = trimmed.match(/youtube(?:-nocookie)?\.com\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // Handle watch?v=abc
  match = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Get the YouTube embed URL.
 */
export function getYouTubeEmbedUrl(url: string | null | undefined): string {
  if (!url) return "";
  const id = extractYouTubeId(url);
  if (id) {
    return `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  return url.trim();
}

/**
 * Get YouTube embed attributes.
 */
export function getYouTubeEmbedAttributes(): Record<string, string> {
  return {
    referrerpolicy: "strict-origin-when-cross-origin",
    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    allowfullscreen: "true",
    frameborder: "0"
  };
}

/**
 * Get a standard YouTube thumbnail URL.
 */
export function getYouTubeThumbnailUrl(url: string | null | undefined): string | null {
  const id = extractYouTubeId(url);
  if (id) {
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }
  return null;
}

/**
 * Check if the URL is a Rumble link.
 */
export function isRumbleUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  // It is a Rumble link, but NOT a direct .m3u8 stream or playlist
  return (
    lower.includes("rumble.com/") &&
    !lower.includes(".m3u8") &&
    !lower.includes("playlist.m3u8") &&
    !lower.includes("live-hls-dvr")
  );
}

/**
 * Extract the Rumble ID and return an embeddable URL.
 */
export function getRumbleEmbedUrl(url: string | null | undefined): string {
  if (!url) return "";
  const cleanUrl = url.trim();

  // If it is already an embed link, return it directly
  if (cleanUrl.toLowerCase().includes("/embed/")) {
    return cleanUrl;
  }

  // Handle rumble.com/v12345-title.html or rumble.com/v12345
  const match = cleanUrl.match(/rumble\.com\/(v[a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return `https://rumble.com/embed/${match[1]}/`;
  }

  return cleanUrl;
}

/**
 * Check if the URL is a direct media stream.
 */
export function isDirectStreamUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.endsWith(".m3u8") ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".pls") ||
    lower.endsWith(".m3u") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".wav") ||
    lower.includes("chunklist") ||
    lower.includes(".m3u8?") ||
    lower.includes(".mp4?") ||
    lower.includes("stream") ||
    lower.includes("live") ||
    lower.includes("playlist")
  );
}

/**
 * Resolves an Archive.org details URL to a direct media stream URL.
 */
export function resolveMediaStreamUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  
  // If it's an Archive.org details link, convert it to a direct download link
  if (rawUrl.includes("archive.org/details/")) {
    const identifier = rawUrl.split("/details/")[1]?.split("/")[0];
    // Fallback default stream or direct mp4 guess
    return `https://archive.org/download/${identifier}/${identifier}_iv.mp4`;
  }
  
  return rawUrl;
}

/**
 * Detect the type of media stream.
 */
export function detectStreamType(
  url: string | null | undefined
): "youtube" | "rumble" | "direct" | "unknown" {
  if (!url) return "unknown";
  if (isYouTubeUrl(url)) return "youtube";
  if (isRumbleUrl(url)) return "rumble";
  if (isDirectStreamUrl(url)) return "direct";
  return "unknown";
}


