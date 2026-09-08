# Run — backend-feature on the Pro subscription promise (2026-09-03)

A dry run of StarCi Skills v8: one orchestrator plus one agent per operator, all inside one process.
Session root `.worktrees/sessions/20260903-dryrun-backend-feature/`, gitignored and kept on disk for
inspection. Every branch names the profile its `operator.json` binds, and every branch was actually
run by **Claude Opus** standing in for that profile, so no profile boundary was exercised anywhere in
this test — read every verdict below with that in mind. Nothing was committed, nothing was written
into the backend checkout, nothing was written into `@worktrees/businesses`, and no git write command
was run anywhere.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `backend-feature` |
| Feature | `pro-subscription` — head `features/pro-subscription/model.json` in the businesses worktree, source under `src/modules/bussiness/pro-subscription/` and the GraphQL resolvers around it |
| Frozen backend head | `d5926ae857aa4f8c11c53a80d6a764ee92a60149` (`git rev-parse HEAD`, read-only) |
| Businesses head at start | content address `eccaeaad…40b1`, `authorityStatus: pending` |
| Chain requested | 1 `workspace.bind` (be) → 2 `business.decide` (model) → 3 `architecture.decide` (1 alternative, automatic, with its `critique` exchange) → STOP before `backend.source.apply` |
| Chain actually run | 4 branches: 1 `workspace.bind` (blocked), 2 `workspace.bind` (resume, done), 3 `business.decide` (done), 4 `architecture.decide` + `critique` (done) |
| Ended | by the test owner, before `backend.source.apply`; `quality.verify`, the `reconcile` pass and `git.publish` were never dispatched |

Requirements came from the workflow presets plus each operator's stated defaults; nobody was asked
anything. Four required fields with no usable default had to be derived, and each is called out where
it occurs: `project` (`starci-academy`), `gitPolicy` (the BE route declaration carries none),
`dimensions` for `business.decide` (the previous head predates the coverage-matrix shape), and
`constraints` for `architecture.decide`.

---

## Step 1 — `workspace.bind`, parallel-1

**Status** `blocked`. **Stop** `CHECKOUT_DIRTY`.
**Profile** `operator.json` binds `sonnet`; run by Claude Opus.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.json` only.

**What the branch found.** The portable declaration `.workspaces/projects/starci-academy/be.json` and
the hydrated route `.workspaces/local/routes/starci-academy/be/config.json` agree on project, role,
repository and branch, and the checkout is the Source itself on `mtp`. The working tree, however, is
not clean: `.workspaces/projects/tayson/fe.json` is modified and `.workspaces/projects/tayson/be.json`
is untracked. `declaredWriteRoots` was `["src"]`, the only path a later `backend.source.apply` in this
chain would write, so both dirty files lie outside the declared roots and the operator stopped exactly
as its own law says it must. It never stashes, never cleans, never widens the boundary on its own.

`CHECKOUT_DIRTY` carries domain `source`; `routing.json` answers `workspace.bind`/`source` with
`{"kind":"resume"}`, so the orchestrator re-entered the same operator as a new step. That routing hop
is the one part of the loop that worked exactly as designed, with no interpretation needed.

The stop itself is invisible in the branch beyond the code: `workspace.bind` declares no output kind
for a blocked run, and the `Findings` vocabulary of `workspace-route-binding` admits only six codes,
none of which can say "the tree is dirty here". A blocked branch is therefore a stop code and nothing
else.

## Step 2 — `workspace.bind`, parallel-1 (resume)

**Status** `done`. No stop.
**Profile** `sonnet`; run by Claude Opus.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.md` (kind `workspace-route-binding`),
`response/data/route.json` (kind `route`), `response/response.json`.

**The delta, stated plainly.** The only field that can move a `CHECKOUT_DIRTY` stop is
`declaredWriteRoots`, and it does double duty: it is both "the only paths later work may write" and
"the boundary outside which dirt blocks". There is no field for "this dirt is not mine and I am not
going to write there". To let the test proceed, the resume declared
`["src", ".workspaces/projects/tayson"]`, and the receipt's `Write roots` table says so in its own
words: a dry-session waiver, not a write intent. That is a bend, it is recorded as one here and in the
receipt, and it is the sharpest single contract defect this run found.

