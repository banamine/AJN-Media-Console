export interface ChannelMetadataInput {
  name: string;
  category: string;
  url?: string;
  source?: string;
  type?: string;
  episodes?: { title: string; genre?: string; plot?: string }[];
}

/**
 * Automatically parses stream metadata and assigns dynamic tags like 'News', 'Documentaries', or 'Live' to each channel.
 * @param channel The channel object to analyze.
 * @returns An array of string tags representing the matched categories.
 */
export function getAutomatedCategoryTags(channel: ChannelMetadataInput): string[] {
  const tagsSet = new Set<string>();
  
  const nameLower = (channel.name || "").toLowerCase();
  const categoryLower = (channel.category || "").toLowerCase();
  const urlLower = (channel.url || "").toLowerCase();
  const sourceLower = (channel.source || "").toLowerCase();
  const typeLower = (channel.type || "").toLowerCase();
  
  // Combine all strings for general keyword scanning
  const combined = `${nameLower} ${categoryLower} ${urlLower} ${sourceLower} ${typeLower}`;
  
  // 1. NEWS Tag
  const newsKeywords = [
    "news", "nightly", "journal", "report", "briefing", "brief", 
    "ajn", "press", "headlines", "dispatch", "ledger", "newsmax", "oan", "infowars"
  ];
  if (newsKeywords.some(keyword => combined.includes(keyword))) {
    tagsSet.add("News");
  }
  
  // 2. DOCUMENTARIES Tag
  const docKeywords = [
    "doc", "documentary", "documentaries", "exposé", "expose", 
    "deception", "unmasked", "chronicles", "revealed"
  ];
  if (docKeywords.some(keyword => combined.includes(keyword))) {
    tagsSet.add("Documentaries");
  }
  
  // 3. LIVE Tag
  // Indicators of stream behavior: live keywords, rumble, youtube embed links, newsmax, oan live, or iptv
  const liveKeywords = [
    "live", "livestream", "broadcast", "iptv", "today", "breaking", 
    "embed", "stream", "rumble", "youtube"
  ];
  const isVODSource = sourceLower.includes("infowars-nightly-news-sd") || 
                      sourceLower.includes("infowars-war-room-2023-sd") || 
                      sourceLower.includes("infowars-police-state-docs") || 
                      sourceLower.includes("alex-jones-infowars-archives") ||
                      typeLower === "ia_collection";
                      
  // If it's a live embed or a livestream URL, or matches live keywords, and isn't purely a historical VOD archive collection
  if ((liveKeywords.some(keyword => combined.includes(keyword)) || typeLower === "rumble" || typeLower === "youtube" || nameLower.includes("livestream")) && !isVODSource) {
    tagsSet.add("Live");
  }
  
  // 4. ARCHIVE Tag
  const archiveKeywords = [
    "archive", "classic", "vault", "historical", "retrospective", "old", "vintage", "archives", "chrono", "historical"
  ];
  const hasYearInName = /\b(19|20)\d{2}\b/.test(nameLower) || /\b(19|20)\d{2}\b/.test(sourceLower);
  if (archiveKeywords.some(keyword => combined.includes(keyword)) || isVODSource || hasYearInName) {
    tagsSet.add("Archive");
  }
  
  // 5. GEOPOLITICS Tag
  const geoKeywords = [
    "war room", "warroom", "geopolitics", "global", "strategic", "strategy", 
    "tactical", "intelligence", "sovereignty", "border", "globalist", "treaty"
  ];
  if (geoKeywords.some(keyword => combined.includes(keyword))) {
    tagsSet.add("Geopolitics");
  }
  
  // 6. TECH Tag
  const techKeywords = [
    "tech", "technology", "cyber", "ai", "artificial", "mesh", "drone", "algorithm", "silicon", "network"
  ];
  if (techKeywords.some(keyword => combined.includes(keyword))) {
    tagsSet.add("Tech");
  }
  
  // 7. ECON Tag
  const econKeywords = [
    "econ", "economic", "economics", "dollar", "gold", "wealth", "finance", "market", "currency", "metals"
  ];
  if (econKeywords.some(keyword => combined.includes(keyword))) {
    tagsSet.add("Econ");
  }
  
  // 8. HEALTH Tag
  const healthKeywords = [
    "health", "bio", "medical", "wellness", "nutritional", "vitality", "detox", "pandemic", "radiation", "hygiene"
  ];
  if (healthKeywords.some(keyword => combined.includes(keyword))) {
    tagsSet.add("Health");
  }
  
  // Scan episodes if available
  if (channel.episodes && channel.episodes.length > 0) {
    channel.episodes.forEach(ep => {
      const epTitleLower = (ep.title || "").toLowerCase();
      const epGenreLower = (ep.genre || "").toLowerCase();
      const epPlotLower = (ep.plot || "").toLowerCase();
      const epCombined = `${epTitleLower} ${epGenreLower} ${epPlotLower}`;
      
      if (newsKeywords.some(kw => epCombined.includes(kw))) tagsSet.add("News");
      if (docKeywords.some(kw => epCombined.includes(kw))) tagsSet.add("Documentaries");
      if (geoKeywords.some(kw => epCombined.includes(kw))) tagsSet.add("Geopolitics");
      if (techKeywords.some(kw => epCombined.includes(kw))) tagsSet.add("Tech");
      if (econKeywords.some(kw => epCombined.includes(kw))) tagsSet.add("Econ");
      if (healthKeywords.some(kw => epCombined.includes(kw))) tagsSet.add("Health");
    });
  }
  
  // Default fallback tags if empty
  if (tagsSet.size === 0) {
    tagsSet.add("Variety");
  }
  
  return Array.from(tagsSet);
}

