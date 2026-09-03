# Run — backend-feature through a dry `backend.source.apply` (round 2, 2026-09-03)

The second dry run of the `backend-feature` workflow on `pro-subscription`, asked for one reason: a
`mode: dry` now exists on `backend.source.apply`, and round 1 could not test the chain past
`architecture.decide` without it. Session root
`.worktrees/sessions/20260903-r2-backend-feature/`, gitignored and kept on disk for inspection.
Nothing was committed, nothing was written into the backend checkout, nothing was written into
`@worktrees/businesses`, and no Git write command was run anywhere.

**Which tree ran.** Every runtime file this run read — `operators/`, `scripts/`, `templates/`,
`knowledge/`, `resources/`, `workflows/`, `routing.json`, `alias/` — is exactly `.claude` HEAD
`3d30a88e4b5a4e56fab5502b54621b738be5654b`, verified clean with `git status --porcelain` over those
paths. The working tree around them is not clean: `INDEX.md`, `INDEX.vi.md`, `onichan.md`,
`docs/_meta.js`, `docs/vi/_meta.js` and `package.json` are modified toward a 1.1.0 rename, and
`README*.md`, `bin/`, `docs/install.mdx` and `scripts/install-cli.spec.mjs` are untracked. None of
them is a file an operator binds, so the runtime under test is 1.0.3 as committed. `npm test` is
green at that state.

**Which model ran.** Every operator in this chain binds an OpenAI profile, and every branch was run
by Claude Opus. `resources/orchestrator.json` `profileEquivalents` pairs `sol-fresh` with `opus` and
`luna` with `sonnet`, so `business.decide` and `architecture.decide` ran on the declared equivalent of
their binding and `workspace.bind` and `backend.source.apply` did not: they bind `luna`, whose Claude
equivalent is `sonnet`, and they were run by Opus. That is a stand-in for a stand-in, it is stated
here because the session itself cannot state it, and the reason it cannot is recorded as a defect
below.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `backend-feature` |
| Feature | `pro-subscription` — head `features/pro-subscription/model.json` in the businesses worktree, source under `src/modules/bussiness/pro-subscription/` and the entitlement consumers around it |
| Frozen backend head | `90ef7fcb8dfbe83129af877e15a2c5fc029358de` (`git rev-parse HEAD`, read-only), branch `mtp` |
| Backend head in round 1 | `d5926ae857aa4f8c11c53a80d6a764ee92a60149`; the only file that moved between the two heads is `.workspaces/projects/starci-academy/fe.json` (`git diff --stat`), so every source citation round 1 made is byte-identical at this head |
| Businesses worktree | `.worktrees/businesses` at `1bdb707371cd418fb44a37623cad5f542ebb42e4`, feature head content address `eccaeaadb6a4cf2c0a915a0589f46e9c3ae1ed661cfd86c6e75e688fe3fa40b1`, `authorityStatus: pending` — unmoved since round 1 |
| Chain requested | 1 `workspace.bind` (be) → 2 `business.decide` (model) → 3 `architecture.decide` (1 alternative, automatic, with its `critique` exchange) → 4 `backend.source.apply` (`mode: dry`) → 5 `quality.verify` if the chain honestly reaches it |
| Chain actually run | 5 branches: 1 `workspace.bind` (blocked), 2 `workspace.bind` (resume, done), 3 `business.decide` (done), 4 `architecture.decide` + `critique` (done), 5 `backend.source.apply` `mode: dry` (blocked) |
| Ended | at step 5. `BUSINESS_AUTHORITY_MISSING` carries domain `business`, which `routing.json` answers with the operator `business.decide`; the orchestrator stopped instead of dispatching it, because a second `business.decide` pass cannot produce the identifier the stop is about. `quality.verify` and `git.publish` were never dispatched |

Requirements came from the workflow presets plus each operator's stated defaults. Four fields with no
usable default had to be supplied by the test owner and each is called out where it occurs:
`gitPolicy` (the BE route declaration still carries none), `declaredWriteRoots`, `dimensions` for
`business.decide`, and `constraints` for `architecture.decide`.

