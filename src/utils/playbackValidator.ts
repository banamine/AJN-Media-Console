import { CHANNEL_REGISTRY, ChannelEntry } from './channelRegistry';
import { generate48hWindow } from './urlConstructor';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  action: 'BLOCK_PLAYBACK' | 'ALLOW_PLAYBACK';
  channel?: ChannelEntry;
}

export const validateChannelPlayback = (channelTitle: string, attemptedURL: string): ValidationResult => {
  const channel = CHANNEL_REGISTRY[channelTitle];
  
  if (!channel) {
    return {
      valid: false,
      error: `Channel "${channelTitle}" not found in registry`,
      action: "BLOCK_PLAYBACK"
    };
  }
  
  // For static channels, verify URL matches exactly
  if (channel.fallbackBehavior === "static" || channel.fallbackBehavior === "none") {
    if (attemptedURL !== channel.url) {
      return {
        valid: false,
        error: `URL mismatch for "${channelTitle}". Expected: ${channel.url}, Got: ${attemptedURL}`,
        action: "BLOCK_PLAYBACK"
      };
    }
  }
  
  // For hourly channels with 48h window, verify URL matches the pattern
  if (channel.fallbackBehavior === "48h-window") {
    const validURLs = generate48hWindow(channelTitle);
    if (!validURLs.includes(attemptedURL)) {
      return {
        valid: false,
        error: `URL "${attemptedURL}" not in 48-hour window for "${channelTitle}"`,
        action: "BLOCK_PLAYBACK"
      };
    }
  }
  
  return {
    valid: true,
    channel: channel,
    action: "ALLOW_PLAYBACK"
  };
};
