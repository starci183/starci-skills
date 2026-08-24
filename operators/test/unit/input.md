# `test/unit` input

This closed JSON object is ephemeral task-session state and is purged on every parent-skill terminal state.

## JSON architecture

| Section | Owner | Meaning |
| --- | --- | --- |
| Root envelope | Skill machine | Accepted stage, status, and facts. |
| `payload.provided` | Previous state | Immutable refs: `previousStateRef`, `testPlanRef`, `changeSetRef`, `seedEvidenceRef`. |
| `payload.loads` | Runtime | Exact bindings to load. |
| `payload.session` | Session runtime | Input, output, scratch, and cleanup lifetime. |

## Runtime loads

- `business`: must be `null`.
- `knowledge`: exact pinned `fe.unit-testing`.
- `source`: exact hash-pinned files only; broad repository preloading is forbidden.
- `commands`: declared argv, cwd, and environment-name allowlist only.
- `external`: declared resources and opaque credential handles only.
- `orchestration`: one mode and provider profile.

Validate before loading. Never persist input, loaded values, scratch, observations, or receipts.
