import React from "react";

interface ScrollPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function ScrollPane({ children, className = "", ...props }: ScrollPaneProps) {
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto relative custom-scrollbar ${className}`} {...props}>
      {children}
    </div>
  );
}
