# seed-plan — feature

One paragraph: which mission goal was read, which UAT plan and surface map supplied the flows and
the stores, which flow folders already carried a seed, and how many units the plan names. Written by
`data.plan` as `response/response.md`; every Units row has an entry with the same id and goal in
`response/data/units.json`, and each unit is placed on its own branch by the seeder under its own
namespace, so no two seeders share a row.

## Units

| Unit | Serves | Namespace | Goal |
| --- | --- | --- | --- |
| `open-item` | flow `open-item` | `uat-open-item` | the items a viewer opens stand in the catalogue at the list volume |
| `item-catalogue` | family `catalogue` | `uat-item-catalogue` | the catalogue the list page shows stands at its density before the page is judged |

## Targets

| Unit | Store | Attribution | Volume | Rollback |
| --- | --- | --- | --- | --- |
| `open-item` | `items` | owner | 3 | every items row the unit's account owns |
| `item-catalogue` | `items` | prefix | 24 | every items row whose id carries the unit's prefix |

## Fixtures

| Unit | State | Action | JSON | SQL | Expected | Creates outcome |
| --- | --- | --- | --- | --- | --- | --- |
| `open-item` | valid | reuse | `.worktrees/uat/items/open-item/seed/records.json` | — | the planned item rows are readable under the namespace | false |
| `item-catalogue` | missing | create | `.worktrees/uat/items/item-catalogue/seed/records.json` | `.worktrees/uat/items/item-catalogue/seed/records.sql` | the catalogue has the representative planned volume | false |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
