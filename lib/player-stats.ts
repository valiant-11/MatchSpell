import {
  PersonalMatchRecord,
  PersonalStatsSummary,
  HeroPersonalWinRate,
  MatchupPersonalStats,
  WeakSpotEntry,
  RolePosition,
} from "./types";
import { getHeroRoleFit } from "./roles";
import HEROES_DATA from "@/data/heroes.json";
import MATCHUPS_DATA from "@/data/matchups.json";
import HERO_STATS_DATA from "@/data/hero-stats.json";

interface RawMatchupEntry {
  games: number;
  wins: number;
  adjWr: number;
  delta: number;
}

const matchups = MATCHUPS_DATA as Record<string, Record<string, RawMatchupEntry>>;
const globalHeroStats = HERO_STATS_DATA as Record<string, { winRate?: number; wr?: number; win_rate?: number }>;

/**
 * Infer the played role (1-5) from match data and hero role suitability.
 */
export function inferMatchRole(
  heroId: number,
  playerSlot: number,
  laneRole?: number,
  isRoaming?: boolean
): RolePosition {
  if (isRoaming || laneRole === 4) {
    return 4; // Soft Support / Roamer
  }

  if (laneRole === 2) {
    return 2; // Mid
  }

  const heroFit = getHeroRoleFit(heroId);

  if (laneRole === 1) {
    // Safe Lane: Disambiguate between Carry (Pos 1) and Hard Support (Pos 5)
    const fitCarry = heroFit ? heroFit.roles[1] : 0.5;
    const fitSupport = heroFit ? heroFit.roles[5] : 0.5;
    if (fitSupport > fitCarry + 0.15) {
      return 5;
    }
    return 1;
  }

  if (laneRole === 3) {
    // Off Lane: Disambiguate between Offlane Core (Pos 3) and Soft Support (Pos 4)
    const fitOfflane = heroFit ? heroFit.roles[3] : 0.5;
    const fitSoftSup = heroFit ? heroFit.roles[4] : 0.5;
    if (fitSoftSup > fitOfflane + 0.15) {
      return 4;
    }
    return 3;
  }

  // Fallback if lane_role is missing/unknown (e.g. laneRole === 0 or undefined)
  if (heroFit) {
    return heroFit.primaryRole;
  }

  return 2;
}

/**
 * Determine enemy lane opponents in a match based on roles.
 */
export function determineOpponents(
  myRole: RolePosition,
  enemiesWithRoles: { heroId: number; role: RolePosition }[]
): number[] {
  switch (myRole) {
    case 1: {
      // Pos 1 carries face enemy offlane duo: Pos 3 + Pos 4
      const opps = enemiesWithRoles
        .filter((e) => e.role === 3 || e.role === 4)
        .map((e) => e.heroId);
      return opps.length > 0 ? opps : enemiesWithRoles.map((e) => e.heroId);
    }
    case 2: {
      // Pos 2 mids face enemy mid: Pos 2
      const opps = enemiesWithRoles.filter((e) => e.role === 2).map((e) => e.heroId);
      return opps.length > 0 ? opps : enemiesWithRoles.map((e) => e.heroId);
    }
    case 3: {
      // Pos 3 offlaners face enemy safelane duo: Pos 1 + Pos 5
      const opps = enemiesWithRoles
        .filter((e) => e.role === 1 || e.role === 5)
        .map((e) => e.heroId);
      return opps.length > 0 ? opps : enemiesWithRoles.map((e) => e.heroId);
    }
    case 4: {
      // Pos 4 soft supports face enemy safelane duo: Pos 1 + Pos 5
      const opps = enemiesWithRoles
        .filter((e) => e.role === 1 || e.role === 5)
        .map((e) => e.heroId);
      return opps.length > 0 ? opps : enemiesWithRoles.map((e) => e.heroId);
    }
    case 5: {
      // Pos 5 hard supports face enemy offlane duo: Pos 3 + Pos 4
      const opps = enemiesWithRoles
        .filter((e) => e.role === 3 || e.role === 4)
        .map((e) => e.heroId);
      return opps.length > 0 ? opps : enemiesWithRoles.map((e) => e.heroId);
    }
  }
}

/**
 * Bayesian smoothing for personal matchup win rate towards global matchup win rate.
 * Formula: smoothedWr = (personalWins + K * globalWr) / (personalGames + K) with K = 10.
 */
