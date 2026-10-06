"use client";

import { use, useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ALL_HEROES, getHeroById } from "@/lib/heroes";
import { useUserState } from "@/lib/useUserState";
import { getMatchup } from "@/lib/scoring";
import { getRecommendedCounterItems } from "@/lib/item-rules";
import {
  createSRSEntry,
  advanceSRS,
  failSRS,
  isDue,
  calculateSRSStats,
} from "@/lib/srs";
import { saveRoleSRSEntry, addGameLog, getMatchupNoteKey } from "@/lib/storage";
import { SRSEntry, PostGameLog, RolePosition, PersonalStatsSummary, WeakSpotEntry } from "@/lib/types";
import { loadSummaryFromIDB, computeWeakSpots } from "@/lib/player-stats";
import {
  ROLE_DEFINITIONS,
  ALL_ROLES,
  getPrimaryOpponentRole,
  getViableHeroesForRole,
  generateRoleLanePlan,
} from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { HeroPortrait } from "@/components/HeroPortrait";
import {
  Button,
  IconButton,
  SegmentedControl,
  Badge,
  Progress,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  Select,
  Kbd,
} from "@/components/ui";
import rawTraits from "@/data/traits.json";
import rawSeedNotes from "@/data/mid-notes.seed.json";
import {
  BrainCircuit,
  RotateCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Sparkles,
  Flame,
  ArrowRight,
  BookOpen,
  Plus,
  TrendingDown,
  Layers,
  History,
  X,
  Filter,
  AlertTriangle,
} from "lucide-react";

const traitsMap = rawTraits as Record<string, any>;
const seedNotesMap = rawSeedNotes as Record<string, any>;
import patchDiffData from "@/data/patch-diff.json";

type DrillTab = "flashcard" | "quiz" | "weak_spots";
type QuizType = "best_hero" | "first_item" | "lane_plan" | "utility_item";

