import rawRules from "@/data/item-rules.json";
import rawTraits from "@/data/traits.json";
import rawItems from "@/data/raw/items.raw.json";
import itemPopData from "@/data/item-popularity.json";
import { Hero } from "./types";

export interface ItemRule {
  id: string;
  roles?: number[]; // optional role restrictions (1 to 5)
  if: {
    countTag?: Record<string, string>;
    hasTag?: string;
    magicShare?: string;
    physShare?: string;
    heroDmg?: "physical" | "magical" | "pure" | "mixed";
    heroRole?: "core" | "support";
  };
  item: string;
  tier: "rush" | "core" | "mid" | "situational";
  reason: string;
}

export interface RecommendedItem {
  key: string;
  name: string;
  img: string;
  cost: number;
  tier: "rush" | "core" | "mid" | "situational";
  reason: string;
  isCounterRule: boolean;
}

export interface EnemyTraitsAggregation {
  tagCounts: Record<string, number>;
  magicShare: number;
  physShare: number;
  pureShare: number;
  totalEnemies: number;
}

const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";
const rules = rawRules as ItemRule[];
const traitsMap = rawTraits as Record<string, { tags: string[]; dmgType: "physical" | "magical" | "pure" | "mixed" }>;
const itemsDb = rawItems as unknown as Record<string, { id: number; dname?: string; img?: string; cost?: number | null }>;

export function getItemMeta(itemKey: string): { key: string; name: string; img: string; cost: number } {
  let resolvedKey = itemKey;
  if (itemKey === "khanda") {
    resolvedKey = "angels_demise";
  }
  const item = itemsDb[resolvedKey];
  if (!item) {
    return { key: itemKey, name: itemKey === "angels_demise" ? "Khanda" : itemKey, img: "", cost: 0 };
  }
  let img = item.img || "";
  if (img.startsWith("/")) img = `${STEAM_CDN}${img}`;
  else if (img && !img.startsWith("http")) img = `${STEAM_CDN}/${img}`;
  return {
    key: itemKey,
    name: item.dname || (itemKey === "angels_demise" ? "Khanda" : itemKey),
    img,
    cost: item.cost || 0,
  };
}

/**
 * Aggregates traits across all enemy heroes
 */
export function aggregateEnemyTraits(enemyHeroIds: number[]): EnemyTraitsAggregation {
  const tagCounts: Record<string, number> = {};
  let magicPoints = 0;
  let physPoints = 0;
  let purePoints = 0;

  for (const id of enemyHeroIds) {
    const t = traitsMap[String(id)];
    if (!t) continue;

    (t.tags || []).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    if (t.dmgType === "magical") magicPoints += 1.0;
    else if (t.dmgType === "physical") physPoints += 1.0;
    else if (t.dmgType === "pure") purePoints += 1.0;
    else if (t.dmgType === "mixed") {
      magicPoints += 0.5;
      physPoints += 0.5;
    }
  }

  const total = enemyHeroIds.length || 1;

  return {
    tagCounts,
    magicShare: magicPoints / total,
    physShare: physPoints / total,
    pureShare: purePoints / total,
    totalEnemies: enemyHeroIds.length,
  };
}

/**
 * Parses numeric condition expressions like ">=2", ">=0.5", ">1", "=3"
 */
function testComparison(val: number, expr: string): boolean {
  if (expr.startsWith(">=")) {
    return val >= parseFloat(expr.slice(2));
  }
  if (expr.startsWith("<=")) {
    return val <= parseFloat(expr.slice(2));
  }
  if (expr.startsWith(">")) {
    return val > parseFloat(expr.slice(1));
  }
  if (expr.startsWith("<")) {
    return val < parseFloat(expr.slice(1));
  }
  if (expr.startsWith("=")) {
    return val === parseFloat(expr.slice(1));
  }
  return val >= parseFloat(expr);
}

/**
 * Evaluates a single rule against enemy aggregated traits and candidate hero context
 */
