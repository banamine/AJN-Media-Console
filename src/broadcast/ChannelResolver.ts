import {
  BroadcastChannel,
  ResolvedChannelPlayback,
  EPGProgramBlock,
  MediaRegistryItem,
  LoopStrategy,
} from "../types";
import { BroadcastRegistry } from "./BroadcastRegistries";

/**
 * Layer 1: Production Broadcast Provider
 * Authoritative provider for real IPTV virtual channels with strict timeline isolation.
 */
export class BroadcastProvider {
  public static resolve(channel: BroadcastChannel, targetTimestampMs: number): ResolvedChannelPlayback {
    const registry = BroadcastRegistry.instance;
    const dateObj = new Date(targetTimestampMs);
    const dateKey = dateObj.toISOString().split("T")[0];

    const schedule = registry.epg.getSchedule(channel.id, dateKey);
    const playlist = registry.playlists.getById(channel.playlistId);

    let currentProgram: EPGProgramBlock | null = null;
    let nextProgram: EPGProgramBlock | null = null;
    let media: MediaRegistryItem | null = null;
    let playbackOffsetSeconds = 0;

    // Time calculation inside the broadcast day
    const secondsSinceMidnight = dateObj.getUTCHours() * 3600 + dateObj.getUTCMinutes() * 60 + dateObj.getUTCSeconds();

    if (schedule && schedule.blocks.length > 0) {
      // Find block matching current time
      for (let i = 0; i < schedule.blocks.length; i++) {
        const blk = schedule.blocks[i];
        const blkStart = new Date(blk.startTime).getTime();
        const blkEnd = blkStart + blk.durationSeconds * 1000;

        if (targetTimestampMs >= blkStart && targetTimestampMs < blkEnd) {
          currentProgram = blk;
          nextProgram = schedule.blocks[i + 1] || null;
          playbackOffsetSeconds = Math.max(0, Math.floor((targetTimestampMs - blkStart) / 1000));
          break;
        }
      }

      // Fallback if none matched exact timestamp
      if (!currentProgram) {
        currentProgram = schedule.blocks[0];
        nextProgram = schedule.blocks[1] || null;
      }
    } else if (playlist && playlist.mediaIds.length > 0) {
      // Deterministic synthetic fallback schedule based on Loop Strategy
      const totalMedia = playlist.mediaIds.length;
      let targetIndex = 0;

      switch (channel.loopStrategy) {
        case LoopStrategy.FIXED_24_HOUR:
        case LoopStrategy.MIDNIGHT: {
          const avgDuration = 1800; // 30 min default block
          targetIndex = Math.floor(secondsSinceMidnight / avgDuration) % totalMedia;
          playbackOffsetSeconds = secondsSinceMidnight % avgDuration;
          break;
        }
        case LoopStrategy.EVENT:
        case LoopStrategy.LIVE_EDGE: {
          targetIndex = totalMedia - 1; // latest item
          playbackOffsetSeconds = 0;
          break;
        }
        default: {
          targetIndex = Math.floor(targetTimestampMs / 1800000) % totalMedia;
          playbackOffsetSeconds = Math.floor((targetTimestampMs % 1800000) / 1000);
        }
      }

      const mediaId = playlist.mediaIds[targetIndex];
      media = registry.media.getById(mediaId) || null;

      if (media) {
        currentProgram = {
          id: `synth_${channel.id}_${targetIndex}`,
          startTime: new Date(targetTimestampMs - playbackOffsetSeconds * 1000).toISOString(),
          title: media.title,
          description: `Synthetic Broadcast Presentation • ${channel.name}`,
          mediaId: media.id,
          durationSeconds: media.durationSeconds > 0 ? media.durationSeconds : 1800,
          isSynthetic: true,
        };
      }
    }

    // Resolve Canonical Media
    if (currentProgram && currentProgram.mediaId && !media) {
      media = registry.media.getById(currentProgram.mediaId) || null;
    }

    return {
      channel,
      currentProgram,
      nextProgram,
      media,
      playbackOffsetSeconds,
      resolvedTimestamp: targetTimestampMs,
      graphicsProfile: channel.graphicsProfile,
    };
  }
}

/**
 * Layer 2: Unified Pool Provider (GlobalDemoProvider)
 * Circular looping pool for demos, testing, random-play kiosk mode, and fallback playback.
 */
