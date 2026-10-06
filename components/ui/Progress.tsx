import React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  variant?: "primary" | "win" | "loss" | "neutral" | "info" | "purple" | "amber";
  size?: "xs" | "sm" | "md";
}

export function Progress({
  value,
  max = 100,
  variant = "primary",
  size = "sm",
  className = "",
  ...props
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeStyles = {
    xs: "h-1",
    sm: "h-1.5",
    md: "h-2.5",
  }[size];

  const variantStyles = {
    primary: "bg-sky-500",
    win: "bg-emerald-500",
    loss: "bg-rose-500",
    neutral: "bg-amber-500",
    info: "bg-cyan-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
  }[variant];

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`w-full overflow-hidden rounded-full bg-[#131926] border border-[#1e283d]/50 ${sizeStyles} ${className}`}
      {...props}
    >
      <div
        className={`h-full transition-all duration-300 ease-out rounded-full ${variantStyles}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
