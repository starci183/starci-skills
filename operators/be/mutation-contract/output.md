# `be/mutation-contract` output

The output is an ephemeral typed artifact governed by `migration/v6.1/architecture-backend/schemas/backend-contract.schema.json`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `payload.decision` | Route `ready`, `revise`, or `blocked`. |
| `payload.state` | Expose status, code, retryability and emitted state. |
| `payload.produced` | Hold the typed artifact and session ref; no durable write. |
| `payload.context.used` | Preserve only refs and revisions actually used. |
| `payload.cleanup` | Purge scratch data at every `skill-terminal`. |
| `payload.evidenceRefs` | Keep inspectable evidence, never reasoning traces. |

Gate: Every write matches the target writer, physical store, database.schema.resource and connection token.
