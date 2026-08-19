import { useCallback } from "react";
import { MusicTrack } from "../types";

export function useMusicPlayer(
  setQueue: (tracks: any[]) => void,
  playSiriusTrack: (idx: number) => void,
  queueProgress: { played: number; total: number }
) {
  const playTrackList = useCallback((tracks: MusicTrack[], selectedIndex: number) => {
    const formattedTracks = tracks.map(t => ({
      title: t.title,
      artist: t.artist,
      url: t.url,
      backups: t.backups || [],
      sourceType: "music"
    }));
    setQueue(formattedTracks);
    playSiriusTrack(selectedIndex);
  }, [setQueue, playSiriusTrack]);

  return {
    playTrackList,
    queueProgress,
  };
}
