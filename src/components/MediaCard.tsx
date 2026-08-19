/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { UnifiedMediaItem } from "../types";

export interface MediaCardProps {
  item: UnifiedMediaItem;
  layout?: "grid" | "list" | "compact" | "wall" | "gallery" | "table" | "carousel";
  onPlay: (item: UnifiedMediaItem) => void;
  onFavoriteToggle?: (item: UnifiedMediaItem) => void;
  isFavorite?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  layout = "grid",
  onPlay,
  onFavoriteToggle,
  isFavorite = false
}) => {
  const [imgError, setImgError] = useState(false);

  // Fallback image resolution pipeline
  const fallbackImg = "https://archive.org/download/daily-highlights/lmbsa.png";

  const thumbnailSrc = (!imgError && item.thumbnail) ? item.thumbnail : fallbackImg;

  if (layout === "list" || layout === "table") {
    return (
      <div 
        onClick={() => onPlay(item)}
        className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 transition-all cursor-pointer group"
      >
        <div className="w-16 h-10 rounded-xl bg-black/50 overflow-hidden shrink-0 relative flex items-center justify-center">
          <img 
            src={thumbnailSrc} 
            alt={item.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          {item.live && (
            <span className="absolute top-0.5 right-0.5 px-1 py-0.2 bg-red-600 text-white text-[8px] font-mono font-bold rounded">
              LIVE
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-sans font-medium text-slate-200 group-hover:text-blue-400 truncate transition-colors">
            {item.title}
          </h4>
          <p className="text-xs text-slate-500 font-mono truncate">
            {item.subtitle || item.provider}
          </p>
        </div>
        {item.resolution && (
          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-mono rounded">
            {item.resolution}
          </span>
        )}
        {onFavoriteToggle && (
          <button 
            onClick={(e) => { e.stopPropagation(); onFavoriteToggle(item); }}
            className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors"
          >
            {isFavorite ? "★" : "☆"}
          </button>
        )}
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div 
        onClick={() => onPlay(item)}
        className="p-2 rounded-xl bg-slate-900/50 hover:bg-blue-600/20 border border-slate-800/60 hover:border-blue-500/50 transition-all cursor-pointer truncate text-xs font-mono text-slate-300 hover:text-white flex items-center justify-between"
      >
        <span className="truncate">{item.title}</span>
        {item.live && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ml-2 animate-pulse" />}
      </div>
    );
  }

  // Default Grid / Wall / Gallery / Carousel layout
  return (
    <div 
      onClick={() => onPlay(item)}
      className="flex flex-col rounded-xl bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 overflow-hidden transition-all duration-300 cursor-pointer group shadow-lg"
    >
      <div className="aspect-video bg-[#05070a] relative overflow-hidden flex items-center justify-center">
        <img 
          src={thumbnailSrc} 
          alt={item.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
        
        <div className="absolute top-2 left-2 flex gap-1">
          {item.badges?.slice(0, 2).map((b, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-black/70 backdrop-blur text-slate-300 text-[9px] font-mono font-bold rounded">
              {b}
            </span>
          ))}
        </div>

        {item.live ? (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-mono font-bold rounded shadow animate-pulse">
            ● LIVE
          </span>
        ) : item.duration && item.duration > 0 ? (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-slate-300 text-[10px] font-mono rounded">
            {Math.floor(item.duration / 60)}m
          </span>
        ) : null}
      </div>

      <div className="p-3 flex flex-col justify-between flex-1">
        <div>
          <h3 className="text-sm font-sans font-semibold text-slate-200 group-hover:text-blue-400 line-clamp-1 transition-colors">
            {item.title}
          </h3>
          {item.subtitle && (
            <p className="text-xs text-slate-500 font-mono line-clamp-1 mt-0.5">
              {item.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
          <span className="uppercase tracking-wider">{item.provider}</span>
          {onFavoriteToggle && (
            <button 
              onClick={(e) => { e.stopPropagation(); onFavoriteToggle(item); }}
              className={`hover:scale-125 transition-transform ${isFavorite ? "text-amber-400" : "text-slate-600 hover:text-slate-400"}`}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
