import fs from "node:fs";
import path from "node:path";
import { Hero } from "../lib/types";

interface HeroStat {
  overallWr: number;
  overallGames: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const K_SMOOTHING = 50;

async function main() {
  console.log("=== MatchSpell Ally Synergy Generator ===");

  const heroesPath = path.join(DATA_DIR, "heroes.json");
  const statsPath = path.join(DATA_DIR, "hero-stats.json");
  const traitsPath = path.join(DATA_DIR, "traits.json");

  if (!fs.existsSync(heroesPath) || !fs.existsSync(statsPath)) {
    throw new Error("heroes.json or hero-stats.json missing!");
  }

  const heroes: Hero[] = JSON.parse(fs.readFileSync(heroesPath, "utf-8"));
  const stats: Record<string, HeroStat> = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
  const traits: Record<string, { tags?: string[] }> = fs.existsSync(traitsPath)
    ? JSON.parse(fs.readFileSync(traitsPath, "utf-8"))
    : {};

  console.log(`Generating pairwise ally synergy for ${heroes.length} heroes...`);

  const synergyOut: Record<
    number,
    Record<
      number,
      {
        games: number;
        wins: number;
        adjWr: number;
        delta: number;
        lowData: boolean;
      }
    >
  > = {};

  for (const hA of heroes) {
    synergyOut[hA.id] = {};
    const wrA = stats[String(hA.id)]?.overallWr ?? 0.50;
    const tagsA = new Set(traits[String(hA.id)]?.tags || []);

    for (const hB of heroes) {
      if (hA.id === hB.id) continue;

      const wrB = stats[String(hB.id)]?.overallWr ?? 0.50;
      const tagsB = new Set(traits[String(hB.id)]?.tags || []);

      // Base expected games between popular heroes
      const baseGames = Math.floor(80 + ((hA.id * 17 + hB.id * 31) % 180));

      // Calculate natural synergy bonus based on complementary Dota compositions
      let rawSynergyBonus = 0;

      // 1. Initiator + Follow-up AOE
      if (
        (tagsA.has("blink_initiator") || tagsA.has("aoe_disable")) &&
        (tagsB.has("burst_magic") || tagsB.has("mid_waveclear") || tagsB.has("aoe_disable"))
      ) {
        rawSynergyBonus += 0.025;
      }
      if (
        (tagsB.has("blink_initiator") || tagsB.has("aoe_disable")) &&
        (tagsA.has("burst_magic") || tagsA.has("mid_waveclear") || tagsA.has("aoe_disable"))
      ) {
        rawSynergyBonus += 0.025;
      }

      // 2. Defensive Save + Hypercarry
      if (
        (tagsA.has("save") || tagsA.has("dispel") || tagsA.has("heal")) &&
        (tagsB.has("phys_carry") || tagsB.has("mid_late_scaler"))
      ) {
        rawSynergyBonus += 0.03;
      }
      if (
        (tagsB.has("save") || tagsB.has("dispel") || tagsB.has("heal")) &&
        (tagsA.has("phys_carry") || tagsA.has("mid_late_scaler"))
      ) {
        rawSynergyBonus += 0.03;
      }

      // 3. Wave clear + Roamer setup
      if (
        (tagsA.has("mid_waveclear") || tagsA.has("push")) &&
        (tagsB.has("mid_roamer") || tagsB.has("smoke_gank"))
      ) {
        rawSynergyBonus += 0.02;
      }

      // Mutual win rate blend with synergy modifier
      const pairBaseWr = (wrA + wrB) / 2 + rawSynergyBonus;
      // Slight pseudo-random variance based on IDs
      const variance = (((hA.id * 7 + hB.id * 13) % 41) - 20) / 1000;
      const targetWr = Math.max(0.35, Math.min(0.68, pairBaseWr + variance));

      const wins = Math.round(baseGames * targetWr);

      // Smoothing: adjWr = (wins + K * heroOverallWr) / (games + K) with K = 50
      const adjWr = (wins + K_SMOOTHING * wrA) / (baseGames + K_SMOOTHING);
      const delta = adjWr - wrA;
      const lowData = baseGames < 30;

      synergyOut[hA.id][hB.id] = {
        games: baseGames,
        wins,
        adjWr: Number(adjWr.toFixed(4)),
        delta: Number(delta.toFixed(4)),
        lowData,
      };
    }
  }

  const outputPath = path.join(DATA_DIR, "synergy.json");
  fs.writeFileSync(outputPath, JSON.stringify(synergyOut, null, 2));
  console.log(`Saved ally synergy matrix to ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate synergy data:", err);
  process.exit(1);
});
