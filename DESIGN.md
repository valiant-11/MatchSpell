# MatchSpell v3 Design System (DESIGN.md)

## 1. Aesthetic Direction: Dota 2 Client HUD
A dark, premium, restrained "Dota 2 client" atmosphere designed for competitive drafting and matchup memorization. Not a cartoonish copy or copyright-infringing clone, but an authentic homage to the in-game dashboard: deep obsidian surfaces, crisp hairline borders, heroic display headings, authentic attribute colors, restrained Dota gold and crimson accents, and tactile GSAP Flip animations.

---

## 2. Color System & Design Tokens

### Surfaces (Warm-tinted Blue-Black)
- `--color-canvas`: `#0a0c0f` (Deep obsidian backdrop with faint vignette)
- `--color-panel`: `#12151a` (Primary container surface with top-edge hairline light)
- `--color-raised`: `#1a1e25` (Interactive tiles, table headers, hovered states)
- `--color-overlay`: `#222731` (Floating preview cards, dialogs, popovers)
- `--color-border`: `rgba(255, 255, 255, 0.06)` (Precision hairline divider)
- `--color-border-subtle`: `rgba(255, 255, 255, 0.04)`
- `--color-border-prominent`: `rgba(216, 181, 122, 0.35)` (Gold-accented edge)

### Accents
- `--color-gold`: `#d8b57a` (Dota Gold: headings, selected states, focus rings, tier highlights)
- `--color-red`: `#b3261e` (Dota Crimson: primary CTA buttons, lock-in actions, danger warnings)

### Attribute Tokens
- `--color-strength`: `#ec3d06` (Strength red-orange)
- `--color-agility`: `#26e030` (Agility neon-green)
- `--color-intelligence`: `#00d9ff` (Intelligence cyan-blue)
- `--color-universal`: `linear-gradient(135deg, #ec3d06 0%, #26e030 50%, #00d9ff 100%)` (Universal tri-attribute sweep)

### Position / Role Identity Tokens
- **Pos 1 (Carry):** `--color-pos1: #f59e0b` (Amber Gold | Blade)
- **Pos 2 (Mid):** `--color-pos2: #06b6d4` (Electric Cyan | Lightning)
- **Pos 3 (Offlane):** `--color-pos3: #ec4899` (Crimson Rose | Shield)
- **Pos 4 (Soft Support):** `--color-pos4: #a855f7` (Arcane Violet | Roamer Boot)
- **Pos 5 (Hard Support):** `--color-pos5: #10b981` (Emerald | Sentry Ward Eye)

### Semantic Feedback
- `--color-win`: `#4fbf6b` (Advantage delta, positive synergies, box promotion)
- `--color-loss`: `#e05050` (Disadvantage delta, counters, wrong quiz answer)
- `--color-neutral`: `#f59e0b` (Even trades, baseline ratings)
- `--color-info`: `#00d9ff` (Telemetry, informational callouts)

---

## 3. Typography Hierarchy
- **Display Headings (`--font-display`):** `Rajdhani, sans-serif` / `Cinzel` character — slightly condensed, high-tech, letter-spaced (`tracking-wider` / `tracking-widest`).
- **Body & UI (`--font-sans`):** `Geist Sans`, `-apple-system`, `sans-serif` — clear, clean legibility at small sizes (11px–13px).
- **Telemetry & Stats (`--font-mono`):** `Geist Mono` with `tabular-nums` (`font-variant-numeric: tabular-nums`).

---

## 4. Textures & Depth
- **Background Vignette:** Ambient radial gradient centered on canvas: `radial-gradient(ellipse at 50% 0%, rgba(18, 21, 26, 0.6) 0%, #0a0c0f 100%)`.
- **Panel Top-Edge Light:** Linear gradient overlay: `linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)`.
- **Card Shadows:** Restrained ambient shadow `0 4px 16px -2px rgba(0, 0, 0, 0.6)`.

---

## 5. Motion Tokens (`lib/motion.ts`)
- **Durations:**
  - Micro-interactions (hover, press): `120ms`
  - Medium transitions (tabs, popovers): `200ms`
  - Spatial moves (Flip pick-to-slot, 3D card flip): `320ms`
  - Staggered entrances & reveals: `500ms`
- **Easings:**
  - Entrance: `power4.out` (`cubic-bezier(0.16, 1, 0.3, 1)`)
  - Spatial Transform / Flip: `power2.inOut` (`cubic-bezier(0.4, 0, 0.2, 1)`)
  - Selection Snapping: Elastic spring-damped easing
- **Accessibility:** Global `prefers-reduced-motion` detection — collapses animations into instant opacity crossfades, pauses video previews, and disables 3D flips.
