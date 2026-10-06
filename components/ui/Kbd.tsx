"use client";

import React from "react";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  size?: "xs" | "sm" | "md";
}

export function Kbd({ children, size = "xs", className = "", ...props }: KbdProps) {
  const sizeStyles = {
    xs: "px-1.5 py-0.5 text-[9px] min-w-[16px]",
    sm: "px-2 py-0.5 text-[10px] min-w-[20px]",
    md: "px-2.5 py-1 text-xs min-w-[24px]",
  }[size];

  return (
    <kbd
      className={`inline-flex items-center justify-center font-mono font-bold uppercase rounded bg-[#0a0c0f] text-[#d8b57a] border border-white/10 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)] select-none ${sizeStyles} ${className}`}
      {...props}
    >
      {children}
    </kbd>
  );
}
