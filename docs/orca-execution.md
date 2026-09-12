# Orca execution adapter

This is the Orca realization of the shared [execution agent model](execution-agent-model.md).
In runtime 5.0 the topology is two layers, not five: **one workflow kernel** and **a pool of operation
agents**. A workflow is one goal in one worktree; the kernel is an ordinary local process
(`execution/workflow-kernel.mjs`) that owns the loop in that worktree, and each operation instance is the
mandatory agent boundary and maps one-to-one to one concrete provider agent. Operations never create
worktrees and never create nested agents.

There is no Plan Coordinator and no per-workflow Workflow Manager. A model is no longer asked to run a
control loop: the loop is code, and a model is called only as a typed function for a decision a model is
actually better at (`assessGoal`, `planOp`, `decide`). Orca supplies exactly two things - worktrees, and
terminals in which an agent can be launched and attested - so the same kernel runs in a Codex or Claude host
session with no Orca present. `supervise`, `coordinate`, `start-monitor`, `replace-monitor` and
`start-coordinator` are gone with the layers they served; see [v5-plan.md](v5-plan.md) for why each 4.x
failure mode traced back to putting a language model in charge of the loop.

`execution/orca.mjs` remains the 4.x child-workflow runtime boundary and is still exercised by its tests; it
accepts only orchestrated mode with control plane `orca`, and it never invokes a shell or the Orca CLI -
callers inject an Orca adapter, which keeps unit tests deterministic and lets the installed runtime translate
calls to the version-matched `orca orchestration` commands. New work runs through the kernel instead.

Each operation is a fresh supervised agent started inside the workflow worktree and released immediately
after its accepted report. Operation agents are never reused. A Qwen operation runs as one command terminal
per attempt, created with the declared target command and fed by `dispatch --return-preamble` with a verified
submission; a managed Codex or Claude operation is created only by `worker-start`, and attaching an
operation to an existing terminal is forbidden either way. The kernel never writes implementation code,
repairs an operation or runs an operation's tests on its behalf - it re-runs the operation's declared checks
to decide whether to accept the slice, which is a different thing: the effects belong exclusively to the
operation agent.

## Approval boundary

Before the first effect, the Coordinator presents one complete workflow/Plan brief and binds the
actual subsequent user acceptance to its digest. `approvals/policy.json` and
`starci approval decide <context.yaml>` classify each next action. Worktree creation, worker
dispatch, bounded edits, tests, retries, technical review/integration, no-effect provider fallback,
conflict-owner work and SDS sidearms are automatic when they remain inside the accepted action,
repository and scope ceilings. The Coordinator does not ask again for those procedures.

The decision is `need-user` for a material goal, business/SRS, scope, repository or ownership
change; an undeclared push/deploy/migration/delete; a missing credential; unresolved business
alternatives; a reserved checkpoint; a safety block; or partial/unknown effects. Completion is
reported automatically when the accepted brief delegated technical acceptance and reserved no
exit checkpoint.

## Request boundary

The adapter consumes the shared request contract with these orchestration fields:

```js
{
  id: 'release-widget',
  mode: 'orchestrated',
  controlPlane: 'orca',
  workflowSelection: {
    provider: 'openai',
    model: 'gpt-5.6-sol',
    effort: 'high',
    orcaLaunch: {kind: 'managed-agent', agent: 'codex'}
  },
  operations: [{
    id: 'backend',
    dependsOn: ['architecture'],
    spec: 'Implement the accepted backend slice',
    allowedFiles: ['services/widget/**'],
    selection: {
      provider: 'openai',
      model: 'gpt-5.6-sol',
      effort: 'high',
      orcaLaunch: {kind: 'managed-agent', agent: 'codex'}
    }
  }]
}
```

In the legacy 4.x adapter the workflow selection chooses the persistent agent hosted in the child worktree.
Operations are ordered.
Dependencies may reference only earlier operations, and every operation carries its own resolved
provider/model selection and nonempty file allowlist. An operation selection chooses its subagent; it
does not change ownership, scope, criteria, authority or workflow worktree.

