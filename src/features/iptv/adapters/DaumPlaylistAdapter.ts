import { GuideChannel } from '../types';

export class DaumPlaylistAdapter {
  /**
   * Parses raw .dpl text and normalizes into internal GuideChannel format
   * Matches index*key*value pattern found in English Channels.dpl
   */
  public static parse(rawData: string): GuideChannel[] {
    const lines = rawData.split(/\r?\n/);
    const channelMap = new Map<string, Partial<GuideChannel>>();

    for (const line of lines) {
      // Regex pattern: Group 1=Index, Group 2=Key, Group 3=Value
      const match = line.match(/^(\d+)\*(\w+)\*(.+)$/);
      
      if (!match) continue;

      const [_, index, key, value] = match;

      if (!channelMap.has(index)) {
        channelMap.set(index, { id: index, active: true, source: 'DAUM', category: 'General' });
      }

      const entry = channelMap.get(index)!;

      // Map DPL keys to GuideChannel properties
      switch (key) {
        case 'file':
          entry.streamUrl = value;
          break;
        case 'title':
          entry.name = value;
          break;
        case 'thumbnail':
          entry.thumbnailUrl = value;
          break;
        case 'author':
          entry.category = value;
          break;
      }
    }

    // Filter and validate strictly
    return Array.from(channelMap.values()).filter((c): c is GuideChannel => 
      !!c.name && !!c.streamUrl
    );
  }
}
