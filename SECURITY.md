# Enterprise Security Hardening Specification

This document details the rigorous security guardrails, DOM sanitization protocols, Cross-Site Scripting (XSS) defenses, Content Security Policy (CSP) enforcements, and regex safety rules.

---

## 1. DOM Hardening & Sanitization (DOMPurify Standard)

Streaming IPTV playlists and EPG XML feeds originate from untrusted third-party servers. Raw string injections pose critical XSS risks.

### Mandatory Sanitization Mandate
* **EPG Program Descriptions**: Electronic Program Guide summary strings rendered in `CinephileSuite` and `SyndicateSuite` must undergo DOM sanitization.
* **Playlist Track Names & Notes**: Custom user comments or imported `#EXTINF` track titles rendered in `TrackList` must be escaped or sanitized.
* **Enforcement Pattern**: React's native JSX text interpolation (`<div>{track.title}</div>`) automatically encodes HTML entities. Where rich text rendering is explicitly required, `DOMPurify.sanitize()` MUST be invoked prior to setting `dangerouslySetInnerHTML`.

---

## 2. Content Security Policy (CSP) & XSS Mitigation

The HTTP server (`server.ts`) and browser document (`index.html`) enforce strict Content Security Policy headers designed to neutralize rogue script execution:

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: http: https:;
  media-src 'self' blob: http: https:;
  connect-src 'self' blob: http: https: ws: wss:;
  frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;
  object-src 'none';
  base-uri 'self';
```

### Architectural Header Highlights
* **`object-src 'none'`**: Completely blocks legacy Flash/Java applet execution.
* **`media-src http: https: blob:`**: Allows adaptive HLS streaming from arbitrary external CDNs and local MSE blob workers.
* **`frame-src youtube-nocookie.com`**: Restricts embedded iFrame player containers exclusively to verified YouTube origins.

---

## 3. Sandboxed iFrame Isolation Boundaries

When rendering third-party video content inside `YouTubeEmbed.tsx`, host DOM access is completely severed via HTML5 sandbox attributes:

```html
<iframe
  src="https://www.youtube-nocookie.com/embed/..."
  sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  referrerpolicy="no-referrer"
/>
```

* **No Top-Level Navigation**: Sandboxed containers cannot redirect the parent AI Studio window (`allow-top-navigation` is strictly omitted).
* **Referrer Privacy**: `referrerpolicy="no-referrer"` prevents leaking sensitive internal application URL parameters to external video providers.

---

## 4. Dangerous API Guardrails

| Browser API Surface | Attack Vector | Engineering Mitigation & Guardrail |
| :--- | :--- | :--- |
| **Clipboard API** (`navigator.clipboard`) | Silent background read of user passwords. | Write-only access enforced. Reads strictly require explicit user click gestures. |
| **Drag & Drop API** | Path traversal or malware file execution. | Dropzone event handlers inspect `event.dataTransfer.files`. Strict MIME type validation (`audio/*`, `video/*`, `.m3u`, `.pls`). |
| **File Upload I/O** | Denial of Service (DoS) via multi-gigabyte upload.| File size capped at 50 MB per playlist import. Lexer parses streams asynchronously. |

---

## 5. Regex Safety & Catastrophic Backtracking Defense

Malformed M3U playlists containing nested quotes or unclosed brackets can trigger **Catastrophic Backtracking** in poorly written regular expressions, freezing the browser main thread.

### Engineering Enforcement
* **No Nested Quantifiers**: Regular expressions in `/src/utils/playlistUtils.ts` strictly prohibit unbounded nested quantifiers (e.g., `/(a+)+/`).
* **Linear Tokenizers**: Complex playlist string parsing prefers deterministic character-by-character loop iteration (`indexOf`, `slice`) over multi-line regex matching.

---

## 6. Secrets Handling & Environment Validation

* **Server-Only Encapsulation**: The `GEMINI_API_KEY` credential is stored strictly within server runtime environment variables (`process.env.GEMINI_API_KEY`). It is **NEVER** prefixed with `VITE_` and is completely stripped from frontend bundles.
* **Schema Enforcement**: `.env.example` documents all required keys without hardcoding confidential tokens.
