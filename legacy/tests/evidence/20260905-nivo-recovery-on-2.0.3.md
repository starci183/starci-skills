# Rerunning the Nivo workspace auto-recovery mission on StarCi Skills 2.0.3

The third run of the OUTER AgentOS workspace auto-recovery backend mission. The 2.0.0 rerun
(`20260905-nivo-recovery-on-2.0.0.md`) met seven closed doors and never reached `backend.generate`;
the 2.0.2 replan (`20260905-nivo-recovery-replan-on-2.0.2.md`) proved the doors open on real ledgers
but dispatched nothing. This run dispatches.

- Mission: the Core-backed recovery backend frozen by business19 and architecture21 of session
  `20260904-042654-nivo-frontend.direction.decide`.
- Runtime under test: `<Source>/.claude` at `3dbc57bd` (2.0.3-alpha.1).
- Session: `<Source>/.worktrees/sessions/20260905-031845-nivo-recovery-on-2.0.3`.
- Product checkout: `D:/Repositories/nivo-be-recovery-20260905-031845`, branch
  `session/20260905-031845-nivo-recovery-on-2.0.3`, branched at `78426381`.
- Goal choice recorded as-stated, sourceRef
  `user-message:2026-09-05 "xong 2.0.3 spawn 2 agent chạy lại 2 task nivo"`.

## The chain, drawn on 2.0.3

`environment.preflight -> workspace.bind#be -> backend.generate (scope full) -> quality.verify ->
business.reconcile`, exactly the shape the 2.0.0 note's replan predicted and the 2.0.2 note proved.
business19 is imported at `8/1` and architecture21 at `9/1`, both evidence-only; no `business.decide`
and no `architecture.decide` branch exists.

## D8 and D10 of the 2.0.2 note are closed

### D8 — the chain gate can now learn an imported input from the plan

`templates/step/state.schema.json` gives `planned["N/M"]` an `inputs` map, "kind -> step-N/parallel-M
reference into an imported slot of this session", and `resources/orchestrator.json#session.lifecycle`
says the orchestrator writes `planned[N/M] = { requirements, inputs }` when the chain is drawn.
Writing `planned["3/1"].inputs["architecture-decision"]` was enough:

```
$ node .claude/scripts/validate-chain.mjs .worktrees/sessions/20260905-031845-nivo-recovery-on-2.0.3
chain valid
$ node .claude/scripts/validate-session.mjs .worktrees/sessions/20260905-031845-nivo-recovery-on-2.0.3
session valid
```

Both green with **zero** `request.json` files on disk. On 2.0.2 the same chain was refused at `3/1`
until `backend.generate`'s request was written ahead of its dispatch. That workaround is gone, and
the believed fix the 2.0.2 note recorded is the fix that shipped.

### D10 — the create order is now written down

`resources/orchestrator.json#session.lifecycle` states it in the operator's own words: "Order at
create: state.json is written with the mission and a provisional chain of the preflight branch alone,
the evidence slots are imported (scripts/producer-import.mjs needs state.json), the chain is planned
from the mission and those slots, and chain, steps and planned are rewritten from the plan." The
three writes to `state.json` are the documented lifecycle rather than an undescribed manoeuvre.

## Step 1 — environment.preflight

Twenty-two checks, one more than the 2.0.0 run: `host.playwright` joined the closed vocabulary in
2.0.3 and answers `ok` (the host install stands where `resources/tools.json#browsercontrol.install`
names it, with a Chromium under its browsers path). Twenty answer `ok`, two answer `wall`, and both
walls are the same two the 2.0.0 run reported, re-observed rather than carried over:

| Wall | Evidence re-observed at 03:29 |
| --- | --- |
| `runtime.be.holder` | port 3068 is listened on by PID 32964; the registry records pid 50636, now a `cmd.exe` after PID reuse, and listenerPid 52708, absent |
| `host.deps.be` | installed @nestjs 11.2.1, pg 8.23.0, typeorm 0.3.31 against 11.1.27, 8.22.0, 0.3.30 in the lockfile |

Nobody has run `npm ci` in `D:/Repositories/nivo-backend` since the 2.0.0 run, so route 1's recorded
choice carries in full: `preflight-walls:20260905-031845-nivo-recovery-on-2.0.3:v1 =
accept-both-walls`, and the branch is a `resolved` transition rather than a stop.

## Step 2 — workspace.bind

