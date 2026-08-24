# `platform/observability-reconcile` input

This closed object declares one bounded observability reconciliation. It and all resolved values remain in the task session and are purged at every parent-skill terminal.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| Root route | Skill machine | Accept only `platform.observability.reconcile / ready`. |
| `payload.provided` | Previous state | Provide immutable `stackRef`, `metricsDestinationRef`, and `credentialReceiptRef`. |
| `payload.loads` | Runtime resolver | Bind those refs plus exact knowledge, source, commands, external resources, and orchestration. |
| `payload.session` | Session runtime | Own input, output, scratch, and terminal retention. |

Every provided ref has exactly one `session-exact` artifact binding. Knowledge is exactly `platform.operations`. Source is hash-pinned with broad context disabled. Commands and external resources are declared-only; credentials are opaque handles, never values. Validate before any load or effect.
