# v8-4 — `scripts/check-work-consistency.mjs` (cross-record semantic consistency)

Lane: v8-4 · Script: `scripts/check-work-consistency.mjs` (443 lines) · Fixture: `tests/work-consistency.spec.mjs` (12 tests)
Live run stamp: 2026-09-19, `ex-testing/lint/scratch/_v84/run-live-final.txt` (raw exit 1, marker `EXIT_NONZERO`).

The gate and the deep check each read one record — against its directory, its bytes, its refs, its code. This
script reads records against each other. It writes nothing: every check is a read of `index.yaml` files, and
no `.starciwork` path was touched by this lane (verified below by the base-gate set-diff).

## 1. What it checks

Three tiers, inherited from `check-work-deep.mjs`: REFUSE / SUSPECT / INFO. Findings are sorted within a tier
so two runs on an unchanged tree are byte-identical (that is what makes a fleet set-diff meaningful).

| Concept | Code(s) | Tier | The two records that must agree |
| --- | --- | --- | --- |
| 1. acceptance criteria | `AC_NAMING_ASYMMETRY` | REFUSE, or SUSPECT when the rule owns no `ac/` at all | `br.*.acceptanceCriteria: [name]` ↔ the `ac/<name>/` record beside it |
| 2. proof coverage | `PROOF_FOREACH_DANGLING` REFUSE · `PROOF_ROUTE_UNHOLDS` REFUSE · `PROOF_COVERAGE_GAP` SUSPECT · `PROOF_COVERAGE_THIN` SUSPECT · `PROOF_UNCLAIMED` SUSPECT | as marked | a record's own `requiresProof` ↔ its `composes`/`requirements`/`stateMachine` fields ↔ the `proves` edges other records point at it |
| 3. contradiction | `CONFLICT_WITHOUT_DECISION` | REFUSE when both sides are `done`, SUSPECT otherwise | the two ends of a `conflictsWith` edge ↔ every `work/policy-decision` naming both |
| 4. prover asymmetry | `PROVES_ASYMMETRY` | SUSPECT | a `todo` impl/uat record's `proves` ↔ a `done` target |
| 5. gap closure | `GAP_CLOSED_BY_NOTHING` · `GAP_CLOSURE_STALE` | SUSPECT | `work/gap` `state` ↔ its `closedBy` targets' states |
| 6. catalog ↔ feature node | `CATALOG_DIRTY` REFUSE · `CATALOG_TITLE_DRIFT` SUSPECT | as marked | `index.yaml`'s `features:` entry ↔ `features/<f>/index.yaml` (`work/feature`) |
| 7. state vocabulary | `STATE_VOCABULARY_UNKNOWN` | REFUSE | an authored `state` ↔ `$defs.state.enum` in that family's own `schemas/work-<family>.schema.yaml` |
| 8. dual-tree parity | `PARITY_FIELD` · `PARITY_SKIPPED` | INFO | one record family as authored in `todo-app-backend` ↔ as authored in `ecommerce-app-be` |

Runnable standalone: `node scripts/check-work-consistency.mjs` (both trees), `--tree <path>` (one tree; the
parity concept reports `PARITY_SKIPPED` rather than silently vanishing). Exit 1 on any REFUSE. Two consecutive
full runs were byte-identical (`scratch/_v84/run-live-final.txt` vs `run-live-repeat.txt`, both markers
`EXIT_NONZERO`), because every tier's lines are sorted before printing — the property a fleet set-diff needs.

## 2. Design decisions

**The `requiresProof` population is a whitelist, and the exclusions are the point.** Applying "a done record
with no declared proof bar is thin" to every schema refused 114 records that cannot satisfy it:
`work-business-rule.schema.yaml` is `additionalProperties: false` and declares no `requiresProof`, and no
business-rule in either tree carries one; `implementation`/`uat-flow`/`ui-screen` state their proof contract
as the outbound `proves` edge instead. So `PROOF_DEMAND_SCHEMAS` lists the six schemas that do author it —
four declared that way in their per-family schema file (`functional-requirement`,
`non-functional-requirement`, `customer-journey`, `sds-component`), plus `contract` and `integration`, which
author it in both trees and have no per-family schema file at all, so the trees are the only available
authority. Live effect: 1 THIN finding, not 114.

