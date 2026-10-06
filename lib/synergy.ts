import { RolePosition, Hero } from "./types";
import { getHeroById } from "./heroes";

export interface AllyPick {
  heroId: number;
  position?: RolePosition;
}

export interface PairSynergyResult {
  allyHeroId: number;
  allyName: string;
  weight: number;
  pairDelta: number;
  traitBonus: number;
  totalDelta: number;
  comboReason?: string;
  lowData: boolean;
}

export interface SynergyScoreResult {
  synergyScore: number;
  topCombo?: {
    allyName: string;
    delta: number;
    reason: string;
  };
  details: PairSynergyResult[];
}

/**
 * Checks if an ally's role makes them the lane partner for the player's role.
 * Pos 1 lane partner: Pos 5
 * Pos 2 lane partner: none (solo mid)
 * Pos 3 lane partner: Pos 4
 * Pos 4 lane partner: Pos 3
 * Pos 5 lane partner: Pos 1
 */
export function isLanePartner(
  myRole: RolePosition,
  allyRole?: RolePosition
): boolean {
  if (!allyRole) return false;
  if (myRole === 1 && allyRole === 5) return true;
  if (myRole === 3 && allyRole === 4) return true;
  if (myRole === 4 && allyRole === 3) return true;
  if (myRole === 5 && allyRole === 1) return true;
  return false;
}

/**
 * Calculates trait synergy bonuses between candidate and ally.
 * - Initiator + Follow-up AOE: +0.03
 * - Save + Hypercarry: +0.03
 * - Wave clear + Roamer: +0.02
 */
export function calculateTraitSynergy(
  candidateTags: string[],
  allyTags: string[]
): { bonus: number; reason?: string } {
  const cSet = new Set(candidateTags);
  const aSet = new Set(allyTags);

  let bonus = 0;
  const reasons: string[] = [];

  // 1. Initiator + Follow-up AOE
  const isInitiatorA = cSet.has("blink_initiator") || cSet.has("aoe_disable");
  const isFollowupA = cSet.has("burst_magic") || cSet.has("mid_waveclear") || cSet.has("aoe_disable");
  const isInitiatorB = aSet.has("blink_initiator") || aSet.has("aoe_disable");
  const isFollowupB = aSet.has("burst_magic") || aSet.has("mid_waveclear") || aSet.has("aoe_disable");

  if ((isInitiatorA && isFollowupB) || (isInitiatorB && isFollowupA)) {
    bonus += 0.03;
    reasons.push("initiation + AOE follow-up");
  }

  // 2. Save + Hypercarry
  const isSaveA = cSet.has("save") || cSet.has("dispel") || cSet.has("heal");
  const isCarryA = cSet.has("phys_carry") || cSet.has("mid_late_scaler");
  const isSaveB = aSet.has("save") || aSet.has("dispel") || aSet.has("heal");
  const isCarryB = aSet.has("phys_carry") || aSet.has("mid_late_scaler");

  if ((isSaveA && isCarryB) || (isSaveB && isCarryA)) {
    bonus += 0.03;
    reasons.push("save + hypercarry synergy");
  }

  // 3. Wave clear + Roamer
  const isWaveclearA = cSet.has("mid_waveclear") || cSet.has("push");
  const isRoamerA = cSet.has("mid_roamer") || cSet.has("smoke_gank");
  const isWaveclearB = aSet.has("mid_waveclear") || aSet.has("push");
  const isRoamerB = aSet.has("mid_roamer") || aSet.has("smoke_gank");

  if ((isWaveclearA && isRoamerB) || (isWaveclearB && isRoamerA)) {
    bonus += 0.02;
    reasons.push("waveclear + roaming tempo");
  }

  return {
    bonus,
    reason: reasons.length > 0 ? reasons.join(" & ") : undefined,
  };
}

/**
 * Calculates overall ally synergy score with lane partner 2x weighting.
 */
