import fs from "node:fs";
import path from "node:path";

interface Hero {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: string;
  attack_type: string;
  roles: string[];
}

interface Trait {
  tags: string[];
  dmgType: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const heroes: Hero[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "heroes.json"), "utf8"));
const traits: Record<string, Trait> = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "traits.json"), "utf8"));

// Optional overrides
let overrides: Record<string, Record<number, number>> = {};
const overridesPath = path.join(DATA_DIR, "hero-roles.overrides.json");
if (fs.existsSync(overridesPath)) {
  try {
    overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
  } catch (e) {
    console.warn("Failed to parse hero-roles.overrides.json");
  }
}

// Well-known archetype anchors for Dota 2 positions
const POS1_ANCHORS = new Set([
  "antimage", "phantom_assassin", "juggernaut", "slark", "faceless_void", "spectre", "terrorblade",
  "drow_ranger", "morphling", "ursa", "sven", "luna", "medusa", "phantom_lancer", "wraith_king",
  "bloodseeker", "chaos_knight", "clinkz", "gyrocopter", "life_stealer", "naga_siren", "weaver",
  "troll_warlord", "sniper", "monkey_king", "riki", "muerta", "marci"
]);

const POS2_ANCHORS = new Set([
  "storm_spirit", "puck", "queenofpain", "ember_spirit", "invoker", "nevermore", "tinker",
  "void_spirit", "templar_assassin", "lina", "leshrac", "kunkka", "pangolier", "primal_beast",
  "dragon_knight", "batrider", "huskar", "meepo", "arc_warden", "tiny", "keeper_of_the_light",
  "zuus", "death_prophet", "necrolyte", "viper", "razor", "windrunner"
]);

const POS3_ANCHORS = new Set([
  "tidehunter", "centaur", "mars", "axe", "slardar", "underlord", "magnataur", "abaddon",
  "bristleback", "doom_bringer", "beastmaster", "legion_commander", "dark_seer", "enigma",
  "night_stalker", "sand_king", "brewmaster", "shredder", "omniknight", "lycan", "broodmother"
]);

const POS4_ANCHORS = new Set([
  "earthshaker", "tusk", "rattletrap", "nyx_assassin", "rubick", "mirana", "hoodwink",
  "spirit_breaker", "earth_spirit", "bounty_hunter", "shadow_shaman", "enchantress",
  "lion", "pudge", "venomancer", "marci", "ringmaster"
]);

const POS5_ANCHORS = new Set([
  "crystal_maiden", "dazzle", "lich", "jakiro", "bane", "shadow_demon", "oracle",
  "treant", "warlock", "disruptor", "ancient_apparition", "witch_doctor", "silencer",
  "ogre_magi", "abaddon", "chen", "grimstroke", "undying", "pugna", "keeper_of_the_light"
]);

function computeSuitability(hero: Hero): { roles: Record<number, number>; primaryRole: number } {
  const shortName = hero.name.replace("npc_dota_hero_", "");
  const heroTrait = traits[String(hero.id)] || { tags: [], dmgType: "physical" };
  const tags = heroTrait.tags || [];
  const roles = hero.roles || [];

  const isCarry = roles.includes("Carry");
  const isSupport = roles.includes("Support");
  const isDurable = roles.includes("Durable");
  const isInitiator = roles.includes("Initiator");
  const isNuker = roles.includes("Nuker");
  const isDisabler = roles.includes("Disabler");

  // Base scores (0.0 to 1.0)
  let s1 = 0.05;
  let s2 = 0.05;
  let s3 = 0.05;
  let s4 = 0.05;
  let s5 = 0.05;

  // Carry heuristics
  if (isCarry) {
    s1 += 0.50;
    s2 += 0.30;
    if (isDurable) s3 += 0.35;
    // Carries without support tags shouldn't get support scores
    if (!isSupport) {
      s4 = Math.min(s4, 0.08);
      s5 = Math.min(s5, 0.03);
    }
  } else {
    // Non-carries cannot be primary pos 1
    s1 = Math.min(s1, 0.12);
  }

  // Support heuristics
  if (isSupport) {
    s4 += 0.55;
    s5 += 0.60;
    if (!isCarry) {
      s1 = 0.02;
      s2 = Math.min(s2, 0.15);
    }
  }

  // Durable / Initiator heuristics (Offlane core)
  if (isDurable) {
    s3 += 0.45;
  }
  if (isInitiator && !isCarry) {
    s3 += 0.35;
    s4 += 0.25;
  }

  // Trait influences
  if (tags.includes("mid_waveclear") || tags.includes("mid_tempo") || tags.includes("mid_roamer")) {
    s2 += 0.40;
  }
  if (tags.includes("phys_carry") && isCarry) {
    s1 += 0.35;
  }
  if (tags.includes("save") || tags.includes("heal")) {
    s5 += 0.35;
    s4 += 0.25;
  }
  if (tags.includes("smoke_gank") || (tags.includes("blink_initiator") && !isCarry)) {
    s4 += 0.30;
  }

  // Specific anchor boosts
  if (POS1_ANCHORS.has(shortName)) {
    s1 = Math.max(s1, 0.95);
    s4 = Math.min(s4, 0.05);
    s5 = Math.min(s5, 0.02);
  }
  if (POS2_ANCHORS.has(shortName)) {
    s2 = Math.max(s2, 0.95);
  }
  if (POS3_ANCHORS.has(shortName)) {
    s3 = Math.max(s3, 0.95);
    s1 = Math.min(s1, 0.10);
  }
  if (POS4_ANCHORS.has(shortName)) {
    s4 = Math.max(s4, 0.90);
    s1 = Math.min(s1, 0.05);
  }
  if (POS5_ANCHORS.has(shortName)) {
    s5 = Math.max(s5, 0.95);
    s1 = Math.min(s1, 0.02);
  }

  // Clamp and round
  const clamp = (v: number) => Number(Math.min(0.99, Math.max(0.01, v)).toFixed(2));
  let resultRoles: Record<number, number> = {
    1: clamp(s1),
    2: clamp(s2),
    3: clamp(s3),
    4: clamp(s4),
    5: clamp(s5),
  };

  // Apply explicit manual overrides if defined for this hero
  if (overrides[String(hero.id)]) {
    resultRoles = { ...resultRoles, ...overrides[String(hero.id)] };
  }

  // Find primary role
  let bestRole = 1;
  let maxScore = -1;
  for (let r = 1; r <= 5; r++) {
    if (resultRoles[r] > maxScore) {
      maxScore = resultRoles[r];
      bestRole = r;
    }
  }

  return { roles: resultRoles, primaryRole: bestRole };
}

const heroRolesMap: Record<string, { heroId: number; name: string; localized_name: string; roles: Record<number, number>; primaryRole: number }> = {};

for (const hero of heroes) {
  const { roles, primaryRole } = computeSuitability(hero);
  heroRolesMap[String(hero.id)] = {
    heroId: hero.id,
    name: hero.name,
    localized_name: hero.localized_name,
    roles,
    primaryRole,
  };
}

fs.writeFileSync(path.join(DATA_DIR, "hero-roles.json"), JSON.stringify(heroRolesMap, null, 2), "utf8");
console.log(`Generated data/hero-roles.json for ${heroes.length} heroes successfully.`);
