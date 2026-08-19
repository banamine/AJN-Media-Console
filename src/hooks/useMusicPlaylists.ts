import { useState, useEffect, useCallback, useRef } from "react";
import { MusicPlaylist } from "../types";
import { getDBValue, putsDBValue } from "../services/IndexedDB";

const STORE_NAME = "music_playlists";

export function useMusicPlaylists() {
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const stored = await getDBValue<{ key: string; value: MusicPlaylist[] }>(STORE_NAME, "all");
        if (active) {
          if (stored && stored.value) {
            setPlaylists(stored.value);
          } else {
            setPlaylists([]);
          }
        }
      } catch (err) {
        console.error("Failed to load music playlists:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const persistPlaylists = useCallback((updated: MusicPlaylist[]) => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(async () => {
      try {
        await putsDBValue(STORE_NAME, { key: "all", value: updated });
      } catch (err) {
        console.error("Failed to persist music playlists to IndexedDB:", err);
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

  const createPlaylist = useCallback((
    name: string,
    description?: string,
    trackIds?: string[],
    extra?: Partial<Omit<MusicPlaylist, 'id' | 'name' | 'description' | 'tracks' | 'createdAt' | 'updatedAt'>>
  ) => {
    const newPl: MusicPlaylist = {
      id: `pl-${Date.now()}`,
      name,
      description: description || "",
      tracks: trackIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra
    };
    setPlaylists(prev => {
      const updated = [...prev, newPl];
      persistPlaylists(updated);
      return updated;
    });
    return newPl;
  }, [persistPlaylists]);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== id);
      persistPlaylists(updated);
      return updated;
    });
  }, [persistPlaylists]);

  const updatePlaylist = useCallback((id: string, name: string, description?: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p =>
        p.id === id
          ? {
              ...p,
              name,
              description: description !== undefined ? description : p.description,
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      persistPlaylists(updated);
      return updated;
    });
  }, [persistPlaylists]);

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id === playlistId) {
          if (p.tracks.includes(trackId)) return p; // Prevent duplicates
          return {
            ...p,
            tracks: [...p.tracks, trackId],
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      persistPlaylists(updated);
      return updated;
    });
  }, [persistPlaylists]);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p =>
        p.id === playlistId
          ? {
              ...p,
              tracks: p.tracks.filter(id => id !== trackId),
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      persistPlaylists(updated);
      return updated;
    });
  }, [persistPlaylists]);

  const clearAllPlaylists = useCallback(() => {
    setPlaylists([]);
    persistPlaylists([]);
  }, [persistPlaylists]);

  return {
    playlists,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    clearAllPlaylists,
    loading,
  };
}
