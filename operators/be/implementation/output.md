# `be/implementation` output

The output is an ephemeral task-session object consumed by the parent skill state machine. It is not a durable artifact. Its retention is `until-skill-terminal`; the runtime purges the output, its input, and every listed scratch reference when the skill reaches `complete`, `blocked`, `handoff`, `not-needed`, or `rejected`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| `stage`, `status`, `facts` | Compatibility envelope consumed by the skill machine. |
| `payload.decision` | Typed route key. It must agree with the emitted state. |
| `payload.state` | Explicit operator result, reason code, retryability, and emitted machine state. |
| `payload.produced` | Source mutations and the task-local change receipt. |
| `payload.context` | Minimal lineage: references and revisions actually used, never copied context or reasoning. |
| `payload.cleanup` | Session scratch references and the mandatory terminal purge policy. |
| `payload.evidenceRefs` | Task-local evidence passed to the next state. |
| `payload.findings` | Concise unresolved facts; no chain-of-thought or analysis transcript. |

## State contract

| Decision | `payload.state.status` | Emitted state | Meaning |
| --- | --- | --- | --- |
| `ready` | `completed` | `quality.format / ready` | The approved source boundary was changed and hashed. |
| `source-drift` | `replan` | `architecture.boundary / ready` | At least one current source hash differs from the approved baseline. No source was changed. |
| `boundary-drift` | `replan` | `architecture.boundary / ready` | Correct implementation requires a path or responsibility outside the approved boundary. |
| `blocked` | `blocked` | `be.blocked / blocked` | A required binding, approval, or safe execution condition is unavailable. |

Only `ready` may contain mutations. All receipt and evidence references use `session://`; durable results are limited to the approved product-source changes themselves.
