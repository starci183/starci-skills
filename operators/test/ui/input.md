# `test/ui` input

This closed JSON object is ephemeral task-session state and is purged on every parent-skill terminal state.

## JSON architecture

| Section | Owner | Meaning |
| --- | --- | --- |
| Root envelope | Skill machine | Accepted stage, status, and facts. |
| `payload.provided` | Previous state | Immutable refs: `previousStateRef`, `testPlanRef`, `changeSetRef`, `seedEvidenceRef`, `uiQualityEvidenceRef`. |
| `payload.loads` | Runtime | Exact bindings to load. |
| `payload.session` | Session runtime | Input, output, scratch, and cleanup lifetime. |

## Runtime loads

- `business`: must be `null`.
- `knowledge`: exact pinned `fe.ui-testing` only. The approved test plan, seed receipt, and UI-quality receipt already project journey, layout, state, fixture, and product-neutral quality authority; reloading their source knowledge would duplicate context.
- `source`: exact hash-pinned files only; broad repository preloading is forbidden.
- `commands`: declared argv, cwd, and environment-name allowlist only.
- `external`: declared resources and opaque credential handles only.
- `cache`: one exact fingerprint and optional session receipt candidate; UI reuse is disabled unless the approved test plan explicitly declares a fresh immutable proof boundary.
- `orchestration`: one mode and provider profile.

Validate before loading. Never persist input, loaded values, scratch, observations, or receipts.
