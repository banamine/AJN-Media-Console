import React, { useMemo } from "react";
import { useGuideRouter } from "./useGuideRouter";
import { TVGuideHub } from "./TVGuideHub";
import { TVGuideSchedule } from "./TVGuideSchedule";
import { TVGuideSearch } from "./TVGuideSearch";
import { LayoutGrid, CalendarDays, Search } from "lucide-react";

interface TVGuideLayoutProps {
  channels: any[];
  triggerPlayout?: (block: any, channel: any, trace?: any) => void;
  masterStore?: any;
  channelBlocksMap?: any;
  nowSec?: number;
  onPlayShow?: (show: any) => void;
}

export const TVGuideLayout: React.FC<TVGuideLayoutProps> = ({ channels, triggerPlayout, masterStore, channelBlocksMap, nowSec, onPlayShow }) => {
  const { currentView, navigateTo } = useGuideRouter();

  const renderView = () => {
    switch (currentView) {
      case "schedule":
        return <TVGuideSchedule channels={channels} triggerPlayout={triggerPlayout} masterStore={masterStore} channelBlocksMap={channelBlocksMap} nowSec={nowSec} />;
      case "search":
        return <TVGuideSearch channels={channels} triggerPlayout={triggerPlayout} channelBlocksMap={channelBlocksMap} nowSec={nowSec} />;
      case "hub":
      default:
        return <TVGuideHub channels={channels} triggerPlayout={triggerPlayout} channelBlocksMap={channelBlocksMap} nowSec={nowSec} onPlayShow={onPlayShow} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0f0f0f] text-white">
      {/* Global View Switcher Navigation */}
      <div className="h-[60px] shrink-0 bg-[#0a0a0a] border-b border-[#333333] flex items-center justify-center px-4 z-50">
        <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333333]">
          <button 
            onClick={() => navigateTo("hub")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-md transition-all duration-200 text-xs sm:text-sm font-bold uppercase tracking-wider ${
              currentView === "hub" 
                ? "bg-[#FF6B35] text-white shadow-md" 
                : "text-[#B0B0B0] hover:text-white hover:bg-[#2d2d2d]"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Hub</span>
          </button>
          <button 
            onClick={() => navigateTo("schedule")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-md transition-all duration-200 text-xs sm:text-sm font-bold uppercase tracking-wider ${
              currentView === "schedule" 
                ? "bg-[#FF6B35] text-white shadow-md" 
                : "text-[#B0B0B0] hover:text-white hover:bg-[#2d2d2d]"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Schedule</span>
          </button>
          <button 
            onClick={() => navigateTo("search")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-md transition-all duration-200 text-xs sm:text-sm font-bold uppercase tracking-wider ${
              currentView === "search" 
                ? "bg-[#FF6B35] text-white shadow-md" 
                : "text-[#B0B0B0] hover:text-white hover:bg-[#2d2d2d]"
            }`}
          >
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>

      {/* Active View Container */}
      <div className="flex-1 overflow-hidden min-h-0 relative">
        {renderView()}
      </div>
    </div>
  );
};
