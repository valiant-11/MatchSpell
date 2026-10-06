import fs from "node:fs";
import path from "node:path";
import { Hero } from "../lib/types";

export const ALLOWED_TAGS = [
  "hard_cc",
  "aoe_disable",
  "silence",
  "break",
  "evasion",
  "illusions",
  "invis",
  "heal",
  "sustain",
  "ranged_harass",
  "burst_magic",
  "phys_carry",
  "blink_initiator",
  "save",
  "dispel",
  "passive_heavy",
  "summons",
  "global",
  "push",
  "smoke_gank",
  "mid_waveclear",
  "mid_roamer",
  "mid_tempo",
  "mid_late_scaler",
] as const;

export type TraitTag = (typeof ALLOWED_TAGS)[number];
export type DamageType = "physical" | "magical" | "pure" | "mixed";

export interface HeroLanePlan {
  harass: string;
  waveclear: string;
  level6: string;
  runeControl: string;
}

export interface HeroTrait {
  heroId: number;
  heroName: string;
  localized_name: string;
  tags: TraitTag[];
  dmgType: DamageType;
  lanePlan: HeroLanePlan;
}

const DATA_DIR = path.join(process.cwd(), "data");

function guessHeroTraits(hero: Hero): HeroTrait {
  const tags = new Set<TraitTag>();
  const name = hero.name.replace("npc_dota_hero_", "");
  let dmgType: DamageType = "physical";

  // Base roles heuristics
  if (hero.roles.includes("Disabler")) tags.add("hard_cc");
  if (hero.roles.includes("Initiator")) tags.add("blink_initiator");
  if (hero.roles.includes("Nuker")) tags.add("burst_magic");
  if (hero.roles.includes("Carry")) tags.add("phys_carry");
  if (hero.roles.includes("Pusher")) tags.add("push");
  if (hero.roles.includes("Durable")) tags.add("sustain");

  if (hero.attack_type === "Ranged") {
    tags.add("ranged_harass");
  }

  // Damage type heuristics
  if (hero.primary_attr === "int" || hero.roles.includes("Nuker")) {
    dmgType = hero.roles.includes("Carry") ? "mixed" : "magical";
  } else if (hero.primary_attr === "str" && hero.roles.includes("Nuker")) {
    dmgType = "mixed";
  }

  // Hero-specific heuristics for signature dota 2 traits
  const heroSpecific: Record<string, { tags: TraitTag[]; dmg?: DamageType }> = {
    antimage: { tags: ["phys_carry", "passive_heavy", "blink_initiator", "mid_late_scaler"], dmg: "physical" },
    axe: { tags: ["blink_initiator", "hard_cc", "aoe_disable", "passive_heavy", "sustain"], dmg: "pure" },
    bane: { tags: ["hard_cc", "save", "ranged_harass"], dmg: "pure" },
    bloodseeker: { tags: ["silence", "sustain", "mid_tempo"], dmg: "mixed" },
    bounty_hunter: { tags: ["invis", "smoke_gank", "mid_roamer"], dmg: "physical" },
    bristleback: { tags: ["passive_heavy", "sustain", "phys_carry"], dmg: "physical" },
    broodmother: { tags: ["summons", "push", "mid_waveclear", "sustain"], dmg: "physical" },
    chaos_knight: { tags: ["illusions", "hard_cc", "phys_carry", "sustain"], dmg: "physical" },
    chen: { tags: ["summons", "heal", "save", "push", "global"], dmg: "mixed" },
    clinkz: { tags: ["invis", "phys_carry", "ranged_harass"], dmg: "physical" },
    crystal_maiden: { tags: ["hard_cc", "aoe_disable", "burst_magic", "ranged_harass"], dmg: "magical" },
    dark_seer: { tags: ["mid_waveclear", "aoe_disable", "sustain"], dmg: "magical" },
    dazzle: { tags: ["save", "heal", "sustain", "ranged_harass"], dmg: "physical" },
    death_prophet: { tags: ["silence", "push", "mid_waveclear", "sustain", "mid_tempo"], dmg: "mixed" },
    disruptor: { tags: ["silence", "aoe_disable", "hard_cc"], dmg: "magical" },
    doom_bringer: { tags: ["silence", "break", "hard_cc", "mid_tempo"], dmg: "pure" },
    dragon_knight: { tags: ["hard_cc", "push", "sustain", "mid_waveclear", "mid_tempo"], dmg: "physical" },
    drow_ranger: { tags: ["silence", "phys_carry", "ranged_harass", "mid_late_scaler"], dmg: "physical" },
    earthshaker: { tags: ["hard_cc", "aoe_disable", "blink_initiator"], dmg: "magical" },
    earth_spirit: { tags: ["hard_cc", "silence", "mid_roamer", "mid_tempo"], dmg: "magical" },
    ember_spirit: { tags: ["mid_waveclear", "burst_magic", "dispel", "mid_tempo", "mid_roamer"], dmg: "mixed" },
    enchantress: { tags: ["summons", "heal", "sustain", "ranged_harass", "passive_heavy"], dmg: "pure" },
    enigma: { tags: ["aoe_disable", "hard_cc", "blink_initiator", "summons", "push"], dmg: "pure" },
    faceless_void: { tags: ["hard_cc", "aoe_disable", "phys_carry", "mid_late_scaler", "passive_heavy"], dmg: "physical" },
    furion: { tags: ["global", "summons", "push", "ranged_harass", "mid_tempo"], dmg: "physical" },
    huskar: { tags: ["passive_heavy", "sustain", "ranged_harass", "burst_magic", "mid_tempo"], dmg: "mixed" },
    invoker: { tags: ["mid_waveclear", "burst_magic", "aoe_disable", "mid_tempo", "mid_late_scaler", "dispel"], dmg: "mixed" },
    jakiro: { tags: ["hard_cc", "aoe_disable", "ranged_harass", "push", "burst_magic"], dmg: "magical" },
    juggernaut: { tags: ["dispel", "heal", "phys_carry", "burst_magic"], dmg: "physical" },
    keeper_of_the_light: { tags: ["mid_waveclear", "burst_magic", "mid_roamer", "heal"], dmg: "magical" },
    kunkka: { tags: ["aoe_disable", "hard_cc", "mid_waveclear", "mid_tempo", "mid_roamer"], dmg: "mixed" },
    legion_commander: { tags: ["hard_cc", "dispel", "heal", "blink_initiator"], dmg: "physical" },
    leshrac: { tags: ["burst_magic", "mid_waveclear", "push", "sustain", "mid_tempo"], dmg: "magical" },
    lich: { tags: ["hard_cc", "aoe_disable", "ranged_harass", "save"], dmg: "magical" },
    lina: { tags: ["hard_cc", "burst_magic", "mid_waveclear", "ranged_harass", "mid_late_scaler"], dmg: "magical" },
    lion: { tags: ["hard_cc", "aoe_disable", "burst_magic", "ranged_harass"], dmg: "magical" },
    lone_druid: { tags: ["summons", "push", "sustain", "mid_tempo"], dmg: "physical" },
    luna: { tags: ["mid_waveclear", "phys_carry", "burst_magic", "push", "mid_late_scaler"], dmg: "mixed" },
    magnataur: { tags: ["hard_cc", "aoe_disable", "blink_initiator", "mid_waveclear"], dmg: "physical" },
    medusa: { tags: ["illusions", "aoe_disable", "mid_waveclear", "mid_late_scaler", "passive_heavy"], dmg: "physical" },
    meepo: { tags: ["summons", "mid_waveclear", "mid_tempo", "burst_magic", "push"], dmg: "mixed" },
    mirana: { tags: ["hard_cc", "invis", "mid_roamer", "burst_magic", "global"], dmg: "mixed" },
    monkey_king: { tags: ["hard_cc", "aoe_disable", "sustain", "mid_tempo", "phys_carry"], dmg: "physical" },
    morphling: { tags: ["phys_carry", "mid_late_scaler", "burst_magic", "sustain"], dmg: "mixed" },
    naga_siren: { tags: ["illusions", "aoe_disable", "mid_late_scaler", "push"], dmg: "physical" },
    necrolyte: { tags: ["heal", "sustain", "burst_magic", "ranged_harass", "mid_tempo"], dmg: "magical" },
    nevermore: { tags: ["mid_waveclear", "burst_magic", "phys_carry", "mid_late_scaler"], dmg: "mixed" },
    night_stalker: { tags: ["silence", "hard_cc", "mid_roamer", "mid_tempo", "smoke_gank"], dmg: "physical" },
    nyx_assassin: { tags: ["invis", "hard_cc", "burst_magic", "smoke_gank", "break"], dmg: "pure" },
    obsidian_destroyer: { tags: ["burst_magic", "hard_cc", "save", "ranged_harass", "mid_tempo"], dmg: "pure" },
    ogre_magi: { tags: ["hard_cc", "sustain", "burst_magic"], dmg: "magical" },
    omniknight: { tags: ["heal", "save", "dispel", "sustain"], dmg: "pure" },
    oracle: { tags: ["save", "heal", "dispel", "burst_magic"], dmg: "magical" },
    pangolier: { tags: ["mid_waveclear", "dispel", "aoe_disable", "mid_roamer", "mid_tempo"], dmg: "mixed" },
    phantom_assassin: { tags: ["evasion", "phys_carry", "passive_heavy", "mid_late_scaler"], dmg: "physical" },
    phantom_lancer: { tags: ["illusions", "phys_carry", "mid_late_scaler", "dispel"], dmg: "physical" },
    phoenix: { tags: ["heal", "aoe_disable", "ranged_harass", "sustain"], dmg: "magical" },
    puck: { tags: ["mid_waveclear", "aoe_disable", "silence", "dispel", "mid_roamer", "mid_tempo"], dmg: "magical" },
    pudge: { tags: ["hard_cc", "burst_magic", "sustain", "mid_roamer"], dmg: "pure" },
    pugna: { tags: ["mid_waveclear", "burst_magic", "push", "heal", "ranged_harass"], dmg: "magical" },
    queenofpain: { tags: ["burst_magic", "mid_waveclear", "ranged_harass", "mid_roamer", "mid_tempo"], dmg: "magical" },
    razor: { tags: ["passive_heavy", "sustain", "mid_tempo", "ranged_harass"], dmg: "physical" },
    riki: { tags: ["invis", "silence", "smoke_gank", "phys_carry"], dmg: "physical" },
    rubick: { tags: ["hard_cc", "burst_magic", "ranged_harass"], dmg: "magical" },
    sand_king: { tags: ["hard_cc", "aoe_disable", "blink_initiator", "invis", "mid_waveclear"], dmg: "magical" },
    shadow_demon: { tags: ["save", "dispel", "burst_magic", "break"], dmg: "pure" },
    shadow_shaman: { tags: ["hard_cc", "push", "summons", "ranged_harass"], dmg: "magical" },
    silencer: { tags: ["silence", "global", "ranged_harass", "burst_magic"], dmg: "pure" },
    skywrath_mage: { tags: ["silence", "burst_magic", "ranged_harass"], dmg: "magical" },
    slardar: { tags: ["hard_cc", "blink_initiator", "passive_heavy", "smoke_gank"], dmg: "physical" },
    slark: { tags: ["dispel", "invis", "sustain", "phys_carry", "mid_late_scaler"], dmg: "physical" },
    sniper: { tags: ["ranged_harass", "phys_carry", "mid_waveclear", "mid_late_scaler"], dmg: "physical" },
    spectre: { tags: ["global", "illusions", "phys_carry", "mid_late_scaler", "passive_heavy"], dmg: "pure" },
    spirit_breaker: { tags: ["hard_cc", "global", "smoke_gank", "mid_roamer"], dmg: "physical" },
    storm_spirit: { tags: ["burst_magic", "mid_waveclear", "mid_roamer", "mid_tempo", "mid_late_scaler"], dmg: "magical" },
    sven: { tags: ["hard_cc", "aoe_disable", "phys_carry", "mid_waveclear"], dmg: "physical" },
    techies: { tags: ["hard_cc", "silence", "burst_magic", "ranged_harass"], dmg: "magical" },
    templar_assassin: { tags: ["burst_magic", "phys_carry", "mid_waveclear", "passive_heavy", "mid_tempo"], dmg: "physical" },
    terrorblade: { tags: ["illusions", "phys_carry", "push", "mid_late_scaler"], dmg: "physical" },
    tidehunter: { tags: ["hard_cc", "aoe_disable", "blink_initiator", "sustain", "dispel"], dmg: "physical" },
    timbersaw: { tags: ["burst_magic", "mid_waveclear", "sustain", "passive_heavy"], dmg: "pure" },
    tinker: { tags: ["burst_magic", "global", "mid_waveclear", "mid_tempo"], dmg: "pure" },
    tiny: { tags: ["burst_magic", "hard_cc", "blink_initiator", "mid_waveclear", "mid_tempo"], dmg: "physical" },
    treant_protector: { tags: ["hard_cc", "aoe_disable", "heal", "invis", "sustain"], dmg: "physical" },
    troll_warlord: { tags: ["hard_cc", "phys_carry", "sustain", "passive_heavy"], dmg: "physical" },
    tusk: { tags: ["hard_cc", "save", "mid_roamer", "blink_initiator"], dmg: "physical" },
    undying: { tags: ["heal", "sustain", "summons", "burst_magic"], dmg: "physical" },
    ursa: { tags: ["sustain", "phys_carry", "passive_heavy", "mid_tempo"], dmg: "physical" },
    vengefulspirit: { tags: ["hard_cc", "save", "ranged_harass"], dmg: "physical" },
    venomancer: { tags: ["ranged_harass", "summons", "push", "sustain"], dmg: "magical" },
    viper: { tags: ["break", "ranged_harass", "passive_heavy", "sustain", "mid_tempo"], dmg: "magical" },
    visage: { tags: ["summons", "burst_magic", "push", "sustain", "passive_heavy"], dmg: "physical" },
    void_spirit: { tags: ["mid_waveclear", "dispel", "burst_magic", "mid_roamer", "mid_tempo"], dmg: "mixed" },
    warlock: { tags: ["hard_cc", "aoe_disable", "heal", "summons"], dmg: "magical" },
    weaver: { tags: ["invis", "phys_carry", "save", "dispel"], dmg: "physical" },
    windrunner: { tags: ["hard_cc", "evasion", "ranged_harass", "burst_magic", "mid_tempo"], dmg: "physical" },
    winter_wyvern: { tags: ["hard_cc", "aoe_disable", "heal", "save", "ranged_harass"], dmg: "mixed" },
    witch_doctor: { tags: ["hard_cc", "heal", "burst_magic", "ranged_harass"], dmg: "physical" },
    skeleton_king: { tags: ["hard_cc", "summons", "phys_carry", "sustain"], dmg: "physical" },
    zuus: { tags: ["burst_magic", "global", "ranged_harass", "mid_waveclear"], dmg: "magical" },
  };

  const spec = heroSpecific[name];
  if (spec) {
    spec.tags.forEach((t) => tags.add(t));
    if (spec.dmg) dmgType = spec.dmg;
  }

  // Generate lane plan summary skeleton
  const isRanged = hero.attack_type === "Ranged";
  const hasWaveclear = tags.has("mid_waveclear") || tags.has("burst_magic");
  const hasBurst = tags.has("burst_magic") || tags.has("hard_cc");

  const lanePlan: HeroLanePlan = {
    harass: isRanged
      ? "Abuse superior attack range and spells to contest every enemy last hit."
      : "Draw creep aggro toward your high ground and trade only with creep advantage.",
    waveclear: hasWaveclear
      ? "Use AoE abilities at :45 seconds to clear wave and rotate to rune spots."
      : "Manage creep equilibrium near your tower; avoid pushing without vision.",
    level6: hasBurst
      ? "Significant kill pressure at level 6. Look for solo kill or gank side lanes."
      : "Power spike enables accelerated farming or objective push rather than solo burst.",
    runeControl: tags.has("mid_roamer") || isRanged
      ? "Strong rune contest potential with mobility and wave shove."
      : "Secure vision on high ground and prioritize bottle refilling.",
  };

  return {
    heroId: hero.id,
    heroName: hero.name,
    localized_name: hero.localized_name,
    tags: Array.from(tags),
    dmgType,
    lanePlan,
  };
}

