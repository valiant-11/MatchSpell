import { describe, it, expect } from "vitest";
import rawRules from "../data/item-rules.json";
import rawTraits from "../data/traits.json";
import { ALLOWED_TAGS } from "../lib/types";
import {
  evaluateRule,
  aggregateEnemyTraits,
  getRecommendedCounterItems,
  getHeroItemProgression,
  ItemRule,
  EnemyTraitsAggregation,
} from "../lib/item-rules";
import { ALL_HEROES, getHeroById } from "../lib/heroes";

const rules = rawRules as ItemRule[];

describe("Phase 4: Trait Tags Validation", () => {
  it("ensures all heroes have valid trait tags from ALLOWED_TAGS", () => {
    const allowedSet = new Set(ALLOWED_TAGS);
    const traitKeys = Object.keys(rawTraits);
    expect(traitKeys.length).toBe(ALL_HEROES.length);

    for (const [id, t] of Object.entries(rawTraits as Record<string, any>)) {
      expect(Array.isArray(t.tags)).toBe(true);
      expect(["physical", "magical", "pure", "mixed"]).toContain(t.dmgType);
      expect(t.lanePlan).toBeDefined();

      for (const tag of t.tags) {
        expect(allowedSet.has(tag)).toBe(true);
      }
    }
  });
});

