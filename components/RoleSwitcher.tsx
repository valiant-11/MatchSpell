"use client";

import React, { useEffect, useRef } from "react";
import { ALL_ROLES } from "@/lib/roles";
import { RolePosition } from "@/lib/types";
import { RoleIcon, ROLE_THEME } from "./icons/RoleIcon";
import { Tooltip } from "./ui/Tooltip";
import { Kbd } from "./ui/Kbd";

export interface RoleSwitcherProps {
  selectedRole: RolePosition;
  onSelectRole: (role: RolePosition) => void;
  className?: string;
}

export function RoleSwitcher({
  selectedRole,
  onSelectRole,
  className = "",
}: RoleSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard 1-5 hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key >= "1" && e.key <= "5" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const roleNum = parseInt(e.key, 10) as RolePosition;
        onSelectRole(roleNum);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectRole]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Role Switcher (Keys 1-5)"
      className={`relative inline-flex items-center p-1 rounded-xl bg-[#0a0c0f] border border-white/10 shadow-inner ${className}`}
    >
      {ALL_ROLES.map((r) => {
        const theme = ROLE_THEME[r];
        const isSelected = selectedRole === r;

        return (
          <Tooltip
            key={r}
            content={
              <div className="flex items-center gap-1.5 font-medium">
                <span>{theme.name}</span>
                <Kbd size="xs">{r}</Kbd>
              </div>
            }
            position="bottom"
          >
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectRole(r)}
              className={`relative flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d8b57a] active:scale-95 ${
                isSelected
                  ? `${theme.bgColor} ${theme.color} border ${theme.borderColor} ${theme.glowClass} shadow-md`
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
              }`}
            >
              <RoleIcon role={r} size={18} active={isSelected} />
              <span className="hidden sm:inline font-mono tracking-tight font-bold text-[11px]">
                {theme.shortName}
              </span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
