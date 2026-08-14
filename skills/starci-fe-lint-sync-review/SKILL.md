---
name: starci-fe-lint-sync-review
description: Review canonical FE lint adoption, rule defects and visible product repairs before writing. Use after starci-fe-lint-sync-plan records the effective-config gap and candidate change tree. Writes no target source and approves one exact wiring and repair revision.
---

# StarCi FE Lint Sync Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print `CONTEXT` and read the lint Plan. `Touching` is the workflow and review artifacts only.

## PROCESS

Review canonical wiring separately from findings. Prove each finding against canon and source before
classifying it as product repair, rule defect or justified repository switch. Never approve lowering
a failing canonical rule to warning. Batch visible decisions such as token, landmark or spacing
changes and show their before/after evidence.

Append revisions and rejections. Complete only when the user approves the config and production
change boundary.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the approved adoption policy; `CHANGES` details only
workflow/review artifacts. Append `## review`, then invite `$starci-fe-lint-sync-apply`.
