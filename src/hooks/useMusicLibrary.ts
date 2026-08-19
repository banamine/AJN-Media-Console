import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MusicTrack } from "../types";
import { getDBValue, putsDBValue } from "../services/IndexedDB";

const STORE_NAME = "music_library";
const PAGE_SIZE = 10;

const DEFAULT_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "track-1",
    title: "Sirius",
    artist: "The Alan Parsons Project",
    url: "https://ia902907.us.archive.org/31/items/capture-25-april-2026-03-06-58-pm-00000/The%20Alan%20Parsons%20Project%20-%20Sirius%20%28Official%20Audio%29.mp3",
    backups: [
      "https://archive.org/download/the-alan-parsons-project-sirius_202111/The%20Alan%20Parsons%20Project%20-%20Sirius.mp3",
      "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/The%20Alan%20Parsons%20Project%20-%20Sirius%20(Official%20Audio).mp3"
    ],
    genre: "Progressive Rock",
    album: "Eye in the Sky",
    year: 1982,
    dateAdded: new Date("2026-01-15T12:00:00Z").toISOString(),
    isFavorite: true,
    sourceType: "sirius",
  },
  {
    id: "track-2",
    title: "Ace of Spades",
    artist: "LMBSA",
    url: "https://ia902907.us.archive.org/31/items/capture-25-april-2026-03-06-58-pm-00000/LMBSA%20-%20Ace%20of%20Spades.mp3",
    backups: [
      "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/Motorhead%20-%20Ace%20Of%20Spades%20(Official%20Audio).mp3",
      "https://archive.org/download/motorhead-ace-of-spades-official-audio/Motorhead%20-%20Ace%20Of%20Spades%20%28Official%20Audio%29.mp3"
    ],
    genre: "Heavy Metal",
    album: "Ace of Spades",
    year: 1980,
    dateAdded: new Date("2026-02-10T12:00:00Z").toISOString(),
    isFavorite: false,
    sourceType: "sirius",
  },
  {
    id: "track-3",
    title: "Remember the Fallen",
    artist: "LMBSA",
    url: "https://ia902907.us.archive.org/31/items/capture-25-april-2026-03-06-58-pm-00000/Remember%20the%20Fallen.mp3",
    backups: [
      "https://raw.githubusercontent.com/banamine/AJN-Resource-Hub/main/Sodom%20-%20Remember%20The%20Fallen%20(Official%20Audio).mp3",
      "https://archive.org/download/sodom-remember-the-fallen-official-audio/Sodom%20-%20Remember%20The%20Fallen%20%28Official%20Audio%29.mp3"
    ],
    genre: "Thrash Metal",
    album: "Agent Orange",
    year: 1989,
    dateAdded: new Date("2026-03-05T12:00:00Z").toISOString(),
    isFavorite: false,
    sourceType: "sirius",
  }
];

export function useMusicLibrary() {
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "artist" | "genre" | "length" | "dateAdded">("title");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  // Load all tracks from IndexedDB or seed defaults on mount
  useEffect(() => {
    let active = true;
    const loadTracks = async () => {
      try {
        setLoading(true);
        const stored = await getDBValue<{ key: string; value: MusicTrack[] }>(STORE_NAME, "all");
        if (active) {
          if (stored && stored.value) {
            setAllTracks(stored.value);
          } else {
            setAllTracks(DEFAULT_MUSIC_TRACKS);
            await putsDBValue(STORE_NAME, { key: "all", value: DEFAULT_MUSIC_TRACKS });
          }
        }
      } catch (err) {
        console.error("Failed to load music library tracks:", err);
        if (active) {
          setAllTracks(DEFAULT_MUSIC_TRACKS);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadTracks();
    return () => {
      active = false;
    };
  }, []);

  // Filter and sort the collection of tracks
  const filtered = useMemo(() => {
    let result = [...allTracks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q)) ||
        (t.genre && t.genre.toLowerCase().includes(q)) ||
        (t.album && t.album.toLowerCase().includes(q))
      );
    }
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "artist":
          return (a.artist || "").localeCompare(b.artist || "");
        case "genre":
          return (a.genre || "").localeCompare(b.genre || "");
        case "length":
          return (a.length || 0) - (b.length || 0);
        case "dateAdded":
          return new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime();
        default:
          return 0;
      }
    });
    return result;
  }, [allTracks, searchQuery, sortBy]);

  // Handle pagination of visible portion
  const visibleTracks = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  const loadMore = useCallback(() => {
    if (visibleCount < filtered.length) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filtered.length));
    }
  }, [visibleCount, filtered.length]);

  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncePersist = useCallback((tracks: MusicTrack[]) => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(async () => {
      try {
        await putsDBValue(STORE_NAME, { key: "all", value: tracks });
      } catch (e) {
        console.error("IndexedDB persist failed:", e);
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

  const toggleFavorite = useCallback((trackId: string) => {
    setAllTracks(prev => {
      const updated = prev.map(t =>
        t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t
      );
      debouncePersist(updated);
      return updated;
    });
  }, [debouncePersist]);

  const addTracks = useCallback(async (newTracks: MusicTrack[]) => {
    setAllTracks(prev => {
      const updated = [...prev, ...newTracks];
      debouncePersist(updated);
      return updated;
    });
  }, [debouncePersist]);

  const updateTrack = useCallback((id: string, updates: Partial<Omit<MusicTrack, 'id' | 'dateAdded'>>) => {
    setAllTracks(prev => {
      const updated = prev.map(track =>
        track.id === id
          ? { ...track, ...updates, updatedAt: new Date().toISOString() }
          : track
      );
      debouncePersist(updated);
      return updated;
    });
  }, [debouncePersist]);

  const clearLibrary = useCallback(() => {
    setAllTracks(DEFAULT_MUSIC_TRACKS);
    debouncePersist(DEFAULT_MUSIC_TRACKS);
  }, [debouncePersist]);

  return {
    allTracks,
    filteredTracks: filtered,
    visibleTracks,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    visibleCount,
    loadMore,
    toggleFavorite,
    addTracks,
    updateTrack,
    clearLibrary,
    loading,
  };
}
