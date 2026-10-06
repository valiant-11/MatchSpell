"use client";

import React, { createContext, useContext } from "react";

interface TabsContextType {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className = "" }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={`space-y-4 ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1.5 p-1 rounded-xl bg-[#0d111a] border border-[#1e283d] overflow-x-auto ${className}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className = "",
  badge,
  icon,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");

  const isSelected = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => ctx.onChange(value)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 whitespace-nowrap ${
        isSelected
          ? "bg-[#1a2234] text-white border border-[#2e3d5c] shadow-sm"
          : "text-slate-400 hover:text-slate-200 hover:bg-[#131926] border border-transparent"
      } ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");

  if (ctx.value !== value) return null;

  return (
    <div role="tabpanel" className={`animate-in fade-in-50 duration-150 ${className}`}>
      {children}
    </div>
  );
}
