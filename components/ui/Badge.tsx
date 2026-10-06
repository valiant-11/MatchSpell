import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "win" | "loss" | "neutral" | "info" | "outline" | "pos1" | "pos2" | "pos3" | "pos4" | "pos5";
  size?: "xs" | "sm" | "md";
  dot?: boolean;
}

export function Badge({
  variant = "default",
  size = "sm",
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-bold tracking-wide uppercase select-none rounded-md transition-colors";

  const sizeStyles = {
    xs: "px-1.5 py-0.2 text-[9px] gap-1",
    sm: "px-2 py-0.5 text-[10px] gap-1.5",
    md: "px-2.5 py-1 text-xs gap-1.5",
  }[size];

  const variantStyles = {
    default: "bg-[#131926] text-slate-300 border border-[#1e283d]",
    win: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
    loss: "bg-rose-500/15 text-rose-400 border border-rose-500/40",
    neutral: "bg-amber-500/15 text-amber-400 border border-amber-500/40",
    info: "bg-sky-500/15 text-sky-400 border border-sky-500/40",
    outline: "bg-transparent text-slate-300 border border-[#1e283d]",
    pos1: "bg-amber-500/15 text-amber-400 border border-amber-500/40",
    pos2: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/40",
    pos3: "bg-pink-500/15 text-pink-400 border border-pink-500/40",
    pos4: "bg-purple-500/15 text-purple-400 border border-purple-500/40",
    pos5: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
  }[variant];

  const dotColors = {
    default: "bg-slate-400",
    win: "bg-emerald-400",
    loss: "bg-rose-400",
    neutral: "bg-amber-400",
    info: "bg-sky-400",
    outline: "bg-slate-400",
    pos1: "bg-amber-400",
    pos2: "bg-cyan-400",
    pos3: "bg-pink-400",
    pos4: "bg-purple-400",
    pos5: "bg-emerald-400",
  }[variant];

  return (
    <span className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`} {...props}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors} animate-pulse`} />}
      {children}
    </span>
  );
}
