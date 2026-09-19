# tinkle-8 — modules/goal/: goal anatomy + decomposition rules

Read `tinkle/_common.md` first — same bar: pure yaml, business analysis, cite sources, mark inferred.

## Mission

Build `.claude/modules/goal/` — the knowledge module that makes a goal "smart enough to determine its op chain". This is NOT a lookup table: it is context + legality rules for the agent (running op `request.analyze`) that decomposes user input into a goal-plan, plus the rules the kernel uses to validate that plan.

## The methodology — state-space planning, NOT archetype matching

Core model: **an op is a state transition** — `needs:` (preconditions on state variables) → `produces:` (postconditions). The system's state space = the state variables carried by .starciwork records (`business: decided`, `sds: decided`, `ui.X: verified`, `impl.X: done`, `evidence: valid`, ...).

Goal decomposition is therefore classical planning:

```
1. PARSE    input → S*   : target-state expression ("thêm tính năng A" → {feature.A: exists ∧ proven})
2. SURVEY   measure S₀   : current state — query .starciwork owners + scan source surfaces
3. GAP      Δ = S* − S₀  : which state variables are missing / wrong / stale
4. CHAIN    backward-chain from S*: each missing variable → which op produces it
            → topological sort by needs → the op chain
5. VALIDATE legality: prereqs satisfied? scopes disjoint? which ambiguity tier fires?
```

Consequences that MUST be encoded in the yaml:

