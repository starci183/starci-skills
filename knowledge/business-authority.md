# Business authority lifecycle

| Field | Value |
| --- | --- |
| Knowledge ID | `business.authority-lifecycle` |
| Operators | `evidence-normalize, model, publish, reconcile` |
| Search tags | `business, evidence, model, pending, in-progress, implemented, rejected, reconcile` |
| Dependencies | `workspace.routing` |

## Record

Business authority is an immutable feature-head state machine backed by routed FE/BE evidence and explicit owner intent. Separate fact, intent, example, unknown, and contradiction before modeling actors, goals, rules, states, operations, failures, surfaces, and acceptance.

Publishing owns lifecycle transitions: new accepted intent becomes `pending`; exact business-affecting implementation advances that head to `in-progress`; proved source reconciles it to `implemented`; rejection preserves lineage. Technical-only work binds an existing implemented head without advancing it. Every claim cites role, path, line range, head, and kind. Examples and screenshots never create product truth.
