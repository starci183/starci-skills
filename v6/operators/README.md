# Operators

An operator is one reusable, typed state transition with eight required files:

- `input.md`: accepted evidence and preconditions.
- `input.schema.json`: closed input JSON Schema.
- `output.md`: emitted artifact and status.
- `output.schema.json`: closed output JSON Schema.
- `operator.json`: accepted/emitted states, Qdrant knowledge references, side effects, and stop metadata only.
- `execute.md`: ordered decisions, boundaries, side effects, and stop conditions.
- `validate-input.mjs`: fail-closed input validation before any processing.
- `validate-output.mjs`: fail-closed output validation before the chain may continue.

Operators do not choose when they run and do not invoke one another. A skill state machine owns guards, branches, loops, waits, and terminal states, then routes one artifact envelope to exactly one operator.

Invalid input stops at the boundary without side effects. Invalid output is never emitted or routed downstream.

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

`materialize.mjs` deterministically generates the atomic V5-derived operator shelf without creating a skill graph. Run `node materialize.mjs`, then `node validate-operators.mjs`. The validator proves path/manifest identity, exact eight-file shape, closed schemas, Qdrant `LOADS` parity, source-reference identity and fail-closed validators.
