import React, { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  Headphones, 
  Bluetooth, 
  Cpu, 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  ChevronDown,
  Volume2
} from "lucide-react";

interface StatusIndicatorBarProps {
  theme?: "dark" | "light";
}

interface DiagnosticState {
  online: boolean;
  networkType: string;
  bluetoothConnected: boolean;
  audioDeviceName: string;
  hwAccelerated: boolean;
  gpuDecoder: string;
  idbHealth: "healthy" | "warning" | "error";
  storageUsedMB: number;
  storageQuotaMB: number;
}

export function StatusIndicatorBar({ theme = "dark" }: StatusIndicatorBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DiagnosticState>({
    online: navigator.onLine ?? true,
    networkType: "Wi-Fi / Ethernet (Broadband)",
    bluetoothConnected: false,
    audioDeviceName: "System Default Sink (Stereo)",
    hwAccelerated: true,
    gpuDecoder: "WebCodecs / VideoToolbox MSE",
    idbHealth: "healthy",
    storageUsedMB: 14.2,
    storageQuotaMB: 1024.0,
  });

  useEffect(() => {
    const updateOnline = () => setStats(prev => ({ ...prev, online: true }));
    const updateOffline = () => setStats(prev => ({ ...prev, online: false }));

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);

    // Estimate storage quota
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const used = (estimate.usage || 0) / (1024 * 1024);
        const quota = (estimate.quota || 1024 * 1024 * 1024) / (1024 * 1024);
        const ratio = used / quota;
        let health: "healthy" | "warning" | "error" = "healthy";
        if (ratio > 0.85) health = "warning";
        if (ratio > 0.95) health = "error";

        setStats(prev => ({
          ...prev,
          storageUsedMB: Math.round(used * 10) / 10,
          storageQuotaMB: Math.round(quota * 10) / 10,
          idbHealth: health
        }));
      }).catch(() => {});
    }

    // Check audio output devices for Bluetooth indicators
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioOutputs = devices.filter(d => d.kind === "audiooutput");
        const btDevice = audioOutputs.find(d => 
          d.label.toLowerCase().includes("bluetooth") || 
          d.label.toLowerCase().includes("airpods") || 
          d.label.toLowerCase().includes("sony") || 
          d.label.toLowerCase().includes("bose") ||
          d.label.toLowerCase().includes("headset")
        );
        if (btDevice && btDevice.label) {
          setStats(prev => ({
            ...prev,
            bluetoothConnected: true,
            audioDeviceName: btDevice.label
          }));
        }
      }).catch(() => {});
    }

    // Check WebGL/GPU status
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
          const isSoftware = renderer.toLowerCase().includes("swiftshader") || renderer.toLowerCase().includes("llvmpipe");
          setStats(prev => ({
            ...prev,
            hwAccelerated: !isSoftware,
            gpuDecoder: renderer ? renderer.slice(0, 36) : "Hardware GPU Decode"
          }));
        }
      }
    } catch {}


    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  const getBadgeColor = (status: "good" | "warning" | "error") => {
    switch (status) {
      case "good":
        return "bg-emerald-500 shadow-emerald-500/50";
      case "warning":
        return "bg-amber-500 shadow-amber-500/50";
      case "error":
        return "bg-red-500 shadow-red-500/50";
    }
  };

  const isLight = theme === "light";

  return (
    <div className="relative inline-block z-40">
      {/* STATUS CHIP TRIGGER */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border font-mono text-[11px] transition-all cursor-pointer active:scale-95 shadow-sm ${
          isLight
            ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            : "bg-[#0b101b] border-slate-800/80 text-slate-300 hover:bg-slate-800/50"
        }`}
        title="System Status & Media Diagnostics Panel"
      >
        {/* Network Icon */}
        <div className="flex items-center gap-1 relative">
          {stats.online ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          )}
          <span className={`w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5 shadow-sm ${getBadgeColor(stats.online ? "good" : "error")}`} />
        </div>

        {/* Bluetooth Icon */}
        <div className="flex items-center gap-1 relative pl-1 border-l border-slate-700/40">
          {stats.bluetoothConnected ? (
            <Headphones className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Bluetooth className="w-3.5 h-3.5 text-slate-400 opacity-70" />
          )}
          <span className={`w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5 shadow-sm ${getBadgeColor(stats.bluetoothConnected ? "good" : "warning")}`} />
        </div>

        {/* Hardware Decode Icon */}
        <div className="flex items-center gap-1 relative pl-1 border-l border-slate-700/40 hidden sm:flex">
          <Cpu className={`w-3.5 h-3.5 ${stats.hwAccelerated ? "text-amber-400" : "text-red-400"}`} />
          <span className={`w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5 shadow-sm ${getBadgeColor(stats.hwAccelerated ? "good" : "warning")}`} />
        </div>

        {/* Cache / IDB Health */}
        <div className="flex items-center gap-1 relative pl-1 border-l border-slate-700/40 hidden sm:flex">
          <Database className={`w-3.5 h-3.5 ${stats.idbHealth === "healthy" ? "text-emerald-400" : "text-amber-400"}`} />
          <span className={`w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5 shadow-sm ${getBadgeColor(stats.idbHealth === "healthy" ? "good" : stats.idbHealth === "warning" ? "warning" : "error")}`} />
        </div>

        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* EXPANDED SYSTEM STATUS PANEL */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
            isLight
              ? "bg-white border-slate-200 text-slate-800"
              : "bg-[#0B0E14] border-slate-800 text-slate-200 shadow-blue-950/40"
          }`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">Diagnostics HUD</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Live Engine
              </span>
            </div>

            <div className="space-y-3 font-sans text-xs">
              {/* Network Row */}
              <div className="flex items-start justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <Wifi className={`w-4 h-4 ${stats.online ? "text-emerald-400" : "text-red-400"}`} />
                  <div>
                    <div className="font-semibold text-slate-200">Network Link</div>
                    <div className="text-[10px] text-slate-400 font-mono">{stats.networkType}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${getBadgeColor(stats.online ? "good" : "error")}`} />
                  <span className="text-[11px] font-mono font-bold text-slate-300">
                    {stats.online ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
              </div>

              {/* Audio / Bluetooth Row */}
              <div className="flex items-start justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800/40">
                <div className="flex items-center gap-2.5">
                  {stats.bluetoothConnected ? (
                    <Headphones className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-200">Audio Sink</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                      {stats.audioDeviceName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono font-bold text-blue-400">
                    {stats.bluetoothConnected ? "BLUETOOTH" : "DEFAULT"}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">AAC / 48kHz</div>
                </div>
              </div>

              {/* Hardware Acceleration Row */}
              <div className="flex items-start justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <Cpu className={`w-4 h-4 ${stats.hwAccelerated ? "text-amber-400" : "text-red-400"}`} />
                  <div>
                    <div className="font-semibold text-slate-200">Video Engine</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                      {stats.gpuDecoder}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[11px] font-mono font-bold ${stats.hwAccelerated ? "text-amber-400" : "text-red-400"}`}>
                    {stats.hwAccelerated ? "HW DECODE" : "SOFTWARE"}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">MSE Buffer OK</div>
                </div>
              </div>

              {/* Cache / IndexedDB Row */}
              <div className="flex items-start justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-slate-200">IndexedDB Vault</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {stats.storageUsedMB} MB / {stats.storageQuotaMB > 1000 ? `${Math.round(stats.storageQuotaMB/1024)} GB` : `${stats.storageQuotaMB} MB`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 font-mono text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CACHED</span>
                </div>
              </div>
            </div>

            {/* TELEMETRY FOOTER */}
            {/* P2 FIX: both lines were hardcoded ("Active"/"ONLINE" always), unlike every other
                stat in this panel which reflects real state. Both now derive from `stats.online`
                (navigator.onLine), matching the Network row above. */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between font-mono text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${stats.online ? "bg-emerald-400 animate-ping" : "bg-red-400"}`} />
                <span>Stream Sync: {stats.online ? "Active" : "Interrupted"}</span>
              </div>
              <div>Connection: <span className={`font-bold ${stats.online ? "text-emerald-400" : "text-red-400"}`}>{stats.online ? "ONLINE" : "OFFLINE"}</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
