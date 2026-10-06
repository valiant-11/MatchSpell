# MatchSpell UI Remake v3: UX & Design Audit (Phase 0)

Audit performed using `redesign-skill`, `impeccable`, and `taste-skill`. Below are the top 10 UX, visual, and motion problems identified in the current interface, ranked by impact.

---

### 1. Hero Grid Does Not Resemble the Dota 2 Client Heroes Tab (Rank 1 - Critical)
* **Problem:** Heroes are rendered as generic card boxes in a flat responsive grid with names permanently visible underneath. It lacks the iconic Dota 2 Heroes tab experience: 4 attribute columns (**Strength**, **Agility**, **Intelligence**, **Universal**) with colored headers, wide 16:9 landscape portraits, minimal gaps, and hidden labels by default.
* **Target Fix:** Build `<HeroPicker />` with 4 attribute sections (columns on wide desktop, stacked on mobile), tight 16:9 tiles, attribute header lines + counters, and hover-activated nameplates.

### 2. Disjointed Modal Dialog for Drafting vs Integrated 3-Zone Stage (Rank 2 - Critical)
* **Problem:** In `/draft`, picking an ally or enemy opens a blocking modal `<Dialog />` that conceals the draft state. Users cannot see their lane composition or enemy picks while selecting heroes.
* **Target Fix:** Rebuild `/draft` into a unified 3-zone drafting amphitheater: **Allies (left 4 slots)** | **HeroPicker (center grid with search & filters)** | **Enemies (right 5 slots)** | **Live Counter Suggestions (bottom deck)**.

### 3. Lack of Spatial Pick-to-Slot Motion (No GSAP Flip) (Rank 3 - High)
* **Problem:** Clicking a hero instantly pops them into a slot with zero spatial feedback, feeling disconnected from the physical action of drafting in Dota.
* **Target Fix:** Implement GSAP Flip pick-to-slot animation: clicking an available hero in HeroPicker sends the portrait flying into the first open slot with a lock-in flash; removing an enemy/ally plays the reverse release animation.

### 4. Missing Animated Hero Hover Preview & Video Render (Rank 4 - High)
* **Problem:** Hovering a hero tile currently only applies a subtle border change without context. It lacks the Dota client's hero preview video or tactical card inspection.
* **Target Fix:** Implement 150ms hover-intent video preview (`renders/{hero}.webm`) over the portrait with silent loop and static fallback. Add a floating preview panel displaying attribute, attack type, complexity diamonds (1–3), roles, trait tags, and dynamic matchup delta vs the current enemy lineup.

### 5. Generic AI Palette Lacking Dota 2 Identity (Rank 5 - High)
* **Problem:** The interface relies on generic Tailwind colors (pink, cyan, amber) and overly bright borders, lacking the restrained, dark, esports aesthetic of the Dota 2 client.
* **Target Fix:** Establish Dota client surfaces: `#0a0c0f` deep canvas, `#12151a` panel, `#1a1e25` raised, `#222731` overlay with `rgba(255,255,255,0.06)` hairline borders. Accent with Dota gold `#d8b57a` (selected states, focus rings, highlights) and Dota red `#b3261e` (primary actions). Implement authentic attribute tokens: Strength `#ec3d06`, Agility `#26e030`, Intelligence `#00d9ff`, and Universal gradient.

### 6. Role Switcher Lacks Custom Visual Role Icons & Animated Pill (Rank 6 - Medium)
* **Problem:** Role switching still relies on text like "Pos 1", "Pos 2" or plain buttons without an animated sliding pill indicator.
* **Target Fix:** Upgrade the top-nav switcher with custom 24px SVG `RoleIcon`s (Carry blade, Mid lightning, Offlane shield, Soft Support boot, Hard Support ward eye), animated sliding background pill, number hotkeys (1–5), and role tooltips. Eliminate all remaining "Pos N" text throughout the app.

### 7. Choppy Grid Filtering with No Motion Smoothing (Rank 7 - Medium)
* **Problem:** Applying search or role filters in the hero pool causes instant DOM jumps and pop-in without staggered entrance or position interpolation.
* **Target Fix:** Coordinate filtering with GSAP Flip + `useGSAP`: non-matching tiles smoothly scale down and dim, while matching tiles smoothly glide into their new positions with a subtle stagger.

### 8. Matchup Heat Table Lacks Interactive Crosshairs & Depth (Rank 8 - Medium)
* **Problem:** The matchup table in `/lane/[role]` is a flat grid without dual sticky headers, crosshair row/column hover guidance, or clear visual distinctions for low-data matches.
* **Target Fix:** Add sticky first-column & header, dual crosshair hover highlighting, subtle cell entrance reveals, color-coded delta scale (loss red -> neutral amber -> win green), and hatched low-data warning patterns.

### 9. Drill Mode Lacks 3D Card-Flip Mechanics and Haptic Feel (Rank 9 - Medium)
* **Problem:** Flashcard revealing is a flat show/hide state without tactile interaction or clear spaced repetition gamification.
* **Target Fix:** Implement a fluid 3D card flip (320ms, perspective transform, crossfade under `prefers-reduced-motion`), clear Leitner box progress bar, gold pulse on correct answers, and subtle shake/red edge flash on incorrect answers.

### 10. Missing Centralized Accessibility & Motion Preferences (Rank 10 - Medium)
* **Problem:** Icon-only buttons lack consistent `aria-label`s and tooltips. Transitions do not centrally honor `prefers-reduced-motion` to disable animations for sensitive users.
* **Target Fix:** Wrap all motion in centralized `motion.ts` tokens with `prefers-reduced-motion` detection. Add tooltips, keyboard shortcuts (`/` search, ESC clear, Enter select, 1–5 roles), and golden focus-visible rings across all components.
