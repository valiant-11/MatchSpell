import {
  ComfortLevel,
  HeroPoolEntry,
  LaneMatchupNote,
  MidMatchupNote,
  PostGameLog,
  RoleHeroPoolEntry,
  RolePosition,
  SRSEntry,
  UserSettings,
  UserState,
} from "./types";

const STORAGE_KEY = "matchspell_user_state_v2";
const LEGACY_V2_STORAGE_KEY = "midmaster_user_state_v2";
const LEGACY_STORAGE_KEY = "midmaster_user_state_v1";

export const DEFAULT_SETTINGS: UserSettings = {
  bracket: "8", // Divine/Immortal
  theme: "dark",
  defaultMode: "balanced",
  selectedRole: 2, // Pos 2 Mid default
  personalTermEnabled: true,
  wPersonal: 0.25,
  blendRatio: 0.5,
};

export const DEFAULT_STATE: UserState = {
  version: 2,
  rolePool: {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
  },
  pool: {},
  notes: {},
  srs: {},
  gameLogs: [],
  settings: DEFAULT_SETTINGS,
};

const canUseStorage = (): boolean =>
  typeof localStorage !== "undefined";

/**
 * One-time migration from v1 (mid-only) schema to v2 (role-aware pos 1-5).
 */
export function migrateUserState(raw: any): UserState {
  if (!raw || typeof raw !== "object") return DEFAULT_STATE;

  const version = raw.version || 1;
  const rolePool: Record<RolePosition, Record<number, RoleHeroPoolEntry>> = {
    1: { ...(raw.rolePool?.[1] || raw.rolePool?.["1"] || {}) },
    2: { ...(raw.rolePool?.[2] || raw.rolePool?.["2"] || {}) },
    3: { ...(raw.rolePool?.[3] || raw.rolePool?.["3"] || {}) },
    4: { ...(raw.rolePool?.[4] || raw.rolePool?.["4"] || {}) },
    5: { ...(raw.rolePool?.[5] || raw.rolePool?.["5"] || {}) },
  };

  const notes: Record<string, LaneMatchupNote> = {};
  const srs: Record<string, SRSEntry> = {};

  if (version < 2) {
    // 1. Migrate old pool into role 2 (Mid pool)
    const oldPool = raw.pool || {};
    for (const [idStr, entryVal] of Object.entries(oldPool)) {
      const heroId = parseInt(idStr, 10);
      const entry = entryVal as HeroPoolEntry;
      if (entry.isMid || entry.inPool) {
        rolePool[2][heroId] = {
          heroId,
          inPool: true,
          comfort: entry.comfort || 2,
        };
      }
    }

    // 2. Migrate old notes `${myHeroId}_${enemyHeroId}` -> `2_${myHeroId}_${enemyHeroId}`
    const oldNotes = raw.notes || {};
    for (const [key, noteVal] of Object.entries(oldNotes)) {
      const val = noteVal as any;
      const myHeroId = val.myHeroId;
      const enemyHeroId = val.enemyHeroId;
      const newKey = key.includes("_") && key.split("_").length >= 3 ? key : `2_${myHeroId}_${enemyHeroId}`;
      notes[newKey] = {
        role: 2,
        myHeroId,
        enemyHeroId,
        notes: val.notes || "",
        skipTake: val.skipTake,
        runePlan: val.runePlan,
        keyItems: val.keyItems,
        mistakeToAvoid: val.mistakeToAvoid,
        updatedAt: val.updatedAt || Date.now(),
      };
    }

    // 3. Migrate old SRS keys `${myHeroId}_${enemyHeroId}` -> `2_${myHeroId}_${enemyHeroId}`
    const oldSRS = raw.srs || {};
    for (const [key, srsVal] of Object.entries(oldSRS)) {
      const val = srsVal as any;
      const myHeroId = val.myHeroId;
      const enemyHeroId = val.enemyHeroId;
      const newKey = key.includes("_") && key.split("_").length >= 3 ? key : `2_${myHeroId}_${enemyHeroId}`;
      srs[newKey] = {
        matchupKey: newKey,
        role: 2,
        myHeroId,
        enemyHeroId,
        box: val.box || 1,
        lastReviewDate: val.lastReviewDate || 0,
        nextDueDate: val.nextDueDate || 0,
        streak: val.streak || 0,
        history: val.history || [],
      };
    }
  } else {
    // Already v2
    Object.assign(notes, raw.notes || {});
    Object.assign(srs, raw.srs || {});
  }

  return {
    version: 2,
    rolePool,
    pool: raw.pool || {},
    notes,
    srs,
    gameLogs: raw.gameLogs || [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings || {}),
      selectedRole: (raw.settings?.selectedRole as RolePosition) || 2,
    },
    accountId: raw.accountId,
  };
}

