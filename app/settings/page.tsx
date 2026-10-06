"use client";

import { useState } from "react";
import { useUserState } from "@/lib/useUserState";
import { exportStateAsJson, importStateFromJson, resetState, updateSettings } from "@/lib/storage";
import { ALL_ROLES, ROLE_DEFINITIONS } from "@/lib/roles";
import { RoleIcon, ROLE_THEME } from "@/components/icons/RoleIcon";
import { RolePosition } from "@/lib/types";
import {
  Button,
  IconButton,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  Select,
  Toggle,
  useToast,
} from "@/components/ui";
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Shield,
  Layers,
  Copy,
} from "lucide-react";

export default function SettingsPage() {
  const { state, refresh, selectRole } = useUserState();
  const { toast } = useToast();
  const [importJsonText, setImportJsonText] = useState("");
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExportDownload = () => {
    const jsonStr = exportStateAsJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matchspell-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup Exported", description: "Downloaded backup JSON file.", variant: "success" });
  };

  const handleExportCopy = () => {
    const jsonStr = exportStateAsJson();
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    toast({ title: "Copied", description: "User data JSON copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    if (!importJsonText.trim()) return;
    const res = importStateFromJson(importJsonText);
    if (res.success) {
      setImportStatus({ success: true, message: "User data imported and restored successfully!" });
      setImportJsonText("");
      refresh();
      toast({ title: "Data Restored", description: "Successfully restored backup data.", variant: "success" });
    } else {
      setImportStatus({ success: false, message: res.error || "Failed to parse JSON" });
      toast({ title: "Import Error", description: res.error || "Failed to parse JSON", variant: "error" });
    }
  };

  const handleReset = () => {
    resetState();
    refresh();
    setShowResetConfirm(false);
    setImportStatus({ success: true, message: "State reset to defaults." });
    toast({ title: "State Reset", description: "All pools, notes, and drill cards reset to default." });
  };

  const handleBracketChange = (bracket: string) => {
    updateSettings({ bracket });
    refresh();
  };

  const handleDefaultRoleChange = (role: RolePosition) => {
    selectRole(role);
    refresh();
  };

  const handleTogglePersonalTerm = (enabled: boolean) => {
    updateSettings({ personalTermEnabled: enabled });
    refresh();
  };

  const handlePersonalWeightChange = (weight: number) => {
    updateSettings({ wPersonal: weight });
    refresh();
  };

  const handleBlendRatioChange = (ratio: number) => {
    updateSettings({ blendRatio: ratio });
    refresh();
  };

  const personalEnabled = state.settings?.personalTermEnabled !== false;
  const currentWeight = state.settings?.wPersonal ?? 0.25;
  const currentBlend = state.settings?.blendRatio ?? 0.50;
  const currentRole = (state.settings?.selectedRole as RolePosition) || 2;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div className="border-b border-[var(--color-border)] pb-5">
        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-sky-400" />
          Settings & Preferences
        </h1>
        <p className="text-xs text-[var(--color-text-dim)] mt-1">
          Configure default position, rank bracket, personal stats weighting, and manage backup data.
        </p>
      </div>

      {/* Role & Bracket Preferences */}
      <Card variant="panel" className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Default Role & Rank Bracket
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Role */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Default Active Position
            </label>
            <p className="text-xs text-[var(--color-text-dim)]">
              Initial role selected on application launch and global trainer navigation.
            </p>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {ALL_ROLES.map((r) => {
                const meta = ROLE_DEFINITIONS[r];
                const theme = ROLE_THEME[r];
                const isSelected = currentRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleDefaultRoleChange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? "border-[var(--color-border-hover)] bg-[var(--color-raised)] text-white shadow-sm"
                        : "border-transparent bg-[var(--color-canvas)] text-[var(--color-text-dim)] hover:text-white"
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
          </div>

          {/* Default Rank Bracket */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Default Rank Bracket
            </label>
            <p className="text-xs text-[var(--color-text-dim)]">
              Baseline statistics prioritize hero performance in this MMR bracket.
            </p>
            <Select
              value={state.settings.bracket}
              onChange={(e) => handleBracketChange(e.target.value)}
              options={[
                { value: "8", label: "Divine / Immortal (Rank 8)" },
                { value: "7", label: "Ancient (Rank 7)" },
                { value: "6", label: "Legend (Rank 6)" },
                { value: "all", label: "All Brackets Combined" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Personal Stats & Draft Weighting Engine */}
      <Card variant="panel" className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Draft Helper Personal Terms & Blend
          </h2>
        </div>

        <div className="space-y-4">
          {/* Toggle Personal Term */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)]">
            <div>
              <span className="text-xs font-bold text-white block">
                Include Personal Match History Term in Draft Scoring
              </span>
              <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
                Factor in your personal Bayesian smoothed head-to-head win rate (K=10).
              </p>
            </div>
            <Toggle
              checked={personalEnabled}
              onChange={handleTogglePersonalTerm}
            />
          </div>

          {/* Personal Weight Slider */}
          <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Personal History Weight (wPersonal)
              </span>
              <span className="font-mono text-xs text-amber-400 font-bold">
                {currentWeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.50"
              step="0.05"
              value={currentWeight}
              onChange={(e) => handlePersonalWeightChange(parseFloat(e.target.value))}
              disabled={!personalEnabled}
              className="w-full accent-amber-500 disabled:opacity-40 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-text-dim)] font-mono">
              <span>0.10 (Subtle)</span>
              <span>0.25 (Default Recommended)</span>
              <span>0.50 (Aggressive)</span>
            </div>
          </div>

          {/* Blend Ratio */}
          <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Matrix Cell Blend Ratio (My Stats vs Global Meta)
              </span>
              <span className="font-mono text-xs text-purple-400 font-bold">
                {Math.round(currentBlend * 100)}% Personal / {Math.round((1 - currentBlend) * 100)}% Meta
              </span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.05"
              value={currentBlend}
              onChange={(e) => handleBlendRatioChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-text-dim)] font-mono">
              <span>20% Personal</span>
              <span>50% Balanced</span>
              <span>80% Personal</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Export / Import Section */}
      <Card variant="panel" className="p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Export & Import User Data (v2 Schema)
          </h2>
          <p className="text-xs text-[var(--color-text-dim)] mt-1">
            Back up your hero pools (pos 1-5), comfort ratings, spaced-repetition cards, matchup notes, and match history.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportDownload}
            className="font-bold"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download Backup JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCopy}
          >
            {copied ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied to Clipboard!" : "Copy JSON"}
          </Button>
        </div>

        {/* Import JSON */}
        <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
          <label className="block text-xs font-semibold text-slate-300">
            Import Backup JSON:
          </label>
          <textarea
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Paste your exported v1 or v2 JSON here..."
            rows={4}
            className="w-full bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
          />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={!importJsonText.trim()}
              className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/20"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Restore Data
            </Button>
            {importStatus && (
              <span
                className={`text-xs font-medium flex items-center gap-1 ${
                  importStatus.success ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {importStatus.message}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Static Data Status & Update Instructions */}
      <Card variant="panel" className="p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-400" />
          Data Pipeline Information
        </h2>
        <p className="text-xs text-[var(--color-text-dim)] leading-relaxed">
          MatchSpell reads static precomputed JSON data from <code className="bg-[var(--color-canvas)] px-1.5 py-0.5 rounded text-sky-400 font-mono">/data</code>. Personal OpenDota stats syncing on the Profile page is the single runtime client-side exception.
        </p>
        <div className="bg-[var(--color-canvas)] rounded-lg p-3 border border-[var(--color-border)] text-xs text-[var(--color-text-dim)] space-y-1 font-mono">
          <div><strong className="text-slate-200">Heroes loaded:</strong> 127 heroes (Pos 1–5 suitability mapped)</div>
          <div><strong className="text-slate-200">Update data:</strong> <code className="text-amber-400">npm run data:update</code> (snapshots previous data)</div>
          <div><strong className="text-slate-200">Diff patches:</strong> <code className="text-sky-400">npm run data:diff</code> (compares against snapshot)</div>
        </div>
      </Card>

      {/* Danger Zone: Reset */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h2>
        <p className="text-xs text-[var(--color-text-dim)]">
          Reset all stored pools, notes, and drill cards back to clean state.
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowResetConfirm(true)}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Reset All Data
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset All Application Data?"
        description="Are you sure you want to reset all your pools, notes, and SRS data? This cannot be undone."
      >
        <div className="flex items-center justify-end gap-3 pt-3">
          <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleReset}>
            Confirm Reset
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
