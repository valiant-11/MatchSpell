"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Swords,
  ShieldAlert,
  BookOpen,
  BrainCircuit,
  Settings,
  User,
  GitCompare,
} from "lucide-react";
import { useUserState } from "@/lib/useUserState";
import { ALL_ROLES, ROLE_DEFINITIONS } from "@/lib/roles";
import { RolePosition } from "@/lib/types";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isLoaded, selectedRole, selectRole } = useUserState();

  // Keyboard shortcuts 1-5 for switching active role globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is focused inside input, textarea or contenteditable
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const roleNum = parseInt(e.key, 10) as RolePosition;
        selectRole(roleNum);

        // If currently on a lane trainer or drill page, transition URL to the new role
        if (pathname?.startsWith("/lane/")) {
          const parts = pathname.split("/");
          if (parts[3] === "drill") {
            router.push(`/lane/${roleNum}/drill`);
          } else {
            router.push(`/lane/${roleNum}`);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectRole, pathname, router]);

  const activeRoleMeta = ROLE_DEFINITIONS[selectedRole] || ROLE_DEFINITIONS[2];

  // Pool count for the currently selected role
  const rolePoolCount = isLoaded
    ? Object.values(state.rolePool?.[selectedRole] || {}).filter((p) => p.inPool).length
    : 0;

  const navItems = [
    {
      href: "/pool",
      label: "Hero Pool",
      icon: Swords,
      badge: isLoaded ? `${rolePoolCount} in ${activeRoleMeta.shortName}` : null,
    },
    { href: "/draft", label: "Draft Helper", icon: ShieldAlert },
    {
      href: `/lane/${selectedRole}`,
      label: "Lane Trainer",
      icon: BookOpen,
      matchPrefix: "/lane",
    },
    {
      href: `/lane/${selectedRole}/drill`,
      label: "Drill Trainer",
      icon: BrainCircuit,
      matchPrefix: `/lane/${selectedRole}/drill`,
    },
    { href: "/changes", label: "Patch Changes", icon: GitCompare },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const handleRoleClick = (r: RolePosition) => {
    selectRole(r);
    if (pathname?.startsWith("/lane/")) {
      const parts = pathname.split("/");
      if (parts[3] === "drill") {
        router.push(`/lane/${r}/drill`);
      } else {
        router.push(`/lane/${r}`);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#1f293d] bg-[#0c1017]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Active Role Badge */}
          <div className="flex items-center gap-3">
            <Link href="/pool" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 via-red-500/20 to-sky-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:border-amber-400 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all">
                <Swords className="w-5 h-5 text-amber-400" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-black tracking-wider uppercase bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                  MATCHSPELL
                </span>
                <span className="block text-[9px] tracking-widest text-slate-400 uppercase -mt-1 font-semibold">
                  v2 Multi-Role Trainer
                </span>
              </div>
            </Link>

            {/* Global Role Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${activeRoleMeta.bgColor} ${activeRoleMeta.borderColor} ${activeRoleMeta.color}`}
              title={`Active Role: ${activeRoleMeta.name} (Press 1-5 to switch)`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{activeRoleMeta.shortName}</span>
              <span className="hidden md:inline font-normal opacity-80">
                • {activeRoleMeta.name}
              </span>
            </div>
          </div>

          {/* 5-Role Fast Switcher (Keyboard 1-5) */}
          <div className="flex items-center bg-[#101622] p-1 rounded-xl border border-slate-800 shadow-inner">
            {ALL_ROLES.map((r) => {
              const meta = ROLE_DEFINITIONS[r];
              const isSelected = selectedRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleClick(r)}
                  className={`relative px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    isSelected
                      ? `${meta.bgColor} ${meta.color} shadow-sm border ${meta.borderColor}`
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  }`}
                  title={`${meta.shortName}: ${meta.name} (Shortcut: ${r})`}
                >
                  <span className="font-mono text-[10px] opacity-70">[{r}]</span>
                  <span>{meta.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Main Navigation Items */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.matchPrefix
                  ? pathname?.startsWith(item.matchPrefix)
                  : pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-slate-800 text-sky-400 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.badge && (
                    <span className="hidden xl:inline ml-0.5 text-[10px] px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-amber-400 font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
