import express from 'express';
import { AJNStreamGrabber } from '../streamGrabber';

const router = express.Router();
const grabber = new AJNStreamGrabber();

// Live HLS Stream Gateway
router.get('/api/v1/stream/live.m3u8', async (req, res) => {
  const targetManifest = req.query.url as string;
  if (!targetManifest) {
    res.status(400).send('Missing target manifest URL parameter');
    return;
  }

  const manifestInfo = await grabber.resolveStreamManifest(targetManifest);
  if (!manifestInfo) {
    res.status(502).send('Unable to resolve HLS stream manifest');
    return;
  }

  // Fetch raw manifest text and rewrite segment paths
  const rawResponse = await fetch(manifestInfo.targetBitrateUrl);
  let manifestText = await rawResponse.text();

  const baseUrl = manifestInfo.targetBitrateUrl;
  manifestText = manifestText.replace(/^(?!#)(.+)$/gm, (line) => {
    if (line.startsWith('http://') || line.startsWith('https://')) {
      return `/api/v1/stream/segment?url=${encodeURIComponent(line)}`;
    }
    const absoluteUrl = new URL(line, baseUrl).href;
    return `/api/v1/stream/segment?url=${encodeURIComponent(absoluteUrl)}`;
  });

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(manifestText);
});

// Proxy route for streaming raw .ts / .m4s media chunks
router.get('/api/v1/stream/segment', async (req, res) => {
  const segmentUrl = req.query.url as string;
  if (!segmentUrl) {
    res.status(400).send('Missing segment URL');
    return;
  }

  try {
    const segmentRes = await fetch(segmentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!segmentRes.ok) {
      res.status(segmentRes.status).send('Segment fetch failed');
      return;
    }

    res.setHeader('Content-Type', segmentRes.headers.get('content-type') || 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (segmentRes.body) {
      const reader = segmentRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }
  } catch (err: any) {
    res.status(502).send(`Segment proxy error: ${err.message}`);
  }
});

router.get('/api/rumble/stream-data/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId) {
    res.status(400).json({ error: "Missing video ID" });
    return;
  }

  try {
    const url = `https://rumble.com/embedJS/u3/?request=video&v=${videoId}`;
    const response = await fetch(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`Rumble API HTTP ${response.status}`);
    
    const data = await response.json();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error(`[Rumble Proxy Error]:`, err.message);
    res.status(500).json({ success: false, error: "Proxy fetch failed" });
  }
});

export default router;
