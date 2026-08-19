import React, { useState, useEffect } from 'react';
import { NativeStreamPlayer } from '../components/NativeStreamPlayer';
import { useStaticRundown } from '../hooks/useStaticRundown';

export const NewsPlayer: React.FC = () => {
  const { rundown, loading } = useStaticRundown();
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  // Auto-select the first available channel as soon as the rundown loads
  useEffect(() => {
    if (!selectedChannel && rundown && rundown.length > 0) {
      setSelectedChannel(rundown[0].network || 'AJN Live 24/7');
    }
  }, [rundown, selectedChannel]);

  // Target manifest URL (e.g., from your channel metadata or live stream endpoint)
  const activeManifestUrl = "https://rss.alexjones.media/AJNHourlyVideo.xml"; // Or your active .m3u8 feed

  return (
    <div className="relative w-full h-screen bg-black flex flex-col justify-center items-center">
      {loading ? (
        <div className="text-green-400 font-mono animate-pulse">LOADING BROADCAST RUNDOWN...</div>
      ) : selectedChannel ? (
        <NativeStreamPlayer manifestUrl={activeManifestUrl} />
      ) : (
        <div className="text-gray-500 font-mono">INITIALIZING CHANNEL GATEWAY...</div>
      )}
    </div>
  );
};

export default NewsPlayer;
