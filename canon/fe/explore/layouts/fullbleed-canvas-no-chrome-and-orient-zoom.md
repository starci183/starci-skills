# Full-bleed CANVAS page — no breadcrumb, no chrome, and a default zoom that answers "where am I"

> A canvas is a surface the reader pans and zooms rather than scrolls: a diagram, a graph, a board,
> a map. The public references are the canvas tools themselves — Figma, Miro, and web maps — none of
> which surround the canvas with page chrome, and all of which open on something specific rather
> than on everything at once.

## The rule — STRICT

- **A full-bleed canvas page has NO breadcrumb and NO page chrome.** The canvas owns the ENTIRE
  viewport: a breadcrumb or a page header eats space the canvas needs, and the canvas already
  carries its own orientation ON its surface — zoom and fit controls, a marker for the current
  position, a legend. Orientation drawn inside the thing being explored beats orientation printed
  above it.
- **This is a deliberate EXCEPTION to "every page carries a breadcrumb".** That rule holds for
  reading pages, where the breadcrumb sits above a column of text and costs nothing. A canvas page
  drops it. Reading pages keep it exactly as before, and the exception is written down here so the
  next reader does not "fix" the canvas back into compliance.
- **The default camera on a LARGE graph is orientation-first, not fit-all.** Fitting a graph with
  many nodes into the viewport shrinks every node to uselessness: the reader sees a shape and no
  content. The default must CENTRE on the node the reader is at — the current position — at a
  readable zoom just under 1, so they see at once and up close where they are. Only when there is no
  current node, for a first-time or anonymous visitor, does it fall back to fitting the whole graph.
  The principle: *the default camera serves "where am I, what is next", not a shrunken panorama.*
  Web maps make the same choice, opening on the reader's location rather than on the globe.
- **Consequences.** The chrome component the canvas no longer renders is DELETED rather than left
  as dead code; the camera hook takes the identifier of the current node so it can choose a centre;
  fit-all is only the fallback.

## Related

[`when-rail.md`](when-rail.md) (a full-bleed canvas drops the rail) ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) (the same family: a focused surface goes
full-bleed and drops chrome and rails, but keeps a task pane and a way back) ·
[`page-shell-selection.md`](page-shell-selection.md).
