# Run — full-feature on the pro-subscription promise, round 2 (2026-09-03)

A dry session of StarCi Skills 1.0.3 whose purpose is the parallel step: the step where a backend
branch and a frontend branch run side by side, laid out as `step-N/parallel-1` and `parallel-2` under
one `state.json`, each branch validated on its own, `validate-step` run on each, and the rule that no
two branches of one step share a write alias observed on the live session rather than on the example
files. Session root `.worktrees/sessions/20260903-r2-full-feature/`, kept on disk and gitignored
(`.gitignore:107 /.worktrees/`). One orchestrator plus one agent per operator, all inside one process.

Every branch below names the profile its `operator.json` binds, and every branch was actually run by
Claude Opus standing in for that profile. The stand-in is not one hop but two for four of the seven
branches: 1.0.3 binds an OpenAI profile everywhere, so `workspace.bind`, `backend.source.apply` and
`quality.verify` bind `luna`, whose declared equivalent in `resources/orchestrator.json`
`profileEquivalents.pairs` is `sonnet` — and this run used `claude-opus-5` for them as well, because
the processor is one model. `business.decide`, `architecture.decide` and `frontend.direction.decide`
bind `sol-fresh`, whose declared equivalent is `opus`, and those three are the only branches whose
running model matches the published pairing. The tree has nowhere to record any of this: see R2-3.

Nothing was committed, nothing was written into either checkout or into the businesses worktree, no
`.claude` runtime file was edited, no git write command was run anywhere, no e2e was run, and no
secret was read or printed.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `full-feature`, run as written including its presets |
| Feature | `pro-subscription` — businesses head `.worktrees/businesses/features/pro-subscription/model.json`, registry content address `eccaeaadb6a4…`, state `pending` |
| Backend target | `src/modules/bussiness/pro-subscription`, routed checkout `D:/Repositories/starci-academy-backend` |
| Frontend target | `/[lang]/subscriptions`, routed checkout `D:/Repositories/starci-academy-fe` |
| Frozen backend head | `90ef7fcb8dfbe83129af877e15a2c5fc029358de` (branch `mtp`, dirty only under `.workspaces/projects/tayson`) |
| Frozen frontend head | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (branch `main`, clean) |
| Chain as published | bind ×2 → business (model) → architecture → [backend apply ∥ direction] → [quality ∥ resolve] → apply → audit → quality → business (reconcile) → publish |
| Chain actually run | step 1 `[1/1 bind be, 1/2 bind fe]` → step 2 `[2/1 bind fe, resume]` → step 3 `[3/1 business.decide]` → step 4 `[4/1 architecture.decide + critique]` → step 5 `[5/1 backend.source.apply dry ∥ 5/2 frontend.direction.decide]` |
| Ended | step 5, both branches blocked to a person: `CONTRACT_UNFROZEN` (contract → user) and `CHANGE_LEVEL_AMBIGUOUS` (caller → user) |
| Overrides | one, on the caller's instruction: `backend.source.apply` runs `mode: dry`, which the workflow does not preset. Everything else ran on the workflow's own presets, including the two that produced the run's two most useful stops |

The session id is `20260903-r2-full-feature`, not the
`<yyyymmdd-HHMMss>-<project>-<first operator>` shape `resources/orchestrator.json` publishes; the test
owner fixed the root, and nothing in the tree reads or checks a session id (R2-8).

---

## Step 1 — `workspace.bind` ×2, the first parallel step

Two branches of one step, both `workspace.bind`, dispatched together: `1/1` binds `be` with
`runtimeNeed: none`, `1/2` binds `fe` with `runtimeNeed: consume`, exactly as `full-feature`'s first
step presets them. Neither writes anything outside its own `response/`, so their write-alias sets are
both empty, the intersection is empty, and two concurrent agents are lawful under
`maxConcurrentAgents: 3`.

**Profile** `operator.json` binds `luna` (`resources/agents/profiles/openai.json`, equivalent `sonnet`);
both branches run here by Claude Opus.

### `1/1` — be, `done`

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

