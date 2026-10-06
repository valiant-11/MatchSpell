"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Hero, PrimaryAttr, AttackType, RolePosition, ComfortLevel } from "@/lib/types";
import { ALL_HEROES } from "@/lib/heroes";
import { getHeroRoleFit } from "@/lib/roles";
import { AttributeIcon } from "./icons/AttributeIcon";
import { RoleIcon, ROLE_THEME } from "./icons/RoleIcon";
import { SearchInput, Button, Badge, Toggle, Kbd } from "./ui";
import { prefersReducedMotion } from "@/lib/motion";
import traitsData from "@/data/traits.json";
import matchupsData from "@/data/matchups.json";
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
  const hoverIntentTimer = useRef<NodeJS.Timeout | null>(null);

  // Keyboard navigation index across visible heroes
  const [focusedHeroId, setFocusedHeroId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const traitsMap = traitsData as Record<string, { tags: string[]; dmgType: string }>;
  const matchups = matchupsData as Record<string, Record<string, { delta: number }>>;

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

  // Mouse hover handlers with 150ms hover-intent delay
  const handleMouseEnter = useCallback((hero: Hero) => {
    setHoveredHero(hero);
    if (hoverIntentTimer.current) clearTimeout(hoverIntentTimer.current);

    // Only load video if not on touch and not reduced motion
    if (!prefersReducedMotion()) {
      hoverIntentTimer.current = setTimeout(() => {
        setActiveVideoHeroId(hero.id);
      }, 150);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverIntentTimer.current) clearTimeout(hoverIntentTimer.current);
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
    <div className={`space-y-3.5 select-none ${className}`}>
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
                      onMouseEnter={() => handleMouseEnter(hero)}
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

                      {/* Video Render Preview (created on hover after 150ms delay) */}
                      {isVideoPlaying && !isPicked && (
                        <video
                          src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${cleanName}.webm`}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="none"
                          className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
                        />
                      )}

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

      {/* 3. Floating / Inspect Preview Strip (Tactical Dota Card) */}
      {previewHero && (
        <div className="rounded-xl bg-[#12151a] border border-white/10 p-3 shadow-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-9 rounded overflow-hidden border border-white/20 shrink-0 shadow-md">
              <Image
                src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${previewHero.name.replace("npc_dota_hero_", "")}.png`}
                alt={previewHero.localized_name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white font-dota">
                  {previewHero.localized_name}
                </h4>
                <Badge variant="neutral" size="xs">
                  {previewHero.attack_type}
                </Badge>
                <span className="text-[10px] font-mono font-bold text-[#d8b57a]">
                  {"◆".repeat(getHeroComplexity(previewHero.name))}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
                <span>{previewHero.roles.join(", ")}</span>
              </div>
            </div>
          </div>

          {/* Traits & Delta */}
          <div className="flex items-center gap-2 flex-wrap">
            {traitsMap[String(previewHero.id)]?.tags?.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1a1e25] text-slate-300 border border-white/5"
              >
                #{tag}
              </span>
            ))}
            {typeof heroDeltas[previewHero.id] === "number" && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0c0f] border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400">Enemy Delta:</span>
                <span
                  className={`text-xs font-mono font-bold ${
                    heroDeltas[previewHero.id] >= 0 ? "text-[#4fbf6b]" : "text-[#e05050]"
                  }`}
                >
                  {heroDeltas[previewHero.id] >= 0
                    ? `+${(heroDeltas[previewHero.id] * 100).toFixed(1)}%`
                    : `${(heroDeltas[previewHero.id] * 100).toFixed(1)}%`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