export function evaluateRule(
  rule: ItemRule,
  enemyAgg: EnemyTraitsAggregation,
  candidateHero?: Hero,
  targetRole?: number
): { matched: boolean; formattedReason: string } {
  // Check optional role condition
  if (rule.roles && targetRole && !rule.roles.includes(targetRole)) {
    return { matched: false, formattedReason: "" };
  }

  const cond = rule.if;

  // 1. countTag condition
  if (cond.countTag) {
    for (const [tag, expr] of Object.entries(cond.countTag)) {
      const count = enemyAgg.tagCounts[tag] || 0;
      if (!testComparison(count, expr)) {
        return { matched: false, formattedReason: "" };
      }
    }
  }

  // 2. hasTag condition
  if (cond.hasTag) {
    if ((enemyAgg.tagCounts[cond.hasTag] || 0) <= 0) {
      return { matched: false, formattedReason: "" };
    }
  }

  // 3. magicShare condition
  if (cond.magicShare) {
    if (!testComparison(enemyAgg.magicShare, cond.magicShare)) {
      return { matched: false, formattedReason: "" };
    }
  }

  // 4. physShare condition
  if (cond.physShare) {
    if (!testComparison(enemyAgg.physShare, cond.physShare)) {
      return { matched: false, formattedReason: "" };
    }
  }

  // 5. heroDmg condition
  if (cond.heroDmg && candidateHero) {
    const candTrait = traitsMap[String(candidateHero.id)];
    if (candTrait && candTrait.dmgType !== cond.heroDmg && candTrait.dmgType !== "mixed") {
      return { matched: false, formattedReason: "" };
    }
  }

  // 6. heroRole condition
  if (cond.heroRole && candidateHero) {
    const isCore = candidateHero.roles.includes("Carry") || candidateHero.roles.includes("Nuker");
    if (cond.heroRole === "core" && !isCore) {
      return { matched: false, formattedReason: "" };
    }
    if (cond.heroRole === "support" && !candidateHero.roles.includes("Support")) {
      return { matched: false, formattedReason: "" };
    }
  }

  // Format reason with interpolation
  let reason = rule.reason;
  if (cond.countTag) {
    const firstTag = Object.keys(cond.countTag)[0];
    const n = enemyAgg.tagCounts[firstTag] || 0;
    reason = reason.replace("{n}", String(n));
  }

  return { matched: true, formattedReason: reason };
}

/**
 * Checks whether an item is viable for the candidate hero based on role, archetype, and high-rank pub data.
 */
export function isItemViableForHero(itemKey: string, hero: Hero): boolean {
  const isSupport = hero.roles.includes("Support");
  const isDurable = hero.roles.includes("Durable");
  const isCarry = hero.roles.includes("Carry");

  // Support-only items: Never recommend for carry / mid cores
  const SUPPORT_ONLY = ["glimmer_cape", "mekansm", "guardian_greaves"];
  if (SUPPORT_ONLY.includes(itemKey) && !isSupport) {
    return false;
  }

  // Force Staff: only viable for supports or ranged cores (who build Hurricane Pike)
  // Melee cores (e.g. Ember Spirit, Anti-Mage, Void, PA, Slark) should never be suggested Force Staff
  if (itemKey === "force_staff") {
    if (!isSupport && hero.attack_type === "Melee") {
      return false;
    }
  }

  // Tank / Offlane Aura items: Pipe of Insight, Hood of Defiance, Crimson Guard
  // Not viable for agile / tempo mid cores (Ember Spirit, Storm, Puck, SF, QoP, Morphling, TA, etc.)
  const TANK_AURA_ITEMS = ["pipe", "hood_of_defiance", "crimson_guard"];
  if (TANK_AURA_ITEMS.includes(itemKey) && !isDurable) {
    return false;
  }

  // Ghost Scepter: only for supports or squishy int casters, never for melee agility/strength carry cores
  if (itemKey === "ghost" && !isSupport && hero.attack_type === "Melee" && hero.primary_attr !== "int") {
    return false;
  }

  // Blink Dagger: only viable for heroes who actually initiate with Blink or have blink_initiator tag
  if (itemKey === "blink") {
    const heroTrait = traitsMap[String(hero.id)];
    const isBlinkInitiator = heroTrait?.tags?.includes("blink_initiator");
    if (!isBlinkInitiator) {
      return false;
    }
  }

  // Break items:
  // Silver Edge: physical / agility / core heroes who attack from invis
  if (itemKey === "silver_edge") {
    if (isSupport && !isCarry) return false;
    return isCarry || hero.attack_type === "Melee" || hero.primary_attr === "agi" || hero.primary_attr === "str";
  }

  // Khanda (angels_demise): unit-target burst right-click cores
  if (itemKey === "angels_demise" || itemKey === "khanda") {
    if (isSupport && !isCarry) return false;
    return true;
  }

  // Pub popularity: if high-rank players actually purchase this item on this hero, it is viable
  const heroPop = (itemPopData as Record<string, any>)[String(hero.id)];
  if (heroPop) {
    const allPhases = [
      ...(heroPop.start_game_items || []),
      ...(heroPop.early_game_items || []),
      ...(heroPop.mid_game_items || []),
      ...(heroPop.late_game_items || []),
    ];
    if (allPhases.some((i: any) => i.key === itemKey)) {
      return true;
    }
  }

  // Satanic: only for carry/physical cores
  if (itemKey === "satanic") {
    return isCarry || hero.primary_attr !== "int";
  }

  // Monkey King Bar: right-click cores
  if (itemKey === "monkey_king_bar") {
    return isCarry || !isSupport;
  }

  return true;
}

