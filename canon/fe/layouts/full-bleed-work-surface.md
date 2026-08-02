# Full-bleed two-pane WORK surface — solving, interviewing, designing with a tool

> The archetype for the job "focus on one piece of work and need a tool for it". Distinct from the
> pure canvas of
> [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)
> and from the single-column solve surface of
> [`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md).
> Web precedent: focus mode (the VS Code secondary side bar, browser focus) HIDES the site nav so
> the screen goes to the work; CoderPad and interviewing.io are two panes of context ↔ workspace.

## The frame — STRICT

- **Full-bleed, DROP the course rail and the chrome** — the route turns on `fullBleed`. Course
  navigation is noise while one piece of work is being done. The way back is a single back-link,
  "← Thoát", which is enough (the same reasoning as
  [`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md)).
- **Two panes.** LEFT is context and conversation: the question, the interviewer, progress, the
  answer field. RIGHT is the workspace as TOOL TABS — Whiteboard · Code · Notes (`tabs` component
  canon; `product/assessment-surface-integrity-and-grade-at-end` rule 3). The workspace is a
  FIRST-CLASS pane, never a "+ add" toggle hidden underneath.
- Grid `lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`; each pane scrolls on its own (`ScrollShadow`)
  rather than letting the whole page scroll.

## Hard two-pane, or a workspace that opens on demand

Choose by how often the work actually needs the tool.

- **Hard two-pane** when the work ALWAYS needs the workspace: system design (drawing throughout),
  code solving (typing throughout).
- **One wide column with a pane that opens on demand** when MOST questions need no tool — spoken
  Q&A, for example. The surface stays full-bleed and one wide column, and the workspace opens for
  the questions that need it, so a debug question shipping given-code opens the Code pane itself.
  This keeps the teaching decision — do not spend half the screen on a question that needs no
  drawing or code — while still avoiding a cramped column. It is the default for Q&A.

Never let the workspace degrade into a "+ add" link hidden below a narrow column.

## Mobile

Two panes STACK vertically: context on top, workspace below as a tab strip or a collapsible (see
[`responsive-regions.md`](responsive-regions.md)). One job per screen; two panes side by side do not
fit a narrow viewport.

## First applied 2026-07-07

Mock Interview, phase `interview`: **open-on-demand for `qna`** (one wide column, the Code pane
opening itself when the question ships given-code) and **hard two-pane for `design`** (the
whiteboard is in use throughout) — ONE shared full-bleed shell that differs only in when the pane
opens, rather than two separate layouts. The route turns on `fullBleed` when `phase === "interview"`,
and the workspace is a first-class pane with the hidden toggle removed. Prototype:
`fe/prototypes/mock-interview.html`.

## Related

[`surface-job-drives-layout.md`](surface-job-drives-layout.md) ·
[`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) ·
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) ·
[`page-shell-selection.md`](page-shell-selection.md) (question 1) ·
[`responsive-regions.md`](responsive-regions.md) · `tabs` ·
`product/assessment-surface-integrity-and-grade-at-end`.
