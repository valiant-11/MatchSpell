# MatchSpell Implementation Notes & API Findings (v2)

This document details API nuances, schema deviations, statistical assumptions, and architectural design choices established across MatchSpell v1 and v2.

---

## 1. Data Sources & OpenDota API Schema Findings

### Dotaconstants & CDN
* **Heroes (`heroes.json`):**
  * 127 heroes returned.
  * Image URLs are relative paths starting with `/apps/dota2/images/dota_react/heroes/...`.
  * Prepended with Steam CDN: `https://cdn.cloudflare.steamstatic.com`.
  * Hero internal identifiers follow `npc_dota_hero_<name>`.
* **Items (`items.raw.json`):**
  * Internal keys differ from display names:
    * Eul's Scepter of Divinity is internal key `cyclone` (id: 100).
    * Linken's Sphere is internal key `sphere` (id: 123).
    * Gem of True Sight is internal key `gem` (id: 30).
    * Orchid Malevolence is internal key `orchid` (id: 98).
    * Ghost Scepter is internal key `ghost` (id: 37).
    * Pipe of Insight is internal key `pipe` (id: 90).
    * Black King Bar is internal key `black_king_bar` (id: 116).
  * Some legacy items have `cost: null`, requiring nullable number handling.

### OpenDota API Endpoints
* **`GET /api/heroStats`:**
  * Returns pub win rates across 8 bracket tiers (`1_pick`/`1_win` through `8_pick`/`8_win`).
  * In sparse rolling windows for niche heroes, bracket 8 (Divine/Immortal) pick count can be zero; the pipeline falls back smoothly to overall pub win rate.
* **`GET /api/heroes/{id}/matchups`:**
  * Returns an array of matchups against all other heroes with fields `{ hero_id, games_played, wins }`.
  * **Zero-Sum Symmetry Fallback:**
    $$\text{games}(A, B) = \text{games}(B, A)$$
    $$\text{wins}(B, A) = \text{games}(A, B) - \text{wins}(A, B)$$
* **`GET /api/heroes/{id}/durations`:**
  * Returns duration buckets with `duration_bin` in seconds.
  * `earlyScore` represents matches $\le 35$ minutes ($\le 2100$s).
  * `lateScore` represents matches $\ge 40$ minutes ($\ge 2400$s).
* **`GET /api/heroes/{id}/itemPopularity`:**
  * Provides item purchase counts per hero partitioned across `start_game_items`, `early_game_items`, `mid_game_items`, and `late_game_items`.

---

## 2. Personal Match Stats Import Architecture (Phase 8)

* **Client-Side Only:** Runs directly in the user's browser; no backend servers are involved.
* **Account ID:** Stored in `localStorage` under key `matchspell_account_id` (fallback: `midmaster_account_id`).
* **Rate Limiting & 429 Handling:** Throttled to ~1 request per second with exponential backoff on HTTP 429 responses.
* **IndexedDB Store:**
  * Database name: `matchspell_v2_db`, version `1` (legacy: `midmaster_v2_db`).
  * Stores: `matches` (raw match summaries) and `player_summary` (aggregated role and matchup matrices).
* **Role Inference Logic (`lib/player-stats.ts`):**
  * `lane_role === 1`: Safe lane. If farm priority / hero role fit indicates core, inferred as Pos 1 (Safe Carry). If support, inferred as Pos 5.
  * `lane_role === 2`: Inferred as Pos 2 (Mid).
  * `lane_role === 3`: Offlane. If core, inferred as Pos 3 (Offlane). If support, inferred as Pos 4 (Soft Support).
  * `is_roaming === true`: Pos 4.
  * Players can manually override inferred roles on the Profile match table.
* **Bayesian Smoothing:**
  * Aggregated head-to-head records are smoothed toward the hero's global meta delta with $K = 10$:
    $$\text{smoothedWr} = \frac{\text{wins} + 10 \cdot \text{globalAdjWr}}{\text{games} + 10}$$
    $$\text{smoothedDelta} = \text{smoothedWr} - 0.50$$

---

## 3. Item Timing Benchmarks Methodology (Phase 9)

