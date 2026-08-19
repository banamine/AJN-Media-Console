import React from "react";
import { ScheduleShow } from "../types/tvGuide";
import { Calendar as CalendarIcon, Play, Radio, Sparkles } from "lucide-react";
import "./WeeklyView.css";

interface WeeklyViewProps {
  schedule: ScheduleShow[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPlayShow: (show: ScheduleShow) => void;
}

export const WeeklyView: React.FC<WeeklyViewProps> = ({
  schedule,
  selectedDate,
  onSelectDate,
  onPlayShow,
}) => {
  // Generate 7 days of the week starting from Monday of selectedDate's week
  const daysOfWeek = React.useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    // Align with Monday: if day is 0 (Sunday), set to -6, otherwise 1 - day
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(startOfWeek);
      nextDate.setDate(startOfWeek.getDate() + i);
      days.push(nextDate);
    }
    return days;
  }, [selectedDate]);

  // Group shows by ISO date key (YYYY-MM-DD)
  const showsByDate = React.useMemo(() => {
    const map: Record<string, ScheduleShow[]> = {};
    schedule.forEach((show) => {
      if (!map[show.airDate]) {
        map[show.airDate] = [];
      }
      map[show.airDate].push(show);
    });
    return map;
  }, [schedule]);

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="bg-[#0b0e1a]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl font-sans flex flex-col w-full">
      {/* Dynamic Editorial Banner */}
      <div className="relative h-44 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center filter saturate-[0.8] brightness-[0.4] transition-all duration-700"
          style={{ backgroundImage: `url('https://archive.org/download/daily-highlights/web%20app1.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e1a] to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              7-DAY PLOTTING
            </span>
            <h3 className="text-xl font-black text-white mt-1.5 uppercase font-mono tracking-tight">
              Weekly Timeline Deck
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Rapid sequential audit of the current seven-day broadcast grid
            </p>
          </div>
          <Sparkles className="w-8 h-8 text-amber-400 opacity-60 hidden sm:block" />
        </div>
      </div>

      {/* 7-Day Grid Deck */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3.5 p-5 bg-[#070912]/50 overflow-x-auto">
        {daysOfWeek.map((date) => {
          const dKey = formatDateKey(date);
          const dayShows = showsByDate[dKey] || [];
          const isSelected = formatDateKey(selectedDate) === dKey;
          const isToday = formatDateKey(new Date()) === dKey;

          const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
          const numLabel = date.getDate();

          return (
            <div
              key={dKey}
              onClick={() => onSelectDate(date)}
              className={`weekly-column shrink-0 flex flex-col rounded-2xl p-3 border transition-all duration-200 cursor-pointer min-h-[340px] select-none ${
                isSelected
                  ? "bg-[#111631] border-amber-500/50 shadow-lg shadow-amber-950/5 scale-[1.01]"
                  : isToday
                    ? "bg-[#0c1023] border-slate-800 text-slate-200 hover:border-slate-700"
                    : "bg-[#080b15] border-slate-900/60 hover:border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {/* Column Header Date Badge */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 w-full">
                <span className={`text-[10.5px] font-black font-mono tracking-wider ${
                  isSelected ? "text-amber-400" : isToday ? "text-indigo-400" : "text-slate-500"
                }`}>
                  {dayLabel}
                </span>
                <span className={`text-xs font-mono font-black px-1.5 py-0.5 rounded ${
                  isSelected ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" : "text-slate-400"
                }`}>
                  {numLabel}
                </span>
              </div>

              {/* Show blocks Stack */}
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[260px] pr-0.5 custom-scrollbar">
                {dayShows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-3 text-center border border-dashed border-slate-900 rounded-xl bg-black/10">
                    <Radio className="w-4 h-4 text-slate-800 mb-1" />
                    <span className="text-[8px] font-mono text-slate-600 tracking-wider">OFF AIR</span>
                  </div>
                ) : (
                  dayShows.map((show) => (
                    <div
                      key={show.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayShow(show);
                      }}
                      className="group/item relative bg-black/45 hover:bg-black/85 border border-slate-900 hover:border-amber-500/30 rounded-xl p-2.5 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[8px] font-mono font-black text-indigo-400">
                            {show.airTime}
                          </span>
                          <span className="text-[7.5px] font-mono font-bold text-slate-500 px-1 py-0.2 bg-slate-900/50 rounded">
                            {show.duration}m
                          </span>
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-200 group-hover/item:text-amber-400 leading-tight transition-colors line-clamp-2">
                          {show.title}
                        </h4>
                      </div>
                      
                      {/* Play Action Hover overlay trigger */}
                      <div className="flex justify-between items-center mt-2 pt-1 border-t border-slate-900/40">
                        <span className="text-[7.5px] font-mono font-bold text-slate-500 truncate uppercase">
                          {show.episode || "EPISODE"}
                        </span>
                        <Play className="w-3 h-3 text-slate-500 group-hover/item:text-amber-400 transition-all opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
