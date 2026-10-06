import fs from "node:fs";
import path from "node:path";
import { Hero } from "../lib/types";

interface OpenDotaHeroStats {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: string;
  pub_pick: number;
  pub_win: number;
  "1_pick"?: number;
  "1_win"?: number;
  "2_pick"?: number;
  "2_win"?: number;
  "3_pick"?: number;
  "3_win"?: number;
  "4_pick"?: number;
  "4_win"?: number;
  "5_pick"?: number;
  "5_win"?: number;
  "6_pick"?: number;
  "6_win"?: number;
  "7_pick"?: number;
  "7_win"?: number;
  "8_pick"?: number;
  "8_win"?: number;
  pro_pick?: number;
  pro_win?: number;
}

interface OpenDotaMatchup {
  hero_id: number;
  games_played: number;
  wins: number;
}

interface OpenDotaDuration {
  duration_bin: number;
  games_played: number;
  wins: number;
}

interface OpenDotaItemPopularity {
  start_game_items?: Record<string, number>;
  early_game_items?: Record<string, number>;
  mid_game_items?: Record<string, number>;
  late_game_items?: Record<string, number>;
}

const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";
const OPENDOTA_BASE = "https://api.opendota.com/api";
const K_SMOOTHING = 50;

// Directories
const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const RAW_DIR = path.join(DATA_DIR, "raw");
const RAW_MATCHUPS_DIR = path.join(RAW_DIR, "matchups");
const RAW_DURATIONS_DIR = path.join(RAW_DIR, "durations");
const RAW_ITEMS_DIR = path.join(RAW_DIR, "items");

