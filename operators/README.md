# Operators

An operator is one reusable, typed state transition with eight required files:

- `input.md`: JSON architecture, caller-provided references, runtime-resolved loads, and session ownership.
- `input.schema.json`: closed input JSON Schema.
- `output.md`: explicit operator state, produced mutations, context lineage, cleanup, evidence, and findings.
- `output.schema.json`: closed output JSON Schema.
- `operator.json`: accepted/emitted states, Qdrant knowledge references, side effects, and stop metadata only.
- `execute.md`: operator-specific steps naming reads, context, decision evidence, actions, session/durable writes, orchestration, joins, and stops.
- `validate-input.mjs`: fail-closed input validation before any processing.
- `validate-output.mjs`: fail-closed output validation before the chain may continue.

Operators do not choose when they run and do not invoke one another. A skill state machine owns guards, branches, loops, waits, and terminal states, then routes one artifact envelope to exactly one operator.

Invalid input stops at the boundary without side effects. Invalid output is never emitted or routed downstream.

Every operator input has three ownership sections: `provided` references from the previous state, `loads` resolved by the runtime, and `session` slots owned by the current task. Every output carries `state`, `produced`, `context`, `cleanup`, `evidenceRefs`, and `findings`. Inputs, outputs, loaded bindings, worker observations, receipts, and scratch objects are session-only and are purged at every parent-skill terminal. Operators never persist intermediate run folders.

Broad repository source context is forbidden. Operators retrieve only their declared knowledge IDs; business authority comes from an exact `.worktrees/business/...` revision; source work opens only hash-pinned contract JSON or exact approved files. Workers are read/analyze-only unless an operator explicitly proves disjoint safe writes, and the coordinator owns joins and mutations.

Input and output schemas are independent files. `operator.json` binds their exact filenames; validation refuses missing, extra, or cross-direction contract files.

## Domains

| Domain | Ownership |
| --- | --- |
| `workspace` | identity, bootstrap, portable declarations, route hydration and write-root proof |
| `business` | evidence, feature model, lifecycle publication and delivered-source reconciliation |
| `architecture` | hard-decision analysis, live source evidence, pattern binding and exact boundary challenge |
| `fe` | journey/layout delivery plus source-first feedback, learning and cross-surface reconciliation |
| `be` | approved backend source implementation only |
| `quality` | one source gate, diagnosis, readiness, repair, debt or rule-accountability responsibility |
| `deployment` | release intent through manifest, host, artifact, migration, domain, rollout, monitor, recovery/rollback and proof |
| `platform` | bounded Cloudflare, MCP/Qdrant, Sonar and observability control-plane reconciliation |
| `source` | provider-neutral provenance record/query |
| `test` | focused test operators retained for FE product proof |

Operator prose and semantic schemas are hand-authored; `materialize.mjs` deliberately preserves them instead of regenerating generic instructions. Run `node materialize.mjs`, then `node validate-operators.mjs`. The validator proves path/manifest identity, exact eight-file shape, closed schemas, Qdrant `LOADS` parity, explicit state/session cleanup, source-context refusal, source-reference identity, and fail-closed validators.
