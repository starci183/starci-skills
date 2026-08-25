# `test/ui-quality-audit` output

The output contains one typed decision, one result for every declared UI-quality rule ID, immutable task-session evidence refs, and no mutation.

## JSON architecture

| Section | Meaning |
| --- | --- |
| `payload.decision` | Typed delivery or standalone route key. |
| `payload.state` | Operator state, code, retryability, and exact emitted route. |
| `payload.produced` | Receipt, structured per-rule results, sanitized artifact refs, and an always-empty mutation list. |
| `payload.context` | Refs and revisions used, never copied context. |
| `payload.cleanup` | Scratch inventory purged at the parent `skill-terminal`. |
| `payload.evidenceRefs` / `findings` | Immutable evidence refs and concise findings. |

| Decision | Route | Meaning |
| --- | --- | --- |
| `delivery-pass` | `test.ui.journey / ready` | Delivery checkpoint has complete green quality evidence. |
| `delivery-in-boundary` | `code.repair / repair` | At least one evidenced defect is repairable inside approved authority. |
| `delivery-boundary-drift` | `layout.review / rejected` | A correction would change an approved axis. |
| `audit-pass` | `ui.quality.result / complete` | Standalone audit has complete green quality evidence. |
| `audit-findings` | `ui.quality.result / ready` | Standalone audit found one or more evidenced failures. |
| `blocked` | `ui.quality.review / blocked` | A required verdict cannot be produced safely. |

Every applicable pass or failure carries evidence. `not-applicable` carries a bounded observation. `payload.produced.mutations` is always empty.
