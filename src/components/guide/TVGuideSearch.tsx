import { TelemetryAudit } from "../../utils/TelemetryAudit";
import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, LayoutGrid, List as ListIcon, Play, X, ChevronDown } from "lucide-react";

interface TVGuideSearchProps {
  channels: any[];
  triggerPlayout?: (block: any, channel: any, trace?: any) => void;
  channelBlocksMap?: any;
  nowSec?: number;
}

export const TVGuideSearch: React.FC<TVGuideSearchProps> = ({ channels, triggerPlayout, channelBlocksMap, nowSec }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width < 768) {
          setIsSidebarOpen(false);
        } else {
          setIsSidebarOpen(true);
        }
      }
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    channels.forEach(ch => {
      if (ch.category) genres.add(ch.category);
    });
    return Array.from(genres).sort();
  }, [channels]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const filteredResults = useMemo(() => {
    return channels.filter(ch => {
      const matchesSearch = !debouncedQuery || 
        (ch.name || "").toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        (ch.category || "").toLowerCase().includes(debouncedQuery.toLowerCase());
        
      const matchesFilters = activeFilters.length === 0 || 
        activeFilters.includes(ch.category) ||
        (activeFilters.includes("Live") && ch.isLiveMode);
        
      return matchesSearch && matchesFilters;
    });
  }, [channels, debouncedQuery, activeFilters]);

  const handleSelectChannel = (ch: any) => {
    if (!triggerPlayout) return;
    const blocks = channelBlocksMap?.[ch.id] || channelBlocksMap?.[ch.channelId] || [];
    let cur = blocks[0];
    if (nowSec) {
      cur = blocks.find((b: any) => nowSec >= b.startTimeSec && nowSec < b.startTimeSec + b.durationSec) || blocks[0];
    }
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
    <div className="flex h-full w-full bg-[#0f0f0f] text-white font-sans overflow-hidden relative">
      {/* Mobile Filter Toggle */}
      <button 
        className="md:hidden absolute bottom-4 right-4 z-50 p-4 bg-[#FF6B35] rounded-full shadow-xl text-white"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Filter className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Advanced Filters Sidebar */}
      <div className={`
        absolute md:relative z-40 h-full bg-[#1a1a1a] border-r border-[#333333] transition-all duration-300
        ${isSidebarOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full md:w-16 md:translate-x-0"}
        overflow-hidden flex flex-col shrink-0
      `}>
        <div className="p-4 border-b border-[#333333] flex items-center justify-between h-[8%] min-h-[60px]">
           <span className={`font-bold uppercase tracking-widest text-sm whitespace-nowrap transition-opacity ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>Filters</span>
           {isSidebarOpen ? (
             <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-[#2d2d2d] rounded">
               <X className="w-5 h-5 text-[#707070]" />
             </button>
           ) : (
             <button onClick={() => setIsSidebarOpen(true)} className="hidden md:block p-1 hover:bg-[#2d2d2d] rounded mx-auto">
               <Filter className="w-5 h-5 text-[#FF6B35]" />
             </button>
           )}
        </div>
        
        <div className={`flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar transition-opacity ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
          <div>
            <h3 className="text-xs font-bold text-[#707070] uppercase tracking-widest mb-3">Availability</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-[#FF6B35] transition-colors">
                <input type="checkbox" className="accent-[#FF6B35]" checked={activeFilters.includes("Live")} onChange={() => toggleFilter("Live")} />
                Live Now
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-[#FF6B35] transition-colors">
                <input type="checkbox" className="accent-[#FF6B35]" checked={activeFilters.includes("VOD")} onChange={() => toggleFilter("VOD")} />
                VOD / Archive
              </label>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-bold text-[#707070] uppercase tracking-widest mb-3">Genres</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {availableGenres.map(genre => (
                <label key={genre} className="flex items-center gap-2 text-sm cursor-pointer hover:text-[#FF6B35] transition-colors">
                  <input type="checkbox" className="accent-[#FF6B35]" checked={activeFilters.includes(genre)} onChange={() => toggleFilter(genre)} />
                  <span className="truncate">{genre}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Header & Search Bar */}
        <div className="bg-[#1a1a1a] border-b border-[#333333] px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 h-auto min-h-[60px] md:h-[8%]">
          <div className="relative w-full md:w-96 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#707070]" />
            <input 
              type="text" 
              placeholder="Search shows, channels, genres..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2d2d2d] border border-[#333333] rounded-full py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#707070] focus:outline-none focus:border-[#FF6B35] transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="text-sm font-mono text-[#B0B0B0]">
              {filteredResults.length} Results
            </div>
            <div className="flex items-center gap-1 bg-[#2d2d2d] rounded-lg p-1 border border-[#333333]">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-[#FF6B35] text-white" : "text-[#707070] hover:text-white"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-[#FF6B35] text-white" : "text-[#707070] hover:text-white"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Bar */}
        {activeFilters.length > 0 && (
          <div className="bg-[#1a1a1a]/50 border-b border-[#333333] px-6 py-2 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
            <span className="text-xs text-[#707070] uppercase font-bold mr-2 shrink-0">Active Filters:</span>
            {activeFilters.map(filter => (
              <div key={filter} className="flex items-center gap-1 bg-[#2d2d2d] border border-[#333333] px-2 py-1 rounded-full text-xs font-mono shrink-0">
                <span className="text-white">{filter}</span>
                <button onClick={() => toggleFilter(filter)} className="text-[#707070] hover:text-[#FF6B35]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button 
              onClick={() => setActiveFilters([])}
              className="text-xs text-[#FF6B35] hover:underline ml-2 shrink-0 font-bold uppercase"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0f0f0f] custom-scrollbar relative">
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#707070] py-12">
              <Search className="w-12 h-12 mb-4 opacity-30 text-[#FF6B35]" />
              <p className="text-lg font-medium text-white">No matches found</p>
              <p className="text-sm mt-2">Try adjusting your filters or search query.</p>
            </div>
          ) : viewMode === "grid" ? (
            // GRID VIEW
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredResults.map((ch, idx) => (
                <div 
                  key={ch.id || idx} 
                  onClick={() => handleSelectChannel(ch)}
                  className="group relative bg-[#1a1a1a] rounded-xl border border-[#333333] overflow-hidden hover:border-[#FF6B35] transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col h-[280px]"
                >
                  <div className="h-[60%] bg-[#2d2d2d] relative overflow-hidden shrink-0">
                    {ch.logo ? (
                      <img src={ch.logo} alt={ch.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#2d2d2d] to-[#1a1a1a]">
                        <span className="font-bold text-white text-center line-clamp-2">{ch.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-[#FF6B35] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300">
                        <Play className="w-6 h-6 ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight">{ch.name}</h3>
                      <p className="text-xs text-[#B0B0B0] mt-2 line-clamp-2">
                        {ch.plot || ch.description || "Video broadcast stream"}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-[#707070] uppercase font-mono bg-[#2d2d2d] px-2 py-0.5 rounded">
                        {ch.category || "General"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // LIST VIEW
            <div className="flex flex-col space-y-2">
              {filteredResults.map((ch, idx) => (
                <div 
                  key={ch.id || idx}
                  onClick={() => handleSelectChannel(ch)}
                  className="flex items-center gap-4 bg-[#1a1a1a] border border-[#333333] p-2 rounded-lg hover:border-[#FF6B35] hover:bg-[#2d2d2d] transition-all cursor-pointer group"
                >
                  <div className="w-24 h-16 shrink-0 bg-black rounded overflow-hidden relative">
                     {ch.logo && <img src={ch.logo} alt={ch.name} loading="lazy" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                       <Play className="w-6 h-6 text-[#FF6B35]" />
                     </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{ch.name}</h3>
                    <p className="text-xs text-[#B0B0B0] truncate mt-1">{ch.plot || ch.description || "Video broadcast stream"}</p>
                  </div>
                  <div className="hidden md:flex flex-col items-end shrink-0 w-32">
                     <span className="text-[10px] font-mono text-[#707070] uppercase">{ch.category || "General"}</span>
                     <span className="text-[10px] font-mono text-[#FF6B35] mt-1 uppercase bg-[#FF6B35]/10 px-1.5 py-0.5 rounded">{ch.type || "Stream"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