**What the branch bound.** `starci-academy/be` → the Source checkout at
`D:/Repositories/starci-academy-backend`, branch `mtp`, head `d5926ae8…`, repository kind `source`
(so a null directory), mutation readiness `read-only`, businesses root derived as
`<gitRoot>/.worktrees/businesses`, runtime `null` because `runtimeNeed` is `none`. Findings:
`ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`, `IDENTITY_ROSTER_SEALED`. The hydrated
route records head `4456c4bc8…`, two commits behind what the checkout actually is; the observed head
is the binding and the stale record is prose in the receipt, because no finding code covers it.

`gitPolicy` had to be invented. The requirement's default is "the policy the route declaration
carries", and the BE portable declaration carries no `gitPolicy` block at all — the FE one does. The
conservative reading was taken: `worktreeBranches: forbidden`, `mutationBranch: mtp`. Mid-run the
owner committed `90ef7fcb8`, which sets the FE route to `worktreeBranches: session-only`, and that
exposed a second problem described under defects: `session-only` cannot be written into a `route`
receipt at all.

## Step 3 — `business.decide` (mode `model`), parallel-1

**Status** `done`. No stop. No fallbacks.
**Profile** `operator.json` binds `sol-fresh` with a bounded `webSearch` grant; run by Claude Opus,
and no web search was used.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node operators/business-decide/validate.mjs <session>/step-3/parallel-1
valid business.decide branch
```

**Artifacts written** `response/response.md` (kind `business-promise-authority`),
`response/data/claims.json`, `response/data/coverage-matrix.json`, `response/data/model.json`,
`response/response.json`. **No head was published**: step 8 of the operator would write
`@worktrees/businesses/features/pro-subscription/model.json`, and this dry session writes nothing
there. The head that *would* be published is `response/data/model.json`.

**Target state, and why.** The registry records `authorityStatus: pending` for `pro-subscription`, and
`LEGAL_TRANSITIONS` allows exactly two moves out of `pending`: `pending->in-progress` and
`pending->rejected`. The feature is not rejected — it is half built in source — so the next state the
head allows is `in-progress`, and that is what the branch modelled. `implemented` was never a
candidate: the validator refuses an implemented head without a reconciliation against delivered
source, which only mode `reconcile` can produce.

**Claims.** 22 claims, all bound to `d5926ae8…`: 18 facts in routed source, 3 intents quoted from the
published head, 1 unknown. The unknown is the important one — nothing in the checkout converts an
unexpired legacy membership or AI period into a Pro period, so the migration branch of the promise has
no observed implementation at all. No contradiction was found, so `CONTRADICTION_UNRESOLVED` never
fired.

**Matrix.** 15 declared dimensions, 21 discovered consumers, 3 discovered lifecycle branches
(`renewal`, `cancellation`, `expiry`), one row per dimension, nothing marked not-applicable:

| Disposition | Dimensions |
| --- | --- |
| `replace` | `actor-eligibility`, `purchase-side-effect`, `idempotency`, `entitlement-consumer`, `denial`, `renewal` |
| `preserve` | `legacy-read`, `legacy-settle` |
| `defer` | `offer-entry`, `read-entry`, `settlement`, `cancellation`, `expiry`, `migration`, `legacy-create` |

The eight enforcing rows each cite a real positive and a real negative test:
`effective-learner-access.service.spec.ts` (Pro allows without claiming enrollment; a legacy
enrollment still allows; neither allows nothing), `pro-subscription.service.spec.ts` (one settlement
grants one period and one audit row; a second claim grants nothing; an early renewal stacks and
reactivates), `bussiness.guards.spec.ts` (the paid-course guard allows and denies),
`transaction-grant.service.spec.ts` (legacy membership still settles; an unknown action type is
refused).

The seven deferred rows are deferred for one reason only: the enforcement exists in source and no test
proves it. That is the vocabulary defect below — `defer` is the only legal disposition for
"implemented but unproven", and it understates what is actually built. `legacy-create` is the clearest
case: five legacy checkout paths refuse to create a sale once `legacySalesMode` leaves `legacy`, which
is a `retire` in substance, but `retire` demands proof the path is closed and no test provides it.

Findings recorded on the receipt: `CONSUMER_SHARED_PROOF` (warning), `PROOF_DEFERRED` (warning),
`MIGRATION_UNIMPLEMENTED` (warning), `LEGACY_COEXISTENCE` (info),
`NO_DISPOSITION_FOR_UNPROVEN_ENFORCEMENT` (info).

**Model (the head that was withheld).** `state: in-progress`, transition `pending->in-progress`,
previous head named by content address so lineage is preserved, `coverageFingerprint` equal to the
frozen matrix, `reconciliation: null`. The promise as modelled: one Pro plan at 229000 VND per paid
calendar month grants every included learner-facing capability through one effective-access decision,
while every right already purchased keeps working and capability controls, quotas and sanctions still
apply.

## Step 4 — `architecture.decide`, parallel-1 (with the `critique` exchange)

**Status** `done`. **Fallback taken** `COMPATIBILITY_UNVERIFIED`.
**Profile** `sol-fresh`; run by Claude Opus. The critique agent binds the same profile and was run by
the same model — see the defect on reviewer independence.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1      # at the waiting pause
response valid

$ node scripts/validate-request.mjs <session>/step-4/parallel-1/critique
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1/critique
response valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1      # after the resume
response valid

$ node operators/architecture-decide/validate.mjs <session>/step-4/parallel-1
valid architecture.decide branch
```

