# Orca execution adapter

This is the Orca realization of the shared [five-layer agent model](execution-agent-model.md).
Plan, Coordinator and workflow wrapper remain flexible; each operation instance is the mandatory
isolation boundary and maps one-to-one to one concrete provider agent in one child worktree.

`execution/orca.mjs` is the StarCi planning/runtime boundary for supervised multi-agent execution. It accepts only a `WorkflowRequest` whose execution mode is `orchestrated` and whose control plane is exactly `orca`. A request for native teams, generic subagents, or an omitted control plane fails before the adapter creates a Run or worktree.

The module never invokes a shell or the Orca CLI. Callers inject an Orca adapter, which makes unit tests deterministic and lets the installed runtime translate calls to the version-matched `orca orchestration` commands.

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

Operations are ordered. Dependencies may reference only earlier operations, and every operation must carry its own resolved provider/model selection and nonempty file allowlist. Selection chooses a worker; it does not change operation ownership, scope, criteria, or authority.

The workflow wrapper freezes dependency outputs into the operation input before dispatch and accepts
only the operation's normalized output afterward. A module fan-out is valid only when the DAG declares
separate operation instances, each with its own Task, Dispatch, ownership and output contract. Several
workers hidden behind one operation instance are invalid.

`planOrcaExecution(request)` performs validation and returns an effect-free plan. The plan has one coordinator, logical operation state, and no hidden scheduler. The coordinator owns ownership, review, and integration decisions but has `implementsChanges: false`.

## Injected Orca methods

The runtime functions use only these injected methods:

- `createRun(input)` returns `{runId}`.
- `createTask(input)` returns `{taskId}`.
- `dispatchWorker(input)` returns `{dispatchId}` and implements the selected `managed-agent` or `command-terminal` launch strategy.
- `stopWorker(input)` retires an operation attempt superseded by a shared change.
- `releaseWorker(input)` releases the exact settled worker after an accepted `worker_done`.
- `integrateChange(input)` performs a coordinator-owned integration action and returns only after the shared change is on the base used by new worktrees.

`dispatchWorker` receives the operation selection, `worktree: {kind: 'new-child', isolated: true}`, and explicit false permissions for merge, rebase, cherry-pick, and push. A production adapter maps managed agents to supervised `worker-start`. A command-terminal adapter creates the declared command terminal, obtains the Dispatch preamble, and sends that preamble and task to the exact terminal while retaining the same Task/Dispatch correlation. It must not silently convert an unsupported native injection into success.

## Normal execution

`startOrcaExecution({request, adapter})` creates one Run and dispatches the first ready wave. A worker is always represented by one Orca Task and one Dispatch attempt in its own worktree. `dispatchReadyOrcaOperations(plan, adapter)` starts every currently independent operation; it does not wait on or serialize unrelated branches.

`acceptOrcaWorkerDone({plan, event, adapter})` requires an exact Task ID, Dispatch ID, operation ID, and explicit `succeeded` or `failed` outcome. Every `filesModified` entry must be a safe relative path matched by that worker's allowlist. Absolute paths, traversal, duplicate entries, wrong attempt identities, and out-of-scope files are rejected without advancing dependencies. An accepted completion releases that exact worker before dependencies advance. A failed operation blocks its dependent branch only; already runnable unrelated workers remain runnable.

Allowlist patterns are repository-relative paths. Exact paths and whole-segment `*` or `**` wildcards are supported. Backslashes and partial-segment wildcards are rejected to keep validation consistent across operating systems.

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

The adapter computes affected dependents, stops and supersedes active attempts only on that branch, and leaves unrelated work alone. It creates a new conflict-owner Task and Dispatch in another isolated worktree using a separately supplied provider/model selection. The coordinator chooses the owner and review policy; an authorized worker implements the change.

The conflict owner's `worker_done` receives the same exact identity and allowlist validation. A successful result enters `awaiting-review`; it does not silently unblock consumers. `integrateOrcaSharedChange` requires the coordinator's explicit `{review: 'accepted', integration: 'integrate'}` decision, stops superseded affected attempts, and calls the injected coordinator integration method. It then records the conflict Task ID as a `sharedDependency`, emits `syncResumeDependencies`, and creates fresh resume Task/Dispatch attempts from the integrated base. Workers never merge, rebase, cherry-pick, or push to synchronize themselves.

## Implementation architecture sidearm

`backend.implement` and `interface.implement` declare an `implementation.architecture` secondary.
When observed source, API, render or test facts prove that accepted SDS is technically missing or
contradictory—and business/SRS remain unchanged—the implementation attempt waits. Orca creates a
separate `architecture.decide` Task/Dispatch/worktree whose allowlist covers only the selected SDS
paths. The code worker never edits SDS.

The sidearm may not change product source, business behavior, SRS, ownership or accepted scope and
may not create another secondary. Its successful result enters architecture review; the Coordinator
integrates only validated English, source-independent SDS. The architecture Task becomes an
explicit dependency of a fresh implementation attempt, which reruns affected checks. Independent
branches keep running. A material change is `need-user`, not a sidearm.

This makes shared-change recovery visible in both layers:

1. the Orca conflict-owner Task/Dispatch is durable execution provenance;
2. each affected operation has an explicit dependency on that Task before it resumes;
3. unrelated operation attempts retain their original Dispatch and worktree.

## Exported API

- `planOrcaExecution(request)` — validate and create an effect-free plan.
- `startOrcaExecution({request, adapter})` — create the Run and first Task/Dispatch wave.
- `dispatchReadyOrcaOperations(plan, adapter)` — dispatch only ready operations.
- `validateWorkerDone(worker, event)` — exact identity and write-scope validation.
- `acceptOrcaWorkerDone({plan, event, adapter})` — settle one operation or conflict-owner attempt.
- `createArchitectureSidearm({plan, event, decision, selection, adapter})` — pause one implementation branch and create its SDS-only `architecture.decide` worker.
- `integrateOrcaArchitectureSidearm({plan, sidearmId, decision, adapter})` — integrate reviewed SDS and resume affected implementation from a fresh worktree.
- `createConflictOwner({plan, event, decision, selection, adapter})` — create the authorized shared-change worker.
- `integrateOrcaSharedChange({plan, conflictId, decision, adapter})` — record coordinator review/integration and resume affected work from the integrated base.
