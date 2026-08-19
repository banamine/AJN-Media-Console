# Broadcast TV Guide: Security Specification

## Overview
Because Electronic Program Guide (EPG) metadata is frequently ingested from untrusted third-party IPTV syndication feeds and community XMLTV origins, strict input sanitization and XSS prevention guardrails are enforced.

---

## Core Security Mandates

### 1. Mandatory HTML Description Sanitization
Upstream XMLTV descriptions frequently embed unescaped HTML tags, hyperlinks, or malicious script payloads.
- **Rule**: All `description` fields MUST pass through `DOMPurify.sanitize()` configured with a strict whitelist before mounting into React DOM.
- **Forbidden Tags**: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<style>`, `<form>`.
- **Forbidden Attributes**: `onload`, `onerror`, `onclick`, `onmouseover`, `javascript:...` URIs.

```typescript
import DOMPurify from "dompurify";

export function sanitizeProgramSynopsis(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "li"],
    ALLOWED_ATTR: []
  });
}
```

---

### 2. Content Security Policy (CSP) Compatibility
The guide subsystem MUST operate flawlessly under enterprise CSP headers:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;
```

- **No Eval**: `eval()` and `new Function(...)` are strictly prohibited across all worker and parser code.
- **Inline Styles**: Permitted strictly for dynamic virtual grid translate3d positioning.

---

### 3. Provider Endpoint Validation
All upstream `streamUrl` and `logo` URIs must undergo protocol validation:
- Permitted Schemes: `https://`, `http://`, `wss://`, `data:image/...`
- Prohibited Schemes: `file://`, `ftp://`, `gopher://`, `vbscript:...`
