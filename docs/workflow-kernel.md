Owner: modules/kernel/
# Workflow kernel

The kernel is **one long-lived logical LLM agent per workflow**. A provider
generation may return to its input prompt; the durable Kernel identity spans
those turn boundaries. It is not a scheduler process: it is an agent that reasons over ledger
projections and mutates state only through `scripts/kernel/cli.mjs`. This page
is the map; the authoritative contracts are the YAML files it cites — when
they disagree with prose, the YAML wins.

## The five roles at a glance

Generated from `modules/kernel/roles.yaml` (`starci runtime check --only roles-contract -- --table` prints it; `-- --write` refreshes
this copy). A happy error is the system working as designed and meeting a stop; a bug is a role or the runtime not doing what its
contract says.

<!-- roles:table:begin -->
| Role | Scope | Function | Happy errors it handles | On a bug |
| --- | --- | --- | --- | --- |
| Op | One unit of work of one workflow. | Owns one attempt and its worktree; decides alone how to do the work inside its contract | asks-a-question (ask-worker-question); asks-the-owner (ask-owner); red-check (error-work); provider-quota (quota-or-circuit); login-expired (error-login-expired) | records the evidence and keeps working inside its contract; it never fixes the bug and never works around it. Debug scans every role and removes the bug by changing .claude with a spec. |
| Critic | One product of one op. | Owns one verdict; decides alone the score by the rubric | failing-verdict (error-work); no-independent-member (critic-no-independent-member); critic-unavailable (critic-unavailable); critic-quota-out (critic-quota-out) | records the evidence and keeps working inside its contract; it never fixes the bug and never works around it. Debug scans every role and removes the bug by changing .claude with a spec. |
| Kernel | One workflow. | Owns one workflow: its plan, its jobs and its gates; decides alone settle of a non-green report, retry past the runtime's bound, switch agent, re-plan inside the goal, the write set of an open leg, seam duties, the route of handover feedback, and answers to ops | worker-question (worker-question); worker-stalled (worker-stalled); peer-wait (peer-wait); supervisor-gate (supervisor-gate); owner-gate (owner-gate); failed-leg (failed-no-step); orphaned-frontier (orphaned-frontier) | records the evidence and keeps working inside its contract; it never fixes the bug and never works around it. Debug scans every role and removes the bug by changing .claude with a spec. |
| Supervisor | All workflows on the machine, inside Orca. | Owns the machine's operations: the shared resources and the gates Kernels raise; decides alone gate rulings and the division of resources | gate-ruling (supervisor-gate); budget-gate (budget-gate); workflow-conflict (peer-dependency); resource-division (pool-full); runtime-defect (runtime-defect); kernel-escape (menu-escape) | records the evidence and keeps working inside its contract; it never fixes the bug and never works around it. Debug scans every role and removes the bug by changing .claude with a spec. |
| Debug | The owner's eyes: a loop of the owner's chat for a limited stabilisation period, not part of steady-state operation. | Owns the edge-case registry, the operating standard and the queue of runtime defects; decides alone which role failed which duty, which collector to trigger, the fix lanes it opens, and restarting a seat (the owner's authority) | owner-matter (owner-gate); owner-question (ask-owner) | removes the bug by changing .claude (contract, prompt, policy row, guard refusal or runtime code) with a spec and an edge-case entry. |
<!-- roles:table:end -->

## Lifecycle

```text
owner prompt
  → starci workflow define        workflows + goals(rev) + inbox rows      phase queued
  → starci workflow start   claims the inbox row, spawns [Kernel] <workflow_id>   phase running
  → driver loop (below)                      until every unit settled + final verify pass
  → starci kernel finish                               phase finished; history preserved
```

## Phases, including paused and stopped

A workflow's phase is one of `awaiting-approval`, `queued`, `running`, `paused`, `stopped`,
`finished`, `archived`. The database holds the allowed transitions (`workflow_transitions`) and
refuses any other; every change writes a `lifecycle_changes` row with who and why
([architecture](architecture.md#workflow-phases)).

- **paused** is temporary: the Kernel seat is `parked` with a reason, no new work is dispatched,
  and the phase returns to `running` when the reason clears.
- **stopped** belongs to the owner. `starci kernel lifecycle --stop` stops a workflow; only the owner's
  `starci kernel lifecycle --resume` moves it back to `queued`. No controller, Kernel or Supervisor resumes a
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

The runtime drives and the Kernel answers. The controllers dispatch ready work, retry inside the bounds of the hold policy, switch
agent, settle green reports, run the retry of a job whose gate resolved or whose ask was answered, and collect leftovers. What needs
judgment is the Kernel's menu (`modules/kernel/kernel-menu.yaml`), one function of the ledger state: `starci kernel status` prints its
open items as the Decide section, and `menu[]` in its JSON.

A Kernel seat whose launch failed for one cause is held (`kernel-start-held`) and quarantined with one Decision Item; the hold counts only
the failures of the runtime revision now running, so a deployed remedy gets one launch at once. `starci reconciler reopen <seat>` puts a
quarantined seat or service back to `declared` earlier; the Decision Item names that verb.

| Step | Call | Why |
| --- | --- | --- |
| read | `starci kernel status --workflow <id>` (`--field <path>` selects fields) | The menu: each item names its situation, the policy step and deadline, and the options that answer it. |
| answer | `starci kernel decide --workflow <id> --item <menu id> --choice <choice> --reason <why> [--text <input>]` | The choice is checked against the current menu, recorded in the decision log and executed in-process. A choice off the menu is refused with the menu. |
| escape | `starci kernel decide ... --choice none-fits --reason <why>` | No option fits: the item escalates to the Supervisor. A bug of the runtime or of a role is never worked around; it is recorded for Debug. |
| attest | `starci kernel kernel-ack-rev --workflow <id> --plan` | The runtime revision moved: read what the plan lists, then attest the complete READ manifest. |
| yield | none | An empty menu is a wait; the watchdog wakes a Kernel only while its menu has an item. |

The Kernel seat's shell is `starci`: the read verbs, `decide` and `kernel-ack-rev`. Every other `starci kernel` verb is the runtime's; a
mutating verb typed from habit is refused (`KERNEL_USE_DECIDE`) with the menu. A wake that spends more than the per-wake budget of the
Kernel role (`modules/kernel/roles.yaml`) is reported by the digest as a departure.

The kernel decides the open items of its menu. It never decides scope, identity or authority, never answers an `ask` itself, and never
edits the ledger by hand.

## The verbs — `modules/kernel/api.yaml`

```text
starci kernel <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` and `modules/cli/commands/kernel/<verb>.yaml`
together form the verb surface: one entry per verb naming what it reads, writes,
returns and refuses. New verbs use `scripts/kernel/verbs/<verb>.mjs`.
`scripts/checks/check-cli-parity.mjs` checks both contract forms against the
core and extension code, and `cli.mjs --help` prints each verb with its arguments.

Every write is one transaction + one hash-chained `events` row; every refusal
exits 1 with `{ok:false, reason}` where the reason string is the contract.
`observe` is read-only in every way that matters: it returns the exact worker
terminal's liveness plus a bounded screen tail as reasoning context and
appends only a compact `op-observed` receipt — an op's screen is never proof,
and only `starci kernel report` plus recorded `starci kernel record-checks` rows support a verdict.

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
For a Git workflow, the worker checkout is its registered workflow tree. An
explicit `--worktree` must name that same tree; `requireWorkflowPlacement`
refuses a missing tree, unavailable registry or different Git placement before
environment preparation, leases or worker launch. The immutable contract and
attempt retain the actual placement for settle. A non-Git ledger has no Git
checkpoint.

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

## The Critic — `modules/kernel/critic.yaml`

The Critic is a standardised role: a fresh worker of the tier `modules/models/tiers.yaml` `seats.critic` names (frontier), never of the
maker's provider (`scripts/work/critic-pick.mjs`, refusal `CRITIC_NO_INDEPENDENT_MEMBER`), bound to the `critic` guard that confines it to
its directory and its verdict file, answering with one `starci/critic-verdict@1` that carries the sha256 of every byte it judged. A
verdict that names other bytes than the attempt's product is `CRITIC_VERDICT_STALE`. The `coverage` table of `critic.yaml` lists the op
kinds that owe one; three are covered:

- `interface.draw` — every draw-loop round, gated by the draw loop's finish and `drawGateEvidence`.
- `scope.define` and `architecture.decide` — the decision legs, because a decision's errors spread to every later leg. The runtime runs the
  Critic itself when the op reports done (`scripts/kernel/settle/critic-run.mjs`, once per version of the records, journalled as `runtime-critic-run`); the op runs none and a verdict it attaches is ignored (`runtime-critic-op-verdict-ignored`). The Critic is handed the op's decision records and the records they cite
  (copied into its directory and hashed), the rubric of its kind from `modules/kernel/critic-rubrics.yaml` (derived from the op's
  contract and its work-record schema: sources named, alternatives weighed, constraints and earlier decisions honoured, no requirement
  invented, traceable to the goal) and a manifest. `starci kernel settle` (`scripts/kernel/critic-settle.mjs`) recomputes the digests of the
  op's records now and refuses a done without a fresh passing verdict of that run for exactly those bytes: `op-critic-verdict-missing` (the run is not recorded yet: the runtime owes it, never the op or the Kernel),
  `CRITIC_VERDICT_STALE`, or `op-critic-verdict-failed` (a score under the declared minimum is the op's `error-work`: the refusal carries every
  failed check with its evidence and fix, and the retry is fed that critique). The three happy errors of the Critic
  (`CRITIC_NO_INDEPENDENT_MEMBER`, `CRITIC_UNAVAILABLE`, `CRITIC_QUOTA_OUT`) hold the settle (the settler tries again after `tail.retryMs`, up to `tail.maxAttempts`, then a Supervisor item names the checker); `starci work decision-critic` stays a verb for a person who wants to see a critique. The token budget of one critique is declared per kind in
  `critic-rubrics.yaml`; it is provisional, and what a real critique costs is not yet measured.

## The op loop — `knowledge/op-gate.yaml`

Every code-writing op listed in `knowledge/op-gate.yaml` `enforcedOps`
(`backend.*`, `interface.scaffold|implement`, `package.scaffold`,
`code.refactor`, `test.author`, `unit|integration|e2e.verify`,
`grammar.update`, `task.execute`) runs one loop:

1. **READ** — `scripts/gates/read-digest.mjs --root <app> --touch <files>`
   prints what the slice must read before coding: the `starci app explain` slot map of
   each touched file, the pattern files of each file kind (`op-gate.yaml`
   `kinds`: the family's `always` files plus those of the longest listed slot
   prefix) and the example files of the same slots. It records the READ digest
   (`starci/read-digest@1`, every file with its sha256).
2. **CODE** — inside the owned paths, in the workflow worktree.
3. **CHECK** — `starci gate run --root <app> --changed <files>
   [--tests <pattern>]`, forced every round. It runs, in order: the merge guard;
   `starci app lint --changed` at the app root (the BE canon under `be/`, the FE canon
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
5. **REPORT** — `starci kernel report` with `gate.json` and `read-digest.json`
   attached. Still red after the last round is `blocked` with the exact
   findings.

`gate.mjs`, `read-digest.mjs`, the packet's owned paths and every finding use
the same app-relative paths (`be/src/...`, `fe/apps/...`) at the app root.

**Settle enforcement.** `starci kernel settle` re-reads both attached documents itself
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
  setup runs a real `starci npm ci` at the app root: there are no `node_modules`
  junctions anywhere. The worktree is registered in `machine.sqlite`
  `worktrees` as kind `workflow`, keyed by Orca's worktree id, against the cap
  per repository; a workflow over the cap waits.
- **Ops.** Every Git op of the workflow starts with `worker-start --worktree <the
  workflow worktree>`. Ops on the same side (`be/` or `fe/`, from the op's
  owned paths) run one after another; ops on different sides run in parallel,
  and an op that owns both sides runs alone. The dispatcher enforces it.
- **Checkpoint.** Ops never commit. When an op settles green, the runtime
  (`checkpointOp`) commits exactly its leased owned paths on the registered workflow branch as that op's
  checkpoint: it is the only committer on the branch. The op's gate base is the
  previous checkpoint (the merge-base with main for the first op), so only the
  op's own new findings block. The base is per side: settle also accepts an
  older checkpoint when no checkpoint since then touched the op's owned paths
  (`gateBasesOf`), so a `be/` checkpoint never makes an `fe/` op in flight run
  its gate again; any other base is refused (`op-gate-base-mismatch`).
  Native settle completes its acceptance checks before checkpoint or
  preserve/reset effects and rejects duplicate terminal settles before those
  effects. A workflow lock serializes acceptance and the checkpoint primitives.
  Durable prepared/applied ledger receipts recover a partial effect with its
  original SHA, owned scope and attempt/dispatch attribution. A conflicting
  recovery refuses; a no-change pass reports `committed:false` with its actual
  SHA. [The settle declaration](../modules/cli/commands/kernel/settle.yaml)
  owns the placement readers, refusal boundary and receipt fields.
- **Milestone rebase.** After a green checkpoint, when no other op of the
  workflow is live, settle asks the milestone policy
  (`scripts/lib/rebase-milestone.mjs`) whether main moved enough: main changed
  a path the branch also changed, or main is `worktrees.rebaseMilestoneBehind`
  commits (`modules/kernel/product-land.yaml`) past the merge-base. If so, the
  branch is rebased onto main now and the checkpoint follows. A conflict leaves
  the branch where it was, keeps its head as
  `refs/heads/preserved/<workflowId>/rebase-<main sha>`, and opens one
  `rebase-conflict` Decision Item (the Kernel's, escalated on the usual
  ladder); the same main tip is never tried twice. Optional failures before a
  rebase effect leave the accepted checkpoint usable. The runtime proposes in
  an internal detached scratch tree, then records its exact rebase intent
  before applying it (`scripts/kernel/workflow-rebase.mjs`). A partial branch,
  index or registry effect holds native acceptance; the same dispatch resumes
  its frozen decision and proposal, retaining the original milestone policy.
  The settle declaration owns the rebase event and recovery fields.
- **Work records.** A Work record is committed only by the runtime, on the
  workflow branch of its owner workflow (`scripts/kernel/work-ownership.mjs`
  `ownerOf`): an op that writes a record commits nothing, and its green
  checkpoint carries the record like any other owned file. A workflow that is
  not the record's owner may not change it: settle refuses the op
  (`workflow-work-record-not-owner`; a record no rule but the repo-owner
  fallback names is the writer's). The owner reads its own records at its
  workflow branch (`workflowCommittedReader`), so its later settles see them
  before it lands; every other workflow reads main, so a peer sees the record
  when the owner lands. `starci kernel record-change` reads the owner's records in its
  workflow worktree.
- **Failure.** A failed or blocked op's uncommitted work is preserved to
  `refs/heads/preserved/<workflowId>/<op>` (a snapshot commit that never holds
  `node_modules`), then its owned paths and foreign changes are reset to the
  last checkpoint. Other live ops' paths stay intact.
- **Finish.** Main is touched only when the workflow ends, in this order: a
  full `gate.mjs` over the whole branch against its merge-base with main; the
  merge guard; `review.verify`, which must have verified the exact head that
  lands; a rebase onto main (the hard stop for a conflict); main
  fast-forwarded and pushed. The finish then marks the worktree
  `release-pending`; it never removes it itself, because the workflow's
  terminals still run there. Any refusal leaves main untouched.
- **Release.** The host-side controller removes a `release-pending` worktree
  once every terminal in it is released: the link check, then Orca's worktree
  removal, then the runtime's verified branch cleanup. The reconciler's GC controller
  (`gc:worktrees`, always active) also collects a workflow worktree whose
  owner process is gone longer than `ownerGoneMs`, always after preserving its
  work, and only through Orca. `starci machine worktrees
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

<!-- roles:begin kernel -->
**Kernel** (modules/kernel/roles.yaml#kernel): One workflow.
- Does:
  - Answers the judgments of its menu: settles a non-green report by re-running the checks, decides retry once the runtime's bounded retry is spent, switch agent or re-plan inside the goal, chooses the write set of a leg the plan leaves open, the checks that reconcile a stub sibling and the re-cut of a slipped seam, routes a defect the owner reported on the handover to the slice it names, and answers ops' questions from the goal and the recorded decisions. The runtime performs what is mechanical: dispatch, bounded retry, the enqueue of a leg whose plan declares its write set, the rework of a red node, the re-run of a stale proof.
  - Reports up to the Supervisor for: a conflict with another workflow (shared files, ports, provider capacity, a shared foundation); a suspected runtime defect, with evidence, after the workaround; a self-contradicting contract; bounds exhausted inside the workflow; a plan deadlock it cannot re-plan inside the goal. No routine status reports: the Supervisor reads the ledger.
  - Sends an owner-class question to the owner through the runtime's ask channel.
- Must clean up:
  - everything stuck inside its workflow: held jobs, stopped ops, open Decision Items, its own worktrees and terminals, until it finishes
- Never:
  - does an op's work
  - changes the runtime
  - touches another workflow
  - decides for the owner what is costly to reverse
  - leaves ready work or a reported block unhandled
  - runs a mutating verb itself: it answers the items of its menu with starci kernel decide, and the runtime does the rest
  - works around a bug: a bug is none-fits, recorded for Debug
  - raises a supervisor-gate before the workaround its gate cause names (the gate ladder refuses it: modules/kernel/op-incident-policy.yaml gateCauses)
  - pins a model around a lineage exclusion without a recorded op-override decision
- Owns: one workflow: its plan, its jobs and its gates. Decides alone: settle of a non-green report, retry past the runtime's bound, switch agent, re-plan inside the goal, the write set of an open leg, seam duties, the route of handover feedback, and answers to ops.
- Reports to: Supervisor (one of the five causes above). Overseen by: the runtime, Supervisor, Debug.
- Measure: legs done inside their bound with zero human untangling.
- Wake budget (provisional): 20 turns and 6000000 tokens per wake, 40 turns and 6000000 tokens for its boot (the contract files and the rev-ack manifest); over it, the digest reports the wake as a departure of the Kernel (a bug): a wake answers the menu and yields.
- Runtime changes (modules/kernel/revision-scope.yaml): woken once with exactly the changed files that concern it, it reads them and attests with starci kernel revision-ack; a change that concerns it nothing costs it nothing; it is replaced by a fresh seat, at its next yield, only when a rule of its contract was removed or reversed or its boot prompt changed.
- Guard: its terminals are bound as the "lead" role of modules/kernel/command-policy.yaml.
- Happy errors it handles (the system working as designed, handled inside the chain through the policy):
  - worker-question (policy row worker-question): an Op asks: the Kernel answers from the goal (menu worker-question) or sends it to the owner
  - worker-stalled (policy row worker-stalled): a worker the nudges did not move: the Kernel nudges, replaces or stops it (menu worker-wedged)
  - peer-wait (policy row peer-wait): another workflow has not landed what a step needs: the Kernel waits for the typed condition or the peer's message (menu peer-message)
  - supervisor-gate (policy row supervisor-gate): a gate the Supervisor rules on: the Kernel waits for the ruling and acts on it
  - owner-gate (policy row owner-gate): a matter that is the owner's: the Kernel waits for the answer
  - failed-leg (policy row failed-no-step): a leg failed with no recorded step: the Kernel retries, switches agent or re-plans inside the goal (menu job-decision)
  - orphaned-frontier (policy row orphaned-frontier): a running workflow with nothing open: the Kernel proposes the next leg (menu decision-item)
- A bug in this role (the chain neither fixes nor works around it; Debug removes it with a change to .claude) is detected by:
  - the Kernel runs a command that is not a starci verb or a pure read: KERNEL_STARCI_ONLY from the seat guard
  - the Kernel uses a verb the runtime-driven menu replaces: KERNEL_USE_DECIDE from the seat guard
  - a Kernel wake spends more than the per-wake budget: kernel-wake-budget problem line of the digest
  - a Kernel decision names a menu item or choice the menu does not hold, or a step fails: menu-item-unknown, menu-choice-unknown, menu-direct-option, menu-text-missing, menu-step-failed, menu-step-usage, menu-verb-unknown, menu-unreadable
- Principles: P1 P2 P3 P4 P5 P6 P8 (modules/kernel/roles.yaml, principles).
<!-- roles:end kernel -->

## Updating the runtime while workflows run

The runtime tree can change while workflows run without any workflow conflicting with the update. What a change asks of each role is one table,
`modules/kernel/revision-scope.yaml`, and the `revision-scope` self-check proves that every tracked path of the tree matches a row, that the files the
engine loads are derived from its import graph, and that the files each seat's launch prompt is built from are the files its generator reads.

| Change | Kernel and Supervisor | Op and Critic | Engine |
|---|---|---|---|
| docs, tests, changelog, tooling | nothing | nothing | nothing |
| CLI verb code, a script no long-lived process imports | nothing: each command is a new process that reads the tree | nothing | nothing |
| guards, command policy | bite on the next command | bite on the next command | nothing |
| code the engine's process imports (derived) | nothing | nothing | one restart |
| a seat's contract, menu or policy, rules only added | updated in place: woken once with exactly the changed files, reads and attests them | nothing | nothing |
| a seat's contract, a rule removed or reversed (a line deleted or modified) | replaced by a fresh seat that boots from the stores, at its next yield | nothing | nothing |
| the files a seat's launch prompt is built from | replaced the same way (the prompt is loaded once at birth) | nothing | nothing |
| an op brief or the knowledge it reads | the Kernel re-reads before it enqueues the op | the attempt in flight continues under its admission; the next try is admitted under the new rules | nothing |
| the Critic's rubric | the Kernel re-reads | the next Critic run reads it | nothing |

A change that concerns a role nothing is written to that role as a `not-concerned` record with the diff hash, so it costs the seat no wake and blocks
nothing. A concerned seat is woken once per revision change even when its menu is empty; several commits deployed together are one change, and the
same revision never wakes a seat twice. A seat already due for rotation by wakes or tokens is replaced by that rotation and the revision change folds
into it. A commit may declare a contract edit wording-only with the trailer `Revision-Wording: <path>`; the declaration holds only for a file that
keeps its structure (every key, list entry, choice, heading and bullet), so an edit that deletes a list entry or a choice stays a replacement. A seat
verifies its own state with `starci kernel status` (field `revisionNotice`) or `starci supervisor status`, and `starci debug digest` prints one line per
seat: the revision it acked, whether the last change concerns it and the files it owes. `starci kernel revision-ack` and `starci supervisor
revision-ack` list the owed files with their hashes (`--plan`) and attest them; the record carries two revisions, a count and a hash, and the file
list lives in the blob store, so an attestation of any number of files stays under the event payload limit.

At settle the runtime records, per proof the op owes, the revision the attempt was admitted under and whether the rules of the judge that decides it
moved since (event `settle-revision-recorded`).

## Seat cost

A seat costs by the turns it re-reads, and its context grows about a thousand tokens per turn, so one long session costs the square of its turns (measured: 50 k tokens at the first turn, 700 k to 800 k at turn 230 to 620). The runtime therefore wakes a Kernel only while its menu holds an item (`scripts/kernel/wake-menu-gate.mjs`; the stall wake asks the same projection), prints per seat the wakes that decided nothing (`starci reconciler status`, `starci debug digest`), and replaces an idle Kernel that has received `rotation.kernel.afterWakes` wakes or spent `afterTokens` tokens since its boot by a fresh seat (`scripts/kernel/seat-rotation.mjs`): the new Kernel reads the ledger, never the old seat's memory. The numbers live in `modules/reconciler/seat-cost.yaml`.
