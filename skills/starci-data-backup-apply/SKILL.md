---
name: starci-data-backup-apply
description: Create the encrypted StarCi datastore snapshot approved by starci-data-backup-review, restart stopped services and prove the archive can be decrypted and enumerated. Use only after explicit approval. Never leaves plaintext in the repository or silently omits a volume.
---

# StarCi Data Backup Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Read the approved Review, then confirm the runtime, destination and `Touching`
boundary once before writing.

## PROCESS

Re-enumerate volumes and compare them with the approved set. If they differ, return to Review. Stop
approved writers unless the approved revision is hot. Stage plaintext in a fresh temporary directory
outside the repository, archive every approved volume, encrypt before the artifact lands in the
repository, and clean the temporary directory in `finally`. Restart everything stopped in `finally`.

Verify archive readability, manifest coverage, size and checksum without printing data or secrets.
Where approved, restore into a scratch stack; otherwise record that proof as `OWED`. Verify ignore
and binary-attribute behavior before any git action.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the verified snapshot. `CHANGES` details the archive,
manifest, workflow and any safety-file edits. Append `## apply`; invite nobody.
