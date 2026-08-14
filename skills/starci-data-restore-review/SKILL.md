---
name: starci-data-restore-review
description: Review and explicitly approve the destructive boundary of a StarCi datastore restore. Use after starci-data-restore-plan verifies the snapshot and compares its manifest with the target. Writes no live data and loops until the target, replacement set and recovery proof are approved.
---

# StarCi Data Restore Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT` and read the restore Plan. `Touching` is the workflow only.

## PROCESS

State what current data will be destroyed, by datastore name. Show snapshot identity, target
environment, manifest differences, pre-restore backup, downtime, clear-not-merge method, restart
sequence, health checks and rollback evidence. Any non-local target requires explicit approval.

Append feedback, revisions and rejections. Complete only when the user approves the exact destructive
boundary and snapshot identity.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the approved recovery point; `CHANGES` details only
the workflow. Append `## review`, then invite `$starci-data-restore-apply`.
