# `be/mutation-contract` input

- `context.contextRefs`: exact canonical references resolved by default repository or file search.
- `context.sourceRefs`: exact routed source files permitted for this job.
- `input.project`: verified project identity.
- `input.objectiveRef`: exact bounded objective reference.
- `input.sourceFingerprint`: frozen fingerprint for the supplied source evidence.

Resolve the project backend Source through the runtime Source `<Source>/.workspaces` route. Durable roots are flat `.worktrees/_templates/`, `.worktrees/businesses/`, `.worktrees/uat/`, `.worktrees/sessions/`, and `.worktrees/debts/`; never use `.worktrees/<project>/`. Search the verified routed source directly with default repository or file search; do not create a derived source cache or external index.