The two route halves agree on project, role, repository and branch, so the Source checkout itself
binds at `90ef7fcb…` on `mtp`. The portable declaration `.workspaces/projects/starci-academy/be.json`
carries no `gitPolicy` at all, so the conservative reading binds `worktreeBranches: forbidden` and
`mutationReadiness: read-only`. The hydrated route still records `d5926ae8…`, one commit behind; the
observed head is the binding and the stale record is a finding subject rather than something to
recompute. Two write roots are declared: `src`, the only product path a later backend apply would
write, and `.workspaces/projects/tayson`, which is not a write intent at all but the only field the
operator offers for tolerating the person's uncommitted route declarations — the same waiver round 1
had to invent, and still the same gap.

### `1/2` — fe, `blocked` with `RUNTIME_NOT_READY`

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-2
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-2
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-1/parallel-2
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-2
valid workspace.bind branch
```

A valid `blocked` is green: both gates enforce the required outputs only on a `done` branch, and
`workspace.bind`'s own validator additionally refuses a route on a blocked branch, which this one
correctly does not carry.

The registry `.worktrees/sessions/central-runtime/owner.json` advertises generation 6, status `ready`,
frontend `http://localhost:3000`, api `http://localhost:3001`, identity `http://localhost:8080`, last
attested 2026-09-01T19:54Z at frontend head `5fe51662…`. The probe contradicts it:

```text
$ curl -s -o /dev/null -w "%{http_code}" --max-time 6 http://localhost:3000/en/subscriptions
000
$ curl -s -o /dev/null -w "%{http_code}" --max-time 6 http://localhost:3001/graphql
000
$ curl -s -o /dev/null -w "%{http_code}" --max-time 6 http://localhost:8089/
000
```

The attested head is not the routed head either (`5fe51662…` against `8d8ed9a1…`). The registry is
stale rather than ready, the operator never starts a shared process, and the `runtime` domain routes
`external`. This is R2-4, and it is the round-1 fix over-correcting: `runtimeNeed: consume` was added
to the step-1 fe bind so the audit at step 7 could capture, and the effect is that all five
frontend-touching workflows now block on their own first step whenever no preview happens to be
served.

## Step 2 — `workspace.bind`, the resume of `1/2`

The person answered the external stop the way `resources/orchestrator.json` `session.lifecycle.block`
prescribes: they supplied the field the stop names. The delta is one requirement, `runtimeNeed`
`consume` → `none`, so the resume brings a real change and not the same input twice. The branch
re-enters as `2/1` with `resume { step: 1, parallel: 2, token: step-1-parallel-2-runtime-not-ready }`
and the blocked branch stays on disk as evidence.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-2/parallel-1
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

`starci-academy/fe` binds to the sibling checkout at `8d8ed9a1…` on `main`, clean, with no endpoints
and `authorityRoots.businesses` null, which is correct for a sibling. The receipt states the price of
the delta rather than hiding it: with no runtime bound, the audit later in this chain has nothing to
capture. `mutationReadiness` is `ready` here and `read-only` on the be branch, decided on the same
axis — the fe declaration carries `worktreeBranches: session-only`, the be declaration carries no
policy — and both values pass the validator either way, so round 1's O11 is still open and is now
visible as two different answers inside one session (R2-9).

## Step 3 — `business.decide`, mode `model`

**Profile** `sol-fresh` (equivalent `opus`); run by Claude Opus. **Status** `done`, no stop, no
fallback.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-3/parallel-1
step valid

