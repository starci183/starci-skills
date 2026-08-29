# `deployment/manifest-validate` input

- `context.contextRefs`: exact canonical references resolved by default repository or file search.
- `context.sourceRefs`: exact routed source files permitted for this job.
- `input.project`: verified project identity.
- `input.objectiveRef`: exact bounded objective reference.
- `input.sourceFingerprint`: frozen fingerprint for supplied evidence.

The runtime Source resolves routes through `.claude/.workspaces`; project authority lives only in the verified backend Source under flat `.worktrees/<kind>`.
