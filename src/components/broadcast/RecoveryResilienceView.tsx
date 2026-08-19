import React, { useState } from "react";
import { VirtualChannel } from "./types";
import { ShieldAlert, RefreshCw, Server, AlertTriangle, CheckCircle2, Play, Flame, HardDrive, WifiOff, ShieldCheck, Activity } from "lucide-react";

interface RecoveryResilienceViewProps {
  channels: VirtualChannel[];
  onTriggerFailover: (channelId: string) => void;
  onRestoreNominal: (channelId: string) => void;
  onInjectEmergencyAlert: (text: string) => void;
  isLight: boolean;
}

export const RecoveryResilienceView: React.FC<RecoveryResilienceViewProps> = ({
  channels,
  onTriggerFailover,
  onRestoreNominal,
  onInjectEmergencyAlert,
  isLight
}) => {
  const [easText, setEasText] = useState("CIVIL EMERGENCY MESSAGE: SEVERE WEATHER ALERT ISSUED FOR ALL BROADCAST SECTORS. TAKE SHELTER IMMEDIATELY.");
  const [isInjectingEas, setIsInjectingEas] = useState(false);

  const handleEasSim = () => {
    setIsInjectingEas(true);
    onInjectEmergencyAlert(easText);
    setTimeout(() => setIsInjectingEas(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div>
          <h2 className="text-lg font-bold font-sans flex items-center gap-2">
            <Server className="w-5 h-5 text-sky-400" />
            Disaster Recovery & Redundant Playout Resilience (N+1)
            <span className="text-xs py-0.5 px-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              SLA 99.999%
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Automated N+1 hot failover routing, Emergency Alert System (EAS) overrides, and emergency slate injection</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => channels.forEach(c => onRestoreNominal(c.id))}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Reset All Servers Nominal
          </button>
        </div>
      </div>

      {/* Emergency Alert System (EAS) Override Cockpit */}
      <div className={`p-6 rounded-2xl border-2 border-red-500/40 transition-all ${
        isLight ? "bg-rose-50/50" : "bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-900 border-rose-600/50 shadow-2xl shadow-red-950/20"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-400 uppercase tracking-wide flex items-center gap-2">
                Emergency Alert System (EAS) Simulcast Override
              </h3>
              <p className="text-xs text-slate-400">Forces immediate audio tone trigger & visual crawl across ALL 24/7 active channel encoders</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-red-400 py-1 px-3 rounded-full bg-red-500/10 border border-red-500/30">
            PRIORITY 0 (ABSOLUTE)
          </span>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold font-mono text-slate-400 block">EAS TELETYPE BROADCAST PAYLOAD</label>
          <textarea
            rows={2}
            value={easText}
            onChange={(e) => setEasText(e.target.value)}
            className="w-full p-3 rounded-2xl bg-slate-950 border border-red-500/30 text-rose-300 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex justify-end pt-1">
            <button
              onClick={handleEasSim}
              disabled={isInjectingEas}
              className="py-3 px-6 rounded-2xl bg-rose-600 hover:bg-red-500 disabled:bg-rose-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-rose-600/30 transition-all"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              {isInjectingEas ? "Simulating Network EAS Broadcast..." : "🚨 Transmit EAS Emergency Override"}
            </button>
          </div>
        </div>
      </div>

      {/* Redundant Playout Servers Matrix (N+1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map(ch => {
          const isFailover = ch.status === "FAILOVER";
          const isBuffering = ch.status === "BUFFERING";

          return (
            <div key={ch.id} className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all ${
              isFailover ? "bg-amber-950/20 border-amber-600/60 shadow-lg shadow-amber-900/10" :
              isBuffering ? "bg-red-950/20 border-rose-600/60" :
              (isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800")
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Ch {ch.number}</span>
                    <h4 className="font-bold text-sm text-slate-100 truncate">{ch.name}</h4>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">Primary: <strong className="text-emerald-400">Encoder-A1</strong> • Hot Backup: <strong className="text-sky-400">Encoder-B1</strong></p>
                </div>

                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold shrink-0 ${
                  isFailover ? "bg-amber-500 text-black animate-pulse" :
                  isBuffering ? "bg-red-500 text-white" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}>
                  {isFailover ? "⚠️ FAILOVER B1" : isBuffering ? "BUFFER SLATE" : "● NOMINAL A1"}
                </span>
              </div>

              {/* Status Simulator Box */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Heartbeat Pulse:</span>
                  <span className={isFailover ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    {isFailover ? "142ms (Backup Active)" : "12ms (Primary Active)"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Playout Buffer:</span>
                  <span className="text-white font-bold">10,000 frames (Locked)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Failover SLA:</span>
                  <span className="text-sky-400">&lt; 500ms Seamless Switch</span>
                </div>
              </div>

              {/* Recovery Controls */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">Call: {ch.callSign}</span>
                <div className="flex gap-2">
                  {!isFailover ? (
                    <button
                      onClick={() => onTriggerFailover(ch.id)}
                      className="py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                    >
                      Simulate Primary Crash
                    </button>
                  ) : (
                    <button
                      onClick={() => onRestoreNominal(ch.id)}
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow shadow-emerald-600/30"
                    >
                      Restore Primary Nominal
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
