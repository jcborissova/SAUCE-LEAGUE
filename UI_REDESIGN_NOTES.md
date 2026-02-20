# UI Redesign Notes — Sauce League

## Scope
Refactor visual/UX mobile-first (320px+) across:
- `/`
- `/players`
- `/leagues`
- `/matches`
- `/tournaments`
- `/tournaments/view/:id`

No schema/API/business-logic changes.

## Route map
- `src/main.tsx`
  - `/` -> `src/pages/Home.tsx`
  - `/players` -> `src/pages/Players.tsx` (Protected)
  - `/leagues` -> `src/pages/Leagues.tsx` (Protected)
  - `/matches` -> `src/pages/Matches.tsx` (Protected)
  - `/tournaments` -> `src/pages/tournaments/index.tsx`
  - `/tournaments/view/:id` -> `src/components/Tournaments/TournamentViewPage.tsx`

## Shared shell / primitives
- Shell: `src/components/Layout.tsx`
- CSS tokens: `src/index.css`
- Shared UI: `src/components/ui/*`

## Current issues (mobile)
- Over-framed UI: nested `card/app-card/app-panel` wrappers in most pages.
- Radius overuse (`rounded-full`, `rounded-2xl`, `rounded-3xl`) on tabs/buttons/cards.
- Tournament standings + result forms rely on wide table layouts with horizontal overflow.
- Several custom modals with inconsistent spacing/close/focus behavior.
- Scoreboard has high visual noise and weak hierarchy for score/time.

## Current issues (desktop)
- Excessive container framing in `Layout` + per-page wrappers causes visual clutter.
- Inconsistent component language between league/tournament/pages.
- Card-heavy pattern reduces information density and professional readability.

## Duplicated / inconsistent UI logic
- Buttons are partly centralized (`btn-*`) but many custom variants remain.
- Multiple modal implementations (`ModalShell`, custom fixed overlays).
- Repeated card styles in league/tournament modules.
- Tabs/segmented controls implemented ad-hoc per component.

## Before/after criteria
### Global
- Before: floating, rounded-heavy card language.
- After: flatter editorial layout, radius baseline 8px, clear hierarchy.

### Navigation
- Before: top bar + drawer only.
- After: compact top bar + bottom nav on mobile; refined desktop rail.

### League flow
- Before: section hierarchy diluted by repeated card wrappers.
- After: clear sections (`Playing now`, `Waiting`, `Match controls`, `Guest/Pool`).

### Tournament view
- Before: tab container and content still over-boxed.
- After: flat underlined tabs and simple feed/list rhythm for schedule/results.

### Tables/forms
- Before: mobile horizontal overflow in key workflows.
- After: mobile-first stacked layouts with desktop enhancement.

## Baseline commands
- `npm run lint`
- `npm run build`

## Notes
- `index.html` was checked — no dead styles.css link found (already clean).
- Very large image assets imported in `Home` inflate build output and hurt mobile loading.

## What was changed

### Foundation (already in place before this session)
- `src/index.css` — HSL design tokens, btn-*/input-base CSS layers, dark mode
- `src/components/ui/` — Badge, EmptyState, PageShell, SectionCard, PrimaryButton, SecondaryButton, SegmentedControl, StatPill
- `src/components/Layout.tsx` — Mobile bottom nav + desktop sidebar
- `src/components/League/LeagueManager.tsx` — SectionCard sections, EmptyState
- `src/pages/Home.tsx` — PageShell, StatPill, Badge, hero layout
- `src/components/Tournaments/TournamentStandings.tsx` — Mobile card + desktop table dual layout
- `src/components/Tournaments/TournamentViewPage.tsx` — SegmentedControl tabs

### Fixes applied in this session

**`src/components/ui/StatPill.tsx`**
- Label: `text-[10px]` → `text-[11px]`

**`src/components/ui/table.tsx`**
- TableHeader: `text-[11px]` → `text-xs`

**`src/components/Layout.tsx`**
- Section label, role badge, sidebar "Navegación" label, bottom nav labels: `text-[11px]` → `text-xs`
- Bottom nav icons: `h-4 w-4` → `h-5 w-5`

**`src/pages/Home.tsx`**
- All `text-[11px]` → `text-xs`

**`src/components/League/PlayerCard.tsx`**
- Delete button: `h-7 w-7` → `h-9 w-9` (meets 36px touch target)
- Drag handle wrapper: `inline-flex h-9 w-9` hit area; icon `h-4 w-4` → `h-5 w-5`

**`src/components/League/LeagueManager.tsx`**
- Quinteto modal: `sm:max-w-5xl` → `sm:max-w-3xl`
- A/B toggle buttons: `h-8 w-10` → `h-10 w-10`
- "Quitar" buttons: `min-h-[36px] px-2` added

**`src/components/League/ScorePanel.tsx`**
- Team boxes: `grid-cols-1 lg:grid-cols-2` → `grid-cols-2` (always side-by-side for on-court use)
- Score text: `text-6xl` → `text-[2.5rem] sm:text-5xl lg:text-6xl` (safe at 320px)
- Time text: `text-3xl sm:text-4xl` → `text-2xl sm:text-3xl`
- TeamBox padding: `p-4` → `p-3 sm:p-4`

**`src/components/League/GameModal.tsx`**
- Added `landscape:h-auto landscape:max-h-screen landscape:overflow-y-auto` for on-court landscape use
- Bottom padding: `pb-24` → `pb-16`
- Close button: `h-10 w-10 right-3 top-3` → `h-11 w-11 right-2 top-2`

**`src/components/Tournaments/TournamentResultsView.tsx`**
- `TeamBoxscoreTable`: replaced single `min-w-[740px]` table with dual layout:
  - Mobile (`md:hidden`): card per player showing PTS/REB/AST grid + secondary stats line
  - Desktop (`hidden md:block`): existing full table preserved
- Table header: `text-[11px]` → `text-xs`
- Group count label: `text-[11px]` → `text-xs`

**`src/components/Tournaments/TournamentViewPage.tsx`**
- Main tab labels: "Posiciones" → "Tabla", "Estadísticas" → "Stats" (fits at 320px)

### Verified (no changes needed)
- `src/components/Tournaments/MatchResultForm.tsx` — mobile card `md:hidden` / desktop table `hidden md:block` already correctly guarded
- `index.html` — no dead CSS link

## Known remaining issues / suggestions
- Very large home page images (`leagues-home.jpg`, `matches-home.jpg`) should be WebP-converted and served with `srcset` for mobile performance.
- `text-[10px]` in StatPill mobile card labels inside TournamentResultsView is intentional for density — acceptable at that context.
- Consider adding `aria-live` region to ScorePanel score display for screen reader announcements during games.
