import rawMatchups from "@/data/matchups.json";
import rawHeroStats from "@/data/hero-stats.json";
import rawDurations from "@/data/durations.json";
import rawSynergy from "@/data/synergy.json";
import rawTraits from "@/data/traits.json";
import { Hero, HeroPoolEntry, PersonalStatsSummary } from "./types";
import { getHeroById } from "./heroes";
import {
  AllyPick,
  calculateAllySynergy,
  getSynergyNormalizedWeights,
} from "./synergy";

export type DraftMode = "balanced" | "lane" | "fight" | "macro";

export type RolePosition = 1 | 2 | 3 | 4 | 5;

export interface EnemyPick {
  heroId: number;
  position?: RolePosition;
}

export interface ScoreBreakdown {
  laneScore: number;
  fightScore: number;
  macroScore: number;
  synergyScore?: number;
  personalScore?: number;
  finalScore: number;
  reasons: string[];
}

export interface CandidateScore {
  hero: Hero;
  poolEntry: HeroPoolEntry;
  scores: ScoreBreakdown;
}

export const MODE_WEIGHTS: Record<DraftMode, { wLane: number; wFight: number; wMacro: number }> = {
  balanced: { wLane: 0.40, wFight: 0.40, wMacro: 0.20 },
  lane:     { wLane: 0.60, wFight: 0.25, wMacro: 0.15 },
  fight:    { wLane: 0.20, wFight: 0.65, wMacro: 0.15 },
  macro:    { wLane: 0.20, wFight: 0.30, wMacro: 0.50 },
};

// Default mode weights per role per specification:
// pos1: 0.25/0.35/0.40, pos2: 0.40/0.30/0.30, pos3: 0.35/0.40/0.25, pos4: 0.30/0.50/0.20, pos5: 0.30/0.50/0.20
export const ROLE_DEFAULT_WEIGHTS: Record<RolePosition, { wLane: number; wFight: number; wMacro: number }> = {
  1: { wLane: 0.25, wFight: 0.35, wMacro: 0.40 },
  2: { wLane: 0.40, wFight: 0.30, wMacro: 0.30 },
  3: { wLane: 0.35, wFight: 0.40, wMacro: 0.25 },
  4: { wLane: 0.30, wFight: 0.50, wMacro: 0.20 },
  5: { wLane: 0.30, wFight: 0.50, wMacro: 0.20 },
};

export function getEffectiveWeights(
  mode: DraftMode,
  role: RolePosition = 2,
  isExplicitOverride = false
): { wLane: number; wFight: number; wMacro: number } {
  if (isExplicitOverride || mode !== "balanced") {
    return MODE_WEIGHTS[mode];
  }
  return ROLE_DEFAULT_WEIGHTS[role] || ROLE_DEFAULT_WEIGHTS[2];
}

const matchups = rawMatchups as Record<string, Record<string, { games: number; wins: number; adjWr: number; delta: number; lowData: boolean }>>;
const heroStats = rawHeroStats as Record<string, { overallWr: number; brackets: Record<string, { wr: number }> }>;
const durations = rawDurations as Record<string, { earlyScore: number; lateScore: number; peakMinute: number }>;
const synergyMatrix = rawSynergy as Record<string, Record<string, { games: number; wins: number; adjWr: number; delta: number; lowData: boolean }>>;
const traitsMap = rawTraits as Record<string, { tags?: string[] }>;

export function getMatchup(heroId: number, enemyId: number) {
  const heroMatchups = matchups[String(heroId)];
  if (!heroMatchups) return null;
  return heroMatchups[String(enemyId)] || null;
}

/**
 * Calculates smoothed adjWr and delta for two heroes.
 * Smoothing formula: adjWr = (wins + K * heroWr) / (games + K) with K = 50.
 */
export function calculateSmoothedDelta(
  wins: number,
  games: number,
  heroOverallWr: number,
  K = 50
): { adjWr: number; delta: number } {
  const adjWr = (wins + K * heroOverallWr) / (games + K);
  const delta = adjWr - heroOverallWr;
  return {
    adjWr: Number(adjWr.toFixed(4)),
    delta: Number(delta.toFixed(4)),
  };
}

/**
 * Scores a candidate hero from the user's pool against the selected enemy team.
 */