export function calculateSmoothedWinRate(
  personalWins: number,
  personalGames: number,
  globalWr: number,
  K: number = 10
): number {
  if (personalGames <= 0) return globalWr;
  return (personalWins + K * globalWr) / (personalGames + K);
}

/**
 * Bayesian smoothing for personal matchup delta.
 * delta = smoothedWr - heroOverallWr
 */
export function calculateSmoothedDelta(
  personalWins: number,
  personalGames: number,
  globalWr: number,
  heroOverallWr: number,
  K: number = 10
): number {
  const smoothedWr = calculateSmoothedWinRate(personalWins, personalGames, globalWr, K);
  return smoothedWr - heroOverallWr;
}

/**
 * Aggregate personal matches into role-keyed statistics and Bayesian smoothed deltas.
 */
export function aggregatePersonalStats(
  matches: PersonalMatchRecord[],
  accountId?: string
): PersonalStatsSummary {
  const roleGames: Record<RolePosition, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const heroStatsMap: Record<RolePosition, Record<number, { games: number; wins: number }>> = {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
  };
  const matchupStatsMap: Record<
    RolePosition,
    Record<string, { games: number; wins: number; results: ("win" | "loss")[] }>
  > = {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
  };

  let parsedMatches = 0;

  for (const m of matches) {
    const role = m.role || 2;
    roleGames[role] = (roleGames[role] || 0) + 1;

    if (m.isParsed || (m.purchaseLog && m.purchaseLog.length > 0)) {
      parsedMatches++;
    }

    // Hero win rate aggregation
    if (!heroStatsMap[role][m.myHeroId]) {
      heroStatsMap[role][m.myHeroId] = { games: 0, wins: 0 };
    }
    heroStatsMap[role][m.myHeroId].games++;
    if (m.won) heroStatsMap[role][m.myHeroId].wins++;

    // Matchup aggregation against all enemy heroes in the match
    for (const enemyId of m.enemies) {
      const key = `${m.myHeroId}_${enemyId}`;
      if (!matchupStatsMap[role][key]) {
        matchupStatsMap[role][key] = { games: 0, wins: 0, results: [] };
      }
      matchupStatsMap[role][key].games++;
      if (m.won) matchupStatsMap[role][key].wins++;
      matchupStatsMap[role][key].results.push(m.won ? "win" : "loss");
    }
  }

  // Format heroStats
  const heroStats: Record<RolePosition, Record<number, HeroPersonalWinRate>> = {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
  };
  for (const r of [1, 2, 3, 4, 5] as RolePosition[]) {
    for (const [idStr, hData] of Object.entries(heroStatsMap[r])) {
      const heroId = parseInt(idStr, 10);
      heroStats[r][heroId] = {
        games: hData.games,
        wins: hData.wins,
        winRate: hData.games > 0 ? hData.wins / hData.games : 0.5,
      };
    }
  }

  // Format matchupStats with Bayesian smoothing (K=10)
  const matchupStats: Record<RolePosition, Record<string, MatchupPersonalStats>> = {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
  };

  for (const r of [1, 2, 3, 4, 5] as RolePosition[]) {
    for (const [key, mData] of Object.entries(matchupStatsMap[r])) {
      const [myIdStr, enemyIdStr] = key.split("_");
      const myHeroId = parseInt(myIdStr, 10);
      const enemyHeroId = parseInt(enemyIdStr, 10);

      const globalMatchup = matchups[myIdStr]?.[enemyIdStr];
      const globalWr = globalMatchup ? globalMatchup.adjWr : 0.5;
      const heroStat = globalHeroStats[myIdStr];
      const heroOverallWr = heroStat ? (heroStat.winRate ?? heroStat.wr ?? 0.5) : 0.5;

      const smoothedWr = calculateSmoothedWinRate(mData.wins, mData.games, globalWr, 10);
      const smoothedDelta = smoothedWr - heroOverallWr;

      matchupStats[r][key] = {
        role: r,
        myHeroId,
        enemyHeroId,
        games: mData.games,
        wins: mData.wins,
        winRate: mData.games > 0 ? mData.wins / mData.games : 0.5,
        smoothedWr,
        smoothedDelta,
        recentResults: mData.results.slice(-5),
      };
    }
  }

  return {
    accountId,
    totalMatches: matches.length,
    parsedMatches,
    lastImportTime: Date.now(),
    roleGames,
    heroStats,
    matchupStats,
  };
}

