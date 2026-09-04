# surface-map — feature

One paragraph: which feature was mapped, from which reference and which source head, how many pages
and modals the map names, and what the shared shell is. Written by `interface.plan` as
`response/response.md`; every Map row has an entry with the same id and goal in
`response/data/units.json`, and each entry is generated on its own branch by the execute operator.

## Map

| Unit | Kind | Route or host | Goal |
| --- | --- | --- | --- |
| `item-list` | page | `/items` | list every item the viewer may open, with its state |
| `item-remove-confirm` | modal | hosted by `item-list` | confirm the removal of one item before it happens |

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

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
