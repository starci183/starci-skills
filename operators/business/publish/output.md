# `business/publish` output

The output is an ephemeral task-session object consumed by the parent state machine. It is not a durable artifact and is purged with its input, loaded bindings, observations, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | State-machine compatibility envelope. |
| `payload.decision` | Typed route key from this operator contract. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Session artifact `businessHeadRef` plus explicitly approved durable effects only. |
| `payload.context` | Minimal refs and revisions actually used; never copied context or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only evidence for the next state. |
| `payload.findings` | Concise unresolved facts, not an analysis transcript. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `architecture-required` | `completed` | `architecture.decision.frame / ready` | business-head-ready, architecture-analysis-required |
| `direct-plan` | `completed` | `architecture.source / ready` | business-head-ready |
| `blocked` | `blocked` | `business.blocked / blocked` | business-publication-blocked |

`businessHeadRef`, evidence, receipts, observations, and output use `session://`. Only a product/worktree effect explicitly declared by `operator.json` may survive the skill.
