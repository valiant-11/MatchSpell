"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Layers,
  BookOpen,
  BrainCircuit,
  User,
  GitCompare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  Menu,
  X,
  Swords,
} from "lucide-react";
import { useUserState } from "@/lib/useUserState";
import { RolePosition } from "@/lib/types";
import { RoleSwitcher } from "./RoleSwitcher";
import { RoleIcon, ROLE_THEME } from "./icons/RoleIcon";
import { Tooltip } from "./ui/Tooltip";
import { updateSettings } from "@/lib/storage";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isLoaded, selectedRole, selectRole, refresh } = useUserState();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleRoleChange = (role: RolePosition) => {
    selectRole(role);
    if (pathname?.startsWith("/lane/")) {
      const parts = pathname.split("/");
      if (parts[3] === "drill") {
        router.push(`/lane/${role}/drill`);
      } else {
        router.push(`/lane/${role}`);
      }
    }
  };

  const navItems = [
    {
      href: "/draft",
      label: "Draft Arena",
      icon: ShieldAlert,
    },
    {
      href: "/pool",
      label: "Hero Pools",
      icon: Layers,
    },
    {
      href: `/lane/${selectedRole}`,
      label: "Lane Trainer",
      icon: BookOpen,
      matchPrefix: "/lane",
      excludePrefix: `/lane/${selectedRole}/drill`,
    },
    {
      href: `/lane/${selectedRole}/drill`,
      label: "Drill Cards",
      icon: BrainCircuit,
      matchPrefix: `/lane/${selectedRole}/drill`,
    },
    {
      href: "/profile",
      label: "Player Stats",
      icon: User,
    },
    {
      href: "/changes",
      label: "Patch Changes",
      icon: GitCompare,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const handleBracketChange = (bracket: string) => {
    updateSettings({ bracket });
    refresh();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0a0c0f] text-[#f8fafc]">
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/10 bg-[#12151a] transition-all duration-200 shrink-0 select-none z-30 ${
          collapsed ? "w-18" : "w-60"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <Link href="/pool" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#1a1e25] border border-[#d8b57a]/40 flex items-center justify-center shrink-0 shadow-md">
              <Swords className="w-5 h-5 text-[#d8b57a]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-dota text-base font-bold tracking-widest text-[#d8b57a] leading-none">
                  MATCHSPELL
                </span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mt-1">
                  Dota 2 Client HUD
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            let isActive = false;
            if (item.matchPrefix) {
              if (item.excludePrefix && pathname?.startsWith(item.excludePrefix)) {
                isActive = false;
              } else {
                isActive = pathname?.startsWith(item.matchPrefix) || false;
              }
            } else {
              isActive = pathname === item.href;
            }

            const linkContent = (
              <Link
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-[#1a1e25] text-white border border-[#d8b57a]/40 shadow-sm shadow-black/60"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-[#d8b57a]" : "text-slate-400"
                  }`}
                />
                {!collapsed && (
                  <span className="truncate font-medium tracking-wide">{item.label}</span>
                )}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#d8b57a] rounded-r-full shadow-[0_0_8px_#d8b57a]" />
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} content={item.label} position="right">
                  {linkContent}
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Sidebar Footer with Non-Affiliation Notice */}
        {!collapsed && (
          <div className="p-3 border-t border-white/5 text-[10px] text-slate-500 leading-tight">
            <span>MatchSpell Dota 2 Trainer</span>
            <span className="block text-[9px] text-slate-600 mt-0.5">Not affiliated with Valve Corp.</span>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-white/10 bg-[#12151a]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Persistent Top Nav Role Switcher */}
            <RoleSwitcher
              selectedRole={selectedRole}
              onSelectRole={handleRoleChange}
            />
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-3">
            {/* Rank Bracket Selector */}
            <select
              value={state.settings?.bracket || "divine"}
              onChange={(e) => handleBracketChange(e.target.value)}
              aria-label="Competitive Rank Bracket"
              className="bg-[#0a0c0f] text-slate-300 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#d8b57a] cursor-pointer"
            >
              <option value="divine">Divine / Immortal (High MMR)</option>
              <option value="ancient">Ancient</option>
              <option value="legend">Legend</option>
              <option value="all">All Brackets</option>
            </select>
          </div>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-[#12151a] p-4 space-y-2 z-40">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive
                      ? "bg-[#1a1e25] text-[#d8b57a] border border-[#d8b57a]/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#d8b57a]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Page Children */}
        <main className="flex-1 pb-16 md:pb-6">{children}</main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#12151a]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.startsWith(item.matchPrefix || item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                  isActive ? "text-[#d8b57a]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-[55px]">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
