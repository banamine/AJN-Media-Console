import { validateChannelPlayback } from './playbackValidator';
import { useToasts } from './toast';

export interface PlayerOptions {
  url?: string;
  autoplay?: boolean;
}

export const playChannel = (channelTitle: string, options: PlayerOptions = {}): boolean => {
  const attemptedURL = options.url || '';
  const validation = validateChannelPlayback(channelTitle, attemptedURL);
  
  if (!validation.valid || !validation.channel) {
    console.error(`[PLAYBACK_BLOCKED] ${validation.error}`);
    // Replace this with your actual app error state mechanism if needed
    // toast({ title: "Playback Error", description: validation.error, variant: "destructive" });
    return false;
  }
  
  const channel = validation.channel;
  
  const playerConfig = {
    title: channel.title,
    url: options.url || channel.url,
    type: channel.type,
    parser: channel.parser, 
    autoplay: options.autoplay !== false
  };
  
  // We assume window.specialPlayer exists as described in the requirements.
  // Using any to bypass TS window object strictness for this generic adapter.
  if ((window as any).specialPlayer && typeof (window as any).specialPlayer.load === 'function') {
    (window as any).specialPlayer.load(playerConfig);
  } else {
    console.warn("window.specialPlayer is not defined. The player config would be:", playerConfig);
  }
  
  return true;
};
