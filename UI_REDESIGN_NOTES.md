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
- `index.html` references `/src/styles.css` which does not exist; should be removed.
- Very large image assets imported in `Home` inflate build output and hurt mobile loading.