* **Data Sourcing (`scripts/generate-item-benchmarks.ts`):**
  * Sourced by sampling winning games across all 127 heroes and 5 competitive roles.
  * Captures the p25 (ahead / snowballing), p50 (median winning benchmark), and p75 (late threshold) first-purchase timestamps.
  * Saved statically into `data/item-benchmarks.json`.
* **Personal Timing Extraction:**
  * Extracted from `purchase_log` in parsed OpenDota matches (`GET /api/matches/{id}`).
  * Evaluated against the winning-game median with $\pm 60$s tolerance:
    * $\Delta \le -60$s: `ahead`
    * $-60\text{s} < \Delta \le 60\text{s}$: `on_time`
    * $\Delta > 60$s: `late`
* **Match Parsing Queue:**
  * For unparsed matches without a `purchase_log`, the UI offers a "Request Parse" button hitting `POST https://api.opendota.com/api/request/{match_id}`.

---

## 4. Patch-Change Diff Engine (Phase 10)

* **Snapshot Lifecycle:**
  * Every run of `npm run data:update` archives existing `data/*.json` files into `data/snapshots/{timestamp}_snapshot/`.
  * Keeps the last 5 snapshots, pruning older directories automatically.
* **Diff Thresholds (`lib/diff.ts`):**
  * Matchup delta shifts: $\ge 2.0\%$ change in smoothed delta with $\min 100$ games in both snapshots.
  * Hero overall win rate shifts: $\ge 1.5\%$ change.
  * Hero role suitability shifts: $\ge 5.0\%$ change.
  * Item build shifts: items entering or dropping out of the top 6 phase items.
* **Staleness Tracking:**
  * If a user has active notes or SRS flashcard entries for an affected matchup, an `outdated?` badge is displayed on table cells and drill cards.
  * The `/changes` page provides a "Reset Cards to Box 2" button for review.

---

## 5. Ally Synergy & Lane Partner Weighting (Phase 11)

* **Pairwise Data Generation (`scripts/generate-synergy.ts`):**
  * Computes same-team pair win rates for all $127 \times 126$ hero combinations.
  * Bayesian smoothing applied with $K = 50$:
    $$adjWr = \frac{\text{wins} + 50 \cdot \text{heroOverallWr}}{\text{games} + 50}$$
    $$\delta = adjWr - \text{heroOverallWr}$$
  * Stored in `data/synergy.json`.
* **Lane Partner 2x Weighting:**
  * Pos 1 lanes with Pos 5 (weight 2.0).
  * Pos 2 is solo mid (weight 1.0).
  * Pos 3 lanes with Pos 4 (weight 2.0).
  * Pos 4 lanes with Pos 3 (weight 2.0).
  * Pos 5 lanes with Pos 1 (weight 2.0).
* **Compositional Trait Bonuses:**
  * Initiator + Follow-up AOE: $+3.0\%$
  * Defensive Save + Hypercarry: $+3.0\%$
  * Waveclear + Roaming Tempo: $+2.0\%$
* **Weight Normalization:**
  * $w_{\text{Synergy}}$ is added to all modes: Lane $0.10$, Fight $0.35$, Macro $0.20$, Balanced $0.25$.
  * Supports (Pos 4 & 5) receive an additional $+0.10$ synergy weight.
  * Remaining weight is distributed proportionally among the base dimensions to ensure $\sum w = 1.00$.

---

## 6. Migration & Storage Schema

* **Schema Version:** Version `2`.
* **Automated Migration (`lib/storage.ts`):**
  * Legacy v1 mid pool entries are automatically migrated into `rolePool[2]`.
  * Legacy v1 mid notes (`mid_notes`) are migrated to `notes["2_<myHero>_<enemyHero>"]`.
  * Legacy v1 SRS entries are migrated to `srs["2_<myHero>_<enemyHero>"]`.
  * Route redirects in Next.js smoothly map legacy `/mid/*` routes to `/lane/2/*`.

---

## 7. UI Overhaul & Design System (Phases A–E)

* **Design Direction:** "Tactical Esports Analytics HUD / Cyber-Dark" documented in `DESIGN.md`.
* **Tokens (`app/globals.css`):**
  * Canvas: `#070a0f`, Panel: `#0d121c`, Raised: `#131926`, Overlay: `#1a2234`.
  * Roles (1–5): Pos 1 (`#ef4444`), Pos 2 (`#f59e0b`), Pos 3 (`#3b82f6`), Pos 4 (`#10b981`), Pos 5 (`#a855f7`).
  * Semantics: Win (`#10b981`), Loss (`#f43f5e`), Neutral (`#f59e0b`), Info (`#0ea5e9`).
