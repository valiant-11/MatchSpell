import { describe, it, expect } from "vitest";
import { createSRSEntry, advanceSRS, failSRS, isDue, calculateSRSStats } from "../lib/srs";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Phase 5: Leitner Spaced Repetition Logic", () => {
  const BASE_TIME = 1700000000000; // Fixed timestamp for deterministic testing

  it("creates a new SRS entry in Box 1 due immediately", () => {
    const entry = createSRSEntry(17, 11, BASE_TIME);
    expect(entry.box).toBe(1);
    expect(entry.streak).toBe(0);
    expect(entry.nextDueDate).toBe(BASE_TIME);
    expect(isDue(entry, BASE_TIME)).toBe(true);
  });

  it("advances box through Leitner intervals (1 -> 2 -> 3 -> 4 -> 5)", () => {
    let entry = createSRSEntry(17, 11, BASE_TIME);

    // Box 1 -> Box 2 (interval: 1 day)
    entry = advanceSRS(entry, BASE_TIME);
    expect(entry.box).toBe(2);
    expect(entry.streak).toBe(1);
    expect(entry.nextDueDate).toBe(BASE_TIME + 1 * DAY_MS);
    expect(isDue(entry, BASE_TIME)).toBe(false);
    expect(isDue(entry, BASE_TIME + 1 * DAY_MS)).toBe(true);

    // Box 2 -> Box 3 (interval: 3 days)
    entry = advanceSRS(entry, BASE_TIME + 1 * DAY_MS);
    expect(entry.box).toBe(3);
    expect(entry.streak).toBe(2);
    expect(entry.nextDueDate).toBe(BASE_TIME + 1 * DAY_MS + 3 * DAY_MS);

    // Box 3 -> Box 4 (interval: 7 days)
    entry = advanceSRS(entry, BASE_TIME + 4 * DAY_MS);
    expect(entry.box).toBe(4);
    expect(entry.streak).toBe(3);
    expect(entry.nextDueDate).toBe(BASE_TIME + 4 * DAY_MS + 7 * DAY_MS);

    // Box 4 -> Box 5 (interval: 21 days)
    entry = advanceSRS(entry, BASE_TIME + 11 * DAY_MS);
    expect(entry.box).toBe(5);
    expect(entry.streak).toBe(4);
    expect(entry.nextDueDate).toBe(BASE_TIME + 11 * DAY_MS + 21 * DAY_MS);

    // Box 5 remains at Box 5 (capped)
    entry = advanceSRS(entry, BASE_TIME + 32 * DAY_MS);
    expect(entry.box).toBe(5);
    expect(entry.streak).toBe(5);
  });

  it("resets back to Box 1 immediately on wrong answer", () => {
    let entry = createSRSEntry(17, 11, BASE_TIME);
    // Advance to box 4
    entry = advanceSRS(entry, BASE_TIME);
    entry = advanceSRS(entry, BASE_TIME + 1 * DAY_MS);
    entry = advanceSRS(entry, BASE_TIME + 4 * DAY_MS);
    expect(entry.box).toBe(4);
    expect(entry.streak).toBe(3);

    // Now fail
    const failedTime = BASE_TIME + 5 * DAY_MS;
    entry = failSRS(entry, failedTime);
    expect(entry.box).toBe(1);
    expect(entry.streak).toBe(0);
    expect(entry.nextDueDate).toBe(failedTime);
    expect(isDue(entry, failedTime)).toBe(true);
    expect(entry.history[entry.history.length - 1].correct).toBe(false);
  });

  it("computes SRS dashboard statistics accurately", () => {
    const srsMap = {
      "17_11": {
        matchupKey: "17_11",
        myHeroId: 17,
        enemyHeroId: 11,
        box: 5,
        lastReviewDate: BASE_TIME,
        nextDueDate: BASE_TIME + 21 * DAY_MS,
        streak: 5,
        history: [],
      },
      "13_39": {
        matchupKey: "13_39",
        myHeroId: 13,
        enemyHeroId: 39,
        box: 4,
        lastReviewDate: BASE_TIME,
        nextDueDate: BASE_TIME + 7 * DAY_MS,
        streak: 3,
        history: [],
      },
      "25_74": {
        matchupKey: "25_74",
        myHeroId: 25,
        enemyHeroId: 74,
        box: 1,
        lastReviewDate: BASE_TIME,
        nextDueDate: BASE_TIME,
        streak: 0,
        history: [],
      },
    };

    const stats = calculateSRSStats(srsMap, BASE_TIME);
    expect(stats.totalCards).toBe(3);
    expect(stats.dueToday).toBe(1); // Only 25_74 is due at BASE_TIME
    expect(stats.memorized).toBe(2); // Box 4 and Box 5
    expect(stats.boxCounts[5]).toBe(1);
    expect(stats.boxCounts[4]).toBe(1);
    expect(stats.boxCounts[1]).toBe(1);
  });
});
