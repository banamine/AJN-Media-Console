# Broadcast TV Guide: Search Indexing Specification

## Overview
To provide instant master control operator search across 5,000+ program items without UI thread blocking, the guide integrates a background-indexed hybrid Trie + Levenshtein fuzzy engine.

---

## Indexing Architecture

### 1. Algorithm Selection
The search engine utilizes a hybrid approach:
- **Exact & Prefix Matching**: In-memory Radix Trie (`MiniSearch` variant) for $O(k)$ instantaneous lookup where $k$ is search string length.
- **Fuzzy Typo Tolerance**: `Fuse.js` Bitap algorithm supporting up to distance 2 Levenshtein edits for operator typos.

---

### 2. Weighted Field Scoring
Search queries score matching candidates across prioritized metadata attributes:

```typescript
export interface WeightedField {
  fieldName: keyof GuideProgram;
  weight: number;
}

export const DEFAULT_SEARCH_WEIGHTS: WeightedField[] = [
  { fieldName: "title", weight: 10.0 },
  { fieldName: "genre", weight: 4.0 },
  { fieldName: "description", weight: 2.5 },
  { fieldName: "provider", weight: 1.0 }
];
```

---

## Search Latency SLO & Worker Flow

- **Service Level Objective (SLO)**: 100% of queries across $\le 10,000$ indexed programs MUST return sorted results in $< 200\text{ms}$.

```
[Operator Types in Search Input]
              │
              ▼ (Debounced 100ms)
[Dispatch Query to Search Worker Thread]
              │
              ▼
[Worker: Radix Trie Exact Prefix Intersect]
              │
              ▼
[Worker: Bitap Fuzzy Score Filter & Sort]
              │
              ▼ (<150ms total execution)
[Main Thread: Dispatch SearchCompletedEvent]
```
