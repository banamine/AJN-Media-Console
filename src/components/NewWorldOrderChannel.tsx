import React, { useEffect, useRef, useState, useCallback } from 'react';
import { resolveCurrentSlot, RotationItem, RotationSlot } from '../utils/rotationScheduler';
import seedData from '../data/newWorldOrderSeed.json';

const CHANNEL_NAME = 'New World Order';
const PUBLISHER_ID = 'u15son'; // Rumble embedJS publisher/version segment used by this account's embeds
const TITLE_OVERLAY_MS = 6000; // how long the lower-third title card stays up after a switch
const TRANSITION_COVER_MS = 550; // how long the fade-to-black mask stays up around a loadVideo() swap
const RESYNC_CHECK_MS = 20000; // periodic safety re-check in case a scheduled switch timer drifts
const SOURCE_CHANNEL_USERNAME = 'LIBERTYEXPRESS';
const CATALOG_REFRESH_MS = 30 * 60 * 1000; // re-poll the backend ingestion endpoint every 30 minutes

const BACKEND_URL = (import.meta as any).env?.DEV ? '' : ((import.meta as any).env?.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');

interface NewWorldOrderChannelProps {
  onPlaying?: () => void;
}

// Loads Rumble's embedJS loader exactly once per page (safe to call repeatedly - it no-ops if
// window.Rumble is already installed).
function ensureRumbleLoaderInstalled() {
  const w = window as any;
  if (w._Rumble) return;
  /* eslint-disable */
  (function (r: any, u: Document, m: string, b: string) {
    r._Rumble = b;
    if (!r[b]) {
      r[b] = function () {
        (r[b]._ = r[b]._ || []).push(arguments);
        if (r[b]._.length === 1) {
          const l = u.createElement(m) as HTMLScriptElement;
          const e = u.getElementsByTagName(m)[0];
          l.async = true;
          l.src =
            'https://rumble.com/embedJS/' +
            PUBLISHER_ID +
            (arguments[0] && arguments[0][1] && arguments[0][1].video ? '.' + arguments[0][1].video : '') +
            '/?url=' +
            encodeURIComponent(location.href) +
            '&args=' +
            encodeURIComponent(JSON.stringify(Array.prototype.slice.call(arguments)));
          if (e && e.parentNode) e.parentNode.insertBefore(l, e);
        }
      };
    }
  })(window, document, 'script', 'Rumble');
  /* eslint-enable */
}

// P0: the Rumble embed's `?start=` URL param does NOT seek (confirmed against the live embed) -
// the only supported way to land on a mid-video offset is the JS Player API's
// api.setCurrentTime(seconds), called after the player fires "play". This is what makes true
// wall-clock-synced "you're joining mid-video, same as everyone else right now" playback possible.
export function NewWorldOrderChannel({ onPlaying }: NewWorldOrderChannelProps) {
  const seedItems: RotationItem[] = (seedData as any).items || [];
  // Mutable, non-reactive item list: starts from the bundled seed for an instant first paint,
  // then may be swapped out in-place by the background catalog-growth fetch below (see
  // refreshCatalogFromBackend). Using a ref instead of state means an in-progress rotation never
  // has to interrupt itself to re-render - the next scheduled switch or resync tick just picks up
  // whatever itemsRef.current currently holds.
  const itemsRef = useRef<RotationItem[]>(seedItems);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeEmbedIdRef = useRef<string | null>(null);
  const seekedForCurrentLoadRef = useRef(false);

  const [title, setTitle] = useState('');
  const [showTitle, setShowTitle] = useState(false);
  const [showCover, setShowCover] = useState(true);
  const [status, setStatus] = useState('TUNING IN…');

  const clearTimers = useCallback(() => {
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    if (resyncTimerRef.current) clearInterval(resyncTimerRef.current);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
  }, []);

  const showTitleCard = useCallback((t: string) => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    setTitle(t);
    setShowTitle(true);
    titleTimerRef.current = setTimeout(() => setShowTitle(false), TITLE_OVERLAY_MS);
  }, []);

  const tuneToSlot = useCallback(
    (slot: RotationSlot, isInitialLoad: boolean) => {
      const api = apiRef.current;
      if (!api) return;

      const alreadyOnThisItem = activeEmbedIdRef.current === slot.item.embedId;
      activeEmbedIdRef.current = slot.item.embedId;
      seekedForCurrentLoadRef.current = false;

      if (!alreadyOnThisItem || isInitialLoad) {
        setShowCover(true);
        setStatus('SWITCHING PROGRAM…');
        try {
          if (isInitialLoad) {
            api.play(true);
          } else {
            api.loadVideo(slot.item.embedId, true);
          }
        } catch {
          // If the SDK call throws (not yet ready), the periodic resync pass will retry.
        }
      }

      showTitleCard(slot.item.title || CHANNEL_NAME);

      // Schedule the next hand-off precisely at the boundary this slot computed, plus a hair of
      // slack so a slightly-slow network doesn't cause us to cut a beat early.
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
      const msUntilSwitch = Math.max(1000, slot.nextSwitchAtMs - Date.now() + 400);
      switchTimerRef.current = setTimeout(() => {
        const next = resolveCurrentSlot(itemsRef.current, CHANNEL_NAME, new Date());
        if (next) tuneToSlot(next, false);
      }, msUntilSwitch);
    },
    [showTitleCard]
  );

  // Best-effort background growth: pull the full (or fuller) Rumble catalog from the backend
  // ingestion endpoint and, if it resolves more videos than we currently have, swap itemsRef in
  // place. This is how the channel picks up new uploads and the rest of the 17-page library
  // beyond the bootstrap seed over time, without ever blocking first paint on a network call.
  const refreshCatalogFromBackend = useCallback(async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/rumble/channel/${encodeURIComponent(SOURCE_CHANNEL_USERNAME)}?pages=17&limit=450`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.videos)) return;

      const resolved: RotationItem[] = data.videos
        .filter((v: any) => v.embedId && (v.duration || v.durationSeconds))
        .map((v: any) => ({
          embedId: v.embedId,
          durationSeconds: v.durationSeconds || v.duration,
          title: v.title,
        }));

      if (resolved.length > itemsRef.current.length) {
        console.log(`[New World Order] Catalog grew: ${itemsRef.current.length} -> ${resolved.length} videos.`);
        itemsRef.current = resolved;
      }
    } catch {
      // Offline, backend unreachable, or rumble.com temporarily blocked the scrape - the bundled
      // seed (or whatever catalog we already loaded) keeps the channel running either way.
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || itemsRef.current.length === 0) return;
    let cancelled = false;
    const divId = 'nwo-rumble-player-' + Math.random().toString(36).slice(2);
    containerRef.current.id = divId;

    ensureRumbleLoaderInstalled();
    const w = window as any;
    const initialSlot = resolveCurrentSlot(itemsRef.current, CHANNEL_NAME, new Date());
    if (!initialSlot) return;

    w.Rumble('play', {
      video: initialSlot.item.embedId,
      div: divId,
      api: (api: any) => {
        if (cancelled) return;
        apiRef.current = api;

        try {
          api.on('play', () => {
            setStatus('LIVE');
            if (onPlaying) onPlaying();
            // Land on the correct mid-video position exactly once per load - the seek needs the
            // player to have actually started before setCurrentTime takes effect reliably.
            if (!seekedForCurrentLoadRef.current) {
              seekedForCurrentLoadRef.current = true;
              const nowSlot = resolveCurrentSlot(itemsRef.current, CHANNEL_NAME, new Date());
              if (nowSlot && nowSlot.item.embedId === activeEmbedIdRef.current && nowSlot.itemOffsetSeconds > 3) {
                try {
                  api.setCurrentTime(nowSlot.itemOffsetSeconds);
                } catch {
                  /* non-fatal - video still plays, just from 0 */
                }
              }
            }
            setTimeout(() => setShowCover(false), TRANSITION_COVER_MS);
          });
        } catch {
          /* SDK version without .on support - degrade gracefully, still plays from 0 */
        }

        try {
          api.on('videoEnd', () => {
            // Safety net: if the actual video ends before our scheduled boundary (duration
            // metadata was off), advance immediately instead of sitting on a frozen last frame.
            const next = resolveCurrentSlot(itemsRef.current, CHANNEL_NAME, new Date());
            if (next) tuneToSlot(next, false);
          });
        } catch {
          /* non-fatal */
        }

        tuneToSlot(initialSlot, true);
      },
    });

    // Belt-and-suspenders resync: recompute the "true" slot periodically and correct if we've
    // somehow drifted (e.g. the tab was backgrounded and timers were throttled). Also doubles as
    // the mechanism that picks up a background catalog swap (see refreshCatalogFromBackend) -
    // once itemsRef.current changes, the next tick here will fold it into the schedule.
    resyncTimerRef.current = setInterval(() => {
      const trueSlot = resolveCurrentSlot(itemsRef.current, CHANNEL_NAME, new Date());
      if (trueSlot && trueSlot.item.embedId !== activeEmbedIdRef.current) {
        tuneToSlot(trueSlot, false);
      }
    }, RESYNC_CHECK_MS);

    // Kick off the background catalog-growth fetch (once now, then periodically) - fire-and-forget,
    // never blocks playback of whatever's already loaded.
    refreshCatalogFromBackend();
    const catalogTimer = setInterval(refreshCatalogFromBackend, CATALOG_REFRESH_MS);

    return () => {
      cancelled = true;
      clearTimers();
      clearInterval(catalogTimer);
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (itemsRef.current.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-slate-400 font-mono text-sm">
        New World Order channel has no videos loaded yet.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Fade-to-black mask that covers the brief reload flash between videos */}
      <div
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-500 ${
          showCover ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Lower-third title card, per-video */}
      <div
        className={`pointer-events-none absolute left-4 bottom-4 max-w-[80%] transition-all duration-500 ${
          showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="bg-black/70 backdrop-blur-sm border-l-2 border-orange-500 px-4 py-2 rounded-r">
          <div className="text-[10px] uppercase tracking-widest text-orange-400 font-mono mb-0.5">{CHANNEL_NAME}</div>
          <div className="text-sm text-slate-100 font-medium leading-tight">{title}</div>
        </div>
      </div>

      {showCover && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-slate-500 font-mono text-xs uppercase tracking-widest">{status}</div>
        </div>
      )}
    </div>
  );
}
