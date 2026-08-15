---
name: starci-be-audit-review
description: Review and revise a StarCi or nivo backend zero-error audit brief before repairs. Use after starci-be-audit-plan measures lint, build, typecheck, test or runtime failures. Verifies root causes, rejects suppression-based cleanup, freezes exact files and proof commands, writes no target source, and ends only after explicit approval of one revision for starci-be-audit-apply.
---

# StarCi BE Audit Review

Read [`../../skill-shape.md`](../../skill-shape.md) completely before continuing.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require the same user-declared `Project` or explicit target repositories used by Plan. Resolve the
backend repository and read the matching `.workflows/lint/<app>/<name>.md`. Print `CONTEXT` before
target-specific work. `Touching` is the workflow and review evidence only.

## PROCESS

1. Re-read the live configs and re-run representative failing commands when needed to prove the
   Plan is still current. Do not repair target source.
2. Review each root-cause group separately. Classify every proposed change as product source,
   config/rule, dependency/lockfile, generated artifact, test defect or environment/runtime.
3. Challenge false-green proposals. Reject reduced severity, new ignore patterns, inline disable,
   skipped suites, snapshot replacement without behavioral proof, test-only branches, unsafe casts
   and deletion of failing coverage.
4. Freeze the exact target file tree and repair order. A wildcard directory is not a write
   boundary. Name generated outputs and lockfiles explicitly when they may change.
5. Freeze closure policy:
   - every approved lint command exits `0` with zero error diagnostics;
   - build/typecheck exits `0`;
   - approved test lanes exit `0` with no unexpected skip or open-handle failure;
   - warning count satisfies the repository's frozen warning policy;
   - changed runtime flows show no unexplained HTTP, console or terminal error;
   - final diff contains no new suppression, severity weakening or coverage exclusion.
6. Decide how Apply will baseline a dirty repository. Unrelated user changes may not be reset,
   overwritten or silently included in the audit commit.
7. Loop brief -> feedback -> revision -> workflow append until the user explicitly approves one
   revision and its exact `Touching` boundary.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`,
`### REJECTED` and `### OWED`, in that order.

Append `## review`, record `Approved revision: <identity>`, and list only workflow/review artifacts
in `CHANGES`. Invite `$starci-be-audit-apply` only after explicit approval.
