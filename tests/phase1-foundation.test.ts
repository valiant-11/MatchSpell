import { describe, it, expect, beforeEach } from "vitest";
import { ALL_HEROES, getHeroById } from "../lib/heroes";
import {
  DEFAULT_STATE,
  loadUserState,
  saveUserState,
  toggleHeroPool,
  toggleHeroMid,
  setHeroComfort,
  setBatchPool,
  exportStateAsJson,
  importStateFromJson,
  resetState,
} from "../lib/storage";

// Mock localStorage for Vitest environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
  length: 0,
  key: () => null,
};
globalThis.window = {
  dispatchEvent: () => true,
} as unknown as Window & typeof globalThis;

describe("Phase 1: Heroes Data & Foundation", () => {
  it("loads 127 heroes with all mandatory fields", () => {
    expect(ALL_HEROES.length).toBeGreaterThanOrEqual(120);

    for (const hero of ALL_HEROES) {
      expect(hero.id).toBeGreaterThan(0);
      expect(hero.localized_name).toBeTruthy();
      expect(hero.name).toMatch(/^npc_dota_hero_/);
      expect(["str", "agi", "int", "all"]).toContain(hero.primary_attr);
      expect(["Melee", "Ranged"]).toContain(hero.attack_type);
      expect(Array.isArray(hero.roles)).toBe(true);
      expect(hero.img).toMatch(/^https:\/\/cdn\.cloudflare\.steamstatic\.com/);
    }
  });

  it("can lookup heroes by ID", () => {
    const invoker = getHeroById(74);
    expect(invoker).toBeDefined();
    expect(invoker?.localized_name).toBe("Invoker");
    expect(invoker?.primary_attr).toBe("int");
  });
});

describe("Phase 1: Storage Wrapper & Hero Pool Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default state", () => {
    const state = loadUserState();
    expect(state.version).toBeGreaterThanOrEqual(1);
    expect(state.pool).toEqual({});
    expect(state.settings.bracket).toBe("8");
  });

  it("toggles hero in and out of pool", () => {
    const heroId = 74; // Invoker
    const updated1 = toggleHeroPool(heroId);
    expect(updated1.pool[heroId].inPool).toBe(true);

    const reloaded1 = loadUserState();
    expect(reloaded1.pool[heroId].inPool).toBe(true);

    const updated2 = toggleHeroPool(heroId);
    expect(updated2.pool[heroId].inPool).toBe(false);

    const reloaded2 = loadUserState();
    expect(reloaded2.pool[heroId].inPool).toBe(false);
  });

  it("toggles mid flag and auto-includes in pool", () => {
    const heroId = 17; // Storm Spirit
    const state = toggleHeroMid(heroId);
    expect(state.pool[heroId].isMid).toBe(true);
    expect(state.pool[heroId].inPool).toBe(true);
  });

  it("updates comfort level 1-3", () => {
    const heroId = 25; // Lina
    toggleHeroPool(heroId);
    const updated = setHeroComfort(heroId, 3);
    expect(updated.pool[heroId].comfort).toBe(3);

    const reloaded = loadUserState();
    expect(reloaded.pool[heroId].comfort).toBe(3);
  });

  it("batch sets pool entries", () => {
    const ids = [11, 13, 17];
    const updated = setBatchPool(ids, { inPool: true, isMid: true, comfort: 3 });
    for (const id of ids) {
      expect(updated.pool[id].inPool).toBe(true);
      expect(updated.pool[id].isMid).toBe(true);
      expect(updated.pool[id].comfort).toBe(3);
    }
  });

  it("exports and imports valid JSON backup", () => {
    const heroId = 74;
    toggleHeroPool(heroId);
    setHeroComfort(heroId, 3);

    const exported = exportStateAsJson();
    expect(typeof exported).toBe("string");

    // Reset state
    resetState();
    expect(loadUserState().pool[heroId]).toBeUndefined();

    // Import state back
    const result = importStateFromJson(exported);
    expect(result.success).toBe(true);

    const reimported = loadUserState();
    expect(reimported.pool[heroId].inPool).toBe(true);
    expect(reimported.pool[heroId].comfort).toBe(3);
  });

  it("gracefully rejects corrupted JSON import", () => {
    const result = importStateFromJson("{not_valid_json");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
