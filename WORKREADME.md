# WORKREADME.md
## AJN Professional Player – AI Build Team Work Specification

### Purpose
This document is the authoritative engineering entry point for all AI development sessions.

## Project Status
- Platform: Broadcast Automation Platform
- Architecture: Unified IPTV + Archive
- Playback: Unified Media Engine
- TV Guide: BroadcastTVGuide
- Scheduler: Gemini AI Auto Scheduler
- Dashboard: Broadcast Operations Suite
- Plugin System: Enabled

## Repository Layout
```
src/
  components/
  features/
    tvguide/
    scheduler/
    dashboard/
    archive/
    iptv/
  hooks/
  providers/
  plugins/
  layouts/
  diagnostics/
  audio/
  config/
docs/
server/
public/
```

## AI Build Workflow
1. Audit repository.
2. Review docs/ architecture.
3. Identify affected modules.
4. Reuse existing components.
5. Implement changes.
6. Update documentation.
7. Run build, lint, tests.
8. Verify runtime.
9. Produce completion report.

## Protected Core Components
- UnifiedPlaybackEngine
- BroadcastTVGuide
- PlayerStore
- StatusIndicatorBar
- ChannelManager
- SchedulerEngine
- PluginHost
- ArchiveProvider
- IPTVProvider
- DiagnosticsHUD

## Engineering Rules
- Preserve backwards compatibility.
- Do not rewrite stable systems.
- TypeScript strict mode.
- No unsafe `any`.
- Clean up timers, observers, listeners, AbortControllers.
- Keep Lite Mode functional.
- Maintain cross-browser compatibility.
- Update documentation with every feature.

## Completed Features
- Unified Media Browser
- IPTV Provider
- Archive Provider
- Broadcast Dashboard
- Broadcast TV Guide
- Channel Manager
- AI Scheduler
- Diagnostics HUD
- Status Indicator Bar
- Thumbnail Fallback
- Plugin Framework
- Unified Search
- Enterprise Broadcast TV Guide Specification (v10.0)
- Master Build Protocol Specification & Resilience Architecture (v2.0)

## Authoritative Specification: Master Build Protocol (v2.0)
The [`MASTER_BUILD_PROTOCOL_v2.md`](./MASTER_BUILD_PROTOCOL_v2.md) specification defines the authoritative engineering guardrails and resilience invariants across 5 critical phases: Core Engine & Resilience, Registry & Asset Integrity, PlaceCard UI, Playback Logic & Cleanup, and Performance & Disaster Recovery.

## Authoritative Specification: BroadcastTVGuide (10/10 Enterprise Grade)

### Overview & Audit Invariants
The `BroadcastTVGuide` module operates as a protected core component within the Universal Stream Hub. It implements a 10/10 enterprise specification supporting 5,100+ channels and 7 days of electronic program guide (EPG) windowed virtualization with sub-200ms search indexing and zero memory leaks.

To maintain modular scalability and developer ergonomics, the exhaustive engineering specifications have been partitioned into focused architectural documents:

```
docs/
 └── BroadcastTVGuide/
      ├── UXRuntimeKernel.md   # UX Runtime Kernel & Guardrail Self-Healing Architecture
      ├── ProductionReadinessGate.md # Authoritative Release Certification Gate & Invariant Checklist
      ├── UXTestHarness.md     # Automated E2E Verification Suite (Playwright & Cypress)
      ├── UXStateMachine.md    # Formal XState v5 Deterministic Navigation & Recovery Machine
      ├── UXTransformationPromptPlan.md # Authoritative 18-Section UX Abstraction Specification
      ├── UXSpecification.md   # Master User Experience (UX), Onboarding & Discoverability
      ├── Governance.md        # Provider Capability Matrix, Preemption Tiers & Certification
      ├── UniversalNormalization.md # Master Source Normalization & Virtual 24/7 Scheduler
      ├── Architecture.md      # Pipeline Topology, Workers & Lifecycle State Machines
      ├── API.md               # BroadcastTVGuideAPI Contracts & Filter Types
      ├── DataModels.md        # GuideProgram, GuideChannel & Transport Contracts
      ├── Rendering.md         # 2D GPU Compositing & Virtual Window Slicing
      ├── StateManagement.md   # Observable Store & GuideSystemEvent Bus
      ├── Virtualization.md    # Coordinate Mathematics & DOM GC Protection
      ├── Search.md            # Hybrid Radix Trie + Levenshtein Indexing
      ├── PluginSDK.md         # Sandboxed Third-Party GuidePlugin Lifecycle
      ├── Telemetry.md         # DiagnosticsHUD Observability & Health Protocols
      ├── Security.md          # DOMPurify Synopsis Sanitization & CSP Guardrails
      ├── Testing.md           # Vitest CI Benchmarks & 48h Endurance Checks
      └── Performance.md       # Empirical SLO Targets & Embedded Hardware Budgets
```

---

### Authoritative Specification Index

