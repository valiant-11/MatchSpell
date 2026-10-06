"use client";

import React, { forwardRef, useRef } from "react";
import { Search, X } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, leftIcon, rightIcon, error, className = "", ...props }, ref) => {
    return (
      <div className="relative w-full space-y-1">
        {label && (
          <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-[#0a0c0f] text-slate-100 placeholder-slate-500 border rounded-lg py-2 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#d8b57a] disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : "pl-3"
            } ${rightIcon ? "pr-9" : "pr-3"} ${
              error ? "border-rose-500 focus:border-rose-500" : "border-white/10 focus:border-[#d8b57a]"
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-[10px] text-rose-400 mt-1 block">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface SearchInputProps extends Omit<InputProps, "leftIcon" | "rightIcon"> {
  onClear?: () => void;
  showHotkey?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, showHotkey = true, placeholder = "Search...", className = "", ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-[#0a0c0f] text-slate-100 placeholder-slate-500 border border-white/10 focus:border-[#d8b57a] rounded-lg pl-9 pr-14 py-2 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#d8b57a] ${className}`}
          {...props}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Clear search input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {showHotkey && !value && (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-[#12151a] text-[10px] font-mono text-[#d8b57a] select-none pointer-events-none shadow-xs">
              /
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
