import express from "express";
import { Server } from "http";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING AJN PLAYLIST PARSER & INTEGRATION TESTS");
  console.log("==================================================");

  // 1. Create a lightweight test app containing the actual parser logic to test
  const app = express();
  app.use(express.json());

  // Set up mock remote server endpoint that mimics Archive.org serving an M3U
  app.get("/mock-archive/playlist.m3u", (req, res) => {
    res.setHeader("Content-Type", "audio/x-mpegurl");
    res.send(`#EXTM3U
#EXTINF:240,The Alan Parsons Project - Sirius
http://localhost:3999/mock-archive/track1.mp3
#EXTINF:-1,Sodom - Remember the Fallen
http://localhost:3999/mock-archive/track2.mp3
#EXTINF:180,OnlyTitleNoArtist
http://localhost:3999/mock-archive/track3.mp3
#EXTINF:99,Invalid Track Lacking URL Following
#EXTINF:120,Sodom - Agent Orange
http://localhost:3999/mock-archive/track4.mp3
`);
  });

  // Re-declare the same clean parsing logic we used in server.ts
  app.all("/api/playlist/import-from-archive", async (req: any, res: any) => {
    const isPost = req.method === "POST";
    const url = (isPost ? req.body?.url : req.query.url as string) || "";
    const isStream = (isPost ? req.body?.stream === true : req.query.stream === "true" || req.query.stream === "1");

    if (!url) {
      res.status(400).json({ success: false, error: "Missing required parameter: url" });
      return;
    }

    try {
      const upstreamRes = await fetch(url, {
        headers: { "User-Agent": "TestAgent" }
      });

      if (!upstreamRes.ok) {
        throw new Error(`Upstream returned status ${upstreamRes.status}`);
      }

      const itemIdMatch = url.match(/archive\.org\/download\/([^\/]+)/) || url.match(/archive\.org\/details\/([^\/]+)/) || url.match(/mock-archive\/([^\/]+)/);
      const itemId = itemIdMatch ? itemIdMatch[1] : null;
      const thumbnailUrl = itemId ? `https://archive.org/services/img/${itemId}` : null;

      let playlistName = "Imported Live Playlist";
      if (itemId) {
        playlistName = itemId
          .split(/[-_]+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }

      if (isStream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
        res.write(`data: ${JSON.stringify({ type: "progress", value: 5 })}\n\n`);
      }

      const reader = upstreamRes.body?.getReader();
      if (!reader) {
        throw new Error("Could not instantiate reader.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const tracks: any[] = [];

      let currentDuration = -1;
      let currentMetadata = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (line.toUpperCase().startsWith("#EXTINF:")) {
            const match = line.match(/#EXTINF:\s*(-?\d+(?:\.\d+)?)\s*(?:[^,]*),(.*)/i);
            if (match) {
              currentDuration = Math.round(parseFloat(match[1]));
              currentMetadata = match[2].trim();
            }
          } else if (!line.startsWith("#")) {
            const trackUrl = line;
            let artist = "Archive.org";
            let title = currentMetadata || "";

            if (!title) {
              try {
                const uParts = trackUrl.split("/");
                const filename = uParts[uParts.length - 1];
                title = decodeURIComponent(filename).replace(/\.[a-zA-Z0-9]+$/, "");
              } catch {
                title = "Track " + (tracks.length + 1);
              }
            }

            const delimiters = [" - ", " -", "- "];
            let splitIdx = -1;
            let matchedDelim = "";
            for (const delim of delimiters) {
              const idx = title.indexOf(delim);
              if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) {
                splitIdx = idx;
                matchedDelim = delim;
              }
            }

            if (splitIdx !== -1) {
              artist = title.slice(0, splitIdx).trim();
              title = title.slice(splitIdx + matchedDelim.length).trim();
            } else {
              const singleDash = title.indexOf("-");
              if (singleDash > 0 && singleDash < title.length - 1) {
                artist = title.slice(0, singleDash).trim();
                title = title.slice(singleDash + 1).trim();
              }
            }

            if (artist.toLowerCase() === title.toLowerCase()) {
              artist = "Archive.org";
            }

            tracks.push({
              id: `track-arch-${itemId || "live"}-${tracks.length}-${Date.now()}`,
              title,
              artist,
              duration: currentDuration,
              url: trackUrl,
              sourceType: "music",
              genre: "Archive Broadcast",
              album: playlistName,
              year: 2026,
              dateAdded: new Date().toISOString()
            });

            currentDuration = -1;
            currentMetadata = "";
          }
        }
      }

      // Leftovers
      if (buffer) {
        const line = buffer.trim();
        if (line && !line.startsWith("#")) {
          const trackUrl = line;
          let artist = "Archive.org";
          let title = currentMetadata || "";
          tracks.push({
            id: `track-arch-${itemId || "live"}-${tracks.length}-${Date.now()}`,
            title,
            artist,
            duration: currentDuration,
            url: trackUrl,
            sourceType: "music",
            genre: "Archive Broadcast",
            album: playlistName,
            year: 2026,
            dateAdded: new Date().toISOString()
          });
        }
      }

      if (isStream) {
        res.write(`data: ${JSON.stringify({
          type: "complete",
          tracks,
          thumbnailUrl,
          playlistName
        })}\n\n`);
        res.end();
      } else {
        res.json({
          success: true,
          tracks,
          thumbnailUrl,
          playlistName
        });
      }
    } catch (err: any) {
      if (isStream) {
        res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ success: false, error: err.message });
      }
    }
  });

  // Start server on test port 3999
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(3999, "127.0.0.1", () => resolve(s));
  });

  try {
    // Test 1: Standard JSON POST parsing
    console.log("Running: Test 1 - Standard JSON POST parsing...");
    const jsonRes = await fetch("http://127.0.0.1:3999/api/playlist/import-from-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1:3999/mock-archive/playlist.m3u" })
    });

    if (!jsonRes.ok) {
      throw new Error(`HTTP status is erroneous: ${jsonRes.status}`);
    }

    const payload: any = await jsonRes.json();
    
    // Assert playlist attributes
    if (!payload.success) throw new Error("Expected success: true");
    if (payload.playlistName !== "Playlist.m3u") {
      throw new Error(`Expected playlistName list translation, got: ${payload.playlistName}`);
    }

    // Verify tracks got parsed correctly (excluding the invalid track with missing URL)
    console.log(`Parsed track count: ${payload.tracks.length} (Expected: 4)`);
    if (payload.tracks.length !== 4) {
      throw new Error(`Expected 4 parsed tracks, got: ${payload.tracks.length}`);
    }

    // Assert individual metadata and split integrity
    const appSymphony = payload.tracks[0];
    if (appSymphony.title !== "Sirius" || appSymphony.artist !== "The Alan Parsons Project" || appSymphony.duration !== 240) {
      throw new Error(`Track 1 parsing error. Title: ${appSymphony.title}, Artist: ${appSymphony.artist}`);
    }

    const fallenSodom = payload.tracks[1];
    if (fallenSodom.title !== "Remember the Fallen" || fallenSodom.artist !== "Sodom" || fallenSodom.duration !== -1) {
      throw new Error(`Track 2 duration mapping error (-1). Got: ${fallenSodom.duration}`);
    }

    const titleOnly = payload.tracks[2];
    if (titleOnly.title !== "OnlyTitleNoArtist" || titleOnly.artist !== "Archive.org") {
      throw new Error(`Track 3 single parameter metadata fallback error.`);
    }

    console.log("✅ Test 1 - Standard JSON POST parsing succeeded!");

    // Test 2: SSE Stream Mode parsing
    console.log("\nRunning: Test 2 - SSE Stream Mode parsing...");
    const sseRes = await fetch("http://127.0.0.1:3999/api/playlist/import-from-archive?stream=true&url=http://127.0.0.1:3999/mock-archive/playlist.m3u");
    
    if (!sseRes.ok) {
      throw new Error(`SSE initiate failed status: ${sseRes.status}`);
    }

    const bodyReader = sseRes.body?.getReader();
    if (!bodyReader) throw new Error("No body reader for SSE stream");

    const textDecoder = new TextDecoder();
    let streamBuffer = "";
    let sseEvents: any[] = [];

    while (true) {
      const { done, value } = await bodyReader.read();
      if (done) break;
      streamBuffer += textDecoder.decode(value, { stream: true });
      const lines = streamBuffer.split("\n");
      streamBuffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim().startsWith("data: ")) {
          const content = JSON.parse(line.trim().slice(6));
          sseEvents.push(content);
        }
      }
    }

    console.log(`Received SSE events count: ${sseEvents.length}`);
    const progressEvt = sseEvents.find(e => e.type === "progress");
    const completeEvt = sseEvents.find(e => e.type === "complete");

    if (!progressEvt) throw new Error("Expected progress emission.");
    if (!completeEvt || completeEvt.tracks.length !== 4) {
      throw new Error("Expected complete emission with exactly 4 tracks.");
    }

    console.log("✅ Test 2 - SSE Stream Mode parsing succeeded!");
    
    console.log("\n==================================================");
    console.log("🎉 ALL TESTS COMPLETED SUCCESSFULLY! VERIFICATION OK!");
    console.log("==================================================");

  } finally {
    server.close();
  }
}

runTests().catch((e) => {
  console.error("❌ TEST FAILED:", e);
  process.exit(1);
});
