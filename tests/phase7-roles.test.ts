import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_ROLES,
  ROLE_DEFINITIONS,
  getOpposingLanePositions,
  getPrimaryOpponentRole,
  getLanePartnerRole,
  getHeroRoleFit,
  isHeroViableInRole,
  getViableHeroesForRole,
  inferEnemyPositions,
  generateRoleLanePlan,
} from "@/lib/roles";
import {
  DEFAULT_STATE,
  migrateUserState,
  toggleHeroRolePool,
  setHeroRoleComfort,
  getRolePool,
  saveUserState,
  loadUserState,
} from "@/lib/storage";
import {
  scoreCandidate,
  rankCandidates,
  ROLE_DEFAULT_WEIGHTS,
  getEffectiveWeights,
} from "@/lib/scoring";
import { calculateSRSStats, createSRSEntry } from "@/lib/srs";
import { getHeroById, ALL_HEROES } from "@/lib/heroes";

// Mock localStorage for Vitest node environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
  length: 0,
  key: () => null,
};
globalThis.window = {
  dispatchEvent: () => true,
} as unknown as Window & typeof globalThis;

describe("Phase 7: Roles & Core Architecture", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Role Definitions & Lane Opponent Mapping", () => {
    it("defines all 5 positions with valid metadata", () => {
      expect(ALL_ROLES).toEqual([1, 2, 3, 4, 5]);
      for (const r of ALL_ROLES) {
        const meta = ROLE_DEFINITIONS[r];
        expect(meta).toBeDefined();
        expect(meta.name).toBeDefined();
        expect(meta.shortName).toBe(`Pos ${r}`);
      }
    });

    it("maps opposing lane opponents per specification", () => {
      // pos 1 faces enemy pos 3 (+ pos 4/5)
      expect(getOpposingLanePositions(1)).toContain(3);
      expect(getPrimaryOpponentRole(1)).toBe(3);

      // pos 2 faces enemy pos 2
      expect(getOpposingLanePositions(2)).toEqual([2]);
      expect(getPrimaryOpponentRole(2)).toBe(2);

      // pos 3 faces enemy pos 1 (+ pos 5)
      expect(getOpposingLanePositions(3)).toContain(1);
      expect(getPrimaryOpponentRole(3)).toBe(1);

      // pos 4 faces opposing safe lane duo
      expect(getOpposingLanePositions(4)).toContain(1);

      // pos 5 faces offlane duo
      expect(getOpposingLanePositions(5)).toContain(3);
    });

    it("maps lane partners in standard 2-1-2 setups", () => {
      expect(getLanePartnerRole(1)).toBe(5); // Carry lanes with Hard Support
      expect(getLanePartnerRole(2)).toBeNull(); // Mid is solo
      expect(getLanePartnerRole(3)).toBe(4); // Offlaner lanes with Soft Support
      expect(getLanePartnerRole(4)).toBe(3);
      expect(getLanePartnerRole(5)).toBe(1);
    });

    it("infers enemy positions accurately from role suitability data", () => {
      // Lineup: Anti-Mage (1), Storm Spirit (17), Tidehunter (29), Lion (26), Crystal Maiden (5)
      const enemyIds = [1, 17, 29, 26, 5];
      const inferred = inferEnemyPositions(enemyIds);

      expect(inferred[1]).toBe(1); // Anti-Mage is Pos 1
      expect(inferred[17]).toBe(2); // Storm Spirit is Pos 2
      expect(inferred[29]).toBe(3); // Tidehunter is Pos 3
      expect(inferred[26]).toBe(4); // Lion is Pos 4
      expect(inferred[5]).toBe(5); // CM is Pos 5
    });

    it("evaluates hero role suitability and viability threshold (>= 0.15)", () => {
      // Anti-Mage (1): Viable carry, not viable support
      expect(isHeroViableInRole(1, 1)).toBe(true);
      expect(isHeroViableInRole(1, 5)).toBe(false);

      // Crystal Maiden (5): Viable support, not viable carry
      expect(isHeroViableInRole(5, 5)).toBe(true);
      expect(isHeroViableInRole(5, 1)).toBe(false);

      // Ember Spirit (106): Viable mid (pos 2) and carry (pos 1)
      expect(isHeroViableInRole(106, 2)).toBe(true);
      expect(isHeroViableInRole(106, 1)).toBe(true);

      const viablePos1 = getViableHeroesForRole(1, 0.15);
      expect(viablePos1.length).toBeGreaterThan(40);
    });
  });

  describe("2. Storage Migration from v1 (Mid-only) to v2 (Roles)", () => {
    it("migrates legacy v1 mid pool, notes, and SRS cards into Role 2", () => {
      const legacyState = {
        version: 1,
        pool: {
          106: { heroId: 106, inPool: true, isMid: true, comfort: 3 },
          17: { heroId: 17, inPool: true, isMid: true, comfort: 2 },
          1: { heroId: 1, inPool: true, isMid: false, comfort: 1 },
        },
        notes: {
          "106_11": {
            myHeroId: 106,
            enemyHeroId: 11,
            notes: "Bait shadowraze, rush bottle.",
            updatedAt: 1000,
          },
        },
        srs: {
          "106_11": {
            matchupKey: "106_11",
            myHeroId: 106,
            enemyHeroId: 11,
            box: 3,
            lastReviewDate: 500,
            nextDueDate: 2000,
            streak: 2,
            history: [],
          },
        },
        settings: { bracket: "8", theme: "dark", defaultMode: "balanced" },
      };

      const migrated = migrateUserState(legacyState);

      expect(migrated.version).toBe(2);
      // Role 2 pool should contain Ember (106) and Storm (17)
      expect(migrated.rolePool[2][106].inPool).toBe(true);
      expect(migrated.rolePool[2][106].comfort).toBe(3);
      expect(migrated.rolePool[2][17].inPool).toBe(true);

      // Notes should be migrated with role prefix 2_
      expect(migrated.notes["2_106_11"]).toBeDefined();
      expect(migrated.notes["2_106_11"].role).toBe(2);
      expect(migrated.notes["2_106_11"].notes).toBe("Bait shadowraze, rush bottle.");

      // SRS cards should be migrated to role 2
      expect(migrated.srs["2_106_11"]).toBeDefined();
      expect(migrated.srs["2_106_11"].role).toBe(2);
      expect(migrated.srs["2_106_11"].box).toBe(3);
    });

    it("persists per-role hero pools independently", () => {
      // Add hero 1 (AM) to Pos 1 pool
      toggleHeroRolePool(1, 1);
      setHeroRoleComfort(1, 1, 3);

      // Add hero 106 (Ember) to Pos 2 pool
      toggleHeroRolePool(2, 106);
      setHeroRoleComfort(2, 106, 2);

      const pos1Pool = getRolePool(1);
      const pos2Pool = getRolePool(2);

      expect(pos1Pool[1]?.inPool).toBe(true);
      expect(pos1Pool[1]?.comfort).toBe(3);
      expect(pos1Pool[106]?.inPool).toBeFalsy(); // Ember not in pos 1 pool

      expect(pos2Pool[106]?.inPool).toBe(true);
      expect(pos2Pool[1]?.inPool).toBeFalsy(); // AM not in pos 2 pool
    });
  });

  describe("3. Role-Weighted Draft Scoring Engine", () => {
    it("applies role default weights per specification in balanced mode", () => {
      // pos1: 0.25/0.35/0.40
      expect(ROLE_DEFAULT_WEIGHTS[1]).toEqual({ wLane: 0.25, wFight: 0.35, wMacro: 0.40 });
      // pos2: 0.40/0.30/0.30
      expect(ROLE_DEFAULT_WEIGHTS[2]).toEqual({ wLane: 0.40, wFight: 0.30, wMacro: 0.30 });
      // pos3: 0.35/0.40/0.25
      expect(ROLE_DEFAULT_WEIGHTS[3]).toEqual({ wLane: 0.35, wFight: 0.40, wMacro: 0.25 });
      // pos4: 0.30/0.50/0.20
      expect(ROLE_DEFAULT_WEIGHTS[4]).toEqual({ wLane: 0.30, wFight: 0.50, wMacro: 0.20 });
      // pos5: 0.30/0.50/0.20
      expect(ROLE_DEFAULT_WEIGHTS[5]).toEqual({ wLane: 0.30, wFight: 0.50, wMacro: 0.20 });

      const wPos1 = getEffectiveWeights("balanced", 1);
      expect(wPos1.wMacro).toBe(0.40);

      const wPos3 = getEffectiveWeights("balanced", 3);
      expect(wPos3.wFight).toBe(0.40);
    });

    it("filters draft candidates strictly to the user's pool for the selected role", () => {
      const ember = getHeroById(106)!;
      const storm = getHeroById(17)!;
      const am = getHeroById(1)!;

      // Pool for Pos 1 contains only AM
      const pos1Pool = {
        1: { heroId: 1, inPool: true, comfort: 3 },
      };

      const enemyPicks = [{ heroId: 11, position: 2 as const }];

      const pos1Ranked = rankCandidates(ALL_HEROES, pos1Pool, enemyPicks, "balanced", 1);
      expect(pos1Ranked.length).toBe(1);
      expect(pos1Ranked[0].hero.id).toBe(1);

      // Pool for Pos 2 contains only Ember & Storm
      const pos2Pool = {
        106: { heroId: 106, inPool: true, comfort: 3 },
        17: { heroId: 17, inPool: true, comfort: 2 },
      };

      const pos2Ranked = rankCandidates(ALL_HEROES, pos2Pool, enemyPicks, "balanced", 2);
      expect(pos2Ranked.length).toBe(2);
      expect(pos2Ranked.map((c) => c.hero.id)).toContain(106);
      expect(pos2Ranked.map((c) => c.hero.id)).toContain(17);
    });
  });

  describe("4. Role-Filtered Drill Queues & Plan Skeletons", () => {
    it("filters SRS cards and statistics by role or across all roles", () => {
      const cardPos1 = createSRSEntry(1, 29, 1); // AM vs Tide (Pos 1)
      const cardPos2 = createSRSEntry(106, 11, 2); // Ember vs SF (Pos 2)
      const cardPos5 = createSRSEntry(5, 29, 5); // CM vs Tide (Pos 5)

      const srsMap = {
        [cardPos1.matchupKey]: cardPos1,
        [cardPos2.matchupKey]: cardPos2,
        [cardPos5.matchupKey]: cardPos5,
      };

      const allStats = calculateSRSStats(srsMap, "all");
      expect(allStats.totalCards).toBe(3);

      const pos1Stats = calculateSRSStats(srsMap, 1);
      expect(pos1Stats.totalCards).toBe(1);

      const pos2Stats = calculateSRSStats(srsMap, 2);
      expect(pos2Stats.totalCards).toBe(1);
    });

    it("generates role-specific tactical plans for all 5 roles", () => {
      const am = getHeroById(1)!;
      const storm = getHeroById(17)!;
      const centaur = getHeroById(96)!;
      const rubick = getHeroById(86)!;
      const cm = getHeroById(5)!;
      const enemySf = getHeroById(11)!;

      // Pos 1 plan mentions CS and farm priority
      const planPos1 = generateRoleLanePlan(1, am, enemySf);
      expect(planPos1.role).toBe(1);
      expect(planPos1.prioritySection.title).toContain("Farm");

      // Pos 2 plan mentions rune control
      const planPos2 = generateRoleLanePlan(2, storm, enemySf);
      expect(planPos2.role).toBe(2);
      expect(planPos2.prioritySection.title).toContain("Rune");

      // Pos 3 plan mentions lane survival / equilibrium
      const planPos3 = generateRoleLanePlan(3, centaur, am, rubick);
      expect(planPos3.role).toBe(3);
      expect(planPos3.tradingSection.title).toContain("Carry");
      expect(planPos3.partnerSection).toBeDefined();

      // Pos 5 plan mentions pulling and saves
      const planPos5 = generateRoleLanePlan(5, cm, centaur, am);
      expect(planPos5.role).toBe(5);
      expect(planPos5.prioritySection.title).toContain("Pull");
      expect(planPos5.partnerSection).toBeDefined();
    });
  });
});
