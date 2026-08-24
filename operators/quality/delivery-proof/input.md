# `quality/delivery-proof` input

This operator assembles final delivery proof. Its input is an ephemeral task-session object. The runtime never writes the envelope, loaded values, command output, diagnostics, worker observations, or receipts outside the session and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted quality transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, law, execution/source boundary, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `changeReceiptRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `gateReceiptSetRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `businessHeadRef`: exact `session://` reference; the operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references listed by `payload.provided` into session memory.
- `knowledge`: retrieve only `quality.source-gates` from the pinned Qdrant generation.
- `business`: load the exact approved business revision under `.worktrees/business/`.
- `orchestration`: resolve execution strategy separately from provider/model mapping.

Acceptance requires that all required gate receipts match one source revision and the approved business head. Validate the complete envelope before any load, command, or mutation.
