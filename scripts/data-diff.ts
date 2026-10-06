import fs from "node:fs";
import path from "node:path";
import {
  compareMatchups,
  compareHeroStats,
  compareRoleFits,
  compareItemPopularity,
  PatchDiffSummary,
} from "../lib/diff";

const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const OUTPUT_DIFF_PATH = path.join(DATA_DIR, "patch-diff.json");

async function main() {
  console.log("=== MatchSpell Patch-Change Diff Engine ===");

  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    console.error("No snapshots directory found in data/snapshots. Run data:update first.");
    process.exit(1);
  }

  const snapshots = fs.readdirSync(SNAPSHOTS_DIR).filter((f) =>
    fs.statSync(path.join(SNAPSHOTS_DIR, f)).isDirectory()
  );

  if (snapshots.length === 0) {
    console.error("No previous snapshots found to diff against.");
    process.exit(1);
  }

  // Pick the latest snapshot (sorted chronologically/alphabetically)
  const sortedSnapshots = [...snapshots].sort();
  const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
  const snapshotPath = path.join(SNAPSHOTS_DIR, latestSnapshot);

  console.log(`Comparing current data against snapshot: ${latestSnapshot}...`);

  // Load files
  const readJson = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {});

  const oldMatchups = readJson(path.join(snapshotPath, "matchups.json"));
  const newMatchups = readJson(path.join(DATA_DIR, "matchups.json"));

  const oldHeroStats = readJson(path.join(snapshotPath, "hero-stats.json"));
  const newHeroStats = readJson(path.join(DATA_DIR, "hero-stats.json"));

  const oldHeroRoles = readJson(path.join(snapshotPath, "hero-roles.json"));
  const newHeroRoles = readJson(path.join(DATA_DIR, "hero-roles.json"));

  const oldItemPop = readJson(path.join(snapshotPath, "item-popularity.json"));
  const newItemPop = readJson(path.join(DATA_DIR, "item-popularity.json"));

  // Run comparisons
  const matchupDiffs = compareMatchups(oldMatchups, newMatchups, 0.02, 100);
  const heroStatDiffs = compareHeroStats(oldHeroStats, newHeroStats, 0.015);
  const roleFitDiffs = compareRoleFits(oldHeroRoles, newHeroRoles, 0.05);
  const itemShifts = compareItemPopularity(oldItemPop, newItemPop);

  const summary: PatchDiffSummary = {
    comparedRange: {
      oldDateOrPatch: latestSnapshot,
      newDateOrPatch: "Current Live / 7.37e+",
    },
    generatedAt: Date.now(),
    matchupDiffs,
    heroStatDiffs,
    roleFitDiffs,
    itemShifts,
  };

  fs.writeFileSync(OUTPUT_DIFF_PATH, JSON.stringify(summary, null, 2));
  console.log(`Saved patch diff summary to ${OUTPUT_DIFF_PATH}`);
  console.log(`\n--- Summary Results ---`);
  console.log(`Matchup delta shifts (>= 2.0%, min 100 games): ${matchupDiffs.length}`);
  for (const m of matchupDiffs.slice(0, 5)) {
    const shiftPercent = (m.deltaShift * 100).toFixed(1);
    console.log(`  Hero ${m.myHeroId} vs Hero ${m.enemyHeroId}: ${(m.oldDelta * 100).toFixed(1)}% -> ${(m.newDelta * 100).toFixed(1)}% (${shiftPercent}%), N=${m.newGames}`);
  }
  console.log(`Hero Win Rate shifts (>= 1.5%): ${heroStatDiffs.length}`);
  for (const s of heroStatDiffs.slice(0, 5)) {
    console.log(`  Hero ${s.heroId}: ${(s.oldWr * 100).toFixed(1)}% -> ${(s.newWr * 100).toFixed(1)}% (${(s.shift * 100).toFixed(1)}%)`);
  }
  console.log(`Hero Role Suitability shifts (>= 5%): ${roleFitDiffs.length}`);
  for (const r of roleFitDiffs.slice(0, 5)) {
    console.log(`  Hero ${r.heroId} Pos ${r.role}: ${(r.oldFit * 100).toFixed(0)}% -> ${(r.newFit * 100).toFixed(0)}%`);
  }
  console.log(`Item Build Shifts: ${itemShifts.length}`);
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Diff execution failed:", err);
  process.exit(1);
});
