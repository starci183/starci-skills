# `deployment/execution-plan` input

This operator compiles deployment intent and observed state into an executable plan. Its input is ephemeral task-session state. Loaded values, captures, provider observations, worker results, and receipts are never persisted and are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted deployment transition. |
| `payload.provided` | Previous state | Supply immutable refs accepted by the machine. |
| `payload.loads` | Runtime resolver | Declare exact authority, law, files, commands, resources, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `deploymentContractRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `manifestReceiptRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `observedStateRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.

## Loaded by the runtime

- `artifacts`: resolve only provided refs into session memory.
- `knowledge`: retrieve only `deployment.lifecycle` from the pinned Qdrant generation.
- `external`: bind declared provider resources and opaque credential handles; secret values never enter model context.
- `orchestration`: resolve strategy independently of provider/model.

Acceptance requires that commands, effects, approvals, checkpoints, migration order, rollback points, and proof obligations are complete. Validate before any load, command, provider call, or mutation.
