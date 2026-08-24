# `be/repair-prerequisite-check` output

The output is ephemeral and machine-routable.

## JSON architecture

`payload.state` owns the typed decision and emitted route; `produced` contains only a session receipt; `context` records metadata lineage; `cleanup` purges every intermediate at `skill-terminal`.

| Decision | State | Route | Meaning |
| --- | --- | --- | --- |
| `ready` | completed | `be.coding-scope / ready` | Route, business revision, approved boundary and repair finding agree. |
| `route-required` | replan | `request.received / ready` | Route receipt is missing, stale, ambiguous or foreign. |
| `business-refresh-required` | replan | `business.freshness / ready` | The bound business head/freshness receipt is no longer current. |
| `replan-required` | replan | `architecture.boundary / ready` | Approval, plan hash, baseline or finding boundary has drifted. |
| `blocked` | blocked | `be.blocked / blocked` | The mismatch has no safe declared repair edge. |

Only `ready` produces `prerequisiteReceiptRef`. No durable write is permitted.