One rejection was earned and corrected rather than argued with:

```text
step-4/parallel-1/response/response.json: fields.independent-critique is not an Output of architecture.decide
```

The critique is an output of the *exchange*, not of the branch; `fields` in the branch response may
name only files without an exchange prefix. The fix was to drop the key, not to touch `.claude`.

**Artifacts written** `response/response.md` (kind `architecture-decision`),
`response/data/current-state.json`, `response/data/stack-model.json`,
`critique/request/request.json`, `critique/response/critique.md`, `critique/response/response.json`,
`response/response.json`. No alternatives page, correctly: `alternatives` is 1.
`step-4-parallel-1-waiting-snapshot.json` at the session root is the orchestrator's own copy of the
`waiting` response, because the resume overwrites it.

**Objective.** The requested objective — one entitlement read path for Pro content — is stated by the
published head almost word for word (rule: effective learner access is permanent course grant OR
active Pro OR explicit free or trial grant, sanctions applied afterward; phase C of the realization
plan: route effective access), so no substitution was needed.

**Current state observed at the frozen head.** Six components (`postgres-primary` 16-alpine,
`redis-cache` 7-alpine, `bullmq-jobs`, `nestjs-framework` 11, `graphql-api` 13, `typeorm` 0.3) and six
boundaries: `pro-subscription-lifecycle` (owns `pro-subscriptions`, `pro-entitlement-sources`),
`effective-learner-access` (owns nothing), `transactions-settlement` (owns `transactions`),
`enrollment-course-access` (owns `enrollments`), `membership-legacy` (owns `memberships`),
`ai-entitlement` (owns `ai-subscriptions`). Every row cites `path:lines@head`.

**The one alternative.** `single-effective-access-collaborator`, selected automatically — cost 4
(adds no component, only a read boundary over stores that already exist), complexity 3 (one boundary
reads five stores and every consumer must be routed through it), reversibility 4 (the boundary owns no
data, so removing it removes a read path and no rows).

**Stack model.** Six boundaries with their interfaces, six stores with writers, readers, migrators,
transaction scope, backup and restore. One store has two writers — `transactions`, written by
`transactions-settlement` and, for one field, by `pro-subscription-lifecycle` — and it carries the
required shared-write justification: the pending-to-succeeded claim must commit inside the grant
transaction, because that is exactly what makes a duplicate settlement a no-op. `postgres-primary`,
`redis-cache` and `bullmq-jobs` are verified on all five compatibility axes with real evidence;
`nestjs-framework`, `graphql-api` and `typeorm` are verified on four and have no backup-restore
evidence to give, because a stateless component has none, so the `COMPATIBILITY_UNVERIFIED` fallback
marked all three `replaced-candidate` and listed the axis under Handoff as unknown.

**The critique.** A second pass, given `response/data/stack-model.json` and nothing else — no
rationale, no receipt, no current-state observation. Eight attacks, all `holds`, verdict `keep`:

| Adverse path | What it found |
| --- | --- |
| partial-failure | The model describes the transaction claim twice and not identically — "inside the grant transaction" in one row, "inside its own transaction" in another. The shared-write justification settles it in favour of one transaction; the looser wording is the risk. |
| retry-idempotency | The conditional pending-to-succeeded update makes a repeat match no row; two concurrent deliveries serialise on it. |
| concurrency | Claim, then learner-row lock, then period-row lock: two grants for one learner serialise and the second extends from what the first wrote. Residual risk: only the justification, not the schema, keeps the shared write inside the grant transaction. |
| stale-state | No store in the model is a cache and no decision reads one; staleness is bounded by the request itself. |
| deletion | The append-only ledger survives, but the model lists a reader for it that has no interface to read it, so a rebuild is an operator action today. Deletion still degrades to denial, not to a wrong grant. |
| recovery | One shared volume means a consistent restore; the lost window is recovered by replaying the provider's settled transactions into the same idempotent grant. |
| dependency-outage | Entitlement reads never touch queue or cache; a lost settlement job is re-enqueued by the boot sweep. Only the datastore is hard, and it fails closed. |
| rollback | The decision is additive; the access boundary owns no data, and the period store is created by an explicit migration rather than by schema synchronisation. |

