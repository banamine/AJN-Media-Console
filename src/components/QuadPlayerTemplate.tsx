import { mainVideoRef } from "../utils/videoRef";
import React, { useState, useEffect, useRef } from "react";
import { IPTVChannel } from "../types";
import { Maximize, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { isYouTubeUrl } from "../utils/urlUtils";
import { VideoPlayer } from "./VideoPlayer";

interface QuadPlayerTemplateProps {
  channels: IPTVChannel[];
  onPlayStream?: (url: string, title: string) => void;
  addLog: (msg: string, type?: "info" | "warning" | "error") => void;
}

export const QuadPlayerTemplate: React.FC<QuadPlayerTemplateProps> = ({ channels, onPlayStream, addLog }) => {
  // Store the URLs for the 4 slots
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [mutedSlots, setMutedSlots] = useState<boolean[]>([true, true, true, true]); // All muted by default
  const videoRefs = [
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null),
  ];

  // Pre-fill slots if we have channels
  useEffect(() => {
    // Pause main background player to prevent collisions with the 4 quad players
    const mainVideo = mainVideoRef.current as HTMLVideoElement | null;
    if (mainVideo && !mainVideo.paused) {
      mainVideo.pause();
    }
    
    setSlots(prev => {
      const next = [...prev];
      let chIdx = 0;
      for (let i = 0; i < 4; i++) {
        if (!next[i] && channels[chIdx]) {
          next[i] = channels[chIdx].url;
          chIdx++;
        }
      }
      return next;
    });
  }, [channels]);

  const toggleMute = (index: number) => {
    setMutedSlots(prev => {
      const next = [...prev];
      next[index] = !next[index];
      // Mute others if one is unmuted? Let's just toggle independently for advanced users.
      return next;
    });

  };

  const handleSelectChannel = (index: number, url: string) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
    addLog(`Quad Slot ${index + 1} updated to new stream`, "info");
  };

  const reloadSlot = (index: number) => {
    // Handled by re-rendering component with key change or no-op
  };

  const getChannelTitle = (url: string) => {
    const ch = channels.find(c => c.url === url);
    return ch ? ch.name : url;
  };

  return (
    <div className="flex-1 w-full h-full bg-[#050810] flex flex-col p-4 relative">
      <div className="mb-4 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-black font-mono tracking-widest text-white uppercase">
          Quad Matrix Playout
        </h2>
        <div className="text-xs text-slate-400 font-mono">
          4-Screen Hardware Decoder Sync
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        {[0, 1, 2, 3].map(i => {
          const slotUrl = slots[i];
          const isMuted = mutedSlots[i];
          
          return (
            <div key={i} className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 flex flex-col group shadow-lg">
              
              {/* Header HUD */}
              <div className="absolute top-0 left-0 right-0 z-10 p-2 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <select 
                  value={slotUrl || ""} 
                  onChange={(e) => handleSelectChannel(i, e.target.value)}
                  className="bg-black/60 text-white text-[10px] font-mono border border-slate-700 rounded px-2 py-1 max-w-[200px] truncate outline-none cursor-pointer backdrop-blur"
                >
                  <option value="">-- Empty Slot --</option>
                  {channels.map((ch, idx) => (
                    <option key={idx} value={ch.url}>{ch.name}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button onClick={() => reloadSlot(i)} className="p-1.5 bg-black/60 rounded-lg hover:bg-slate-800 text-slate-300">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleMute(i)} className="p-1.5 bg-black/60 rounded-lg hover:bg-slate-800 text-slate-300">
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <button 
                    onClick={() => {
                      if (onPlayStream && slotUrl) {
                        onPlayStream(slotUrl, getChannelTitle(slotUrl));
                      }
                    }}
                    className="p-1.5 bg-blue-600/60 rounded-lg hover:bg-blue-600 text-white"
                    title="Send to Main Player"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Player Canvas */}
              <div className="flex-1 w-full h-full flex items-center justify-center bg-black">
                {!slotUrl ? (
                  <div className="text-slate-600 font-mono text-[10px] uppercase">Slot {i + 1} Offline</div>
                ) : (
                  <VideoPlayer id={`quad-slot-${i}`} url={slotUrl} isMuted={isMuted} isExclusive={false} />
                )}
              </div>

              {/* Footer Title */}
              {slotUrl && (
                <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/70 backdrop-blur text-white text-[10px] font-mono font-bold truncate px-2.5 py-1 rounded-md border border-slate-700/50 inline-block">
                    {getChannelTitle(slotUrl)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
