---
name: starci-data-backup-plan
description: Inventory and brief an encrypted snapshot of every datastore in a StarCi stack. Use before backup, migration, reseed, volume deletion or restore. Reads the runtime and repository safety configuration, writes no snapshot, and hands an exact scope to starci-data-backup-review.
---

# StarCi Data Backup Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Use `.workflows/data-backup/<app>/<name>.md`. Name the stack, runtime, compose
project, archive destination and whether the target is local or remote.

## PROCESS

Ask the runtime for every mounted datastore or persistent volume; do not use a handwritten service
list. Inspect running writers, available downtime, archive size, free space, `.gitignore`,
`.gitattributes` and the age recipient without printing secrets. Plan plaintext staging outside the
repository and encrypted-at-rest output only.

Write a brief naming all captured volumes, consistency method, stop/start sequence, encryption path,
verification method, retention destination and restore command. No snapshot is created here.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the snapshot concept and coverage. `CHANGES` details
only the workflow. Append `## plan`, then invite `$starci-data-backup-review`.
