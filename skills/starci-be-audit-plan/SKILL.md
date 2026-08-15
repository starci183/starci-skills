---
name: starci-be-audit-plan
description: Measure a StarCi or nivo backend repository's real lint, build, typecheck, test and runtime gates and write an exact zero-error repair brief. Use when backend CI is red, lint errors are numerous, build or tests fail, quality debt must be inventoried, or the user asks to audit/clean the backend before changing source. Writes no target source and hands one evidence-backed boundary to starci-be-audit-review.
---

# StarCi BE Audit Plan

Read [`../../skill-shape.md`](../../skill-shape.md) completely before continuing.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`; never infer a target from
`Source`. Resolve the backend repository, current branch, package manager and workflow at
`.workflows/lint/<app>/<name>.md`. `Touching` is the workflow only.

## PROCESS

1. Read `AGENTS.md`, package/workspace manifests, lockfiles, compiler configs, lint configs, test
   configs and CI workflows. Derive commands from source; do not assume `npm`, Jest or ESLint.
2. Record `git status --short` before running gates. Preserve every existing change. Plan is
   read-only against the target and never runs a command with `--fix`, `--write` or snapshot update.
3. Run each discovered non-mutating gate independently and record command, exit code, duration,
   failing files, rule/error codes, suite counts and stderr. Include at least lint, build/typecheck
   and the repository's ordinary unit test lane. Run a live/runtime probe only when it is already
   safe and configured; otherwise name it as acceptance evidence.
4. Distinguish warnings from errors. The default closure is zero lint errors and successful
   build/typecheck/tests. Zero warnings is required only when CI uses a warning budget such as
   `--max-warnings=0`, canon requires it, or the user explicitly requests it.
5. Group findings by root cause, not by line: product-source defect, lint/config wiring,
   dependency/toolchain mismatch, generated artifact drift, flaky/environmental failure, or
   pre-existing unrelated worktree state. Prove each representative against source.
6. Name every candidate file before it is edited. Separate mechanical formatting from semantic or
   runtime changes. Any severity change, ignore pattern, dependency upgrade, generated-file rewrite
   or public/runtime behavior change is an explicit Review decision.
7. Define the shortest safe order of repairs and the exact full commands that prove zero-error
   closure. Never propose `eslint-disable`, broad exclusions, skipped tests, weakened severity,
   `any` casts or snapshot acceptance as cleanup substitutes.

Write no product, config, lockfile, generated source or snapshot in Plan.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`,
`### REJECTED` and `### OWED`, in that order.

Append `## plan` with the baseline gate matrix, root-cause groups, exact candidate tree and closure
commands. `CHANGES` lists only the workflow. Invite `$starci-be-audit-review`.
