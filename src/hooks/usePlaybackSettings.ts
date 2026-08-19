import { useState, useEffect } from "react";
import { safeLocalStorage } from "../utils/safeStorage";
import { PlaybackSettings } from "../types";

const DEFAULT_SETTINGS: PlaybackSettings = {
  autoAdvance: true,
  loopPlaylist: true,
  shuffleMode: 'off',
  sortPreference: 'none',
};

// Listeners collection to keep all instances inside the app synchronized
const listeners = new Set<(settings: PlaybackSettings) => void>();

function getStoredSettings(): PlaybackSettings {
  try {
    const stored = safeLocalStorage.getItem("ajn_playback_settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch (e) {
    console.error("Failed to parse playback settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

function setStoredSettings(settings: PlaybackSettings) {
  try {
    safeLocalStorage.setItem("ajn_playback_settings", JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to write playback settings:", e);
  }
  listeners.forEach((listener) => listener(settings));
}

export function usePlaybackSettings() {
  const [settings, setSettings] = useState<PlaybackSettings>(getStoredSettings);

  useEffect(() => {
    const handleUpdate = (newSettings: PlaybackSettings) => {
      setSettings(newSettings);
    };

    // Add this instance's setter to the global listener list
    listeners.add(handleUpdate);

    // Sync across browser tabs/windows
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "ajn_playback_settings") {
        setSettings(getStoredSettings());
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const updateSettings = (updates: Partial<PlaybackSettings>) => {
    const current = getStoredSettings();
    const updated = { ...current, ...updates };
    setStoredSettings(updated);
  };

  const resetSettings = () => {
    setStoredSettings({ ...DEFAULT_SETTINGS });
  };

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
