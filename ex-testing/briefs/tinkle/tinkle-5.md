# tinkle-5 — coherence sweep + TINKLE report (WAIT LANE)

Read tinkle/_common.md. WAIT GATE: `tinkle-1..4.done` all present (poll ~3min, max 90min).

Then: (1) verify `modules/ops/registry.yaml` covers all 30 ops (diff vs `ls ops/`); (2) verify `modules/models/` covers every runtime in `.dist/model/runtimes.json`; (3) verify `schemas/index.yaml` covers every .dist schema; (4) run `check-example-work.mjs` + `check-work-deep.mjs` — confirm the moves broke nothing; (5) write `ex-testing/lint/TINKLE-FINAL.md`: what modules/ now contains, coverage table, gaps still open, and the business-analysis quality spot-check (pick 3 ops + 1 model, quote their business: blocks, judge if an agent could route correctly from them).

## Amendment — also wait tinkle-6.done, and verify resolvers
Add to coverage verification: run `route-op.mjs` and `route-model.mjs` on 3 real inputs each — confirm they resolve correctly against the yaml lanes 1-2 wrote. A resolver returning wrong picks = the route keys are wrong; report it, don't patch the script.
