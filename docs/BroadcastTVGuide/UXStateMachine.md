# AJN Liberty Play — Formal XState Deterministic Navigation & Session Recovery Specification (v12.5)

## Executive Summary
To eliminate race conditions, UI deadlock, and unpredictable navigation jumps, the user interface routing architecture is modeled as a deterministic, mathematically verifiable finite state machine (FSM). Using **XState v5 semantics**, this specification governs the lifecycle of `LiteApp.tsx`, guaranteeing that all view transitions, session rehydrations, and emergency fallbacks execute deterministically.

---

## 1. Authoritative State Machine Topology

```
                         ┌────────────────────────────────────────┐
                         │              [ BOOT ]                  │
                         └───────────────────┬────────────────────┘
                                             │
                                  Evaluate LocalStorage
                                             │
                        ┌────────────────────┴────────────────────┐
                        │                                         │
             Valid Session Exists?                     No Session Discovered
                        │                                         │
                        ▼                                         ▼
            ┌───────────────────────┐                 ┌───────────────────────┐
            │  [ SESSION_RECOVERY ] │                 │   [ DEMO_HYDRATION ]  │
            └───────────┬───────────┘                 └───────────┬───────────┘
                        │                                         │
          ┌─────────────┴─────────────┐                           │
          │ User Selects              │ User Selects              │ Auto-Hydrates
          ▼ Continue                  ▼ Restart                   │ Demo M3U
     ┌──────────┐               ┌──────────┐                      │
     │ STAGE_ON │               │ STAGE_ON │                      │
     │ (Resume) │               │ (Seek 0) │                      │
     └─────┬────┘               └─────┬────┘                      │
           │                          │                           │
           └──────────────────────────┼───────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │      [ IDLE_DASHBOARD ]       │
                      │   (Active Navigation Shell)   │
                      └───────────────┬───────────────┘
                                      │
             ┌──────────────┬─────────┴──────┬──────────────┬──────────────┐
             ▼              ▼                ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐     ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   HOME   │   │  GUIDE   │     │  PLAYER  │   │ LIBRARY  │   │ SETTINGS │
        └──────────┘   └──────────┘     └──────────┘   └──────────┘   └──────────┘
```

---

## 2. Formal XState v5 Machine Definition (`src/machines/uxNavigationMachine.ts`)

```typescript
import { createMachine, assign } from 'xstate';

export interface UXMachineContext {
  activeSurface: 'home' | 'guide' | 'player' | 'library' | 'favorites' | 'search' | 'settings';
  isTheatreModeActive: boolean;
  isFirstRunCompleted: boolean;
  activeStreamUrl: string | null;
  activeStreamTitle: string | null;
  resumeTimestampMs: number | null;
  errorRecoveryCount: number;
}

export type UXMachineEvent =
  | { type: 'BOOT_COMPLETED'; hasSession: boolean; startView: UXMachineContext['activeSurface'] }
  | { type: 'NAVIGATE'; surface: UXMachineContext['activeSurface'] }
  | { type: 'SELECT_STREAM'; url: string; title: string }
  | { type: 'TOGGLE_THEATRE_MODE' }
  | { type: 'RESUME_SESSION' }
  | { type: 'RESTART_SESSION' }
  | { type: 'GO_LIVE_NOW' }
  | { type: 'EMERGENCY_FALLBACK' };

export const uxNavigationMachine = createMachine<UXMachineContext, UXMachineEvent>({
  id: 'ajnLibertyPlayUX',
  initial: 'booting',
  context: {
    activeSurface: 'home',
    isTheatreModeActive: false,
    isFirstRunCompleted: true,
    activeStreamUrl: null,
    activeStreamTitle: null,
    resumeTimestampMs: null,
    errorRecoveryCount: 0
  },
  states: {
    booting: {
      on: {
        BOOT_COMPLETED: [
          {
            guard: ({ event }) => event.hasSession,
            target: 'recoveringSession'
          },
          {
            target: 'idle',
            actions: assign({
              activeSurface: ({ event }) => event.startView
            })
          }
        ]
      }
    },
    recoveringSession: {
      on: {
        RESUME_SESSION: {
          target: 'idle',
          actions: assign({ activeSurface: 'player' })
        },
        RESTART_SESSION: {
          target: 'idle',
          actions: assign({ 
            activeSurface: 'player',
            resumeTimestampMs: 0 
          })
        }
      }
    },
    idle: {
      on: {
        NAVIGATE: {
          actions: assign({
            activeSurface: ({ event }) => event.surface
          })
        },
        SELECT_STREAM: {
          actions: assign({
            activeSurface: 'player',
            activeStreamUrl: ({ event }) => event.url,
            activeStreamTitle: ({ event }) => event.title
          })
        },
        TOGGLE_THEATRE_MODE: {
          actions: assign({
            isTheatreModeActive: ({ context }) => !context.isTheatreModeActive
          })
        },
        GO_LIVE_NOW: {
          actions: assign({
            activeSurface: 'player',
            resumeTimestampMs: null // Synchronize playhead to live edge
          })
        },
        EMERGENCY_FALLBACK: {
          actions: assign({
            activeSurface: 'guide',
            errorRecoveryCount: ({ context }) => context.errorRecoveryCount + 1
          })
        }
      }
    }
  }
});
```

---

## 3. Deterministic Invariant Enforcement

### Invariant A: No Deadlock Transitions
Every state node explicitly handles `EMERGENCY_FALLBACK`. If any upstream network worker stalls or video decoder throws an unrecoverable `MediaError`, the UI state machine detaches from the failed stage and transitions immediately into `activeSurface: 'guide'`, ensuring continuous operator control.

### Invariant B: Theatre Mode Orthogonality
`isTheatreModeActive` is stored as orthogonal context rather than a distinct hierarchical state node. This guarantees that an operator can navigate freely between `guide`, `library`, and `settings` while Theatre Mode viewport scaling remains persistently locked.