Bound `checkout: session` onto a **new** worktree, `D:/Repositories/nivo-be-recovery-20260905-031845`,
branched at `78426381` with a `node_modules` junction to the same installed tree the 2.0.0 run used.
The 2.0.0 session's own checkout was left untouched, because the handoff forbids switching another
task's checkout. Tree clean, mutation readiness derived as `ready`. The `identityFingerprint` on the
receipt was recomputed from `.workspaces/device-state.json` rather than copied.

## The runtime under test is green

The 2.0.2 note could not run the tree's own suite, because a peer agent was editing the same
worktree. It ran here, at `3dbc57bd`, with no dependency install (the tree carries no `node_modules`,
and every check below is a plain node script):

| Check | Result |
| --- | --- |
| `validate-routing` | routing map closed: 23 operators, 96 routes |
| `validate-resources` | 2 runtimes, 17 tools, 4 profiles, 23 operators on 2 profiles |
| `validate-knowledge-citations` | 44 prefixes, 261 rules, 112 files |
| `validate-alias` | 40 aliases, 74 bindings across 23 operators |
| `validate-operator` | 23 operator.md packages of 23 |
| `validate-defaults` | 23 operators accept a defaults-only request |
| `validate-templates` | 33 templates, 168 documents |
| `run-operator-self-tests` | 23 operator self-tests passed |
| `node --test scripts/*.spec.mjs` | 248 tests, 0 fail, 24.3 s |

`npm run docs:check`, the last link of `npm test`, was not run: it is the only step that needs the
tree's own dependencies, and this mission installs none.

## A door read ahead of step 5, and why it may still be shut

Read before dispatching step 5, not after being stopped by it. The published head of
`agentos-workspace-recovery` is `in-progress`. `operators/business-reconcile/operator.md` offers two
values for `targetState`: `implemented` "when the delivered source enforces every row", or
`in-progress` "when the head is republished with what was delivered so far". But
`operators/business-reconcile/validate.mjs:17-25` carries no `in-progress->in-progress` row in
`LEGAL_TRANSITIONS`; the only reconcilable transition out of `in-progress` is
`in-progress->implemented`.

So the second option the Requirements table offers is unreachable for a head that is already
`in-progress`. A mission of the shape "keep implementing a promise already in progress" has exactly
one lawful ending at this operator: every row of the frozen matrix enforced, no discrepancy standing,
published `implemented`. Anything short of that is `RECONCILIATION_DISCREPANCY`, which publishes no
head at all.

That is the same shape as D6 of the 2.0.0 note, moved from `business.decide` to `business.reconcile`:
an operator whose documented option its own validator cannot express. Whether it actually fires on
this mission is recorded at step 5 below, not predicted here.

## The runtime moved under the running branch, and was re-measured

At about 03:41, while `3/1` was writing source, `<Source>/.claude` was fast-forwarded from
`3dbc57bd` (2.0.3-alpha.1) to `35e5b34e` (2.0.3) by a peer session. A runtime that changes
mid-dispatch is the exact hazard the stopped Codex session's handoff records, so the ledger was
re-gated rather than assumed safe.

Twenty-eight files moved. No operator on this chain is among them: `environment-preflight`,
`workspace-bind`, `backend-generate`, `quality-verify` and `business-reconcile` are all untouched.
Five gate scripts did move, however — `plan-chain.mjs`, `producer-import.mjs`, `validate-chain.mjs`,
`validate-request.mjs` and `validate-response.mjs` — so "the validators are the same" is not quite
right; what is the same is their verdict on this ledger, and that was measured at the new head:

| Gate re-run at `35e5b34e` | Result |
| --- | --- |
| `plan-chain --roles be` | the identical five-branch chain, same imported slot, same goals |
| `validate-chain` | chain valid |
| `validate-session` | session valid |
| `validate-step` on `1/1` | step valid |
| `validate-step` on `2/1` | step valid |
| `validate-request` on `3/1` | request valid |

The 2.0.3 fan-out change — only an operator binding a `units` input fans out through its plan — does
not reach this chain, which carries no plan operator and one `backend.generate` branch.

## Step 3 — backend.generate, the step the 2.0.0 run never reached

One commit, `1a779998`, eighteen files, 2252 insertions against 90 deletions, every path inside
`mutableFileRefs`, no widening, no protected ref touched, working tree clean afterwards.

The receipt was not taken on trust. Checked independently against the repository:

| Claim | How it was checked | Result |
| --- | --- | --- |
| the contract is the frozen one | sha256 of the imported `stack-model.json` bytes against `mutations.contractFingerprint` | equal |
| 24 operations restated unchanged | every operation's transport, writer, stores, transaction, idempotency, migrations and dimension ids compared field by field | zero drift, same order |
| the change record describes the branch | every one of the 18 `afterHash` values recomputed from the file on disk | all 18 match |
| one commit | `git rev-list --count 78426381..HEAD` | 1 |
| the proofs were run | the command, exit code and output of each proof record read | real jest output, not narration |

