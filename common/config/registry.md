# Rules registry ownership

## The three registries

| Root | May contain | Must not contain |
|---|---|---|
| `.claude/common/` | Shared configuration, context routing, workflow/lifecycle rules, cross-role vocabulary | FE-only UI law, BE-only architecture law, machine paths |
| `.claude/fe/` | Frontend gates, contract construction, ownership, presentation and FE lint rules | Backend business behavior, workspace routing, local paths |
| `.claude/be/` | Backend patterns, architecture, transport, persistence and BE lint rules | UI composition, workspace routing, local paths |

No fourth rules root is allowed. A new cross-role rule goes under `common`; a rule with one role
owner goes under that role. Support trees remain separate:

- `skills/` tells an agent how to execute a capability;
- `sources/` contains executable enforcement and twin tests;
- `scripts/` contains shared deterministic tooling.

Support code must point back to the owning registry rule. It must not become a parallel statement of
the rule.

## Resolution

Load `common` first. Load `fe` or `be` only after roles are resolved from `.workspace`. A request
covering both roles loads both registries but does not merge their ownership: backend behavior owns
business truth; frontend contract owns UI relationships and composition.

`fe-legacy` is a workspace role, not a registry. It uses `.claude/fe/` only to interpret parity and
migration evidence. It never overrides the active FE contract or creates a `fe-legacy` rules tree.
