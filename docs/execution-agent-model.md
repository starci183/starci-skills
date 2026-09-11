# Execution agent model

StarCi separates five logical layers without requiring five processes:

1. **Plan** owns the accepted outcome, scope and workflow DAG.
2. **Coordinator** resolves decisions, conflicts, approvals and integration.
3. **Workflow wrapper** schedules dependency-safe operations and owns their handoffs.
4. **Operation-wrapper agent** is the logical agent for exactly one operation instance.
5. **Concrete operation agent** is the provider/profile/model selected for that logical agent.

Plan, Coordinator and workflow wrapper may be combined in the current host session. Only an operation
is a mandatory isolation boundary. The logical operation and its concrete provider binding are two
agent layers at the same boundary: changing the concrete model does not change the operation's goal,
ownership, input, output or authority.

## Wrapper-owned handoff

Before an operation starts, the wrapper resolves dependencies and freezes a normalized input envelope:

```text
operation identity + goal + scope + capabilities
+ accepted dependency outputs
+ output contract
+ resolved provider/profile/model binding
```

After the agent stops, the wrapper validates the gate and seals a normalized output envelope. Dependents
receive that envelope, never the producing agent's hidden chat history. A no-effect fallback may bind a
new concrete agent to the same logical operation; partial or unknown effects require reconciliation.

## Codex and Claude solo hosts

The current Codex or Claude chat is the Plan/Coordinator/workflow session. Each ready operation instance
opens one isolated inline background agent and closes it after its gate. Up to three distinct operation
agents may be active when the fixed workflow DAG says they are independent. One operation instance may
not be divided among several agents, and the solo host cannot create child worktrees, dynamically fan out
work, span providers or integrate shared conflicts.

```text
current chat
└─ fixed workflow
   ├─ OP-1 → one inline background agent
   ├─ OP-2 → one inline background agent
   └─ OP-3 → one inline background agent
```

If OP-2 depends on OP-1, they run sequentially. Concurrency is permitted only between different ready
operation instances; the three-agent ceiling is not permission to shard one operation.

## Orca host

Orca represents every operation instance with one Task/Dispatch attempt and one isolated child worktree.
The workflow DAG may contain several instances of the same operator for separate owned scopes:

```text
Orca workflow
├─ OP-ACCOUNTING: backend.implement → child worktree A
├─ OP-CHATBOT: backend.implement   → child worktree B
└─ OP-SALES: backend.implement     → child worktree C
```

This is explicit workflow fan-out: three operation instances, not three workers hidden inside one
operation. Orca owns conflict workers, provider-spanning chains and integration between worktrees.
