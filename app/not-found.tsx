"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, Swords } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = window.location.pathname;
    const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const basePath = rawBasePath
      ? (rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`).replace(/\/$/, "")
      : "";

    // Normalize path by stripping basePath if present
    let relativePath = path;
    if (basePath && relativePath.startsWith(basePath)) {
      relativePath = relativePath.slice(basePath.length);
    }

    // 1. Check old lane matchup URL: /lane/:role/:myHero/:enemyHero
    const laneMatch = relativePath.match(/\/lane\/([1-5])\/(\d+)\/(\d+)\/?$/);
    if (laneMatch) {
      const [, role, me, enemy] = laneMatch;
      setRedirecting(true);
      window.location.replace(`${basePath}/lane/matchup?role=${role}&me=${me}&enemy=${enemy}`);
      return;
    }

    // 2. Check old mid matchup URL: /mid/:myHero/:enemyHero
    const midMatch = relativePath.match(/\/mid\/(\d+)\/(\d+)\/?$/);
    if (midMatch) {
      const [, me, enemy] = midMatch;
      setRedirecting(true);
      window.location.replace(`${basePath}/lane/matchup?role=2&me=${me}&enemy=${enemy}`);
      return;
    }

    // 3. Check /mid/drill
    if (relativePath.includes("/mid/drill")) {
      setRedirecting(true);
      window.location.replace(`${basePath}/lane/2/drill/`);
      return;
    }

    // 4. Check /mid
    if (relativePath.match(/\/mid\/?$/)) {
      setRedirecting(true);
      window.location.replace(`${basePath}/lane/2/`);
      return;
    }
  }, []);

  if (redirecting) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-[#d8b57a] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300 font-mono">Redirecting to matchup playbook...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center px-4 py-12 text-center space-y-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-[#ec3d06]/10 border border-[#ec3d06]/30 flex items-center justify-center shadow-[0_0_30px_rgba(236,61,6,0.2)]">
          <ShieldAlert className="w-10 h-10 text-[#ec3d06]" />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-3xl font-black text-white font-dota tracking-tight">404 - Lane Lost</h1>
        <p className="text-sm text-slate-400">
          The requested lane or tactical playbook could not be found. Return to base to regroup.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button variant="outline" size="sm">
            <Home className="w-4 h-4 mr-1.5" />
            Home
          </Button>
        </Link>
        <Link href="/draft">
          <Button variant="primary" size="sm">
            <Swords className="w-4 h-4 mr-1.5" />
            Draft Arena
          </Button>
        </Link>
        <Link href="/lane/2">
          <Button variant="secondary" size="sm">
            Mid Matrix
          </Button>
        </Link>
      </div>
    </div>
  );
}