**What was reused and what was re-run.** The business and architecture reasoning is round 1's, which
the mission allowed. Every branch was nonetheless re-observed at the new head before it was accepted:
the backend head and working tree were read fresh, the businesses worktree head and registry entry
were read fresh, every file behind the twenty-two claims and every proof reference in the coverage
matrix was confirmed to exist at `90ef7fcb8`, the sampled claim range
(`pro-subscription.service.ts:60-67`) was read and still holds the date-aware `isActive` the claim
describes, and every `package.json` and compose line the current-state observation cites was opened
and matched line for line (`package.json:89, 92, 95, 173`; `postgres.yaml:19`; `redis.yaml:9`). Every
fingerprint in the session was recomputed rather than copied.

---

## Step 1 — `workspace.bind`, parallel-1

**Status** `blocked`. **Stop** `CHECKOUT_DIRTY`.
**Profile** `operator.json` binds `luna`; run by Claude Opus, which is not `luna`'s declared Claude
equivalent (`sonnet`).

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.json` only.

**What the branch found.** The same wall as round 1, re-observed rather than remembered. The portable
declaration `.workspaces/projects/starci-academy/be.json` and the hydrated route
`.workspaces/local/routes/starci-academy/be/config.json` agree on project, role, repository and
branch, and the checkout is the Source itself on `mtp` at `90ef7fcb8`. The working tree is not clean:
`.workspaces/projects/tayson/fe.json` is modified and `.workspaces/projects/tayson/be.json` is
untracked, unchanged from round 1. `declaredWriteRoots` was `["src"]`, so both files lie outside the
declared boundary and the operator stopped. It never stashes, never cleans, never widens the boundary
on its own.

`CHECKOUT_DIRTY` carries domain `source`; `routing.json` answers `workspace.bind`/`source` with
`{"kind":"resume"}`, so the orchestrator re-entered the same operator as a new step. That hop worked
with no interpretation for the second round running.

The stop is still invisible beyond the code: `workspace.bind` declares no output kind for a blocked
run, and the six-code `Findings` vocabulary of `workspace-route-binding` contains nothing that can say
"the tree is dirty here".

## Step 2 — `workspace.bind`, parallel-1 (resume)

**Status** `done`. No stop. No fallbacks.
**Profile** `luna`; run by Claude Opus.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-2/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.md` (kind `workspace-route-binding`),
`response/data/route.json` (kind `route`), `response/response.json`.

**The delta.** The only field that can move a `CHECKOUT_DIRTY` stop is still `declaredWriteRoots`,
and the code's own resume text offers exactly two ways out — "Clean the boundary, or declare the write
roots that cover it". Cleaning is a Git write this session may not make and the operator refuses on
its own account, so the resume declared `["src", ".workspaces/projects/tayson"]` and the receipt's
`Write roots` table says in its own words that the second entry is a dry-session waiver and not a
write intent. This is not a bent gate — it is the published resume — but it is the published resume
being wrong about what it is asking for, and it is recorded again below.

**What the branch bound.** `starci-academy/be` → the Source checkout at
`D:/Repositories/starci-academy-backend`, branch `mtp`, head `90ef7fcb8`, repository kind `source`
(so a null directory), mutation readiness `read-only`, businesses root derived as
`<gitRoot>/.worktrees/businesses`, runtime `null` because `runtimeNeed` is `none`. Findings:
`ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`, `IDENTITY_ROSTER_SEALED`. The hydrated
route records head `d5926ae857aa4f8c11c53a80d6a764ee92a60149`, one commit behind the observed head;
the observed head is the binding and the stale record is prose on the receipt, because no finding code
covers it.

`gitPolicy` had to be supplied again. The BE portable declaration still carries no `gitPolicy` block
while the FE one does, so the requirement's default — "the policy the route declaration carries" —
resolves to nothing, and the test owner supplied the conservative reading round 1 used:
`worktreeBranches: forbidden`, `mutationBranch: mtp`. That value is what makes defect A2 below
load-bearing rather than theoretical.

