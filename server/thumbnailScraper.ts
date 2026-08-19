import { getEpisodes, insertEpisode, type Episode } from './storage.ts';

// Regex sanitizer to clean show titles
export function cleanTitleForScraping(rawTitle: string): string {
  let title = rawTitle;
  
  // Strip dates like 20150826, 2023-10-12
  title = title.replace(/\b\d{8}\b/g, '');
  title = title.replace(/\b\d{4}[-_]\d{2}[-_]\d{2}\b/g, '');
  
  // Strip quality tags like HD, 720p, 1080p, 4K
  title = title.replace(/\b(?:HD|720p|1080p|4K|2160p)\b/gi, '');
  
  // Strip file extensions
  title = title.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|m3u8|ts|jpg|png|gif)\b/gi, '');
  
  // Strip special characters and extra spaces
  title = title.replace(/[-_\[\]\(\)]/g, ' ');
  title = title.replace(/\s{2,}/g, ' ').trim();
  
  return title;
}

export function extractArchiveIdentifier(url: string): string | null {
  if (!url) return null;
  const match = url.match(/archive\.org\/(?:download|details)\/([^/?#]+)/);
  return match ? match[1] : null;
}

export async function processItemForThumbnails(ep: Episode): Promise<boolean> {
  let updated = false;
  try {
    const identifier = extractArchiveIdentifier(ep.url);
    
    // Primary: Native Archive.org .thumbs extraction
    if (identifier) {
      const metaRes = await fetch(`https://archive.org/metadata/${identifier}`);
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const files = metaData.files || [];
        
        // Find .thumbs directory images or main .jpg
        const thumbFiles = files.filter((f: any) => 
          (f.name && f.name.includes('.thumbs/') && f.name.endsWith('.jpg')) ||
          (f.format && typeof f.format === 'string' && f.format.includes('Thumbnail'))
        );
        
        if (thumbFiles.length > 0) {
          // Select middle frame if possible
          const midIndex = Math.floor(thumbFiles.length / 2);
          const bestThumb = thumbFiles[midIndex];
          ep.poster_art = `https://archive.org/download/${identifier}/${bestThumb.name}`;
          ep.backdrop_thumb = ep.poster_art; // Fallback to same
          updated = true;
          return updated;
        }
      }
      
      // Secondary: HTML Meta Scraping & Regex Matching (Open Graph)
      try {
        const htmlRes = await fetch(`https://archive.org/details/${identifier}`);
        if (htmlRes.ok) {
          const htmlText = await htmlRes.text();
          const ogImageMatch = htmlText.match(/<meta property="og:image" content="([^"]+)"/i);
          if (ogImageMatch && ogImageMatch[1]) {
            ep.poster_art = ogImageMatch[1];
            ep.backdrop_thumb = ep.poster_art;
            updated = true;
            return updated;
          }
        }
      } catch (e) {
        console.warn(`[ThumbnailScraper] Failed to scrape HTML for ${identifier}`);
      }
    }
    
    // Tertiary: Category & Title Query Scraper
    const cleanedTitle = cleanTitleForScraping(ep.title);
    if (cleanedTitle.length > 2) {
      const searchUrl = `https://archive.org/advancedsearch.php?q=title:(${encodeURIComponent(cleanedTitle)})+AND+mediatype:(image)&output=json`;
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.response?.docs?.length > 0) {
          const doc = searchData.response.docs[0];
          ep.poster_art = `https://archive.org/services/img/${doc.identifier}`;
          ep.backdrop_thumb = ep.poster_art;
          updated = true;
          return updated;
        }
      }
    }
    
    // Quaternary: Fallback to local
    ep.poster_art = "https://archive.org/download/daily-highlights/ajn_logo.png";
    ep.backdrop_thumb = "https://archive.org/download/daily-highlights/ajn_logo.png";
    updated = true;
    
  } catch (error) {
    console.error(`[ThumbnailScraper] Error processing ${ep.title}:`, error);
  }
  return updated;
}

// The background worker function
export async function runScraperJob() {
  console.log('[ThumbnailScraper] Starting background job...');
  const episodes = getEpisodes();
  
  let batchCount = 0;
  for (const ep of episodes) {
    if (!ep.poster_art && ep.url.includes('archive.org')) {
      const didUpdate = await processItemForThumbnails(ep);
      if (didUpdate) {
        insertEpisode(ep);
        batchCount++;
      }
      
      // Delay to avoid HTTP 429
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log(`[ThumbnailScraper] Finished. Processed ${batchCount} items.`);
}
