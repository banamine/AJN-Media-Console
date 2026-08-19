import { Parser } from 'm3u8-parser';

export interface StreamManifestInfo {
  masterUrl: string;
  targetBitrateUrl: string;
  isLive: boolean;
  targetSegments: string[];
  expiresAt: number;
}

export class AJNStreamGrabber {
  private activeStreams: Map<string, StreamManifestInfo> = new Map();

  /**
   * Resolves a target manifest URL into a clean segment structure
   */
  async resolveStreamManifest(manifestUrl: string): Promise<StreamManifestInfo | null> {
    try {
      const response = await fetch(manifestUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
      }

      const manifestText = await response.text();
      const parser = new Parser();
      parser.push(manifestText);
      parser.end();

      const parsed = parser.manifest;

      // Master Playlist Check: Select highest bandwidth variant stream
      if (parsed.playlists && parsed.playlists.length > 0) {
        const sortedPlaylists = parsed.playlists.sort(
          (a: any, b: any) => (b.attributes.BANDWIDTH || 0) - (a.attributes.BANDWIDTH || 0)
        );
        const bestVariantUri = new URL(sortedPlaylists[0].uri, manifestUrl).href;
        
        // Resolve chosen variant media playlist
        return this.resolveStreamManifest(bestVariantUri);
      }

      // Media Playlist: Extract segment URIs
      const segments = (parsed.segments || []).map((seg: any) => new URL(seg.uri, manifestUrl).href);
      const isLive = !parsed.endList;

      const manifestInfo: StreamManifestInfo = {
        masterUrl: manifestUrl,
        targetBitrateUrl: manifestUrl,
        isLive,
        targetSegments: segments,
        expiresAt: Date.now() + (isLive ? 10000 : 3600000)
      };

      this.activeStreams.set(manifestUrl, manifestInfo);
      return manifestInfo;
    } catch (err: any) {
      console.error('[AJN Stream Grabber] Manifest resolution error:', err.message);
      return null;
    }
  }
}
