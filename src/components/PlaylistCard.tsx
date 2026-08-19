import React from "react";
import { MusicPlaylist } from "../types";
import { Music, Calendar, Layers, MapPin } from "lucide-react";

interface PlaylistCardProps {
  playlist: MusicPlaylist & { thumbnailUrl?: string | null; isSmart?: boolean; rules?: any[] };
  onClick: () => void;
  active?: boolean;
  customTrackCount?: number;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = React.memo(({ playlist, onClick, active = false, customTrackCount }) => {
  const trackCount = customTrackCount !== undefined ? customTrackCount : (playlist.tracks?.length || 0);
  const showThumbnail = !!playlist.thumbnailUrl;
  
  const formattedDate = React.useMemo(() => {
    try {
      if (!playlist.createdAt) return "N/A";
      const date = new Date(playlist.createdAt);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "Unknown Date";
    }
  }, [playlist.createdAt]);

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3.5 p-3 rounded-2xl border transition-all duration-300 cursor-pointer select-none ${
        active
          ? "bg-blue-600/10 border-blue-500/60 shadow-lg shadow-blue-900/10"
          : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-850/60 hover:border-slate-700 hover:shadow-md"
      }`}
    >
      {/* Side Color Highlight on Hover or Active */}
      <div 
        className={`absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full transition-all duration-300 ${
          active ? "bg-blue-500 h-1/2" : "bg-transparent group-hover:bg-slate-600 group-hover:h-1/2"
        }`} 
      />

      {/* Left Cover Art Area */}
      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-800/60 border border-slate-705/30 flex items-center justify-center shrink-0">
        {showThumbnail ? (
          <img
            src={playlist.thumbnailUrl!}
            alt={playlist.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="text-slate-500 group-hover:text-blue-400 transition-colors duration-300">
            <Music className="w-6 h-6" />
          </div>
        )}
        
        {/* Hover play icon overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
          <div className="w-7 h-7 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
            <span className="text-[10px] font-mono font-bold leading-none">▶</span>
          </div>
        </div>
      </div>

      {/* Right Metadata Area */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-start justify-between gap-1">
          <h3 className={`text-sm font-semibold truncate transition-colors duration-300 flex-1 ${
            active ? "text-blue-400 font-bold" : "text-slate-100 group-hover:text-blue-300"
          }`}>
            {playlist.name}
            {playlist.isSmart && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-450 border border-indigo-500/25 text-[8px] font-mono font-bold align-middle inline-block">
                ⚡ SMART
              </span>
            )}
          </h3>
          {playlist.format && playlist.format !== "all" && (
            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[8px] tracking-wider uppercase shrink-0 ${
              playlist.format === "flac" 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            }`}>
              {playlist.format}
            </span>
          )}
        </div>
        
        {playlist.description && (
          <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
            {playlist.description}
          </p>
        )}

        {/* Live Music / Concert Metadata */}
        {(playlist.artist || playlist.venue || playlist.date) && (
          <div className="flex flex-wrap gap-1.5 items-center mt-1 text-[9px] text-slate-400 font-mono">
            {playlist.artist && playlist.artist !== "Unknown Artist" && (
              <span className="bg-blue-500/10 text-blue-400 px-1 py-0.2 rounded border border-blue-500/10 max-w-[120px] truncate" title={playlist.artist}>
                {playlist.artist}
              </span>
            )}
            {playlist.date && (
              <span className="bg-amber-500/10 text-amber-400 px-1 py-0.2 rounded border border-amber-500/10">
                {playlist.date}
              </span>
            )}
            {playlist.venue && (
              <span className="flex items-center gap-0.5 text-slate-500 max-w-[150px] truncate" title={playlist.venue}>
                <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-600" />
                <span>{playlist.venue}</span>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3 text-slate-600" />
            <span className={trackCount > 0 ? "text-slate-300 font-medium" : "text-slate-500"}>
              {trackCount} {trackCount === 1 ? "track" : "tracks"}
            </span>
          </span>
          <span className="flex items-center gap-1 min-w-0">
            <Calendar className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="truncate">{formattedDate}</span>
          </span>
        </div>
      </div>
    </div>
  );
});

PlaylistCard.displayName = "PlaylistCard";
