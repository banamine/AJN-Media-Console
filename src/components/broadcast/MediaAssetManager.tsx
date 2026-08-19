import React, { useState, useMemo } from "react";
import { MediaAsset } from "./types";
import { ThumbnailFactory } from "./ThumbnailFactory";
import { 
  Film, Search, Filter, Plus, UploadCloud, Folder, AlertTriangle, 
  CheckCircle, Edit3, Trash2, Tag, Volume2, ShieldAlert, Layers, RefreshCw
} from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface MediaAssetManagerProps {
  assets: MediaAsset[];
  onUpdateAsset: (updated: MediaAsset) => void;
  onDeleteAsset: (id: string) => void;
  onAddAssets: (newAssets: MediaAsset[]) => void;
  isLight: boolean;
}

export const MediaAssetManager: React.FC<MediaAssetManagerProps> = ({
  assets,
  onUpdateAsset,
  onDeleteAsset,
  onAddAssets,
  isLight
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("ALL");
  const [selectedResolution, setSelectedResolution] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFolderWatching, setIsFolderWatching] = useState(true);

  // Modal states
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEscapeKey(() => {
    if (editingAsset) setEditingAsset(null);
    if (showBatchModal) setShowBatchModal(false);
  });

  const [batchGenre, setBatchGenre] = useState("");
  const [batchTag, setBatchTag] = useState("");
  const [cogStyle, setCogStyle] = useState<"CINEMATIC" | "MINIMALIST" | "VIBRANT">("CINEMATIC");
  const [customCogPrompt, setCustomCogPrompt] = useState("");
  const [isCogGenerating, setIsCogGenerating] = useState(false);

  // Genres & Filtered Assets
  const genres = useMemo(() => {
    const set = new Set(assets.map(a => a.genre));
    return ["ALL", ...Array.from(set)];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchGenre = selectedGenre === "ALL" || a.genre === selectedGenre;
      const matchRes = selectedResolution === "ALL" || a.resolution === selectedResolution;
      return matchSearch && matchGenre && matchRes;
    });
  }, [assets, searchTerm, selectedGenre, selectedResolution]);

  // Handle Drag-and-drop / Upload Simulator
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newItems: MediaAsset[] = Array.from(e.target.files).map((file, idx) => ({
      id: `ast-ingest-${Date.now()}-${idx}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      subtitle: "Direct Drag-and-Drop Ingest",
      description: `Uploaded broadcast file (${Math.round(file.size / 1024 / 1024)} MB). Verified container structure.`,
      provider: "Local Studio Dropzone",
      collection: "New Ingestion",
      genre: "Variety",
      year: new Date().getFullYear(),
      runtime: Math.floor(Math.random() * 90) + 15,
      resolution: "1080p",
      codec: "H.264 / AVC",
      audioCodec: "AAC Stereo",
      language: "English",
      rating: "TV-14",
      poster: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
      backdrop: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
      thumbnail: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
      checksum: Math.random().toString(36).substring(2, 15),
      playCount: 0,
      lastPlayed: "Never",
      favorite: false,
      tags: ["ingest", "verified"],
      lufs: -14.0,
      healthScore: 100
    }));
    onAddAssets(newItems);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAssets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAssets.map(a => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const applyBatchEdit = () => {
    selectedIds.forEach(id => {
      const found = assets.find(a => a.id === id);
      if (found) {
        onUpdateAsset({
          ...found,
          genre: batchGenre || found.genre,
          tags: batchTag ? Array.from(new Set([...found.tags, batchTag])) : found.tags
        });
      }
    });
    setShowBatchModal(false);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Header & Folder Watching Status */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-500">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans flex items-center gap-2">
              Media Asset Management (MAM)
              <span className="text-xs py-0.5 px-2 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
                {assets.length} Assets
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              Folder Watch: <span className="text-emerald-400 font-bold">● ACTIVE</span> (/mnt/broadcast/incoming)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-sans flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/25 transition-all">
            <UploadCloud className="w-4 h-4" />
            Ingest Files
            <input type="file" multiple className="hidden" onChange={handleFileUpload} />
          </label>

          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-sans flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all"
            >
              <Layers className="w-4 h-4" />
              Batch Edit ({selectedIds.length})
            </button>
          )}

          <button
            onClick={() => setViewMode(prev => prev === "table" ? "grid" : "table")}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            {viewMode === "table" ? "🔲 Grid View" : "📋 Table View"}
          </button>
        </div>
      </div>

      {/* Drag and Drop Upload Simulator Dropzone */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) {
            const fakeInput = { target: { files: e.dataTransfer.files } } as any;
            handleFileUpload(fakeInput);
          }
        }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
          isLight ? "border-slate-300 bg-slate-50/50 hover:bg-slate-100/50" : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80"
        }`}
      >
        <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-2 opacity-80" />
        <p className="text-xs font-bold">Drag and drop broadcast masters (MP4, MKV, TS, MOV) here</p>
        <p className="text-[11px] text-slate-500 font-mono mt-1">Automated checksum verification, LUFS audio scan, and duplicate QC check on ingest</p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, provider, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            Genre:
          </div>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className={`py-2 px-3 rounded-xl border text-xs font-bold font-sans focus:outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"
            }`}
          >
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            value={selectedResolution}
            onChange={(e) => setSelectedResolution(e.target.value)}
            className={`py-2 px-3 rounded-xl border text-xs font-bold font-sans focus:outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"
            }`}
          >
            <option value="ALL">All Res</option>
            <option value="4K">4K UHD</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
        </div>
      </div>

      {/* Asset Table / Grid */}
      {viewMode === "table" ? (
        <div className={`rounded-2xl border overflow-x-auto ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b font-mono uppercase text-[10px] text-slate-400 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"}`}>
                <th className="p-3 w-10 text-center">
                  <input type="checkbox" checked={selectedIds.length === filteredAssets.length && filteredAssets.length > 0} onChange={handleSelectAll} />
                </th>
                <th className="p-3">Asset & Provider</th>
                <th className="p-3">Genre / Tags</th>
                <th className="p-3">Codec & Audio</th>
                <th className="p-3 text-center">LUFS</th>
                <th className="p-3 text-center">Health</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-sans">
              {filteredAssets.map(asset => {
                const isSelected = selectedIds.includes(asset.id);
                const isLoudnessBad = asset.lufs > -12 || asset.lufs < -18;
                return (
                  <tr key={asset.id} className={`transition-colors ${isSelected ? (isLight ? "bg-blue-50/60" : "bg-blue-900/20") : (isLight ? "hover:bg-slate-50" : "hover:bg-slate-800/30")}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(asset.id)} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={asset.poster || "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg"} 
                          alt={asset.title} 
                          className="w-10 h-14 rounded-xl object-cover bg-slate-800 shrink-0 border border-slate-700/50"
                        />
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            {asset.title}
                            <span className="text-[10px] py-0.5 px-1.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                              {asset.resolution}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{asset.subtitle || asset.provider}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">ID: {asset.id} • {asset.runtime} mins</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-300">{asset.genre}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {asset.tags.map(t => (
                          <span key={t} className="text-[10px] py-0.5 px-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>{asset.codec}</div>
                      <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                        <Volume2 className="w-3 h-3 text-blue-400" />
                        {asset.audioCodec}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      <span className={`py-1 px-2 rounded-xl text-[11px] ${
                        isLoudnessBad ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {asset.lufs} LUFS
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1 font-mono font-bold text-xs">
                        <span className={asset.healthScore < 80 ? "text-amber-400" : "text-emerald-400"}>
                          {asset.healthScore}%
                        </span>
                        {asset.isDuplicate && <span title="Duplicate Detected"><ShieldAlert className="w-3.5 h-3.5 text-red-500" /></span>}
                        {asset.isMissingArtwork && <span title="Missing Artwork"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></span>}
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button 
                        onClick={() => setEditingAsset(asset)}
                        className="p-1.5 rounded-xl hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                        title="Edit Metadata"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDeleteAsset(asset.id)}
                        className="p-1.5 rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Purge Asset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map(asset => (
            <div key={asset.id} className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
              isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/60 border-slate-800"
            }`}>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700/50">
                <img src={asset.backdrop || asset.poster} alt={asset.title} className="w-full h-full object-cover" />
                <span className="absolute top-2 right-2 text-[10px] font-mono font-bold py-0.5 px-1.5 rounded bg-black/80 text-white border border-white/20 backdrop-blur-md">
                  {asset.resolution}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm line-clamp-1">{asset.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{asset.description}</p>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2">
                  <span>{asset.runtime} mins</span>
                  <span className="text-emerald-400">{asset.lufs} LUFS</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">Score: {asset.healthScore}%</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditingAsset(asset)} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDeleteAsset(asset.id)} className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metadata Editor Modal */}
      {editingAsset && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingAsset(null)}
        >
          <div 
            className={`w-full max-w-2xl rounded-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                Asset Metadata Editor ({editingAsset.id})
              </h3>
              <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Title</label>
                <input 
                  type="text" 
                  value={editingAsset.title} 
                  onChange={e => setEditingAsset({...editingAsset, title: e.target.value})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Subtitle</label>
                <input 
                  type="text" 
                  value={editingAsset.subtitle} 
                  onChange={e => setEditingAsset({...editingAsset, subtitle: e.target.value})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-400 block mb-1">Description</label>
                <textarea 
                  rows={2}
                  value={editingAsset.description} 
                  onChange={e => setEditingAsset({...editingAsset, description: e.target.value})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Provider</label>
                <input 
                  type="text" 
                  value={editingAsset.provider} 
                  onChange={e => setEditingAsset({...editingAsset, provider: e.target.value})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Genre</label>
                <input 
                  type="text" 
                  value={editingAsset.genre} 
                  onChange={e => setEditingAsset({...editingAsset, genre: e.target.value})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={editingAsset.tags.join(", ")} 
                  onChange={e => setEditingAsset({...editingAsset, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">LUFS Loudness Score</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={editingAsset.lufs} 
                  onChange={e => setEditingAsset({...editingAsset, lufs: parseFloat(e.target.value) || -14})}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" 
                />
              </div>
            </div>

            {/* Phase 2 & Phase 3: CogView4 Prompting & Thumbnail Generation Pipeline */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono text-[10px] font-bold tracking-wider">COGVIEW4 GPU</span>
                  <span className="font-bold text-slate-200 text-xs">AJN Aesthetic Asset Pipeline</span>
                </div>
                {isCogGenerating && (
                  <span className="flex items-center gap-1.5 text-amber-400 text-[11px] font-mono font-bold animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating Poster...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-400 text-[11px] block mb-1">Style Dictionary</label>
                  <select 
                    value={cogStyle}
                    disabled={isCogGenerating}
                    onChange={e => setCogStyle(e.target.value as any)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold"
                  >
                    <option value="CINEMATIC">🎬 Cinematic</option>
                    <option value="MINIMALIST">📐 Minimalist</option>
                    <option value="VIBRANT">⚡ Vibrant</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-400 text-[11px] block mb-1">Custom Prompt Override (Optional)</label>
                  <input 
                    type="text"
                    disabled={isCogGenerating}
                    placeholder={`Leave empty to auto-build from ${cogStyle} template...`}
                    value={customCogPrompt}
                    onChange={e => setCustomCogPrompt(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  {editingAsset.thumbnail && (
                    <img src={editingAsset.thumbnail} alt="Poster preview" className="w-16 h-9 object-cover rounded border border-slate-600 shadow" />
                  )}
                  <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                    <p>Current: <span className="text-slate-200 truncate inline-block max-w-[180px] align-bottom">{editingAsset.thumbnail || "None"}</span></p>
                    <p>Resolution: 1024x1024 (16:9 Master)</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isCogGenerating}
                  onClick={async () => {
                    setIsCogGenerating(true);
                    try {
                      await ThumbnailFactory.generate(
                        editingAsset.id,
                        {
                          id: editingAsset.id,
                          title: editingAsset.title,
                          genre: editingAsset.genre,
                          description: editingAsset.description
                        },
                        (showId, newPath, styleName) => {
                          setEditingAsset(prev => prev ? { ...prev, thumbnail: newPath, poster: newPath } : null);
                        },
                        cogStyle,
                        customCogPrompt
                      );
                    } finally {
                      setIsCogGenerating(false);
                    }
                  }}
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCogGenerating ? "animate-spin" : ""}`} />
                  {editingAsset.thumbnail ? "Regenerate Thumbnail" : "Generate Thumbnail"}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={() => setEditingAsset(null)} className="py-2 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">
                Cancel
              </button>
              <button 
                onClick={() => {
                  onUpdateAsset(editingAsset);
                  setEditingAsset(null);
                }} 
                className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Edit Modal */}
      {showBatchModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBatchModal(false)}
        >
          <div 
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Batch Edit {selectedIds.length} Selected Assets
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Set New Genre</label>
                <input type="text" placeholder="e.g. Sci-Fi Classics" value={batchGenre} onChange={e => setBatchGenre(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Append Tag</label>
                <input type="text" placeholder="e.g. primetime_approved" value={batchTag} onChange={e => setBatchTag(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBatchModal(false)} className="py-2 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">Cancel</button>
              <button onClick={applyBatchEdit} className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">Apply Batch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