export interface StreamValidationResult {
  valid: boolean;
  reason?: string;
  temporaryThumbnail?: string;
}

/**
 * Validates a stream or collection source URL asynchronously.
 * Performs simulated DNS and real fetch HEAD requests gracefully handling CORS.
 * Generates an appropriate temporary thumbnail for valid URLs based on source type.
 */
export async function validateStreamURL(url: string, type: string): Promise<StreamValidationResult> {
  if (!url || !url.trim()) {
    return { valid: false, reason: "Source/URL is empty" };
  }

  const cleanUrl = url.trim();

  // Helper to extract YouTube video ID for thumbnail generation
  const getYTThumbnail = (ytUrl: string): string => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = ytUrl.match(regExp);
      if (match && match[2].length === 11) {
        return `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
      }
    } catch (_) {}
    return "https://archive.org/download/daily-highlights/lmbsa.png";
  };

  if (type === "ia_collection") {
    // internet archive identifier validation (alphanumeric and dash/underscore)
    if (!/^[a-zA-Z0-9\-_]+$/.test(cleanUrl)) {
      return { valid: false, reason: "Invalid Internet Archive collection identifier format (must be alphanumeric, dash, or underscore)" };
    }
    // Real dynamic Internet Archive collection image URL!
    return { 
      valid: true, 
      temporaryThumbnail: `https://archive.org/services/img/${cleanUrl}` 
    };
  }

  if (type === "youtube") {
    const isYt = cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be");
    if (!isYt) return { valid: false, reason: "Not a valid YouTube domain" };
    return { 
      valid: true, 
      temporaryThumbnail: getYTThumbnail(cleanUrl) 
    };
  }

  if (type === "rumble") {
    const isRumble = cleanUrl.includes("rumble.com");
    if (!isRumble) return { valid: false, reason: "Not a valid Rumble domain" };
    return { 
      valid: true, 
      temporaryThumbnail: "https://archive.org/download/daily-highlights/lmbsa.png" 
    };
  }

  if (type === "rss") {
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      return { valid: false, reason: "RSS Feed must be a valid http:// or https:// URL" };
    }
    return {
      valid: true,
      temporaryThumbnail: "https://archive.org/download/daily-highlights/lmbsa.png"
    };
  }

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, reason: "URL must use http:// or https://" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const fallbackThumb = cleanUrl.endsWith(".m3u8") 
      ? "https://archive.org/download/daily-highlights/lmbsa.png"
      : "https://archive.org/download/daily-highlights/lmbsa.png";

    try {
      // Direct streaming URL or file fetch - use no-cors to resolve across domains
      await fetch(cleanUrl, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return { 
        valid: true, 
        temporaryThumbnail: fallbackThumb 
      };
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        return { valid: false, reason: "Connection timed out (server unresponsive)" };
      }
      
      const errMsg = String(fetchErr).toLowerCase();
      // If it is a generic "Failed to fetch" due to CORS, but didn't time out/connection-refuse,
      // it means the server responded (hence valid URL exists!).
      if (errMsg.includes("failed to fetch") || errMsg.includes("dns") || errMsg.includes("network")) {
        let secondTimeout: any = null;
        try {
          const secondController = new AbortController();
          secondTimeout = setTimeout(() => secondController.abort(), 4000);
          await fetch(cleanUrl, { method: "GET", mode: "no-cors", signal: secondController.signal });
          clearTimeout(secondTimeout);
          return { 
            valid: true, 
            temporaryThumbnail: fallbackThumb 
          };
        } catch (getErr: any) {
          if (secondTimeout) clearTimeout(secondTimeout);
          if (getErr.name === "AbortError") {
            return { valid: false, reason: "Connection timed out" };
          }
          return { valid: false, reason: "Server is unreachable or DNS resolution failed" };
        }
      }
      return { 
        valid: true, 
        temporaryThumbnail: fallbackThumb 
      };
    }
  } catch (e) {
    return { valid: false, reason: "Invalid URL format" };
  }
}

