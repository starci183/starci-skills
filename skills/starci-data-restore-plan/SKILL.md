---
name: starci-data-restore-plan
description: Inspect an encrypted StarCi snapshot and brief exactly what a restore will replace. Use before restoring local or remote datastore volumes or when verifying a backup in a scratch stack. Writes no live data and hands the destruction boundary to starci-data-restore-review.
---

# StarCi Data Restore Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Use `.workflows/data-restore/<app>/<name>.md`. Name the snapshot identity, target
stack, runtime, environment and whether the target is disposable.

## PROCESS

Verify ciphertext readability, checksum and manifest without restoring. Enumerate the target's live
volumes independently. Compare snapshot and target, name every volume replaced, missing or extra,
and state the health checks that prove recovery. Plan a backup of current target data unless the
approved purpose proves it disposable.

No target data is changed here.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the restore concept and impact. `CHANGES` details only
the workflow. Append `## plan`, then invite `$starci-data-restore-review`.
