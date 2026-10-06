"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getHeroById, ATTR_LABELS } from "@/lib/heroes";
import { useUserState } from "@/lib/useUserState";
import { getMatchup } from "@/lib/scoring";
import { createSRSEntry } from "@/lib/srs";
import {
  saveLaneMatchupNote,
  saveRoleSRSEntry,
  getMatchupNoteKey,
  getLaneMatchupNote,
} from "@/lib/storage";
import { LaneMatchupNote, SRSEntry, RolePosition, Hero, PersonalStatsSummary } from "@/lib/types";
import {
  ROLE_DEFINITIONS,
  getPrimaryOpponentRole,
  getLanePartnerRole,
  getViableHeroesForRole,
  generateRoleLanePlan,
} from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { HeroPortrait } from "@/components/HeroPortrait";
import { ItemPriorityPanel } from "@/components/ItemPriorityPanel";
import { ItemTimingChart } from "@/components/ItemTimingChart";
import {
  Button,
  Badge,
  Card,
  Select,
  Input,
} from "@/components/ui";
import { loadSummaryFromIDB } from "@/lib/player-stats";
import rawTraits from "@/data/traits.json";
import rawSeedNotes from "@/data/mid-notes.seed.json";
import {
  ArrowLeft,
  Save,
  Sparkles,
  AlertTriangle,
  BookmarkPlus,
  BookmarkCheck,
  Users,
  BarChart2,
} from "lucide-react";

interface SeedNote {
  myHeroId: number;
  enemyHeroId: number;
  notes?: string;
  skipTake?: string;
  runePlan?: string;
  keyItems?: string;
  mistakeToAvoid?: string;
}

const traitsMap = rawTraits as Record<string, any>;
const seedNotesMap = rawSeedNotes as Record<string, SeedNote>;