The workflow wrapper freezes dependency outputs into the operation input before dispatch and accepts
only the operation's normalized output afterward. Each operation has its own nested Task/Dispatch,
agent identity, ownership and output contract while reusing the workflow child. Several agents hidden
behind one operation instance are invalid.

`planOrcaExecution(request)` performs validation and returns an effect-free plan for one workflow
child. The outer parent owns cross-workflow dependencies, review and integration; the child wrapper
owns only its logical operation state and scheduler.

## Injected Orca methods

The runtime functions use only these injected methods:

- `createRun(input)` returns `{runId}`.
- `createTask(input)` creates either a workflow-wrapper Task or a nested operation-subagent Task and returns `{taskId}`.
- `dispatchWorker(input)` returns `{dispatchId, worktreeId}` for a wrapper and `{dispatchId}` for an operation. For a wrapper it creates the workflow child; for an operation it launches the selected managed agent in that existing child. A recognized provider must use its native Orca agent id; Qwen 3.8 Flash uses `qwen-code` and inherits the verified model from Qwen runtime configuration.
- `setWorktreeParent(input)` explicitly binds the new child to the exact main Coordinator worktree.
- `showWorktree(input)` returns the exact child record used to attest `parentWorktreeId` before any operation Task is created.
- `showWorker(input)` returns the exact Task/Dispatch/worker/provider receipt used before UI naming.
- `renameTerminal(input)` canonicalizes the native terminal title after provider readiness and again before release.
- `stopWorker(input)` retires an operation attempt superseded by a shared change.
- `releaseWorker(input)` releases the exact settled worker after an accepted `worker_done`.
- `integrateChange(input)` performs a coordinator-owned integration action and returns only after the shared change is on the base used by new worktrees.

The wrapper Dispatch receives `worktree: {kind: 'new-child', isolated: true, parentWorktree: {selector, id}}` exactly once. The adapter then sets and reads back the parent lineage. A null or different `parentWorktreeId` is a blocking topology defect; membership in the same orchestration Run is not sufficient. Every
operation Dispatch receives `worktree: {kind: 'existing-child', ...}` plus
`agent: {kind: 'isolated-subagent'}` and explicit false permissions for merge, rebase, cherry-pick and
push. A command-terminal adapter is reserved for an exact per-operation model override that the
native adapter cannot represent. It starts the declared CLI in the existing workflow worktree and
retains the nested Task/Dispatch/operation correlation. It must not silently convert an unsupported
launch into success.

For Qwen 3.8 Flash, the Workflow Manager creates the operation Task with display name
`[Op] <operation> - <scope>`, then calls `worker-start --task <task-id> --worktree current --agent qwen-code`.
It first uses `worker-show` to attest the exact Task, worker, native `qwen-code` agent and configured
`qwen3.8-flash` model. It then reapplies the canonical title with `terminal rename` and verifies that
title with a second `worker-show` before accepting effects. This sequence keeps one Task, one
Dispatch, one native branded agent and one supervised worker resource. Nested provider agents remain
forbidden by the operation contract and are verified at the boundary rather than by replacing the
native launch with a shell command.

If native start reports `agent_prompt_stalled` or `session_not_reported`, fence and reconcile that
exact attempt. Retry the same resolved target or the next declared provider only after effects are
verified absent. Never convert the failed attempt into a command terminal, or use `dispatch --inject`,
`dispatch --return-preamble`, `dispatch --to <terminal>`, manual prompt submission or a retained
unsupervised terminal as a successful operation.

The display contract is mandatory at creation time:

- workflow worktree: `[Workflow] <Workflow>`;
- the kernel process that owns the loop in it: `[Kernel] <Workflow>`;
- isolated operation agent: `[Op] <operation> - <scope>`.

The executable call contract is `providers/orca/calls.yaml` (compiled to `calls.json`); `index.yaml`
documents the same calls per role. `execution/orca-calls.mjs` builds every argv from that contract,
verifies each declared command and flag against the live `orca agent-context` before the first effect,
replays an unknown mutation once with `--retry-request`, and returns every exit code as a
`starci/orca-call-result@1` envelope with `outcome` (`ok`, `failed`, `unknown`) and `effectState`
(`committed`, `none`, `partial`, `unknown`). An Orca failure is a classified result; only a contract
violation throws.

