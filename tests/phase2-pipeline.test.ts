import { describe, it, expect } from "vitest";
import matchupsData from "../data/matchups.json";
import heroStatsData from "../data/hero-stats.json";
import durationsData from "../data/durations.json";
import itemPopData from "../data/item-popularity.json";
import { ALL_HEROES } from "../lib/heroes";

describe("Phase 2: Data Pipeline Integrity", () => {
  it("has hero stats for all 127 heroes", () => {
    const statsKeys = Object.keys(heroStatsData);
    expect(statsKeys.length).toBe(ALL_HEROES.length);

    for (const hero of ALL_HEROES) {
      const stat = (heroStatsData as Record<string, any>)[hero.id];
      expect(stat).toBeDefined();
      expect(stat.overallWr).toBeGreaterThan(0.3);
      expect(stat.overallWr).toBeLessThan(0.7);
      expect(stat.brackets).toBeDefined();
    }
  });

  it("has matchups matrix with smoothed adjWr and lowData flags", () => {
    const heroIds = ALL_HEROES.map((h) => h.id);

    // Test a sample hero (Storm Spirit: id 17)
    const stormMatchups = (matchupsData as Record<string, any>)["17"];
    expect(stormMatchups).toBeDefined();

    // Check vs Shadow Fiend (id 11)
    const vsSf = stormMatchups["11"];
    expect(vsSf).toBeDefined();
    expect(typeof vsSf.games).toBe("number");
    expect(typeof vsSf.wins).toBe("number");
    expect(typeof vsSf.adjWr).toBe("number");
    expect(typeof vsSf.delta).toBe("number");
    expect(typeof vsSf.lowData).toBe("boolean");
    expect(vsSf.lowData).toBe(vsSf.games < 30);

    // Verify smoothing formula: adjWr = (wins + 50 * heroWr) / (games + 50)
    const stormWr = (heroStatsData as Record<string, any>)["17"].brackets["8"]?.wr ??
                    (heroStatsData as Record<string, any>)["17"].overallWr;
    const expectedAdjWr = Number(((vsSf.wins + 50 * stormWr) / (vsSf.games + 50)).toFixed(4));
    expect(Math.abs(vsSf.adjWr - expectedAdjWr)).toBeLessThanOrEqual(0.001);
  });

  it("has durations data with earlyScore and lateScore for all heroes", () => {
    const durationKeys = Object.keys(durationsData);
    expect(durationKeys.length).toBe(ALL_HEROES.length);

    for (const hero of ALL_HEROES) {
      const dur = (durationsData as Record<string, any>)[hero.id];
      expect(dur).toBeDefined();
      expect(typeof dur.earlyScore).toBe("number");
      expect(typeof dur.lateScore).toBe("number");
      expect(Array.isArray(dur.buckets)).toBe(true);
    }
  });

  it("has item popularity with item images and localized names", () => {
    const itemKeys = Object.keys(itemPopData);
    expect(itemKeys.length).toBe(ALL_HEROES.length);

    // Check hero 1 (Anti-Mage)
    const amItems = (itemPopData as Record<string, any>)["1"];
    expect(amItems).toBeDefined();
    expect(Array.isArray(amItems.early_game_items)).toBe(true);
    expect(amItems.early_game_items.length).toBeGreaterThan(0);

    const firstItem = amItems.early_game_items[0];
    expect(firstItem.name).toBeDefined();
    expect(firstItem.img).toMatch(/^https:\/\/cdn\.cloudflare\.steamstatic\.com/);
  });
});
