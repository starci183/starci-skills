# The workflow kernel (StarCi 5-plus)

The `kernel/` folder is the whole control plane of a job. One process per workflow: no Plan Coordinator, no
per-module Monitor, no provider chain. A **job** is any piece of work ("implement backend feature A",
"backend for three modules with the existing SRS/SDS", "write an SRS"); its **inputs** are typed refs
(`sds:path`, `srs:path`, `file:path`, `note:...`) of which specifications are one kind among many.

**One concern, one module.** 5-plus split the 318 KB kernel into files named after the reason each one
exists, and this document is laid out the same way, so a section and a module can be read against each
other:

| module | the concern | section |
| --- | --- | --- |
| `kernel/kernel.mjs` | the loop itself: the phases, `applyOpReport`, `renderContract`, the seams | [Phases](#phases), [The policy table](#the-policy-table) |
| `kernel/common.mjs` | what every concern shares: op creation, status vocabulary, scope reading, the tree paths of a shared ledger | throughout |
| `kernel/graph.mjs` | the process as data: kinds, lanes, routes, `validateGraph` | [Lanes and routes](#lanes-and-routes) |
| `kernel/io.mjs` | the record catalog: what a path IS, what a kind may cite and produce | [Declared inputs and outputs](#declared-inputs-and-outputs) |
| `kernel/goal.mjs` | the goal phase and its critique | [Phases](#phases) |
| `kernel/intake.mjs` | the one operation that exists because the tree lacks the records | [Intake](#intake-the-records-before-the-work) |
| `kernel/reconciliation.mjs` | the three typed cases, checked mechanically | [Reconciliation](#reconciliation-three-cases-as-data) |
| `kernel/owner.mjs` | the owner loop: open the question, prepare it, deliver the ruling | [The owner loop](#the-owner-loop) |
| `kernel/sync.mjs` | the ledger sync: new ops, the ledger write-back, stale proofs | [Writing the ledger back](#writing-the-ledger-back) |
| `kernel/ledger.mjs` | the Work tree itself: reads, writes, integrations, the proof digest | [Integrations and the proof digest](#integrations-and-the-proof-digest) |
| `kernel/contract.mjs` | the working order per kind, spliced into every contract | [The operation contract](#the-operation-contract) |
| `kernel/schedule.mjs`, `budget.mjs`, `loads.mjs`, `chains.mjs` | scheduling, the dynamic budget, the shared runtime ledger, launch | [Bounds](#bounds-on-what-a-run-may-grow), [Runtimes](#runtimes-are-shared-across-workflows) |
| `kernel/lanes.mjs` | the lane worktree one workflow owns | [Lanes: one workflow, one worktree](#lanes-one-workflow-one-worktree) |
| `kernel/verify.mjs`, `guards.mjs` | machine verification, proof by contrast, the guards | [What is machine-verified](#what-is-machine-verified-and-what-the-model-is-asked), [The guards](#the-guards-the-kernel-owes-itself) |
| `kernel/terminals.mjs`, `supervisor.mjs` | tabs and the supervising process | [Terminals](#terminals), [Supervision](#supervision-without-an-agent) |
| `kernel/store.mjs`, `view.mjs`, `reports.mjs`, `routing.mjs` | the store, the status page, the report vocabulary, ledger resolution | [Reading a workflow](#reading-a-workflow) |
| `checks/render.mjs` | the canon rules, read from the bytes a drawing left | [Render checks](#render-checks) |
| `hosts/index.mjs` | the host model as data | [Hosts](#hosts-orca-and-headless-one-chat--one-workflow) |

Entry points are the commands of `bin/starci.mjs`, the one command line of the runtime; it forwards them
unchanged to the launcher in `hosts/orca/launch.mjs`, which routes them straight into `kernelMain`. `starci`
below is `node <skill root>/bin/starci.mjs`:

```
starci workflow-goal    --job <text> [--lane [<name>]] [--inputs a,b] [--gates name=command,...] [--ledger work|plan] [--scope f1,f2] [--id <id>]
starci workflow-approve --id <id> [--allocation <runtime>=<slots>[:<tiers>],...] [--allow-dynamic N] [--accept-critique "<reason>"]
starci workflow-answer  --id <id> --op <ask op> [--choice <n>] [--note "<the owner's words>"]
starci workflow-run     --id <id> [--from <own terminal> --run <run>] [--launch-file <f>] [--max-iterations N]
starci workflow-status  --id <id>
starci workflow-lane-close --id <id>
```

Every command also takes `--host-adapter orca|headless` (default `orca`, or `headless` when `STARCI_HOST=headless`
is set): see [Hosts: Orca and headless](#hosts-orca-and-headless-one-chat--one-workflow).

`--allow-dynamic N` raises this workflow's run-time operation budget (default `DYNAMIC_OPS_BUDGET` = 64) and
reinstates the operations the dynamic-op gate refused. Re-approving is how a user answers that gate.
`--accept-critique "<reason>"` is how a user approves a goal whose critique returned `refuse` (see **Phases**).

All runtime state of one workflow lives in one directory (`kernel/store.mjs`):
`state.json` (atomic snapshot), `events.jsonl` (append-only audit), `goal.md` / `goal.json`, `contracts/`,
`reports/`, `checks/`, `validator/` (the validator's memory and verdict log), `final-report.json`.

## Two ledgers

A workflow's ledger is either the product's own or one a model assessed, and `--ledger` names which.
`detectLedgerMode` defaults it: a repository with `<repo>/.starciwork/features` is driven by its Work tree.

| | `work` (default with a Work tree) | `plan` (no Work tree) |
| --- | --- | --- |
| where the TODO list comes from | the authored Work tree, through the shipped validator | `assessGoal` invents it |
| what the model is asked | the definition of done, risks and questions | the whole plan form |
| what an op is | one step of the lane of one eligible `todo` node in `--scope` | one op of the assessed plan |
| goal text / allowlist / checks / acceptance | `description` / `implementation.changes[].files` / `extensions.work3.checks` / `assertions` | the model's op form |
| what an accepted slice writes | the node's `state`, `completion` and an evidence manifest - at the LAST lane step only - plus a `Work: <node id>` commit trailer | nothing outside the workflow directory |
| review granularity | one `review.verify` per module, for lanes whose template names it | one per connected ledger component |

A node that declares no allowlist or no checks is never guessed at - and it is not the user's chore either:
it is listed in `goal.md` under **Needs you first** as `ledger incomplete`, and the first ledger sync turns it
into one `work.author` operation whose write scope is that node's own `index.yaml`. See **Ledger incomplete ->
work.author** below. Decision nodes (`business`, `business-overview`, `architecture`) are listed too but never
launched into a worktree - a decision is answered. The exception is a reported `sds-gap`: see the policy table.

### Ledger incomplete -> work.author

`enrich` in `kernel/ledger.mjs` marks a candidate `schedulable:false` with a `reason` when its record
declares no write scope (`implementation.changes[].files` or `extensions.work3.allowlist`) or no check
(`extensions.work3.checks`). Nothing of that node's lane may start, because the kernel would have to invent the
two things it refuses to invent. Completing the record, though, is work - reading the node, its neighbours and
the requirement and design it references, then naming real files and real commands - so `syncLedgerOps` creates
an operation for it instead of an item in `needUser[]`:

| | |
| --- | --- |
| kind / origin | `work.author` / `ledger` (so it counts against no dynamic budget) |
| id | `<node>-author`, recorded as `state.lanes[<node>].authored` |
| goal | `Complete the Work record of <node> so the kernel can launch it: <reason>` |
| allowlist | exactly one path: the node's own `index.yaml`, as `protectedPaths` names it |
| checks | one: `work-valid`, the kernel's own whole-tree validator |
| acceptance | the node declares an allowlist and checks that name its assertions; the tree validates |
| ledger items | none - the node enters `state.ledger` when its own lane starts, not when its record is written |

It is the one kind allowed to write its own node's `index.yaml`, which `kernelOwnedPaths` already permits for a
path an allowlist names exactly, so the contract's **Never touch (kernel-owned)** lists only that node's
`evidence/**`. What stays the kernel's *inside* the file is guarded by comparison instead of by path:
`launchOp` snapshots `state`, `completion` and `extensions.work3.kernel` right after its own `markInProgress`
write, and `guardRecordBlocks` reads them back before anything is verified. A moved block is reverted with the
rest of the file and the report is downgraded to `failed` and retried, exactly as a written kernel path is for
any other op. No proof by contrast applies (the op changes no spec), and the validator (the LLM one) sees the
record diff like any other op's diff.

On acceptance the kernel asks the tree, never the report: the ledger is reloaded and `executableCandidates`
re-enriches the node.

- **Schedulable now** - event `record-authored {node, op, allowlist, checks}`, and the node's lane creates its
  first step on the next iteration, with the node's own id, because the author op preceded the lane rather
  than walking a step of it.
- **Still not schedulable** - event `record-still-incomplete` and one `ledger` item in `needUser[]`. There is
  no second author op: one per node per workflow is the bound, and the record is now the user's to settle.

Either way the node keeps `state: todo` with nothing but the kernel's `in-progress` receipt. Authoring a record
is not completing work, so there is no `markDone`, no `completion` and no evidence manifest.

Two cases keep the 5.0 behaviour of a bare `needUser` item, because no operation here could hold the write
scope: a Work tree another repository owns (the record is not in this worktree at all, the same reason
`requestSharedChange` refuses ledger paths), and a node whose `index.yaml` the guard cannot name.

A third case is the same rule one layer out. A reported `grammar-gap` is grown in the repository that owns the
installed grammar, and the workspace binding is what names it: an optional `grammar` role beside `be` and `fe`
(`{pathFromSource, gitRepository, package?}`), carried onto `ctx.work.grammar`. A binding that declares none is
not a defect - it is a product whose grammar this workflow may not change - so the kernel creates no operation,
reopens nothing and leaves the requester `blocked` with one `environment` item naming the file that would answer
it. Inventing a repository root for a language is exactly the guess the routing contract forbids.

### Too big for one operation -> implementation.plan

The sibling case. A node whose record *is* complete can still be more than one operation can deliver, and the
kernel decides that from the record rather than from an opinion. `cutReason` in `kernel/sync.mjs` measures every
schedulable `implementation` node three ways — a write scope naming more than `CUT_FILES` (12) files, more than
`CUT_ASSERTIONS` (8) assertions, or `refs`/`dependsOn` naming SDS records carrying `CUT_COMPONENTS` (3) or more
components — and one bound passed makes the node a cut:

| | |
| --- | --- |
| kind / origin | `implementation.plan` / `ledger` (the `work.author` operator contract, sequence `work.cut`) |
| id | `<node>-cut`, recorded as `state.lanes[<node>].cut` |
| goal | `Cut the Work node <node> into child nodes that can be built in parallel: <reason>` |
| allowlist | the node's own folder in the tree: `.starciwork/<node dir>/**` |
| checks | one: `work-tree-validates`, the whole-tree validator (named as the intake's is, because the kernel strips its own `work-valid` from every op it loads and validates the tree itself at acceptance) |
| references | the node, its `refs` and `dependsOn`, and the code its own allowlist names |
| ledger items | none — the children it writes are the nodes the tree has afterwards |

It is planned **before the lane and instead of the node's first step**, once per node, in both places a first
step is created: `workGoalPhase` (so the page the owner approves reads `1 implementation.plan -> seam ->
N backend.implement -> 1 e2e.verify -> 1 review.verify`) and `syncLedgerOps` (for a node that becomes
schedulable mid-run). The design gate runs first, because a frontend node is cut by screen and region and there
is nothing to cut it by until the feature's `ui` node is done. Event: `cut-planned {op, node, reason, files,
assertions, components}`.

The folder glob grants the node's own `index.yaml`, so `kernelOwnedPaths` keeps only that node's `evidence/**`
protected. Inside the record the guard is narrower than for an author op and deliberately so: a derived parent
authors no state, so removing `state` is the job here and `CUT_OWNED` is just `completion` —
`guardRecordBlocks` compares the named blocks field by field rather than the whole triple as one string.

On acceptance the kernel asks the tree, never the report (`settleCut`):

- **Children under the node's folder** — event `cut-authored {node, op, children, seam, groupAssertions}`, the
  group is recorded as `state.cuts[<parent>] = {children, seam, assertions}`, and the parent's ledger item is
  dropped because the parent closes nothing of its own any more. The seam is read from the records: the one
  child every other child names in `dependsOn`. On the next read the children are schedulable nodes and the
  parent, now a branch with no `state`, is no candidate at all.
- **No children** — event `cut-none`, `state.lanes[<node>].cutNone`, and the node starts its own lane with its
  own id exactly as it would have without the cut. No second cut is ever planned for it.

Afterwards the group is the unit of everything that judges: `cutParentOf` answers which group a node belongs
to, `cutChildDefers` keeps a child from ever planning its own prove step, `groupIncomplete` holds a proof until
every child of the parent is implemented, `groupVerifyKind` names the one proof the group still owes
(`e2e.verify` before `review.verify` on a backend lane, `uat.verify` on a frontend one), and `childOwning`
maps a finding's file back to the child whose write scope holds it. `fanOutDeferral` is the scheduler's side:
the seam of a group runs alone and at most `allocation.fanOut.maxPerGroup` of its children run at once
(`schedule-deferred {op, reason, parent, running}`). See [op-granularity.md](op-granularity.md) §1 and §4.

## Lanes and routes

One Work node is not one operation. It is a **lane**: the ordered kinds it travels before its ledger entry may
be called done. `model/kinds.yaml` declares the catalog and the lanes; `kernel/graph.mjs` reads it
(`laneFor`, `nextKind`, `routeFor`, `roleOf`, `familyOf`, `isReadOnly`, `describeLane`, `validateGraph`), and the
kernel only walks what it answers. Adding "frontend work is drawn before it is coded, and proved by a UAT run"
is a profile edit, not a patch to the control loop.

| lane | steps | who creates each step |
| --- | --- | --- |
| `design/ui` | `interface.draw` -> `interface.asset` (optional) | the ui node, both |
| `implementation/frontend` | `frontend.implement` -> `uat.verify` | the node, both - held (`lane-waits-design`) until the feature's ui node is done, a `design` question when the feature has none |
| `implementation/backend` | `backend.implement` -> `e2e.verify` -> `review.verify` | the node, then the kernel's review planner |
| `uat/frontend` | `uat.verify` | the node |
| `e2e` / `uat` | `e2e.verify` | the node |
| `integration` | `integration.verify` | the node; one declared external system, one node, one live proof |
| `operations` | `runtime.operate` -> `review.verify` | the node, then the review planner |
| `architecture` / `business` / `brand` | `architecture.decide` / `business.decide` / `brand.decide` | answered as a decision, never launched |

The optional artwork step of the ui lane is decided by the node's own design record, not by a judgement:
see [Brand and artwork](#brand-and-artwork). The layout comes from the node path: a node under `implementation/frontend/**` takes the frontend lane, one
under `implementation/backend/**` (or any implementation node that names no layout) the backend lane. A `ui`
node is the feature's interface design record and walks the `design/ui` lane. `state.lanes[nodeId] = {lane, done, checks, head}` is the whole bookkeeping.

Three rules follow, and they are the difference from 4.x:

- **One step at a time.** A node yields its next operation only when the previous step is accepted and nothing
  of that node is still in flight. The op id is the node id for the first step and `<node>-<action>` after it.
- **The ledger hears `in-progress` until the last step.** Every accepted step writes `markInProgress` and a
  `lane-step` event; `markDone` - with the checks every step of the lane proved and one evidence manifest - is
  written only when `nextKind` answers null. So the node's completion is named after the step that completed
  its lane (a backend node's evidence record is the review's), and a half-built node is never `done` in the tree.
- **`review.verify` stays the kernel's.** The review planner creates it for a lane whose template names it; a
  frontend lane is proved by its own `uat.verify` step, so no review is planned for one.

A **route** is the same idea for a reported outcome: the graph says which kind answers it, under which origin,
what happens to the reporter (`pause`, `reopen`, `retry`) and with which bound. Every application appends
`routed {op, on, to, origin}`.

| on | routes to | the reporter | bound |
| --- | --- | --- | --- |
| `blocked` `srs-gap` | `business.revise` on the business node the report names (its `index.yaml` plus its SRS folder), origin `business`, whose own check is that the Work tree still validates; `markDecided` bumps the node's `rev` | reopened behind it | 2 rounds, then the user |
| `blocked` `sds-gap` | `architecture.revise` on the architecture node (its `index.yaml` plus its SDS folder), origin `architecture`, whose own check is that the Work tree still validates; `markDecided` bumps the node's `rev` | reopened behind it | - |
| `blocked` `interface-gap` | `interface.draw` on the same node, origin `architecture` | reopened behind it | - |
| `blocked` `grammar-gap` | `grammar.update` in the repository the binding's `grammar` role names, origin `architecture`, allowlisted to that repository and the canon | reopened behind it | 2 rounds; no `grammar` role means no op at all |
| `blocked` `shared-change` | the reporter's own kind, origin `shared` | paused | 3 new shared ops per iteration |
| review findings | the lane's build kind (so a finding on frontend work comes back as `frontend.implement`), origin `repair` | finished; the repair carries the work | 3 rounds per reviewed node set |
| `uat.verify` reporting `failed` | the lane's build kind, origin `repair` | reopened behind the repair | the same 3 review rounds |
| validator reject | retry of the same op | retried | 2 (`validatorRejectLimit()`) |
| `blocked` `environment` / `authority` naming something only the owner can provide, or an effect nobody can undo | `owner.ask`, origin `ask` | paused, and a `needUser` `decision` item once the ask has prepared it | - |
| `blocked` `authority` naming neither | `owner.ask`, origin `ask` | not paused: it depends on the ask and resumes with the runtime's own recommendation, recorded under `state.provisional` | - |
| `blocked` `environment` naming neither | nothing | blocked, `needUser` | - |

Kinds younger than `ops/registry.yaml` are resolved to a launchable operator id once, at the launch seam:
`frontend.implement` launches as `interface.implement`, `architecture.revise` as `architecture.decide` and
`business.revise` as `business.decide` (`launchOperator`), so both repairs run on the reasoning chain that
decided the record in the first place - Fable, then Astra, then Opus. The allocator is asked for the op's own kind, because `roleOf` from the graph is what
decides its role - the runtimes profile's `roleOfKind` map is only the fallback for a kind the graph lacks.

A profile that cannot be read is not fatal: the graph is empty, `DECISION_OPERATION` in `kernel/io.mjs` maps
the decision node kinds as it did in 5.1, every route falls back to its built-in default, and one
`kind-graph-problem` event says so. With a profile present that table is never consulted: `decisionKindFor`
reads the lanes, because a decision node's lane is a single step and that step is the answer.

## Declared inputs and outputs

Every kind declares `reads` and `writes` over the record catalog of `model/records.yaml`, and `kernel/io.mjs`
is the one module that reads that catalog. Before 5-plus the kernel kept a set per question - which kinds are
"design kinds" and therefore get the brand payload, which operation settles a decision node, which operation
completes a Work record - and each set drifted from the catalog on its own schedule. Now there is one answer
to each question, and the kernel asks for it in four places:

| where | what `kernel/io.mjs` answers |
| --- | --- |
| the contract | `ioBlock(kind)` prints `## Reads` and `## Produces` under the goal, each record kind with the catalog's own one-line purpose, so an operation knows what it may cite and produce before it reads its allowlist |
| an accepted `done` | `undeclaredWrites(kind, files)` maps every changed file to a record kind (`recordKindOfPath`) and returns the ones the kind never declared. A non-empty answer downgrades the report to `failed` with the finding `produced a <record> record it does not declare: <file>`, appends `io-undeclared-write` and retries the op. No model is asked; this runs before the validator |
| the validator | `ioPayload(kind)` travels as `io:{reads,writes}` beside the diff, with the one rule that makes it binding: a record cited outside `reads` or written outside `writes` is a defect, whatever else the diff gets right |
| the brand payload | `kindsReadingBrand()` is which kinds receive the `## Brand` block and the brand rules - the kinds whose declaration says they read `brand`, not a list the kernel remembers |

A path that is not a record at all - the workspace file, a `_resources` or `_local` entry, the runtime state
the kernel keeps - answers `null` and is never a finding: the kernel's own state files are not the
operation's output. `ctx.kindsProfile` is the profile to read the mapping against; `null` is the compiled
one, and a caller running the kernel against an authored or a fixture profile hands that one in instead of
rebuilding `.dist` for it.

## Phases

**`goal`.** On the Work ledger the kernel loads the tree, lists the decision candidates and the schedulable
executable candidates in scope, derives one op per schedulable node and asks `assessGoal` only for the
definition of done, the risks and the questions; when that call fails the definition of done falls back to
the node list and the failure is an event, because the TODO list is a fact of the tree and not the model's
to supply. On a plan ledger `assessGoal` fills one form: the definition of done, a **ledger** of goal items,
and a dynamic list of **ops** with `dependsOn` and disjoint allowlists. Either way the kernel writes
`goal.md` and `goal.json` and stops. An item the plan reports as already `done` is carried as `preexisting`:
approved by the user, never verified by the kernel, and named as such in the final report.

**critique.** Every goal a person writes is challenged by the runtime before anything is planned from it, and
that challenge is a step of the goal phase, never a helper session. After the assessment and before the approval
page is written, `critiqueGoal` is called on the host's critics (`critique.runtimes` in config.json, astra then
fable by default: one call per goal, and Fable's week is the scarcer window) with the job text, the scope, the ledger items, the **decided** business and architecture records in scope
with the statements and acceptance criteria of their `srs`/`sds` payload (bounded to 40 records and 12k
characters), the brand when the tree has one, and what this runtime can and cannot verify. It answers one closed
verdict, and every objection must name its evidence - a record id, a rule statement, a fact of the job text -
because an objection without one is dropped by the kernel. The verdict lands in `state.critique`, in `goal.json`
and in the `## Phản biện (critique)` section of `goal.md` above the definition of done, with the event
`goal-critiqued`:

- **`sound`** - proceed as written. Nothing else follows from it.
- **`revise`** - proceed only under the changes in `required`. They are part of the goal the user approves, so
  `renderContract` renders them as `## Goal critique - required` under the goal of **every** operation of the
  workflow, above its allowlist: the operations honour the critique without anyone re-typing it.
- **`refuse`** - the goal contradicts an accepted record or cannot be verified at all, and the critique states
  the one question whose answer would unblock it. `approve` refuses until either the question is answered and the
  goal is written again, or the owner overrides the critique with
  `workflow-approve --id <id> --accept-critique "<reason>"`. The reason is recorded as `state.critiqueOverride`
  with the event `critique-overridden` and rendered on the goal page. An override is the owner's own decision, so
  the kernel never asks for it again.

- **`prerequisites`** - what the goal builds on that the tree does not hold: the `srs`/`sds` of the feature it
  extends ("add X to the backend" with no record of X), the `brand` a design needs, a `decision` nobody took.
  The kernel acts on them: a feature or brand record the tree lacks becomes the intake operation that authors
  it (`intake-planned` with `prerequisite`), and **every other operation of the goal waits for it** - the build
  starts from a record, never from the prompt. One the tree holds is `prerequisite-held` and changes nothing;
  a `decision` is the owner's (`prerequisite-owner`) and stays on the page under `### Prerequisites`.

- **`hidden-decision` objections** - what the goal decides silently that the owner should decide. They are not
  all the same, and the critic says which is which with `decisive`. A **non-decisive** one becomes nothing at
  all (`hidden-decision-deferred`): the record repair (`business.revise`, `architecture.revise`) settles it
  towards the most reasonable reading when an operation actually hits it, and the owner overturns it from the
  record's decision log. A **decisive** one - it changes an observable outcome about money, authority or
  customer data - becomes one `owner.ask` of `question.kind: decision`, planned before every operation that
  touches its feature (`planCritiqueDecisions`, event `decision-planned`), so the owner is asked before the
  work rather than after it. A decisive decision about a feature no operation of this goal touches is reported
  (`decision-unplanned`) rather than turned into a question nobody is waiting for.

- **`provisions`** - everything only the **owner** can provide for the proofs of this goal to be real: a
  credential or token, a sandbox or test account on an external system, a real dataset or sample, the legal or
  consent authority to act for real. The critic names every one the goal's scope implies from the decided
  records, not only what the job text says. They are `state.provisions`, listed on the goal page under
  `### The owner provides` and printed by `workflow-status` as `## The owner provides (n)` with each one
  `open`, `asked` or `provided`. **Nothing waits on that list**: the operation that needs one opens the
  question in its own tab at the moment it needs it, with the exact name, and every other operation carries on.

A critic no provider could answer is `goal-critique-unavailable`: the goal page says `Phản biện: chưa chạy được`,
nothing binds an operation, and the workflow carries on - a dead provider is never a veto over the owner's job.

**approval.** `approve` sets `state.approved`. This is the only human gate; nothing is launched before it, and a
goal whose critique returned `refuse` is not approvable until the override above is given.

**`run`.** `runLoop` first runs the worktree **preflight** once (`kernel-guards.preflight`: `core.longpaths`,
the hooks environment for the kernel's own commits, the recorded `autocrlf` state, the branch) and appends one
`preflight` event; a fix it applied is recorded, a problem it cannot fix becomes a `needUser` item. Then, per
iteration:

1. **answer** every op waiting for an answer (`notifyTerminal`), then
2. **shared changes** - return every `paused` op whose shared op is `done` to `ready`, and create the shared
   ops a full earlier iteration had to queue, then
3. **lanes and review** - give every node whose previous lane step is accepted its next operation, and create a
   `review.verify` op for each ledger group whose implementing ops are all done and whose lane names that step, then
4. **schedule** - every op whose `dependsOn` are done, whose allowlist does not overlap a running op's
   allowlist and whose resource locks do not clash a running op's, up to `allocator.maxParallelOps`, gets a
   runtime from `allocator.allocate(kind,{avoid})`, a rendered contract, and a launch; then
5. **wait** - one `waitTick` on the workflow run (it classifies every live op), then
6. **accept** every report that arrived, then settle every op the tick found stalled or dead; and
7. when nothing is left to run: **gates**, then the **final report**.

Every iteration appends a `tick` event and saves `state.json`, so re-running `workflow-run` continues the
same workflow - the same counters, the same event log, the same ledger. The first binding of the Orca run is
the `run-bound` event; a kernel that already has its run (a resume, or a run handed in) appends `run-resumed`,
because re-binding a Run would invalidate every live Dispatch on it.

An op is `pending` -> `ready` -> `running` (`answering` while the kernel types an answer into its terminal,
`paused` while it waits for a shared change) -> `done` | `blocked`. `paused` counts as live: a job never
finishes while an op is waiting for someone else's change.

A ledger item moves `planned` -> `implemented` (an op's reproduced `done` was committed) -> `verified` (an
independent review accepted it); `preexisting` is the fourth state, for an item the approved plan reported as
already done. The workflow is `done` only when every item is `verified` or `preexisting` and the gates pass.

## What is machine-verified, and what the model is asked

The kernel never takes `done` on trust. For an accepted report it re-runs **every check command of that
op's contract** in the worktree (`spawnSync`, shell, 30 min default), computes the changed files from
`git status --porcelain` filtered to the op's allowlist, and commits them as `feat(<opId>): <goal>`.
A check the kernel cannot reproduce downgrades the report to `failed` with the failing check as the
finding, and the op comes back. The job **gates** are run the same way, by the kernel, never by an agent.

The model is asked for forms only, never for control flow:

| function | what it fills |
| --- | --- |
| `assessGoal` | a plan ledger: definition of done, ledger, ops (`starci/goal-plan@1`); on the Work ledger only the definition of done, risks and questions (`starci/work-goal@1`) |
| `critiqueGoal` | the objections to the goal itself (`starci/goal-critique@1`): one closed verdict `sound` / `revise` / `refuse`, evidenced objections, the required changes, the alternatives and the one question (see **Phases**) |
| `planOp` | the input form of one op that must be planned again after a design decision |
| `decide` | one option of a closed set when a bounded policy cell ran out |
| `validateOp` | the closed verdict of the workflow's one validator on a `done` the kernel already reproduced: `accept`, or `reject` with findings inside the diff (see **Validator**) |

Everything else - scheduling, allowlist arbitration, runtime choice, retries, commits, gates, the final
report - is this code.

## Brand and artwork

Two bodies of material stand behind every surface this kernel builds. The **grammar** is the host's and is the
same for every product (`knowledge/grammars/**`, `knowledge/patterns/fe/**`, `knowledge/ui/**`, listed by
`grammarReferences()`). The **brand** is the product's own and lives in the Work tree: one `brand` node whose
record carries the name, the design family, every colour token with the role it plays, the fonts, the mascot
and logo assets, what is forbidden and the rules every imagery prompt must carry. `kernel/ledger.mjs`
answers it as `ledger.brand = {node, rev, file, spec} | null`, and `brandReferences(ledger)` names the record
file plus every `brand/assets/**` path beside it.

Which operations read both is no longer a set the kernel keeps. `kindsReadingBrand()` asks the catalog for
the kinds whose `reads` names `brand` - today `interface.draw`, `interface.asset`, `frontend.implement`,
`uat.verify`, `grammar.update` - so settling one more kind inside the identity is an edit to
`model/kinds.yaml` rather than to the control loop. They are what `brand.decide` exists for, so for each of
them the kernel:

- **references the brand.** `deriveWorkOp` adds the grammar canon and `brandReferences(loaded)` to the op's
  references; an op derived before the brand existed picks the record up at launch, so its contract never
  points at material that was not there yet.
- **prints it in the contract.** A short `## Brand` block under the references - name, family, rev, the record
  path and the mascot/logo assets - plus the one line it exists for: every colour, font, icon and illustration
  comes from that record and the grammar, and none is invented beside them. No other kind gets the block.
- **refuses to run without it.** A design op on a tree whose ledger knows about brands and carries no record is
  not launched: `schedule-deferred` with reason `brand missing`, and the op waits behind the `brand.decide`
  operation the kernel creates from the tree's own brand node (its `index.yaml` plus the folder its assets live
  in, origin `ledger`, one check: the tree still validates). A tree that carries no brand node at all is the one
  thing the kernel will not invent - a brand is the product's identity - so it asks once, as a `brand` needUser
  item: *no brand record: author `.starciwork/brand/index.yaml` (a work.author or brand.decide op)*.

A ledger build that does not answer the `brand` field at all leaves all of this off, so a tree that was never
asked about brands behaves exactly as before.

**The brand is a decision.** `brand` is a decision kind, so `decisionCandidates` lists it in goal.md,
`DECISION_OPERATION.brand` is `brand.decide`, and an accepted `brand.decide` is settled by `markDecided` with a
bumped `rev` - like `architecture.revise`, because every surface already built from the old brand was built from
something that has now changed. The kernel then re-reads the tree and records `brand-revised {rev, node, op}`.
That is all it does: the Work validator binds a completion to the digest of what it was built from, so the
frontend-facing nodes that were built against the old brand are reopened in the tree itself, and `syncLedgerOps`
picks them up on the next iteration like any other newly schedulable node.

**The design record is the feature's `ui` node.** Its `ui:` spec - surfaces, states, the candidate images under
its own `assets/` and the `artworkSlots` the drawing declared - is the authority for the interface lanes, and
`lanePredicates` reads it from disk (`designRecord`): a `ui` node reads itself, an implementation node reads
the ui node it references or the one beside it under `features/<feature>/ui`. The ui node walks `design/ui`
(`interface.draw -> interface.asset`); its drawing and artwork ops are granted the record's exact path, because
the design body is theirs to author. On a shared ledger those tree paths are located in the owner repository
(`locateSharedTreePaths`), because that is where the one tree is. When the ui node is recorded done, the
candidates its record names under the node's `assets/` become the hashed captures of its evidence
(`designEvidenceAssets`), which is what the `ui` completion profile requires.

| predicate | true when | effect |
| --- | --- | --- |
| `node.hasInterfaceDesign` | the record names its surfaces and the candidates that drew them | informational: the drawing is never optional |
| `node.hasNoArtworkSlots` | the record is drawn and declares no `artworkSlots`, or every slot names its generated `file` | `interface.asset` is skipped: there is no artwork left to produce |

A node whose record was never drawn satisfies neither, so both steps run: the default is to do the work, and
only the record may retire it. A slot is `{id, screen, state, region, purpose, brief, size, format,
references, crop, file?, sha256?, status?}`, which is what makes the asset step checkable - the files it
produced, against the slots that were declared. An implementation node is held before its first step
(`lane-waits-design`, once per drawing) while the feature's ui node is not done, and a feature with no ui node
raises a `design` question for the user: a build that invents its own screen leaves nothing for the walk to
compare against. An `interface-gap` from the build is drawn on that ui node, never on the build's code paths.
The lane bookkeeping prints the lane as walked: a step the record retired is in `skipped` and out of the
progress count. A lane templated by an older profile is re-templated at load (`lane-retemplated`) when nothing
accepted is lost.

**The validator is given the brand too**, trimmed to the fields a verdict can be founded on (`brandPayload`:
name, family, rev, colorTokens, mascotAssets, forbidden, imageryPromptRules) and with three rules that make it
binding: a design candidate or a built surface using a colour, font or icon outside the brand tokens and the
grammar is a defect; an `interface.asset` result whose slot files are missing, or whose artwork ignores the
brand mascot and logo references, is a defect; and a `frontend.implement` result that substitutes its own image
for a declared artwork slot, or omits one, is a defect.

## Intake: the records before the work

`kernel/intake.mjs` owns the one operation that exists because the tree does **not** hold what the job is
about. Every other operation of the kernel is derived from an authored node; an intake is derived from a
scope entry the tree does not know - a feature nobody has written down yet, or the brand of a product that
has none - so it is the only place the kernel writes records rather than work.

A `--scope` entry the tree does not know is not an error: the goal phase plans one intake operation for it
(`intake-planned`) and the tree, once it has the records, says what follows. `intakeKindFor(scope)` decides
which: `brand` becomes one `brand.decide` op on `.starciwork/brand/**` that authors and decides the one brand
record, and a feature becomes one `work.author` op on `.starciwork/features/<feature>/**` that mirrors the
shape of an existing feature - module record, business overview and SRS as full drafts, architecture
skeleton - with every leaf record `todo` and the roots carrying no state, so the owner reads drafts and the
decisions stay the owner's. Neither op closes a Work node (`ledgerIds: []`); the records it writes are the
nodes the next `syncLedgerOps` sees.

An intake op's goal and acceptance are re-derived from the current build at every sync
(`intake-retemplated {op, changed}`): the validator reads the acceptance literally, so a wording the build
has since corrected must reach the ops planned before the correction. Only the text moves - the allowlist and
the references stay what the owner approved.

An accepted intake is **settled by what the tree holds under its scope** (`settleIntake`,
`intake-authored {op, scope, records, decisions}`), never measured as an incomplete record: two workflows
once finished `blocked` asking the owner about a node called `null`, because an op that closes no node was
being measured as one. The records under the scope are listed, the open decisions among them go to the
report as the owner's, and nothing asks the user.

`workflow-goal --reintake <feature>` plans the same intake in reconcile mode over drafts the tree already
holds (`intake-planned {mode: reconcile}`), which is how a feature authored before this rule is brought under
it.

`workflow-goal --migrate <feature,...|all>` is the one workflow that executes no node. It plans one intake per
feature in migrate mode (`intake-planned {mode: migrate}`) over an allowlist of the module record, `business/**`,
`architecture/**` and `integration/**` - never `implementation/` or `ui/` - so the intakes of every feature run
side by side and never meet a kernel write. A migration brings the decided records under the current model:
the typed reconciliation on the module record, every outside system declared at `extensions.work3.integrations`
with its credential's name and `custody: identity:<slug>`, and one todo integration node per declaration.
No decided record changes its state, its rev or its substance; a contradiction is a `conflict` row and a
decision record, never an edit. `all` names every feature with a decided business or architecture record
(one without is skipped, `migrate-skipped`); a feature the tree lacks is refused. The intake runs the
`work.migrate` sequence, which declares and never re-decides, and the validator leaves the two declarations
out of the semantic digest, so a migrated module record stales nothing beneath it.

### What an older rule already parked

A rule that turns a bound into an escalation applies to what an older rule already parked for the owner. On
kernel start, once per rule (`PARK_RULE`, stamped on `state.parkRule`), `rejudgeParked` judges every item of
the owner's list again under the current rule and routes it where the rule routes it today: a parked review is
escalated (`verify-escalated`, a provisional question when its findings cite no decided record), a shared change
called too deep is authored as a node (`shared-authored`), a request that named record paths is refused again
(`ledger-path-refused {rejudged: true}`) and its code paths carry on as a shared change - or, when it named
record paths alone, the op runs again with the rule in its findings - a spent launch cools and comes back
(`launch-cooling`, `launch-readmitted`), a requester blocked behind a blocked-but-alive shared change waits
for it instead (`resumePaused` blocks a requester only behind a refused or failed shared change), and the
"never verified" line is dropped because the finish recomputes it. A provision, an irreversible effect, a
decision - what is genuinely the owner's - stays. The pass writes one `parked-rejudged {rule, routed, left}`.

## Reconciliation: three cases, as data

### The principle

Adding a capability to a product whose features are already decided is not an append. A new feature arriving
beside decided ones does not get to sit next to them and be true on its own terms: what has to hold after the
change is **the whole product as one consistent set of decided records**. So every decided record the new
feature touches is re-examined, and there are exactly three things that re-examination can find.

What a decided record already holds, the new feature cites by its id and leaves exactly as it is - not
re-worded, not re-defined, not copied under another name, because two statements of one rule are two rules
the moment one of them is edited. What the new feature would change in a decided record is a **conflict**,
and a conflict is the owner's: the intake states both sides, the consequences of each, the numbered options
and one recommendation in a decision record under its own feature, and the decided record becomes its revised
version only through the owner's answer. The runtime never writes that revision, never overwrites the record
and never averages the two positions; every part of the new feature that rests on the unsettled question
stays a draft behind it, which is why **the workflow may not finish `done` over an unsettled conflict**. What
no decided record covers is **new**: authored under the new feature, declaring what it reads from the decided
records it rests on and what it hands on, both to the records that follow it and to the decided records that
will now depend on it. The owner's shorthand for this thinking is "A, B + C => A', B', C'"; the three typed
cases below are how the runtime makes it checkable.

### The three cases

The intake writes one typed row per touched record into the feature's module record at
`extensions.work3.reconciliation`, each row `{case, record, decision, reads, hands, detail}`:

| case | what the intake writes | what the kernel does |
| --- | --- | --- |
| `reference` | the decided record's id and one line of detail; nothing of it restated | nothing - the citation is the whole of it |
| `conflict` | a `todo` `decision` record under this feature with both sides, the consequences, numbered options and one recommendation, named in `decision`; the decided record left byte for byte | lists it for the owner (`needUser` kind `decision`, `reconciliation-conflict`) and finishes `blocked` on an unanswered one |
| `new` | the record, authored under this feature, with the `reads` it rests on and the `hands` it passes work to | nothing - the record is a node the next sync sees |

### What the kernel checks before any model

`kernel/reconciliation.mjs` is pure apart from the node reader the caller injects, and the kernel calls it
when an intake reports `done`, **before the validator** (`ctx.reconcile`, the seam `reconcileIntakeSeam`).
`readReconciliation(record)` answers `{rows, findings, table}` - the rows it normalized, the rows it could
not (`reconciliation-row-malformed`, a finding rather than a throw, because a malformed table is the intake's
defect and not the loop's crash), and whether a table was there at all. `scopeReconciliation` collects the
rows under the scope shallowest-record-first, and reads the feature's module record **from disk** when the
tree listing holds nothing under that scope - a validator projection taken before the op lists none of what
the intake just authored, and a table that exists is never reported missing for being newer than the listing.

| finding | rule |
| --- | --- |
| `reconciliation-missing` | the tree holds decided records of other features and this intake wrote no table |
| `reference-unknown` | a `reference` row names a record the tree does not hold, or one that is not decided |
| `reference-restated` | a `new` record repeats a sentence of a referenced record word for word |
| `conflict-without-decision` | no decision record named, or one that is not a `todo` `decision` node under this feature |
| `conflict-edited` | the decided record a conflict names moved while the intake ran |
| `new-unknown` | a `new` row names a record outside the scope, or `reads`/`hands` ids the tree lacks |
| `new-reads-blind` | a `new` row cites a record of a kind its own record kind is not derived from |
| `reconciliation-row-malformed` | the table, or one of its rows, is not a shape the reader can normalize |

A failing check appends `reconciliation-rejected {op, scope, findings}`, downgrades the report to `failed`
and retries the op with the findings - retrying is the kernel's policy and stays there, which is why the
module returns findings instead of retrying itself. A passing one appends
`reconciled {op, scope, reference, conflict, new}`. A checker that throws is `reconciliation-failed` with the
reason and the intake settles as it would have before the rule existed.

Two mechanics are worth stating, because they are what keep these findings from being opinions.
**Restatement** is not a similarity score: a statement is cut into sentences, each folded (whitespace
collapsed, case dropped, trailing punctuation removed), and a folded sentence of at least
`RESTATEMENT_WORDS` (12) words appearing in two records is the same sentence written twice; anything shorter
is left to the validator, because two features may both state that a refund window is thirty days without
either restating the other. **`conflict-edited`** compares the digests the kernel captured at launch
(`op.intakeDigests`, sha-256 over each node file's bytes) against the tree now, so a decided record that
moved while the intake ran is caught against what the tree held before the op rather than against the
intake's word for it.

`recordReadsOf(kind)` - which record kinds a `new` row may cite - **includes the record's own kind**. A rule
that refines another rule, or a design that cites a sibling design, is a peer citation and not a derivation,
so without it the ordinary case of a requirement citing a requirement would read as blind.

### Who else sees the same cases

The **critic** answers `overlaps: [{record, case, evidence}]` beside its verdict, over the two cases visible
from the goal text and the decided records (`reference`, `conflict`); the third is not an overlap with
anything and is not the critic's to name. Its binding move is the verdict: a goal that would only be added
beside the decided records, naming none of them, is `revise` with the reconciliation in `required`, and a
`revise` reaches the owner's approval page and the contract of every operation. The overlaps travel too:
`critiqueGoalPhase` keeps the two closed cases in `state.critique.overlaps` and counts them on `goal-critiqued`;
the goal page prints every `conflict` under `### Conflicts for the owner` and every `reference` under
`### Records to cite`; and the intake's contract carries `## Reconciliation the critic found`, one row to
write per overlap. The kernel still checks the table the intake writes against the tree by id, so the
critic's reading is a head start for the intake and a preview for the owner, never the verdict.
The **validator** is told which case each row claims and which ids the kernel already
checked, and judges only what a reader can. The **intake contract** (`work.intake`) is written around the
sides and the three cases and names the table shape verbatim. An intake edits no record of another feature
and files no gap against one: what a decided record must become is either the owner's decision or new work
the feature declares.

## The owner loop

`kernel/owner.mjs` is the whole loop in one file, because it is one rule: the runtime prepares a decision and
the owner takes it. The kernel calls it at three seams.

**What stops the work, and what does not.** The owner is asked only for what the runtime cannot obtain and
for what it must not do, and there are exactly two of those.

- **Something only the owner can provide** - `ownerProvisionNeed(detail)` answers
  `{kind: credential | account | dataset | authority}` or `null`. A credential (an upper-case underscored
  name, or api key / token / secret / credential / password / client id / webhook / oauth) is one member of
  that class: a **sandbox or test account** on an outside system (a payment gateway, a bank, an e-invoice
  provider, a tax authority, an SMS or e-mail provider, an identity provider, storage), a **real dataset** the
  product must be verified against (statements, invoices, exports), and a **legal or consent authority** (may
  we message these users, may we charge this card) are as unobtainable by a runtime as a key is.
- **An effect nobody can undo** - `irreversibleEffect(detail)`: a message or notification to real customers, a
  payment, charge, transfer or refund of real money, a deletion, drop or purge of production or customer data,
  a publish, deploy or release to production.

`stopReasonFor(question)` reads the sentence first and an unambiguously declared kind second; `authority`
alone is never a stop, because it is also the kernel's own generic blocker kind. A stop question pauses the op
that asked (`owner-ask-opened {op, ask, kind, stop}`) and is listed for the owner once the ask op has prepared
it (`needUser` kind `decision`, `owner-question`).

**Open.** Every other question - a business rule, a design choice, a reconciliation conflict, a
`hidden-decision` a review found - opens the same `owner.ask` op and does **not** pause the requester: it only
`dependsOn` the ask (`owner-ask-opened {provisional: true}`). The ask op's allowlist is the feature's own
policy-decision folder (`decisionAllowlistFor`, read from the node's path in the tree and never from the id
segment), and one existing policy decision of the tree travels as a reference to mirror. A second operation
asking the same question joins that ask as another requester rather than opening a second one. "Mechanical" is
the closed set `mechanical | runtime | retry | format | tooling` (`MECHANICAL_QUESTION`); only those reach the
supervisor model's `decide`, and only through the closed options the kernel offered it (`decide` event, then
`answer` typed into the op's terminal); a mechanical question the model cannot answer becomes a provisional
decision rather than a stop.

**Prepare.** The ask op first reads the decided records. One that settles the question answers it: the summary
carries `answered-from: <record id>`, the answer reaches every requester in its next contract
(`owner-ask-answered-from-record`, then `owner-answer-delivered` per requester) and nothing is written.
Otherwise it writes one policy-decision record draft - the question, why it matters, numbered options analysed
per side (architecture, user stories, security and authority, business rules, quality), the decided records
each option touches, and exactly one recommendation - and reports `decision: <record id>` with
`recommended: <n>`.

**Take it provisionally.** For a question that is not a stop, that recommendation IS the answer for now:
requesters resume with `provisional: option <n> - <text> (decision <id>)` in their contract
(`owner-answer-provisional`), carry `op.provisional = [<decision id>]` into everything they and their
dependants build (`inheritProvisional`; `markDone` writes the ids into the node's kernel block), and the
decision is listed under `state.provisional` - never under `needUser`. **A workflow may finish `done` over
one**: the final report carries `provisional` plus a rendered `## Provisional decisions (n)` block, and
`workflow-status` prints the same section beside, not inside, `## Needs you`.

**Answer, in the op or by command.** After writing the record the ask op prints the question and the numbered
options in its own terminal and says the owner may answer there with the number or later with
`workflow-answer`. An answer typed there comes back as `answered-by-owner: <n>` and is handled exactly as the
command (`owner-answered {via: 'terminal'}`). A provision is never asked for as a value: the owner puts a
credential into custody and replies `set`, the op checks only presence and reports
`credential: <VAR> present in identity:<slug>` (or `provided: <what>` for an account, a dataset or an
authority), and `redactSecrets` masks anything key-shaped that reaches an answer, an event or a report.

`workflow-answer --id <wf> --op <op> --choice <n> [--note "..."]`, queued to a live kernel's inbox, records the
owner's pick and delivers it to every live requester (`owner-answered`, then `owner-answer-delivered` each).
On a decision the runtime had already taken, the same option is `decision-confirmed` and changes nothing that
was built; a different option is `decision-overturned {decision, choice, reopened}` and every done node whose
kernel block lists that decision is `markReopened`, its work planned again with the owner's answer as a
finding. **The same command answers a reconciliation conflict**, and the `--op` there is the intake operation
that wrote the decision record rather than an `owner.ask`: `answerOwnerQuestion` finds the ask when there is
one and otherwise the `decision` item on the list, records the answer on that item's own record, and resumes
only requesters that are still live - the intake itself is already accepted, and re-running it would undo the
reconciliation the owner just settled.

**Custody.** A credential is never an environment variable: one belongs to whichever terminal exported it, it
is gone on the next machine, and the tree cannot say who set it. It lives in an encrypted identity resource of
the Work tree - `_resources/identity/<slug>/resource.yaml` (alias, provider subject, role, the variable NAMES)
beside `secrets.enc.yaml` (sops, the host's own age or GPG key) - which the integration declaration names as
`custody: identity:<slug>`. The owner fills it with `starci identity set <slug> --name <VAR>` (the value on
stdin, never an argument, never printed), and every operation reads it through `sops exec-env` at the moment
of use, so the value exists in one process and is copied into no file, log, report or contract. A missing
sops, a key this host lacks or a custody without that variable is `blocked` `environment` naming the slug and
the variable - never invented, stubbed, defaulted or silently skipped.

**Mechanical bounds escalate; they never become questions.** A bound the runtime set for itself is not a
decision anyone can take from a terminal.

- `verify-exhausted`: one more repair round on the strongest implement runtime that has not worked the group
  (`verify-escalated {group, round, runtime}`), which also buys the review that judges it. Findings that cite
  no decided record are a hidden decision (`verify-hidden-decision`) and the repair waits for a provisional
  ruling. Capped at `VERIFY_ROUNDS * 2` escalations per group per day; past that the group is parked
  (`verify-parked`) and that item is the owner's.
- `shared-depth`: a shared change too deep to delegate, inside this repository, becomes one Work node authored
  by a `work.author` op the kernel creates (`shared-authored {node, paths}`). Only paths outside the
  repository stay refused.
- `ledger-path`: a request naming record paths AND code paths is split - the record paths refused with one
  event (`ledger-path-refused {paths, continued}`), the code paths continued as the scoped shared op. Record
  paths alone are refused in the op's own terminal, never as a `needUser` item.
- launch exhaustion (`chain-exhausted`, the restart limit for `stalled-idle`): the op cools for
  `RATE_LIMIT_COOLDOWN_MS` and is re-admitted (`launch-cooling`, `launch-readmitted`), capped at
  `LAUNCH_DAILY_CAP = 6` re-admissions per op per day; past the cap it is an `environment` item
  (`launch-cap-reached`), not a decision.

`needUser` is deduplicated every iteration by `(kind, op|node, first 120 characters of detail)`
(`need-user-deduplicated`), so a kernel that runs for a day leaves one item per question.

## Render checks

A drawing is the installed grammar rendered in a browser, and `checks/render.mjs` checks that claim from the
two artefacts the drawing leaves behind: the PNG the browser captured and the markup it rendered, kept beside
each capture as `<candidate>.html`. Both are read as bytes, because both are the only things that cannot be
argued with. Nothing there renders, installs, downloads or edits; the PNG decoder is implemented on
`node:zlib` so a drawing is never checked by a dependency that may not be installed, and the colour
mathematics is `checks/brand.mjs`'s - one runtime, one definition of two colours being the same.

The kernel runs it on an accepted `interface.draw` report, before the validator (`ctx.renderChecks`, default
`renderChecksFor`). The hook finds the ui node from the operation's allowlist or the files its diff touched
and answers **null** - not a green result - for an operation that wrote no design record, so an operation
with nothing to do with a drawing is never reported as a drawing that passed.

| check | reads | fails when |
| --- | --- | --- |
| `palette-off-brand` | the capture's pixels | a colour bucket over `MIN_BUCKET_SHARE` (2%) of the saturated pixels is farther than `PALETTE_TOLERANCE` (deltaE 6) from every brand colour token |
| `primary-absent` | the capture's pixels | the brand's `role: primary` token appears in no bucket at all |
| `entity-list-in-card` | the kept markup | `MIN_REPEATED_ITEMS` (3) or more repeated rows sit inside a card surface of the grammar family |
| `mascot-slot-missing` | the design record | the brand allows the mascot on a surface whose `artworkSlots` declares no slot for it |

A failing check downgrades the report to `failed` with one finding per failing check, appends
`render-check-failed {op, checks}` and retries the op; a passing run appends `render-checked {op, checks}`.
A hook that throws is `render-check-unavailable {op, reason}` and the drawing is judged as it would have
been before the rules existed.

**A check that cannot be performed is `skip` with the reason, never `pass`**: no markup kept beside a
capture, a PNG format the decoder does not read, a record that declares no capture, a brand that names no
mascot, a surface the brand does not allow the mascot on. A `skip` never makes a run `ok: false` and never
makes it green either. When the run cannot start at all - a tree with no brand record, a node with no `ui:`
spec - the hook answers the single skip `render-checks-unavailable` carrying the reason: a broken input is
one unproven claim, never a failed drawing and never a passing one.

The same code is the CLI `starci render check <ui node dir> --brand <work root> [--family <id>] [--json]`,
which prints one line per check and exits 1 on a failing check or a broken input. The thresholds and the
decoder are described in [brand-checks.md](brand-checks.md#render-checks).

## Integrations and the proof digest

An external system is a record, not a remark in a description, and a proof of one remembers the rules it was
taken under. Both live in `kernel/ledger.mjs`; [work-ledger.md](work-ledger.md#external-integrations-proven-live-or-not-proven)
has the record shapes in full.

**Declared.** `declaredIntegrations(ledger)` reads `extensions.work3.integrations[]` from every `business`,
`business-overview`, `module` and `architecture` node and answers `{list, problems}`. `list` carries
`{id, provider, credential:{name, providedBy, custody, slug, where}, sandbox?, declaredBy}`; `problems` is
what the runtime cannot act on - `credential-missing`, `credential-not-owner`, `credential-custody-missing`
(no `custody: identity:<slug>`, or only the retired 5.1 `where`), `integration-shape` - as findings rather than
silent skips, because a vague declaration is exactly what a faked proof hides behind. An entry with an id is
listed even when its credential is a finding, so the tree still owes it a node.
`missingIntegrationNodes(ledger)` returns the declared ids with no `integration` node, which the kernel
reports as *ledger incomplete* and closes with `work.author`.

**Proven.** `integrationProofStatus(ledger)` answers, per declared id, `live` (a passing manifest on its own
integration node carries `proof.boundary: live`), `fake` (it appears only in another run's `proof.fakes`) or
`none` (nothing proved it, or the only live run failed). There is no fourth state, and a failed live run is
`none`: it ran, it did not prove. `workflow-status` prints one line per declared integration under
`## Integrations`.

**Bound to its rules.** `contractDigestOf({kind, kindRecord, operator, rules})` is the canonical sha-256 of
everything a proof of one kind rests on - the `model/kinds.yaml` entry, the operator contract it launched
through, and `VALIDATOR_RULES` - with stable key order at every depth, so a digest written today and one
computed tomorrow compare byte for byte. `contractDigestFor(kind)` is the kernel's default seam
(`ctx.contractDigest`); a kind the catalog does not carry answers `null` and binds nothing. On acceptance
`markDone` stores both `contractDigest` and `contractKind` in the node's kernel block, so the digest and the
declaration it was taken for travel together.

**Reopened.** Every ledger sync runs `reopenStaleProofs`: a done node whose stored digest is not the current
one was accepted under a contract that has since changed, so it is reopened through `markReopened` with the
reason `proof-under-old-rule` and its lane runs again under the rule that holds now
(`proof-under-old-rule {node, kind}`). Two details of that comparison are deliberate. **The comparison is by
the recorded kind**: `contractKind` says which declaration the digest was taken for, and only a block written
by an older build - which names none - falls back to the last step of the node's lane, then to the node kind
for a node with no lane. And **a node that stores no digest at all is left alone**: reopening every proof
written before the digest existed would be a whole product's work the owner never asked for, so those are
reopened only when the owner asks. `staleProofs(ledger,{digestOf,kindOf})` asks the same question of a tree
rather than of a run, and considers only nodes the kernel itself completed - their kernel block names an
`opId` - so a decided record settled by review is never dragged in.

## Validator

One validator per workflow, shared by every op, accepts or rejects every op result before the kernel commits
it - so an op that satisfied its own checks with a spec that cannot fail, or with code the goal never asked
for, does not get to fool the kernel. It is **an identity with memory, not a process**: not a long-lived agent
in a terminal (a serial bottleneck whose context rots and that would itself need supervising), but a headless
`validateOp` call the kernel makes per accepted result, with the same memory handed in every time.

**When.** In `applyOpReport`, after `machineVerify` and the proof by contrast have passed and before
`commitOp` and the ledger `done`. An op that changed nothing inside its allowlist (a review, an empty slice)
has no diff to judge and is skipped on the record (`validator-skipped` with the op).

**What it sees.** The op (id, kind, goal, acceptance, allowlist, attempt) and, on the Work ledger, the raw
node's description and assertions; the unified diff of the op's changed files against `op.baseHead`
(untracked files rendered as added; capped at 120 KB with a truncation note the validator can read); the
checks the kernel re-ran (name, command, exit code, output tail); `op.references`; the brand record when the
op's kind reads one; `io:{reads,writes}` - what the kind declares it may cite and produce - and the memory.
The rules travel with the payload: `VALIDATOR_RULES`, plus `VALIDATOR_IO_RULE` whenever a declaration was
handed over, so an operation with no declaration is judged without it rather than against a rule it was
never given.

**The verdict is closed.** `{verdict:'accept', summary}` or `{verdict:'reject', summary,
findings:[{file, line?, assertion?, detail}]}`. A finding whose `file` is not in the diff's file list is dropped
and recorded (`validator-finding-dropped`): the validator has no authority outside the diff. A reject with no
finding is an invalid form and is asked again; a reject whose every finding was dropped is no verdict at all.
An unparseable answer, a provider failure or an empty provider chain is `unavailable`.

**What the kernel does with it** (`op.validation = {verdict, summary, provider, at}` is stored either way):

| verdict | action | bound |
| --- | --- | --- |
| `accept` | `validated` event, then commit and ledger `done` exactly as before | - |
| `reject` | the report is downgraded to `failed`, `validator-rejected` is recorded, and the same op is relaunched with the findings (`retry`, reason `validator-reject`) - like a proof contradiction | 2 rejects of one op: the second sets it `blocked` with a `validator` needUser item and a `validator-exhausted` event, never a third launch |
| `unavailable` | never blocks: the commit proceeds, `validator-unavailable` is recorded and counted | 3 unavailable in a row: one `validator` needUser item names the outage; any accept or reject resets the count |

The verdict is data. It changes nothing except these transitions.

**Memory.** `<store>/validator/verdicts.jsonl` appends every verdict (op, head, verdict, findings, provider,
usage, reason). `<store>/validator/memory.md` is rebuilt by the kernel from it after each verdict: the job
rulings from `<store>/rulings.md` when present (binding), then the last 40 verdict lines `op | verdict |
summary` (a reject carries its first finding), oldest lines dropped until the page stays under 12 KB. The
whole page goes into every call, which is what keeps one validator consistent across ops.

**Runtimes.** `validator.runtimes` in `config.json` (default `[gpt-5.6-sol, claude-opus]`: Sol first, Opus as
the fallback) names the providers in order; the same `{runtimes: [...]}` shape as `supervisor`. A provider the
allocator reports as cooling is skipped rather than tried; a provider that errors moves the chain on. Usage is
read through `runHeadlessWithUsage` and recorded with the verdict. `runLoop({validateOp:null})` runs without
the validator and writes `validator-skipped` once; tests inject a stub the same way.

## The policy table

| result | action | bound |
| --- | --- | --- |
| `done`, checks reproduce | commit the allowlisted changes, ledger item `implemented` (`verified` for a review) with evidence `{opId, head}`, release the runtime | - |
| `done`, a check fails for the kernel | downgrade to `failed`, retry the same op with the failing check as the finding | retry bound |
| `done`, a changed file maps to a record kind the op's `writes` does not declare | downgrade to `failed`, `io-undeclared-write`, retry with one finding per file (`produced a <record> record it does not declare`). No model is asked and this runs before the validator | retry bound |
| `done` from an intake whose reconciliation table does not hold | downgrade to `failed`, `reconciliation-rejected`, retry with the named findings; a checker that threw is `reconciliation-failed` and the intake settles as before the rule | retry bound |
| `done` from an intake whose table holds | `reconciled {reference, conflict, new}`; every `conflict` row becomes a `needUser` `decision` item (`reconciliation-conflict`) answered by `workflow-answer --op <intake op>`; the workflow finishes `blocked` on an unanswered one | - |
| `done` from an `interface.draw` whose render checks fail | downgrade to `failed`, `render-check-failed`, retry with one finding per failing check; a passing run is `render-checked`, a hook that threw is `render-check-unavailable` and the drawing is judged as before the rules | retry bound |
| a done node whose stored `contractDigest` is not the current one for its `contractKind` | `markReopened` with the reason `proof-under-old-rule`; its lane runs again under the rule that holds now. A node that stores no digest at all is left alone until the owner asks | one reopen per declaration change |
| `done`, checks reproduce, the validator rejects | downgrade to `failed`, retry the same op with the validator's findings | 2 rejects per op, then `blocked` + `needUser` |
| `done`, checks reproduce, the validator is unavailable | commit anyway, count it | 3 in a row, then one `needUser` item |
| report fails `validateReport` | retry the same op with the rejection as the finding | retry bound |
| `partial` | resume the same op (`attempt+1`, `priorOpen` = `open[]`) | 5, then `decide` |
| `failed` | retry the same op with the failing checks as findings | 3, then `decide` (`retry-other-runtime` / `split` / `escalate-to-user`) |
| `ask` | `decide` `answer` or `escalate-to-user`; an answer is typed into the op's terminal and its report file is kept aside so it can report once more | - |
| `blocked` `shared-change` with paths | one shared op per distinct path set (a path-prefix overlap merges into the pending or running shared op and appends the requester); the requester is `paused` and returns to `ready` only when that op is `done`, carrying `priorOpen: ["shared change <op> done at <head>"]` | 3 new shared ops per iteration, the rest queued |
| `blocked` `shared-change` naming no path | treated as an `ask` to the kernel: the op is answered in its terminal with "name the exact paths" and reports again | - |
| a report whose op wrote a kernel-owned path | `revertProtected`, report downgraded to `failed` with the finding `operation modified kernel-owned ledger paths: <paths>`, op retried | retry bound |
| a Work node the ledger reports incomplete (no write scope, or no check) | one `work.author` op on that node's own `index.yaml`, origin `ledger`, checked by the whole-tree validator; on acceptance the tree is re-read - `record-authored` and the node's lane starts, or `record-still-incomplete` and one `needUser` item | one author op per node per workflow |
| an author op that moved `state`, `completion` or `extensions.work3.kernel` inside the record it authors | the file is reverted, the report downgraded to `failed` with the finding `operation modified kernel-owned fields (...)`, op retried | retry bound |
| an op created at run time past `state.dynamicOpsBudget`, or whose whole allowlist is outside `state.scope` | the op is created `blocked` and becomes a `needUser` item; `workflow-approve --allow-dynamic N` reinstates it | 6 dynamic ops per workflow |
| two `stalled-silent` settlements of one runtime within 30 minutes | `allocator.failed(runtime,{reason:'rate-limited (inferred from repeated silence)'})` and a `rate-limit-inferred` event | the window is cleared after it fires |
| `blocked` `srs-gap` from a **builder, a prover or a design op** | on the Work ledger: `markReopened` the business node the report names (or the one in the op's module) and create the route's `business.revise` op on that node's `index.yaml` and SRS folder, whose own check is that the Work tree still validates; `markDecided` settles it with a bumped `rev` when the op is accepted (`reopenRecordOwner`, event `srs-gap`). The blocked op is reopened behind it exactly as for `sds-gap` and reads the settled requirement on its next attempt. With no Work tree, or no business node to revise, the requirement is the owner's and the kernel says so rather than guessing | 2 rounds per node, then the user |
| `blocked` `sds-gap` from a **builder or a prover** | on the Work ledger: `markReopened` the architecture node the report names (or the one in the op's module) and create the route's `architecture.revise` op on that node's `index.yaml` and SDS folder, whose own check is that the Work tree still validates; `markDecided` settles it with a bumped `rev` when the op is accepted. On a plan ledger: an `architecture.decide` op on the design inputs, re-planned with `planOp` afterwards. Either way the blocked op depends on it and resumes afterwards | - |
| `blocked` `sds-gap` from an **intake** | the 5.1 rule that let an intake report what a decided record must become as `sds-gap` is withdrawn. An intake edits no record of another feature and files no gap against one: a change to what that record decided is a `conflict` row the owner decides, or a `new` row the feature declares. The route still exists for every other kind, and an intake that raises the blocker anyway is answered by the same route - but its contract and the validator rule both say it is a defect of the report | - |
| `blocked` `interface-gap` | the route's `interface.draw` op on the same node; the reporter is reopened behind it | - |
| `blocked` `grammar-gap` | the route's `grammar.update` op, allowlisted to the `grammar` repository of the workspace binding plus the canon (`knowledge/grammars/**`, `knowledge/patterns/fe/**`) and to nothing of the product, with the whole canon as its references and the acceptance "the grammar renders `<detail>`", "published at a new version and the consumer imports it", "the canon names the new unit"; the reporter is reopened behind it and reads the canon again. A binding with no `grammar` role creates nothing: one `environment` item naming `role \`grammar\` in .workspaces/projects/<project>/work.json`, a `grammar-unbound` event, and the requester stays `blocked` | 2 rounds per node |
| `blocked` `environment` / `authority` naming something only the owner can provide (a credential, an account on an outside system, a real dataset, a legal authority) or an effect nobody can undo | one `owner.ask` op, the requester **paused** (`owner-ask-opened {stop}`); the prepared question is a `needUser` `decision` item | - |
| `blocked` `authority` naming neither | one `owner.ask` op, the requester **not paused** - it `dependsOn` the ask and resumes with `provisional: option <n> …`; the decision is listed under `state.provisional`, never `needUser` | - |
| `blocked` `environment` naming neither | `needUser`, op blocked | - |
| a question the runtime took provisionally, answered later | the same option is `decision-confirmed` and nothing moves; a different one is `decision-overturned` and every done node whose kernel block lists that decision is `markReopened` and planned again | - |
| an op that asked for Work-tree record paths **and** code paths | split: `ledger-path-refused` for the record paths, the code paths continue as the scoped shared op. Record paths alone are refused in the op's own terminal, never a `needUser` item | - |
| a shared change already at `SHARED_DEPTH_LIMIT`, inside this repository | one `work.author` op authoring a Work node for exactly those paths (`shared-authored`), scheduled like any node; the requester waits for it as for any shared op | - |
| an op whose launch attempts (`chain-exhausted`) or `stalled-idle` restarts are spent | `launch-cooling`, then `launch-readmitted` after `RATE_LIMIT_COOLDOWN_MS` with its counters cleared | `LAUNCH_DAILY_CAP` (6) re-admissions per op per day, then one `environment` item |
| review with findings | one repair op of the lane's build kind on the files the findings name inside the group's allowlists, then a fresh review | 3 rounds per ledger group |
| review rounds spent | one more repair on the strongest implement runtime the group has not had (`verify-escalated`), plus the review that judges it; findings citing no decided record open a provisional `owner.ask` first (`verify-hidden-decision`) | `VERIFY_ROUNDS * 2` escalations per group per day, then `verify-parked` + one `review` item |
| a `uat.verify` op reporting `failed` | one repair op of the lane's build kind, and the UAT run itself reopened behind it | the same 3 rounds per node set |
| failing gate | one repair op whose findings are the tail of the gate output, then the gates again | 3 rounds |
| `stalled-prompt` / `stalled-silent` / `dead` from the tick | `settleDispatch(close)` and requeue on another runtime | 3 restarts |
| nothing launchable and nothing running | `needUser`, stop `blocked` | 3 iterations |

A review never runs on a runtime that implemented the ledger items it judges (`avoid`), and two ops whose
allowlists overlap - or whose resource locks clash - never run at the same time, so one worktree stays safe
for a whole pool.

## The guards the kernel owes itself

`kernel/guards.mjs` is the only place these mechanical protections live; the kernel reaches every
one of them through `ctx.guards` (default `kernelGuards`), so a host or a test can inject the contract, and a
tree shipped without the module falls back to a minimal implementation of the same contract.

| guard | what the kernel does with it |
| --- | --- |
| `protectedPaths(node, repoRoot)` | the node's `index.yaml` (where `state`, `completion` and `extensions.work3.kernel` live) and its `evidence/**`. Every contract of that node lists them under **Never touch (kernel-owned)**; `changedFiles` excludes them, so no operation commit can ever carry one. An op is granted one only when its own allowlist names that exact file - how an `architecture.decide` op authors the design body of its node, and how a `work.author` op authors the record of its own - never through a directory glob. Inside a record an author op holds, `state`, `completion` and `extensions.work3.kernel` are still the kernel's, guarded by `guardRecordBlocks` comparing them before and after |
| `revertProtected(git, {cwd, paths})` | run before any machine verification. The kernel fingerprints those paths right after its own `markInProgress` write, so only the operation's edits are caught; a changed fingerprint is reverted and the report is downgraded to `failed` with the finding `operation modified kernel-owned ledger paths: <paths>`. A completion an agent writes itself is a claim, not a record |
| `resourceLocks(op)` / `resourcesClash(a, b)` | the declared `op.resources` plus what the op's kind and check commands prove it reaches for (`postgres`, `e2e-runtime`, `docker`, `cluster`). The scheduler treats a clash exactly like an overlapping allowlist, and the contract renders them under **Resources** |
| `gitQueue(fn)` | every git mutation the kernel makes - the op commit, the ledger commit, a protected-path revert - runs alone through this queue, because one worktree has one index |
| `preflight({worktree, git})` | once at the start of `runLoop`: the fixes it applied and the problems it could not are one `preflight` event, `state.preflight`, and - for a problem - a `needUser` item |

## Bounds on what a run may grow

The kernel creates ops at run time (reviews, repairs, shared changes, design decisions, gate repairs, newly
schedulable Work nodes). Two bounds keep that from drifting away from what the user approved:
`state.dynamicOpsBudget` (64) caps how many run-time ops a workflow may create, and an op whose whole
allowlist falls outside the approved `scope` is refused the same way - matched against the scope entries that
name a path or a feature folder, since a scope given as a Work node id constrains the ledger and not a file
path, and never against an op derived from a node the ledger already scoped. A refused op is still
created - so the graph and the final report name it - but it is `blocked` with a `dynamic-op` entry in
`needUser[]`, and `workflow-approve --id <id> --allow-dynamic N` is how the user lifts it.

A shared change is the other growth path, and it is disciplined: the blocker must name concrete repository
paths (one that names none is sent back to the operation as a question), identical and prefix-overlapping path
sets share one op with every requester appended to it, at most three new shared ops are created per iteration,
and a requester waits `paused` - never `pending`, so nothing reschedules it early.

Anything the table cannot settle becomes an entry in `needUser[]`, and the workflow stops with outcome
`blocked` and a `final-report.json` that says exactly what a human has to decide.

## Writing the ledger back

Every write to a Work node goes through `kernel/ledger.mjs`, which owns exactly four things -
`state`, `completion`, `extensions.work3.kernel` and the evidence manifest - and preserves every other
authored line byte for byte. The kernel calls it at four points:

| when | call | what it records |
| --- | --- | --- |
| an op launches | `markInProgress` | `opId` and `dispatch` in the kernel block; `state` stays `todo`, because Work v2 authors only `uninvestigate`, `todo` and `done` |
| a lane step is accepted and another follows | `markInProgress` again + a `lane-step` event | the step that just landed; the node is still `todo`, because its lane is not walked |
| the LAST lane step is accepted | `markDone` + its evidence manifest | the checks every step of the lane proved, the assertion each one covers, the head, a `completion` bound to the digest the validator reports after the kernel block was written, and - when the kernel has a digest seam - `contractDigest` with the `contractKind` it was taken for |
| a decision op is accepted | `markDecided` | a collocated `starci/design-review@1` with one observation per authored assertion - a decision is never settled by an execution receipt |
| a reported `sds-gap` | `markReopened` | the node returns to `todo` with the reason, and its stored proof is kept as history |
| a sync finds a proof under an older declaration | `markReopened` | the same, with the reason `proof-under-old-rule: <node> was proven under an older declaration of <kind>` |

The evidence manifest itself says what it proved against: `writeEvidence` accepts
`proof: {boundary: api | live, fakes: [provider ids]}` and writes it whole, `boundary` being required once a
proof is given at all and `fakes` defaulting to the empty list. `e2e.verify` writes `boundary: api` and names
every provider it faked; `integration.verify` writes `boundary: live` and may name none. That field is the
whole of what lets a status view say an integration was proven against a fake rather than live.

A refused write is never silent and never fatal: `work-ledger` restores the node's original bytes, the
refusal is a `ledger-write-failed` event, and the workflow carries it to the user instead of reporting a
green slice over a ledger that does not say so. The most common refusal is honest - `markDone` will not
write `done` unless a passing check proves every assertion the node authored.

The op's own commit carries a `Work: <node id>` trailer; the kernel's ledger write is committed after it, in
its own `work(<node id>): ...` commit scoped to that node's directory, so the tree is never left dirty. Both
commits go through `gitQueue`, and the node's `index.yaml` and `evidence/**` are kernel-owned for the whole
life of the op: see the guards above.

### When the ledger belongs to another repository

The tree a job works is resolved once, before the store exists, by `kernel/routing.mjs`:
`--ledger-root`, else the host route registry, else `<repoRoot>/.starciwork`. A frontend job therefore works
the Work tree its backend owns — see **Shared ledger across repositories** in
[work-ledger.md](work-ledger.md) for the resolution rules and what a shared tree changes.

Inside the kernel this splits `ctx.work` in two: `ctx.work.code` is `{repoRoot,origin,repository}` of the
worktree this kernel commits code in, and `ctx.work.ledger` is `{repoRoot,workRoot,repository}` of the tree
it records Work in (`ctx.work.at` is the `{repoRoot,workRoot}` pair every `work-ledger` call takes, and
`ctx.work.shared` says whether they differ). Candidate filtering asks with `ctx.work.code.repository` and
`ctx.work.side`, so a frontend workflow picks only the nodes its repository delivers; source identity and
evidence name `ctx.work.code`; the ledger write and its commit happen in `ctx.work.ledger`. `state.ledgerRoot`
and `state.ledgerOwner` are written at goal time and reused on every resume, `workflow-status` reports both,
and `workflow-goal|run|status` all accept `--ledger-root`. The workflow directory itself follows the ledger:
a repository that shares another's tree keeps no `.starciwork` of its own, so
`.starciwork/_local/workflows/<id>` lives in the owner.

A shared-ledger run records `ledger-shared {owner,root}` on its `ledger-loaded` event and refuses to start at
all when the owner's tree carries pending changes the kernel does not own (`ledger-shared-dirty`, then
`blocked` with a `needUser` item naming the files).

## Lanes: one workflow, one worktree

A **lane** is the worktree one workflow owns. This is not the kind lane a node travels ([Lanes and
routes](#lanes-and-routes)); it is the place the whole workflow happens: the kernel, every operation and every
commit of that workflow, on a branch of its own, as one top-level Orca row `[Workflow] <id>`. Two workflows
never share a worktree, because that is what made three workflows' agents hang under a single row with no way
to tell whose operation was whose.

`workflow-goal --lane [<name>]`, run from the base worktree (repository R on branch B), does four things
before the goal phase:

1. `orca worktree create --repo path:<R> --name <name> --base-branch <B> --setup skip --no-parent` - the lane
   is a git worktree of R on a branch Orca names; the receipt's path and branch are recorded, never guessed.
   The default name is the workflow id. A name Orca already has is Orca's refusal, surfaced as it came.
2. `orca worktree set --display-name "[Workflow] <id>" --workspace-status in-progress` - the row the owner reads.
3. the goal phase runs with `worktree = <lane path>` and `branch = <lane branch>`, so every operation, check
   and commit of this workflow happens in the lane; goal.md names the lane and the base under its title.
4. `state.lane = {name, worktree, branch, orcaId, base:{worktree,branch}}` is a fact of the workflow from then on.

`--lane` is refused from inside a lane (`state.lane` of another workflow pointing at this worktree): a lane
never opens a lane of its own.

**Where the store is.** The lane does not move the workflow directory: `createStore({repoRoot})` resolves the
repository through the git common dir, which a lane shares with its base, so
`<R>/.starciwork/_local/workflows/<id>` is found from the base worktree and from the lane - the supervisor
polls either one and starts the kernel with `cwd` = the lane.

**The ledger.** A lane of the repository that OWNS the Work tree has its own `.starciwork` on its branch, and
that is the point: those records are merged back with the code. A lane of a code repository that routes to a
shared ledger (a frontend) keeps writing the owner's tree exactly as before - the lane changes the code root,
not the routing.

**Merge-back.** When the workflow finishes `done`, `finish` runs in the base worktree:

```
git merge --no-ff --no-edit -m "merge(workflow): <id> - <lane branch> into <B>" <lane branch>
```

On success: `lane-merged {id,branch,base,commit}`, `orca worktree set --workspace-status completed`, and the
lane worktree is left in place for the owner to read. On a refusal - a content conflict, a pending change in the
base that the merge would overwrite, or a base worktree that has since moved to another branch (a merge takes
whatever is checked out there, so a different branch is not this lane's merge at all) - the merge
is aborted, `lane-merge-conflict {files}` is recorded, a `needUser` item of kind `merge` names the files, and
the workflow finishes **blocked** instead of done. Nothing in the base worktree is ever stashed, reset or
force-merged: it may be somebody's working copy with a kernel of its own. The work is not lost either - it is
committed on the lane branch, waiting for the merge the owner performs.

`workflow-lane-close --id <w>` removes a merged lane's worktree (`orca worktree rm --force`) and keeps its
branch (`lane-closed`, with the preserved branch). It refuses while the kernel is alive (`workflow-stop`
first) and while the lane has not been merged.

## The single-candidate launch

5.0 allocates one runtime per op, so the launcher must try exactly one candidate.
`startOperation(input,{candidates})` is that seam: the launcher takes the resolved selection instead of
resolving a chain, so nothing has to pretend a target was unavailable. `launchWithCandidate` still proves
the allocated target belongs to the operation's declared environments, rebuilds the request from the
candidate alone so a mismatch is caught before any Orca effect, and records **why the other targets were
not used in the kernel's own `launched` event** (`allocation.notAllocated`), never as a fake launcher
attempt. Allocation itself is kept inside `allocator.launchableTargets(kind)`, so a runtime whose role has
no profile for that operation is never chosen and then rejected.

## Runtimes are shared across workflows

Several workflows of one repository run at once, each with its own kernel and its own allocator, and the
expensive runtimes are split across them, not owned by one. One file says so: the shared runtime ledger
`<workflowsRoot>/runtime-loads.json` (`kernel/loads.mjs`, schema `starci/runtime-loads@1`), beside
the workflow directories every kernel of the repository already shares.

```json
{"schema":"starci/runtime-loads@1","runtimes":{"claude-fable-5.1":{
  "live":[{"workflow":"20260912-101500-nivo-setup","op":"op-decide","since":1789000000000}],
  "cooling":{"until":1789000600000,"reason":"HTTP 429","kind":"rate-limited","workflow":"20260912-101500-nivo-setup"},
  "usedToday":3,"day":"2026-09-12"}}}
```

The kernel records a launch (the allocation was accepted **and** the operation actually launched), a release or
a failure, and a provider cooldown; at start it drops its own leftovers - entries of this workflow whose
operation is no longer running (`runtime-loads-swept`). Writes are atomic (temp file, rename) under a `.lock`
beside the file carrying pid and timestamp, retried with short waits and broken when it is stale (30 s) or its
pid is dead. Entries of a workflow whose kernel is dead - no live pid in its `kernel.lock` - are ignored on
read and dropped on the next write, so a crashed kernel never holds a slot of Fable for the others. A
cooldown outlives the kernel that found it: the limit belongs to the provider.

What it changes in allocation, with `createAllocator({shared:{path, workflow}})`:

- another kernel's live operations on a runtime count as **load**, so `maxParallel` is the runtime's cap across
  the repository instead of per workflow;
- a cooldown another kernel ran into is a cooldown here (`runtime-cooling-shared {runtime, until, from}`, once
  per learned cooldown); only provider limits are published - a rate limit and an exhausted quota - while an
  auth or local failure stays the kernel's own;
- among the candidates that all qualify - role, free slot, budget, no cooldown - the one **no other kernel is
  using** wins, and inside one shared load the local order decides (preference, then ratio, then chain order).
  So a second workflow's hard operation goes to Astra while Fable carries the first one's, and the receipt says
  so: `allocation-shared {op, runtime, preferredOver:[...], sharedLoad:{runtime:n}}`.

The quota proposal reads the same file: when the first runtime of a kind's launch chain carries live operations
of another workflow, the next chain runtime that has the role is proposed a slot too, with the reason in the
row (`... is busy with <workflow>`), so a lane opened while another lane is on Fable proposes Astra without the
owner saying "prefer Astra, Fable is busy".

What it never changes: **a workflow's own quota.** The slots and order the user approved stay that workflow's
cap, the per-workflow `maxParallelOps` is unchanged, and nothing shared ever widens them. And the ledger is
never a gate: an unreadable, missing or foreign file reads as nothing shared, so allocation degrades to the
local behaviour and a launch is never blocked by it.

## The operation contract

`renderContract` owns every concrete value - the lane line (`Lane: interface.draw -> frontend.implement ->
uat.verify (this op: step 2 of 3)`, so an operation knows what came before it and what will judge it), goal,
goal items, allowlist, the kernel-owned paths the op may never touch, its resource locks, references, inherited
open items, findings, acceptance, the exact check commands, the checks file, the report command with
`--reports-dir`. A design-family operation also gets the short `## Brand` block under its references (see
[Brand and artwork](#brand-and-artwork)).
Between the acceptance and the process prose it splices the kind-specific working order from
`kernel/contract.mjs` (`stepsFor`): see [op-granularity.md](op-granularity.md), "Working order per kind".
The process prose (`## Cook until done`, `## Ping (mandatory)`, `## Never`) is reused verbatim from
`docs/supervision-templates/op.md`, so one template serves every operation kind and no placeholder survives
into a rendered contract.

## The final report

`final-report.json` carries the outcome and reason, the branch and head, the definition of done, every
ledger item with its evidence, the gates, `needUser[]`, and every op with its runtime, node, commits and
verdict. On the Work ledger it also carries `ledgerMode`, `scope`, the open `decisions` and a
`ledgerSummary` re-read from the tree at the end, so the report states what the ledger says now rather than
what it said at approval.

## Supervision without an agent

A workflow has no monitor agent. Three layers keep it running on their own:

- **Supervisor (process, `workflow-supervise`)**: one long-running program per repository. Every poll it reads `_local/workflows/*/state.json`, `events.jsonl` and `kernel.lock`; an approved, unfinished workflow with no live kernel is started (`workflow-run` detached), a kernel whose log stays silent past the health window (default 25 min, one wait tick plus slack) is killed and started again. Finished, stopped (`stop.flag`) or unapproved workflows are left alone. Log: `_local/workflows/supervisor.log`.
- **Reconcile (kernel, start + every 10 ticks)**: the kernel compares Orca's `worker-list` of its Run with `state.ops`; a live Dispatch no operation names is an orphan and is settled (`reconciled-orphans` event). This is what a restarted kernel needs to trust its own state again.
- **Triage (LLM, closed options)**: the policy table handles known outcomes (done/failed/question/shared-change/stall/rate-limit). When the same anomaly signature repeats `TRIAGE_AFTER` (3) times, the kernel asks the `decide` function once, offering only `resume-ops | park-runtime | settle-op | restart-kernel | needUser`; the pick is applied, recorded (`triage` event) and never asked again for that signature in the workflow. Without a decider (tests, `--functions` off) triage is a no-op and the anomaly stays a counter.

```
node <skill root>/bin/starci.mjs workflow-supervise --host <skill root> [--once true] [--id <workflow-id>] [--poll-ms 60000] [--health-ms 1500000]
```

### Supervisor level

`config.json` (host-local, gitignored) may carry `supervisor.runtimes`: the models triage and the `decide` role prefer, strongest first. The default is `[claude-fable-5.1, gpt-6-astra]`; lower it (for example to `[claude-opus]`) to save budget. Only ids declared in `model/runtimes.yaml` take effect; the rest of the profile's `decide` preference follows.

### Review rounds and the dynamic budget

A review round is counted per reviewed node set (`verifyRounds[<ids joined by +>]`), never per feature: counting per module burned a feature's three rounds on three different nodes. After the last round the group is parked as `review-exhausted` with one needUser item instead of being re-planned every tick. Ops the kernel derives itself (origins `ledger`, `verify`, `gate`, `architecture`) never count against `--allow-dynamic`; only `shared` and `repair` ops do, and `--allow-dynamic 0` forbids them.

## Terminals

The kernel is one Orca tab, `[Kernel] <id>`, in its worktree, and that tab is the Run's coordinator: a start
reuses the tab a previous start left (and closes a duplicate); a pause or a rebuild leaves it in place; only a
finished workflow closes it (`kernel-terminal-closed`). A kernel that finds the Run bound to a tab that is gone
re-binds the Run to its own tab once (`run-rebound`), which fences the old tab's live Dispatches. An op's tab
is closed when its report is accepted (`op-terminal-closed`); a blocked or failed op keeps its tab, which is
where its last words are. Every reconcile also sweeps what an older build left behind - stale `[Kernel]` tabs
and done-op tabs of this workflow (`terminals-swept`) - and never touches another workflow's tabs.

## The worktree is trusted before the agent opens it

A TUI agent asks whether it may trust a folder it has never been opened in, and Orca's pasted task lands in
that dialog: the start times out (`agent_prompt_stalled`) and the agent exits. Before every managed launch the
launcher grants trust to the exact worktree the way the agent records the owner's own answer - Claude Code in
`~/.claude.json` (`projects[<path>].hasTrustDialogAccepted`), Codex in `~/.codex/config.toml`
(`[projects.'<path>'] trust_level = "trusted"`) - touching nothing else in those files; the attempt record
carries `trust: {action: trusted | already-trusted | no-dialog}`.

## A coordinator tab whose pane is gone is replaced

Orca refuses every launch from a coordinator tab whose pane died ("The coordinator terminal has no stable pane
identity"). The kernel treats that as its own tab to replace, never as the runtime's failure: the old handle is
closed, a fresh `[Kernel] <id>` tab is opened, the Run is re-bound to it (`coordinator-tab-recovered`), and the
op stays ready for the next tick - once per attempt.

## A tab exists only while its op runs

Every five minutes (and at every reconcile) the kernel closes every tab of this workflow that nobody reads:
a stale kernel tab, the kernel tab of a sibling workflow of the same store root that finished or whose kernel
is gone, and the tab of any op that is not on it right now - matched by the handle the op holds as much as
by its title, so a tab whose rename never landed is found too - done, blocked, retried or pending alike
(`terminals-swept` with the op's status as the reason). Tabs of other workflows and tabs the owner
opened are never touched. A kernel paused by `stop.flag` closes its own tab too (`kernel-terminal-closed`
with the reason); the next start opens one and re-binds the Run.

## The validator judges by the record on disk

The brand payload the validator receives is read again from disk when the op wrote the brand record itself:
the summary the last sync read is what the op was told to change, not what it is judged by. A retry closes
the failed attempt's tab and a validator-exhausted block closes the op's tab (`op-terminal-closed`): a tab
without a reader is not left idle in the sidebar.

## A command reaches a running kernel within one tick

The wait for running operations is sliced (`tickMs`, two minutes), and between two slices the kernel looks
for a queued inbox command or a stop flag: either ends the wait (`wait {result: "woken"}`) so the next
iteration applies it, instead of the command sitting until the whole wait for the running operations is over.

## Avoided runtimes expire

A runtime an op learned to avoid - it failed to launch there, stalled there, was rate-limited there - is
avoided for the rate-limit cooldown (one hour), not for ever: the avoidance carries its stamp
(`op.avoidedAt`) and `readmitCooled` opens the runtime to the op again once the cooldown has passed
(`avoid-expired`). A verify op's avoidance of its implementers carries no stamp and never expires: that one
is independence, not a failure.

## Approving again after a blocked finish

A workflow that finished `blocked` stopped for the owner's decision, and `workflow-approve --id <id>` on it is that
decision: the finish is cleared (`resumed-after-block`, with the ops it re-admits) and every op a limit had
exhausted - the validator's two rejections, the launch attempts, the restarts, a stall - goes back to `ready`
with its counters at zero, the runtimes it had learned to avoid open to it again, and its question gone
(`op-readmitted`). An op the kernel refused on principle
(superseded, out of the repository, a dynamic op over budget) stays refused: approving again changes nothing
it was refused for. The supervisor then starts the kernel, which carries on from where it stopped.

## A red tree counts against an op only where the op could have caused it

The whole-tree check the kernel proves for an op (`work-valid`) is scoped (`treeVerdictFor`): an error under the
op's allowlist, in the files it reported or on the node it closes is the op's; every other error is foreign -
reported as `ledger-invalid`, listed in the check's evidence, never the reason the op is rejected. Ops the
validator exhausted on the whole-tree check are judged again as soon as every remaining error is foreign to them
(`op-readmitted`), inside the sync's red branch, which is where a live tree is actually red. A triage
`restart-kernel` is a restart request of the loop (`stopped: restart: triage restart`), never a stop flag, which
the supervisor would honour as a pause until someone removed it. On a shared ledger every contract says where the
one tree lives (`## Where the Work tree lives`), so a `.starciwork` folder created in the code worktree is named a
defect before it is made.

## Strays that break the tree are quarantined

An invalid tree whose every error sits under an untracked path that no live operation owns is what an
abandoned operation left behind - never the owner's draft, which would be tracked or owned. The kernel moves
those paths whole to `<store>/strays/<timestamp>/` (`stray-quarantined`), reads the tree again, and when it is
valid again (`ledger-valid-again`) re-admits the ops the validator had exhausted only for a red whole-tree
check (`op-readmitted`). Every untracked stray that carries an error and that no live op owns is moved, whether or not other errors sit on tracked paths: what the kernel can clean it cleans, and the rest is reported as it is.

## Hosts: Orca and headless (one chat = one workflow)

The kernel runs on a **host**, and it reads exactly three things about it: a name, the capabilities it offers
and whether it runs operations in parallel (`hostDescriptorOf(orca)`). Those three facts are declared per host
in `model/hosts.yaml` and loaded by `hosts/index.mjs` (`loadHosts`, `hostDescriptor`, `validateHosts`), so the
two adapters read one source instead of each holding a constant, and `validateHosts` checks every offered
capability against the `capabilities` vocabulary of `model/kinds.yaml` - the same vocabulary a kind's `needs`
is drawn from. Each adapter keeps the shipped values as the fallback for a tree with no `.dist` yet: a host
must be able to describe itself before a build exists. Two hosts exist.

- **Orca** - `hosts/orca/calls.mjs`, `ORCA_HOST = {name:'orca', capabilities:['design-tool'], sequential:false}`:
  the multi-agent IDE with terminals, a dispatch mailbox and a run coordinator, the runner every command always had.
- **Headless** - `hosts/headless/host.mjs`, `HEADLESS_HOST = {name:'headless', capabilities:[], sequential:true}`:
  the same `invoke(command, params, {cwd}) -> starci/orca-call-result@1` surface, answered with child processes
  and files, so not one line of the kernel knows which host it is on. It is what a plain Claude Code chat or a
  Codex chat uses to drive a workflow without Orca: **one chat = one workflow**, not multi-agent - operations
  run one at a time as headless CLI processes (`claude -p`, `codex exec`, `qwen`) in the workflow's worktree.

**Selection.** Every launcher command takes `--host-adapter orca|headless` (default `orca`); `headless` is also
selected when `STARCI_HOST=headless` is in the environment, which is what the kernel sets on every operation
process it spawns, so a child's own `report` reaches the host mailbox with no flag. `workflow-run` records the
host as `state.hostAdapter`, and the supervisor starts the next kernel of that workflow with the same
`--host-adapter`: a workflow never changes host behind the owner's back. The supervisor itself only spawns
launchers, so `workflow-supervise` works on either host; on the headless one its budget probe reports
`budget-probe-failed` with the host's reason (see `account list` below) and the last written budget stands.

**What the headless host does with each call.** Its files live in `<store>/headless/` once the kernel has bound
its workflow store (`bindStore`), and in `<repo>/.starciwork/_local/headless/` before one exists (a lane opened
at goal time). A child process finds the same directory through `STARCI_HEADLESS_ROOT`; a `report` run by hand
finds it beside the `--reports-dir` it was given.

| call | headless answer |
| --- | --- |
| `worker-start` (managed agent) / `dispatch` (command terminal) | spawns the runtime's own headless command line from `HEADLESS_PROVIDERS` (`claude -p --output-format json`, `codex exec --json`, `qwen --approval-mode yolo ...`), detached, in the operation's worktree, with a short preamble (task, dispatch, terminal handle, "there is no `orca` here, skip the ping") plus the contract on stdin; stdout/stderr go to `<dispatch>.log`, the prompt to `<dispatch>.prompt.md`. Permissions are exactly what those command lines carry and nothing more. A launch asked for with no model passes none - the agent's own default, as Orca's `worker-start` without `--model` - and reports `model: null` back. A model no headless line exists for is a failed launch (`no headless command ...`), never a substitute |
| `send` / `check` | `send` appends one line to `mailbox.jsonl`; `check` reads the unacknowledged messages of the run, hands them out under a delivery id, acknowledges a delivery on `--ack` and delivers an unacknowledged one again, so `singleTick` works unchanged. A blocking check ends when a message lands, when a process it watched exits, or at the timeout. A `--peek` for heartbeats answers one ping per live process: liveness is the heartbeat this host can vouch for |
| `worker-list`, `task-list`, `terminal-list`, `dispatch-show`, `worker-show`, `run-*` | `table.json`, every pid checked alive on read. A dispatch stays listed until the kernel releases it, because the kernel settles only what it is shown. The run coordinator is the handle string the kernel gave (`term_h<n>`, its own synthetic terminal, found again by title on the next start) |
| `terminal-create/read/send/rename/close` | handles in the table, no pty. A terminal's screen is made of the facts of its process: running for N minutes with the busy markers, exited (with the log tail), or past the wall-time bound (90 min, the same bound the Orca qwen command line carries) with no activity claimed. `send` to an exited process is a failed call, so the kernel records an answer as undelivered instead of believing a screen; `close` on a live process ends it - the terminal is the process here |
| `worktree-create/set/show/rm` | `git worktree add -b workflow/<name> <repo>/.worktrees/lanes/<name> <base>`, a metadata write, `git rev-parse`, `git worktree remove` with the branch preserved |
| `agent-context` | the calls contract itself, so `verify` passes |
| `account list` | `outcome: 'unsupported'` with a reason, never a throw; `probeBudget()` returns `{ok:false, reason}` |

**Sequential, by construction.** `createAllocator({sequential:true})` (`sequentialRuntimes`) caps
`maxParallelOps` at 1 and every pool at one slot, after the quota is applied so no approved allocation widens
it; `workflow-run` passes `host.sequential`, and the `host` event of every run says so. Two reasons, both
structural: the operations are detached processes in one worktree with no terminal to supervise them from, so
two of them would race on the same index and the allowlist arbitration a chat cannot see; and one chat drives
one workflow - the owner reads one operation's outcome at a time. The scheduler's overlap, resource-lock and
dependency rules still apply on top.

**Liveness without a screen.** A headless process prints nothing until its turn ends, so the observer reads
facts instead: a live pid inside the wall-time bound is `working` (and pings), a gone pid is `dead` (the kernel
settles it and relaunches on another runtime, as for any dead worker), a live pid past the bound is
`stalled-silent` and is settled the same way. An `ask` cannot be answered into a process that has already
exited: the kernel's answer is recorded as undelivered, the op is relaunched, and the answer travels in the
contract of that next attempt (`## Answer to the question you asked earlier`) - on every host alike.

**Capabilities.** `model/kinds.yaml` may give a kind `needs: [<capability>]` from the closed vocabulary
`capabilities` (`design-tool`; `CAPABILITIES` in `kernel/graph.mjs`, `needsOf(kind)`). `interface.asset`
needs `design-tool` (the image model that generates the declared artwork), which only Orca declares; every other
kind runs anywhere - `interface.draw` included, because a drawing is the installed grammar rendered in a browser
(one candidate per screen and viewport, the main state only; loading, empty and error are described in the
record and rendered by the build from the grammar's state contracts), never an image-model painting. At schedule time an op whose kind
needs what the host lacks is refused: `blocked` with `refusal: 'host-unsupported'`, one needUser item
`{op, kind:'host', detail}`, event `op-host-unsupported {op, kind, host, missing}`, and the workflow carries on
with everything else. On a frontend feature that means the design gate keeps holding the `frontend.implement`
lane behind the ui node (`lane-waits-design`) - correctly: there is no drawing to build from - so the workflow
finishes `blocked` naming the host item and the ledger items it could not verify. `workflow-approve` from a
host that has the capability re-admits such ops (`op-readmitted {op, host}`), clears their host item and, as
for any blocked finish, lets the supervisor start a kernel on that host; an approval from a host that still
lacks it changes nothing. An approval queued to a *live* kernel (the inbox) is applied by that kernel on its
own host, so the re-admission is given to a kernel on the capable host: stop the headless kernel, then approve
from Orca.

**Driving a workflow from a chat (Claude Code or Codex).** The assistant is the owner's hands, never an agent
of the kernel:

1. `workflow-goal --job "<text>" [--lane] --host-adapter headless` (or export `STARCI_HOST=headless` once);
   the assistant reads `goal.md` back to the owner, who approves in the chat.
2. `workflow-approve --id <id>` - the one human gate, unchanged.
3. `workflow-run --id <id> --host-adapter headless` in the background (or `workflow-supervise --host <.claude>`
   with `STARCI_HOST=headless`, which restarts the kernel after a crash or a rebuild exactly as on Orca).
4. The assistant polls `workflow-status --id <id>` and the events, relays every `ask` the kernel escalated
   (`needUser` kind `authority`) and every other needUser item (`host`, `ledger`, `environment`, ...) to the chat,
   and the owner answers with the commands of the table below - `workflow-approve` again, an authored record, a
   `workflow-stop`. `.starciwork/_local/workflows/<id>/headless/<dispatch>.log` is where an operation's process
   left its output when the assistant needs to read one.

## Operating a running workflow

Everything an operator does is a command or a file the kernel reads; nothing is a write to `state.json`, which
the kernel holds in memory and saves over at every tick. Every command below is
`node <skill root>/bin/starci.mjs <command> ...` - the one command line of the runtime, which forwards a
workflow command to the launcher with its argv untouched, so nothing an operator types names a module path
inside the runtime. `--host <skill root>` stays on every command that reaches a ledger, because without it
the Work tree is looked for under `<repo>/.claude`, which is not where a repository sharing another's tree
finds its records.

```
node <skill root>/bin/starci.mjs workflow-approve --host <skill root> --id <w> [--allow-dynamic N] [--allocation <runtime>=<slots>,...] [--accept-critique "<reason>"]
node <skill root>/bin/starci.mjs workflow-answer  --host <skill root> --id <w> --op <ask or intake op> --choice <n> [--note "<the owner's words>"]
node <skill root>/bin/starci.mjs workflow-status  --host <skill root> --id <w> [--json true]
node <skill root>/bin/starci.mjs workflow-stop    --host <skill root> --id <w>
node <skill root>/bin/starci.mjs workflow-lane-close --host <skill root> --id <w>
node <skill root>/bin/starci.mjs render check <ui node dir> --brand <work root>
node <skill root>/bin/starci.mjs brand check <work root> [--source <repository root>]
```

| you want | do | the kernel |
| --- | --- | --- |
| raise the run-time op budget or change the allocation of a running workflow | `workflow-approve --id <w> --allow-dynamic N` / `--allocation ...` | queued in `<store>/inbox/`, applied at the next tick (`inbox-applied`); a new allocation ends the loop with `stopped: restart: allocation changed` and the supervisor starts the kernel again within a minute |
| resume a workflow that finished `blocked` after you answered its questions | `workflow-approve --id <w>` (with `--allow-dynamic` / `--allocation` as needed) | `resumed-after-block`: the finish is cleared, the supervisor starts a kernel |
| ship a new runtime build | `npm run build` | every running kernel notices its module changed (`build-changed`), ends cleanly and is restarted by the supervisor on the new code |
| pause a workflow | `workflow-stop --id <w>` (writes `stop.flag`) | `stopped: stop flag` at the next tick; the supervisor leaves it while the flag exists; delete the flag to let it start again |
| read a workflow | `workflow-status --id <w>` | read-only |
| clean up the worktree of a workflow that merged | `workflow-lane-close --id <w>` | `orca worktree rm --force` on the lane, branch preserved (`lane-closed`); refused while the kernel is alive or the lane is unmerged |
| merge a lane the kernel could not merge | merge it yourself in the base worktree, then `workflow-approve --id <w>` | the conflict is in `lane-merge-conflict` and in the `merge` needUser item; the kernel never force-merges into a tree it does not own |
| run a workflow from a chat, without Orca | `--host-adapter headless` on every command, or `STARCI_HOST=headless` once | one operation at a time as a headless process; a `host` needUser item names an op this host cannot run (see [Hosts](#hosts-orca-and-headless-one-chat--one-workflow)) |

One thing that looks like a defect and is not: a workflow finishes `blocked` with every gate green when
questions for the user remain - the gates say the code holds, the questions say what the owner still decides.
And one that was a defect: Orca groups agent terminals by worktree, so the ops of several workflows sharing one
worktree all hang under the first run's node in the sidebar. That is what `--lane` ends - one workflow, one
worktree, one row.

## The provider quota is probed, not guessed

The supervisor follows the build exactly as the kernels do: a rebuilt launcher (`npm run build`) is seen at the
next round, a successor is started from the same command line and this one leaves (`supervisor-rebuilt`), so no
build needs a hand restart to take effect.

Every three minutes the supervisor asks Orca for the usage windows its status bar shows (`orca account list
--json` -> `rateLimits`: Claude's five-hour session, its week and Fable's own week; Codex's week) and writes
them whole beside every store root it covers as `_local/workflows/runtime-budget.json` (`budget-probed`; a
failed probe leaves the last good file and says `budget-probe-failed`). A runtime is bound by the generic
windows of its provider (`provider:` in model/runtimes.yaml) and by a named window only when its profile
names it (`budgetWindow: fableWeekly`); `budgetVerdict` says whether a window is exhausted (95% and not yet
reset) and what share is left. Kernels read the file, never Orca. The allocator folds the verdict into every
pick: a runtime whose window is exhausted is blocked (`provider window exhausted until <reset>`) until the
reset, and among the ready runtimes the one with clearly more of its window left comes first - in bands of
25 points, so a few percent never reorder a role's own chain while a half-spent week does; a runtime no window
binds (a local model, an unread provider) sits in the top band. The shared-load key still comes first. When
the budget alone moved the choice the launch says so: `allocation-budgeted {op, runtime, sparedOver:[...],
remaining:{runtime:share}}`.

## The event log, by concern

`events.jsonl` is the audit of one workflow and the only complete account of what happened: `state.json` is
a snapshot the kernel overwrites, the log is append-only. Every event the kernel emits is named here, grouped
by the module that emits it, so a line in a log can be read without opening the source. A name that appears
under two concerns is emitted by both for the same reason.

**The goal phase** (`kernel/goal.mjs`) - `goal` the assessed goal was written; `goal-assessment-failed` the
model could not fill the form and the definition of done fell back to the node list; `goal-failed` the phase
could not produce a goal at all; `goal-critiqued` the critique's verdict; `goal-critique-unavailable` no
critic answered and the goal carries on uncritiqued; `critique-overridden` the owner overrode a `refuse` with
`--accept-critique`; `approved` the one human gate passed; `intake-planned` a scope entry the tree does not
hold became an intake op (with `mode: reconcile` for a `--reintake`); `prerequisite-held` /
`prerequisite-owner` / `prerequisite-unresolved` what the critique said the goal rests on - already in the
tree, the owner's to decide, or neither; `resumed-after-block` an approval cleared a blocked finish;
`op-readmitted` an op a limit had exhausted went back to `ready`.

**Creating an operation** (`kernel/common.mjs`) - `op-created` every op the kernel adds, with why;
`dynamic-op-refused` an op past the run-time budget or wholly outside the approved scope, created `blocked`;
`routed` one report's outcome was answered by the graph's route (`{op, on, to, origin}`).

**The intake** (`kernel/intake.mjs`) - `intake-retemplated` an op planned by an older build took the current
goal and acceptance; `intake-authored` an accepted intake was settled by what the tree holds under its scope;
`reconciled` the typed table held, with the count per case; `reconciliation-rejected` it did not, with the
findings; `reconciliation-conflict` one conflict row became the owner's question;
`reconciliation-failed` the checker itself threw and the intake settled as before the rule;
`ledger-sync-failed` the tree could not be re-read and the last loaded one stands.

**The owner loop** (`kernel/owner.mjs`) - `owner-ask-opened` a question opened an ask, carrying `stop` when it
is one of the two stop reasons (the requester is paused) and `provisional: true` when it is not (the requester
only depends on the ask); `owner-ask-answered-from-record` a decided record settled it; `owner-question` a
stop question's drafted decision was listed for the owner; `owner-question-provisional` /
`owner-answer-provisional` the runtime took its own recommendation so the work could continue, and one
requester carries it; `credential-present` the owner provided something and the op confirmed only that it is
there; `owner-answered` the owner's pick arrived (`via: 'command'` or `'terminal'`); `decision-confirmed` the
owner chose what the runtime had chosen; `decision-overturned` they chose otherwise and the nodes built on it
were reopened; `owner-answer-delivered` an answer reached one requester; `need-user-deduplicated` the owner's
list was collapsed to one item per question; `decide` the supervisor model answered a mechanical question from
the closed options.

**Scheduling and launching** (`kernel/kernel.mjs`, `schedule.mjs`, `chains.mjs`, `loads.mjs`) - `created` the
workflow store exists; `host` which host this run is on and whether it is sequential; `tick` one iteration;
`wait` one wait slice and how it ended (`woken` for an inbox command or a stop flag); `launched` an operation
started, with the allocation and the runtimes not used; `launch-failed` / `launch-refused` the launch did not
happen, or was refused before any effect; `allocation-deferred` / `allocation-rejected` no runtime qualified,
or the allocated one did not belong to the operation's environments; `allocation-shared` another kernel's
load moved the pick; `allocation-budgeted` the provider window moved it; `schedule-deferred` an op was held
(a design op waiting for the brand record, an allowlist or resource clash); `op-host-unsupported` the op's
kind needs a capability this host does not offer; `op-out-of-repository` the node names another repository;
`op-blocked` / `op-paused` / `op-resumed` / `op-reopened` / `op-done` the op's transitions; `op-added` a lane
step or a newly schedulable node became an op; `accepted-early` a report arrived before the kernel asked;
`nudged` a silent operation was prompted; `stalled` the tick classified an operation as stalled or dead;
`settled` a dispatch was released; `answered` an answer was typed into an operation's terminal;
`report` a report was read; `report-rejected` it failed `validateReport` and the op comes back; `retry` /
`resume` the policy table's own transitions; `split-refused` a split the kernel does not perform;
`replanned` / `replan-failed` an op re-planned after a design decision; `triage` a repeated anomaly was
settled once through the closed option set; `finished` the workflow ended, with its outcome; `stopped` the
loop ended for a stop flag, a new allocation or a rebuilt runtime; `build-changed` the runtime's own modules
moved under a running kernel; `kernel-error` the loop caught something it could not classify.

**Budget, cooldowns and the shared ledger** - `rate-limit-cooling` a provider was parked; `rate-limit-parked`
an operation was moved off it; `rate-limit-inferred` two silent settlements of one runtime inside thirty
minutes were read as a quota refusal; `rate-limit-readmitted` the cooldown passed; `launch-cooling` /
`parked-rejudged` the owner's list was judged again under the current rule on kernel start, once per rule (its `routed` names every item and where it went);
`launch-cooling {migrated: true}` an environment line an older build or the terminal reconciliation parked (a lost agent, an idle restart, a launch nobody could take) was migrated to a cooldown by `readmitCooled`;
an ask op holding a provision or an irreversible effect (`STOP_KINDS`) is waiting for the owner in its tab by design and is never nudged or restarted as `stalled-idle`; an ask op on any other question reports `decision` at once and never waits;
A decision record has one shape in the whole runtime: a business record at `features/<f>/business/srs/business-rules/policy-decisions/<slug>/index.yaml` with the `starci/srs-policy-decision@1` section (`decisionStatus: open` while `state: todo`), `refs: []` - the shape an owner.ask writes, the reconciliation checker accepts (`isPolicyDecision`), the record catalog names and the validator's SRS layout allows. It names the records it concerns by id in its text, never as a graph edge into another feature.
`shared-change-refused {reason: record-authoring op}` an intake, a migration or a node author asked for a shared change: a record author writes records under its allowlist and delegates no code change, so it is told the rule in its next attempt; `shared-op-withdrawn` a shared op an older rule opened on such an op's behalf was withdrawn on kernel start and its requester runs again with the rule;
`owner-ask-marker-honoured` an ask op wrote `answered-from`, `answered-by-owner`, `credential` or `provided` beside an outcome other than `done`: the marker is the ruling and the ask is settled on it;
`launch-readmitted` / `launch-cap-reached` an op whose launch attempts or `stalled-idle` restarts were spent
cooled, came back, and - past `LAUNCH_DAILY_CAP` in one day - became the owner's `environment` item;
`avoid-expired` /
`avoid-reset` / `avoid-exhausted` an op's learned avoidance of a runtime expired, was cleared, or left it
with nowhere to go; `runtime-cooling-shared` another kernel's cooldown was adopted; `runtime-loads-swept` this
workflow's leftovers were dropped from the shared ledger; `inbox-applied` / `inbox-ignored` / `inbox-rejected`
a queued command was applied, was not for this kernel, or was malformed.

**Verification, the validator and the commit** (`kernel/verify.mjs`, `kernel/kernel.mjs`) -
`machine-verify-failed` a check the kernel re-ran did not reproduce; `proof` the proof by contrast and its
verdict; `io-undeclared-write` a changed file's record kind is not in the op's `writes`; `render-checked` /
`render-check-failed` / `render-check-unavailable` the canon rules over a drawing's own bytes; `validated` the
validator accepted; `validator-rejected` it rejected; `validator-finding-dropped` a finding outside the diff;
`validator-unavailable` no provider answered; `validator-skipped` there was no diff to judge, or
`validateOp:null`; `validator-exhausted` two rejections of one op; `validator-only-block` the validator is the
only thing holding the op; `commit-failed` the operation's own commit did not land; `gates` the job gates ran;
`brand-revised` an accepted `brand.decide` bumped the brand's `rev`.

**Reviews and repairs** - `verify-findings` a review returned findings; `verify-limit` / `verify-exhausted`
the review rounds of one node set ran out; `verify-escalated` that bound escalated inside the runtime - one
more repair on a runtime the group has not had, naming it; `verify-hidden-decision` the findings cited no
decided record, so the rule they argue about went to the owner as a provisional question;
`verify-parked` the escalations for the day are spent and the group is the owner's; `uat-findings` a walk
reported failures; `uat-limit` its repair rounds ran out; `sds-gap` a design gap was routed;
`grammar-gap` a grammar gap was routed;
`grammar-unbound` the workspace binding declares no grammar repository, so nothing was created;
`brand-missing` a tree that knows about brands carries no record; `brand-decide-created` the kernel created
the `brand.decide` op from the tree's own brand node; `shared-change-blocked` / `shared-change-deferred` /
`shared-change-merged` / `shared-change-refused` / `shared-change-resumed` / `shared-change-unnamed` /
`shared-change-depth` the whole life of a shared change: queued past the per-iteration cap, merged into an
overlapping one, refused, resumed when its op landed, sent back for naming no paths, or refused for nesting
too deep (which survives only for a change no feature folder can hold); `shared-authored` /
`shared-node-authored` a change too deep to delegate became one Work node instead, and that node's record
landed; `ledger-path-refused` an op asked for Work-tree record paths - refused on their own, split from the
code paths when it asked for both.

**The ledger sync** (`kernel/sync.mjs`) - `ledger-loaded` the tree was read (carrying `ledger-shared` for a
tree another repository owns); `ledger-invalid` the tree does not validate; `ledger-valid-again` it does
again; `ledger-node-missing` a node an op names is gone; `ledger-write` / `ledger-write-failed` one node
transition; `ledger-commit` / `ledger-commit-failed` the kernel's own `work(<node>)` commit;
`ledger-shared-dirty` the owner's tree carries changes the kernel does not own, so the run refuses to start;
`ledger-shared-strays` untracked paths in the owner's tree; `stray-quarantined` /
`stray-quarantine-failed` / `stray-files-reverted` / `tree-strays-removed` what an abandoned operation left
behind, moved aside so the tree validates again; `kernel-paths-modified` / `kernel-record-repaired` /
`kernel-record-repair-failed` / `record-blocks-modified` an operation wrote what the kernel owns, inside a
record or as a whole path; `record-authored` a `work.author` op made its node schedulable;
`record-still-incomplete` it did not, and the record is now the owner's; `lane-step` one lane step landed;
`lane-waits-design` an implementation node is held until its feature's ui node is done;
`lane-retemplated` / `lane-template-stale` / `lane-record-retry` a lane templated by an older profile;
`proof-under-old-rule` a done node was proven under a declaration that has since moved;
`need-user-answered` a `needUser` item's reason is gone.

**The lane worktree** (`kernel/lanes.mjs`) - `lane-created` the worktree this workflow owns;
`lane-merged` it went home to its base; `lane-merge-conflict` it could not and the owner merges;
`lane-merge-skipped` there was nothing to merge; `lane-closed` a merged lane's worktree was removed and its
branch kept; `lane-status-failed` the host would not set the row's display state.

**Terminals and the run** (`kernel/terminals.mjs`) - `kernel-terminal` / `kernel-terminal-closed` the
kernel's own tab; `op-terminal-closed` an op's tab when nobody reads it any more; `terminals-swept` the
periodic sweep, with the reason per tab; `coordinator-tab-lost` / `coordinator-tab-recovered` a coordinator
whose pane died and the fresh tab the Run was re-bound to; `run-rebound` the Run was bound to this kernel's
own tab, fencing the old tab's dispatches; `reconciled-orphans` a live dispatch no operation names;
`reconciled-dead` a dispatch whose process is gone.

**The preflight and the guards** - `preflight` the worktree preflight ran, with what it fixed;
`preflight-blocked` a problem it could not fix, which becomes a `needUser` item;
`kind-graph-problem` `validateGraph` reported something about the shipped profile.

## Reading a workflow

A workflow has no monitor agent to ask, so the one way to know where it stands is its own files.
`kernel/view.mjs` derives a single page from them - `state.json`, `events.jsonl`, `kernel.lock`,
`stop.flag`, `validator/verdicts.jsonl` and the repository's `supervisor.log` - and the launcher prints it:

```
starci workflow-status --id <id> [--json true]
starci workflow-list
```

`workflow-status` prints the page; `--json true` prints the machine record instead (the kernel's own status
fields, unchanged, plus the whole view under `view`). `workflow-list` prints one line per workflow of the
repository: phase, operations done, whether a kernel process is alive, how old the last event is.
`buildView({repoRoot,id,now})` is the same view as a plain object, `renderView` the page, `renderJson` the
record. The view never calls Orca, never asks a model and never writes - it does not even open a store, so
reading a workflow cannot create one - and a missing file is an empty field, never an error: a tree whose
kernel keeps no validator verdicts and no lanes still renders a complete page.

| section | what the number means |
| --- | --- |
| `kernel` | the pid in `kernel.lock` and whether that process exists, plus `silentMs`: how long ago the **last event** was appended |
| `lane` | the worktree this workflow owns, its branch, the base worktree and branch it goes home to, and the merge that took it there (null for a workflow that runs in whatever worktree it was started from). `workflow-list` carries the same row |
| `supervisor` | the last `supervisor-round` in `supervisor.log`, and what that round decided for this workflow. There is no pid to probe, so `alive` means only "a round landed in the last 5 minutes" |
| `runtimes` | `running` is counted from the operations that are actually running (saved loads may belong to a dead kernel), `max` is this workflow's `--allocation` slot count, `cooling` is the allocator's wake time |
| `ops` | the status histogram, every running op with its age since `launched`, its restarts and the last thing the log said about it (`lastPing`), and every blocked op with its refusal |
| `ledger` | `done` = `verified` + `preexisting`, `implemented`, `todo` = `planned`, `outOfRepository`, and `eligible` = the items a live op is carrying. `byFeature` groups by the first two segments of the Work node id (`<product>.<feature>`). `treeEligible`/`treeTotal` are the whole tree's numbers from `ledgerSummary`, not this workflow's |
| `reviews` | rounds per reviewed node set (`verifyRounds`) and the groups a `verify-exhausted` event has parked |
| `validator` | accepted / rejected / unavailable verdicts, from `validator/verdicts.jsonl` when the kernel keeps it and from the `validated` / `validator-rejected` / `validator-unavailable` events otherwise |
| `rate` | `op-done` events per hour and distinct nodes finished per hour over the last 3 hours - or over the workflow's whole life when it is younger than that, so a 20 minute old run never reads as idle |
| `anomalies` | `state.anomalies`: one signature per repeated oddity, its count and the triage option that settled it |
| `recent` | the last 15 events, one line each: time, seq, event and the fields that matter |
| `## Reconciliation (n)` | one line per intake of the workflow: the scope, the counts of the three cases the kernel checked in its table (`reconciled`), and every conflict still open for the owner (a `decision` item naming the intake op). Read from the log and the state alone |
| `## Provisional decisions (n)` | one line per decision the runtime took on its own recommendation and has not been answered on: the record, the option it took, and the `workflow-answer` command that settles it. Deliberately outside `## Needs you` - nothing is blocked on these, and a workflow that finished `done` may still owe the owner every one of them |
| `## Integrations (n)` | one line per declared integration of the workflow's tree - its id, its provider, the node that owes the proof, and what it is actually proven by: *proven live*, *proven against a fake, not live*, or *not proven*. The tree is read through the bounded `readLedgerTree` so a status page never spawns the validator, and a workflow that names no tree leaves the section out rather than guessing |

**When `kernel.silentMs` grows.** Up to one wait tick (15 min) of silence is normal: the kernel is inside
`waitTick`. Past the supervisor's health window (25 min) the supervisor itself kills and restarts the kernel,
so the honest reading is the pair: silence **and** a supervisor whose last round is recent means the restart
is already someone's job; silence with no supervisor log means nothing is watching - start
`workflow-supervise`, or run `workflow-run --id <id>` yourself. A silent kernel whose `pid` is gone and whose
`finished` is null was killed; the store is complete, so starting it again resumes the same workflow.

**When `needUser` is not empty.** Nothing else will clear those items: the policy table has already decided
it cannot. A `ledger` item wants an allowlist or checks authored on the node; a `dynamic-op` item wants
`workflow-approve --id <id> --allow-dynamic N`; `environment` and `authority` items want you. Until then the
workflow keeps running everything else and stops `blocked` at the end with those items in its final report.

The supervisor covers two store roots: the repository's own (`<repo>/.starciwork/_local/workflows`) and, when it runs from a worktree, that worktree's, because a workflow whose tree was named with `--ledger-root` keeps its store beside that tree; such a workflow is started with the same `--ledger-root`.
