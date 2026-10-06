# MatchSpell v2 - Role-Aware Dota 2 Draft & Lane Trainer

**MatchSpell v2** is a personal, role-aware competitive toolkit for Dota 2 players. Built for competitive players across **all five positions** (Pos 1 Safe Lane Carry, Pos 2 Mid, Pos 3 Offlane, Pos 4 Soft Support, Pos 5 Hard Support) with personal match data synchronization, item timing benchmarks, patch diff tracking, and ally synergy drafting.

Scope remains strictly **draft + itemization**. No gameplay mechanics content.

---

## What's New in v2

### 1. Global Multi-Role Architecture (Pos 1–5)
- **Top Nav Role Switcher:** Fast toggling between Pos 1–5 with persistent state and global hotkeys (`1`–`5`).
- **Role-Filtered Hero Pools (`/pool`):** Independent hero pools with comfort ratings (★ / ★★ / ★★★) for each position. Heroes can belong to multiple role pools.
- **Hero Role Fit (`data/hero-roles.json`):** Empirical role suitabilities (0.0 to 1.0) derived from competitive lane play rates with override support in `traits.overrides.json`.
- **Generalized Lane Trainer (`/lane/[role]`):** Head-to-head matchup matrix comparing your role pool against the primary opposing lane heroes.
- **Role-Specific Lane Plans:** Dynamic skeletons generated per position:
  - **Pos 1:** Farm priority, harass vs sustain, contesting vs pulling, power spike timing.
  - **Pos 2:** Rune control, waveclear, level 6 threat, roam windows.
  - **Pos 3:** Lane survival, trading, creep equilibrium, carry disruption.
  - **Pos 4:** Rotation windows, stacking/pulling options, duo kill setups.
  - **Pos 5:** Pull/stack routes, harass trade patterns, core protection and saves.
- **Duo/Trilane Lane Partner:** Pos 3/4/5 matchup pages support lane partner assignments with tailored notes.

---

### 2. Four New Core Systems

#### A. Personal Stats Import & Analysis (`/profile`)
- **Single Runtime API Exception:** Runs strictly client-side directly against OpenDota (`GET /api/players/{id}/matches` and `/api/matches/{id}`), throttled to ~1 req/sec with exponential backoff on HTTP 429.
- **IndexedDB Caching:** All raw match records and aggregated role summaries are cached in IndexedDB. Your Dota Account ID is stored locally in `localStorage`.
- **Role Inference:** Automatically derives your played role from `lane_role`, roaming status, and hero suitability fit. Editable per match.
- **Bayesian Smoothing:** Blends personal win rates toward global matchup deltas using $K = 10$.
- **Weak Spots Drill:** Ranks challenging matchups by loss frequency ($\text{lossRate} \times \text{frequency}$) for targeted Leitner drill practice.
- **Draft Personal Term:** Optional personal historical factor in draft scoring (`finalScore += wPersonal * myAdjDelta`).

#### B. Item Timing Benchmarks (`/profile` & Matchup Pages)
- **Winning-Game Benchmarks:** Median purchase timings and p25/p75 benchmark windows per hero and position (`data/item-benchmarks.json`).
- **Role Key Item Allowlist:** Focused tracking of critical items per archetype (e.g. BKB, Battle Fury, Manta for carries; Blink, BKB, Orchid for mids; Pipe, Crimson, Shiva's for offlane; Glimmer, Force, Mekansm, Lotus for supports).
- **Timing Verdicts:** Visual status badges (e.g. `Ahead (+2:15)`, `On Time`, `~3:10 late on BKB`).
- **Match Parse Request:** Detects unparsed matches and offers one-click parse requests (`POST /api/request/{match_id}`) to populate `purchase_log` timings.

#### C. Patch-Change Diff Engine (`/changes`)
- **Automated Snapshotting:** `npm run data:update` automatically archives previous data into `data/snapshots/{patch-or-date}/` (retaining the last 5 snapshots).
- **Diff Tool (`npm run data:diff`):** Identifies matchup deltas with swings $\ge 2.0\%$ ($N \ge 100$), hero win rate shifts $\ge 1.5\%$, and role suitability swings $\ge 5\%$.
- **Outdated Card Flagging:** Affected matchups in your personal playbook are marked with an `outdated?` badge.
- **Review Changed Queue:** One-click action to reset stale cards to Box 2 with a 1-day review interval.

#### D. Ally Synergy & Lane Partner Weighting (`/draft`)
- **Allied Pick Slots:** Draft helper includes an Allies row (up to 4 teammates, each with position assignment).
- **Pairwise Synergy Matrix (`data/synergy.json`):** Empirical same-team win rates smoothed with $K = 50$.
- **2x Lane Partner Weight:** Allies who share your lane (e.g. Pos 5 for Pos 1, Pos 4 for Pos 3) receive double synergy weight.
- **Compositional Trait Bonuses:**
  - Initiator + Follow-up AOE: $+3.0\%$
  - Defensive Save + Hypercarry: $+3.0\%$
  - Waveclear + Roaming Tempo: $+2.0\%$
- **5-Score Breakdown Bars:** Lane Match, Teamfight, Macro Timing, Ally Synergy, and Personal History.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `1` – `5` | Global (Any page) | Instantly switch active role (Pos 1–5) |
| `/` | Pools / Pickers / Search | Focus hero search bar |
| `Esc` | Search / Modals | Close modal or blur search |
| `Space` | Drill Flashcard | Flip active flashcard |
| `1` | Drill Flashcard | Mark "Needs Practice" (resets to Box 1) |
| `2` | Drill Flashcard | Mark "Got it Right" (advances to next Box) |
| `1`, `2`, `3`, `4` | Drill Quizzes | Select multiple-choice option |

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Unit Tests
```bash
npm test
```
Executes 137 unit tests covering role mappings, scoring math, item rules, Leitner SRS, personal stats smoothing, benchmarks, patch diffs, and ally synergy.

### 4. Build for Production
```bash
npm run build
```

### 5. CLI Data Pipeline Commands
```bash
# Update global data from OpenDota (automatically snapshots previous files)
npm run data:update

# Generate patch diff against latest snapshot
npm run data:diff

# Generate ally synergy matrix
npx tsx scripts/generate-synergy.ts

# Generate item timing benchmarks
npx tsx scripts/generate-item-benchmarks.ts
```

---

## Architectural Principles
- **No Database & No Auth:** Runs entirely in-browser with `localStorage` and `IndexedDB`.
- **Static Build-Time Data:** Meta statistics, matchups, synergies, and hero traits are committed JSON files.
- **One Runtime Exception:** Personal match sync on `/profile` connects directly to OpenDota from the browser (no middleman servers).
