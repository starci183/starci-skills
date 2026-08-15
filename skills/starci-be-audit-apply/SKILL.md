---
name: starci-be-audit-apply
description: Apply an approved StarCi or nivo backend audit repair and keep iterating until lint has zero errors and the frozen build, typecheck, test and runtime gates pass. Use only after starci-be-audit-review approves one exact revision and file boundary. Preserves unrelated work, forbids suppressions or weakened gates, records every pass, and never reports clean while an unexplained error remains.
---

# StarCi BE Audit Apply

Read [`../../skill-shape.md`](../../skill-shape.md) completely before continuing.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require the same user-declared `Project` or explicit targets used by Review. Resolve the backend,
branch and matching `.workflows/lint/<app>/<name>.md`; read the approved Review completely. Print
`CONTEXT` and confirm `Repo / branch`, `Approved revision` and exact `Touching` once before writes.

## BASELINE

Inspect `git status`, staged diff and untracked files. Preserve unrelated work. Before the first
approved target write, create and record the baseline commit required by `skill-shape.md`.

If unrelated dirty files prevent an honest baseline, do not reset, stash, stage or absorb them.
Report the exact overlap and request one baseline decision. Never call a partly repaired tree the
baseline.

## REPAIR LOOP

1. Re-run the frozen gates without mutating flags and record the actual starting counts.
2. Repair one root-cause batch at a time inside `Touching`. Prefer the smallest semantic fix that
   removes the cause across its family; do not mechanically rewrite unrelated files.
3. After each batch, run the narrowest relevant lint/build/test command. When it passes, run the
   full frozen gate matrix. Continue while safe in-boundary work remains; there is no arbitrary
   iteration limit.
4. A required file outside `Touching`, a rule defect, a dependency decision not approved, or a
   runtime/product behavior decision returns to Review. Environment failures receive safe
   diagnostics and fallbacks before they may be marked OWED.
5. Never gain green by adding or widening ignores, lowering severity, adding inline disables,
   skipping tests, deleting assertions, accepting snapshots blindly, hiding stderr, using
   `|| exit 0`, or excluding changed source from a gate.
6. Run formatting or lint `--fix` only when Review approved that mechanical rewrite and the diff is
   inspected immediately afterward. Use `apply_patch` for deliberate source edits.
7. If runtime-visible code changed, use the app's authorized test persona and run the affected live
   flow. Inspect response/network evidence plus frontend/backend terminal output. Record no
   password, token, cookie or secret.

## CLEAN EXIT

Apply closes only when all are true:

- every frozen lint command exits `0` with zero error diagnostics;
- build and typecheck exit `0`;
- every frozen test lane exits `0`, with no unexpected skip, open handle or unhandled rejection;
- warning count meets the approved policy and is recorded even when non-blocking;
- runtime proof has no unexplained error when runtime behavior changed;
- `git diff <baseline>` stays inside `Touching` and contains no suppression or gate weakening.

Do not translate partial progress into PASS. If an external or approval blocker remains, append the
exact failing command, final diagnostic and clearing action to `OWED`.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`,
`### REJECTED` and `### OWED`, in that order.

Append `## apply` with `Applied revision`, `Baseline commit`, `Tracked diff`, before/after gate
matrix, iteration ledger and live-flow proof when applicable. `CHANGES` names every path in the
tracked diff. Run the workflow validator before closing.
