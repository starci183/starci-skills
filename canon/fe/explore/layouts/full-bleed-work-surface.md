# Full-bleed WORK surface — one focused job, the site nav dropped, one way back

> The archetype for the job "focus on one piece of work, possibly with a tool for it". Distinct from
> the pure canvas of
> [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md),
> which carries no task pane at all. Web precedent: focus and Zen modes (VS Code's Zen mode, reader
> modes in browsers) HIDE the surrounding navigation so the screen goes to the work; single-problem
> practice sites give the problem and the submission area with no site nav attached; paired coding
> and interview tools split the screen into context and workspace.

## The frame — STRICT

- **Full-bleed: DROP the content rails and the page chrome.** Navigation around the work is noise
  while the work is being done. A reader who came to solve one item did not come to browse the tree,
  and keeping the tree only squeezes the working area.
- **The way BACK must exist and be visible on the surface itself.** Dropping the rails is only
  acceptable because the surface carries its own exit: one back-link to the place that sent the
  reader here. One step back, never a dead end. The full tree still lives on that parent surface, so
  the loop is parent, focused work, back, pick the next item.
- **A narrow surface-to-surface icon rail may STAY.** It is chrome belonging to the application, not
  to the content being browsed; it costs a few dozen pixels and keeps the reader from being stranded
  in a shell with only one door.
- Where there are two panes, each pane scrolls on its own rather than letting the whole page scroll,
  so neither pane can push the other out of view.

## One pane or two — choose by how often the work needs the tool

- **Hard two-pane** when the work ALWAYS needs the workspace: diagramming throughout, typing code
  throughout. LEFT is context and conversation — the question, the prompt, progress, the answer
  field. RIGHT is the workspace, and when it holds several tools they are TABS, never a stack. The
  split is even; two equal columns say the two halves matter equally, which is exactly the claim
  being made.
- **One wide column with a pane that opens on demand** when MOST of the work needs no tool. The
  surface stays full-bleed and one wide column, and the workspace opens for the cases that need it,
  including opening itself when the task ships something to work on. This keeps the honest decision
  — do not spend half the screen on a step that needs no tool — while still avoiding a cramped
  column.

Never let the workspace degrade into an "add" link hidden below a narrow column. If a tool is part
of the job, it is a first-class pane; if it is not part of the job, it does not belong on the
surface.

## Distinguish a focused surface from a reading one

- **A reading page KEEPS its content tree and its on-this-page rail**, because browsing while
  reading is exactly what needs the tree. Only the focused leaf goes full-bleed.
- **Distinguish a tab from a route.** A query parameter that switches a panel inside the same page
  is still that page, and it KEEPS the rail. A route segment that lands on one item is the focused
  surface and goes full-bleed. Confusing the two strips the rail from a reader who never left the
  reader.

## A multi-phase route cannot be decided at the shell

When one route passes through several phases — set up, work, wait, read the result — only the
working phase belongs to this archetype. A route-level full-bleed flag sees the URL and never the
client-side phase, so a phase that needs a narrow reading column applies that measure in the
component itself rather than relying on the shell. See
[`surface-job-drives-layout.md`](surface-job-drives-layout.md).

## Mobile

Two panes STACK vertically: context on top, workspace below as a tab strip or a collapsible (see
[`responsive-regions.md`](responsive-regions.md)). One job per screen; two panes side by side do not
fit a narrow viewport.

## Related

[`surface-job-drives-layout.md`](surface-job-drives-layout.md) ·
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) ·
[`page-shell-selection.md`](page-shell-selection.md) (question 1) ·
[`responsive-regions.md`](responsive-regions.md) · [`when-rail.md`](when-rail.md).
