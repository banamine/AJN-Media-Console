import { BroadcastRegistry } from "./BroadcastRegistries";
import { ChannelResolver } from "./ChannelResolver";
import { LoopStrategy } from "../types";

export interface BenchmarkReport {
  timestamp: string;
  parameters: {
    channelCount: number;
    mediaPerChannel: number;
    totalMediaAssets: number;
  };
  metrics: {
    seedingTimeMs: number;
    gcSweepTimeMs: number;
    resolve10kLatencyMs: number;
    avgResolveMicroseconds: number;
  };
  pruningStats: {
    prunedMedia: number;
    prunedEPG: number;
    prunedPlaylists: number;
  };
}

/**
 * Performance & Stress Testing Suite
 * Measures registry indexing, GC sweeping, and resolveChannel() latency under heavy enterprise scale.
 */
export class BroadcastBenchmarkSuite {
  public static runStressTest(channelCount = 1000, mediaPerChannel = 30): BenchmarkReport {
    const registry = BroadcastRegistry.instance;
    const totalMediaAssets = channelCount * mediaPerChannel;

    console.log(`[BroadcastBenchmark] Starting stress test: ${channelCount} channels, ${totalMediaAssets} media assets...`);

    // Generate mock legacy channel list for seeding benchmark
    const mockChannels: any[] = [];
    for (let c = 1; c <= channelCount; c++) {
      const groupName = c % 4 === 0 ? "News Network" : c % 4 === 1 ? "Sports Matrix" : c % 4 === 2 ? "Cinema Gold" : "Classic Vault";
      for (let m = 0; m < mediaPerChannel; m++) {
        mockChannels.push({
          tvgId: `ch_stress_${c}`,
          tvgName: `Stress Channel ${c}`,
          name: `Program Asset ${m + 1} (Channel ${c})`,
          url: `https://mock.enterprise.edge/live/stream_${c}_asset_${m}.m3u8`,
          logo: `https://mock.enterprise.edge/logo_${c}.png`,
          group: groupName,
          duration: 1800,
          tvgChno: `${100 + c}`,
        });
      }
    }

    // Measure Seeding Time
    const seedStart = performance.now();
    registry.seedFromIPTVChannels(mockChannels);
    const seedingTimeMs = Math.round((performance.now() - seedStart) * 100) / 100;

    // Measure 10,000 Random resolveChannel invocations
    const resolveStart = performance.now();
    const allChannels = registry.channels.getAll();
    const maxNum = allChannels.length > 0 ? allChannels[allChannels.length - 1].number : 100;

    for (let i = 0; i < 10000; i++) {
      const targetNum = 101 + Math.floor(Math.random() * channelCount);
      ChannelResolver.resolveChannel(targetNum, Date.now() - Math.floor(Math.random() * 86400000));
    }
    const resolve10kLatencyMs = Math.round((performance.now() - resolveStart) * 100) / 100;
    const avgResolveMicroseconds = Math.round((resolve10kLatencyMs / 10000) * 1000 * 100) / 100;

    // Measure GC Sweep
    const gcStart = performance.now();
    const pruningStats = registry.gc(2);
    const gcSweepTimeMs = Math.round((performance.now() - gcStart) * 100) / 100;

    const report: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      parameters: {
        channelCount,
        mediaPerChannel,
        totalMediaAssets,
      },
      metrics: {
        seedingTimeMs,
        gcSweepTimeMs,
        resolve10kLatencyMs,
        avgResolveMicroseconds,
      },
      pruningStats,
    };

    console.log("[BroadcastBenchmark] Stress test completed:", report);
    return report;
  }
}
