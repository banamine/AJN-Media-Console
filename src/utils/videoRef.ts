import React from "react";

export const mainVideoRef = React.createRef<HTMLVideoElement>();

export interface RegisterVideoOptions {
  exclusive?: boolean;
}

export const videoRegistry = new Map<HTMLMediaElement, RegisterVideoOptions>();

export const registerVideo = (video: HTMLMediaElement, options: RegisterVideoOptions = { exclusive: true }) => {
  videoRegistry.set(video, options);
  
  const handlePlay = () => {
    if (!options.exclusive) return;
    
    // Pause all other registered exclusive videos
    videoRegistry.forEach((opts, v) => {
      if (v !== video && !v.paused) {
        // If the other video is exclusive, we pause it so only ONE exclusive plays.
        // If the other video is NOT exclusive, we leave it alone (e.g. Quad player can keep playing in background?)
        // Actually, if we are starting an exclusive video, it should probably steal focus from EVERYTHING.
        v.pause();
      }
    });
  };
  
  video.addEventListener('play', handlePlay);
  
  return () => {
    video.removeEventListener('play', handlePlay);
    videoRegistry.delete(video);
  };
};
