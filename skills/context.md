# Skill runtime router

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-catalog` | `skill-runtime/catalog/catalog.json` | file | shortlist one semantic facade and route its exact mode to one physical skill before loading any skill body |

## Routes

The twenty capability entries each live in their own capability folder as `SKILL.md`. Use `@skill-catalog` first:
select one of its seven semantic facades, then one exact mode, apply the declared exclusions and risk/read/write filters,
and load only the routed physical skill. Full skill bodies do not participate in shortlisting. A facade is non-executable
selection metadata; it transfers no approval, permission, proof or orchestration identity to its target.

Exact skill names remain valid explicit routes. If catalog evidence cannot separate two modes, recover the missing
observable fact instead of loading both skills. Rebuild the generated catalog from its overrides and physical
frontmatter; never edit `catalog.json` by hand.

`skill-shape/context.md` is shared runtime policy, not a capability entry. Every selected capability compiles its
own `Run` or `Process` through that module's context-envelope and `Input → Transform → Output → Gate` contract.
Use `dual-track` only for genuinely independent origins, `reconciliation` for declared-versus-observed work and
`linear` for a single authority; never duplicate this shared pipeline law inside individual skills. Every physical
capability reaches `orchestration/context.md` through `skill-shape`, resolves its exact `profiles.skillMaps` entry
and follows one phase map. Layout, Block and Refactor keep their explicit orchestration step; other capabilities
reuse their existing `PIPELINE` steps. Any map may execute sequentially when no safe disjoint task has positive
coordination benefit.

Every map declares both `manual` and `auto`. Manual remains the default; exact `mode=auto` binds the selected
skill to the immutable invocation envelope and advances only gate-passed checkpoints inside the disclosed scope.
Read-only and no-write capabilities never invent a write approval.

## Default topology registry

The selected capability may narrow its topology when its own `Run` proves a different authority shape. These are
the defaults used before execution:

| Topology | Capability entries | Join law |
|---|---|---|
| `dual-track` | `starci-architecture-analyze`, `starci-be-plan`, `starci-fe-design-layout` | isolate independent constraint/journey evidence from observed source capability, then join only gate-passed artifacts |
| `reconciliation` | `starci-be-approve`, `starci-business-analyze`, `starci-cloudflare-tunnel-set`, `starci-debt-repay`, `starci-deploy`, `starci-diagnose`, `starci-fe-design-block`, `starci-fe-design-refactor`, `starci-fe-design-resolve`, `starci-fe-ui-reconcile`, `starci-grammar-refresh-references`, `starci-init`, `starci-repair`, `starci-setup-mcp`, `starci-setup-sonar`, `starci-stale-list` | compare declared authority with observed state and emit one discrepancy/repair receipt |
| `linear` | `starci-conversation-record` | advance one fenced authority through ordered gate-passed artifacts; do not invent a second branch |

`dual-track` means one isolated owner for each track and one coordinator when delegation is available. Without
delegation, the same runtime uses sequential context firewalls: finish and gate one track, clear its working notes,
finish and gate the other, then load only both receipts for the join.
