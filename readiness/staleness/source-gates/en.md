---
title: Source gates
---

# Source gates

## LOADS

None.

## Stale signature

The repository's own check-only format, lint, typecheck, build or unit command fails, or the manifest
declares no meaningful gate surface. A command the repository does not declare is absent, not failing.

## List evidence

Read the manifest, list the declared primary entrypoints, then run the check-only gates locally in cheapest
order: format check, lint, typecheck, build, unit. Generated caches and ignored output are allowed; tracked
source mutation is not. Record command, exit code and failure counts. A missing prerequisite is
`unmeasured`, names the prerequisite, and does not support `ready`. Never run end-to-end suites unless the
request names them.

## Repair inventory

Read the manifest before running anything. Do not invent commands. Run existing gates in cheapest order:
format check, lint, typecheck, build, unit. Do not run end-to-end suites unless named by the request.
Record exact error, warning, failing-suite and file counts before the first source write.

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

Run the exact original gates again and report before/after counts. Zero is valid only with the same
commands, checkout revision and machine, without suppression. A ready verdict names every executed local
gate and its zero exit status.
