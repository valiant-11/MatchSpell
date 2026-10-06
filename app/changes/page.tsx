"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useUserState } from "@/lib/useUserState";
import { ALL_ROLES, ROLE_DEFINITIONS, getHeroRoleFit } from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { HeroPortrait } from "@/components/HeroPortrait";
import { RolePosition, Hero, SRSEntry } from "@/lib/types";
import {
  resetStaleCardToBox2,
  MatchupDiffEntry,
  HeroStatDiffEntry,
  RoleFitDiffEntry,
  ItemShiftEntry,
  PatchDiffSummary,
} from "@/lib/diff";
import { saveRoleSRSEntry } from "@/lib/storage";
import {
  Button,
  IconButton,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  useToast,
} from "@/components/ui";

// Static build data
import rawPatchDiff from "@/data/patch-diff.json";
import rawHeroes from "@/data/heroes.json";

const patchDiffData = rawPatchDiff as unknown as PatchDiffSummary;
const heroes = rawHeroes as Hero[];
const heroMap = new Map<number, Hero>(heroes.map((h) => [h.id, h]));

export default function PatchChangesPage() {
  const { state, refresh, selectedRole } = useUserState();
  const { toast } = useToast();
  const [activeTabRole, setActiveTabRole] = useState<RolePosition | "all">("all");
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const matchupDiffs: MatchupDiffEntry[] = patchDiffData.matchupDiffs || [];
  const heroStatDiffs: HeroStatDiffEntry[] = patchDiffData.heroStatDiffs || [];
  const roleFitDiffs: RoleFitDiffEntry[] = patchDiffData.roleFitDiffs || [];
  const itemShifts: ItemShiftEntry[] = patchDiffData.itemShifts || [];
  const comparedRange = patchDiffData.comparedRange || {
    oldDateOrPatch: "Previous Snapshot",
    newDateOrPatch: "Current Live",
  };

  // Filter matchups by active role tab if not "all"
  const filteredMatchups = matchupDiffs.filter((m) => {
    if (activeTabRole === "all") return true;
    const fit = getHeroRoleFit(m.myHeroId);
    return (fit?.roles?.[activeTabRole] || 0) >= 0.15;
  });

  // Filter role fits by active role tab if not "all"
  const filteredRoleFits = roleFitDiffs.filter((r) => {
    if (activeTabRole === "all") return true;
    return r.role === activeTabRole;
  });

  // Calculate stale cards in user SRS
  const userSRSCards: SRSEntry[] = Object.values(state.srs || {});
  const staleSRSCards = userSRSCards.filter((card) =>
    matchupDiffs.some(
      (m) => m.myHeroId === card.myHeroId && m.enemyHeroId === card.enemyHeroId
    )
  );

  const handleResetStaleCards = () => {
    if (staleSRSCards.length === 0) return;

    let count = 0;
    for (const card of staleSRSCards) {
      const resetCard = resetStaleCardToBox2(card);
      saveRoleSRSEntry(resetCard);
      count++;
    }

    refresh();
    const msg = `Reset ${count} affected cards to Box 2 for review.`;
    setResetSuccessMessage(msg);
    toast({ title: "Cards Reset", description: msg, variant: "success" });
    setTimeout(() => setResetSuccessMessage(null), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <Card variant="raised" className="p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <GitCompare className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                Patch Diff & Meta Swings
              </h1>
            </div>
            <p className="text-xs text-[var(--color-text-dim)] max-w-2xl leading-relaxed">
              Detects significant matchup delta swings (≥ 2.0%), role suitability shifts, hero win
              rate fluctuations, and build updates across patches.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest block font-bold">
                Compared Snapshots
              </span>
              <span className="text-xs font-mono font-bold text-sky-400">
                {comparedRange.oldDateOrPatch} → {comparedRange.newDateOrPatch}
              </span>
            </div>

            {staleSRSCards.length > 0 && (
              <Button
                variant="outline"
                size="md"
                onClick={handleResetStaleCards}
                className="border-amber-500/40 text-amber-300 hover:bg-amber-950/20 font-bold"
              >
                <RotateCcw className="w-4 h-4 mr-1.5 text-amber-400" />
                Reset {staleSRSCards.length} Cards to Box 2
              </Button>
            )}
          </div>
        </div>

        {resetSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{resetSuccessMessage}</span>
          </div>
        )}
      </Card>

      {/* Role Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[var(--color-border)] pb-3.5">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-dim)]" />
          <span className="text-xs font-bold uppercase text-[var(--color-text-dim)] tracking-wider">
            Filter Position:
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTabRole("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTabRole === "all"
                ? "bg-[var(--color-accent)] text-white shadow-sm"
                : "bg-[var(--color-panel)] text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-raised)]"
            }`}
          >
            All Roles ({matchupDiffs.length})
          </button>
          {ALL_ROLES.map((r) => {
            const meta = ROLE_DEFINITIONS[r];
            const theme = ROLE_THEME[r];
            const isTab = activeTabRole === r;
            const count = matchupDiffs.filter((m) => {
              const fit = getHeroRoleFit(m.myHeroId);
              return (fit?.roles?.[r] || 0) >= 0.15;
            }).length;

            return (
              <button
                key={r}
                type="button"
                onClick={() => setActiveTabRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isTab
                    ? "border-[var(--color-border-hover)] bg-[var(--color-raised)] shadow-sm"
                    : "border-transparent bg-[var(--color-panel)] text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-raised)]"
                }`}
              >
                <RoleIcon role={r} size={14} active={isTab} />
                <span style={{ color: isTab ? theme.color : undefined }}>{meta.shortName}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 1: Matchup Delta Swings (>= 2.0%) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Matchup Delta Swings (≥ 2.0% change, N ≥ 100)
            </h2>
          </div>
          <span className="text-xs text-[var(--color-text-dim)] font-mono">
            {filteredMatchups.length} matchups
          </span>
        </div>

        {filteredMatchups.length === 0 ? (
          <Card variant="panel" className="p-8 text-center text-[var(--color-text-dim)] text-xs">
            No matchup swings ≥ 2.0% found for this role filter.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMatchups.map((m, idx) => {
              const myHero = heroMap.get(m.myHeroId);
              const enemyHero = heroMap.get(m.enemyHeroId);
              const isPositive = m.deltaShift >= 0;
              const hasCard = userSRSCards.some(
                (c) => c.myHeroId === m.myHeroId && c.enemyHeroId === m.enemyHeroId
              );

              return (
                <Card
                  key={`${m.myHeroId}_${m.enemyHeroId}_${idx}`}
                  variant="panel"
                  className="p-3.5 space-y-3 hover:border-[var(--color-border-hover)] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HeroPortrait src={myHero?.img} alt={myHero?.localized_name || ""} size="xs" aspectRatio="video" />
                      <span className="text-xs font-bold text-white truncate max-w-[85px]">
                        {myHero?.localized_name || `Hero ${m.myHeroId}`}
                      </span>

                      <span className="text-[10px] text-slate-500 font-bold">vs</span>

                      <HeroPortrait src={enemyHero?.img} alt={enemyHero?.localized_name || ""} size="xs" aspectRatio="video" />
                      <span className="text-xs font-bold text-rose-300 truncate max-w-[85px]">
                        {enemyHero?.localized_name || `Hero ${m.enemyHeroId}`}
                      </span>
                    </div>

                    {hasCard && (
                      <Badge variant="neutral" size="sm" dot>
                        Outdated
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs bg-[var(--color-canvas)] p-2 rounded-lg border border-[var(--color-border)]">
                    <div>
                      <span className="text-[9px] text-[var(--color-text-dim)] block uppercase font-bold">
                        Previous
                      </span>
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">
                        {(m.oldDelta * 100).toFixed(1)}%
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    <div>
                      <span className="text-[9px] text-[var(--color-text-dim)] block uppercase font-bold">
                        Live
                      </span>
                      <span className="font-mono text-xs text-white font-bold">
                        {(m.newDelta * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-[var(--color-text-dim)] block uppercase font-bold">
                        Swing
                      </span>
                      <span
                        className={`font-mono text-xs font-bold flex items-center justify-end gap-0.5 ${
                          isPositive ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"
                        }`}
                      >
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPositive ? "+" : ""}
                        {(m.deltaShift * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-dim)]">
                    <span>Games: {m.newGames.toLocaleString()}</span>
                    <Link
                      href={`/lane/matchup?role=${selectedRole}&me=${m.myHeroId}&enemy=${m.enemyHeroId}`}
                      className="text-[var(--color-accent)] hover:underline font-semibold"
                    >
                      View Playbook →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Role Fit Shifts & Hero Win Rate Shifts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Fit Shifts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Hero Role Fit Shifts (≥ 5%)
            </h2>
          </div>

          {filteredRoleFits.length === 0 ? (
            <Card variant="panel" className="p-6 text-center text-[var(--color-text-dim)] text-xs">
              No significant role suitability changes found.
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredRoleFits.map((rf, idx) => {
                const hero = heroMap.get(rf.heroId);
                const roleMeta = ROLE_DEFINITIONS[rf.role as RolePosition] || ROLE_DEFINITIONS[2];
                const isPos = rf.shift >= 0;

                return (
                  <Card
                    key={`${rf.heroId}_${rf.role}_${idx}`}
                    variant="panel"
                    className="p-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <HeroPortrait src={hero?.img} alt={hero?.localized_name || ""} size="xs" aspectRatio="video" />
                      <div>
                        <span className="font-bold text-white block">
                          {hero?.localized_name || `Hero ${rf.heroId}`}
                        </span>
                        <Badge variant="outline" size="sm">
                          {roleMeta.shortName} • {roleMeta.name}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="font-mono text-[var(--color-text-dim)]">
                        {Math.round(rf.oldFit * 100)}% → {Math.round(rf.newFit * 100)}%
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          isPos ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"
                        }`}
                      >
                        {isPos ? "+" : ""}
                        {Math.round(rf.shift * 100)}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Overall Hero Win Rate Shifts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Hero Win Rate Shifts (≥ 1.5%)
            </h2>
          </div>

          {heroStatDiffs.length === 0 ? (
            <Card variant="panel" className="p-6 text-center text-[var(--color-text-dim)] text-xs">
              Hero win rates remain within stable ±1.5% margins.
            </Card>
          ) : (
            <div className="space-y-2">
              {heroStatDiffs.map((hs, idx) => {
                const hero = heroMap.get(hs.heroId);
                const isPos = hs.shift >= 0;

                return (
                  <Card
                    key={`${hs.heroId}_${idx}`}
                    variant="panel"
                    className="p-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <HeroPortrait src={hero?.img} alt={hero?.localized_name || ""} size="xs" aspectRatio="video" />
                      <span className="font-bold text-white">
                        {hero?.localized_name || `Hero ${hs.heroId}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="font-mono text-[var(--color-text-dim)]">
                        {(hs.oldWr * 100).toFixed(1)}% → {(hs.newWr * 100).toFixed(1)}%
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          isPos ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"
                        }`}
                      >
                        {isPos ? "+" : ""}
                        {(hs.shift * 100).toFixed(1)}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Item Build Trend Shifts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Item Build Trend Shifts
          </h2>
        </div>

        {itemShifts.length === 0 ? (
          <Card variant="panel" className="p-6 text-center text-[var(--color-text-dim)] text-xs">
            No item build entrance/exit disruptions recorded in top 6 phases.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemShifts.map((it, idx) => {
              const hero = heroMap.get(it.heroId);
              return (
                <Card
                  key={`${it.heroId}_${it.item}_${idx}`}
                  variant="panel"
                  className="p-3 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {hero?.localized_name || `Hero ${it.heroId}`}
                    </span>
                    <span className="text-[var(--color-text-dim)] font-mono">[{it.item}]</span>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {it.changeType}
                  </Badge>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
