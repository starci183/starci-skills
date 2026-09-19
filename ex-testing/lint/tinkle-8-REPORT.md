# TINKLE-8 — modules/goal report

**Brief:** `ex-testing/briefs/tinkle/tinkle-8.md` (amended — state-space planning methodology)
**Deliverables:** `modules/goal/{anatomy,archetypes,existing,legality}.yaml`

The business answer the module encodes: **a goal is the machine-checkable
contract between the owner's intent and the op chain.** The amended brief
reframes *how* the chain is found: **an op is a state transition**
(`needs:` → `produces:`) and decomposition is **classical planning**, not
archetype matching:

```
1. PARSE    input → S*   : target-state expression
2. SURVEY   measure S₀   : current state — .starciwork owners + source surfaces
3. GAP      Δ = S* − S₀  : which state variables are missing / wrong / stale
4. CHAIN    backward-chain from S*: missing var → which op produces it → topo-sort by needs
5. VALIDATE legality     : prereqs satisfied? scopes disjoint? ambiguity tier?
```

`anatomy.yaml` encodes the state model + the 5 steps; `existing.yaml` is the
SURVEY leg (input × current-state, extend-vs-add); `archetypes.yaml` holds the
seven priors explicitly as **memoized plans** — a Δ→chain cache, not the
algorithm; `legality.yaml` is the five-family rulebook VALIDATE runs.

Below, four owner prompts are hand-simulated **through the 5 steps**, showing
which rules fired.

---

## Simulation 1 — feature-with-ui

**Prompt:** "code fe the course-enrolment screen for the academy app"

### 1. PARSE → S\*
`{feature.enrolment-screen: exists ∧ proven}` — a UI surface that works.
Intent unambiguous ("code fe" + named screen).

### 2. SURVEY → S₀
Ownership lookup (`ledger.mjs inScope`/`executableCandidates` over
`.starciwork` allowlists) + source scan: no record owns the enrolment screen's
paths; no `ui`/`impl` node for it exists. S₀ = feature absent; `brand:
settled` already true (existing brand record).
`existing-surface-detection` rule satisfied — survey ran before the chain.

### 3. GAP → Δ
`{business.enrolment: decided, sds.enrolment: decided, ui.enrolment: drawn,
ui.enrolment: assets, impl.enrolment(fe): done, ui.enrolment: verified,
slice: reviewed}` — all missing (BUILD shape, `existing.yaml` decision row 3).

### 4. CHAIN — backward from S\*
Each Δ variable → the op that produces it (`legality.yaml producesVocabulary`):

| Δ variable | produced by | needs |
|---|---|---|
| `scope: defined` | scope.define | request analyzed |
| `business: decided` | business.decide | scope defined |
| `sds: decided` | architecture.decide | business decided |
| `ui: drawn` | interface.draw | business+sds+brand |
| `ui: assets` | interface.asset | ui drawn w/ artworkSlots |
| `impl(fe): done` | interface.implement | ui drawn + sds |
| `records: authored` | work.author | scope defined |
| `ui: verified` | uat.verify | impl done + served build |
| `slice: reviewed` | review.verify | a delivery |

Topo-sort by needs → the chain. Archetype cache hit: **`feature-build-with-ui`** — the memoized Δ→chain pattern matches this Δ exactly, so steps 3–4 short-circuit to the cached plan, then get confirmed leg by leg.

### 5. VALIDATE
- `forwardEdges: draw-before-ui-build` — interface.implement after interface.draw (designGate enforces, `sync.mjs`). ✓
- `forwardEdges: frontend-after-direction-and-design` — draw + sds prereqs met. ✓
- `forwardEdges: verify-after-implement` — uat/review after impl. ✓
- `existingSurfaceRules: survey-before-chain` — survey ran. ✓
- Ambiguity: none fires — intent/scope/order all determined.

### Owner moments
None unless critique raises a hidden-decision or a brand gap surfaces
(brand-gap → brand.decide route). `impl.enrolment(fe)` being a *new* variable
means no DEP_STALE regression leg — nothing existing was touched.

### Inferred vs observed
*Observed:* lane order, designGate, route prerequisites. *Inferred:* the
produces: vocabulary itself (see gap report below) and the module-tier
placement of review.verify.

---

## Simulation 2 — refactor

**Prompt:** "refactor the enrolment service to split the eligibility rules into their own module"

### 1. PARSE → S\*
`{impl.enrolment: done(restructured), behaviour: invariant}` — the S\* names a
*shape* of existing code, not a new variable.

### 2. SURVEY → S₀
The enrolment service exists — `impl.enrolment: done`, owned by a record in
`done` state. **`existingSurfaceRules: done-record-reverify` fires**: the
touched surface is done-owned, so its baseline will go DEP_STALE on the change
(`check-work-deep.mjs` — "proof was captured against older premises").

### 3. GAP → Δ
`{impl.enrolment: done(restructured)}` — but the SURVEY finding adds a second
variable: `{impl.enrolment.evidence: re-verified}` — the record's
`sourceIdentity`/`currentCodeMap` must be re-anchored to the moved code and
the suite re-run, or the done variable isn't done.

