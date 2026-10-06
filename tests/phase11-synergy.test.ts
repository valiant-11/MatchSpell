import { describe, it, expect } from "vitest";
import {
  isLanePartner,
  calculateTraitSynergy,
  calculateAllySynergy,
  getSynergyNormalizedWeights,
  AllyPick,
} from "../lib/synergy";
import { scoreCandidate, rankCandidates, EnemyPick } from "../lib/scoring";
import { Hero } from "../lib/types";

describe("Phase 11: Ally Synergy & Lane Partner Weighting", () => {
  it("identifies lane partners correctly for all positions", () => {
    // Pos 1 faces safe lane with Pos 5 support
    expect(isLanePartner(1, 5)).toBe(true);
    expect(isLanePartner(1, 4)).toBe(false);
    expect(isLanePartner(1, 2)).toBe(false);

    // Pos 2 is solo mid (no lane partner)
    expect(isLanePartner(2, 4)).toBe(false);
    expect(isLanePartner(2, 5)).toBe(false);

    // Pos 3 offlane lanes with Pos 4 soft support
    expect(isLanePartner(3, 4)).toBe(true);
    expect(isLanePartner(3, 5)).toBe(false);

    // Pos 4 soft support lanes with Pos 3 offlane
    expect(isLanePartner(4, 3)).toBe(true);
    expect(isLanePartner(4, 1)).toBe(false);

    // Pos 5 hard support lanes with Pos 1 carry
    expect(isLanePartner(5, 1)).toBe(true);
    expect(isLanePartner(5, 3)).toBe(false);
  });

  it("calculates trait synergy bonuses for complementary compositions", () => {
    // 1. Initiator + Follow-up AOE (+0.03)
    const initTags = ["blink_initiator", "aoe_disable"];
    const aoeTags = ["burst_magic", "mid_waveclear"];
    const result1 = calculateTraitSynergy(initTags, aoeTags);
    expect(result1.bonus).toBeGreaterThanOrEqual(0.03);
    expect(result1.reason).toContain("initiation + AOE follow-up");

    // 2. Save + Hypercarry (+0.03)
    const saveTags = ["save", "heal"];
    const carryTags = ["phys_carry"];
    const result2 = calculateTraitSynergy(carryTags, saveTags);
    expect(result2.bonus).toBeGreaterThanOrEqual(0.03);
    expect(result2.reason).toContain("save + hypercarry");

    // 3. Wave clear + Roamer (+0.02)
    const waveTags = ["mid_waveclear"];
    const roamerTags = ["mid_roamer"];
    const result3 = calculateTraitSynergy(waveTags, roamerTags);
    expect(result3.bonus).toBeGreaterThanOrEqual(0.02);
    expect(result3.reason).toContain("waveclear + roaming tempo");

    // 4. No synergy
    const neutralTags = ["passive_heavy"];
    const neutralTags2 = ["evasion"];
    const result4 = calculateTraitSynergy(neutralTags, neutralTags2);
    expect(result4.bonus).toBe(0);
  });

  it("weights lane partners 2x in ally synergy scoring", () => {
    const candidate: Hero = {
      id: 1, // Anti-Mage (Pos 1 carry)
      name: "antimage",
      localized_name: "Anti-Mage",
      primary_attr: "agi",
      attack_type: "Melee",
      roles: ["Carry", "Escape"],
      img: "/antimage.png",
    };

    const allies: AllyPick[] = [
      { heroId: 5, position: 5 }, // Pos 5 lane partner (weight 2.0)
      { heroId: 17, position: 2 }, // Pos 2 mid (weight 1.0)
    ];

    const mockSynergyData = {
      "1": {
        "5": { delta: 0.04, games: 150, lowData: false },
        "17": { delta: 0.01, games: 120, lowData: false },
      },
    };

    const mockTraitsData = {
      "1": { tags: [] },
      "5": { tags: [] },
      "17": { tags: [] },
    };

    const result = calculateAllySynergy(
      candidate,
      1,
      allies,
      mockSynergyData,
      mockTraitsData
    );

    // Expected weighted average:
    // (0.04 * 2.0 + 0.01 * 1.0) / (2.0 + 1.0) = 0.09 / 3.0 = 0.03
    expect(result.synergyScore).toBeCloseTo(0.03, 3);
    expect(result.details).toHaveLength(2);
    expect(result.details.find((d) => d.allyHeroId === 5)?.weight).toBe(2.0);
    expect(result.details.find((d) => d.allyHeroId === 17)?.weight).toBe(1.0);
  });

  it("handles missing synergy data gracefully with fallback 0 and lowData flag", () => {
    const candidate: Hero = {
      id: 1,
      name: "antimage",
      localized_name: "Anti-Mage",
      primary_attr: "agi",
      attack_type: "Melee",
      roles: ["Carry"],
      img: "/antimage.png",
    };

    const allies: AllyPick[] = [{ heroId: 999, position: 5 }];
    const emptySynergyData = {};
    const emptyTraitsData = {};

    const result = calculateAllySynergy(
      candidate,
      1,
      allies,
      emptySynergyData,
      emptyTraitsData
    );

    expect(result.synergyScore).toBe(0);
    expect(result.details[0].lowData).toBe(true);
    expect(result.details[0].pairDelta).toBe(0);
  });

  it("normalizes mode weights with wSynergy and adds +0.10 for supports", () => {
    const baseWeights = { wLane: 0.40, wFight: 0.40, wMacro: 0.20 };

    // 1. Balanced mode for core (pos 1): wSynergy = 0.25
    const balancedCore = getSynergyNormalizedWeights(baseWeights, "balanced", 1);
    expect(balancedCore.wSynergy).toBeCloseTo(0.25, 2);
    const sumCore =
      balancedCore.wLane + balancedCore.wFight + balancedCore.wMacro + balancedCore.wSynergy;
    expect(sumCore).toBeCloseTo(1.0, 3);

    // 2. Balanced mode for support (pos 5): wSynergy = 0.25 + 0.10 = 0.35
    const balancedSupport = getSynergyNormalizedWeights(baseWeights, "balanced", 5);
    expect(balancedSupport.wSynergy).toBeCloseTo(0.35, 2);
    const sumSupport =
      balancedSupport.wLane +
      balancedSupport.wFight +
      balancedSupport.wMacro +
      balancedSupport.wSynergy;
    expect(sumSupport).toBeCloseTo(1.0, 3);

    // 3. Lane mode: wSynergy = 0.10
    const laneWeights = getSynergyNormalizedWeights(baseWeights, "lane", 2);
    expect(laneWeights.wSynergy).toBeCloseTo(0.10, 2);
    expect(laneWeights.wLane + laneWeights.wFight + laneWeights.wMacro + laneWeights.wSynergy).toBeCloseTo(1.0, 3);

    // 4. Fight mode: wSynergy = 0.35
    const fightWeights = getSynergyNormalizedWeights(baseWeights, "fight", 3);
    expect(fightWeights.wSynergy).toBeCloseTo(0.35, 2);
    expect(fightWeights.wLane + fightWeights.wFight + fightWeights.wMacro + fightWeights.wSynergy).toBeCloseTo(1.0, 3);

    // 5. Macro mode: wSynergy = 0.20
    const macroWeights = getSynergyNormalizedWeights(baseWeights, "macro", 2);
    expect(macroWeights.wSynergy).toBeCloseTo(0.20, 2);
    expect(macroWeights.wLane + macroWeights.wFight + macroWeights.wMacro + macroWeights.wSynergy).toBeCloseTo(1.0, 3);
  });

  it("integrates ally synergy into scoreCandidate and generates combo reason", () => {
    const candidate: Hero = {
      id: 106,
      name: "ember_spirit",
      localized_name: "Ember Spirit",
      primary_attr: "agi",
      attack_type: "Melee",
      roles: ["Escape", "Nuker"],
      img: "/ember.png",
    };

    const enemyPicks: EnemyPick[] = [{ heroId: 11, position: 2 }];
    const allies: AllyPick[] = [{ heroId: 5, position: 5 }]; // Crystal Maiden

    const score = scoreCandidate(
      candidate,
      { heroId: 106, inPool: true, comfort: 2 },
      enemyPicks,
      "balanced",
      2,
      false,
      undefined,
      undefined,
      allies
    );

    expect(score.synergyScore).toBeDefined();
    expect(typeof score.synergyScore).toBe("number");
    expect(score.finalScore).toBeDefined();
  });

  it("excludes both picked enemies and allies from pool candidates in rankCandidates", () => {
    const allHeroes: Hero[] = [
      { id: 1, name: "antimage", localized_name: "Anti-Mage", primary_attr: "agi", attack_type: "Melee", roles: [], img: "" },
      { id: 2, name: "axe", localized_name: "Axe", primary_attr: "str", attack_type: "Melee", roles: [], img: "" },
      { id: 3, name: "bane", localized_name: "Bane", primary_attr: "int", attack_type: "Ranged", roles: [], img: "" },
      { id: 4, name: "bloodseeker", localized_name: "Bloodseeker", primary_attr: "agi", attack_type: "Melee", roles: [], img: "" },
    ];

    const userPool = {
      1: { heroId: 1, inPool: true, comfort: 2 },
      2: { heroId: 2, inPool: true, comfort: 2 },
      3: { heroId: 3, inPool: true, comfort: 2 },
      4: { heroId: 4, inPool: true, comfort: 2 },
    };

    const enemyPicks: EnemyPick[] = [{ heroId: 1, position: 1 }];
    const allies: AllyPick[] = [{ heroId: 2, position: 3 }];

    const ranked = rankCandidates(
      allHeroes,
      userPool,
      enemyPicks,
      "balanced",
      2,
      false,
      false,
      undefined,
      undefined,
      allies
    );

    const candidateIds = ranked.map((r) => r.hero.id);
    expect(candidateIds).not.toContain(1); // Excluded because picked as enemy
    expect(candidateIds).not.toContain(2); // Excluded because picked as ally
    expect(candidateIds).toContain(3);
    expect(candidateIds).toContain(4);
  });
});
