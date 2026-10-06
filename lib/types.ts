export type PrimaryAttr = "str" | "agi" | "int" | "all";
export type AttackType = "Melee" | "Ranged";

export interface Hero {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: PrimaryAttr;
  attack_type: AttackType;
  roles: string[];
  img: string;
  icon?: string;
}

export interface HeroAbility {
  id: string;
  name: string;
  img: string;
  desc?: string;
  dmg_type?: string;
}

export type RolePosition = 1 | 2 | 3 | 4 | 5;

export interface HeroRoleFit {
  heroId: number;
  name: string;
  localized_name: string;
  roles: Record<RolePosition, number>; // 0.0 to 1.0 suitability score
  primaryRole: RolePosition;
}

export type ComfortLevel = 1 | 2 | 3;

export interface RoleHeroPoolEntry {
  heroId: number;
  inPool: boolean;
  comfort: ComfortLevel;
}

// Legacy v1 pool entry for compatibility during migration
export interface HeroPoolEntry {
  heroId: number;
  inPool: boolean;
  isMid: boolean;
  comfort: ComfortLevel;
}

export interface UserSettings {
  bracket: string; // "8" = Divine/Immortal, "all" = All brackets
  theme: "dark";
  defaultMode: "balanced" | "lane" | "fight" | "macro";
  selectedRole: RolePosition; // 1 | 2 | 3 | 4 | 5 (defaults to 2)
  personalTermEnabled?: boolean;
  wPersonal?: number;
  blendRatio?: number;
  statsViewMode?: "global" | "personal" | "blend";
}

export interface PersonalMatchRecord {
  matchId: number;
  startTime: number;
  duration: number;
  myHeroId: number;
  role: RolePosition;
  userAssignedRole?: boolean;
  won: boolean;
  allies: number[];
  enemies: number[];
  opponents: number[]; // opposing lane heroes
  patch?: number;
  isParsed?: boolean;
  purchaseLog?: { item: string; time: number }[];
}

export interface HeroPersonalWinRate {
  games: number;
  wins: number;
  winRate: number;
}

export interface MatchupPersonalStats {
  role: RolePosition;
  myHeroId: number;
  enemyHeroId: number;
  games: number;
  wins: number;
  winRate: number;
  smoothedWr: number;
  smoothedDelta: number;
  recentResults: ("win" | "loss")[];
}

export interface PersonalStatsSummary {
  accountId?: string;
  totalMatches: number;
  parsedMatches: number;
  lastImportTime: number;
  roleGames: Record<RolePosition, number>;
  heroStats: Record<RolePosition, Record<number, HeroPersonalWinRate>>;
  matchupStats: Record<RolePosition, Record<string, MatchupPersonalStats>>; // key `${myHeroId}_${enemyHeroId}`
}

export interface WeakSpotEntry {
  role: RolePosition;
  myHeroId: number;
  enemyHeroId: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  smoothedWr: number;
  smoothedDelta: number;
  score: number; // lossRate * games
}

export interface LaneMatchupNote {
  role: RolePosition;
  myHeroId: number;
  enemyHeroId: number;
  lanePartnerId?: number; // for pos 3, 4, 5 duo/trilane
  notes: string;
  skipTake?: string;
  runePlan?: string;
  keyItems?: string;
  mistakeToAvoid?: string;
  updatedAt: number;
}

// Backward compatibility alias for MidMatchupNote
export type MidMatchupNote = LaneMatchupNote;

export interface SRSEntry {
  matchupKey: string; // `${role}_${myHeroId}_${enemyHeroId}`
  role?: RolePosition;
  myHeroId: number;
  enemyHeroId: number;
  lanePartnerId?: number;
  box: number; // 1 to 5
  lastReviewDate: number;
  nextDueDate: number;
  streak: number;
  history: { date: number; correct: boolean }[];
}

export interface PostGameLog {
  id: string;
  timestamp: number;
  role?: RolePosition;
  myHeroId: number;
  enemyHeroId: number;
  lanePartnerId?: number;
  result: "win" | "loss";
  whatWentWrong?: string;
  notes?: string;
  tag?: string;
}

export interface UserState {
  version: number;
  // v2 per-role pool: rolePool[role][heroId]
  rolePool: Record<RolePosition, Record<number, RoleHeroPoolEntry>>;
  // Legacy pool for migration fallback
  pool: Record<number, HeroPoolEntry>;
  notes: Record<string, LaneMatchupNote>;
  srs: Record<string, SRSEntry>;
  gameLogs: PostGameLog[];
  settings: UserSettings;
  accountId?: string;
}

export const LEITNER_INTERVALS_DAYS = [0, 1, 3, 7, 21]; // Box 1 to 5

export const ALLOWED_TAGS = [
  "hard_cc",
  "aoe_disable",
  "silence",
  "break",
  "evasion",
  "illusions",
  "invis",
  "heal",
  "sustain",
  "ranged_harass",
  "burst_magic",
  "phys_carry",
  "blink_initiator",
  "save",
  "dispel",
  "passive_heavy",
  "summons",
  "global",
  "push",
  "smoke_gank",
  "mid_waveclear",
  "mid_roamer",
  "mid_tempo",
  "mid_late_scaler",
] as const;

export type TraitTag = (typeof ALLOWED_TAGS)[number];
export type DamageType = "physical" | "magical" | "pure" | "mixed";

export interface HeroLanePlan {
  harass: string;
  waveclear: string;
  level6: string;
  runeControl: string;
}

export interface HeroTrait {
  heroId: number;
  heroName: string;
  localized_name: string;
  tags: TraitTag[];
  dmgType: DamageType;
  lanePlan: HeroLanePlan;
}
