/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { FolderRegistry } from "../../types";
import { getAllDBValues, deleteDBValue } from "../../services/IndexedDB";
import { safeWrite } from "../../services/ProtocolResilienceEngine";

export function useFolderRegistry() {
  const [folders, setFolders] = useState<FolderRegistry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      let list = await getAllDBValues<FolderRegistry>("folders");
      
      // Ensure default system locked unorganized folder exists
      const unorganizedId = "folder_unorganized";
      if (!list.find(f => f.id === unorganizedId)) {
        const defaultFolder: FolderRegistry = {
          id: unorganizedId,
          name: "Unorganized Broadcasts",
          description: "Default fallback landing zone for batch imports and unmapped URLs.",
          icon: "📁",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sortIndex: 0,
          isSystemLocked: true,
          tags: ["SYSTEM", "DEFAULT"]
        };
        await safeWrite("folders", defaultFolder);
        list = [defaultFolder, ...list];
      }

      // Sort by sortIndex then name
      list.sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name));
      setFolders(list);
    } catch (err) {
      console.error("[useFolderRegistry] Error loading folders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const addFolder = useCallback(async (name: string, description?: string, icon: string = "📁") => {
    const id = `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newFolder: FolderRegistry = {
      id,
      name,
      description,
      icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortIndex: folders.length + 1
    };
    const ok = await safeWrite("folders", newFolder);
    if (ok) await loadFolders();
    return ok;
  }, [folders.length, loadFolders]);

  const removeFolder = useCallback(async (id: string) => {
    const target = folders.find(f => f.id === id);
    if (target?.isSystemLocked) {
      console.warn("[useFolderRegistry] Cannot delete system locked folder.");
      return false;
    }
    try {
      await deleteDBValue("folders", id);
      setFolders(prev => prev.filter(f => f.id !== id));
      return true;
    } catch (e) {
      console.error("[useFolderRegistry] Delete failed:", e);
      return false;
    }
  }, [folders]);

  return {
    folders,
    loading,
    addFolder,
    removeFolder,
    refreshFolders: loadFolders
  };
}
