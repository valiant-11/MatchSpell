"use client";

import Image from "next/image";
import { Hero } from "@/lib/types";
import { getHeroItemProgression, ProgressionTierItem } from "@/lib/item-rules";
import itemPopData from "@/data/item-popularity.json";
import { Zap, Clock, Package, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ItemPriorityPanelProps {
  candidateHero: Hero;
  enemyHeroIds: number[];
  targetRole?: number;
}

const TIER_META: Record<
  "rush" | "core" | "mid" | "situational",
  { label: string; bg: string; border: string; text: string; badgeVariant: "loss" | "neutral" | "info" | "pos5" }
> = {
  rush: {
    label: "Rush Priority (Early Timing)",
    bg: "bg-rose-950/20",
    border: "border-rose-500/30",
    text: "text-rose-400",
    badgeVariant: "loss",
  },
  core: {
    label: "Core Progression",
    bg: "bg-amber-950/20",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badgeVariant: "neutral",
  },
  mid: {
    label: "Mid Game Tech & Adaptation",
    bg: "bg-cyan-950/20",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    badgeVariant: "info",
  },
  situational: {
    label: "Situational & Late Luxury",
    bg: "bg-purple-950/20",
    border: "border-purple-500/30",
    text: "text-purple-400",
    badgeVariant: "pos5",
  },
};

export function ItemPriorityPanel({ candidateHero, enemyHeroIds, targetRole }: ItemPriorityPanelProps) {
  const progression = getHeroItemProgression(candidateHero, enemyHeroIds, targetRole);

  // Group by tier
  const tiers: Array<"rush" | "core" | "mid" | "situational"> = ["rush", "core", "mid", "situational"];
  const grouped = tiers.map((tier) => ({
    tier,
    items: progression[tier],
  }));

  const totalItems = grouped.reduce((sum, g) => sum + g.items.length, 0);

  // Baseline items
  const baseline = (itemPopData as Record<string, any>)[String(candidateHero.id)];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Adaptive Itemization & Core Progression
        </h3>
        <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
          {candidateHero.localized_name} high-rank core build dynamically tailored with counter rules vs enemy lineup.
        </p>
      </div>

      {/* Progression by Tier */}
      {totalItems === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs text-[var(--color-text-dim)] text-center">
          Select heroes to evaluate declarative itemization counter rules.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ tier, items }) => {
            if (items.length === 0) return null;
            const meta = TIER_META[tier];

            return (
              <div key={tier} className={`rounded-xl border p-3.5 ${meta.bg} ${meta.border} space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${meta.text}`}>
                    {meta.label}
                  </span>
                  <Badge variant={meta.badgeVariant} size="sm">
                    {tier}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-start gap-2.5 p-2 rounded-lg bg-[var(--color-canvas)]/90 border transition-all ${
                        item.isCounterRule ? "border-amber-500/40 shadow-sm shadow-amber-950/20" : "border-[var(--color-border)]"
                      }`}
                    >
                      <div className="relative w-10 h-7 rounded overflow-hidden shrink-0 border border-[var(--color-border)] bg-black/40">
                        {item.img ? (
                          <Image src={item.img} alt={item.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-bold text-white truncate">{item.name}</span>
                            {item.isCounterRule ? (
                              <Badge variant="loss" size="xs">
                                Counter
                              </Badge>
                            ) : (
                              <Badge variant="win" size="xs">
                                Core
                              </Badge>
                            )}
                          </div>
                          {item.cost > 0 && (
                            <span className="text-[10px] font-mono font-bold text-amber-400 shrink-0">
                              {item.cost}g
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-0.5">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Baseline Popularity Build Timeline */}
      {baseline && (
        <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Statistical Baseline Build Timeline
            </h4>
            <span className="text-[10px] text-[var(--color-text-dim)]">From high-rank pub data</span>
          </div>

          {/* Starting Items */}
          {baseline.start_game_items?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">Starting Items:</span>
              <div className="flex flex-wrap gap-1.5">
                {baseline.start_game_items.slice(0, 6).map((item: any) => (
                  <div
                    key={item.id}
                    title={`${item.name} (${item.cost}g)`}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-canvas)] border border-[var(--color-border)] text-[11px] text-slate-200"
                  >
                    {item.img && (
                      <div className="relative w-4 h-3 rounded overflow-hidden">
                        <Image src={item.img} alt={item.name} fill className="object-cover" />
                      </div>
                    )}
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Early Game */}
          {baseline.early_game_items?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">Early Game:</span>
              <div className="flex flex-wrap gap-1.5">
                {baseline.early_game_items.slice(0, 6).map((item: any) => (
                  <div
                    key={item.id}
                    title={`${item.name} (${item.cost}g)`}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-canvas)] border border-[var(--color-border)] text-[11px] text-slate-200"
                  >
                    {item.img && (
                      <div className="relative w-4 h-3 rounded overflow-hidden">
                        <Image src={item.img} alt={item.name} fill className="object-cover" />
                      </div>
                    )}
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mid Game */}
          {baseline.mid_game_items?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">Mid Game Core:</span>
              <div className="flex flex-wrap gap-1.5">
                {baseline.mid_game_items.slice(0, 8).map((item: any) => (
                  <div
                    key={item.id}
                    title={`${item.name} (${item.cost}g)`}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-canvas)] border border-[var(--color-border)] text-[11px] text-slate-200"
                  >
                    {item.img && (
                      <div className="relative w-4 h-3 rounded overflow-hidden">
                        <Image src={item.img} alt={item.name} fill className="object-cover" />
                      </div>
                    )}
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Late Game */}
          {baseline.late_game_items?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">Late Game Luxury:</span>
              <div className="flex flex-wrap gap-1.5">
                {baseline.late_game_items.slice(0, 8).map((item: any) => (
                  <div
                    key={item.id}
                    title={`${item.name} (${item.cost}g)`}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-canvas)] border border-[var(--color-border)] text-[11px] text-slate-200"
                  >
                    {item.img && (
                      <div className="relative w-4 h-3 rounded overflow-hidden">
                        <Image src={item.img} alt={item.name} fill className="object-cover" />
                      </div>
                    )}
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
