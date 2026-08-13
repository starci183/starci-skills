# Bounded backend enablers

Use this classification when a UI design reveals missing backend support. The purpose is to expose
existing business truth safely, not to smuggle product or architecture design into frontend work.

| Class | Meaning | Examples | Decision |
|---|---|---|---|
| `reuse` | Current API already supports the UI | Existing query, mutation or subscription with a different FE composition | Reuse; no backend proposal |
| `additive-enabler` | Backward-compatible access to existing authorized behavior/data | New read projection, optional query field, small mutation invoking an existing command, subscription over an existing event and transport | May propose; apply only after explicit approval |
| `backend-design` | Changes domain meaning, lifecycle, authorization or infrastructure | New invariant, permission, aggregate transition, storage, event source, WebSocket/auth lifecycle, delivery guarantee, payment or identity behavior | Separate backend design and approval |

## Proposal test

An `additive-enabler` must answer yes to every question:

1. Does executable backend behavior or stored data already establish the capability?
2. Does the change preserve domain invariants and authorization?
3. Is the API delta additive and backward-compatible?
4. Can it be implemented through current application/domain boundaries?
5. Is it bounded to named UI states/actions with focused tests?
6. Does it avoid new infrastructure, lifecycle and delivery semantics?

Any `no` reclassifies the proposal as `backend-design`.

## Required proposal fields

Record `id`, `uiNeed`, `operationKind`, `currentEvidence`, `apiDelta`, `applicationPath`,
`authorization`, `compatibility`, `tests`, `rejectedAlternatives` and `escalationTrigger`.

For subscriptions, additionally record `existingEvent`, `existingTransport`, authentication,
reconnect/stale behavior and delivery semantics already guaranteed by the repository. A desire for
live UI does not prove that WebSocket is the smallest solution; compare polling, invalidation and
server-sent alternatives against existing infrastructure.

For quick-access mutations, prove that “quick” changes navigation or presentation only. It must not
weaken confirmation, validation, authorization or irreversible-action safeguards.
