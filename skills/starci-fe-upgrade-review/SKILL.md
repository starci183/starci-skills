---
name: starci-fe-upgrade-review
description: Review and revise evidence-backed StarCi trust-tree upgrades before changing canon, skills, workflow shape or lint gates. Use after starci-fe-upgrade-plan groups repeated real rejections. Writes no trust rules and ends with explicit approval per proposed change.
---

# StarCi FE Upgrade Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print `CONTEXT`. Read `.workflows/upgrade/<app>/<name>.md`. `Touching` is the upgrade workflow and
review artifacts only.

## PROCESS

For each proposal, show the deduplicated workflow witnesses, what the rules said at the time, the
smallest general rule that covers those witnesses and its correct home. Ignore `None`, `not recorded`
and reconstructed memories. Keep one-off evidence watched rather than promoted.

Revise proposals after feedback and append every rejection. Approve proposals independently; one
refused group does not block unrelated groups. Complete only when every travelling change has an
explicit approved wording, home, test obligation and write boundary.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names approved rule concepts; `CHANGES` details only the
workflow/review artifacts. Append `## review`, then invite `$starci-fe-upgrade-apply`.
