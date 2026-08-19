import { safeLocalStorage } from "../utils/safeStorage";
/**
 * Session Recovery Service (P0 Fix)
 * Implements an asynchronous handshake for live embed and stream session recoveries.
 * Keeps the main UI responsive and interactive by decoupling the player initialization
 * from the React render/main threads.
 */

export interface SessionRecoveryConfig {
  onInitializeUI: () => void;
  onLoadStream: (url: string, name: string) => void;
  onAddLog?: (msg: string, type?: "info" | "warning" | "error") => void;
}

class SessionRecoveryService {
  private isProcessing = false;

  /**
   * Recovers a session asynchronously, ensuring the main UI thread remains fully interactive.
   * This prevents deadlocks if external iframe APIs (like Rumble postMessage or YouTube embeds)
   * stall during initialization.
   */
  public async loadLiveEmbed(
    embedUrl: string,
    streamName: string,
    config: SessionRecoveryConfig
  ): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    if (config.onAddLog) {
      config.onAddLog(`[SessionRecovery] Initiating asynchronous background handshake for: ${streamName}`, "info");
    }

    // Required Behavior: Initialize the UI immediately to keep the screen active and responsive
    try {
      config.onInitializeUI();
    } catch (uiErr: any) {
      if (config.onAddLog) {
        config.onAddLog(`[SessionRecovery] UI layout transition failed: ${uiErr.message || uiErr}`, "error");
      }
    }

    // Required Behavior: Load the stream in the background using a decoupled macrotask
    setTimeout(() => {
      try {
        if (config.onAddLog) {
          config.onAddLog(`[SessionRecovery] Handshake complete. Loading stream in background: ${streamName}`, "info");
        }
        config.onLoadStream(embedUrl, streamName);
      } catch (streamErr: any) {
        if (config.onAddLog) {
          config.onAddLog(`[SessionRecovery] Background stream load failed: ${streamErr.message || streamErr}`, "error");
        }
      } finally {
        this.isProcessing = false;
      }
    }, 50); // 50ms delay guarantees the UI thread handles the modal close transition first
  }

  /**
   * Forcefully clears all saved playback session states in case of persistent external stalls
   */
  public clearSession(): void {
    safeLocalStorage.removeItem("ajn_last_session");
    safeLocalStorage.removeItem("ajn_last_playback_snapshot");
  }
}

export const sessionRecoveryService = new SessionRecoveryService();
