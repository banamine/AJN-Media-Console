export interface ScheduleShow {
  id: string;
  title: string;
  description?: string;
  airDate: string; // ISO date: "YYYY-MM-DD"
  airTime: string; // HH:mm format: "14:00"
  duration: number; // minutes
  episode?: string; // "Hour 1", "Hour 2", etc.
  videoUrl: string; // Playable stream URL
  thumbnailUrl?: string; // Poster image
  channel?: string; // "Channel 1", "AJN", etc.
  showType: "live" | "archive" | "special";
  tags?: string[]; // For filtering
}

export interface Channel {
  id: string;
  name: string;
  m3uUrl?: string; // Link to M3U playlist
  logo?: string;
  description?: string;
}

export interface TVGuideState {
  schedule: ScheduleShow[];
  channels: Channel[];
  selectedDate: Date;
  selectedChannel?: string;
  isLoading: boolean;
  lastRefresh: number;
}
