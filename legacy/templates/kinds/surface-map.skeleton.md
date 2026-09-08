# surface-map — feature

One paragraph: which feature was mapped, from which reference and which source head, how many pages
and modals the map names, and what the shared shell is. Written by `interface.plan` as
`response/response.md`; every Map row has an entry with the same id, goal and tier in
`response/data/units.json`, and each entry is generated on its own branch by the execute operator.
Only a `journey` unit is audited afterwards; a `secondary` one is recorded as unchecked under
`@worktrees/unchecked` with the reason its Tier cell carries.

## Map

| Unit | Kind | Route or host | Goal | Tier |
| --- | --- | --- | --- | --- |
| `item-list` | page | `/items` | list every item the viewer may open, with its state | journey |
| `item-remove-confirm` | modal | hosted by `item-list` | confirm the removal of one item before it happens | journey |
| `item-archive` | page | `/items/archive` | show the items the viewer has archived | secondary — no done-when line of this mission reaches the archive |

## Shell

| Element | Owner | Decided |
| --- | --- | --- |
| sidebar | the feature layout | the family's navigation composition, with the feature's entries in the navigation order below |
| header | the feature layout | the family's header composition carrying the feature title and the viewer menu |
| breadcrumb | each page | the family's breadcrumb composition, rooted at the feature entry |
| navigation order | the feature layout | items, then archive, then settings |

## Data contracts

| Unit | Reads | Writes |
| --- | --- | --- |
| `item-list` | the item list operation, paged | — |
| `item-remove-confirm` | one item by id | the item removal operation |
| `item-archive` | the archived item list operation, paged | — |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
