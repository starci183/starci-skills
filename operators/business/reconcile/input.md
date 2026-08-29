# `business/reconcile` input

- `context.contextRefs`: exact canonical references resolved by default repository or file search.
- `context.sourceRefs`: exact routed source files permitted for this job.
- `input.project`: verified project identity.
- `input.objectiveRef`: exact bounded objective reference.
- `input.sourceFingerprint`: frozen fingerprint for the supplied source evidence.

For durable business authority, references must use the verified project backend Source flat `.worktrees/businesses/` root. The runtime Source owns `.claude/.workspaces`; never add a project segment below `.worktrees/`.
