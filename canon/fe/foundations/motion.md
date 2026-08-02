# Motion

There is no named duration scale in this app. What follows is the convention read back out of real
usage, plus two guards that are mandatory for every decorative animation.

Source: `globals.css` (the `@keyframes` book, the `@media (prefers-reduced-motion)` block, the
`--tooltip-delay` / `--tooltip-close-delay` overrides), `@heroui/styles` (tooltip defaults of
1500ms / 500ms, `--skeleton-animation`), and a grep of `duration-*` / `transition-*` across `src/`.

## 1. `transition-colors` is the default

Hover and focus change colour, so `transition-colors` dominates real usage — roughly 92 places in
`src/`. `transition-opacity` is for fades; `transition-transform` is for movement and scale (a caret
icon, a CTA arrow).

`transition-all` is only for a case where two properties from different groups genuinely need to
animate, and that has been confirmed. It is not a lazy default: it animates everything the browser
can, including properties you did not intend, and it costs more to composite.

## 2. Durations run 150 / 200 / 300 / 500ms

Those are the values observable in the source. There is no token and no named scale. 150-300ms
covers micro-interaction (hover, focus); 500ms is for a larger fade (the splash, a page-level
transition). Stay inside that band rather than inventing an unfamiliar number.

## 3. `prefers-reduced-motion` is MANDATORY for every decorative animation

It does not apply to essential feedback such as a loading spinner, where removing the motion removes
the information. Two mechanisms, chosen by where the animation lives:

- **CSS `@keyframes`** (ambient, splash) — guard it inside
  `@media (prefers-reduced-motion: reduce)` right there in `globals.css`. Blocks already exist for
  `.ambient-*` and `.app-splash-bar`.
- **Framer-motion components** (diagrams, scroll-driven scenes) — call the `useReducedMotion()` hook
  and switch the lerp or motion off, falling back to a hard cut. Already done in
  `CollapsibleSidebar`, `ArchitectureScene`, `KnowledgeGraph`, `LearnLoopScroll`, `StatStrip` and
  `AIProcessingText`.

## 4. `@keyframes` live in ONE book, in `globals.css`

No loose keyframes in a CSS module or an inline `<style>`. What is already there:

- `wireFlow` — the packet running along a wire in the hero diagram.
- `emberRise`, `snowFall`, `rainFall`, `bubbleRise`, `fireflyDrift`, `starTwinkle`, `auroraDrift`,
  `waveDrift`, `circuitPulse` — the nine `AmbientBackground` effects.
- `reactionPop` — the Facebook-style bounce-in on a reaction.
- `appSplashTrickle` — the entry splash bar.

A new decorative animation is added here. One book means a duplicate is visible before it ships, and
the reduced-motion guard in §3 has a single place to cover.

See [[reimplement-dead-lib-natively-fb-reactions]] for the convention that keeps a transform pop-in
(on the button) separate from a hover-scale (on a child span), so the two do not overwrite each
other on the same element.

## 5. Skeletons share one animation

`--skeleton-animation: shimmer` is the HeroUI default and the app does not override it. Every
`Skeleton` uses it. Do not build a second loading animation — two shimmer styles on one page reads
as two different kinds of loading, which is a claim the UI is not making.

## 6. Tooltips are instant

The app forces `--tooltip-delay` and `--tooltip-close-delay` to `0ms`, against HeroUI's defaults of
1500ms and 500ms. Hover shows the tooltip immediately; the library's built-in hesitation is gone
deliberately.

## 7. The three loading tiers are their own concept

Cold-load splash, navigation top-bar, region skeleton — that is a larger idea than motion alone. See
[[loading-feedback-three-tiers-splash-toploader-skeleton]].

## Related

[[loading-feedback-three-tiers-splash-toploader-skeleton]] ·
[[reimplement-dead-lib-natively-fb-reactions]] · [[z-index]] (splash and top-bar layering belong to
the same system).
