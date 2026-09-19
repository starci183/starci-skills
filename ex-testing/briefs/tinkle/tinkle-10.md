# tinkle-10 — backfill produces: into modules/ops/*.yaml

Read `tinkle/_common.md` + `tinkle-8.md` methodology section. tinkle-8's `modules/goal/legality.yaml` defines the state-variable vocabulary — READ IT FIRST and reuse its variable names exactly.

## Mission
Every `modules/ops/ops/<id>.yaml` needs a `produces:` block — the postcondition state variables the op establishes — so backward-chaining (GAP → chain) works. Currently ops only have `route:` matching keys (needs-side).

## Per op, add
```yaml
produces:
  - <state-var>: <value>          # e.g. sds: decided, ui.<node>: implemented
  invalidates: [...]              # which state vars go stale when this op runs (e.g. impl change stales verification)
  consumes: [...]                 # which state vars must already hold (complements route.prerequisites)
```
Base each op's produces on its operator.yaml `goal`, `nodeKinds`, `completionProfile`, and the records/evidence it writes (cite ops/<id>/operator.yaml). tinkle-8's legality.yaml vocabulary is authoritative — if a needed variable is missing there, add it to YOUR report's "vocabulary gaps" section rather than inventing a divergent name.

## Also
- Update `modules/ops/registry.yaml` ONLY via `node scripts/route/build-ops-registry.mjs` — never hand-edit.
- Report: per-op produces summary table + vocabulary gaps found. Marker `done/tinkle-10.done`.

## Boundaries
Edit ONLY `modules/ops/ops/*.yaml` (+ regenerated registry). Do not touch modules/goal or .dist.
