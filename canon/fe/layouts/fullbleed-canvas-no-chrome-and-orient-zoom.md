# Full-bleed CANVAS page — no breadcrumb, no chrome, and a default zoom that answers "where am I"

> A heuristic. It extends [`when-rail.md`](when-rail.md) (full-bleed drops the rail) and CORRECTS
> the `elements/header` rule "breadcrumb everywhere" for canvas pages.

## The rule — STRICT

- **A full-bleed CANVAS page — a mind map or diagram occupying the whole viewport — has NO
  breadcrumb and NO page chrome.** The canvas owns the ENTIRE viewport: a breadcrumb or header eats
  space the canvas needs, and the canvas already carries its own orientation ON its surface — zoom
  and fit controls, a "you are here" node, a legend.
- **This CORRECTS the rule that every `/learn/*` page must have a breadcrumb** (`elements/header`).
  That rule holds for READING pages — the reading column. The exception is a full-bleed page
  (`fullBleed` on `LearnShell`, the mind map for example), which drops the breadcrumb. Reading pages
  keep it exactly as before.
- **The default camera on a LARGE map is orientation-first, not fit-all.** Calling `fitView` on a
  graph with many nodes shrinks every node to uselessness. The default must CENTRE on the "you are
  here" node — the current task — at a readable zoom of about `0.8`, so the learner sees at once and
  up close where they are. Only when there is no current node (a guest, or a learner who has
  finished) does it fall back to fitting the whole graph.
  The principle: *the default zoom serves "where am I, what is next", not a shrunken panorama.*
- **Consequences:** the canvas's own breadcrumb component is deleted when it is removed, rather than
  left as dead code; the fit-view hook takes the pointer to the current node so it can choose a
  centre; fit-all is only the fallback.

## Related

[`when-rail.md`](when-rail.md) (full-bleed canvas drops the rail) ·
[`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) (same
family: a focused surface goes full-bleed and drops chrome and rails) · `elements/header`
(breadcrumb, and the full-bleed exception).
