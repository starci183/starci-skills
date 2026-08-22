# Skill runtime router

## LOADS

None.

## Routes

The seventeen capability entries each live in their own capability folder as `SKILL.md`. Select them from their frontmatter
descriptions and load exactly one binding entry unless the owner explicitly requests separate runs.

`skill-shape/context.md` is shared runtime policy, not a capability entry. Every selected capability compiles its
own `Run` or `Process` through that module's context-envelope and `Input → Transform → Output → Gate` contract.
Use `dual-track` only for genuinely independent origins, `reconciliation` for declared-versus-observed work and
`linear` for a single authority; never duplicate this shared pipeline law inside individual skills. Layout, Block
and Refactor additionally load `orchestration/context.md`, display one orchestration step and follow its frontend
phase map. Every other capability stays sequential until it declares and validates its own map.

## Default topology registry

The selected capability may narrow its topology when its own `Run` proves a different authority shape. These are
the defaults used before execution:

| Topology | Capability entries | Join law |
|---|---|---|
| `dual-track` | `starci-be-plan`, `starci-fe-design-layout` | isolate demand/journey evidence from schema/source capability, then join only gate-passed artifacts |
| `reconciliation` | `starci-be-approve`, `starci-business-analyze`, `starci-cloudflare-tunnel-set`, `starci-debt-repay`, `starci-deploy`, `starci-diagnose`, `starci-fe-design-block`, `starci-fe-layout-refactor`, `starci-grammar-refresh-references`, `starci-init`, `starci-repair`, `starci-setup-mcp`, `starci-setup-sonar`, `starci-stale-list` | compare declared authority with observed state and emit one discrepancy/repair receipt |
| `linear` | `starci-conversation-record` | advance one fenced authority through ordered gate-passed artifacts; do not invent a second branch |

`dual-track` means one isolated owner for each track and one coordinator when delegation is available. Without
delegation, the same runtime uses sequential context firewalls: finish and gate one track, clear its working notes,
finish and gate the other, then load only both receipts for the join.
