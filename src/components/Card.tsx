import React from "react";
import { Button } from "./Button";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badgeText?: string;
  badgeColor?: "live" | "warn" | "neutral";
  onActionClick?: (e: React.MouseEvent) => void;
  actionIcon?: React.ReactNode;
  aspectRatio?: "16:9" | "4:3" | "1:1";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className = "", 
    title, 
    subtitle, 
    imageUrl, 
    badgeText, 
    badgeColor = "neutral", 
    onActionClick, 
    actionIcon,
    aspectRatio = "16:9",
    ...props 
  }, ref) => {

    const ratioStyles = {
      "16:9": "aspect-video",
      "4:3": "aspect-[4/3]",
      "1:1": "aspect-square"
    };

    const badgeStyles = {
      live: "bg-live text-black",
      warn: "bg-warn text-white",
      neutral: "bg-surface-3 text-text-1 text-opacity-90"
    };

    return (
      <div 
        ref={ref}
        className={`group relative flex flex-col bg-surface-1 rounded-md overflow-hidden border border-border shadow-soft transition-all duration-150 ease-standard hover:border-accent hover:shadow-glow cursor-pointer ${className}`}
        {...props}
      >
        {/* Image Region */}
        <div className={`relative w-full ${ratioStyles[aspectRatio]} bg-surface-2 overflow-hidden`}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={title} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-3">
              <span className="opacity-50">No Image</span>
            </div>
          )}
          
          {/* Top-Right Badge */}
          {badgeText && (
            <div className="absolute top-2 right-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm ${badgeStyles[badgeColor]}`}>
                {badgeText}
              </span>
            </div>
          )}
        </div>

        {/* Content Region */}
        <div className="flex-1 p-3 flex flex-col justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text-1 line-clamp-2 leading-tight">{title}</h3>
            {subtitle && (
              <p className="text-xs text-text-3 mt-1 line-clamp-1">{subtitle}</p>
            )}
          </div>
          
          {/* Action Corner (Bottom Right alignment by flex-row reverse or similar) */}
          {actionIcon && onActionClick && (
            <div className="flex justify-end mt-2">
              <Button 
                variant="icon" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onActionClick(e);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {actionIcon}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Card.displayName = "Card";
