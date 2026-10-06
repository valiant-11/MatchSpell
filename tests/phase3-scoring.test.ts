import { describe, it, expect } from "vitest";
import {
  calculateSmoothedDelta,
  scoreCandidate,
  rankCandidates,
  MODE_WEIGHTS,
  analyzeEnemyLane,
} from "../lib/scoring";
import { ALL_HEROES, getHeroById } from "../lib/heroes";
import { HeroPoolEntry } from "../lib/types";

describe("Phase 3: Scoring Math & Formulas", () => {
  it("calculates smoothed adjWr and delta correctly with K=50", () => {
    // Hero with 50% baseline wr, 60 wins out of 100 games
    // adjWr = (60 + 50 * 0.5) / (100 + 50) = 85 / 150 = 0.5667
    // delta = 0.5667 - 0.5 = +0.0667 (+6.67%)
    const res = calculateSmoothedDelta(60, 100, 0.5, 50);
    expect(res.adjWr).toBe(0.5667);
    expect(res.delta).toBe(0.0667);
  });

  it("dampens small sample sizes with smoothing K=50", () => {
    // 1 win out of 1 game: raw WR is 100%, but smoothed WR should be much closer to 50%
    const res = calculateSmoothedDelta(1, 1, 0.5, 50);
    // (1 + 25) / 51 = 26 / 51 = 0.5098
    expect(res.adjWr).toBe(0.5098);
    expect(res.delta).toBe(0.0098);
  });

  it("applies mode weights correctly across all 4 modes", () => {
    expect(MODE_WEIGHTS.balanced).toEqual({ wLane: 0.40, wFight: 0.40, wMacro: 0.20 });
    expect(MODE_WEIGHTS.lane).toEqual({ wLane: 0.60, wFight: 0.25, wMacro: 0.15 });
    expect(MODE_WEIGHTS.fight).toEqual({ wLane: 0.20, wFight: 0.65, wMacro: 0.15 });
    expect(MODE_WEIGHTS.macro).toEqual({ wLane: 0.20, wFight: 0.30, wMacro: 0.50 });

    // Mode weights must sum to 1.0
    for (const [mode, w] of Object.entries(MODE_WEIGHTS)) {
      const sum = Number((w.wLane + w.wFight + w.wMacro).toFixed(2));
      expect(sum).toBe(1.0);
    }
  });
});

describe("Phase 3: Pool Filtering & Candidate Ranking", () => {
  const puck = getHeroById(13)!; // Puck
  const storm = getHeroById(17)!; // Storm Spirit
  const am = getHeroById(1)!; // Anti-Mage

  const pool: Record<number, HeroPoolEntry> = {
    13: { heroId: 13, inPool: true, isMid: true, comfort: 3 },
    17: { heroId: 17, inPool: true, isMid: true, comfort: 2 },
    1: { heroId: 1, inPool: true, isMid: false, comfort: 2 },
  };

  it("ONLY considers heroes in the user pool", () => {
    const enemyPicks = [{ heroId: 11, position: 2 as const }]; // Enemy SF mid
    const ranked = rankCandidates(ALL_HEROES, pool, enemyPicks, "balanced", 2, false);

    const rankedIds = ranked.map((r) => r.hero.id);
    expect(rankedIds).toContain(13);
    expect(rankedIds).toContain(17);
    expect(rankedIds).toContain(1);
    // Hero not in pool must NOT appear
    expect(rankedIds).not.toContain(74); // Invoker not in pool
  });

  it("filters mid only candidates when filterMidOnly is enabled", () => {
    const enemyPicks = [{ heroId: 11, position: 2 as const }];
    const ranked = rankCandidates(ALL_HEROES, pool, enemyPicks, "balanced", 2, true);

    const rankedIds = ranked.map((r) => r.hero.id);
    expect(rankedIds).toContain(13); // Puck is mid
    expect(rankedIds).toContain(17); // Storm is mid
    expect(rankedIds).not.toContain(1); // AM is not mid
  });

  it("excludes enemy picks from candidate suggestions", () => {
    // If enemy picked Puck (13), candidate list must NOT suggest Puck
    const enemyPicks = [{ heroId: 13, position: 2 as const }];
    const ranked = rankCandidates(ALL_HEROES, pool, enemyPicks, "balanced", 2, true);

    const rankedIds = ranked.map((r) => r.hero.id);
    expect(rankedIds).not.toContain(13);
  });

  it("produces reasons and score breakdown bars", () => {
    const enemyPicks = [
      { heroId: 11, position: 2 as const }, // SF
      { heroId: 14, position: 4 as const }, // Pudge
    ];
    const score = scoreCandidate(puck, pool[13], enemyPicks, "lane", 2);

    expect(typeof score.laneScore).toBe("number");
    expect(typeof score.fightScore).toBe("number");
    expect(typeof score.macroScore).toBe("number");
    expect(typeof score.finalScore).toBe("number");
    expect(Array.isArray(score.reasons)).toBe(true);
    expect(score.reasons.length).toBeGreaterThan(0);
  });
});

describe("Phase 3: Enemy Lane Threat Analysis", () => {
  it("summarizes enemy lane threats", () => {
    const viper = getHeroById(47)!;
    const venomancer = getHeroById(40)!;

    const analysis = analyzeEnemyLane([viper, venomancer], "Safe Lane vs Offlane");
    expect(analysis.harassLevel).toBe("High");
    expect(analysis.summary).toContain("Heavy ranged");
  });

  it("awards Break counter bonus and reason for break heroes (Viper and Hoodwink) vs passive-heavy heroes (Bristleback)", () => {
    const viper = getHeroById(47)!; // Viper has break
    const hoodwink = getHeroById(123)!; // Hoodwink has break
    const bristleback = 99; // Bristleback has passive_heavy

    const enemyPicks = [{ heroId: bristleback, position: 3 as const }];

    const viperScore = scoreCandidate(viper, { heroId: 47, inPool: true, comfort: 2 }, enemyPicks, "fight", 2);
    expect(viperScore.reasons.some((r) => r.includes("Break") && r.includes("Bristleback"))).toBe(true);

    const hoodwinkScore = scoreCandidate(hoodwink, { heroId: 123, inPool: true, comfort: 2 }, enemyPicks, "fight", 4);
    expect(hoodwinkScore.reasons.some((r) => r.includes("Break") && r.includes("Bristleback"))).toBe(true);
  });
});
