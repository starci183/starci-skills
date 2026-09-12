# StarCi 5.0 plan: a kernel runs the workflow, models only decide

Status: in progress. Supersedes the supervision protocol of `v4.1-supervision-plan.md` and the
orchestration layers of `v4-plan.md`. The typed Orca call contract, the settlement rules and the
operation report schema from 4.x survive unchanged; the control loop above them does not.

## 1. Why 5.0

4.x put a language model in charge of the control loop and then asked it to be reliable. Every stall
traced to that one decision, not to the operation work:

| # | 4.x failure | What it cost | 5.0 rule that answers it |
| --- | --- | --- | --- |
| F1 | **Mailbox fence.** A terminal consumes only the Run it is bound to, so downward instructions to a supervisor bound to a nested Run silently vanished. | Decisions, replies and contract changes never arrived. | No supervisor mailbox. The kernel is one local process that reads and writes files; an operation receives its whole contract at launch and answers with one report file. |
| F2 | **Prompt stalls.** A delivered prompt could stay staged in an agent's input box while the launcher believed it was working. | A dead agent and a working agent looked identical. | Launch is the only place an agent is spoken to, and it is already attested. The kernel never types into a live agent, so there is no second channel to stall. |
| F3 | **Self-declared done.** An operation reported `done` with the checks it claimed to have run. | Green reports over unbuilt code. | Acceptance is machine-verified: the kernel re-runs every check itself, computes the changed files from git, and refuses a report whose files fall outside the operation's allowlist. |
| F4 | **Module-shaped workflows.** One workflow per code module meant one worktree per module and a merge problem per module. | Integration dominated the work. | One workflow is one goal in one worktree. Operations inside it are parallel by disjoint allowlist, not by repository layout. |
| F5 | **LLM-run control loops.** Supervisors improvised scheduling, retries, waiting and escalation in prose. | Non-reproducible runs; a turn ended before the goal. | The loop is code. A model is called only for a decision a model is actually better at, as a function with a typed form. |

## 2. The model in one page

```text
Job (what the user wants, in their words)
  └─ goal            assessGoal() turns the job into a definition of done, a ledger of the
     │               things that must exist, and as many operations as the job needs
     │               → presented once → one user approval → frozen
     └─ workflow      one kernel process + one worktree
        ├─ op pool    up to 10 operation agents at once, each with a disjoint allowlist
        │  └─ op      one contract in, one report file out, one commit
        ├─ verify     a verify op per accepted slice, allocated to a different runtime
        ├─ gates      the workflow's own gates, run by the kernel
        └─ final report
```

**Job → goal.** The user states a job. `assessGoal` (a model function, not an agent) returns a
definition of done, a ledger of the artifacts that must exist with their current status, and the
operation set with, per operation, its kind, goal, ledger ids, allowlist, references, checks and
acceptance. The user approves that goal exactly once. After approval the goal is frozen: the kernel
may re-plan an operation inside it, never widen it.

**One workflow, one worktree.** A workflow is not a module and not a repository. It is one goal, one
branch, one worktree, and a pool of up to ten concurrent operation agents inside it. Two operations may
run at the same time when their allowlists are disjoint; the kernel enforces that, so there is no
shared-file conflict to arbitrate and no cross-worktree integration to perform.