**A fingerprint that could not be reproduced.** Round 1 recorded `routeFingerprint`
`sha256:4144c224…` over the same two route files. Round 2 cannot reproduce it and cannot tell whether
it should: nothing in the tree publishes a canonicalization, the hydrated route has since been
rewritten, and `identityFingerprint` is plainly the sha256 of `.workspaces/device-state.json`'s bytes
while `routeFingerprint` is plainly not the sha256 of either route file's bytes. This run declared its
own rule — sha256 over the portable declaration bytes concatenated with the hydrated route bytes,
`sha256:5b2e815a78be45c54b9ce8250ed48ac25d121104e086a265ae27ae04a9562769` — and no validator noticed
either the old value or the new one.

## Step 3 — `business.decide` (mode `model`), parallel-1

**Status** `done`. No stop. No fallbacks.
**Profile** `sol-fresh`, whose declared Claude equivalent is `opus`; run by Claude Opus, with the
bounded `webSearch` grant unused.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-3/parallel-1
step valid

$ node operators/business-decide/validate.mjs <session>/step-3/parallel-1
valid business.decide branch
```

**Artifacts written** `response/response.md` (kind `business-promise-authority`),
`response/data/claims.json`, `response/data/coverage-matrix.json`, `response/data/model.json`,
`response/response.json`. **No head was published**: step 8 of the operator would write
`@worktrees/businesses/features/pro-subscription/model.json`, and this dry session writes nothing
there. The head that would be published is `response/data/model.json`.

**What the branch found.** The registry still records `authorityStatus: pending`, so the only forward
transition remains `pending->in-progress`, and that is what was modelled. Twenty-two claims, all
rebound to `90ef7fcb8`: eighteen facts in routed source, three intents quoted from the published head,
one unknown. The unknown is unchanged and still the important one — nothing in the checkout converts
an unexpired legacy membership or AI period into a Pro period, so the migration branch of the promise
has no observed implementation at all. Fifteen declared dimensions, twenty-one discovered consumers,
three discovered lifecycle branches, one row per dimension, nothing marked not-applicable: six
`replace`, two `preserve`, seven `defer`, with eight rows carrying both a positive and a negative
proof. Findings recorded: `CONSUMER_SHARED_PROOF`, `PROOF_DEFERRED`, `MIGRATION_UNIMPLEMENTED`,
`LEGACY_COEXISTENCE`, `NO_DISPOSITION_FOR_UNPROVEN_ENFORCEMENT`.

The prose of the round-1 receipt said "seven enforcing, six deferred" where the frozen matrix says
eight and seven. Re-running the count caught it and the sentence was corrected. Nothing in the tree
would have.

Every fingerprint was recomputed, and one gap in the checking showed itself again:
`operators/business-decide/validate.mjs` compares `model.coverageFingerprint` against the matrix and
never compares `model.claimsFingerprint` against `claims.json.fingerprint`. The two agree here because
this run made them agree, not because anything required it.

## Step 4 — `architecture.decide`, parallel-1 (with the `critique` exchange)

**Status** `done`. **Fallback taken** `COMPATIBILITY_UNVERIFIED`.
**Profile** `sol-fresh` → `opus`; run by Claude Opus. The critique agent binds the same profile and
was run by the same model.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-4/parallel-1
step valid

$ node scripts/validate-request.mjs <session>/step-4/parallel-1/critique
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1/critique
response valid

$ node operators/architecture-decide/validate.mjs <session>/step-4/parallel-1
valid architecture.decide branch
```

**Artifacts written** `response/response.md` (kind `architecture-decision`),
`response/data/current-state.json`, `response/data/stack-model.json`,
`critique/request/request.json`, `critique/response/critique.md`, `critique/response/response.json`,
`response/response.json`. No alternatives page, correctly: `alternatives` is 1.

