import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');

export function useRumbleAutoUpdater(initialUrl: string) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  useEffect(() => {
    setCurrentUrl(initialUrl);
    
    // Only auto-update if it's the Alex Jones Rumble feed
    if (!initialUrl.includes('rumble.com/embed/') || !initialUrl.includes('pub=15son')) {
      return;
    }

    const channelUrl = 'https://rumble.com/c/TheAlexJonesShowLive';
    let checkTimer: any = null;

    const checkAndUpdate = async () => {
      try {
        const proxyUrl = `${BACKEND_URL}/api/stream-proxy?url=${encodeURIComponent(channelUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) return;
        
        const html = await response.text();
        
        // Method 1: Look for embed src attribute
        let newId = null;
        const embedMatch = html.match(/src="https:\/\/rumble\.com\/embed\/(v[a-zA-Z0-9]+)\//);
        if (embedMatch) {
          newId = embedMatch[1];
        } else {
          // Method 2: Look for Rumble play init
          const scriptMatch = html.match(/Rumble\("play",\s*\{"video":"(v[a-zA-Z0-9]+)"/);
          if (scriptMatch) {
            newId = scriptMatch[1];
          }
        }
        
        if (newId) {
          const newUrl = `https://rumble.com/embed/${newId}/?pub=15son`;
          setCurrentUrl(prev => {
            if (prev !== newUrl) {
              console.log(`[RumbleLiveUpdater] Stream ID changed to: ${newId}`);
              return newUrl;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('[RumbleLiveUpdater] Check failed:', err);
      }
    };

    // Initial check
    checkAndUpdate();

    // Start periodic checks (every 30 seconds)
    checkTimer = setInterval(checkAndUpdate, 30000);

    return () => {
      if (checkTimer) clearInterval(checkTimer);
    };
  }, [initialUrl]);

  return currentUrl;
}