$ node .claude/operators/business-decide/validate.mjs <session>/step-3/parallel-1
valid business.decide branch
```

The promise was modelled at `90ef7fcb…`. Round 1's `backend-feature` run modelled the same feature at
`d5926ae8…`, and the re-binding of its 22 claims to this head is proof rather than assumption:
`git diff --stat d5926ae8..90ef7fcb -- src` is empty, the one commit between the two heads edits
`.workspaces/projects/starci-academy/fe.json` and nothing else, and two claims were re-read at the new
head by hand (`pro-subscription.service.ts:60-67`, `graphql-must-enrolled.guard.ts:42-64`). Fifteen
dimensions each carry one disposition — seven `replace` or `preserve` on real positive and negative
proof, six `defer` to phases the published head itself names, none `not-applicable`. Fingerprints are
recomputed for this session and are internally consistent: `claims.fingerprint` is the sha256 of the
claims array, `coverage-matrix.fingerprint` the sha256 of the rows array, and `model.json` carries
both plus a `headFingerprint` over the promise, state, lineage and those two fingerprints.

The publication itself was withheld: step 8 would write the head under `@worktrees/businesses`, and
the test harness forbids writing there. `response/data/model.json` is the head that would be
published, and `state.json` says so. The consequence is not cosmetic and is filed as R2-11: every
later operator binds the business authority as a **Context alias**, never as an Input, so steps 4 and
5 read the on-disk `pending` head and no path exists by which this branch's own model reaches them.

## Step 4 — `architecture.decide`, with the nested `critique` exchange

**Profile** `sol-fresh` (equivalent `opus`); run by Claude Opus. **Status** `waiting` → `done`.
**Fallback taken** `COMPATIBILITY_UNVERIFIED`.

The branch observed the current state at the frozen head, deepened the single alternative
`single-effective-access-collaborator`, and then paused exactly as the operator's step 8 prescribes,
emitting a response with `status: waiting` and
`awaiting { exchange: critique, kind: independent-critique }`. That snapshot is kept beside the branch
as `step-4-parallel-1-waiting-snapshot.json`, because the resumed agent overwrites
`response/response.json` in place and the pause would otherwise leave no trace — the same
orchestrator-level workaround round 1 needed. The orchestrator then wrote
`critique/request/request.json` with `stack-model` as its only input and no requirements, ran a fresh
agent for it, and resumed the paused one when the exchange answered `done`. Eight adverse paths were
attacked from the stack model alone and all eight hold.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node .claude/scripts/validate-request.mjs <session>/step-4/parallel-1/critique
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-4/parallel-1
response valid

$ node .claude/scripts/validate-response.mjs <session>/step-4/parallel-1/critique
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-4/parallel-1
step valid

$ node .claude/operators/architecture-decide/validate.mjs <session>/step-4/parallel-1
valid architecture.decide branch
```

`validate-step` is the gate that does the real work here: it reads the operator's Outputs table, finds
the declared `critique` exchange, and validates that folder's own request and response as a pair,
refusing a `done` branch whose declared exchange never ran or did not finish.

**The half of this case that could not be exercised.** The instruction was to run the waiting exchange
*while the sibling branch keeps running*, and `full-feature` gives it no sibling: step 3 of the
published chain is `[architecture.decide]` alone. That is not a local accident. No example workflow in
`workflows/` ever places an exchange-bearing operator in a multi-branch step — `architecture.decide`
is solo in `full-feature` and in `backend-feature`, and `content.generate` is solo in `content-unit` —
so the sentence in `architecture.decide`'s own operator.md, "Other branches of the same step keep
running throughout", and the same promise in `resources/orchestrator.json` `handoff.waiting`, are
claims no published chain can put under test. The pause and the resume are exercised here; the
concurrency around them is not, and that is R2-5.

## Step 5 — the parallel step: `backend.source.apply` ∥ `frontend.direction.decide`

This is the step the case exists for. Both branches were dispatched together from step 4's `next`,
which names both operators and matches `architecture.decide`'s Next table.

**Write aliases.** `5/1` `backend.source.apply` holds `@workspaces/be` — exclusive per checkout under
`resources/orchestrator.json` `concurrency.sharedCheckout`, and held even under `mode: dry`, because
the lease is taken at dispatch and the mode is the agent's to honour. `5/2`
`frontend.direction.decide` writes nothing outside its own `response/`: its Boundary says context is
read-only. The intersection of the two write sets is empty, `@workspaces/be` and `@workspaces/fe` are
different checkouts anyway, and the two agents are lawful together under the three-agent ceiling.
`state.json` records the sets it dispatched on rather than asserting the rule was met.

### `5/1` — `backend.source.apply`, `mode: dry`, `blocked` with `CONTRACT_UNFROZEN`

**Profile** `luna` (equivalent `sonnet`); run by Claude Opus.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-5/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-5/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-5/parallel-1
step valid

