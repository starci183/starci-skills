# `architecture/decision-challenge` output

The output is an ephemeral task-session object consumed by the parent state machine. It is not a durable artifact and is purged with its input, loaded bindings, observations, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | State-machine compatibility envelope. |
| `payload.decision` | Typed route key from this operator contract. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.reviewPreview` | Required `visualize` HTML binding for every ready option set, all failure/recovery scenarios, and exact approval commands. |
| `payload.produced` | Session artifacts `challengeReceiptRef` and `reviewArtifactRef` plus explicitly approved durable effects only. |
| `payload.context` | Minimal refs and revisions actually used; never copied context or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only evidence for the next state. |
| `payload.findings` | Concise unresolved facts, not an analysis transcript. |
| `payload.challengeSummary` | Structured falsification record: assumptions, counterexamples, rejected options, failure modes, operational surprises and disconfirming tests. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `ready` | `completed` | `architecture.decision.handoff / ready` | architecture-challenge-ready, architecture-visual-preview-ready |
| `revise` | `replan` | `architecture.decision.alternatives / ready` | architecture-feedback |
| `blocked` | `blocked` | `architecture.blocked / blocked` | architecture-decision-blocked |

`challengeReceiptRef`, evidence, receipts, observations, and output use `session://`. Only a product/worktree effect explicitly declared by `operator.json` may survive the skill.

A `ready` decision is invalid while any critical challenge is unresolved. Every non-recommended rendered option must have an evidence-linked rejection; agreement or a polished comparison is not proof.
