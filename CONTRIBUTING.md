# Engineering Craftsmanship & Contribution Standards

We welcome engineering contributions to the **Universal Stream Hub**. To maintain our **10/10 Enterprise Engineering Score**, all contributors and AI coding agents must strictly enforce the following rules.

---

## 1. Architectural Guardrails
1. **Never Violate SRP**: Each component or helper utility must execute exactly one well-defined responsibility.
2. **Never Introduce Circular Imports**: Check all import trees. Unidirectional import dependency hierarchy (Level 0 to Level 4) must remain pristine.
3. **Never Expose Secrets to Client**: Any API token or Gemini key must remain strictly on the Express server (`server.ts`).

---

## 2. TypeScript & Code Quality Rules
* **No Enums via `const enum`**: Use standard `enum` declarations to preserve CommonJS build stripping compatibility.
* **No Unsafe `any` Types**: All interfaces and domain objects must be explicitly declared in `/src/types.ts`.
* **No `console.log`**: All logging must route through structured service error handlers.
* **No Stale Closures or Unmemoized Effects**: Ensure all `useEffect` hooks contain clean, primitive dependency arrays and explicit return cleanup functions.

---

## 3. Memory & Performance Discipline
* **Always Clean Up Resources**: If you attach a `MediaSource`, `AudioContext`, `Interval`, `Worker`, or `Observer`, you **MUST** provide an explicit teardown handler on component unmount.
* **Always Revoke Object URLs**: Invoke `URL.revokeObjectURL()` immediately after binary asset downloading.
* **Respect Port 3000 Ingress**: Do not hardcode external ports or modify container server bindings.

---

## 4. Verification Gate
Before submitting a pull request, verify that the entire local CI suite passes green:
```bash
npm run lint
npm run build
```
