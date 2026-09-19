# tinkle-1 — modules/ops/: catalog all 30 ops as pure yaml

Read tinkle/_common.md. Source: `.claude/ops/*/operator.yaml` (30 ops) + `ops/registry.yaml` + `ops/common.yaml`.

Produce `.claude/modules/ops/`:
- `registry.yaml` — the op list: each entry {id, kind-inferred, goal-oneliner, nodeKinds, completionProfile, sideEffects-summary, reads/writes scope, lifecycle-position}. The lifecycle-position + when-needed analysis is YOURS — derive it from the op's goal/reads/writes (e.g. `interface.draw` = pre-implementation direction-setting; `uat.verify` = post-implementation proof).
- `ops/<id>.yaml` per op — full port of operator.yaml PLUS a `business:` block: {question, whenNeeded, whenNot, consumes, produces, failureModes}. Only what sources support — mark inference.
- Do NOT move/delete `ops/` — modules/ is a parallel catalog; migration is a later decision.
- `.mjs` helpers in ops/ (select, contracts, generate, validate, role-authority) are engines — describe their ROLE in `registry.yaml`'s `engines:` section, don't port code.

## Amendment — route: block is mandatory
Every ops/<id>.yaml must carry `route:` {nodeKinds, phase, intent[], prerequisites[]} — derive keys from the operator.yaml's nodeKinds/graphPolicy/goal. This is what lets `scripts/route/route-op.mjs` pick without reading full files. Also generate `registry.yaml` via a small script (scripts/route/build-ops-registry.mjs) rather than hand-writing it — put a `# generated` header on it.
