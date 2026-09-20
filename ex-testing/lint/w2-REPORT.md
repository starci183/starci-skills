# w2 — route-plan + dispatch-op (tinkle-11 + tinkle-12) — REPORT

Lane: wave2/w2. Scope: `scripts/route/route-plan.mjs` (chain builder) +
`scripts/route/dispatch-op.mjs` (dispatch packet + Orca spawn). Executed
sequentially per `ex-testing/briefs/wave2/w2.md`.

## Files written (only these)

- `scripts/route/route-plan.mjs` — NEW
- `scripts/route/dispatch-op.mjs` — NEW

No other files touched. `.dist/` never read by the new scripts (sources read
directly: `modules/ops/ops/*.yaml`, `modules/goal/legality.yaml`,
`modules/models/profiles/*.yaml`, `scripts/example-ownership.mjs`).

## Prior state found / mid-flight changes

- `modules/{ops,models,goal}` complete; `modules/kernel/` landed mid-flight
  (header says TINKLE-9 / WAVE2-w1) — `dispatch.yaml` + `verdict-contract.yaml`
  now exist, so the packet was reconciled against the LANDED contract, not just
  the brief spec. Shapes matched (op/brief/context/constraints/returns); the
  landed `spawnMechanics` adds a `terminal-read` readiness step which was added
  to the spawn sequence.
- `produces:` backfill verified present on all 30 ops — but it is PROSE under
  `business.produces:`, not machine-readable. `route:` blocks still carry only
  `prerequisites`. The planner therefore consumes
  `modules/goal/legality.yaml producesVocabulary.opProduces` (the declared
  vocabulary) and falls back to `route.intent`/goal matching marked
  `produces-inferred` when the vocabulary lacks an entry.
- `model/*.yaml` was renamed to `legacy/model/` and re-homed under
  `modules/models/` by another lane during this run — no impact (neither new
  script reads `model/`).

## route-plan.mjs — what it does

PARSE → SURVEY → GAP → backward-CHAIN → topo-sort → VALIDATE, per
`modules/goal/anatomy.yaml` decomposition + `legality.yaml` families:

- S* input: `--target "<var>: <state>"` (repeatable), `--target-json '{...}'`,
  or `--text "<prompt>"` resolved through a small intent→S* table for the 7
  archetypes (`archetypes.yaml`), composing by union. `feature.A: exists
  proven` expands to `impl.A: done` + `api.A: verified` (`--surface ui` flips
  the proof to `ui.A: verified`).
- S₀ survey: `--state <.starciwork>` loads records via
  `example-ownership.mjs::loadRecords`, maps `work/*` schemas to variable
  families, `state: done` = settled; `work/gap` records surface as open gaps.
  `--simulate` pins S₀ empty.
- Backward chain: each Δ var → producer from `producesVocabulary.opProduces`;
  multi-producer vars disambiguate via archetype hints/impl qualifier
  (frontend/backend), else pick is recorded as an ORDER-tier `assumed`.
- Prerequisites: fixed phrase table maps each observed `route.prerequisites`
  string to a chain edge (`business.decide done`), a state-var need (`scope
  defined`), a compound (`delivered code + existing regression coverage`), or
  a recorded `condition` (`an owner-only input is needed`, etc.).
- Injected legs (Δ alone never produces them, per archetypes): `work.author`
  before implement legs on scoped chains AND after `code.refactor`
  (remap-after-refactor), `provision.ask` before `integration.verify`
  (integration-after-custody), `perf.verify#baseline` before scoping for
  investigate-first, `review.verify` closing build chains (kernel-planned).
- Legality: cycle → `infeasible` + cycle printed, exit 1; unproducible var →
  `infeasible` + gap list, exit 1; forward edges checked
  (verify-after-implement, draw-before-ui-build, decide-before-build);
  ≥2 implement legs get a `parallel` verdict — `undetermined` without
  allowlist data (serialFallback per legality.yaml). INTENT ambiguity (no
  archetype, no target) emits a single `provision.ask` leg — never a guess.

## dispatch-op.mjs — what it does

- Packet per `modules/kernel/dispatch.yaml`: `{op, brief:
  modules/ops/ops/<id>.yaml, context: {records, owned_paths}, constraints:
  {model, provider, budget, lease}, returns: {verdict: pass|fail|blocked,
  evidence, suspicion}}`.
- `owned_paths` resolved from `--records` via `loadRecords` +
  `resolveOwnedDirs` (incl. prover-fallback) against `--state`.
- `--model` resolves `modules/models/profiles/<target>.yaml` →
  `launch.orca.command` (default `qwen-agent`, the orchestration default).
- Orca path reconciled with the REAL CLI (verified live this session):
  `orca terminal create --worktree <sel> --title "[Op] <id>" --command <cmd>
  --json` → receipt `result.terminal.handle`; `orca terminal read --terminal
  <h> --screen --json` (readiness); `orca terminal send --terminal <h> --text
  <prompt> --enter --json`. Matches `providers/orca/calls.yaml`
  terminal-create/-read/-send receipts.