The kernel starts an operation only through `execution/orca-supervised-launch.mjs start-op`;
it never assembles `task-create`, `worker-start`, candidate fallback or terminal naming commands itself.
Inside one invocation the launcher attests the Run, creates the canonical Task once, then tries the one
candidate the allocator supplied (`startOperation({candidates})`) or, when none was supplied, walks the
resolved chain: for each candidate it starts one fresh native worker, proves prompt delivery
(`worker.state` ready and `dispatch_input` accepted), attests the effective agent/model/worktree,
canonicalizes the title, and accepts. A failed candidate is classified; when a Dispatch exists it is
settled (`worker-stop`, `worker-release` must report `released` or `already_released`). Only a proven
`effectState: none` admits the next candidate; `partial` or `unknown` stops with a typed reconciliation
request, and an exhausted chain returns `ok:false, exhausted:true, attempts[]`. A caller that has verified,
from receipts, that a chain target cannot start on this host passes `--skip <target:reason>` (reason from the
registry's `fallback.allowedReasons`); the skip is recorded as a no-effect attempt and the chain starts at the
next candidate. The kernel never uses `--skip` for allocation: it names the candidate it wants, so a target
that was never tried is never recorded as having failed. Companion commands are
`settle --dispatch`, `sweep` (close dead terminals in the workflow worktree after settlement) and
`verify`; the workflow control loop itself is the kernel's (`workflow-goal`, `workflow-approve`,
`workflow-run`, `workflow-status`).
`execution/orca-adapter.mjs` is the concrete adapter for `execution/orca.mjs` on the same runner,
including `waitBoundary` (keepalive-filtered `check --wait` with `--ack`). A visible
`Bash: ...` subtitle is only the native agent's current tool activity; identity comes from the native
immutable Task display name and supervised worker/provider receipt. The terminal title is mutable UI
metadata: native activity may change it while the agent works. The kernel restores the canonical
`[Op] ...` title without fencing the worker when the immutable identities still match, and restores it once
more before release. Title drift alone never invalidates otherwise valid operation effects.

## Workflow kernel (5.0)

The control loop above the launcher is code, not an agent. `workflow-goal` turns a job into a goal and prints it
for exactly one user approval. In a repository that owns a Work tree (`<repo>/.starciwork/features`) the
ledger **is** that tree: the kernel lists the eligible nodes in `--scope`, derives each operation from its
node (goal from `description`, allowlist from `implementation.changes[].files`, checks from
`extensions.work3.checks`, acceptance from `assertions`), names a node that declares no allowlist or checks
as `ledger incomplete` instead of guessing one, and asks `assessGoal` only for the definition of done and
the risks and questions. Without a Work tree, `assessGoal` assesses the whole ledger and the operation set
itself. Either way the goal is frozen by the approval; `workflow-approve` records that approval and freezes the goal; `workflow-run` runs the loop;
`workflow-status` reads one workflow's own directory. A workflow is one goal in one worktree with a pool
of up to ten operation agents, parallel whenever their allowlists are disjoint, so there is no shared
file to arbitrate. `execution/runtime-allocator.mjs` assigns each ready operation to the
first runtime of that role's preference order that has a free slot, remaining budget and no cooldown
(`prefer-then-overflow`, declared in `profiles/runtimes.yaml` and explained in
`docs/runtime-allocation.md`); a launch failure or rate-limit releases the slot, parks that runtime for a
classified cooldown and the operation overflows to the next preference, and a verify operation is allocated
with the implementing runtime in `avoid`. The launcher is handed that one resolved candidate through
`startOperation({candidates})`, so no chain is walked and no target is reported as skipped that was never
tried. Acceptance is never
self-declared: a report (`starci/op-report@1`, the file under the workflow's `reports/` directory, with
the Orca message only as the wake-up) is evidence, and the kernel itself re-runs the operation's checks,
computes the changed files from git rather than from the report, refuses anything outside the allowlist,
then commits that one operation. On the Work ledger that commit carries a
`Work: <node id>` trailer and the accepted slice is written back into its node - `state`, `completion` and an
evidence manifest - through `execution/work-ledger.mjs`, which owns those fields and nothing else; a refused
write restores the node's original bytes and becomes a `needUser` item rather than a green report over a
ledger that does not agree. `report`, `wait` and `notify` remain the operation-side evidence and boundary
commands. All runtime state lives in `.starciwork/_local/workflows/<id>/`, where
`events.jsonl` is an append-only audit trail that can replay a run from seq 0 and `state.json` is a
derived snapshot. Orca supplies worktrees and attested agent terminals only; the same kernel runs on a
Codex or Claude host with no Orca present. The Op contract is rendered from
`docs/supervision-templates/op.md`. See [v5-plan.md](v5-plan.md).