export default function LaneDrillPage({ params }: { params: Promise<{ role: string }> }) {
  const resolvedParams = use(params);
  const paramRole = parseInt(resolvedParams.role, 10);
  const routeRole: RolePosition = ([1, 2, 3, 4, 5].includes(paramRole) ? paramRole : 2) as RolePosition;

  const { state, refresh, isLoaded } = useUserState();

  const [filterRole, setFilterRole] = useState<RolePosition | "all">(routeRole);
  const [activeTab, setActiveTab] = useState<DrillTab>("flashcard");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [quizType, setQuizType] = useState<QuizType>("best_hero");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);

  // Post-Game Log Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [logMyHero, setLogMyHero] = useState<number>(106);
  const [logEnemyHero, setLogEnemyHero] = useState<number>(11);
  const [logResult, setLogResult] = useState<"win" | "loss">("loss");
  const [logMistake, setLogMistake] = useState("");
  const [logTag, setLogTag] = useState("Laning trade error");

  const activeRoleMeta = filterRole !== "all" ? ROLE_DEFINITIONS[filterRole] : null;

  const [personalSummary, setPersonalSummary] = useState<PersonalStatsSummary | null>(null);

  useEffect(() => {
    loadSummaryFromIDB().then((s) => {
      if (s) setPersonalSummary(s);
    });
  }, []);

  const weakSpots = useMemo(() => {
    if (!personalSummary) return [];
    return computeWeakSpots(
      personalSummary,
      filterRole === "all" ? undefined : filterRole,
      3,
      0.45
    );
  }, [personalSummary, filterRole]);

  const handleDrillWeakSpot = (ws: WeakSpotEntry) => {
    const entry = createSRSEntry(ws.myHeroId, ws.enemyHeroId, ws.role);
    saveRoleSRSEntry(entry);
    refresh();
    setActiveTab("flashcard");
  };

  // Filter cards in SRS
  const srsEntries = useMemo(() => {
    const all = Object.values(state.srs);
    if (filterRole === "all") return all;
    return all.filter((e) => (e.role || 2) === filterRole);
  }, [state.srs, filterRole]);

  const dueEntries = useMemo(() => {
    return srsEntries.filter((e) => isDue(e));
  }, [srsEntries]);

  // Active deck to drill
  const activeDeck = dueEntries.length > 0 ? dueEntries : srsEntries;
  const currentEntry = activeDeck[currentCardIndex] || activeDeck[0];

  const currentRole = (currentEntry?.role || 2) as RolePosition;
  const currentRoleMeta = ROLE_DEFINITIONS[currentRole];
  const oppRoleMeta = ROLE_DEFINITIONS[getPrimaryOpponentRole(currentRole)];

  const myHero = currentEntry ? getHeroById(currentEntry.myHeroId) : null;
  const enemyHero = currentEntry ? getHeroById(currentEntry.enemyHeroId) : null;
  const partnerHero = currentEntry?.lanePartnerId ? getHeroById(currentEntry.lanePartnerId) : null;

  const matchupKey = currentEntry?.matchupKey || (currentEntry ? `${currentRole}_${currentEntry.myHeroId}_${currentEntry.enemyHeroId}` : "");
  const matchupData = currentEntry ? getMatchup(currentEntry.myHeroId, currentEntry.enemyHeroId) : null;
  const userNote = state.notes[matchupKey] || (currentRole === 2 ? seedNotesMap[`${currentEntry?.myHeroId}_${currentEntry?.enemyHeroId}`] : null) || null;

  // Generated Tactical Plan
  const tacticalPlan = useMemo(() => {
    if (!myHero || !enemyHero) return null;
    return generateRoleLanePlan(currentRole, myHero, enemyHero, partnerHero);
  }, [currentRole, myHero, enemyHero, partnerHero]);

  // Counter items
  const counterItems = useMemo(() => {
    if (!currentEntry || !myHero) return [];
    return getRecommendedCounterItems([currentEntry.enemyHeroId], myHero);
  }, [currentEntry, myHero]);

  // SRS Stats
  const srsStats = useMemo(() => {
    return calculateSRSStats(state.srs, filterRole);
  }, [state.srs, filterRole]);

  // Weakest Matchups
  const weakestMatchups = useMemo(() => {
    return srsEntries
      .map((entry) => {
        const m = getMatchup(entry.myHeroId, entry.enemyHeroId);
        return {
          entry,
          myHero: getHeroById(entry.myHeroId),
          enemyHero: getHeroById(entry.enemyHeroId),
          delta: m ? m.delta : 0,
          games: m ? m.games : 0,
          box: entry.box,
        };
      })
      .filter((item) => item.myHero && item.enemyHero)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5);
  }, [srsEntries]);

  // Handle flashcard recall rating
  const [feedbackEffect, setFeedbackEffect] = useState<"correct" | "wrong" | null>(null);

  const handleRateCard = (passed: boolean) => {
    if (!currentEntry) return;

    setFeedbackEffect(passed ? "correct" : "wrong");
    const nextEntry = passed ? advanceSRS(currentEntry) : failSRS(currentEntry);
    saveRoleSRSEntry(nextEntry);
    refresh();

    setTimeout(() => {
      setFeedbackEffect(null);
      setIsFlipped(false);
      if (currentCardIndex >= activeDeck.length - 1) {
        setCurrentCardIndex(0);
      } else {
        setCurrentCardIndex((prev) => prev + 1);
      }
    }, 380);
  };

  // Bootstrap starter cards
  const handleBootstrapDeck = () => {
    const oppRole = getPrimaryOpponentRole(routeRole);
    const myViables = getViableHeroesForRole(routeRole, 0.4).slice(0, 3);
    const oppViables = getViableHeroesForRole(oppRole, 0.4).slice(0, 3);

    for (const mId of myViables) {
      for (const eId of oppViables) {
        saveRoleSRSEntry(createSRSEntry(mId, eId, routeRole));
      }
    }
    refresh();
  };

  // Quiz Question Generation
  const quizQuestion = useMemo(() => {
    if (!currentEntry || !myHero || !enemyHero) return null;

    if (quizType === "best_hero") {
      const rolePoolHeroes = Object.values(state.rolePool?.[currentRole] || {})
        .filter((p) => p.inPool)
        .map((p) => getHeroById(p.heroId)!)
        .filter(Boolean);

      const candidates = rolePoolHeroes.length >= 4 ? rolePoolHeroes : ALL_HEROES.slice(0, 25);
      const shuffled = [...candidates].sort(() => 0.5 - Math.random()).slice(0, 4);

      let bestHero = shuffled[0];
      let bestDelta = -999;
      for (const cand of shuffled) {
        const m = getMatchup(cand.id, enemyHero.id);
        const d = m ? m.delta : 0;
        if (d > bestDelta) {
          bestDelta = d;
          bestHero = cand;
        }
      }

      return {
        prompt: `Enemy ${oppRoleMeta.shortName} is ${enemyHero.localized_name}. Which of your ${currentRoleMeta.shortName} heroes has the highest statistical delta?`,
        options: shuffled.map((h) => ({
          hero: h,
          label: h.localized_name,
          isCorrect: h.id === bestHero.id,
          explanation: `Delta vs ${enemyHero.localized_name}: ${((getMatchup(h.id, enemyHero.id)?.delta || 0) * 100).toFixed(1)}%`,
        })),
      };
    }

    if (quizType === "first_item" || quizType === "utility_item") {
      const topItems = counterItems.slice(0, 4);
      if (topItems.length > 0) {
        const correct = topItems[0];
        const dummyItems = [
          { name: "Heart of Tarrasque", reason: "Standard HP pool" },
          { name: "Bloodstone", reason: "Spell lifesteal" },
          { name: "Daedalus", reason: "Raw critical strike" },
        ];
        const opts = [
          { label: correct.name, isCorrect: true, explanation: correct.reason },
          ...dummyItems.map((d) => ({ label: d.name, isCorrect: false, explanation: d.reason })),
        ].sort(() => 0.5 - Math.random());

        return {
          prompt: `You are playing ${myHero.localized_name} against ${enemyHero.localized_name}. What is your highest-priority item adaptation?`,
          options: opts,
        };
      }
    }

    // Lane Plan Quiz
    return {
      prompt: `In the ${currentRoleMeta.name} matchup of ${myHero.localized_name} vs ${enemyHero.localized_name}, what is the primary tactical objective?`,
      options: [
        {
          label: tacticalPlan?.prioritySection.text.slice(0, 80) + "...",
          isCorrect: true,
          explanation: tacticalPlan?.prioritySection.text || "Primary lane plan",
        },
        {
          label: "Ignore creep equilibrium and continuously shove waves under enemy tower.",
          isCorrect: false,
          explanation: "Never push without purpose against strong lane opponents.",
        },
        {
          label: "Avoid contesting power runes, lotus pool, or small camps regardless of vision.",
          isCorrect: false,
          explanation: "Yielding all lane objectives guarantees an enemy advantage.",
        },
      ].sort(() => 0.5 - Math.random()),
    };
  }, [currentEntry, myHero, enemyHero, quizType, counterItems, currentRole, currentRoleMeta, oppRoleMeta, tacticalPlan, state.rolePool]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab === "quiz" && !quizAnswered && quizQuestion) {
        const keyNum = parseInt(e.key, 10);
        if (keyNum >= 1 && keyNum <= quizQuestion.options.length) {
          e.preventDefault();
          setSelectedOption(keyNum - 1);
          setQuizAnswered(true);
        }
      } else if (activeTab === "flashcard") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setIsFlipped((f) => !f);
        } else if (isFlipped && (e.key === "1" || e.key === "ArrowLeft")) {
          e.preventDefault();
          handleRateCard(false);
        } else if (isFlipped && (e.key === "2" || e.key === "ArrowRight")) {
          e.preventDefault();
          handleRateCard(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, quizAnswered, quizQuestion, isFlipped, currentEntry]);

  // Post-game loss submission
  const handleSaveGameLog = () => {
    const log: PostGameLog = {
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      role: routeRole,
      myHeroId: logMyHero,
      enemyHeroId: logEnemyHero,
      result: logResult,
      whatWentWrong: logMistake,
      tag: logTag,
    };
    addGameLog(log);
    refresh();
    setShowLogModal(false);
    setLogMistake("");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <BrainCircuit className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Drill & Spaced Repetition Trainer
            </h1>
            <Badge variant="outline" size="sm">
              5-Box Leitner SRS
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-dim)] mt-1">
            Drill lane plans, counter-items, and matchup dynamics until memorized.
          </p>
        </div>

        {/* Post Game Log Button */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowLogModal(true)}
            className="border-rose-500/30 text-rose-300 hover:bg-rose-950/30"
          >
            <History className="w-3.5 h-3.5 mr-1 text-rose-400" />
            + Post-Game Log
          </Button>
        </div>
      </div>

      {/* Role Filter Selector */}
      <div className="flex items-center justify-between bg-[var(--color-panel)] p-2.5 rounded-xl border border-[var(--color-border)] flex-wrap gap-2 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-[var(--color-text-dim)] px-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterRole("all")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              filterRole === "all"
                ? "bg-[var(--color-accent)] text-white shadow-sm"
                : "text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-raised)]"
            }`}
          >
            All Roles
          </button>
          {ALL_ROLES.map((r) => {
            const meta = ROLE_DEFINITIONS[r];
            const theme = ROLE_THEME[r];
            const isSelected = filterRole === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? "border-[var(--color-border-hover)] bg-[var(--color-raised)] text-white shadow-sm"
                    : "border-transparent text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-raised)]"
                }`}
              >
                <RoleIcon role={r} size={14} active={isSelected} />
                <span style={{ color: isSelected ? theme.color : undefined }}>
                  {meta.shortName}
                </span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-[var(--color-text-dim)] font-mono pr-2">
          {srsEntries.length} cards • {dueEntries.length} due
        </span>
      </div>

      {/* Header Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="panel" className="p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-dim)] tracking-wider block">
            Due Today
          </span>
          <span className={`text-2xl font-black font-mono mt-0.5 block ${srsStats.dueToday > 0 ? "text-[var(--color-loss)]" : "text-slate-400"}`}>
            {srsStats.dueToday}
          </span>
        </Card>
        <Card variant="panel" className="p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-dim)] tracking-wider block">
            Memorized (Box 4+)
          </span>
          <span className="text-2xl font-black font-mono text-[var(--color-win)] mt-0.5 block">
            {srsStats.memorized}
          </span>
        </Card>
        <Card variant="panel" className="p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-dim)] tracking-wider block">
            Active Streak
          </span>
          <span className="text-2xl font-black font-mono text-amber-400 mt-0.5 block">
            {srsStats.averageStreak}
          </span>
        </Card>
        <Card variant="panel" className="p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-dim)] tracking-wider block">
            Deck Size
          </span>
          <span className="text-2xl font-black font-mono text-sky-400 mt-0.5 block">
            {srsStats.totalCards}
          </span>
        </Card>
      </div>

      {/* Progress Bar of Current Drill Session */}
      {activeDeck.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)] font-mono">
            <span>Session Progress</span>
            <span>Card {currentCardIndex + 1} of {activeDeck.length}</span>
          </div>
          <Progress
            value={((currentCardIndex + 1) / activeDeck.length) * 100}
            variant="purple"
            size="sm"
          />
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <SegmentedControl
          options={[
            { value: "flashcard", label: `Flashcards (${activeDeck.length})` },
            { value: "quiz", label: "Interactive Quiz" },
            { value: "weak_spots", label: `Weak Spots (${weakSpots.length})` },
          ]}
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val as DrillTab);
            setSelectedOption(null);
            setQuizAnswered(false);
          }}
          size="sm"
        />

        {activeTab === "quiz" && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--color-text-dim)] text-[11px]">Type:</span>
            <Select
              value={quizType}
              onChange={(e) => {
                setQuizType(e.target.value as QuizType);
                setSelectedOption(null);
                setQuizAnswered(false);
              }}
              className="py-1 text-xs"
            >
              <option value="best_hero">Best Counter Hero</option>
              <option value="first_item">Key Item Priority</option>
              <option value="lane_plan">Tactical Lane Plan</option>
              <option value="utility_item">Support Utility Item</option>
            </Select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeDeck.length === 0 ? (
        <Card variant="panel" className="p-12 text-center space-y-4">
          <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No Matchup Cards in Deck</h3>
            <p className="text-xs text-[var(--color-text-dim)] max-w-md mx-auto mt-1">
              Add matchups to your drill from any lane matchup page, or auto-populate starter matchups.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleBootstrapDeck}
          >
            + Auto-Populate Starter Deck for {activeRoleMeta?.shortName || "Current Role"}
          </Button>
        </Card>
      ) : activeTab === "flashcard" ? (
        /* Focused Flashcard View with 3D Rotate */
        <div className="space-y-6">
          <div className="perspective-1000 w-full min-h-[460px]">
            <div
              className={`w-full min-h-[460px] preserve-3d transition-transform duration-300 relative rounded-2xl ${
                isFlipped ? "rotate-y-180" : ""
              } ${
                feedbackEffect === "correct"
                  ? "animate-gold-pulse ring-2 ring-[#d8b57a]"
                  : feedbackEffect === "wrong"
                  ? "animate-red-shake ring-2 ring-[#e05050]"
                  : ""
              }`}
            >
              {/* FRONT OF CARD */}
              <Card
                variant="raised"
                onClick={() => setIsFlipped(true)}
                className="absolute inset-0 backface-hidden p-8 flex flex-col justify-between cursor-pointer hover:border-[#d8b57a]/50 shadow-2xl select-none border-white/10 bg-[#12151a]"
              >
                {/* Top Indicator Strip */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {currentRoleMeta.shortName}
                    </Badge>
                    <span>Card {currentCardIndex + 1} of {activeDeck.length}</span>
                    {currentEntry &&
                      patchDiffData.matchupDiffs?.some(
                        (d: any) => d.myHeroId === currentEntry.myHeroId && d.enemyHeroId === currentEntry.enemyHeroId
                      ) && (
                        <Badge variant="neutral" size="sm">
                          Patch Delta Swing
                        </Badge>
                      )}
                  </span>

                  {/* Leitner Box Indicator (1-5) */}
                  <div className="flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-lg bg-[#0a0c0f] border border-white/10">
                    <span className="font-bold text-white">Box {currentEntry?.box || 1}</span>
                    <span className="text-slate-500">/ 5</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[#d8b57a] font-bold">{currentEntry?.streak || 0} streak</span>
                  </div>
                </div>

                {/* Front Matchup Presentation */}
                <div className="flex flex-col items-center justify-center py-6 space-y-6 text-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400 font-dota">
                    You are playing {currentRoleMeta.name}:
                  </span>

                  <div className="flex items-center justify-center gap-8">
                    {/* My Hero */}
                    {myHero && (
                      <div className="flex flex-col items-center gap-2">
                        <HeroPortrait
                          src={myHero.img}
                          alt={myHero.localized_name}
                          size="lg"
                          aspectRatio="video"
                          glow
                        />
                        <span className="text-base font-black text-white font-dota">{myHero.localized_name}</span>
                      </div>
                    )}

                    <span className="text-2xl font-black text-[#e05050] italic font-dota">VS</span>

                    {/* Enemy Hero */}
                    {enemyHero && (
                      <div className="flex flex-col items-center gap-2">
                        <HeroPortrait
                          src={enemyHero.img}
                          alt={enemyHero.localized_name}
                          size="lg"
                          aspectRatio="video"
                        />
                        <span className="text-base font-black text-white font-dota">{enemyHero.localized_name}</span>
                      </div>
                    )}
                  </div>

                  {partnerHero && (
                    <Badge variant="info" size="sm">
                      Lane Partner: {partnerHero.localized_name}
                    </Badge>
                  )}
                </div>

                {/* Bottom Actions with Keyboard Hint Chips */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Click card or press</span>
                    <Kbd size="xs">Space</Kbd>
                    <span>to flip and reveal strategy</span>
                  </div>
                  <span className="text-[#d8b57a] font-bold text-xs">Reveal Card →</span>
                </div>
              </Card>

              {/* BACK OF CARD */}
              <Card
                variant="raised"
                className="absolute inset-0 backface-hidden rotate-y-180 p-8 flex flex-col justify-between shadow-2xl select-none border-white/10 bg-[#12151a]"
              >
                {/* Top Indicator Strip */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {currentRoleMeta.shortName}
                    </Badge>
                    <span className="font-bold text-white">{myHero?.localized_name} vs {enemyHero?.localized_name}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsFlipped(false)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>Flip Front</span>
                    <Kbd size="xs">Space</Kbd>
                  </button>
                </div>

                {/* Back Revealed Strategy */}
                <div className="py-2 space-y-3.5 text-xs overflow-y-auto max-h-[270px] custom-scrollbar pr-1">
                  {tacticalPlan && (
                    <div className="p-3.5 rounded-xl bg-[#0a0c0f] border border-white/5 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-[#d8b57a] font-dota">Tactical Objective:</span>
                      <p className="text-slate-200 leading-relaxed">{tacticalPlan.prioritySection.text}</p>
                    </div>
                  )}

                  {userNote?.notes && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-[#4fbf6b] font-dota">Personal Playbook:</span>
                      <p className="text-slate-200 leading-relaxed">{userNote.notes}</p>
                    </div>
                  )}

                  {userNote?.mistakeToAvoid && (
                    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/60 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-[#e05050] font-dota">ONE Mistake to Avoid:</span>
                      <p className="text-rose-200 font-medium leading-relaxed">{userNote.mistakeToAvoid}</p>
                    </div>
                  )}

                  {counterItems.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#1a1e25] border border-white/10 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#00d9ff] font-dota">Core Counter Items:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {counterItems.slice(0, 3).map((item) => (
                          <span key={item.key} className="px-2.5 py-0.5 rounded bg-[#0a0c0f] border border-white/10 text-[11px] text-white font-bold">
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions with Keyboard Hint Chips */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <span className="text-[11px] text-slate-400">Rate your recall:</span>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="danger"
                      size="md"
                      onClick={() => handleRateCard(false)}
                      className="font-bold flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Forgot (Box 1)</span>
                      <Kbd size="xs">1</Kbd>
                    </Button>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleRateCard(true)}
                      className="font-bold flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mastered (+1 Box)</span>
                      <Kbd size="xs">2</Kbd>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : activeTab === "quiz" ? (
        /* Interactive Quiz View */
        <div className="space-y-6">
          {quizQuestion && (
            <Card variant="raised" className="p-8 space-y-6 shadow-xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Multiple Choice Drill Question:
                </span>
                <h3 className="text-base font-bold text-white mt-1 leading-snug">
                  {quizQuestion.prompt}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {quizQuestion.options.map((opt, i) => {
                  const isChosen = selectedOption === i;
                  let style = "bg-[var(--color-canvas)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-slate-200";

                  if (quizAnswered) {
                    if (opt.isCorrect) {
                      style = "bg-emerald-950/60 border-emerald-500 text-emerald-200";
                    } else if (isChosen) {
                      style = "bg-rose-950/60 border-rose-500 text-rose-200";
                    } else {
                      style = "opacity-50 border-[var(--color-border)] bg-[var(--color-canvas)]";
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={quizAnswered}
                      type="button"
                      onClick={() => {
                        setSelectedOption(i);
                        setQuizAnswered(true);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${style}`}
                    >
                      <kbd className="w-6 h-6 rounded-lg bg-black/40 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {i + 1}
                      </kbd>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold block">{opt.label}</span>
                        {quizAnswered && opt.explanation && (
                          <span className="text-[11px] opacity-80 block mt-1">{opt.explanation}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {quizAnswered && (
                <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                  <span className="text-xs font-bold text-slate-300">
                    {quizQuestion.options[selectedOption!]?.isCorrect ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Correct answer!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> Incorrect. Check the explanation above.
                      </span>
                    )}
                  </span>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedOption(null);
                      setQuizAnswered(false);
                      if (currentCardIndex >= activeDeck.length - 1) {
                        setCurrentCardIndex(0);
                      } else {
                        setCurrentCardIndex((c) => c + 1);
                      }
                    }}
                  >
                    Next Question
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      ) : (
        /* Weak Spots View */
        <div className="space-y-6">
          <Card variant="panel" className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
              <div>
                <h2 className="text-base font-black text-rose-400 uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  Personal Weak Spots ({weakSpots.length})
                </h2>
                <p className="text-xs text-[var(--color-text-dim)]">
                  Matchups where smoothed win rate &lt; 45% (min 3 games) or high failure rate, ranked by loss impact.
                </p>
              </div>

              <Link
                href="/profile"
                className="self-start sm:self-auto text-xs font-bold text-amber-400 hover:underline"
              >
                Sync Matches in Profile →
              </Link>
            </div>

            {weakSpots.length === 0 ? (
              <div className="p-8 text-center bg-[var(--color-canvas)] rounded-xl border border-[var(--color-border)] space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-slate-200">No Critical Weak Spots Detected</p>
                <p className="text-xs text-[var(--color-text-dim)] max-w-md mx-auto">
                  Import matches in your Profile to automatically identify and prioritize difficult matchups.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weakSpots.map((ws, idx) => {
                  const myH = getHeroById(ws.myHeroId);
                  const enemyH = getHeroById(ws.enemyHeroId);
                  const roleMeta = ROLE_DEFINITIONS[ws.role];

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[var(--color-canvas)] border border-rose-950/60 hover:border-rose-700/80 transition-all flex flex-col justify-between gap-4 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <HeroPortrait src={myH?.img} alt={myH?.localized_name || ""} size="xs" aspectRatio="video" />
                          <span className="text-xs font-black text-white">{myH?.localized_name}</span>
                          <span className="text-xs text-slate-500 font-bold">vs</span>
                          <HeroPortrait src={enemyH?.img} alt={enemyH?.localized_name || ""} size="xs" aspectRatio="video" />
                          <span className="text-xs font-black text-rose-300">{enemyH?.localized_name}</span>
                        </div>

                        <Badge variant="loss" size="sm">
                          Pos {ws.role}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-[var(--color-panel)] p-2.5 rounded-lg border border-[var(--color-border)] text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Record</span>
                          <span className="font-mono font-bold text-rose-400">{ws.wins}W - {ws.losses}L</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Smoothed WR</span>
                          <span className="font-mono font-bold text-rose-400">{(ws.smoothedWr * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Loss Score</span>
                          <span className="font-mono font-bold text-amber-400">{ws.score.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Link
                          href={`/lane/${ws.role}/${ws.myHeroId}/${ws.enemyHeroId}`}
                          className="text-xs text-[var(--color-accent)] hover:underline font-bold"
                        >
                          View Lane Playbook →
                        </Link>

                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => handleDrillWeakSpot(ws)}
                        >
                          Drill Now
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Weakest Matchups Section */}
      {weakestMatchups.length > 0 && (
        <Card variant="panel" className="p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            Weakest Matchups in SRS Deck
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {weakestMatchups.map((w, idx) => (
              <Link
                key={idx}
                href={`/lane/${w.entry.role || 2}/${w.entry.myHeroId}/${w.entry.enemyHeroId}`}
                className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] hover:border-rose-500/60 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <HeroPortrait src={w.myHero!.img} alt={w.myHero!.localized_name} size="xs" aspectRatio="video" />
                  <span className="text-xs font-bold text-white">vs {w.enemyHero!.localized_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-rose-400">
                    {(w.delta * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[var(--color-text-dim)] block">Box {w.box}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Post Game Log Dialog */}
      <Dialog
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Post-Game Matchup Logger"
        description="Record a recent match. Losses automatically reset the matchup card to Box 1."
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Select
                label="My Hero:"
                value={logMyHero}
                onChange={(e) => setLogMyHero(parseInt(e.target.value, 10))}
              >
                {ALL_HEROES.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.localized_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Enemy Opponent:"
                value={logEnemyHero}
                onChange={(e) => setLogEnemyHero(parseInt(e.target.value, 10))}
              >
                {ALL_HEROES.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.localized_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-[var(--color-text-dim)] font-bold mb-1">Match Outcome:</label>
            <div className="flex items-center gap-2">
              <Button
                variant={logResult === "win" ? "primary" : "outline"}
                size="sm"
                onClick={() => setLogResult("win")}
                className="flex-1"
              >
                Won Game
              </Button>
              <Button
                variant={logResult === "loss" ? "danger" : "outline"}
                size="sm"
                onClick={() => setLogResult("loss")}
                className="flex-1"
              >
                Lost (Resets to Box 1)
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-[var(--color-text-dim)] font-bold mb-1">What Went Wrong / Lane Mistake:</label>
            <textarea
              value={logMistake}
              onChange={(e) => setLogMistake(e.target.value)}
              rows={2}
              placeholder="e.g. Took bad level 2 trade, missed 4min water rune..."
              className="w-full bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-2 text-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleSaveGameLog}
            >
              Save Log
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
