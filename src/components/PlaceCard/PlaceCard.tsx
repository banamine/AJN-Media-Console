/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, memo } from "react";
import { ContentItem } from "../../types";
import { cleanTitle } from "../../utils/titleCleaner";
import styles from "./PlaceCard.module.css";
import { AlertTriangle, Check, Sliders } from "lucide-react";
import thumbnails from "../../data/thumbnails.json";
import { safeLocalStorage } from "../../utils/safeStorage";

interface PlaceCardProps {
  slotNumber: number;
  item?: ContentItem;
  onDropItem: (item: ContentItem, slotNumber: number) => void;
  onPlay?: (item: ContentItem) => void;
  onSelect?: (item: ContentItem) => void;
  onConflictResolve?: (itemId: string, selectedUrl: string) => void;
}

const getItemType = (item: ContentItem): string => {
  if (!item) return "archive";
  const explicitType = (item as any).type;
  if (explicitType && (thumbnails.types as any)[explicitType]) {
    return explicitType;
  }
  const titleLower = item.title ? item.title.toLowerCase() : "";
  const groupLower = item.groupTitle ? item.groupTitle.toLowerCase() : "";
  const combined = `${titleLower} ${groupLower}`;

  if (combined.includes("war room") || combined.includes("warroom") || combined.includes("liberty express")) {
    return "warroom";
  }
  if (combined.includes("alex jones") || combined.includes("infowars") || combined.includes("alex")) {
    return "alexjones";
  }
  if (combined.includes("live") || combined.includes("livestream") || combined.includes("transmission")) {
    return "live";
  }
  if (combined.includes("emergency") || combined.includes("alert") || combined.includes("scte-35")) {
    return "emergency";
  }
  if (combined.includes("highlight") || combined.includes("clip") || combined.includes("briefing")) {
    return "daily";
  }
  if (combined.includes("special") || combined.includes("report") || combined.includes("exclusive") || combined.includes("interview")) {
    return "special";
  }
  if (combined.includes("audio") || combined.includes("podcast") || combined.includes("radio") || combined.includes("mp3") || combined.includes("sound")) {
    return "audio";
  }
  if (combined.includes("archive") || combined.includes("classic") || combined.includes("retro") || combined.includes("old") || combined.includes("history")) {
    return "archive";
  }
  return "archive";
};

