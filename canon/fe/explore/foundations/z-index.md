# Z-index

There is no CSS variable for layering. The scale below is LITERAL, cast from actual usage across the
app — a grep of `z-\d+` and `z-\[N\]` over `src/`. Do not climb to an arbitrary number; anchor to the
nearest step here.

## 1. The scale, low to high

- **`z-10`** — chrome floating LOCALLY inside one component: the mini reaction-bar popover, an
  overlay button on article text. `-z-10` is for decoration behind content (the ambient background).
- **`z-20`** — a control floating above a region that is itself already sticky: the rail's resize
  handle, video controls overlay.
- **`z-30`** — a sticky sub-header, or an in-page overlay on mobile: the filter bar at
  `sticky top-16`, the mobile settings tab strip, the search-result dropdown.
- **`z-40`** — chrome floating at PAGE level: the FAB, a sticky bottom bar, the mobile bottom tab
  bar, the socket-connection-status pill, the learn mobile top bar.
- **`z-50`** — the **navbar** (`sticky top-0 z-50`). This is the marker for "top of app chrome in the
  ordinary page flow".
- **`z-[60]`** — TopLoader, the SPA navigation loading bar, which MUST sit above the navbar. See
  [[loading-feedback-three-tiers-splash-toploader-skeleton]].
- **`z-[70]`** — AppSplash (the cold-load overlay), and any secondary overlay that has to clear all
  chrome — the settings modal opened from inside a FAB popover at `z-40`, for instance. This is the
  highest step currently in the app.

Anchors: Navbar `z-50`, TopLoader `z-[60]`, AppSplash and the `ContentAiSettingsModal` backdrop
`z-[70]`, FAB / StickyBottomBar / mobile bars `z-40`, rail resize handle and video controls `z-20`,
sticky filter and search dropdown `z-30`.

## 2. Every new z-index anchors to the nearest existing step

No inventing a value in between (`z-[45]`), and no jumping straight to `z-[100]` to be safe. A scale
only tells you what a layer MEANS while the steps stay countable; one number nobody can place turns
it back into guesswork.

When two overlays fight, fix the ARCHITECTURE before raising a number — see the gotcha below.

## 3. The unlayered gotcha: numbers do not decide the fight

HeroUI bakes `z-50` into `.modal__backdrop` and `.drawer__backdrop`. That baked style sits in the
SAME layer as a `z-[N]` added through className, so the winner is decided by SOURCE ORDER in the
bundle, not by the numeric value — a hand-added `z-[70]` can still LOSE if the HeroUI CSS loads
after it.

So an overlay opened from inside another popover is not a z-fight you can win by counting. Render it
IN-PANEL instead of as a body-level `Modal` or `Drawer`. See
[[overlay-from-popover-render-in-panel]].

## Related

[[overlay-from-popover-render-in-panel]] ·
[[loading-feedback-three-tiers-splash-toploader-skeleton]] · [[when-drawer]].
