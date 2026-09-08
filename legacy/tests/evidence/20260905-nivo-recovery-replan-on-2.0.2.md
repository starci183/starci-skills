# Replanning the Nivo workspace auto-recovery mission on StarCi Skills 2.0.2

Proof that the seven doors the 2.0.0 rerun met (`.claude/tests/evidence/20260905-nivo-recovery-on-2.0.0.md`,
sections D1–D7) are open on the 2.0.2 candidate. The same confirmed mission, the same three done-when
lines, the same two frozen decisions, replanned on the new tree. Nothing was dispatched, no product
command ran, and no product source was read or written.

- Runtime under test: `D:/Repositories/starci-academy-backend/.claude-2.0.2`, branch `release/2.0.2`,
  head `bc5eb704`. The tree was not edited except for this file.
- Live 2.0.0 runtime, used only as the negative control: `<Source>/.claude` at `4b622b09`.
- Replan session, kept on disk:
  `<Source>/.worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2/`.
- Frozen producers, read-only: `20260904-042654-nivo-frontend.direction.decide` step 19 parallel 1
  (`business.decide`) and step 21 parallel 1 (`architecture.decide`).

Every command below was run from the host repository root.

## 1. The session

`state.json` was written first, as `SKILL.md` step 4 prescribes: the mission block copied verbatim
from the stopped session's confirmed mission (goal, includes, excludes, and the three done-when lines
`backend.generate`, `quality.verify`, `business.reconcile`), the goal choice
`goal:20260905-025001-nivo-recovery-replan-on-2.0.2:v1` recorded `as-stated` with the same
`user-message:` sourceRef the old session used, route 1's choice
`preflight-walls:20260905-025001-nivo-recovery-replan-on-2.0.2:v1 = accept-both-walls` with its own
sourceRef, the brief, and `budget` copied from `resources/orchestrator.json#budget`
(`maxSteps 24`, `maxSameOperator 4`).

The chain field was written provisionally (`[["1/1"]]`, `environment.preflight`) because the import
gate reads the target session's `state.json` before the plan can be drawn — see D10 below.

## 2. The imports

```
$ node .claude-2.0.2/scripts/producer-import.mjs 20260904-042654-nivo-frontend.direction.decide 19 1 20260905-025001-nivo-recovery-replan-on-2.0.2 8 1
{"target":"D:\\Repositories\\starci-academy-backend\\.worktrees\\sessions\\20260905-025001-nivo-recovery-replan-on-2.0.2\\step-8\\parallel-1","files":8,"sourceSessionId":"20260904-042654-nivo-frontend.direction.decide"}
exit=0

$ node .claude-2.0.2/scripts/producer-import.mjs 20260904-042654-nivo-frontend.direction.decide 21 1 20260905-025001-nivo-recovery-replan-on-2.0.2 9 1
{"target":"D:\\Repositories\\starci-academy-backend\\.worktrees\\sessions\\20260905-025001-nivo-recovery-replan-on-2.0.2\\step-9\\parallel-1","files":7,"sourceSessionId":"20260904-042654-nivo-frontend.direction.decide"}
exit=0
```

architecture21 is the one that was refused on 2.0.0 (D5), because its `response.json` carries
`"next": ["backend.source.apply"]`, a 1.x operator id. It imports on 2.0.2:
`scripts/producer-import.mjs:56` calls `validateResponse(..., {origin: true})`, and the origin flag
exempts `next` — routing history of the tree that ran it, not an output.

## 3. The plan

```
$ node .claude-2.0.2/scripts/plan-chain.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2 --roles be
[1/1 environment.preflight] goal: prerequisite: 2/1
[1/1 environment.preflight] opens the chain: backend.generate, business.reconcile hold git, sourcewrite · roles=["be"]
[2/1 workspace.bind] goal: prerequisite: 3/1
[2/1 workspace.bind] binds @workspaces/be, which backend.generate requires; binds @workspaces/be, which business.reconcile requires; binds @workspaces/be, which the mission declares · role="be"
[3/1 backend.generate] goal: doneWhen:0 backend.generate receipt kind backend-source-application, kèm changes, mutations, conformance, proof, phủ hợp đồng recovery và tám lỗi
[3/1 backend.generate] evidence for done-when 0: "backend.generate receipt kind backend-source-application, kèm changes, mutations, conformance, proof, phủ hợp đồng recovery và tám lỗi"; produces backend-source-application, which business.reconcile requires
[3/1 backend.generate] architecture-decision imported from 20260904-042654-nivo-frontend.direction.decide step 21 (step-9/parallel-1/response/response.md)
[4/1 quality.verify] goal: doneWhen:1 quality.verify receipt xanh tại đúng head đó
[4/1 quality.verify] evidence for done-when 1: "quality.verify receipt xanh tại đúng head đó"
[5/1 business.reconcile] goal: doneWhen:2 business.reconcile receipt đối chiếu source đã giao với lời hứa của business19
[5/1 business.reconcile] evidence for done-when 2: "business.reconcile receipt đối chiếu source đã giao với lời hứa của business19"
ends: user
exit=0
```

