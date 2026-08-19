/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Schema-correct Rumble channel factory + cross-manifest validator.
 * Matches the ACTUAL fields used by every existing manifest entry
 * (channelId, num, category, logo, streamType, type, source, hlsSource,
 * description) — not a new, incompatible shape.
 */

export const AJN_LIVE_PLACEHOLDER_ID = "v77ywh4"; // AJN Live's own real embed — never valid for any other channel

export interface RumbleChannelConfig {
  channelId: string;
  num: number;
  name: string;
  category: string;
  logo: string;
  rumbleEmbedId: string; // the ID from https://rumble.com/embed/{id}/?pub=...
  pub: string;
  sourcePageUrl?: string; // the human-readable https://rumble.com/{id}-{slug}.html page, for reference
  description: string;
}

export function createRumbleChannel(config: RumbleChannelConfig) {
  const embedUrl = `https://rumble.com/embed/${config.rumbleEmbedId}/?pub=${config.pub}`;
  return {
    channelId: config.channelId,
    num: config.num,
    name: config.name,
    category: config.category,
    logo: config.logo,
    streamType: "live_hls" as const,
    type: "live_hls" as const,
    source: embedUrl,
    hlsSource: embedUrl,
    sourcePageUrl: config.sourcePageUrl,
    description: config.description,
  };
}

/**
 * Checks ALL manifests (factory-built or plain object literals) for the
 * AJN Live placeholder ID. Deliberately does not exempt any channel except
 * AJN Live itself — a channel legitimately needing that ID doesn't exist
 * outside AJN Live, so there is nothing safe to exclude.
 */
export function validateChannelManifests(manifests: any[]): string[] {
  const warnings: string[] = [];
  for (const m of manifests) {
    const usesPlaceholder =
      (m.source && m.source.includes(AJN_LIVE_PLACEHOLDER_ID)) ||
      (m.hlsSource && m.hlsSource.includes(AJN_LIVE_PLACEHOLDER_ID));
    if (usesPlaceholder && m.channelId !== "ch-ajn-live") {
      warnings.push(
        `Channel "${m.name}" (${m.channelId}) still points at the AJN Live placeholder embed (${AJN_LIVE_PLACEHOLDER_ID}) — likely a copy-paste that was never replaced with its real source.`
      );
    }
  }
  return warnings;
}
