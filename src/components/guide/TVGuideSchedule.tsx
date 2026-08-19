import { TelemetryAudit } from "../../utils/TelemetryAudit";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Play, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { List } from 'react-window';

interface TVGuideScheduleProps {
  channels: any[];
  triggerPlayout?: (block: any, channel: any, trace?: any) => void;
  masterStore: any; // A map of channelId to MasterPlaylist (with episodes)
  channelBlocksMap?: any;
  nowSec?: number;
}

export const TVGuideSchedule: React.FC<TVGuideScheduleProps> = ({ channels, triggerPlayout, masterStore, channelBlocksMap, nowSec }) => {
  const scrollRef = useRef<any>(null);
  
  // Time axis state (6 hour window)
  const [baseTimeMs, setBaseTimeMs] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0); // round to top of hour
    return now.getTime();
  });
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  useEffect(() => {
    const tick = () => {
      if (typeof window !== "undefined" && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          setCurrentTimeMs(Date.now());
        });
      } else {
        setCurrentTimeMs(Date.now());
      }
    };
    
    // Sync to system clock boundaries for batched UI updates
    const now = Date.now();
    const delayToNextSecond = 1000 - (now % 1000);
    
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 1000);
    }, delayToNextSecond);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const timeBlocks = useMemo(() => {
    const blocks = [];
    // From baseTimeMs - 1 hour, to baseTimeMs + 5 hours (6 hour window)
    const startWindow = baseTimeMs - (1 * 60 * 60 * 1000);
    for (let i = 0; i < 12; i++) {
      const bTime = startWindow + (i * 30 * 60 * 1000); // 30 min blocks
      blocks.push(bTime);
    }
    return blocks;
  }, [baseTimeMs]);

  const PIXELS_PER_MINUTE = 8;
  const COLUMN_WIDTH = 30 * PIXELS_PER_MINUTE; // 240px per 30 min

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleTimeShift = (hours: number) => {
    setBaseTimeMs(prev => prev + (hours * 60 * 60 * 1000));
  };

  const startWindowMs = timeBlocks[0];
  const endWindowMs = timeBlocks[timeBlocks.length - 1] + (30 * 60 * 1000);

  // Helper to generate schedule blocks for a channel based on channelBlocksMap
  // or fallbacks if episodes aren't defined.
  const getScheduleBlocks = (ch: any) => {
    const blocks = channelBlocksMap?.[ch.id] || channelBlocksMap?.[ch.channelId] || [];
    if (blocks.length > 0) {
      return blocks.map((b: any) => ({
        id: `block-${ch.id}-${b.startTimeSec}`,
        title: b.episode.title,
        startTime: b.startTimeSec * 1000,
        endTime: (b.startTimeSec + b.durationSec) * 1000,
        originalBlock: b
      }));
    }

    // For this mockup, we'll create some deterministic overlapping blocks based on channel ID
    const seed = (ch.id || ch.name || "A").charCodeAt(0) || 1;
    const mockBlocks = [];
    let currentT = startWindowMs - (seed * 60 * 1000);
    
    while (currentT < endWindowMs) {
      // 30 min to 120 min duration
      const durMins = 30 + ((seed * currentT) % 90);
      const durMs = durMins * 60 * 1000;
      mockBlocks.push({
        id: `block-${ch.id}-${currentT}`,
        title: ch.name + " Programming",
        startTime: currentT,
        endTime: currentT + durMs,
        originalBlock: {
          startTimeSec: Math.floor(currentT / 1000),
          durationSec: Math.floor(durMs / 1000),
          episode: { url: ch.url || ch.source || "", title: ch.name }
        }
      });
      currentT += durMs;
    }
    return mockBlocks;
  };

  const nowLineLeft = useMemo(() => {
    if (currentTimeMs < startWindowMs || currentTimeMs > endWindowMs) return -1;
    const minutesSinceStart = (currentTimeMs - startWindowMs) / (60 * 1000);
    return minutesSinceStart * PIXELS_PER_MINUTE;
  }, [currentTimeMs, startWindowMs, endWindowMs, PIXELS_PER_MINUTE]);

  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Filter channels based on active tab
  const visibleChannels = useMemo(() => {
    if (!activeTabId) return channels;
    return channels.filter(ch => {
      // Keep live, multiplexer, and drop_go regardless of week tab
      if (ch.type !== "weekly_rolling" && ch.category !== "Rolling RSS Archive") {
        return true;
      }
      return ch.id === activeTabId;
    });
  }, [channels, activeTabId]);

  const rollingWeekChannels = useMemo(() => {
    return channels.filter(ch => ch.type === "weekly_rolling" || ch.category === "Rolling RSS Archive");
  }, [channels]);

  const leftListRef = useRef<any>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mainScroll = scrollRef.current?.element;
    const headerScroll = headerScrollRef.current;
    
    if (mainScroll && headerScroll) {
      const handleScroll = () => {
        headerScroll.scrollLeft = mainScroll.scrollLeft;
        if (leftListRef.current && leftListRef.current.element) {
          leftListRef.current.element.scrollTop = mainScroll.scrollTop;
        }
      };
      mainScroll.addEventListener('scroll', handleScroll);
      return () => mainScroll.removeEventListener('scroll', handleScroll);
    }
    return undefined;
  }, [visibleChannels]); // re-bind if refs change

  const handleRightScroll = ({ scrollOffset }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
    if (leftListRef.current && leftListRef.current.element) {
      leftListRef.current.element.scrollTop = scrollOffset;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0f0f0f] text-white font-sans overflow-hidden">
      {/* Top Controls */}
      <div className="h-[8%] min-h-[60px] bg-[#1a1a1a] border-b border-[#333333] px-6 flex items-center justify-between shrink-0">
        <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-tight text-[#FFFFFF]">Timeline Schedule</h2>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => handleTimeShift(-3)} className="p-2 bg-[#2d2d2d] rounded hover:bg-[#FF6B35] transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setBaseTimeMs(Date.now() - (Date.now() % 3600000))} className="px-3 sm:px-4 py-2 bg-[#2d2d2d] rounded text-xs sm:text-sm font-bold uppercase hover:bg-[#333333] transition-colors flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FF6B35]" />
            <span className="hidden sm:inline">Jump to Now</span>
            <span className="sm:hidden">Now</span>
          </button>
          <button onClick={() => handleTimeShift(3)} className="p-2 bg-[#2d2d2d] rounded hover:bg-[#FF6B35] transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Week Tab Selector */}
      {rollingWeekChannels.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 bg-[#0f0f0f] border-b border-[#333333] overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveTabId(null)}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              activeTabId === null
                ? "bg-[#FF6B35] text-white"
                : "bg-[#1a1a1a] text-[#B0B0B0] hover:bg-[#2d2d2d] hover:text-white border border-[#333333]"
            }`}
          >
            All Channels
          </button>
          {rollingWeekChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveTabId(ch.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                activeTabId === ch.id
                  ? "bg-[#FF6B35] text-white"
                  : "bg-[#1a1a1a] text-[#B0B0B0] hover:bg-[#2d2d2d] hover:text-white border border-[#333333]"
              }`}
            >
              {ch.name.replace("📅 ", "")}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Fallback */}
      <div className="flex lg:hidden flex-1 items-center justify-center p-6 text-center text-[#707070] bg-[#0f0f0f]">
        <div className="max-w-sm">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-white mb-2">Schedule View Unavailable</h3>
          <p className="text-sm">The timeline schedule requires a larger screen. Please switch to the Hub or Search view, or rotate your device to landscape.</p>
        </div>
      </div>

      {/* Grid Container (Hidden on small screens) */}
      <div className="hidden lg:flex flex-1 overflow-hidden relative">
        {/* Sticky Left Column (Channels) */}
        <div className="w-[200px] sm:w-[240px] shrink-0 bg-[#1a1a1a] border-r border-[#333333] z-20 flex flex-col">
          <div className="h-12 border-b border-[#333333] flex items-center px-4 bg-[#1a1a1a] text-xs font-bold text-[#707070] uppercase">
            {new Date(startWindowMs).toLocaleDateString()}
          </div>
          <div className="flex-1 overflow-hidden">
            <List
              listRef={leftListRef}
              rowCount={visibleChannels.length}
              rowHeight={80}
              rowProps={{}}
              style={{ height: typeof window !== 'undefined' ? window.innerHeight : 800, overflow: 'hidden' }}
              rowComponent={({ index, style }: any) => {
                const ch = visibleChannels[index];
                return (
                  <div style={style} key={ch.id || index} className="border-b border-[#333333] p-3 flex items-center gap-3 bg-[#1a1a1a]">
                     <div className="w-10 h-10 rounded bg-black shrink-0 relative overflow-hidden">
                       <img src={ch.logo || "https://archive.org/download/daily-highlights/lmbsa.png"} alt={ch.name} className="w-full h-full object-cover" />
                       <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[8px] font-bold text-center leading-tight py-0.5">CH {ch.num}</div>
                     </div>
                     <div className="min-w-0">
                       <div className="text-sm font-bold truncate text-white">{ch.name}</div>
                       <div className="text-[10px] text-[#B0B0B0] truncate uppercase">{ch.category}</div>
                     </div>
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Main Scrolling Grid */}
        <div className="flex-1 overflow-hidden relative bg-[#0f0f0f] flex flex-col">
          {/* Time Header Row */}
          <div 
             className="h-12 bg-[#1a1a1a] border-b border-[#333333] z-10 flex overflow-hidden shrink-0"
             ref={headerScrollRef}
          >
             <div className="flex relative" style={{ width: timeBlocks.length * COLUMN_WIDTH }}>
               {timeBlocks.map((timeMs) => (
                 <div key={timeMs} className="shrink-0 border-r border-[#333333] px-3 flex items-center h-12" style={{ width: COLUMN_WIDTH }}>
                   <span className="text-xs font-bold text-[#B0B0B0]">{formatTime(timeMs)}</span>
                 </div>
               ))}
               
               {/* Now Line (Header portion) */}
               {nowLineLeft >= 0 && (
                 <div className="absolute top-0 bottom-0 w-[2px] bg-[#FF4444] z-30 pointer-events-none" style={{ left: nowLineLeft }}>
                   <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-[#FF4444] text-white text-[10px] px-1.5 py-0.5 rounded font-bold tracking-widest">
                     NOW
                   </div>
                 </div>
               )}
             </div>
          </div>

          {/* Grid Rows */}          <div 
             className="flex-1 overflow-x-auto overflow-y-hidden relative"
             onScroll={(e) => {
                const target = e.currentTarget as HTMLElement;
                requestAnimationFrame(() => {
                  if (headerScrollRef.current) {
                    headerScrollRef.current.scrollLeft = target.scrollLeft;
                  }
                });
             }}
          >
            <List
              listRef={scrollRef}
              rowCount={visibleChannels.length}
              rowHeight={80}
              rowProps={{}}
              className="custom-scrollbar"
              style={{ height: typeof window !== 'undefined' ? window.innerHeight : 800, width: timeBlocks.length * COLUMN_WIDTH }}
              rowComponent={({ index, style }: any) => {
                const ch = visibleChannels[index];
                const blocks = getScheduleBlocks(ch);
                return (
                  <div style={style} key={ch.id || index} className="border-b border-[#333333] relative flex items-center">
                    {/* Grid Lines */}
                    {timeBlocks.map((timeMs) => (
                      <div key={`grid-${timeMs}`} className="absolute top-0 bottom-0 border-r border-[#333333]/30 pointer-events-none" style={{ left: ((timeMs - startWindowMs) / 60000) * PIXELS_PER_MINUTE, width: COLUMN_WIDTH }} />
                    ))}
                    
                    {/* Now Line (Body portion) */}
                    {nowLineLeft >= 0 && (
                      <div className="absolute top-0 bottom-0 w-[2px] bg-[#FF4444]/50 z-10 pointer-events-none" style={{ left: nowLineLeft }} />
                    )}

                    {/* Program Blocks */}
                    {blocks.map((block: any) => {
                      const startMin = (block.startTime - startWindowMs) / 60000;
                      const durMin = (block.endTime - block.startTime) / 60000;
                      const left = startMin * PIXELS_PER_MINUTE;
                      const width = durMin * PIXELS_PER_MINUTE;

                      // Only render if visible in window
                      if (left + width < 0 || left > timeBlocks.length * COLUMN_WIDTH) return null;
                      const isLive = currentTimeMs >= block.startTime && currentTimeMs <= block.endTime;

                      return (
                        <div 
                          key={block.id}
                          onClick={() => {
    if (triggerPlayout) {
      const trace = TelemetryAudit.createTrace("EPG_TIMELINE_CLICK", {
        channelId: ch.id,
        showTitle: block.originalBlock?.episode?.title || block.title,
        expectedM3u: ch.url || ch.source
      });
      triggerPlayout(block.originalBlock, ch, trace);
    }
  }}
                          className="absolute h-[68px] top-[6px] bg-[#2d2d2d] rounded-[4px] border border-[#333333] overflow-hidden hover:bg-[#3d3d3d] hover:border-[#FF6B35] cursor-pointer transition-colors group p-2 flex flex-col justify-center z-20"
                          style={{ left: Math.max(0, left), width: left < 0 ? width + left : width }}
                        >
                          <div className="text-xs font-bold text-white truncate">{block.title}</div>
                          <div className="text-[10px] text-[#B0B0B0] mt-0.5 flex gap-2">
                             <span>{formatTime(block.startTime)} - {formatTime(block.endTime)}</span>
                             {isLive && <span className="text-[#4CAF50] font-bold">LIVE</span>}
                          </div>
                          {/* Hover Play */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[#FF6B35]">
                            <Play className="w-5 h-5 fill-current" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
