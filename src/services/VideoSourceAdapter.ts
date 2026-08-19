/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractYouTubeId } from "../utils/urlUtils";

export interface VideoSourceAdapter {
  readonly sourceType: "youtube" | "rumble" | "direct" | "iframe";
  generateEmbedUrl(rawUrl: string, isMuted?: boolean): string;
  getInitializationPolicy(): "autoplay" | "user-gesture";
}

/**
 * YouTube Source Adapter.
 * Strips controls, enforces modest branding, and sets autoplay/mute parameters natively.
 */
export class YouTubeAdapter implements VideoSourceAdapter {
  public readonly sourceType = "youtube" as const;

  public generateEmbedUrl(rawUrl: string, isMuted = true): string {
    const videoId = extractYouTubeId(rawUrl);
    if (!videoId) return rawUrl;

    const muteParam = isMuted ? 1 : 0;
    // Official provider parameters for auto-initiation & clean UI
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muteParam}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&enablejsapi=1&disablekb=1`;
  }

  public getInitializationPolicy(): "autoplay" | "user-gesture" {
    return "autoplay";
  }
}

/**
 * Rumble Source Adapter.
 * Intercepts Rumble links and generates clean embed configuration.
 */
export class RumbleAdapter implements VideoSourceAdapter {
  public readonly sourceType = "rumble" as const;

  public generateEmbedUrl(rawUrl: string, isMuted = true): string {
    let cleanUrl = rawUrl.trim();

    // Check if it's already an embed URL or extract watch ID
    const embedMatch = cleanUrl.match(/rumble\.com\/embed\/([a-zA-Z0-9]+)/i);
    const watchMatch = cleanUrl.match(/rumble\.com\/(v[a-zA-Z0-9]+)/i);

    let embedId = "";
    if (embedMatch && embedMatch[1]) {
      embedId = embedMatch[1];
    } else if (watchMatch && watchMatch[1]) {
      embedId = watchMatch[1];
    }

    if (embedId) {
      const pubMatch = cleanUrl.match(/pub=([a-zA-Z0-9]+)/);
      const pubParam = pubMatch ? `pub=${pubMatch[1]}&` : "";
      const muteParam = isMuted ? 1 : 0;
      // In Rumble embed API, autoplay=2 initiates autoplay muted. autoplay=1 initiates standard autoplay.
      const autoParam = isMuted ? 2 : 1;
      return `https://rumble.com/embed/${embedId}/?${pubParam}rel=0&autoplay=${autoParam}&muted=${muteParam}&controls=0`;
    }

    const separator = cleanUrl.includes("?") ? "&" : "?";
    const muteParam = isMuted ? 1 : 0;
    return `${cleanUrl}${separator}rel=0&autoplay=1&muted=${muteParam}&controls=0`;
  }

  public getInitializationPolicy(): "autoplay" | "user-gesture" {
    return "autoplay";
  }
}

/**
 * Direct Media Stream Adapter (HLS, MP4, WebRTC).
 */
export class DirectStreamAdapter implements VideoSourceAdapter {
  public readonly sourceType = "direct" as const;

  public generateEmbedUrl(rawUrl: string, _isMuted = true): string {
    return rawUrl.trim();
  }

  public getInitializationPolicy(): "autoplay" | "user-gesture" {
    return "autoplay";
  }
}

/**
 * Generic Iframe Embed Adapter.
 */
export class GenericIframeAdapter implements VideoSourceAdapter {
  public readonly sourceType = "iframe" as const;

  public generateEmbedUrl(rawUrl: string, isMuted = true): string {
    const separator = rawUrl.includes("?") ? "&" : "?";
    const muteParam = isMuted ? 1 : 0;
    return `${rawUrl}${separator}autoplay=1&mute=${muteParam}&muted=${muteParam}&controls=0`;
  }

  public getInitializationPolicy(): "autoplay" | "user-gesture" {
    return "autoplay";
  }
}

/**
 * Source Adapter Factory.
 * Resolves heterogeneous video feed URLs to standardized controller adapters.
 */
export class VideoSourceAdapterFactory {
  public static getAdapter(url: string | null | undefined): VideoSourceAdapter {
    if (!url || typeof url !== "string") {
      return new DirectStreamAdapter();
    }

    const lower = url.toLowerCase().trim();

    if (lower.includes("youtube.com/") || lower.includes("youtu.be/") || lower.includes("youtube-nocookie.com/")) {
      return new YouTubeAdapter();
    }

    if (lower.includes("rumble.com/")) {
      return new RumbleAdapter();
    }

    if (
      lower.endsWith(".m3u8") ||
      lower.endsWith(".mp4") ||
      lower.endsWith(".mpd") ||
      lower.endsWith(".webm") ||
      lower.includes(".m3u8?") ||
      lower.includes(".mp4?") ||
      lower.startsWith("blob:") ||
      lower.startsWith("data:")
    ) {
      return new DirectStreamAdapter();
    }

    if (lower.includes("/embed") || lower.includes("player") || lower.includes("iframe")) {
      return new GenericIframeAdapter();
    }

    return new DirectStreamAdapter();
  }
}
