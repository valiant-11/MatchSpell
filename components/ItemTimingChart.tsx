"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  ROLE_KEY_ITEMS,
  getHeroRoleKeyItems,
  calculateTimingVerdict,
  formatTimeSeconds,
} from "@/lib/benchmarks";
import { RolePosition } from "@/lib/types";
import rawBenchmarks from "@/data/item-benchmarks.json";
import rawItems from "@/data/raw/items.raw.json";
import { Badge } from "@/components/ui/Badge";
import { Clock, AlertTriangle, CheckCircle2, TrendingUp, Info } from "lucide-react";

interface ItemTimingChartProps {
  heroId: number;
  role: RolePosition;
  personalTimings?: Record<string, number>; // itemName -> seconds
  title?: string;
}

const itemsDict = rawItems as Record<string, any>;
const benchmarksData = (rawBenchmarks as any).benchmarks;

export function ItemTimingChart({
  heroId,
  role,
  personalTimings = {},
  title = "Key Item Timing Benchmarks",
}: ItemTimingChartProps) {
  const isSupport = role === 4 || role === 5;

  const keyItems = useMemo(() => {
    return getHeroRoleKeyItems(heroId, role);
  }, [heroId, role]);

  const benchmarkItems = useMemo(() => {
    const roleBenchmarks = benchmarksData?.[String(role)]?.[String(heroId)] || {};
    return keyItems.map((itemKey) => {
      const benchmark = roleBenchmarks[itemKey] || {
        p25: 900,
        median: 1100,
        p75: 1300,
        sampleCount: 30,
      };
      const myTime = personalTimings[itemKey];
      const itemData = itemsDict[itemKey] || {
        dname: itemKey.replace(/_/g, " "),
        img: `/items/${itemKey}.png`,
      };
      const verdict = myTime !== undefined
        ? calculateTimingVerdict(myTime, benchmark.median, itemData.dname)
        : null;

      return {
        itemKey,
        dname: itemData.dname || itemKey,
        img: itemData.img ? `https://cdn.cloudflare.steamstatic.com${itemData.img}` : null,
        benchmark,
        myTime,
        verdict,
      };
    });
  }, [heroId, role, keyItems, personalTimings]);

  // Late items ordered by how far behind
  const lateItems = useMemo(() => {
    return benchmarkItems
      .filter((i) => i.verdict && i.verdict.status === "late")
      .sort((a, b) => b.verdict!.diffSeconds - a.verdict!.diffSeconds);
  }, [benchmarkItems]);

  const maxTimelineSeconds = 40 * 60; // 40 minutes scale

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            {title}
          </h3>
          <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
            Target first-purchase timings in winning high-rank games (p25 to p75 window with median target)
          </p>
        </div>

        {isSupport && (
          <Badge variant="info" size="sm">
            <Info className="w-3 h-3 mr-1" /> Support Context
          </Badge>
        )}
      </div>

      {/* Late Items Alert Box */}
      {lateItems.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Priority Item Delays ({lateItems.length})
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {lateItems.map((item) => (
              <span
                key={item.itemKey}
                className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <span>{item.dname}:</span>
                <span className="font-mono font-bold text-rose-400">
                  +{formatTimeSeconds(item.verdict!.diffSeconds)} late
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Item Timeline Rows */}
      <div className="space-y-3.5">
        {benchmarkItems.map((item) => {
          const { benchmark, myTime, verdict } = item;
          const p25Pct = Math.min(100, (benchmark.p25 / maxTimelineSeconds) * 100);
          const medianPct = Math.min(100, (benchmark.median / maxTimelineSeconds) * 100);
          const p75Pct = Math.min(100, (benchmark.p75 / maxTimelineSeconds) * 100);
          const myTimePct = myTime !== undefined ? Math.min(100, (myTime / maxTimelineSeconds) * 100) : null;

          return (
            <div
              key={item.itemKey}
              className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {item.img && (
                    <div className="relative w-7 h-5 rounded overflow-hidden border border-[var(--color-border)] shrink-0">
                      <Image
                        src={item.img}
                        alt={item.dname}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <span className="text-xs font-bold text-white">{item.dname}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-[11px] font-mono text-[var(--color-text-dim)]">
                    <span className="opacity-70">Median: </span>
                    <span className="text-amber-400 font-bold">{formatTimeSeconds(benchmark.median)}</span>
                    <span className="text-[var(--color-text-dim)] ml-1">({formatTimeSeconds(benchmark.p25)} - {formatTimeSeconds(benchmark.p75)})</span>
                  </div>

                  {verdict && (
                    <Badge
                      variant={
                        verdict.status === "early"
                          ? "win"
                          : verdict.status === "late"
                          ? "loss"
                          : "outline"
                      }
                      size="sm"
                    >
                      {verdict.verdict}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress Bar Timeline */}
              <div className="relative w-full h-3 bg-[var(--color-panel)] rounded-full overflow-hidden border border-[var(--color-border)]">
                {/* Benchmark Band [p25 to p75] */}
                <div
                  className="absolute top-0 bottom-0 bg-amber-500/25 border-x border-amber-500/60 rounded"
                  style={{
                    left: `${p25Pct}%`,
                    width: `${Math.max(2, p75Pct - p25Pct)}%`,
                  }}
                  title={`Winning Window: ${formatTimeSeconds(benchmark.p25)} to ${formatTimeSeconds(benchmark.p75)}`}
                />

                {/* Median Target Marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  style={{ left: `${medianPct}%` }}
                  title={`Median target: ${formatTimeSeconds(benchmark.median)}`}
                />

                {/* Personal Time Marker (if available) */}
                {myTimePct !== null && (
                  <div
                    className={`absolute -top-0.5 bottom-0 w-2 rounded-full border border-white z-10 ${
                      verdict?.status === "early"
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                        : verdict?.status === "late"
                        ? "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                        : "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                    }`}
                    style={{ left: `calc(${myTimePct}% - 4px)` }}
                    title={`Your time: ${formatTimeSeconds(myTime!)}`}
                  />
                )}
              </div>

              {/* Timestamp Labels */}
              <div className="flex justify-between text-[9px] font-mono text-[var(--color-text-dim)] px-0.5">
                <span>0:00</span>
                <span>10:00</span>
                <span>20:00</span>
                <span>30:00</span>
                <span>40:00+</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
