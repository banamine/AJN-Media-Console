# Broadcast TV Guide: Performance SLOs

## Overview
Master Control automation operators require zero-lag responsiveness when preempting streams or auditing playout schedules. This document establishes the strict Service Level Objectives (SLOs) for guide execution.

---

## Empirical Performance Objectives

| Metric | Target SLO | Warning Threshold | Critical Failure |
| :--- | :---: | :---: | :---: |
| **Grid Cold Boot (IDB Hydrated)** | $< 180\text{ms}$ | $> 300\text{ms}$ | $> 1000\text{ms}$ |
| **Viewport Scroll FPS** | $60\text{ FPS}$ | $< 50\text{ FPS}$ | $< 30\text{ FPS}$ |
| **Search Query Latency (5,000 items)** | $< 45\text{ms}$ | $> 120\text{ms}$ | $> 200\text{ms}$ |
| **Upstream XMLTV Worker Parse** | $< 400\text{ms}$ | $> 800\text{ms}$ | $> 2500\text{ms}$ |
| **Main Thread Long Tasks** | $0$ tasks $> 50\text{ms}$ | $\ge 1$ task $> 50\text{ms}$ | $\ge 5$ tasks $> 100\text{ms}$ |
| **Garbage Collection Pauses** | $< 8\text{ms}$ | $> 16\text{ms}$ | $> 33\text{ms}$ |

---

## Hardware Profiling Benchmarks

### 1. Low-End Embedded Hardware (ARM Cortex-A53 / 2GB RAM)
- **Max Virtual Rows Mounted**: 18 rows.
- **Worker Concurrency**: Single background worker thread.
- **Overscan Buffering**: ±1 hour horizontal buffer.

### 2. High-End Master Control Workstation (Xeon / 32GB RAM / 4K Display)
- **Max Virtual Rows Mounted**: 65 rows.
- **Worker Concurrency**: 4 parallel worker threads.
- **Overscan Buffering**: ±4 hour horizontal buffer.
