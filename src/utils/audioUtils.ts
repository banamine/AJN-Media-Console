/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A tiny 100ms silent WAV file encoded in base64.
 * This is used to pre-emptively "wake" the Bluetooth/audio output channels
 * and reduce initial fade-in or connection latency.
 */
export const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";

/**
 * Helper to play a tiny silent sound to wake up the Bluetooth audio device channel.
 */
export function wakeAudioChannel(): Promise<void> {
  if (typeof Audio === "undefined") return Promise.resolve();
  const silence = new Audio(SILENT_AUDIO_URI);
  silence.volume = 0.01; // extremely low volume
  return silence.play().catch((err) => {
    console.warn("[AudioUtils] Silent audio wake failed or blocked:", err);
  });
}

/**
 * Helper to check if a media device label corresponds to a Bluetooth or wireless output.
 */
export function isBluetoothDevice(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return (
    lower.includes("bluetooth") ||
    lower.includes("wireless") ||
    lower.includes("headset") ||
    lower.includes("airpods") ||
    lower.includes("buds") ||
    lower.includes("hands-free") ||
    lower.includes("hearing aid") ||
    lower.includes("hfp") ||
    lower.includes("a2dp")
  );
}