$ node .claude/operators/backend-source-apply/validate.mjs <session>/step-5/parallel-1
valid backend.source.apply branch
```

1.0.3 added the `dry` mode round 1 asked for, and this branch reached it: the gate is valid, the
observed head equals the frozen `90ef7fcb…`, and step 1 passed. Step 2 is where it stops, and the
reason is structural. The operator freezes its contract from the Input `architecture-decision`, and
neither half of that kind carries a mutation. `stack-model.schema.json` publishes `decisionId`,
`selectedAlternativeId`, `alternatives`, `boundaries`, `stores` and `components`;
`architecture-decision.contract.json` publishes Decision, Current state, Alternatives, Boundaries,
Data ownership, Stack delta, Handoff and Fallbacks taken. Neither carries an operation with a
`writerRef`, a `transactionBoundary`, an `idempotencyKind`, `migrationRefs` or an
`authorityDecisionId` — which is exactly the set `mutations.schema.json` requires at least one of, and
exactly what this operator's own prose says it reads from the frozen input rather than from a person,
because "a person retyping a contract into a request is how the contract and the implementation
quietly diverge". Filling the plan anyway would mean inventing the operations and their writers here,
which is the definition of `CONTRACT_WIDENED`. The contradiction is sharper than a missing field:
`architecture.decide` is told its "handoff names contracts, never implementation files", while
`backend-source-apply/validate.mjs:74` checks `operation.writerRef` against the `mutableFileRefs`
ceiling — the producing operator is forbidden to write the very value the consuming schema requires.
A second wall stands immediately behind: every operation must cite an `authorityDecisionIds` entry
matching `^BA-[0-9]+$`, and no producer anywhere in the tree emits such an identifier. See R2-1 and
R2-2.

### `5/2` — `frontend.direction.decide`, `blocked` with `CHANGE_LEVEL_AMBIGUOUS`

**Profile** `sol-fresh` (equivalent `opus`); run by Claude Opus.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-5/parallel-2
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-5/parallel-2
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-5/parallel-2
step valid

$ node .claude/operators/frontend-direction-decide/validate.mjs <session>/step-5/parallel-2
valid frontend.direction.decide branch
```

The workflow presets this branch `intent: create, changeLevel: new`, and its `when` says the chain is
for a feature that needs *a new frontend surface*. The mission's surface is not new. At the frozen
head the routed checkout carries `src/app/[lang]/subscriptions/page.tsx`, mounting
`src/components/pages/ProSubscriptionPage`, which composes
`src/components/blocks/commerce/ProSubscriptionBlock`; the route file was last written on 2026-09-02
in `82b9e9af`, and round 1 ran `frontend-refine` against this same surface. Step 2 therefore cannot
resolve the change-level authority: `create` occurs with `new` and only with it, `new` closes the
state set before anything is drawn, and step 4 would have to observe that the target is absent. The
operator does not settle it by quietly demoting itself to `reconstruct` — the change level is the
request's own authority, and no operator rewrites its own requirements — and it does not draw a page
that already exists on the strength of a preset. This is the tree behaving correctly, and it is round
1's G4 arriving with teeth: nothing anywhere says whether a caller may override a preset, so a
half-matching `when` becomes an operator stop three steps later instead of a refusal at Setup (R2-6).

### How the step resolved

Both branches blocked, independently, to different domains — `contract` → `user` and `caller` →
`user` — and neither blocked because of the other. The step advances nowhere: `full-feature` step 6 is
`frontend.presentation.resolve` fed by a direction that does not exist, and step 5's own second branch
`quality.verify` would have nothing written to verify. The session status is `blocked`, the folder is
kept, and two questions go to a person rather than one. Steps 6 to 10 of the chain
(`quality.verify ∥ frontend.presentation.resolve`, `frontend.source.apply`, `frontend.surface.audit`,
`quality.verify`, `business.decide reconcile`, `git.publish`) were never dispatched.

## The parallel step in `state.json`

`state.json` is the only place the orchestrator's own moves are recorded, so the transitions it
carries are the readable form of everything above. The parallel-step entries, verbatim:

