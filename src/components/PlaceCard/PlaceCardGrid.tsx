/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ContentItem } from "../../types";
import { usePlaceCardState } from "./usePlaceCardState";
import { PlaceCard } from "./PlaceCard";
import { safeWrite } from "../../services/ProtocolResilienceEngine";
import { getAllDBValues } from "../../services/IndexedDB";
import { MatrixPlayerModal } from "./MatrixPlayerModal";

interface PlaceCardGridProps {
  selectedFolderId?: string;
  onPlayStream?: (url: string, title: string) => void;
  totalSlots?: number;
  stopPreludeMusic?: () => void;
}

export const PlaceCardGrid: React.FC<PlaceCardGridProps> = ({
  selectedFolderId = "all",
  onPlayStream,
  totalSlots = 40,
  stopPreludeMusic
}) => {
  const { items, loading, assignSlot, getSlots, refreshSlots } = usePlaceCardState(selectedFolderId);
  const [filterQuery, setFilterQuery] = useState("");
  const [activePlayItem, setActivePlayItem] = useState<ContentItem | null>(null);

  const slots = useMemo(() => {
    return getSlots(totalSlots);
  }, [getSlots, totalSlots]);

  const filteredSlots = useMemo(() => {
    return slots.filter(slot => !filterQuery || (slot.contentItem && slot.contentItem.title.toLowerCase().includes(filterQuery.toLowerCase())));
  }, [slots, filterQuery]);

  // Subscription Debugging: onRSSUpdate dynamic listener and auto-promotion engine
  useEffect(() => {
    const handleRSSUpdate = async () => {
      console.log("[PlaceCardGrid] Dynamic RSS observer triggered. Running auto-promotion...");
      try {
        // 1. Fetch all items from IndexedDB content registry
        const allItems = await getAllDBValues<ContentItem>("contentItems");
        
        // 2. Identify filled slots and extract available "DROP CONTENT" slots
        const filledSlots = new Set(
          allItems
            .map(i => i.slotNumber)
            .filter((s): s is number => s !== undefined && s > 0)
        );
        const emptySlots: number[] = [];
        for (let s = 1; s <= totalSlots; s++) {
          if (!filledSlots.has(s)) {
            emptySlots.push(s);
          }
        }
        
        // 3. Find unorganized items that have no slotNumber assigned yet
        const unorganizedUnassigned = allItems.filter(
          i =>
            (i.folderId === "folder_unorganized" || !i.folderId) &&
            (!i.slotNumber || i.slotNumber <= 0)
        );
        
        // 4. Map / Auto-promote unorganized items into empty slots
        if (unorganizedUnassigned.length > 0 && emptySlots.length > 0) {
          console.log(`[PlaceCardGrid] Auto-promoting ${Math.min(unorganizedUnassigned.length, emptySlots.length)} unorganized assets...`);
          let updatedAny = false;
          for (let idx = 0; idx < Math.min(unorganizedUnassigned.length, emptySlots.length); idx++) {
            const item = unorganizedUnassigned[idx];
            const targetSlot = emptySlots[idx];
            item.slotNumber = targetSlot;
            
            // Persist the slot mapping update to IndexedDB
            await safeWrite("contentItems", item);
            updatedAny = true;
          }
          if (updatedAny) {
            refreshSlots();
          }
        }
      } catch (err) {
        console.error("[PlaceCardGrid] Auto-promotion engine error:", err);
      }
    };

    window.addEventListener("ajn-rss-updated" as any, handleRSSUpdate);
    
    // Also run once on mount to handle any pending/unmapped items from previous loads
    handleRSSUpdate();

    return () => {
      window.removeEventListener("ajn-rss-updated" as any, handleRSSUpdate);
    };
  }, [totalSlots, refreshSlots]);

  // Seed 5 sample content items for drag-drop testing as requested
  const seedSampleItems = async () => {
    const nowIso = new Date().toISOString();
    const samples: ContentItem[] = [
      {
        id: "item_sample_1",
        folderId: "folder_unorganized",
        slotNumber: 1,
        title: "Alex Jones Show - Hour 1 Broadcast Vault",
        url: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
        backupUrl: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
        sourcePriority: [
          "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
          "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4"
        ],
        hasConflict: true,
        conflictSources: [
          { id: "cs1_1", name: "US West Playout Mirror", url: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4", priority: 90 },
          { id: "cs1_2", name: "Europe High-Bitrate Edge (Alt)", url: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4", priority: 80 }
        ],
        mediaType: "vod",
        thumbnailUrl: "https://archive.org/download/daily-highlights/lmbsa.png",
        groupTitle: "INFOWARS VAULT",
        durationSeconds: 3600,
        parsedAt: nowIso,
        createdAt: nowIso,
        checksum: "a1b2c3d4"
      },
      {
        id: "item_sample_2",
        folderId: "folder_unorganized",
        slotNumber: 2,
        title: "Rumble Action Live Feed - Studio A",
        url: "",
        backupUrl: "https://www.liberty-express.org/stream.pls",
        hasConflict: true,
        conflictSources: [
          { id: "cs2_1", name: "Rumble Primary Edge CDN", url: "", priority: 95 },
          { id: "cs2_2", name: "Liberty Live Stream backup", url: "https://www.liberty-express.org/stream.pls", priority: 70 }
        ],
        mediaType: "live",
        thumbnailUrl: "https://rumble.com/favicon.ico",
        groupTitle: "RUMBLE LIVE",
        durationSeconds: 3600,
        parsedAt: nowIso,
        createdAt: nowIso,
        checksum: "e5f6g7h8"
      },
      {
        id: "item_sample_3",
        folderId: "folder_unorganized",
        slotNumber: 3,
        title: "War Room With Owen Shroyer - Full Master",
        url: "",
        mediaType: "vod",
        thumbnailUrl: "https://archive.org/download/daily-highlights/lmbsa.png",
        groupTitle: "WAR ROOM",
        durationSeconds: 3600,
        parsedAt: nowIso,
        createdAt: nowIso,
        checksum: "87654321"
      },
      {
        id: "item_sample_4",
        folderId: "folder_unorganized",
        slotNumber: 4,
        title: "Liberty Express Synthesizer Audio Stream",
        url: "https://www.liberty-express.org/stream.pls",
        mediaType: "audio",
        thumbnailUrl: "https://archive.org/download/daily-highlights/lmbsa.png",
        groupTitle: "SYNTH WAVE",
        durationSeconds: 3600,
        parsedAt: nowIso,
        createdAt: nowIso,
        checksum: "11223344"
      },
      {
        id: "item_sample_5",
        folderId: "folder_unorganized",
        slotNumber: 5,
        title: "Retro Sci-Fi Compilation Master Reel",
        url: "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4",
        mediaType: "vod",
        thumbnailUrl: "https://archive.org/download/daily-highlights/lmbsa.png",
        groupTitle: "SCI-FI REEL",
        durationSeconds: 3600,
        parsedAt: nowIso,
        createdAt: nowIso,
        checksum: "99887766"
      }
    ];

    for (const s of samples) {
      await safeWrite("contentItems", s);
    }
    refreshSlots();
  };

  const handleConflictResolved = useCallback(() => {
    // Silent re-render of the grid to update source badges
    refreshSlots();
  }, [refreshSlots]);

  const handlePlayCard = useCallback((item: ContentItem) => {
    setActivePlayItem(item);
    if (onPlayStream) {
      onPlayStream(item.url, item.title);
    }
  }, [onPlayStream]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#06080C]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-emerald-400 tracking-widest uppercase font-bold">Loading PlaceCard Canvas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#06080C] overflow-hidden min-h-0 relative">
      {/* HUD CONTROLLER BAR */}
      <div className="px-5 py-3 bg-[#0a0f1d]/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-extrabold text-emerald-400 tracking-widest uppercase bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/60">
            PLACECARD MATRIX (v2.0)
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Active Slots: {items.filter(i => i.slotNumber).length} / {totalSlots}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter matrix slots..."
            className="bg-[#04060a] border border-slate-800 rounded px-3 py-1 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/80 w-48"
          />
          {items.length === 0 && (
            <button
              onClick={seedSampleItems}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-mono font-extrabold text-xs rounded uppercase tracking-wider shadow transition cursor-pointer"
            >
              ⚡ Seed 5 Sample Items
            </button>
          )}
          <button
            onClick={refreshSlots}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
            title="Refresh Matrix"
          >
            🔄
          </button>
        </div>
      </div>

      {/* PLACECARD SLOT MATRIX (Viewport-Virtualized Grid Canvas) */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#06080C] min-h-0">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
        >
          {filteredSlots.map((slot) => (
              <PlaceCard
                key={`matrix_slot_${slot.slotNumber}`}
                slotNumber={slot.slotNumber}
                item={slot.contentItem}
                onDropItem={assignSlot}
                onConflictResolve={handleConflictResolved}
                onPlay={handlePlayCard}
              />
            ))}
        </div>
      </div>

      {/* CONTROLLED "MATRIX" PLAYER OVERLAY */}
      <MatrixPlayerModal
        stopPreludeMusic={stopPreludeMusic}
        isOpen={activePlayItem !== null}
        onClose={() => setActivePlayItem(null)}
        item={activePlayItem}
      />
    </div>
  );
};
