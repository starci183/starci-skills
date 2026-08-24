# `quality/workflow-diagnose` input

This operator diagnoses one workflow invocation without changing it. Its input is an ephemeral task-session object. The runtime never writes the envelope, loaded values, command output, diagnostics, worker observations, or receipts outside the session and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted quality transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, law, execution/source boundary, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `skillRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `invocationRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `observedEnvironmentRef`: exact `session://` reference; the operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references listed by `payload.provided` into session memory.
- `knowledge`: retrieve only `quality.readiness-repair` from the pinned Qdrant generation.
- `orchestration`: resolve execution strategy separately from provider/model mapping.

Acceptance requires that the trace explains state, route, environment, and failure evidence without mutating the observed workflow. Validate the complete envelope before any load, command, or mutation.
