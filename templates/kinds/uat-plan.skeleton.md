# uat-plan — feature

One paragraph: which mission goal was read, how many journeys it names, which surface map supplied
the entry routes, and which flow folders already existed. Written by `uat.plan` as
`response/response.md`; every Flows row has an entry with the same id and tier in
`response/data/units.json`, and each `journey` flow is walked on its own branch with its own account
alias and seed namespace, so no two walkers share a row. A `secondary` flow is not walked: it is
recorded as unchecked under `@worktrees/unchecked` with the reason its Tier cell carries.

## Flows

| Flow | Entry | Steps | Account | Seed namespace | Tier |
| --- | --- | --- | --- | --- | --- |
| `open-item` | `/items` | 4 | `viewer-open` | `uat-open-item` | journey |
| `remove-item` | `/items` | 5 | `viewer-remove` | `uat-remove-item` | journey |
| `archive-item` | `/items` | 3 | `viewer-archive` | `uat-archive-item` | secondary — no done-when line of this mission walks the archive |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
