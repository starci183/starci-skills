# `test/ui-quality-audit` input

This closed JSON object binds either one delivery checkpoint (`test.ui`) or one standalone check-only audit (`ui.quality.audit`) to the same atomic UI-quality responsibility. All values are task-session state and are purged at the parent-skill terminal.

## JSON architecture

| Section | Owner | Meaning |
| --- | --- | --- |
| Root envelope | Skill machine | Accepted delivery or standalone stage, status, and facts. |
| `payload.provided` | Previous state | Immutable route, plan, target, baseline, and prior-state refs. |
| `payload.loads` | Runtime | Exact knowledge, source, command, browser, cache, and orchestration bindings. |
| `payload.session` | Session runtime | Input, output, scratch, and cleanup lifetime. |

## Provided refs

- `previousStateRef`: exact upstream operator or validated invocation.
- `routeReceiptRef`: verified frontend checkout and allowed target boundary.
- `auditPlanRef`: closed surface, state, viewport, rule-applicability, and evidence matrix.
- `targetSetRef`: exact browser routes and source revisions under audit.
- `baselineRef`: approved layout/change baseline for delivery classification, or the standalone comparison baseline.

## Runtime loads

- `business`: always `null`; this operator never interprets product meaning.
- `knowledge`: exactly one pinned `fe.ui-quality-review` record.
- `source`: exact hash-pinned files only, never repository context.
- `commands`: declared app/browser commands only.
- `external`: declared running app/browser resources and opaque credential handles only.
- `cache`: exact fingerprint; standalone and delivery UI audits are non-cacheable unless the audit plan explicitly freezes every mutable input and TTL.
- `orchestration`: provider-neutral execution mode.

Validate the complete envelope before resolving any binding or controlling the browser.
