# Choosing the page SHELL — rail vs full-bleed vs hub vs centered

> The first-tier decision doc: ask these questions in order BEFORE opening a new route, then turn
> into the specific archetype ([`docs-three-pane-reader.md`](docs-three-pane-reader.md) ·
> [`master-detail-rail.md`](master-detail-rail.md) · [`dashboard-hub.md`](dashboard-hub.md) ·
> [`catalog-grid.md`](catalog-grid.md) · [`centered-form-setup.md`](centered-form-setup.md) ·
> [`marketing-landing.md`](marketing-landing.md)).
>
> It gathers three separate rules — [`when-rail.md`](when-rail.md),
> [`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) and
> [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) —
> into ONE decision tree. Those three files are KEPT as the case-by-case detail and are not replaced
> by this one.

## The decision tree — ask in order, stop at the FIRST question that matches

1. **Does a canvas or tool occupy the WHOLE viewport for one focused job** (mind map, solving a
   single challenge)? → **full-bleed**, dropping every rail, all chrome and the breadcrumb. See
   [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)
   for the canvas and
   [`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md)
   for the solve surface, which keeps one back-link.
2. **Is there ONE nav axis plus a list long enough (roughly 5 items or more) to browse alongside the
   content?** → a two-pane rail. Then split: a third TOC or outline pane on the right, for
   multi-level documentation inside `LearnShell`, means
   [`docs-three-pane-reader.md`](docs-three-pane-reader.md); two panes only — a rail and a work
   pane on a standalone route — means [`master-detail-rail.md`](master-detail-rail.md). The "earn
   the rail" test is in [`when-rail.md`](when-rail.md): fewer than 5 items, or no real sub-list, and
   there is NO rail.
3. **Several PEER areas of content under one identity or scope, switched by TAB rather than by
   hierarchical nav?** → [`dashboard-hub.md`](dashboard-hub.md), a tab strip on the navbar bottom
   layer over a two-column bare-identity and panel body.
4. **Browsing N items of the SAME kind** (course, job, deck)? → [`catalog-grid.md`](catalog-grid.md)
   — search, count, grid/line toggle, pager. When the item does not need tiling, use the minimal
   anatomy in `search-filter-list-surface` instead.
5. **One focused task or form with no secondary nav** (checkout, cart, post form, session setup)? →
   [`centered-form-setup.md`](centered-form-setup.md), one column and no rail.
6. **Public selling or storytelling, no login?** → [`marketing-landing.md`](marketing-landing.md).

Nothing matches → default to a **centered single column, `max-w-3xl mx-auto`**. It is the safest
choice; see [`when-rail.md`](when-rail.md), section "DEFAULT is NO rail".

## Anti-patterns already caught in the real app

- A rail left EMPTY because the mode has only two or three options rather than a list. Drop the
  rail; see [`when-rail.md`](when-rail.md), section "Traps".
- A full-bleed surface still carrying a breadcrumb or page chrome, which erases the definition of
  full-bleed.
- A dashboard hub rebuilding a nav rail instead of a tab strip for the job of "switch content
  area". That is question 3, not question 2.

## Related

[`when-rail.md`](when-rail.md) · `when-drawer` ·
[`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) ·
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) ·
[`docs-three-pane-reader.md`](docs-three-pane-reader.md) ·
[`master-detail-rail.md`](master-detail-rail.md) · [`dashboard-hub.md`](dashboard-hub.md) ·
[`catalog-grid.md`](catalog-grid.md) · [`centered-form-setup.md`](centered-form-setup.md) ·
[`marketing-landing.md`](marketing-landing.md) · `search-filter-list-surface`.
