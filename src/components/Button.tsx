import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "icon" | "badge";
  size?: "sm" | "md" | "lg" | "icon";
  active?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", active, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-150 ease-standard rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";
    
    const variants = {
      primary: "bg-accent text-white hover:bg-accent-2 shadow-sm hover:shadow-glow",
      secondary: "bg-surface-2 text-text-1 hover:bg-surface-3 border border-border",
      ghost: "bg-transparent text-text-2 hover:text-text-1 hover:bg-surface-2",
      icon: "bg-transparent text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-full",
      badge: "bg-surface-2 text-text-2 hover:text-text-1 text-[11px] px-2 py-[2px] uppercase tracking-wider rounded-sm font-semibold"
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-6 text-lg",
      icon: "h-10 w-10"
    };

    if (variant === "badge") {
      // Badge doesn't use standard sizing
      return (
        <button
          ref={ref}
          className={`${baseStyles} ${variants[variant]} ${className}`}
          {...props}
        />
      );
    }

    const activeStyle = active && variant === "ghost" ? "bg-surface-2 text-text-1" : "";
    const sizeStyle = sizes[variant === "icon" ? "icon" : size];

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizeStyle} ${activeStyle} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

