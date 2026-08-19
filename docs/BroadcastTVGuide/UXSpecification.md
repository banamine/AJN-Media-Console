# Broadcast TV Guide: Master User Experience (UX), Onboarding & Discoverability Specification (v12.0)

## Executive Summary
While the underlying engineering architecture, universal source normalization, and virtual playout scheduler achieve 10/10 empirical audit scores, enterprise power must remain effortless. This specification establishes the **Master UX Architecture Layer**, elevating Discoverability, First-Run Ergonomics, and Cross-Device Layout Parity to matching 10/10 standards.

A new operator or casual viewer launching AJN Liberty Play must never encounter a blank workspace or complex broadcast jargon. Instead, they experience instant session restoration, visible one-click Theatre Mode controls, zero-config Demo Channels, and persistent navigation guardrails across all device tiers.

---

## 1. First-Run Onboarding & Zero-Config Demo Channels
New users are guided by `FirstRunExperienceManifest`. Upon initial launch, the user is presented with a welcoming, scannable setup dialog offering instant access to **Built-in Demo Channels**:

```
────────────────────────────────────────────────────────────
AJN Liberty Play — Universal Stream Hub

Welcome! How would you like to start?

 📺 Demo Channels (Zero Configuration)
    Explore 24/7 synthesized news, movies, and sci-fi channels immediately.

 📁 Load External M3U / XMLTV Playlist
    Import your existing IPTV or syndication broadcast feeds.

 🎬 Connect Archive.org / YouTube / Rumble Library
    Synthesize continuous virtual linear channels from VOD collections.
────────────────────────────────────────────────────────────
```

### Invariants
1. **Never a Blank Screen**: If no user session or playlist is discovered, the app automatically hydrates `availableDemoPools` (`DemoChannelDescriptor`), mounting a fully functional 24/7 linear grid matrix immediately.
2. **Auto-Build on Import**: When an external source is selected, normalization and schedule synthesis execute automatically in background workers (`autoBuildGuideOnImport === true`), requiring zero manual reload triggers.

---

## 2. First-Class Discoverable Navigation
The EPG guide and primary media controls must never be buried inside secondary drawer menus. Every template layout (Classic, Modern, Broadcast, OBS, Compact) strictly enforces persistent exposure of `PrimaryNavigationAction` items:

- **`NAV_HOME_DASHBOARD`**: Central overview of resume cards and quick launchers.
- **`NAV_LIVE_GUIDE`**: Direct 1-click entry into the 2D windowed EPG grid.
- **`NAV_MASTER_PLAYER`**: Instant playout stage focus.
- **`NAV_MEDIA_LIBRARY`**: Heterogeneous VOD collection manager.
- **`NAV_FAVORITES`**: Filtered rails of starred station slots.
- **`NAV_SEARCH`**: Sub-200ms hybrid Trie search index.
- **`NAV_SETTINGS`**: Operator preferences and source adapter credentials.

---

## 3. Visible One-Click Theatre Mode & Session Persistence
Hiding viewport expansion inside right-click context menus is prohibited. The master playout stage guarantees visible, single-click toggle controls governed by `TheatreModePersistedState`:

```
[ 📺 Live Guide ]  [ ▶ Player ]  [ 🖵 Theatre Mode ]  [ ⛶ Fullscreen ]
```

- **Surgical State Recall**: If an operator selects Theatre Mode or Compact Mode, the preference persists across browser restarts via IndexedDB. Subsequent app launches boot directly into the preferred viewport geometry.
- **Default Launch Destination**: Users configure their preferred startup view (`NAV_LIVE_GUIDE`, `NAV_MASTER_PLAYER`, or `NAV_HOME_DASHBOARD`), allowing dedicated automation monitors to boot straight into the EPG matrix.

---

## 4. Authoritative Resume Watching Recovery
Modeled after modern premier streaming platforms, `ResumeWatchingRecord` tracks exact millisecond playout coordinates:

```typescript
export interface ResumeWatchingRecord {
  channelId: string;
  programId: string;
  programTitle: string;
  playbackPositionMs: number;
  totalDurationMs: number;
  lastWatchedAt: string; // ISO 8601 UTC
}
```
- **Instant Resume Card**: Mounted prominently on the Home Dashboard (`▶ Resume Last Channel: Liberty Cinema — 01:14:22 remaining`). Clicking immediately restores the video stream and syncs the EPG scroll position.

---

## 5. Responsive Device Breakpoint Tiers (`DeviceLayoutTier`)
Rather than compressing intricate desktop tables onto mobile viewports, adaptive layout containers dynamically restitch UI density:

| Breakpoint Tier | Layout Topology & Navigation Ergonomics |
| :--- | :--- |
| **Desktop** (`xl` / `2xl`) | Side-by-side Master Playout Stage + 7-Day Virtual Grid + Telemetry Rails + Real-Time Clock. |
| **Laptop** (`lg`) | Top Video Stage with expandable bottom 2D Grid matrix. |
| **Tablet** (`md`) | Stacked Video Player with vertical channel selector drawer. |
| **Phone** (`sm`) | Single-screen Touch Guide $\rightarrow$ Tap $\rightarrow$ Fullscreen Mobile Playout Stage with 1-tap `Return to Live` button. |

---

## 6. UX Quality Assessment Matrix

| UX Domain | Empirical Objective & SLO Guardrails | Target Score |
| :--- | :--- | :---: |
| **Ease of Use for New Users** | 1-click startup via zero-config Demo Channels. | **10 / 10** |
| **Navigation Discoverability**| First-class persistent action bar across all themes. | **10 / 10** |
| **First-Run Experience** | Guided onboarding wizard without jargon. | **10 / 10** |
| **Cross-Device UX Parity** | Dedicated touch targets ($\ge 44\text{px}$) & adaptive density. | **10 / 10** |
| **One-Click "Go to Live"** | Dedicated visible `NOW / Return to Live` button. | **100% Compliant** |
| **Theatre Mode Exposure** | Dedicated visible header toggle button. | **100% Compliant** |
