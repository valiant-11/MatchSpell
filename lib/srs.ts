import { SRSEntry, LEITNER_INTERVALS_DAYS, RolePosition } from "./types";
import { getMatchupNoteKey } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a new SRS entry in Box 1, due immediately.
 * Supports both createSRSEntry(myHero, enemyHero, now) and createSRSEntry(myHero, enemyHero, role, partnerId, now).
 */
export function createSRSEntry(
  myHeroId: number,
  enemyHeroId: number,
  roleOrNow: RolePosition | number = 2,
  lanePartnerIdOrNow?: number,
  nowTime?: number
): SRSEntry {
  let role: RolePosition = 2;
  let lanePartnerId: number | undefined = undefined;
  let now = Date.now();

  if (typeof roleOrNow === "number") {
    if (roleOrNow > 10) {
      // Legacy signature: createSRSEntry(myHeroId, enemyHeroId, now)
      now = roleOrNow;
      role = 2;
    } else {
      role = roleOrNow as RolePosition;
      if (typeof lanePartnerIdOrNow === "number") {
        if (lanePartnerIdOrNow > 1000) {
          now = lanePartnerIdOrNow;
        } else {
          lanePartnerId = lanePartnerIdOrNow;
          if (nowTime !== undefined) now = nowTime;
        }
      }
    }
  }

  const matchupKey = getMatchupNoteKey(role, myHeroId, enemyHeroId, lanePartnerId);
  return {
    matchupKey,
    role,
    myHeroId,
    enemyHeroId,
    lanePartnerId,
    box: 1,
    lastReviewDate: 0,
    nextDueDate: now,
    streak: 0,
    history: [],
  };
}

/**
 * Handles a correct drill response:
 * Advances to next Leitner box (up to 5), extends nextDueDate based on box interval, increments streak.
 */
export function advanceSRS(entry: SRSEntry, now = Date.now()): SRSEntry {
  const currentBox = entry.box || 1;
  const nextBox = Math.min(5, currentBox + 1);
  const intervalDays = LEITNER_INTERVALS_DAYS[nextBox - 1] ?? 1;
  const nextDueDate = now + intervalDays * DAY_MS;

  return {
    ...entry,
    box: nextBox,
    lastReviewDate: now,
    nextDueDate,
    streak: (entry.streak || 0) + 1,
    history: [...(entry.history || []), { date: now, correct: true }],
  };
}

/**
 * Handles a failed drill response:
 * Resets box back to Box 1, sets nextDueDate to now (due immediately), resets streak.
 */
export function failSRS(entry: SRSEntry, now = Date.now()): SRSEntry {
  return {
    ...entry,
    box: 1,
    lastReviewDate: now,
    nextDueDate: now, // Due immediately
    streak: 0,
    history: [...(entry.history || []), { date: now, correct: false }],
  };
}

/**
 * Checks if a matchup card is due for review.
 */
export function isDue(entry: SRSEntry, now = Date.now()): boolean {
  return entry.nextDueDate <= now;
}

/**
 * Aggregates statistics for the spaced repetition dashboard, optionally filtered by role.
 * Supports both calculateSRSStats(srsMap, now) and calculateSRSStats(srsMap, role, now).
 */
export interface SRSStats {
  totalCards: number;
  dueToday: number;
  memorized: number; // Box >= 4
  boxCounts: Record<number, number>; // 1 to 5
  averageStreak: number;
}

export function calculateSRSStats(
  srsMap: Record<string, SRSEntry>,
  roleOrNow?: RolePosition | "all" | number,
  nowTime?: number
): SRSStats {
  let role: RolePosition | "all" | undefined = undefined;
  let now = Date.now();

  if (typeof roleOrNow === "number") {
    if (roleOrNow > 10) {
      // Legacy signature: calculateSRSStats(srsMap, now)
      now = roleOrNow;
    } else {
      role = roleOrNow as RolePosition;
      if (nowTime !== undefined) now = nowTime;
    }
  } else if (roleOrNow === "all") {
    role = "all";
    if (nowTime !== undefined) now = nowTime;
  }

  let entries = Object.values(srsMap);
  if (role && role !== "all") {
    entries = entries.filter((e) => (e.role || 2) === role);
  }

  const totalCards = entries.length;

  let dueToday = 0;
  let memorized = 0;
  let totalStreak = 0;
  const boxCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const entry of entries) {
    if (isDue(entry, now)) {
      dueToday++;
    }
    const b = Math.max(1, Math.min(5, entry.box || 1));
    boxCounts[b] = (boxCounts[b] || 0) + 1;

    if (b >= 4) {
      memorized++;
    }
    totalStreak += entry.streak || 0;
  }

  const averageStreak = totalCards > 0 ? Number((totalStreak / totalCards).toFixed(1)) : 0;

  return {
    totalCards,
    dueToday,
    memorized,
    boxCounts,
    averageStreak,
  };
}
