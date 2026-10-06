"use client";

import { useState, useEffect } from "react";
import {
  User,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Trophy,
  Flame,
  TrendingDown,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useUserState } from "@/lib/useUserState";
import { ALL_ROLES, ROLE_DEFINITIONS } from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { RolePosition, PersonalMatchRecord, PersonalStatsSummary } from "@/lib/types";
import {
  fetchOpenDotaMatches,
  loadMatchesFromIDB,
  loadSummaryFromIDB,
  saveMatchesToIDB,
  saveSummaryToIDB,
  aggregatePersonalStats,
  clearPersonalIDB,
  ImportProgress,
} from "@/lib/player-stats";
import { getHeroById } from "@/lib/heroes";
import { saveUserState } from "@/lib/storage";
import { ItemTimingChart } from "@/components/ItemTimingChart";
import { requestMatchParse } from "@/lib/benchmarks";
import { HeroPortrait } from "@/components/HeroPortrait";
import {
  Button,
  IconButton,
  Input,
  Badge,
  Progress,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  Select,
  useToast,
} from "@/components/ui";

export default function ProfilePage() {
  const { state, isLoaded, selectedRole, selectRole } = useUserState();
  const { toast } = useToast();

  const [accountId, setAccountId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<PersonalMatchRecord[]>([]);
  const [summary, setSummary] = useState<PersonalStatsSummary | null>(null);
  const [activeTabRole, setActiveTabRole] = useState<RolePosition>(selectedRole || 2);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync initial accountId from user state
  useEffect(() => {
    if (isLoaded && state.accountId) {
      setAccountId(state.accountId);
    }
  }, [isLoaded, state.accountId]);

  // Load matches and summary from IndexedDB
  useEffect(() => {
    async function loadIDBData() {
      try {
        const loadedMatches = await loadMatchesFromIDB();
        const loadedSummary = await loadSummaryFromIDB();
        setMatches(loadedMatches);
        if (loadedSummary) {
          setSummary(loadedSummary);
        } else if (loadedMatches.length > 0) {
          const recomputed = aggregatePersonalStats(loadedMatches, state.accountId);
          setSummary(recomputed);
        }
      } catch (err) {
        console.error("Failed to load IndexedDB personal stats:", err);
      }
    }
    loadIDBData();
  }, [state.accountId]);

  const handleSaveAccountId = (newId: string) => {
    setAccountId(newId);
    const updated = {
      ...state,
      accountId: newId.trim(),
    };
    saveUserState(updated);
  };

  const handleImport = async () => {
    if (!accountId.trim()) {
      setErrorMessage("Please enter a valid OpenDota Account ID.");
      return;
    }

    setErrorMessage(null);
    setIsImporting(true);
    setImportProgress({
      stage: "Connecting to OpenDota API...",
      current: 0,
      total: 100,
      percent: 5,
    });

    handleSaveAccountId(accountId);

    try {
      const result = await fetchOpenDotaMatches(accountId.trim(), {
        maxMatches: 300,
        onProgress: (p) => setImportProgress(p),
      });

      if (result.error) {
        setErrorMessage(result.error);
        setIsImporting(false);
        toast({ title: "Import Failed", description: result.error, variant: "error" });
        return;
      }

      setMatches(result.matches);
      const newSummary = aggregatePersonalStats(result.matches, accountId.trim());
      setSummary(newSummary);
      await saveSummaryToIDB(newSummary);
      toast({
        title: "Matches Synchronized",
        description: `Successfully loaded ${result.matches.length} matches.`,
        variant: "success",
      });
    } catch (err: any) {
      const msg = err.message || "Failed to import matches from OpenDota.";
      setErrorMessage(msg);
      toast({ title: "Import Error", description: msg, variant: "error" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleEditMatchRole = async (matchId: number, newRole: RolePosition) => {
    const updated = matches.map((m) =>
      m.matchId === matchId ? { ...m, role: newRole, userAssignedRole: true } : m
    );
    setMatches(updated);
    await saveMatchesToIDB(updated);
    const recomputed = aggregatePersonalStats(updated, accountId.trim());
    setSummary(recomputed);
    await saveSummaryToIDB(recomputed);
  };

  const handleClearData = async () => {
    await clearPersonalIDB();
    setMatches([]);
    setSummary(null);
    setShowClearConfirm(false);
    toast({ title: "Cache Cleared", description: "All local match records deleted." });
  };

  const [parseRequested, setParseRequested] = useState<Record<number, boolean>>({});

  const handleRequestParse = async (matchId: number) => {
    setParseRequested((prev) => ({ ...prev, [matchId]: true }));
    await requestMatchParse(matchId);
    toast({ title: "Parse Requested", description: `Match ${matchId} queued for parsing.` });
  };

  const currentRoleSummary = summary?.heroStats[activeTabRole] || {};
  const heroPerformanceList = Object.entries(currentRoleSummary).map(([idStr, s]) => {
    const heroId = parseInt(idStr, 10);
    const hero = getHeroById(heroId);
    return {
      heroId,
      hero,
      games: s.games,
      wins: s.wins,
      winRate: s.winRate,
    };
  });

  const topHeroForRole = [...heroPerformanceList].sort((a, b) => b.games - a.games)[0] || {
    heroId: 106,
    hero: getHeroById(106),
  };

  const heroesWithMinGames = heroPerformanceList.filter((h) => h.games >= 2);
  const bestHeroes = [...heroesWithMinGames].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
  const worstHeroes = [...heroesWithMinGames].sort((a, b) => a.winRate - b.winRate).slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Profile & Personal Match History
              </h1>
              <p className="text-xs text-[var(--color-text-dim)]">
                Local OpenDota synchronization, role-aware Bayesian smoothing & benchmarks.
              </p>
            </div>
          </div>
        </div>

        {matches.length > 0 && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowClearConfirm(true)}
            className="self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear Local Cache
          </Button>
        )}
      </div>

      {/* Account Configuration & Importer Card */}
      <Card variant="panel" className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 flex-1 max-w-lg">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Dota 2 Account ID (Friend ID)
            </label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. 86745912 (Your 32-bit Friend ID)"
            />
            <p className="text-[11px] text-[var(--color-text-dim)]">
              Ensure &apos;Expose Public Match Data&apos; is enabled in your Dota 2 Social settings. Data is cached locally in IndexedDB.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleImport}
              disabled={isImporting || !accountId.trim()}
              isLoading={isImporting}
              className="font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              {matches.length > 0 ? "Refresh Matches" : "Import Matches"}
            </Button>
          </div>
        </div>

        {/* Import Progress Bar */}
        {isImporting && importProgress && (
          <div className="space-y-1.5 pt-2 border-t border-[var(--color-border)]">
            <div className="flex justify-between text-xs font-mono text-[var(--color-text-dim)]">
              <span>{importProgress.stage}</span>
              <span className="text-amber-400 font-bold">{importProgress.percent}%</span>
            </div>
            <Progress value={importProgress.percent} variant="amber" size="sm" />
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Sync Error</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Coverage Stat Tiles */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)]">
            <div className="bg-[var(--color-canvas)] p-3.5 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-[var(--color-win)] shrink-0" />
              <div>
                <div className="text-xl font-black font-mono text-white">{summary.totalMatches}</div>
                <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider font-semibold">
                  Matches Imported
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-canvas)] p-3.5 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-amber-400 shrink-0" />
              <div>
                <div className="text-xl font-black font-mono text-white">{summary.parsedMatches}</div>
                <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider font-semibold">
                  Parsed Item Timing Logs
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-canvas)] p-3.5 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
              <Clock className="w-7 h-7 text-sky-400 shrink-0" />
              <div>
                <div className="text-xs font-mono font-bold text-white">
                  {new Date(summary.lastImportTime).toLocaleDateString()} {new Date(summary.lastImportTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider font-semibold">
                  Last Synchronized
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Role Distribution Grid */}
      {summary && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Role Distribution & Performance
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {ALL_ROLES.map((r) => {
              const meta = ROLE_DEFINITIONS[r];
              const theme = ROLE_THEME[r];
              const games = summary.roleGames[r] || 0;
              const roleHeroes = summary.heroStats[r] || {};
              const totalWins = Object.values(roleHeroes).reduce((sum, h) => sum + h.wins, 0);
              const wr = games > 0 ? (totalWins / games) * 100 : 0;
              const isSelected = activeTabRole === r;

              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveTabRole(r)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-[var(--color-raised)] border-[var(--color-accent)] shadow-md shadow-sky-500/10"
                      : "bg-[var(--color-panel)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-raised)]/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <RoleIcon role={r} size={15} active={isSelected} />
                    <span
                      className="text-xs font-bold"
                      style={{ color: isSelected ? theme.color : undefined }}
                    >
                      {meta.shortName}
                    </span>
                  </div>
                  <div className="text-xl font-black font-mono text-white">
                    {games} <span className="text-[10px] font-normal text-[var(--color-text-dim)]">games</span>
                  </div>
                  <div className="text-xs font-mono font-semibold mt-0.5">
                    {games > 0 ? (
                      <span className={wr >= 50 ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"}>
                        {wr.toFixed(1)}% WR
                      </span>
                    ) : (
                      <span className="text-slate-500">No data</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Role Hero Performance (Best & Worst) */}
      {summary && (
        <Card variant="panel" className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3.5">
            <div>
              <h2 className="text-base font-bold text-white">
                Pos {activeTabRole} ({ROLE_DEFINITIONS[activeTabRole].name}) Performance
              </h2>
              <p className="text-xs text-[var(--color-text-dim)]">
                Rankings require min 2 games in this position.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)]">
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveTabRole(r)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    activeTabRole === r
                      ? "bg-[var(--color-accent)] text-white shadow-sm"
                      : "text-[var(--color-text-dim)] hover:text-white"
                  }`}
                >
                  Pos {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Best Heroes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Flame className="w-4 h-4" /> Strongest Heroes (Pos {activeTabRole})
              </div>
              {bestHeroes.length > 0 ? (
                <div className="space-y-2">
                  {bestHeroes.map((item) => (
                    <div
                      key={item.heroId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <HeroPortrait src={item.hero?.img} alt={item.hero?.localized_name || ""} size="xs" aspectRatio="video" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            {item.hero?.localized_name || `Hero ${item.heroId}`}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-dim)] font-mono">
                            {item.wins}W - {item.games - item.wins}L ({item.games} matches)
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-black font-mono text-[var(--color-win)]">
                        {(item.winRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-center text-xs text-[var(--color-text-dim)]">
                  Not enough matches recorded for Pos {activeTabRole} (min 2 games).
                </div>
              )}
            </div>

            {/* Worst Heroes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                <TrendingDown className="w-4 h-4" /> Weakest Heroes (Pos {activeTabRole})
              </div>
              {worstHeroes.length > 0 ? (
                <div className="space-y-2">
                  {worstHeroes.map((item) => (
                    <div
                      key={item.heroId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <HeroPortrait src={item.hero?.img} alt={item.hero?.localized_name || ""} size="xs" aspectRatio="video" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            {item.hero?.localized_name || `Hero ${item.heroId}`}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-dim)] font-mono">
                            {item.wins}W - {item.games - item.wins}L ({item.games} matches)
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-black font-mono text-[var(--color-loss)]">
                        {(item.winRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-center text-xs text-[var(--color-text-dim)]">
                  Not enough matches recorded for Pos {activeTabRole} (min 2 games).
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Item Timing Benchmarks for Active Role */}
      {topHeroForRole && topHeroForRole.hero && (
        <Card variant="panel" className="p-5">
          <ItemTimingChart
            heroId={topHeroForRole.heroId}
            role={activeTabRole}
            title={`Pos ${activeTabRole} Item Timing Benchmarks (${topHeroForRole.hero.localized_name})`}
          />
        </Card>
      )}

      {/* Recent Matches Table */}
      {matches.length > 0 && (
        <Card variant="panel" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Recent Matches & Role Inferences
              </h2>
              <p className="text-xs text-[var(--color-text-dim)]">
                Inferred from lane role and laning partners. Adjust below if misclassified.
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--color-text-dim)]">
              Showing last {Math.min(matches.length, 30)} matches
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-text-dim)] font-bold border-b border-[var(--color-border)] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Hero</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Timings</th>
                  <th className="px-4 py-3 text-right">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {matches.slice(0, 30).map((m) => {
                  const hero = getHeroById(m.myHeroId);
                  const mins = Math.floor(m.duration / 60);
                  const secs = m.duration % 60;
                  const durStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

                  return (
                    <tr key={m.matchId} className="hover:bg-[var(--color-raised)]/50 transition-colors">
                      <td className="px-4 py-3 font-black">
                        <Badge variant={m.won ? "win" : "loss"} size="sm">
                          {m.won ? "WON" : "LOST"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <HeroPortrait src={hero?.img} alt={hero?.localized_name || ""} size="xs" aspectRatio="video" />
                          <span className="font-bold text-white">
                            {hero?.localized_name || `Hero ${m.myHeroId}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={String(m.role)}
                          onChange={(e) =>
                            handleEditMatchRole(m.matchId, parseInt(e.target.value, 10) as RolePosition)
                          }
                          aria-label={`Assign role for match ${m.matchId}`}
                          className="py-0.5 text-xs font-mono"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              Pos {r} - {ROLE_DEFINITIONS[r].shortName}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-dim)] font-mono">{durStr}</td>
                      <td className="px-4 py-3 text-[var(--color-text-dim)]">
                        {new Date(m.startTime * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {m.isParsed || (m.purchaseLog && m.purchaseLog.length > 0) ? (
                          <Badge variant="win" size="sm">
                            Parsed
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleRequestParse(m.matchId)}
                            disabled={parseRequested[m.matchId]}
                            className="text-amber-400 hover:text-amber-300 text-[10px] h-6 px-2"
                          >
                            {parseRequested[m.matchId] ? "Queued..." : "Request Parse"}
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`https://www.opendota.com/matches/${m.matchId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
                        >
                          {m.matchId} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmation Dialog for Clear Cache */}
      <Dialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Local Personal Cache?"
        description="This will permanently delete all imported match records and locally calculated statistics from IndexedDB."
      >
        <div className="flex items-center justify-end gap-3 pt-3">
          <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleClearData}>
            Confirm Clear
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
