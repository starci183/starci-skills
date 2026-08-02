# Regions that CHANGE with the screen — responsive and adaptive

> A region changes how it is arranged with the viewport, and there are two different mechanisms
> behind that sentence
> ([supercharge.design](https://supercharge.design/articles/adaptive-layout-vs-responsive-layout)):
> **responsive** is fluid within ONE shape (a capped width, wrapping); **adaptive** CHANGES the shape
> or the shell at a breakpoint (a rail becomes chips, two panes become a stack). Material's window
> size classes and Fluent 2's layout guidance both assume the second, not only the first. A third
> mechanism sits alongside them: adaptive-by-task, where the layout follows the JOB rather than the
> width ([`surface-job-drives-layout.md`](surface-job-drives-layout.md)).

## Adaptive rules — STRICT

- **A vertical rail exists only at the large breakpoint.** On a narrow screen it FOLDS into a
  horizontally scrolling CHIP row at the top of the pane, reading the same URL state: the rail is
  hidden below the breakpoint, the chip row hidden above it. A rail hidden with nothing in its place
  means the navigation is simply gone.
- **Sibling mobile bars must share POSITION, and may differ only in CONTENT.** A shell that picks
  one of two bars depending on the page — a three-tab bar for a reader, a single drawer button for
  everything else — is picking correctly: a reader needs three views, other pages need one drawer.
  It is not free to also move them. Put one bar at the bottom and its sibling below the navbar, and
  every page carrying the second one reads as though it has LOST its navigation entirely: all that
  is left is a faint line of links at the top where a solid bar sits on the neighbouring page.
  Consistency of position is what lets a reader stop looking for the control (Nielsen's consistency
  and standards).

  Two consequences follow. Both bars take the same position and the same height, so the swap is
  invisible. And the shell's bottom padding — the space reserved so content is not covered by a
  fixed bar — is applied ALWAYS rather than only for the variant that happened to be fixed first;
  reserving space conditionally is how the last line of a page ends up under a bar.
- **Two panes STACK on mobile**: context on top, workspace or detail below as a tab strip or a
  collapsible ([`full-bleed-work-surface.md`](full-bleed-work-surface.md)).
- **Reposition and reflow** (Material, Fluent 2): a vertical card becomes horizontal, a floating
  action button becomes a nav rail as width allows. Use it when there is room; do not cram.
- **Swap the overlay by modality:** on desktop a drawer or a modal beside the content, on mobile a
  bottom sheet.

## Responsive — fluid, same shape

- A capped container width, centered; wrapping for chips and buttons; and permission to shrink along
  the whole flex chain, since one child that refuses to shrink defeats every ancestor's max-width.
- **A block WIDER than the column SCROLLS instead of breaking the layout** — diagrams, tables, wide
  code. The overflow belongs to that block, never to the page: a page that scrolls horizontally has
  lost its left margin for every element on it.
- Reserve the scrollbar gutter so content does not jump sideways when a scrollbar appears.

## Gotchas

- Changing shape at a breakpoint must keep ONE source of state, and the URL is the right one. Never
  two states, one for desktop and one for mobile: they will disagree the first time a reader rotates
  a tablet.
- A layout that changes shape must be checked in the SHAPE IT CHANGES TO. Most breakpoint bugs are
  not wrong values; they are branches nobody looked at.

## Related

[`region-model.md`](region-model.md) ·
[`surface-job-drives-layout.md`](surface-job-drives-layout.md) ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) ·
[`master-detail-rail.md`](master-detail-rail.md) · when-drawer.