export function loadUserState(): UserState {
  if (!canUseStorage()) return DEFAULT_STATE;

  try {
    // Check MatchSpell storage first
    let rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) {
      // Check legacy MidMaster v2 storage
      rawStr = localStorage.getItem(LEGACY_V2_STORAGE_KEY);
      if (rawStr) {
        const migrated = migrateUserState(JSON.parse(rawStr));
        saveUserState(migrated);
        return migrated;
      }
      // Check legacy MidMaster v1 storage
      rawStr = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (rawStr) {
        const migrated = migrateUserState(JSON.parse(rawStr));
        saveUserState(migrated);
        return migrated;
      }
      return DEFAULT_STATE;
    }

    const parsed = JSON.parse(rawStr);
    return migrateUserState(parsed);
  } catch (err) {
    console.error("Failed to load user state from localStorage:", err);
    return DEFAULT_STATE;
  }
}

export function saveUserState(state: UserState): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("matchspell_storage_updated", { detail: state }));
      window.dispatchEvent(new CustomEvent("midmaster_storage_updated", { detail: state }));
    }
  } catch (err) {
    console.error("Failed to save user state to localStorage:", err);
  }
}

// ==========================================
// ROLE SELECTION
// ==========================================

export function getSelectedRole(): RolePosition {
  const state = loadUserState();
  return state.settings.selectedRole || 2;
}

export function setSelectedRole(role: RolePosition): UserState {
  const current = loadUserState();
  const next: UserState = {
    ...current,
    settings: {
      ...current.settings,
      selectedRole: role,
    },
  };
  saveUserState(next);
  return next;
}

// ==========================================
// PER-ROLE HERO POOL
// ==========================================

export function getRolePool(role: RolePosition): Record<number, RoleHeroPoolEntry> {
  const state = loadUserState();
  return state.rolePool[role] || {};
}

export function toggleHeroRolePool(role: RolePosition, heroId: number): UserState {
  const current = loadUserState();
  const existing = current.rolePool[role]?.[heroId] || {
    heroId,
    inPool: false,
    comfort: 2,
  };
  const updated: RoleHeroPoolEntry = {
    ...existing,
    inPool: !existing.inPool,
  };

  const nextRolePool = {
    ...current.rolePool,
    [role]: {
      ...(current.rolePool[role] || {}),
      [heroId]: updated,
    },
  };

  // Sync to legacy pool field for backward compatibility
  const nextPool = { ...(current.pool || {}) };
  nextPool[heroId] = {
    heroId,
    inPool: updated.inPool,
    isMid: role === 2 ? updated.inPool : !!nextPool[heroId]?.isMid,
    comfort: updated.comfort,
  };

  const next: UserState = {
    ...current,
    rolePool: nextRolePool,
    pool: nextPool,
  };
  saveUserState(next);
  return next;
}

export function setHeroRoleComfort(
  role: RolePosition,
  heroId: number,
  comfort: ComfortLevel
): UserState {
  const current = loadUserState();
  const existing = current.rolePool[role]?.[heroId] || {
    heroId,
    inPool: true,
    comfort: 2,
  };
  const updated: RoleHeroPoolEntry = {
    ...existing,
    comfort,
  };

  const nextRolePool = {
    ...current.rolePool,
    [role]: {
      ...(current.rolePool[role] || {}),
      [heroId]: updated,
    },
  };

  // Sync to legacy pool
  const nextPool = { ...(current.pool || {}) };
  nextPool[heroId] = {
    heroId,
    inPool: existing.inPool,
    isMid: role === 2 ? existing.inPool : !!nextPool[heroId]?.isMid,
    comfort: updated.comfort,
  };

  const next: UserState = {
    ...current,
    rolePool: nextRolePool,
    pool: nextPool,
  };
  saveUserState(next);
  return next;
}

export function setBatchPool(
  heroIds: number[],
  updates: Partial<Omit<HeroPoolEntry, "heroId">>
): UserState {
  const current = loadUserState();
  const newPool = { ...(current.pool || {}) };
  const nextRolePool = { ...current.rolePool };
  const role2 = { ...(nextRolePool[2] || {}) };

  for (const id of heroIds) {
    const existing = newPool[id] || { heroId: id, inPool: false, isMid: false, comfort: 2 };
    newPool[id] = { ...existing, ...updates };

    role2[id] = {
      heroId: id,
      inPool: !!newPool[id].inPool,
      comfort: newPool[id].comfort || 2,
    };
  }

  nextRolePool[2] = role2;
  const next: UserState = { ...current, pool: newPool, rolePool: nextRolePool };
  saveUserState(next);
  return next;
}

// Legacy pool helpers for backward compatibility
export function toggleHeroPool(heroId: number): UserState {
  const activeRole = getSelectedRole();
  return toggleHeroRolePool(activeRole, heroId);
}

export function toggleHeroMid(heroId: number): UserState {
  return toggleHeroRolePool(2, heroId);
}

export function setHeroComfort(heroId: number, comfort: ComfortLevel): UserState {
  const activeRole = getSelectedRole();
  return setHeroRoleComfort(activeRole, heroId, comfort);
}

