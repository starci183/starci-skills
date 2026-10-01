# Workflow kernel

The kernel is **one long-lived logical LLM agent per workflow**. A provider
generation may return to its input prompt; the durable Kernel identity spans
those turn boundaries. It is not a scheduler process: it is an agent that reasons over ledger
projections and mutates state only through `scripts/kernel/cli.mjs`. This page
is the map; the authoritative contracts are the YAML files it cites — when
they disagree with prose, the YAML wins.

## Lifecycle

```text
owner prompt
  → node scripts/goal/define-goal.mjs        workflows + goals(rev) + inbox rows      phase queued
  → node scripts/kernel/start-workflow.mjs   claims the inbox row, spawns [Kernel] <workflow_id>   phase running
  → driver loop (below)                      until every unit settled + final verify pass
  → api finish                               phase finished; history preserved
```

## Phases, including paused and stopped

A workflow's phase is one of `awaiting-approval`, `queued`, `running`, `paused`, `stopped`,
`finished`, `archived`. The database holds the allowed transitions (`workflow_transitions`) and
refuses any other; every change writes a `lifecycle_changes` row with who and why
([architecture](architecture.md#workflow-phases)).

- **paused** is temporary: the Kernel seat is `parked` with a reason, no new work is dispatched,
  and the phase returns to `running` when the reason clears.
- **stopped** belongs to the owner. `api lifecycle --stop` stops a workflow; only the owner's
  `api lifecycle --resume` moves it back to `queued`. No controller, Kernel or Supervisor resumes a
  stopped workflow, and no controller replaces the seat of a paused or stopped one.
- A `finished` or `stopped` workflow can be `archived`; an archived workflow accepts no new event or
  job, and its open incidents were closed when it finished.

Kernel death is recoverable: re-running `start-workflow` with the same goal
spawns a *replacement* kernel (attempt+1, same workflow generation) — durable
plan, jobs and events survive agent churn. A `signals` singleton row enforces
one kernel per workflow in data, not by politeness. Contract:
`modules/kernel/start-workflow.yaml`.

The `StarCi-Reconciler` task starts the one host engine through
`scripts/reconciler/boot.mjs ensure`. Its Host controller keeps the Kernel seat
alive by running `scripts/kernel/kernel-watchdog.mjs --once --repair` for the workflow.
That command is a single liveness pass: it reads ledger status and attested
terminal evidence, wakes a turn-idle Kernel when work is actionable, and replaces
a seat only after proving it dead or unwritable. There is no per-workflow
watchdog loop or fallback process.

The Job controller runs `scripts/kernel/settle/job-settle.mjs` for eligible green
reports, reconciles dead or held workers and dispatches ready work through the
existing API. A non-green report opens a `settle-nongreen` Decision Item; the
Kernel chooses its verdict. The Workflow controller opens progress and stall
Decision Items and re-parks asks. The Kernel reads its Decision Items first on
every wake, acts through `scripts/kernel/cli.mjs`, then yields when nothing needs
a decision. See `modules/reconciler/reconciler.yaml` and
`modules/kernel/driver-loop.yaml` for the ownership split.

After a host restart, the Host controller's boot phase restores services and
Kernel seats. The Job controller reconciles dead or held workers. A filed
report is consumed; an attempt with no proven effect can return to queued;
evidence of an unknown effect is fenced for a Kernel decision. The ledger
preserves the plan, jobs and events across restarts.

## Kernel decision cycle — `modules/kernel/driver-loop.yaml`

The Kernel uses these API calls for its decisions. Controllers own green settlement,
worker recovery, ready dispatch and seat liveness:

| Step | Call | Why |
| --- | --- | --- |
| survey | `api survey --workflow <id>` | Open on the ledger, never on memory: goal revision + `opChain`, all jobs, inbox, signals, event tail, open incidents. |
| plan | `api plan --workflow <id> --file <plan.json>` | Persist the derived plan; the api stores its digest and the *structural* diff vs the approved `opChain`. Divergence → `incident --kind plan-divergence`; dispatch nothing on a divergent plan. |
| enqueue | `api enqueue --workflow <id> --op <opId> --paths <csv>` | One `queued` job row per planned op the queue lacks. An oversized semantic op is partitioned into bounded same-op jobs with `--cut-id/--cut-ordinal/--cut-total`; this does not change the approved plan. |
| drive | `api decisions --workflow <id>` then `api status` and an allowed decision verb | Claim and resolve non-green verdicts, worker questions, progress stalls and Supervisor rulings; use `--decision <id>` for the chosen action. Yield when no decision is executable. Job, Workflow and Host controllers continue their mechanical passes. |
| finish | `api finish --workflow <id>` | Last call. Refuses while any job is unsettled (`workflow-open-jobs`) or the owner has not approved the newest handover after the last business settle (`handover-not-approved`). |

The kernel decides the plan and its open Decision Items. It never decides scope, identity or
authority, never answers an `ask` itself, and never edits the ledger by hand.

## The verbs — `modules/kernel/api.yaml`

```text
node scripts/kernel/cli.mjs <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` `commands:` and `modules/kernel/api-commands/<verb>.yaml`
together form the verb surface: one entry per verb naming what it reads, writes,
returns and refuses. New verbs use `scripts/kernel/verbs/<verb>.mjs`.
`scripts/checks/check-api-surface.mjs` checks both contract forms against the
core and extension code, and `cli.mjs --help` prints each verb with its arguments.

Every write is one transaction + one hash-chained `events` row; every refusal
exits 1 with `{ok:false, reason}` where the reason string is the contract.
`observe` is read-only in every way that matters: it returns the exact worker
terminal's liveness plus a bounded screen tail as reasoning context and
appends only a compact `op-observed` receipt — an op's screen is never proof,
and only `api report` plus recorded `api check` rows support a verdict.

## Dispatch — `modules/kernel/dispatch.yaml`

`dispatch` reserves the lease + budget atomically, resolves the workflow's
worktree (below; no worktree is made per op), renders the packet and — with
`--spawn` — starts the op agent through `scripts/agent/lib.mjs` `spawnAgent`:
one `orchestration worker-start --worktree <the workflow worktree>`, the Task
carrying the packet, the effective agent and model attested
with `worker-show` ([host contract](host-contract.md)). The packet is a bounded
grant: one op, its brief (`modules/ops/ops/<op>.yaml`), a closed read set, a
closed write set (`owned_paths`, app-relative: `be/...`, `fe/...`,
`.starciwork/...` or an app-root path of the bound app; any other form is
refused `path-not-app-relative`), one model,
one budget, one lease token. Without `--spawn` it is a dry-run — the packet
prints and nothing is reserved. A spawn that does not land is
`dispatch-rejected`: the reservation is settled, never left leasing a ghost.

## Agent launches — every agent is a `worker-start` worker

There is one way to start an agent: `orchestration worker-start` with
`--agent <provider>` (and `--model`/`--effort` where the agent card takes them).
No runtime code creates a terminal for an agent (`check-host-boundary.mjs` rule
`agent-launch`), and Orca supervises every agent it starts (`worker-show`,
`worker-read`, `worker-stop`, `worker-release`). The Kernel, the `[Supervisor]`,
op agents and Supervisor workers all start this way. `start-workflow.mjs`
creates the Kernel's entry Run from the launching terminal and starts the
Kernel in it. The Kernel then binds its own Run (`run-create --from <its
terminal>`) and starts every op there (`worker-start --spec --run --from <its
terminal>`, which files the op's Task), never with `--parent`: Orca nests the
workflow Run under the Kernel's Dispatch, so `worker-show` shows the Kernel at
depth 1 and its ops at depth 2. `settle` stops and releases the op's worker.

## The op loop — `knowledge/op-gate.yaml`

Every code-writing op listed in `knowledge/op-gate.yaml` `enforcedOps`
(`backend.*`, `interface.scaffold|implement`, `package.scaffold`,
`code.refactor`, `test.author`, `unit|integration|e2e.verify`,
`grammar.update`, `task.execute`) runs one loop:

1. **READ** — `scripts/gates/read-digest.mjs --root <app> --touch <files>`
   prints what the slice must read before coding: the `hfs explain` slot map of
   each touched file, the pattern files of each file kind (`op-gate.yaml`
   `kinds`: the family's `always` files plus those of the longest listed slot
   prefix) and the example files of the same slots. It records the READ digest
   (`starci/read-digest@1`, every file with its sha256).
2. **CODE** — inside the owned paths, in the workflow worktree.
3. **CHECK** — `scripts/gates/gate.mjs --root <app> --changed <files>
   [--tests <pattern>]`, forced every round. It runs, in order: the merge guard;
   `hfs lint --changed` at the app root (the BE canon under `be/`, the FE canon
   under `fe/`, the repository checks); the root `codegen` and the build of
   every workspace package that exports `dist`; `tsc`, one incremental program
   per tsconfig owning a changed file; with `--tests`, the slice's specs. Only
   findings new against the base block: the base is the workflow's previous
   checkpoint (the merge-base with main for the workflow's first op), measured
   read-only from git objects, never from a second checkout, so only this op's
   new findings block, and settle refuses a gate measured against any other
   base; failing specs always block. Exit `0`
   green, `1` new findings, `2` a tool could not run (never a pass). Its stdout is
   one `starci/gate@1` document.
4. **FIX** — and check again, up to the op's `params.gateRounds` rounds.
5. **REPORT** — `api report` with `gate.json` and `read-digest.json`
   attached. Still red after the last round is `blocked` with the exact
   findings.

`gate.mjs`, `read-digest.mjs`, the packet's owned paths and every finding use
the same app-relative paths (`be/src/...`, `fe/apps/...`) at the app root.

**Settle enforcement.** `api settle` re-reads both attached documents itself
(`scripts/kernel/gate-settle.mjs`, recorded as the runtime check `op-gate`) and
refuses a `done` that is `op-gate-proof-missing` (no gate JSON),
`op-gate-tool-failed` (exit 2), `op-gate-new-findings`,
`op-read-digest-missing` (READ skipped) or `op-read-digest-no-pattern` (the
digest names no pattern file for a touched file kind). A refused pass never
counts as green.

**The merge guard.** Every merge commit in `base..HEAD` with one parent on the
main line is recomputed with `git merge-tree`; a path main changed whose
merged blob is the lane's (main's change dropped) is the finding
`merge/dropped-main-change`, never preexisting. The gate runs it first, and the
workflow's finish runs it again over the whole workflow branch before anything
is rebased (`land-merge-dropped-main`).

## The workflow worktree — one per Kernel workflow

One git worktree per Kernel workflow, never one per op (owner decision,
contract change `workflow-worktree`). Orca creates and owns it; the runtime
keys its registry, cap, GC and safe removal per workflow
(`scripts/kernel/workflow-worktree.mjs`, `scripts/kernel/workflow-checkpoint.mjs`).
Ops that only touch the Work owner, ops on the `.claude` runtime and ops that
never commit keep the shared tree.

- **Create.** At workflow start, before the Kernel launches,
  `ensureWorkflowWorktree` has Orca create the worktree (`orca worktree create
  --name wf-<workflowId> --base-branch main --setup run --no-parent`) off the
  app's main; its branch is Orca's `wf-<workflowId>`, which the runtime reads
  from the registry. The Kernel then starts with `orchestration worker-start
  --worktree <that path>`: an existing tree, so launch trust is written into
  it before the agent starts. Its
  setup runs a real `npm ci` at the app root: there are no `node_modules`
  junctions anywhere. The worktree is registered in `machine.sqlite`
  `worktrees` as kind `workflow`, keyed by Orca's worktree id, against the cap
  per repository; a workflow over the cap waits.
- **Ops.** Every op of the workflow starts with `worker-start --worktree <the
  workflow worktree>`. Ops on the same side (`be/` or `fe/`, from the op's
  owned paths) run one after another; ops on different sides run in parallel,
  and an op that owns both sides runs alone. The dispatcher enforces it.
- **Checkpoint.** Ops never commit. When an op settles green, the runtime
  (`checkpointOp`) commits its side's changes on `wf-<workflowId>` as that op's
  checkpoint: it is the only committer on the branch. The op's gate base is the
  previous checkpoint (the merge-base with main for the first op), so only the
  op's own new findings block, and settle refuses a gate measured against any
  other base.
- **Failure.** A failed or blocked op's uncommitted work is preserved to
  `refs/heads/preserved/<workflowId>/<op>` (a snapshot commit that never holds
  `node_modules`), and the worktree is reset to the last checkpoint. The tree is
  private to the workflow, so the reset touches nothing else.
- **Finish.** Main is touched only when the workflow ends, in this order: a
  full `gate.mjs` over the whole branch against its merge-base with main; the
  merge guard; `review.verify`, which must have verified the exact head that
  lands; a rebase onto main (also at milestones when main has moved); main
  fast-forwarded and pushed. The finish then marks the worktree
  `release-pending`; it never removes it itself, because the workflow's
  terminals still run there. Any refusal leaves main untouched.
- **Release.** The host-side controller removes a `release-pending` worktree
  once every terminal in it is released: the link check, then Orca's worktree
  removal, then `git branch -d`. The reconciler's GC controller
  (`gc:worktrees`, always active) also collects a workflow worktree whose
  owner process is gone longer than `ownerGoneMs`, always after preserving its
  work, and only through Orca. `node scripts/machine/worktrees.mjs
  counts` shows each repository's count against its cap; `start --check`
  reports them.

## Verdicts — `modules/kernel/verdict-contract.yaml`

Two layers, kept distinct: the op's **report outcome**
(`done|partial|failed|ask|blocked`, schema `starci/op-report@1`) is what the
agent claims; the kernel's **verdict** (`pass|fail|blocked`) is what the api
records after re-proof, in separate columns of the attempt row (`report_outcome`, `verdict`).
`settle` validates the report row — it belongs to exactly this attempt (`attempt_id`, `dispatch_id`)
under the job's current lease token, files stay inside `owned_paths`, and `pass` is recorded only
after the op's declared checks re-ran green under the runtime's runner (the raw exit code, never the
op's declared one) on bytes computed from git. A refused settle
(`stale-lease-settle`, `out-of-scope-files`, `report-invalid`) is a routed
fact, never silent loss.

## What the kernel may not do

- Open `runtime.sqlite` or write any row directly — api only.
- Call the host (Orca) API or spawn terminals directly — `dispatch` owns host mechanics.
- Pick a model by taste — `scripts/route/route-model.mjs` resolves eligibility from `modules/models/selection.yaml`; owner `config.yaml` and an explicit `--agent` override in that order.
- Delete history — `finish` preserves goals/jobs/reports/events.
- Retry forever — each unit has a try budget (default 5) that the database enforces; only the owner or the Supervisor raises it. Exhaustion is an incident, and identical evidence is not progress.

## Durable memory

The ledger is the kernel's memory: findings, plans and settlements are
persisted as `events` as they form — never hoarded in
context. Re-plans keep lineage (`replannedFrom`, blocker, path delta, routing
reason) so a replacement kernel reconstructs intent from rows, not from a
dead agent's transcript.