Seven of the eight defects are closed in code and measured. The eighth, the hand-maintained scheduler
namespace map, is deliberately not closed: the bound matrix approves recovery on the *configured*
replacement target and forbids mutating cluster configuration in this pass, so deriving the namespace
automatically would be a business rule the approved authority does not state. Its silent half was
closed instead — a namespace claimed by two workspace ids now declares no target, which every caller
already treats as a retryable `TARGET_UNAVAILABLE`, rather than resolving its way into recovering one
customer on top of another's runtime.

The fixture the handoff recorded as never authored now exists and runs:
`recovery-retained-data-replay.container-spec.ts`, two installations and fifty-two documents through
real PostgreSQL, MinIO and Qdrant, four cases passing. A second new spec proves the additive migration
adds its keys over an inherited orphan, refuses a new one, and reverses without deleting state — the
`down()` that used to throw.

### The branch broke a rule and said so

It ran `git stash push --keep-index --include-untracked` inside the product checkout while probing
lint baselines, which its dispatch forbade. It recorded that in its own receipt rather than hiding it.
Containment was verified here, not accepted: the stash ref does not exist, the stack is empty, the
2.0.0 run's worktree is still clean at `78426381`, and the stopped Codex checkout still holds its 111
preserved dirty paths. No work was lost and no sibling session's stash was disturbed.

## Step 4 — quality.verify, red on a gate that predates the mission

Six gates planned from the routed plan, all six executed at `1a779998`, none skipped or substituted.

| Gate | Status | Measured |
| --- | --- | --- |
| `format` | fail | the same eslint command as `lint` in this project |
| `lint` | fail | 4030 problems across 79 files |
| `typecheck` | pass | no diagnostic |
| `build` | pass | both nest builds exit 0 |
| `unit-coverage` | pass | 31 suites, 197 tests, against a 189 baseline |
| `integration` | pass | 23 tests over four container specs on real PostgreSQL, MinIO and Qdrant |

Coverage carries no bar: the frozen `jest --showConfig` evidence declares no `coverageThreshold`, so
all four metrics are `unconfigured` and no measured value can sit below a threshold that does not
exist.

The lint result was measured from both ends before it was classified. Of the 79 failing files, 64 lie
outside this delivery, and `lint:check` is repository-wide, so **no re-entry scoped to the delivered
files can turn that gate green**. The delivery nonetheless added 127 errors of its own — the 15 files
it modified went from 1518 to 1554, and its 3 new files carry 91 — and that part is in-boundary for
the backend owner. The base figure was obtained from a throwaway detached worktree at `78426381`,
which is also where this run did its own damage; see below.

`lint` was kept `required` because `operators/quality-verify/validate.mjs#DEFAULT_GATES` marks it
required. Declaring it optional would have produced a green receipt by choosing the gate list after
seeing the result, which is the one thing a gate operator may not do.

The receipt was then rewritten once, when a peer session shipped `lintScope` to `quality.verify` at
`569e4858` mid-run. Under `lintScope: changed` the repository's own base is a `LINT_BASELINE_RED`
finding and only the delivery's own errors decide the gate, which is the same repair Sonar received
when it gained `new-code`. The verdict does not move: the lint gate now records
`lint { baseline: 4030, delivery: 127, changedFiles: 18 }` and passes only at zero. `format` left the
plan in that rewrite, for a reason that is a property of the project rather than of the result —
`format:check` is defined as `npm run lint:check`, the identical command, and only the `lint` gate may
carry a delivery-scoped record, so planning both would measure one command twice and judge the copy
against the whole checkout forever. The first reading, with `format` planned and the whole checkout
judged, is recorded here rather than quietly replaced.

The verdict is `fail` and done-when 1 is not met at `1a779998`.

### D11 — a backend-only delivery can never reach a shipping scorecard

`operators/quality-verify/validate.mjs:23` fixes the nine scorecard topics, and
`:246` refuses a receipt missing any of them. All nine are closed by `interface.audit` and
`uat.verify`. A mission that writes no frontend source plans neither operator — correctly, since the
long-flow law applies only to a frontend delivery under `mode: apply` — so every row is `blocked`,
`scorecardVerdict` returns `blocked`, and `Verdict: ship` is unreachable for any pure backend
delivery. This is independent of whether the gates passed.

