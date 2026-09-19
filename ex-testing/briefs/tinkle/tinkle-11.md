# tinkle-11 — scripts/route/route-plan.mjs — the chain builder

Read `tinkle/_common.md`. `route-op.mjs` picks ONE op; you build the planner that chains MANY.

## Mission
`scripts/route/route-plan.mjs`: input = {input text or explicit S* vars} + S₀ measurement → output = ordered op chain with per-leg reasons.

```
node route-plan.mjs --target "feature.A: exists proven" --state .starciwork-path
node route-plan.mjs --simulate --target-json '{"sds":"decided","ui.X":"verified"}'
```

## Algorithm (from modules/goal/anatomy.yaml + legality.yaml — READ BOTH FIRST)
1. Parse S* — explicit vars or (for now) a small intent→S* table for the 7 archetypes in modules/goal/archetypes.yaml
2. Survey S₀ — read .starciwork records: state per record, owners, staleness (reuse patterns from scripts/check-work-deep.mjs / example-ownership.mjs)
3. Δ = S* − S₀
4. Backward-chain: each missing var → op whose produces: covers it (tinkle-10 is filling produces: — if an op lacks it, report the gap and use route.prerequisites+goal as fallback inference, marked)
5. Topo-sort by needs/prerequisites; detect cycles → report as plan-infeasible with the cycle
6. Apply legality rules: forward edges, split_rules (disjoint scope → fanout legs), ambiguity tier → emit `provision.ask` legs where required

## Output contract
JSON + human mode: ordered legs, each {op, produces-covered, needs-satisfied-by, extends?, assumed?}; plus `infeasible` report when no chain exists. Exit 1 on infeasible.

## Verify
Hand-run 4 scenarios: greenfield feature-with-ui, extend-existing-api, refactor, ambiguous-intent. Show chains in report `tinkle-11-REPORT.md`. Marker `done/tinkle-11.done`.

## Boundaries
Write ONLY scripts/route/route-plan.mjs + report + marker. Read modules/, scripts/, .starciwork of examples — don't edit them.