/**
 * Evaluates all rules and outputs recommended items grouped and ordered by tier:
 * rush > core > mid > situational
 */
export function getRecommendedCounterItems(
  enemyHeroIds: number[],
  candidateHero?: Hero,
  targetRole?: number,
  baselineItems?: { key: string; name: string; img: string; cost: number; phase: string }[]
): RecommendedItem[] {
  const agg = aggregateEnemyTraits(enemyHeroIds);
  const matchedRules: RecommendedItem[] = [];
  const seenItems = new Set<string>();

  for (const rule of rules) {
    // If candidateHero is specified, filter out non-viable items for that hero archetype
    if (candidateHero && !isItemViableForHero(rule.item, candidateHero)) {
      continue;
    }

    const evalRes = evaluateRule(rule, agg, candidateHero, targetRole);
    if (evalRes.matched && !seenItems.has(rule.item)) {
      seenItems.add(rule.item);
      const meta = getItemMeta(rule.item);
      matchedRules.push({
        key: rule.item,
        name: meta.name,
        img: meta.img,
        cost: meta.cost,
        tier: rule.tier,
        reason: evalRes.formattedReason,
        isCounterRule: true,
      });
    }
  }

  // Group and re-order by tier: rush > core > mid > situational
  const tierRank: Record<RecommendedItem["tier"], number> = {
    rush: 1,
    core: 2,
    mid: 3,
    situational: 4,
  };

  matchedRules.sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);

  return matchedRules;
}

const RAW_COMPONENTS = new Set([
  "tango", "quelling_blade", "branches", "circlet", "magic_stick", "faerie_fire", "clarity", "flask",
  "ward_observer", "ward_sentry", "dust", "smoke_of_deceit", "gloves", "slippers", "mantle", "gauntlets",
  "belt_of_strength", "boots_of_elves", "robe", "crown", "ogre_axe", "blade_of_alacrity", "staff_of_wizardry",
  "point_booster", "vitality_booster", "energy_booster", "void_stone", "ring_of_health", "broadsword",
  "claymore", "mithril_hammer", "blades_of_attack", "chainmail", "helm_of_iron_will", "javelin", "blight_stone",
  "infused_raindrop", "wind_lace", "ring_of_protection", "ring_of_regen", "sobi_mask", "fluffy_hat",
  "shadow_amulet", "voodoo_mask", "blitz_knuckles", "cornucopia", "diadem", "ring_of_tarrasque", "tiara_of_selemene",
  "relic", "demon_edge", "mystic_staff", "reaver", "eagle", "hyperstone", "ultimate_orb", "platemail", "talisman_of_evasion"
]);

export interface ProgressionTierItem {
  key: string;
  name: string;
  img: string;
  cost: number;
  tier: "rush" | "core" | "mid" | "situational";
  reason: string;
  isCounterRule: boolean;
}

/**
 * Builds the complete hero-centric progression by taking the hero's natural high-rank pub core
 * and merging in the contextual counter items against the enemy lineup.
 */