function LaneMatchupDetailContent() {
  const searchParams = useSearchParams();

  const roleParam = searchParams.get("role");
  const meParam = searchParams.get("me") || searchParams.get("myHero");
  const enemyParam = searchParams.get("enemy") || searchParams.get("enemyHero");

  const roleNum = parseInt(roleParam || "2", 10);
  const role: RolePosition = ([1, 2, 3, 4, 5].includes(roleNum) ? roleNum : 2) as RolePosition;
  const myHeroId = parseInt(meParam || "0", 10);
  const enemyHeroId = parseInt(enemyParam || "0", 10);

  const myHero = getHeroById(myHeroId);
  const enemyHero = getHeroById(enemyHeroId);

  const { state, refresh } = useUserState();

  const roleMeta = ROLE_DEFINITIONS[role];
  const roleTheme = ROLE_THEME[role];
  const oppRole = getPrimaryOpponentRole(role);
  const oppMeta = ROLE_DEFINITIONS[oppRole];
  const oppTheme = ROLE_THEME[oppRole];
  const partnerRole = getLanePartnerRole(role);
  const partnerMeta = partnerRole ? ROLE_DEFINITIONS[partnerRole] : null;

  // Lane Partner selection for duo lanes (Pos 3, 4, 5)
  const [partnerId, setPartnerId] = useState<number | undefined>(undefined);
  const partnerHero = partnerId ? getHeroById(partnerId) : null;

  // Viable partner hero options
  const viablePartnerHeroes = partnerRole
    ? getViableHeroesForRole(partnerRole, 0.3)
        .map((id) => getHeroById(id)!)
        .filter(Boolean)
        .sort((a, b) => a.localized_name.localeCompare(b.localized_name))
    : [];

  const matchupKey = getMatchupNoteKey(role, myHeroId, enemyHeroId, partnerId);

  // Matchup Data
  const matchup = getMatchup(myHeroId, enemyHeroId);
  const myTrait = traitsMap[String(myHeroId)];
  const enemyTrait = traitsMap[String(enemyHeroId)];

  // User Notes & Form state
  const existingNote: LaneMatchupNote | null = getLaneMatchupNote(role, myHeroId, enemyHeroId, partnerId);
  const legacySeedKey = `${myHeroId}_${enemyHeroId}`;
  const seedNote: SeedNote | undefined = role === 2 ? seedNotesMap[legacySeedKey] : undefined;

  const [notes, setNotes] = useState(existingNote?.notes ?? seedNote?.notes ?? "");
  const [skipTake, setSkipTake] = useState(existingNote?.skipTake ?? seedNote?.skipTake ?? "");
  const [runePlan, setRunePlan] = useState(existingNote?.runePlan ?? seedNote?.runePlan ?? "");
  const [keyItems, setKeyItems] = useState(existingNote?.keyItems ?? seedNote?.keyItems ?? "");
  const [mistakeToAvoid, setMistakeToAvoid] = useState(
    existingNote?.mistakeToAvoid ?? seedNote?.mistakeToAvoid ?? ""
  );
  const [personalSummary, setPersonalSummary] = useState<PersonalStatsSummary | null>(null);

  useEffect(() => {
    loadSummaryFromIDB().then((s) => {
      if (s) setPersonalSummary(s);
    });
  }, []);

  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  // Sync state when partner or note changes
  useEffect(() => {
    const n = getLaneMatchupNote(role, myHeroId, enemyHeroId, partnerId);
    if (n) {
      setNotes(n.notes ?? "");
      setSkipTake(n.skipTake ?? "");
      setRunePlan(n.runePlan ?? "");
      setKeyItems(n.keyItems ?? "");
      setMistakeToAvoid(n.mistakeToAvoid ?? "");
    } else {
      setNotes(seedNote?.notes ?? "");
      setSkipTake(seedNote?.skipTake ?? "");
      setRunePlan(seedNote?.runePlan ?? "");
      setKeyItems(seedNote?.keyItems ?? "");
      setMistakeToAvoid(seedNote?.mistakeToAvoid ?? "");
    }
  }, [role, myHeroId, enemyHeroId, partnerId, seedNote]);

  // Autosave handler
  const handleSaveNotes = () => {
    const notePayload: LaneMatchupNote = {
      role,
      myHeroId,
      enemyHeroId,
      lanePartnerId: partnerId,
      notes,
      skipTake,
      runePlan,
      keyItems,
      mistakeToAvoid,
      updatedAt: Date.now(),
    };
    saveLaneMatchupNote(notePayload);
    refresh();
    setSavedStatus("Saved");
    setTimeout(() => setSavedStatus(null), 2500);
  };

  // SRS card status
  const existingSRS: SRSEntry | undefined = state.srs[matchupKey] || state.srs[`${role}_${myHeroId}_${enemyHeroId}`];

  const handleToggleDrill = () => {
    if (existingSRS) {
      const nextSRS = { ...state.srs };
      delete nextSRS[matchupKey];
      delete nextSRS[`${role}_${myHeroId}_${enemyHeroId}`];
      state.srs = nextSRS;
      saveLaneMatchupNote({
        role,
        myHeroId,
        enemyHeroId,
        lanePartnerId: partnerId,
        notes,
        updatedAt: Date.now(),
      });
      refresh();
    } else {
      const entry = createSRSEntry(myHeroId, enemyHeroId, role, partnerId);
      saveRoleSRSEntry(entry);
      refresh();
    }
  };

  if (!myHero || !enemyHero) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-rose-400">Matchup not found</h1>
        <p className="text-xs text-slate-400">
          Provide query params ?role=2&me=HERO_ID&enemy=ENEMY_ID
        </p>
        <Link href={`/lane/${role}`} className="text-sm text-[var(--color-accent)] hover:underline">
          Return to {roleMeta.name} Matrix
        </Link>
      </div>
    );
  }

  const myAttr = ATTR_LABELS[myHero.primary_attr] || ATTR_LABELS.all;
  const enemyAttr = ATTR_LABELS[enemyHero.primary_attr] || ATTR_LABELS.all;

  const delta = matchup?.delta ?? 0;
  const adjWr = matchup?.adjWr ?? 0.5;
  const games = matchup?.games ?? 0;
  const deltaPct = (delta * 100).toFixed(1);

  // Role-specific tactical skeleton
  const tacticalPlan = generateRoleLanePlan(role, myHero, enemyHero, partnerHero);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/lane/${role}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-dim)] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {roleMeta.name} Matrix
        </Link>

        {/* Drill Toggle Button */}
        <Button
          size="sm"
          variant={existingSRS ? "primary" : "outline"}
          onClick={handleToggleDrill}
        >
          {existingSRS ? (
            <>
              <BookmarkCheck className="w-4 h-4 text-amber-300 mr-1.5" />
              <span>In {roleMeta.shortName} Drill (Box {existingSRS.box})</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-4 h-4 mr-1.5" />
              <span>Add to {roleMeta.shortName} Drill</span>
            </>
          )}
        </Button>
      </div>

      {/* Matchup Header Card */}
      <Card variant="raised" className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* My Hero (Left) */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <HeroPortrait
              src={myHero.img}
              alt={myHero.localized_name}
              size="lg"
              aspectRatio="video"
              glow
            />
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" size="sm">
                  My {roleMeta.shortName}
                </Badge>
                <Badge variant="outline" size="sm">
                  {myAttr.label}
                </Badge>
              </div>
              <h2 className="text-xl font-black text-white mt-1">{myHero.localized_name}</h2>
              <span className="text-xs text-[var(--color-text-dim)] capitalize">
                {myTrait?.dmgType || "mixed"} damage
              </span>
            </div>
          </div>

          {/* VS & Delta Stat Center Tile with Diagonal Split */}
          <div className="flex flex-col items-center justify-center relative shrink-0">
            {/* Diagonal split badge */}
            <div className="relative w-16 h-7 flex items-center justify-center mb-2 overflow-hidden rounded border border-white/10 shadow-lg">
              <div className="absolute inset-0 bg-[#0a0c0f]" />
              {/* Ally side tint */}
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  background: roleTheme.color,
                  clipPath: "polygon(0 0, 60% 0, 40% 100%, 0 100%)",
                }}
              />
              {/* Enemy side tint */}
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  background: oppTheme.color,
                  clipPath: "polygon(60% 0, 100% 0, 100% 100%, 40% 100%)",
                }}
              />
              <span className="relative z-10 font-dota font-black text-xs text-white tracking-widest drop-shadow">
                VS
              </span>
            </div>

            <div className="flex flex-col items-center justify-center px-6 py-2.5 rounded-xl bg-[#0a0c0f] border border-white/10 text-center shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                Matchup Delta
              </span>
              <div className="flex items-center gap-2 my-0.5">
                <span
                  className={`text-2xl font-black font-mono ${
                    delta > 0 ? "text-[#4fbf6b]" : delta < 0 ? "text-[#e05050]" : "text-slate-400"
                  }`}
                >
                  {delta > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>Adj WR: {(adjWr * 100).toFixed(1)}%</span>
                <span>•</span>
                <span>{games} games</span>
              </div>
            </div>
          </div>

          {/* Enemy Opponent Hero (Right) */}
          <div className="flex items-center justify-end gap-4 w-full md:w-auto text-right">
            <div>
              <div className="flex items-center justify-end gap-2">
                <Badge variant="outline" size="sm">
                  {enemyAttr.label}
                </Badge>
                <Badge variant="loss" size="sm">
                  Enemy {oppMeta.shortName}
                </Badge>
              </div>
              <h2 className="text-xl font-black text-white mt-1">{enemyHero.localized_name}</h2>
              <span className="text-xs text-[var(--color-text-dim)] capitalize">
                {enemyTrait?.dmgType || "mixed"} damage
              </span>
            </div>
            <HeroPortrait
              src={enemyHero.img}
              alt={enemyHero.localized_name}
              size="lg"
              aspectRatio="video"
            />
          </div>
        </div>

        {/* Lane Partner Picker for Duo Lanes (Pos 3, 4, 5) */}
        {partnerMeta && (
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--color-canvas)] p-3 rounded-xl border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-xs font-bold text-white">
                  Lane Partner ({partnerMeta.shortName} - {partnerMeta.name}):
                </span>
                <p className="text-[11px] text-[var(--color-text-dim)]">
                  Duo lane dynamics change creep equilibrium, kill setups, and trading plans.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={partnerId ? String(partnerId) : ""}
                onChange={(e) => setPartnerId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="py-1 text-xs"
              >
                <option value="">(Solo / No Partner Assigned)</option>
                {viablePartnerHeroes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.localized_name} ({partnerMeta.shortName})
                  </option>
                ))}
              </Select>

              {partnerHero && (
                <HeroPortrait
                  src={partnerHero.img}
                  alt={partnerHero.localized_name}
                  size="xs"
                  aspectRatio="video"
                />
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Personal Head-to-Head Record Banner with Win/Loss Pips */}
      {(() => {
        const personalMu = personalSummary?.matchupStats?.[role]?.[`${myHeroId}_${enemyHeroId}`];
        if (!personalMu || personalMu.games === 0) {
          return (
            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl p-3.5 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-[var(--color-text-dim)]">
                <BarChart2 className="w-4 h-4 text-slate-500" />
                <span>No personal matches recorded yet for Pos {role} {myHero.localized_name} vs {enemyHero.localized_name}.</span>
              </div>
              <Link href="/profile" className="text-amber-400 font-bold hover:underline shrink-0">
                Sync Matches in Profile →
              </Link>
            </div>
          );
        }

        const recentWins = personalMu.recentResults.filter((r) => r === "win").length;
        const isHot = recentWins >= 3;

        return (
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-black text-sm shrink-0">
                {personalMu.wins}W
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white font-mono">
                    Personal Record: {personalMu.wins}W - {personalMu.games - personalMu.wins}L
                  </span>
                  <Badge variant={personalMu.winRate >= 0.5 ? "win" : "loss"} size="sm">
                    {(personalMu.winRate * 100).toFixed(1)}% WR
                  </Badge>
                  <span className="text-[11px] font-mono text-[var(--color-text-dim)]">
                    (Smoothed: {(personalMu.smoothedWr * 100).toFixed(1)}%, Delta {(personalMu.smoothedDelta * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
                  Based on {personalMu.games} personal matches in Pos {role}.
                </div>
              </div>
            </div>

            {/* Win/Loss Pips */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--color-text-dim)] font-bold uppercase mr-1">
                  Last {personalMu.recentResults.length}:
                </span>
                {personalMu.recentResults.map((r, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black uppercase font-mono border ${
                      r === "win"
                        ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/60"
                        : "bg-rose-950/80 text-rose-400 border-rose-500/60"
                    }`}
                  >
                    {r === "win" ? "W" : "L"}
                  </span>
                ))}
              </div>

              <Badge variant={isHot ? "win" : "loss"} dot>
                {isHot ? "Hot Streak" : "Needs Drill"}
              </Badge>
            </div>
          </div>
        );
      })()}

      {/* Main Grid: Auto Lane Plan & User Playbook Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Auto-Generated Tactical Skeleton */}
        <div className="space-y-6">
          <Card variant="panel" className="p-5 space-y-4">
            <div className="border-b border-[var(--color-border)] pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Role Tactical Lane Plan
              </h3>
              <Badge variant="neutral" size="sm">
                AUTO-GENERATED
              </Badge>
            </div>

            <p className="text-xs text-slate-300 italic bg-[var(--color-canvas)] p-3 rounded-lg border border-[var(--color-border)]">
              {tacticalPlan.summary}
            </p>

            <div className="space-y-3 text-xs">
              {/* Priority Section */}
              <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                  {tacticalPlan.prioritySection.title}
                </h4>
                <p className="text-[var(--color-text-muted)] leading-relaxed">
                  {tacticalPlan.prioritySection.text}
                </p>
              </div>

              {/* Trading Section */}
              <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
                <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  {tacticalPlan.tradingSection.title}
                </h4>
                <p className="text-[var(--color-text-muted)] leading-relaxed">
                  {tacticalPlan.tradingSection.text}
                </p>
              </div>

              {/* Timing Section */}
              <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
                <h4 className="font-bold text-purple-400 uppercase tracking-wider text-[11px]">
                  {tacticalPlan.timingSection.title}
                </h4>
                <p className="text-[var(--color-text-muted)] leading-relaxed">
                  {tacticalPlan.timingSection.text}
                </p>
              </div>

              {/* Partner Synergy Section */}
              {tacticalPlan.partnerSection && (
                <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-800/40 space-y-1">
                  <h4 className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
                    {tacticalPlan.partnerSection.title}
                  </h4>
                  <p className="text-[var(--color-text-muted)] leading-relaxed">
                    {tacticalPlan.partnerSection.text}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: User Matchup Playbook (Markdown Autosaved) */}
        <div className="space-y-6">
          <Card variant="panel" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Save className="w-4 h-4 text-emerald-400" />
                  Your Matchup Playbook
                </h3>
                <span className="text-[11px] text-[var(--color-text-dim)]">
                  Autosaves on edit.
                </span>
              </div>

              {savedStatus && (
                <Badge variant="win" dot size="sm">
                  {savedStatus}
                </Badge>
              )}
            </div>

            <div className="space-y-3.5 text-xs">
              {/* General Strategy */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Lane Strategy & Notes (Markdown):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleSaveNotes}
                  rows={4}
                  placeholder={`What is your game plan as ${myHero.localized_name} against ${enemyHero.localized_name}?`}
                  className="w-full bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              {/* What to Skip / Take */}
              <Input
                label="Skill / Item Build (Skip vs Take):"
                type="text"
                value={skipTake}
                onChange={(e) => setSkipTake(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="e.g. Magic Stick mandatory, max spell Q first..."
              />

              {/* Rune / Pull Plan */}
              <Input
                label="Rune / Pull / Lotus Plan:"
                type="text"
                value={runePlan}
                onChange={(e) => setRunePlan(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="e.g. Pull at :15/:45, contest 3min Lotus Pool..."
              />

              {/* Key Items */}
              <Input
                label="Key Rush / Counter Items:"
                type="text"
                value={keyItems}
                onChange={(e) => setKeyItems(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="e.g. bkb, orchid, lotus_orb, force_staff..."
              />

              {/* The ONE Mistake to Avoid */}
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/50">
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  The ONE Mistake to Avoid:
                </label>
                <textarea
                  value={mistakeToAvoid}
                  onChange={(e) => setMistakeToAvoid(e.target.value)}
                  onBlur={handleSaveNotes}
                  rows={2}
                  placeholder="e.g. Never contest power rune without HP. Don't pull when wave is under tower."
                  className="w-full bg-[var(--color-canvas)] border border-rose-900/60 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-sans"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Item Timing Benchmarks & Counter Item Priorities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card variant="panel" className="p-5">
          <ItemTimingChart
            heroId={myHeroId}
            role={role}
            title={`Pos ${role} ${myHero.localized_name} Timing Benchmarks`}
          />
        </Card>

        <Card variant="panel" className="p-5">
          <ItemPriorityPanel
            candidateHero={myHero}
            enemyHeroIds={[enemyHeroId]}
          />
        </Card>
      </div>
    </div>
  );
}

export default function LaneMatchupPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-400">
          Loading matchup playbook...
        </div>
      }
    >
      <LaneMatchupDetailContent />
    </Suspense>
  );
}
