/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentItem } from "../types";

export class ConflictManager {
  /**
   * Normalizes incoming ContentItem metadata and checks for URL/Title collisions against existing items.
   * If a collision is detected, flags the item as in conflict rather than discarding it.
   */
  public static normalizeAndResolve(
    newItem: ContentItem,
    existingItems: ContentItem[]
  ): ContentItem {
    // 1. Metadata Normalization Check
    if (!newItem.url || newItem.url.trim() === "") {
      newItem.url = newItem.backupUrl || "";
    }
    
    if (!newItem.durationSeconds || newItem.durationSeconds <= 0) {
      newItem.durationSeconds = newItem.duration || 3600;
    }
    
    if (!newItem.thumbnailUrl || newItem.thumbnailUrl.trim() === "") {
      newItem.thumbnailUrl = "https://archive.org/download/daily-highlights/lmbsa.png";
    }

    // 2. Conflict / Metadata Collision Check (URL or Title collision)
    const collision = existingItems.find(
      (existing) =>
        existing.id !== newItem.id &&
        (existing.url === newItem.url || existing.title.toLowerCase() === newItem.title.toLowerCase())
    );

    if (collision) {
      newItem.hasConflict = true;
      newItem.conflictSources = [
        {
          id: collision.id,
          name: "Existing Matrix Slot Asset",
          url: collision.url,
          priority: 90
        },
        {
          id: newItem.id + "_incoming",
          name: "Incoming RSS Feed Stream",
          url: newItem.url,
          priority: 80
        }
      ];
    } else {
      newItem.hasConflict = false;
    }

    return newItem;
  }
}
