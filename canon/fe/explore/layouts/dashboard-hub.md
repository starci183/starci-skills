# Dashboard hub — tab strip under the navbar over a bare-identity plus panel two-column

> The shell for several PEER areas of content under one identity or scope. The public reference
> shape is a code-hosting profile page: a tab strip pinned under the global header, a bare identity
> column on the left that never changes, and one panel on the right. Material and Fluent 2 both draw
> the same line — tabs are for peer content at the same level, single-select and mutually exclusive;
> a rail is for hierarchy.

## When to use

Several peer areas under one scope (Overview, Activity, Items, Community, and so on), where the nav
is not hierarchical and therefore needs no rail — see [`when-rail.md`](when-rail.md). Switching area
is a TAB, not a button group: a button group says "do something", a tab says "you are looking at one
of these".

One archetype can serve more than one subject. A signed-in owner's hub and the public view of the
same identity are the same layout with different panels; building them as two layouts guarantees
they drift.

## Region map

1. **Tab strip = the layer directly below the navbar.** It carries no sticky and no border of its
   own: the navbar root owns the single bottom border, which falls below the last layer. A second
   border here reads as two separate bars stacked on each other.
2. **Body** — centered at a wide measure, two columns from the medium breakpoint:
   - **Left aside**, fixed width and not shrinking — identity and standing, BARE rather than wrapped
     in a card, and it STAYS PUT across every tab. A card around it would claim it is one panel
     among several, when in fact it is the scope all the panels belong to.
   - **Right main**, allowed to shrink and taking the remaining width — the panel of the tab
     currently selected. **Only the active panel MOUNTS**: each tab runs its own query lazily, so an
     unselected tab neither renders nor fetches while idle.
3. **Mobile** — aside first, then content, stacked VERTICALLY in the same DOM order. No rail, no
   drawer. The identity is the context for everything below it, so it reads first.

The current tab lives in the URL as a query parameter, read and written through shared state rather
than local component state, so a link to a particular tab can be shared and the browser's back
button means what the reader expects.

## Related

[`when-rail.md`](when-rail.md) (why there is no rail here) ·
`home-does-not-duplicate-navigation` and `completed-task-returns-not-auto-forwards` (the information
architecture around a home and a hub: do not repeat a surface, do not auto-forward away from the
hub) · [`page-shell-selection.md`](page-shell-selection.md).
