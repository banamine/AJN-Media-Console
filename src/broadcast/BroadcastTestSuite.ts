import { BroadcastRegistry } from "./BroadcastRegistries";
import { ChannelResolver } from "./ChannelResolver";
import { LoopStrategy } from "../types";

export interface TestResult {
  passed: boolean;
  total: number;
  passedCount: number;
  failures: string[];
  logs: string[];
}

/**
 * Automated Verification Suite
 * Validates registry deduplication, resolver deterministic timelines, hot-swap continuity, and GC pruning.
 */
export class BroadcastTestSuite {
  public static runAllTests(): TestResult {
    const logs: string[] = [];
    const failures: string[] = [];
    let passedCount = 0;
    const total = 5;

    const log = (msg: string) => {
      console.log(`[BroadcastTestSuite] ${msg}`);
      logs.push(msg);
    };

    const assert = (condition: boolean, testName: string, failMsg: string) => {
      if (condition) {
        log(`✅ PASSED: ${testName}`);
        passedCount++;
      } else {
        log(`❌ FAILED: ${testName} - ${failMsg}`);
        failures.push(`${testName}: ${failMsg}`);
      }
    };

    log("Booting Automated Verification Suite...");
    const registry = BroadcastRegistry.instance;

    // Save backup of current state
    const backupSnapshot = registry.serializeSnapshot();

    try {
      // ----------------------------------------------------------------------
      // TEST 1: Deduplication & Fingerprinting
      // ----------------------------------------------------------------------
      registry.clear();
      const item1 = registry.media.register({
        title: "Canonical News Feed",
        url: "https://edge.ajn/live/news.m3u8",
        durationSeconds: 1800,
      });
      const item2 = registry.media.register({
        title: "Canonical News Feed ", // trailing space
        url: "https://edge.ajn/live/news.m3u8",
        durationSeconds: 1800,
      });
      assert(
        registry.media.getAll().length === 1 && item1.id === item2.id,
        "Deduplication & Fingerprinting",
        `Expected 1 canonical media asset, got ${registry.media.getAll().length} (ID1=${item1.id}, ID2=${item2.id})`
      );

      // ----------------------------------------------------------------------
      // TEST 2: Provider Layer Abstraction
      // ----------------------------------------------------------------------
      registry.clear();
      registry.channels.register({
        id: "ch_test_demo",
        number: 999,
        name: "Demo Pool Channel",
        playbackProvider: "global_demo",
        playlistId: "pls_demo",
        epgId: "epg_demo",
        loopStrategy: LoopStrategy.MIDNIGHT,
      });
      registry.media.register({ title: "Demo Clip A", url: "https://ajn/a.mp4", durationSeconds: 60 });
      registry.media.register({ title: "Demo Clip B", url: "https://ajn/b.mp4", durationSeconds: 60 });

      const resolvedDemo = ChannelResolver.resolveChannel(999, Date.now());
      assert(
        resolvedDemo.channel.playbackProvider === "global_demo" && resolvedDemo.currentProgram?.id.startsWith("demo_") === true,
        "Provider Abstraction Switch",
        `Expected GlobalDemoProvider resolution (demo_ prefix), got ${resolvedDemo.currentProgram?.id}`
      );

      // ----------------------------------------------------------------------
      // TEST 3: Deterministic Timeline Resolution
      // ----------------------------------------------------------------------
      registry.clear();
      const testDateStr = new Date().toISOString().split("T")[0];
      registry.channels.register({
        id: "ch_test_linear",
        number: 500,
        name: "Linear Cinema",
        playbackProvider: "broadcast",
        playlistId: "pls_lin",
        epgId: "epg_lin",
        loopStrategy: LoopStrategy.LINEAR,
      });
      registry.epg.register("ch_test_linear", testDateStr, [
        {
          id: "blk_exact_1",
          startTime: `${testDateStr}T12:00:00.000Z`,
          title: "High Noon Feature",
          durationSeconds: 3600,
        },
      ], "xmltv");

      const targetTime = new Date(`${testDateStr}T12:15:30.000Z`).getTime();
      const resolvedLinear = ChannelResolver.resolveChannel(500, targetTime);
      assert(
        resolvedLinear.currentProgram?.id === "blk_exact_1" && resolvedLinear.playbackOffsetSeconds === 930,
        "Deterministic Timeline Resolution",
        `Expected blk_exact_1 at offset 930s, got ${resolvedLinear.currentProgram?.id} at offset ${resolvedLinear.playbackOffsetSeconds}s`
      );

      // ----------------------------------------------------------------------
      // TEST 4: Hot-Swap Continuity & Concurrency Lock
      // ----------------------------------------------------------------------
      registry.clear();
      registry.channels.register({
        id: "ch_hotswap",
        number: 777,
        name: "HotSwap Live",
        playbackProvider: "broadcast",
        playlistId: "pls_hot",
        epgId: "epg_hot",
        loopStrategy: LoopStrategy.LIVE_EDGE,
      });
      const m1 = registry.media.register({ title: "Feed v1", url: "https://hot/v1.m3u8", durationSeconds: -1 });
      registry.playlists.register("pls_hot", "Hot Playlist", [m1.id], LoopStrategy.LIVE_EDGE);

      const beforeSwap = ChannelResolver.resolveChannel(777, Date.now());
      
      // Concurrently swap playlist media
      const m2 = registry.media.register({ title: "Feed v2 (Hot Swapped)", url: "https://hot/v2.m3u8", durationSeconds: -1 });
      registry.playlists.register("pls_hot", "Hot Playlist", [m2.id], LoopStrategy.LIVE_EDGE);

      const afterSwap = ChannelResolver.resolveChannel(777, Date.now());
      assert(
        beforeSwap.media?.url === "https://hot/v1.m3u8" && afterSwap.media?.url === "https://hot/v2.m3u8",
        "Hot-Swap Source Continuity",
        `Expected seamless transition from v1 to v2, got before=${beforeSwap.media?.url}, after=${afterSwap.media?.url}`
      );

      // ----------------------------------------------------------------------
      // TEST 5: Memory Lifecycle Garbage Collection
      // ----------------------------------------------------------------------
      registry.media.register({ title: "Orphan Clip", url: "https://dead.drop/orphan.mp4", durationSeconds: 120 });
      const mediaCountBeforeGC = registry.media.getAll().length;
      const gcStats = registry.gc(3);
      const mediaCountAfterGC = registry.media.getAll().length;

      assert(
        gcStats.prunedMedia >= 1 && mediaCountAfterGC < mediaCountBeforeGC,
        "Garbage Collection Sweep",
        `Expected orphan media pruned (before=${mediaCountBeforeGC}, after=${mediaCountAfterGC}, pruned=${gcStats.prunedMedia})`
      );
    } catch (err: any) {
      log(`❌ FATAL TEST EXCEPTION: ${err?.message || err}`);
      failures.push(`FATAL EXCEPTION: ${err?.message || err}`);
    } finally {
      // Restore state
      registry.restoreSnapshot(backupSnapshot);
    }

    const result: TestResult = {
      passed: failures.length === 0,
      total,
      passedCount,
      failures,
      logs,
    };
    log(`Suite Completed: ${passedCount}/${total} Passed.`);
    return result;
  }
}
