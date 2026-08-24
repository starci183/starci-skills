# Source quality gates

| Field | Value |
| --- | --- |
| Knowledge ID | `quality.source-gates` |
| Operators | `format, lint, typecheck, build, unit-coverage, integration, e2e, sonar, delivery-proof` |
| Search tags | `quality, format, lint, typecheck, build, unit coverage, integration, e2e, sonar` |
| Dependencies | `be.boundary-planning` |

## Record

Source gates run in declared order and emit independent receipts. Before model reasoning, validate the route, command identity, checkout revision, configuration, toolchain and environment. Query an exact receipt cache next. A trusted hit may be reused only when its full fingerprint, gate version, evidence hash and retention policy match; partial keys and cached failures never pass. On a miss, run the pinned command before retrieving explanatory knowledge. A deterministic green command needs no source load and no AI classification.

Format must be check-only; lint is zero errors and zero warnings; typecheck and build use repository entrypoints; unit is the sole coverage producer; integration proves declared connected boundaries; E2E proves real behavior; Sonar is final and cannot inherit another lane's verdict. Statements/lines/functions meet project thresholds, branches meet their own threshold, and patch/new metrics remain independent.

Skip, todo, only, zero-test, `passWithNoTests`, suppression, missing entrypoint, substituted check, or absent external evidence never passes. A command failure is classified from structured diagnostics only after execution: `in-boundary` when the approved owner can fix it, `boundary-drift` when correction changes an approved boundary, `flaky` when identical source and environment produce contradictory outcomes under the declared bounded confirmation policy, and `external-blocker` when the environment or dependency prevents a verdict. Reruns are for classification, never for converting an unexplained failure into green.

Gate input, output, cache candidates, command captures, logs, diagnostic slices, worker observations and receipts are session-only and purged at the parent terminal. No gate loads broad repository context. A failing gate may request exact source files only from a later approved repair operator.
