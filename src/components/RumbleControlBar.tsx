import React, { useState } from 'react';

interface RumbleControlBarProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const RumbleControlBar: React.FC<RumbleControlBarProps> = ({ iframeRef }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPiP, setIsPiP] = useState(false);

  // Helper function to send postMessage commands to Rumble Iframe API
  const sendRumbleCommand = (command: string, value: any = null) => {
    if (iframeRef?.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          method: command,
          value: value
        }),
        '*'
      );
    }
  };

  const handleMuteToggle = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    sendRumbleCommand(newMuteState ? 'mute' : 'unmute');
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    sendRumbleCommand('setVolume', newVolume);
  };

  const handlePiPToggle = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (iframeRef.current) {
        // Document Picture-in-Picture API or native PiP call
        if ('documentPictureInPicture' in window) {
          const pipWindow = await (window as any).documentPictureInPicture.requestWindow();
          const iframe = iframeRef.current;
          const originalParent = iframe.parentNode;
          const originalNextSibling = iframe.nextSibling;
          
          // Move the actual playing iframe into the PiP window
          pipWindow.document.body.appendChild(iframe);
          
          // Return it to the main window when PiP closes
          pipWindow.addEventListener("pagehide", () => {
            if (originalParent) {
              originalParent.insertBefore(iframe, originalNextSibling);
            }
            setIsPiP(false);
          });
        } else {
          // Fallback toggle signal to Rumble player
          sendRumbleCommand('togglePiP');
        }
        setIsPiP(true);
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

  return (
    <div className="w-full bg-neutral-900 border-t border-neutral-800 text-neutral-200 px-4 py-2.5 flex items-center justify-between font-sans select-none rounded-b-md shadow-md">
      {/* Left section: Mute & Volume */}
      <div className="flex items-center space-x-3">
        <button
          onClick={handleMuteToggle}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-600"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3.63 3.63a.996.996 0 00-1.41 1.41L7.29 10H4c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h3.29l4.29 4.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.14-.58.53-.44.89.14.36.53.58.89.44.77-.3 1.48-.72 2.11-1.23l2.23 2.23a.996.996 0 101.41-1.41L3.63 3.63zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.37-.14-.77.04-.92.41-.14.37.04.78.41.92C17.32 6.13 19 8.86 19 12z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            </svg>
          )}
        </button>

        <div className="flex items-center space-x-2 group">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none"
          />
          <span className="text-xs text-neutral-400 font-mono w-8">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>

      {/* Right section: Picture-in-Picture */}
      <button
        onClick={handlePiPToggle}
        className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 hover:text-white rounded border border-neutral-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-600"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11h-6a1 1 0 00-1 1v4a1 1 0 001 1h6a1 1 0 001-1v-4a1 1 0 00-1-1z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
        <span>{isPiP ? 'Exit PiP' : 'PiP Mode'}</span>
      </button>
    </div>
  );
};

export default RumbleControlBar;