* **Icons:** Custom 24px inline SVG icons in `components/icons/RoleIcon.tsx` (Broadsword, Lightning Crosshair, Aegis Shield, Roamer Boot, Sentinel Ward Eye) with stroke 1.75 and rounded joins. `lucide-react` for system icons.
* **Shared UI Library (`components/ui/`):**
  * `Button`, `IconButton`, `Tabs`, `SegmentedControl`, `Badge`, `Card`, `Input`, `SearchInput`, `Select`, `Tooltip`, `Dialog`, `Toggle`, `Progress`, `Skeleton`, `EmptyState`, `Toast`.
  * Zero unstyled native controls. Focus-visible rings, tooltips on icon-only controls, WCAG AA contrast.
* **Layout Shell:** Collapsible sidebar (`AppShell.tsx`), top bar with persistent `RoleSwitcher` (hotkeys 1–5), bracket selector, and mobile bottom tab bar.
* **Zero Logic Mutation:** All existing route paths, unit tests (137/137 passing), scoring formulas, and storage keys preserved intact.

---

## 8. Adaptive Hero Core Progression & Break Counters

* **Hero-Centric Core Progression (`lib/item-rules.ts`):**
  * Core builds are anchored first in the selected hero's high-rank pub data (`data/item-popularity.json`) rather than generic rule overrides.
  * Natural signature rush items (e.g. Radiance on Necrophos, Desolator/Echo Sabre on Monkey King, Blink Dagger on Axe) establish timing priority before contextual counter rules.
  * Counter items are merged and prioritized contextually: if an urgent counter (e.g. BKB against heavy stuns or Silver Edge against passive-heavy threats) matches, it is either promoted to rush priority or integrated into the core timeline.
  * Non-viable items are filtered out by archetype and role: Blink Dagger is strictly restricted to initiator heroes (`blink_initiator` tag); support items (Glimmer, Greaves, Force on melee cores) and tank auras are blocked from non-fitting heroes.
* **Break Mechanics & Passive Counters:**
  * **Khanda (`angels_demise`):** In `dotaconstants`, Khanda is internally represented as `angels_demise` (cost 5600g). Evaluated as a unit-target spell break & burst counter rule (`khanda-break`).
  * **Silver Edge (`silver_edge`):** Added `silver-edge-break` rule (rush tier for physical cores) when facing `passive_heavy` threats like Bristleback and Phantom Assassin.
  * **Break Counter Heroes (`lib/scoring.ts` & `data/traits.json`):** Added `"break"` tag to Hoodwink (hero 123) alongside Doom (69), Shadow Demon (79), and Viper (47). Draft scoring awards $+0.04$ synergy bonus and explicit reasoning line when picking Break heroes against passive-heavy enemy lineups.

---

## 9. Hero Video Renders & HeroPicker Architecture (UI Remake v3)

* **Hero Animated Renders:**
  * Animated hover preview video: `https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/{hero_name}.webm` (where `{hero_name}` is dotaconstants `name` stripped of `npc_dota_hero_`). Tested and verified HTTP 200 `video/webm` on Cloudflare Steam CDN.
  * Static portrait fallback: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{hero_name}.png` (and `hero.img` from dotaconstants).
  * Video rules: created dynamically on hover only, `preload="none"`, `muted`, `loop`, 150ms hover-intent delay, auto-paused and destroyed on `mouseleave`. Never mounted on touch devices or under `prefers-reduced-motion`.
* **Dota 2 Heroes Tab Attribute Layout:**
  * 4 attribute sections: **Strength** (`#ec3d06`), **Agility** (`#26e030`), **Intelligence** (`#00d9ff`), and **Universal** (`linear-gradient(135deg, #ec3d06, #26e030, #00d9ff)`).
  * 16:9 landscape tiles in a tight grid; nameplate slides up on hover with attribute glow and scale z-lift (`scale(1.06)`).
  * Filtering smoothly reflows tiles with GSAP Flip; non-matching tiles dim/shrink.


