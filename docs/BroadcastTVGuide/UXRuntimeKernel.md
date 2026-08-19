# AJN Liberty Play — UX Runtime Kernel & Guardrail Architecture Specification (v12.5)

## Executive Summary
To enforce **Level 4 Certified Broadcast UX System** maturity, user experience guarantees cannot remain static pre-runtime assertions or CI test guardrails. They must operate as an active, self-healing **UX Runtime Kernel**. Sitting directly between UI rendering, finite state navigation routers, and broadcast playout engines, the kernel guarantees that no invalid, blank, or deadlocked interface state can ever be presented to the viewer.

---

## 1. System Topology & Architectural Layers

```
┌────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION LAYER                     │
│  Clicks • Navigation • Playback Control • Touch • Keyboard        │
└───────────────┬────────────────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    UX RUNTIME KERNEL (CORE LAYER)                 │
│                                                                    │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  1. Navigation Router (XState Machine)                     │   │
│   │     - Home / Guide / Player / Library / Settings          │   │
│   │     - Deterministic transitions                           │   │
│   └───────────────┬────────────────────────────────────────────┘   │
│                   │                                                │
│                   ▼                                                │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  2. UX Guardrail Layer                                     │   │
│   │     - Prevent blank screen                                 │   │
│   │     - Enforce Guide availability                           │   │
│   │     - Enforce Resume flow                                 │   │
│   │     - Enforce Theatre Mode persistence                     │   │
│   └───────────────┬────────────────────────────────────────────┘   │
│                   │                                                │
│                   ▼                                                │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  3. Session Intelligence Engine                            │   │
│   │     - ajn_last_session recovery                            │   │
│   │     - Resume / Restart decisions                           │   │
│   │     - Cross-tab sync                                      │   │
│   └───────────────┬────────────────────────────────────────────┘   │
│                   │                                                │
│                   ▼                                                │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  4. Broadcast Abstraction Layer                            │   │
│   │     - Scheduler Engine                                     │   │
│   │     - Provider Normalization                               │   │
│   │     - Guide Auto-Build                                     │   │
│   └───────────────┬────────────────────────────────────────────┘   │
│                   │                                                │
│                   ▼                                                │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  5. Playback Runtime Core                                  │   │
│   │     - HLS / Media Engine                                   │   │
│   │     - Buffer Control                                       │   │
│   │     - Error Recovery                                       │   │
│   └───────────────┬────────────────────────────────────────────┘   │
│                   │                                                │
│                   ▼                                                │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  6. UX State Persistence Layer                             │   │
│   │     - localStorage / IndexedDB                             │   │
│   │     - Mode persistence (Theatre / Layout / Startup)        │   │
│   └────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
                ▲
                │
┌────────────────────────────────────────────────────────────────────┐
│                     UX RUNTIME GUARDRAIL LOOP                     │
│                                                                    │
│   Continuous Verification Cycle:                                  │
│   - assert(noBlankScreenOnBoot)                                   │
│   - assert(resumeFlowExists)                                      │
│   - assert(guideAccessible)                                       │
│   - assert(theatreModePersistent)                                 │
│   - assert(oneClickLiveReturn)                                    │
│                                                                    │
│   Failure → Auto-Heal → Route Correction → Safe UX Surface         │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Runtime Control Layers (Logical Stack)

* **Layer A — Input Abstraction**: Clicks, touch gestures, and keyboard shortcuts feed into the routing kernel.
* **Layer B — Navigation Kernel (XState)**: Deterministic routing, illegal state prevention, and view transition guards.
* **Layer C — UX Guardrail Engine**: Invariant runtime enforcement, fallback routing, and safety overrides.
* **Layer D — Session Intelligence Engine**: Active session rehydration (`ajn_last_session`), resume modals, and cross-tab reconciliation.
* **Layer E — Broadcast System**: Weighted hybrid scheduling engine, program queue generation, and provider normalization.
* **Layer F — Playback Runtime Core**: HLS media execution, buffer management, adaptive bitrate controls, and stall handling.
* **Layer G — State Persistence Layer**: `localStorage`, `sessionStorage`, and `IndexedDB` schemas preserving operator layout choices.

---

## 3. Formal UX Guarantee Invariants

The kernel enforces the following non-negotiable invariants continuously:

1. **$I_1$ — No Blank State**: $\forall \text{ boot } \rightarrow \text{UI\_state} \neq \text{EMPTY}$. If channel ingestion fails or network feeds timeout, built-in fallback syndication channels are auto-injected.
2. **$I_2$ — Guide Accessibility**: $\forall \text{ state } \rightarrow \text{Guide reachable in } \le 1 \text{ transition}$. The primary global rail remains locked across all viewport tiers.
3. **$I_3$ — Resume Determinism**: If active session exists $\rightarrow \text{Resume\_UI} \in \{\text{modal}, \text{auto-resume}\}$. Active viewing states cannot be silently wiped during window reloads.
4. **$I_4$ — Theatre Persistence**: If $\text{theatre\_mode} = \text{true} \rightarrow \text{UI\_mode persists across reload } \forall \text{ time}$. Playout viewport scaling overrides standard default layout templates.
5. **$I_5$ — Safe Failure Mapping**: $\text{error\_state} \rightarrow \text{Guide OR Home}$. Unhandled runtime exceptions or media playback crashes trigger immediate stage detachment and safe route redirection rather than white screens of death.

---

## 4. Failure Resolution & Self-Healing Pipeline

```
[ Unhandled Media/Ingest Exception ]
                 │
                 ▼
     [ UX Guardrail Intercept ]
                 │
                 ▼
     [ Classify Failure Type ]
   ├── Route / Navigation Invalid
   ├── Session Storage Corrupt
   ├── Media Decoder Crash
   └── M3U Feed Exhausted / Empty
                 │
                 ▼
     [ Map to Safe UX Surface ]
   ├── Auto-Inject Demo Channels
   ├── Force Jump to Guide EPG
   └── Present Recovery Prompt
                 │
                 ▼
     [ Rehydrate Kernel Context ]
                 │
                 ▼
     [ Resume Continuous Playout ]
```

---

## 5. Certification & System Maturity Declaration

With the activation of runtime self-healing guardrails, AJN Liberty Play reaches **Level 4 Certified Broadcast UX System** status. The interface contract guarantees zero developer friction, 1-click stage access, and television-grade reliability across desktop, mobile, and broadcast playout environments.