**`forEach` resolves as a dotted path.** The schema text says "the name of a field on this same record", and
the trees author `transitions: {forEach: stateMachine.transitions}` — a nested path. A single-key lookup
called all 11 sds components' transition demands dangling, i.e. refused the tree's most consistent
convention. `fieldOf` walks the path; `PROOF_FOREACH_DANGLING` now refuses only a name no path resolves to
(zero live findings, proven by fixture).

**The prover pairing is schema-scoped, because one record type answered its `uat` demand differently.** A
first pass demanded a `work/uat-flow` for any done record with `requiresProof.uat.required`. That named
`journey.login.first-sign-in`, which is done with its own `evidence.yaml` and is pointed at by no uat-flow in
either tree — journeys carry their own walked evidence here (`proves` edge census: `uat-flow` targets only
`functional-requirement` (16) and `business-rule` (10); no journey is ever a `proves` target). So
`PROVER_PAIRING` keeps the two pairings the layout actually uses — `fr.uat → work/uat-flow`,
`sds.implementation → work/implementation` — and the count went 3 → 2, with the third line removed as a false
positive rather than reported at a softer tier.

**A conflict is settled when a `decided` policy-decision names both ends anywhere in its record.** Not just
`tension.records`: `decision.audit.erasure-method` resolves `br.audit.erasure.right ↔ br.audit.retention`
through its `tension.records`, and an `outcome: open` decision naming both does not resolve anything (it
records that nobody has decided). Both ends `done` with no decider is the only refusal; any `todo` side makes
it a SUSPECT, because the contradiction is then about a claim that is not being made yet.

**REFUSE was withheld from `proves` where the base gate already fires.** `PROVES_TARGET_NOT_DONE`
(`check-example-work.mjs` concept 3, line 287) covers done-source → not-done-target. This script covers the
mirror, and one line per source record rather than per edge: 7 lines for 20 edges, each naming its targets.
The literal brief wording ("`proves: [X]` but X's derived provenance would not include it") was measured and
rejected: `proves` is not in `EDGE_FIELD_NAMES` in `scripts/example-derive.mjs`, so it lands in
`unclassifiedEdges` and no record's `usedBy` carries it — that reading refuses all 89 `proves` edges in both
trees and distinguishes nothing. The section comment in the script records that so the next reader does not
"fix" the check back into the useless version.

**One INFO line per record family, not per field.** Cross-tree field deltas are 40 lines field-by-field and 10
lines grouped, and the grouped form is the one that reads: the two `work/brand` records share three keys out
of ten, which is a forked convention, while `work/integration.module` appearing in one tree is a skeleton not
yet written. Value vocabularies (`state`, `outcome`, `change.kind`) are deliberately not compared — the only
value divergence in either tree was `state: uninvestigate`, which is concept 7's refusal, and everything else
of that shape measures progress, not convention.

**Severity discipline on `uninvestigate`.** One tree authored `state: uninvestigate` on all five of its
ui-screens; `schemas/work-ui-screen.schema.yaml` declares `state` as `$ref: #/$defs/state`, enum
`[todo, done]`. It is refused, and the enum is read from the schema file rather than restated in the script,
so the check cannot drift from the authority it enforces. That is the check's headline live finding: those five
records match neither branch of every `state === 'done'` rule in the base gate, so they escape the ui
direction-asset rule (concept 10), the render-proof rule and the done-needs-evidence rule while still reading
to a skimming human as designed screens. It is also the one place this lane reports a defect another check
"should" own: `tests/work-record-schemas.spec.mjs` validates every record in `todo-app-backend` against its
family schema and would catch this shape, but (a) it never walks the ecommerce tree and (b) it cannot run on
this host — `node --test tests/work-record-schemas.spec.mjs` dies with `ERR_MODULE_NOT_FOUND:
.../node_modules/ajv/dist/2020.js` (ajv is a declared devDependency and is not installed here; raw marker
`EXIT_NONZERO`). `PARITY_VOCABULARY` was dropped rather than softened, so nothing here claims to be the
schema validator.

## 3. Live findings, verbatim

`node scripts/check-work-consistency.mjs` on both real trees —
`311 record(s) across 2 tree(s): 8 refused, 24 suspect, 10 info` (raw exit 1).
`node scripts/check-work-consistency.mjs --tree examples/ecommerce-app-be/.starciwork` —
`41 record(s) across 1 tree(s): 5 refused, 4 suspect, 1 info`.

All 8 refusals, verbatim:

