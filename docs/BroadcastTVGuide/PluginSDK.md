# Broadcast TV Guide: Plugin SDK Specification

## Overview
The `GuidePlugin` SDK provides a structured, sandboxed lifecycle contract allowing external automation plugins, custom AI syndication annotators, and master control overlays to extend EPG capabilities.

---

## Authoritative Interface: `GuidePlugin`

```typescript
import { BroadcastTVGuideAPI } from "./API";
import { GuideViewport, GuideProgram, GuideChannel, GuideDay } from "./guideSpecification";

export interface GuidePlugin {
  /** Unique plugin bundle namespace identifier */
  readonly id: string;
  /** Human-readable display label */
  readonly name: string;
  /** Semantic version string */
  readonly version: string;

  /**
   * Called upon plugin mounting into the Master Control Host.
   * @param api Authoritative handle to manipulate EPG state.
   */
  initialize(api: BroadcastTVGuideAPI): void | Promise<void>;

  /**
   * Triggered immediately upon successful EPG grid hydration.
   */
  onGuideLoaded(summary: { channels: number; programs: number }): void;

  /**
   * Triggered whenever virtualized grid scrolling crosses window thresholds.
   */
  onViewportChanged(viewport: GuideViewport): void;

  /**
   * Intercepts operator click interaction on any program block.
   * @return Return `true` to cancel default Master Playout trigger.
   */
  onProgramClicked(program: GuideProgram, channel: GuideChannel): boolean | void;

  /**
   * Triggered when real-time upstream schedules mutate.
   */
  onScheduleUpdated(day: GuideDay): void;

  /**
   * Invoked during system shutdown to unhook unmanaged memory references.
   */
  destroy(): void;
}
```

---

## Plugin Sandboxing Rules

1. **DOM Isolation**: Plugins are strictly forbidden from direct `document.querySelector` manipulation of virtual grid DOM elements. All UI injections must occur via registered overlay slots.
2. **Network Quotas**: Plugins execute network requests through the host proxy relay to adhere to rate limits and CSP mandates.
3. **Graceful Degradation**: If a plugin hook throws an unhandled exception during `onProgramClicked` or `onViewportChanged`, the host catches the error, dispatches a `GuideErrorEvent`, and automatically detaches the faulty plugin.
