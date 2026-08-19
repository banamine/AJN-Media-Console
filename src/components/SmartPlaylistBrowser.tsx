import React, { useState, useMemo } from "react";
import { 
  Search, 
  Play, 
  Download, 
  Sparkles, 
  Radio, 
  Tv, 
  Calendar, 
  Megaphone, 
  Film, 
  Music, 
  Archive, 
  Compass, 
  Zap,
  Sliders, 
  Plus, 
  ListMusic, 
  Shuffle, 
  CheckCircle2, 
  Heart 
} from "lucide-react";
import { SmartPlaylistCategory } from "../utils/smartPlaylistEngine";
import { IPTVChannel } from "../types";

interface SmartPlaylistBrowserProps {
  category: SmartPlaylistCategory | null;
  playStream: (url: string, name: string) => void;
  addLog: (msg: string) => void;
  isLight: boolean;
}

export function SmartPlaylistBrowser({
  category,
  playStream,
  addLog,
  isLight
}: SmartPlaylistBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!category) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 animate-bounce">
          <ListMusic className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">No Smart Playlist Selected</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Select an auto-categorized playlist from the sidebar menu to browse processed streams.
        </p>
      </div>
    );
  }

  // Get matching icon for category header
  const CategoryIcon = useMemo(() => {
    return {
      Megaphone: Megaphone,
      Film: Film,
      Music: Music,
      Radio: Radio,
      Zap: Zap,
      Calendar: Calendar,
      Archive: Archive,
      Compass: Compass
    }[category.icon] || Compass;
  }, [category.icon]);

  // Filter channels based on query
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return category.channels;
    const q = searchQuery.toLowerCase();
    return category.channels.filter(ch => 
      ch.name.toLowerCase().includes(q) || 
      (ch.group && ch.group.toLowerCase().includes(q)) || 
      (ch.tvgId && ch.tvgId.toLowerCase().includes(q))
    );
  }, [category.channels, searchQuery]);

  // Export current smart category as an M3U file
  const handleExportM3U = () => {
    if (category.channels.length === 0) {
      addLog("Export failed: Category is empty.");
      return;
    }

    let m3u = `#EXTM3U x-tvg-name="AJN Smart: ${category.name}"\n\n`;
    category.channels.forEach((ch, idx) => {
      m3u += `#EXTINF:-1 group-title="${ch.group || category.name}" tvg-logo="${ch.logo || ""}" tvg-id="${ch.tvgId || ""}" tvg-name="${ch.tvgName || ""}" tvg-chno="${ch.tvgChno || idx + 1}",${ch.name}\n${ch.url}\n\n`;
    });

    const blob = new Blob([m3u], { type: "text/m3u" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${category.id}-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog(`Exported Smart Playlist "${category.name}" (${category.channels.length} items) as custom M3U download.`);
  };

  // Play a random channel from this playlist
  const handlePlayRandom = () => {
    if (category.channels.length === 0) return;
    const randomCh = category.channels[Math.floor(Math.random() * category.channels.length)];
    playStream(randomCh.url, randomCh.name);
    addLog(`Smart Playlist Shuffle: Selected and streamed random channel "${randomCh.name}"`);
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1500);
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Category Header Card */}
      <div className={`p-6 md:p-8 rounded-2xl border relative overflow-hidden transition-all duration-300 ${
        isLight ? "bg-white border-slate-200 shadow-md" : "bg-gradient-to-br from-[#0c1325] to-[#070b16] border-slate-800/80"
      }`}>
        <div className="absolute top-0 right-0 p-10 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/10">
              <CategoryIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  category.type === "genre" 
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" 
                    : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                }`}>
                  Smart Classification: {category.type === "genre" ? "Auto-Genre" : "Activity Frequency"}
                </span>
                <span className="text-xs font-mono text-slate-500">• {category.channels.length} Streams</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight mt-1.5">{category.name}</h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{category.description}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePlayRandom}
              disabled={category.channels.length === 0}
              className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-40"
              title="Play a random channel from this list"
            >
              <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Random Stream</span>
            </button>
            <button
              onClick={handleExportM3U}
              disabled={category.channels.length === 0}
              className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/10 transition-all disabled:opacity-40 cursor-pointer"
              title="Export this automatically filtered list to a standard M3U file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export M3U</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Filter & Stream Directory Card */}
      <div className={`flex-1 flex flex-col rounded-2xl border overflow-hidden min-h-0 ${
        isLight ? "bg-white border-slate-200" : "bg-[#080d1a] border-slate-800/80"
      }`}>
        {/* Search Bar Block */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search streams in this category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none transition-colors placeholder:text-slate-500"
            />
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Filtered: <span className="text-slate-300 font-bold">{filteredChannels.length}</span> of {category.channels.length}
          </div>
        </div>

        {/* Channels List / Directory viewport */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 scrollbar-thin">
          {filteredChannels.length === 0 ? (
            <div className="py-16 text-center font-sans">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800/50 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-300">No matching streams found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Try widening your search terms or select another category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChannels.map((ch, idx) => (
                <div 
                  key={ch.url + idx}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-850 hover:border-slate-700 transition-all group flex flex-col justify-between gap-3 shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={ch.logo || "https://archive.org/download/daily-highlights/lmbsa.png"}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover border border-slate-800/80 shrink-0 bg-slate-900"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://archive.org/download/daily-highlights/lmbsa.png";
                      }}
                    />
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug" title={ch.name}>
                        {ch.name}
                      </h3>
                      {ch.group && (
                        <span className="text-[10px] text-slate-400 font-mono mt-1 inline-block truncate max-w-full">
                          📁 {ch.group}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Channel Meta Details & Actions */}
                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2 text-[10px] font-mono">
                    <div className="text-slate-500 truncate max-w-[130px]">
                      {ch.tvgId ? `ID: ${ch.tvgId}` : "ID: UNRESOLVED"}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => copyToClipboard(ch.url)}
                        className={`py-1 px-2 rounded-xl text-[9px] font-bold border transition-colors ${
                          copiedUrl === ch.url
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                        }`}
                        title="Copy direct stream URL to clipboard"
                      >
                        {copiedUrl === ch.url ? "Copied" : "Copy URL"}
                      </button>
                      <button
                        onClick={() => playStream(ch.url, ch.name)}
                        className="py-1 px-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white font-bold border border-blue-500/20 hover:border-blue-500 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Play stream now"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>Stream</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
