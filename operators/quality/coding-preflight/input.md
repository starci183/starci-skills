# `quality/coding-preflight` input

Bind one frozen coding scope to exact implementation references and applicable static contracts before any product-source mutation.

`targetFiles` contains only the approved write boundary. `referenceFiles` contains the nearest maintained implementation or template for the same responsibility. `lintFiles` and `typescriptFiles` contain only configuration or local declarations that actually govern those targets.

The deferred plan always names `lint`, `typecheck`, and `sonar`, with `staticGateTrigger` fixed to `commit-or-explicit-gate-request`. These commands remain dormant during ordinary coding, builds, focused tests, deployment recovery and UAT. They activate automatically before an authorized commit, or when the user explicitly invokes the standalone static-quality-gates capability. Independent read-only preparation may run in parallel; Sonar waits for its required coverage artifact and no lane may run indefinitely.

## JSON architecture

| Section | Ownership | Purpose |
| --- | --- | --- |
| Route envelope | Skill machine | Require `quality.coding-preflight / ready`. |
| `payload.provided` | Previous states | Bind the frozen coding scope and approved contract. |
| `payload.loads.targetFiles` | Runtime resolver | Load only exact files in the approved write boundary. |
| `payload.loads.referenceFiles` | Runtime resolver | Load the nearest maintained implementation or template. |
| `payload.loads.lintFiles` | Runtime resolver | Load only applicable ESLint configuration and rules. |
| `payload.loads.typescriptFiles` | Runtime resolver | Load only governing TypeScript contracts and local public types. |
| `payload.loads.knowledge` | Runtime resolver | Load the pinned `quality.source-gates` record only after exact bindings are known. |
| `payload.loads.orchestration` | Runtime resolver | Bind dormant gates, activation trigger, dependency order, and time budget. |
| `payload.session` | Session runtime | Hold ephemeral input, bindings, preflight plan, and output. |