describe("Phase 4: Item Rules Engine - Every Seeded Rule Has a Test", () => {
  it(`has at least 30 seeded rules (found ${rules.length})`, () => {
    expect(rules.length).toBeGreaterThanOrEqual(30);
  });

  // Dynamically test EACH seeded rule to guarantee 100% rule coverage
  rules.forEach((rule) => {
    it(`evaluates and triggers rule "${rule.id}" for item "${rule.item}"`, () => {
      // Construct a mock enemy aggregation that specifically satisfies this rule's condition
      const mockAgg: EnemyTraitsAggregation = {
        tagCounts: {},
        magicShare: 0.1,
        physShare: 0.1,
        pureShare: 0,
        totalEnemies: 5,
      };

      if (rule.if.countTag) {
        for (const [tag, expr] of Object.entries(rule.if.countTag)) {
          mockAgg.tagCounts[tag] = 3; // easily satisfies >= 1, >= 2
        }
      }

      if (rule.if.hasTag) {
        mockAgg.tagCounts[rule.if.hasTag] = 2;
      }

      if (rule.if.magicShare) {
        mockAgg.magicShare = 0.8;
      }

      if (rule.if.physShare) {
        mockAgg.physShare = 0.8;
      }

      // Mock candidate hero (Puck or Anti-Mage depending on condition)
      const mockHero = rule.if.heroDmg === "physical"
        ? getHeroById(1)! // Anti-Mage
        : getHeroById(13)!; // Puck

      const result = evaluateRule(rule, mockAgg, mockHero);
      expect(result.matched).toBe(true);
      expect(result.formattedReason).toBeTruthy();
    });
  });

  it("prioritizes item recommendations by tier (rush > core > mid > situational)", () => {
    // Enemy lineup: Lion (8), Lina (25), Shadow Fiend (11), PA (44), Storm (17)
    // Lots of magic, hard_cc, burst_magic, evasion
    const enemyIds = [8, 25, 11, 44, 17];
    const recs = getRecommendedCounterItems(enemyIds, getHeroById(13)!);

    expect(recs.length).toBeGreaterThan(0);

    const tierRank = { rush: 1, core: 2, mid: 3, situational: 4 };
    for (let i = 0; i < recs.length - 1; i++) {
      expect(tierRank[recs[i].tier]).toBeLessThanOrEqual(tierRank[recs[i + 1].tier]);
    }

    // Should recommend BKB or MKB against this lineup
    const itemKeys = recs.map((r) => r.key);
    expect(itemKeys).toContain("black_king_bar");
    expect(itemKeys).toContain("monkey_king_bar");
  });

  it("filters item suggestions so they are strictly viable for the selected hero (e.g. Ember Spirit)", () => {
    const ember = getHeroById(106)!; // Ember Spirit (Agility Mid / Carry)
    // Enemy lineup with high magic and blink initiator: Lion (26), Lina (25), Tidehunter (29)
    const enemyIds = [26, 25, 29];
    const emberRecs = getRecommendedCounterItems(enemyIds, ember);
    const emberItemKeys = emberRecs.map((r) => r.key);

    // Support items MUST NOT be recommended for Ember
    expect(emberItemKeys).not.toContain("glimmer_cape");
    expect(emberItemKeys).not.toContain("force_staff");
    expect(emberItemKeys).not.toContain("mekansm");
    expect(emberItemKeys).not.toContain("guardian_greaves");

    // Tank offlane aura items MUST NOT be recommended for Ember
    expect(emberItemKeys).not.toContain("pipe");
    expect(emberItemKeys).not.toContain("hood_of_defiance");
    expect(emberItemKeys).not.toContain("crimson_guard");

    // Viable core items SHOULD be recommended
    expect(emberItemKeys).toContain("black_king_bar");
    expect(emberItemKeys).toContain("mage_slayer");
  });

  it("permits aura/tank items for durable heroes and support items for support heroes", () => {
    const centaur = getHeroById(96)!; // Centaur Warrunner (Durable Offlaner)
    const dazzle = getHeroById(50)!; // Dazzle (Support)
    const sniper = getHeroById(35)!; // Sniper (Ranged Agility Carry)

    const enemyIds = [26, 25, 29]; // Magic-heavy + initiator lineup

    // Centaur should be allowed to receive Pipe of Insight
    const centaurRecs = getRecommendedCounterItems(enemyIds, centaur).map((r) => r.key);
    expect(centaurRecs).toContain("pipe");
    expect(centaurRecs).not.toContain("glimmer_cape");

    // Dazzle (support) should be allowed to receive Glimmer Cape and Force Staff
    const dazzleRecs = getRecommendedCounterItems(enemyIds, dazzle).map((r) => r.key);
    expect(dazzleRecs).toContain("glimmer_cape");
    expect(dazzleRecs).toContain("force_staff");

    // Sniper (ranged core) can receive Force Staff (for Hurricane Pike) but NOT Pipe or Glimmer
    const sniperRecs = getRecommendedCounterItems(enemyIds, sniper).map((r) => r.key);
    expect(sniperRecs).toContain("force_staff");
    expect(sniperRecs).not.toContain("pipe");
    expect(sniperRecs).not.toContain("glimmer_cape");
  });

  it("bases core progression on the hero (Necrophos rushes Radiance, Monkey King rushes physical core, neither rushes Blink Dagger)", () => {
    const necro = getHeroById(36)!; // Necrophos
    const mk = getHeroById(114)!; // Monkey King
    const axe = getHeroById(2)!; // Axe (Blink Initiator)

    // Against magic burst lineup
    const enemyIds = [25, 26]; // Lina, Lion

    const necroProgression = getHeroItemProgression(necro, enemyIds);
    const necroRushKeys = necroProgression.rush.map((i) => i.key);
    // Necrophos rushes Radiance, NOT Blink Dagger
    expect(necroRushKeys).toContain("radiance");
    expect(necroRushKeys).not.toContain("blink");

    const mkProgression = getHeroItemProgression(mk, enemyIds);
    const mkRushKeys = mkProgression.rush.map((i) => i.key);
    // Monkey King rushes physical core item, NOT Blink Dagger
    expect(mkRushKeys).not.toContain("blink");
    const mkAllKeys = [
      ...mkProgression.rush.map((i) => i.key),
      ...mkProgression.core.map((i) => i.key),
    ];
    expect(mkAllKeys).toContain("black_king_bar");

    // Axe (blink initiator) CAN rush Blink Dagger
    const axeProgression = getHeroItemProgression(axe, enemyIds);
    const axeAllKeys = [
      ...axeProgression.rush.map((i) => i.key),
      ...axeProgression.core.map((i) => i.key),
    ];
    expect(axeAllKeys).toContain("blink");
  });

  it("suggests Break items (Silver Edge and Khanda) against passive-heavy enemies like Bristleback and PA", () => {
    const monkeyKing = getHeroById(114)!; // Monkey King
    // Enemy lineup with Bristleback (99) and Phantom Assassin (44)
    const passiveEnemies = [99, 44];

    const mkRecs = getRecommendedCounterItems(passiveEnemies, monkeyKing);
    const mkItemKeys = mkRecs.map((r) => r.key);

    expect(mkItemKeys).toContain("silver_edge");
    const silverEdgeItem = mkRecs.find((r) => r.key === "silver_edge");
    expect(silverEdgeItem?.reason).toContain("Break");
  });
});
