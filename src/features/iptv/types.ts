export interface GuideChannel {
  id: string; // The index from the .dpl file
  name: string;
  streamUrl: string;
  thumbnailUrl: string;
  category: string;
  source: 'DAUM' | 'IPTV' | 'ARCHIVE';
  active: boolean;
}
