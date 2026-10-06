"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DEFAULT_STATE,
  loadUserState,
  saveUserState,
  setSelectedRole as setSelectedRoleStorage,
  toggleHeroRolePool as toggleRolePoolStorage,
  setHeroRoleComfort as setRoleComfortStorage,
  toggleHeroPool as togglePoolStorage,
  toggleHeroMid as toggleMidStorage,
  setHeroComfort as setComfortStorage,
  setBatchPool as setBatchPoolStorage,
} from "./storage";
import { HeroPoolEntry, RolePosition, UserState } from "./types";

export function useUserState() {
  const [state, setState] = useState<UserState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setState(loadUserState());
    setIsLoaded(true);

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<UserState>;
      if (customEvent.detail) {
        startTransition(() => {
          setState(customEvent.detail);
        });
      } else {
        startTransition(() => {
          setState(loadUserState());
        });
      }
    };

    window.addEventListener("matchspell_storage_updated", handleUpdate);
    window.addEventListener("midmaster_storage_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("matchspell_storage_updated", handleUpdate);
      window.removeEventListener("midmaster_storage_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const togglePool = (heroId: number) => {
    const updated = togglePoolStorage(heroId);
    setState(updated);
  };

  const toggleMid = (heroId: number) => {
    const updated = toggleMidStorage(heroId);
    setState(updated);
  };

  const setComfort = (heroId: number, comfort: 1 | 2 | 3) => {
    const updated = setComfortStorage(heroId, comfort);
    setState(updated);
  };

  const setBatch = (heroIds: number[], updates: Partial<Omit<HeroPoolEntry, "heroId">>) => {
    const updated = setBatchPoolStorage(heroIds, updates);
    setState(updated);
  };

  const selectRole = (role: RolePosition) => {
    const updated = setSelectedRoleStorage(role);
    setState(updated);
  };

  const toggleRolePool = (role: RolePosition, heroId: number) => {
    const updated = toggleRolePoolStorage(role, heroId);
    setState(updated);
  };

  const setRoleComfort = (role: RolePosition, heroId: number, comfort: 1 | 2 | 3) => {
    const updated = setRoleComfortStorage(role, heroId, comfort);
    setState(updated);
  };

  return {
    state,
    isLoaded,
    selectedRole: (state.settings?.selectedRole as RolePosition) || 2,
    selectRole,
    toggleRolePool,
    setRoleComfort,
    togglePool,
    toggleMid,
    setComfort,
    setBatch,
    refresh: () => setState(loadUserState()),
  };
}