[DATA_DIR, SNAPSHOTS_DIR, RAW_DIR, RAW_MATCHUPS_DIR, RAW_DURATIONS_DIR, RAW_ITEMS_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

function snapshotCurrentData() {
  const snapshotFiles = [
    "matchups.json",
    "hero-stats.json",
    "hero-roles.json",
    "item-popularity.json",
    "durations.json",
    "synergy.json",
  ];
  const existingFiles = snapshotFiles.filter((f) => fs.existsSync(path.join(DATA_DIR, f)));
  if (existingFiles.length === 0) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const snapshotFolder = path.join(SNAPSHOTS_DIR, `${timestamp}_snapshot`);
  fs.mkdirSync(snapshotFolder, { recursive: true });

  for (const f of existingFiles) {
    fs.copyFileSync(path.join(DATA_DIR, f), path.join(snapshotFolder, f));
  }
  console.log(`[Snapshot] Archived current data to ${snapshotFolder}`);

  // Retain last 5 snapshots
  const allSnapshots = fs.readdirSync(SNAPSHOTS_DIR).filter((item) =>
    fs.statSync(path.join(SNAPSHOTS_DIR, item)).isDirectory()
  );
  if (allSnapshots.length > 5) {
    const sorted = [...allSnapshots].sort();
    const toPrune = sorted.slice(0, sorted.length - 5);
    for (const folder of toPrune) {
      fs.rmSync(path.join(SNAPSHOTS_DIR, folder), { recursive: true, force: true });
      console.log(`[Snapshot] Pruned older snapshot: ${folder}`);
    }
  }
}

// Helper: sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Throttled fetch with retry on 429
async function fetchWithRetry<T>(url: string, retries = 5, backoffMs = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "MatchSpell-Dota-Trainer/1.0" },
      });

      if (res.status === 429) {
        const wait = backoffMs * attempt;
        console.warn(`[429 Rate Limited] URL: ${url}. Waiting ${wait}ms before attempt ${attempt}/${retries}...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = backoffMs * attempt;
      console.warn(`[Network/Fetch Error] ${err}. Retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function main() {
  console.log("=== MatchSpell Data Pipeline: Refreshing Data ===");

  // 0. Snapshot previous data
  snapshotCurrentData();

  // 1. Load heroes.json
  const heroesPath = path.join(DATA_DIR, "heroes.json");
  if (!fs.existsSync(heroesPath)) {
    throw new Error("data/heroes.json not found! Run npm run data:update or fetch-constants first.");
  }
  const heroes: Hero[] = JSON.parse(fs.readFileSync(heroesPath, "utf-8"));
  console.log(`Loaded ${heroes.length} heroes from ${heroesPath}`);

  // 2. Load items.raw.json
  const itemsRawPath = path.join(RAW_DIR, "items.raw.json");
  let itemsRaw: Record<string, { id: number; dname?: string; img?: string; cost?: number }> = {};
  if (fs.existsSync(itemsRawPath)) {
    itemsRaw = JSON.parse(fs.readFileSync(itemsRawPath, "utf-8"));
  }

  // Map item numeric ID -> item details
  const itemById: Record<number, { key: string; name: string; img: string; cost: number }> = {};
  for (const [key, item] of Object.entries(itemsRaw)) {
    if (item && typeof item.id === "number") {
      let img = item.img || "";
      if (img.startsWith("/")) img = `${STEAM_CDN}${img}`;
      else if (img && !img.startsWith("http")) img = `${STEAM_CDN}/${img}`;
      itemById[item.id] = {
        key,
        name: item.dname || key,
        img,
        cost: item.cost || 0,
      };
    }
  }

  // 3. Fetch Hero Stats
  console.log("Fetching Hero Stats from OpenDota...");
  const heroStatsRawPath = path.join(RAW_DIR, "heroStats.raw.json");
  let rawStats: OpenDotaHeroStats[];
  if (fs.existsSync(heroStatsRawPath)) {
    console.log("Using cached heroStats.raw.json");
    rawStats = JSON.parse(fs.readFileSync(heroStatsRawPath, "utf-8"));
  } else {
    rawStats = await fetchWithRetry<OpenDotaHeroStats[]>(`${OPENDOTA_BASE}/heroStats`);
    fs.writeFileSync(heroStatsRawPath, JSON.stringify(rawStats, null, 2));
    await sleep(1000);
  }

  // Calculate bracket totals for pick rates
  const statsMap: Record<number, OpenDotaHeroStats> = {};
  rawStats.forEach((s) => {
    statsMap[s.id] = s;
  });

  const heroStatsOut: Record<
    number,
    {
      heroId: number;
      name: string;
      overallWr: number;
      overallGames: number;
      pickRate: number;
      brackets: Record<string, { wins: number; games: number; wr: number }>;
    }
  > = {};

  for (const h of heroes) {
    const s = statsMap[h.id];
    const pubGames = s?.pub_pick || 1;
    const pubWins = s?.pub_win || 0;
    const overallWr = pubGames > 0 ? pubWins / pubGames : 0.5;

    // Divine / Immortal (bracket 8)
    const b8Games = s?.["8_pick"] || 0;
    const b8Wins = s?.["8_win"] || 0;
    const b8Wr = b8Games > 0 ? b8Wins / b8Games : overallWr;

    // Ancient (bracket 7)
    const b7Games = s?.["7_pick"] || 0;
    const b7Wins = s?.["7_win"] || 0;
    const b7Wr = b7Games > 0 ? b7Wins / b7Games : overallWr;

    // Legend (bracket 6)
    const b6Games = s?.["6_pick"] || 0;
    const b6Wins = s?.["6_win"] || 0;
    const b6Wr = b6Games > 0 ? b6Wins / b6Games : overallWr;

    heroStatsOut[h.id] = {
      heroId: h.id,
      name: h.name,
      overallWr: Number(overallWr.toFixed(4)),
      overallGames: pubGames,
      pickRate: Number((pubGames / 1000000).toFixed(4)),
      brackets: {
        "8": { wins: b8Wins, games: b8Games, wr: Number(b8Wr.toFixed(4)) },
        "7": { wins: b7Wins, games: b7Games, wr: Number(b7Wr.toFixed(4)) },
        "6": { wins: b6Wins, games: b6Games, wr: Number(b6Wr.toFixed(4)) },
        all: { wins: pubWins, games: pubGames, wr: Number(overallWr.toFixed(4)) },
      },
    };
  }

  fs.writeFileSync(path.join(DATA_DIR, "hero-stats.json"), JSON.stringify(heroStatsOut, null, 2));
  console.log(`Saved data/hero-stats.json for ${Object.keys(heroStatsOut).length} heroes.`);

  // 4. Matchups, Durations, and Item Popularity per hero
  // We check command line args for --limit if testing
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const maxHeroes = limitArg ? parseInt(limitArg.split("=")[1], 10) : heroes.length;
  const targetHeroes = heroes.slice(0, maxHeroes);

  console.log(`Processing matchups, durations, item popularity for ${targetHeroes.length} heroes (Throttle: ~800ms)...`);

  const rawMatchupsMap: Record<number, Record<number, { games: number; wins: number }>> = {};
  const durationsOut: Record<number, any> = {};
  const itemPopularityOut: Record<number, any> = {};

  for (let i = 0; i < targetHeroes.length; i++) {
    const hero = targetHeroes[i];
    const heroId = hero.id;

    // A. Matchups
    const matchupCache = path.join(RAW_MATCHUPS_DIR, `matchups_${heroId}.json`);
    let heroMatchups: OpenDotaMatchup[];
    if (fs.existsSync(matchupCache)) {
      heroMatchups = JSON.parse(fs.readFileSync(matchupCache, "utf-8"));
    } else {
      console.log(`[${i + 1}/${targetHeroes.length}] Fetching matchups for ${hero.localized_name} (${heroId})...`);
      try {
        heroMatchups = await fetchWithRetry<OpenDotaMatchup[]>(`${OPENDOTA_BASE}/heroes/${heroId}/matchups`);
        fs.writeFileSync(matchupCache, JSON.stringify(heroMatchups, null, 2));
        await sleep(800);
      } catch (err) {
        console.error(`Error fetching matchups for hero ${heroId}:`, err);
        heroMatchups = [];
      }
    }

    rawMatchupsMap[heroId] = {};
    for (const m of heroMatchups) {
      rawMatchupsMap[heroId][m.hero_id] = {
        games: m.games_played,
        wins: m.wins,
      };
    }

    // B. Durations
    const durationCache = path.join(RAW_DURATIONS_DIR, `durations_${heroId}.json`);
    let heroDurations: OpenDotaDuration[];
    if (fs.existsSync(durationCache)) {
      heroDurations = JSON.parse(fs.readFileSync(durationCache, "utf-8"));
    } else {
      console.log(`[${i + 1}/${targetHeroes.length}] Fetching durations for ${hero.localized_name} (${heroId})...`);
      try {
        heroDurations = await fetchWithRetry<OpenDotaDuration[]>(`${OPENDOTA_BASE}/heroes/${heroId}/durations`);
        fs.writeFileSync(durationCache, JSON.stringify(heroDurations, null, 2));
        await sleep(800);
      } catch (err) {
        console.error(`Error fetching durations for hero ${heroId}:`, err);
        heroDurations = [];
      }
    }

    // Derive earlyScore (<= 35 min / 2100s) and lateScore (>= 40 min / 2400s)
    let earlyGames = 0;
    let earlyWins = 0;
    let lateGames = 0;
    let lateWins = 0;
    let peakBin = 2100;
    let peakWr = 0;

    const sortedDurations = (heroDurations || []).sort((a, b) => a.duration_bin - b.duration_bin);
    for (const d of sortedDurations) {
      if (d.games_played >= 10) {
        const wr = d.wins / d.games_played;
        if (wr > peakWr) {
          peakWr = wr;
          peakBin = d.duration_bin;
        }
      }
      if (d.duration_bin <= 2100) {
        earlyGames += d.games_played;
        earlyWins += d.wins;
      }
      if (d.duration_bin >= 2400) {
        lateGames += d.games_played;
        lateWins += d.wins;
      }
    }

    const heroWr = heroStatsOut[heroId]?.overallWr || 0.5;
    const earlyWr = earlyGames > 0 ? earlyWins / earlyGames : heroWr;
    const lateWr = lateGames > 0 ? lateWins / lateGames : heroWr;

    durationsOut[heroId] = {
      heroId,
      earlyScore: Number(earlyWr.toFixed(4)),
      lateScore: Number(lateWr.toFixed(4)),
      peakMinute: Math.round(peakBin / 60),
      buckets: sortedDurations.map((d) => ({
        bin: d.duration_bin,
        minutes: Math.round(d.duration_bin / 60),
        games: d.games_played,
        wins: d.wins,
        wr: d.games_played > 0 ? Number((d.wins / d.games_played).toFixed(4)) : 0,
      })),
    };

    // C. Item Popularity
    const itemCache = path.join(RAW_ITEMS_DIR, `item_pop_${heroId}.json`);
    let heroItemPop: OpenDotaItemPopularity;
    if (fs.existsSync(itemCache)) {
      heroItemPop = JSON.parse(fs.readFileSync(itemCache, "utf-8"));
    } else {
      console.log(`[${i + 1}/${targetHeroes.length}] Fetching item popularity for ${hero.localized_name} (${heroId})...`);
      try {
        heroItemPop = await fetchWithRetry<OpenDotaItemPopularity>(`${OPENDOTA_BASE}/heroes/${heroId}/itemPopularity`);
        fs.writeFileSync(itemCache, JSON.stringify(heroItemPop, null, 2));
        await sleep(800);
      } catch (err) {
        console.error(`Error fetching item popularity for hero ${heroId}:`, err);
        heroItemPop = {};
      }
    }

    const formatPhaseItems = (itemObj?: Record<string, number>) => {
      if (!itemObj) return [];
      return Object.entries(itemObj)
        .map(([idStr, count]) => {
          const numId = parseInt(idStr, 10);
          const meta = itemById[numId];
          return {
            id: numId,
            key: meta?.key || `item_${numId}`,
            name: meta?.name || `Item ${numId}`,
            img: meta?.img || "",
            cost: meta?.cost || 0,
            count,
          };
        })
        .sort((a, b) => b.count - a.count);
    };

    itemPopularityOut[heroId] = {
      heroId,
      start_game_items: formatPhaseItems(heroItemPop.start_game_items).slice(0, 8),
      early_game_items: formatPhaseItems(heroItemPop.early_game_items).slice(0, 8),
      mid_game_items: formatPhaseItems(heroItemPop.mid_game_items).slice(0, 10),
      late_game_items: formatPhaseItems(heroItemPop.late_game_items).slice(0, 10),
    };
  }

  // 5. Build data/matchups.json with symmetry fallback & smoothing formula
  console.log("Computing smoothed matchups matrix...");
  const matchupsOut: Record<
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

  for (const myHero of heroes) {
    const myId = myHero.id;
    matchupsOut[myId] = {};
    const myOverallWr = heroStatsOut[myId]?.brackets["8"]?.wr || heroStatsOut[myId]?.overallWr || 0.5;

    for (const enemyHero of heroes) {
      const enemyId = enemyHero.id;
      if (myId === enemyId) continue;

      let games = 0;
      let wins = 0;

      // Check direct matchup record
      if (rawMatchupsMap[myId] && rawMatchupsMap[myId][enemyId]) {
        games = rawMatchupsMap[myId][enemyId].games;
        wins = rawMatchupsMap[myId][enemyId].wins;
      } else if (rawMatchupsMap[enemyId] && rawMatchupsMap[enemyId][myId]) {
        // Symmetry complement: enemy vs me => games is same, my wins = games - enemy wins
        games = rawMatchupsMap[enemyId][myId].games;
        wins = Math.max(0, games - rawMatchupsMap[enemyId][myId].wins);
      }

      // Smoothing: adjWr = (wins + K * heroOverallWr) / (games + K) with K = 50
      const adjWr = (wins + K_SMOOTHING * myOverallWr) / (games + K_SMOOTHING);
      const delta = adjWr - myOverallWr;
      const lowData = games < 30;

      matchupsOut[myId][enemyId] = {
        games,
        wins,
        adjWr: Number(adjWr.toFixed(4)),
        delta: Number(delta.toFixed(4)),
        lowData,
      };
    }
  }

  fs.writeFileSync(path.join(DATA_DIR, "matchups.json"), JSON.stringify(matchupsOut, null, 2));
  console.log(`Saved data/matchups.json for ${Object.keys(matchupsOut).length} heroes.`);

  fs.writeFileSync(path.join(DATA_DIR, "durations.json"), JSON.stringify(durationsOut, null, 2));
  console.log(`Saved data/durations.json for ${Object.keys(durationsOut).length} heroes.`);

  fs.writeFileSync(path.join(DATA_DIR, "item-popularity.json"), JSON.stringify(itemPopularityOut, null, 2));
  console.log(`Saved data/item-popularity.json for ${Object.keys(itemPopularityOut).length} heroes.`);

  // 6. Ensure mid-notes.seed.json exists
  const notesSeedPath = path.join(DATA_DIR, "mid-notes.seed.json");
  if (!fs.existsSync(notesSeedPath)) {
    const initialNotesSeed = {
      // Sample seed for classic mid matchup: Storm Spirit vs Shadow Fiend
      "17_11": {
        myHeroId: 17,
        enemyHeroId: 11,
        notes: "Abuse SF before level 3. Look to dodge razes using Ball Lightning after 6. Pull wave onto high ground.",
        skipTake: "Bottle first, rush Orchid / Eul's.",
        runePlan: "Shove wave at :45 with Remnant to secure 2/4/6 min power runes.",
        keyItems: "orchid_malevolence, euls_scepter, bkb",
        mistakeToAvoid: "Getting hit by double or triple raze at level 5 without creep advantage.",
      },
      // Sample seed for Puck vs Queen of Pain
      "13_39": {
        myHeroId: 13,
        enemyHeroId: 39,
        notes: "Phase Shift Shadow Strike projectile reliably. Do not commit Illusory Orb forward unless Scream is on cooldown.",
        skipTake: "Stick is mandatory. Max Illusory Orb and Phase Shift.",
        runePlan: "Orb through creeps to contest water and power runes.",
        keyItems: "witch_blade, blink, euls_scepter",
        mistakeToAvoid: "Failing to Phase Shift Shadow Strike early.",
      },
    };
    fs.writeFileSync(notesSeedPath, JSON.stringify(initialNotesSeed, null, 2));
    console.log("Created data/mid-notes.seed.json");
  }

  console.log("=== MatchSpell Data Pipeline Complete! ===");
}

main().catch((err) => {
  console.error("Pipeline failure:", err);
  process.exit(1);
});