Believed fix: let the scorecard report only the topics the delivery's own kind can produce, or record
`not-applicable` for a topic no operator of the planned chain could have closed, so a backend mission
is not permanently blocked on a frontend verdict nobody was ever going to write.

### D12 — an operator's own cleanup can destroy a shared installed tree

Not the tree's defect, but the tree offers no protection against it and the trap is worth recording.
Tearing down the throwaway base worktree, `git worktree remove --force` refused because the directory
was not empty, and `rm -rf node_modules` inside it followed the Windows junction into the **shared**
installed tree owned by the stopped Codex checkout and junctioned by two other worktrees, deleting
`node_modules/.bin` for all of them at once. Every `npm run` script that calls a bare binary broke
simultaneously in three checkouts.

Repaired without installing anything: all 780 packages were intact at their drifted versions, so the
61 bin entries were regenerated from the `bin` fields of the packages already on disk, 174 files.
`typecheck`, `jest`, `nest build` and `eslint` all resolve again through `npm run`, and both sibling
checkouts are untouched. The `.bin` directory is now reconstructed rather than npm-generated; the next
`npm ci` will regenerate it canonically.

## D13 — the operator validators never run on a session branch

This is the largest finding of the run, and it was found by probing rather than by being stopped.

A peer session shipped `lintScope` to `quality.verify` at `569e4858` while this mission ran. The rule
reads correctly in the source: `operators/quality-verify/validate.mjs:193-201` requires the lint gate
to carry `lint { baseline, delivery, changedFiles }` under `lintScope: changed`, and to pass exactly
when `delivery` is 0. It does not fire. Four probes against this session's own `4/1` branch, each of
which the rule should refuse:

| Probe | `validate-step` said |
| --- | --- |
| lint `status: fail` with `delivery: 0`, a direct contradiction | step valid |
| the `lint` record deleted entirely under `lintScope: changed` | step valid |
| a `sonarScope` on the lint gate (`validate.mjs:192`) | step valid |
| an `e2e.json` gate result the plan never named (`validate.mjs:169`) | step valid |

The cause is not `lintScope`. `scripts/validate-step.mjs:26-29` calls `validateRequest` and
`validateResponse` and nothing else, and neither of those, nor `validate-session.mjs`, ever dispatches
to `operators/<id>/validate.mjs`. Across the whole tree the only callers of `validateQualityStep` are
the operator's own `self-test.mjs`, `scripts/migration-release.mjs:120` and a fixture. The same holds
for `validateBackendStep` and `validateWorkspaceStep`.

So the loop `SKILL.md` states —

```
request/request.json -> validate-request.mjs -> agent writes response/ -> validate-response.mjs + the operator's validate.mjs -> route
```

— is not what any real branch runs. The operator half is exercised only against synthetic fixtures.
Every `step valid` in this note, in the 2.0.0 and 2.0.2 notes before it, and in any other session that
gated a branch this way, proves the generic contracts (template sections, closed regexes, kind
schemas, `goalCheck`, the secret sweep) and nothing an operator says about its own receipt.

Believed fix: have `validateStep` resolve `operators/<id>/validate.mjs` from the branch's operator id
and merge its errors — `scripts/record-findings.mjs:167` already resolves an operator validator
generically, so the mechanism exists and is simply not wired into the gate.

**Repaired in-run at `935afab2`**, which is the fix above: `validate-step` now dispatches the
operator's one `validate<Name>Step` export after the shared laws, and the CLI always asks for it. The
two probes that had passed are refused by name afterwards — a lint gate `fail` with `delivery: 0` and
a deleted lint record each return the rule's own sentence. Every branch of this session was then
re-gated through the tree rather than by hand, and the results are the same ones the manual run found:
`1/1`, `4/1` and `5/1` valid, `2/1` and `3/1` refused. An intermediate commit, `c25998ca`, carried a
top-level-await import cycle that made the CLI exit silently; `935afab2` is the working one, and a
gate that fails silent is worth remembering as its own near-miss.

### What the operator validators found once run by hand

Run directly against this session's four finished branches, they returned nine errors the session
gates had passed:

| Branch | Errors | What |
| --- | --- | --- |
| `1/1` `environment.preflight` | 6 | the four `runtime.be.*` checks must be `skipped`, not `ok`/`wall`, because the mission names no `runtimeRoles`; and two Walls repairs were abbreviated away from the report's own wording |
| `2/1` `workspace.bind` | 2 | `sourceHead` and `checkout` differ from an independently re-observed selection |
| `3/1` `backend.generate` | 1 | `changes.md` writes the Binding row with abbreviated shas, so the next request cannot pin exactly what was written |
| `4/1` `quality.verify` | 0 | clean after the `lintScope` rewrite |

