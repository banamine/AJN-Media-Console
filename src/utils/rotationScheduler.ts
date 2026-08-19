/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic wall-clock scheduler for "rotating channel" playback (e.g. New World Order).
 *
 * The goal: simulate a real linear TV channel out of a pool of on-demand videos of wildly
 * varying length (14 seconds to 4.6+ hours in this pool). Two viewers who tune in at the same
 * real-world moment should land on the same video at the same offset; a single viewer who
 * leaves and comes back later should very likely find a DIFFERENT video playing, because the
 * schedule keeps advancing against the wall clock whether anyone is watching or not - exactly
 * like a real broadcast channel.
 *
 * How it works:
 *  1. The playlist order is deterministically shuffled once per UTC day (mulberry32 PRNG seeded
 *     from a hash of the channel name + the date), so the rotation "feels" random but is
 *     reproducible for every viewer and re-shuffles itself daily so it doesn't get stale.
 *  2. Cumulative durations over that shuffled order define a single "cycle" of the channel.
 *  3. secondsIntoCycle = (secondsSinceUTCMidnight) % cycleLengthSeconds - this is what makes
 *     the position a pure function of wall-clock time, so it is naturally shared across every
 *     viewer and every device without any server-side "now playing" state to keep in sync.
 *  4. Walking the cumulative-duration array locates which item that offset falls into, and how
 *     far into that item's own duration the cycle currently is.
 *
 * NOTE: Rumble's embedded player does support API.setCurrentTime(seconds) for genuine mid-video
 * seeking (confirmed against the live player), so the computed itemOffsetSeconds can be used to
 * actually seek a freshly loaded video to the "live" position, not just to pick which video plays.
 */

export interface RotationItem {
  embedId: string;
  durationSeconds: number;
  title?: string;
}

export interface RotationSlot {
  index: number;            // index into the SHUFFLED order (not the original array)
  item: RotationItem;
  itemOffsetSeconds: number;     // how far into this item's own duration "now" is
  itemRemainingSeconds: number;  // itemOffsetSeconds's complement - time left before the next item starts
  nextSwitchAtMs: number;        // absolute epoch ms when the schedule will advance to the next item
  cycleLengthSeconds: number;
  shuffleDateKey: string;        // which day's shuffle produced this slot, for cache invalidation across midnight
}

// mulberry32: tiny, fast, deterministic PRNG - good enough for a daily reshuffle, not for anything
// security-sensitive.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple string hash (FNV-1a-ish) to turn "channelName + dateKey" into a numeric PRNG seed.
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Deterministic Fisher-Yates using the seeded PRNG - same seed always produces the same order.
function seededShuffleIndices(n: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Computes the shuffled playback order for a given channel + calendar day. Exposed separately
 * from resolveCurrentSlot so callers (e.g. a "what's coming up next" UI) can walk the full order
 * without recomputing "now" repeatedly.
 */
export function getShuffledOrder(items: RotationItem[], channelName: string, atDate: Date = new Date()): RotationItem[] {
  const dateKey = utcDateKey(atDate);
  const seed = hashSeed(`${channelName}::${dateKey}`);
  const order = seededShuffleIndices(items.length, seed);
  return order.map((i) => items[i]);
}

/**
 * Resolves what should be "on" for a given channel right now (or at an arbitrary Date, useful
 * for tests). Pure function of (items, channelName, now) - no hidden state, no side effects.
 */
export function resolveCurrentSlot(
  items: RotationItem[],
  channelName: string,
  now: Date = new Date()
): RotationSlot | null {
  const validItems = items.filter((it) => it.durationSeconds > 0);
  if (validItems.length === 0) return null;

  const dateKey = utcDateKey(now);
  const shuffled = getShuffledOrder(validItems, channelName, now);

  const cumulative: number[] = [];
  let total = 0;
  for (const it of shuffled) {
    cumulative.push(total);
    total += it.durationSeconds;
  }
  const cycleLengthSeconds = total;
  if (cycleLengthSeconds <= 0) return null;

  const midnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const secondsSinceMidnight = (now.getTime() - midnightUtc) / 1000;
  const secondsIntoCycle = secondsSinceMidnight % cycleLengthSeconds;

  // Binary search for the last cumulative boundary <= secondsIntoCycle.
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cumulative[mid] <= secondsIntoCycle) lo = mid;
    else hi = mid - 1;
  }
  const index = lo;
  const item = shuffled[index];
  const itemOffsetSeconds = Math.max(0, secondsIntoCycle - cumulative[index]);
  const itemRemainingSeconds = Math.max(0, item.durationSeconds - itemOffsetSeconds);
  const nextSwitchAtMs = now.getTime() + itemRemainingSeconds * 1000;

  return {
    index,
    item,
    itemOffsetSeconds,
    itemRemainingSeconds,
    nextSwitchAtMs,
    cycleLengthSeconds,
    shuffleDateKey: dateKey,
  };
}
