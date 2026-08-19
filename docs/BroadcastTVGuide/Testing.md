# Broadcast TV Guide: Testing Specification

## Overview
To maintain its protected core status and 10/10 audit score, any modifications to the `BroadcastTVGuide` codebase must pass an exhaustive automated CI test matrix.

---

## CI Verification Matrix

### 1. Unit & Data Model Tests (`Vitest`)
- Asserts exact `duration === endTime - startTime` derivation.
- Asserts `live === true` enforces `recordingAllowed === false`.
- Verifies DOMPurify stripping of XSS payloads from raw synopsis strings.
- Asserts schema migration adapters cleanly transform `v1` $\rightarrow$ `v3` contracts.

---

### 2. Virtualization & Stress Benchmarks
- **10,000 Channel Matrix Simulation**: Mounts 10,000 synthetic channels across 7 days. Asserts initial render completes in $< 150\text{ms}$.
- **Rapid Scroll Simulation**: Simulates continuous 100px/frame vertical scrolling for 60 seconds. Asserts zero mounted DOM node leaks and $\ge 58$ FPS average.

---

### 3. Endurance & Memory Leak Verification
- **48-Hour Simulated Playout**: Automated headless Puppeteer test running continuous background sync cycles and viewport shifts for 48 hours.
- **Heap Growth Invariant**: Asserts total JS heap growth $\le 2\text{MB}$ over 48 hours.

---

### 4. Accessibility & Screen Reader Compliance (`axe-core`)
- 100% pass rate on WCAG 2.1 AA color contrast ratios for channel call signs and genre tags.
- Asserts appropriate ARIA grid roles (`role="grid"`, `role="row"`, `role="gridcell"`) across virtualIZED elements.
