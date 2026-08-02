# Choosing the page SHELL — rail vs full-bleed vs hub vs centered

> The first-tier decision doc: ask these questions in order BEFORE opening a new route, then turn
> into the specific archetype ([`docs-three-pane-reader.md`](docs-three-pane-reader.md) ·
> [`master-detail-rail.md`](master-detail-rail.md) · [`dashboard-hub.md`](dashboard-hub.md) ·
> [`catalog-grid.md`](catalog-grid.md) · [`centered-form-setup.md`](centered-form-setup.md) ·
> [`marketing-landing.md`](marketing-landing.md)).
>
> It gathers the scattered shell rules — [`when-rail.md`](when-rail.md),
> [`full-bleed-work-surface.md`](full-bleed-work-surface.md) and
> [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) —
> into ONE decision tree. Those files are KEPT as the case-by-case detail and are not replaced by
> this one. Material calls the same idea canonical layouts: a small closed set of arrangements, so
> that choosing one is a decision with a name rather than an improvisation.

## The decision tree — ask in order, stop at the FIRST question that matches

1. **Does a canvas or a tool occupy the WHOLE viewport for one focused job?** Full-bleed, dropping
   the content rails, the page chrome and the breadcrumb. See
   [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)
   for a pannable canvas and [`full-bleed-work-surface.md`](full-bleed-work-surface.md) for a work
   surface, which keeps one back-link and possibly a second pane.
2. **Is there ONE nav axis plus a list long enough — roughly five items or more — to browse
   alongside the content?** A two-pane rail. Then split: a third orientation pane on the right, for
   multi-level documentation inside a reading shell, means
   [`docs-three-pane-reader.md`](docs-three-pane-reader.md); two panes only, a rail and a work pane
   on a standalone route, means [`master-detail-rail.md`](master-detail-rail.md). The "earn the
   rail" test is in [`when-rail.md`](when-rail.md): fewer than five items, or no real sub-list, and
   there is NO rail.
3. **Several PEER areas of content under one identity or scope, switched by TAB rather than by
   hierarchical nav?** [`dashboard-hub.md`](dashboard-hub.md), a tab strip below the navbar over a
   two-column bare-identity and panel body.
4. **Browsing N items of the SAME kind?** [`catalog-grid.md`](catalog-grid.md) — search, count, view
   toggle, pager. When the item does not need tiling, use the minimal search-filter-list anatomy
   instead.
5. **One focused task or form with no secondary nav** (a cart, a checkout, a post form, a session
   setup)? [`centered-form-setup.md`](centered-form-setup.md), one column and no rail.
6. **Public selling or storytelling, no login?** [`marketing-landing.md`](marketing-landing.md).

Nothing matches: default to a **centered single column at a narrow measure**. It is the safest
choice, because it is the only one that cannot be wrong for the wrong reason — see
[`when-rail.md`](when-rail.md), section "DEFAULT is NO rail".

## Anti-patterns

- A rail left EMPTY because the nav has only two or three options rather than a list. Drop the rail;
  see [`when-rail.md`](when-rail.md), section "Common traps".
- A full-bleed surface still carrying a breadcrumb or page chrome, which erases the definition of
  full-bleed and leaves a surface that is neither.
- A hub rebuilding a nav rail instead of a tab strip for the job of "switch content area". That is
  question 3, not question 2, and the difference is whether the areas are peers or a hierarchy.
- Asking the questions out of order. The tree is ordered by how much the answer constrains
  everything downstream; answering question 4 first produces a catalog page that then has to be
  argued into a shell it does not fit.

## Related

[`when-rail.md`](when-rail.md) · when-drawer ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) ·
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) ·
[`docs-three-pane-reader.md`](docs-three-pane-reader.md) ·
[`master-detail-rail.md`](master-detail-rail.md) · [`dashboard-hub.md`](dashboard-hub.md) ·
[`catalog-grid.md`](catalog-grid.md) · [`centered-form-setup.md`](centered-form-setup.md) ·
[`marketing-landing.md`](marketing-landing.md) ·
[`surface-job-drives-layout.md`](surface-job-drives-layout.md).
