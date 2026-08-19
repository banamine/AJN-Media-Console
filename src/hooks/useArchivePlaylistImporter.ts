import { useState, useRef, useCallback } from "react";
import { MusicTrack, MusicPlaylist } from "../types";
import { getCachedImport, setCachedImport } from "../services/IndexedDB";
import { toastService } from "../utils/toast";
import { detectArchiveUrlType, extractArchiveDetails } from "../utils/archiveUtils";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


interface UseArchivePlaylistImporterProps {
  allTracks: MusicTrack[];
  addTracks: (tracks: MusicTrack[]) => Promise<void>;
  createPlaylist: (
    name: string,
    description?: string,
    trackIds?: string[],
    extra?: Partial<Omit<MusicPlaylist, 'id' | 'name' | 'description' | 'tracks' | 'createdAt' | 'updatedAt'>>
  ) => any;
  addLog: (message: string, type?: "info" | "warning" | "error") => void;
  onSuccess?: (playlistId: string) => void;
}

export interface BatchItem {
  url: string;
  status: 'pending' | 'importing' | 'success' | 'failed';
  playlistId?: string;
  errorMessage?: string;
}

export interface BatchProgress {
  current: number;
  total: number;
  status: 'idle' | 'importing' | 'done' | 'error';
  results: BatchItem[];
}

