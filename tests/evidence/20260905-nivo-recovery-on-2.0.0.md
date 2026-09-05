# Rerunning the Nivo workspace auto-recovery mission on StarCi Skills 2.0.0

A live proof run of the rebuild: a stopped Codex mission of the 1.7–1.9 tree, rerun on 2.0.0 by an
Opus processor, with the harness measured while it ran.

- Mission: the OUTER AgentOS workspace auto-recovery backend, frozen by business19 and
  architecture21 of session `20260904-042654-nivo-frontend.direction.decide`.
- Runtime under test: `.claude` at `4b622b09` (2.0.0).
- Session: `.worktrees/sessions/20260905-015806-nivo-environment.preflight`.
- Product checkout: `D:/Repositories/nivo-be-recovery-20260905-015806`, branch
  `session/20260905-015806-nivo-environment.preflight`, based on `aba9c978`.

## Runtime defects met while running

Each was met by following the tree, not by looking for it. None was repaired: nothing under
`.claude/` was edited except this file.

### D1 — a mission that needs an architecture decision but promises no business head cannot be planned

`node scripts/plan-chain.mjs <session> --roles be` refuses the confirmed mission with:

```
architecture.decide could run next, and no Next table of workspace.bind permits any of them
```

`backend.generate` requires the `architecture-decision` input (`operators/backend-generate/operator.md:181`),
whose only producer is `architecture.decide`. `architecture.decide` is named in exactly one Next
table in the whole tree, `operators/business-decide/operator.md:195`. So the planner can reach it only
through `business.decide`, and `business.decide` enters a chain only when a done-when line names it.
A mission whose done-when lines are `backend.generate`, `quality.verify` and `business.reconcile` —
the ordinary shape of "implement what was already decided" — is therefore unplannable. Adding a
fourth done-when line naming `business.decide` makes the same planner succeed, which is how the root
cause was isolated.

