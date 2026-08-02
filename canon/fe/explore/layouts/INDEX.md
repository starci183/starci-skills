# Front end — layouts

Which **shell** a surface gets, and how its regions behave. The root rule of the shelf is that the
question is never "what does this page look like" but "what job is this surface doing" — the job picks
the shell, and a multi-phase feature is allowed to change shell between phases.

Two tiers sit here. The decision docs settle which archetype applies; the archetype files describe one
shell each. Start at [`surface-job-drives-layout.md`](surface-job-drives-layout.md) or
[`page-shell-selection.md`](page-shell-selection.md) and turn into the archetype they name.

| File | Decides |
|---|---|
| [`surface-job-drives-layout.md`](surface-job-drives-layout.md) | the root rule: the surface's job chooses the shell, with the job-to-shell table, and a multi-phase feature changing shell per phase |
| [`page-shell-selection.md`](page-shell-selection.md) | the first-tier decision tree — rail, full-bleed, hub or centered — asked in order before a new route is opened, gathering the three full-bleed and rail heuristics into one path |
| [`region-model.md`](region-model.md) | the vocabulary of regions and the shells they belong to, so that placing a component starts by naming its region rather than by styling it, and so measure and padding stay with the column |
| [`responsive-regions.md`](responsive-regions.md) | how a region changes with the viewport — responsive fluidity within one shape versus adaptive change of shape at a breakpoint — including the rail that folds into a chip row on small screens |
| [`when-rail.md`](when-rail.md) | that no rail is the default and a rail must be earned by one nav axis plus a list long enough to fill it, because an empty rail reads as a void |
| [`docs-three-pane-reader.md`](docs-three-pane-reader.md) | the archetype for deeply hierarchical content browsed continuously while reading: icon rail, content tree, reading column, on-this-page TOC |
| [`master-detail-rail.md`](master-detail-rail.md) | the standalone route with one nav axis and a work pane beside it, in its resizable and its collapsible fixed-width variants |
| [`dashboard-hub.md`](dashboard-hub.md) | the archetype for several peer areas under one identity: a tab strip under the navbar over a centered two-column, with switching area as a tab rather than a button group |
| [`catalog-grid.md`](catalog-grid.md) | the shell for browsing N items of one kind — search, count, grid-or-line toggle, card list, pager — and when an item is too field-rich to tile and stays row-only |
| [`centered-form-setup.md`](centered-form-setup.md) | the one narrow column with no rail for a single focused task: review, then action, then CTA |
| [`marketing-landing.md`](marketing-landing.md) | the shape of a public selling page — full-fold hero, stacked story sections, closing CTA — with the copy and data rules left to the principles shelf |
| [`full-bleed-work-surface.md`](full-bleed-work-surface.md) | the shell for one focused piece of work: the surrounding content rails and page chrome dropped, one visible way back, and the choice between a hard two-pane split and a workspace pane that opens on demand |
| [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) | that a canvas page carries no breadcrumb and no page chrome, orienting the reader on its own surface instead — the one documented correction to breadcrumb-everywhere |

## Reading order

Decision docs first, archetype second. The three full-bleed and rail heuristics are deliberately kept
beside the decision tree rather than folded into it: the tree gets you to an answer quickly, and the
heuristics are what you open when the answer is being argued.

The sibling of [`when-rail.md`](when-rail.md) is [`when-drawer.md`](../patterns/when-drawer.md), which
sits on the patterns shelf because a drawer is a behaviour inside a surface rather than a shell for
one.