**Machine-verified acceptance.** An operation's report is evidence, not a verdict. The kernel accepts
a slice only when it has itself re-run the operation's checks, computed the changed files from git
(never from the report's own list), confirmed every file lies inside the allowlist, and found the
acceptance statements satisfied. It then commits that operation's files. One op, one commit: a rejected
operation leaves nothing behind to unwind.

**Verify on a different runtime.** Every accepted slice gets a verify operation, and the allocator is
told to avoid the runtime that implemented it. A model does not grade its own homework, and a provider
outage does not take the grader with it.

**One validator per workflow, before every commit.** Machine verification proves the checks pass; the
proof by contrast proves a spec can fail; neither proves the diff is the work the goal asked for. So the
kernel asks one validator - shared by the whole workflow - to accept or reject every op result after its
own checks and before the commit. The validator is an identity with memory, not a process: a headless
`validateOp` call per result (Sol first, Opus fallback, `validator.runtimes` in `config.json`), fed the
op, the diff, the check results, the references and a kernel-maintained memory page
(`<workflow>/validator/memory.md`, rebuilt from `verdicts.jsonl` and the job rulings, bounded), so it
judges every op by the same standard without living in a terminal. Its verdict is closed and it has no
authority outside the diff: a finding on a file the op did not change is dropped on the record. A reject
sends the op back with the findings; a second reject of the same op stops it at the user; an unavailable
validator never blocks a commit but three in a row are a `needUser` item. See
[workflow-kernel.md](workflow-kernel.md#validator).

**Gates, then the final report.** The kernel runs the workflow's gates after the last slice and writes
one final report: goal, ledger status, every operation with its runtime, commits, checks and verdict.

**The process itself is data.** Which operation kinds exist, the mandatory lane a ledger node walks
(`interface.draw -> frontend.implement -> uat.verify`, never a step skipped) and the bounded route an outcome
may take live in `profiles/kinds.yaml`, read by the pure `execution/kind-graph.mjs`: see
[kinds.md](kinds.md). The model fills an operation and picks among closed options; it never picks the process.

## 3. Runtime allocation instead of chains

4.x resolved an ordered provider chain and walked it. Ten parallel operations cannot walk one ordered
list; they all pick the same head, exhaust its rate limit, and fall through together.

5.0 treats every runtime as a pool, declared in `profiles/runtimes.yaml`:

- **Roles.** A runtime advertises the roles it may take (`implement`, `verify`, `write`, `decide`,
  `plan`); an operation kind maps to one role. Allocation never offers a runtime a role it lacks.
- **Slots.** `maxParallel` per runtime, so ten parallel operations spread across providers instead of
  queueing on one. Which eligible runtime a ready operation actually gets is the allocator's policy, not
  this plan's: see [runtime-allocation.md](runtime-allocation.md).
- **Budgets.** `opsPerDay` per runtime, counted and rolled over at the day boundary.
- **Cooldowns.** A runtime that fails to launch or answers with a rate-limit is released and parked for
  a classified cooldown; the operation takes the next eligible runtime in the same attempt, so one
  saturated or throttled provider never becomes the workflow's bottleneck.
- **Avoidance.** `allocate(kind, {avoid})` is how verify-after-implement and relaunch-after-failure are
  expressed: the same primitive, no special case.

## 4. `_local/workflows/<id>/` is the only runtime state

One workflow owns exactly one directory, and that directory is the entire runtime state of the product:

```text
.starciwork/_local/workflows/<yyyymmdd-hhmmss-slug>/
  events.jsonl     append-only audit trail; seq is assigned by the log, never by a caller
  state.json       derived snapshot, written by atomic rename so a crash never leaves half a file
  goal.md/.json    the assessed goal and the approval that froze it
  contracts/<op>   the contract handed to one operation agent
  reports/<id>     one report file per dispatch — the source of truth, the wake-up is only a signal
  checks/<op>      what the kernel re-ran, and what it got
  final-report.json
```

`events.jsonl` is never rewritten, so any run can be replayed from seq 0 and any claim in a final
report can be traced to the event that produced it. `state.json` is a convenience derived from it; if
the two disagree, the log wins. No other `_local` subtree exists, so there is no second place to look
and no stale mirror to reconcile.

## 5. Orca is a provider, not the architecture

4.x built the control loop out of Orca primitives — Runs, Tasks, Dispatches, supervisor terminals,
Run mail — and inherited Orca's semantics as product semantics. In 5.0 Orca supplies two things:
**worktrees** and **terminals in which an agent can be launched and attested**. Everything above that
is the kernel's, and the kernel is ordinary Node code reading ordinary files.

The consequence is portability. The same kernel runs in a Codex or Claude host session with no Orca
present: the host provides a working directory and a way to launch an agent, the allocator decides
which runtime, and the state directory is identical. An Orca host gains isolated worktrees and
attested managed agents; it does not gain a different model.

## 6. The launcher surface

`execution/orca-supervised-launch.mjs` keeps the supervised-launch and evidence commands and gains the
kernel's four:

| Command | Owner | What it does |
| --- | --- | --- |
| `workflow-goal` | kernel | assess a job into a goal and print it for the one approval |
| `workflow-approve` | kernel | record that approval and freeze the goal |
| `workflow-run` | kernel | run the loop: allocate, launch, verify acceptance, commit, gate, report |
| `workflow-status` | kernel | the current state of one workflow from its own directory |
| `start-op` | launcher | launch one attested operation agent in a worktree |
| `settle`, `sweep` | launcher | fence a dispatch; close dead terminals in a worktree |
| `report`, `wait`, `notify` | protocol | typed operation report, boundary wait tick, terminal message |
| `verify` | launcher | prove the live Orca command contract before any effect |

`supervise`, `coordinate`, `start-monitor`, `replace-monitor` and `start-coordinator` are gone with the
layers they served.

## 7. Non-goals

- No change to Work/SRS/SDS schemas, job matrices, `ops/*` or knowledge content.
- No new execution mode. A kernel run is the only orchestrated shape; solo stays for one bounded
  workflow in the current session.
- No Orca runtime patch. Provider defects are still detected, fenced and routed around, not fixed here.
- No npm publish and no product state migration. A 4.x runtime directory is read, never rewritten.