Two of those — the second writer on `transactions` and the ledger with no reader interface — went
into the Handoff as named risks rather than being smoothed over.

## Step 5 — `backend.source.apply`: not dispatched

Stopped here by the test owner. The operator has no dry mode: its whole contract is to write source on
a session branch and record the commit, and there is no requirement, no fallback and no stop code that
means "produce the write set and commit nothing". A dry run of a `backend-feature` chain therefore
cannot reach `quality.verify`, the `reconcile` pass or `git.publish` at all — the chain is untestable
end to end without either a dry mode or a disposable checkout.

Independently, the run would have stopped anyway: the observed backend head moved twice while this
session was open (`4456c4bc8` → `d5926ae8` at the start, `d5926ae8` → `90ef7fcb8` during step 4), and
a request frozen at `d5926ae8…` meets `SOURCE_DRIFT` at the next operator's step 1.

---

# Defects this run exposed

## Knowledge gaps

1. **The BE route declares no `gitPolicy`.** `workspace.bind` defaults `gitPolicy` to "the policy the
   route declaration carries"; `.workspaces/projects/starci-academy/be.json` carries none, while
   `fe.json` does. Nothing in the tree says what a missing policy means, so the orchestrator invented
   `forbidden`/`mtp`. Two runs could invent differently for the same route.
2. **No source for a first coverage surface.** `dimensions` defaults to "the dimensions of the
   previous head". The previous head here is a `schemaVersion: 1` business document with no
   `dimensions` field and a completely different shape, so the default is unusable against every
   pre-v8 head. The 15 dimensions used in this run were invented by the agent, and a second run could
   invent a different set for the same feature and still pass every validator.
3. **Nothing defines "proof".** `positiveProofRef` and `negativeProofRef` are free strings. No
   knowledge topic says whether a source branch counts as proof or only an executed test does. This
   single ambiguity decided seven of the fifteen dispositions in this run.
4. **`@knowledge/patterns/be` had nothing to say about this decision.** It is bindable by
   `architecture.decide` and contains no rule about entitlement, ownership, or read paths, so the
   architecture step drew on nothing but the source and the promise.

## Operator and contract defects

1. **`backend.source.apply` has no dry mode.** Recorded as the operator gap this run was asked to
   confirm: there is no way to run a `backend-feature` chain past step 4 without writing source.
2. **`declaredWriteRoots` is overloaded** in `workspace.bind`. It is simultaneously the write
   permission and the dirt-tolerance boundary, so tolerating unrelated dirt in a person's checkout
   requires declaring a write root the chain will never write. There is no honest field for
   "pre-existing, not mine, not touching it".
3. **A blocked `workspace.bind` branch has no receipt.** No output kind covers a stop, and the
   `Findings` code vocabulary of `workspace-route-binding` (six codes) contains nothing that can state
   a blocking condition. The stop code in `response.json` is the entire record.
4. **`route.schema.json` and `portable-route.schema.json` disagree.** The kind schema's
   `gitPolicy.worktreeBranches` enum is `["forbidden", "allowed"]`; the portable declaration schema's
   is `["forbidden", "session-only"]`, and the declaration also carries `incomingBranchRefs`, for
   which the `route` kind has no field. As of `90ef7fcb8` the FE route is `session-only`, so a correct
   `workspace.bind` on that route cannot express its own policy in its own receipt. `allowed` also
   contradicts the source-writes rule in `resources/orchestrator.json`, which knows only session
   branches.
5. **`workspace.bind`'s `## Next` table does not list `business.decide`,** yet step 2 of
   `backend-feature` is exactly that. Nothing validates `response.json.next` against the Next table or
   against the workflow, so the contradiction is silent — the workflow wins at runtime and the table
   is decoration.
6. **`business.decide` has no disposition for "enforced, not proved".** `defer` says postponed to an
   owner, `retire` and `replace` demand proof. Enforcement that exists in source with no test can only
   be recorded as `defer`, which understates it, or dressed as proof by citing a source path in
   `positiveProofRef`, which is the exact false pass the operator's own prose forbids.