export function getHeroItemProgression(
  candidateHero: Hero,
  enemyHeroIds: number[] = [],
  targetRole?: number
): {
  rush: ProgressionTierItem[];
  core: ProgressionTierItem[];
  mid: ProgressionTierItem[];
  situational: ProgressionTierItem[];
} {
  const heroPop = (itemPopData as Record<string, any>)[String(candidateHero.id)];
  const counterItems = getRecommendedCounterItems(enemyHeroIds, candidateHero, targetRole);
  const seenItems = new Set<string>();

  const result: {
    rush: ProgressionTierItem[];
    core: ProgressionTierItem[];
    mid: ProgressionTierItem[];
    situational: ProgressionTierItem[];
  } = {
    rush: [],
    core: [],
    mid: [],
    situational: [],
  };

  // 1. Establish the hero's natural core progression first from high-rank pub data
  if (heroPop) {
    const isCompletedItem = (i: any) =>
      i &&
      i.key &&
      !RAW_COMPONENTS.has(i.key) &&
      (i.cost >= 1400 || i.key === "aghanims_shard" || i.key === "magic_wand");

    const midCompleted = (heroPop.mid_game_items || []).filter(isCompletedItem);
    const earlyCompleted = (heroPop.early_game_items || []).filter(
      (i: any) => isCompletedItem(i) && (i.cost >= 2000 || i.key.includes("boots"))
    );

    const candidatesForRush = [...midCompleted, ...earlyCompleted].sort((a, b) => b.count - a.count);

    // Pick top completed item as hero's natural signature rush item
    const heroRush = candidatesForRush[0];
    if (heroRush) {
      seenItems.add(heroRush.key);
      const meta = getItemMeta(heroRush.key);
      result.rush.push({
        key: heroRush.key,
        name: meta.name,
        img: meta.img,
        cost: meta.cost || heroRush.cost || 0,
        tier: "rush",
        reason: `${candidateHero.localized_name} signature core timing rush (high-elo pub build)`,
        isCounterRule: false,
      });
    }

    // Next 2-3 completed items form hero's Core Progression
    let coreCount = 0;
    for (const item of midCompleted) {
      if (coreCount >= 3) break;
      if (!seenItems.has(item.key)) {
        seenItems.add(item.key);
        const meta = getItemMeta(item.key);
        result.core.push({
          key: item.key,
          name: meta.name,
          img: meta.img,
          cost: meta.cost || item.cost || 0,
          tier: "core",
          reason: `High-winrate core progression for ${candidateHero.localized_name}`,
          isCounterRule: false,
        });
        coreCount++;
      }
    }
  }

  // 2. Merge contextual counter items against the enemy team
  for (const counter of counterItems) {
    // If the counter item is already in rush:
    const inRush = result.rush.find((i) => i.key === counter.key);
    if (inRush) {
      inRush.isCounterRule = true;
      inRush.reason = `${inRush.reason} • Counter: ${counter.reason}`;
      continue;
    }

    // If the counter item is in core:
    const inCoreIdx = result.core.findIndex((i) => i.key === counter.key);
    if (inCoreIdx !== -1) {
      if (counter.tier === "rush") {
        // Promote core item to rush because this counter is an urgent priority vs the enemy!
        const [promoted] = result.core.splice(inCoreIdx, 1);
        promoted.tier = "rush";
        promoted.isCounterRule = true;
        promoted.reason = `Rush priority: ${counter.reason}`;
        result.rush.push(promoted);
      } else {
        result.core[inCoreIdx].isCounterRule = true;
        result.core[inCoreIdx].reason = counter.reason;
      }
      continue;
    }

    // If already in seenItems (e.g. from later stages), skip
    if (seenItems.has(counter.key)) {
      continue;
    }

    // Otherwise, add to the respective tier
    seenItems.add(counter.key);
    result[counter.tier].push({
      key: counter.key,
      name: counter.name,
      img: counter.img,
      cost: counter.cost,
      tier: counter.tier,
      reason: counter.reason,
      isCounterRule: true,
    });
  }

  // 3. Fill in remaining mid and situational items from hero popularity
  if (heroPop) {
    const isCompletedItem = (i: any) =>
      i &&
      i.key &&
      !RAW_COMPONENTS.has(i.key) &&
      (i.cost >= 1400 || i.key === "aghanims_shard");

    const midCompleted = (heroPop.mid_game_items || []).filter(isCompletedItem);
    const lateCompleted = (heroPop.late_game_items || []).filter(isCompletedItem);

    let midCount = 0;
    for (const item of midCompleted) {
      if (midCount >= 2) break;
      if (!seenItems.has(item.key)) {
        seenItems.add(item.key);
        const meta = getItemMeta(item.key);
        result.mid.push({
          key: item.key,
          name: meta.name,
          img: meta.img,
          cost: meta.cost || item.cost || 0,
          tier: "mid",
          reason: `Mid-game tempo item for ${candidateHero.localized_name}`,
          isCounterRule: false,
        });
        midCount++;
      }
    }

    let lateCount = 0;
    for (const item of lateCompleted) {
      if (lateCount >= 3) break;
      if (!seenItems.has(item.key)) {
        seenItems.add(item.key);
        const meta = getItemMeta(item.key);
        result.situational.push({
          key: item.key,
          name: meta.name,
          img: meta.img,
          cost: meta.cost || item.cost || 0,
          tier: "situational",
          reason: `Late-game luxury extension for ${candidateHero.localized_name}`,
          isCounterRule: false,
        });
        lateCount++;
      }
    }
  }

  return result;
}