```json
{
  "at": "step-5",
  "event": "dispatch",
  "branches": ["5/1", "5/2"],
  "writeAliases": { "5/1": ["@workspaces/be"], "5/2": [] },
  "note": "the parallel step: backend.source.apply holds @workspaces/be for writing (dry, so it writes nothing), frontend.direction.decide writes only its own response/; the intersection of the two write-alias sets is empty, so both run concurrently"
},
{ "at": "5/1", "event": "blocked", "stop": "CONTRACT_UNFROZEN", "domain": "contract", "route": "user" },
{ "at": "5/2", "event": "blocked", "stop": "CHANGE_LEVEL_AMBIGUOUS", "domain": "caller", "route": "user" },
{
  "at": "step-5",
  "event": "resolved",
  "resolution": "blocked: both branches blocked independently, each to a person; the step advances nowhere and the session stops with two open questions rather than one"
}
```

and the leases the step held:

```json
"leases": {
  "5/1": { "agent": "backend.source.apply@luna/run-by-claude-opus", "holds": ["@workspaces/be"] },
  "5/2": { "agent": "frontend.direction.decide@sol-fresh/run-by-claude-opus", "holds": [] }
}
```

The first parallel step resolved the other way and is recorded in the same shape: `1/1` `done`, `1/2`
`blocked` with `RUNTIME_NOT_READY` routed `external`, then a `person-decision` entry and the resume as
`2/1`. Both `chain` and `steps` carry `1/1` and `1/2` as one step, which is what makes the two branches
one step rather than two.

Everything in that block is unchecked. No schema covers `state.json`, no script reads it except the
request-hash comparison inside `validate-request.mjs`, and `transitions` is a field this run invented
because there was nowhere else to record how a step resolved (R2-8). The hash comparison did work:
`validate-request.mjs` recomputed each `request/request.json` against `state.json.requestHashes` on
every run above, so a request edited after dispatch would have failed the gate.

---

## Defects and proposed fixes

### R2-1 — `architecture-decision` cannot express a mutation contract, so `backend.source.apply` can never bind one

**Files** `.claude/templates/kinds/stack-model.schema.json`,
`.claude/templates/kinds/architecture-decision.contract.json`,
`.claude/templates/kinds/mutations.schema.json`, `.claude/operators/architecture-decide/operator.md`,
`.claude/operators/backend-source-apply/operator.md`.

**Evidence** step `5/1` blocked with `CONTRACT_UNFROZEN`. `mutations.schema.json` requires
`operations` with `minItems: 1`, each carrying `operationId`, `name`, `transport`, `writerRef`,
`storeRefs`, `transactionBoundary`, `idempotencyKind`, `migrationRefs`, `authorityDecisionIds`,
`facets`, `proofKinds`. `stack-model.schema.json` has `additionalProperties: false` and no
`operations` key; `architecture-decision.contract.json` has no `## Operations` section. The operator
that must fill them is forbidden to invent them (`CONTRACT_WIDENED`) and the operator that must
publish them is told its "handoff names contracts, never implementation files" while `writerRef` is
checked against `mutableFileRefs` in `backend-source-apply/validate.mjs:74`.

**Proposed change** add the operation declaration to the producer. In
`stack-model.schema.json`, add `"operations"` to `required` and to `properties`:

```json
"operations": {
  "type": "array", "minItems": 1, "maxItems": 64,
  "items": {
    "type": "object", "additionalProperties": false,
    "required": ["operationId", "name", "transport", "writerRef", "storeRefs",
                 "transactionBoundary", "idempotencyKind", "migrationRefs", "authorityDecisionIds"],
    "properties": {
      "operationId": { "$ref": "#/$defs/id" },
      "name": { "type": "string", "minLength": 1, "maxLength": 256 },
      "transport": { "enum": ["graphql-mutation", "graphql-query", "rest", "worker", "cron", "event-consumer"] },
      "writerRef": { "type": "string", "minLength": 1, "maxLength": 1024 },
      "storeRefs": { "type": "array", "maxItems": 64, "items": { "$ref": "#/$defs/id" } },
      "transactionBoundary": { "enum": ["single-transaction", "per-item", "read-only", "none"] },
      "idempotencyKind": { "enum": ["none", "natural-key", "request-token", "event-id"] },
      "migrationRefs": { "type": "array", "maxItems": 64, "items": { "type": "string", "minLength": 1 } },
      "authorityDecisionIds": { "type": "array", "minItems": 1, "maxItems": 64, "items": { "type": "string", "pattern": "^BA-[0-9]+$" } }
    }
  }
}
```