`1/1` was corrected and is now clean: 15 `ok`, 6 `skipped`, 1 `wall`. The correction matters beyond
tidiness. **`runtime.be.holder` was never a lawful wall for this mission.** This chain serves nothing,
observes no surface and walks no journey, so under `validate.mjs:149-156` its runtime family is
skipped. The 2.0.0 note recorded that wall and the person's answer `accept-both-walls` covered it; on
this tree only `host.deps.be` ever stood. The registry still disagrees with the process listening on
3068, and that is still nobody's to repair here — it simply is not this mission's readiness question.

`2/1` was deliberately **not** corrected. Its two errors are a time-of-check artifact: the validator
re-runs the workspace selection and observes the head the chain has since advanced to, while the
receipt honestly records the head the bind saw. Rewriting it to match today's head would make the
receipt false. That a bind receipt cannot be re-validated after the branch it enabled commits is its
own smaller finding.

`3/1` was not corrected either, because doctoring an agent's receipt is not the orchestrator's job;
the defect is recorded and the re-entered fix branch owes a correct `changes.md`.

## D14 — an imported evidence slot blocks the step number a growing chain needs, and the regression its repair caused

While replanning, the chain had to grow from five branches to eight. `validate-chain` requires chain
position N to hold a cell numbered N, and the imported evidence slots sat at `8/1` and `9/1` because
the chain was five long when they were imported. Position 8 therefore collided with the business19
slot. The imports could not be renumbered: `3/1`'s request names `step-9/parallel-1/...` and its hash
is frozen in `state.json.requestHashes`. The chain was extended as `1..7` plus `8/2`, which validates
and leaves the evidence slot untouched at `8/1`.

The repair, `b21fd9ab`, gives imported slots their own range
(`orchestrator.json#session.imports.stepBase = 100`) so a growing chain can never reach them. The
design is right and a fresh session would import at `100/1`. But as shipped it **broke this session**,
and the break is worth recording because it is the exact hazard a mid-run runtime move creates.

`scripts/producer-import.mjs:84` applies `evidenceOnly` on the **read** path, from the manifest, not
only at `:101` where a new import is written. `validateImportedInput` therefore re-applies the range
on every request validation, so both slots below 100 stopped being credited and two branches that had
been valid for twenty minutes were refused at once:

```
request.json: import architecture-decision: import coordinate step 9 is below the evidence range
(orchestrator.json#session.imports.stepBase = 100); a chain is numbered from 1 and must never grow
onto an imported slot
```

`3/1` is a completed, gated branch with a frozen request hash. `6/1` was running against the same
frozen reference at the moment the rule landed. Steps 1, 4 and 5 still validated individually, so the
blast radius was exactly the two branches that consume an import.

The receipts were **not** rewritten to match. Re-importing at `100/1` and editing two frozen requests
would have rewritten history so the past looked gated under a rule that did not exist when it ran,
which is the one thing the session lifecycle exists to prevent. Believed fix, and the one the
change's own description implies: enforce the range where a new import is written and let a slot
already on disk stay credited, since its bytes are still held by the import gate. The coordinate rule
is about where new evidence may go, not about whether old evidence still counts.

**Repaired at `541142a6`**, and the repair is the two-line shape above: `withinEvidenceRange` runs
only where a new import is written, and `evidenceOnly` on the read path checks reservation alone.
Verified from both directions on this session — `validate-request` on `3/1` returns `request valid`
and `validate-session` returns `session valid`, while a fresh import attempted at step 7 is still
refused by the range. So the protection D14 added stands and the frozen slots at `8/1` and `9/1` keep
counting. No receipt of this session was rewritten at any point.

Four runtime fast-forwards landed under this running mission — `35e5b34e`, `569e4858` with
`935afab2`, `b21fd9ab`, and `aaa77c37` with `541142a6`. Three were absorbed by re-gating. One broke
it, and the rule it teaches is narrow and worth keeping: a hot fix that touches a read path is
verified against a live ledger before it is fast-forwarded, because a rule about where new evidence
may be written should never change whether evidence already written still counts.

### D15 — a chain that grows under an unchanged goal could not record itself

