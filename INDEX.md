# StarCi Skills 3.0.0-alpha.1

The active entry is [SKILL.md](SKILL.md): the agent maps each prompt to a scope-bounded op chain, at most three sequential waves with at most three concurrent ops per wave. A product-owned completion tree, resources and evidence define the work; no unbounded chain or mandatory request/response ledger.

## Load order

1. Read SKILL.md fully.
2. Read [v3/README.md](v3/README.md) and the selected operator's common/document entries from [v3/ops/catalog.json](v3/ops/catalog.json).
3. Resolve only that operation's business nodes, resources, evidence and bound source.
4. Before maintaining this package, read [UPDATE.md](UPDATE.md).

## Active layout

- `v3/ops/`: detailed operation contracts and human Vietnamese mirrors.
- `v3/core/`, `v3/schemas/`: read-only completion/evidence validation.
- `v3/cli/`: inspect/init utilities, never product-operation dispatch.
- `bin/starci-skills.mjs`: installer and `work` CLI forwarding.
- Product `.work/`: current business tree and durable evidence; not inside the installed skill.

## Compatibility boundary

The top-level `operators/`, `routing.json`, `workflows/` and v2 orchestration scripts are retained historical compatibility sources, not the v3 runtime entry. Do not load their chain/session instructions to execute v3. Existing `.worktrees` data is unchanged; conversion needs a separate reviewed migration.

`npm test` validates the v3 implementation. `npm run test:legacy` retains the old suite for explicit investigation; it is not a claim that the old entrypoint/installer contract still applies. Public docs generated for v2 remain historical and are not v3 instructions.

## Lineage

3.0.0-alpha.1: replaces automatic orchestration with selected operations, completion-tree validation and explicit evidence/resource custody. Local alpha; no registry publication or live-product acceptance implied.