## Normal execution (the legacy 4.x adapter)

The remainder of this document describes `execution/orca.mjs`, the 4.x child-workflow boundary that is still
shipped and tested. Its parent/child wording is that module's own model, not the 5.0 topology above.

`startOrcaExecution({request, parentRunId, parentWorktree, adapter})` attaches one workflow child to an existing Orca
parent Run; omitting `parentRunId` creates a compatibility parent Run. `parentWorktree` carries the exact main selector and id. It creates one wrapper Task/Dispatch/worktree, binds and attests the child lineage, and only then starts the first ready operation-subagent wave.
`dispatchReadyOrcaOperations(plan, adapter)` starts every currently independent operation in that
same child, up to the configured ceiling; it does not serialize unrelated branches.

`acceptOrcaWorkerDone({plan, event, adapter})` requires an exact Task ID, Dispatch ID, operation ID, and explicit `succeeded` or `failed` outcome. Every `filesModified` entry must be a safe relative path matched by that worker's allowlist. Absolute paths, traversal, duplicate entries, wrong attempt identities, and out-of-scope files are rejected without advancing dependencies. An accepted completion reapplies the canonical operation title and releases that exact worker before dependencies advance; a closed terminal that cannot be renamed is recorded as a UI defect and does not invalidate verified effects. A failed operation blocks its dependent branch only; already runnable unrelated workers remain runnable.

Allowlist patterns are repository-relative paths. Exact paths and whole-segment `*` or `**` wildcards are supported. Backslashes and partial-segment wildcards are rejected to keep validation consistent across operating systems.

## Event-driven coordinator wait

After dispatch, the native main-worktree Coordinator does not supervise operation terminals. Each
Workflow Manager uses the version-matched orchestration event wait with a cursor, waits for, and receives its
operations' `question`, `escalation`, `heartbeat`, `worker_done` and `worker_failed` events. It handles
operation progress by deciding and dispatching operation agents for bounded repair, safe local approval,
provider fallback and module-local SDS sidearms; it does not execute those operations itself. Only a
normalized cross-workflow/shared-owner/authority/human-decision boundary,
manager failure or workflow completion is sent to the parent Coordinator. The parent returns decisions
through the Workflow Manager, never directly to an operation. A healthy heartbeat confirms liveness
but requires no parent reply, terminal read or user update.

A wait timeout means only that no matching boundary event arrived. Re-arm the wait;
do not turn the timeout into a terminal poll. Inspect liveness only after the workflow's
declared deadline or heartbeat grace is breached, or when Orca reports a closed,
crashed or otherwise terminal worker. Start with task/dispatch state and the latest
heartbeat. Read at most one bounded terminal tail when those signals cannot determine
whether the worker is slow or stopped.

The Workflow Manager acts only by deciding and dispatching at operation boundaries; the parent acts only
by deciding and scheduling at normalized workflow boundaries. Neither manager performs lower-layer work:

- receive a cross-workflow/shared-owner/authority/human-decision escalation from the manager;
- return the decision to that manager for delivery to its operation;
- accept a normalized workflow completion and schedule newly ready workflows;
- recover or replace a genuinely stopped Workflow Manager while preserving its child worktree.

