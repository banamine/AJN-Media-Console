import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Play, Radio, Info } from "lucide-react";
import { CHANNEL_RANGES, ChannelRange } from "../../utils/channelRanges";
import { resolveMediaStreamUrl } from "../../utils/urlUtils";
import { TelemetryAudit } from "../../utils/TelemetryAudit";

import { List } from 'react-window';

interface TVGuideHubProps {
  channels: any[];
  triggerPlayout?: (block: any, channel: any, trace?: any) => void;
  channelBlocksMap?: any;
  nowSec?: number;
  onPlayShow?: (show: any) => void;
}

const ChannelRangeSelector: React.FC<{
  activeRange: string | null;
  onSelectRange: (range: ChannelRange) => void;
}> = ({ activeRange, onSelectRange }) => {
  return (
    <div className="flex gap-2 p-2 bg-[#0a0a0a] border-b border-[#333333] overflow-x-auto custom-scrollbar shrink-0">
      {CHANNEL_RANGES.map((range) => (
        <button
          key={range.id}
          onClick={() => onSelectRange(range)}
          className={`px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeRange === range.id
              ? "bg-[#FF6B35] text-white shadow-md"
              : "bg-[#1a1a1a] text-[#B0B0B0] hover:bg-[#2d2d2d] hover:text-white border border-[#333333]"
          }`}
        >
          <span className={activeRange === range.id ? "text-white opacity-80" : "text-[#FF6B35]"}>Ch.{range.rangeStart}</span>
          <span>{range.label}</span>
        </button>
      ))}
      {activeRange && (
        <button
          onClick={() => onSelectRange({ id: "all" } as any)}
          className="px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors bg-[#1a1a1a] text-[#707070] hover:bg-[#2d2d2d] hover:text-white border border-[#333333]"
        >
          Clear
        </button>
      )}
    </div>
  );
};

