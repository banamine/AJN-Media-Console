export interface ChannelRange {
  id: string;
  label: string;
  rangeStart: number;
  rangeEnd: number;
  description?: string;
}

export const CHANNEL_RANGES: ChannelRange[] = [
  {
    id: "premium_live",
    label: "Premium & Live",
    rangeStart: 1,
    rangeEnd: 99,
    description: "Live broadcasts and premium feeds",
  },
  {
    id: "classics",
    label: "Classics",
    rangeStart: 100,
    rangeEnd: 199,
    description: "Classic TV Shows & Movies",
  },
  {
    id: "news_archives",
    label: "News & AJN Archives",
    rangeStart: 200,
    rangeEnd: 299,
    description: "Historical News Broadcasts & Archives",
  },
  {
    id: "time_shows",
    label: "Time-Based Shows",
    rangeStart: 300,
    rangeEnd: 399,
    description: "Dynamic feeds categorized by timeframe",
  },
  {
    id: "auto_channels",
    label: "Custom Auto-Channels",
    rangeStart: 400,
    rangeEnd: 499,
    description: "User-generated custom channels",
  },
  {
    id: "multiplexer",
    label: "Multiplexer",
    rangeStart: 500,
    rangeEnd: 599,
    description: "Isolated state feeds",
  },
  {
    id: "overflow",
    label: "Overflow",
    rangeStart: 600,
    rangeEnd: 999,
    description: "General overflow channels",
  }
];