async function main() {
  console.log("Generating traits with ability and hero heuristics...");
  const heroesPath = path.join(DATA_DIR, "heroes.json");
  const heroes: Hero[] = JSON.parse(fs.readFileSync(heroesPath, "utf-8"));

  // Check for overrides
  const overridesPath = path.join(DATA_DIR, "traits.overrides.json");
  let overrides: Record<string, Partial<HeroTrait>> = {};
  if (fs.existsSync(overridesPath)) {
    overrides = JSON.parse(fs.readFileSync(overridesPath, "utf-8"));
  } else {
    fs.writeFileSync(overridesPath, JSON.stringify({}, null, 2));
  }

  const traitsMap: Record<number, HeroTrait> = {};

  for (const hero of heroes) {
    const guessed = guessHeroTraits(hero);
    const heroOverride = overrides[hero.id];

    if (heroOverride) {
      traitsMap[hero.id] = {
        ...guessed,
        ...heroOverride,
        tags: heroOverride.tags || guessed.tags,
        lanePlan: { ...guessed.lanePlan, ...(heroOverride.lanePlan || {}) },
      };
    } else {
      traitsMap[hero.id] = guessed;
    }
  }

  const traitsPath = path.join(DATA_DIR, "traits.json");
  fs.writeFileSync(traitsPath, JSON.stringify(traitsMap, null, 2));
  console.log(`Saved ${Object.keys(traitsMap).length} hero traits to data/traits.json`);
}

main().catch(console.error);
