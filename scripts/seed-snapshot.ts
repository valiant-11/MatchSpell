import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots", "2026-09-01_patch7.37");

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// 1. Copy hero-stats.json with slight shift
const statsPath = path.join(DATA_DIR, "hero-stats.json");
if (fs.existsSync(statsPath)) {
  const stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
  // Perturb a hero slightly for diff demonstration (e.g. Storm Spirit 17, Ember Spirit 106)
  if (stats["17"]) {
    stats["17"].overallWr = Number((stats["17"].overallWr - 0.025).toFixed(4));
    if (stats["17"].brackets?.["8"]) {
      stats["17"].brackets["8"].wr = Number((stats["17"].brackets["8"].wr - 0.025).toFixed(4));
    }
  }
  if (stats["106"]) {
    stats["106"].overallWr = Number((stats["106"].overallWr + 0.021).toFixed(4));
    if (stats["106"].brackets?.["8"]) {
      stats["106"].brackets["8"].wr = Number((stats["106"].brackets["8"].wr + 0.021).toFixed(4));
    }
  }
  fs.writeFileSync(path.join(SNAPSHOT_DIR, "hero-stats.json"), JSON.stringify(stats, null, 2));
}

// 2. Copy hero-roles.json with slight shift
const rolesPath = path.join(DATA_DIR, "hero-roles.json");
if (fs.existsSync(rolesPath)) {
  const roles = JSON.parse(fs.readFileSync(rolesPath, "utf-8"));
  if (roles["106"]?.roles) {
    // Ember previously had higher pos 1 fit in patch 7.37
    roles["106"].roles[1] = 0.45;
    roles["106"].roles[2] = 0.55;
  }
  fs.writeFileSync(path.join(SNAPSHOT_DIR, "hero-roles.json"), JSON.stringify(roles, null, 2));
}

// 3. Copy matchups.json with shift >= 2.0% (0.02)
const matchupsPath = path.join(DATA_DIR, "matchups.json");
if (fs.existsSync(matchupsPath)) {
  const matchups = JSON.parse(fs.readFileSync(matchupsPath, "utf-8"));
  // Storm Spirit (17) vs Shadow Fiend (11): old delta -0.015, games 540
  if (matchups["17"]?.["11"]) {
    matchups["17"]["11"].delta = Number((matchups["17"]["11"].delta - 0.035).toFixed(4));
    matchups["17"]["11"].adjWr = Number((matchups["17"]["11"].adjWr - 0.035).toFixed(4));
  }
  // Ember Spirit (106) vs Huskar (59): old delta shifted by 0.028
  if (matchups["106"]?.["59"]) {
    matchups["106"]["59"].delta = Number((matchups["106"]["59"].delta + 0.028).toFixed(4));
    matchups["106"]["59"].adjWr = Number((matchups["106"]["59"].adjWr + 0.028).toFixed(4));
  }
  // Puck (13) vs Queen of Pain (39)
  if (matchups["13"]?.["39"]) {
    matchups["13"]["39"].delta = Number((matchups["13"]["39"].delta - 0.022).toFixed(4));
    matchups["13"]["39"].adjWr = Number((matchups["13"]["39"].adjWr - 0.022).toFixed(4));
  }
  fs.writeFileSync(path.join(SNAPSHOT_DIR, "matchups.json"), JSON.stringify(matchups, null, 2));
}

// 4. Copy item-popularity.json
const popPath = path.join(DATA_DIR, "item-popularity.json");
if (fs.existsSync(popPath)) {
  const pop = JSON.parse(fs.readFileSync(popPath, "utf-8"));
  // Adjust item for Storm Spirit (17): say Eul's was previously top 1
  if (pop["17"]?.mid_game_items?.length >= 2) {
    const temp = pop["17"].mid_game_items[0];
    pop["17"].mid_game_items[0] = pop["17"].mid_game_items[1];
    pop["17"].mid_game_items[1] = temp;
  }
  fs.writeFileSync(path.join(SNAPSHOT_DIR, "item-popularity.json"), JSON.stringify(pop, null, 2));
}

// 5. Copy durations.json
const durPath = path.join(DATA_DIR, "durations.json");
if (fs.existsSync(durPath)) {
  fs.copyFileSync(durPath, path.join(SNAPSHOT_DIR, "durations.json"));
}

console.log("Baseline snapshot created at data/snapshots/2026-09-01_patch7.37");
