import { RolePosition } from "./types";
import rawItemPopularity from "@/data/item-popularity.json";

export interface ItemTimingBenchmark {
  sampleCount: number;
  p25: number; // seconds
  median: number; // seconds
  p75: number; // seconds
}

export interface HeroRoleBenchmarks {
  [itemKey: string]: ItemTimingBenchmark;
}

export interface BenchmarksData {
  generatedAt: number;
  source: string;
  // benchmarks[role][heroId] = HeroRoleBenchmarks
  benchmarks: Record<string, Record<string, HeroRoleBenchmarks>>;
}

/**
 * Key items allowlist per role per specification:
 * carries: BKB, Battle Fury, Manta, Skadi, Butterfly, Satanic, Silver Edge, MKB...
 * mids: Blink, BKB, Aghs (ultimate_scepter), Orchid, Bloodstone, Witch Blade, Kaya & Sange...
 * offlane: Blink, Pipe, Crimson, Shiva's, Blade Mail, Halberd, Lotus...
 * supports: Glimmer, Force, Mekansm, Guardian Greaves, Lotus, Aether Lens, Spirit Vessel, Ghost...
 */
export const ROLE_KEY_ITEMS: Record<RolePosition, string[]> = {
  1: [
    "black_king_bar",
    "bfury",
    "manta",
    "skadi",
    "butterfly",
    "satanic",
    "silver_edge",
    "monkey_king_bar",
    "diffusal_blade",
    "nullifier",
  ],
  2: [
    "blink",
    "black_king_bar",
    "ultimate_scepter",
    "orchid",
    "bloodstone",
    "witch_blade",
    "yasha_and_kaya",
    "kaya_and_sange",
    "manta",
    "shivas_guard",
  ],
  3: [
    "blink",
    "pipe",
    "crimson_guard",
    "shivas_guard",
    "blade_mail",
    "heavens_halberd",
    "lotus_orb",
    "black_king_bar",
    "heart",
  ],
  4: [
    "glimmer_cape",
    "force_staff",
    "blink",
    "aether_lens",
    "urn_of_shadows",
    "spirit_vessel",
    "lotus_orb",
    "boots_of_bearing",
    "solar_crest",
    "cyclone",
  ],
  5: [
    "glimmer_cape",
    "force_staff",
    "mekansm",
    "guardian_greaves",
    "ghost",
    "solar_crest",
    "holy_locket",
    "lotus_orb",
    "tranquil_boots",
  ],
};

/**
 * Compute percentile from a sorted or unsorted list of numbers.
 */
export function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Format seconds into mm:ss format.
 */
export function formatTimeSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export interface TimingVerdict {
  diffSeconds: number; // positive = late, negative = early
  verdict: string;
  status: "early" | "on_time" | "late";
}

/**
 * Calculate verdict comparing personal timing vs benchmark median.
 * Thresholds:
 * - early: diff <= -60 (e.g. "~1:30 early on BKB")
 * - on_time: -60 < diff <= 60 ("On time on BKB")
 * - late: diff > 60 (e.g. "~2:15 late on BKB")
 */
export function calculateTimingVerdict(
  myTimeSeconds: number,
  benchmarkMedianSeconds: number,
  itemName = "Item"
): TimingVerdict {
  const diff = myTimeSeconds - benchmarkMedianSeconds;
  const absDiff = Math.abs(diff);
  const diffFormatted = formatTimeSeconds(absDiff);

  if (diff <= -60) {
    return {
      diffSeconds: diff,
      verdict: `~${diffFormatted} early on ${itemName}`,
      status: "early",
    };
  }

  if (diff > 60) {
    return {
      diffSeconds: diff,
      verdict: `~${diffFormatted} late on ${itemName}`,
      status: "late",
    };
  }

  return {
    diffSeconds: diff,
    verdict: `On time on ${itemName}`,
    status: "on_time",
  };
}

/**
 * Get the intersection of role key items and that hero's popular items.
 */
export function getHeroRoleKeyItems(heroId: number, role: RolePosition): string[] {
  const roleAllowlist = new Set(ROLE_KEY_ITEMS[role] || []);
  const heroPop = (rawItemPopularity as unknown as Record<string, any>)[String(heroId)] || {};

  const heroItems = new Set<string>();
  const phases = ["start_game_items", "early_game_items", "mid_game_items", "late_game_items"];
  for (const phase of phases) {
    const list = heroPop[phase];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item?.key) heroItems.add(item.key);
      }
    }
  }

  // Intersect role allowlist with hero popular items
  const intersection = Array.from(roleAllowlist).filter((item) => heroItems.has(item));

  // If intersection is small (< 3), supplement with top role key items
  if (intersection.length < 3) {
    return ROLE_KEY_ITEMS[role].slice(0, 5);
  }

  return intersection;
}

/**
 * Extract personal key item purchase times from match purchase logs.
 */
export function extractPersonalItemTimings(
  purchaseLog: { item: string; time: number }[],
  keyItems: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  const targetSet = new Set(keyItems);

  for (const entry of purchaseLog) {
    // Only capture first purchase of the item
    if (targetSet.has(entry.item) && result[entry.item] === undefined) {
      result[entry.item] = entry.time;
    }
  }

  return result;
}

/**
 * Request match parse on OpenDota: POST https://api.opendota.com/api/request/{match_id}
 */
export async function requestMatchParse(
  matchId: number
): Promise<{ job?: { jobId: number }; error?: string }> {
  try {
    const res = await fetch(`https://api.opendota.com/api/request/${matchId}`, {
      method: "POST",
    });

    if (res.status === 429) {
      return { error: "Rate limit exceeded. Please wait a moment." };
    }

    if (!res.ok) {
      return { error: `Failed to request parse (HTTP ${res.status})` };
    }

    const data = await res.json();
    return { job: data };
  } catch (err: any) {
    return { error: err.message || "Network error requesting parse" };
  }
}
