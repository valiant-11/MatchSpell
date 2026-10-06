import { describe, it, expect } from "vitest";
import {
  compareMatchups,
  compareHeroStats,
  compareRoleFits,
  compareItemPopularity,
  isMatchupStale,
  resetStaleCardToBox2,
  getSnapshotsToPrune,
} from "../lib/diff";
import { SRSEntry } from "../lib/types";

describe("Phase 10: Patch-Change Diff Engine", () => {
  it("flags matchups with delta shift >= 2.0% and minGames filter", () => {
    const oldMatchups = {
      "17": {
        "11": { delta: -0.05, adjWr: 0.45, games: 150 },
        "39": { delta: 0.01, adjWr: 0.51, games: 120 },
        "106": { delta: 0.03, adjWr: 0.53, games: 20 }, // below minGames
      },
    };

    const newMatchups = {
      "17": {
        "11": { delta: -0.01, adjWr: 0.49, games: 200 }, // +4.0% shift (>= 2.0%)
        "39": { delta: 0.015, adjWr: 0.515, games: 140 }, // +0.5% shift (< 2.0%)
        "106": { delta: 0.08, adjWr: 0.58, games: 25 }, // low games
      },
    };

    const diffs = compareMatchups(oldMatchups, newMatchups, 0.02, 100);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].myHeroId).toBe(17);
    expect(diffs[0].enemyHeroId).toBe(11);
    expect(diffs[0].deltaShift).toBeCloseTo(0.04, 4);
    expect(diffs[0].newGames).toBe(200);
  });

  it("filters out pairs where either snapshot has fewer than minGames", () => {
    const oldMatchups = {
      "1": {
        "2": { delta: 0.0, adjWr: 0.5, games: 80 }, // < 100
      },
    };
    const newMatchups = {
      "1": {
        "2": { delta: 0.05, adjWr: 0.55, games: 150 },
      },
    };

    const diffs = compareMatchups(oldMatchups, newMatchups, 0.02, 100);
    expect(diffs).toHaveLength(0);
  });

  it("identifies hero overall win rate shifts >= 1.5%", () => {
    const oldStats = {
      "17": { wr: 0.50 },
      "106": { wr: 0.52 },
    };
    const newStats = {
      "17": { wr: 0.525 }, // +2.5% (>= 1.5%)
      "106": { wr: 0.528 }, // +0.8% (< 1.5%)
    };

    const diffs = compareHeroStats(oldStats, newStats, 0.015);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].heroId).toBe(17);
    expect(diffs[0].shift).toBeCloseTo(0.025, 3);
  });

  it("identifies role suitability fit shifts >= 5%", () => {
    const oldHeroRoles = {
      "106": {
        roles: { 1: 0.40, 2: 0.60, 3: 0.0, 4: 0.0, 5: 0.0 },
      },
    };
    const newHeroRoles = {
      "106": {
        roles: { 1: 0.85, 2: 0.95, 3: 0.0, 4: 0.0, 5: 0.0 },
      },
    };

    const diffs = compareRoleFits(oldHeroRoles, newHeroRoles, 0.05);
    expect(diffs.length).toBeGreaterThanOrEqual(2);
    const pos1Shift = diffs.find((d) => d.heroId === 106 && d.role === 1);
    expect(pos1Shift).toBeDefined();
    expect(pos1Shift?.shift).toBeCloseTo(0.45, 2);
  });

  it("detects items entering and leaving top 6 builds", () => {
    const oldPop = {
      "17": {
        early_game_items: [{ key: "bottle" }, { key: "boots" }],
        mid_game_items: [{ key: "witch_blade" }, { key: "orchid" }],
        late_game_items: [{ key: "bloodstone" }, { key: "bkb" }],
      },
    };
    const newPop = {
      "17": {
        early_game_items: [{ key: "bottle" }, { key: "boots" }],
        mid_game_items: [{ key: "kaya_and_sange" }, { key: "orchid" }], // kaya_and_sange entered, witch_blade left
        late_game_items: [{ key: "bloodstone" }, { key: "bkb" }],
      },
    };

    const shifts = compareItemPopularity(oldPop, newPop);
    expect(shifts.some((s) => s.item === "kaya_and_sange" && s.changeType === "entered_top6")).toBe(true);
    expect(shifts.some((s) => s.item === "witch_blade" && s.changeType === "left_top6")).toBe(true);
  });

  it("correctly flags matchup staleness for user cards", () => {
    const matchupDiffs = [
      {
        myHeroId: 17,
        enemyHeroId: 11,
        oldDelta: -0.05,
        newDelta: -0.01,
        deltaShift: 0.04,
        oldAdjWr: 0.45,
        newAdjWr: 0.49,
        oldGames: 120,
        newGames: 180,
      },
    ];

    expect(isMatchupStale(17, 11, matchupDiffs)).toBe(true);
    expect(isMatchupStale(17, 39, matchupDiffs)).toBe(false);
  });

  it("resets stale SRS cards to Box 2 with 1-day interval", () => {
    const oldCard: SRSEntry = {
      matchupKey: "2_17_11",
      myHeroId: 17,
      enemyHeroId: 11,
      role: 2,
      box: 5,
      streak: 8,
      lastReviewDate: 100000,
      nextDueDate: 200000,
      history: [],
    };

    const resetCard = resetStaleCardToBox2(oldCard);
    expect(resetCard.box).toBe(2);
    expect(resetCard.streak).toBe(1);
    expect(resetCard.nextDueDate).toBeGreaterThan(Date.now());
  });

  it("correctly prunes snapshots keeping only the last 5", () => {
    const snapshots = [
      "2026-08-01",
      "2026-08-05",
      "2026-08-10",
      "2026-08-15",
      "2026-08-20",
      "2026-08-25",
      "2026-08-30",
    ];

    const toPrune = getSnapshotsToPrune(snapshots, 5);
    expect(toPrune).toEqual(["2026-08-01", "2026-08-05"]);

    // If 5 or fewer, prune none
    expect(getSnapshotsToPrune(["2026-08-20", "2026-08-25"], 5)).toEqual([]);
  });
});