export const TVGuideHub: React.FC<TVGuideHubProps> = ({ channels, triggerPlayout, channelBlocksMap, nowSec, onPlayShow }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarHeight, setSidebarHeight] = useState(600);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setSidebarHeight(entries[0].contentRect.height);
      }
    });
    observer.observe(sidebarRef.current);
    return () => observer.disconnect();
  }, []);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeRange, setActiveRange] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredChannels = useMemo(() => {
    let result = channels;
    if (debouncedQuery) {
      const lowerQ = debouncedQuery.toLowerCase();
      result = result.filter((ch) => 
        (ch.name || "").toLowerCase().includes(lowerQ) ||
        (ch.category || "").toLowerCase().includes(lowerQ)
      );
    }
    return result;
  }, [channels, debouncedQuery]);

  const groupedChannels = useMemo(() => {
    const groups: Record<string, typeof channels> = {};
    
    CHANNEL_RANGES.forEach((range) => {
      groups[range.id] = filteredChannels.filter(
        (ch) => ch.num >= range.rangeStart && ch.num <= range.rangeEnd
      );
    });

    return groups;
  }, [filteredChannels]);

  const scrollToRange = (range: ChannelRange) => {
    if (range.id === "all") {
       setActiveRange(null);
       return;
    }
    setActiveRange(range.id);
    const el = document.getElementById(`range-${range.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSelectChannel = (ch: any) => {
    if (!triggerPlayout) return;
    const blocks = channelBlocksMap?.[ch.id] || channelBlocksMap?.[ch.channelId] || [];
    let cur = blocks[0];
    if (nowSec) {
      cur = blocks.find((b: any) => nowSec >= b.startTimeSec && nowSec < b.startTimeSec + b.durationSec) || blocks[0];
    }
    // Fallback block if none found
    if (!cur) {
      cur = {
        startTimeSec: nowSec || Math.floor(Date.now() / 1000),
        durationSec: 3600,
        episode: { url: ch.url || ch.source || "", title: ch.name }
      };
    }

    const trace = TelemetryAudit.createTrace("SIDEBAR_SELECTOR_CLICK", {
      channelId: ch.id,
      showTitle: cur.episode.title || ch.name,
      expectedM3u: ch.url || ch.source
    });

    triggerPlayout(cur, ch, trace);
  };

  return (
    <div className="flex h-full w-full bg-[#0f0f0f] text-white relative font-sans overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Channel List (Slide-in) */}
      <div 
        className={`absolute left-0 top-0 h-full bg-[#1a1a1a] border-r border-[#333333] z-50 transition-all duration-300 flex flex-col ${isSidebarOpen ? "w-64 translate-x-0" : "w-12 -translate-x-0 sm:w-16 sm:translate-x-0"} shadow-2xl overflow-hidden`}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
        onClick={() => !isSidebarOpen && setIsSidebarOpen(true)}
      >
        <div className="p-4 flex items-center gap-3 border-b border-[#333333] shrink-0 h-[8%] min-h-[60px] cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <Radio className="w-5 h-5 text-[#FF6B35] shrink-0" />
          <span className={`font-bold whitespace-nowrap uppercase tracking-widest text-sm transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
            Networks
          </span>
        </div>
        <div className="flex-1 py-2" style={{ overflow: "hidden" }} ref={sidebarRef}>

          <div style={{ height: sidebarHeight || 600, width: "100%" }}>
          <List
            rowCount={channels.length}
            rowHeight={56}
            overscanCount={5}
            rowProps={{}}
            style={{ height: sidebarHeight || 600, overflowX: 'hidden' }}
            rowComponent={({ index, style }: any) => {
              const ch = channels[index];
              return (
                <div 
                  style={style}
                  key={ch.id || index}
                  onClick={() => {
                    handleSelectChannel(ch);
                    setIsSidebarOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 hover:bg-[#2d2d2d] cursor-pointer transition-colors border-b border-[#333333]/30"
                >
                  <img 
                    src={ch.logo || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg"} 
                    alt={ch.name}
                    className="w-8 h-8 rounded shrink-0 object-cover bg-black"
                    loading="lazy"
                  />
                  <div className={`min-w-0 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
                    <div className="text-sm font-bold truncate text-[#FFFFFF]">{ch.name}</div>
                    <div className="text-[10px] text-[#B0B0B0] truncate uppercase tracking-wider">{ch.category || "General"}</div>
                  </div>
                </div>
              );
            }}
          />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ml-12 sm:ml-16 ${isSidebarOpen ? "lg:ml-64" : ""}`}>
        {/* Header */}
        <div className="h-[8%] min-h-[60px] bg-[#1a1a1a] border-b border-[#333333] px-6 flex items-center justify-between shrink-0">
          <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-tight text-[#FFFFFF]">Network Hub</h2>
          <div className="relative w-64 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707070]" />
            <input 
              type="text" 
              placeholder="Search channels..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2d2d2d] border border-[#333333] rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-[#707070] focus:outline-none focus:border-[#FF6B35] transition-colors"
            />
          </div>
        </div>
        
        <ChannelRangeSelector activeRange={activeRange} onSelectRange={scrollToRange} />

        {/* Grid Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0f0f0f] custom-scrollbar">
          {filteredChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#707070] py-12">
              <Radio className="w-12 h-12 mb-4 opacity-50 text-[#FF6B35]" />
              <p className="text-lg text-white font-medium">No channels found</p>
              <p className="text-sm mt-2">Try searching for a different network or category.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {CHANNEL_RANGES.map((range) => {
                const rangeChannels = groupedChannels[range.id] || [];
                if (rangeChannels.length === 0) return null;
                if (activeRange && activeRange !== range.id) return null;

                return (
                  <section key={range.id} id={`range-${range.id}`}>
                    <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur py-3 border-b border-[#333333] mb-4 flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-[#FF6B35]/20 text-[#FF6B35] border border-[#FF6B35]/30 text-xs font-mono tracking-wider">
                          {range.rangeStart}-{range.rangeEnd}
                        </span>
                        <span className="uppercase tracking-widest">{range.label}</span>
                      </h3>
                      <span className="text-xs text-[#707070] font-mono">{rangeChannels.length} NETWORKS</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
                      {rangeChannels.map((ch, idx) => (
                        <div 
                          key={ch.id || idx} 
                          onClick={() => {
                            const blocks = channelBlocksMap?.[ch.id] || channelBlocksMap?.[ch.channelId] || [];
                            let cur = blocks[0];
                            if (nowSec) {
                              cur = blocks.find((b: any) => nowSec >= b.startTimeSec && nowSec < b.startTimeSec + b.durationSec) || blocks[0];
                            }
                            if (!cur) {
                              cur = {
                                startTimeSec: nowSec || Math.floor(Date.now() / 1000),
                                durationSec: 3600,
                                episode: { url: ch.url || ch.source || "", title: ch.name, plot: ch.description || ch.plot, thumbnail: ch.logo }
                              };
                            }

                            if (onPlayShow) {
                              onPlayShow({
                                id: ch.id,
                                channel: ch.name,
                                title: cur.episode.title || ch.currentShowTitle || ch.name,
                                videoUrl: resolveMediaStreamUrl(cur.episode.url || ch.streamUrl || ch.url || ch.source),
                                airDate: ch.airDate || "2026-08-17",
                                airTime: ch.airTime || "LIVE",
                                duration: ch.duration || Math.round(cur.durationSec / 60) || 60,
                                description: cur.episode.plot || ch.description || ch.plot || "Continuous 24/7 deterministic playout loop.",
                                thumbnailUrl: cur.episode.thumbnail || ch.logo,
                                episode: cur.episode,
                                showType: "live",
                                tags: [ch.category]
                              });
                            } else {
                              handleSelectChannel(ch);
                            }
                          }}
                          className="group relative flex flex-col bg-[var(--surface-1)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden hover:border-[var(--accent)] transition-all duration-[var(--dur-med)] ease-[var(--ease-standard)] hover:shadow-[var(--shadow-glow)] shadow-[var(--shadow-soft)] cursor-pointer"
                        >
                          <div className="aspect-video bg-[var(--surface-2)] relative overflow-hidden">
                            {ch.logo ? (
                              <img 
                                src={ch.logo} 
                                alt={ch.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[180ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[var(--surface-2)]">
                                <span className="text-[0.875rem] font-semibold text-[#f2f2f2] line-clamp-2">{ch.name}</span>
                                <span className="text-[0.75rem] text-[#8a8a8a] mt-1 font-mono uppercase">{ch.category}</span>
                              </div>
                            )}
                            
                            {/* Live Badge */}
                            <div className="absolute top-2 left-2 px-2 py-1 bg-[var(--live)] text-[var(--bg)] text-[var(--text-xs)] font-bold uppercase rounded-[var(--radius-sm)] flex items-center gap-1 leading-none shadow-[var(--shadow-soft)]">
                              <span className="w-1.5 h-1.5 bg-[#121212] rounded-full animate-pulse" />
                              LIVE
                            </div>
                            
                            {/* Channel Number Badge */}
                            <div className="absolute top-2 right-2 px-2 py-1 bg-[#1a1a1a]/80 text-[#f2f2f2] text-[0.75rem] font-bold font-mono rounded-[8px] backdrop-blur-sm border border-[rgba(255,255,255,0.08)] leading-none shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                              CH {ch.num}
                            </div>

                            {/* Quick Play Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-[150ms] ease-[cubic-bezier(.2,.8,.2,1)] bg-[#121212]/40">
                              <div className="w-12 h-12 rounded-full bg-[#ff6a33] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.25)] transform scale-75 group-hover:scale-100 transition-all duration-[180ms] ease-[cubic-bezier(.2,.8,.2,1)]">
                                <Play className="w-6 h-6 ml-1" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3 flex flex-col gap-1">
                            <h3 className="text-[0.875rem] font-semibold text-[#f2f2f2] leading-tight truncate">{ch.name}</h3>
                            <p className="text-[0.75rem] text-[#8a8a8a] line-clamp-1 leading-normal">
                              {ch.plot || ch.description || "Continuous 24/7 deterministic playout loop."}
                            </p>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[rgba(255,255,255,0.08)]">
                              <span className="text-[0.75rem] text-[#b8b8b8] bg-[var(--surface-2)] px-2 py-1 rounded-[8px] font-medium leading-none">
                                {ch.category || "General"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
