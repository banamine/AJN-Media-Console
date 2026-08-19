export interface ParsedM3UTrack {
  url: string;
  channelId: string;
  trackTitle?: string;
  parentM3uUrl: string;
  title: string; // for backward compatibility in VideoPlayer
}

export async function fetchAndParseM3U(url: string, parentChannelId: string): Promise<ParsedM3UTrack[]> {
  try {
    const fetchUrl = url.startsWith('http') && !url.includes('/api/stream-proxy') 
       ? `/api/stream-proxy?url=${encodeURIComponent(url)}` 
       : url;
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    const tracks: ParsedM3UTrack[] = [];
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentTitle = "";
    let tvgId = "";
    
    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const commaIndex = line.indexOf(',');
        if (commaIndex !== -1) {
          currentTitle = line.substring(commaIndex + 1).trim();
        }
        const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
        if (tvgIdMatch) {
          tvgId = tvgIdMatch[1];
        }
      } else if (!line.startsWith('#')) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.endsWith('.mp4') || lowerLine.endsWith('.mp3') || lowerLine.includes('.mp4?') || lowerLine.includes('.mp3?')) {
          let trackUrl = line;
          if (!trackUrl.match(/^(https?|rtmp|rtsp|mms):\/\//i) && !trackUrl.startsWith("file://")) {
            try {
              trackUrl = new URL(line, url).toString();
            } catch(e) {}
          }
          tracks.push({
            url: trackUrl,
            channelId: tvgId || parentChannelId,
            trackTitle: currentTitle || trackUrl.split('/').pop() || 'Unknown Track',
            parentM3uUrl: url,
            title: currentTitle || trackUrl.split('/').pop() || 'Unknown Track'
          });
          currentTitle = "";
          tvgId = "";
        }
      }
    }
    
    return tracks;
  } catch (error) {
    console.warn("Failed to parse M3U Manifest:", error);
    return []; 
  }
}
