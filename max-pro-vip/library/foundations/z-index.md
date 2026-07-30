---
name: z-index
tier: foundations
admitted: 2026-07-30
---

# Z-index

## Role

The stacking-order ladder for anything that must float above ordinary page flow. It governs which
literal `z-*` a block reaches for by role — not whether it should float at all.

## Source of truth

No CSS variable, no token. A literal scale, read directly off real usage across `src/` (confirmed by
grep). New values must anchor to the nearest existing step below, never invent a number in between.

## Scale

| Step | Derived as | Means |
|---|---|---|
| `z-10` / `-z-10` | hand-set literal, independent | chrome floating **locally inside one component** (mini-popover reaction bar, overlay button on article text) / `-z-10` for decor placed **behind** content (ambient background) |
| `z-20` | hand-set literal, independent | a control floating over an already-sticky region (rail resize-handle, video controls overlay) |
| `z-30` | hand-set literal, independent | sticky sub-header or in-page overlay, mostly mobile (filter bar, settings tab-strip, search-result dropdown, bottom sheet) |
| `z-40` | hand-set literal, independent | page-level chrome (FAB, sticky bottom bar, mobile bottom tab-bar, sticky filter row) |
| `z-50` | hand-set literal, independent | the navbar (`sticky top-0 z-50`) — the anchor use. Also reached by a handful of unrelated floating elements today (a contribution-calendar tooltip, a diagram node popover, a full-screen confetti overlay) that land on the same step without a documented reason to sit exactly here rather than `z-40` |
| `z-[60]` | hand-set literal, independent | TopLoader (SPA nav progress bar) — must beat the navbar |
| `z-[70]` | hand-set literal, independent | the highest step in live use: AppSplash (cold-load overlay) and any overlay that must beat every other layer of chrome (currently `ContentAiSelectionAsk`) |

There is no root and nothing derives from anything — every step is an independently observed
literal. One value seen in the codebase does **not** belong to this ladder and should not be read as
a step on it: `z-[1]` in `AIProcessingText`'s inner panel is a purely local hack to lift one element
above a `z-auto` sibling within the same small component — it carries no relationship to the global
layer scale above and does not compete with any of these seven steps.

`z-50` is the collision worth flagging: the navbar is the reason this step exists, but today several
unrelated floating elements (tooltip, diagram popover, confetti) also resolve to `z-50` — apparently
because "as high as the navbar" was good enough, not because they need to sit at the navbar's own
layer. If the navbar's step ever moves, these ride along by accident, not by design, and nothing
records why they picked `z-50` specifically rather than `z-40`.

## How steps relate

Each step is an independent decision, not a formula — but every new `z-*` must anchor to the
**nearest existing step below** rather than pick a number in between (`z-[45]`) or leap straight to
an arbitrary high number "to be safe." If two overlays fight, the fix is architecture (render
in-panel instead of as a separate Modal/Drawer body), not a higher number.

## Forbidden

| Forbidden | Caught by |
|---|---|
| picking a z-index number between two documented steps (`z-[45]`) or jumping straight to an arbitrary high value | nothing — arbitrary bracket values compile and render fine |
| trying to win a z-fight against an overlay opened from inside another overlay (e.g. a popover-spawned overlay vs. its parent popover) by raising the number | nothing catches this directly — the real fix is rendering in-panel; see `overlay-from-popover-render-in-panel` |

## Read by which axes

Any overlay/floating-layer decision — `overlay-from-popover-render-in-panel`,
`loading-feedback-three-tiers-splash-toploader-skeleton`, `when-drawer`.

## Anchors

Grepped `z-\d+`/`z-\[N\]` across `src/` directly (2026-07-30): Navbar `z-50`
(`components/blocks/layout/shell/Navbar`, `components/features/navbar/Navbar`), TopLoader `z-[60]`,
AppSplash `z-[70]`, `ContentAiSelectionAsk` `z-[70]` — this replaces an older note's example of a
`ContentAiSettingsModal` at `z-[70]`, which no longer exists in the tree; the step itself is still
live, its example moved. FAB / StickyBottomBar / LearnMobileBar / ContentAiFab / PracticeFilters at
`z-40`; rail resize-handle / VideoControls at `z-20`; SearchInput dropdown / SettingsLayout sticky
filter / LearningHistory CourseDetail sticky / ConnectSheet / LearnMobileTabBar at `z-30`. The
unlayered-CSS gotcha (HeroUI `.modal__backdrop`/`.drawer__backdrop` bake `z-50` in the same utility
layer as a hand-added `z-[N]`, so source order in the bundle — not the number — decides the winner)
is unverified in this pass and should be re-confirmed against the current HeroUI bundle before being
restated as fact.
