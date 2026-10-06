import fs from "node:fs";
import path from "node:path";

interface RawHeroAbilityMeta {
  dname?: string;
  img?: string;
  desc?: string;
  dmg_type?: string;
}

interface RawHeroAbilityGroup {
  abilities: string[];
}

const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const rawDir = path.join(dataDir, "raw");

  // Read raw hero abilities or fetch if missing
  const rawHeroAbilitiesPath = path.join(dataDir, "hero-abilities.json");
  let rawHeroAbilities: Record<string, RawHeroAbilityGroup>;
  if (fs.existsSync(rawHeroAbilitiesPath)) {
    rawHeroAbilities = JSON.parse(fs.readFileSync(rawHeroAbilitiesPath, "utf8"));
  } else {
    const res = await fetch("https://raw.githubusercontent.com/odota/dotaconstants/master/build/hero_abilities.json");
    rawHeroAbilities = await res.json();
  }

  // Read raw abilities meta
  const rawAbilitiesPath = path.join(rawDir, "abilities.raw.json");
  let rawAbilitiesMeta: Record<string, RawHeroAbilityMeta>;
  if (fs.existsSync(rawAbilitiesPath)) {
    rawAbilitiesMeta = JSON.parse(fs.readFileSync(rawAbilitiesPath, "utf8"));
  } else {
    const res = await fetch("https://raw.githubusercontent.com/odota/dotaconstants/master/build/abilities.json");
    rawAbilitiesMeta = await res.json();
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(rawAbilitiesPath, JSON.stringify(rawAbilitiesMeta, null, 2));
  }

  // Read heroes.json
  const heroes = JSON.parse(fs.readFileSync(path.join(dataDir, "heroes.json"), "utf8"));

  // Build clean mapping: heroId -> Ability[]
  const heroAbilitiesById: Record<number, {
    id: string;
    name: string;
    img: string;
    desc?: string;
    dmg_type?: string;
  }[]> = {};

  for (const hero of heroes) {
    const heroData = rawHeroAbilities[hero.name];
    if (!heroData) {
      heroAbilitiesById[hero.id] = [];
      continue;
    }

    const filtered = (heroData.abilities || []).filter(
      (a: string) =>
        a &&
        !a.includes("generic_hidden") &&
        !a.includes("empty") &&
        !a.includes("special_bonus")
    );

    const abilities = filtered.map((abilityId) => {
      const meta = rawAbilitiesMeta[abilityId];
      let img = meta?.img
        ? `${STEAM_CDN}${meta.img}`
        : `${STEAM_CDN}/apps/dota2/images/dota_react/abilities/${abilityId}.png`;

      // Clean up dname
      let name = meta?.dname;
      if (!name) {
        // Fallback title case
        name = abilityId
          .replace("npc_dota_hero_", "")
          .replace(hero.name.replace("npc_dota_hero_", "") + "_", "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }

      return {
        id: abilityId,
        name,
        img,
        desc: typeof meta?.desc === "string" ? meta.desc : undefined,
        dmg_type: meta?.dmg_type,
      };
    });

    heroAbilitiesById[hero.id] = abilities;
  }

  const outputPath = path.join(dataDir, "hero-abilities.json");
  fs.writeFileSync(outputPath, JSON.stringify(heroAbilitiesById, null, 2));
  console.log(`Successfully generated ${outputPath} for ${Object.keys(heroAbilitiesById).length} heroes.`);
}

main().catch((err) => {
  console.error("Error generating hero abilities:", err);
  process.exit(1);
});