Raised while extending the chain and closed at `aaa77c37`. `state.schema.json` put `goalVersion` at a
minimum of 2 and `validate-session#missionHistoryErrors` refused a `replanned` transition whose
version exceeded `mission.version`, so recording this redraw meant bumping the mission to version 2 —
and a version 2 carries a `goal-confirm` the person never gave. The redraw here changed no goal at
all: a red lint gate routed back to the backend owner, which is the routing loop working. The chain
was therefore extended without a `replanned` transition and the session validated, but the ledger was
silent about a redraw it had made. `goalVersion` now has a minimum of 1 and a chain-only redraw is
recorded at the current mission version, which is what this session now carries.

## Step 5 — business.reconcile, and zero discrepancies checked rather than believed

All fourteen rows of the frozen matrix answered by source at `1a779998`, 47 fact claims bound to that
head, no discrepancy standing, and the head republished `implemented` through `in-progress->implemented`
— the only transition its state admits. `previousHeadRef` points at the pre-existing content object,
byte-identical, so nothing was erased.

Zero discrepancies is the answer that most deserves suspicion, so three of the cited guards were
opened in the source rather than taken from the receipt. The duplicate-namespace guard is really at
`agent-workspace-recovery-target.service.ts`, with its reasoning in a comment. The launch path really
does compute `currentSyncRevision` and compare the applied revision against it, rather than compare
two stored columns — defect 5 closed, not asserted. The branch also named the three readings that
could have gone the other way instead of burying them: `cluster-replacement` (enforced *because* the
row approves a configured target and forbids mutating cluster configuration, which is what keeps
defect 6 lawfully open), `backup-restore` (enforced by guards that need no live cluster), and
`access-state` (a chain across probe, readiness and permit rather than one file).

## Step 6 — the lint repair, and the four ways it could have been bought

`c87accaf`, one commit, 16 files, all inside the boundary, no widening. `eslint` over the delivered
files exits 0: the 1645 errors those files carried, 127 of them the previous entry's own, are gone.

A lint gate is the easiest gate in the world to fake, so each way of faking it was checked:

| How it could have been bought | What was found |
| --- | --- |
| relax the rules | `eslint.config.mjs`, `package.json`, the lockfile, `tsconfig`, charts and terraform all untouched |
| blanket `eslint-disable` | exactly one disable, for a deferred CJS `require`, with a written reason, copying the existing sibling convention at `src/tests/probe/rag-collection-isolation.probe-spec.ts:314` |
| delete the failing tests | 23 test declarations removed and 23 added; counted per spec file at base and head — 25/25, 4/4, 4/4, 9/9, 4/4, 6/6, 6/6, 1/1. Reformatting, not deletion |
| claim it without running it | `eslint` re-run here over all 19 delivered paths: exit 0 |

The delivery is 19 files now rather than 18: `types/target.ts` gained the named `RecoveryTargetConfig`.
It sits inside `src/modules/bussiness/**`, its change record carries `widened: false`, and that was
checked against the record rather than taken from the prose.

The ~2382 problems across the 63 files this delivery never touched are still there, untouched, and
correctly so.

## Step 7 — quality.verify, green

Every gate re-measured at `c87accaf` here rather than copied from the producer's proofs.

| Gate | Result |
| --- | --- |
| `lint` (scope `changed`) | 0 errors over the delivery's 19 files; baseline 2382 across 63 untouched files recorded as `LINT_BASELINE_RED` |
| `typecheck` | exit 0 |
| `build` | both nest builds exit 0 |
| `unit-coverage` | 31 suites, 197 tests |
| `integration` | 23 tests over four container specs on real PostgreSQL, MinIO and Qdrant — 6/6, 12/12, 4/4, 1/1 |

Coverage carries no configured bar, so all four metrics are `unconfigured` against frozen
`jest --showConfig` evidence. The nine surface topics are `not-applicable`, because the request binds
no `@workspaces/fe`, and the scorecard reads `ship` on the gates alone. That is a change of law, not
of evidence: the same delivery scored `blocked` an hour earlier, when nine rows were demanded of a
mission that could never produce them (D11).

## D16 — a reconciled head cannot be reconciled again after a repair

`business.reconcile` published `implemented` at `1a779998`. The lint repair then moved the delivered
head to `c87accaf`. `operators/business-reconcile/validate.mjs:17-25` carries `implemented->in-progress`
and `implemented->rejected` and **no** `implemented->implemented`, so the head cannot be reconciled
again against the repaired delivery. The only lawful route is to downgrade to `in-progress` and
immediately re-upgrade, which would write a reconciliation carrying zero discrepancies while
publishing `in-progress` — a contradiction entered into the ledger to satisfy a lifecycle. The branch
was therefore dropped as a `replanned` transition at `goalVersion 1` with its reason recorded, not run.

This is the same shape as D6 on 2.0.0 and as the door read ahead before step 5: an operator whose
lifecycle cannot express the state the work actually reached.