### 4. CHAIN
| Δ variable | produced by | note |
|---|---|---|
| `impl: done(restructured)` | code.refactor | needs regression coverage to exist (prereq); missing → test-gap → test.author first |
| `records: remapped` | work.author | the REMAP leg — pins evidence to new source identity |
| `slice: reviewed` | review.verify | reads that behaviour held + record now matches code |

Archetype: **`refactor`** — cache hit on the memoized plan.

### 5. VALIDATE
- `forwardEdges: remap-after-refactor` — **the load-bearing rule**: work.author remap is mandatory, not optional; evidence pins identity (`work-verification.md`). ✓
- `existingSurfaceRules: extends-must-record-and-reprove` — `extends: impl.enrolment` recorded; the re-verification leg is in Δ. ✓
- `backwardEdges: spec-conflict-in-scope` *(armed)* — if the refactor surfaces that SRS describes eligibility differently than code: NOT a quiet fix — `srs-gap` → business.revise (reopen, limit 2) → dependents stale-marked → re-prove. That's re-planning (S₀ re-measured), not rollback.
- Excluded: no draw/uat/e2e (behaviour-invariant — "no interface.draw because no ui nodeKind"; a new walk proves nothing the suite doesn't).

### Owner moments
`scope-expansion` if "their own module" touches undeclared paths → re-run
scope.define → provision.ask if it widens authority (AUTHORITY_WIDENING).

### Inferred vs observed
*Observed:* DEP_STALE semantics, the test-gap route, sourceIdentity binding.
*Inferred:* the remap leg is a work.author op specifically (the record-author
kind) — sources say the mapping must move; the op pairing is module analysis.

---

## Simulation 3 — external-integration

**Prompt:** "integrate VNPay for course payments"

### 1. PARSE → S\*
`{integration.vnpay: verified(live, owner-credential)}` — the S\* names a
*proof against a real provider*, which is what makes this archetype distinct.

### 2. SURVEY → S₀
No record owns a VNPay integration; the payment-call surface doesn't exist.
`provision.vnpay-credential: provided` reads absent — `credentialNeed` in
`owner.mjs` already matches "VNPay" + "payments" (api-key/secret words).

### 3. GAP → Δ
`{business.payments: decided, sds.payments: decided, provision.credential:
provided, impl.payments(be): done, api.payments: verified,
integration.vnpay: verified, slice: reviewed}`

### 4. CHAIN
| Δ variable | produced by | needs |
|---|---|---|
| `business/sds: decided` | business.decide → architecture.decide | chained prereqs |
| `provision.credential: provided` | provision.ask | **STOP kind — pauses requester until owner acts** |
| `impl(be): done` | backend.implement | business+sds done |
| `api: verified` | e2e.verify | impl done |
| `integration: verified` | integration.verify | impl done + custody |
| `slice: reviewed` | review.verify | delivery |

### 5. VALIDATE
- `forwardEdges: integration-after-custody` — **fires hard**: custody must be
  in progress before the verify leg needs it. The "settles inprogress if
  custody missing" rule made concrete: provision.ask opens a credential
  owner-request and pauses the requester; if custody is still absent when
  integration.verify runs it reports blocked/environment →
  `environment-needs-the-user` (needUser); and the ask only settles `verified`
  *after* integration.verify reports done+pass
  (`verifyAcceptedIntegrationOwnerRequests`). The proof is never faked to
  close the ask. ✓
- `forwardEdges: backend-after-decisions` — leg gated on both decides. ✓
- `ambiguityRules: INTENT` *(armed)* — had the prompt said "take payments"
  without naming VNPay, S\* couldn't be formed → provision.ask, never a
  guessed provider.

### Owner moments
The credential ask IS the structural one — the one thing the runtime cannot
obtain itself. Conditional second: if `done` names a **live** charge,
`IRREVERSIBLE_RULES` raise a second stop before real money moves.

### Inferred vs observed
*Observed:* pause-on-provision, environment→needUser route,
credential-verified-only-after-pass. *Inferred:* provision.ask placed in the
chain upfront vs arising only from critique `provisions` — the analyzer's
prior for a prompt that names a provider.

---

## Simulation 4 — ambiguous-intent

**Prompt:** "sort out the enrolment thing"

### 1. PARSE → S\*
**FAILS.** "sort out" names no state change; "the enrolment thing" names no
variable. S\* cannot be formed — **`ambiguityRules: INTENT` fires at the top
rung**: PARSE is where the information is missing.

### The legal chain — deliberately short
| Op | Why |
|---|---|
| request.analyze | external intake; classifies the ambiguity |
| provision.ask | the intent question to the owner — the ONLY legal next step |

No SURVEY leg is even meaningful yet — SURVEY measures S₀ against an S\*;
without S\* there's nothing to measure *for*.

### Why never-guess is structural
Every downstream op/question/decision/report binds `goalRev` (`goalRevOf`);
a wrong intent voids all of it. And the kernel forbids the quiet fix:
`validateGoalRevision` rejects an identity change; the amendment binds
`baseGoalIdentity`. The only honest move is the owner question.

### After the owner answers ("it's double-enrolling students")
S\* forms → SURVEY runs (does an enrolment impl exist? state? extendable?) →
Δ computes → CHAIN. A double-enrolment fix likely lands investigate-first or
feature-build-backend shape depending on whether cause is known — but that
decomposition happens against a real S\*, not a guess.

### VALIDATE
- `ambiguityRules: INTENT` — primary rule; chain stops at the ask.
- `ambiguityRules` escalation — intent before scope before order; the lower
  rungs were uncomputable while this one was open.
- `backwardEdges: identity-wrong` — the *reason* never-guess is absolute:
  identity cannot move under the goal's feet.

### Inferred vs observed
*Observed:* goalRev binding, identity immutability, provision stops.
*Inferred:* the ladder ordering as a pipeline-stage mapping (PARSE/SURVEY/CHAIN)
— the kinds and the never-guess rule are sourced; the stage framing is the
brief's own methodology encoded.

---

## Gap report — `produces:` vocabulary missing from modules/ops (flagged, not fixed)

The amended brief names this directly, and it's real: **`modules/ops/ops/*.yaml`
route: blocks carry `prerequisites:` (the needs) but no `produces:` (the
postconditions).** Step 4 of the method — backward chaining, "each missing
variable → which op produces it" — cannot run against the route index today;
the lookup table doesn't exist there.

What this module did about it:

- `legality.yaml producesVocabulary` **specifies the required vocabulary** —
  the state variables a goal's S\* is written in
  (`business.X: decided`, `sds.X: decided`, `ui.X: drawn/verified`,
  `impl.X: done`, `evidence.X: valid`, `provision.X: provided`, ...) and the
  `opProduces` map: which op establishes which variable(s). Derived from
  `kind.writes` + lane step purposes in `model/kinds.yaml` — marked inferred,
  since no `produces:` field exists in the sources.
- **The fix belongs to tinkle-1's lane, not this one** (read-only boundary):
  each `modules/ops/ops/<op>.yaml` route block needs a `produces:` key
  backfilled from this vocabulary.
- **A future `scripts/route/route-plan.mjs`** (chain builder) would consume
  it — `route-op.mjs` picks ONE op for a job; a planner walks `produces:`/
  `needs:` backward from S\* to S₀ and returns the topo-sorted chain. Today
  that walk is the agent's job, guided by this module's YAML.

Related gaps found while reading (same "report, don't fix" rule):

1. **`work-query.mjs` does not exist** — the brief cites it as the
   ownership-lookup mechanism for the survey leg. The actual mechanism is
   `ledger.mjs` (`inScope`, `executableCandidates`, `decisionCandidates`,
   node allowlists) plus `intake.mjs`'s `extensions.work3.reconciliation`
   typed rows (`reference`/`conflict`/`new`). `existing.yaml` cites the real
   sources.
2. **`riskHints` absent on ~half the ops** — present on build/effect ops;
   missing on `security.verify`, `perf.verify`, `review.verify`, all the
   decide/author/intake ops. A consumer keying safety off `riskHints` reads
   them as riskless — mostly true, but the two verify ops touch a served
   target like `e2e.verify`'s `served-target` hint names.
3. **`nodeKinds` vocabulary ≠ lane match keys** — `uat.verify` says
   `nodeKinds: [uat.ux]` while the Work-tree kind is `uat`; the decide/intake
   ops say `[operations]`/`[business]` — family names, not node kinds a lane
   matches. `route.nodeKinds` means "which family this op serves"; the
   authoritative nodeKind→chain map is `model/kinds.yaml` lanes.
4. **`phase` mixes stage + coarsePhase** — `[decide, cross-cutting]`,
   `[intake, pre-implementation]`; a strict matcher must treat phase as
   set-membership, not a single value.

---

## Files

- `.claude/modules/goal/anatomy.yaml` — goal identity, rev/amendments, the
  **state model** (op = needs→produces transition; goal = S\* over
  .starciwork variables) and the **5-step decomposition** (PARSE→S\*,
  SURVEY→S₀, GAP→Δ, backward-CHAIN, VALIDATE; cấn cấn = re-plan not rollback),
  plus derivation/critique/approval/revision/question mechanics.
- `.claude/modules/goal/archetypes.yaml` — the seven priors reframed as
  **memoized Δ→chain plans** (cache, not algorithm; fall back to 5-step when
  no cache hit; BUILD shape assumed, SURVEY may shorten to EXTEND/ADD).
- `.claude/modules/goal/existing.yaml` — the SURVEY leg: ownership lookup +
  source scan + reconciliation rows; the extend-vs-add decision
  (EXTEND/ADD/BUILD shapes); the four rules (existing-surface-detection,
  extend-vs-add, reuse-over-rebuild, ownership-check) with DEP_STALE
  semantics.
- `.claude/modules/goal/legality.yaml` — **five** rule families
  (forward edges, backward edges, split rules, existing-surface rules,
  ambiguity ladder) + the `producesVocabulary` table that documents the
  missing `produces:` contract.

All YAML parses clean. Read-only boundary respected: nothing under `.dist/`,
`ops/`, `modules/ops/`, `modules/models/` touched.
