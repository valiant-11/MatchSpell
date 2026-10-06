"use client";

import Link from "next/link";
import { Swords, ShieldAlert, BookOpen, BrainCircuit, ArrowRight, Zap, Target, BookMarked } from "lucide-react";
import { useUserState } from "@/lib/useUserState";
import { ALL_HEROES } from "@/lib/heroes";

export default function HomePage() {
  const { state, isLoaded } = useUserState();

  const totalInPool = isLoaded ? Object.values(state.pool).filter((p) => p.inPool).length : 0;
  const midInPool = isLoaded ? Object.values(state.pool).filter((p) => p.inPool && p.isMid).length : 0;
  const dueReviews = isLoaded
    ? Object.values(state.srs).filter((s) => s.nextDueDate <= Date.now()).length
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#131d2e] to-[#0d1424] border border-[#1f2e4d] p-8 md:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Zap className="w-3.5 h-3.5" /> Dota 2 Competitive Draft & Lane Specialization
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase">
            Master the Draft. <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              Dominate Every Lane.
            </span>
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            MatchSpell is your personal high-elo preparation toolkit. Configure your hero pool, calculate mathematically smoothed draft counters, and drill role matchups using spaced repetition.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/pool"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/20 transition-all"
            >
              Configure Hero Pool
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/draft"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 transition-all"
            >
              Draft Helper
            </Link>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Feature Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hero Pool */}
        <Link
          href="/pool"
          className="group p-5 rounded-xl bg-[#101622] border border-[#1e283d] hover:border-sky-500/50 hover:bg-[#141b2a] transition-all flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <Swords className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
              Hero Pool
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Define your hero repertoire, comfort levels (1-3), and mid hero subset.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Pool Size</span>
            <span className="font-mono font-semibold text-sky-400">
              {totalInPool} / {ALL_HEROES.length}
            </span>
          </div>
        </Link>

        {/* Card 2: Draft Helper */}
        <Link
          href="/draft"
          className="group p-5 rounded-xl bg-[#101622] border border-[#1e283d] hover:border-amber-500/50 hover:bg-[#141b2a] transition-all flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
              Draft Helper
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Input up to 5 enemy picks to get statistically smoothed recommendations across 4 modes.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Algorithms</span>
            <span className="font-semibold text-amber-400">Lane / Fight / Macro</span>
          </div>
        </Link>

        {/* Card 3: Mid Matchup Matrix */}
        <Link
          href="/mid"
          className="group p-5 rounded-xl bg-[#101622] border border-[#1e283d] hover:border-emerald-500/50 hover:bg-[#141b2a] transition-all flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
              Mid Matchups
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Inspect head-to-head win deltas, auto lane plans, and personal notes for every matchup.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Mid Heroes</span>
            <span className="font-mono font-semibold text-emerald-400">{midInPool}</span>
          </div>
        </Link>

        {/* Card 4: Drill Trainer */}
        <Link
          href="/mid/drill"
          className="group p-5 rounded-xl bg-[#101622] border border-[#1e283d] hover:border-purple-500/50 hover:bg-[#141b2a] transition-all flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
              Drill Trainer
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Leitner 5-box spaced repetition system. Drill flashcards and multiple-choice quizzes.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Due Today</span>
            <span className="font-mono font-semibold text-purple-400">{dueReviews} reviews</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