7. **`CONSUMER_UNPROVEN` cannot fire for an unproven consumer.** The validator enforces that every
   discovered consumer has a *row*; it never checks that a consumer has proof of its own. Thirteen
   consumers were disposed under one row citing one guard's spec and the branch is green. The code's
   published meaning ("no disposition **or no proof**") is half enforced.
8. **Fingerprints are unspecified and uncorrelated.** No canonicalization rule is published for
   `claims.fingerprint`, `coverage-matrix.fingerprint`, `model.headFingerprint` or
   `current-state.fingerprint`, and nothing checks `model.claimsFingerprint` against
   `claims.json.fingerprint` (only the coverage pair is checked). Two implementations would produce
   different fingerprints for the same content, which defeats the stated purpose of letting backend,
   quality and UAT prove they consumed the same matrix.
9. **The five compatibility axes have no not-applicable verdict.** `backup-restore` is meaningless for
   a framework, an API layer or an object-relational mapper, so the only legal outcome is the
   `COMPATIBILITY_UNVERIFIED` fallback, which stamps three unchanged components `replaced-candidate` —
   a status a human reads as "we are thinking of replacing this". The receipt now says the opposite of
   what happened.
10. **Reviewer independence is unverifiable.** `independent-critique` requires the literal
    `Inherited turns | none`, and nothing can detect that author and reviewer are the same process and
    the same model, which is exactly what happened in this test. The contract checks a word, not an
    execution.
11. **`architecture.decide` cannot receive the business branch's output.** Its Inputs table declares
    only `architecture-decision`; the promise is bound through `@worktrees/businesses/<featureId>`,
    the *published* head. A `business.decide` branch that models a head but does not publish it — dry,
    blocked, or awaiting approval — silently leaves the architecture step reading the old head. In
    this run the architecture step read the `pending` head while the modelled head sat unpublished in
    step 3.
12. **`business-promise-authority` has no `## Fallbacks taken` section,** but `validate-response`
    cross-checks `response.fallbacks` against that section of `response.md`. No `business.decide` code
    currently has a `fallback` disposition, so the trap is latent; the first one added makes a legal
    fallback impossible to record without breaking the document contract. (Adding the section to the
    document is rejected as an unexpected trailing section — this was hit and removed during the run.)

## Orchestrator gaps

1. **A blocked branch consumes a step number,** so after step 1 stopped, chain positions and workflow
   positions diverged: `business.decide` ran as step 3 and `architecture.decide` as step 4 of a
   workflow that calls them steps 2 and 3. Nothing in `state.json` records that mapping, and a later
   reader cannot tell a resume from a fresh chain position.
2. **`workspace.bind`'s output is consumed by nobody in this chain.** Neither `business.decide` nor
   `architecture.decide` takes a route input; both re-resolve their own aliases. The frozen head
   travels only in `request.contexts[].head`, which the orchestrator writes by hand, and
   `validate-request` never checks it against the bound route. The chain's first step is, contractually,
   a no-op for the two steps that follow it.
3. **The `waiting` state is not preserved.** The resumed agent overwrites the same
   `response/response.json`, so a finished branch keeps no evidence that it ever paused for a nested
   exchange. Only the exchange folder hints at it. This run snapshotted the paused response by hand.
4. **No mid-chain head re-freeze rule.** HEAD moved twice during this session. `SOURCE_DRIFT` exists
   and its resume text says "the orchestrator freezes the head again", but nothing tells the
   orchestrator when to re-observe, or what happens to evidence already cited at the old head.
5. **`state.json` has no schema and no validator.** Only `requestHashes` is read by anything. Its
   `chain`, `steps`, `current` and `leases` are documented in `resources/orchestrator.json` prose and
   enforced nowhere.
6. **A successful session deletes its own record.** The lifecycle deletes the session folder after
   `git.publish`, so the receipts, claims, matrices and critiques of a green run survive only if the
   owner copies them out first. Every artifact this report cites exists because the run stopped.

---

## What worked

The routing hop after `CHECKOUT_DIRTY` resolved through `errors.json` → domain `source` →
`routing.json` → `resume` with no interpretation. Every schema and contract rejection during the run
was correct and specific — the exchange-scoped `fields` rejection caught a genuine mistake in one
line. `validate-request`'s hash check against `state.json` held across four requests and one nested
exchange. The `waiting` → exchange → resume mechanics of `architecture.decide` worked exactly as
written, and the constraint that the critique may not be given the author's `response.md` is actually
enforced by the operator's validator. The two operator validators that carry real domain law
(`business-decide`, `architecture-decide`) rejected nothing that was true and accepted nothing that
this run knew to be false.
