import React, { useState, useEffect } from "react";
import { broadcastExporter } from "../../broadcast/BroadcastExporter";
import { registry } from "../../broadcast/RegistryManager";
import { Radio, Copy, Check, Download, RefreshCw, ExternalLink, Terminal, ShieldCheck } from "lucide-react";

export function PlayoutBridgeStatusPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedM3U, setCopiedM3U] = useState(false);
  const [copiedXML, setCopiedXML] = useState(false);
  const [timestamp, setTimestamp] = useState(() => broadcastExporter.lastUpdated);

  useEffect(() => {
    const unsub = registry.subscribe("manifests_updated", (data: any) => {
      if (data && data.timestamp) {
        setTimestamp(data.timestamp);
      } else {
        setTimestamp(Date.now());
      }
    });

    return () => unsub();
  }, []);

  const masterM3UUrl = "https://stream.ajn-broadcast.io/live/playlist.m3u8";
  const masterXMLUrl = "https://stream.ajn-broadcast.io/live/guide.xml";

  const handleCopy = (text: string, type: "m3u" | "xml") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === "m3u") {
        setCopiedM3U(true);
        setTimeout(() => setCopiedM3U(false), 2000);
      } else {
        setCopiedXML(true);
        setTimeout(() => setCopiedXML(false), 2000);
      }
    }
  };

  const handleDownload = (content: string, filename: string, mime: string) => {
    if (typeof document !== "undefined") {
      try {
        const blob = new Blob([content || "#EXTM3U"], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed:", err);
      }
    }
  };

  const handleForceSync = () => {
    broadcastExporter.triggerManualSync();
    setTimestamp(Date.now());
  };

  return (
    <div className="relative z-50 select-none font-sans">
      {/* Trigger Button in Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-950"
        title="Live Playout Bridge & M3U/XMLTV Export Engine"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>

        <Radio className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-mono text-[11px] tracking-tight font-bold">OBS BRIDGE</span>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0B0E14] border border-slate-700/80 shadow-2xl overflow-hidden z-50 animate-fadeIn">
          {/* Header Bar */}
          <div className="p-3.5 bg-[#141A29] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">Control Room Export Engine</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span>LIVE SYNCED</span>
            </div>
          </div>

          {/* Live Status Description */}
          <div className="p-3.5 bg-slate-900/50 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Status: <strong className="text-emerald-400">Serving playlist.m3u8</strong></span>
              <span>Updated: {timestamp ? new Date(timestamp).toLocaleTimeString() : "Just now"}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Every thumbnail generation, channel addition, and grid reorder automatically rewrites the live M3U & XMLTV manifests.
            </p>
          </div>

          {/* Integration Hook Box */}
          <div className="p-3.5 space-y-3.5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Integration Hook (OBS / vMix / VLC)</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Copy this URL into your OBS <strong>&apos;VLC Video Source&apos;</strong> to pull your channel playlist directly into your stream.
              </p>
            </div>

            {/* M3U Copy URL Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-500">Master M3U8 Playlist Feed</label>
              <div className="flex items-center gap-1.5 bg-black/60 border border-slate-800 rounded-xl p-1.5 pl-3">
                <input
                  type="text"
                  readOnly
                  value={masterM3UUrl}
                  className="w-full bg-transparent text-[11px] font-mono text-slate-300 outline-none select-all"
                />
                <button
                  onClick={() => handleCopy(masterM3UUrl, "m3u")}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedM3U ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copiedM3U ? "COPIED" : "COPY"}</span>
                </button>
              </div>
            </div>

            {/* XMLTV Copy URL Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-500">XMLTV EPG Guide Feed</label>
              <div className="flex items-center gap-1.5 bg-black/60 border border-slate-800 rounded-xl p-1.5 pl-3">
                <input
                  type="text"
                  readOnly
                  value={masterXMLUrl}
                  className="w-full bg-transparent text-[11px] font-mono text-slate-300 outline-none select-all"
                />
                <button
                  onClick={() => handleCopy(masterXMLUrl, "xml")}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedXML ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copiedXML ? "COPIED" : "COPY"}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownload(broadcastExporter.m3u8Content, "playlist.m3u8", "application/vnd.apple.mpegurl")}
                className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save M3U8</span>
              </button>

              <button
                onClick={() => handleDownload(broadcastExporter.xmltvContent, "guide.xml", "application/xml")}
                className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Save XMLTV</span>
              </button>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="p-2.5 bg-[#0A0D14] border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Interoperable Stream Ready</span>
            </div>
            <button
              onClick={handleForceSync}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1 underline cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Force Re-sync</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
