# Rumble Embed Engine Integration Critique & Mitigation Report

This document reviews the architectural design, risks, and mitigations of integrating external video streams (such as Rumble.com) into the AJN Broadcast Automation Suite.

## 1. Backend Coupling Risks & Mitigations

**Risks:**
- High dependency on external, third-party backend servers or proxies can lead to complete EPG failure if they crash, experience downtime, or encounter rate limits.
- If the Express proxy or a Python microservice becomes unresponsive, any blocking calls in the frontend during mount/boot could crash or freeze the client application.

**Mitigations (Graceful Degradation):**
- **Offline / Warm Fallbacks:** On-startup caching is utilized (preloaded with seeds in `rumble_cache.json`). The proxy endpoints immediately return cached, static fallbacks if the live Rumble API is unavailable.
- **Asynchronous, Non-Blocking Design:** All network requests in the frontend are asynchronous with strict timeouts (10 seconds) and fallback data handlers.
- **Client-Side Survival:** If the backend proxy is entirely down, the frontend automatically falls back to calculating default/mock metadata and loading iframe templates directly, ensuring that the app is always functional.

---

## 2. Persistence Risks & Schema Versioning Strategy

**Risks:**
- Cleared browser caches can wipe custom channels.
- Schema changes in future app updates could lead to deserialization errors (e.g., if a channel's attributes change, causing standard JSON parsers to throw exceptions or components to receive `undefined` values).

**Mitigations:**
- **Schema-Versioned Local Storage Key:** We use the versioned storage key `ajn_rumble_favorites_v2`.
- **Validation on Load:** On load, the schema checks for a top-level `version: 2` flag. If missing or invalid, the data is migrated safely or re-initialized with the pre-seeded defaults, avoiding system-wide crashes.

---

## 3. Live/VOD Detection Improvements

**Risks:**
- Upstream Rumble OEmbed responses do not always explicitly declare an active live stream flag, or they may only contain temporary live embed structures in the raw HTML response.
- Relying solely on `duration == 0` or standard title strings leads to false negatives.

**Mitigations:**
- **Regex & Class Parsing:** The system scans the raw HTML template returned by Rumble OEmbed for signatures like `data-live="true"`, `"live"`, or references to live playback controls.
- **State-Observer Pattern:** Implement a background observer on the active player that pings the proxy endpoint every 60 seconds. This ensures that when a stream transitions from offline/VOD to live, the URL parameters (e.g., swapping `/embed/` and `/embed/live/`) update dynamically and trigger seamless re-renders without full-page reloads.

---

## 4. Cloudflare Challenge Handling Plan

**Risks:**
- Rumble utilizes Cloudflare or other CDN protection layers which might block, challenge (JS/CAPTCHA), or rate-limit direct client requests.
- Directly querying Rumble APIs from the browser often fails due to CORS or Cloudflare browser signature verification checks.

**Mitigations:**
- **Server-Side Proxy Ingress:** The client browser never requests Rumble's APIs directly. Instead, all requests are routed through our trusted Express backend `/api/rumble/oembed`.
- **User-Agent Spoofing & Fetch Resiliency:** The Express proxy wraps requests with standard desktop browser `User-Agent` headers and handles abort signals. If challenged or blocked, the proxy gracefully serves cache-hit or default items instead of throwing a fatal error.
