# `deployment/execution-root-init` input

This operator initializes the ignored rebuildable deployment execution root. Its input is ephemeral task-session state. Loaded values, captures, provider observations, worker results, and receipts are never persisted and are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted deployment transition. |
| `payload.provided` | Previous state | Supply immutable refs accepted by the machine. |
| `payload.loads` | Runtime resolver | Declare exact authority, law, files, commands, resources, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `executionPlanRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `manifestReceiptRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `ignoreProofRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.

## Loaded by the runtime

- `artifacts`: resolve only provided refs into session memory.
- `knowledge`: retrieve only `deployment.lifecycle` from the pinned Qdrant generation.
- `commands`: bind declared commands and exact checkout; captures remain session-only.
- `orchestration`: resolve strategy independently of provider/model.

Acceptance requires that the root is ignored, release-scoped, reproducible, free of secrets, and derived from the approved plan. Validate before any load, command, provider call, or mutation.