export function scoreCandidate(
  candidate: Hero,
  poolEntry: { heroId: number; inPool: boolean; comfort: number; isMid?: boolean },
  enemyPicks: EnemyPick[],
  mode: DraftMode = "balanced",
  targetRole: RolePosition = 2,
  isExplicitModeOverride = false,
  personalStats?: PersonalStatsSummary,
  personalOptions?: { enabled?: boolean; weight?: number },
  allies: AllyPick[] = []
): ScoreBreakdown {
  const baseWeights = getEffectiveWeights(mode, targetRole, isExplicitModeOverride);
  const weights = getSynergyNormalizedWeights(baseWeights, mode, targetRole);
  const reasons: string[] = [];

  // Ally synergy calculation
  const synergyResult = calculateAllySynergy(
    candidate,
    targetRole,
    allies,
    synergyMatrix,
    traitsMap
  );
  const synergyScore = synergyResult.synergyScore;

  if (enemyPicks.length === 0 && allies.length === 0) {
    return {
      laneScore: 0,
      fightScore: 0,
      macroScore: 0,
      synergyScore: 0,
      personalScore: 0,
      finalScore: 0,
      reasons: ["No heroes selected yet"],
    };
  }

  // 1. Fight score: Mean delta against all enemy picks + trait counter bonuses
  let totalFightDelta = 0;
  const matchupDetails: { enemyName: string; delta: number }[] = [];

  for (const enemy of enemyPicks) {
    const mu = getMatchup(candidate.id, enemy.heroId);
    const delta = mu ? mu.delta : 0;
    totalFightDelta += delta;

    const enemyHero = getHeroById(enemy.heroId);
    if (enemyHero) {
      matchupDetails.push({ enemyName: enemyHero.localized_name, delta });
    }
  }

  // Trait counter bonuses: Break vs passive-heavy, Dispel vs silences
  const candTags = traitsMap[String(candidate.id)]?.tags || [];
  const hasBreak = candTags.includes("break");
  const hasDispel = candTags.includes("dispel");

  const passiveEnemies = enemyPicks
    .map((e) => getHeroById(e.heroId))
    .filter((h) => h && (traitsMap[String(h.id)]?.tags || []).includes("passive_heavy"));

  const silenceEnemies = enemyPicks
    .map((e) => getHeroById(e.heroId))
    .filter((h) => h && (traitsMap[String(h.id)]?.tags || []).includes("silence"));

  let traitFightBonus = 0;
  if (hasBreak && passiveEnemies.length > 0) {
    traitFightBonus += Math.min(0.04, 0.025 * passiveEnemies.length);
  }
  if (hasDispel && silenceEnemies.length > 0) {
    traitFightBonus += Math.min(0.03, 0.02 * silenceEnemies.length);
  }

  const fightScore = (enemyPicks.length > 0 ? totalFightDelta / enemyPicks.length : 0) + traitFightBonus;

  // 2. Lane score: Delta against lane opponents based on opposing lane mapping
  let laneOpponents: EnemyPick[] = [];
  if (targetRole === 1) {
    laneOpponents = enemyPicks.filter((e) => e.position === 3 || e.position === 4);
  } else if (targetRole === 2) {
    laneOpponents = enemyPicks.filter((e) => e.position === 2);
  } else if (targetRole === 3) {
    laneOpponents = enemyPicks.filter((e) => e.position === 1 || e.position === 5);
  } else if (targetRole === 4) {
    laneOpponents = enemyPicks.filter((e) => e.position === 1 || e.position === 5 || e.position === 3);
  } else if (targetRole === 5) {
    laneOpponents = enemyPicks.filter((e) => e.position === 3 || e.position === 4);
  }

  // Fallback to all enemies if no lane opponent has been assigned
  if (laneOpponents.length === 0) {
    laneOpponents = enemyPicks;
  }

  let totalLaneDelta = 0;
  for (const opp of laneOpponents) {
    const mu = getMatchup(candidate.id, opp.heroId);
    totalLaneDelta += mu ? mu.delta : 0;
  }

  let traitLaneBonus = 0;
  const lanePassiveOpponents = laneOpponents
    .map((e) => getHeroById(e.heroId))
    .filter((h) => h && (traitsMap[String(h.id)]?.tags || []).includes("passive_heavy"));
  if (hasBreak && lanePassiveOpponents.length > 0) {
    traitLaneBonus += 0.035;
  }

  const laneScore = (laneOpponents.length > 0 ? totalLaneDelta / laneOpponents.length : 0) + traitLaneBonus;

  // 3. Macro score: Compare candidate duration profile vs enemy team duration profile
  let macroScore = 0;
  if (enemyPicks.length > 0) {
    const candDur = durations[String(candidate.id)] || { earlyScore: 0.5, lateScore: 0.5 };
    let enemyEarlySum = 0;
    let enemyLateSum = 0;
    for (const enemy of enemyPicks) {
      const eDur = durations[String(enemy.heroId)] || { earlyScore: 0.5, lateScore: 0.5 };
      enemyEarlySum += eDur.earlyScore;
      enemyLateSum += eDur.lateScore;
    }
    const avgEnemyEarly = enemyEarlySum / enemyPicks.length;
    const avgEnemyLate = enemyLateSum / enemyPicks.length;

    // Difference: does candidate out-tempo or out-scale?
    const earlyDiff = candDur.earlyScore - avgEnemyEarly;
    const lateDiff = candDur.lateScore - avgEnemyLate;
    macroScore = earlyDiff * 0.4 + lateDiff * 0.6;
  }

  // 4. Comfort bonus: small nudge for high comfort heroes (+0.5% for comfort 3, 0 for 2, -0.5% for 1)
  const comfortBonus = (poolEntry.comfort - 2) * 0.005;

  // 5. Personal stats term: Bayesian smoothed delta vs enemies / hero win rate
  let personalScore = 0;
  let personalCount = 0;
  if (personalOptions?.enabled !== false && personalStats) {
    const roleMatchups = personalStats.matchupStats?.[targetRole] || {};
    for (const enemy of enemyPicks) {
      const pMu = roleMatchups[`${candidate.id}_${enemy.heroId}`];
      if (pMu && pMu.games >= 1) {
        personalScore += pMu.smoothedDelta;
        personalCount++;
      }
    }
    if (personalCount > 0) {
      personalScore = personalScore / personalCount;
    } else {
      const heroPersonal = personalStats.heroStats?.[targetRole]?.[candidate.id];
      if (heroPersonal && heroPersonal.games >= 2) {
        personalScore = heroPersonal.winRate - 0.5;
      }
    }
  }

  const wPersonal = personalOptions?.weight ?? 0.25;
  const personalTerm =
    personalCount > 0 || (personalStats?.heroStats?.[targetRole]?.[candidate.id]?.games ?? 0) >= 2
      ? wPersonal * personalScore
      : 0;

  // Final weighted score including synergy
  const finalScore =
    weights.wLane * laneScore +
    weights.wFight * fightScore +
    weights.wMacro * macroScore +
    weights.wSynergy * synergyScore +
    comfortBonus +
    personalTerm;

  // 6. Generate descriptive "Why" line from the strongest factors
  matchupDetails.sort((a, b) => b.delta - a.delta);
  const bestMatch = matchupDetails[0];
  const secondBest = matchupDetails[1];

  if (hasBreak && passiveEnemies.length > 0) {
    const enemyNames = passiveEnemies.slice(0, 2).map((h) => h!.localized_name).join(" & ");
    reasons.push(`Applies Break vs ${enemyNames} passives`);
  }

  if (hasDispel && silenceEnemies.length > 0) {
    reasons.push("Has dispel vs enemy silences");
  }

  if (bestMatch && bestMatch.delta > 0.01) {
    const pct = (bestMatch.delta * 100).toFixed(1);
    reasons.push(`+${pct}% vs ${bestMatch.enemyName}`);
  }

  if (secondBest && secondBest.delta > 0.015) {
    const pct = (secondBest.delta * 100).toFixed(1);
    reasons.push(`+${pct}% vs ${secondBest.enemyName}`);
  }

  if (synergyResult.topCombo) {
    const pct = (synergyResult.topCombo.delta * 100).toFixed(1);
    reasons.push(`+${pct}% combo with ${synergyResult.topCombo.allyName} (${synergyResult.topCombo.reason})`);
  }

  if (personalTerm > 0.01) {
    reasons.push(`+${(personalScore * 100).toFixed(1)}% personal history`);
  } else if (personalTerm < -0.01) {
    reasons.push(`${(personalScore * 100).toFixed(1)}% personal history`);
  }

  if (laneScore > 0.02) {
    reasons.push("Strong lane match-up");
  } else if (laneScore < -0.02) {
    reasons.push("Challenging lane phase");
  }

  if (macroScore > 0.02) {
    reasons.push("Strong timing fit");
  }

  if (poolEntry.comfort === 3) {
    reasons.push("Signature hero");
  }

  if (reasons.length === 0) {
    reasons.push("Solid all-round draft fit");
  }

  return {
    laneScore: Number(laneScore.toFixed(4)),
    fightScore: Number(fightScore.toFixed(4)),
    macroScore: Number(macroScore.toFixed(4)),
    synergyScore: Number(synergyScore.toFixed(4)),
    personalScore: Number(personalScore.toFixed(4)),
    finalScore: Number(finalScore.toFixed(4)),
    reasons: reasons.slice(0, 3),
  };
}

