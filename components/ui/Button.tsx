"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "gold-outline";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      iconOnly = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b57a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c0f] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed";

    const variantStyles = {
      primary:
        "bg-[#b3261e] hover:bg-[#c92f25] text-white shadow-md shadow-red-950/50 border border-red-500/30",
      secondary:
        "bg-[#1a1e25] hover:bg-[#222731] text-slate-200 border border-white/10 shadow-sm",
      outline:
        "bg-transparent hover:bg-[#1a1e25] text-slate-300 hover:text-white border border-white/10 hover:border-white/20",
      "gold-outline":
        "bg-transparent hover:bg-[#d8b57a]/10 text-[#d8b57a] border border-[#d8b57a]/50 hover:border-[#d8b57a] shadow-sm shadow-[#d8b57a]/10",
      ghost:
        "bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-100 border border-transparent",
      danger:
        "bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 shadow-sm",
    }[variant];

    const sizeStyles = iconOnly
      ? {
          xs: "w-6 h-6 p-0 text-xs",
          sm: "w-7 h-7 p-0 text-xs",
          md: "w-9 h-9 p-0 text-sm",
          lg: "w-11 h-11 p-0 text-base",
        }[size]
      : {
          xs: "px-2 py-1 text-[11px] gap-1",
          sm: "px-2.5 py-1.5 text-xs gap-1.5",
          md: "px-3.5 py-2 text-xs gap-2",
          lg: "px-5 py-2.5 text-sm gap-2.5",
        }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