**What the branch found.** The objective — one entitlement read path for Pro content — is stated by
the published head almost word for word, so no substitution was needed. Six components and six
boundaries were re-observed at `90ef7fcb8` and every citation was reopened: `@nestjs/core ^11.0.1`,
`@nestjs/graphql ^13.2.4`, `typeorm ^0.3.28`, `@nestjs/bullmq ^11.0.4` at the exact `package.json`
lines the record names, `postgres:16-alpine` and `redis:7-alpine` at the exact compose lines. The one
alternative, `single-effective-access-collaborator`, was selected automatically at cost 4, complexity
3, reversibility 4. One store has two writers — `transactions` — and carries its shared-write
justification: the pending-to-succeeded claim must commit inside the grant transaction, which is what
makes a duplicate settlement a no-op. Three stateless components have no backup-restore evidence to
give, so the `COMPATIBILITY_UNVERIFIED` fallback marked them `replaced-candidate` and listed the axis
as unknown under Handoff — the same misreporting round 1 recorded, unchanged.

The critique was a second pass given `response/data/stack-model.json` and nothing else. Eight adverse
paths, all `holds`, verdict `keep`; two of them — the second writer on `transactions` and the
append-only ledger whose declared reader has no interface to read it — went into the Handoff as named
risks. Reviewer independence remains unverifiable: the contract checks the literal words
`Inherited turns | none` and nothing can detect that author and reviewer were the same process on the
same model, which is again what happened.

## Step 5 — `backend.source.apply`, `mode: dry`, parallel-1

**Status** `blocked`. **Stop** `BUSINESS_AUTHORITY_MISSING`.
**Profile** `operator.json` binds `luna`, whose declared Claude equivalent is `sonnet`; run by Claude
Opus.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-5/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-5/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-5/parallel-1
step valid

$ node operators/backend-source-apply/validate.mjs <session>/step-5/parallel-1
valid backend.source.apply branch
```

**Artifacts written** `response/response.json` only. A blocked branch may carry no implementation,
and the operator's own validator enforces that: no `mutations.json`, no receipt, no change record.

**The request.** `featureId` `pro-subscription`; `mode` `dry`; `outcome` "Route every learner-facing
paid read through the effective-learner-access collaborator, so entitlement is decided once per read
and no product decides it for itself", which is phase C of the published head's own realization plan;
`mutableFileRefs` six real paths that exist at the frozen head, covering the collaborator, its spec,
the module, the paid-course guard, the guard spec and the AI entitlement service; input
`architecture-decision` pointing at step 4's receipt.

**Where it stopped, and why that is the honest answer.** Step 2 of the operator binds the business
authority, and it cannot obtain the one thing every operation is required to cite.
`templates/kinds/mutations.schema.json` requires each operation to carry at least one
`authorityDecisionIds` entry matching `^BA-[0-9]+$`, and
`templates/kinds/backend-source-application.contract.json` requires the receipt's `Decisions` column
to read `BA-<n>`. Nothing in the tree publishes an identifier of that shape. A grep across
`templates/`, `knowledge/` and every `operator.md` returns only those two contracts and the operator's
own self-test fixture. `model.schema.json` has no decisions field at all; `coverage-matrix.schema.json`
addresses its rows by `dimension`; `claims.schema.json` addresses claims by a kebab `claimId`;
`stack-model.schema.json` carries one kebab `decisionId` for the entire architecture decision. The
head actually bound — `.worktrees/businesses/features/pro-subscription/model.json`, content address
`eccaeaad…40b1`, `schemaVersion: 1`, state `pending` — states its approved behaviour as an unnumbered
array of fifteen `rules` strings.

Numbering those fifteen strings into `BA-1 … BA-15` would have let the branch run, and it is exactly
what the operator forbids: "the backend never invents business behaviour", and a minted decision
address is indistinguishable from an approved one the moment it is written down. So the branch stopped
before it read one line inside the mutable ceiling. The dry projection, the plan, the change record
and every path of the dry-mode validator were therefore never exercised, which is the second finding
of this step and not a smaller one than the first.

A second, independent reason points at the same wall and is worth stating separately because fixing
one does not fix the other: the head this session modelled in step 3 was never published, since a dry
session writes nothing into the businesses root, and both `architecture.decide` and
`backend.source.apply` bind the *published* head rather than the branch output. Step 5 was therefore
reading a `pending` head while the modelled `in-progress` head sat unpublished two steps upstream —
round 1 recorded this as a defect and it is unchanged.

`BUSINESS_AUTHORITY_MISSING` carries domain `business`; `routing.json` answers
`backend.source.apply`/`business` with the operator `business.decide`. The orchestrator did not
dispatch it. A second `business.decide` pass reads the same source at the same head and writes the
same three kinds, none of which has a field that could hold a `BA-<n>`, so the route leads straight to
`NO_PROGRESS`: the same input reaching the same wall. Reporting the wall is what the entry's own
Progress section says to do.

## Step 6 — `quality.verify`: not dispatched

The chain never reached it, so nothing about it was measured. What the tree says would have happened
is recorded as a reading, not as a run, because the mission asked whether `quality.verify` can verify a
plan.

It cannot, and the refusal is already written into the operator twice. Its prose says "The predecessor
receipt's own commit must equal that same head, because a receipt describing a commit the gates are
not standing on is `PREDECESSOR_STALE`", and `operators/quality-verify/validate.mjs` enforces the same
sentence over every gate file: `if (r.predecessorCommit !== r.sourceHead)`. A dry
`backend.source.apply` produces `mutations.commit: null`, a receipt whose `Commit` reads `—`, and a
`changes.md` whose Checkout row reads "…nothing written". There is no commit for a gate to stand on,
so no gate result could be written that both tells the truth and passes the validator. The honest
outcome is a `PREDECESSOR_STALE` stop at the operator's step 2, before any command runs; its domain is
`caller`, which `routing.json` answers with `user`. The gate plan itself was available — the `gates`
alias resolves to `package.json#scripts` plus the configs it names, and this checkout has them — so
the block is about the plan-shaped predecessor and nothing else.

