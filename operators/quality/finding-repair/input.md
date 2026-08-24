# `quality/finding-repair` input

This operator repairs one approved readiness finding. Its input is an ephemeral task-session object. The runtime never writes the envelope, loaded values, command output, diagnostics, worker observations, or receipts outside the session and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind one accepted quality transition. |
| `payload.provided` | Previous state | Supply immutable task-session references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, law, execution/source boundary, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `approvedFindingRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `approvalReceiptRef`: exact `session://` approval over the finding fingerprint, target hashes, permitted writes, and approval revision.
- `baselineRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `ownerBoundaryRef`: exact `session://` reference; the operator cannot replace or broaden it.
- `proofPlanRef`: exact `session://` plan naming the expected mutation proof and the independent reinventory gate.

## One-finding scope

`payload.scope` binds one `findingId`, its measured `findingFingerprint`, the exact `approvalFingerprint`, and the number of approved target files. Arrays of findings, wildcard targets, and approval over a category are invalid. `targetCount` must equal `payload.loads.source.targetFiles.length`.

## Loaded by the runtime

- `artifacts`: resolve only references listed by `payload.provided` into session memory.
- `knowledge`: retrieve only `quality.readiness-repair` from the pinned Qdrant generation.
- `source`: open only declared target files and verify their hashes; broad repository context is forbidden.
- `orchestration`: resolve execution strategy separately from provider/model mapping.

Acceptance requires that every changed file belongs to this one finding's exact approval boundary and directly addresses it. `repaired` means the approved mutation was applied and proven by hashes; the parent state machine must reinventory independently before claiming the finding is cleared.
