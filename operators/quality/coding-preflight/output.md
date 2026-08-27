# `quality/coding-preflight` output

`ready` means the implementation reference, lint rules, TypeScript constraints, exact target hashes, three deferred checks, their commit-or-explicit activation and time budgets are bound in task-session receipts before coding begins.

`reference-gap` routes back to boundary planning when a suitable template or applicable contract cannot be selected without expanding scope. `blocked` reports missing or contradictory evidence. This operator never runs lint, typecheck, or Sonar and never mutates product source; the standalone gate capability activates them automatically before commit or by explicit request.

## JSON architecture

`payload.state` emits exactly one declared route and decision. `payload.produced` holds the ephemeral
preflight and deferred-plan refs with zero durable writes. `payload.context.used` records only exact
reference identities and revisions. `payload.cleanup` purges all scratch and receipts at the parent
skill-terminal.
