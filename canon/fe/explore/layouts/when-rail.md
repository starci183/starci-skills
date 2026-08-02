# WHEN to use a left RAIL (two-pane master-detail), and when not to

> The heuristic for the rail decision, gathering the scattered rail rules into one place. The quick
> question: *does this surface have ONE nav axis plus a list LONG ENOUGH to feed a rail?* A rail is
> the most expensive region on a page — it takes horizontal space on every single view, forever — so
> it has to be paying for that space in navigations saved.

## The root rule — STRICT

- **DEFAULT is NO rail.** A centered single column at a narrow measure is the default for every
  page. **A rail is an exception that must be EARNED**, never the starting layout. If an application
  shell already provides a way to move between surfaces, a second rail inside the page is heavy, and
  goes empty or lopsided the moment the content does not fill it. If you are looking at a second
  rail and are in doubt, REMOVE it.
- **A rail — the left nav column of a two-pane layout — is used ONLY when the surface has one nav
  axis AND one list of items long enough to browse**: a section-to-page tree, a folder list, a topic
  list, a category list. A rail is durable navigation or filtering over a rich set of items. There
  must be at least one REAL sub-list, and it must be long.
- **No list to feed it means no rail.** Two or three mode toggles are not a list. Putting them in a
  rail leaves a column of whitespace next to the content, and the page reads as lopsided rather than
  as spacious.
- **The "earn the rail" test:** (1) is there a sub-list of roughly five items or more to browse?
  (2) does that list SURVIVE every state of the surface, rather than vanishing in one mode? Fail
  either one and there is NO rail.

## The decision table

| Situation | Layout |
|---|---|
| One nav axis plus a **long list** (a content tree, folders, topics, categories) | **two panes: left rail plus right pane** ([`master-detail-rail.md`](master-detail-rail.md)) |
| Nav of only **two or three modes**, no sub-list | **tabs or a segmented control at the top of the pane**, plus one column |
| A focused single-job work surface | **full-bleed, content rails dropped** ([`full-bleed-work-surface.md`](full-bleed-work-surface.md)) |
| A canvas filling the viewport | **full-bleed, no chrome** ([`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)) |
| One reading, setup or focused form column | **centered at a narrow measure, no rail** ([`centered-form-setup.md`](centered-form-setup.md)) |

The middle row is Hick's Law read the other way round: with two or three options the cost is not the
decision, it is the chrome built to present it. Tabs cost a row; a rail costs a column on every
view.

## WHERE the rail goes, if there is one

- **A route inside a shell** — the rail is the shell's left-rail slot, declared at layout level,
  with its state in the **URL**, because the rail and the pane are not in one component tree and
  local state cannot span them.
- **A STANDALONE route**, with no shell — a page-internal two-pane layout, where the content
  declares its own padding since no shell is doing it.

## Mobile — STRICT

A left vertical rail suits only wide viewports. On a narrow screen the rail is hidden and **folds
into a horizontally scrolling chip row** at the top of the pane, reading the same URL state. See
[`responsive-regions.md`](responsive-regions.md).

## Common traps

- **A surface with two modes where one HAS a list and the other does not.** A browse mode with a
  folder list, and a shuffle mode that draws at random from everything and therefore has nothing to
  list, are one surface with two different layout needs. **Do not force one layout on both.** The
  mode with a list gets the rail; the mode without gets one column plus tabs. Do not keep an empty
  rail in the list-less mode for the sake of symmetry: an empty rail is worse than an asymmetric
  layout, because the reader reads the emptiness as content that failed to load.
- **Count the items BEFORE choosing a rail.** Fewer than roughly four nav items and no sub-list
  means certainly no rail. Counting after the rail is built means arguing against work already done.
- **A rail that is really a filter.** That is legitimate — a category rail acting as a filter over
  the pane is still one nav axis over a long list — but it must then behave like a filter: a visible
  active state, and a way to clear it.

## Related

when-drawer (hiding the secondary behind a drawer) ·
[`master-detail-rail.md`](master-detail-rail.md) ·
[`docs-three-pane-reader.md`](docs-three-pane-reader.md) ·
[`responsive-regions.md`](responsive-regions.md) ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) and
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)
(full-bleed drops the rail) · [`page-shell-selection.md`](page-shell-selection.md).