```text
REFUSE  examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/index.yaml: ui.checkout.cart carries state "uninvestigate", which schemas/work-ui-screen.schema.yaml declares no such value (its enum is [todo, done]) - the record matches neither the done rules nor the todo ones [STATE_VOCABULARY_UNKNOWN]
REFUSE  examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/index.yaml: ui.checkout.landing-home carries state "uninvestigate", which schemas/work-ui-screen.schema.yaml declares no such value (its enum is [todo, done]) - the record matches neither the done rules nor the todo ones [STATE_VOCABULARY_UNKNOWN]
REFUSE  examples/ecommerce-app-be/.starciwork/features/checkout/ui/shop-browse/index.yaml: ui.checkout.shop-browse carries state "uninvestigate", which schemas/work-ui-screen.schema.yaml declares no such value (its enum is [todo, done]) - the record matches neither the done rules nor the todo ones [STATE_VOCABULARY_UNKNOWN]
REFUSE  examples/ecommerce-app-be/.starciwork/features/checkout/ui/stock-refused/index.yaml: ui.checkout.stock-refused carries state "uninvestigate", which schemas/work-ui-screen.schema.yaml declares no such value (its enum is [todo, done]) - the record matches neither the done rules nor the todo ones [STATE_VOCABULARY_UNKNOWN]
REFUSE  examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/index.yaml: ui.identity.sign-in carries state "uninvestigate", which schemas/work-ui-screen.schema.yaml declares no such value (its enum is [todo, done]) - the record matches neither the done rules nor the todo ones [STATE_VOCABULARY_UNKNOWN]
REFUSE  examples/todo-app-backend/.starciwork/features/audit/data/log-line/index.yaml: data.audit.log-line (done) and br.task.delete.final (done) each declare the other impossible - "stays-gone requires a deleted task's identifier to resolve to nothing anywhere, now and after a restart, but target here is exactly that identifier, kept byte-f" - and no work/policy-decision naming both sides settles it; two done records cannot both be true of the same product [CONFLICT_WITHOUT_DECISION]
REFUSE  examples/todo-app-backend/.starciwork/features/plan/contract/create-precondition/index.yaml: contract.plan.create-precondition (done) and fr.task.create (done) each declare the other impossible - "fr.task.create's mainFlow creates a task for any non-empty title with no precondition step and no dependency on this contract, so its done state and this contra" - and no work/policy-decision naming both sides settles it; two done records cannot both be true of the same product [CONFLICT_WITHOUT_DECISION]
REFUSE  examples/todo-app-backend/.starciwork/features/recur/data/occurrence/index.yaml: data.recur.occurrence (done) and sds.task.completion-state (done) each declare the other impossible - "an occurrence's lifecycle has five states because a rule can end under it (materialised can become orphaned); sds.task.completion-state models exactly two (open" - and no work/policy-decision naming both sides settles it; two done records cannot both be true of the same product [CONFLICT_WITHOUT_DECISION]
```

The last three refusals are the `erasure`-vs-`retention` class the brief named. The pair the tree already
settled (`br.audit.erasure.right ↔ br.audit.retention`, decided by `decision.audit.erasure-method`, whose
`tension.records` names both) stays silent, while three pairs that recorded their own contradiction in
`because` and never wrote the decision are refused. All three refuse edges cross a feature boundary
(`audit ↔ task`, `plan ↔ task`, `recur ↔ task`), which is exactly where a per-record check cannot see the other
half. Two further conflict edges are in the trees with a `todo` side and are reported as SUSPECT instead:
`contract.notify.new-device-signal ↔ br.login.session.single-device` and
`fr.notify.on-new-device ↔ br.login.session.single-device`.

Representative SUSPECT lines. The 24 break down as 7 `PROVES_ASYMMETRY`, 5 `CATALOG_TITLE_DRIFT`,
4 `PROOF_COVERAGE_GAP`, 2 `CONFLICT_WITHOUT_DECISION`, 2 `GAP_CLOSURE_STALE`, 2 `PROOF_UNCLAIMED`,
1 `PROOF_COVERAGE_THIN`, 1 `GAP_CLOSED_BY_NOTHING`:

