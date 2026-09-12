# The workflow kernel (StarCi 5.0)

`execution/workflow-kernel.mjs` is the whole control plane of a job. One process per workflow: no Plan
Coordinator, no per-module Monitor, no provider chain. A **job** is any piece of work ("implement backend
feature A", "backend for three modules with the existing SRS/SDS", "write an SRS"); its **inputs** are typed
refs (`sds:path`, `srs:path`, `file:path`, `note:...`) of which specifications are one kind among many.

Entry points are the canonical launcher's four commands, which route straight into `kernelMain`:

```
orca-supervised-launch.mjs workflow-goal    --job <text> [--inputs a,b] [--gates name=command,...] [--ledger work|plan] [--scope f1,f2] [--id <id>]
orca-supervised-launch.mjs workflow-approve --id <id> [--allocation <runtime>=<slots>[:<tiers>],...] [--allow-dynamic N]
orca-supervised-launch.mjs workflow-run     --id <id> [--from <own terminal> --run <run>] [--launch-file <f>] [--max-iterations N]
orca-supervised-launch.mjs workflow-status  --id <id>
```

`--allow-dynamic N` raises this workflow's run-time operation budget (default `DYNAMIC_OPS_BUDGET` = 6) and
reinstates the operations the dynamic-op gate refused. Re-approving is how a user answers that gate.

All runtime state of one workflow lives in one directory (`execution/workflow-store.mjs`):
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

A node that declares no allowlist or no checks is never guessed at: it is listed in `goal.md` under
**Needs you first** as `ledger incomplete` and becomes a `needUser` item, because inventing a scope for
authored work is exactly what the ledger exists to prevent. Decision nodes (`business`,
`business-overview`, `architecture`) are listed too but never launched into a worktree - a decision is
answered. The exception is a reported `sds-gap`: see the policy table.

## Lanes and routes

One Work node is not one operation. It is a **lane**: the ordered kinds it travels before its ledger entry may
be called done. `profiles/kinds.yaml` declares the catalog and the lanes; `execution/kind-graph.mjs` reads it
(`laneFor`, `nextKind`, `routeFor`, `roleOf`, `familyOf`, `isReadOnly`, `describeLane`, `validateGraph`), and the
kernel only walks what it answers. Adding "frontend work is drawn before it is coded, and proved by a UAT run"
is a profile edit, not a patch to the control loop.

| lane | steps | who creates each step |
| --- | --- | --- |
| `implementation/backend` | `backend.implement` -> `review.verify` | the node, then the kernel's review planner |
| `implementation/frontend` | `interface.draw` -> `frontend.implement` -> `uat.verify` | the node, all three |
| `operations` | `runtime.operate` -> `review.verify` | the node, then the review planner |
| `uat` | `uat.verify` | the node |
| `architecture` / `business` | `architecture.decide` / `business.decide` | answered as a decision, never launched |

The layout comes from the node path: a node under `implementation/frontend/**` takes the frontend lane, one
under `implementation/backend/**` (or any implementation node that names no layout) the backend lane. A `ui`
node is frontend by kind. `state.lanes[nodeId] = {lane, done, checks, head}` is the whole bookkeeping.

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
| `blocked` `sds-gap` | `architecture.revise` on the architecture node (its `index.yaml` plus its SDS folder), origin `architecture`, whose own check is that the Work tree still validates; `markDecided` bumps the node's `rev` | reopened behind it | - |
| `blocked` `interface-gap` | `interface.draw` on the same node, origin `architecture` | reopened behind it | - |
| `blocked` `shared-change` | the reporter's own kind, origin `shared` | paused | 3 new shared ops per iteration |
| review findings | the lane's build kind (so a finding on frontend work comes back as `frontend.implement`), origin `repair` | finished; the repair carries the work | 3 rounds per reviewed node set |
| `uat.verify` reporting `failed` | the lane's build kind, origin `repair` | reopened behind the repair | the same 3 review rounds |
| validator reject | retry of the same op | retried | 2 (`validatorRejectLimit()`) |
| `blocked` `environment` / `authority` | nothing | blocked, `needUser` | - |

Kinds younger than `ops/registry.yaml` are resolved to a launchable operator id once, at the launch seam:
`frontend.implement` launches as `interface.implement` and `architecture.revise` as `architecture.decide`
(`launchOperator`). The allocator is asked for the op's own kind, because `roleOf` from the graph is what
decides its role - the runtimes profile's `roleOfKind` map is only the fallback for a kind the graph lacks.

A profile that cannot be read is not fatal: the graph is empty, `WORK_OPERATION` maps the node kind as it did
in 4.x, every route falls back to its built-in default, and one `kind-graph-problem` event says so.

## Phases

**`goal`.** On the Work ledger the kernel loads the tree, lists the decision candidates and the schedulable
executable candidates in scope, derives one op per schedulable node and asks `assessGoal` only for the
definition of done, the risks and the questions; when that call fails the definition of done falls back to
the node list and the failure is an event, because the TODO list is a fact of the tree and not the model's
to supply. On a plan ledger `assessGoal` fills one form: the definition of done, a **ledger** of goal items,
and a dynamic list of **ops** with `dependsOn` and disjoint allowlists. Either way the kernel writes
`goal.md` and `goal.json` and stops. An item the plan reports as already `done` is carried as `preexisting`:
approved by the user, never verified by the kernel, and named as such in the final report.

**approval.** `approve` sets `state.approved`. This is the only human gate; nothing is launched before it.

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
| `planOp` | the input form of one op that must be planned again after a design decision |
| `decide` | one option of a closed set when a bounded policy cell ran out |
| `validateOp` | the closed verdict of the workflow's one validator on a `done` the kernel already reproduced: `accept`, or `reject` with findings inside the diff (see **Validator**) |

Everything else - scheduling, allowlist arbitration, runtime choice, retries, commits, gates, the final
report - is this code.

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
checks the kernel re-ran (name, command, exit code, output tail); `op.references`; and the memory.

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
| `done`, checks reproduce, the validator rejects | downgrade to `failed`, retry the same op with the validator's findings | 2 rejects per op, then `blocked` + `needUser` |
| `done`, checks reproduce, the validator is unavailable | commit anyway, count it | 3 in a row, then one `needUser` item |
| report fails `validateReport` | retry the same op with the rejection as the finding | retry bound |
| `partial` | resume the same op (`attempt+1`, `priorOpen` = `open[]`) | 5, then `decide` |
| `failed` | retry the same op with the failing checks as findings | 3, then `decide` (`retry-other-runtime` / `split` / `escalate-to-user`) |
| `ask` | `decide` `answer` or `escalate-to-user`; an answer is typed into the op's terminal and its report file is kept aside so it can report once more | - |
| `blocked` `shared-change` with paths | one shared op per distinct path set (a path-prefix overlap merges into the pending or running shared op and appends the requester); the requester is `paused` and returns to `ready` only when that op is `done`, carrying `priorOpen: ["shared change <op> done at <head>"]` | 3 new shared ops per iteration, the rest queued |
| `blocked` `shared-change` naming no path | treated as an `ask` to the kernel: the op is answered in its terminal with "name the exact paths" and reports again | - |
| a report whose op wrote a kernel-owned path | `revertProtected`, report downgraded to `failed` with the finding `operation modified kernel-owned ledger paths: <paths>`, op retried | retry bound |
| an op created at run time past `state.dynamicOpsBudget`, or whose whole allowlist is outside `state.scope` | the op is created `blocked` and becomes a `needUser` item; `workflow-approve --allow-dynamic N` reinstates it | 6 dynamic ops per workflow |
| two `stalled-silent` settlements of one runtime within 30 minutes | `allocator.failed(runtime,{reason:'rate-limited (inferred from repeated silence)'})` and a `rate-limit-inferred` event | the window is cleared after it fires |
| `blocked` `sds-gap` | on the Work ledger: `markReopened` the architecture node the report names (or the one in the op's module) and create the route's `architecture.revise` op on that node's `index.yaml` and SDS folder, whose own check is that the Work tree still validates; `markDecided` settles it with a bumped `rev` when the op is accepted. On a plan ledger: an `architecture.decide` op on the design inputs, re-planned with `planOp` afterwards. Either way the blocked op depends on it and resumes afterwards | - |
| `blocked` `interface-gap` | the route's `interface.draw` op on the same node; the reporter is reopened behind it | - |
| `blocked` `environment` / `authority` | `needUser`, op blocked | - |
| review with findings | one repair op of the lane's build kind on the files the findings name inside the group's allowlists, then a fresh review | 3 rounds per ledger group |
| a `uat.verify` op reporting `failed` | one repair op of the lane's build kind, and the UAT run itself reopened behind it | the same 3 rounds per node set |
| failing gate | one repair op whose findings are the tail of the gate output, then the gates again | 3 rounds |
| `stalled-prompt` / `stalled-silent` / `dead` from the tick | `settleDispatch(close)` and requeue on another runtime | 3 restarts |
| nothing launchable and nothing running | `needUser`, stop `blocked` | 3 iterations |

A review never runs on a runtime that implemented the ledger items it judges (`avoid`), and two ops whose
allowlists overlap - or whose resource locks clash - never run at the same time, so one worktree stays safe
for a whole pool.

## The guards the kernel owes itself

`execution/kernel-guards.mjs` is the only place these mechanical protections live; the kernel reaches every
one of them through `ctx.guards` (default `kernelGuards`), so a host or a test can inject the contract, and a
tree shipped without the module falls back to a minimal implementation of the same contract.

| guard | what the kernel does with it |
| --- | --- |
| `protectedPaths(node, repoRoot)` | the node's `index.yaml` (where `state`, `completion` and `extensions.work3.kernel` live) and its `evidence/**`. Every contract of that node lists them under **Never touch (kernel-owned)**; `changedFiles` excludes them, so no operation commit can ever carry one. An op is granted one only when its own allowlist names that exact file - how an `architecture.decide` op authors the design body of its node - never through a directory glob |
| `revertProtected(git, {cwd, paths})` | run before any machine verification. The kernel fingerprints those paths right after its own `markInProgress` write, so only the operation's edits are caught; a changed fingerprint is reverted and the report is downgraded to `failed` with the finding `operation modified kernel-owned ledger paths: <paths>`. A completion an agent writes itself is a claim, not a record |
| `resourceLocks(op)` / `resourcesClash(a, b)` | the declared `op.resources` plus what the op's kind and check commands prove it reaches for (`postgres`, `e2e-runtime`, `docker`, `cluster`). The scheduler treats a clash exactly like an overlapping allowlist, and the contract renders them under **Resources** |
| `gitQueue(fn)` | every git mutation the kernel makes - the op commit, the ledger commit, a protected-path revert - runs alone through this queue, because one worktree has one index |
| `preflight({worktree, git})` | once at the start of `runLoop`: the fixes it applied and the problems it could not are one `preflight` event, `state.preflight`, and - for a problem - a `needUser` item |

## Bounds on what a run may grow

The kernel creates ops at run time (reviews, repairs, shared changes, design decisions, gate repairs, newly
schedulable Work nodes). Two bounds keep that from drifting away from what the user approved:
`state.dynamicOpsBudget` (6) caps how many run-time ops a workflow may create, and an op whose whole
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

Every write to a Work node goes through `execution/work-ledger.mjs`, which owns exactly four things -
`state`, `completion`, `extensions.work3.kernel` and the evidence manifest - and preserves every other
authored line byte for byte. The kernel calls it at four points:

| when | call | what it records |
| --- | --- | --- |
| an op launches | `markInProgress` | `opId` and `dispatch` in the kernel block; `state` stays `todo`, because Work v2 authors only `uninvestigate`, `todo` and `done` |
| a lane step is accepted and another follows | `markInProgress` again + a `lane-step` event | the step that just landed; the node is still `todo`, because its lane is not walked |
| the LAST lane step is accepted | `markDone` + its evidence manifest | the checks every step of the lane proved, the assertion each one covers, the head, and a `completion` bound to the digest the validator reports after the kernel block was written |
| a decision op is accepted | `markDecided` | a collocated `starci/design-review@1` with one observation per authored assertion - a decision is never settled by an execution receipt |
| a reported `sds-gap` | `markReopened` | the node returns to `todo` with the reason, and its stored proof is kept as history |

A refused write is never silent and never fatal: `work-ledger` restores the node's original bytes, the
refusal is a `ledger-write-failed` event, and the workflow carries it to the user instead of reporting a
green slice over a ledger that does not say so. The most common refusal is honest - `markDone` will not
write `done` unless a passing check proves every assertion the node authored.

The op's own commit carries a `Work: <node id>` trailer; the kernel's ledger write is committed after it, in
its own `work(<node id>): ...` commit scoped to that node's directory, so the tree is never left dirty. Both
commits go through `gitQueue`, and the node's `index.yaml` and `evidence/**` are kernel-owned for the whole
life of the op: see the guards above.

### When the ledger belongs to another repository

The tree a job works is resolved once, before the store exists, by `execution/ledger-routing.mjs`:
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

## The single-candidate launch

5.0 allocates one runtime per op, so the launcher must try exactly one candidate.
`startOperation(input,{candidates})` is that seam: the launcher takes the resolved selection instead of
resolving a chain, so nothing has to pretend a target was unavailable. `launchWithCandidate` still proves
the allocated target belongs to the operation's declared environments, rebuilds the request from the
candidate alone so a mismatch is caught before any Orca effect, and records **why the other targets were
not used in the kernel's own `launched` event** (`allocation.notAllocated`), never as a fake launcher
attempt. Allocation itself is kept inside `allocator.launchableTargets(kind)`, so a runtime whose role has
no profile for that operation is never chosen and then rejected.

## The operation contract

`renderContract` owns every concrete value - the lane line (`Lane: interface.draw -> frontend.implement ->
uat.verify (this op: step 2 of 3)`, so an operation knows what came before it and what will judge it), goal,
goal items, allowlist, the kernel-owned paths the op may never touch, its resource locks, references, inherited
open items, findings, acceptance, the exact check commands, the checks file, the report command with
`--reports-dir`.
Between the acceptance and the process prose it splices the kind-specific working order from
`execution/contract-steps.mjs` (`stepsFor`): see [op-granularity.md](op-granularity.md), "Working order per kind".
The process prose (`## Cook until done`, `## Ping (mandatory)`, `## Never`) is reused verbatim from
`docs/supervision-templates/op.md`, so one template serves every operation kind and no placeholder survives
into a rendered contract.

## The final report

`final-report.json` carries the outcome and reason, the branch and head, the definition of done, every
ledger item with its evidence, the gates, `needUser[]`, and every op with its runtime, node, commits and
verdict. On the Work ledger it also carries `ledgerMode`, `scope`, the open `decisions` and a
`ledgerSummary` re-read from the tree at the end, so the report states what the ledger says now rather than
what it said at approval.

## Supervision without an agent (5.1)

A workflow has no monitor agent. Three layers keep it running on their own:

- **Supervisor (process, `workflow-supervise`)**: one long-running program per repository. Every poll it reads `_local/workflows/*/state.json`, `events.jsonl` and `kernel.lock`; an approved, unfinished workflow with no live kernel is started (`workflow-run` detached), a kernel whose log stays silent past the health window (default 25 min, one wait tick plus slack) is killed and started again. Finished, stopped (`stop.flag`) or unapproved workflows are left alone. Log: `_local/workflows/supervisor.log`.
- **Reconcile (kernel, start + every 10 ticks)**: the kernel compares Orca's `worker-list` of its Run with `state.ops`; a live Dispatch no operation names is an orphan and is settled (`reconciled-orphans` event). This is what a restarted kernel needs to trust its own state again.
- **Triage (LLM, closed options)**: the policy table handles known outcomes (done/failed/question/shared-change/stall/rate-limit). When the same anomaly signature repeats `TRIAGE_AFTER` (3) times, the kernel asks the `decide` function once, offering only `resume-ops | park-runtime | settle-op | restart-kernel | needUser`; the pick is applied, recorded (`triage` event) and never asked again for that signature in the workflow. Without a decider (tests, `--functions` off) triage is a no-op and the anomaly stays a counter.

```
node .claude/.dist/execution/orca-supervised-launch.mjs workflow-supervise --host <path-to-.claude> [--once true] [--id <workflow-id>] [--poll-ms 60000] [--health-ms 1500000]
```

### Supervisor level

`config.json` (host-local, gitignored) may carry `supervisor.runtimes`: the models triage and the `decide` role prefer, strongest first. The default is `[claude-fable-5.1, gpt-6-astra]`; lower it (for example to `[claude-opus]`) to save budget. Only ids declared in `profiles/runtimes.yaml` take effect; the rest of the profile's `decide` preference follows.

### Review rounds and the dynamic budget

A review round is counted per reviewed node set (`verifyRounds[<ids joined by +>]`), never per feature: counting per module burned a feature's three rounds on three different nodes. After the last round the group is parked as `review-exhausted` with one needUser item instead of being re-planned every tick. Ops the kernel derives itself (origins `ledger`, `verify`, `gate`, `architecture`) never count against `--allow-dynamic`; only `shared` and `repair` ops do, and `--allow-dynamic 0` forbids them.

## Reading a workflow

A workflow has no monitor agent to ask, so the one way to know where it stands is its own files.
`execution/workflow-view.mjs` derives a single page from them - `state.json`, `events.jsonl`, `kernel.lock`,
`stop.flag`, `validator/verdicts.jsonl` and the repository's `supervisor.log` - and the launcher prints it:

```
orca-supervised-launch.mjs workflow-status --id <id> [--json true]
orca-supervised-launch.mjs workflow-list
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
| `supervisor` | the last `supervisor-round` in `supervisor.log`, and what that round decided for this workflow. There is no pid to probe, so `alive` means only "a round landed in the last 5 minutes" |
| `runtimes` | `running` is counted from the operations that are actually running (saved loads may belong to a dead kernel), `max` is this workflow's `--allocation` slot count, `cooling` is the allocator's wake time |
| `ops` | the status histogram, every running op with its age since `launched`, its restarts and the last thing the log said about it (`lastPing`), and every blocked op with its refusal |
| `ledger` | `done` = `verified` + `preexisting`, `implemented`, `todo` = `planned`, `outOfRepository`, and `eligible` = the items a live op is carrying. `byFeature` groups by the first two segments of the Work node id (`<product>.<feature>`). `treeEligible`/`treeTotal` are the whole tree's numbers from `ledgerSummary`, not this workflow's |
| `reviews` | rounds per reviewed node set (`verifyRounds`) and the groups a `verify-exhausted` event has parked |
| `validator` | accepted / rejected / unavailable verdicts, from `validator/verdicts.jsonl` when the kernel keeps it and from the `validated` / `validator-rejected` / `validator-unavailable` events otherwise |
| `rate` | `op-done` events per hour and distinct nodes finished per hour over the last 3 hours - or over the workflow's whole life when it is younger than that, so a 20 minute old run never reads as idle |
| `anomalies` | `state.anomalies`: one signature per repeated oddity, its count and the triage option that settled it |
| `recent` | the last 15 events, one line each: time, seq, event and the fields that matter |

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
