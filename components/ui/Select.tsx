"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", children, ...props }, ref) => {
    return (
      <div className="relative w-full space-y-1">
        {label && (
          <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`w-full appearance-none bg-[#0d111a] text-slate-200 border rounded-lg pl-3 pr-8 py-2 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              error ? "border-rose-500 focus:border-rose-500" : "border-[#1e283d] focus:border-sky-500"
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
        {error && <span className="text-[10px] text-rose-400 mt-1 block">{error}</span>}
      </div>
    );
  }
);

Select.displayName = "Select";
