# Solo execution

`execution/solo.mjs` hosts a fixed StarCi workflow inside the current Codex or Claude chat. The
chat may combine Plan, Coordinator and workflow-wrapper responsibilities. Each operation instance,
not the whole workflow, is the mandatory isolation boundary. See the shared
[execution agent model](execution-agent-model.md).

## Entry contract

Call `runSoloWorkflow({host, workflow, adapters, receipt})` with `host` equal to `codex` or
`claude`. A workflow has a stable ID, explicit dependencies and one gate per operation:

```js
const workflow = {
  id: 'implement-example',
  maxConcurrentOperationAgents: 3,
  operations: [
    {id: 'design', operation: 'architecture.decide', dependsOn: [], gate: {id: 'design-pass'}},
    {id: 'backend', operation: 'backend.implement', dependsOn: ['design'], gate: {id: 'checks-pass'}},
    {id: 'review', operation: 'review.verify', dependsOn: ['backend'], gate: {id: 'review-pass'}},
  ],
};
```

The runner validates the DAG before effects. It opens at most three dependency-safe operation
agents. The concurrency ceiling limits distinct operation instances; it never permits one
operation to fan out into several agents.

## Session and operation adapters

The host supplies the current chat session and the inline-agent implementation:

```js
const adapters = {
  session: {
    async current({requiredSession}) {
      return requiredSession ?? {id: 'current-chat', kind: 'chat-session'};
    },
  },
  operation: {
    async openAgent({operation, requiredAgent}) {
      return requiredAgent ?? {
        id: `agent-${operation.id}`,
        kind: 'inline-background-agent',
        isolated: true,
        operationId: operation.id,
      };
    },
    async run({agent, input, resumeCursor}) {
      return {status: 'completed', output: {result: 'bounded operation result'}};
    },
    async evaluateGate({agent, input, output}) {
      return {status: 'passed', observation: 'Operation contract passed'};
    },
    async closeAgent({agent, outcome}) {},
  },
};
```

One operation instance must retain one unique isolated agent identity. A paused operation resumes
that same agent. Reusing one agent for two operation instances or returning a non-isolated agent
fails closed.

## Normalized handoffs

The workflow wrapper creates `starci/operation-input@1` for every ready operation. It contains the
operation identity, goal, scope, capabilities, expected output, concrete agent binding and only the
sealed outputs of declared dependencies. The agent does not receive another operation's hidden chat.

On completion the wrapper creates `starci/operation-output@1`, evaluates the declared gate and stores
the sealed output in the receipt. A dependent operation cannot start until every required output is
present and passed. Provider fallback changes the concrete agent binding only; it does not alter the
logical operation contract.

## Scheduling and resume

Independent operations may run concurrently, up to three. Dependencies determine the waves, so a
design → implementation → review workflow remains sequential. A failed operation blocks only its
dependent branch; an unrelated branch may finish.

The `starci/solo-execution-receipt@2` receipt binds the host, current chat session, workflow digest,
three-agent ceiling, operation-agent identities, normalized input digests, outputs, gate states and
per-operation resume cursors. Completed operations never rerun. Resumption must use the same chat
session and the same agent for every paused operation.

## Orca boundary

The solo runner returns `requiresOrca` before opening a session when the request requires:

- more than three concurrent operation agents;
- several agents or shards inside one operation instance;
- dynamic worker creation or provider-spanning orchestration;
- child worktrees, conflict ownership or cross-worktree integration.

Orca may represent parallel modules as separate operation instances with separate child worktrees.
Codex and Claude solo hosts must not imitate that by hiding several workers behind one operation.
