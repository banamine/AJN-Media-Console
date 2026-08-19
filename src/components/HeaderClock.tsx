import React, { useState, useEffect } from "react";

export function HeaderClock() {
  const [timeStr, setTimeStr] = useState("");
  const [countdown, setCountdown] = useState("00:00");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString());

      const nextHour = new Date();
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diffMs = nextHour.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      setCountdown(
        `${String(diffMins).padStart(2, "0")}:${String(diffSecs).padStart(2, "0")}`
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-6 text-xs text-slate-400">
      <div className="flex items-center gap-2 bg-[#050608] px-4 py-2 rounded-full border border-slate-800/60">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-semibold text-slate-500 font-mono text-[10px] uppercase tracking-wider">CLOCK:</span>
        <span className="font-mono text-white tracking-widest">{timeStr || "--:--:--"}</span>
      </div>
      <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/10">
        <span className="text-blue-400 font-bold font-mono text-[10px] uppercase tracking-widest">⏱️ NEXT SEGMENT IN:</span>
        <span className="font-mono text-white text-xs">{countdown}</span>
      </div>
    </div>
  );
}
