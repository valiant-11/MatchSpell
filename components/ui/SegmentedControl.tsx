"use client";

import React from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  ariaLabel,
}: SegmentedControlProps<T>) {
  const sizeStyles = {
    sm: "p-0.5 text-[11px]",
    md: "p-1 text-xs",
  }[size];

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-lg bg-[#0a0c0f] border border-white/10 ${sizeStyles} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d8b57a] ${
              isSelected
                ? "bg-[#1a1e25] text-[#d8b57a] shadow-sm border border-[#d8b57a]/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