export function useArchivePlaylistImporter({
  allTracks,
  addTracks,
  createPlaylist,
  addLog,
  onSuccess
}: UseArchivePlaylistImporterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Batch import states
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    current: 0,
    total: 0,
    status: 'idle',
    results: []
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isBatchCancelledRef = useRef<boolean>(false);

  const cancelImport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setError("Import cancelled by user.");
    addLog("Archive.org playlist import cancelled by user.", "warning");
  }, [addLog]);

  const cancelBatch = useCallback(() => {
    isBatchCancelledRef.current = true;
    cancelImport();
    setBatchProgress(prev => ({
      ...prev,
      status: 'error'
    }));
    toastService.showImportError("Batch import was cancelled by the user.");
  }, [cancelImport]);

  // Shared routine to insert tracks, create playlist, and save to IndexedDB cache
  const processAndCreatePlaylist = useCallback(async (
    url: string,
    incomingTracks: MusicTrack[],
    rawThumb: string | null,
    titleName: string,
    isFromBatch: boolean,
    extraMetadata?: Partial<Omit<MusicPlaylist, 'id' | 'name' | 'description' | 'tracks' | 'createdAt' | 'updatedAt'>>
  ): Promise<string | null> => {
    if (!isFromBatch) {
      setTracks(incomingTracks);
      setThumbnailUrl(rawThumb);
      setPlaylistName(titleName);
      setProgress(100);
    }

    if (incomingTracks.length === 0) {
      throw new Error("No audio tracks found in the given playlist.");
    }

    // Create map of existing tracks by url for deduplication
    const existingTracksByUrl = new Map<string, MusicTrack>();
    for (const t of allTracks) {
      if (t.url) {
        existingTracksByUrl.set(t.url, t);
      }
    }

    const tracksToInsert: MusicTrack[] = [];
    const playlistTrackIds: string[] = [];

    for (const track of incomingTracks) {
      const existing = existingTracksByUrl.get(track.url);
      if (existing) {
        playlistTrackIds.push(existing.id!);
      } else {
        tracksToInsert.push(track);
        playlistTrackIds.push(track.id!);
      }
    }

    // Save only new tracks
    if (tracksToInsert.length > 0) {
      await addTracks(tracksToInsert);
    }

    // Create the Playlist
    const desc = `Archive.org compilation containing ${incomingTracks.length} tracks.`;
    const pl = createPlaylist(titleName, desc, playlistTrackIds, extraMetadata);

    addLog(`Playlist "${titleName}" successfully imported/synchronized! Added ${tracksToInsert.length} new tracks to library, referencing ${playlistTrackIds.length} tracks overall`, "info");
    
    // Cache success
    if (pl && pl.id) {
      await setCachedImport(url.trim(), pl.id, incomingTracks.length);
    }

    if (!isFromBatch) {
      setIsLoading(false);
      abortControllerRef.current = null;
      if (pl && pl.id) {
        onSuccess?.(pl.id);
      }
      toastService.showImportSuccess(titleName, incomingTracks.length, rawThumb || undefined);
    }
    return pl?.id || null;
  }, [allTracks, addTracks, createPlaylist, addLog, onSuccess]);

  const importPlaylist = useCallback(async (url: string, isFromBatch = false, preferredFormat = "all"): Promise<string | null> => {
    if (!url.trim()) {
      if (!isFromBatch) setError("Please provide a valid Archive.org item or M3U URL.");
      return null;
    }

    const trimmedUrl = url.trim();

    if (!isFromBatch) {
      setIsLoading(true);
      setProgress(0);
      setError(null);
      setTracks([]);
      setThumbnailUrl(null);
      setPlaylistName("");
    }

    // 1. Check client-side Cache First
    addLog(`Checking import cache for: ${trimmedUrl}`, "info");
    const cached = await getCachedImport(trimmedUrl);
    if (cached) {
      addLog(`Cache hit! Loaded existing playlist ID: ${cached.playlistId}`, "info");
      
      if (!isFromBatch) {
        setProgress(100);
        setIsLoading(false);
        const displayName = trimmedUrl.split("/").pop() || "Cached Playlist";
        setPlaylistName(displayName);
        onSuccess?.(cached.playlistId);
        toastService.showImportSuccess(displayName, cached.trackCount);
      }
      return cached.playlistId;
    }

    const urlType = detectArchiveUrlType(trimmedUrl);
    if (urlType === 'unknown') {
      const errorMsg = "Invalid archive.org URL. Please paste a valid item or M3U link.";
      if (!isFromBatch) {
        setError(errorMsg);
        toastService.showImportError(errorMsg);
      }
      addLog(`Validation failed: ${trimmedUrl} is not a valid archive.org URL`, "error");
      return null;
    }

    // Setup active AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (urlType === 'm3u') {
      addLog(`Initiating streaming M3U import for archive.org asset...`, "info");
      try {
        // Build SSE URL
        const fetchUrl = `/api/playlist/import-from-archive?stream=true&url=${encodeURIComponent(trimmedUrl)}`;
        const response = await fetch(fetchUrl, {
          signal: controller.signal
        });

        if (response.status === 429) {
          setRetryCount(prev => prev + 1);
          throw new Error("Archive.org is rate-limiting requests. Please wait a moment and try again.");
        }

        if (!response.ok) {
          throw new Error(`Failed to initiate stream: HTTP status ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Target response stream is not readable.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        // Read remote stream chunks
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6);
            try {
              const dataObj = JSON.parse(jsonStr);
              if (dataObj.type === "progress") {
                if (!isFromBatch) {
                  setProgress(dataObj.value);
                }
              } else if (dataObj.type === "complete") {
                const incomingTracks: MusicTrack[] = dataObj.tracks || [];
                const rawThumb = dataObj.thumbnailUrl || null;
                const titleName = dataObj.playlistName || "Imported Playlist";

                const plId = await processAndCreatePlaylist(trimmedUrl, incomingTracks, rawThumb, titleName, isFromBatch);
                return plId;
              } else if (dataObj.type === "error") {
                throw new Error(dataObj.message || "Unknown proxy error.");
              }
            } catch (jsonErr: any) {
              if (jsonErr.message && (jsonErr.message.includes("No tracks") || jsonErr.message.includes("returned status") || jsonErr.message.includes("URL did not return"))) {
                throw jsonErr;
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          if (!isFromBatch) setError("Import aborted.");
        } else {
          const errorMsg = err.message || "Faulty in-flight streaming network error.";
          if (!isFromBatch) {
            setError(errorMsg);
            toastService.showImportError(errorMsg);
          }
          addLog(`Import failed: ${errorMsg}`, "error");
          throw err;
        }
      } finally {
        if (!isFromBatch) {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      }
    } else if (urlType === 'item') {
      const details = extractArchiveDetails(trimmedUrl);
      const identifier = details?.identifier;
      const targetFilename = details?.filename;
      if (!identifier) {
        const errorMsg = "Could not extract identifier from Archive.org URL.";
        if (!isFromBatch) {
          setError(errorMsg);
          toastService.showImportError(errorMsg);
        }
        addLog(`Validation failed: unable to extract identifier from ${trimmedUrl}`, "error");
        return null;
      }

      addLog(`Fetching metadata for Archive.org item: ${identifier}...`, "info");
      if (!isFromBatch) setProgress(30);

      try {
        const response = await fetch(BACKEND_URL + "/api/playlist/import-from-archive-metadata", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ identifier, preferredFormat, targetFilename }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        if (!isFromBatch) setProgress(70);

        const dataObj = await response.json();
        if (!dataObj.success) {
          throw new Error(dataObj.error || "Failed to fetch metadata from server.");
        }

        const rawTracks = dataObj.tracks || [];
        const rawThumb = dataObj.thumbnailUrl || null;
        const titleName = dataObj.playlistName || identifier;

        const incomingTracks: MusicTrack[] = rawTracks.map((t: any, index: number) => ({
          id: `track-arch-${identifier}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: t.title,
          artist: t.artist,
          length: t.duration,
          duration: t.duration,
          url: t.url,
          sourceType: "music",
          genre: "Archive Broadcast",
          album: titleName,
          year: new Date().getFullYear(),
          dateAdded: new Date().toISOString(),
          part: t.part
        }));

        const plId = await processAndCreatePlaylist(
          trimmedUrl,
          incomingTracks,
          rawThumb,
          titleName,
          isFromBatch,
          {
            thumbnailUrl: rawThumb || undefined,
            venue: dataObj.venue || undefined,
            date: dataObj.date || undefined,
            artist: dataObj.artist || undefined,
            format: dataObj.preferredFormat || undefined
          }
        );
        return plId;
      } catch (err: any) {
        if (err.name === "AbortError") {
          if (!isFromBatch) setError("Import aborted.");
        } else {
          const errorMsg = err.message || "Failed to fetch Archive.org metadata.";
          if (!isFromBatch) {
            setError(errorMsg);
            toastService.showImportError(errorMsg);
          }
          addLog(`Import failed: ${errorMsg}`, "error");
          throw err;
        }
      } finally {
        if (!isFromBatch) {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      }
    }

    return null;
  }, [allTracks, addTracks, createPlaylist, addLog, onSuccess, processAndCreatePlaylist]);

  // High performance parallel batch importer using the backend batch endpoint
  const importBatch = useCallback(async (urls: string[], preferredFormat = "all") => {
    const cleanUrls = urls.map(u => u.trim()).filter(Boolean);
    if (cleanUrls.length === 0) {
      toastService.showImportError("No valid URLs provided inside the batch paste section.");
      return;
    }

    isBatchCancelledRef.current = false;
    setIsLoading(true);
    setError(null);

    const initialResults: BatchItem[] = cleanUrls.map(url => ({
      url,
      status: 'pending'
    }));

    setBatchProgress({
      current: 0,
      total: cleanUrls.length,
      status: 'importing',
      results: initialResults
    });

    const succeededNames: string[] = [];
    let failedCount = 0;

    const activeResults = [...initialResults];
    const unresolvedUrls: string[] = [];
    const unresolvedIndices: number[] = [];

    for (let i = 0; i < cleanUrls.length; i++) {
      const url = cleanUrls[i];
      const cached = await getCachedImport(url);
      if (cached) {
        succeededNames.push(url.split("/").pop() || "Archive Playlist");
        activeResults[i] = {
          url,
          status: 'success',
          playlistId: cached.playlistId
        };
        addLog(`[Batch Cache Hit] "${url}" is already imported.`, "info");
      } else {
        const urlType = detectArchiveUrlType(url);
        if (urlType === 'unknown') {
          failedCount++;
          activeResults[i] = {
            url,
            status: 'failed',
            errorMessage: "Invalid Archive.org URL"
          };
          addLog(`[Batch Error] Invalid Archive.org URL: ${url}`, "error");
        } else {
          unresolvedUrls.push(url);
          unresolvedIndices.push(i);
        }
      }
    }

    setBatchProgress({
      current: cleanUrls.length - unresolvedUrls.length,
      total: cleanUrls.length,
      status: unresolvedUrls.length > 0 ? 'importing' : 'done',
      results: activeResults
    });

    if (unresolvedUrls.length === 0) {
      setIsLoading(false);
      toastService.showBatchComplete(cleanUrls.length, failedCount, succeededNames);
      return;
    }

    const m3uTasks: { url: string; index: number }[] = [];
    const itemTasks: { url: string; index: number; identifier: string; targetFilename?: string }[] = [];

    for (let j = 0; j < unresolvedUrls.length; j++) {
      const url = unresolvedUrls[j];
      const index = unresolvedIndices[j];
      const urlType = detectArchiveUrlType(url);
      
      if (urlType === 'm3u') {
        m3uTasks.push({ url, index });
      } else if (urlType === 'item') {
        const details = extractArchiveDetails(url);
        if (details?.identifier) {
          itemTasks.push({ url, index, identifier: details.identifier, targetFilename: details.filename });
        } else {
          failedCount++;
          activeResults[index] = {
            url,
            status: 'failed',
            errorMessage: "Unable to parse identifier"
          };
          addLog(`[Batch Error] Unable to parse identifier from URL: ${url}`, "error");
        }
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Process Archive.org metadata items in parallel
    if (itemTasks.length > 0 && !isBatchCancelledRef.current) {
      const tasks = itemTasks.map(t => ({ identifier: t.identifier, targetFilename: t.targetFilename }));
      addLog(`[Batch API] Fetching metadata for ${tasks.length} items in parallel...`, "info");

      setBatchProgress(prev => {
        const updated = [...prev.results];
        itemTasks.forEach(t => {
          updated[t.index] = { ...updated[t.index], status: 'importing' };
        });
        return { ...prev, results: updated };
      });

      try {
        const response = await fetch(BACKEND_URL + "/api/playlist/import-batch-archive-metadata", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ tasks, preferredFormat }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Batch metadata endpoint returned status ${response.status}`);
        }

        const dataObj = await response.json();
        if (dataObj.success && dataObj.results) {
          const resultsMap = new Map<string, any>();
          for (const res of dataObj.results) {
            resultsMap.set(res.identifier, res);
          }

          for (const task of itemTasks) {
            if (isBatchCancelledRef.current) break;

            const resData = resultsMap.get(task.identifier);
            if (resData && resData.success) {
              try {
                const rawTracks = resData.tracks || [];
                const rawThumb = resData.thumbnailUrl || null;
                const titleName = resData.playlistName || task.identifier;

                const incomingTracks: MusicTrack[] = rawTracks.map((t: any, index: number) => ({
                  id: `track-arch-${task.identifier}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  title: t.title,
                  artist: t.artist,
                  length: t.duration,
                  duration: t.duration,
                  url: t.url,
                  sourceType: "music",
                  genre: "Archive Broadcast",
                  album: titleName,
                  year: new Date().getFullYear(),
                  dateAdded: new Date().toISOString(),
                  part: t.part
                }));

                const plId = await processAndCreatePlaylist(
                  task.url,
                  incomingTracks,
                  rawThumb,
                  titleName,
                  true,
                  {
                    thumbnailUrl: rawThumb || undefined,
                    venue: resData.venue || undefined,
                    date: resData.date || undefined,
                    artist: resData.artist || undefined,
                    format: resData.preferredFormat || undefined
                  }
                );
                if (plId) {
                  succeededNames.push(titleName);
                  setBatchProgress(prev => {
                    const updated = [...prev.results];
                    updated[task.index] = { ...updated[task.index], status: 'success', playlistId: plId };
                    return {
                      ...prev,
                      current: prev.current + 1,
                      results: updated
                    };
                  });
                } else {
                  throw new Error("Failed to store playlist");
                }
              } catch (importErr: any) {
                failedCount++;
                const errStr = importErr.message || "Failed to process item";
                setBatchProgress(prev => {
                  const updated = [...prev.results];
                  updated[task.index] = { ...updated[task.index], status: 'failed', errorMessage: errStr };
                  return {
                    ...prev,
                    current: prev.current + 1,
                    results: updated
                  };
                });
                addLog(`[Batch Error] Failed to process ${task.identifier}: ${errStr}`, "error");
              }
            } else {
              failedCount++;
              const errStr = resData?.error || "Failed to fetch metadata";
              setBatchProgress(prev => {
                const updated = [...prev.results];
                updated[task.index] = { ...updated[task.index], status: 'failed', errorMessage: errStr };
                return {
                  ...prev,
                  current: prev.current + 1,
                  results: updated
                };
              });
              addLog(`[Batch Error] Metadata retrieval failed for ${task.identifier}: ${errStr}`, "error");
            }
          }
        } else {
          throw new Error("Metadata batch endpoint returned unsuccessful");
        }
      } catch (batchErr: any) {
        addLog(`[Batch Error] Batch metadata fetch failed: ${batchErr.message}`, "error");
        for (const task of itemTasks) {
          if (isBatchCancelledRef.current) break;
          try {
            const plId = await importPlaylist(task.url, true);
            if (plId) {
              succeededNames.push(task.url.split("/").pop() || "Archive Playlist");
              setBatchProgress(prev => {
                const updated = [...prev.results];
                updated[task.index] = { ...updated[task.index], status: 'success', playlistId: plId };
                return { ...prev, current: prev.current + 1, results: updated };
              });
            } else {
              throw new Error("Import failed");
            }
          } catch (seqErr: any) {
            failedCount++;
            setBatchProgress(prev => {
              const updated = [...prev.results];
              updated[task.index] = { ...updated[task.index], status: 'failed', errorMessage: seqErr.message || "Sequential fallback failed" };
              return { ...prev, current: prev.current + 1, results: updated };
            });
          }
        }
      }
    }

    // Process streaming M3U tasks sequentially
    for (const task of m3uTasks) {
      if (isBatchCancelledRef.current) break;

      setBatchProgress(prev => {
        const updated = [...prev.results];
        updated[task.index] = { ...updated[task.index], status: 'importing' };
        return { ...prev, results: updated };
      });

      try {
        const plId = await importPlaylist(task.url, true);
        if (plId) {
          succeededNames.push(task.url.split("/").pop() || "M3U Playlist");
          setBatchProgress(prev => {
            const updated = [...prev.results];
            updated[task.index] = { ...updated[task.index], status: 'success', playlistId: plId };
            return {
              ...prev,
              current: prev.current + 1,
              results: updated
            };
          });
        } else {
          throw new Error("No playlist output received.");
        }
      } catch (m3uErr: any) {
        failedCount++;
        const errStr = m3uErr.message || "Failed to process M3U stream";
        setBatchProgress(prev => {
          const updated = [...prev.results];
          updated[task.index] = { ...updated[task.index], status: 'failed', errorMessage: errStr };
          return {
            ...prev,
            current: prev.current + 1,
            results: updated
          };
        });
        addLog(`[Batch Error] M3U import failed for ${task.url}: ${errStr}`, "error");
      }
    }

    setIsLoading(false);
    if (!isBatchCancelledRef.current) {
      setBatchProgress(prev => ({
        ...prev,
        status: failedCount === cleanUrls.length ? 'error' : 'done'
      }));

      toastService.showBatchComplete(cleanUrls.length, failedCount, succeededNames);
      addLog(`Batch import complete. Successfully loaded ${cleanUrls.length - failedCount} of ${cleanUrls.length} playlists!`, "info");
    }
  }, [importPlaylist, processAndCreatePlaylist, addLog]);

  return {
    isLoading,
    progress,
    tracks,
    thumbnailUrl,
    playlistName,
    error,
    retryCount,
    batchProgress,
    importPlaylist,
    cancelImport,
    importBatch,
    cancelBatch
  };
}