add to `architecture-decision.contract.json` the section
`{ "heading": "^## Operations$", "table": "| Operation | Transport | Writer | Stores | Transaction | Idempotency | Decisions |", "minRows": 1, "cell": { "Transport": "^(graphql-mutation|graphql-query|rest|worker|cron|event-consumer)$", "Transaction": "^(single-transaction|per-item|read-only|none)$", "Idempotency": "^(none|natural-key|request-token|event-id)$", "Decisions": "^BA-[0-9]+(?:, BA-[0-9]+)*$" } }`;
add `response/data/stack-model.json` operations to `architecture.decide` step 7's Writes; and replace
the sentence "The handoff names contracts, never implementation files" with "The handoff names
contracts, never implementation files; the writer of each declared operation is the one file path this
operator does name, because the implementation may not choose its own writer." The narrower
alternative — giving `backend.source.apply` an `operations` Requirement — is the change this operator
explicitly argues against, so it should be taken only if the first is rejected.

### R2-2 — `BA-<n>` business decision identifiers have no producer anywhere in the tree

**Files** `.claude/templates/kinds/mutations.schema.json:47`,
`.claude/templates/kinds/backend-source-application.contract.json:6`,
`.claude/templates/kinds/coverage-matrix.schema.json`, `.claude/templates/kinds/model.schema.json`,
`.claude/templates/kinds/claims.schema.json`, `.claude/operators/business-decide/operator.md`.

**Evidence** `grep -rn "BA-" .claude/templates/kinds/` matches only the two backend consumer files.
`business.decide` publishes claim ids as slugs (`pro-entity`, `effective-access`), coverage rows keyed
by `dimension`, and a `model.json` with no decision list at all. An operation must cite at least one
`BA-<n>` and the receipt's Decisions column must restate every one of them, so the backend receipt is
unwritable even after R2-1 is fixed.

**Proposed change** make the coverage matrix the address space. In `coverage-matrix.schema.json`, add
`"decisionId"` to `coverageRow.required` and to its properties as
`{ "type": "string", "pattern": "^BA-[0-9]+$" }`, and add to `business.decide` operator.md step 5 the
sentence: "Each frozen row is addressed as `BA-<n>`, assigned in order on the first publication of the
matrix and never renumbered or reused; a later matrix appends new numbers and keeps the meaning of the
old ones." That makes the enforcement rows the approved decisions the backend cites, which is what
both consumer files already assume.

### R2-3 — the profile stand-in cannot be recorded, though `orchestrator.json` requires it

**Files** `.claude/resources/orchestrator.json` (`profileEquivalents.rule`),
`.claude/templates/step/response.schema.json`.

**Evidence** the rule says "response.json records both (boundProfile, ranProfile) so an audit can tell
a stand-in from the binding". `response.schema.json` sets `additionalProperties: false` and declares
neither key, so every branch in this run — all seven of them stand-ins — records the binding nowhere
in-band, and this prose report is the only place the pairing exists.

**Proposed change** add to `response.schema.json` `properties`:
`"boundProfile": { "type": "string", "minLength": 1 }` and
`"ranProfile": { "type": "string", "minLength": 1 }`, and add both to `required`; then have
`validate-response.mjs` check `boundProfile` against the emitting operator's
`operator.json.resources.profile` and, when `ranProfile` differs, against
`orchestrator.json.profileEquivalents.pairs`. A run whose model matches neither — this one, for the
four `luna` branches — then has to say so instead of passing silently.

### R2-4 — five workflows guarantee they cannot start unless a preview happens to be running

**File** `.claude/workflows/full-feature.json:20`, and identically
`frontend-new-surface.json:20`, `frontend-reconstruct.json:14`, `frontend-refine.json:14`,
`frontend-with-uat.json:20`.

**Evidence** step `1/2` blocked with `RUNTIME_NOT_READY` before any product work began. The runtime is
first *needed* at the `frontend.surface.audit` step, six steps later. Round 1's G2 was the opposite
failure (the audit could never capture because nothing bound a runtime), and the fix moved the binding
to the earliest possible step instead of the latest necessary one.

