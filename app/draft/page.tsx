"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ALL_HEROES, getHeroById } from "@/lib/heroes";
import { useUserState } from "@/lib/useUserState";
import {
  DraftMode,
  RolePosition,
  EnemyPick,
  rankCandidates,
  analyzeEnemyLane,
} from "@/lib/scoring";
import {
  ALL_ROLES,
  ROLE_DEFINITIONS,
  inferEnemyPositions,
} from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { AllyPick } from "@/lib/synergy";
import { loadSummaryFromIDB } from "@/lib/player-stats";
import { Hero, PersonalStatsSummary } from "@/lib/types";
import { ItemPriorityPanel } from "@/components/ItemPriorityPanel";
import { HeroPortrait } from "@/components/HeroPortrait";
import { HeroPicker } from "@/components/HeroPicker";
import {
  Button,
  IconButton,
  SegmentedControl,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  EmptyState,
  Select,
} from "@/components/ui";
import {
  ShieldAlert,
  X,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Users,
  Swords,
  Compass,
  Scale,
  Plus,
} from "lucide-react";

export default function DraftPage() {
  const { state, isLoaded, selectedRole, selectRole } = useUserState();

  // Drafting inputs
  const [enemyPicks, setEnemyPicks] = useState<EnemyPick[]>([]);
  const [allyPicks, setAllyPicks] = useState<AllyPick[]>([]);
  const [mode, setMode] = useState<DraftMode>("balanced");
  const [targetRole, setTargetRole] = useState<RolePosition>(2);
  const [activePickerTarget, setActivePickerTarget] = useState<"enemy" | "ally">("enemy");
  const [mobileSlotHero, setMobileSlotHero] = useState<{ type: "ally" | "enemy"; heroId: number; pos: RolePosition } | null>(null);

  // Sync targetRole with global selectedRole on initial load
  useEffect(() => {
    if (isLoaded && selectedRole) {
      setTargetRole(selectedRole);
    }
  }, [isLoaded, selectedRole]);

  // Selected candidate hero for detailed preview
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  // User pool for active target role
  const activeRolePool = useMemo(() => {
    if (!isLoaded) return {};
    return state.rolePool?.[targetRole] || {};
  }, [isLoaded, state.rolePool, targetRole]);

  const poolCount = useMemo(() => {
    return Object.values(activeRolePool).filter((p) => p.inPool).length;
  }, [activeRolePool]);

  // Infer enemy positions dynamically when enemies are added
  const inferredEnemyRoles = useMemo(() => {
    const ids = enemyPicks.map((e) => e.heroId);
    return inferEnemyPositions(ids);
  }, [enemyPicks]);

  // Effective enemy picks with inferred fallback
  const effectiveEnemyPicks = useMemo(() => {
    return enemyPicks.map((pick) => ({
      ...pick,
      position: pick.position || inferredEnemyRoles[pick.heroId] || 2,
    }));
  }, [enemyPicks, inferredEnemyRoles]);

  // IndexedDB personal stats summary cache
  const [personalStats, setPersonalStats] = useState<PersonalStatsSummary | null>(null);
  useEffect(() => {
    if (state.accountId) {
      loadSummaryFromIDB().then((summary) => {
        if (summary) setPersonalStats(summary);
      });
    }
  }, [state.accountId]);

  // Filter pool candidates strictly to user's configured pool for target role
  const poolCandidates = useMemo(() => {
    return ALL_HEROES.filter((hero) => {
      return !!activeRolePool[hero.id]?.inPool;
    });
  }, [activeRolePool]);

  // Comfort levels map
  const comfortLevels = useMemo(() => {
    const map: Record<number, number> = {};
    for (const [idStr, entry] of Object.entries(activeRolePool)) {
      if (entry.inPool) {
        map[parseInt(idStr, 10)] = entry.comfort || 2;
      }
    }
    return map;
  }, [activeRolePool]);

  // Rank candidate heroes using pure scoring engine
  const rankedResults = useMemo(() => {
    if (poolCandidates.length === 0) return [];

    return rankCandidates(
      ALL_HEROES,
      activeRolePool,
      effectiveEnemyPicks,
      mode,
      targetRole,
      false,
      false,
      personalStats || undefined,
      undefined,
      allyPicks
    );
  }, [poolCandidates.length, activeRolePool, effectiveEnemyPicks, allyPicks, mode, targetRole, personalStats]);

  const topCandidates = rankedResults.slice(0, 5);
  const activeHeroId = selectedCandidateId || topCandidates[0]?.hero.id;
  const activeHero = activeHeroId ? getHeroById(activeHeroId) : undefined;

  // Lane Threat Analysis for enemies
  const getHeroesForPositions = (positions: RolePosition[]) => {
    return effectiveEnemyPicks
      .filter((p) => positions.includes(p.position))
      .map((p) => getHeroById(p.heroId))
      .filter((h): h is Hero => !!h);
  };

  const midThreat = useMemo(() => analyzeEnemyLane(getHeroesForPositions([2]), "Mid Lane"), [effectiveEnemyPicks]);
  const offlaneThreat = useMemo(() => analyzeEnemyLane(getHeroesForPositions([3, 4]), "Offlane Duo"), [effectiveEnemyPicks]);
  const safeThreat = useMemo(() => analyzeEnemyLane(getHeroesForPositions([1, 5]), "Safelane Duo"), [effectiveEnemyPicks]);

  // Pick / remove handlers
  const handlePickHero = (hero: (typeof ALL_HEROES)[0]) => {
    if (activePickerTarget === "enemy") {
      if (enemyPicks.length < 5 && !enemyPicks.some((e) => e.heroId === hero.id)) {
        setEnemyPicks([...enemyPicks, { heroId: hero.id }]);
      }
    } else {
      if (allyPicks.length < 4 && !allyPicks.some((a) => a.heroId === hero.id)) {
        setAllyPicks([...allyPicks, { heroId: hero.id, position: (allyPicks.length + 1) as RolePosition }]);
      }
    }
  };

  const handleRemoveEnemy = (heroId: number) => {
    setEnemyPicks(enemyPicks.filter((e) => e.heroId !== heroId));
  };

  const handleRemoveAlly = (heroId: number) => {
    setAllyPicks(allyPicks.filter((a) => a.heroId !== heroId));
  };

  const handleUpdatePosition = (heroId: number, pos: RolePosition) => {
    setEnemyPicks(
      enemyPicks.map((pick) => (pick.heroId === heroId ? { ...pick, position: pos } : pick))
    );
  };

  const handleUpdateAllyPosition = (heroId: number, pos: RolePosition) => {
    setAllyPicks(
      allyPicks.map((pick) => (pick.heroId === heroId ? { ...pick, position: pos } : pick))
    );
  };

  const targetRoleMeta = ROLE_DEFINITIONS[targetRole];
  const allPickedIds = [...enemyPicks.map((e) => e.heroId), ...allyPicks.map((a) => a.heroId)];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Bar: Title, Role Focus, Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 font-dota">
              <ShieldAlert className="w-6 h-6 text-[#d8b57a]" />
              Dota 2 Draft Arena
            </h1>
            <Badge variant="neutral" size="sm">
              Role: {targetRoleMeta.shortName}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pick enemy and allied lineups to receive live synergy counter-picks and adaptive item progressions.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={[
              { value: "lane", label: "Lane", icon: <Swords className="w-3.5 h-3.5" /> },
              { value: "teamfight", label: "Fight", icon: <Users className="w-3.5 h-3.5" /> },
              { value: "macro", label: "Macro", icon: <Compass className="w-3.5 h-3.5" /> },
              { value: "balanced", label: "Balanced", icon: <Scale className="w-3.5 h-3.5" /> },
            ]}
            value={mode}
            onChange={(m) => setMode(m as DraftMode)}
            size="sm"
          />
        </div>
      </div>

      {/* 2. Panoramic Drafting Arena Deck: Compact Lineups (Hero Icon + Role, Name on Hover) */}
      <div className="p-4 rounded-2xl bg-[#0e1117]/95 border border-white/10 shadow-xl space-y-3.5">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          {/* Allied Team Lineup Slots (4 Slots) */}
          <div className="flex flex-col space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-dota">
                  Allied Team ({allyPicks.length}/4)
                </span>
              </div>
              {allyPicks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAllyPicks([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* 4 Compact Slots: Just Hero Icon + Role, Name on Hover / Tap on Mobile */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {[0, 1, 2, 3].map((slotIdx) => {
                const pick = allyPicks[slotIdx];
                const hero = pick ? getHeroById(pick.heroId) : null;

                return (
                  <div key={slotIdx} className="group/slot relative shrink-0">
                    <div
                      onClick={() => {
                        if (hero && pick) {
                          setMobileSlotHero({ type: "ally", heroId: pick.heroId, pos: pick.position || 1 });
                        } else {
                          setActivePickerTarget("ally");
                        }
                      }}
                      className={`relative w-15 h-11 sm:w-16 sm:h-12 rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer select-none ${
                        hero
                          ? "border-emerald-500/70 bg-[#0a0c0f] shadow-[0_0_12px_rgba(16,185,129,0.35)] hover:border-emerald-400 hover:scale-105"
                          : activePickerTarget === "ally"
                          ? "border-dashed border-emerald-500/60 bg-emerald-950/25 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                          : "border-dashed border-white/15 bg-black/40 text-slate-500 hover:border-emerald-500/40 hover:text-emerald-400"
                      }`}
                    >
                      {hero && pick ? (
                        <>
                          <Image
                            src={hero.img}
                            alt={hero.localized_name}
                            fill
                            sizes="64px"
                            className="object-cover pointer-events-none"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                          {/* Role Position Pip / Badge */}
                          <div className="absolute bottom-0.5 right-0.5 z-10 flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/85 border border-emerald-500/40 text-[9px] font-mono font-bold text-emerald-300 pointer-events-none">
                            <RoleIcon role={pick.position || 1} size={10} active />
                            <span>Pos {pick.position || 1}</span>
                          </div>

                          {/* Quick remove button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAlly(pick.heroId);
                            }}
                            title={`Remove ${hero.localized_name}`}
                            className="absolute top-0.5 right-0.5 z-20 w-4 h-4 rounded-full bg-black/80 text-slate-400 hover:text-rose-400 hover:bg-rose-950 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-mono font-semibold uppercase text-slate-400">
                            Ally {slotIdx + 1}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Hover Tooltip: Hero localized name + Role selector */}
                    {hero && pick && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/slot:flex flex-col items-center z-50 pointer-events-auto animate-in fade-in zoom-in-95 duration-100">
                        <div className="w-2 h-2 bg-[#0c0f14] border-t border-l border-white/20 rotate-45 -mb-1 z-10" />
                        <div className="p-2.5 rounded-xl bg-[#0c0f14]/98 border border-white/20 shadow-2xl min-w-[150px] text-center space-y-2">
                          <div>
                            <span className="text-xs font-bold text-white block font-dota leading-tight">
                              {hero.localized_name}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                              {ROLE_DEFINITIONS[pick.position || 1].name}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-white/10">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Role:</span>
                            <select
                              value={String(pick.position || 1)}
                              onChange={(e) =>
                                handleUpdateAllyPosition(
                                  pick.heroId,
                                  parseInt(e.target.value, 10) as RolePosition
                                )
                              }
                              className="bg-[#1a1e25] text-emerald-300 text-[10px] font-mono font-bold rounded px-1.5 py-0.5 border border-white/15 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  Pos {r} ({ROLE_DEFINITIONS[r].shortName})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Arena Controls: Active Target & Role Focus */}
          <div className="flex flex-col items-center justify-center gap-2.5 py-1 px-4 border-y xl:border-y-0 xl:border-x border-white/10">
            {/* Active Draft Picker Target Toggle */}
            <div className="inline-flex rounded-xl bg-[#07090c] p-0.5 border border-white/10 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setActivePickerTarget("enemy")}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePickerTarget === "enemy"
                    ? "bg-rose-950/70 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Pick Enemy ({enemyPicks.length}/5)</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePickerTarget("ally")}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePickerTarget === "ally"
                    ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Pick Ally ({allyPicks.length}/4)</span>
              </button>
            </div>

            {/* Target Role Pips */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-[10px] uppercase font-bold text-slate-500">Draft For Role:</span>
              <div className="flex items-center gap-1">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setTargetRole(r);
                      selectRole(r);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      targetRole === r
                        ? "bg-[#d8b57a] text-slate-950 shadow-xs"
                        : "bg-black/40 text-slate-400 hover:text-white border border-white/5"
                    }`}
                  >
                    Pos {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Enemy Team Lineup Slots (5 Slots) */}
          <div className="flex flex-col space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 font-dota">
                  Enemy Team ({enemyPicks.length}/5)
                </span>
              </div>
              {enemyPicks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEnemyPicks([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* 5 Compact Slots: Just Hero Icon + Role, Name on Hover / Tap on Mobile */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const pick = effectiveEnemyPicks[slotIdx];
                const hero = pick ? getHeroById(pick.heroId) : null;

                return (
                  <div key={slotIdx} className="group/slot relative shrink-0">
                    <div
                      onClick={() => {
                        if (hero && pick) {
                          setMobileSlotHero({ type: "enemy", heroId: pick.heroId, pos: pick.position || 2 });
                        } else {
                          setActivePickerTarget("enemy");
                        }
                      }}
                      className={`relative w-15 h-11 sm:w-16 sm:h-12 rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer select-none ${
                        hero
                          ? "border-rose-500/70 bg-[#0a0c0f] shadow-[0_0_12px_rgba(244,63,94,0.35)] hover:border-rose-400 hover:scale-105"
                          : activePickerTarget === "enemy"
                          ? "border-dashed border-rose-500/60 bg-rose-950/25 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                          : "border-dashed border-white/15 bg-black/40 text-slate-500 hover:border-rose-500/40 hover:text-rose-400"
                      }`}
                    >
                      {hero && pick ? (
                        <>
                          <Image
                            src={hero.img}
                            alt={hero.localized_name}
                            fill
                            sizes="64px"
                            className="object-cover pointer-events-none"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                          {/* Role Position Pip / Badge */}
                          <div className="absolute bottom-0.5 right-0.5 z-10 flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/85 border border-rose-500/40 text-[9px] font-mono font-bold text-rose-300 pointer-events-none">
                            <RoleIcon role={pick.position || 2} size={10} active />
                            <span>Pos {pick.position || 2}</span>
                          </div>

                          {/* Quick remove button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveEnemy(pick.heroId);
                            }}
                            title={`Remove ${hero.localized_name}`}
                            className="absolute top-0.5 right-0.5 z-20 w-4 h-4 rounded-full bg-black/80 text-slate-400 hover:text-rose-400 hover:bg-rose-950 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-mono font-semibold uppercase text-slate-400">
                            Enemy {slotIdx + 1}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Hover Tooltip: Hero localized name + Role selector */}
                    {hero && pick && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/slot:flex flex-col items-center z-50 pointer-events-auto animate-in fade-in zoom-in-95 duration-100">
                        <div className="w-2 h-2 bg-[#0c0f14] border-t border-l border-white/20 rotate-45 -mb-1 z-10" />
                        <div className="p-2.5 rounded-xl bg-[#0c0f14]/98 border border-white/20 shadow-2xl min-w-[150px] text-center space-y-2">
                          <div>
                            <span className="text-xs font-bold text-white block font-dota leading-tight">
                              {hero.localized_name}
                            </span>
                            <span className="text-[10px] text-rose-400 font-semibold block mt-0.5">
                              Enemy {ROLE_DEFINITIONS[pick.position || 2].name}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-white/10">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Role:</span>
                            <select
                              value={String(pick.position || 2)}
                              onChange={(e) =>
                                handleUpdatePosition(
                                  pick.heroId,
                                  parseInt(e.target.value, 10) as RolePosition
                                )
                              }
                              className="bg-[#1a1e25] text-rose-300 text-[10px] font-mono font-bold rounded px-1.5 py-0.5 border border-white/15 focus:outline-none focus:border-rose-500 cursor-pointer"
                            >
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  Pos {r} ({ROLE_DEFINITIONS[r].shortName})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lane Threat Summary Ribbon (visible when enemies exist) */}
        {enemyPicks.length > 0 && (
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1 font-dota">
              <AlertTriangle className="w-3 h-3" />
              Lane Threats:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/5 text-[11px]">
              <span className="font-bold text-sky-400 font-dota">{midThreat.laneTitle}:</span>
              <span className="text-slate-300">{midThreat.summary}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/5 text-[11px]">
              <span className="font-bold text-rose-400 font-dota">{offlaneThreat.laneTitle}:</span>
              <span className="text-slate-300">{offlaneThreat.summary}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/5 text-[11px]">
              <span className="font-bold text-emerald-400 font-dota">{safeThreat.laneTitle}:</span>
              <span className="text-slate-300">{safeThreat.summary}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Massive Full-Width Hero Selection Stage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-white font-dota flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d8b57a]" />
              Hero Selection Stage
            </span>
            <Badge
              variant={activePickerTarget === "enemy" ? "loss" : "win"}
              size="sm"
            >
              {activePickerTarget === "enemy"
                ? `Drafting for Enemy Team (${enemyPicks.length}/5)`
                : `Drafting for Allied Team (${allyPicks.length}/4)`}
            </Badge>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Click heroes to draft. Hover for cinematic inspect & abilities.
          </span>
        </div>

        <HeroPicker
          mode={activePickerTarget}
          role={targetRole}
          onPickHero={handlePickHero}
          selectedHeroIds={allPickedIds}
          enemyHeroIds={enemyPicks.map((e) => e.heroId)}
        />
      </div>

      {/* 3. Bottom Counter Recommendations Deck & Item Priorities */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold uppercase tracking-wider text-white flex items-center gap-2 font-dota">
            <Sparkles className="w-5 h-5 text-[#d8b57a]" />
            Recommended Counter Heroes for {targetRoleMeta.name} ({topCandidates.length})
          </h2>
          <span className="text-xs text-slate-400 font-mono">From your pool ({poolCount} heroes)</span>
        </div>

        {topCandidates.length === 0 ? (
          <EmptyState
            title={poolCount === 0 ? `No heroes in your ${targetRoleMeta.shortName} pool` : "No recommendations"}
            description={
              poolCount === 0
                ? `Configure your ${targetRoleMeta.shortName} pool in Hero Pools to receive tailored draft recommendations.`
                : "Add enemy heroes to calculate counter-picks."
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Candidates list (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-3">
              {topCandidates.map((cand, idx) => {
                const score = cand.scores;
                const isSelected = activeHeroId === cand.hero.id;
                const finalPct = (score.finalScore * 100).toFixed(1);

                return (
                  <div
                    key={cand.hero.id}
                    onClick={() => setSelectedCandidateId(cand.hero.id)}
                    className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-[#1a1e25] border-[#d8b57a] shadow-lg shadow-black/50"
                        : "bg-[#12151a] border-white/10 hover:border-white/20 hover:bg-[#161a22]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-500 w-4">
                          #{idx + 1}
                        </span>
                        <HeroPortrait src={cand.hero.img} alt={cand.hero.localized_name} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white font-dota">
                              {cand.hero.localized_name}
                            </h3>
                            <Badge variant="neutral" size="xs">
                              {cand.hero.primary_attr.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-[#4fbf6b] font-medium mt-0.5 line-clamp-1">
                            {score.reasons.join(" • ")}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-black font-mono ${
                            score.finalScore >= 0 ? "text-[#4fbf6b]" : "text-[#e05050]"
                          }`}
                        >
                          {score.finalScore >= 0 ? `+${finalPct}%` : `${finalPct}%`}
                        </span>
                        <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                          Advantage
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Bars */}
                    <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-5 gap-2 text-xs">
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">Lane</span>
                          <span className="font-mono text-slate-200">
                            {(score.laneScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-[#0a0c0f] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${score.laneScore >= 0 ? "bg-[#4fbf6b]" : "bg-[#e05050]"}`}
                            style={{ width: `${Math.min(100, Math.max(10, Math.abs(score.laneScore) * 1000))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">Fight</span>
                          <span className="font-mono text-slate-200">
                            {(score.fightScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-[#0a0c0f] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${score.fightScore >= 0 ? "bg-[#00d9ff]" : "bg-[#e05050]"}`}
                            style={{ width: `${Math.min(100, Math.max(10, Math.abs(score.fightScore) * 1000))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">Macro</span>
                          <span className="font-mono text-slate-200">
                            {(score.macroScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-[#0a0c0f] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${score.macroScore >= 0 ? "bg-[#d8b57a]" : "bg-[#e05050]"}`}
                            style={{ width: `${Math.min(100, Math.max(10, Math.abs(score.macroScore) * 1000))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">Synergy</span>
                          <span className="font-mono text-slate-200">
                            {((score.synergyScore ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-[#0a0c0f] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${(score.synergyScore ?? 0) >= 0 ? "bg-[#a855f7]" : "bg-[#e05050]"}`}
                            style={{ width: `${Math.min(100, Math.max(10, Math.abs(score.synergyScore ?? 0) * 1000))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-400">Comfort</span>
                          <span className="font-mono text-[#d8b57a]">
                            {"★".repeat(comfortLevels[cand.hero.id] || 2)}
                          </span>
                        </div>
                        <div className="w-full bg-[#0a0c0f] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#d8b57a]"
                            style={{ width: `${((comfortLevels[cand.hero.id] || 2) / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Hero Adaptive Item Progression (5 cols on lg) */}
            <div className="lg:col-span-5">
              {activeHero ? (
                <div className="p-4 rounded-xl bg-[#12151a] border border-white/10 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <HeroPortrait src={activeHero.img} alt={activeHero.localized_name} size="sm" />
                      <div>
                        <span className="text-xs font-bold text-white block font-dota">
                          {activeHero.localized_name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Adaptive Core Progression
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/lane/matchup?role=${targetRole}&me=${activeHero.id}&enemy=${effectiveEnemyPicks[0]?.heroId || 1}`}
                      className="text-[11px] font-semibold text-[#d8b57a] hover:underline flex items-center gap-1"
                    >
                      <span>Matchup Drills</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <ItemPriorityPanel
                    candidateHero={activeHero}
                    enemyHeroIds={effectiveEnemyPicks.map((e) => e.heroId)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Slot Bottom Action Sheet */}
      {mobileSlotHero && (() => {
        const hero = getHeroById(mobileSlotHero.heroId);
        if (!hero) return null;
        return (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setMobileSlotHero(null)}
            />
            <div className="relative bg-[#12151a] border-t border-white/15 rounded-t-3xl p-5 space-y-4 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <HeroPortrait src={hero.img} alt={hero.localized_name} size="md" />
                  <div>
                    <h3 className="font-dota font-bold text-white text-base leading-tight">
                      {hero.localized_name}
                    </h3>
                    <span className="text-xs text-slate-400 capitalize">
                      {mobileSlotHero.type === "ally" ? "Allied" : "Enemy"} Team Slot
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSlotHero(null)}
                  className="p-2 rounded-full bg-white/5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Position selector */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-400 font-mono">
                  Assigned Position:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {ALL_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        if (mobileSlotHero.type === "ally") {
                          handleUpdateAllyPosition(mobileSlotHero.heroId, r);
                        } else {
                          handleUpdatePosition(mobileSlotHero.heroId, r);
                        }
                        setMobileSlotHero(null);
                      }}
                      className={`py-2 rounded-lg font-mono font-bold text-xs border text-center transition-all ${
                        mobileSlotHero.pos === r
                          ? mobileSlotHero.type === "ally"
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                            : "bg-rose-500 text-white border-rose-400 shadow-sm"
                          : "bg-[#0a0c0f] text-slate-300 border-white/10"
                      }`}
                    >
                      Pos {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remove button */}
              <Button
                variant="danger"
                size="md"
                className="w-full"
                onClick={() => {
                  if (mobileSlotHero.type === "ally") {
                    handleRemoveAlly(mobileSlotHero.heroId);
                  } else {
                    handleRemoveEnemy(mobileSlotHero.heroId);
                  }
                  setMobileSlotHero(null);
                }}
              >
                Remove {hero.localized_name} from {mobileSlotHero.type === "ally" ? "Allied" : "Enemy"} Lineup
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
