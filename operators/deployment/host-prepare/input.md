# `deployment/host-prepare` input

This operator prepares the declared host idempotently. Its input is ephemeral task-session state. Loaded values, captures, provider observations, worker results, and receipts are never persisted and are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted deployment transition. |
| `payload.provided` | Previous state | Supply immutable refs accepted by the machine. |
| `payload.loads` | Runtime resolver | Declare exact authority, law, files, commands, resources, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `executionPlanRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `hostRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `credentialReceiptRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `setupSourceRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.

## Loaded by the runtime

- `artifacts`: resolve only provided refs into session memory.
- `knowledge`: retrieve only `deployment.lifecycle` from the pinned Qdrant generation.
- `source`: open only hash-pinned files; broad repository context and indexed source summaries are forbidden.
- `commands`: bind declared commands and exact checkout; captures remain session-only.
- `external`: bind declared provider resources and opaque credential handles; secret values never enter model context.
- `orchestration`: resolve strategy independently of provider/model.

Acceptance requires that host identity, OS facts, packages, users, directories, firewall intent, and setup source match the plan. Validate before any load, command, provider call, or mutation.
