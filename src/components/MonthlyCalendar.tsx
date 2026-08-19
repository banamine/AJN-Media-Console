import React from "react";
import { ScheduleShow } from "../types/tvGuide";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Star } from "lucide-react";
import "./MonthlyCalendar.css";

interface MonthlyCalendarProps {
  schedule: ScheduleShow[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  schedule,
  selectedDate,
  onSelectDate,
}) => {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => new Date(selectedDate));

  const changeMonth = (offset: number) => {
    setCurrentMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      return next;
    });
  };

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  // Get weekday of first day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  // Let's align with Mon as the first day: (day + 6) % 7
  const startDayOfWeek = (startOfMonth.getDay() + 6) % 7;
  const totalDays = endOfMonth.getDate();

  const daysArray: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  }

  // Group shows by local ISO DateKey (YYYY-MM-DD) for fast lookup
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

  const monthYearLabel = currentMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="bg-[#0b0e1a]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl font-sans flex flex-col">
      {/* Editorial Header Banner */}
      <div className="relative h-44 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center filter saturate-[0.85] brightness-[0.4] transition-all duration-700"
          style={{ backgroundImage: `url('https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e1a] to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
              ARCHIVAL GRID
            </span>
            <h3 className="text-xl font-black text-white mt-1.5 uppercase font-mono tracking-tight">
              Monthly Playout Planner
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Click any calendar day to load custom daily schedule feeds
            </p>
          </div>
          <CalendarIcon className="w-8 h-8 text-indigo-400 opacity-60 hidden sm:block" />
        </div>
      </div>

      {/* Month Navigation Row */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800/60 bg-black/25">
        <h4 className="text-sm font-bold text-slate-100 font-mono tracking-tight uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {monthYearLabel}
        </h4>
        <div className="flex gap-1">
          <button
            onClick={() => changeMonth(-1)}
            className="p-1.5 bg-[#12162a] hover:bg-[#1b213f] border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-2.5 py-1 bg-[#12162a] hover:bg-[#1b213f] border border-slate-800 rounded-xl text-[9px] font-mono font-black text-indigo-300 uppercase tracking-wider cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="p-1.5 bg-[#12162a] hover:bg-[#1b213f] border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 px-4 py-2 bg-[#090b14] border-b border-slate-900/60 text-center">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
          <span key={day} className="text-[8.5px] font-mono font-black text-slate-500 tracking-wider">
            {day}
          </span>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="p-4 grid grid-cols-7 gap-1.5 bg-[#070912]/40">
        {daysArray.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="aspect-square bg-transparent rounded-xl" />;
          }

          const dKey = formatDateKey(date);
          const dayShows = showsByDate[dKey] || [];
          const isSelected = formatDateKey(selectedDate) === dKey;
          const isToday = formatDateKey(new Date()) === dKey;

          return (
            <button
              key={dKey}
              onClick={() => onSelectDate(date)}
              className={`calendar-grid-cell group relative aspect-square rounded-2xl flex flex-col justify-between p-2 cursor-pointer border text-left ${
                isSelected
                  ? "bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.25)] text-white"
                  : isToday
                    ? "bg-[#111531] border-indigo-500/30 text-indigo-300"
                    : "bg-[#0b0e1c] border-slate-900/80 hover:border-indigo-500/40 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className={`text-[10px] font-mono font-black ${isSelected ? "text-indigo-400" : ""}`}>
                  {date.getDate()}
                </span>
                {isToday && (
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping shrink-0" />
                )}
              </div>

              {/* Show Status Indicators */}
              <div className="w-full flex flex-col gap-0.5 mt-1 pointer-events-none">
                {dayShows.slice(0, 2).map((show) => (
                  <span
                    key={show.id}
                    className="text-[7.5px] font-mono tracking-tight font-medium truncate block py-0.5 px-1 rounded bg-[#131933] border border-indigo-500/10 text-indigo-300"
                    title={show.title}
                  >
                    {show.title.includes("Hour") ? show.title.split("Hour")[1].trim() : show.title}
                  </span>
                ))}
                {dayShows.length > 2 && (
                  <span className="text-[6.5px] font-mono text-slate-500 text-center font-bold">
                    +{dayShows.length - 2} MORE
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
