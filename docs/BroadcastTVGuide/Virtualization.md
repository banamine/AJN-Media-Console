# Broadcast TV Guide: Virtualization & Recycling

## Overview
Windowed virtualization is mandatory for meeting the 60 FPS scroll SLO. This document outlines the spatial calculation math and DOM recycling rules.

---

## Grid Coordinate Mathematics

### 1. Time-to-Pixel Conversion Math
Given a zoom resolution scale $R$ (minutes per column division) and standard division width $W$ (default `60px`):

$$\text{PixelsPerMinute} = \frac{W}{R}$$

For any program with UTC timestamp $T_{\text{start}}$ relative to grid midnight $T_{\text{midnight}}$:

$$\text{LeftOffset (px)} = \left(\frac{T_{\text{start}} - T_{\text{midnight}}}{60000}\right) \times \text{PixelsPerMinute}$$

$$\text{Width (px)} = \left(\frac{\text{DurationMs}}{60000}\right) \times \text{PixelsPerMinute}$$

---

### 2. Visible Row Range Calculation
Given container vertical scroll top $S_y$ and viewport visible height $H_{\text{view}}$ with fixed row height $H_{\text{row}} = 64$:

$$\text{StartIndex} = \max\left(0, \left\lfloor \frac{S_y}{H_{\text{row}}} \right\rfloor - \text{Overscan}_v\right)$$

$$\text{EndIndex} = \min\left(\text{TotalChannels} - 1, \left\lceil \frac{S_y + H_{\text{view}}}{H_{\text{row}}} \right\rceil + \text{Overscan}_v\right)$$

Where $\text{Overscan}_v = 5$.

---

## Memory Bounds & Garbage Collection Protection

### Strict Invariants
1. **Zero InnerHTML Allocation**: Virtual rows MUST NEVER be hydrated using `elem.innerHTML = ...`. All DOM hydration must manipulate existing `textContent`, `setAttribute`, or stabilized React component trees.
2. **Anonymous Function Prohibition**: Inline anonymous arrow functions inside rendered virtual row items (`onClick={() => ...}`) are prohibited to prevent closures from pinning detached DOM nodes in heap memory. Handlers must use event delegation on the master grid grid container.
3. **ResizeObserver Debouncing**: Grid container dimensions updates must be debounced by `16ms` (1 frame) via `requestAnimationFrame`.
