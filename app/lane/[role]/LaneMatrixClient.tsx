"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { getHeroById } from "@/lib/heroes";
import { useUserState } from "@/lib/useUserState";
import { getMatchup } from "@/lib/scoring";
import { calculateSRSStats } from "@/lib/srs";
import {
  ALL_ROLES,
  ROLE_DEFINITIONS,
  getPrimaryOpponentRole,
  getViableHeroesForRole,
} from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { HeroPortrait } from "@/components/HeroPortrait";
import { RolePosition } from "@/lib/types";
import {
  SearchInput,
  SegmentedControl,
  Badge,
  Toggle,
} from "@/components/ui";
import {
  BrainCircuit,
  ArrowRight,
} from "lucide-react";
import { loadSummaryFromIDB } from "@/lib/player-stats";
import { PersonalStatsSummary } from "@/lib/types";
import patchDiffData from "@/data/patch-diff.json";

export default function LaneMatrixClient({ roleParam }: { roleParam: string }) {
  const roleNum = parseInt(roleParam, 10);
  const role: RolePosition = ([1, 2, 3, 4, 5].includes(roleNum) ? roleNum : 2) as RolePosition;

  const { state, isLoaded, selectRole } = useUserState();

  const [rowSearch, setRowSearch] = useState("");
  const [colSearch, setColSearch] = useState("");
  const [onlyUserPool, setOnlyUserPool] = useState(false);
  const [viewMode, setViewMode] = useState<"global" | "personal" | "blend">("global");
  const [personalSummary, setPersonalSummary] = useState<PersonalStatsSummary | null>(null);
  const [hoveredRowHeroId, setHoveredRowHeroId] = useState<number | null>(null);
  const [hoveredColHeroId, setHoveredColHeroId] = useState<number | null>(null);

  useEffect(() => {
    loadSummaryFromIDB().then((s) => {
      if (s) setPersonalSummary(s);
    });
  }, []);

  const roleMeta = ROLE_DEFINITIONS[role];
  const roleTheme = ROLE_THEME[role];
  const oppRole = getPrimaryOpponentRole(role);
  const oppMeta = ROLE_DEFINITIONS[oppRole];
  const oppTheme = ROLE_THEME[oppRole];

  // SRS stats for header badge
  const srsStats = useMemo(() => {
    return isLoaded ? calculateSRSStats(state.srs, role) : { totalCards: 0, dueToday: 0, memorized: 0 };
  }, [isLoaded, state.srs, role]);

  // Determine row heroes (my heroes for this role)
  const userRolePoolIds = useMemo(() => {
    if (!isLoaded) return [];
    return Object.values(state.rolePool?.[role] || {})
      .filter((p) => p.inPool)
      .map((p) => p.heroId);
  }, [isLoaded, state.rolePool, role]);

  // Viable heroes for my role
  const viableMyRoleIds = useMemo(() => {
    return getViableHeroesForRole(role, 0.35);
  }, [role]);

  const rowHeroes = useMemo(() => {
    let ids: number[] = [];
    if (userRolePoolIds.length > 0) {
      ids = onlyUserPool ? userRolePoolIds : Array.from(new Set([...userRolePoolIds, ...viableMyRoleIds.slice(0, 20)]));
    } else {
      ids = viableMyRoleIds.slice(0, 25);
    }

    return ids
      .map((id) => getHeroById(id)!)
      .filter(Boolean)
      .filter((h) => {
        if (!rowSearch.trim()) return true;
        const q = rowSearch.toLowerCase();
        return h.localized_name.toLowerCase().includes(q) || h.name.toLowerCase().includes(q);
      })
      .sort((a, b) => a.localized_name.localeCompare(b.localized_name));
  }, [onlyUserPool, userRolePoolIds, viableMyRoleIds, rowSearch]);

  // Determine column heroes (enemy heroes for opposing role)
  const colHeroes = useMemo(() => {
    const oppViableIds = getViableHeroesForRole(oppRole, 0.15);

    return oppViableIds
      .map((id) => getHeroById(id)!)
      .filter(Boolean)
      .filter((h) => {
        if (!colSearch.trim()) return true;
        const q = colSearch.toLowerCase();
        return h.localized_name.toLowerCase().includes(q) || h.name.toLowerCase().includes(q);
      })
      .sort((a, b) => a.localized_name.localeCompare(b.localized_name));
  }, [oppRole, colSearch]);

  const getDeltaBadge = (delta: number) => {
    const pct = (delta * 100).toFixed(1);
    if (delta >= 0.03) {
      return { text: `+${pct}%`, bg: "bg-emerald-950/80 text-emerald-400 border-emerald-500/60 font-bold" };
    }
    if (delta > 0.005) {
      return { text: `+${pct}%`, bg: "bg-emerald-950/40 text-emerald-300 border-emerald-800/40" };
    }
    if (delta >= -0.005) {
      return { text: `${pct}%`, bg: "bg-amber-950/20 text-amber-300 border-amber-800/40" };
    }
    if (delta <= -0.03) {
      return { text: `${pct}%`, bg: "bg-rose-950/80 text-rose-400 border-rose-500/60 font-bold" };
    }
    return { text: `${pct}%`, bg: "bg-rose-950/40 text-rose-300 border-rose-800/40" };
  };

  return (
    <div className="max-w-[98vw] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <RoleIcon role={role} size={24} active />
            <h1 className="text-2xl font-black text-white tracking-tight">
              {roleMeta.name} Lane Matchup Heatmap
            </h1>
            <Badge variant="outline" size="sm">
              {roleMeta.shortName} vs {oppMeta.shortName}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-dim)] mt-1">
            Evaluating {roleMeta.name} matchups against opposing {oppMeta.name} ({oppMeta.laneName}).
          </p>
        </div>

        {/* Drill Link & Due Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/lane/${role}/drill`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/40 group"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>Launch {roleMeta.shortName} Drill</span>
            {srsStats.dueToday > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                {srsStats.dueToday} due
              </span>
            )}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Role Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[var(--color-panel)] p-1.5 rounded-xl border border-[var(--color-border)]">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_DEFINITIONS[r];
          const theme = ROLE_THEME[r];
          const isSelected = role === r;
          return (
            <Link
              key={r}
              href={`/lane/${r}`}
              onClick={() => selectRole(r)}
              className={`py-2 px-3 rounded-lg text-center transition-all border flex items-center justify-center gap-2 ${
                isSelected
                  ? "border-[var(--color-border-hover)] bg-[var(--color-raised)] font-black shadow-sm"
                  : "border-transparent text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-raised)]/40"
              }`}
            >
              <RoleIcon role={r} size={16} active={isSelected} />
              <div className="text-left">
                <span
                  className="text-xs font-bold block"
                  style={{ color: isSelected ? theme.color : undefined }}
                >
                  {meta.shortName}
                </span>
                <span className="text-[10px] opacity-70 truncate block">{meta.laneName}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-xl bg-[var(--color-panel)] border border-[var(--color-border)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Row Hero Search */}
          <div className="min-w-[180px] flex-1 max-w-xs">
            <SearchInput
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
              placeholder={`Filter my ${roleMeta.shortName} heroes...`}
            />
          </div>

          {/* Col Hero Search */}
          <div className="min-w-[180px] flex-1 max-w-xs">
            <SearchInput
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              placeholder={`Filter enemy ${oppMeta.shortName} heroes...`}
            />
          </div>

          {/* User Pool Toggle */}
          <Toggle
            checked={onlyUserPool}
            onChange={setOnlyUserPool}
            label={`Only My ${roleMeta.shortName} Pool (${userRolePoolIds.length})`}
          />

          {/* Data Source SegmentedControl: Global | My stats | Blend */}
          <SegmentedControl
            options={[
              { value: "global", label: "Global" },
              { value: "personal", label: "My Stats" },
              { value: "blend", label: "Blend" },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as "global" | "personal" | "blend")}
            size="sm"
          />
        </div>

        <div className="text-xs text-[var(--color-text-dim)] font-mono shrink-0">
          Grid: {rowHeroes.length} × {colHeroes.length} matchups
        </div>
      </div>

      {/* Matchup Matrix Heatmap Table Container */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-30 bg-[#070a0f] border-b border-[var(--color-border)]">
              <tr>
                {/* Top-left sticky corner */}
                <th className="sticky left-0 z-40 bg-[#070a0f] p-3 text-xs font-black text-slate-300 border-r border-[var(--color-border)] min-w-[170px] shadow-md">
                  <div className="flex items-center justify-between">
                    <span style={{ color: roleTheme.color }}>My {roleMeta.shortName}</span>
                    <span style={{ color: oppTheme.color }}>Enemy {oppMeta.shortName} →</span>
                  </div>
                </th>

                {/* Column Headers: Enemy Opponent Heroes */}
                {colHeroes.map((enemy) => {
                  const isColActive = hoveredColHeroId === enemy.id;
                  return (
                    <th
                      key={enemy.id}
                      className={`p-1.5 border-r border-[var(--color-border)]/60 min-w-[68px] text-center transition-colors ${
                        isColActive ? "bg-[#1a1e25] ring-1 ring-[#d8b57a]/50" : ""
                      }`}
                      title={enemy.localized_name}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <HeroPortrait
                          src={enemy.img}
                          alt={enemy.localized_name}
                          size="xs"
                          aspectRatio="video"
                        />
                        <span className={`text-[10px] truncate max-w-[62px] font-semibold ${
                          isColActive ? "text-[#d8b57a]" : "text-slate-300"
                        }`}>
                          {enemy.localized_name}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {rowHeroes.map((myHero, idx) => {
                const inPool = userRolePoolIds.includes(myHero.id);
                const isRowActive = hoveredRowHeroId === myHero.id;

                return (
                  <tr
                    key={myHero.id}
                    className={`border-b border-[var(--color-border)]/50 transition-colors ${
                      isRowActive
                        ? "bg-[#1a1e25]/90 ring-1 ring-inset ring-[#d8b57a]/30"
                        : idx % 2 === 0
                        ? "bg-[var(--color-canvas)] hover:bg-[var(--color-raised)]/70"
                        : "bg-[var(--color-panel)] hover:bg-[var(--color-raised)]/70"
                    }`}
                  >
                    {/* Sticky Row Header: My Hero */}
                    <td className={`sticky left-0 z-20 p-2 border-r border-[var(--color-border)] shadow-md transition-colors ${
                      isRowActive ? "bg-[#1a1e25] ring-1 ring-[#d8b57a]/50" : "bg-inherit"
                    }`}>
                      <div className="flex items-center gap-2">
                        <HeroPortrait
                          src={myHero.img}
                          alt={myHero.localized_name}
                          size="xs"
                          aspectRatio="video"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate max-w-[85px] ${
                              isRowActive ? "text-[#d8b57a]" : "text-white"
                            }`}>
                              {myHero.localized_name}
                            </span>
                            {inPool && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-win)] shrink-0" title="In your pool" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Matchup Cells */}
                    {colHeroes.map((enemy) => {
                      const m = getMatchup(myHero.id, enemy.id);
                      const key = `${myHero.id}_${enemy.id}`;
                      const personalMu = personalSummary?.matchupStats?.[role]?.[key];
                      const isCrosshair = hoveredRowHeroId === myHero.id || hoveredColHeroId === enemy.id;

                      let displayDelta = m ? m.delta : 0;
                      let displayGames = m ? m.games : 0;
                      let isLowData = !m || m.games < 30;
                      let cellText = "";
                      let subText = "";

                      if (viewMode === "global") {
                        const badge = getDeltaBadge(displayDelta);
                        cellText = isLowData ? "--" : badge.text;
                        subText = isLowData ? "low" : `${displayGames}g`;
                      } else if (viewMode === "personal") {
                        if (personalMu && personalMu.games > 0) {
                          const wrPct = (personalMu.winRate * 100).toFixed(0);
                          displayDelta = personalMu.winRate - 0.5;
                          cellText = `${wrPct}%`;
                          subText = `${personalMu.games}g`;
                          isLowData = false;
                        } else {
                          cellText = "--";
                          subText = "0g";
                          isLowData = true;
                        }
                      } else {
                        // Blend mode
                        if (personalMu && personalMu.games > 0) {
                          displayDelta = personalMu.smoothedDelta;
                          const badge = getDeltaBadge(displayDelta);
                          cellText = badge.text;
                          subText = `${personalMu.games}p+${displayGames}g`;
                          isLowData = false;
                        } else {
                          const badge = getDeltaBadge(displayDelta);
                          cellText = isLowData ? "--" : badge.text;
                          subText = isLowData ? "low" : `${displayGames}g`;
                        }
                      }

                      const badge = getDeltaBadge(displayDelta);
                      const isStale =
                        Boolean(state.notes[key] || (state.srs && Object.values(state.srs).some((s: any) => s.myHeroId === myHero.id && s.enemyHeroId === enemy.id))) &&
                        patchDiffData.matchupDiffs?.some((d: any) => d.myHeroId === myHero.id && d.enemyHeroId === enemy.id);

                      return (
                        <td
                          key={enemy.id}
                          onMouseEnter={() => {
                            setHoveredRowHeroId(myHero.id);
                            setHoveredColHeroId(enemy.id);
                          }}
                          onMouseLeave={() => {
                            setHoveredRowHeroId(null);
                            setHoveredColHeroId(null);
                          }}
                          className={`p-1 border-r border-[var(--color-border)]/40 text-center relative transition-colors ${
                            isCrosshair ? "bg-white/[0.04]" : ""
                          }`}
                        >
                          <Link
                            href={`/lane/matchup?role=${role}&me=${myHero.id}&enemy=${enemy.id}`}
                            className={`block p-1 rounded border text-[11px] transition-all hover:scale-105 hover:z-10 animate-cell-in ${
                              isLowData
                                ? "bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_3px,transparent_3px,transparent_6px)] border-[var(--color-border)] text-slate-500 hover:border-slate-500"
                                : `${badge.bg} hover:border-[#d8b57a] hover:ring-1 hover:ring-[#d8b57a]/40 shadow-sm`
                            }`}
                            title={`${myHero.localized_name} vs ${enemy.localized_name} (${viewMode})${isStale ? " - Outdated: Patch Delta Swing" : ""}`}
                          >
                            <span className="block font-mono font-bold leading-tight">{cellText}</span>
                            <span className="block text-[8px] opacity-70 leading-tight">
                              {subText}
                            </span>
                            {isStale && (
                              <span className="block text-[7px] text-amber-300 font-bold uppercase tracking-wider bg-amber-500/30 rounded mt-0.5">
                                patch?
                              </span>
                            )}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap Visual Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-[var(--color-panel)] border border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
        <span className="font-semibold text-white">Color Legend:</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-500" />
            <span>Heavy Win (&gt;+3%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-950/40 border border-emerald-800/40" />
            <span>Slight Win (&gt;0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-950/20 border border-amber-800/40" />
            <span>Even (~0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-950/40 border border-rose-800/40" />
            <span>Slight Loss (&lt;0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-950 border border-rose-500" />
            <span>Heavy Loss (&lt;-3%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-slate-700 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.1)_0px,rgba(255,255,255,0.1)_2px,transparent_2px,transparent_4px)]" />
            <span>Low Data (&lt;30 games)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
