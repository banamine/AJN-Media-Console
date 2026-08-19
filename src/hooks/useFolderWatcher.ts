/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { WatchedFolder } from "../types";
import { FolderWatcher } from "../services/FolderWatcher";

export function useFolderWatcher() {
  const [folders, setFolders] = useState<WatchedFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    try {
      await FolderWatcher.initSampleFolders();
      const list = await FolderWatcher.getWatchedFolders();
      setFolders(list);
    } catch (e) {
      console.error("Failed to query folder watcher registries:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const watchPath = useCallback(async (path: string, autoPoll: boolean = false) => {
    try {
      const added = await FolderWatcher.watchFolder(path, autoPoll);
      await fetchFolders();
      return added;
    } catch (e) {
      console.error("Failed to append folder watch path:", e);
      throw e;
    }
  }, [fetchFolders]);

  const unwatchPath = useCallback(async (id: string) => {
    try {
      await FolderWatcher.unwatchFolder(id);
      await fetchFolders();
    } catch (e) {
      console.error("Failed to remove folder watch path:", e);
    }
  }, [fetchFolders]);

  const scanFolder = useCallback(async (id: string) => {
    setActiveScanId(id);
    try {
      const mappedChannels = await FolderWatcher.forceScan(id);
      await fetchFolders();
      return mappedChannels;
    } catch (e) {
      console.error("Folder scan failed:", e);
      return [];
    } finally {
      setActiveScanId(null);
    }
  }, [fetchFolders]);

  return {
    folders,
    loading,
    activeScanId,
    watchPath,
    unwatchPath,
    scanFolder,
    reloadFolders: fetchFolders,
  };
}
