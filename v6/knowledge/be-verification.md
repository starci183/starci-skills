# Backend verification

| Field | Value |
| --- | --- |
| Knowledge ID | `be.verification` |
| Operators | `verification` |
| Search tags | `backend, unit, integration, e2e, lint, typecheck, build, coverage, gate` |
| Dependencies | `be.implementation` |

## Record

Verify the implemented revision with the exact evidence matrix approved in the plan. Run rule accountability, format/check, lint with zero warnings, typecheck, build, focused unit tests, integration tests, connected E2E, coverage, and repository delivery gates in the declared order.

## Failure classification

Classify every failure as `in-boundary`, `boundary-drift`, or `external-blocker`. In-boundary means the approved design is intact and source inside the boundary can repair it. Boundary drift means a missing file, behavior, dependency, pattern decision, contract, or test invalidates the approved plan. External blockers require evidence and never become a fabricated pass.

Skipped, todo, zero-test, `passWithNoTests`, suppressed, or substituted checks do not count. Verification mutates no product source; the skill state machine selects the repair loop.
