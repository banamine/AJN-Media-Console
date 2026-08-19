# Module Dependency & Bundling Topology Specification

This specification defines the strict import hierarchy, third-party dependency justifications, circular dependency prevention guardrails, and container build boundaries for the application codebase.

---

## 1. Import Hierarchy & Layer Enforcement

To enforce clean separation of concerns, source files are strictly governed by a unidirectional import dependency hierarchy. Lower layers are strictly forbidden from importing higher layers.

```
Level 4: Main Application Entry & Container
         (main.tsx, App.tsx, server.ts)
                    │
                    ▼
Level 3: UI View Components
         (/src/components/*)
                    │
                    ▼
Level 2: State Controllers & Lifecycle Hooks
         (/src/hooks/*)
                    │
                    ▼
Level 1: Persistent Storage Engines & Services
         (/src/services/*)
                    │
                    ▼
Level 0: Pure Algorithmic Utilities & Type Contracts
         (/src/utils/*, /src/types.ts)
```

### Strict Linting & Architectural Guardrails
* **No Upward Imports**: A file in `/src/utils/*` cannot import from `/src/services/*`, `/src/hooks/*`, or `/src/components/*`.
* **No Circular Dependencies**: ESLint rules (`import/no-cycle`) and CI compilation checks strictly verify zero circular dependency chains across the entire codebase.
* **Explicit Type Stripping**: Enums must be declared using standard `enum` syntax (`const enum` is strictly prohibited). Imports of types must use standard named imports without breaking CommonJS build stripping.

---

## 2. External Third-Party Dependency Justifications

Every external npm library included in `package.json` undergoes rigorous security evaluation and serves an irreplaceable functional requirement:

| Package | Version | Layer | Primary Architectural Justification |
| :--- | :--- | :--- | :--- |
| `react` & `react-dom` | `^18.3.1` | Presentation | Core declarative UI rendering engine and fiber reconciler. |
| `hls.js` | `^1.5.17` | Engine | Adaptive bit-rate HTTP Live Streaming demuxer for browsers lacking native Apple HLS demuxing (Chrome, Firefox, Edge). |
| `@google/genai` | `^0.1.1` | Backend | Modern TypeScript SDK for server-side AI logic, stream categorization, and dynamic metadata grounding. |
| `motion` | `^11.15.0` | Presentation | Hardware-accelerated layout transitions and surgical CSS viewport expansion animations (`transition-all duration-500`). |
| `lucide-react` | `^0.469.0` | Presentation | Standardized, tree-shakeable vector SVG icon system ensuring crisp HiDPI scaling across all display modes. |
| `clsx` & `tailwind-merge` | `^2.1.1` | Utility | Dynamic CSS className concatenation and utility conflict resolution (`cn()` helper). |
| `express` | `^4.21.2` | Reverse Proxy | Container edge HTTP server managing external ingress routing on Port 3000 and CORS stream proxying. |
| `vite` & `tsx` | `^6.0.3` | Build / Dev | Hot development server and production bundler. |

---

## 3. Dual Runtime Bundling Boundaries

The repository operates across two distinct runtime environments within a single Cloud Run container instance: **Node.js CommonJS Backend** and **Browser ES Module Frontend**.

```
+---------------------------------------------------------------------------------+
|                       CLOUD RUN CONTAINER (PORT 3000)                           |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  | BACKEND RUNTIME: Node.js (CommonJS / ESBuild Output)                      |  |
|  | Entry Point: /dist/server.cjs (Compiled from server.ts)                   |  |
|  |                                                                           |  |
|  | * Binds exclusively to 0.0.0.0:3000                                       |  |
|  | * Intercepts /api/* requests for CORS Reverse Proxying                    |  |
|  | * Serves static frontend client bundle from /dist/*                       |  |
|  +---------------------------------------------------------------------------+  |
|                                       │                                         |
|                             Static Asset Ingress                                |
|                                       ▼                                         |
|  +---------------------------------------------------------------------------+  |
|  | FRONTEND RUNTIME: Web Browser V8/SpiderMonkey/WebKit (ES Modules)         |  |
|  | Entry Point: /dist/index.html -> /src/main.tsx                            |  |
|  |                                                                           |  |
|  | * Executes React Virtual DOM client-side                                  |  |
|  | * Demuxes HLS audio/video streams via Web Workers                         |  |
|  | * Communicates with local IndexedDB storage quota                         |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

### Build Command Mechanics
The production build pipeline (`npm run build`) reconciles both runtime targets atomically:
1. `vite build`: Compiles all frontend React components, Tailwind styles, and workers into optimized static assets located in `/dist/`.
2. `esbuild server.ts`: Bundles the Express backend into a standalone CommonJS binary (`/dist/server.cjs`), resolving all external Node packages (`--packages=external`) and generating inline sourcemaps for runtime stack trace diagnostics.
