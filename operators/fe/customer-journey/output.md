# `fe/customer-journey` output

The output is a closed, ephemeral task-session object consumed by the parent skill state machine. It is never a durable artifact. Only explicitly approved product-source or external mutations survive; the output and every intermediate reference are purged at every skill terminal.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `stage`, `status`, `facts` | Compatibility envelope for the existing skill route. |
| `payload.decision` | Typed decision key selected from this operator's declared outcomes. |
| `payload.state` | Explicit operator status, code, retryability, and exact emitted route. |
| `payload.produced` | Journey batch, recommendation, optional selected-journey session ref, direction count, and selection policy. |
| `payload.context` | Minimal references and revisions actually used; never copied context or reasoning. |
| `payload.cleanup` | Scratch references and mandatory `skill-terminal` purge policy. |
| `payload.evidenceRefs` | Session-only evidence for the next state. |
| `payload.findings` | Concise unresolved facts; never a chain-of-thought transcript. |

## State contract

| Decision | Operator state | Emitted state | Required facts |
| --- | --- | --- | --- |
| `directions-ready` | `pending` | `flow.review / pending` | `flow-directions-ready` |
| `recommended-selected` | `completed` | `flow.review / approved` | `flow-directions-ready`, `flow-approved`, `recommended-flow-auto-selected` |

Manual policy leaves `selectedJourneyRef` null and waits for exact approval. Auto policy selects only the recommended direction and emits a session ref. The parent state machine routes the result; nothing is persisted outside the task session.
