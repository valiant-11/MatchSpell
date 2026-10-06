import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computePercentile,
  calculateTimingVerdict,
  getHeroRoleKeyItems,
  extractPersonalItemTimings,
  formatTimeSeconds,
  requestMatchParse,
  ROLE_KEY_ITEMS,
} from "@/lib/benchmarks";
import { RolePosition } from "@/lib/types";

describe("Phase 9: Item Timing Benchmarks (Role-Aware)", () => {
  describe("1. Percentile and Median Calculations", () => {
    it("computes accurate medians (p50) on odd and even length sample arrays", () => {
      const oddSamples = [600, 800, 900, 1000, 1200];
      expect(computePercentile(oddSamples, 50)).toBe(900);

      const evenSamples = [800, 900, 1000, 1200];
      expect(computePercentile(evenSamples, 50)).toBe(950);
    });

    it("computes p25 and p75 percentile thresholds accurately", () => {
      // 5 values: indices at 0, 1, 2, 3, 4
      // p25 is index 1 (800), p75 is index 3 (1000)
      const samples = [600, 800, 900, 1000, 1200];
      expect(computePercentile(samples, 25)).toBe(800);
      expect(computePercentile(samples, 75)).toBe(1000);
    });

    it("handles single-element and empty arrays gracefully", () => {
      expect(computePercentile([], 50)).toBe(0);
      expect(computePercentile([900], 50)).toBe(900);
      expect(computePercentile([900], 25)).toBe(900);
      expect(computePercentile([900], 75)).toBe(900);
    });

    it("formats seconds into mm:ss time display strings", () => {
      expect(formatTimeSeconds(920)).toBe("15:20");
      expect(formatTimeSeconds(600)).toBe("10:00");
      expect(formatTimeSeconds(65)).toBe("1:05");
      expect(formatTimeSeconds(5)).toBe("0:05");
    });
  });

  describe("2. Timing Verdict Thresholds", () => {
    const medianBenchmark = 1500; // 25:00 benchmark

    it("identifies early timings when purchase is > 60 seconds ahead of median", () => {
      // Purchased at 23:30 (90 seconds early)
      const verdict = calculateTimingVerdict(1410, medianBenchmark, "BKB");
      expect(verdict.status).toBe("early");
      expect(verdict.diffSeconds).toBe(-90);
      expect(verdict.verdict).toMatch(/early on BKB/i);
      expect(verdict.verdict).toContain("1:30");
    });

    it("identifies late timings when purchase is > 60 seconds behind median", () => {
      // Purchased at 28:10 (190 seconds late)
      const verdict = calculateTimingVerdict(1690, medianBenchmark, "BKB");
      expect(verdict.status).toBe("late");
      expect(verdict.diffSeconds).toBe(190);
      expect(verdict.verdict).toMatch(/late on BKB/i);
      expect(verdict.verdict).toContain("3:10");
    });

    it("identifies on-time timings within [-60s, +60s] window", () => {
      // Purchased at 25:30 (30 seconds diff)
      const verdict = calculateTimingVerdict(1530, medianBenchmark, "BKB");
      expect(verdict.status).toBe("on_time");
      expect(verdict.verdict).toBe("On time on BKB");

      // Purchased at 24:20 (-40 seconds diff)
      const verdictEarlyOnTime = calculateTimingVerdict(1460, medianBenchmark, "BKB");
      expect(verdictEarlyOnTime.status).toBe("on_time");
    });
  });

  describe("3. Role Key Items & Intersection", () => {
    it("defines distinct key items allowlists per position 1-5", () => {
      for (const role of [1, 2, 3, 4, 5] as RolePosition[]) {
        const items = ROLE_KEY_ITEMS[role];
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThanOrEqual(7);
      }

      // Carries get battlefury / manta / butterfly
      expect(ROLE_KEY_ITEMS[1]).toContain("bfury");
      expect(ROLE_KEY_ITEMS[1]).toContain("manta");

      // Mids get blink / orchid / bloodstone
      expect(ROLE_KEY_ITEMS[2]).toContain("blink");
      expect(ROLE_KEY_ITEMS[2]).toContain("orchid");

      // Offlaners get pipe / crimson / blademail
      expect(ROLE_KEY_ITEMS[3]).toContain("pipe");
      expect(ROLE_KEY_ITEMS[3]).toContain("crimson_guard");

      // Supports get glimmer / force / mekansm
      expect(ROLE_KEY_ITEMS[4]).toContain("glimmer_cape");
      expect(ROLE_KEY_ITEMS[5]).toContain("mekansm");
    });

    it("extracts intersection with hero popular items for Anti-Mage (Pos 1)", () => {
      const amKeyItems = getHeroRoleKeyItems(1, 1);
      expect(amKeyItems).toBeDefined();
      expect(amKeyItems).toContain("bfury");
      expect(amKeyItems).toContain("manta");
    });

    it("extracts intersection with hero popular items for Ember Spirit (Pos 2)", () => {
      const emberKeyItems = getHeroRoleKeyItems(106, 2);
      expect(emberKeyItems).toBeDefined();
      expect(emberKeyItems).toContain("black_king_bar");
    });
  });

  describe("4. Purchase Log Extraction & Unparsed Handling", () => {
    it("extracts first purchase timestamp for key items from purchase log", () => {
      const purchaseLog = [
        { item: "tango", time: -60 },
        { item: "quelling_blade", time: -50 },
        { item: "bfury", time: 880 },
        { item: "boots", time: 940 },
        { item: "manta", time: 1320 },
        { item: "bfury", time: 2400 }, // Second BF purchase (should be ignored)
      ];

      const keyItems = ["bfury", "manta", "black_king_bar"];
      const timings = extractPersonalItemTimings(purchaseLog, keyItems);

      expect(timings["bfury"]).toBe(880);
      expect(timings["manta"]).toBe(1320);
      expect(timings["black_king_bar"]).toBeUndefined();
    });

    it("handles requesting match parse on OpenDota with mock fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ job: { id: 12345 } }),
        } as Response)
      );

      const res = await requestMatchParse(7890123);
      expect(res.error).toBeUndefined();
      expect(res.job).toBeDefined();
    });

    it("handles rate limits (429) when requesting parse", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({}),
        } as Response)
      );

      const res = await requestMatchParse(7890123);
      expect(res.error).toMatch(/rate limit/i);
    });
  });
});
