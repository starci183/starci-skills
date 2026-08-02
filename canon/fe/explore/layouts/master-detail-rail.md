# Master-detail rail — left rail plus work pane, URL-synced, on a STANDALONE route

> Material names this one of the canonical layouts — list-detail: a browsable list on one side, the
> selected item's detail on the other. Mail clients, settings sections and file managers are all the
> same archetype, and the reason it holds is that the list is durable context: the reader will pick
> again in a moment, so hiding the list between picks costs a navigation every time.

## When to use

A STANDALONE route — one with no surrounding documentation shell — that still has a single NAV AXIS
and a list long enough to browse (a topic list, the set of settings pages, a folder tree) standing
beside a work pane.

Two things separate it from [`docs-three-pane-reader.md`](docs-three-pane-reader.md): there are only
two panes, with no third orientation pane, and the CONTENT declares its own padding because there is
no shell to do it. Whichever of the two owns the padding, exactly one of them does.

## Region map

1. **Rail**, on the left, hidden below the large breakpoint, sticky under the navbar and running the
   remaining viewport height. Two kinds, chosen by what the nav actually is:
   - **Resizable** when the rail holds nav items of VARYING width — a mode switch plus a long list
     of user-named items, where no fixed width is right for everyone. Persist the chosen width.
   - **Collapsible fixed** when the rail is a FIXED menu whose labels are known and short. It
     collapses to icons only, and that choice persists too.
   The distinction is not cosmetic: a resizable rail exists because the content's width is unknown,
   and a collapsible one exists because the reader sometimes wants the space back.
2. **Work pane**, on the right, allowed to shrink and taking the remaining width — page header
   (breadcrumb and title) then the content. The pane's state, meaning which item is being viewed, is
   read from the URL and not from local state living inside the rail; otherwise the rail and the
   pane can disagree about what is selected, and neither the back button nor a shared link means
   what the reader expects.
3. **Mobile** — the rail is hidden and folds into a horizontally scrolling row of chips, or a
   scrolling nav row stuck below the navbar, reading the same URL state. A rail hidden with nothing
   in its place means the navigation is simply gone; see
   [`responsive-regions.md`](responsive-regions.md).

## Related

[`when-rail.md`](when-rail.md) · [`docs-three-pane-reader.md`](docs-three-pane-reader.md) (the
three-pane variant, which lives inside a documentation shell) ·
[`responsive-regions.md`](responsive-regions.md) ·
[`page-shell-selection.md`](page-shell-selection.md).
