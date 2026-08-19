import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Music, Clock, AlertCircle, RotateCcw } from "lucide-react";
import { List as ActualList } from "react-window";
import { AudioTrack } from "../types";
import { extractTitleFromFilename } from "../utils/playlistUtils";
import { usePlaybackSettings } from "../hooks/usePlaybackSettings";

type SortOption = "none" | "trackNum" | "artist" | "title" | "duration";

export interface TrackListProps {
  tracks: AudioTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onPlayTrack: (index: number) => void;
  addLog?: (message: string, type?: "info" | "warning" | "error") => void;
  playlistId?: string;
  enrichPlaylistMetadata?: (playlistId: string) => Promise<void>;
  enriching?: boolean;
  enrichProgress?: number;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onPlayTrack,
  addLog,
  playlistId,
  enrichPlaylistMetadata,
  enriching = false,
  enrichProgress = 0,
}) => {
  const { settings, updateSettings } = usePlaybackSettings();
  const listRef = useRef<any>(null);
  const [failedTracks, setFailedTracks] = useState<Set<string>>(new Set());

  // Safe-guard against undefined/null tracks
  const safeTracks = React.useMemo(() => tracks || [], [tracks]);

  // Use persisted sort option or default to 'none'
  const sortOption = (settings.sortPreference as SortOption) || "none";

  const setSortOption = (opt: SortOption) => {
    updateSettings({ sortPreference: opt });
    if (addLog) {
      addLog(`Playlist sorting updated: ${opt.toUpperCase()}`, "info");
    }
  };

  // Listen for audio player error events
  useEffect(() => {
    const handleError = (e: any) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'AUDIO') {
        const audio = target as HTMLAudioElement;
        const currentUrl = audio.src;
        if (currentUrl) {
          setFailedTracks((prev) => {
            const next = new Set(prev);
            next.add(currentUrl);
            return next;
          });
          if (addLog) {
            addLog(`Audio stream failed to load source: ${currentUrl}`, "error");
          }
        }
      }
    };

    window.addEventListener("error", handleError, true);

    return () => {
      window.removeEventListener("error", handleError, true);
    };
  }, [addLog]);

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Associate original index to handle clicks correctly when sorted
  const tracksWithOriginalIndex = React.useMemo(() => {
    return safeTracks.map((track, originalIndex) => ({
      track,
      originalIndex,
    }));
  }, [safeTracks]);

  // Perform sorting
  const sortedTracks = React.useMemo(() => {
    const sorted = [...tracksWithOriginalIndex];
    if (sortOption === "artist") {
      sorted.sort((a, b) => (a.track.artist || "").localeCompare(b.track.artist || ""));
    } else if (sortOption === "title") {
      sorted.sort((a, b) => (a.track.title || "").localeCompare(b.track.title || ""));
    } else if (sortOption === "duration") {
      sorted.sort((a, b) => (a.track.length || 0) - (b.track.length || 0));
    } else if (sortOption === "trackNum") {
      const getTrackNumber = (track: AudioTrack) => {
        const filename = track.url.substring(track.url.lastIndexOf("/") + 1);
        const parsed = extractTitleFromFilename(filename || track.title);
        return parsed.trackNumber ?? 9999;
      };
      sorted.sort((a, b) => getTrackNumber(a.track) - getTrackNumber(b.track));
    }
    return sorted;
  }, [tracksWithOriginalIndex, sortOption]);

  // Scroll active track into view on load or when active track changes
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (listRef.current && currentTrackIndex >= 0 && currentTrackIndex < safeTracks.length) {
      const sortedIdx = sortedTracks.findIndex(
        (item) => item.originalIndex === currentTrackIndex
      );
      if (sortedIdx !== -1) {
        // Use timeout to ensure DOM layout is ready before scrolling
        timer = setTimeout(() => {
          if (typeof listRef.current.scrollToRow === "function") {
            listRef.current.scrollToRow({ index: sortedIdx, align: "center" });
          } else if (typeof listRef.current.scrollToItem === "function") {
            listRef.current.scrollToItem(sortedIdx, "center");
          }
        }, 100);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentTrackIndex, sortedTracks, safeTracks.length]);

  const listHeight = Math.min(sortedTracks.length * 56, 350) || 150;
  const hasArchiveUrls = React.useMemo(() => {
    return safeTracks.some(t => t.url && t.url.includes("archive.org/"));
  }, [safeTracks]);

  // Always memoize itemData to prevent re-renders and conform with standard guidelines
  const itemData = React.useMemo(() => ({
    items: sortedTracks,
    currentTrackIndex,
    isPlaying,
    failedTracks,
    safeTracksLength: safeTracks.length,
    onPlayTrack,
  }), [sortedTracks, currentTrackIndex, isPlaying, failedTracks, safeTracks.length, onPlayTrack]);

  const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data?: any }) => {
    // Safely resolve the items data source from context/props or fallback to closure
    const listItems = data?.items || sortedTracks;
    const sortedItem = listItems[index];

    if (!sortedItem || !sortedItem.track) {
      return (
        <div style={style} className="p-3 text-xs text-red-400 bg-transparent flex items-center">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 mr-2 shrink-0" />
          <span>Error: Track frame reference not found ({index})</span>
        </div>
      );
    }

    const { track, originalIndex } = sortedItem;
    const isCurrent = currentTrackIndex === originalIndex;
    const isFailed = failedTracks.has(track.url);

    const handleRetry = (e: React.MouseEvent) => {
      e.stopPropagation();
      setFailedTracks((prev) => {
        const next = new Set(prev);
        next.delete(track.url);
        return next;
      });
      onPlayTrack(originalIndex);
    };

    const handleSkip = (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextIndex = (originalIndex + 1) % safeTracks.length;
      onPlayTrack(nextIndex);
    };

    return (
      <div
        style={style}
        onClick={() => onPlayTrack(originalIndex)}
        className={`p-3 cursor-pointer border-b border-slate-900/50 transition-all flex items-center justify-between group ${
          isCurrent
            ? "bg-blue-600/[0.08] text-white border-l-2 border-blue-500 pl-2.5"
            : "bg-transparent text-slate-400 hover:text-white hover:bg-slate-900/40"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-6 text-right font-mono text-[10px] text-slate-600 font-bold pr-1">
            {isCurrent && isPlaying ? (
              <span className="flex items-end gap-0.5 justify-end h-3 w-3 inline-block">
                <span className="bg-blue-500 w-0.5 h-full animate-pulse block"></span>
                <span className="bg-blue-500 w-0.5 h-2/3 animate-pulse block" style={{ animationDelay: "150ms" }}></span>
                <span className="bg-blue-500 w-0.5 h-1/2 animate-pulse block" style={{ animationDelay: "300ms" }}></span>
              </span>
            ) : (
              `${originalIndex + 1}.`
            )}
          </div>

          <div className="min-w-0 flex-1 relative group/tooltip">
            <h4 className={`text-xs font-bold leading-tight truncate transition-colors ${
              isFailed 
                ? "text-red-500 line-through decoration-red-600/70" 
                : "group-hover:text-blue-400"
            }`}>
              {track.title || "Unnamed Stream"}
            </h4>
            <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1">
              {isFailed && <AlertCircle className="w-2.5 h-2.5 text-red-500 inline shrink-0" />}
              <span>{track.artist || "Unknown Artist"}</span>
            </p>

            {isFailed && (
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover/tooltip:block bg-slate-950 text-red-400 text-[9px] font-mono p-1.5 rounded-xl border border-red-500/20 shadow-lg z-50 whitespace-nowrap">
                Failed to load. Check URL or network.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pl-3 shrink-0">
          {isFailed ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleRetry}
                className="p-1 rounded bg-red-950/40 hover:bg-red-900/30 text-red-400 hover:text-red-350 transition-all font-mono text-[8px] flex items-center gap-0.5 cursor-pointer"
                title="Retry loading this track"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Retry
              </button>
              <button
                onClick={handleSkip}
                className="p-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all font-mono text-[8px] cursor-pointer"
                title="Skip to next track"
              >
                Skip
              </button>
            </div>
          ) : (
            <>
              <span className="font-mono text-[9px] text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 opacity-60" />
                {formatDuration(track.length)}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTrack(originalIndex);
                }}
                className={`p-1.5 rounded-full flex items-center justify-center ${
                  isCurrent && isPlaying ? "bg-red-500" : "bg-blue-600"
                } text-white opacity-0 group-hover:opacity-100 transition-all scale-75 cursor-pointer`}
                aria-label={isCurrent && isPlaying ? "Pause" : "Play"}
              >
                {isCurrent && isPlaying ? (
                  <Pause className="w-2.5 h-2.5 fill-white" />
                ) : (
                  <Play className="w-2.5 h-2.5 fill-white ml-0.2" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full border border-slate-900 rounded-2xl bg-slate-950/20 overflow-hidden">
      {/* TrackList Header containing Sort and Fetch Metadata Controls */}
      <div className="p-3 border-b border-slate-900 bg-slate-950/40 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px] font-mono font-bold text-slate-400">AUDIO QUEUE DIRECTORY</span>
        <div className="flex items-center gap-2 flex-wrap">
          {hasArchiveUrls && enrichPlaylistMetadata && playlistId && (
            <button
              onClick={() => enrichPlaylistMetadata(playlistId)}
              disabled={enriching}
              className={`bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-mono text-[9px] px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer`}
            >
              {enriching ? (
                <>
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-ping"></span>
                  ENRICHING ({enrichProgress}%)
                </>
              ) : (
                "⚡ FETCH METADATA"
              )}
            </button>
          )}

          {failedTracks.size > 0 && (
            <button
              onClick={() => {
                const count = failedTracks.size;
                setFailedTracks(new Set());
                if (addLog) {
                  addLog(`Retrying all ${count} failed tracks. Queue re-primed.`, "info");
                }
                if (currentTrackIndex >= 0 && currentTrackIndex < safeTracks.length) {
                  const currentTrack = safeTracks[currentTrackIndex];
                  if (failedTracks.has(currentTrack.url)) {
                    onPlayTrack(currentTrackIndex);
                  }
                }
              }}
              className="bg-red-950/80 border border-red-500/30 hover:bg-red-900/60 text-red-400 hover:text-red-300 font-mono text-[9px] px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
              title="Clear all failure states and re-try loading failed items"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              RETRY ALL FAILED ({failedTracks.size})
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <label htmlFor="sort-select" className="text-[9px] font-mono text-slate-500">SORT:</label>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[9px] font-mono text-slate-300 outline-none focus:border-blue-500"
            >
              <option value="none">Original</option>
              <option value="trackNum">Track #</option>
              <option value="artist">Artist A-Z</option>
              <option value="title">Title A-Z</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Virtualized List Container */}
      <div className="flex-1 select-none min-h-[150px]" aria-label="Virtualized Track List">
        {sortedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 h-[200px] text-slate-500 font-medium">
            <Music className="w-8 h-8 opacity-40 mb-2 animate-pulse" />
            <span className="text-xs">No tracks in this playlist</span>
          </div>
        ) : (
          <ActualList
            listRef={listRef}
            style={{ height: listHeight, width: '100%' }}
            rowCount={sortedTracks.length}
            rowHeight={56}
            rowProps={itemData}
            rowComponent={Row as any}
            className="scrollbar-thin"
          />
        )}
      </div>

      {/* Footer statistics Panel */}
      <div className="p-2 border-t border-slate-900 bg-slate-950/40 flex items-center justify-between text-[9px] font-mono text-slate-550 font-bold select-none px-4">
        <span>TOTAL SHUTTLES: {safeTracks.length}</span>
        <span>RENDERED: VIRTUALIZED ({sortedTracks.length})</span>
      </div>
    </div>
  );
};
