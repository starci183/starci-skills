# `be/coding-scope-freeze` output

## JSON architecture

`payload.state` owns the typed decision and route. `produced` contains only frozen metadata and a session receipt, never source. `context` contains exact lineage and `cleanup` purges every intermediate at `skill-terminal`.

| Decision | Route | Meaning |
| --- | --- | --- |
| `ready` | `be.repair / ready` | Exact target set, baseline and allowed changes are frozen. |
| `source-drift` | `architecture.boundary / ready` | HEAD or an existing target hash changed. |
| `boundary-drift` | `architecture.boundary / ready` | A target escapes or disagrees with the approved boundary. |
| `blocked` | `be.blocked / blocked` | Safe deterministic hashing/scope binding is unavailable. |

Only `ready` produces a session-only `codingScopeRef` and targets. No source content or durable write is returned.
