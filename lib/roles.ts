import rawHeroRoles from "@/data/hero-roles.json";
import rawTraits from "@/data/traits.json";
import { Hero, HeroRoleFit, RolePosition } from "./types";

export interface RoleMeta {
  id: RolePosition;
  name: string;
  shortName: string;
  laneName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<RolePosition, RoleMeta> = {
  1: {
    id: 1,
    name: "Safe Lane Carry",
    shortName: "Pos 1",
    laneName: "Safe Lane",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "Primary farm priority, late-game scaling, creep equilibrium & power spike timings.",
  },
  2: {
    id: 2,
    name: "Mid",
    shortName: "Pos 2",
    laneName: "Mid Lane",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    description: "Solo lane, rune control, bottle refilling, rapid level 6 tempo & map rotations.",
  },
  3: {
    id: 3,
    name: "Offlane",
    shortName: "Pos 3",
    laneName: "Offlane",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    description: "Frontline initiator/tank, harassing enemy carry, creep equilibrium & utility auras.",
  },
  4: {
    id: 4,
    name: "Soft Support",
    shortName: "Pos 4",
    laneName: "Support (Offlane / Roam)",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    description: "Offlane partner, lotus pool / rune contests, stacking, gank rotations & skirmish initiator.",
  },
  5: {
    id: 5,
    name: "Hard Support",
    shortName: "Pos 5",
    laneName: "Support (Safe Lane)",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    description: "Carry protection, camp pulling & camp blocking, vision control, saves & consumables.",
  },
};

export const ALL_ROLES: RolePosition[] = [1, 2, 3, 4, 5];

const heroRolesDb = rawHeroRoles as unknown as Record<string, HeroRoleFit>;
const traitsDb = rawTraits as unknown as Record<string, { tags: string[]; dmgType: string }>;

/**
 * Returns role fit metadata for a given hero ID.
 */
export function getHeroRoleFit(heroId: number): HeroRoleFit | null {
  return heroRolesDb[String(heroId)] || null;
}

/**
 * Checks whether a hero is viable in a given position (suitability >= threshold).
 */
export function isHeroViableInRole(heroId: number, role: RolePosition, threshold = 0.15): boolean {
  const fit = getHeroRoleFit(heroId);
  if (!fit) return true;
  return (fit.roles[role] || 0) >= threshold;
}

/**
 * Returns all hero IDs viable for a given role.
 */
export function getViableHeroesForRole(role: RolePosition, threshold = 0.15): number[] {
  return Object.values(heroRolesDb)
    .filter((h) => (h.roles[role] || 0) >= threshold)
    .map((h) => h.heroId);
}

/**
 * Lane opponent mapping:
 * - pos1 faces enemy pos3 (+ enemy pos4/5 as lane support when known)
 * - pos2 faces enemy pos2
 * - pos3 faces enemy pos1 (+ enemy pos5)
 * - pos4 and pos5 face the opposing lane duo
 */
export function getOpposingLanePositions(role: RolePosition): RolePosition[] {
  switch (role) {
    case 1:
      return [3, 4]; // Faces offlaner + soft support
    case 2:
      return [2]; // 1v1 mid lane
    case 3:
      return [1, 5]; // Faces carry + hard support
    case 4:
      return [1, 5]; // Contests safe lane duo
    case 5:
      return [3, 4]; // Defends vs offlane duo
  }
}

/**
 * Returns the primary opposing lane core position.
 */
export function getPrimaryOpponentRole(role: RolePosition): RolePosition {
  switch (role) {
    case 1:
      return 3;
    case 2:
      return 2;
    case 3:
      return 1;
    case 4:
      return 1;
    case 5:
      return 3;
  }
}

/**
 * Returns the lane partner position in a standard 2-1-2 setup.
 */
export function getLanePartnerRole(role: RolePosition): RolePosition | null {
  switch (role) {
    case 1:
      return 5;
    case 2:
      return null;
    case 3:
      return 4;
    case 4:
      return 3;
    case 5:
      return 1;
  }
}

/**
 * Infers 1-5 role assignments for up to 5 enemy heroes based on role suitabilities.
 */
export function inferEnemyPositions(enemyHeroIds: number[]): Record<number, RolePosition> {
  const result: Record<number, RolePosition> = {};
  if (enemyHeroIds.length === 0) return result;

  const assignedRoles = new Set<RolePosition>();
  const unassignedHeroes = [...enemyHeroIds];

  // Pass 1: Assign heroes with strong primary roles (> 0.70)
  for (const heroId of [...unassignedHeroes]) {
    const fit = getHeroRoleFit(heroId);
    if (fit && !assignedRoles.has(fit.primaryRole) && fit.roles[fit.primaryRole] >= 0.7) {
      result[heroId] = fit.primaryRole;
      assignedRoles.add(fit.primaryRole);
      const idx = unassignedHeroes.indexOf(heroId);
      if (idx !== -1) unassignedHeroes.splice(idx, 1);
    }
  }

  // Pass 2: Greedy assignment for remaining heroes across available roles 1..5
  const remainingRoles: RolePosition[] = ALL_ROLES.filter((r) => !assignedRoles.has(r));

  for (const heroId of unassignedHeroes) {
    const fit = getHeroRoleFit(heroId);
    let bestRole: RolePosition = remainingRoles[0] || 2;
    let bestScore = -1;

    for (const r of remainingRoles) {
      const score = fit ? fit.roles[r] || 0 : 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestRole = r;
      }
    }

    result[heroId] = bestRole;
    assignedRoles.add(bestRole);
    const rIdx = remainingRoles.indexOf(bestRole);
    if (rIdx !== -1) remainingRoles.splice(rIdx, 1);
  }

