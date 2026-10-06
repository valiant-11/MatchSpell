"use client";

import React from "react";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
  size = "md",
}: ToggleProps) {
  const switchSize = size === "sm" ? "w-8 h-4.5" : "w-11 h-6";
  const thumbSize = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  const translate = size === "sm" ? "translate-x-3.5" : "translate-x-5";

  return (
    <label
      className={`inline-flex items-center justify-between gap-3 cursor-pointer select-none ${
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
      } ${className}`}
    >
      {(label || description) && (
        <div className="flex-1">
          {label && <span className="text-xs font-semibold text-slate-200 block">{label}</span>}
          {description && <span className="text-[11px] text-slate-400 block mt-0.5">{description}</span>}
        </div>
      )}
      <div className="relative inline-flex items-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`${switchSize} rounded-full transition-colors duration-200 ease-in-out border ${
            checked
              ? "bg-sky-500 border-sky-400/80 shadow-xs shadow-sky-500/20"
              : "bg-[#131926] border-[#1e283d]"
          }`}
        >
          <div
            className={`${thumbSize} rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out mt-[1px] ml-[1px] ${
              checked ? translate : "translate-x-0"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
