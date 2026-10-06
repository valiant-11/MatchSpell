"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Hero, PrimaryAttr, AttackType, RolePosition, ComfortLevel, HeroAbility } from "@/lib/types";
import { ALL_HEROES } from "@/lib/heroes";
import { getHeroRoleFit } from "@/lib/roles";
import { AttributeIcon } from "./icons/AttributeIcon";
import { RoleIcon, ROLE_THEME } from "./icons/RoleIcon";
import { SearchInput, Button, Badge, Toggle, Kbd } from "./ui";
import { prefersReducedMotion } from "@/lib/motion";
import traitsData from "@/data/traits.json";
import matchupsData from "@/data/matchups.json";
import heroAbilitiesData from "@/data/hero-abilities.json";
import {
  Sparkles,
  Sword,
  Target,
  Check,
  Ban,
  Shield,
  Zap,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

// Dota 2 Hero Complexity Map (1 = simple, 2 = intermediate, 3 = complex)
const COMPLEXITY_MAP: Record<string, 1 | 2 | 3> = {
  // 3-star complexity
  invoker: 3, meepo: 3, chen: 3, earth_spirit: 3, morphling: 3,
  visage: 3, brewmaster: 3, lone_druid: 3, arc_warden: 3, tinker: 3,
  io: 3, elder_titan: 3, ember_spirit: 3, storm_spirit: 3, void_spirit: 3,
  // 1-star complexity
  wraith_king: 1, sniper: 1, viper: 1, phantom_assassin: 1, dragon_knight: 1,
  crystal_maiden: 1, ogre_magi: 1, tidehunter: 1, bristleback: 1, drow_ranger: 1,
  juggernaut: 1, axe: 1, sven: 1, lich: 1, lion: 1, shadow_shaman: 1,
  ursa: 1, bloodseeker: 1, spirit_breaker: 1, razor: 1, riki: 1,
};

function getHeroComplexity(name: string): 1 | 2 | 3 {
  const clean = name.replace("npc_dota_hero_", "");
  return COMPLEXITY_MAP[clean] || 2;
}

export interface HeroPickerProps {
  mode: "pool" | "enemy" | "ally";
  role?: RolePosition;
  onPickHero?: (hero: Hero) => void;
  onTogglePoolHero?: (heroId: number) => void;
  onSetComfort?: (heroId: number, comfort: ComfortLevel) => void;
  rolePool?: Record<number, { inPool: boolean; comfort: ComfortLevel }>;
  selectedHeroIds?: number[];
  enemyHeroIds?: number[];
  className?: string;
}

export function HeroPicker({
  mode,
  role = 2,
  onPickHero,
  onTogglePoolHero,
  onSetComfort,
  rolePool = {},
  selectedHeroIds = [],
  enemyHeroIds = [],
  className = "",
}: HeroPickerProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [attackFilter, setAttackFilter] = useState<AttackType | "all">("all");
  const [complexityFilter, setComplexityFilter] = useState<number | "all">("all");
  const [selectedRoleTag, setSelectedRoleTag] = useState<string | "all">("all");
  const [onlyViableInRole, setOnlyViableInRole] = useState(false);
  const [onlyInPool, setOnlyInPool] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "role_fit" | "delta">("name");

  // Hover preview state
  const [hoveredHero, setHoveredHero] = useState<Hero | null>(null);
  const [activeVideoHeroId, setActiveVideoHeroId] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverIntentTimer = useRef<NodeJS.Timeout | null>(null);

  // Keyboard navigation index across visible heroes
  const [focusedHeroId, setFocusedHeroId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const traitsMap = traitsData as Record<string, { tags: string[]; dmgType: string }>;
  const matchups = matchupsData as Record<string, Record<string, { delta: number }>>;
  const abilitiesMap = heroAbilitiesData as Record<string, HeroAbility[]>;

  // Hotkey: '/' focuses search, ESC clears
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "Escape") {
        if (search) {
          setSearch("");
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [search]);

  // Compute live matchup delta vs enemy lineup if enemies exist
  const heroDeltas = useMemo(() => {
    const deltas: Record<number, number> = {};
    if (enemyHeroIds.length === 0) return deltas;

    for (const hero of ALL_HEROES) {
      const heroMatchup = matchups[String(hero.id)];
      if (!heroMatchup) continue;

      let sumDelta = 0;
      let count = 0;
      for (const enemyId of enemyHeroIds) {
        const m = heroMatchup[String(enemyId)];
        if (m && typeof m.delta === "number") {
          sumDelta += m.delta;
          count++;
        }
      }
      if (count > 0) {
        deltas[hero.id] = sumDelta / count;
      }
    }
    return deltas;
  }, [enemyHeroIds, matchups]);

  // Filter & sort heroes
  const filteredHeroes = useMemo(() => {
    return ALL_HEROES.filter((hero) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = hero.localized_name.toLowerCase().includes(q);
        const matchesInternal = hero.name.toLowerCase().includes(q);
        if (!matchesName && !matchesInternal) return false;
      }

      // Attack type
      if (attackFilter !== "all" && hero.attack_type !== attackFilter) {
        return false;
      }

      // Complexity
      if (complexityFilter !== "all" && getHeroComplexity(hero.name) !== complexityFilter) {
        return false;
      }

      // Role tag
      if (selectedRoleTag !== "all" && !hero.roles.includes(selectedRoleTag)) {
        return false;
      }

      // Role viability
      if (onlyViableInRole) {
        const fit = getHeroRoleFit(hero.id);
        const score = fit?.roles[role] || 0;
        if (score < 0.15) return false;
      }

      // Only in pool filter
      if (onlyInPool && mode === "pool") {
        if (!rolePool[hero.id]?.inPool) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "role_fit") {
        const fitA = getHeroRoleFit(a.id)?.roles[role] || 0;
        const fitB = getHeroRoleFit(b.id)?.roles[role] || 0;
        return fitB - fitA;
      }
      if (sortBy === "delta" && enemyHeroIds.length > 0) {
        const deltaA = heroDeltas[a.id] ?? -999;
        const deltaB = heroDeltas[b.id] ?? -999;
        return deltaB - deltaA;
      }
      return a.localized_name.localeCompare(b.localized_name);
    });
  }, [
    search,
    attackFilter,
    complexityFilter,
    selectedRoleTag,
    onlyViableInRole,
    onlyInPool,
    sortBy,
    role,
    mode,
    rolePool,
    enemyHeroIds,
    heroDeltas,
  ]);

  // Group heroes into the 4 Dota client attribute categories
  const groupedHeroes = useMemo(() => {
    return {
      str: filteredHeroes.filter((h) => h.primary_attr === "str"),
      agi: filteredHeroes.filter((h) => h.primary_attr === "agi"),
      int: filteredHeroes.filter((h) => h.primary_attr === "int"),
      all: filteredHeroes.filter((h) => h.primary_attr === "all"),
    };
  }, [filteredHeroes]);

  // Mouse hover handlers with 120ms hover-intent delay
  const handleMouseEnter = useCallback((hero: Hero, e?: React.MouseEvent) => {
    if (e) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
    setHoveredHero(hero);
    if (hoverIntentTimer.current) clearTimeout(hoverIntentTimer.current);

    // Load full-size video in the inspect popup window
    if (!prefersReducedMotion()) {
      hoverIntentTimer.current = setTimeout(() => {
        setActiveVideoHeroId(hero.id);
      }, 120);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverIntentTimer.current) clearTimeout(hoverIntentTimer.current);
    setHoveredHero(null);
    setActiveVideoHeroId(null);
  }, []);

  // Click action depending on mode
  const handleTileClick = useCallback(
    (hero: Hero) => {
      if (mode === "pool") {
        onTogglePoolHero?.(hero.id);
      } else {
        if (!selectedHeroIds.includes(hero.id)) {
          onPickHero?.(hero);
        }
      }
    },
    [mode, onTogglePoolHero, onPickHero, selectedHeroIds]
  );

  const handleCycleComfort = useCallback(
    (e: React.MouseEvent, heroId: number) => {
      e.stopPropagation();
      const current = rolePool[heroId]?.comfort || 2;
      const next: ComfortLevel = current === 1 ? 2 : current === 2 ? 3 : 1;
      onSetComfort?.(heroId, next);
    },
    [rolePool, onSetComfort]
  );

  const previewHero = hoveredHero || (focusedHeroId ? ALL_HEROES.find((h) => h.id === focusedHeroId) : null);
  const previewTraits = previewHero ? traitsMap[String(previewHero.id)] : null;
  const previewFit = previewHero ? getHeroRoleFit(previewHero.id) : null;
  const previewAbilities = previewHero ? abilitiesMap[String(previewHero.id)] || [] : [];
  const previewCleanName = previewHero ? previewHero.name.replace("npc_dota_hero_", "") : "";

  // Dynamic viewport-clamped popup coordinates
  const popupStyle = useMemo<React.CSSProperties>(() => {
    if (!previewHero) {
      return { display: "none" };
    }

    const width = 400;
    const height = 660;
    const padding = 16;

    if (typeof window === "undefined" || (mousePos.x === 0 && mousePos.y === 0)) {
      return {
        position: "fixed",
        right: "24px",
        bottom: "24px",
        zIndex: 100,
        pointerEvents: "none",
      };
    }

    let left = mousePos.x + 24;
    let top = mousePos.y - 120;

    // Flip to left if overflowing viewport right edge
    if (left + width > window.innerWidth - padding) {
      left = mousePos.x - width - 24;
    }
    if (left < padding) {
      left = padding;
    }

    // Clamp top to viewport
    if (top + height > window.innerHeight - padding) {
      top = window.innerHeight - height - padding;
    }
    if (top < padding) {
      top = padding;
    }

    return {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 100,
      pointerEvents: "none",
    };
  }, [mousePos, previewHero]);

  const ATTR_SECTIONS: { attr: PrimaryAttr; label: string; color: string; border: string; glow: string }[] = [
    {
      attr: "str",
      label: "Strength",
      color: "text-[#ec3d06]",
      border: "border-[#ec3d06]/30",
      glow: "hover:border-[#ec3d06] hover:shadow-[0_0_14px_rgba(236,61,6,0.35)]",
    },
    {
      attr: "agi",
      label: "Agility",
      color: "text-[#26e030]",
      border: "border-[#26e030]/30",
      glow: "hover:border-[#26e030] hover:shadow-[0_0_14px_rgba(38,224,48,0.35)]",
    },
    {
      attr: "int",
      label: "Intelligence",
      color: "text-[#00d9ff]",
      border: "border-[#00d9ff]/30",
      glow: "hover:border-[#00d9ff] hover:shadow-[0_0_14px_rgba(0,217,255,0.35)]",
    },
    {
      attr: "all",
      label: "Universal",
      color: "text-[#d8b57a]",
      border: "border-[#d8b57a]/30",
      glow: "hover:border-[#d8b57a] hover:shadow-[0_0_14px_rgba(216,181,122,0.35)]",
    },
  ];

  return (
    <div
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      className={`space-y-3.5 select-none relative ${className}`}
    >
      {/* 1. Sticky Dota-style Filter Toolbar */}
      <div className="sticky top-0 z-40 bg-[#0a0c0f]/95 backdrop-blur-md p-2.5 rounded-xl border border-white/10 shadow-lg space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="w-full sm:w-64">
            <SearchInput
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search heroes (press /)..."
            />
          </div>

          {/* Attack Type Filter */}
          <div className="flex items-center gap-1 rounded-lg bg-[#12151a] p-0.5 border border-white/10 text-xs">
            {(["all", "Melee", "Ranged"] as const).map((atk) => (
              <button
                key={atk}
                type="button"
                onClick={() => setAttackFilter(atk)}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-colors cursor-pointer ${
                  attackFilter === atk
                    ? "bg-[#1a1e25] text-[#d8b57a] border border-[#d8b57a]/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {atk === "all" ? "All Attacks" : atk}
              </button>
            ))}
          </div>

          {/* Complexity Filter (1-3 Diamonds) */}
          <div className="flex items-center gap-1 rounded-lg bg-[#12151a] p-0.5 border border-white/10 text-xs">
            <span className="text-[10px] text-slate-500 font-bold px-1.5 uppercase tracking-wider">Comp:</span>
            {(["all", 1, 2, 3] as const).map((comp) => (
              <button
                key={String(comp)}
                type="button"
                onClick={() => setComplexityFilter(comp)}
                className={`px-2 py-1 rounded font-mono font-bold text-[11px] transition-colors cursor-pointer ${
                  complexityFilter === comp
                    ? "bg-[#1a1e25] text-[#d8b57a] border border-[#d8b57a]/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {comp === "all" ? "All" : "◆".repeat(comp)}
              </button>
            ))}
          </div>

          {/* Role Viability & Pool Toggles */}
          <div className="flex items-center gap-2">
            <Toggle
              checked={onlyViableInRole}
              onChange={setOnlyViableInRole}
              label={`Viable in Role`}
              size="sm"
            />
            {mode === "pool" && (
              <Toggle
                checked={onlyInPool}
                onChange={setOnlyInPool}
                label="In My Pool"
                size="sm"
              />
            )}
          </div>
        </div>

        {/* Roles Pills Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1">
            Roles:
          </span>
          {[
            "all",
            "Carry",
            "Support",
            "Nuker",
            "Disabler",
            "Durable",
            "Escape",
            "Pusher",
            "Initiator",
          ].map((rTag) => (
            <button
              key={rTag}
              type="button"
              onClick={() => setSelectedRoleTag(rTag)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors shrink-0 cursor-pointer ${
                selectedRoleTag === rTag
                  ? "bg-[#d8b57a] text-slate-950 shadow-xs"
                  : "bg-[#12151a] hover:bg-[#1a1e25] text-slate-400 hover:text-slate-200 border border-white/5"
              }`}
            >
              {rTag === "all" ? "All Roles" : rTag}
            </button>
          ))}

          {/* Counter Badge */}
          <div className="ml-auto text-[11px] font-mono text-slate-400 shrink-0">
            {filteredHeroes.length} / {ALL_HEROES.length} Heroes
          </div>
        </div>
      </div>

      {/* 2. Main Attribute Grid Columns (Replicating Dota Heroes Tab) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {ATTR_SECTIONS.map(({ attr, label, color, border, glow }) => {
          const heroes = groupedHeroes[attr];

          return (
            <div
              key={attr}
              className="rounded-xl bg-[#12151a]/80 border border-white/10 p-2.5 flex flex-col space-y-2 shadow-inner"
            >
              {/* Attribute Section Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <AttributeIcon attr={attr} size={16} />
                  <span className={`text-xs font-bold uppercase tracking-wider font-dota ${color}`}>
                    {label}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400 px-1.5 py-0.2 rounded bg-black/40 border border-white/5">
                  {heroes.length}
                </span>
              </div>

              {/* 16:9 Hero Tiles Tight Grid */}
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-1.5 pt-0.5">
                {heroes.map((hero) => {
                  const isPicked = selectedHeroIds.includes(hero.id);
                  const isPoolSelected = mode === "pool" && !!rolePool[hero.id]?.inPool;
                  const comfort = rolePool[hero.id]?.comfort || 2;
                  const cleanName = hero.name.replace("npc_dota_hero_", "");
                  const isHovered = hoveredHero?.id === hero.id;
                  const isVideoPlaying = activeVideoHeroId === hero.id;
                  const heroDelta = heroDeltas[hero.id];

                  return (
                    <div
                      key={hero.id}
                      tabIndex={0}
                      onClick={() => handleTileClick(hero)}
                      onMouseEnter={(e) => handleMouseEnter(hero, e)}
                      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={handleMouseLeave}
                      onFocus={() => {
                        setFocusedHeroId(hero.id);
                        handleMouseEnter(hero);
                      }}
                      onBlur={handleMouseLeave}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTileClick(hero);
                        }
                      }}
                      className={`group relative aspect-[16/9] rounded overflow-hidden cursor-pointer transition-all duration-150 select-none border ${
                        isPicked
                          ? "border-white/5 opacity-30 grayscale cursor-not-allowed"
                          : isPoolSelected
                          ? "border-[#d8b57a] shadow-[0_0_12px_rgba(216,181,122,0.4)]"
                          : `border-white/10 ${glow} hover:scale-[1.06] hover:z-30`
                      } bg-[#0a0c0f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b57a]`}
                    >
                      {/* Static Portrait Image */}
                      <Image
                        src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${cleanName}.png`}
                        alt={hero.localized_name}
                        fill
                        sizes="(max-width: 768px) 33vw, 25vw"
                        className="object-cover pointer-events-none"
                        loading="lazy"
                      />

                      {/* Picked Overlay Badge */}
                      {isPicked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
                          <Ban className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}

                      {/* Pool Mode Selection Check Indicator */}
                      {isPoolSelected && (
                        <div className="absolute top-0.5 right-0.5 z-20 bg-[#d8b57a] text-slate-950 p-0.5 rounded-xs shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Pool Mode Comfort Level Pips (1-3) */}
                      {isPoolSelected && (
                        <button
                          type="button"
                          onClick={(e) => handleCycleComfort(e, hero.id)}
                          title={`Comfort Level: ${comfort}/3 (Click to cycle)`}
                          className="absolute bottom-0.5 right-0.5 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/80 border border-white/20 hover:border-[#d8b57a]"
                        >
                          {[1, 2, 3].map((star) => (
                            <span
                              key={star}
                              className={`w-1.5 h-1.5 rounded-full ${
                                star <= comfort ? "bg-[#d8b57a]" : "bg-slate-700"
                              }`}
                            />
                          ))}
                        </button>
                      )}

                      {/* Hover Sliding Nameplate */}
                      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-1 translate-y-full group-hover:translate-y-0 transition-transform duration-150 pointer-events-none">
                        <span className="block text-[10px] font-bold text-white truncate leading-tight">
                          {hero.localized_name}
                        </span>
                        {typeof heroDelta === "number" && (
                          <span
                            className={`block text-[9px] font-mono font-bold ${
                              heroDelta >= 0 ? "text-[#4fbf6b]" : "text-[#e05050]"
                            }`}
                          >
                            {heroDelta >= 0 ? `+${(heroDelta * 100).toFixed(1)}%` : `${(heroDelta * 100).toFixed(1)}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Big Pop-Up Window for Hovered Hero (Cinematic Dota 2 Inspect Card) */}
      {previewHero && (
        <div
          style={popupStyle}
          className="fixed z-50 pointer-events-none w-[400px] max-w-[92vw] rounded-2xl bg-[#0c0f14]/95 backdrop-blur-2xl border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-150 animate-in fade-in zoom-in-95"
        >
          {/* Large Hero Portrait & High-Res Video Render Banner with Expanded Height for Standing Heroes */}
          <div className="relative w-full h-[300px] min-h-[300px] bg-[#07090c] overflow-hidden border-b border-white/10">
            {/* Full-Bleed Hero Portrait Background - Filling the Whole Cinematic Showcase */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
              <Image
                src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${previewCleanName}.png`}
                alt={previewHero.localized_name}
                fill
                sizes="420px"
                className={`object-cover object-center transition-all duration-300 ${
                  activeVideoHeroId === previewHero.id
                    ? "blur-2xl opacity-30 scale-125"
                    : "scale-105 opacity-100"
                }`}
                priority
              />
              {/* Darkening & Atmospheric Gradient Overlay so text and badges pop */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f14] via-[#0c0f14]/40 to-black/50" />
              <div className="absolute inset-0 bg-black/20 backdrop-brightness-95" />
            </div>

            {/* High-res WebM Animated Render - 1440x1440 fitted cleanly in foreground without clipping head/feet */}
            {activeVideoHeroId === previewHero.id && (
              <div className="relative w-full h-full z-15 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
                <video
                  key={previewHero.id}
                  src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${previewCleanName}.webm`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="none"
                  className="absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none drop-shadow-[0_16px_32px_rgba(0,0,0,0.95)]"
                />
              </div>
            )}

            {/* Atmospheric Attribute Gradient Lighting */}
            <div
              className="absolute inset-0 z-20 pointer-events-none opacity-50 mix-blend-screen"
              style={{
                background:
                  previewHero.primary_attr === "str"
                    ? "radial-gradient(circle at 50% 35%, rgba(236,61,6,0.65) 0%, transparent 70%)"
                    : previewHero.primary_attr === "agi"
                    ? "radial-gradient(circle at 50% 35%, rgba(38,224,48,0.65) 0%, transparent 70%)"
                    : previewHero.primary_attr === "int"
                    ? "radial-gradient(circle at 50% 35%, rgba(0,217,255,0.65) 0%, transparent 70%)"
                    : "radial-gradient(circle at 50% 35%, rgba(216,181,122,0.65) 0%, transparent 70%)",
              }}
            />
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#0c0f14] via-transparent to-black/35 pointer-events-none" />

            {/* Top Badges: Attribute & Attack Type */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-black/80 backdrop-blur-md border font-dota shadow-lg ${
                  previewHero.primary_attr === "str"
                    ? "text-[#ec3d06] border-[#ec3d06]/50 shadow-[0_0_12px_rgba(236,61,6,0.35)]"
                    : previewHero.primary_attr === "agi"
                    ? "text-[#26e030] border-[#26e030]/50 shadow-[0_0_12px_rgba(38,224,48,0.35)]"
                    : previewHero.primary_attr === "int"
                    ? "text-[#00d9ff] border-[#00d9ff]/50 shadow-[0_0_12px_rgba(0,217,255,0.35)]"
                    : "text-[#d8b57a] border-[#d8b57a]/50 shadow-[0_0_12px_rgba(216,181,122,0.35)]"
                }`}
              >
                <AttributeIcon attr={previewHero.primary_attr} size={15} />
                <span>
                  {previewHero.primary_attr === "str"
                    ? "Strength"
                    : previewHero.primary_attr === "agi"
                    ? "Agility"
                    : previewHero.primary_attr === "int"
                    ? "Intelligence"
                    : "Universal"}
                </span>
              </span>

              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/80 backdrop-blur-md border border-white/10 text-slate-200">
                {previewHero.attack_type === "Melee" ? (
                  <Sword className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Target className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>{previewHero.attack_type}</span>
              </span>
            </div>

            {/* Top-Right Complexity Diamonds */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-0.5">COMPLEXITY</span>
              {[1, 2, 3].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${
                    star <= getHeroComplexity(previewHero.name) ? "text-[#d8b57a]" : "text-slate-600"
                  }`}
                >
                  ◆
                </span>
              ))}
            </div>

            {/* Bottom Overlay: Big Hero Name and Roles */}
            <div className="absolute bottom-2.5 left-3.5 right-3.5 z-30 flex items-end justify-between">
              <div>
                <h3 className="text-2xl font-black text-white font-dota tracking-wide drop-shadow-md">
                  {previewHero.localized_name}
                </h3>
                <span className="text-xs text-slate-300 font-semibold tracking-wide">
                  {previewHero.roles.slice(0, 3).join(" • ")}
                </span>
              </div>

              {previewTraits?.dmgType && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/80 border border-white/15 text-slate-300">
                  {previewTraits.dmgType} dmg
                </span>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="p-3.5 space-y-3 bg-[#0c0f14]">
            {/* Hero Abilities Kit */}
            {previewAbilities.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-[#d8b57a]" />
                    Abilities ({previewAbilities.length})
                  </span>
                  <span className="text-[9px] text-[#d8b57a] font-mono">Hero Kit</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {previewAbilities.map((ab) => (
                    <div
                      key={ab.id}
                      className="group/ability relative shrink-0"
                      title={`${ab.name}${ab.dmg_type ? ` (${ab.dmg_type} Damage)` : ""}${ab.desc ? `\n\n${ab.desc}` : ""}`}
                    >
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20 bg-black/80 shadow-md transition-all duration-150 group-hover/ability:scale-110 group-hover/ability:border-[#d8b57a] group-hover/ability:shadow-[0_0_12px_rgba(216,181,122,0.5)]">
                        <img
                          src={ab.img}
                          alt={ab.name}
                          className="w-full h-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        {ab.dmg_type && (
                          <span
                            className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-black/80 shadow-xs ${
                              ab.dmg_type === "Magical"
                                ? "bg-sky-400"
                                : ab.dmg_type === "Pure"
                                ? "bg-amber-400"
                                : "bg-rose-500"
                            }`}
                            title={`${ab.dmg_type} Damage`}
                          />
                        )}
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/ability:flex flex-col items-center z-50 pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2.5 py-1.5 rounded-lg bg-[#07090c]/98 border border-white/25 shadow-2xl text-center max-w-[220px]">
                          <span className="text-[11px] font-bold text-white block leading-tight">
                            {ab.name}
                          </span>
                          {ab.dmg_type && (
                            <span
                              className={`text-[9px] font-mono font-bold uppercase block mt-0.5 ${
                                ab.dmg_type === "Magical"
                                  ? "text-sky-400"
                                  : ab.dmg_type === "Pure"
                                  ? "text-amber-300"
                                  : "text-rose-400"
                              }`}
                            >
                              {ab.dmg_type} Damage
                            </span>
                          )}
                        </div>
                        <div className="w-1.5 h-1.5 bg-[#07090c] border-r border-b border-white/25 rotate-45 -mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Live Draft Advantage / Disadvantage Delta Bar */}
            {typeof heroDeltas[previewHero.id] === "number" && (
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  heroDeltas[previewHero.id] >= 0
                    ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
                    : "bg-rose-950/50 border-rose-500/50 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block font-dota">
                      {heroDeltas[previewHero.id] >= 0
                        ? "Advantage vs Enemy Picks"
                        : "Disadvantage vs Enemy Picks"}
                    </span>
                    <span className="text-[10px] opacity-80">
                      Mean head-to-head matchup delta
                    </span>
                  </div>
                </div>
                <span className="text-lg font-mono font-black">
                  {heroDeltas[previewHero.id] >= 0
                    ? `+${(heroDeltas[previewHero.id] * 100).toFixed(1)}%`
                    : `${(heroDeltas[previewHero.id] * 100).toFixed(1)}%`}
                </span>
              </div>
            )}

            {/* Tactical Trait Tags */}
            {previewTraits?.tags && previewTraits.tags.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Tactical Traits:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {previewTraits.tags.slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#1a1e25] text-slate-200 border border-white/10"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pos 1-5 Suitability Grid */}
            {previewFit && (
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Pos 1-5 Lane Viability:</span>
                  <span className="text-slate-300 font-mono text-[10px]">
                    Primary: Pos {previewFit.primaryRole} ({((previewFit.roles[previewFit.primaryRole] || 0) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((pos) => {
                    const score = previewFit.roles[pos] || 0;
                    const isCurrent = pos === role;
                    return (
                      <div
                        key={pos}
                        className={`p-1 rounded text-center border ${
                          isCurrent
                            ? "border-[#d8b57a] bg-[#1a1e25]"
                            : "border-white/5 bg-black/40"
                        }`}
                      >
                        <span className="text-[9px] text-slate-400 block font-bold">Pos {pos}</span>
                        <span
                          className={`text-[11px] font-mono font-bold ${
                            score >= 0.4
                              ? "text-[#4fbf6b]"
                              : score >= 0.15
                              ? "text-amber-400"
                              : "text-slate-600"
                          }`}
                        >
                          {(score * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pool Status / Comfort hint if in pool mode */}
            {mode === "pool" && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Pool Status:{" "}
                  {rolePool[previewHero.id]?.inPool ? (
                    <span className="text-[#d8b57a] font-bold">In Your Pool</span>
                  ) : (
                    <span className="text-slate-500">Not in pool</span>
                  )}
                </span>
                <span className="text-[11px] text-[#d8b57a] font-mono">
                  Comfort: {"★".repeat(rolePool[previewHero.id]?.comfort || 2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
