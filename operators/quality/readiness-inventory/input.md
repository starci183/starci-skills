# `quality/readiness-inventory` input

This operator inventories source readiness. Its input is an ephemeral task-session object. The runtime never writes the envelope, loaded values, command output, diagnostics, worker observations, or receipts outside the session and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted quality transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, law, execution/source boundary, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `routeSetRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `declaredGateSetRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `staleRegistryRef`: exact `session://` reference; the operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references listed by `payload.provided` into session memory.
- `knowledge`: retrieve only `quality.readiness-repair` from the pinned Qdrant generation.
- `orchestration`: resolve execution strategy separately from provider/model mapping.

Acceptance requires that routes, gates, and stale records resolve to a complete green result or owned findings. Validate the complete envelope before any load, command, or mutation.