/**
 * Identify weak spots: matchups where smoothed win rate < 45% with games >= 3,
 * sorted by (loss rate * frequency).
 */
export function computeWeakSpots(
  stats: PersonalStatsSummary,
  role?: RolePosition,
  minGames: number = 3,
  maxWinRate: number = 0.45
): WeakSpotEntry[] {
  const weakSpots: WeakSpotEntry[] = [];
  const rolesToScan = role ? [role] : ([1, 2, 3, 4, 5] as RolePosition[]);

  for (const r of rolesToScan) {
    const roleMatchups = stats.matchupStats[r] || {};
    for (const m of Object.values(roleMatchups)) {
      if (m.games >= minGames && m.smoothedWr <= maxWinRate) {
        const losses = m.games - m.wins;
        const lossRate = 1 - m.winRate;
        const score = lossRate * m.games;

        weakSpots.push({
          role: r,
          myHeroId: m.myHeroId,
          enemyHeroId: m.enemyHeroId,
          games: m.games,
          wins: m.wins,
          losses,
          winRate: m.winRate,
          smoothedWr: m.smoothedWr,
          smoothedDelta: m.smoothedDelta,
          score,
        });
      }
    }
  }

  // Sort descending by score (loss rate * frequency)
  return weakSpots.sort((a, b) => b.score - a.score);
}

// ============================================================================
// INDEXED DB CLIENT-SIDE STORAGE
// ============================================================================

const DB_NAME = "matchspell_v2_db";
const DB_VERSION = 1;
const STORE_MATCHES = "matches";
const STORE_META = "meta";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MATCHES)) {
        db.createObjectStore(STORE_MATCHES, { keyPath: "matchId" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMatchesToIDB(matches: PersonalMatchRecord[]): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MATCHES], "readwrite");
    const store = tx.objectStore(STORE_MATCHES);
    for (const match of matches) {
      store.put(match);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadMatchesFromIDB(): Promise<PersonalMatchRecord[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MATCHES], "readonly");
    const store = tx.objectStore(STORE_MATCHES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSummaryToIDB(summary: PersonalStatsSummary): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], "readwrite");
    const store = tx.objectStore(STORE_META);
    store.put({ id: "stats_summary", ...summary });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSummaryFromIDB(): Promise<PersonalStatsSummary | null> {
  if (typeof window === "undefined" || !window.indexedDB) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], "readonly");
    const store = tx.objectStore(STORE_META);
    const req = store.get("stats_summary");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPersonalIDB(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MATCHES, STORE_META], "readwrite");
    tx.objectStore(STORE_MATCHES).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// OPENDOTA CLIENT-SIDE RUNTIME IMPORTER (THROTTLED & RESUMABLE)
// ============================================================================

export interface ImportProgress {
  stage: string;
  current: number;
  total: number;
  percent: number;
}

