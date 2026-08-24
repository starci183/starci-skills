# `deployment/intent-bind` input

This operator binds routed business authority to one deployment target. Its input is ephemeral task-session state. Loaded values, captures, provider observations, worker results, and receipts are never persisted and are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted deployment transition. |
| `payload.provided` | Previous state | Supply immutable refs accepted by the machine. |
| `payload.loads` | Runtime resolver | Declare exact authority, law, files, commands, resources, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `routeReceiptRefs`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `imperativeRequestRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `deploymentIntentRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.

## Loaded by the runtime

- `artifacts`: resolve only provided refs into session memory.
- `knowledge`: retrieve only `deployment.lifecycle` from the pinned Qdrant generation.
- `business`: load the exact approved revision below `.worktrees/<project>/businesses/`; deployed source is not business authority.
- `orchestration`: resolve strategy independently of provider/model.

Acceptance requires that route, business revision, release, environment, target, and imperative request identify one target. Validate before any load, command, provider call, or mutation.
