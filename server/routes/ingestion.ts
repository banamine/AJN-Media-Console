import express from 'express';
import { extractArchiveDetails } from '../../src/utils/archiveUtils.ts';
import { isUrlSafe } from '../../src/utils/ssrfGuard.ts';

export const ingestionRouter = express.Router();

ingestionRouter.post("/import", async (req, res) => {
  const { url, source_type, channel_id } = req.body;
  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  if (!isUrlSafe(url)) {
    res.status(403).json({ error: "SSRF Guard Block: Access to URL is restricted" });
    return;
  }

  try {
    let title = "Unknown Title";
    let thumbnail = "";
    let category = "Uncategorized";
    let type = source_type || "hls";

    // Auto-fill logic
    if (url.includes('rumble.com/embed/')) {
      type = "rumble";
      const match = url.match(/\/embed\/([^\/?]+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        title = `Rumble Broadcast [${videoId}]`;
        thumbnail = `https://rumble.com/embed/${videoId}/thumbnail.jpg`;
        category = "Live News";
      }
    } else if (url.includes('archive.org')) {
      type = "archive";
      const details = extractArchiveDetails(url);
      if (details?.identifier) {
        title = `Archive File: ${details.identifier}`;
        thumbnail = `https://archive.org/services/img/${details.identifier}`;
        category = "Documentary";
      }
    } else if (url.endsWith('.m3u8')) {
      type = "hls";
      title = `HLS Stream Feed`;
      category = "Live";
    } else if (url.endsWith('.m3u')) {
      type = "m3u";
      title = `M3U Playlist Feed`;
      category = "Playlist";
    }

    // Insert into dbInMemory or real DB here
    // For now we just return the auto-filled data

    res.json({
      success: true,
      data: {
        title,
        thumbnail,
        category,
        sourceType: type,
        url
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
