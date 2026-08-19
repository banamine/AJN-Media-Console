import React, { useState } from "react";
import { GraphicsOverlay, VirtualChannel } from "./types";
import { Layers, Zap, Plus, Trash2, Edit3, Check, Eye, CloudRain, Clock, Trophy, Flame, Bell } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface GraphicsEngineViewProps {
  overlays: GraphicsOverlay[];
  channels: VirtualChannel[];
  onToggleOverlay: (id: string) => void;
  onUpdateOverlay: (overlay: GraphicsOverlay) => void;
  onAddOverlay: (overlay: GraphicsOverlay) => void;
  onDeleteOverlay: (id: string) => void;
  isLight: boolean;
}

export const GraphicsEngineView: React.FC<GraphicsEngineViewProps> = ({
  overlays,
  channels,
  onToggleOverlay,
  onUpdateOverlay,
  onAddOverlay,
  onDeleteOverlay,
  isLight
}) => {
  const [editingOverlay, setEditingOverlay] = useState<GraphicsOverlay | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEscapeKey(() => {
    if (editingOverlay) setEditingOverlay(null);
    if (showAddModal) setShowAddModal(false);
  });

  // New Overlay Form State
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<GraphicsOverlay["type"]>("breaking_news");
  const [newChId, setNewChId] = useState("ALL");

  const handleCreate = () => {
    if (!newName.trim()) return;
    const item: GraphicsOverlay = {
      id: `ovl-${Date.now()}`,
      name: newName,
      type: newType,
      active: true,
      channelId: newChId,
      templateData: {
        headline: newType === "breaking_news" ? "NEW DEVELOPMENTS REPORTED IN GLOBAL TECH SECTOR" : undefined,
        subtext: "Live updates streaming continuous via master control playout.",
        temperature: newType === "weather" ? "72°F / 22°C" : undefined,
        condition: newType === "weather" ? "Partly Cloudy • Wind 10mph ENE" : undefined,
        teamA: newType === "sports_score" ? { name: "AJN Apex", score: 2 } : undefined,
        teamB: newType === "sports_score" ? { name: "Cyber Titans", score: 1 } : undefined,
        items: newType === "ticker" ? ["Item 1: E-Sports Playoffs Live", "Item 2: Stock Markets Rally +1.8%"] : undefined,
        bgAccent: newType === "breaking_news" ? "#dc2626" : newType === "weather" ? "#0284c7" : "#16a34a"
      }
    };
    onAddOverlay(item);
    setShowAddModal(false);
    setNewName("");
  };

  const getOverlayIcon = (type: GraphicsOverlay["type"]) => {
    switch (type) {
      case "breaking_news": return <Flame className="w-4 h-4 text-red-500" />;
      case "weather": return <CloudRain className="w-4 h-4 text-sky-400" />;
      case "clock": return <Clock className="w-4 h-4 text-amber-400" />;
      case "sports_score": return <Trophy className="w-4 h-4 text-emerald-400" />;
      default: return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div>
          <h2 className="text-lg font-bold font-sans flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Live Broadcast Graphics Engine
            <span className="text-xs py-0.5 px-2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {overlays.filter(o => o.active).length} Active Overlays
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage HTML5 dynamic lower-thirds, news tickers, sports scoreboards, and emergency crawls</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Graphic Template
        </button>
      </div>

      {/* Overlays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {overlays.map(overlay => {
          const chName = overlay.channelId === "ALL" ? "All Broadcast Channels" : channels.find(c => c.id === overlay.channelId)?.name || overlay.channelId;
          return (
            <div key={overlay.id} className={`rounded-2xl border p-5 transition-all flex flex-col justify-between gap-4 ${
              overlay.active ? (isLight ? "bg-purple-50/50 border-purple-300 shadow-md" : "bg-purple-950/20 border-purple-800/80 shadow-lg shadow-purple-900/10")
                             : (isLight ? "bg-white border-slate-200" : "bg-slate-900/40 border-slate-800")
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${overlay.active ? "bg-purple-500/20 border-purple-500/40" : "bg-slate-800 border-slate-700"}`}>
                    {getOverlayIcon(overlay.type)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      {overlay.name}
                    </h4>
                    <span className="text-[11px] font-mono text-purple-400 mt-0.5 block">
                      Target: {chName} • Type: {overlay.type.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => onToggleOverlay(overlay.id)}
                  className={`py-1.5 px-3 rounded-full text-xs font-bold font-mono transition-all flex items-center gap-1.5 shrink-0 ${
                    overlay.active ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 animate-pulse" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${overlay.active ? "bg-black" : "bg-slate-500"}`} />
                  {overlay.active ? "ON-AIR" : "STANDBY"}
                </button>
              </div>

              {/* Graphic Mockup Preview Box */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-xs space-y-1 overflow-hidden">
                {overlay.type === "breaking_news" && (
                  <div className="bg-rose-600 text-white p-2 rounded-xl font-bold font-sans flex items-center gap-2 text-[11px] shadow">
                    <Flame className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                    <span className="truncate">{overlay.templateData.headline}</span>
                  </div>
                )}
                {overlay.type === "weather" && (
                  <div className="bg-sky-600 text-white p-2 rounded-xl font-bold font-sans flex items-center justify-between text-[11px] shadow">
                    <span className="flex items-center gap-1.5"><CloudRain className="w-3.5 h-3.5" /> {overlay.templateData.temperature}</span>
                    <span className="truncate text-[10px] opacity-90">{overlay.templateData.condition}</span>
                  </div>
                )}
                {overlay.type === "sports_score" && overlay.templateData.teamA && (
                  <div className="bg-emerald-700 text-white p-2 rounded-xl font-bold font-sans flex items-center justify-around text-xs shadow">
                    <span>{overlay.templateData.teamA.name}: <strong className="text-amber-300">{overlay.templateData.teamA.score}</strong></span>
                    <span className="text-[10px] opacity-60">VS</span>
                    <span>{overlay.templateData.teamB?.name}: <strong className="text-amber-300">{overlay.templateData.teamB?.score}</strong></span>
                  </div>
                )}
                {overlay.type === "ticker" && overlay.templateData.items && (
                  <div className="bg-slate-900 text-emerald-400 p-2 rounded-xl text-[11px] font-mono whitespace-nowrap overflow-hidden">
                    📜 {overlay.templateData.items.join("   •••   ")}
                  </div>
                )}
                {overlay.type === "clock" && (
                  <div className="text-center font-bold text-amber-400 tracking-widest text-sm py-1">
                    [ UTC 02:00:00 • STATION TIME ]
                  </div>
                )}
                <div className="text-[10px] text-slate-500 pt-1 flex justify-between">
                  <span>Template Data Configured</span>
                  <span style={{ color: overlay.templateData.bgAccent }}>Accent: {overlay.templateData.bgAccent || "#333"}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">ID: {overlay.id}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditingOverlay(overlay)}
                    className="py-1 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Data
                  </button>
                  <button
                    onClick={() => onDeleteOverlay(overlay.id)}
                    className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    title="Delete Graphic"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Graphic Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" /> Create Graphic Template
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Graphic Title</label>
                <input type="text" placeholder="e.g. Primetime Sports Banner" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Graphic Preset Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value as any)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold">
                  <option value="breaking_news">🔥 Breaking News Crawl</option>
                  <option value="ticker">📜 Scrolling Ticker</option>
                  <option value="weather">⛈️ Severe Weather Strip</option>
                  <option value="sports_score">🏆 Sports Scoreboard</option>
                  <option value="clock">⏱️ Top of Hour Clock</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Target Channel</label>
                <select value={newChId} onChange={e => setNewChId(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold">
                  <option value="ALL">All Channels (Simulcast)</option>
                  {channels.map(c => <option key={c.id} value={c.id}>Ch {c.number}: {c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setShowAddModal(false)} className="py-2 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">Cancel</button>
              <button onClick={handleCreate} className="py-2 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">Deploy Graphic</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Overlay Modal */}
      {editingOverlay && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingOverlay(null)}
        >
          <div 
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-purple-400" /> Edit Graphic Data ({editingOverlay.name})
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Headline / Primary Text</label>
                <input 
                  type="text" 
                  value={editingOverlay.templateData.headline || ""} 
                  onChange={e => setEditingOverlay({...editingOverlay, templateData: {...editingOverlay.templateData, headline: e.target.value}})} 
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Subtext / Secondary Description</label>
                <input 
                  type="text" 
                  value={editingOverlay.templateData.subtext || ""} 
                  onChange={e => setEditingOverlay({...editingOverlay, templateData: {...editingOverlay.templateData, subtext: e.target.value}})} 
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" 
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Accent HEX Color</label>
                <input 
                  type="text" 
                  value={editingOverlay.templateData.bgAccent || "#dc2626"} 
                  onChange={e => setEditingOverlay({...editingOverlay, templateData: {...editingOverlay.templateData, bgAccent: e.target.value}})} 
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono uppercase" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setEditingOverlay(null)} className="py-2 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">Cancel</button>
              <button 
                onClick={() => {
                  onUpdateOverlay(editingOverlay);
                  setEditingOverlay(null);
                }} 
                className="py-2 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                Save Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
