import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  inferMatchRole,
  determineOpponents,
  calculateSmoothedWinRate,
  calculateSmoothedDelta,
  aggregatePersonalStats,
  computeWeakSpots,
  fetchOpenDotaMatches,
} from "@/lib/player-stats";
import { PersonalMatchRecord, RolePosition, PersonalStatsSummary } from "@/lib/types";

describe("Phase 8: Personal Stats Engine (Role-Aware)", () => {
  describe("1. Role Inference from Match Meta & Suitability", () => {
    it("infers Mid (Pos 2) when lane_role is 2", () => {
      // Storm Spirit (17), mid lane
      expect(inferMatchRole(17, 0, 2, false)).toBe(2);
      // Ember Spirit (106), mid lane
      expect(inferMatchRole(106, 0, 2, false)).toBe(2);
    });

    it("infers Soft Support / Roamer (Pos 4) when is_roaming is true or lane_role is 4", () => {
      // Earth Spirit (107), roaming
      expect(inferMatchRole(107, 0, 1, true)).toBe(4);
      expect(inferMatchRole(107, 0, 4, false)).toBe(4);
    });

    it("disambiguates Safe Lane (lane_role 1) between Carry (Pos 1) and Hard Support (Pos 5)", () => {
      // Anti-Mage (1): carry fit is high -> Pos 1
      expect(inferMatchRole(1, 0, 1, false)).toBe(1);

      // Crystal Maiden (5): support fit is high -> Pos 5
      expect(inferMatchRole(5, 0, 1, false)).toBe(5);

      // Drow Ranger (6): Carry -> Pos 1
      expect(inferMatchRole(6, 0, 1, false)).toBe(1);
    });

    it("disambiguates Off Lane (lane_role 3) between Offlane Core (Pos 3) and Soft Support (Pos 4)", () => {
      // Tidehunter (29): core offlaner -> Pos 3
      expect(inferMatchRole(29, 0, 3, false)).toBe(3);

      // Lion (26): support -> Pos 4
      expect(inferMatchRole(26, 0, 3, false)).toBe(4);
    });

    it("falls back to hero primary role fit when lane_role is missing", () => {
      // Anti-Mage with undefined lane_role -> Pos 1
      expect(inferMatchRole(1, 0, undefined, false)).toBe(1);
      // Invoker (74) with undefined lane_role -> Pos 2
      expect(inferMatchRole(74, 0, undefined, false)).toBe(2);
      // Axe (2) with undefined lane_role -> Pos 3
      expect(inferMatchRole(2, 0, undefined, false)).toBe(3);
    });
  });

  describe("2. Lane Opponent Mapping in Match Context", () => {
    const enemies = [
      { heroId: 1, role: 1 as RolePosition }, // AM (carry)
      { heroId: 106, role: 2 as RolePosition }, // Ember (mid)
      { heroId: 29, role: 3 as RolePosition }, // Tide (offlane)
      { heroId: 26, role: 4 as RolePosition }, // Lion (soft sup)
      { heroId: 5, role: 5 as RolePosition }, // CM (hard sup)
    ];

    it("maps Pos 1 Carry to enemy Pos 3 + Pos 4", () => {
      const opps = determineOpponents(1, enemies);
      expect(opps).toContain(29); // Tide
      expect(opps).toContain(26); // Lion
    });

    it("maps Pos 2 Mid to enemy Pos 2 Mid", () => {
      const opps = determineOpponents(2, enemies);
      expect(opps).toEqual([106]); // Ember
    });

    it("maps Pos 3 Offlane to enemy Pos 1 + Pos 5", () => {
      const opps = determineOpponents(3, enemies);
      expect(opps).toContain(1); // AM
      expect(opps).toContain(5); // CM
    });
  });

  describe("3. Bayesian Smoothing towards Global Matchup Baseline (K=10)", () => {
    it("returns global win rate when personal games is 0", () => {
      const globalWr = 0.54;
      const smoothed = calculateSmoothedWinRate(0, 0, globalWr, 10);
      expect(smoothed).toBe(0.54);
    });

    it("smooths small samples heavily towards global baseline", () => {
      const globalWr = 0.50;
      // 1 game, 1 win: without smoothing it would be 100%
      // With K=10: (1 + 10 * 0.5) / (1 + 10) = 6.0 / 11 = ~0.545
      const smoothed = calculateSmoothedWinRate(1, 1, globalWr, 10);
      expect(smoothed).toBeCloseTo(6 / 11, 3);
    });

    it("gives higher weight to personal data as sample size grows", () => {
      const globalWr = 0.50;
      // 100 games, 80 wins:
      // (80 + 10 * 0.5) / (100 + 10) = 85 / 110 = ~0.772
      const smoothed = calculateSmoothedWinRate(80, 100, globalWr, 10);
      expect(smoothed).toBeCloseTo(85 / 110, 3);
      expect(smoothed).toBeGreaterThan(0.75);
    });

    it("computes smoothed delta relative to hero overall win rate", () => {
      const globalWr = 0.52;
      const heroOverallWr = 0.50;
      const delta = calculateSmoothedDelta(4, 5, globalWr, heroOverallWr, 10);
      // (4 + 10 * 0.52) / (5 + 10) = 9.2 / 15 = 0.6133
      // delta = 0.6133 - 0.50 = 0.1133
      expect(delta).toBeCloseTo(0.1133, 3);
    });
  });

  describe("4. Aggregations Grouped Strictly by Role", () => {
    const mockMatches: PersonalMatchRecord[] = [
      {
        matchId: 101,
        startTime: 1000,
        duration: 2100,
        myHeroId: 106, // Ember Spirit
        role: 2, // Played as Mid
        won: true,
        allies: [1, 2, 3, 4],
        enemies: [11, 74, 17, 26, 5],
        opponents: [11],
        isParsed: true,
      },
      {
        matchId: 102,
        startTime: 2000,
        duration: 1800,
        myHeroId: 106,
        role: 2, // Played as Mid
        won: false,
        allies: [1, 2, 3, 4],
        enemies: [11, 74, 17, 26, 5],
        opponents: [11],
        isParsed: true,
      },
      {
        matchId: 103,
        startTime: 3000,
        duration: 2400,
        myHeroId: 106,
        role: 1, // Played as Carry
        won: true,
        allies: [10, 20, 30, 40],
        enemies: [29, 26, 11, 74, 17],
        opponents: [29, 26],
        isParsed: false,
      },
    ];

    it("aggregates match counts and win rates separated by role", () => {
      const summary = aggregatePersonalStats(mockMatches, "123456");

      expect(summary.totalMatches).toBe(3);
      expect(summary.parsedMatches).toBe(2);
      expect(summary.roleGames[2]).toBe(2);
      expect(summary.roleGames[1]).toBe(1);
      expect(summary.roleGames[3]).toBe(0);

      // Hero stats in Pos 2: Ember 1W - 1L (50%)
      const emberPos2 = summary.heroStats[2][106];
      expect(emberPos2).toBeDefined();
      expect(emberPos2.games).toBe(2);
      expect(emberPos2.wins).toBe(1);
      expect(emberPos2.winRate).toBe(0.5);

      // Hero stats in Pos 1: Ember 1W - 0L (100%)
      const emberPos1 = summary.heroStats[1][106];
      expect(emberPos1).toBeDefined();
      expect(emberPos1.games).toBe(1);
      expect(emberPos1.wins).toBe(1);
      expect(emberPos1.winRate).toBe(1.0);

      // Matchup stats in Pos 2: Ember vs SF (11)
      const vsSF = summary.matchupStats[2]["106_11"];
      expect(vsSF).toBeDefined();
      expect(vsSF.games).toBe(2);
      expect(vsSF.wins).toBe(1);
      expect(vsSF.recentResults).toEqual(["win", "loss"]);
    });
  });

  describe("5. Weak Spots Ordering (Loss Rate x Frequency)", () => {
    it("sorts matchups by impact score = (1 - winRate) * games", () => {
      const mockSummary: PersonalStatsSummary = {
        totalMatches: 20,
        parsedMatches: 10,
        lastImportTime: Date.now(),
        roleGames: { 1: 0, 2: 20, 3: 0, 4: 0, 5: 0 },
        heroStats: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
        matchupStats: {
          1: {},
          2: {
            // Matchup A: 10 games, 2 wins (20% WR, losses = 8, score = 0.8 * 10 = 8.0)
            "106_11": {
              role: 2,
              myHeroId: 106,
              enemyHeroId: 11,
              games: 10,
              wins: 2,
              winRate: 0.20,
              smoothedWr: 0.32,
              smoothedDelta: -0.18,
              recentResults: ["loss", "loss"],
            },
            // Matchup B: 4 games, 1 win (25% WR, losses = 3, score = 0.75 * 4 = 3.0)
            "106_74": {
              role: 2,
              myHeroId: 106,
              enemyHeroId: 74,
              games: 4,
              wins: 1,
              winRate: 0.25,
              smoothedWr: 0.40,
              smoothedDelta: -0.10,
              recentResults: ["loss"],
            },
            // Matchup C: High win rate (70% WR) -> Should NOT be a weak spot
            "106_17": {
              role: 2,
              myHeroId: 106,
              enemyHeroId: 17,
              games: 6,
              wins: 5,
              winRate: 0.83,
              smoothedWr: 0.65,
              smoothedDelta: +0.15,
              recentResults: ["win"],
            },
          },
          3: {},
          4: {},
          5: {},
        },
      };

      const weakSpots = computeWeakSpots(mockSummary, 2, 3, 0.45);

      expect(weakSpots.length).toBe(2);
      expect(weakSpots[0].enemyHeroId).toBe(11); // Matchup A has highest score (8.0)
      expect(weakSpots[0].score).toBe(8.0);
      expect(weakSpots[1].enemyHeroId).toBe(74); // Matchup B has score 3.0
      expect(weakSpots[1].score).toBe(3.0);
    });
  });

  describe("6. Private Profile & Error Handling (Mocked)", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns a descriptive error message when account profile is private (404 / no matches)", async () => {
      // Mock global fetch returning 404
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({}),
        } as Response)
      );

      const result = await fetchOpenDotaMatches("99999999");
      expect(result.matches).toEqual([]);
      expect(result.error).toMatch(/private/i);
    });

    it("rejects invalid non-numeric account IDs before making API calls", async () => {
      const result = await fetchOpenDotaMatches("invalid_id");
      expect(result.matches).toEqual([]);
      expect(result.error).toMatch(/numeric/i);
    });
  });
});
