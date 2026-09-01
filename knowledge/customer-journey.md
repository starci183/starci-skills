# Customer journey reasoning

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.customer-journey` |
| Contract revision | `7.6.0` |
| Operators | `fe/request-compile` |
| Search tags | `journey, user flow, multi-page, recovery, compile` |
| Dependencies | `fe.audit-loop-v75b` |

## Internal compile guidance

Derive the complete user journey before page layout. A page is one checkpoint in a task, not the unit
of product reasoning. This record contributes a compiled contract; it does not create a journey
stage, flow-approval checkpoint, or loop.

Start from the actor's trigger, desired outcome, verified business operations, consequential
decisions, and terminal states. Preserve uncertainty as an open fact. Challenge plausible sequencing,
decision timing, recovery, and page-boundary alternatives internally, then emit one strongest closed
journey using evidenced fit, risk, reversibility, and implementation cost. Three or four rendered
alternatives exist only when no material direction dominates or the user explicitly requests
comparison, and remain inside the optional `generate` guidance in `direction.visualization`.

The compiled journey names:

- entry evidence and safe exit/terminal conditions;
- ordered user goals and system commitments;
- page/container boundaries and why each exists;
- reversible and irreversible actions;
- populated, initial loading, mutation pending, settled empty, validation, denied, error, recovery,
  refresh/resume, and long-content states when reachable;
- client validation, business refusal, auth/security, stale/expired, concurrency/idempotency,
  rate-limit, transport/infrastructure, realtime, and recovery edges when applicable;
- journey-global owners versus page-local owners;
- strongest rejected alternative and why it loses.

Do not invent prices, permissions, policies, outcomes, hidden automation, or unreachable decorative
states. User feedback is evidence of a possible reusable pain relationship; probe every journey state
where that relationship may recur rather than patching the originating screenshot.

Freeze the behavior envelope and failure topology before UI composition. Interaction-container
selection is UX authority. UI may later vary hierarchy, density, surface treatment, and responsive
composition, but it cannot reorder the journey, change API semantics/business policy, or move work to
another container outside the compiled contract.

A linear multi-page process has one journey-progress owner referenced by participating pages. Tabs
are same-page peer panels; they never represent progress across routes. Existing flows and product
examples are evidence, not journey templates.
