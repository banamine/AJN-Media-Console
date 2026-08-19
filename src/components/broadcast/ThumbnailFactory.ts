/**
 * Prompting & Asset Generation Pipeline: Developer Directive
 * Master Implementation v10.0
 * 
 * 1. Architectural Flow: Non-blocking background queue
 * 2. AJN Aesthetic Style Dictionary
 * 3. PromptEngine Logic
 * 4. ThumbnailFactory Integration
 */

import { registry } from "../../broadcast/RegistryManager";

export type CogViewStyle = "CINEMATIC" | "MINIMALIST" | "VIBRANT";

export interface StyleTemplate {
  prefix: string;
  negative: string;
}

// 2. The "AJN Aesthetic" Style Dictionary
export const STYLE_TEMPLATES: Record<string, StyleTemplate> = {
  CINEMATIC: {
    prefix: "Professional film still, cinematic lighting, dramatic shadows, high contrast, moody atmosphere, depth of field, 35mm film grain.",
    negative: "text, watermark, blurry, low resolution, flat lighting, amateur photography"
  },
  MINIMALIST: {
    prefix: "Minimalist graphic design, clean composition, bold typography, flat colors, geometric shapes, negative space, simple, elegant, vector art style.",
    negative: "photorealistic, cluttered, messy, complex, shadows, gradients"
  },
  VIBRANT: {
    prefix: "Vibrant broadcast aesthetic, saturated tones, energetic composition, high-key lighting, modern television graphics style, punchy colors.",
    negative: "dull, desaturated, dark, grainy, vintage, moody"
  }
};

export interface ShowMetadata {
  id: string;
  title: string;
  genre: string;
  description: string;
}

export interface PromptBuildResult {
  prompt: string;
  negativePrompt: string;
  styleName: string;
}

// 3. The PromptEngine (Logic)
export class PromptEngine {
  /**
   * Standardizes prompt creation for the Broadcast Asset Manager
   * Combines Metadata + Branding according to formula:
   * [Style Context] + [Show Specifics] + [Quality Anchors]
   */
  public static buildPrompt(showData: ShowMetadata, styleName: string = "CINEMATIC", customOverride?: string): PromptBuildResult {
    const normStyle = styleName.toUpperCase();
    const style = STYLE_TEMPLATES[normStyle] || STYLE_TEMPLATES.CINEMATIC;

    if (customOverride && customOverride.trim().length > 0) {
      return {
        prompt: `${customOverride.trim()}, 16:9 aspect ratio, 1024x1024 resolution, high quality, production-ready.`,
        negativePrompt: style.negative,
        styleName: normStyle
      };
    }

    const contextSnippet = showData.description ? showData.description.slice(0, 100) : "Prime broadcast television show.";
    const prompt = (
      `${style.prefix} ` +
      `Subject: A television thumbnail for a show titled '${showData.title}'. ` +
      `Genre: ${showData.genre}. ` +
      `Context: ${contextSnippet}. ` +
      `16:9 aspect ratio, 1024x1024 resolution, high quality, production-ready.`
    );

    return {
      prompt,
      negativePrompt: style.negative,
      styleName: normStyle
    };
  }
}

export interface GenerationJob {
  jobId: string;
  showId: string;
  styleName: string;
  prompt: string;
  controlHintPath?: string;
  status: "QUEUED" | "GENERATING" | "COMPLETED" | "FAILED";
  outputPath?: string;
  error?: string;
  createdAt: number;
}

// 4. Integration: The ThumbnailFactory
export class ThumbnailFactory {
  private static activeJobs: Map<string, GenerationJob> = new Map();
  private static listeners: Array<() => void> = [];

  public static subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notify(): void {
    this.listeners.forEach(l => l());
  }

  public static getActiveJob(showId: string): GenerationJob | undefined {
    return Array.from(this.activeJobs.values()).find(j => j.showId === showId && (j.status === "QUEUED" || j.status === "GENERATING"));
  }

  public static getJobHistory(showId: string): GenerationJob[] {
    return Array.from(this.activeJobs.values()).filter(j => j.showId === showId).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Simulated CogView4 + ControlNet Conditioning Pipeline Execution
   * Generates production-ready 16:9 broadcast asset
   */
  private static async executeCogViewPipeline(prompt: string, title: string, styleName: string, controlHintPath?: string): Promise<string> {
    // Simulate non-blocking GPU CogView diffusion latency
    await new Promise(resolve => setTimeout(resolve, 1800));

    // Generate high-resolution broadcast artwork poster
    const encodedTitle = encodeURIComponent(title.toUpperCase());
    const encodedStyle = encodeURIComponent(styleName);
    
    let bgColors = ["#0F172A", "#1E293B"];
    let accentColor = "#38BDF8";
    if (styleName === "VIBRANT") {
      bgColors = ["#4338CA", "#EC4899"];
      accentColor = "#FBBF24";
    } else if (styleName === "MINIMALIST") {
      bgColors = ["#18181B", "#27272A"];
      accentColor = "#E4E4E7";
    }

    const controlNetBadge = controlHintPath 
      ? `<g transform="translate(820, 24)">
          <rect x="0" y="0" width="180" height="26" rx="4" fill="#10B981" opacity="0.9" />
          <text x="90" y="14" font-family="monospace" font-size="11" font-weight="bold" fill="#064E3B" text-anchor="middle" dominant-baseline="middle">CONTROLNET COND • 0.7</text>
         </g>` 
      : "";

    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576" width="1024" height="576">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgColors[0]}" />
          <stop offset="100%" stop-color="${bgColors[1]}" />
        </linearGradient>
        <radialGradient id="r" cx="80%" cy="20%" r="60%">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1024" height="576" fill="url(#g)" />
      <rect width="1024" height="576" fill="url(#r)" />
      <circle cx="850" cy="120" r="280" fill="${accentColor}" opacity="0.12" />
      <path d="M0 450 L1024 350 L1024 576 L0 576 Z" fill="#000000" opacity="0.4" />
      ${controlNetBadge}
      <g transform="translate(64, 420)">
        <rect x="0" y="-36" width="120" height="28" rx="6" fill="${accentColor}" />
        <text x="60" y="-18" font-family="sans-serif" font-size="14" font-weight="900" fill="#0F172A" text-anchor="middle" dominant-baseline="middle">${encodedStyle}</text>
        <text x="0" y="32" font-family="sans-serif" font-size="48" font-weight="900" fill="#FFFFFF" letter-spacing="-1">${encodedTitle}</text>
        <text x="0" y="70" font-family="monospace" font-size="16" fill="#94A3B8">COGVIEW4 :: PIPELINE MASTER • 1024x576</text>
      </g>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svgData)}`;
  }

  /**
   * Background service generate queue trigger
   */
  public static async generate(
    showId: string,
    showData: ShowMetadata,
    onUpdateThumbnail?: (showId: string, newPath: string, styleName: string) => void,
    styleName: string = "CINEMATIC",
    customOverride?: string,
    controlHintPath?: string
  ): Promise<GenerationJob> {
    // AI PIPELINE SHELVED: Return default path immediately
    const defaultPath = "https://archive.org/download/daily-highlights/liberty%20moonlight.png";
    if (onUpdateThumbnail) onUpdateThumbnail(showId, defaultPath, styleName);
    try {
      registry.update_thumbnail(showId, defaultPath, styleName);
    } catch (e) {}

    return {
      jobId: `job_shelved_${Date.now()}`,
      showId,
      styleName,
      prompt: "AI Pipeline Shelved - Playout Mode",
      status: "COMPLETED",
      outputPath: defaultPath,
      createdAt: Date.now()
    };
  }
}
