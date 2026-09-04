# uat-plan — feature

One paragraph: which mission goal was read, how many journeys it names, which surface map supplied
the entry routes, and which flow folders already existed. Written by `uat.plan` as
`response/response.md`; every Flows row has an entry with the same id in `response/data/units.json`,
and each flow is walked on its own branch with its own account alias and seed namespace, so no two
walkers share a row.

## Flows

| Flow | Entry | Steps | Account | Seed namespace |
| --- | --- | --- | --- | --- |
| `open-item` | `/items` | 4 | `viewer-open` | `uat-open-item` |
| `remove-item` | `/items` | 5 | `viewer-remove` | `uat-remove-item` |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