The JSON block the same call printed carried `presets {"1/1": {"roles": ["be"]}, "2/1": {"role": "be"}}`,
`imports {"3/1": {"architecture-decision": {...cell "9/1", sourceStep 21}}}`, and
`dropped ["business.reconcile → backend.generate (optional model) would close a cycle",
"business.reconcile → backend.generate (Next) would close a cycle"]`.

This is exactly the shape the 2.0.0 note's replan asked for:
`environment.preflight → workspace.bind#be → backend.generate (scope full) → quality.verify →
business.reconcile`, with the frozen architecture credited as imported and **no** `business.decide`
and **no** `architecture.decide` branch.

One correction to that note. It expected `business-promise-authority` to be credited as imported too.
It is not, and should not be: no operator of this chain declares that kind as an Input.
`business-promise-authority` is an optional Input of `backend.plan`, `interface.plan` and
`interface.generate` only; `business.reconcile` reads the published promise through its Context row
`@worktrees/businesses/<featureId>`, not as an Input. business19's import remains lawful evidence in
the session, but it is bound by no branch, so the planner prints nothing for it.

`state.json` was then rewritten with the plan's `chain`, `steps` and
`planned["1/1"].requirements.roles = ["be"]`, `planned["2/1"].requirements.role = "be"`.

## 4. The gates, before any request existed

```
$ node .claude-2.0.2/scripts/validate-chain.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2
3/1: backend.generate requires input architecture-decision, which no earlier step produces and no imported slot the request names supplies
exit=1

$ node .claude-2.0.2/scripts/validate-session.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2
3/1: backend.generate requires input architecture-decision, which no earlier step produces and no imported slot the request names supplies
exit=1
```

Read this failure carefully, because it proves two different things at once.

- The **bind half of D3 is closed**: with zero requests on disk, the gate said nothing about
  `@workspaces/be` being unbound. It read the role from `state.json.planned`
  (`scripts/validate-chain.mjs:189`).
- A **new defect of exactly the same shape** appears for an imported input: the plan knows the import
  (`plan.imports["3/1"]`) and the gate cannot see it until the consuming branch's request is written.
  Recorded as D8 below.

## 5. Step 1's request, and the workaround D8 forces

`step-1/parallel-1/request/request.json` was written as the orchestrator would — the preflight, with
`requirements` carrying the planned `roles: ["be"]`, `project nivo`, `env dev`, `flow null`, the five
Context aliases `environment.preflight` declares, `goal {"prerequisite": "2/1"}` — and its hash
recorded in `state.json.requestHashes["1/1"]`.

```
$ node .claude-2.0.2/scripts/validate-request.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2/step-1/parallel-1
request valid
exit=0
```

The chain was still refused at 3/1 after that, so `step-3/parallel-1/request/request.json` was written
ahead of its dispatch — the same workaround the 2.0.0 run had to use for D3, now needed for the
import. It names `inputs["architecture-decision"] = "step-9/parallel-1/response/response.md"`,
`featureId agentos-workspace-recovery`, `mode apply`, `scope full`, and the owner boundary the stopped
session declared.

```
$ node .claude-2.0.2/scripts/validate-chain.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2
chain valid
exit=0

$ node .claude-2.0.2/scripts/validate-session.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2
session valid
exit=0

$ node .claude-2.0.2/scripts/validate-request.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2/step-3/parallel-1
request valid
exit=0
```

Nothing was dispatched. No response exists in this session and none was written.

## 6. The verdict on D1–D7