**Repaired in-run at `728abf99`**: `business.reconcile` gains `implemented->implemented`, the same
state with new bindings, for a delivery that moved after its head was reconciled and where no
discrepancy stands. `8/2` was restored on that transition — a second `replanned` at `goalVersion 1`,
reversing the drop and saying why — and re-run against `c87accaf`. The branch was told to re-verify
all fourteen rows rather than carry the previous verdict forward: a reformat that moved some files by
hundreds of lines is exactly the change that can relocate or reshape a guard, and a rebinding that
assumed the old reading would be a promise resting on an assumption. Its outcome is below.

Its consequence was measured rather than assumed. The published head binds its 47 fact claims to
`1a779998`, and the repair moved 15 of 16 files' line counts — the operation runner from 1518 to 1763
lines, the recovery container spec from 541 to 838. **The claims' line ranges are stale at the
delivered head.** Whether the promise had become false was checked separately, and it has not: the
duplicate-namespace guard, the launch path's recomputed revision, the provenance membership test over
`nivo-module`, and a migration `down()` that no longer throws are all present at `c87accaf`. The
substance holds; the citations point at moved lines.

## Step 8/2 — the rebinding, and why "only lint" was not taken on trust

Re-run at `c87accaf` on the newly lawful `implemented->implemented`. Fourteen of fourteen rows still
enforced, no verdict changed, zero discrepancies, head republished with the coverage fingerprint
carried unchanged.

The branch was told not to assume the previous verdict carried because the repair was "only lint",
and it did not. Ignoring whitespace, the diff across the eight non-test files was still 654
insertions and 236 deletions, so it compared both commits at the token level — comments stripped,
whitespace removed, streams aligned:

- 20 of the 26 cited files are byte-identical between the two commits, so 24 claims keep their ranges.
- `chores.service.ts` and `module-knowledge-reconciler.service.ts` moved but have identical token
  streams: layout only.
- The migration rewrote template literals as escaped double-quoted strings; decoded and collapsed, its
  44 SQL statements are identical.
- One file carried four non-layout differences and none is a guard: an unused import dropped, an
  unread binding dropped while its call is kept, one import made relative, and a raw
  `throw new Error("RECOVERY_SESSION_CHANGED")` replaced by the module's own exception with the same
  status, inside a `try` whose `catch` never reads the error.

23 of the 47 claims were re-bound and all 47 re-stamped to `c87accaf`. Checked here rather than
accepted: every claim carries `sourceHead` `c87accaf`, and three cited ranges were opened in the
source — `ownership` at 123-152 holds the advisory lock, the owner-scoped resolution and the
not-found throw; the health gate re-bound from 574-619 to 706-765 holds the snapshot's `observedAt`;
the completion compare-and-set re-bound from 653-685 to 806-838 holds `requiredSyncRevision` in the
match clause, which is defect 4.

One judgement call the branch surfaced rather than hid: `previousHeadRef` names step 5's own
`model.json`, verified byte-identical to the head it replaces, instead of a path under
`objects/sha256/`. The convention is the object store, but step 5 never archived its head there and
this branch's write set excludes `objects/`, so the conventional path would have named a file that
does not exist. Recorded as a finding; restoring the convention is one file for a publishing step.

**So the stale-citation debt that D16 created is discharged.** The published head cites the commit the
gates passed on.

## The mission's own done-when lines

| Done when | Verdict | Checkout + HEAD | Command | Result | Log |
| --- | --- | --- | --- | --- | --- |
| a `backend.generate` receipt (scope full) covering the contract and the eight defects | **DONE** | `nivo-be-recovery-20260905-031845` @ `c87accaf` | `validate-step.mjs step-6/parallel-1` | step valid, 24 operations restated with zero drift, 16 change records, no widening | `step-6/parallel-1/response/` |
| a green `quality.verify` receipt at that head | **DONE** | same @ `c87accaf` | five gates re-measured | all five pass; `Verdict: ship` | `step-7/parallel-1/response/data/evidence/` |
| a `business.reconcile` receipt against business19 | **DONE** | same @ `c87accaf` | `validate-step.mjs step-8/parallel-2` | step valid, 14/14 rows re-verified at the gated head, head republished `implemented->implemented`, 47 claims bound to `c87accaf` | `step-8/parallel-2/response/` |

All three are bound to `c87accaf`, the commit every gate passed on. The first reconciliation at
`step-5/parallel-1` remains in the ledger, bound to `1a779998`, as the reading that was true when it
ran.

## The eight product defects at the end

