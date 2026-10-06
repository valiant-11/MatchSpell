import fs from "node:fs";
import path from "node:path";

export interface ItemRule {
  id: string;
  if: {
    countTag?: Record<string, string>;
    hasTag?: string;
    magicShare?: string;
    physShare?: string;
    heroDmg?: "physical" | "magical" | "pure" | "mixed";
    heroRole?: "core" | "support";
  };
  item: string; // Internal name from items.json
  tier: "rush" | "core" | "mid" | "situational";
  reason: string;
}

export const SEEDED_ITEM_RULES: ItemRule[] = [
  // 1. Black King Bar (BKB)
  {
    id: "bkb-cc",
    if: { countTag: { hard_cc: ">=2" } },
    item: "black_king_bar",
    tier: "rush",
    reason: "{n} hard CC heroes on enemy team",
  },
  {
    id: "bkb-magic",
    if: { magicShare: ">=0.5" },
    item: "black_king_bar",
    tier: "rush",
    reason: "heavy enemy magic burst damage",
  },
  // 2. Linken's Sphere
  {
    id: "linkens-lockdown",
    if: { countTag: { hard_cc: ">=1" }, heroRole: "core" },
    item: "sphere",
    tier: "situational",
    reason: "single-target spell lockdown defense",
  },
  // 3. Lotus Orb
  {
    id: "lotus-silence",
    if: { countTag: { silence: ">=1" } },
    item: "lotus_orb",
    tier: "core",
    reason: "dispel against enemy silences and target spells",
  },
  {
    id: "lotus-cc",
    if: { countTag: { hard_cc: ">=2" } },
    item: "lotus_orb",
    tier: "situational",
    reason: "reflects enemy targeted disables back at caster",
  },
  // 4. Eul's Scepter of Divinity
  {
    id: "euls-silence",
    if: { hasTag: "silence" },
    item: "cyclone",
    tier: "mid",
    reason: "self-cyclone basic dispel vs silence and projectile dodge",
  },
  {
    id: "euls-roamer",
    if: { hasTag: "mid_roamer" },
    item: "cyclone",
    tier: "situational",
    reason: "setup and disrupt mobile enemy momentum",
  },
  // 5. Ghost Scepter
  {
    id: "ghost-phys",
    if: { physShare: ">=0.6" },
    item: "ghost",
    tier: "situational",
    reason: "physical immune active against heavy right-click carries",
  },
  // 6. Blade Mail
  {
    id: "blade-mail-burst",
    if: { hasTag: "burst_magic" },
    item: "blade_mail",
    tier: "core",
    reason: "reflects burst damage back to fragile attackers",
  },
  {
    id: "blade-mail-phys",
    if: { countTag: { phys_carry: ">=2" } },
    item: "blade_mail",
    tier: "situational",
    reason: "punishes enemy multi-core physical assault",
  },
  // 7. Hood of Defiance
  {
    id: "hood-magic",
    if: { magicShare: ">=0.5" },
    item: "hood_of_defiance",
    tier: "core",
    reason: "magic barrier against spell damage heavy lineup",
  },
  // 8. Pipe of Insight
  {
    id: "pipe-magic",
    if: { magicShare: ">=0.5" },
    item: "pipe",
    tier: "core",
    reason: "team-wide magic resistance aura and magic barrier",
  },
  {
    id: "pipe-aoe",
    if: { countTag: { aoe_disable: ">=2" } },
    item: "pipe",
    tier: "mid",
    reason: "protects team against magic combo initiations",
  },
  // 9. Crimson Guard
  {
    id: "crimson-summons",
    if: { hasTag: "summons" },
    item: "crimson_guard",
    tier: "core",
    reason: "blocks multi-unit summons physical chip damage",
  },
  {
    id: "crimson-illusions",
    if: { hasTag: "illusions" },
    item: "crimson_guard",
    tier: "rush",
    reason: "shields allies against overwhelming illusion swarm right-clicks",
  },
  {
    id: "crimson-phys",
    if: { physShare: ">=0.7" },
    item: "crimson_guard",
    tier: "core",
    reason: "team physical damage block barrier against pure physical lineup",
  },
  // 10. Shiva's Guard
  {
    id: "shivas-heal",
    if: { hasTag: "heal" },
    item: "shivas_guard",
    tier: "core",
    reason: "anti-heal active and attack slow against enemy healing",
  },
  {
    id: "shivas-illusions",
    if: { hasTag: "illusions" },
    item: "shivas_guard",
    tier: "rush",
    reason: "Arctic Blast AOE reveals and clears illusion armies",
  },
  {
    id: "shivas-sustain",
    if: { hasTag: "sustain" },
    item: "shivas_guard",
    tier: "core",
    reason: "reduces enemy HP regeneration and life-drain sustain",
  },
  // 11. Mekansm & Guardian Greaves
  {
    id: "mek-sustain",
    if: { countTag: { mid_tempo: ">=1" } },
    item: "mekansm",
    tier: "core",
    reason: "early group heal and armor for 5-man objective deathball",
  },
  {
    id: "greaves-silence",
    if: { countTag: { silence: ">=1" } },
    item: "guardian_greaves",
    tier: "core",
    reason: "dispel on self and low-HP armor surge for the team",
  },
  // 12. Glimmer Cape
  {
    id: "glimmer-magic",
    if: { magicShare: ">=0.5" },
    item: "glimmer_cape",
    tier: "core",
    reason: "invis and 300 magic damage absorption shield for allies",
  },
  {
    id: "glimmer-save",
    if: { hasTag: "burst_magic" },
    item: "glimmer_cape",
    tier: "situational",
    reason: "emergency repositioning and fade shield save",
  },
  // 13. Force Staff
  {
    id: "force-staff-initiator",
    if: { countTag: { blink_initiator: ">=1" } },
    item: "force_staff",
    tier: "core",
    reason: "repositions teammates out of enemy jump zones and AoE cages",
  },
  {
    id: "force-staff-cc",
    if: { countTag: { hard_cc: ">=2" } },
    item: "force_staff",
    tier: "situational",
    reason: "kites melee lockdown and breaks immobilizing spells",
  },
  // 14. Silver Edge
  {
    id: "silver-edge-passive",
    if: { countTag: { passive_heavy: ">=1" } },
    item: "silver_edge",
    tier: "core",
    reason: "applies Break to disable enemy passives (Bristleback, PA, Specter, Huskar)",
  },
  // 15. Nullifier
  {
    id: "nullifier-saves",
    if: { countTag: { save: ">=1" } },
    item: "nullifier",
    tier: "rush",
    reason: "continuous dispel dispels Ghost Scepter, Eul's, Force Staff, and buffs",
  },
  {
    id: "nullifier-sustain",
    if: { hasTag: "sustain" },
    item: "nullifier",
    tier: "situational",
    reason: "purges protective shields and self-buffs every second",
  },
  // 16. Orchid Malevolence
  {
    id: "orchid-escape",
    if: { countTag: { mid_roamer: ">=1" } },
    item: "orchid",
    tier: "rush",
    reason: "5s silence prevents mobile spirit and escape heroes from blinking",
  },
  {
    id: "orchid-burst",
    if: { hasTag: "burst_magic" },
    item: "orchid",
    tier: "core",
    reason: "amplifies damage and locks down squishy spell nukers",
  },
  // 17. Monkey King Bar (MKB)
  {
    id: "mkb-evasion",
    if: { hasTag: "evasion" },
    item: "monkey_king_bar",
    tier: "mid",
    reason: "80% True Strike pierces innate evasion (PA, Windranger, Butterfly)",
  },
  // 18. Heaven's Halberd
  {
    id: "halberd-carry",
    if: { countTag: { phys_carry: ">=1" } },
    item: "heavens_halberd",
    tier: "core",
    reason: "3-5s undispellable disarm neutralizes enemy right-click threat",
  },
  // 19. Aeon Disk
  {
    id: "aeon-burst",
    if: { hasTag: "burst_magic" },
    item: "aeon_disk",
    tier: "situational",
    reason: "emergency invulnerability trigger prevents instant 100-to-0 death",
  },
  // 20. Satanic
  {
    id: "satanic-sustain",
    if: { countTag: { hard_cc: ">=1" }, heroDmg: "physical" },
    item: "satanic",
    tier: "situational",
    reason: "basic dispel and 175% lifesteal turns around losing teamfights",
  },
  // 21. Gem of True Sight
  {
    id: "gem-invis",
    if: { hasTag: "invis" },
    item: "gem",
    tier: "situational",
    reason: "reveals permanent invis heroes and enemy smoke wards",
  },
  // 22. Spirit Vessel
  {
    id: "spirit-vessel-heal",
    if: { hasTag: "heal" },
    item: "spirit_vessel",
    tier: "core",
    reason: "soul release cuts enemy healing by 45% and burns max HP",
  },
  {
    id: "spirit-vessel-sustain",
    if: { hasTag: "sustain" },
    item: "spirit_vessel",
    tier: "core",
    reason: "melts high-health durable tanks and reduces health regeneration",
  },
  // 23. Mage Slayer
  {
    id: "mage-slayer-magic",
    if: { magicShare: ">=0.5" },
    item: "mage_slayer",
    tier: "core",
    reason: "inflicts 40% spell damage debuff on spell-heavy enemies",
  },
  // 24. Diffusal Blade
  {
    id: "diffusal-mana",
    if: { countTag: { mid_late_scaler: ">=1" } },
    item: "diffusal_blade",
    tier: "mid",
    reason: "mana combustion drains mana pools and slows mobile targets",
  },
  // 25. Manta Style
  {
    id: "manta-silence",
    if: { countTag: { silence: ">=1" }, heroDmg: "physical" },
    item: "manta",
    tier: "rush",
    reason: "instant self-dispel for agility carries against Orchid and silences",
  },
];

async function main() {
  console.log("Validating item rules against raw items database...");
  const rawItemsPath = path.join(process.cwd(), "data", "raw", "items.raw.json");
  if (!fs.existsSync(rawItemsPath)) {
    throw new Error(`data/raw/items.raw.json not found!`);
  }

  const itemsDb = JSON.parse(fs.readFileSync(rawItemsPath, "utf-8"));

  // Strict check: every item name in SEEDED_ITEM_RULES must exist in items.json
  const invalidItems: string[] = [];
  for (const rule of SEEDED_ITEM_RULES) {
    if (!itemsDb[rule.item]) {
      invalidItems.push(`Rule ${rule.id} references unknown item "${rule.item}"`);
    }
  }

  if (invalidItems.length > 0) {
    console.error("FAIL: Unknown item names found in rules:");
    invalidItems.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }

  console.log(`PASS: All ${SEEDED_ITEM_RULES.length} item rules reference valid items!`);

  const outPath = path.join(process.cwd(), "data", "item-rules.json");
  fs.writeFileSync(outPath, JSON.stringify(SEEDED_ITEM_RULES, null, 2));
  console.log(`Saved ${SEEDED_ITEM_RULES.length} verified item rules to data/item-rules.json`);
}

main().catch(console.error);
