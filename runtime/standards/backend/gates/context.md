# Backend gate authority router

## LOADS

None.

## Record

The gate answers where existing backend source is refused. It never describes the desired source shape
in place of a pattern and never patches the lint machine in a consumer repository.

## Routes

| Evidence | Runtime target |
|---|---|
| Canonical ESLint finding | `runtime/gates/be/lints/context.md` |
| Quality/coverage/analysis delivery finding | `platform/readiness/staleness/assurance/context.md` |
| Check-only repository source-gate failure | `platform/readiness/staleness/source-gates/context.md` |

## Rules

1. Run the canonical machine before loading a child gate.
2. Unknown emitted rules stop as unaccountable machine rules.
3. A gate may not invent a source pattern or repair action.
4. Suppression, lowered severity, skipped tests and excluded authored source do not clear a finding.