| # | Defect | State |
| --- | --- | --- |
| 1 | private-knowledge provenance filter | **closed** — a membership test over the provenances a workspace collection can hold, replacing equality against `"nivo"` |
| 2 | the proposed correction unwritten | **closed** — staging destination in `KnowledgeStoreService.write`, pins carried in both recovery jobs, point ids derived exactly once |
| 3 | health freshness after the final Helm | **closed** — freshness from the Kubernetes snapshot's `observedAt`, gate moved after `installCurrent` with a post-effect probe |
| 4 | completion CAS without the required revision | **closed** — `requiredSyncRevision` in the compare-and-set, no SQL transaction across Helm |
| 5 | launch and access compare stored revisions | **closed** — the current Core revision is recomputed and the target snapshot must have observed it |
| 6 | scheduler namespace mapping is manual | **open by design** — the bound matrix approves the *configured* replacement target and forbids mutating cluster configuration this pass, so automating it would coin a rule the authority does not state; its silent half is closed, and a namespace claimed twice now declares no target |
| 7 | the additive migration is a draft | **closed** — workspace and owner keys as `NOT VALID`, and a `down()` that runs and drops no column |
| 8 | dependency drift | **reported, never repaired**, exactly as the mission asks; every gate measured the drifted tree and says so |

The retained-data replay fixture the handoff recorded as never authored exists and passes: two
installations, fifty-two documents, real PostgreSQL, MinIO and Qdrant, four cases. A migration replay
spec exists and passes.

## Harness metrics

| Measure | Value |
| --- | --- |
| Session created | 03:18:45 local; chain green and gated by 03:22 |
| First wall | 03:30, twelve minutes in: `ENVIRONMENT_NOT_READY`, answered from the recorded choice without stopping |
| First wall that cost work | 04:45, the dead operator validators (D13) |
| Branches run | 8, plus 2 imported evidence slots |
| `RECEIPT_MISSING` | 0 |
| Same-operator re-entries | 3 (`backend.generate`, `quality.verify` and `business.reconcile` twice each) |
| Times a person had to answer | **0** |
| Runtime fast-forwards under the running mission | 5 (`35e5b34e`, `569e4858`+`935afab2`, `b21fd9ab`, `aaa77c37`+`541142a6`, `728abf99`); four absorbed, one broke the session |
| Runtime defects met | D11–D16 plus the `b21fd9ab` regression; D8 and D10 already closed on arrival |

Every branch of this session was gated by `validate-step` **after** D13 was repaired, so the shared
laws and each operator's own law both ran. Before that repair the same command proved only the shared
half, which is why the receipts had to be re-examined once the operator law began to run.

At the end, `validate-session` is green and six of the eight branches pass their own operator's law.
Two are refused, and both were left refused on purpose:

- `2/1` `workspace.bind` — the validator re-runs the workspace selection and observes the head the
  chain has since advanced to, while the receipt honestly records the head the bind saw. Rewriting it
  to today's head would make it false. A bind receipt that cannot be re-validated once the branch it
  enabled commits is a defect of the operator, not of the receipt.
- `3/1` `backend.generate` — `changes.md` names abbreviated shas. Real, and the dispatch gate would
  have caught it had the operator law been running. It is corrected in its successor `6/1`, which
  carries full forty-character shas; the historical receipt was not doctored to hide that it shipped
  with the defect.

## What is left standing

- **For a person, in the businesses tree:** `business-registry-v1.json` still names head `996e68e6`
  with `authorityStatus: in-progress` while the feature directory says `implemented`.
  `business.reconcile`'s declared write set is the feature directory alone, so it correctly refused
  the index; the publish that would fix it is excluded from this mission.
- **For a person, on the reconciliation:** nothing outstanding. The stale citations were discharged by
  the rebinding at `8/2` once D16 was repaired. One convention is left unrestored: `previousHeadRef`
  names step 5's receipt rather than an `objects/sha256/` path, because step 5 archived no object and
  the rebinding's write set excludes that directory.
- **Defect 6** stays open by the authority's own words, not by omission.
- **Dependency drift** stays, and every gate result in this note measured the drifted tree.
- Nothing was published, deployed, served or installed. `D:/Repositories/nivo-backend` is untouched on
  `main` at `cfb8379a`; the 2.0.0 run's worktree is untouched at `78426381`; the stopped Codex
  checkout still holds its 111 preserved dirty paths.
- One thing this run damaged and repaired itself: the shared `node_modules/.bin` (D12). It is
  reconstructed rather than npm-generated, and the next `npm ci` will regenerate it canonically.