What the tree does *not* currently do is refuse it at step 2. As written, a dry predecessor would be
consumed as valid, the gates would run against the base head, and the contradiction would surface as a
per-gate-file error at the end. That is the fix proposed in B1.

---

# Defects and proposed fixes

## A — what stopped the run

### A1. `BA-<n>` is required and nothing publishes it

**Files** `templates/kinds/mutations.schema.json` (`$defs.operation.properties.authorityDecisionIds`),
`templates/kinds/backend-source-application.contract.json` (`## Operations`, cell `Decisions`).

**Evidence** Both demand `^BA-[0-9]+$`. Grepping `BA-` across `templates/`, `knowledge/` and every
`operator.md` returns those two files and `operators/backend-source-apply/self-test.mjs`, whose
`BA-1` is a fixture. No producing kind carries such an identifier: `model.schema.json` has no
decisions field among its required keys, `coverage-matrix.schema.json` rows are keyed by `dimension`,
`claims.schema.json` by kebab `claimId`, `stack-model.schema.json` by one kebab `decisionId`. The
bound head states its rules as an unnumbered string array.

**Proposed change** — one of two, and the second is recommended.

(i) Add a decision register to the business head. In `templates/kinds/model.schema.json`, add a
required `decisions` array of objects `{ "decisionId": {"pattern": "^BA-[0-9]+$"}, "statement":
{"type": "string"}, "claimIds": {"$ref": "#/$defs/identifierArray"} }`, and add to
`operators/business-decide/operator.md` step 4 the clause "and number the approved rules into
`decisions`, appending only, so a published address is never reused".

(ii) **Recommended.** Make the coverage matrix the decision register it already is. In
`templates/kinds/mutations.schema.json` change `authorityDecisionIds.items` from
`{"type": "string", "pattern": "^BA-[0-9]+$"}` to `{"type": "string", "pattern":
"^[a-z0-9][a-z0-9-]*$"}` and rename the field to `authorityDimensionIds`; in
`templates/kinds/backend-source-application.contract.json` change the `Decisions` cell regex from
`^BA-[0-9]+(?:, BA-[0-9]+)*$` to `^[a-z0-9][a-z0-9-]*(?:, [a-z0-9][a-z0-9-]*)*$`; in
`operators/backend-source-apply/operator.md`, under "The backend never invents business behaviour",
add "the approved decision an operation cites is a coverage-matrix dimension of the published head,
addressed by its `dimension`, and the matrix fingerprint travels with the citation". This costs one
schema edit and one contract edit, it reuses the fingerprint the matrix already carries, and it makes
the citation checkable rather than merely well-shaped.

