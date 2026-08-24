# Source quality gates

| Field | Value |
| --- | --- |
| Knowledge ID | `quality.source-gates` |
| Operators | `format, lint, typecheck, build, unit-coverage, integration, e2e, sonar, delivery-proof` |
| Search tags | `quality, format, lint, typecheck, build, unit coverage, integration, e2e, sonar` |
| Dependencies | `be.boundary-planning` |

## Record

Source gates run in declared order and emit independent receipts. Format must be check-only; lint is zero errors and zero warnings; typecheck and build use repository entrypoints; unit is the sole coverage producer; integration proves declared connected boundaries; E2E proves real behavior; Sonar is final and cannot inherit another lane's verdict.

Statements/lines/functions meet project thresholds, branches meet their own threshold, and patch/new metrics remain independent. Skip, todo, only, zero-test, `passWithNoTests`, suppression, missing entrypoint, substituted check, or absent external evidence never passes. Failures are classified `in-boundary`, `boundary-drift`, or `external-blocker` for the later state machine.
