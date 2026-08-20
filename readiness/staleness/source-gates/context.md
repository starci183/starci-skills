# Source gates

## LOADS

None.

## Stale signature

The declared gate contract is absent, incomplete, fails, or is not executable for every routed role. Order:
format → lint → typecheck → build → unit coverage → E2E → Sonar. Lint requires 0 errors and 0 warnings.
Unit requires S/L/F ≥80%, branches ≥75%, and patch/new metrics ≥90%. E2E requires an existing declared
entrypoint, real tests, and all tests passing; skip/todo/only/passWithNoTests/zero-test/focused-check substitutes reject.
Sonar is the final required pass. No gate may be weakened or reordered; undeclared commands are absent.
Unit is the sole coverage producer for Codecov and Sonar. E2E is an independent behavioral lane: it may
not create, merge, mutate or improve unit coverage; its files are excluded from Sonar scanner scope, and
E2E/Sonar verdicts never imply or relabel each other.
Patch/new is N/A only when an explicit base-SHA diff proves no authored production change; empty
working-tree evidence or a missing coverage entry is not N/A.

## List evidence

Read the manifest and every routed role's primary entrypoints. Run format, lint, typecheck, build, unit
coverage, E2E and Sonar in that order. Record commands, exit codes, lint counts, coverage metrics, E2E
entrypoint/test/pass counts and Sonar verdict. Ignored output is allowed, tracked mutation is not. Missing
prerequisite, entrypoint, real tests, coverage or Sonar evidence is unmeasured/absent and cannot support ready.

## Repair inventory

Read the manifest first and do not invent commands. Run all declared gates in mandatory order and record exact
errors, warnings, coverage metrics, failing tests, E2E entrypoint existence and Sonar status before writing.

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

Run the exact original gates again in the same order. Ready requires lint 0/0, unit thresholds, real passing
E2E and final Sonar pass, with no suppression.
