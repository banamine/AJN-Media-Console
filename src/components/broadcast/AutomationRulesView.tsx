import React, { useState } from "react";
import { AutomationRule, VirtualChannel } from "./types";
import { Sliders, Shield, Clock, Film, RefreshCw, AlertCircle, Plus, Trash2, Check, ArrowUp, ArrowDown } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface AutomationRulesViewProps {
  rules: AutomationRule[];
  channels: VirtualChannel[];
  onToggleRule: (id: string) => void;
  onUpdateRule: (rule: AutomationRule) => void;
  onAddRule: (rule: AutomationRule) => void;
  onDeleteRule: (id: string) => void;
  isLight: boolean;
}

export const AutomationRulesView: React.FC<AutomationRulesViewProps> = ({
  rules,
  channels,
  onToggleRule,
  onUpdateRule,
  onAddRule,
  onDeleteRule,
  isLight
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  useEscapeKey(() => {
    if (showAddModal) setShowAddModal(false);
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<AutomationRule["type"]>("avoid_repeat");
  const [chId, setChId] = useState("ALL");
  const [priority, setPriority] = useState(3);

  const handleCreate = () => {
    if (!name.trim()) return;
    const item: AutomationRule = {
      id: `rul-${Date.now()}`,
      name,
      type,
      channelId: chId,
      enabled: true,
      config: {
        windowHours: type === "avoid_repeat" ? 12 : undefined,
        targetSlot: type === "reserve_slot" ? "20:00-23:00" : undefined,
        intervalMin: type === "station_id_top" || type === "promo_interval" ? 60 : undefined,
        maxRating: type === "content_rating" ? "TV-PG" : undefined,
        priority
      }
    };
    onAddRule(item);
    setShowAddModal(false);
    setName("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div>
          <h2 className="text-lg font-bold font-sans flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            Automation Rules & AI Guardrails
            <span className="text-xs py-0.5 px-2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {rules.filter(r => r.enabled).length} Active Rules
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Define automated scheduling guardrails, slot reservations, rating restrictions, and bumper cadence</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Scheduling Rule
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.sort((a, b) => (a.config.priority || 5) - (b.config.priority || 5)).map((rule) => {
          const chName = rule.channelId === "ALL" ? "All Channels" : channels.find(c => c.id === rule.channelId)?.name || rule.channelId;
          return (
            <div key={rule.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
              rule.enabled ? (isLight ? "bg-amber-50/40 border-amber-200" : "bg-slate-900/80 border-amber-500/30 shadow-md")
                           : (isLight ? "bg-slate-50 border-slate-200 opacity-60" : "bg-slate-900/40 border-slate-800 opacity-60")
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border font-mono font-bold text-xs shrink-0 ${
                  rule.enabled ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-500 border-slate-700"
                }`}>
                  P{rule.config.priority || 5}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-100">{rule.name}</h4>
                    <span className="text-[10px] font-mono py-0.5 px-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {rule.type.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Target: <strong className="text-amber-400">{chName}</strong>
                    {rule.config.windowHours && ` • Avoid Repeat: ${rule.config.windowHours}h Window`}
                    {rule.config.targetSlot && ` • Reserved Slot: ${rule.config.targetSlot}`}
                    {rule.config.intervalMin && ` • Inject Every: ${rule.config.intervalMin} mins`}
                    {rule.config.maxRating && ` • Rating Ceiling: ${rule.config.maxRating}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => onToggleRule(rule.id)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    rule.enabled ? "bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/25" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {rule.enabled ? "✓ ENFORCED" : "DISABLED"}
                </button>

                <button
                  onClick={() => onDeleteRule(rule.id)}
                  className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Purge Rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rule Modal */}
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
              <Plus className="w-5 h-5 text-amber-400" /> Add Scheduling Rule
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Rule Name</label>
                <input type="text" placeholder="e.g. Primetime Movie Lockdown" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white" />
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Guardrail Logic Type</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold">
                  <option value="avoid_repeat">🔄 Avoid Repeat within Window</option>
                  <option value="reserve_slot">📅 Reserve Defined Time Slot</option>
                  <option value="station_id_top">🏷️ Top of Hour Station ID Bumper</option>
                  <option value="promo_interval">📢 Promo / Commercial Interval</option>
                  <option value="content_rating">🔞 Content Rating Restriction</option>
                  <option value="gap_filler">🧱 Automatic Schedule Gap Filler</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Target Channel</label>
                <select value={chId} onChange={e => setChId(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold">
                  <option value="ALL">All Channels</option>
                  {channels.map(c => <option key={c.id} value={c.id}>Ch {c.number}: {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-400 block mb-1">Execution Priority (1 = Highest)</label>
                <input type="number" min={1} max={10} value={priority} onChange={e => setPriority(parseInt(e.target.value) || 3)} className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setShowAddModal(false)} className="py-2 px-4 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">Cancel</button>
              <button onClick={handleCreate} className="py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">Enforce Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
