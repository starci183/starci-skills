---
name: starci-data-restore-apply
description: Replace StarCi datastore volumes with the exact encrypted snapshot approved by starci-data-restore-review, restart the stack and prove health. Use only after explicit destructive approval. Never merges old and restored files or decrypts inside the repository.
---

# StarCi Data Restore Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Re-read the approved snapshot identity, target and replacement set. Confirm
`Repo / branch`, target environment and `Touching` once before destruction.

## PROCESS

Re-enumerate target volumes; a changed set returns to Review. Take the approved pre-restore backup.
Stop all readers, decrypt into a fresh temporary directory outside the repository, clear each target
including hidden files, restore exactly the manifest and remove temporary plaintext in `finally`.
Restart stopped services in `finally`.

Run the approved health checks and compare the restored identities/manifest. Do not claim success
when only archive extraction passed.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the recovered state. `CHANGES` details every replaced
volume, backup artifact, workflow update and safety-file edit. Append `## apply`; invite nobody.
