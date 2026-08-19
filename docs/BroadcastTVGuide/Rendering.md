# Broadcast TV Guide: Rendering Architecture

## Overview
To render 5,100+ channels and 7 days of electronic program guide (EPG) events smoothly without stuttering or DOM memory ballooning, the `BroadcastTVGuide` implements a dual-axis windowed virtualization renderer coupled with hardware GPU layer compositing.

---

## Dual-Axis Virtualization Engine

### 1. Vertical Channel Windowing
Instead of mounting 5,100 DOM rows, the engine calculates the viewport height and mounts ONLY the visible rows plus a fixed overscan buffer.

- **Row Height**: Fixed at `64px` (or dynamic based on operator layout density).
- **Overscan Buffer**: Exactly `5` rows above and below the visible viewport boundary.
- **Recycling Pool**: DOM nodes are retained in a fixed-size node pool. When a row scrolls out of view, its container DOM node is re-assigned to the incoming channel data rather than unmounted.

---

### 2. Horizontal Timeline Slicing
Each channel row spans 168 hours (7 days) of linear time. Rendering thousands of program div blocks horizontally per row causes extreme browser layout thrashing.

- **Time Resolution Slicing**: The horizontal axis is partitioned into fixed column widths governed by `zoomResolutionMinutes` (e.g., `15m = 60px`).
- **Visible Time Range**: Only programs overlapping (`viewport.startDate` $\leftrightarrow$ `viewport.endDate`) ± `2 hours` overscan buffer are rendered.
- **Absolute Positioning**: Program blocks are positioned via CSS `position: absolute` with left offset calculated as:
  $$\text{left} = \frac{\text{program.startTime} - \text{dayStartMs}}{\text{msPerPixel}}$$

---

## Hardware Acceleration & Reflow Prevention

### GPU Composing Rules
To maintain 60 FPS scrolling on legacy or embedded broadcast hardware:
1. **Translate3d Positioning**: All virtual grid rows use `transform: translate3d(0, yOffset, 0)` instead of `top: yOffset`. This elevates rows onto dedicated GPU compositing layers.
2. **Will-Change Guardrails**: The container applies `will-change: transform` only during active scroll events, removing it 150ms after scroll cessation to conserve GPU VRAM.
3. **Passive Observers**: All `wheel` and `touchmove` listeners are registered with `{ passive: true }` to eliminate input latency.

---

## DOM Recycling Flowchart

```
[Scroll Event Triggered]
          │
          ▼
[Calculate New StartIndex & EndIndex]
          │
          ▼
[Identify Out-of-Bounds DOM Nodes]
          │
          ▼
[Detach & Recycle Nodes into Pool]
          │
          ▼
[Hydrate Recycled Nodes with Incoming Row Data]
          │
          ▼
[Apply GPU translate3d Offsets]
```
