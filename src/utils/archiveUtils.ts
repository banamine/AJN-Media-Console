// Utility helper functions for archive.org metadata parsing and URL detection

export function extractTitleFromFilename(filename: string): string {
  try {
    const raw = decodeURIComponent(filename.split("/").pop() || filename);
    let clean = raw.replace(/\.(mp3|m4a|ogg|flac|wav|opus)$/i, "");
    clean = clean.replace(/^(\d+(?:[.\-]\s*|\s+))?/, "").trim();
    return clean || raw;
  } catch {
    return filename;
  }
}

export function detectArchiveUrlType(url: string): 'm3u' | 'item' | 'unknown' {
  if (!url || typeof url !== 'string') return 'unknown';
  const clean = url.trim();
  if (clean.includes("archive.org/download/") && clean.toLowerCase().endsWith(".m3u")) {
    return 'm3u';
  }
  if (clean.includes("archive.org/download/") || clean.includes("archive.org/details/")) {
    return 'item';
  }
  return 'unknown';
}

export function extractArchiveDetails(url: string): { identifier: string; filename?: string } | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/archive\.org\/(?:download|details)\/([^/?#]+)(?:\/([^?#]+))?/);
  if (match && match[1]) {
    const filename = match[2] ? decodeURIComponent(match[2]) : undefined;
    return { identifier: decodeURIComponent(match[1]), filename };
  }
  if (!url.includes("/") && !url.includes(".")) {
    return { identifier: url.trim() };
  }
  return null;
}

export function extractIdentifier(url: string): string | null {
  const details = extractArchiveDetails(url);
  return details ? details.identifier : null;
}
