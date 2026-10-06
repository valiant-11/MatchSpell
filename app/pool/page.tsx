"use client";

import { useState, useMemo, useEffect } from "react";
import { ALL_HEROES } from "@/lib/heroes";
import { useUserState } from "@/lib/useUserState";
import { HeroPicker } from "@/components/HeroPicker";
import { RolePosition } from "@/lib/types";
import { ALL_ROLES, ROLE_DEFINITIONS, getHeroRoleFit } from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { Button, Badge } from "@/components/ui";
import { ShieldCheck, Sparkles, RotateCcw } from "lucide-react";

export default function PoolPage() {
  const {
    state,
    isLoaded,
    selectedRole,
    selectRole,
    toggleRolePool,
    setRoleComfort,
  } = useUserState();

  const [activeRole, setActiveRole] = useState<RolePosition>(2);

  // Sync active role tab with global selectedRole when loaded
  useEffect(() => {
    if (isLoaded && selectedRole) {
      setActiveRole(selectedRole);
    }
  }, [isLoaded, selectedRole]);

  const activeRoleMeta = ROLE_DEFINITIONS[activeRole];
  const activeRoleTheme = ROLE_THEME[activeRole];

  // Statistics for active role
  const inCurrentRolePoolCount = useMemo(() => {
    return Object.values(state.rolePool?.[activeRole] || {}).filter((p) => p.inPool).length;
  }, [state.rolePool, activeRole]);

  // Bulk actions for active role
  const handleAddAllViable = () => {
    ALL_HEROES.forEach((hero) => {
      const fit = getHeroRoleFit(hero.id);
      if (fit && (fit.roles[activeRole] || 0) >= 0.35) {
        if (!state.rolePool?.[activeRole]?.[hero.id]?.inPool) {
          toggleRolePool(activeRole, hero.id);
        }
      }
    });
  };

  const handleClearRolePool = () => {
    const roleEntries = state.rolePool?.[activeRole] || {};
    Object.keys(roleEntries).forEach((idStr) => {
      const heroId = parseInt(idStr, 10);
      if (roleEntries[heroId]?.inPool) {
        toggleRolePool(activeRole, heroId);
      }
    });
  };

  const handleSwitchRoleTab = (r: RolePosition) => {
    setActiveRole(r);
    selectRole(r);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header with Title and Role Pool Count Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 font-dota">
              <ShieldCheck className="w-6 h-6 text-[#d8b57a]" />
              Hero Selection & Pool Roster
            </h1>
            <Badge variant="neutral" size="sm">Dota 2 Client Heroes</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse all heroes by attribute just like the Dota 2 in-game client. Click any tile to toggle it in your {activeRoleMeta.shortName} pool with 1–3 comfort ratings.
          </p>
        </div>

        {/* Counter Widget */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#12151a] border border-white/10 flex items-center gap-3 shadow-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${activeRoleTheme.bgColor}`}
            />
            <div className="text-left">
              <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {activeRoleMeta.shortName} Roster
              </span>
              <span className="text-sm font-black text-white font-mono">
                {inCurrentRolePoolCount} heroes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 5-Role Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#12151a] p-1.5 rounded-2xl border border-white/10 shadow-inner">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_DEFINITIONS[r];
          const theme = ROLE_THEME[r];
          const isCurrentTab = activeRole === r;
          const poolCount = Object.values(state.rolePool?.[r] || {}).filter((p) => p.inPool).length;

          return (
            <button
              key={r}
              type="button"
              onClick={() => handleSwitchRoleTab(r)}
              className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all duration-150 border text-center cursor-pointer ${
                isCurrentTab
                  ? "border-[#d8b57a]/50 bg-[#1a1e25] shadow-md shadow-black/50"
                  : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <RoleIcon role={r} size={18} active={isCurrentTab} />
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isCurrentTab ? theme.color : ""
                  }`}
                >
                  {meta.shortName}
                </span>
              </div>
              <span className="text-[11px] opacity-75 mt-0.5 truncate max-w-full">
                {meta.name}
              </span>
              <span className="mt-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0a0c0f] border border-white/10 font-bold text-slate-400">
                {poolCount} heroes
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Role Lane Banner with Quick Populate Actions */}
      <div
        className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12151a] border-white/10"
        style={{ borderLeftWidth: "4px", borderLeftColor: activeRole === 1 ? "#f59e0b" : activeRole === 2 ? "#06b6d4" : activeRole === 3 ? "#ec4899" : activeRole === 4 ? "#a855f7" : "#10b981" }}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {activeRoleMeta.laneName} Role Strategy
            </span>
            <Badge variant="neutral" size="xs">
              {activeRoleMeta.shortName}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400">
            {activeRoleMeta.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddAllViable}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#d8b57a]" />}
          >
            Add Viable Meta
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearRolePool}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* 4. The HeroPicker Centerpiece (4 Attribute Columns) */}
      <HeroPicker
        mode="pool"
        role={activeRole}
        rolePool={state.rolePool?.[activeRole] || {}}
        onTogglePoolHero={(heroId) => toggleRolePool(activeRole, heroId)}
        onSetComfort={(heroId, comfort) => setRoleComfort(activeRole, heroId, comfort)}
      />
    </div>
  );
}
