# Docs 3/4-pane reader — icon rail · content tree · reading column · on-this-page TOC

> Grounded in `src/components/features/learn/LearnShell`, which serves every route under
> `/courses/[courseId]/learn/*`. The archetype is technical documentation in the shape of Stripe
> Docs or Docusaurus: browse the content tree on the LEFT, read in the MIDDLE, orient inside the
> current page on the RIGHT.

## When to use

Deeply HIERARCHICAL content (module → lesson → section) that has to be browsed CONTINUOUSLY while
reading, rather than a single self-contained task. Two or three modes are not a tree; that case is
not this archetype and goes back to [`page-shell-selection.md`](page-shell-selection.md).

## Region map, left to right

1. **Icon rail** — `LearnSidebar`, always visible from `lg+`. It moves between SURFACES (content,
   challenges, leaderboard, personal project…), is sticky at `top-16` and full height, and takes
   care of its own scrolling, dividers and collapse.
2. **Content-tree rail** — the `leftRail` prop, for example `ContentMap`. It holds the
   module-to-lesson tree of the CURRENT surface, is ALWAYS visible with no collapse, and is passed
   in by the route layout.
3. **Reading column** — `children`, the main content at `max-w-3xl mx-auto`. **`p-6` is owned by the
   SHELL**: a feature never declares its own `p-*` here, except under `fullBleed`. Padding declared
   twice is padding nobody can predict.
4. **On-this-page rail** — the `rightRail` prop, for example `OutlineRail` or a milestone rail. It
   is the in-page table of contents, optional per route; `showRightCollapse` turns on a redux-driven
   handle when one is needed.

**Mobile (`<lg`)** — the four columns fold into `LearnMobileTabBar`, a bottom tab bar, whenever
there is a `leftRail`. A route that is not a reader uses `LearnMobileBar`, a drawer bar, through
`simpleMobileBar`.

**Full-bleed opt-out** — a canvas that fills the viewport, such as the mind map, sets `fullBleed`,
which drops both `p-6` and the rails. At that point the surface has left this archetype; see
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md).

## Related

[`when-rail.md`](when-rail.md) · `learn-home-surfaces-share-flat-chrome` (each surface's home shares
this same chrome) ·
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) ·
`sidebar` component canon (`LearnSidebar`, `OutlineRail`) · `header` component canon (breadcrumb
slot) · [`page-shell-selection.md`](page-shell-selection.md).
