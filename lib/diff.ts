import { RolePosition, SRSEntry } from "./types";

export interface MatchupDiffEntry {
  myHeroId: number;
  enemyHeroId: number;
  oldDelta: number;
  newDelta: number;
  deltaShift: number; // newDelta - oldDelta
  oldAdjWr: number;
  newAdjWr: number;
  oldGames: number;
  newGames: number;
}

export interface HeroStatDiffEntry {
  heroId: number;
  oldWr: number;
  newWr: number;
  shift: number;
}

export interface RoleFitDiffEntry {
  heroId: number;
  role: RolePosition;
  oldFit: number;
  newFit: number;
  shift: number;
}

export interface ItemShiftEntry {
  heroId: number;
  item: string;
  changeType: "entered_top6" | "left_top6" | "pick_rate_shift";
  description: string;
}

export interface PatchDiffSummary {
  comparedRange: {
    oldDateOrPatch: string;
    newDateOrPatch: string;
  };
  generatedAt: number;
  matchupDiffs: MatchupDiffEntry[];
  heroStatDiffs: HeroStatDiffEntry[];
  roleFitDiffs: RoleFitDiffEntry[];
  itemShifts: ItemShiftEntry[];
}

/**
 * Compare matchups between two snapshots.
 * Flags pairs where delta moved >= 2.0 percentage points (0.02)
 * with min 100 games in both snapshots, sorted by shift magnitude descending.
 */
export function compareMatchups(
  oldMatchups: Record<string, Record<string, any>>,
  newMatchups: Record<string, Record<string, any>>,
  threshold = 0.02,
  minGames = 100
): MatchupDiffEntry[] {
  const diffs: MatchupDiffEntry[] = [];

  for (const [myIdStr, enemyMap] of Object.entries(newMatchups)) {
    const oldEnemyMap = oldMatchups[myIdStr];
    if (!oldEnemyMap) continue;

    const myHeroId = parseInt(myIdStr, 10);

    for (const [enemyIdStr, newMu] of Object.entries(enemyMap)) {
      const oldMu = oldEnemyMap[enemyIdStr];
      if (!oldMu) continue;

      if (newMu.games < minGames || oldMu.games < minGames) continue;

      const deltaShift = newMu.delta - oldMu.delta;
      if (Math.abs(deltaShift) >= threshold) {
        diffs.push({
          myHeroId,
          enemyHeroId: parseInt(enemyIdStr, 10),
          oldDelta: oldMu.delta,
          newDelta: newMu.delta,
          deltaShift,
          oldAdjWr: oldMu.adjWr,
          newAdjWr: newMu.adjWr,
          oldGames: oldMu.games,
          newGames: newMu.games,
        });
      }
    }
  }

  // Sort by shift magnitude descending
  return diffs.sort((a, b) => Math.abs(b.deltaShift) - Math.abs(a.deltaShift));
}

/**
 * Compare overall hero win rates between snapshots.
 */
export function compareHeroStats(
  oldStats: Record<string, any>,
  newStats: Record<string, any>,
  threshold = 0.015
): HeroStatDiffEntry[] {
  const diffs: HeroStatDiffEntry[] = [];

  for (const [idStr, newStat] of Object.entries(newStats)) {
    const oldStat = oldStats[idStr];
    if (!oldStat) continue;

    const newWr = newStat.winRate ?? newStat.wr ?? 0.5;
    const oldWr = oldStat.winRate ?? oldStat.wr ?? 0.5;
    const shift = newWr - oldWr;

    if (Math.abs(shift) >= threshold) {
      diffs.push({
        heroId: parseInt(idStr, 10),
        oldWr,
        newWr,
        shift,
      });
    }
  }

  return diffs.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
}

/**
 * Compare hero role suitabilities between snapshots.
 */
export function compareRoleFits(
  oldHeroRoles: Record<string, any>,
  newHeroRoles: Record<string, any>,
  threshold = 0.05
): RoleFitDiffEntry[] {
  const diffs: RoleFitDiffEntry[] = [];

  for (const [idStr, newEntry] of Object.entries(newHeroRoles)) {
    const oldEntry = oldHeroRoles[idStr];
    if (!oldEntry || !oldEntry.roles || !newEntry.roles) continue;

    const heroId = parseInt(idStr, 10);

    for (const r of [1, 2, 3, 4, 5] as RolePosition[]) {
      const oldFit = oldEntry.roles[r] || oldEntry.roles[String(r)] || 0;
      const newFit = newEntry.roles[r] || newEntry.roles[String(r)] || 0;
      const shift = newFit - oldFit;

      if (Math.abs(shift) >= threshold) {
        diffs.push({
          heroId,
          role: r,
          oldFit,
          newFit,
          shift,
        });
      }
    }
  }

  return diffs.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
}

/**
 * Compare item popularity shifts between snapshots.
 */
export function compareItemPopularity(
  oldPop: Record<string, any>,
  newPop: Record<string, any>
): ItemShiftEntry[] {
  const shifts: ItemShiftEntry[] = [];

  for (const [idStr, newEntry] of Object.entries(newPop)) {
    const oldEntry = oldPop[idStr];
    if (!oldEntry) continue;

    const heroId = parseInt(idStr, 10);
    const getTopItems = (entry: any): string[] => {
      const items: string[] = [];
      for (const phase of ["early_game_items", "mid_game_items", "late_game_items"]) {
        const list = entry[phase];
        if (Array.isArray(list)) {
          for (const item of list.slice(0, 3)) {
            if (item?.key) items.push(item.key);
          }
        }
      }
      return items.slice(0, 6);
    };

    const oldTop = getTopItems(oldEntry);
    const newTop = getTopItems(newEntry);

    // Items that entered top 6
    for (const item of newTop) {
      if (!oldTop.includes(item)) {
        shifts.push({
          heroId,
          item,
          changeType: "entered_top6",
          description: `Entered top builds for Hero ${heroId}`,
        });
      }
    }

    // Items that left top 6
    for (const item of oldTop) {
      if (!newTop.includes(item)) {
        shifts.push({
          heroId,
          item,
          changeType: "left_top6",
          description: `Dropped out of top builds for Hero ${heroId}`,
        });
      }
    }
  }

  return shifts;
}

/**
 * Check if a matchup note or SRS card is affected by significant patch changes.
 */
export function isMatchupStale(
  myHeroId: number,
  enemyHeroId: number,
  matchupDiffs: MatchupDiffEntry[]
): boolean {
  return matchupDiffs.some(
    (d) => d.myHeroId === myHeroId && d.enemyHeroId === enemyHeroId
  );
}

/**
 * Reset a stale SRS card to Box 2 after review.
 */
export function resetStaleCardToBox2(card: SRSEntry): SRSEntry {
  return {
    ...card,
    box: 2,
    streak: Math.min(card.streak, 1),
    lastReviewDate: Date.now(),
    nextDueDate: Date.now() + 24 * 60 * 60 * 1000, // 1 day interval for Box 2
  };
}

/**
 * Snapshot rotation helper: given a list of snapshot directory names,
 * keep only the latest maxCount (default 5) and identify older directories to prune.
 */
export function getSnapshotsToPrune(snapshots: string[], maxCount = 5): string[] {
  if (snapshots.length <= maxCount) return [];
  const sorted = [...snapshots].sort(); // alphabetical sorting by date/timestamp
  return sorted.slice(0, sorted.length - maxCount);
}
