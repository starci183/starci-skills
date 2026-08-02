# The surface's JOB chooses the shell — and a multi-phase feature CHANGES shell per phase

> The root rule of this shelf. Before building a page, the question is not "what does this page look
> like" but **"what JOB is this surface doing?"** — the job picks the shell. Web ground: adaptive
> layout, where the arrangement follows the *task or modality* rather than being locked to one frame
> ([Material](https://m2.material.io/design/layout/understanding-layout.html) · [Fluent
> 2](https://fluent2.microsoft.design/layout)); and focus mode, where editors and reader modes HIDE
> the surrounding navigation to concentrate on one job.

## Job to shell

| Job of the surface | Shell | Archetype |
|---|---|---|
| **Read or browse** hierarchical documentation | three panes: tree rail, reading column, orientation rail | [`docs-three-pane-reader.md`](docs-three-pane-reader.md) |
| **Browse N items of one kind** | catalog grid/line plus pager | [`catalog-grid.md`](catalog-grid.md) |
| **Decide or enter** one task (form, setup, checkout) | centered single column, no rail | [`centered-form-setup.md`](centered-form-setup.md) |
| **FOCUSED WORK with a tool** | full-bleed, no content rails, one or two panes | [`full-bleed-work-surface.md`](full-bleed-work-surface.md) |
| **Explore a canvas** (diagram, graph, board, map) | full-bleed, no chrome at all | [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) |
| **Overview** of several areas under one identity | hub with a tab strip | [`dashboard-hub.md`](dashboard-hub.md) |
| **Read a result or a debrief** | centered single column | the [`centered-form-setup.md`](centered-form-setup.md) shape |
| **Sell or tell a story** in public | stacked landing | [`marketing-landing.md`](marketing-landing.md) |

To pick the concrete shell, use the decision tree in
[`page-shell-selection.md`](page-shell-selection.md); for the vocabulary of regions, see
[`region-model.md`](region-model.md).

## A MULTI-PHASE feature is several jobs in one route — CHANGE the shell per phase, STRICT

- **One route passing through N phases with DIFFERENT jobs uses the shell of each phase's job. Do
  not lock the whole feature to one frame.** Forcing every phase into one shell distorts whichever
  phase has a different job — usually the working phase, crammed into a narrow reading column, or
  the result, spilling across a full width it does not need.
- The symptom: a single phase state machine rendering every phase inside the SAME centered measure
  and the SAME rail, while one of those phases is work that needs the whole viewport.
- Switching shell by phase is **adaptive-by-task**, not only adaptive-by-viewport: the phase changes
  job, so the layout changes.

A live-session feature is the clearest case. Four phases, four jobs:

| Phase | Job | Shell |
|---|---|---|
| set up | deciding | centered |
| the session itself | working with a tool | full-bleed, one or two panes, no rails |
| processing | waiting | centered interstitial |
| the result | reading | centered |

Building all four in the working phase's shell wastes three quarters of the flow; building all four
in the centered shell strangles the one phase that needed the room.

## A route-level shell flag cannot see a client-side phase

The obvious implementation — have the route's layout turn on full-bleed for this feature — breaks
the moment the route is DEDICATED and RESUMABLE, keeping ONE URL for the whole session and moving
between phases through client state without changing the URL. The layout matches on the URL segment,
so the shell believes the ENTIRE route is full-bleed, and the phases that should be centered lose
their reading column and spill across the full width.

**The reusable rule:** when a route holds a fixed URL across several phases with different jobs, a
route-level shell flag sees only the URL and never the phase. A phase that needs a narrow reading
column must therefore not rely on the shell; it caps its own measure in the component that renders
it. The alternative — encoding the phase in the URL so the shell can see it — is legitimate, and is
the better answer when the phases are genuinely separate places a reader can link to or return to;
it is the wrong answer when the phases are one continuous session that must resume where it left
off.

## Related

[`page-shell-selection.md`](page-shell-selection.md) (picking the concrete shell) ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) · [`region-model.md`](region-model.md) ·
[`responsive-regions.md`](responsive-regions.md) ·
`every-surface-offers-a-path-onward` (every phase still covers its states and still offers a way
onward).
