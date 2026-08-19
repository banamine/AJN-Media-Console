import React, { useState } from 'react';
import { ArchiveThumbnail } from './ArchiveThumbnail';

export interface ArchiveSegment {
  id: string;
  title: string;
  timestampLabel: string;
  duration: string;
  thumbnailUrl: string;
  broadcaster: string;
  videoUrl?: string;
}

interface ArchiveHubProps {
  segments: ArchiveSegment[];
  onSelectSegment: (segment: ArchiveSegment) => void;
  focusedIndex?: number;
}

export const ArchiveHub: React.FC<ArchiveHubProps> = ({ segments, onSelectSegment, focusedIndex }) => {
  // Global refresh state tracking timestamp mutations across all mounted child components
  const [thumbnailRefreshKey, setThumbnailRefreshKey] = useState<number>(0);

  /**
   * Appends an explicit timestamp query string to all archive thumbnail assets
   * to force a UI re-render bypass without disturbing live player proxy sessions.
   */
  const triggerThumbnailRefresh = (): void => {
    const timestampBuster = Date.now();
    setThumbnailRefreshKey(timestampBuster);
    console.log(`[Cache Engine] Manual thumbnail reload triggered with cache buster: ?t_refresh=${timestampBuster}`);
  };

  return (
    <div className="w-full bg-[#070913] p-4 text-slate-100 font-sans rounded-2xl border border-slate-900">
      {/* Section Header Controls Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800/60 pb-4 mb-4 gap-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Day-View Broadcaster Hub
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Complete high-density segment index mapped for chosen archival dates.
          </p>
        </div>

        {/* Core Cache Buster Action Control */}
        <button
          type="button"
          onClick={triggerThumbnailRefresh}
          className="px-3 py-1.5 bg-[#12162f] hover:bg-[#1a2045] border border-indigo-500/30 text-indigo-300 rounded-xl font-mono text-[10px] font-semibold tracking-wide flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer"
          title="Force-reload thumbnail assets via query-string timestamp injection"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18.2" />
          </svg>
          Refresh Grid Assets
        </button>
      </div>

      {/* Multi-Column High Density Render Deck */}
      {segments.length === 0 ? (
        <div className="w-full py-10 flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-xl bg-[#090b16]">
          <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">No Segment Blocks Logged</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[65vh] overflow-y-auto overscroll-contain pr-2 custom-scrollbar">
          {segments.map((segment, idx) => (
            <div
              key={segment.id}
              onClick={() => onSelectSegment(segment)}
              className={`group relative flex flex-col transition-all duration-200 rounded-xl p-2.5 cursor-pointer shadow-md hover:-translate-y-0.5 ${
                idx === focusedIndex
                  ? "bg-[#11142a] border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.35)] scale-[1.01]"
                  : "bg-[#0d1022] border border-slate-800/70 hover:border-indigo-500/40 hover:shadow-indigo-500/5"
              }`}
            >
              {/* Image Frame Container Node with Lazy Throttling */}
              <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-2 shadow-inner" style={{ aspectRatio: "16/9" }}>
                <ArchiveThumbnail
                  src={segment.thumbnailUrl || ""}
                  alt={segment.title}
                  refreshTrigger={thumbnailRefreshKey}
                  episodeUrl={segment.videoUrl}
                />
                
                {/* Micro Metadata HUD Badges */}
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  <span className="bg-slate-900/85 backdrop-blur-md text-[8px] font-mono px-1.5 py-0.5 rounded text-indigo-300 font-bold border border-slate-700/50">
                    {segment.timestampLabel}
                  </span>
                </div>
                
                <div className="absolute bottom-1.5 right-1.5">
                  <span className="bg-black/75 backdrop-blur-md text-[8px] font-mono px-1 py-0.5 rounded text-slate-300">
                    {segment.duration}
                  </span>
                </div>
              </div>

              {/* Text Meta Content Stack */}
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[8px] uppercase tracking-wider font-mono font-bold text-indigo-400 mb-0.5">
                  {segment.broadcaster}
                </span>
                <h3 className="text-[11px] font-medium text-slate-200 group-hover:text-white truncate transition-colors leading-snug">
                  {segment.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
