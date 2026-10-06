"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Hero, HeroPoolEntry, ComfortLevel, RolePosition } from "@/lib/types";
import { ATTR_LABELS } from "@/lib/heroes";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import { ROLE_THEME } from "@/components/icons/RoleIcon";
import { Check, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface HeroCardProps {
  hero: Hero;
  role?: RolePosition;
  roleFitScore?: number; // 0.0 to 1.0
  isInRolePool?: boolean;
  comfort?: ComfortLevel;
  onToggleRolePool?: (heroId: number) => void;
  onSetRoleComfort?: (heroId: number, comfort: ComfortLevel) => void;
  // Legacy compatibility props
  poolEntry?: HeroPoolEntry;
  onTogglePool?: (heroId: number) => void;
  onToggleMid?: (heroId: number) => void;
  onSetComfort?: (heroId: number, comfort: ComfortLevel) => void;
  compact?: boolean;
}

export function HeroCard({
  hero,
  role,
  roleFitScore,
  isInRolePool,
  comfort: propComfort,
  onToggleRolePool,
  onSetRoleComfort,
  poolEntry,
  onTogglePool,
  onToggleMid,
  onSetComfort,
  compact = false,
}: HeroCardProps) {
  const [imgError, setImgError] = useState(false);

  // Determine pool and comfort state (role-aware first, then legacy fallback)
  const isSelected =
    isInRolePool !== undefined
      ? isInRolePool
      : !!poolEntry?.inPool;

  const currentComfort: ComfortLevel =
    propComfort !== undefined
      ? propComfort
      : poolEntry?.comfort || 2;

  const isLegacyMid = !!poolEntry?.isMid;
  const attrInfo = ATTR_LABELS[hero.primary_attr] || ATTR_LABELS.all;
  const roleTheme = role ? ROLE_THEME[role] : null;

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking directly on sub-buttons (comfort dots or mid toggle), don't trigger card toggle
    if ((e.target as HTMLElement).closest(".prevent-card-toggle")) {
      return;
    }

    if (onToggleRolePool) {
      onToggleRolePool(hero.id);
    } else if (onTogglePool) {
      onTogglePool(hero.id);
    }
  };

  const handleSetComfort = (level: ComfortLevel) => {
    if (onSetRoleComfort) {
      onSetRoleComfort(hero.id, level);
    } else if (onSetComfort) {
      onSetComfort(hero.id, level);
    }
  };

  // Border & Glow styling
  const selectedBorderClass = role
    ? role === 1
      ? "border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.25)] bg-[var(--color-raised)]"
      : role === 2
      ? "border-[#06b6d4] shadow-[0_0_12px_rgba(6,182,212,0.25)] bg-[var(--color-raised)]"
      : role === 3
      ? "border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.25)] bg-[var(--color-raised)]"
      : role === 4
      ? "border-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.25)] bg-[var(--color-raised)]"
      : "border-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.25)] bg-[var(--color-raised)]"
    : isLegacyMid
    ? "border-[#06b6d4] shadow-[0_0_12px_rgba(6,182,212,0.25)] bg-[var(--color-raised)]"
    : "border-[var(--color-accent)] shadow-[0_0_12px_rgba(59,130,246,0.2)] bg-[var(--color-raised)]";

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-lg overflow-hidden border transition-all duration-150 cursor-pointer select-none ${
        isSelected
          ? selectedBorderClass
          : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-raised)] opacity-65 hover:opacity-100"
      }`}
    >
      {/* Top Banner / Image Container */}
      <div className="relative aspect-[16/9] w-full bg-[var(--color-canvas)] overflow-hidden">
        {hero.img && !imgError ? (
          <Image
            src={hero.img}
            alt={hero.localized_name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 15vw"
            className={`object-cover object-center transition-transform duration-200 group-hover:scale-105 ${
              !isSelected ? "grayscale contrast-125" : ""
            }`}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-500 bg-[var(--color-raised)]">
            <User className="w-6 h-6 opacity-40 mb-1" />
            <span className="text-[10px] truncate max-w-[90%]">{hero.localized_name}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-canvas)] via-transparent to-transparent opacity-90 pointer-events-none" />

        {/* Selected checkmark indicator */}
        {isSelected && (
          <div className="absolute top-1.5 left-1.5 bg-[var(--color-accent)] text-white rounded p-0.5 shadow-md flex items-center justify-center">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        )}

        {/* Attribute Badge */}
        <div
          className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider backdrop-blur-sm border ${attrInfo.bg} ${attrInfo.border} ${attrInfo.color}`}
        >
          {hero.primary_attr === "all" ? "UNI" : hero.primary_attr.toUpperCase()}
        </div>

        {/* Role Fit Badge if role provided */}
        {roleFitScore !== undefined && roleFitScore > 0 && (
          <div
            className={`absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider backdrop-blur-md border ${
              roleFitScore >= 0.75
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                : roleFitScore >= 0.35
                ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                : "bg-slate-900/80 text-slate-400 border-slate-700"
            }`}
            title={`Role Fit: ${(roleFitScore * 100).toFixed(0)}%`}
          >
            {(roleFitScore * 100).toFixed(0)}% fit
          </div>
        )}

        {/* Legacy Mid Badge */}
        {!role && isLegacyMid && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow">
            MID
          </div>
        )}
      </div>

      {/* Hero Info and Controls */}
      <div className="p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1">
          <span
            className={`text-xs font-semibold tracking-wide truncate ${
              isSelected ? "text-[var(--color-text)] font-bold" : "text-[var(--color-text-muted)]"
            }`}
            title={hero.localized_name}
          >
            {hero.localized_name}
          </span>
          <span className="text-[10px] text-slate-500 shrink-0 font-mono font-bold">
            {hero.attack_type === "Melee" ? "M" : "R"}
          </span>
        </div>

        {/* Controls when in pool (or hoverable) */}
        {!compact && (
          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-[var(--color-border)] text-[11px]">
            {/* Status Text */}
            <span className="text-[10px] font-medium text-[var(--color-text-dim)]">
              {isSelected ? (
                <span className="text-[var(--color-win)] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-win)] animate-pulse" />
                  In Pool
                </span>
              ) : (
                <span className="italic hover:text-[var(--color-text-muted)]">Click to add</span>
              )}
            </span>

            {/* 3-Dot Comfort Indicator */}
            {isSelected ? (
              <div
                className="prevent-card-toggle flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--color-canvas)]/80 border border-[var(--color-border)]"
                title={`Comfort Level: ${currentComfort}/3 (Click dots to adjust)`}
              >
                {([1, 2, 3] as ComfortLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetComfort(level);
                    }}
                    aria-label={`Set comfort level ${level}`}
                    className={`w-2 h-2 rounded-full transition-all hover:scale-125 ${
                      currentComfort >= level
                        ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
                        : "bg-slate-700 hover:bg-slate-500"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