const getArchiveThumbnail = (id: string = ""): string => {
  const fileNames = [
    "warroom.png",
    "gettyimages-1796841914.webp",
    "liberty%20moonlight.png",
    "emegency.png",
    "old-tv-television-empty-screen-2-cover.jpg",
    "web%20app1.png"
  ];
  let hash = 0;
  const safeId = id || "";
  for (let i = 0; i < safeId.length; i++) {
    hash = safeId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % fileNames.length;
  return `https://archive.org/download/daily-highlights/${fileNames[index]}`;
};

const PlaceCardComponent: React.FC<PlaceCardProps> = ({
  slotNumber,
  item,
  onDropItem,
  onPlay,
  onSelect,
  onConflictResolve
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConflictPopover, setShowConflictPopover] = useState(false);
  const [preferredUrl, setPreferredUrl] = useState<string>("");
  const [isIntersecting, setIsIntersecting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [resizeMode, setResizeMode] = useState<string>("cover");

  useEffect(() => {
    const updateResizeMode = () => {
      const saved = safeLocalStorage.getItem("placecard_resize_mode") || "cover";
      setResizeMode(saved);
    };
    updateResizeMode();
    window.addEventListener("placecard-settings-updated", updateResizeMode);
    return () => {
      window.removeEventListener("placecard-settings-updated", updateResizeMode);
    };
  }, []);

  // Generate deterministic file count (between 1 and 24 files)
  const getFileCount = (): number => {
    if (!item) return 0;
    if (item.fileCount !== undefined) {
      return item.fileCount;
    }
    if (item.files && item.files.length > 0) {
      return item.files.length;
    }
    const safeId = item.id || "";
    let hash = 0;
    for (let i = 0; i < safeId.length; i++) {
      hash = safeId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 24) + 1;
  };

  const fileCount = getFileCount();

  // Viewport Virtualization Observer setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { rootMargin: "150px" } // Load slightly early for seamless UX
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (item) {
      setPreferredUrl(safeLocalStorage.getItem(`pref_source_${item.id}`) || item.url);
    } else {
      setPreferredUrl("");
    }
  }, [item]);

  const handleDragStart = (e: React.DragEvent) => {
    if (!item) return;
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = e.dataTransfer.getData("application/json");
      if (data) {
        const droppedItem: ContentItem = JSON.parse(data);
        onDropItem(droppedItem, slotNumber);
      }
    } catch (err) {
      console.error("[PlaceCard] Drop parsing failed:", err);
    }
  };

  const handleChooseSource = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item) return;
    safeLocalStorage.setItem(`pref_source_${item.id}`, url);
    setPreferredUrl(url);
    if (onConflictResolve) {
      onConflictResolve(item.id, url);
    }
  };

  // Determine current active source badge text
  const getSourceBadgeLabel = () => {
    if (!item) return "";
    if (preferredUrl === item.url) return "Primary";
    if (preferredUrl === item.backupUrl) return "Backup Server";
    if (item.conflictSources) {
      const match = item.conflictSources.find(cs => cs.url === preferredUrl);
      if (match) return match.name;
    }
    return "Custom Pipeline";
  };

  const itemType = item ? getItemType(item) : "archive";
  const cardData = (thumbnails.types as any)[itemType] || thumbnails.types.archive;
  const initialThumbnail = item ? (item.thumbnailUrl || cardData.thumbnail || getArchiveThumbnail(item.id)) : "";

  return (
    <div
      ref={cardRef}
      className={`relative ${styles.cardContainer} ${isDragOver ? styles.dragOver : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      draggable={!!item && isIntersecting}
      onDragStart={handleDragStart}
      onClick={() => item && onSelect && onSelect(item)}
      onMouseEnter={() => item?.hasConflict && isIntersecting && setShowConflictPopover(true)}
      onMouseLeave={() => setShowConflictPopover(false)}
    >
      {/* SLOT HEADER (Always visible to maintain structure & layout) */}
      <div className={styles.slotHeader}>
        <span className={styles.slotBadge}>SLOT #{slotNumber < 10 ? `0${slotNumber}` : slotNumber}</span>
        {item && isIntersecting && (
          <div className="flex gap-1 items-center shrink-0">
            {item.hasConflict && (
              <span className="text-[11px] font-mono font-extrabold bg-red-600/10 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>Conflict</span>
              </span>
            )}
            <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/50 shrink-0">
              {item.mediaType || "VOD"}
            </span>
          </div>
        )}
      </div>

      {/* VIRTUALIZED INNER CONTENT */}
      {!isIntersecting ? (
        <div className="flex-1 flex flex-col justify-center items-center bg-slate-950/30 text-[11px] font-mono text-slate-700">
          <span className="animate-pulse">LOADING SLOT VIRTUALIZATION...</span>
        </div>
      ) : item ? (
        <div className="flex-1 p-3 flex flex-col justify-between relative group cursor-pointer overflow-hidden min-h-[180px]">
          {/* Thumbnail backdrop area structured exactly to match CSS selector 3 */}
          <div className="absolute inset-0 w-full h-full">
            <div className="w-full h-full relative">
              <img
                src={initialThumbnail}
                alt={cardData.name || cleanTitle(item.title)}
                referrerPolicy="no-referrer"
                className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                style={{
                  objectFit: (resizeMode as any) || "cover"
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = thumbnails.settings.fallbackImage || "https://archive.org/download/daily-highlights/liberty%20moonlight.png";
                }}
              />
              {/* GRADIENT SHADOWS OVER THUMBNAIL */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-10" />
              {/* Dynamic Type Icon Badge */}
              {cardData.icon && (
                <div 
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg z-20 font-sans select-none border border-white/15 cursor-help transform group-hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: cardData.color || "#0F172A" }}
                  title={`${cardData.name}: ${cardData.description}\nUsed as dynamic Slot Backdrop.`}
                >
                  {cardData.icon}
                </div>
              )}
            </div>
          </div>

          {/* Overlaid texts and badges on top of the thumbnail */}
          <div className="relative z-20 flex flex-col justify-end h-full flex-1 mt-auto pointer-events-auto">
            {/* Overtop of thumbnail: display files count badge */}
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-mono font-black text-emerald-400 bg-slate-950/95 px-2 py-0.5 rounded border border-emerald-500/20 shadow">
                {fileCount} {fileCount === 1 ? "FILE" : "FILES"}
              </span>
            </div>

            <h4 className="text-white text-xs font-sans font-extrabold leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors drop-shadow">
              {cleanTitle(item.title)}
            </h4>
            <p className="text-[11px] font-mono text-slate-300 truncate mt-0.5 opacity-90 drop-shadow" title={preferredUrl || item.url}>
              {item.groupTitle || preferredUrl || item.url}
            </p>

            {/* Image Details Metadata Tooltip Overlay */}
            <div className="text-[11px] font-mono text-indigo-300 bg-slate-950/95 p-1 rounded border border-indigo-500/20 max-h-0 opacity-0 group-hover:max-h-16 group-hover:opacity-100 group-hover:mt-1.5 transition-all duration-300 overflow-hidden shrink-0">
              <div className="font-black text-white uppercase text-[10px] flex justify-between items-center mb-0.5">
                <span>🖼️ Poster Metadata:</span>
                <span className="text-emerald-400">Fit: {resizeMode}</span>
              </div>
              <div className="text-slate-300 truncate">{cardData.description}</div>
              <div className="text-[10px] text-slate-500 truncate">Placed in: Slot Backdrop #{slotNumber}</div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60">
              {/* Dynamic Source Badge */}
              <span className="text-[11px] font-mono text-emerald-400 bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-900 truncate max-w-[100px]" title={getSourceBadgeLabel()}>
                Src: {getSourceBadgeLabel()}
              </span>
              {onPlay && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const playItem = { ...item, url: preferredUrl || item.url };
                    onPlay(playItem);
                  }}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-mono font-extrabold text-xs rounded uppercase tracking-wider shadow transition group-hover:scale-105 cursor-pointer"
                >
                  ▶ PLAY
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptySlot}>
          <span>+ DROP CONTENT</span>
        </div>
      )}

      {/* CONFLICT RESOLUTION HOVER POPOVER */}
      {showConflictPopover && isIntersecting && item && item.conflictSources && item.conflictSources.length > 0 && (
        <div className="absolute top-12 left-2 right-2 bg-[#090f1d] border border-red-500/40 rounded-xl shadow-2xl z-50 p-3 flex flex-col gap-2.5 animate-fade-in text-left">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
            <Sliders className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-[10px] font-mono font-extrabold text-white uppercase tracking-wider">
              Conflict resolution
            </span>
          </div>
          
          <div className="space-y-1.5 overflow-y-auto max-h-[140px] pr-0.5">
            {/* Primary Source option */}
            <button
              onClick={(e) => handleChooseSource(item.url, e)}
              className={`w-full text-left p-2 rounded-xl border text-[10px] font-mono flex flex-col gap-0.5 transition-all ${
                preferredUrl === item.url
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                  : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-[9px] uppercase text-emerald-400">★ Primary Server</span>
                {preferredUrl === item.url && <Check className="w-3 h-3 text-emerald-400" />}
              </div>
              <span className="truncate break-all">{item.url}</span>
            </button>

            {/* Alternative/Conflict sources */}
            {item.conflictSources.map((cs) => {
              const isSelected = preferredUrl === cs.url;
              return (
                <button
                  key={cs.id}
                  onClick={(e) => handleChooseSource(cs.url, e)}
                  className={`w-full text-left p-2 rounded-xl border text-[10px] font-mono flex flex-col gap-0.5 transition-all ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-[9px] uppercase text-amber-400">Alternative Source</span>
                    {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className="font-sans font-bold text-slate-200">{cs.name}</span>
                  <span className="truncate break-all opacity-80">{cs.url}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[8px] font-mono text-slate-500 leading-tight border-t border-slate-800 pt-1.5">
            Clicking a source updates preferences in LocalStorage and re-routes playout instantly.
          </p>
        </div>
      )}
    </div>
  );
};

export const PlaceCard = memo(PlaceCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.slotNumber === nextProps.slotNumber &&
    prevProps.item === nextProps.item
  );
});
