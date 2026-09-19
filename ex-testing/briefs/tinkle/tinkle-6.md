# tinkle-6 — scripts/route/ resolvers (WAIT LANE)

Read tinkle/_common.md incl. amendment. WAIT GATE: `tinkle-1.done` + `tinkle-2.done` (you consume their yaml shapes). Max 60min poll.

Then write:
- `scripts/route/route-op.mjs` — CLI: `node scripts/route/route-op.mjs --kind <opKind> [--nodeKind ui] [--phase pre-implementation] [--intent direction]`. Loads all `modules/ops/*.yaml`, scores `route:` matches deterministically (exact-kind > nodeKind > phase > intent overlap), prints: top pick + score breakdown + yaml path + runner-ups. Exit 1 with reasons when zero candidates match.
- `scripts/route/route-model.mjs` — CLI: `--kind --risk --floor --tools --contextTokens`. Executes `modules/models/selection.yaml` rules order-sensitively; prints model + rule that fired + fallback chain.
- `scripts/route/build-ops-registry.mjs` — regenerates `modules/ops/registry.yaml` from per-op yamls (`--check` mode diffs without writing, for CI).
- TEST: fixture-test 5 op routes (e.g. kind=interface.draw intent=direction → interface.draw) + 3 model workloads incl. one fallback + one refusal. Report the test table.
