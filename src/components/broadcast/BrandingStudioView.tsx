import React, { useState } from "react";
import { VirtualChannel, ChannelBranding } from "./types";
import { Sparkles, Sliders, Type, Palette, Layout, ShieldCheck, Film, Image as ImageIcon, Eye } from "lucide-react";

interface BrandingStudioViewProps {
  channels: VirtualChannel[];
  brandingPackages: Record<string, ChannelBranding>;
  onUpdateBranding: (channelId: string, branding: ChannelBranding) => void;
  isLight: boolean;
}

export const BrandingStudioView: React.FC<BrandingStudioViewProps> = ({
  channels,
  brandingPackages,
  onUpdateBranding,
  isLight
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || "vch-101");

  const currentBrand: ChannelBranding = brandingPackages[selectedChannelId] || {
    channelId: selectedChannelId,
    logoUrl: channels.find(c => c.id === selectedChannelId)?.logoUrl || "",
    watermarkText: `${channels.find(c => c.id === selectedChannelId)?.name?.toUpperCase() || "AJN"} LIVE`,
    watermarkPosition: "top-right",
    stationIdUrl: "AJN Network • Verified Playout",
    introUrl: "https://assets.ajn.player/intros/default-ident.mp4",
    outroUrl: "https://assets.ajn.player/outros/default-credits.mp4",
    lowerThirdStyle: "modern-glass",
    sponsorOverlayUrl: "Sponsored by AJN Global Media",
    themePrimaryColor: "#3b82f6",
    themeSecondaryColor: "#1d4ed8",
    fontHeading: "Space Grotesk",
    fontBody: "Inter",
    transitionEffect: "crossfade"
  };

  const handleChange = (key: keyof ChannelBranding, value: any) => {
    const updated = { ...currentBrand, [key]: value };
    onUpdateBranding(selectedChannelId, updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Channel Selector & Settings Form */}
      <div className={`lg:col-span-7 rounded-2xl border p-6 space-y-6 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900/60 border-slate-800"
      }`}>
        <div className="flex items-center justify-between border-b pb-4 border-slate-800/80">
          <div>
            <h2 className="text-lg font-bold font-sans flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Channel Branding Studio
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Configure station IDs, bugs, intros, lower-thirds, and visual identity</p>
          </div>

          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="py-2 px-3 rounded-xl bg-blue-600 font-bold text-white text-xs focus:outline-none shadow-lg shadow-blue-600/30"
          >
            {channels.map(c => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                Ch {c.number}: {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-sans">
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-400 block mb-1">Watermark Bug Text ("Bug")</label>
            <input
              type="text"
              value={currentBrand.watermarkText}
              onChange={(e) => handleChange("watermarkText", e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1">Watermark Corner Position</label>
            <select
              value={currentBrand.watermarkPosition}
              onChange={(e) => handleChange("watermarkPosition", e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold"
            >
              <option value="top-left">↖ Top Left</option>
              <option value="top-right">↗ Top Right</option>
              <option value="bottom-left">↙ Bottom Left</option>
              <option value="bottom-right">↘ Bottom Right</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1">Lower-Third Style Preset</label>
            <select
              value={currentBrand.lowerThirdStyle}
              onChange={(e) => handleChange("lowerThirdStyle", e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold"
            >
              <option value="modern-glass">🪟 Modern Glassmorphism</option>
              <option value="classic-solid">🟦 Classic Broadcast Solid</option>
              <option value="cyber-neon">⚡ Cyberpunk Neon Grid</option>
              <option value="minimal-dark">⚫ Minimalist Dark Slate</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1">Heading Typography</label>
            <select
              value={currentBrand.fontHeading}
              onChange={(e) => handleChange("fontHeading", e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold"
            >
              <option value="Space Grotesk">Space Grotesk (Tech)</option>
              <option value="Inter">Inter (Clean)</option>
              <option value="Outfit">Outfit (Display)</option>
              <option value="JetBrains Mono">JetBrains Mono (Technical)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1">Playout Transition Effect</label>
            <select
              value={currentBrand.transitionEffect}
              onChange={(e) => handleChange("transitionEffect", e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold"
            >
              <option value="crossfade">🌊 Smooth Crossfade</option>
              <option value="dip-to-black">⚫ Dip to Black</option>
              <option value="wipe-right">👉 Wipe Right</option>
              <option value="glitch-cut">💥 Cyber Glitch Cut</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1">Primary Theme Accent</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={currentBrand.themePrimaryColor}
                onChange={(e) => handleChange("themePrimaryColor", e.target.value)}
                className="w-10 h-10 rounded-xl bg-transparent cursor-pointer border border-slate-700"
              />
              <input
                type="text"
                value={currentBrand.themePrimaryColor}
                onChange={(e) => handleChange("themePrimaryColor", e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-400 block mb-1">Secondary Theme Accent</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={currentBrand.themeSecondaryColor}
                onChange={(e) => handleChange("themeSecondaryColor", e.target.value)}
                className="w-10 h-10 rounded-xl bg-transparent cursor-pointer border border-slate-700"
              />
              <input
                type="text"
                value={currentBrand.themeSecondaryColor}
                onChange={(e) => handleChange("themeSecondaryColor", e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono uppercase"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-slate-400 block mb-1">Station ID & Ident Bumper Text</label>
            <input
              type="text"
              value={currentBrand.stationIdUrl}
              onChange={(e) => handleChange("stationIdUrl", e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-sans"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-slate-400 block mb-1">Sponsor Overlay Credit</label>
            <input
              type="text"
              value={currentBrand.sponsorOverlayUrl}
              onChange={(e) => handleChange("sponsorOverlayUrl", e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-sans text-emerald-400 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Live Branding Preview Stage */}
      <div className={`lg:col-span-5 rounded-2xl border p-6 space-y-4 ${
        isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"
      }`}>
        <h3 className="text-sm font-bold font-sans flex items-center gap-2 text-slate-300">
          <Eye className="w-4 h-4 text-emerald-400" />
          Live Playout Branding Simulator
        </h3>

        {/* Video Canvas Mockup */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col justify-between p-4 group">
          <img
            src="https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg"
            alt="Playout preview"
            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
          />

          {/* Watermark Bug */}
          <div className={`absolute z-10 py-1 px-2.5 rounded-xl backdrop-blur-md border font-mono font-bold text-[10px] tracking-wider transition-all shadow-lg ${
            currentBrand.watermarkPosition === "top-left" ? "top-3 left-3" :
            currentBrand.watermarkPosition === "top-right" ? "top-3 right-3" :
            currentBrand.watermarkPosition === "bottom-left" ? "bottom-14 left-3" : "bottom-14 right-3"
          }`}
          style={{ 
            backgroundColor: `${currentBrand.themePrimaryColor}33`, 
            borderColor: currentBrand.themePrimaryColor,
            color: "#ffffff"
          }}>
            {currentBrand.watermarkText}
          </div>

          {/* Top Station ID Credit */}
          <div className="relative z-10 self-center top-1 bg-black/60 backdrop-blur-md py-0.5 px-3 rounded-full border border-white/10 text-[9px] font-mono text-slate-300">
            {currentBrand.stationIdUrl}
          </div>

          {/* Lower Third Overlay Stage */}
          <div className="relative z-10 mt-auto space-y-1.5">
            <div className={`p-3 rounded-xl backdrop-blur-lg border transition-all ${
              currentBrand.lowerThirdStyle === "modern-glass" ? "bg-slate-900/70 border-white/15 text-white" :
              currentBrand.lowerThirdStyle === "classic-solid" ? "bg-blue-900 border-blue-500 text-white" :
              currentBrand.lowerThirdStyle === "cyber-neon" ? "bg-black/90 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]" :
              "bg-slate-950 border-slate-800 text-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: currentBrand.themePrimaryColor }} />
                  <span className="font-bold text-xs font-sans tracking-tight" style={{ fontFamily: currentBrand.fontHeading }}>
                    {channels.find(c => c.id === selectedChannelId)?.currentProgram || "Cyberpunk Heist Breakdown"}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                  {currentBrand.transitionEffect}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-1 opacity-80">
                {currentBrand.sponsorOverlayUrl}
              </p>
            </div>
          </div>
        </div>

        {/* Branding Package Summary Cards */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-500 block text-[9px]">HEADING FONT</span>
            <span className="font-bold text-slate-200">{currentBrand.fontHeading}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-500 block text-[9px]">LOWER THIRD</span>
            <span className="font-bold text-slate-200">{currentBrand.lowerThirdStyle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
