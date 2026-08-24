# `deployment/artifact-build` output

The output is an ephemeral task-session object consumed by the parent state machine. It is purged with input, bindings, command captures, worker observations, receipts, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Emit `deployment.artifact.publish / ready` with `deployment-artifacts-built`. |
| `payload.decision` | Typed route key; this operator emits only `ready`. |
| `payload.state` | Explicit completion status, code, retryability, and emitted route. |
| `payload.produced` | Session `artifactBuildReceiptRef` plus immutable artifact refs that intentionally survive. |
| `payload.context` | Minimal refs and revisions actually used; no copied source or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only build and digest evidence for publication. |
| `payload.findings` | Value-safe unresolved facts, never raw logs or hidden reasoning. |

## State contract

| Decision | State status | Emitted state | Required fact |
| --- | --- | --- | --- |
| `ready` | `completed` | `deployment.artifact.publish / ready` | `deployment-artifacts-built` |

The receipt, command captures, diagnostics, observations, and output use `session://`. Only immutable build artifacts declared by the execution plan may survive the skill.
