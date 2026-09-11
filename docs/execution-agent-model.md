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

## Solo hosts

The current Codex, Claude or Orca session hosts one unrelated workflow. Each ready operation instance
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

Orca adds an outer Plan coordinator above the workflow wrappers. The parent schedules the dependency
DAG of related workflows and creates exactly one isolated child worktree per workflow attempt. A child
workflow wrapper then schedules its own operation DAG and opens exactly one isolated subagent per
operation in that existing workflow worktree. An operation subagent never creates a worktree.

```text
Orca parent: AgentOS backend Plan
├─ workflow child: Core backend
│  └─ ready operations → isolated subagents in the Core worktree
├─ workflow child: Accounting backend
│  └─ ready operations → isolated subagents in the Accounting worktree
├─ workflow child: Chatbot backend
│  └─ ready operations → isolated subagents in the Chatbot worktree
└─ workflow child: Sales backend
   └─ ready operations → isolated subagents in the Sales worktree
```

The parent exposes cross-workflow dependencies; each child wrapper exposes operation dependencies.
Independent operations in one workflow may overlap up to the three-agent ceiling. One operation still
maps to one subagent and cannot fan out. Related workflows use the Orca parent; an unrelated bounded
workflow should run solo instead of being attached to this Plan merely to gain concurrency. Orca
orchestrated mode owns conflict operations, provider-spanning chains and integration between workflow
worktrees.
