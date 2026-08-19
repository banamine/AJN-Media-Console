/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { ContentItem, PlaceCardSlot } from "../../types";
import { getAllDBValues } from "../../services/IndexedDB";
import { safeWrite } from "../../services/ProtocolResilienceEngine";

export function usePlaceCardState(selectedFolderId: string = "folder_unorganized") {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const allItems = await getAllDBValues<ContentItem>("contentItems");
      // Filter by folder or return all if unorganized/all
      const folderItems = selectedFolderId === "all"
        ? allItems
        : allItems.filter(i => i.folderId === selectedFolderId || (!i.folderId && selectedFolderId === "folder_unorganized"));
      setItems(folderItems);
    } catch (err) {
      console.error("[usePlaceCardState] Failed to fetch contentItems:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Assign or reassign item to numbered slot
  const assignSlot = useCallback(async (item: ContentItem, targetSlot: number) => {
    const updated: ContentItem = {
      ...item,
      slotNumber: targetSlot,
      folderId: selectedFolderId === "all" ? (item.folderId || "folder_unorganized") : selectedFolderId
    };
    const success = await safeWrite("contentItems", updated);
    if (success) {
      setItems(prev => {
        // Remove targetSlot from any other item in this view
        const cleared = prev.map(i => i.slotNumber === targetSlot ? { ...i, slotNumber: undefined } : i);
        return cleared.map(i => i.id === updated.id ? updated : i);
      });
    }
    return success;
  }, [selectedFolderId]);

  // Generate deterministic grid slots 1..TOTAL_SLOTS
  const getSlots = useCallback((totalSlots: number = 40): PlaceCardSlot[] => {
    const slots: PlaceCardSlot[] = [];
    for (let s = 1; s <= totalSlots; s++) {
      const found = items.find(i => i.slotNumber === s);
      slots.push({
        slotNumber: s,
        contentItem: found
      });
    }
    return slots;
  }, [items]);

  return {
    items,
    loading,
    assignSlot,
    getSlots,
    refreshSlots: loadItems
  };
}