export class GlobalDemoProvider {
  public static resolve(channel: BroadcastChannel, targetTimestampMs: number): ResolvedChannelPlayback {
    const registry = BroadcastRegistry.instance;
    const allMedia = registry.media.getAll();

    if (allMedia.length === 0) {
      return {
        channel,
        currentProgram: null,
        nextProgram: null,
        media: null,
        playbackOffsetSeconds: 0,
        resolvedTimestamp: targetTimestampMs,
      };
    }

    // Global circular loop calculation across all loaded media
    const avgSegLen = 600; // 10 min segments
    const totalCycle = allMedia.length * avgSegLen * 1000;
    const loopPosMs = targetTimestampMs % totalCycle;
    const itemIndex = Math.floor(loopPosMs / (avgSegLen * 1000));
    const offsetSec = Math.floor((loopPosMs % (avgSegLen * 1000)) / 1000);

    const media = allMedia[itemIndex] || allMedia[0];
    const nextMedia = allMedia[(itemIndex + 1) % allMedia.length];

    const currentProgram: EPGProgramBlock = {
      id: `demo_${itemIndex}`,
      startTime: new Date(targetTimestampMs - offsetSec * 1000).toISOString(),
      title: media.title,
      description: "Global Unified Demo Pool • Continuous Circular Loop",
      mediaId: media.id,
      durationSeconds: avgSegLen,
      isSynthetic: true,
    };

    const nextProgram: EPGProgramBlock = {
      id: `demo_${itemIndex + 1}`,
      startTime: new Date(targetTimestampMs + (avgSegLen - offsetSec) * 1000).toISOString(),
      title: nextMedia ? nextMedia.title : "Next Loop Feed",
      durationSeconds: avgSegLen,
      isSynthetic: true,
    };

    return {
      channel,
      currentProgram,
      nextProgram,
      media,
      playbackOffsetSeconds: offsetSec,
      resolvedTimestamp: targetTimestampMs,
      graphicsProfile: channel.graphicsProfile,
    };
  }
}

export interface ResolverDiagnostics {
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number;
  totalResolutions: number;
  activeCacheSize: number;
}

/**
 * Authoritative Channel Resolver Orchestrator
 * Decouples the playback engine from storage stores and provider modes.
 */
export class ChannelResolver {
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static totalLatencyMs = 0;
  private static resolutionCount = 0;

  private static resolveCache = new Map<string, {
    registryRevision: number;
    timestampFloor: number;
    timestampCeil: number;
    result: ResolvedChannelPlayback;
  }>();

  public static getMetrics(): ResolverDiagnostics {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      avgLatencyMs: this.resolutionCount > 0 ? Number((this.totalLatencyMs / this.resolutionCount).toFixed(3)) : 0,
      totalResolutions: this.resolutionCount,
      activeCacheSize: this.resolveCache.size,
    };
  }

  public static clearCache(): void {
    this.resolveCache.clear();
  }

  /**
   * Resolve media and playback policy for any channel at any given timestamp with intelligent boundary caching.
   */
  public static resolveChannel(channelIdOrNumber: string | number, targetTimestampMs: number = Date.now()): ResolvedChannelPlayback {
    const startTime = performance.now();
    this.resolutionCount++;
    const registry = BroadcastRegistry.instance;
    const currentRevision = registry.getRevision();
    const cacheKey = `${channelIdOrNumber}`;

    const cached = this.resolveCache.get(cacheKey);
    if (cached && cached.registryRevision === currentRevision && targetTimestampMs >= cached.timestampFloor && targetTimestampMs < cached.timestampCeil) {
      this.cacheHits++;
      const cachedResult = {
        ...cached.result,
        resolvedTimestamp: targetTimestampMs,
        playbackOffsetSeconds: Math.max(0, Math.floor((targetTimestampMs - cached.timestampFloor) / 1000)),
      };
      this.totalLatencyMs += performance.now() - startTime;
      return cachedResult;
    }

    this.cacheMisses++;

    let channel: BroadcastChannel | undefined;
    if (typeof channelIdOrNumber === "number") {
      channel = registry.channels.getByNumber(channelIdOrNumber);
    } else {
      channel = registry.channels.getById(channelIdOrNumber);
      if (!channel && !isNaN(Number(channelIdOrNumber))) {
        channel = registry.channels.getByNumber(Number(channelIdOrNumber));
      }
    }

    // Fallback if channel not found
    if (!channel) {
      const allChannels = registry.channels.getAll();
      channel = allChannels[0] || {
        id: "ch_demo_fallback",
        number: 1,
        name: "AJN Global Demo Stream",
        playbackProvider: "global_demo",
        playlistId: "pls_demo",
        epgId: "epg_demo",
        loopStrategy: LoopStrategy.MIDNIGHT,
        graphicsProfile: {
          showLowerThirds: true,
          logoPosition: "top-right",
          overlayTheme: "slate",
          showCountdown: false,
        },
      };
    }

    // Orchestration Switch
    const resolved = channel.playbackProvider === "global_demo"
      ? GlobalDemoProvider.resolve(channel, targetTimestampMs)
      : BroadcastProvider.resolve(channel, targetTimestampMs);

    // Compute cache boundary for intelligent invalidation
    if (resolved.currentProgram && resolved.currentProgram.startTime) {
      const floor = new Date(resolved.currentProgram.startTime).getTime();
      const ceil = floor + (resolved.currentProgram.durationSeconds > 0 ? resolved.currentProgram.durationSeconds * 1000 : 1800000);
      if (!isNaN(floor) && !isNaN(ceil) && ceil > floor) {
        this.resolveCache.set(cacheKey, {
          registryRevision: currentRevision,
          timestampFloor: floor,
          timestampCeil: ceil,
          result: resolved,
        });
      }
    }

    this.totalLatencyMs += performance.now() - startTime;
    return resolved;
  }
}