| Document | Core Focus & Empirical Invariants | Status |
| :--- | :--- | :---: |
| **[`UXRuntimeKernel.md`](./docs/BroadcastTVGuide/UXRuntimeKernel.md)** | **UX Runtime Kernel & Guardrails**: Self-healing orchestration layer intercepting empty states, invalid navigation transitions, and media exceptions. | **10 / 10** |
| **[`ProductionReadinessGate.md`](./docs/BroadcastTVGuide/ProductionReadinessGate.md)** | **Master Release Certification Gate**: Enterprise invariant checklist verifying zero empty states, 1-click controls, session interception & touch targets. | **10 / 10** |
| **[`UXTestHarness.md`](./docs/BroadcastTVGuide/UXTestHarness.md)** | **Automated E2E Verification Suite**: Playwright & Cypress test suites asserting cold boot hydration, $\le 1$ click reachability, and cross-session Theatre geometry. | **10 / 10** |
| **[`UXStateMachine.md`](./docs/BroadcastTVGuide/UXStateMachine.md)** | **Formal XState v5 Machine**: Verifiable finite state machine governing boot decisions, session recovery dialogs, and deadlock detachment. | **10 / 10** |
| **[`UXTransformationPromptPlan.md`](./docs/BroadcastTVGuide/UXTransformationPromptPlan.md)** | **UX Transformation Specification**: 18-section TV-first UX prompt plan; 1-click first screen, 3-layer progressive disclosure & device adaptive layouts. | **10 / 10** |
| **[`UXSpecification.md`](./docs/BroadcastTVGuide/UXSpecification.md)** | **Master UX Architecture**: Zero-config Demo Channels, 1-click Theatre Mode controls, instant Resume Watching recovery & cross-device layouts. | **10 / 10** |
| **[`Governance.md`](./docs/BroadcastTVGuide/Governance.md)** | **Enterprise Governance & Certification**: Provider Capability Matrix (`ProviderCapabilities`), Preemption Tiers, Metadata Confidence & Certification Manifest. | **10 / 10** |
| **[`UniversalNormalization.md`](./docs/BroadcastTVGuide/UniversalNormalization.md)** | **Universal Playout & Scheduler**: Decouples 8 heterogeneous sources (YouTube, Rumble, Archive, IPTV, RSS) via `UniversalSourceAdapter`; 24/7 synthesis & breaking preemption. | **10 / 10** |
| **[`Architecture.md`](./docs/BroadcastTVGuide/Architecture.md)** | **System Pipeline & Workers**: Background SAX ingestion threads (`PARSE_XMLTV`, `BUILD_SEARCH_INDEX`), dependency topologies & state machine transitions. | **10 / 10** |
| **[`API.md`](./docs/BroadcastTVGuide/API.md)** | **Master Public Interface**: Strongly typed contracts for `loadGuide()`, `refreshGuide()`, `setViewport()`, and instant `playProgram()` playout triggers. | **10 / 10** |
| **[`DataModels.md`](./docs/BroadcastTVGuide/DataModels.md)** | **Formal Schemas**: `GuideProgram` invariants (`live === true` enforces `recordingAllowed === false`), `GuideChannel` rows & `PlaybackSourceMetadata`. | **10 / 10** |
| **[`Rendering.md`](./docs/BroadcastTVGuide/Rendering.md)** | **GPU Layer Compositing**: Dual-axis windowing (`64px` row height + `5` overscan), `translate3d` reflow prevention & passive scroll listeners. | **10 / 10** |
| **[`StateManagement.md`](./docs/BroadcastTVGuide/StateManagement.md)** | **Event Bus & Stores**: Decoupled domain stores (IndexedDB Map) vs transient React UI state. Strongly typed `GuideSystemEvent` propagation. | **10 / 10** |
| **[`Virtualization.md`](./docs/BroadcastTVGuide/Virtualization.md)** | **Recycling Mathematics**: Time-to-pixel spatial formulas, innerHTML zero-allocation invariants & debounced `ResizeObserver` limits. | **10 / 10** |
| **[`Search.md`](./docs/BroadcastTVGuide/Search.md)** | **Sub-200ms Indexing**: Radix Trie exact prefix matching combined with `Fuse.js` fuzzy bitap scoring across weighted metadata fields. | **10 / 10** |
| **[`PluginSDK.md`](./docs/BroadcastTVGuide/PluginSDK.md)** | **Extensibility Engine**: `GuidePlugin` lifecycle (`initialize`, `onProgramClicked`), DOM isolation invariants & unhandled error detachment. | **10 / 10** |
| **[`Telemetry.md`](./docs/BroadcastTVGuide/Telemetry.md)** | **Diagnostics Integration**: Real-time emission of `GuideTelemetryMetrics` (`scrollFPS`, heap MB) & `DiagnosticsHealthReport` degradation rules. | **10 / 10** |
| **[`Security.md`](./docs/BroadcastTVGuide/Security.md)** | **Sanitization & CSP**: Strict `DOMPurify` whitelist stripping on untrusted XMLTV feeds. Zero `eval()` invariants under strict CSP policies. | **10 / 10** |
| **[`Testing.md`](./docs/BroadcastTVGuide/Testing.md)** | **CI Verification Suite**: 10,000 synthetic channel stress benchmarks, 48-hour headless Puppeteer endurance playout & `axe-core` accessibility. | **10 / 10** |
| **[`Performance.md`](./docs/BroadcastTVGuide/Performance.md)** | **Empirical SLOs**: $<180\text{ms}$ cold boot, guaranteed 60 FPS viewport scrolling, $<8\text{ms}$ GC pauses & embedded ARM Cortex budgets. | **10 / 10** |

---

## Current Focus
Production validation, endurance testing, accessibility, browser compatibility, performance optimization, documentation synchronization.

## Definition of Done
- Production build passes.
- Zero TypeScript errors.
- Zero lint errors.
- Zero runtime console errors.
- No memory leaks.
- Documentation updated.
- Tests pass.
- Feature validated on supported layouts.
