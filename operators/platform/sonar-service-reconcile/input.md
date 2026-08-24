# `platform/sonar-service-reconcile` input

This operator reconciles the declared Sonar service, project set, and quality-profile enforcement. Input and loaded provider state are ephemeral task-session data; raw secrets never enter the envelope, and all intermediates are purged at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind `platform.sonar.reconcile / ready`. |
| `payload.provided` | Previous state | Supply exact project-set, quality-profile, and credential-receipt refs. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, platform law, Sonar resources, opaque handles, and orchestration. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `projectSetRef`: approved Sonar project identities and expected source revisions.
- `qualityProfileRef`: exact profile, quality-gate, and enforcement bindings.
- `credentialReceiptRef`: custody-approved opaque credential receipt.

## Loaded by the runtime

- `artifacts`: resolve only the three provided refs.
- `knowledge`: retrieve only `platform.operations` from a pinned Qdrant generation.
- `external`: load only declared Sonar service/project resource identities and opaque credential handles; never secret values.
- `orchestration`: resolve strategy independently from provider/model selection.

Validate the entire envelope before any Sonar read or mutation.