export function calculateAllySynergy(
  candidate: Hero,
  candidateRole: RolePosition,
  allies: AllyPick[],
  synergyData: Record<string, Record<string, { delta: number; games: number; lowData: boolean }>>,
  traitsData: Record<string, { tags?: string[] }>
): SynergyScoreResult {
  if (allies.length === 0) {
    return {
      synergyScore: 0,
      details: [],
    };
  }

  const candidateTags = traitsData[String(candidate.id)]?.tags || [];
  let weightedDeltaSum = 0;
  let totalWeight = 0;
  const details: PairSynergyResult[] = [];

  for (const ally of allies) {
    const allyHero = getHeroById(ally.heroId);
    const allyName = allyHero ? allyHero.localized_name : `Hero ${ally.heroId}`;
    const allyTags = traitsData[String(ally.heroId)]?.tags || [];

    // Lane partner gets 2x weight
    const isPartner = isLanePartner(candidateRole, ally.position);
    const weight = isPartner ? 2.0 : 1.0;

    // Pair delta lookup with missing-data fallback
    const pairEntry = synergyData?.[String(candidate.id)]?.[String(ally.heroId)];
    const pairDelta = pairEntry?.delta ?? 0;
    const lowData = pairEntry ? pairEntry.lowData : true;

    // Trait bonus
    const traitResult = calculateTraitSynergy(candidateTags, allyTags);
    const totalDelta = pairDelta + traitResult.bonus;

    weightedDeltaSum += totalDelta * weight;
    totalWeight += weight;

    details.push({
      allyHeroId: ally.heroId,
      allyName,
      weight,
      pairDelta,
      traitBonus: traitResult.bonus,
      totalDelta,
      comboReason: traitResult.reason,
      lowData,
    });
  }

  const synergyScore = totalWeight > 0 ? weightedDeltaSum / totalWeight : 0;

  // Find best combo for "Why" summary
  details.sort((a, b) => b.totalDelta - a.totalDelta);
  const bestAlly = details[0];
  const topCombo =
    bestAlly && bestAlly.totalDelta > 0.015
      ? {
          allyName: bestAlly.allyName,
          delta: bestAlly.totalDelta,
          reason: bestAlly.comboReason || "strong pairing synergy",
        }
      : undefined;

  return {
    synergyScore: Number(synergyScore.toFixed(4)),
    topCombo,
    details,
  };
}

/**
 * Normalizes weights incorporating wSynergy across draft modes.
 * Mode synergy weights: Lane 0.10, Fight 0.35, Macro 0.20, Balanced 0.25.
 * Supports (pos 4 and pos 5) receive +0.10 to synergy weight.
 * Remaining weight is distributed proportionally among base weights (Lane, Fight, Macro).
 */
export function getSynergyNormalizedWeights(
  baseWeights: { wLane: number; wFight: number; wMacro: number },
  mode: "balanced" | "lane" | "fight" | "macro",
  role: RolePosition = 2
): { wLane: number; wFight: number; wMacro: number; wSynergy: number } {
  const modeSynergyMap = {
    lane: 0.10,
    fight: 0.35,
    macro: 0.20,
    balanced: 0.25,
  };

  let wSynergy = modeSynergyMap[mode] ?? 0.25;

  // Supports (pos4 and pos5) get +0.10 synergy weight
  if (role === 4 || role === 5) {
    wSynergy = Math.min(0.60, wSynergy + 0.10);
  }

  const remaining = 1.0 - wSynergy;
  const baseSum = baseWeights.wLane + baseWeights.wFight + baseWeights.wMacro;

  if (baseSum <= 0) {
    return { wLane: 0.25, wFight: 0.25, wMacro: 0.25, wSynergy: 0.25 };
  }

  return {
    wLane: Number(((baseWeights.wLane / baseSum) * remaining).toFixed(4)),
    wFight: Number(((baseWeights.wFight / baseSum) * remaining).toFixed(4)),
    wMacro: Number(((baseWeights.wMacro / baseSum) * remaining).toFixed(4)),
    wSynergy: Number(wSynergy.toFixed(4)),
  };
}