**Proposed change** in each of the five files, set the step-1 frontend bind to
`"runtimeNeed": "none"`, and insert immediately before the `frontend.surface.audit` step the step
`[{ "operator": "workspace.bind", "requirements": { "role": "fe", "runtimeNeed": "consume" } }]`.
The audit then blocks on a missing runtime, which is `platform.operate`'s domain and a correct place
to stop, while a chain that never reaches an audit is no longer hostage to a dev server.

### R2-5 — no published chain can exercise a nested exchange beside a running sibling

**Files** `.claude/workflows/*.json`, `.claude/operators/architecture-decide/operator.md`
("Other branches of the same step keep running throughout"), `.claude/resources/orchestrator.json`
(`handoff.waiting`: "other branches of the step keep running"), `.claude/tests/README.md`.

**Evidence** the only exchange-bearing operators are `architecture.decide` (`critique`) and
`content.generate` (`review`). `architecture.decide` is a solo step in `full-feature` and
`backend-feature`; `content.generate` is the whole of `content-unit`. This run performed the pause,
the fresh exchange agent and the resume, and could not perform the concurrency, because the step had
no second branch to keep running.

**Proposed change** two lines, no new rule. In `architecture-decide/operator.md`, replace "Other
branches of the same step keep running throughout" with "Other branches of the same step, when the
workflow gives the step more than one, keep running throughout; no published workflow does yet." In
`tests/README.md`, record under the round-2 row that the waiting-beside-a-sibling property is
unexercised and needs a composed chain, not an example, to test it.

### R2-6 — a workflow whose `when` half-matches still runs, and nothing says whether a preset may be overridden

**Files** `.claude/workflows/README.md`, `.claude/SKILL.md` (Setup, item 3),
`.claude/scripts/validate-workflows.mjs`.

**Evidence** `full-feature`'s `when` says "a new frontend surface"; the mission's surface exists. The
chain ran anyway on the caller's instruction, and the mismatch surfaced four steps later as `5/2`'s
`CHANGE_LEVEL_AMBIGUOUS`. Separately, this run overrode `backend.source.apply`'s absent `mode` preset
to `dry` with no rule permitting or forbidding it — round 1's G4, unchanged.

**Proposed change** add to `workflows/README.md`, after item 2 of "How the entry uses them": "A
workflow runs only while every clause of its `when` holds. When a caller pins a workflow whose `when`
half-matches, or overrides one of its presets, the overridden field and its value are named in the
request and recorded in `state.json.overrides`; the workflow's `when` no longer certifies the chain,
and any stop that follows from the override belongs to the caller." Then add `overrides` to the
`state.json` schema proposed in R2-8.

### R2-7 — a source-writing operator against a read-only binding is unruled, and `dry` is not exempted

**Files** `.claude/resources/orchestrator.json` (`sourceWrites.policy`),
`.claude/operators/backend-source-apply/errors.json`,
`.workspaces/projects/starci-academy/be.json` (workspace side, outside the tree).

**Evidence** the policy reads "a route declaring forbidden binds read-only and no source-writing
operator may run against it". The be declaration carries no `gitPolicy` at all, so the bind was
`forbidden` / `read-only`, and step `5/1` — a source-writing operator — was dispatched against it
anyway, lawfully in substance because `dry` writes nothing, and unlawfully by the letter of that
sentence. No stop code exists for "the routed binding is read-only", so an `apply` run in the same
place would have had nothing correct to emit either. Round 1 made the same call for
`frontend.source.apply` and recorded it only in prose.

**Proposed change** append to `sourceWrites.policy`: "; under `mode: dry` the operator writes nothing
and may run against a read-only binding, and its receipt records the binding it read". And, on the
workspace side, `.workspaces/projects/starci-academy/be.json` should carry an explicit `gitPolicy`
like its `fe` sibling, so the binding stops depending on a conservative default.

### R2-8 — `state.json` is still unvalidated, and now carries fields nobody defined

**Files** `.claude/resources/orchestrator.json` (`session.manifest`), `.claude/scripts/` (no reader),
`.claude/templates/step/` (no schema).

**Evidence** round 1's G6, unchanged. This run added `transitions` and `writeAliases` because there
was nowhere else to record how a parallel step resolved, and `status: "blocked"`, `workflow` and
`note` are equally unchecked; the session id does not follow the published shape and nothing noticed.