```text
SUSPECT examples/todo-app-backend/.starciwork/features/audit/uat/right-to-be-forgotten/index.yaml: uat.audit.right-to-be-forgotten is todo but its proves names 4 record(s) already done (fr.audit.erasure.request, fr.audit.erasure.complete, fr.audit.export, fr.audit.log.read) - their provenance now rests on a prover that is not itself proven [PROVES_ASYMMETRY]
SUSPECT examples/todo-app-backend/.starciwork/features/audit/fr/log/append/index.yaml: fr.audit.log.append is done and its requiresProof.uat demands a uat-flow, but no work/uat-flow record in this tree names fr.audit.log.append in its proves - the demand is stated and unclaimed [PROOF_UNCLAIMED]
SUSPECT examples/todo-app-backend/.starciwork/features/share/fr/list/index.yaml: fr.share.list is done, composes 2 rule(s) through src/modules/bussiness/share, and declares no e2e demand - composition is exactly what no isolated test can see [PROOF_COVERAGE_GAP]
SUSPECT examples/todo-app-backend/.starciwork/features/task/gap/reopen-not-specified/index.yaml: gap.task.reopen-not-specified records the gap as closed and names no closedBy - nothing in this tree says what closed it, so the claim is unfalsifiable [GAP_CLOSED_BY_NOTHING]
SUSPECT examples/todo-app-backend/.starciwork/features/audit/gap/emitted-events/index.yaml: gap.audit.emitted-events is still open while every record it names as its closer is done (impl.task.todo-app-backend.platform-events) - either the gap is stale or one of those done claims is not [GAP_CLOSURE_STALE]
SUSPECT examples/todo-app-backend/.starciwork/index.yaml (feature entry share): the catalog describes the feature as "A task shared with other people through role-bounded, expiring invitations." while the feature node titles it "A task shared with other people" - one is the other truncated [CATALOG_TITLE_DRIFT]
SUSPECT examples/ecommerce-app-be/.starciwork/index.yaml (feature entry checkout): the catalog describes the feature as "Cart, stock, payment and the confirmed order - the first thing that needs a second service." while the feature node titles it "Buying what is in the cart" - two different sentences about one feature [CATALOG_TITLE_DRIFT]
```

All 10 parity lines are worth reading as a set (`_v84/run-live-final.txt`); the sharpest:

```text
INFO    (both trees): work/brand is authored two different ways (ecommerce-app-be=1, todo-app-backend=1 record(s)) - only ecommerce-app-be: colour, donts, imagery, mascot, review, typography; only todo-app-backend: assets, brand, change, completion, kind [PARITY_FIELD]
INFO    (both trees): work/sds-component is authored two different ways (ecommerce-app-be=1, todo-app-backend=12 record(s)) - only ecommerce-app-be: extensions; only todo-app-backend: appliesTo, blockedBy, subscribes [PARITY_FIELD]
INFO    (both trees): work/business-rule is authored by one tree only (ecommerce-app-be=4, todo-app-backend=30 record(s)) - only todo-app-backend: blockedBy, conflictsWith, refs [PARITY_FIELD]
```

`work/brand` is the one to act on: two brand records, one per tree, sharing only `schema`, `id`, `state`.
Every render/brand check in `checks/brand.mjs` and `checks/render.mjs` reads one shape; the two trees are not
authoring the same contract, and no check said so before this one.

## 4. False positives observed

Measured, not assumed — each count is a run on both live trees:

