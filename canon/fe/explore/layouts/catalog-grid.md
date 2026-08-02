# Catalog grid/line — search, count, view toggle, card list, pager

> The shell for browsing N items of ONE kind. The shape is settled across the industry: Baymard's
> product-listing research describes the same regions — a search field, a visible result count,
> filters that do not compete with the search input, the list itself, and a pager — and Material's
> canonical "feed" layout describes the tiling half of it.

## When to use

Browsing N items of the same kind, where the item is either simple enough to tile or so rich in
fields that it must always be a row.

The number of FIELDS per item decides whether a grid/line toggle exists at all. A product with an
image, a name and a price tiles well, so both views are readable and a toggle is worth offering. A
job posting carrying title, company, location, work mode and salary does not survive being squeezed
into a tile: five fields need a row, so there is nothing for a toggle to switch to and the surface
is row-only. Offer a toggle only when both views are genuinely readable; a toggle whose second
option is worse is a choice that costs the reader attention and returns nothing (Hick's Law).

This is the FULL form, the one with tiles. When the item needs no grid at all, the minimal anatomy
is the plain search-filter-list surface.

## Region map

1. **Page header** — breadcrumb and title, plus an actions slot when the surface has a secondary
   action of its own ("Post a listing" on a job board, "New document" on a document library).
2. **Search row** — the input on the left, capped so it does not run the full width of a wide
   screen; on the right the muted result count and, optionally, the view toggle as an icon-only
   segmented control, persisted so the reader's choice survives a reload. A count is not decoration:
   it is the feedback that tells a reader whether their filter did anything (Nielsen's visibility of
   system status).
3. **Filter row**, only when the surface has facets — one wrapping single-select control per facet,
   on its OWN line below the search row. Facets crammed onto the search row leave neither the input
   nor the facets a readable width.
4. **List**, through the async wrapper — the skeleton MIRRORS whichever view is currently selected.
   A grid skeleton is not a line skeleton, and using one for both makes the layout jump when the
   data resolves. Grid runs one column, two at the medium breakpoint, three at the large one; line
   and row-only run a list container plus rows.
5. **Pager** — left-aligned flush with the item edge, so the eye returns to the same left margin it
   has been scanning down.

## Two empties, not one

They need different exits, so they are different states:

- **Nothing exists yet** — zero items in the whole system, no filter applied. The exit is a
  two-way funnel: nobody has posted yet, would you post one?
- **Nothing matches** — a filter is applied and nothing matches it. The exit is "clear the filter",
  and naming the filter that killed the result is what turns a dead end into a recoverable step.

Collapsing both into one empty state hands the wrong exit to at least one of the two causes. This
is Nielsen's error-recovery heuristic applied to a state that does not look like an error.

## Related

The plain search-filter-list surface (the shared anatomy, when no grid is needed) ·
`every-surface-offers-a-path-onward` (the empty / one / N / overflow matrix) ·
[`page-shell-selection.md`](page-shell-selection.md).
