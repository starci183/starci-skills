---
name: starci-data-backup-review
description: Review and approve a StarCi datastore snapshot boundary, downtime, encryption, retention and restore verification. Use after starci-data-backup-plan inventories the live stack. Writes no snapshot and loops until the user approves one exact backup revision.
---

# StarCi Data Backup Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT` and read the backup Plan. `Touching` is the workflow only.

## PROCESS

Show the exact datastores captured, what will stop, expected interruption, plaintext staging
location, encryption recipient identity, destination, size/cost warning and verification path. A hot
backup is a revision with named consistency risk, not a silent fallback. Missing encryption or an
unknown datastore blocks approval.

Append feedback, revisions and rejections. Complete only when the user approves the coverage,
downtime, destination and verification method.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the approved snapshot policy; `CHANGES` details only
the workflow. Append `## review`, then invite `$starci-data-backup-apply`.