- Managed-agent profiles (claude/codex: `launch.orca.kind: managed-agent`)
  print the `orca orchestration worker-start` path instead and REFUSE `--spawn`
  (needs an orchestration Task id — `providers/orca/index.yaml`
  managedFallback).
- `--spawn` requires `--lease`; on Windows it invokes `orca.cmd`.
- Compact agent prompt: op id, brief path, records, owned_paths, lease/budget,
  verdict contract path `modules/kernel/verdict-contract.yaml`, "return
  verdict+evidence, cite suspicion".

## Verification output (all run this session)

### route-plan — 4 required scenarios + extras

1. Greenfield feature-with-ui —
   `--simulate --text "build the enrolment screen"` → exit 0, chain:
   request.analyze(external) → scope.define → business.decide →
   architecture.decide → brand.decide → interface.draw → work.author(injected)
   → interface.implement → uat.verify → review.verify(injected). Matches
   archetype #1.
2. Extend-existing-api —
   `--state examples/todo-app-backend/.starciwork --target "api.audit:
   verified" --target "impl.audit.export: done"` → 227 records surveyed (121
   settled, 41 open gaps); e2e.verify satisfied `implementation done` from
   `S0:impl.audit.todo-app-backend.erasure (done)`; impl producer ambiguity
   recorded as ORDER-tier assumption. Also `--target "feature.A: exists
   proven" --state ...` → backend.implement with prereqs satisfied-by-S0.
3. Refactor — `--simulate --text "refactor the audit module..."` →
   test.author(conditional: only if coverage missing, test-gap route) →
   code.refactor → work.author(remap-after-refactor) → review.verify. The
   pre-existing delivered code is an `assumed` soft need, not a build leg —
   matches archetype #3 (scope.define correctly excluded).
4. Ambiguous-intent — `--simulate --text "do something about the app"` →
   `status: needs-owner`, single provision.ask leg, exit 0.

   Extra: `--simulate --target-json '{"sds":"decided","ui.X":"verified"}'` →
   full decide+direct+implement+verify chain; `"integrate VNPay..."` →
   provision.ask custody pre-mark before integration.verify; `"app hơi lag"`
   → perf.verify#baseline before scope.define (evidence-before-boundary);
   `--target "nonexist.thing: frobnicated"` → INFEASIBLE exit 1 with the
   unproducible var named.

### dispatch-op — 3 dry-runs (per brief; no real --spawn — see assumptions)

1. `--op backend.implement --records fr.audit.log.read,impl.audit.todo-app-
   backend.erasure --state examples/todo-app-backend/.starciwork --model
   qwen-agent --budget 50000 --lease lease-demo-123 --dry-run` → complete
   packet; owned_paths resolved incl. prover-fallback
   (`src/modules/bussiness/audit` via `impl...operator-read`); qwen
   command-terminal launch line printed.
2. `--op uat.verify --records ui.audit.privacy --state ... --dry-run` → packet;
   owned paths resolved through the prover impl record (frontend repo paths —
   relative to the fe repo root, noted).
3. `--op provision.ask --model claude-agent --lease L3 --dry-run` →
   managed-agent kind detected; `worker-start` command shown, terminal-create
   correctly NOT offered.
   `--op nonexistent.op` → exit 1, "no brief".

## Assumptions / limitations (all marked in output where they occur)

- produces vocabulary = `legality.yaml producesVocabulary.opProduces`
  (declared table), not a `route.produces` field — that field does not exist
  yet; `business.produces` is prose. Fallback inference path is marked.
- Prerequisite phrases are matched by a fixed table of the ~15 observed
  strings; an unrecognized phrase degrades to a `condition` note on the leg,
  never a silent drop.
- S₀ staleness is shallow (record `state` + gap records); full DEP_STALE
  needs the `_derived/deep-baseline.json` baseline — not reproduced here.
- `request.analyze` is an `external` leg (model/kinds.yaml `external: true`) —
  listed, never dispatched.
- e2e.verify in the integration archetype is not Δ-driven (nothing requires
  `api.X: verified`) — the planner produces it only when the target names it.
- Disjointness for fanout needs per-leg allowlists that exist only after
  scope.define; legs are marked `parallel: undetermined` → serial fallback.
- No real `--spawn` was executed: no idle test op exists and a real spawn
  creates a live Orca agent. The spawn path (create → read → send, handle from
  `result.terminal.handle`) is documented above and exercised in dry-run.

## Needed elsewhere (not mine to touch)

- `scripts/route/route-model.mjs` was repointed from `.dist/model/*.json` to
  `modules/models/*.yaml` by its owning lane mid-flight (observed in git diff
  during this run) — no action needed from w2.
- `modules/ops/ops/*.yaml` `route:` blocks could gain a machine-readable
  `produces:` field so the planner stops depending on the legality.yaml side
  table (tinkle-10 territory).
