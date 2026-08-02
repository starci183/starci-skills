# Docs 3/4-pane reader — icon rail, content tree, reading column, on-this-page TOC

> The documentation archetype, in the shape used by Stripe Docs, Docusaurus and MDN: browse the
> content tree on the LEFT, read in the MIDDLE, orient inside the current page on the RIGHT. Each
> pane answers a different question — where can I go, what am I reading, where am I inside it — and
> that is why three panes are justified here and nowhere else.

## When to use

Deeply HIERARCHICAL content (section to page to heading) that has to be browsed CONTINUOUSLY while
reading, rather than a single self-contained task. Two or three modes are not a tree; that case is
not this archetype and goes back to [`page-shell-selection.md`](page-shell-selection.md).

## Region map, left to right

1. **Icon rail** — always visible from the large breakpoint. It moves between SURFACES rather than
   within one, is sticky below the navbar, runs full height, and takes care of its own scrolling,
   dividers and collapse.
2. **Content-tree rail** — the tree of the CURRENT surface, ALWAYS visible with no collapse, and
   supplied by the route's layout rather than by the page inside it. Collapsing the tree that the
   archetype exists to expose defeats the reason for choosing this shell.
3. **Reading column** — the main content at a narrow measure, centered. **Padding is owned by the
   SHELL**: a feature never declares its own padding here, except under the full-bleed opt-out.
   Padding declared twice is padding nobody can predict.
4. **On-this-page rail** — the in-page table of contents, optional per route, with an optional
   collapse handle when a route needs one. It is orientation, not navigation: it tells the reader
   how much of the current page is left.

**Mobile** — the columns fold into a bottom tab bar whenever there is a content tree, giving the
reader the same three views (contents, page, on this page) one at a time. A route that is not a
reader uses the simpler bar instead, but at the same position — see
[`responsive-regions.md`](responsive-regions.md).

**Full-bleed opt-out** — a canvas that fills the viewport drops both the shell padding and the
rails. At that point the surface has left this archetype; see
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md).

## Related

[`when-rail.md`](when-rail.md) · `sibling-surfaces-share-chrome` (each surface's home shares this
same chrome) ·
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) ·
[`page-shell-selection.md`](page-shell-selection.md).