Do not repeatedly call terminal read/list, inspect partial diffs, duplicate tests,
send progress prompts, restart healthy operations or surface unchanged state to the
user. The child remains responsible for reaching its own terminal event.

The canonical machine-readable contract is authored in
`workflows/supervision.yaml`, compiled to `.dist/workflows/supervision.json`, and
enforced by `execution/supervision.mjs`. Authored policy contains no run-specific
identifiers. Each bound Plan stores its current cursor, message/delivery identities,
attempt identity and liveness timestamps under excluded `_local` runtime state.

## Shared-change escalation

An ordinary worker cannot expand its allowlist. It escalates with reason `out-of-scope-shared-change`, exact shared files, and its current Task/Dispatch identity. The coordinator then supplies an explicit decision to `createConflictOwner`:

```js
{
  action: 'create-conflict-owner',
  affectedOperations: ['backend'],
  allowedFiles: ['packages/contracts/**'],
  spec: 'Implement the reviewed contract adjustment'
}
```

The adapter computes affected dependents, stops and supersedes active attempts only on that branch,
and leaves unrelated work alone. It creates a conflict-owner operation subagent in the affected
workflow child using a separately supplied provider/model selection. A conflict spanning workflows is
promoted to the outer parent, which creates a separately owned conflict workflow child.

The conflict owner's `worker_done` receives the same exact identity and allowlist validation. A successful result enters `awaiting-review`; it does not silently unblock consumers. `integrateOrcaSharedChange` requires the coordinator's explicit `{review: 'accepted', integration: 'integrate'}` decision, stops superseded affected attempts, and calls the injected coordinator integration method. It then records the conflict Task ID as a `sharedDependency`, emits `syncResumeDependencies`, and creates fresh resume Task/Dispatch attempts from the integrated base. Workers never merge, rebase, cherry-pick, or push to synchronize themselves.

## Implementation architecture sidearm

`backend.implement` and `interface.implement` declare an `implementation.architecture` secondary.
When observed source, API, render or test facts prove that accepted SDS is technically missing or
contradictory—and business/SRS remain unchanged—the implementation attempt waits. The workflow
wrapper creates a separate `architecture.decide` operation subagent in the existing workflow child;
its allowlist covers only the selected SDS paths. The code worker never edits SDS.

The sidearm may not change product source, business behavior, SRS, ownership or accepted scope and
may not create another secondary. Its successful result enters architecture review; the Coordinator
integrates only validated English, source-independent SDS. The architecture Task becomes an
explicit dependency of a fresh implementation attempt, which reruns affected checks. Independent
branches keep running. A material change is `need-user`, not a sidearm.

This makes shared-change recovery visible in both layers:

1. the Orca conflict-owner Task/Dispatch is durable execution provenance;
2. each affected operation has an explicit dependency on that Task before it resumes;
3. unrelated operation attempts retain their original Dispatch in the same workflow worktree.

## Exported API

- `planOrcaExecution(request)` — validate and create an effect-free plan.
- `startOrcaExecution({request, parentWorktree, adapter})` — create the Run, bind the workflow child to the exact main worktree, and start the first Task/Dispatch wave.
- `dispatchReadyOrcaOperations(plan, adapter)` — dispatch only ready operations.
- `validateWorkerDone(worker, event)` — exact identity and write-scope validation.
- `acceptOrcaWorkerDone({plan, event, adapter})` — settle one operation or conflict-owner attempt.
- `createArchitectureSidearm({plan, event, decision, selection, adapter})` — pause one implementation branch and create its SDS-only `architecture.decide` worker.
- `integrateOrcaArchitectureSidearm({plan, sidearmId, decision, adapter})` — integrate reviewed SDS and resume affected implementation from a fresh worktree.
- `createConflictOwner({plan, event, decision, selection, adapter})` — create the authorized shared-change worker.
- `integrateOrcaSharedChange({plan, conflictId, decision, adapter})` — record coordinator review/integration and resume affected work from the integrated base.