- **extend-vs-add falls out of GAP**: SURVEY finds `api.X: done` → Δ only contains the new part → chain shortens and records `extends: X`; the extended surface's `verified` variable goes stale → a regression/re-verification leg is generated automatically.
- **"cấn cấn" (mid-flight wrongness) = re-plan, not exception**: discovering the SRS is wrong = discovering S₀ was measured wrong (`sds: decided` actually invalid) → re-run from step 2 with corrected S₀ → new chain. No separate rollback logic.
- **ambiguity = missing information, tiered by WHERE it is missing**: intent ambiguous (can't form S*) → `provision.ask`; scope ambiguous (S* exists, Δ unmeasurable) → `scope.define` first; order ambiguous (S* and Δ known) → agent orders by `needs`, records `assumed:`.
- **archetypes are MEMOIZED PLANS, not the algorithm**: they cache common Δ→chain patterns for speed. When none matches, fall back to the 5-step method — never force-fit an archetype.

## KNOWN GAP — flag in report, do not fix

`modules/ops/*.yaml` (tinkle-1) currently declare `route:` matching keys but likely lack `produces:` postconditions — backward chaining needs them. Document the required `produces:` vocabulary in `legality.yaml` (what state variables each op establishes) and note in the report that tinkle-1 files need backfill + a future `scripts/route/route-plan.mjs` (chain builder; `route-op.mjs` only picks one op).

## Sources (read all)

- `.dist/kernel/goal.mjs`, `owner-requests.mjs` — goal lifecycle, amend/derive mechanics
- `ops/request.analyze/operator.yaml`, `ops/scope.define/`, `ops/goal.revise/`, `ops/scope.retire/` — the ops that do the breaking
- `.dist/schemas/goal.schema.json`, `goal-plan.json`, `execution-request.schema.json`
- `.dist/docs/workflow-goals.md`, `architecture-input-scope.md`, `scoped-approval.md`
- `modules/ops/*.yaml` (tinkle-1 output) — the `route:` blocks are what decomposition matches against

## Deliverables — `.claude/modules/goal/`

### `anatomy.yaml`
What a goal IS: goal_identity, revision counter, amendments[], nodes, scope, definition-of-done. How revision/amendment works (cite goal.mjs RPCs: goal_amend/goal_derive or observed equivalent). The key business answer: "goal is the machine-checkable contract between owner's intent and the op chain".

### `archetypes.yaml`
Decomposition PRIORS — not an enum. Each archetype = {match signals, typical op chain, notes}. Must cover at minimum:
- `feature-build-with-ui` — "code fe X" → [request.analyze, scope.define, interface.draw, interface.implement, work.author, uat.verify, review.verify]
- `feature-build-backend` — same minus draw leg
- `refactor` — [request.analyze, code.refactor, work.author(remap), review.verify]; NO draw/uat (behavior unchanged)
- `external-integration` — adds business.decide + architecture.decide + integration.verify; external legs pre-marked "settles inprogress if custody missing"
- `verify-only` — "lint check repo" → single review.verify; not every input needs a chain
- `investigate-first` — "app hơi lag" → perf.verify/diagnostic leg BEFORE any build leg
- `fanout` — goal with ≥2 disjoint-scope nodes → sibling goals, each own op chain + agent + worktree; join at integration.verify on parent
For each archetype: worked example decomposing a realistic owner prompt into the chain, with the reason each leg is included/excluded (e.g. "no interface.draw because no ui nodeKind").

### `existing.yaml` — the "what do we already have" leg
Goal breaking is NEVER on raw input — it is input × current-state. Before proposing a chain, the goal must identify what already exists that the request touches:

```yaml
# intent: "thêm tính năng A"
survey:
  - .starciwork records: is there an impl/br/fr owning the paths A would touch?
  - source: does api X / module X already exist and is it extendable?
decision:
  - X exists + extendable  → chain is EXTEND-shaped: [scope.define(delta), architecture.decide(extension points), backend.implement(extends X), uat.verify(A + regression on X)]
  - X exists + NOT extendable (sealed/other-owner) → chain is ADD-shaped: new module beside X + integration.verify on the boundary
  - X missing              → chain is BUILD-shaped: full archetype legs
```

Rules to encode:
- `existing-surface-detection`: every feature/refactor input gets a survey leg BEFORE the chain is proposed — cite `work-query.mjs`/ownership lookup as the mechanism (.starciwork owners → which record owns the touched paths).
- `extend-vs-add`: when target exists, the goal must record `extends: <record-id>` and the chain must include a regression/verification leg on the EXTENDED surface, not just the new feature — because touching X can break X.
- `reuse-over-rebuild`: if an existing impl already provides the capability, the correct chain may be ZERO build legs + one wiring/integration leg — flag this as a legal outcome, not a failure to decompose.
- `ownership-check`: if the touched surface is owned by a record in `done` state, the chain must include re-verification of that record (its baseline will go DEP_STALE on change — cite check-work-deep.mjs dep semantics).

### `legality.yaml`
The kernel-enforceable rules. Five families:

1. **forward_edges** — ordering constraints: ui work without interface.draw first → ILLEGAL; uat.verify before impl done → ILLEGAL; refactor without work.author remap → ILLEGAL. Encode as {if, then-required/before} rules.
2. **backward_edges** — the "cấn cấn" mechanism: mid-flight discovery (impl finds SRS contradicts UI) → NOT "fix quietly" → raise amendment → goal.revise → re-run from the affected boundary (business.decide / architecture.decide) → fresh evidence. Cite the work-correction policy in CLAUDE.md. Three suspicion levels: spec-conflict-in-scope (agent resolves via revise), scope-expansion (re-run scope.define, maybe provision.ask), identity-wrong (MUST provision.ask — never self-decide a goal_identity change).
3. **split_rules** — fan-out legality: split allowed ONLY if scopes are disjoint (no two nodes own the same path — cite the .starciwork ownership model); if can't split cleanly → serial, don't force. Each sibling gets own chain; parent keeps join ops (integration.verify, review.verify).
4. **existing_surface_rules** — the survey leg: input × current-state, extend-vs-add decision, extends: linkage, regression leg on extended surfaces, ownership-check on done records (DEP_STALE semantics). See `existing.yaml`.
5. **ambiguity_rules** — ladder by what is ambiguous: ORDER ambiguous → agent picks by route: prerequisites, records `assumed:` on the goal; SCOPE ambiguous → scope.define proposes then provision.ask; INTENT ambiguous → MUST provision.ask, never guess (a wrong identity voids all downstream evidence; a wrong order only costs re-runs).

### `README` — no. Pure yaml, comments carry the context.

## Report

`ex-testing/lint/tinkle-8-REPORT.md`: for each of 4 worked examples (feature-with-ui, refactor, external-integration, ambiguous-intent) hand-simulate the decomposition and show which rules fired. Marker `done/tinkle-8.done`.

## Boundaries

- READ-ONLY on `.dist/`, `ops/`, `modules/ops`, `modules/models` — write ONLY under `modules/goal/` + brief/report/marker.
- If `modules/ops/` route: blocks are missing keys you need (phase, prerequisites), report the gap in your report — do NOT edit other lanes' files.
