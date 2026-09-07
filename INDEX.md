# StarCi Work 3.0.0-alpha.2

Read [SKILL.md](SKILL.md) completely: prompt → named preset/mode → selected scope → bounded ops → actual result.

## Load order

1. Main skill and [runtime guide](v3/README.md).
2. [Skill catalogue](skills/catalog.json), then the selected skill document and fixed recipe.
3. Selected [op contracts](v3/ops/catalog.json) and common policy.
4. Actual product nodes, resources, evidence and bound source.
5. For package maintenance, [UPDATE.md](UPDATE.md).

## Current layout

- `skills/`: 14 named presets with EN/VI documents and fixed recipes.
- `v3/ops/`: 32 detailed operation contracts.
- `v3/core/`, `v3/schemas/`: completion, dependency, digest and evidence validation.
- `v3/cli/`: inspection/minimal initialization, not dispatch.
- `knowledge/`: reusable domain guidance, not routing or product truth.
- `bin/`: installer and CLI forwarding.
- Product `.work/`: completion tree, resources, sanitized evidence; outside the installed skill.

Across all selected skills/workers/retries: max three sequential waves × three simultaneous ops. Scope/dependencies remain product-owned; recipes only bound execution.

V2 alias/routing/workflows/helpers/operators/session scripts/templates/generated website and Lite are removed. Historical recovery uses Git. Old-name safety guards protect existing data; they are not a second runtime. Alpha/local tests do not establish product UAT or publication; installing does not migrate product ledgers or delete Git worktrees.
