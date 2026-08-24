# `quality/debt-repay` output

The output is an ephemeral task-session object consumed by the parent state machine. It is purged with input, bindings, command output, diagnostics, observations, receipts, and scratch values at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Compatibility state emitted to the skill machine. |
| `payload.decision` | Typed quality route key. |
| `payload.state` | Explicit status, code, retryability, and emitted state. |
| `payload.produced` | Debt receipt, exact approval fingerprint, bounded loop proof, optional closure candidate, independent closure proof, atomic closed-inventory receipt, and approved durable writes. |
| `payload.context` | Minimal refs and revisions actually used; no copied context or reasoning. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only proof handed to the next state. |
| `payload.findings` | Structured failure facts, never hidden reasoning. |

## State contract

| Decision | State status | Emitted state | Facts added |
| --- | --- | --- | --- |
| `closed` | `completed` | `quality.debt.result / complete` | debt-closed |
| `progress` | `completed` | `quality.debt.result / ready` | debt-progress |
| `closure-candidate` | `completed` | `quality.debt.proof / ready` | debt-closure-candidate |
| `blocked` | `blocked` | `quality.blocked / blocked` | debt-blocked |

`debtReceiptRef`, command captures, evidence, diagnostics, and output use `session://`. Only the explicit repair/debt product effect declared by `operator.json` may survive the skill.

`progress` and `closure-candidate` require a new iteration fingerprint plus either a strictly better metric or a smaller declared remainder. `closure-candidate` does not close debt; it hands control to an independent proof state. `closed` is legal only in `intent: close`, consumes a green proof whose verifier is not `quality/debt-repay`, and atomically writes a `closedInventory` receipt binding that proof hash. Blocked iterations leave no durable writes or closure artifacts.

The canonical durable inventory is `.worktrees/<project>/quality/debts/inventory.json`; closure is a compare-and-swap transition of exactly one debt identity from open to closed.