/**
 * Filter pool candidates and sort by final score descending.
 */
export function rankCandidates(
  allHeroes: Hero[],
  userPool: Record<number, { heroId: number; inPool: boolean; comfort: number; isMid?: boolean }>,
  enemyPicks: EnemyPick[],
  mode: DraftMode = "balanced",
  targetRole: RolePosition = 2,
  filterMidOnly = false,
  isExplicitModeOverride = false,
  personalStats?: PersonalStatsSummary,
  personalOptions?: { enabled?: boolean; weight?: number },
  allies: AllyPick[] = []
): CandidateScore[] {
  const excludedHeroIds = new Set([
    ...enemyPicks.map((e) => e.heroId),
    ...allies.map((a) => a.heroId),
  ]);

  // Candidates are ONLY heroes in the user's pool, excluding already picked enemy/ally heroes
  const poolCandidates: { hero: Hero; poolEntry: HeroPoolEntry }[] = [];

  for (const hero of allHeroes) {
    if (excludedHeroIds.has(hero.id)) continue;

    const entry = userPool[hero.id];
    if (!entry || !entry.inPool) continue;

    if (filterMidOnly && !entry.isMid) continue;

    poolCandidates.push({
      hero,
      poolEntry: {
        heroId: hero.id,
        inPool: true,
        comfort: (entry.comfort as any) || 2,
        isMid: !!entry.isMid,
      },
    });
  }

  const scored: CandidateScore[] = poolCandidates.map(({ hero, poolEntry }) => ({
    hero,
    poolEntry,
    scores: scoreCandidate(
      hero,
      poolEntry,
      enemyPicks,
      mode,
      targetRole,
      isExplicitModeOverride,
      personalStats,
      personalOptions,
      allies
    ),
  }));

  // Sort descending by finalScore
  scored.sort((a, b) => b.scores.finalScore - a.scores.finalScore);

  return scored;
}

