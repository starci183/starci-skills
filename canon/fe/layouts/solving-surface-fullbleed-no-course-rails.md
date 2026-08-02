# The SOLVE surface — full-bleed, and the course nav rails are dropped

> A heuristic, in the same family as
> [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md):
> a page that occupies the whole viewport and carries its own orientation. The rail decision itself
> lives in [`when-rail.md`](when-rail.md).

## The rule — STRICT

- **A page that is a "solve this one item" surface — challenge solve, a code lab — goes full-bleed
  and DROPS the course navigation rails**, both the content tree and the on-this-page rail. The
  learner came here to SOLVE ONE PROBLEM, not to browse the course, so packing the module and
  lesson tree in only squeezes the working area. It is the LeetCode or Exercism shape: the problem
  and the submission area, with no site nav attached.
- **The way BACK must exist and be visible on the page itself.** Dropping the rail is only
  acceptable because the page carries its own exit: a challenge has a back-link ("← Quay lại bài
  học") to the lesson containing it (`elements/header` §3). The full tree lives on the lesson page,
  and the flow is lesson → solve (focused) → back → pick another item. One step back, never a dead
  end.
- **The narrow icon rail, `LearnSidebar`, STAYS.** It is `LearnShell`'s fixed `<aside>`, not the
  `leftRail` prop, so surface-to-surface navigation still works. Only `leftRail` and `rightRail`,
  the content rails, are dropped, and `fullBleed` is turned on.
- **Distinguish it from a READING page.** The lesson reader KEEPS the content tree and the
  on-this-page rail, because browsing and reading is exactly what needs the tree. Only the "solve"
  leaf is full-bleed. Both share the route pattern `segments.includes("modules")`, and
  `segments.includes("challenges")` is what overrides it to full-bleed.
- **Distinguish a tab (query param) from a route segment.** `?tab=challenges` is a query param
  switching client-side inside the same reader page, and it KEEPS the rail. That is not the SOLVE
  page at `…/challenges/<id>`, which is a route segment and goes full-bleed. Confusing the two
  strips the rail from a reader.

## Related

[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)
(the full-bleed canvas) · [`when-rail.md`](when-rail.md) (when a rail is used at all) ·
`leaf-page-one-nav-and-combined-tab-toolbar` (one affordance for going back) · `elements/header`
(the back-link slot).