| Run | REFUSE | SUSPECT | INFO | What was wrong |
| --- | --- | --- | --- | --- |
| 1 | 58 | 27 | 71 | 50 of the 58 refusals were `AC_NAMING_ASYMMETRY`: the criterion-lives-under-its-rule test compared `path.relative(...)` normalized to `/` against a prefix built with `path.sep` (`\` on this host), so **every** acceptance criterion in both trees was refused. Caught because the live tree cannot plausibly have 50 broken criteria when the base gate's ref resolution passes them. |
| 2 | 8 | 27 | 71 | Refusals clean. Still 71 INFO: 40 per-field parity lines plus 31 value-vocabulary lines, mostly "the skeleton tree has not authored that yet". |
| 3 / final | 8 | 24 | 10 | Parity aggregated per family and value vocabularies dropped; `journey.login.first-sign-in`'s `PROOF_UNCLAIMED` removed as a false positive (see §2); `fr.notify.on-completion` stopped being reported three times for one absence (its `PROOF_COVERAGE_THIN` line now stands alone). |

Two live-only judgment calls that a reader may reverse:

- The 4 `PROOF_COVERAGE_GAP` lines on `fr.share.*` and `fr.notify.on-completion` say "no e2e demand is
  declared", not "no e2e proof exists". Those flows have unit and uat demands and evidence; an author who
  decided a walked uat covers share's composition is right to keep it, and the demand is theirs to state.
  SUSPECT tier, never refusal.
- The 5 `CATALOG_TITLE_DRIFT` lines compare a catalog `description` to a feature `title` after stripping
  trailing punctuation and collapsing whitespace, so only real prose divergence is reported. Three of the
  five are truncations (`share`, `notify`, `recur`), which reads as the catalog sentence being shortened
  when the feature node was retitled — drift, not error, but the kind that ends with two descriptions of one
  feature.

Zero findings of these codes were reported on the live trees while the corresponding shapes exist:
`AC_NAMING_ASYMMETRY` (0 — v6-4's `[is-idempotent, is-reversible]` class is clean today; the fixture proves
it fires), `PROOF_FOREACH_DANGLING` (0 after the dotted-path fix), `PROOF_ROUTE_UNHOLDS` (0). Those three are
kept because they are cheap, deterministic and each is proven by a fixture; they are also the three codes most
likely to fire the next time a lane edits a rule's criteria or a `forEach` demand.

## 5. What this script deliberately does NOT check

- **Nothing about code, files or digests.** No `owners`/`module` existence, no `codeDigest` freshness, no
  command liveness, no route/contract surface. Those are `check-example-work.mjs` (concepts 1–3),
  `check-work-deep.mjs` and the v8-2 surfaces lane.
- **Whether a demanded proof was satisfied.** `provenBy` is derived by the kernel from `requiresProof` plus the
  provers' `proves` edges, and `check-work-deep.mjs` refuses an authored one (`PROVENBY_AUTHORED`). This script
  asks only whether a demand is stated, internally scaled, and claimed by some record — never whether it was
  met. Concretely: 8 done `fr` records demand `uat` and are claimed only by a `todo` uat-flow; that is not
  reported at all, because `gap.audit.live-proof` and `gap.checkout.live-proof` already author the same fact as
  an open gap, and reporting it twice in two vocabularies is how a tree starts arguing with itself.
- **`provider`/`consumer` on a contract.** Two roles, no authored field saying which prover covers which side;
  splitting them would invent an edge the layout does not record. `live` and `measurement` are answered by the
  record's own evidence run, which belongs to v8-1's replay tool.
- **Record shape.** No JSON-Schema validation, no enum membership beyond the one `state` clause needed to turn
  an invented value into a refusal. `tests/work-record-schemas.spec.mjs` is that check (and needs ajv).
- **The `tension`-off-`policy-decision` and legacy `directory`/`files`/`targetFiles` cases the brief names as
  parity examples.** Both are already refused by the base gate (concepts 3 and 9); re-refusing them here would
  put one defect on two ledgers with two different owners.
- **`_derived/**`, `evidence.yaml`, `accounts.yaml`, asset payloads and uat run manifests** are excluded from
  the record inventory (`loadRecords` skips evidence and `_derived`; the walk here additionally ignores
  `assets/` and `runs/`), so a `generation-receipts.yaml` payload is never read as a record — which is the
  exact mistake the base gate currently makes 6 times in `ecommerce-app-be` (`id is undefined, but its place
  says ui.checkout.cart.assets`).

## 6. Testing

Fixture convention found: `tests/example-work-gate.spec.mjs` builds a throwaway `.starciwork` under
`<drive root>/starci-tmp` and asserts per-rule refusals against the exported checker. `tests/work-consistency.spec.mjs`
matches it — 12 tests, one section per concept, each asserting the malformed pair fires, the legitimate
variant stays silent, and the tier matches (`refusedWith` / `suspectedWith`):

```text
node --test tests/example-work-gate.spec.mjs tests/work-consistency.spec.mjs
ℹ tests 35 | ℹ pass 35 | ℹ fail 0        (raw marker EXIT_ZERO; the 23 existing gate tests were re-run
                                            alongside so the new file is shown not to disturb them)
```

`node --test tests/work-consistency.spec.mjs` alone: 12 pass, 0 fail, marker `EXIT_ZERO`. First run was 8/12:
four failures, all of them flaws in my expectations rather than in the script — a fixture whose criterion id
also changed (so it hit the id/place refusal instead of the back-reference one), a catalog fixture builder that
appended entries without writing the `features:` key, and one assertion that demanded zero SUSPECT lines from a
tree whose `PROVES_ASYMMETRY` line was correct. Fixed in the test, not in the check.

Not run: the full `npm test` (`node --test tests/*.spec.mjs`) — several of its files import ajv, which is not
installed on this host, so a suite run cannot be interpreted here; the two files that matter to this lane are
above.

## 7. Fleet evidence and lane boundaries

- Files this lane created: `scripts/check-work-consistency.mjs`, `tests/work-consistency.spec.mjs`, this
  report, `done/v8-4.done`, and scratch under `ex-testing/lint/scratch/` (`_v84-explore.mjs` plus
  `_v84-proto.mjs` … `_v84-proto5.mjs` — the six measurement passes that set the tiers;
  `_v84-gate-diff.mjs`, `_v84-gate-attribute.mjs`; `_v84/` with the stamped runs). No existing file was edited.
- `check-example-work.mjs`, `check-work-deep.mjs`, `example-ownership.mjs` and every `.starciwork` tree:
  untouched, per `_common.md`. Evidence rather than assertion — `git status --porcelain` reports no `M` for the
  two tracked canon files, and mtimes put the canon reads outside this lane: `check-example-work.mjs`
  2026-09-18T17:43Z, `example-ownership.mjs` 2026-09-18T06:50Z, `check-work-deep.mjs` 2026-09-19T11:30:30Z
  (it is untracked — `??`, another lane's new file — and was last written 22 minutes before this lane's first
  file write at 11:52:15Z). This lane's own files: `scripts/check-work-consistency.mjs` 12:13Z,
  `tests/work-consistency.spec.mjs` 12:18Z, this report 12:25Z.
- Base gate (`node scripts/check-example-work.mjs`) before the first write and after the last, with the
  finding-line sets compared rather than the totals, because lanes v7/v8 are editing the same trees:
  - before — `154 refused, 4 warned` over `311 records / 2505 refs / 120 evidence` (marker `EXIT_NONZERO`),
    `scratch/_v84/gate-baseline.txt`;
  - after — `135 refused, 4 warned` over the same `311 / 2505 / 120` (marker `EXIT_NONZERO`),
    `scratch/_v84/gate-final.txt`;
  - set-diff — 47 finding lines changed, **14 added / 33 removed, all 47 `RENDER_CHECK_FAILED`, all on 5
    frontend `impl` records in `todo-app-backend`** (`sign-in`, `preferences`, `schedule`, `invite-screen`,
    `task-list`) — another lane's re-captures. This lane's attribution to that delta: none.
    `scratch/_v84/gate-diff.txt`.
  - after the last write of all (report + `done/v8-4.done`) — `135 refused, 4 warned`, byte-equal to
    `gate-final.txt`, and the same 47-line set-diff against the baseline
    (`scratch/_v84/gate-close.txt`, marker `EXIT_NONZERO`). This lane's own checks were re-run at the same
    moment and were byte-equal to `run-live-final.txt`, so the live numbers above are the closing numbers too.
- The record/ref/evidence totals being identical across the two gate runs is the part worth trusting: no
  record appeared or vanished while this lane worked, so the 19-line swing is entirely palette variance in
  captures this lane never opened.
- Live numbers in §3 are a snapshot. If `STATE_VOCABULARY_UNKNOWN` or `CONFLICT_WITHOUT_DECISION` counts move
  after another lane's commit, the finding was re-attributed, not contradicted: rerun the command and compare
  sets, not totals.

## 8. Open items for the owner (this lane does not fix records)

1. Five `ecommerce-app-be` ui-screens carry `state: uninvestigate`. Either the word belongs in the layout (then
   `schemas/work-ui-screen.schema.yaml`'s `$defs.state` enum and every `state === 'done'` rule need the same
   edit together) or the records become `state: todo` with the reason in prose. Until one of those happens the
   five are unchecked by the gate's done rules.
2. Three `conflictsWith` pairs where both sides are `done` and no decision settles them
   (`data.audit.log-line ↔ br.task.delete.final`, `contract.plan.create-precondition ↔ fr.task.create`,
   `data.recur.occurrence ↔ sds.task.completion-state`). Each already contains the argument; what is missing
   is the `work/policy-decision` that names both and says which one yields — the shape
   `decision.audit.erasure-method` demonstrates.
3. `work/brand` is two different contracts in two trees; whichever is canonical, the other should be rewritten
   toward it before a third example tree inherits the ambiguity.
4. `fr.share.*` and `fr.notify.on-completion` state no e2e demand while composing 1–2 rules each; `fr.audit.log.append`
   and `fr.share.list` demand a walk no `uat-flow` claims. Either add the demand/the flow, or say in
   `requiresProof` why composition is covered elsewhere.
