---
title: Source gates
---

# Source gates

## Stale signature

The repository's own check-only format, lint, typecheck, build or unit command fails, or the manifest
declares no meaningful gate surface. A command the repository does not declare is absent, not failing.

## List evidence

Read the manifest and list only declared primary entrypoints. Mark results `unmeasured`: stale-list never
executes project gates because typecheck/build/test can write caches, output and incremental state.

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
commands and the same machine, without suppression.
