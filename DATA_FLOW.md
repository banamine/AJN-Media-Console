# End-to-End Data Pipeline & Ingestion Flow Specification

This specification maps the lifecycle of streaming data from raw text files and remote network sockets through parser tokenizers, reverse proxy relays, and storage vaults.

---

## 1. End-to-End Media Ingestion & Playback Pipeline

```
[Raw Stream URL / Playlist File]
               │
               ▼
   [Scheme & Provider Detection] ──► Is YouTube? ──► [YouTubeEmbed iFrame]
               │
      (HTTP / HTTPS / M3U8 / PLS)
               │
               ▼
      [CORS & Header Validation]
               │
    ┌──────────┴──────────┐
(CORS Safe)          (CORS Blocked / HTTPS Mixed Content)
    │                     │
    │                     ▼
    │           [Express Reverse Proxy (/api/proxy)]
    │                     │ (Relays binary chunks via pipe())
    └──────────┬──────────┘
               │
               ▼
     [Codec & Container Demuxer]
               │
    ┌──────────┼──────────┐
(M3U8 HLS) (MP4/DASH) (Icecast/MP3 Audio)
    │          │          │
    ▼          ▼          ▼
[HLS.js]  [HTMLVideo] [HTMLAudio / Web Audio DSP]
    │          │          │
    └──────────┼──────────┘
               │
               ▼
   [Hardware Presentation Canvas]
```

---

## 2. Playlist Lexer & Abstract Syntax Tree (AST) Ingestion

When a user drags-and-drops an `.m3u`, `.m3u8`, or `.pls` file into `BatchImportWidget` or `ArchiveImportWidget`, the file undergoes linear non-blocking processing:

```
[File Blob Upload]
       │
       ▼ (FileReader API Read as UTF-8)
[Encoding Normalization] (Strips BOM, CRLF -> LF)
       │
       ▼
[Token Lexer Engine] (/src/utils/playlistUtils.ts)
       ├── Identifies File Header (#EXTM3U vs [playlist])
       ├── Tokenizes Line-by-Line (Linear time O(n))
       └── Extracts Metadata Tags (#EXTINF, tvg-id, tvg-logo, group-title)
       │
       ▼
[AST Construction] (Array of Normalized Track Objects)
       │
       ▼
[Deduplication & Validation Gate] (Filters broken URIs & duplicate hashes)
       │
       ▼
[IndexedDB Atomic Transaction] (/src/services/PlaylistVault.ts)
```

### PLS & M3U Parsing Grammar Integrity
* **M3U/M3U8**: Correctly parses duration attributes, title strings following commas, and extended TVG attributes (`tvg-name="HBO"`, `tvg-logo="https://..."`).
* **PLS**: Correctly parses INI-style `[playlist]` headers, correlating `File1=...`, `Title1=...`, and `Length1=...` indices regardless of line permutation order.

---

## 3. Reverse Proxy Stream Relay Mechanics

The server entry point (`server.ts`) implements an Express streaming proxy designed to prevent memory ballooning during continuous streaming:

```ts
// Conceptual Stream Relay Pipeline
app.get("/api/proxy", async (req, res) => {
  const targetUrl = decodeURIComponent(req.query.url as string);
  
  // 1. Initiate upstream network socket
  const upstreamResponse = await fetch(targetUrl, {
    headers: { "User-Agent": "Mozilla/5.0...", "Referer": new URL(targetUrl).origin }
  });
  
  // 2. Mirror upstream content-type and status
  res.status(upstreamResponse.status);
  res.setHeader("Content-Type", upstreamResponse.headers.get("Content-Type") || "application/octet-stream");
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  // 3. Zero-copy stream piping (Prevents RAM heap accumulation)
  Readable.fromWeb(upstreamResponse.body).pipe(res);
});
```

---

## 4. Export Serialization Round-Trip Integrity

The export system (`exportUtils.ts`) guarantees **100% bit-level round-trip integrity**. A playlist imported into the vault and immediately exported retains all original channel IDs, logo paths, and stream parameters.

### Checksum & Validation Gate
Before initiating a browser download prompt, exported bundles undergo automated structural checks:
* **JSON Backup**: Validates schema compliance against `/src/types.ts`.
* **M3U Export**: Verifies `#EXTM3U` header presence and exact line-break pairing.
* **TV Explorer Export**: Formats channel lists compatible with Retro TV grid layout visualizers.
