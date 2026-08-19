import React, { useState } from "react";
import { MediaAsset } from "./types";
import { ShieldAlert, AlertTriangle, CheckCircle, RefreshCw, Eye, Volume2, ShieldCheck, Film, Play, Search, Filter } from "lucide-react";

interface QC_DashboardViewProps {
  assets: MediaAsset[];
  onTriggerQC: (assetId: string) => void;
  onApproveAsset: (assetId: string) => void;
  isLight: boolean;
}

export const QC_DashboardView: React.FC<QC_DashboardViewProps> = ({
  assets,
  onTriggerQC,
  onApproveAsset,
  isLight
}) => {
  const [filter, setFilter] = useState<"ALL" | "ISSUES" | "PASSED">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssetForSim, setSelectedAssetForSim] = useState<MediaAsset | null>(null);

  const filteredAssets = assets.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.id.includes(searchTerm);
    const hasIssue = a.healthScore < 85 || a.isDuplicate || a.isMissingArtwork || a.lufs > -12 || a.lufs < -18;
    if (filter === "ISSUES") return matchSearch && hasIssue;
    if (filter === "PASSED") return matchSearch && !hasIssue;
    return matchSearch;
  });

  const issueCount = assets.filter(a => a.healthScore < 85 || a.isDuplicate || a.isMissingArtwork || a.lufs > -12 || a.lufs < -18).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div>
          <h2 className="text-lg font-bold font-sans flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Automated Quality Control (QC) & Loudness Compliance
            <span className="text-xs py-0.5 px-2 rounded-full bg-red-500/20 text-rose-300 border border-red-500/30">
              {issueCount} Flagged Items
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Automated CALM Act ITU-R BS.1770 loudness scanning, frame freeze QC, video black detection, and duplicate checks</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => assets.forEach(a => onTriggerQC(a.id))}
            className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Run Full Network QC Scan
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search master assets by title or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-sans focus:outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 font-mono text-xs font-bold">
          <button
            onClick={() => setFilter("ALL")}
            className={`py-1.5 px-3 rounded-xl transition-all ${filter === "ALL" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            All Masters ({assets.length})
          </button>
          <button
            onClick={() => setFilter("ISSUES")}
            className={`py-1.5 px-3 rounded-xl transition-all ${filter === "ISSUES" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-rose-300"}`}
          >
            ⚠️ Flagged Issues ({issueCount})
          </button>
          <button
            onClick={() => setFilter("PASSED")}
            className={`py-1.5 px-3 rounded-xl transition-all ${filter === "PASSED" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-emerald-300"}`}
          >
            ✓ Passed QC ({assets.length - issueCount})
          </button>
        </div>
      </div>

      {/* QC Masters Table */}
      <div className={`rounded-2xl border overflow-x-auto ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className={`border-b font-mono uppercase text-[10px] text-slate-400 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"}`}>
              <th className="p-3.5">Asset Title & Ingest ID</th>
              <th className="p-3.5">Video Codec & Res</th>
              <th className="p-3.5">Audio Loudness (LUFS)</th>
              <th className="p-3.5">QC Integrity Diagnostics</th>
              <th className="p-3.5 text-center">Health Score</th>
              <th className="p-3.5 text-right">Playout Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 font-sans">
            {filteredAssets.map(asset => {
              const isLoudnessBad = asset.lufs > -12 || asset.lufs < -18;
              const hasIssue = asset.healthScore < 85 || asset.isDuplicate || asset.isMissingArtwork || isLoudnessBad;

              return (
                <tr key={asset.id} className={`transition-colors ${hasIssue ? (isLight ? "bg-rose-50/40" : "bg-red-950/15") : (isLight ? "hover:bg-slate-50" : "hover:bg-slate-800/30")}`}>
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={asset.poster || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg"}
                        alt={asset.title}
                        className="w-9 h-12 rounded object-cover bg-slate-800 border border-slate-700 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          {asset.title}
                          {asset.favorite && <span className="text-amber-400">★</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">ID: {asset.id} • Checksum: {asset.checksum.substring(0,8)}...</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5 font-mono text-[11px]">
                    <div className="text-slate-200 font-bold">{asset.resolution}</div>
                    <div className="text-slate-400 mt-0.5">{asset.codec}</div>
                  </td>

                  <td className="p-3.5 font-mono">
                    <div className="flex items-center gap-2">
                      <Volume2 className={`w-4 h-4 ${isLoudnessBad ? "text-amber-500" : "text-blue-400"}`} />
                      <span className={`font-bold ${isLoudnessBad ? "text-amber-400 underline" : "text-emerald-400"}`}>
                        {asset.lufs} LUFS
                      </span>
                    </div>
                    {isLoudnessBad && <span className="text-[10px] text-amber-500 block mt-0.5 font-mono">CALM Act Non-Compliant (-24±2 target)</span>}
                  </td>

                  <td className="p-3.5 font-mono text-[11px] space-y-1">
                    {asset.isDuplicate && (
                      <div className="text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Duplicate Master Detected in Library
                      </div>
                    )}
                    {asset.isMissingArtwork && (
                      <div className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Missing Metadata Artwork / Keyframe
                      </div>
                    )}
                    {!hasIssue && (
                      <div className="text-emerald-400 flex items-center gap-1 font-bold font-sans">
                        <ShieldCheck className="w-4 h-4 shrink-0" /> All Automated QC Tests Passed
                      </div>
                    )}
                  </td>

                  <td className="p-3.5 text-center">
                    <span className={`py-1 px-2.5 rounded-xl font-mono font-bold text-xs ${
                      asset.healthScore < 80 ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {asset.healthScore}%
                    </span>
                  </td>

                  <td className="p-3.5 text-right space-x-1.5">
                    <button
                      onClick={() => setSelectedAssetForSim(asset)}
                      className="py-1.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" /> QC Review
                    </button>
                    {hasIssue ? (
                      <button
                        onClick={() => onApproveAsset(asset.id)}
                        className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow shadow-emerald-600/30"
                      >
                        Override & Approve
                      </button>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-1">✓ APPROVED</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* QC Visual Inspection Simulator Modal */}
      {selectedAssetForSim && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-950 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4 border-slate-800">
              <div className="flex items-center gap-3">
                <Film className="w-6 h-6 text-blue-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Broadcast Master QC Bench: {selectedAssetForSim.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedAssetForSim.id} • Checksum: {selectedAssetForSim.checksum}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAssetForSim(null)} className="text-slate-400 hover:text-white font-bold text-base">✕</button>
            </div>

            {/* Video Inspection Preview Canvas */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
              <img src={selectedAssetForSim.backdrop || selectedAssetForSim.poster} alt="QC Stage" className="w-full h-full object-cover opacity-75" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
              <div className="absolute top-4 left-4 font-mono text-[11px] bg-black/80 px-3 py-1.5 rounded border border-white/20 text-emerald-400 space-y-0.5">
                <div>[ VECTOROSCOPE: OK ]</div>
                <div>[ WAVEFORM GAMUT: 100% LEGAL ]</div>
                <div>[ AUDIO PEAK: -2.1 dBFS ]</div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-white">
                <span>TIMECODE: 00:14:22:18</span>
                <span className="text-blue-400">{selectedAssetForSim.codec} • {selectedAssetForSim.resolution}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">LUFS LOUDNESS</span>
                <span className="font-bold text-emerald-400 text-sm">{selectedAssetForSim.lufs} LUFS</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">BITRATE</span>
                <span className="font-bold text-white text-sm">12,450 kbps</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">CONTAINER SYNC</span>
                <span className="font-bold text-emerald-400 text-sm">100% Locked</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSelectedAssetForSim(null)} className="py-2.5 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">Close Bench</button>
              <button 
                onClick={() => {
                  onApproveAsset(selectedAssetForSim.id);
                  setSelectedAssetForSim(null);
                }} 
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
              >
                Approve for On-Air Playout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
