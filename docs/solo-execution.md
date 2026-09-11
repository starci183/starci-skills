# Solo execution

`execution/solo.mjs` is the constrained workflow host for Codex and Claude when Orca is not
needed to coordinate several agents. It executes one workflow as an ordered sequence of
operations. It does not provide a subagent API, a team abstraction, parallel scheduling, or
shared-write coordination.

## Entry contract

Call `runSoloWorkflow({ host, workflow, adapters, receipt })` with `host` equal to `codex` or
`claude`. Any other host is rejected. A workflow has a stable `id`, at least one operation,
and an explicit gate for every operation:

```js
const workflow = {
  id: 'implement-example',
  operations: [
    {id: 'inspect', dependsOn: [], gate: {id: 'inspection-complete'}},
    {id: 'implement', dependsOn: ['inspect'], gate: {id: 'focused-checks-pass'}},
  ],
};
```

Dependencies are topologically sorted with declaration order as the stable tie breaker. A
cycle, unknown dependency, duplicate operation, or missing gate fails before an adapter can
perform work.

Workflow entry invokes `adapters.worktree.enter` exactly once. On a new run it receives
`mode: "create"`, unless `workflow.worktree` names an existing isolated worktree to require.
On resume it receives `mode: "require"` and the worktree stored in the receipt. The adapter
must return `{ id, isolated: true, ... }`; resumption must return the same `id`. This keeps all
operations in one isolated workflow worktree without coupling the state machine to Git or the
Orca CLI.

## Operation and gate adapters

The operation adapter is deliberately small and injectable:

```js
const adapters = {
  worktree: {
    async enter({mode, requiredWorktree}) {
      // Create or require one isolated worktree, then return its descriptor.
    },
  },
  operation: {
    async run({operation, worktree, resumeCursor}) {
      return {status: 'completed', output: {artifact: 'result'}};
    },
    async evaluateGate({operation, result, worktree}) {
      return {status: 'passed', observation: 'Focused checks passed'};
    },
  },
};
```

`run` returns `completed`, `paused`, or `failed`. A paused result must include an opaque
`resumeCursor`. Only a completed result reaches `evaluateGate`, whose result is `passed` or
`failed`. Adapter exceptions become operation or gate failures in the receipt, allowing the
caller to report durable state rather than losing the resume boundary.

Operations never overlap. An operation runs only after every declared dependency is
completed with a passed gate. A failed operation skips its gate; a failed gate marks the
operation failed. Either failure blocks every later operation in the ordered workflow.

## Receipt and resume behavior

The `starci/solo-execution-receipt@1` receipt records:

- the host, workflow ID, and a digest of the worktree/operation/gate definition;
- the one isolated worktree descriptor;
- workflow status, `currentOperation`, and `resumeCursor`;
- each operation's dependencies, state, attempt count, result, and explicit gate state.

Operation states are `pending`, `running`, `paused`, `gating`, `completed`, `failed`, and
`blocked`. Gate states are `pending`, `evaluating`, `passed`, `failed`, `skipped`, and
`blocked`.

Pass the returned receipt back unchanged to resume. The runner validates the host, workflow,
definition, dependency completion, and passed gates before entering the worktree. Completed
operations are skipped. A paused operation alone is invoked again with its stored cursor.
Blocked, failed, and completed receipts are terminal snapshots and cause no operation calls.
Changing the workflow definition requires a new run; it is never treated as a safe resume.

## Orca boundary

The solo host refuses host-native subagent or team orchestration. A declared parallel need or
more than one writer also cannot be reduced to serial calls because that would hide ownership
and conflict semantics. These declarations return a receipt with `status: "requiresOrca"`
before worktree entry:

- `nativeOrchestration`, `subagents`, or `team` set to `true`;
- `parallel`, `requiresParallel`, or `mode: "parallel"`;
- `requiresMultipleWriters`, or more than one distinct `writers`/`writeOwners` entry.

The caller should then route the unchanged workflow through Orca's supervised orchestration.
The solo module itself never launches agents or coordinates multiple writers.

## Pure testing

Tests use in-memory adapters that record calls and return synthetic descriptors and results.
No test needs to create, remove, or inspect a real repository or worktree. Production hosts
remain responsible for implementing the same adapter contract using their authorized
worktree and operation mechanisms.