| # | Door on 2.0.0 | On 2.0.2 | The line of proof |
| --- | --- | --- | --- |
| D1 | a mission needing `architecture-decision` but promising no business head cannot be planned | CLOSED | `plan-chain --roles be` returned the five-branch chain, exit 0 (§3); the same mission on `.claude` at `4b622b09` still refuses with the D1 wording (§7a). Two independent repairs close it: `operators/workspace-bind/operator.md` now carries the Next row "the route is bound and a boundary must be decided inside it → `architecture.decide`", and — the one that applies here — an imported slot counts as a producer, so no `architecture.decide` branch is added at all (`scripts/plan-chain.mjs:122`) |
| D2 | an imported producer can never satisfy a required Input | CLOSED | `validate-chain` credits the kind through `readImportedInputs` → `validateImportedInput` (`scripts/validate-chain.mjs:248-259`, guard at `:159`): "chain valid" with `import.json` present, and the same chain refused the moment `import.json` is deleted (§7c) |
| D3 | a chain cannot validate until every later bind branch's request already exists | CLOSED (for the bind role) | with zero requests on disk the gate raised exactly one error and it was not about `@workspaces/be`; the role came from `state.json.planned` (`scripts/validate-chain.mjs:189`, `templates/step/state.schema.json:124`). The identical problem survives for an imported input — D8 |
| D4 | `gitPolicy` documented as a list, compared as an object | CLOSED | `operators/workspace-bind/operator.md:102` types it "object `{worktreeBranches, mutationBranch}`", and `scripts/workspace-checkout.mjs#gitPolicyErrors` names both the field and the shape: a list yields "request.json: gitPolicy.worktreeBranches is absent because gitPolicy is a list, not the object {worktreeBranches, mutationBranch} the route declaration carries; it differs from the declared route (session-only)" (and the same for `mutationBranch`), while the declared object yields `[]` |
| D5 | a 1.x producer bundle cannot be imported at all | CLOSED at the import gate | architecture21, whose `next` names the retired `backend.source.apply`, imported with exit 0 (§2); `scripts/producer-import.mjs:56` revalidates the origin with `{origin: true}`. It is **reopened on one conditional path** — D9 |
| D6 | the forced `business.decide` branch has no lawful work and the chain dies there | CLOSED | `business.decide` is not in the chain (§3). `LIFECYCLE_TRANSITION_INVALID` cannot occur, because nothing asks the already-`in-progress` promise to transition. Route 2 of the 2.0.0 note therefore does not arise |
| D7 | no `Next` table reaches any plan operator, so the fan-out law is unreachable | CLOSED | `scripts/validate-operator.mjs#checkReachability` returns 0 errors over all 23 operators from `environment.preflight`; `backend.plan` and `data.plan` now exist beside `interface.plan` and `uat.plan`; `workspace.bind` hands to `interface.plan` and `data.plan`, `quality.verify` hands to `uat.plan` |

## 7. Negative controls

Each ran in its own throwaway session under the same folder prefix, and each was deleted afterwards.

### (a) The same mission on the live 2.0.0 runtime — the door was really closed

Session `…-control-a` carried the identical mission block and no imports.

```
$ node .claude/scripts/plan-chain.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2-control-a --roles be
architecture.decide could run next, and no Next table of workspace.bind permits any of them
exit=1
```

Verbatim the D1 refusal, at `.claude` head `4b622b09`.

### (b) A dispatched bind whose role left the plan

Session `…-control-b` carried the same `planned["2/1"].requirements.role = "be"` and a
`workspace.bind` request asking for `role: "fe"`.

```
$ node .claude-2.0.2/scripts/validate-request.mjs .worktrees/sessions/20260905-025001-nivo-recovery-replan-on-2.0.2-control-b/step-2/parallel-1
request.json: requirements.role is "fe" and the plan fixed it as "be" (state.json.planned); the chain was validated on the planned value, so the dispatched request carries it
exit=1
```

The refusal names the plan, as D3's repair promises.

### (c) The import with its manifest removed

Session `…-control-c` was a fresh session with architecture21 imported at 9/1 and the same 3/1 request.

```
$ node .claude-2.0.2/scripts/validate-chain.mjs …-control-c
chain valid
exit=0

$ rm …-control-c/step-9/parallel-1/import.json
$ node .claude-2.0.2/scripts/validate-chain.mjs …-control-c
3/1: backend.generate requires input architecture-decision, which no earlier step produces and no imported slot the request names supplies
exit=1
```

The kind is credited only through the import manifest and the import gate, never from the copied bytes
alone.

## 8. New runtime defects met on 2.0.2

Each was met by following the tree, not by looking for it. None was repaired: nothing under
`.claude-2.0.2/` was edited except this file.

### D8 — the chain gate cannot learn an imported input from the plan

`scripts/validate-chain.mjs:159` credits a required kind from an imported slot only through
`options.imported`, and `readImportedInputs` (`:248`) builds that map from `byBranch` — the requests
written on disk. `state.json.planned` (`templates/step/state.schema.json:124`) carries only
`requirements`, so the plan's own `imports` map, which `scripts/plan-chain.mjs` computes and prints
(`plan.imports["3/1"]`), reaches the gate nowhere. A chain drawn before step 1, exactly as `SKILL.md`
step 3 and `workflows/README.md` require, therefore fails on any branch whose required input is
imported, and the only way to make it validate is to write a later branch's request ahead of its
dispatch — the same manoeuvre D3 was raised for and 2.0.2 fixed for a bind's role.

