# `deployment/domain-reconcile` input

This operator reconciles declared domain and TLS state with the provider. Its input is ephemeral task-session state. Loaded values, captures, provider observations, worker results, and receipts are never persisted and are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted deployment transition. |
| `payload.provided` | Previous state | Supply immutable refs accepted by the machine. |
| `payload.loads` | Runtime resolver | Declare exact authority, law, files, commands, resources, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `executionPlanRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `domainPlanRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.
- `credentialReceiptRef`: exact task-session ref supplied by the previous state; it cannot be replaced or broadened.

## Loaded by the runtime

- `artifacts`: resolve only provided refs into session memory.
- `knowledge`: retrieve only `deployment.lifecycle` from the pinned Qdrant generation.
- `commands`: bind declared commands and exact checkout; captures remain session-only.
- `external`: bind declared provider resources and opaque credential handles; secret values never enter model context.
- `orchestration`: resolve strategy independently of provider/model.

Acceptance requires that hostname, zone ownership, target, proxy mode, certificate mode, and provider revision match the domain plan. Validate before any load, command, provider call, or mutation.
