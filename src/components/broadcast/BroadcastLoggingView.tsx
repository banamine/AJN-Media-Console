import React, { useState } from "react";
import { BroadcastLog } from "./types";
import { FileCode, Search, Filter, Download, ShieldCheck, AlertTriangle, Info, CheckCircle2, Clock, Terminal } from "lucide-react";

interface BroadcastLoggingViewProps {
  logs: BroadcastLog[];
  onClearLogs: () => void;
  isLight: boolean;
}

export const BroadcastLoggingView: React.FC<BroadcastLoggingViewProps> = ({
  logs,
  onClearLogs,
  isLight
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        log.channelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        log.id.includes(searchTerm);
    const matchLevel = levelFilter === "ALL" || log.level === levelFilter;
    const matchCat = categoryFilter === "ALL" || log.category === categoryFilter;
    return matchSearch && matchLevel && matchCat;
  });

  const handleExportCsv = () => {
    const headers = "Timestamp,Level,Category,Channel,Message,Program\n";
    const rows = filteredLogs.map(l => `"${l.timestamp}","${l.level}","${l.category}","${l.channelId}","${l.message.replace(/"/g, '""')}","${l.programTitle || ''}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ajn-as-run-broadcast-logs-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div>
          <h2 className="text-lg font-bold font-sans flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            FCC Compliance Audit & As-Run Broadcast Logging
            <span className="text-xs py-0.5 px-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              {logs.length} Recorded Events
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time SCTE-35 ad-insertion triggers, CALM Act telemetry audits, playout errors, and EAS failover logs</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all"
          >
            <Download className="w-4 h-4" /> Export As-Run CSV
          </button>
          <button
            onClick={onClearLogs}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700" : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
            }`}
          >
            Clear Buffer
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search telemetry records by keyword or channel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-sans focus:outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className={`py-2 px-3 rounded-xl border text-xs font-bold font-mono focus:outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"
            }`}
          >
            <option value="ALL">Level: ALL</option>
            <option value="INFO">Level: INFO</option>
            <option value="WARN">Level: WARN</option>
            <option value="ERROR">Level: ERROR</option>
            <option value="AUDIT">Level: AUDIT</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`py-2 px-3 rounded-xl border text-xs font-bold font-sans focus:outline-none ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"
            }`}
          >
            <option value="ALL">Category: ALL</option>
            <option value="PLAYOUT">PLAYOUT</option>
            <option value="SCTE35">SCTE-35 AD</option>
            <option value="LOUDNESS">LOUDNESS</option>
            <option value="SCHEDULER">SCHEDULER</option>
            <option value="FAILOVER">FAILOVER</option>
          </select>
        </div>
      </div>

      {/* Terminal Styled Log Table */}
      <div className={`rounded-2xl border font-mono text-xs overflow-hidden shadow-2xl ${
        isLight ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-slate-950 text-slate-200 border-slate-800/90"
      }`}>
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <strong className="text-slate-300 ml-2">master-control-syslog.log</strong>
          </span>
          <span>Buffer: {filteredLogs.length} / 10,000 Lines</span>
        </div>

        <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
          {filteredLogs.map(log => {
            const isErr = log.level === "ERROR";
            const isWarn = log.level === "WARN";
            const isAudit = log.level === "AUDIT";

            return (
              <div key={log.id} className="py-2 px-3 rounded hover:bg-slate-900/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="text-slate-500 text-[10px] whitespace-nowrap pt-0.5 shrink-0">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                    isErr ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                    isWarn ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                    isAudit ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>
                    [{log.level}]
                  </span>
                  <span className="text-emerald-400 text-[11px] font-bold shrink-0">({log.category})</span>
                  <span className="text-slate-200">{log.message}</span>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-500 self-end sm:self-center shrink-0">
                  {log.programTitle && <span className="text-amber-300/80 font-sans">"{log.programTitle}"</span>}
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">{log.channelId}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
