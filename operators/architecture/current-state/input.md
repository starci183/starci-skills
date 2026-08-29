# `architecture/current-state` input

- `context.contextRefs`: exact canonical references resolved by default repository or file search.
- `context.sourceRefs`: exact routed source files permitted for this job.
- `input.project`: verified project identity.
- `input.objectiveRef`: exact bounded objective reference.
- `input.sourceFingerprint`: frozen fingerprint for the supplied source evidence.

Resolve routed source identity through the runtime Source `.claude/.workspaces`. Any project authority reference uses the verified backend Source and its flat `.worktrees/` roots.
