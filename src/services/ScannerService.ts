import { fetchArchiveCollectionFiles } from "../utils/semanticResolver";

export interface DiscoveredChannel {
  channelId: string;
  num: number;
  name: string;
  category: string;
  logo: string;
  type: "ia_collection";
  source: string;
  filesCount: number;
  sampleFile: string;
  isValidated: boolean;
  isFavorite: boolean;
  seriesId: string; // Hash of source path to uniquely identify series across restarts
}

/**
 * Sanitizes Archive.org folder names into clean, readable Channel Titles.
 * E.g., "The David Knight Show (2November20 Full Show)" -> "The David Knight Show"
 * E.g., "Gunsmoke [1955]!" -> "Gunsmoke"
 */
export function sanitizeFolderToTitle(folderName: string): string {
  let clean = folderName;
  
  // Remove parentheses and their contents, e.g., (2November20 Full Show)
  clean = clean.replace(/\([^)]*\)/g, "");
  
  // Remove brackets and their contents, e.g., [1955]
  clean = clean.replace(/\[[^\]]*\]/g, "");
  
  // Remove file extensions if any got in
  clean = clean.replace(/\.[a-zA-Z0-9]+$/, "");
  
  // Replace underscores and hyphens with spaces
  clean = clean.replace(/[_-]/g, " ");
  
  // Remove other trailing/leading special symbols
  clean = clean.replace(/[!@#$%^&*(){}[\]:;"'<>,.?/\\|~`+]+/g, " ");
  
  // Convert CamelCase to spaced words
  clean = clean.replace(/([a-z])([A-Z])/g, "$1 $2");
  
  // Clean up multiple spaces
  clean = clean.replace(/\s+/g, " ");
  
  // Capitalize first letter of each word
  clean = clean.replace(/\b\w/g, c => c.toUpperCase());
  
  return clean.trim() || folderName;
}

/**
 * Computes a simple deterministic 32-bit FNV-1a hash to act as a permanent Series ID.
 * This is crucial for retaining favorite flags even if Channel IDs change during a re-shuffle.
 */
export function computeSeriesId(sourcePath: string): string {
  const cleanStr = sourcePath.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < cleanStr.length; i++) {
    hash ^= cleanStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `series_${(hash >>> 0).toString(16)}`;
}

/**
 * Validates a sample URL using a HEAD or quick GET through the stream-proxy.
 */
export async function validateSampleLink(url: string): Promise<boolean> {
  try {
    const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(url)}`;
    // Run a quick fetch with a low range or HEAD to verify accessibility
    const response = await fetch(proxiedUrl, {
      method: "GET",
      headers: {
        "Range": "bytes=0-100"
      }
    });
    return response.ok || response.status === 206;
  } catch (err) {
    console.error(`[ScannerService] Link validation failed for ${url}:`, err);
    return false;
  }
}

/**
 * Scans a root Internet Archive collection, extracts subfolders as separate channels,
 * and compiles them with automatic numbering, titles, and validation.
 */
export async function scanCollectionForFolders(
  collectionId: string,
  startingChannelNum: number = 40,
  category: string = "Archive Discover"
): Promise<DiscoveredChannel[]> {
  const cleanId = collectionId.trim();
  if (!cleanId) return [];

  console.log(`[ScannerService] Starting scan for collection: ${cleanId}`);
  const allFiles = await fetchArchiveCollectionFiles(cleanId);
  if (!allFiles || allFiles.length === 0) {
    console.warn(`[ScannerService] No files found for collection: ${cleanId}`);
    return [];
  }

  // Parse files and group by top-level directories
  const folderGroups = new Map<string, string[]>();
  
  allFiles.forEach(file => {
    const lower = file.toLowerCase();
    // Only care about video or audio media files
    const isMedia = (
      lower.endsWith(".mp4") ||
      lower.endsWith(".m3u8") ||
      lower.endsWith(".mp3") ||
      lower.endsWith(".m4a") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".m4v") ||
      lower.endsWith(".avi") ||
      lower.endsWith(".mkv")
    );

    if (!isMedia) return;

    // Check if the file lives in a subfolder
    const firstSlash = file.indexOf("/");
    if (firstSlash !== -1) {
      const folderName = file.substring(0, firstSlash).trim();
      if (folderName && !folderName.startsWith(".") && !folderName.includes("__ia_thumb")) {
        if (!folderGroups.has(folderName)) {
          folderGroups.set(folderName, []);
        }
        folderGroups.get(folderName)!.push(file);
      }
    }
  });

  const discovered: DiscoveredChannel[] = [];
  let currentNum = startingChannelNum;

  // If there are no folders, but we have media files at the root, treat the root collection itself as a single series
  if (folderGroups.size === 0) {
    const rootMediaFiles = allFiles.filter(file => {
      const lower = file.toLowerCase();
      return (
        !file.includes("/") &&
        (lower.endsWith(".mp4") ||
         lower.endsWith(".m3u8") ||
         lower.endsWith(".mp3") ||
         lower.endsWith(".m4a") ||
         lower.endsWith(".mov") ||
         lower.endsWith(".m4v"))
      );
    });

    if (rootMediaFiles.length > 0) {
      const sanitizedName = sanitizeFolderToTitle(cleanId);
      const sourcePath = cleanId;
      const seriesId = computeSeriesId(sourcePath);
      
      discovered.push({
        channelId: `discovered-${seriesId}`,
        num: currentNum,
        name: sanitizedName,
        category,
        logo: "https://archive.org/download/daily-highlights/lmbsa.png",
        type: "ia_collection",
        source: sourcePath,
        filesCount: rootMediaFiles.length,
        sampleFile: rootMediaFiles[0],
        isValidated: false, // Default to false until staging HEAD check succeeds
        isFavorite: false,
        seriesId
      });
    }
  } else {
    // Process each subfolder
    for (const [folderName, files] of folderGroups.entries()) {
      if (files.length === 0) continue;

      const sanitizedName = sanitizeFolderToTitle(folderName);
      const sourcePath = `${cleanId}/${folderName}`;
      const seriesId = computeSeriesId(sourcePath);

      // Take a sample file
      const sampleFile = files[0];

      discovered.push({
        channelId: `discovered-${seriesId}`,
        num: currentNum++,
        name: sanitizedName,
        category,
        logo: "https://archive.org/download/daily-highlights/lmbsa.png",
        type: "ia_collection",
        source: sourcePath,
        filesCount: files.length,
        sampleFile,
        isValidated: false, // Default to false until validated
        isFavorite: false,
        seriesId
      });
    }
  }

  // Perform validation staging checks concurrently (HEAD/GET requests on sample files)
  const validationPromises = discovered.map(async (ch) => {
    // Construct sample file URL
    const filePart = ch.sampleFile;
    const url = `https://archive.org/download/${cleanId}/${filePart}`;
    const isValid = await validateSampleLink(url);
    ch.isValidated = isValid;
    console.log(`[ScannerService] Validated channel "${ch.name}": ${isValid ? "SUCCESS" : "FAILED"}`);
  });

  // Limit execution time/wait for validation checks, but don't fail if some fail
  try {
    await Promise.all(validationPromises);
  } catch (err) {
    console.warn("[ScannerService] Error during channel validation staging:", err);
  }

  // Sort discovered channels alphabetically by sanitized name
  discovered.sort((a, b) => a.name.localeCompare(b.name));
  
  // Re-assign dynamic sequential channel numbers starting from startingChannelNum after sorting
  discovered.forEach((ch, idx) => {
    ch.num = startingChannelNum + idx;
  });

  console.log(`[ScannerService] Discovered ${discovered.length} channels from ${cleanId}`);
  return discovered;
}
