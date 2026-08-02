# Search, count, list, pager — the minimum anatomy of any browsable list surface

> Baymard's research on list and category pages is the grounding: the recurring failures are filters
> that give no feedback, result counts that do not reflect the filter, and pagination that loses the
> reader's place. Each part below exists to close one of those.

## When this applies

Any list that can grow long enough to need filtering or browsing — a product catalogue, a job list, a
document library, an audit log — including lists with no card or tile at all, where plain rows are
enough. The grid version of this anatomy, with a grid-and-rows toggle and the page around it, is the
catalogue layout on the layouts shelf; this file is the part they share.

## Four parts, in a fixed vertical order

**1. Search** — a filtering input, debounced by roughly 300 to 350 milliseconds before it reaches the
server, which **always resets the page to one** when the query changes. A stale page number against a
shorter result set shows an empty page the reader cannot explain and has no obvious way out of.

**2. Count** — on the right of the same row as the search, muted and small, reading "Found 24
results". The number is the **filtered** count, not the total: the point of the line is to confirm
that the filter did something, which is the feedback a filter otherwise never gives.

**3. List** — the region resolves through the standard chain of error, loading, empty and content,
and the skeleton mirrors the real row so nothing jumps when the data lands.

**4. Pager** — left-aligned, flush with the item edge. Two treatments, and neither is the default:
hidden when there is only one page, or always visible to keep the layout stable on a list that is
certain to keep growing. Decide from the context, and write down which one this surface chose.

**Filter facets** are optional and sit between the search row and the list. Each facet is its own
single-select control **on its own line**. Crowding them onto the search row makes both harder to
read and makes the count line, which belongs to the search, look like it belongs to the facets.

## Related

`every-surface-offers-a-path-onward.md` — the empty, one, many and overflow states this list must
define · `loading-state-carries-no-artificial-hold.md` — the priority chain each region resolves
through.