Believed fix: give `workspace.bind` a Next row for `architecture.decide` ("the route is bound and a
boundary must be decided inside it"), the same way it already has one for `business.decide`.

### D2 — an imported producer can never satisfy a required Input

`SKILL.md` offers `scripts/producer-import.mjs` for cross-session evidence and says to use the
normal `step-N/parallel-M/response` input path. But `scripts/producer-import.mjs#evidenceOnly`
refuses any target coordinate that `state.json.chain`, `steps`, `requestHashes`, `current` or
`leases` names, while `scripts/validate-chain.mjs:144` builds its `produced` set only from the graph
outputs of chain cells. An imported `architecture-decision` therefore sits at a coordinate the chain
gate cannot see, and `backend.generate` is refused with `requires input architecture-decision, which
no earlier step produces`. The two mechanisms contradict: the mission instruction "import them rather
than re-deciding" cannot be carried out for a required input.

Believed fix: let `validate-chain` credit a kind whose imported bundle is referenced by a branch's
`request.json.inputs` and validated by `validate-request#validateImportedInput`.

### D3 — a chain cannot validate until every later bind branch's request already exists

`scripts/validate-chain.mjs:145` reports `@workspaces/<role>` unbound unless an earlier
`workspace.bind` branch's `request.json` exists on disk with `requirements.role`, but
`resources/orchestrator.json#session.lifecycle` writes a branch's request only when the branch is
dispatched. A chain drawn before step 1, as `SKILL.md` step 3 requires, therefore fails
`validate-session` from its first transition. Writing step 2's request ahead of its dispatch is what
made the session valid.

### D4 — `gitPolicy` is documented as a list and compared as an object

`operators/workspace-bind/operator.md` Requirements types `gitPolicy` as a "list of
`{worktreeBranches, mutationBranch}`". `scripts/workspace-checkout.mjs:156` compares
`requirements.gitPolicy.worktreeBranches` and `.mutationBranch` directly, so a list is refused with
`request.json: requested Git policy differs from the declared route`, naming neither the shape nor
the field.

### D5 — a producer bundle from an earlier major version cannot be imported at all

`node scripts/producer-import.mjs 20260904-042654-nivo-frontend.direction.decide 21 1 <target> 4 2`
is refused with:

```
origin response fails its typed output gate: step-21/parallel-1/response/response.json: next names unknown operator backend.source.apply
```

`scripts/producer-import.mjs#originAuthority` revalidates the origin bundle with today's
`validate-response.mjs`, and `backend.source.apply` is a 1.x operator id that 2.0.0 retired into
`backend.generate` (the lineage note in `INDEX.md` says so). Every 1.x producer whose receipt names a
renamed operator in `next` is therefore unimportable, and the origin cannot be edited because it is
another session's frozen evidence. business19 imported cleanly; architecture21 could not, so the
frozen architecture had to be re-emitted in 2.0.0 shape by an `architecture.decide` branch of this
session instead of imported.

Believed fix: `originAuthority` should validate the origin against the operator catalogue of the tree
that produced it, or exempt the `next` field, which is routing history and not an output.

### D6 — the forced `business.decide` branch has no lawful work, and the chain dies there

Because of D1 the chain had to carry a `business.decide` branch purely to reach `architecture.decide`.
The promise `agentos-workspace-recovery` was already decided and published `in-progress` by the
stopped session, so the branch refused, correctly and on two independent grounds
(`step-3/parallel-1/response/response.json`):

- `in-progress -> in-progress` is not one of the eight entries of `LEGAL_TRANSITIONS` in
  `operators/business-decide/validate.mjs`; publishing would require naming the older `pending` object
  as `previousHead`, erasing the current head from the lineage the operator exists to preserve. The
  operator's own validator would have accepted that, because it checks lineage for internal
  consistency and never against the head on disk.
- Re-binding the frozen promise's fact claims to a head that now carries the delivered recovery source
  is `business.reconcile`'s job, which `operators/business-decide/operator.md` reserves explicitly.

`LIFECYCLE_TRANSITION_INVALID` has domain `caller`, which `routing.json` routes to `user`. So on
2.0.0 a mission of the shape "implement a promise that is already decided" is structurally
unreachable: the only route to the frozen architecture runs through an operator that must refuse.

### D7 — no `Next` table reaches any plan operator, so the fan-out law cannot be exercised

Checked after a peer session pointed at it, and confirmed on this head: no `## Next` table of any of
the 21 operators names `interface.plan` or `uat.plan`, and `backend.plan` does not exist. But
`scripts/validate-chain.mjs` refuses a step holding an operator that no Next table of the step before
permits. So the plan-then-fan-out law that `SKILL.md` and `workflows/README.md` both state, one unit
per branch after a `<domain>.plan`, is unreachable for every domain: the two plan operators that do
exist can never be placed in a chain, and a mission naming an execute operator on more than one
done-when line has no way to expand.

This mission was not bound by it, because its done-when lines name `backend.generate` once, so one
branch with `scope: full` over the whole contract was the right shape anyway. It is the same root
cause as D1: an operator the tables can reach from nowhere.


## Harness metrics

| Measure | Value |
| --- | --- |
| Start of the run | 01:52 local, session created 01:58:06 |
| First wall | ~01:56, about four minutes in: `plan-chain` refused the mission (D1) |
| Second wall | 02:17:25, `business.decide` blocked with `LIFECYCLE_TRANSITION_INVALID` (D6) |
| Steps written | 4 branches (`1/1`, `2/1`, `3/1`, and `4/1`'s request) of a 7-branch chain |
| Branches dispatched | 3 |
| `RECEIPT_MISSING` | 0 |
| Same-operator re-entries | 0 |
| Times the chain routed to a person | 2 (`ENVIRONMENT_NOT_READY`, `LIFECYCLE_TRANSITION_INVALID`) |
| Times a person actually answered | 0; the first was resolved from the mission text, the second stands |
| Runtime defects met | 7, all above |

The 2.0.0 promise held on one count and failed on another. It held on speed of discovery: the first
wall arrived in about four minutes, against the 1.x pattern of meeting walls hours apart, and
`environment.preflight` returned all twenty-one checks in one pass. It failed on reachability: three of
the seven defects (D1, D6 and D7) are not slow walls but closed doors, and no amount of preflight helps a
chain the tables cannot draw.

## What the product source actually does, measured

Every command below ran in `D:/Repositories/nivo-be-recovery-20260905-015806` at head
`7842638183f82a75158d4e1f585ed575d405ca8e`, whose only content beyond `aba9c978` is the verbatim
carry-forward of the 110 preserved paths. `node_modules` is a junction to the stopped session's own
installed tree, so these numbers describe the same drifted dependency set the handoff recorded; no
dependency was installed.

| Command | Result | Log |
| --- | --- | --- |
| `npm run typecheck` | exit 0, no diagnostics | `diagnostics/baseline-typecheck.log` |
| `npm run build:cli` | exit 0 | `diagnostics/baseline-build-cli.log` |
| `npm run build:controlplane` | exit 0 | `diagnostics/baseline-build-controlplane.log` |
| `npm run test:unit -- --runInBand --testPathPattern=<the handoff's filter>` | 31 suites, 189 tests, all passed | `diagnostics/baseline-unit.log` |
| `npm run test:container -- …agent-workspace-recovery.container-spec.ts` | 6 of 6 passed | `diagnostics/baseline-container-recovery.log` |
| `npm run test:container -- …agent-workspace-operation-runner.service.container-spec.ts` | 12 of 12 passed | `diagnostics/baseline-container-runner.log` |

The handoff's last recorded filtered run was 31 suites and 188 units before later changes; the carried
draft is at 189 and no suite regressed.

## The eight open defects, read at this head

Read-only inspection by the orchestrator, not an operator receipt. No fix was written.

| # | Defect | Verdict | Where |
| --- | --- | --- | --- |
| 1 | private-knowledge provenance filter | reproduced | the replay filter demands `metadata.source === "nivo"` at `module-knowledge-reconciler.service.ts:482`; the only publisher writes `"nivo-module"` at `module-knowledge-artifact.service.ts:161`, so every private point is dropped on replay |
| 2 | the proposed correction | still unwritten | no staging destination exists in the knowledge store write path |
| 3 | health freshness after the final Helm | reproduced | `agent-workspace-operation-runner.service.ts:569` takes freshness from telemetry `runtime.reportedAt`, not the Kubernetes snapshot's own `observedAt`, and the whole health gate at line 601 runs before `installCurrent` at line 628 |
| 4 | completion CAS without the required revision | reproduced | the final `update` matches on id, status, stop intent, intent revision, target generation, executor, operation and attempt sequence, and not on `requiredSyncRevision`, while writing `appliedSyncRevision` from the in-memory row |
| 5 | launch and access compare stored revisions | reproduced | `workspace-app-launch.service.ts:287-289` compares `appliedSyncRevision` against the stored `requiredSyncRevision`, never a recomputed Core revision or the current target snapshot |
| 6 | scheduler namespace mapping is manual | reproduced | `agent-workspace-recovery-target.service.ts:46` reads the namespace from an environment JSON map keyed by workspace id, with `__new__` gated on `replacementApproved` |
| 7 | the additive migration is a draft | reproduced | `1799100900000-core-backed-recovery.ts` is 45 lines of `ADD COLUMN IF NOT EXISTS` with zero foreign keys, and its `down()` throws `core-backed recovery migration is irreversible` |
| 8 | dependency drift | reproduced and measured | Nest 11.2.1 against 11.1.27, pg 8.23.0 against 8.22.0, TypeORM 0.3.31 against 0.3.30; reported, not repaired, exactly as the mission asks |

## The mission's own done-when lines

| Done when | Verdict | Why |
| --- | --- | --- |
| a `backend.generate` receipt covering the recovery contract and the eight defects | NOT TESTED | the chain never reached step 5; `backend.generate` requires an `architecture-decision` input that no branch of this session could produce |
| a green `quality.verify` receipt at that head | PARTIAL | no receipt exists, because the operator never ran in the chain; the gates themselves were run as orchestrator diagnostics and are green at `78426381`, which is evidence about the draft and not the receipt the mission asks for |
| a `business.reconcile` receipt against business19's promise | NOT TESTED | it consumes `backend-source-application`, which was never produced |

## The two user routes, and what an answer to each would have to say

Written so a rerun on a later tree can be replanned from this file. One of the two has an answer on
record; the other does not, and nothing here should be read as the person having given one.

### Route 1 — `ENVIRONMENT_NOT_READY` at `1/1`, answered

The two walls were `runtime.be.holder` and `host.deps.be`. The mission block the person confirmed
already answers both, by excluding both repairs in its own words: "dependency install" and "any
shared deployment" are excluded, and the prompt states that `runtime.serve` is the only thing that may
touch a runtime and that this mission does not require serving. The answer is therefore: both walls
stand on record, neither is repaired, and every gate result says it measured a tree whose installed
dependencies differ from its lockfile. That is recorded as
`choices["preflight-walls:20260905-015806-nivo-environment.preflight:v1"] = accept-both-walls`, with
the person's message as `sourceRef`, and the branch is a `resolved` transition rather than a stop.

A rerun should carry the same choice, unless the person has since run `npm ci` in
`D:/Repositories/nivo-backend`, in which case `host.deps.be` answers `ok` and the choice covers only
the runtime holder.

### Route 2 — `LIFECYCLE_TRANSITION_INVALID` at `3/1`, unanswered

No answer was given and none is invented here. What an answer would have to choose between:

- Change the goal, so that a done-when line names `business.decide` and the promise is advanced to a
  state the lifecycle allows. This does not actually work: from `in-progress` the only legal exits are
  `implemented`, which only `business.reconcile` may publish, and `rejected`, which is not what anyone
  wants. It is listed so the next reader does not spend time on it.
- Change the tree, so the chain never needs `business.decide` at all. This is the only answer that
  makes the mission runnable, and it is a runtime change, not a decision about the product.

So the honest shape of route 2 is that it is not really a question for the person about the recovery
work. It is D1 and D6 surfacing as a stop, and the person's answer is a decision about the runtime.
Once `validate-chain` credits an imported producer slot, `business.decide` leaves the chain, the
imported architecture reaches `backend.generate` directly, and this route does not occur: there is
nothing left to script an answer for.

The replan for a fixed tree is therefore: same mission, same three done-when lines, same
`goal-confirm` at `as-stated`; chain `environment.preflight`, `workspace.bind#be`, `backend.generate`
at `scope: full`, `quality.verify`, `business.reconcile`; `architecture21` imported into an off-chain
slot and named as `backend.generate`'s `architecture-decision` input; route 1's choice carried
forward. Everything this run built is reusable: the session worktree at `78426381` already carries the
draft with its provenance commit, and the six baseline gate logs are the before-state that a
`backend.generate` run must not regress.

## What is left standing

- The eight product defects are all still open. Nothing in the recovery source was changed by this
  run; the only commit is the verbatim carry-forward.
- The stopped session's checkout is untouched: still `aba9c978` with its 111 dirty paths, never reset,
  stashed, cleaned or committed.
- Two runtime doors (D1 and D6) must open before this mission can run at all. The smallest change is a
  `Next` row on `workspace.bind` for `architecture.decide`; the more complete one is letting
  `validate-chain` credit an imported producer, which also repairs D2 and makes D5's version problem
  survivable.
- D7 is a third door of the same kind and blocks every fan-out, not this mission. D1, D6 and D7 are
  one class of defect: an operator the Next tables can reach from nowhere. A single check that every
  operator is reachable from `environment.preflight` through the Next tables would have caught all
  three before release.
