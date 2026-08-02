# Search, count, list, pager — the minimum anatomy of any browsable list surface

> Shell and route: `CourseCatalog` and `JobList`. This file is the anatomy **shared** by lists that
> need no tile or grid; the `catalog-grid` pattern is the full version, with the grid-to-line toggle.
> The same shape appears inside the rail of `Practice` and `SettingsLayout` when the rail has a
> search box.

## When this applies

Any list that can grow long enough to need filtering or browsing — including lists with no card or
tile at all, where plain rows are enough.

## Four parts, in a fixed vertical order

**1. Search** — a filtering input, debounced by roughly 300–350ms before it reaches the backend, and
it **always resets the page to 1** when the query changes. A stale page number against a shorter
result set shows an empty page the user cannot explain.

**2. Count** — on the right of the same row as the search, muted, `body-sm shrink-0`, reading
`"Tìm thấy {n}…"`. `n` is the **filtered** count, not the total; the point of the line is to confirm
the filter did something.

**3. List** — each item goes through `AsyncContent` (`error → loading → empty → content`), and the
skeleton mirrors the real layout so nothing jumps when the data resolves.

**4. Pager** — left-aligned, flush with the item edge. Two treatments, and neither is the default:
hidden when `totalPages ≤ 1` (`JobList`), or always visible to keep the UI stable on a list that is
certain to keep growing (`CourseCatalog`). Decide from the context.

**Filter facets** are optional and sit between the search row and the list. Each facet is its own
single-select control (`FlexWrapButtonRadio`) **on its own line** — they are not crammed onto the
search row.

## Related

`layout-must-funnel-to-courses-and-cover-full-data-state-matrix.md` — the empty, 1, N and overflow
states this list must define · `asynccontent-remove-debug-hold.md` — the `AsyncContent` priority
chain.
