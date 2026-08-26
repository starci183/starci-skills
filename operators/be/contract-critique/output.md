# `be/contract-critique` output

The output is an ephemeral typed artifact governed by `migration/v6.1/architecture-backend/schemas/critique.schema.json`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `payload.decision` | Route `ready`, `revise`, or `blocked`. |
| `payload.state` | Expose status, code, retryability and emitted state. |
| `payload.produced` | Hold the typed artifact and session ref; no durable write. |
| `payload.context.used` | Preserve only refs and revisions actually used. |
| `payload.cleanup` | Purge scratch data at every `skill-terminal`. |
| `payload.evidenceRefs` | Keep inspectable evidence, never reasoning traces. |

Gate: Fresh-context critique includes a wrong-store counterexample and never accepts lint or types as semantic proof.