// ==========================================
// LANE MATCHUP NOTES
// ==========================================

export function getMatchupNoteKey(
  role: RolePosition,
  myHeroId: number,
  enemyHeroId: number,
  partnerId?: number
): string {
  return partnerId ? `${role}_${myHeroId}_${enemyHeroId}_${partnerId}` : `${role}_${myHeroId}_${enemyHeroId}`;
}

export function getLaneMatchupNote(
  role: RolePosition,
  myHeroId: number,
  enemyHeroId: number,
  partnerId?: number
): LaneMatchupNote | null {
  const state = loadUserState();
  const keyWithPartner = getMatchupNoteKey(role, myHeroId, enemyHeroId, partnerId);
  if (state.notes[keyWithPartner]) return state.notes[keyWithPartner];
  // Fallback to role-only note without partner
  const keyWithoutPartner = getMatchupNoteKey(role, myHeroId, enemyHeroId);
  return state.notes[keyWithoutPartner] || null;
}

export function saveLaneMatchupNote(note: LaneMatchupNote): UserState {
  const current = loadUserState();
  const key = getMatchupNoteKey(note.role, note.myHeroId, note.enemyHeroId, note.lanePartnerId);
  const next: UserState = {
    ...current,
    notes: {
      ...current.notes,
      [key]: { ...note, updatedAt: Date.now() },
    },
  };
  saveUserState(next);
  return next;
}

// Legacy note helpers
export function getMatchupNote(myHeroId: number, enemyHeroId: number): MidMatchupNote | null {
  return getLaneMatchupNote(2, myHeroId, enemyHeroId);
}

export function saveMatchupNote(note: MidMatchupNote): UserState {
  return saveLaneMatchupNote({ ...note, role: note.role || 2 });
}

// ==========================================
// SPACED REPETITION (SRS)
// ==========================================

export function getRoleSRSEntries(role?: RolePosition | "all"): SRSEntry[] {
  const state = loadUserState();
  const all = Object.values(state.srs);
  if (!role || role === "all") return all;
  return all.filter((s) => s.role === role);
}

export function getRoleSRSEntry(
  role: RolePosition,
  myHeroId: number,
  enemyHeroId: number,
  partnerId?: number
): SRSEntry | null {
  const state = loadUserState();
  const key = getMatchupNoteKey(role, myHeroId, enemyHeroId, partnerId);
  return state.srs[key] || state.srs[`${role}_${myHeroId}_${enemyHeroId}`] || null;
}

export function saveRoleSRSEntry(entry: SRSEntry): UserState {
  const current = loadUserState();
  const key =
    entry.matchupKey || getMatchupNoteKey(entry.role || 2, entry.myHeroId, entry.enemyHeroId, entry.lanePartnerId);
  const next: UserState = {
    ...current,
    srs: {
      ...current.srs,
      [key]: { ...entry, matchupKey: key },
    },
  };
  saveUserState(next);
  return next;
}

// Legacy SRS helpers
export function getSRSEntry(myHeroId: number, enemyHeroId: number): SRSEntry | null {
  return getRoleSRSEntry(2, myHeroId, enemyHeroId);
}

export function saveSRSEntry(entry: SRSEntry): UserState {
  return saveRoleSRSEntry({ ...entry, role: entry.role || 2 });
}

// ==========================================
// GAME LOGS & SETTINGS
// ==========================================

export function addGameLog(log: PostGameLog): UserState {
  const current = loadUserState();
  const role = log.role || current.settings.selectedRole || 2;
  const next: UserState = {
    ...current,
    gameLogs: [{ ...log, role }, ...current.gameLogs],
  };

  // If wrong-tagged / loss, push matchup back to box 1 per AGENTS.md
  if (log.result === "loss" || log.whatWentWrong) {
    const srsKey = getMatchupNoteKey(role, log.myHeroId, log.enemyHeroId, log.lanePartnerId);
    const srsEntry = next.srs[srsKey] || next.srs[`${role}_${log.myHeroId}_${log.enemyHeroId}`];
    if (srsEntry) {
      next.srs[srsKey] = {
        ...srsEntry,
        box: 1,
        nextDueDate: Date.now(),
        streak: 0,
        history: [...(srsEntry.history || []), { date: Date.now(), correct: false }],
      };
    }
  }

  saveUserState(next);
  return next;
}

export function updateSettings(settings: Partial<UserSettings>): UserState {
  const current = loadUserState();
  const next: UserState = {
    ...current,
    settings: {
      ...current.settings,
      ...settings,
    },
  };
  saveUserState(next);
  return next;
}

export function exportStateAsJson(): string {
  const state = loadUserState();
  return JSON.stringify(state, null, 2);
}

export function importStateFromJson(jsonString: string): { success: boolean; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "Invalid JSON format" };
    }
    const migrated = migrateUserState(parsed);
    saveUserState(migrated);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Parse error" };
  }
}

export function resetState(): UserState {
  saveUserState(DEFAULT_STATE);
  return DEFAULT_STATE;
}
