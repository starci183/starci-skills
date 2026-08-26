# `architecture/independent-critique` output

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

Gate: The critic receives artifacts and counter-evidence only, never the author reasoning trace, and cannot accept open blockers.