  return result;
}

export interface GeneratedRoleLanePlan {
  role: RolePosition;
  roleName: string;
  summary: string;
  prioritySection: { title: string; text: string };
  tradingSection: { title: string; text: string };
  timingSection: { title: string; text: string };
  partnerSection?: { title: string; text: string };
}

/**
 * Generates role-specific lane plan skeletons:
 * - Pos 1: farm priority, harass vs sustain, contesting vs pulling, power spike timing
 * - Pos 2: rune control, waveclear, level 6 threat, roam windows
 * - Pos 3: lane survival, trading, creep equilibrium, aggression vs carry
 * - Pos 4: rotation windows, stacking/pulling options, kill setups with partner
 * - Pos 5: pull/stack/block routes by lane, harass trade patterns, save/protection options
 */
export function generateRoleLanePlan(
  role: RolePosition,
  myHero: Hero,
  enemyHero: Hero,
  partnerHero?: Hero | null
): GeneratedRoleLanePlan {
  const myTraits = traitsDb[String(myHero.id)] || { tags: [], dmgType: "physical" };
  const enemyTraits = traitsDb[String(enemyHero.id)] || { tags: [], dmgType: "physical" };

  const myTags = new Set(myTraits.tags);
  const enemyTags = new Set(enemyTraits.tags);

  const roleMeta = ROLE_DEFINITIONS[role];

  switch (role) {
    case 1: {
      // Pos 1: Safe Lane Carry
      const hasSustain = myTags.has("sustain") || myTags.has("heal");
      const enemyHasHarass = enemyTags.has("ranged_harass") || enemyTags.has("burst_magic");
      const enemyDurable = enemyTags.has("phys_carry") || enemyTraits.dmgType === "physical";

      return {
        role: 1,
        roleName: roleMeta.name,
        summary: `[GENERATED TACTICAL SKELETON] Focus strictly on CS efficiency against ${enemyHero.localized_name}. Keep creep wave near your tower and avoid overextending into deep trades.`,
        prioritySection: {
          title: "Farm Priority & Wave Management",
          text: `Prioritize uncontested last hits under equilibrium. If ${enemyHero.localized_name} attempts to freeze near their offlane tower, ask your Pos 5 to pull the small camp at :15/:45 seconds to reset wave positioning.`,
        },
        tradingSection: {
          title: "Harass vs Sustain Trading",
          text: enemyHasHarass
            ? `${enemyHero.localized_name} brings heavy harass threat. Bring extra Tangoes, Magic Stick, and avoid tanking creep aggro while securing ranged creep with spells.`
            : hasSustain
            ? `You have native sustain. Punish ${enemyHero.localized_name} whenever their core cooldowns are used on creeps.`
            : `Trade hits only when you have high ground vision and creep advantage. Do not commit into extended trades without support backup.`,
        },
        timingSection: {
          title: "Power Spike & Jungle Transition",
          text: `Hit your early stat item timings (Wraith Band/Bracer/Treads). At 7–8 minutes, if ${enemyHero.localized_name} hits level 6 kill pressure, rotate to farm the safe lane hard camp and triangle.`,
        },
        partnerSection: partnerHero
          ? {
              title: `Lane Partner Synergy with ${partnerHero.localized_name} (Pos 5)`,
              text: `Coordinate with ${partnerHero.localized_name} to pull small camp while you safely hold the wave on your tower steps.`,
            }
          : undefined,
      };
    }

    case 2: {
      // Pos 2: Mid
      const canWaveclear = myTags.has("mid_waveclear");
      const level6Threat = myTags.has("burst_magic") || myTags.has("mid_tempo");

      return {
        role: 2,
        roleName: roleMeta.name,
        summary: `[GENERATED TACTICAL SKELETON] 1v1 Mid lane matchup against ${enemyHero.localized_name}. Contest water/power runes and balance wave shoving against bottle refill timings.`,
        prioritySection: {
          title: "Rune Control & Bottle Refill",
          text: `Secure Water Runes at 2:00 and 4:00. At :50 seconds, shove the creep wave onto ${enemyHero.localized_name}'s high ground with AoE so you secure rune priority with 0 lost XP.`,
        },
        tradingSection: {
          title: "Waveclear & Creep Aggro",
          text: canWaveclear
            ? `Nuke out the wave at :45 seconds to create space for side-camp stacks or river rune contests.`
            : `Draw creep aggro backward to your high ground ramp. Trade hits exclusively when enemy creeps are dying.`,
        },
        timingSection: {
          title: "Level 6 Kill Window & Roam Timing",
          text: level6Threat
            ? `Huge kill window at Level 6. Bait out ${enemyHero.localized_name}'s defensive cooldown or look for an immediate side-lane gank with power rune (Haste/Double Damage).`
            : `Respect ${enemyHero.localized_name}'s level 6 kill threat. Maintain vision ward on enemy mid high ground.`,
        },
      };
    }

    case 3: {
      // Pos 3: Offlane
      const isInitiator = myTags.has("blink_initiator") || myTags.has("hard_cc");

      return {
        role: 3,
        roleName: roleMeta.name,
        summary: `[GENERATED TACTICAL SKELETON] Bully and disrupt enemy carry ${enemyHero.localized_name}. Deny safe farm and maintain control over the enemy pull camp.`,
        prioritySection: {
          title: "Lane Survival & Creep Equilibrium",
          text: `Block the enemy small pull camp with a Sentry ward at minute 0. Keep the wave just outside your offlane tower range where ${enemyHero.localized_name} is vulnerable to ganks.`,
        },
        tradingSection: {
          title: "Aggression vs The Carry",
          text: `Every time ${enemyHero.localized_name} steps up for a last hit, punish with right clicks and spells. Trade heavily whenever their support leaves the lane to pull or stack.`,
        },
        timingSection: {
          title: "Power Spike & Tower Pressure",
          text: isInitiator
            ? `Rush Phase/Vanguard or Blink Dagger. Force ${enemyHero.localized_name} out of lane by minute 8 and take down their Tier 1 Safe Lane tower.`
            : `Build early defensive aura/item components to absorb harass and establish permanent lane dominance.`,
        },
        partnerSection: partnerHero
          ? {
              title: `Kill Setup with ${partnerHero.localized_name} (Pos 4)`,
              text: `Coordinate stuns/slows with ${partnerHero.localized_name} onto ${enemyHero.localized_name} the moment they step into river or past the creep line.`,
            }
          : undefined,
      };
    }

    case 4: {
      // Pos 4: Soft Support
      return {
        role: 4,
        roleName: roleMeta.name,
        summary: `[GENERATED TACTICAL SKELETON] Offlane lane support & map disruptor contesting ${enemyHero.localized_name}. Protect your offlaner and control river runes and lotus pool.`,
        prioritySection: {
          title: "Lotus Pool, Pulling & Camp Blocking",
          text: `Contest the 3:00 minute Lotus Pool. Block the radiant/dire small camp, and unblock the offlane hard camp to pull the wave whenever it pushes out.`,
        },
        tradingSection: {
          title: "Harass Trade & Kill Setups",
          text: `Trade aggressively with enemy lane support from the trees. Isolate ${enemyHero.localized_name} and set up kills using your slows/disables alongside your pos 3.`,
        },
        timingSection: {
          title: "Mid Gank & Power Rune Rotations",
          text: `At 5:45, prepare to leave lane to secure the 6:00 minute Power Rune for your mid laner, or gank mid via Smoke of Deceit.`,
        },
        partnerSection: partnerHero
          ? {
              title: `Synergy with Offlaner ${partnerHero.localized_name} (Pos 3)`,
              text: `Chain your disable with ${partnerHero.localized_name}'s initiation to burst down targets before they can retreat to tower safety.`,
            }
          : undefined,
      };
    }

    case 5: {
      // Pos 5: Hard Support
      return {
        role: 5,
        roleName: roleMeta.name,
        summary: `[GENERATED TACTICAL SKELETON] Safe lane protector defending against ${enemyHero.localized_name}. Maintain camp pulls, provide vision, and ensure your carry farms unmolested.`,
        prioritySection: {
          title: "Pull / Stack / Block Routes",
          text: `De-ward the small camp immediately if blocked. Pull the wave at :15 or :45 seconds to deny enemy XP and keep the creep line right in front of your carry's tower.`,
        },
        tradingSection: {
          title: "Harass Trade Patterns & Safety",
          text: `Trade right-clicks and spells against ${enemyHero.localized_name} outside the creep aggro range. Never draw enemy creeps onto your carry while trading.`,
        },
        timingSection: {
          title: "Saves, Warding & Consumable Support",
          text: `Stock up on Blood Grenades, Salves, and clarity potions. Place a defensive lane ward to spot incoming enemy mid rotations or smoke ganks.`,
        },
        partnerSection: partnerHero
          ? {
              title: `Protection Plan for Carry ${partnerHero.localized_name} (Pos 1)`,
              text: `Position yourself between ${enemyHero.localized_name} and ${partnerHero.localized_name}. Bodyblock and trade health to guarantee safe last hits for your carry.`,
            }
          : undefined,
      };
    }
  }
}