**Proposed change** add `.claude/templates/step/state.schema.json` with
`required: ["id", "project", "startedAt", "status", "workflow", "chain", "steps", "current", "leases", "requestHashes"]`,
`status` as `{"enum": ["running", "waiting", "blocked", "done"]}`, `chain` as an array of arrays of
`^\\d+/\\d+$`, `steps` as a map from the same pattern to an operator id, `leases` as a map to
`{agent, holds}` with `holds` an array of aliases, plus optional `transitions` and `overrides`; and add
`.claude/scripts/validate-session.mjs` that checks the manifest against it, that every entry of
`chain` has a branch folder and an entry in `steps`, and that no two branches of one step declare
overlapping `holds`. That last check is the one this case had to perform by reading.

### R2-9 — `mutationReadiness` still has no stated derivation

**File** `.claude/operators/workspace-bind/operator.md` (step 4).

**Evidence** `1/1` recorded `read-only` and `2/1` recorded `ready`, in one session, on the same branch
condition (observed branch equals the mutation branch); the distinction actually used was whether the
declaration carries a `session-only` policy, and `workspace-bind/validate.mjs` accepts either value in
both cases. Round 1's O11 predicted exactly this.

**Proposed change** add to step 4's row in `workspace-bind/operator.md`: "Mutation readiness is
`ready` only when the observed branch is the declared mutation branch *and* the routed policy publishes
a write path (`worktreeBranches: session-only`); every other binding is `read-only`." Then have
`workspace-bind/validate.mjs` derive it rather than accept it.

### R2-10 — a blocked branch's `reason` is the only prose it has, and it is not in any receipt

**Files** `.claude/templates/step/response.schema.json` (`reason`), the kind contracts.

**Evidence** both step-5 branches blocked, so neither could emit its markdown receipt (the contracts
require sections a blocked branch cannot fill — round 1's O3, now met twice more). Everything a reader
needs about why the chain stopped lives in `response.json.reason`, a field capped at 2000 characters
that no kind contract, no index and no report template reads. It worked, and it is the whole record.

**Proposed change** none to the field, which earned its place in 1.0.3; instead add one line to
`tests/README.md`'s description of a run record: "a blocked branch's `reason` is quoted in the record,
because it is the only prose the branch produced." This run restates both branches' `reason` in full
in the step-5 sections above.

### R2-11 — a withheld or unpublished business head has no path to the operators that need it

**Files** `.claude/operators/architecture-decide/operator.md` (Context),
`.claude/operators/backend-source-apply/operator.md` (Context, Inputs).

**Evidence** `business.decide` publishes its head into `@worktrees/businesses/<featureId>`, and both
downstream operators bind that alias as **Context**, never as an Input. In this dry session the
publication was withheld, so steps 4 and 5 bound the on-disk `pending` head while step 3's own
`model.json` sat two folders away, unreachable by any declared path. The same shape would appear in a
real run whenever the publish is refused or deferred.

**Proposed change** add to both operators' Inputs tables the row
`| model | business.decide; the head this chain published, read instead of the alias when the branch that produced it is in this session | no |`,
and one sentence to each Context row: "when the session carries a `model` Input, it is the authority
and the alias is evidence." Without it, a chain can silently decide against an older promise than the
one it just modelled.

---

## What is on disk

`.worktrees/sessions/20260903-r2-full-feature/` was kept: `state.json`, the waiting snapshot
`step-4-parallel-1-waiting-snapshot.json`, and seven branches across five steps — `step-1/parallel-1`,
`step-1/parallel-2`, `step-2/parallel-1`, `step-3/parallel-1`, `step-4/parallel-1` (with its
`critique/` exchange), `step-5/parallel-1` and `step-5/parallel-2` — each with its
`request/request.json` and its `response/`. The backend checkout is untouched at
`90ef7fcb8dfbe83129af877e15a2c5fc029358de` on `mtp`, dirty only in the two
`.workspaces/projects/tayson` files it was already dirty in; the frontend checkout is untouched and
clean at `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` on `main`; the businesses worktree is exactly as it
was, with `features/pro-subscription/model.json` still at the `pending` head. No file under `.claude/`
was written except this report and its Vietnamese mirror.
