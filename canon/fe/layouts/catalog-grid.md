# Catalog grid/line — search, count, grid/line toggle, card list, pager

> The shell for browsing N items of ONE kind. Grounded in two routes: `CourseCatalog`
> (`src/components/features/course/CourseCatalog/index.tsx`, route `/courses`), which carries a
> grid/line toggle that persists, and `JobList`
> (`src/components/features/careers/Jobs/JobList/index.tsx`, route `/jobs`), which is row-ONLY and
> has no toggle at all.

## When to use

Browsing N items of the same kind, where the item is either simple enough to tile (a course) or so
rich in fields that it must always be a row. `JobList` is row-only because one posting carries
title, company, location, mode and salary — five fields that do not survive being squeezed into a
tile, so there is nothing for a toggle to switch to.

This is the FULL form, the one with tiles. When the item needs no grid at all, the minimal anatomy
is `search-filter-list-surface`.

## Region map

1. **`PageHeader`** — breadcrumb and title, plus `actions` when the surface has a secondary CTA (the
   "Đăng tin" button on `JobList`).
2. **Search row** — input on the left (`w-full sm:max-w-sm`); on the right the muted result count
   and, optionally, the grid/line toggle: an icon-only `SegmentedControl`, persisted to
   `localStorage`.
3. **Filter row**, only when the surface has facets — one `FlexWrapButtonRadio` per facet,
   single-select, on its OWN line below the search row. Facets crammed onto the search row leave
   neither the input nor the facets a readable width.
4. **List**, through `AsyncContent` — the skeleton MIRRORS whichever view is currently selected. A
   grid skeleton is not a line skeleton, and using one for both makes the layout jump when the data
   resolves. Grid is `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; line and row-only are
   `SurfaceListCard` plus rows.
5. **Pager** — `Pagination`, left-aligned flush with the item edge. HeroUI does not bake in a hover
   state here, so add `hover:bg-default`.

## Two empties, not one

`JobList` separates them, because they need different exits:

- **platform-empty** — zero items in the whole system, no filter applied. The exit is a two-way
  funnel: nobody has posted yet, would you post one?
- **filtered-empty** — a filter is applied and nothing matches it. The exit is "clear the filter".

Collapsing both into one empty state hands the wrong exit to at least one of the two causes.

## Related

`search-filter-list-surface` (the shared anatomy, when no grid is needed) ·
`layout-must-funnel-to-courses-and-cover-full-data-state-matrix` (the empty / one / N / overflow
matrix) · `card` component canon (grid and line `CourseCard`, same radius in both views) ·
[`page-shell-selection.md`](page-shell-selection.md).