/**
 * Broadcast Automation & Graphics Engine
 * Intercepts resolved playback to inject lower thirds, commercial insertion hooks, and emergency interruptions.
 */
export class BroadcastAutomationEngine {
  private static emergencyCutInActive = false;
  private static emergencyMessage = "";

  public static triggerEmergencyAlert(message: string): void {
    this.emergencyCutInActive = true;
    this.emergencyMessage = message;
  }

  public static clearEmergencyAlert(): void {
    this.emergencyCutInActive = false;
    this.emergencyMessage = "";
  }

  public static getAutomationState(playback: ResolvedChannelPlayback): {
    showLowerThird: boolean;
    lowerThirdText: string;
    showWatermarkBug: boolean;
    watermarkPos: string;
    isEmergencyAlert: boolean;
    emergencyBanner: string;
    isCommercialBreak: boolean;
    upNextTitle: string;
    countdownSeconds: number;
    isBreakingNews: boolean;
    networkBrandingTheme: string;
    policyHierarchy: { global: string; category: string; playlist: string; channelOverride: string };
  } {
    const profile = playback.graphicsProfile || {
      showLowerThirds: true,
      logoPosition: "top-right",
      overlayTheme: "slate",
      showCountdown: false,
    };

    // Check if emergency threshold triggers
    const isEmergency = this.emergencyCutInActive && (playback.channel.emergencyAlertProfile?.allowCutIns !== false);

    // Commercial break check (e.g. synthetic commercial flag or block category)
    const isCommercial = playback.currentProgram?.category?.toLowerCase() === "commercial" ||
                         playback.currentProgram?.title?.toLowerCase().includes("commercial");

    const isBreakingNews = playback.currentProgram?.category?.toLowerCase() === "breaking news" ||
                           playback.currentProgram?.title?.toLowerCase().includes("breaking news");

    let countdownSeconds = 0;
    if (playback.currentProgram?.startTime && playback.currentProgram.durationSeconds) {
      const endMs = new Date(playback.currentProgram.startTime).getTime() + playback.currentProgram.durationSeconds * 1000;
      if (!isNaN(endMs)) {
        countdownSeconds = Math.max(0, Math.floor((endMs - playback.resolvedTimestamp) / 1000));
      }
    }

    return {
      showLowerThird: profile.showLowerThirds && !isCommercial,
      lowerThirdText: playback.currentProgram?.title || playback.channel.name,
      showWatermarkBug: profile.logoPosition !== "hidden",
      watermarkPos: profile.logoPosition || "top-right",
      isEmergencyAlert: isEmergency,
      emergencyBanner: isEmergency ? `🚨 BROADCAST EMERGENCY CUT-IN: ${this.emergencyMessage}` : "",
      isCommercialBreak: !!isCommercial,
      upNextTitle: playback.nextProgram?.title || "Continuing Broadcast Presentation",
      countdownSeconds,
      isBreakingNews: !!isBreakingNews,
      networkBrandingTheme: profile.overlayTheme || "slate",
      policyHierarchy: {
        global: "AJN Core Standard Policy",
        category: playback.currentProgram?.category || "Universal Streams",
        playlist: playback.channel.playlistId || "pls_default",
        channelOverride: playback.channel.id,
      },
    };
  }
}