### A2. `sourceWrites.policy` was not updated when `mode: dry` was added

**File** `resources/orchestrator.json`, `sourceWrites.policy`.

**Evidence** The sentence reads "the routed checkout must declare `gitPolicy.worktreeBranches =
session-only`…; a route declaring `forbidden` binds read-only and no source-writing operator may run
against it", with no exception. `backend.source.apply` under `dry` writes nothing — its own
operator.md says "not one byte reaches `@workspaces/be`". The `starci-academy/be` declaration carries
no `gitPolicy` at all, so the conservative binding is `forbidden`, and a dry apply is therefore
unlaunchable against the very route the `backend-feature` workflow targets. This run dispatched step 5
on the operator's own authority, which `SKILL.md` says overrides this file, and records the
contradiction rather than hiding it.

**Proposed change** Append to that policy string: `"; mode dry is exempt, because it writes nothing:
a dry backend.source.apply or frontend.source.apply may run against a read-only binding, and its
mutations.json records the plan with a null commit."`

### A3. The BE route still declares no `gitPolicy` (round-1 gap 1, unfixed)

**Files** `.workspaces/projects/starci-academy/be.json` (outside `.claude`, the workspace owner's),
`operators/workspace-bind/operator.md` (Requirements, `gitPolicy` Default cell).

**Evidence** `be.json` has no `repository.gitPolicy`; `fe.json` has one, and since `90ef7fcb8` it
reads `session-only`. The requirement's default is "the policy the route declaration carries", which
resolves to nothing, so two runs may invent differently for the same route — round 1 and round 2 both
had the value handed to them by the test owner and neither could have derived it.

**Proposed change** Two edits. In `.workspaces/projects/starci-academy/be.json`, add under
`repository`: `"gitPolicy": { "mutationBranch": "mtp", "worktreeBranches": "session-only",
"incomingBranchRefs": "merge-into-mutation-branch" }`. In `operators/workspace-bind/operator.md`,
change the `gitPolicy` Default cell to "the policy the route declaration carries; a declaration that
carries none is `INVALID_INPUT` at step 1, never a guessed policy", so the gap fails loudly instead of
being filled by whoever writes the request.

## B — what would have stopped `quality.verify`

### B1. A dry predecessor is refused too late and by the wrong rule

**Files** `operators/quality-verify/operator.md` ("One delivery, one head, at least one producer
receipt"), `operators/quality-verify/validate.mjs`.

**Evidence** The validator's only defence is per gate file:
`if (r.predecessorCommit !== r.sourceHead) errors.push(...)`. A dry predecessor has no commit at all,
so the operator would consume it at step 2, run every gate against the base head, and discover the
contradiction only when the gate files are checked. The operator's Inputs table cannot tell a dry
`backend-source-application` from an applied one, because the receipt kind is the same in both modes.

**Proposed change** In `operator.md`, add to that section: "A predecessor produced under `mode: dry`
carries no commit and describes a plan rather than a delivery; it is `PREDECESSOR_STALE` at step 2,
before any command runs, because a plan has no head to stand on." In `validate.mjs`, beside the
existing predecessor checks, refuse a `done` branch whose `changes` input Binding row reads "nothing
written" or whose `backend-source-application` Binding row has `Commit` equal to `—`.

## C — contract and orchestration defects

### C1. `boundProfile` and `ranProfile` cannot be recorded

**Files** `templates/step/response.schema.json`, `resources/orchestrator.json`
(`profileEquivalents.rule`), `scripts/validate-response.mjs`.

**Evidence** The rule says "response.json records both (`boundProfile`, `ranProfile`) so an audit can
tell a stand-in from the binding". `response.schema.json` is `additionalProperties: false` and
declares neither field, so writing them fails the gate. This run bound `luna` on three branches and
ran Claude Opus, which is not even `luna`'s declared equivalent, and the session has nowhere to say
so — the sentence at the top of this record is the only record that exists.

**Proposed change** In `templates/step/response.schema.json` `properties`, add
`"boundProfile": { "type": "string", "minLength": 1 }` and
`"ranProfile": { "type": "string", "minLength": 1 }`, both optional. In
`scripts/validate-response.mjs`, add: when either is present, require both, and require `boundProfile`
to equal the profile `operator.json` names for that operator.

### C2. Fingerprint canonicalization is still unpublished (round-1 defect 8, unfixed)

**Files** every `templates/kinds/*.schema.json` carrying a `fingerprint` `$def`;
`operators/business-decide/validate.mjs` line 199.

**Evidence** Round 1 recorded `routeFingerprint` `sha256:4144c224…`; round 2, reading the same two
declared files, cannot reproduce it and cannot tell whether it should. `identityFingerprint` is
demonstrably the sha256 of `.workspaces/device-state.json`'s bytes; `routeFingerprint` is
demonstrably not the sha256 of either route file's bytes, nor of their concatenation as round 1 left
them. This run declared its own rule and no validator noticed. Separately,
`model.claimsFingerprint` is never compared with `claims.json.fingerprint`; only the coverage pair is
checked.

**Proposed change** Add `templates/kinds/FINGERPRINTS.md` stating one rule — "a document fingerprint
is sha256 over the RFC 8785 (JCS) canonical JSON of the document with its own fingerprint field
removed; a fingerprint over files is sha256 over the concatenated file bytes in the order the schema
lists them" — and cite it from the `description` of every `fingerprint` `$def`. In
`operators/business-decide/validate.mjs`, beside line 199, add
`if (claims && model.claimsFingerprint !== claims.fingerprint) errors.push('response/data/model.json: claimsFingerprint must equal the frozen claims fingerprint');`

### C3. `declaredWriteRoots` is still overloaded (round-1 defect 2, unfixed)

**Files** `operators/workspace-bind/operator.md` (Requirements, Steps 4),
`operators/workspace-bind/validate.mjs`, `templates/kinds/route.schema.json`,
`templates/kinds/workspace-route-binding.contract.json`.

**Evidence** The field is simultaneously "the only paths later work may write" and "the boundary
outside which dirt blocks", so tolerating a person's unrelated `.workspaces/projects/tayson` edits
requires declaring them a write root the chain will never write. The error's own resume text asks for
exactly that. Two rounds have now done it and both had to explain in prose that they did not mean it.

**Proposed change** Add a Requirements row to `operator.md`:
`| toleratedDirtRoots | list | empty | Paths whose pre-existing uncommitted changes do not block the binding, and which no later step may write |`,
and name it beside `declaredWriteRoots` in Step 4's Params. Add a required `toleratedDirtRoots` array
to `route.schema.json` beside `writeRoots`. Add a `^## Tolerated dirt$` section with table
`| Path | Why |` and no `minRows` to `workspace-route-binding.contract.json`. In `validate.mjs`, refuse
any path appearing in both lists and require the receipt's new table to match
`route.toleratedDirtRoots` the way the Write roots table already matches `route.writeRoots`.

### C4. A read-only binding cannot render its own receipt

**Files** `templates/kinds/workspace-route-binding.contract.json` (`## Write roots`),
`templates/kinds/route.schema.json` (`writeRoots`).

**Evidence** The contract sets `"minRows": 1`; the schema sets `"minItems": 0` and its own description
reads "empty for a read-only binding (`declaredWriteRoots` defaults to empty)". Since
`validate.mjs` also requires the receipt's rows to equal `route.writeRoots` exactly, an honest
read-only binding has no legal document.

**Proposed change** Remove `"minRows": 1` from the `## Write roots` section of
`workspace-route-binding.contract.json`.

### C5. `backend.source.apply` has no `## Next` row for a dry plan

**File** `operators/backend-source-apply/operator.md` (`## Next`).

**Evidence** All three forward rows begin "the contract is filled". Under `dry` the contract is not
filled — the operator says so itself — yet the branch ends `done` and must name a `next`. Nothing
validates `next` against the Next table, so the gap is silent and the workflow wins at runtime
(round-1 defect 5, unfixed).

**Proposed change** Add the row
`| the plan was produced under mode dry and a person decides whether to pay for it | user |`,
and add to `scripts/validate-response.mjs` a check that every entry of `response.next` appears in the
operator's `## Next` table or is `user`/`external`.

### C6. A dry agent is granted the tools its mode forbids

**Files** `operators/backend-source-apply/operator.json` (`resources.tools`),
`resources/orchestrator.json` (`agent.grants`).

**Evidence** The operator declares `@tools/sourcewrite: declared-write-set` and
`@tools/git: commit-session-branch` unconditionally. Under `mode: dry` it may use neither, and
`agent.grants` has no way to condition a grant on a requirement, so the one run that must not write is
handed the write tools.

**Proposed change** Append to `agent.grants`: "a tool whose only use the operator's mode forbids is
not granted for that run; `backend.source.apply` and `frontend.source.apply` under `mode: dry` receive
neither `@tools/sourcewrite` nor `@tools/git`." State the same in the operator's "Dry mode writes the
plan, not the tree" paragraph so the grant and the prose cannot drift apart.

### C7. The downstream operators still bind the published head only (round-1 defect 11, unfixed)

**Files** `operators/architecture-decide/operator.md` and
`operators/backend-source-apply/operator.md` (Inputs and Context tables).

**Evidence** Both bind `@worktrees/businesses/<featureId>`, the *published* head, and neither declares
an input that could carry a modelled-but-unpublished head. In this run step 4 and step 5 both read
`pending` at `eccaeaad…40b1` while the modelled `in-progress` head sat in
`step-3/parallel-1/response/data/model.json`. Any `business.decide` branch that is dry, blocked, or
awaiting approval leaves the rest of the chain reading yesterday's promise.

**Proposed change** Add to both Inputs tables
`| model | business.decide; the head that branch modelled, when it has not been published yet | no |`,
and add one sentence to each operator's binding paragraph: "when the `model` input is present it is
the authority for this run and the published head is lineage only; when it is absent the published
head is the authority."

## What round 1 fixed and this run confirms

`workspace.bind`'s `## Next` table now lists `business.decide`, so step 2's route is no longer
decoration. `templates/kinds/route.schema.json` now carries the `["forbidden", "session-only"]` enum
that matches the portable declaration schema, and `writeRoots` now allows `minItems: 0`.
`backend.source.apply` gained `mode: dry`, and its validator carries real dry-mode law: a null commit,
no after hash on any planned path, no conformance record, no proof record, and every path reported
`unchanged` in the change record. None of that law could be exercised this round, because the branch
stopped before the plan existed — but it is written, and it is written correctly as far as reading it
can tell.

---

# Verdict

The chain reached step 5 of the seven the workflow names and stopped there. `workspace.bind` blocked
and resumed exactly as designed for the second round running; `business.decide` and
`architecture.decide` re-produced their round-1 answers at a new head with every citation reopened and
one inherited counting error caught; `backend.source.apply` in `mode: dry` blocked at its authority
binding with `BUSINESS_AUTHORITY_MISSING`, which is the correct stop and a green result for the test:
the operator refused to mint a decision address rather than shipping a plan that cited an invented
one. `quality.verify` was never dispatched, and the reading of why it could not have verified a plan
is recorded above rather than performed.

The round did not achieve what it was called for. `mode: dry` exists, it is written carefully, and it
remains untested end to end, because a schema two files away from it demands an identifier the tree has
never published. A2 and A1 are the two edits that would let round 3 actually run it, and A1 is the one
that matters: until an approved decision has an address, no backend receipt in this tree can honestly
cite one, in dry mode or in apply mode.