This is the one defect that keeps a fresh 2.0.2 session from being green from its first transition.

Believed fix: write the plan's `imports` into `state.json.planned["N/M"].inputs` when the chain is
drawn, and let `validateChain` credit a kind from there when the branch's request is not yet written,
mirroring the bind's role at `scripts/validate-chain.mjs:189`. The import gate stays the authority on
the bytes, exactly as it is today for a written request.

### D9 — `migration-contract` revalidates a foreign origin with today's catalogue, reopening D5

`scripts/migration-contract.mjs` resolves an imported architecture producer back to its original
session (`:118-124`) and then runs `validateArchitectureStep(producer, root)` (`:128`) — with no
`origin` flag, unlike `scripts/producer-import.mjs:56`. On this mission the path is reachable by
binding `requirements.contractFingerprint`, which the operator's own Requirements row invites
("SHA-256 of the producer stack-model bytes; the orchestrator binds it for a standalone migration
contract"), and it produces, among others:

```
migration producer: step-21/parallel-1/response/response.json: next names unknown operator backend.source.apply
migration producer: state.json: the mission's goal is not confirmed: doneWhen "…" names backend.source.apply, which is not an operator
migration producer: state.json: the mission's goal is not confirmed: doneWhen "…" names frontend.source.apply, which is not an operator
migration producer: request.json: contexts[3].alias @workspaces/nivo/chart is covered by no Context row of architecture.decide
migration producer: response/response.json: the objective is restated and the request records no choice on restatement:agentos-workspace-recovery, so the branch ends blocked with RESTATEMENT_UNCONFIRMED, not done
```

The first line is D5 verbatim; the rest judge a 1.x session's mission block, contexts and restatement
protocol by 2.0.2 law. The origin cannot be edited — it is another session's frozen evidence.

This mission is not blocked by it: architecture21's `stack-model.json` declares 24 operations and
**zero** with `transport: "migration"`, so the contract is inactive and the orchestrator must not bind
`contractFingerprint`. The request in the session therefore carries `contractFingerprint: null` and is
valid. But any imported architecture producer that does declare a migration operation activates the
path unconditionally (`:85`, `:87`), and every 1.x producer will then be refused.

Believed fix: thread the same origin exemption `producer-import.mjs` uses through
`migration-contract.mjs:128` (and through the `metadata`/`validateArchitectureStep` pair) when the
producer was reached via an `import.json`, so a foreign origin is judged on its declared outputs and
bytes and never on its routing history, its mission block or its session protocol.

### D10 — a plan needs the imports, and an import needs the state file

`scripts/producer-import.mjs#evidenceOnly` reads the target session's `state.json` before it will
copy anything, and `templates/step/state.schema.json` makes `chain` required with `minItems 1`. But
`plan-chain` cannot draw the chain until the imported slots exist. The orchestrator must therefore
write a provisional chain, import, plan, and rewrite — three writes to `state.json` that no lifecycle
text describes. Minor, and it costs nothing but a reader's confidence that the ledger was written once.

Believed fix: say so in `resources/orchestrator.json#session.lifecycle`, or let `evidenceOnly` accept
a session whose `state.json` has no chain yet.

## 9. What a person must still decide before this mission can run on 2.0.2

Nothing.

- Route 1 (`ENVIRONMENT_NOT_READY` on `runtime.be.holder` and `host.deps.be`) has its answer on record
  in this session as `preflight-walls:…:v1 = accept-both-walls`, carried forward with the same
  reasoning the 2.0.0 note gives: the confirmed mission excludes both repairs in its own words.
- Route 2 (`LIFECYCLE_TRANSITION_INVALID` at `business.decide`) does not occur. There is no
  `business.decide` branch in the chain, so there is nothing to script an answer for — which is the
  outcome the 2.0.0 note predicted for a fixed tree.
- D8 costs the orchestrator one extra write (step 3's request ahead of its dispatch); it is not a
  question for a person.
- D9 does not fire on this mission, because the frozen contract declares no migration operation.

The mission is runnable end to end on 2.0.2 from this session's plan, with the stopped session's
worktree at `78426381` and its six baseline gate logs as the before-state.

## 10. What this run did not prove

- No branch was dispatched, so no operator's Steps were executed and no receipt exists. `backend.generate`,
  `quality.verify` and `business.reconcile` are still NOT TESTED against this mission's done-when lines.
- The tree's own `npm test` was not run: another agent was editing `operators/library-update/**` in the
  same worktree during this run, and a red suite from that package would have said nothing about the
  doors under test.
- D9 was demonstrated by activating the migration contract deliberately (binding `contractFingerprint`
  on a contract that has no migration operation). It was not observed on a producer that genuinely
  declares one, because none of the frozen producers does.
