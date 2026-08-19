export const safePlay = (mediaElement: HTMLMediaElement | null, onBlocked?: () => void, onAborted?: () => void) => {
  if (!mediaElement) return;
  const playPromise = mediaElement.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      if (error.name === 'NotAllowedError') {
        console.warn("Autoplay blocked. Waiting for interaction.");
        if (onBlocked) onBlocked();
      } else if (error.name === 'AbortError') {
        console.log("Playback safely interrupted by new stream.");
        if (onAborted) onAborted();
      } else {
        console.warn("Play interrupted:", error);
      }
    });
  }
};
