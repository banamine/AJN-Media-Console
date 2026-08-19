import React, { useState, useMemo, useEffect } from "react";
import { TVGuideState, ScheduleShow, Channel } from "../types/tvGuide";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { WeeklyView } from "./WeeklyView";
import { DailyView } from "./DailyView";

import { ArchiveComponent } from "./ArchiveComponent";
import { Calendar, Layers, Clock, Film, Radio, Tv, Star, Volume2, Sparkles, HelpCircle } from "lucide-react";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


interface TVGuideDashboardProps {
  onPlayMainStream?: (url: string, title: string) => void;
}

export const TVGuideDashboard: React.FC<TVGuideDashboardProps> = ({ onPlayMainStream }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly" | "archive">("daily");

  const [rssEpisodes, setRssEpisodes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch(BACKEND_URL + "/api/ajn-archive")
      .then((res) => {
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          return res.json();
        }
        return { success: false };
      })
      .then((data) => {
        if (data && data.success && data.episodes) {
          setRssEpisodes(data.episodes);
        }
      })
      .catch((err) => console.warn("Failed to fetch RSS archive for calendar:", err));
  }, []);

  // Dynamically generate a 35-day schedule centered around the selected month to ensure the calendar is fully loaded
  const schedule = useMemo(() => {
    const list: ScheduleShow[] = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Start generating from 15 days ago to 30 days into the future
    for (let dayOffset = -15; dayOffset <= 30; dayOffset++) {
      const date = new Date(year, month, now.getDate() + dayOffset);
      const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

      const findRss = (showName: string, hourStr: string) => {
        return rssEpisodes.find(ep => ep.dateKey === isoDate && ep.show === showName && ep.hour === hourStr);
      };

      // Weekday Playout (Monday - Friday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // 1. Alex Jones Show Hours 1-4
        const aj1 = findRss("Alex Jones Show", "Hour 1");
        list.push({
          id: `aj-hr1-${isoDate}`,
          title: aj1 ? aj1.title : "Alex Jones Show Hour 1",
          description: "Live commentary on geopolitical breaking events and intelligence summaries.",
          airDate: isoDate,
          airTime: "11:00",
          duration: 60,
          episode: "Hour 1",
          videoUrl: aj1 ? aj1.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp",
          channel: "Infowars Live",
          showType: aj1 ? "archive" : "live",
          tags: ["Geopolitics", "Hour 1", "Alex Jones"]
        });
        const aj2 = findRss("Alex Jones Show", "Hour 2");
        list.push({
          id: `aj-hr2-${isoDate}`,
          title: aj2 ? aj2.title : "Alex Jones Show Hour 2",
          description: "Direct studio transmission with special field reporters and investigative logs.",
          airDate: isoDate,
          airTime: "12:00",
          duration: 60,
          episode: "Hour 2",
          videoUrl: aj2 ? aj2.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
          channel: "Infowars Live",
          showType: aj2 ? "archive" : "live",
          tags: ["Intelligence", "Hour 2", "Alex Jones"]
        });
        const aj3 = findRss("Alex Jones Show", "Hour 3");
        list.push({
          id: `aj-hr3-${isoDate}`,
          title: aj3 ? aj3.title : "Alex Jones Show Hour 3",
          description: "Open line segments and live interactive debate on the globalist agenda.",
          airDate: isoDate,
          airTime: "13:00",
          duration: 60,
          episode: "Hour 3",
          videoUrl: aj3 ? aj3.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/emegency.png",
          channel: "Infowars Live",
          showType: aj3 ? "archive" : "live",
          tags: ["Debate", "Hour 3", "Alex Jones"]
        });
        const aj4 = findRss("Alex Jones Show", "Hour 4");
        list.push({
          id: `aj-hr4-${isoDate}`,
          title: aj4 ? aj4.title : "Alex Jones Show Hour 4",
          description: "Playout summary and strategic preparation logs for the weekend emergency cycle.",
          airDate: isoDate,
          airTime: "14:00",
          duration: 60,
          episode: "Hour 4",
          videoUrl: aj4 ? aj4.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
          channel: "Infowars Live",
          showType: aj4 ? "archive" : "live",
          tags: ["Summary", "Hour 4", "Alex Jones"]
        });

        // 2. War Room (Harrison Smith) Hours 1-4
        const wr1 = findRss("War Room", "Hour 1");
        list.push({
          id: `wr-hr1-${isoDate}`,
          title: wr1 ? wr1.title : "The Warroom Hour 1",
          description: "Harrison Smith, an 8th-generation Texan, hosts the show. It features political commentary, current events analysis, guest interviews, and listener calls.",
          airDate: isoDate,
          airTime: "15:00",
          duration: 60,
          episode: "Hour 1",
          videoUrl: wr1 ? wr1.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/warroom.png",
          channel: "War Room Feed",
          showType: "archive",
          tags: ["Elections", "Hour 1", "War Room"]
        });
        const wr2 = findRss("War Room", "Hour 2");
        list.push({
          id: `wr-hr2-${isoDate}`,
          title: wr2 ? wr2.title : "The Warroom Hour 2",
          description: "Economic warfare reports and tactical updates on grass-roots political assemblies.",
          airDate: isoDate,
          airTime: "16:00",
          duration: 60,
          episode: "Hour 2",
          videoUrl: wr2 ? wr2.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/web%20app1.png",
          channel: "War Room Feed",
          showType: "archive",
          tags: ["Economics", "Hour 2", "War Room"]
        });
        const wr3 = findRss("War Room", "Hour 3");
        list.push({
          id: `wr-hr3-${isoDate}`,
          title: wr3 ? wr3.title : "The Warroom Hour 3",
          description: "Detailed legislative tracking logs and global currency devaluation analyses.",
          airDate: isoDate,
          airTime: "17:00",
          duration: 60,
          episode: "Hour 3",
          videoUrl: wr3 ? wr3.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg",
          channel: "War Room Feed",
          showType: "archive",
          tags: ["Devaluation", "Hour 3", "War Room"]
        });
        const wr4 = findRss("War Room", "Hour 4");
        list.push({
          id: `wr-hr4-${isoDate}`,
          title: wr4 ? wr4.title : "The Warroom Hour 4",
          description: "Closing war room statements, special round-tables, and guest panels.",
          airDate: isoDate,
          airTime: "18:00",
          duration: 60,
          episode: "Hour 4",
          videoUrl: wr4 ? wr4.videoUrl : "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/warroom.png",
          channel: "War Room Feed",
          showType: "archive",
          tags: ["Strategy", "Hour 4", "War Room"]
        });
      }

      // Saturday Playout
      if (dayOfWeek === 6) {
        list.push({
          id: `sat-emergency-${isoDate}`,
          title: "Saturday Emergency Broadcasts",
          description: "High-level strategic alerts and continuous live reporting during global emergencies.",
          airDate: isoDate,
          airTime: "14:00",
          duration: 120,
          episode: "Special",
          videoUrl: "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/emegency.png",
          channel: "Emergency Playout",
          showType: "special",
          tags: ["Emergency", "Live Alert", "Saturday"]
        });
      }

      // Sunday Playout
      if (dayOfWeek === 0) {
        list.push({
          id: `sun-live-${isoDate}`,
          title: "Sunday Night Live",
          description: "Alex Jones returns to the studio for the premier weekend debate and predictions log.",
          airDate: isoDate,
          airTime: "18:00",
          duration: 180,
          episode: "Live Broadcast",
          videoUrl: "",
          thumbnailUrl: "https://archive.org/download/daily-highlights/liberty%20moonlight.png",
          channel: "Infowars Live",
          showType: "live",
          tags: ["Sunday", "Predictions", "Live"]
        });
      }
    }
    return list;
  }, [rssEpisodes]);

  const channels: Channel[] = [
    { id: "ch-infowars", name: "Infowars Live", description: "Geopolitical broadcasts" },
    { id: "ch-warroom", name: "War Room Feed", description: "Political tactical reports" },
    { id: "ch-emergency", name: "Emergency Network", description: "Playout alert node" },
    { id: "ch-highlights", name: "Daily Highlights", description: "Top selected clips and moments curated from today's broadcasts." }
  ];

  const handlePlayShow = (show: ScheduleShow) => {
    // Play directly in main stream instead of opening a modal
    if (onPlayMainStream) {
      onPlayMainStream(show.videoUrl, show.title);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative w-full bg-[#06080C] select-none text-white p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto">
      
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
        <input 
          type="text" 
          placeholder="Search channels & shows (Client-side fast filter)..." 
          className="w-full sm:w-96 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      {/* Editorial Header Banner */}
    
      <div className="relative h-48 shrink-0 overflow-hidden rounded-2xl border border-slate-800/80 shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center filter saturate-[0.85] brightness-[0.35]"
          style={{ backgroundImage: `url('https://archive.org/download/daily-highlights/warroom.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-[#05080f]/40 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md">
              COORDINATED SCHEDULE SYSTEMS
            </span>
            <h2 className="text-2xl font-black text-white mt-2 uppercase font-mono tracking-tight">
              AJN TV Guide Command Deck
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Deterministic EPG planner coordinating Alex Jones and War Room broadcasts
            </p>
          </div>
          
          {/* Calendar status bar */}
          <div className="flex items-center gap-2.5 bg-black/45 border border-slate-800 px-4 py-2 rounded-2xl font-mono text-[10.5px] text-slate-300">
            <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Today: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-2 bg-[#0f0303] border-solid rounded-[17px] border-[22.11111px] w-[939.444px] max-w-full">
        <div className="flex gap-2 bg-[#0B0E14] border border-slate-800/80 p-1 rounded-2xl w-full sm:w-auto">
          {[
            { id: "daily", label: "Daily EPG", icon: Clock },
            { id: "weekly", label: "Weekly Deck", icon: Layers },
            { id: "monthly", label: "Monthly Grid", icon: Calendar },
            { id: "archive", label: "Library Vault", icon: Film }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-mono font-black uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Date indicator */}
        <div className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5 uppercase font-bold">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>Viewing Date: </span>
          <span className="text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            {selectedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
      </div>

      {/* Primary Dashboard Views Renderer */}
      <div className="flex-1 min-h-0 w-full">
        {activeTab === "daily" && (
          <DailyView
            schedule={schedule}
            selectedDate={selectedDate}
            onPlayShow={handlePlayShow}
          />
        )}

        {activeTab === "weekly" && (
          <WeeklyView
            schedule={schedule}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPlayShow={handlePlayShow}
          />
        )}

        {activeTab === "monthly" && (
          <MonthlyCalendar
            schedule={schedule}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setActiveTab("daily"); // auto-switch to daily when day is clicked
            }}
          />
        )}

        {activeTab === "archive" && (
          <ArchiveComponent
            schedule={schedule}
            onPlayShow={handlePlayShow}
          />
        )}
      </div>



    </div>
  );
};
