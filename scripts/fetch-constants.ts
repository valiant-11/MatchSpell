import fs from "node:fs";
import path from "node:path";

interface RawHero {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: string;
  attack_type: string;
  roles: string[];
  img: string;
  icon?: string;
}

export interface Hero {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: "str" | "agi" | "int" | "all";
  attack_type: "Melee" | "Ranged";
  roles: string[];
  img: string;
  icon?: string;
}

const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";
const HEROES_URL = "https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json";
const ITEMS_URL = "https://raw.githubusercontent.com/odota/dotaconstants/master/build/items.json";

async function main() {
  console.log("Fetching heroes from dotaconstants...");
  const rawHeroesRes = await fetch(HEROES_URL);
  if (!rawHeroesRes.ok) {
    throw new Error(`Failed to fetch heroes: ${rawHeroesRes.status} ${rawHeroesRes.statusText}`);
  }
  const rawHeroes: Record<string, RawHero> = await rawHeroesRes.json();

  const rawDir = path.join(process.cwd(), "data", "raw");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, "heroes.raw.json"), JSON.stringify(rawHeroes, null, 2));

  const heroesList: Hero[] = Object.values(rawHeroes)
    .filter((h) => h.id && h.localized_name)
    .map((h) => {
      let img = h.img || "";
      if (img.startsWith("/")) {
        img = `${STEAM_CDN}${img}`;
      } else if (img && !img.startsWith("http")) {
        img = `${STEAM_CDN}/${img}`;
      }
      return {
        id: h.id,
        name: h.name,
        localized_name: h.localized_name,
        primary_attr: (h.primary_attr || "all") as Hero["primary_attr"],
        attack_type: (h.attack_type || "Melee") as Hero["attack_type"],
        roles: h.roles || [],
        img,
        icon: h.icon ? (h.icon.startsWith("/") ? `${STEAM_CDN}${h.icon}` : `${STEAM_CDN}/${h.icon}`) : undefined,
      };
    })
    .sort((a, b) => a.localized_name.localeCompare(b.localized_name));

  const dataDir = path.join(process.cwd(), "data");
  fs.writeFileSync(path.join(dataDir, "heroes.json"), JSON.stringify(heroesList, null, 2));
  console.log(`Successfully generated data/heroes.json with ${heroesList.length} heroes.`);

  // Also fetch items.json for validation and future item rules
  console.log("Fetching items from dotaconstants...");
  const rawItemsRes = await fetch(ITEMS_URL);
  if (rawItemsRes.ok) {
    const rawItems = await rawItemsRes.json();
    fs.writeFileSync(path.join(rawDir, "items.raw.json"), JSON.stringify(rawItems, null, 2));
    console.log(`Saved items.raw.json with ${Object.keys(rawItems).length} items.`);
  } else {
    console.warn("Failed to fetch items.json:", rawItemsRes.status);
  }
}

main().catch((err) => {
  console.error("Error fetching constants:", err);
  process.exit(1);
});