export async function fetchOpenDotaMatches(
  accountId: string,
  options?: {
    maxMatches?: number;
    onProgress?: (p: ImportProgress) => void;
  }
): Promise<{ matches: PersonalMatchRecord[]; error?: string }> {
  const maxMatches = options?.maxMatches || 300;
  const onProgress = options?.onProgress || (() => {});

  const cleanAccountId = accountId.trim();
  if (!cleanAccountId || !/^\d+$/.test(cleanAccountId)) {
    return { matches: [], error: "Invalid Dota 2 Account ID. Please enter a valid numeric ID." };
  }

  onProgress({ stage: "Connecting to OpenDota API...", current: 0, total: 100, percent: 5 });

  // 1. Fetch player recent matches
  const matchesUrl = `https://api.opendota.com/api/players/${cleanAccountId}/matches?limit=${maxMatches}&project=match_id&project=hero_id&project=player_slot&project=radiant_win&project=start_time&project=duration&project=lane_role&project=is_roaming&project=game_mode&project=lobby_type`;

  let response: Response;
  try {
    response = await fetch(matchesUrl);
  } catch (err: any) {
    return { matches: [], error: `Network error connecting to OpenDota: ${err.message}` };
  }

  if (response.status === 404) {
    return {
      matches: [],
      error: "Profile not found or private. Ensure 'Expose Public Match Data' is enabled in Dota 2 Social settings.",
    };
  }

  if (response.status === 429) {
    return { matches: [], error: "OpenDota rate limit exceeded (429). Please wait a moment and try again." };
  }

  if (!response.ok) {
    return { matches: [], error: `OpenDota API returned error HTTP ${response.status}` };
  }

  const rawMatches = await response.json();
  if (!Array.isArray(rawMatches) || rawMatches.length === 0) {
    return {
      matches: [],
      error: "No public matches found. Your match history may be private in Dota 2 settings.",
    };
  }

  onProgress({
    stage: `Found ${rawMatches.length} matches. Parsing match details...`,
    current: 0,
    total: rawMatches.length,
    percent: 15,
  });

  // Load any previously cached matches from IndexedDB to avoid re-fetching details
  const existingMatches = await loadMatchesFromIDB();
  const existingMap = new Map<number, PersonalMatchRecord>(existingMatches.map((m) => [m.matchId, m]));

  const parsedRecords: PersonalMatchRecord[] = [];
  const toHydrate: any[] = [];

  for (const m of rawMatches) {
    const existing = existingMap.get(m.match_id);
    if (existing && existing.enemies.length > 0) {
      parsedRecords.push(existing);
    } else {
      toHydrate.push(m);
    }
  }

  // Hydrate matches needing details with 1 req/sec throttle
  for (let i = 0; i < toHydrate.length; i++) {
    const m = toHydrate[i];
    const isRadiant = m.player_slot < 128;
    const won = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);
    const inferredRole = inferMatchRole(m.hero_id, m.player_slot, m.lane_role, m.is_roaming);

    let enemies: number[] = [];
    let allies: number[] = [];
    let opponents: number[] = [];
    let isParsed = false;
    let purchaseLog: { item: string; time: number }[] = [];

    // Check if match has players details via single match fetch if needed (sample up to 25 to respect throttle)
    if (i < 25) {
      try {
        const detailRes = await fetch(`https://api.opendota.com/api/matches/${m.match_id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          if (Array.isArray(detail.players)) {
            const enemyPlayersWithRoles: { heroId: number; role: RolePosition }[] = [];
            for (const p of detail.players) {
              const pIsRadiant = p.player_slot < 128;
              if (pIsRadiant === isRadiant) {
                if (p.hero_id !== m.hero_id) allies.push(p.hero_id);
              } else {
                enemies.push(p.hero_id);
                const pRole = inferMatchRole(p.hero_id, p.player_slot, p.lane_role, p.is_roaming);
                enemyPlayersWithRoles.push({ heroId: p.hero_id, role: pRole });
              }

              // Extract purchase_log for player if parsed
              if (p.hero_id === m.hero_id && Array.isArray(p.purchase_log)) {
                isParsed = true;
                purchaseLog = p.purchase_log.map((log: any) => ({
                  item: log.key,
                  time: log.time,
                }));
              }
            }
            opponents = determineOpponents(inferredRole, enemyPlayersWithRoles);
          }
        }
      } catch (e) {
        // Fallback gracefully on rate limits or errors
      }

      // Throttle 1 second per match fetch
      await new Promise((r) => setTimeout(r, 1050));
    }

    parsedRecords.push({
      matchId: m.match_id,
      startTime: m.start_time,
      duration: m.duration,
      myHeroId: m.hero_id,
      role: inferredRole,
      won,
      allies,
      enemies,
      opponents,
      isParsed,
      purchaseLog,
    });

    const percent = Math.min(95, 15 + Math.round(((i + 1) / toHydrate.length) * 80));
    onProgress({
      stage: `Importing match ${i + 1} of ${toHydrate.length}...`,
      current: i + 1,
      total: toHydrate.length,
      percent,
    });
  }

  // Save to IndexedDB
  await saveMatchesToIDB(parsedRecords);
  const summary = aggregatePersonalStats(parsedRecords, cleanAccountId);
  await saveSummaryToIDB(summary);

  onProgress({
    stage: "Import completed successfully!",
    current: parsedRecords.length,
    total: parsedRecords.length,
    percent: 100,
  });

  return { matches: parsedRecords };
}
