import React from "react";
import { telemetry, generateCorrelationId } from "../../telemetry/playbackTelemetry";
import { registerVideo } from "../../utils/videoRef";
import { VirtualChannel, GraphicsOverlay, AutomationRule, AutomationPlugin, ReleaseMetrics } from "./types";
import { Activity, Radio, Layers, Sliders, Cpu, HardDrive, Wifi, ShieldCheck, Volume2, AlertTriangle, Eye, Play, CheckCircle2 } from "lucide-react";

interface MasterControlDashboardViewProps {
  channels: VirtualChannel[];
  activeChannel: VirtualChannel;
  onSelectChannel: (ch: VirtualChannel) => void;
  overlays: GraphicsOverlay[];
  rules: AutomationRule[];
  plugins: AutomationPlugin[];
  metrics: ReleaseMetrics;
  isLight: boolean;
}

export const MasterControlDashboardView: React.FC<MasterControlDashboardViewProps> = ({
  channels,
  activeChannel,
  onSelectChannel,
  overlays,
  rules,
  plugins,
  metrics,
  isLight
}) => {
  const correlationId = React.useRef(generateCorrelationId()).current;
  const activeOverlaysCount = overlays.filter(o => o.active).length;
  const activePluginsCount = plugins.filter(p => p.active).length;
  const [fallbackUrl, setFallbackUrl] = React.useState<string | null>(null);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  const [videoElement, setVideoElement] = React.useState<HTMLVideoElement | null>(null);

  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  };

  React.useEffect(() => {
    if (videoElement) {
      const cleanup = registerVideo(videoElement);
      return cleanup;
    }
    return undefined;
  }, [videoElement]);

  React.useEffect(() => {
    setFallbackUrl(null);
    const video = videoRef.current;
    if (video && activeChannel.streamUrl) {
      video.load();
      video.play().catch(e => console.warn("MCD Autoplay prevented:", e));
    }
    return () => {
      if (video) {
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {});
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [activeChannel.streamUrl]);

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0"><Radio className="w-5 h-5 animate-pulse" /></div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">NETWORK HEALTH</span>
            <span className="text-sm font-bold font-sans text-emerald-400 flex items-center gap-1">● NOMINAL</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0"><Wifi className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">PLAYOUT BITRATE</span>
            <span className="text-sm font-bold font-mono text-slate-100">{activeChannel.bitrateKbps} kbps</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0"><Volume2 className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">AUDIO LUFS</span>
            <span className="text-sm font-bold font-mono text-emerald-400">-14.1 dB</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 shrink-0"><Cpu className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">GPU / BUFFER</span>
            <span className="text-sm font-bold font-mono text-slate-100">{metrics.gpuUsagePercent}% / 99.8%</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0"><Layers className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">ACTIVE OVERLAYS</span>
            <span className="text-sm font-bold font-mono text-purple-400">{activeOverlaysCount} ON-AIR</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"}`}>
          <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 shrink-0"><ShieldCheck className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">SYSTEM STATUS</span>
            <span className="text-sm font-bold font-mono text-sky-400">{activePluginsCount} Plugins OK</span>
          </div>
        </div>
      </div>

      {/* Main Grid: On-Air Master Stage vs Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Master Playout Video Deck */}
        <div className={`lg:col-span-8 rounded-2xl border p-6 space-y-4 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"}`}>
          <div className="flex items-center justify-between border-b pb-4 border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="py-1 px-3 rounded-full bg-rose-600 font-mono font-bold text-white text-xs animate-pulse flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white" />
                MASTER ON-AIR
              </span>
              <div>
                <h3 className="text-base font-bold font-sans text-slate-100">
                  Ch {activeChannel.number}: {activeChannel.name} ({activeChannel.callSign})
                </h3>
                <p className="text-xs text-slate-400 font-mono">Simulcasting 24/7 Virtual Playout</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 py-1.5 px-3 rounded-xl border border-emerald-500/20">
              <Eye className="w-3.5 h-3.5" />
              {activeChannel.viewerCount.toLocaleString()} Viewers
            </div>
          </div>

          {/* Video Mockup Stage */}
          <div id="ajn-mcd-player-frame" className="relative flex-1 bg-black aspect-video flex items-center justify-center min-h-[220px] md:min-h-[380px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group">
            {fallbackUrl || activeChannel.streamUrl?.includes('iframe=true') ? (
               <iframe
                 src={fallbackUrl || activeChannel.streamUrl}
                 className="absolute inset-0 w-full h-full border-0 z-10"
                 allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                 sandbox="allow-scripts allow-same-origin allow-presentation"
                 allowFullScreen
               />
            ) : (
            <video
              ref={setVideoRef}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-80"
              onPlaying={(e) => {
                telemetry.trackEvent({ correlationId: correlationId, emittedBy: 'MasterControlDashboardView', category: 'PLAYER_LIFECYCLE', type: 'frame_rendering_started', payload: { currentTime: e.currentTarget.currentTime } });
              }}
              onWaiting={(e) => {
                telemetry.trackEvent({ correlationId: correlationId, emittedBy: 'MasterControlDashboardView', category: 'PLAYER_LIFECYCLE', type: 'playback_stalled', payload: { bufferedEnd: e.currentTarget.buffered.length ? e.currentTarget.buffered.end(0) : 0 } });
              }}
              onError={(e) => {
                const code = e.currentTarget.error?.code;
                telemetry.trackEvent({ correlationId: correlationId, emittedBy: 'MasterControlDashboardView', category: 'PLAYER_LIFECYCLE', type: 'native_error', payload: { error: e.currentTarget.error?.message || 'unknown', code } });
              }}
            >
              {activeChannel.streamUrl && activeChannel.streamUrl.trim() !== "" && (
                <>
                  <source src={activeChannel.streamUrl} type={activeChannel.streamUrl.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
                  {activeChannel.streamUrl.endsWith('.mp4') && <source src={activeChannel.streamUrl.replace('.mp4', '.webm')} type="video/webm" />}
                  <p>Your browser does not support the video tag.</p>
                </>
              )}
            </video>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Top OSD */}
            <div className="relative z-10 flex items-center justify-between font-mono text-xs text-white">
              <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded border border-white/10">
                [ PLAYOUT ORIGIN: SERVER 1 ]
              </span>
              <span className="bg-blue-600/80 backdrop-blur-md px-2.5 py-1 rounded font-bold">
                {activeChannel.category} HD
              </span>
            </div>

            {/* Bottom OSD / Program Info */}
            <div className="relative z-10 mt-auto space-y-1">
              <div className="bg-slate-900/80 backdrop-blur-md p-3.5 rounded-xl border border-white/15 text-white max-w-xl">
                <span className="text-[10px] font-mono uppercase text-blue-400 font-bold block mb-0.5">NOW BROADCASTING</span>
                <h4 className="text-sm font-bold font-sans line-clamp-1">{activeChannel.currentProgram}</h4>
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono mt-1 pt-1 border-t border-white/10">
                  <span>UP NEXT: <strong className="text-amber-300">{activeChannel.nextProgram}</strong></span>
                  <span className="text-emerald-400">Buffer 100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Schedule Status Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Scheduler Engine:</span>
              <strong className="text-white">Auto-fill & Anti-Repeat ACTIVE</strong>
            </div>
            <span className="text-slate-500">Uptime: {(metrics.uptimeSeconds / 3600).toFixed(1)} hrs</span>
          </div>
        </div>

        {/* Multi-Channel Playout Quick Deck */}
        <div className={`lg:col-span-4 rounded-2xl border p-6 space-y-4 ${isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"}`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-800/80">
            <h3 className="text-sm font-bold font-sans flex items-center gap-2 text-slate-100">
              <Sliders className="w-4 h-4 text-blue-400" />
              Virtual Channel Switcher
            </h3>
            <span className="text-[11px] font-mono text-slate-400">{channels.length} Channels</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {channels.map(ch => {
              const isActive = ch.id === activeChannel.id;
              const isFailover = ch.status === "FAILOVER";
              return (
                <button
                  key={ch.id}
                  onClick={() => onSelectChannel(ch)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                    isActive ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 font-bold"
                             : (isLight ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800" : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200")
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-xl font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${
                      isActive ? "bg-white text-blue-700 border-white" : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}>
                      {ch.number}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs truncate font-bold">{ch.name}</div>
                      <div className={`text-[10px] truncate font-mono mt-0.5 ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                        {ch.currentProgram}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-mono text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded block ${
                      isFailover ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {ch.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
