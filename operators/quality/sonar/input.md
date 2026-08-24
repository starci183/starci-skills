# `quality/sonar` input

This operator evaluates the pinned Sonar quality gate. Its input is an ephemeral task-session object. The runtime never writes the envelope, loaded values, command output, diagnostics, worker observations, or receipts outside the session and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted quality transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, law, execution/source boundary, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `changeReceiptRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `lcovReceiptRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `sonarProjectRef`: exact `session://` reference; the operator cannot replace or broaden it.

## Loaded by the runtime

- `artifacts`: resolve only references listed by `payload.provided` into session memory.
- `knowledge`: retrieve only `quality.source-gates` from the pinned Qdrant generation.
- `execution`: bind one exact command and checkout; captured stdout, stderr, exit status, and diagnostics remain session-only.
- `cache`: bind one exact fingerprint and optional session receipt candidate; validate it before retrieving knowledge or running the command.
- `orchestration`: resolve execution strategy separately from provider/model mapping.

Acceptance requires that analysis belongs to the expected project and revision and the remote gate reaches pass. Validate the complete envelope before any load, command, or mutation.