/**
 * Enemy Lane Threat Analysis
 */
export interface LaneThreatSummary {
  laneTitle: string;
  heroes: Hero[];
  harassLevel: "High" | "Medium" | "Low";
  killThreat: "High" | "Medium" | "Low";
  sustainLevel: "High" | "Medium" | "Low";
  divePotential: "High" | "Medium" | "Low";
  summary: string;
}

export function analyzeEnemyLane(laneHeroes: Hero[], laneTitle: string): LaneThreatSummary {
  if (laneHeroes.length === 0) {
    return {
      laneTitle,
      heroes: [],
      harassLevel: "Low",
      killThreat: "Low",
      sustainLevel: "Low",
      divePotential: "Low",
      summary: "No enemy assigned yet.",
    };
  }

  const rangedCount = laneHeroes.filter((h) => h.attack_type === "Ranged").length;
  const disablerCount = laneHeroes.filter((h) => h.roles.includes("Disabler")).length;
  const nukerCount = laneHeroes.filter((h) => h.roles.includes("Nuker")).length;
  const durableCount = laneHeroes.filter((h) => h.roles.includes("Durable")).length;
  const supportCount = laneHeroes.filter((h) => h.roles.includes("Support")).length;

  const harassLevel: "High" | "Medium" | "Low" =
    rangedCount >= 1 || nukerCount >= 1 ? "High" : "Medium";

  const killThreat: "High" | "Medium" | "Low" =
    disablerCount >= 1 && (nukerCount >= 1 || laneHeroes.length > 1) ? "High" : disablerCount > 0 ? "Medium" : "Low";

  const sustainLevel: "High" | "Medium" | "Low" =
    supportCount >= 1 || durableCount >= 1 ? "High" : "Low";

  const divePotential: "High" | "Medium" | "Low" =
    durableCount >= 1 && disablerCount >= 1 ? "High" : durableCount >= 1 ? "Medium" : "Low";

  const notes: string[] = [];
  if (harassLevel === "High") notes.push("Heavy ranged/spell harass");
  if (killThreat === "High") notes.push("Dangerous setup with lockdown and burst");
  if (divePotential === "High") notes.push("High tower-dive capability");
  if (sustainLevel === "High") notes.push("Strong lane attrition");

  const summary = notes.length > 0 ? notes.join(" • ") : "Standard lane balance";

  return {
    laneTitle,
    heroes: laneHeroes,
    harassLevel,
    killThreat,
    sustainLevel,
    divePotential,
    summary,
  };
}
