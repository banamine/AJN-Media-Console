import { CHANNEL_REGISTRY } from './channelRegistry';

function resolvePatternAndHours(channelKey: string, targetDate: Date): { pattern: string; hours: number[] } {
  const channel = CHANNEL_REGISTRY[channelKey];
  if (!channel) throw new Error(`Invalid channel: ${channelKey}`);

  const day = targetDate.getDay(); // 0=Sun..6=Sat
  const override = channel.weekdaySegments?.[day];

  if (override) {
    return { pattern: override.pattern, hours: override.hours ?? [1] };
  }
  if (!channel.urlPattern) throw new Error(`No default urlPattern for channel: ${channelKey}`);
  return { pattern: channel.urlPattern, hours: channel.hours ?? [1] };
}

export const constructHourlyURL = (channelKey: string, hour: number, dateOverride: Date | null = null): string => {
  const targetDate = dateOverride || new Date();
  const { pattern } = resolvePatternAndHours(channelKey, targetDate);

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][targetDate.getDay()];
  const dateStr = `${year}${month}${day}_${dayName}`;

  return pattern
    .replace('{DATE}', dateStr)
    .replace('{HOUR}', hour.toString());
};

// Generates URLs for a single day, respecting weekday-specific segment structure.
export const generateDayWindow = (channelKey: string, targetDate: Date): string[] => {
  const { hours } = resolvePatternAndHours(channelKey, targetDate);
  return hours.map(hour => constructHourlyURL(channelKey, hour, targetDate));
};

// Generates a window of URLs across N days back from today (default 2 = today+yesterday),
// now day-aware instead of blindly reusing today's hour count for yesterday too.
export const generate48hWindow = (channelKey: string, daysBack: number = 2): string[] => {
  const urls: string[] = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(Date.now() - i * 86400000);
    urls.push(...generateDayWindow(channelKey, d));
  }
  return urls;
};

// EMERGENCY OVERRIDE (per explicit request): hardcoded, verified-against-live-feed
// URLs for Aug 15-16, in chronological order. Use this to force the rundown for
// that window regardless of what the generator above produces, e.g.:
//   const rundown = dateKey === '2026-08-15' || dateKey === '2026-08-16'
//     ? AUG_15_16_OVERRIDE
//     : generate48hWindow(channelKey);
export const AUG_15_16_OVERRIDE: string[] = [
  "https://ajn.archives.pub/hourly-m4v/20260815_Sat_Alex-Special.m4v",
  "https://ajn.archives.pub/hourly-m4v/20260816_Sun_Alex-Hr1.m4v",
  "https://ajn.archives.pub/hourly-m4v/20260816_Sun_Alex-Hr2.m4v",
  "https://ajn.archives.pub/hourly-m4v/20260816_Sun_SundayLive-Hr1.m4v",
  "https://ajn.archives.pub/hourly-m4v/20260816_Sun_SundayLive-Hr2.m4v",
];
