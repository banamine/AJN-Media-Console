import React from "react";
import { ScheduleShow } from "../types/tvGuide";
import { Clock, Play, Radio, Tag, Tv } from "lucide-react";
import "./DailyView.css";

interface DailyViewProps {
  schedule: ScheduleShow[];
  selectedDate: Date;
  onPlayShow: (show: ScheduleShow) => void;
}

export const DailyView: React.FC<DailyViewProps> = ({
  schedule,
  selectedDate,
  onPlayShow,
}) => {
  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const selectedDateKey = formatDateKey(selectedDate);
  const isSelectedDateToday = formatDateKey(new Date()) === selectedDateKey;

  // Filter shows on selectedDate
  const dayShows = React.useMemo(() => {
    return schedule
      .filter((show) => show.airDate === selectedDateKey)
      .sort((a, b) => a.airTime.localeCompare(b.airTime));
  }, [schedule, selectedDateKey]);

  // Check if a show is currently "airing" (mocked based on minutes of day if selectedDate is Today, or static first show if not)
  const isShowActiveNow = (show: ScheduleShow, idx: number): boolean => {
    if (!isSelectedDateToday) return false;
    
    // Simple dynamic playout rule: we can mock current active based on hours
    const now = new Date();
    const currentHourStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    
    // Let's see if show's airTime <= currentHourStr and end time >= currentHourStr
    const showStart = show.airTime;
    const [h, m] = showStart.split(":").map(Number);
    const startMins = h * 60 + m;
    const endMins = startMins + show.duration;
    
    const currentMins = now.getHours() * 60 + now.getMinutes();
    return currentMins >= startMins && currentMins < endMins;
  };

  return (
    <div className="bg-[#0b0e1a]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl font-sans flex flex-col w-full">
      {/* Editorial Header Banner */}
      <div className="relative h-44 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center filter saturate-[0.8] brightness-[0.45] transition-all duration-700"
          style={{ backgroundImage: `url('https://archive.org/download/daily-highlights/liberty%20moonlight.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e1a] to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              EPG TRANSMISSION
            </span>
            <h3 className="text-xl font-black text-white mt-1.5 uppercase font-mono tracking-tight">
              Daily Master Playout
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              EPG logs for {selectedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <Tv className="w-8 h-8 text-emerald-400 opacity-60 hidden sm:block" />
        </div>
      </div>

      {/* Main Timeline Deck */}
      <div className="p-6 bg-[#070912]/40 flex-1 flex flex-col min-h-[300px]">
        {dayShows.length === 0 ? (
          <div className="flex-1 py-14 flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-2xl bg-[#090b16]">
            <Radio className="w-8 h-8 text-slate-700 animate-pulse mb-3" />
            <h4 className="text-xs font-black font-mono text-slate-400 uppercase tracking-wider">No Scheduled Broadcast Blocks</h4>
            <p className="text-[10px] text-slate-500 mt-1">This calendar day has no manual programs configured in playout database</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-800/80 pl-6 space-y-6">
            {dayShows.map((show, idx) => {
              const active = isShowActiveNow(show, idx);
              return (
                <div key={show.id} className="relative group">
                  {/* Timeline Node Highlight Indicator */}
                  <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-3 flex items-center justify-center transition-all duration-300 ${
                    active 
                      ? "bg-emerald-500 border-indigo-600 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-110" 
                      : "bg-[#0b0e1a] border-slate-800 group-hover:border-indigo-500"
                  }`}>
                    {active && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                  </div>

                  {/* Show Card Item Block */}
                  <div className={`flex flex-col sm:flex-row items-start gap-4 p-4.5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 ${
                    active
                      ? "bg-[#11192e] border-emerald-500/40 shadow-md shadow-emerald-950/10"
                      : "bg-[#0b0e1c] border-slate-900/85 hover:border-slate-800/80"
                  }`}>
                    
                    {/* AirTime clock HUD */}
                    <div className="shrink-0 flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 text-xs font-mono font-black text-slate-100 min-w-[70px]">
                      <div className="flex items-center gap-1.5 text-indigo-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="tracking-wide text-xs">{show.airTime}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 bg-black/40 rounded border border-slate-900">
                        {show.duration} MIN
                      </span>
                    </div>

                    {/* Metadata Content Stack */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[8.5px] font-mono font-black uppercase text-indigo-400 tracking-wider">
                          {show.channel || "AJN MAIN"}
                        </span>
                        {show.episode && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[#1b1c35] text-indigo-300 border border-indigo-500/10">
                            {show.episode}
                          </span>
                        )}
                        {active && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                            AIRING NOW
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors uppercase leading-snug">
                        {show.title}
                      </h4>

                      {show.description && (
                        <p className="text-[10px] text-slate-400 font-mono mt-1 leading-relaxed max-w-xl">
                          {show.description}
                        </p>
                      )}

                      {/* Tags list footer */}
                      {show.tags && show.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-3.5">
                          {show.tags.map((tag) => (
                            <span key={tag} className="text-[7.5px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 px-1.5 py-0.5 bg-black/30 border border-slate-900 rounded-md">
                              <Tag className="w-2 h-2 text-slate-600" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Play button transport clicker */}
                    <button
                      onClick={() => onPlayShow(show)}
                      className={`shrink-0 px-3.5 py-2.5 rounded-xl text-[10px] font-mono font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all border active:scale-95 self-end sm:self-center ${
                        active
                          ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-950/20"
                          : "bg-[#12162a] hover:bg-[#1a203d] border-slate-800 text-indigo-300 hover:text-white"
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Playout Signal</span>
                    </button>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
