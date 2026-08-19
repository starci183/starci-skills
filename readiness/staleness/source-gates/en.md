---
title: Source gates
---

# Source gates

## LOADS

None.

## Stale signature

The repository's own declared gate contract is absent, incomplete, fails, or is not executable for every
routed role. The mandatory order is **format → lint → typecheck → build → unit coverage → E2E → Sonar**.
Lint passes only with exactly 0 errors and 0 warnings. A command the repository does not declare is an
absent gate, not a pass.

Unit coverage must report statements/lines (S/L), functions (F) and branches: S/L/F ≥80%, branches ≥75%,
and every patch/new-code metric ≥90%. E2E must name a declared entrypoint that exists, contain real tests,
and pass all tests. `skip`, `todo`, `only`, `passWithNoTests`, zero-test runs, or a focused/check substitute are rejects.
Sonar is the final gate and must pass for every routed role. No gate may be weakened or reordered.

## List evidence

Read the manifest and list declared primary entrypoints for every routed role. Run every gate in the
mandatory order above; do not skip E2E or Sonar because they are expensive. Generated caches and ignored
output are allowed; tracked source mutation is not. Record command, exit code, lint errors/warnings,
coverage metrics, E2E entrypoint/test/pass counts and Sonar verdict. A missing prerequisite, entrypoint,
real test, coverage report or external Sonar evidence is `unmeasured`/`absent` and cannot support `ready`.

## Repair inventory

Read the manifest before running anything. Do not invent commands. Run existing declared gates in the
mandatory order: format, lint, typecheck, build, unit coverage, E2E, Sonar. Record exact errors, warnings,
coverage metrics, failing-suite/test counts, entrypoint existence and Sonar status before the first source
write. A missing mandatory gate is a finding, never permission to continue.

## Apply

Classify findings before repair:

| Class | Apply |
|---|---|
| `format` | one mechanical ESLint-owned formatting pass |
| `mechanical` | safe autofix, then read every hunk |
| `defect` | smallest hand repair, one file owner at a time |
| `decision` | return to owner; never weaken a gate |

Formatting, mechanical changes and defects are separate commits. Never add disables, lower severity,
remove a rule, skip a test or add `any` merely to buy green.

## Proof

Run the exact original gates again, in the same order, and report before/after counts and metrics. Zero is
valid only with the same commands, checkout revision and machine, without suppression. A ready verdict
requires format pass; lint 0 errors/0 warnings; typecheck/build pass; unit S/L/F ≥80%, branches ≥75% and
patch/new metrics ≥90%; declared real E2E entrypoint with all tests passing; and final Sonar pass.
