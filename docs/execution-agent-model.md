# Execution agent model

StarCi separates five logical layers without requiring five processes:

1. **Plan** owns the accepted outcome, scope and workflow DAG.
2. **Coordinator** resolves decisions, conflicts, approvals and integration.
3. **Workflow wrapper** schedules dependency-safe operations, owns their handoffs and waits for their boundaries; it never performs operation work.
4. **Operation-wrapper agent** is the logical agent for exactly one operation instance.
5. **Concrete operation agent** is the provider/profile/model selected for that logical agent.

Only an operation is a mandatory isolation boundary. In solo mode, Plan, Coordinator and workflow
wrapper may be combined in the current Codex, Claude or Orca host session. In Orca orchestrated mode,
an external Codex or Claude session is bootstrap-only: it creates a persistent native Coordinator
agent in the Orca main worktree, hands off the Run/DAG, and leaves the control loop. The logical
operation and its concrete provider binding are two agent layers at the same boundary: changing the
concrete model does not change the operation's goal, ownership, input, output or authority.

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

Orca adds a persistent native Plan Coordinator agent in the main worktree above persistent native
Workflow Manager agents. The external initiating chat only bootstraps and hands off. The Coordinator
schedules the dependency DAG of related workflows and creates exactly one isolated child worktree per
workflow attempt. Each child runs exactly one Workflow Manager agent for that attempt. The manager
schedules its own operation DAG and opens exactly one isolated subagent per operation in that existing
workflow worktree. An operation subagent never creates a worktree and never manages the workflow.
The manager only decides, dispatches, retries, replaces and waits. Coding, repair, test execution and
operation output production belong to the operation agent. The parent Coordinator similarly waits for
normalized manager boundaries and never performs workflow-local or operation work.

```text
Orca main worktree
└─ [Coordinator] AgentOS Backend
   ├─ [Workflow] Core (child worktree)
   │  └─ [Monitor] Core
   │     └─ [Op] <operation> - Core
   ├─ [Workflow] Accounting (child worktree)
   │  └─ [Monitor] Accounting
   │     └─ [Op] <operation> - Accounting
   ├─ [Workflow] Chatbot (child worktree)
   │  └─ [Monitor] Chatbot
   │     └─ [Op] <operation> - Chatbot
   └─ [Workflow] Sales (child worktree)
      └─ [Monitor] Sales
         └─ [Op] <operation> - Sales
```

The parent exposes cross-workflow dependencies; each child wrapper exposes operation dependencies.
Independent operations in one workflow may overlap up to the three-agent ceiling. One operation still
maps to one subagent and cannot fan out. Related workflows use the Orca parent; an unrelated bounded
workflow should run solo instead of being attached to this Plan merely to gain concurrency. Orca
orchestrated mode owns conflict operations, provider-spanning chains and integration between workflow
worktrees.

Communication follows one chain of command: an operation talks only to its Workflow Manager, and the
manager talks to the parent Coordinator only for a normalized cross-workflow, shared-owner, authority,
human-decision, manager-failure or workflow-completion boundary. Module-local retries, safe approvals,
provider fallback, small fixes, focused test failures and architecture sidearms are resolved inside the
workflow without parent traffic. A Coordinator decision returns through the Workflow Manager, which
then resumes or replaces the operation. If the manager fails, the Coordinator recovers or replaces it;
it never bypasses the manager to control an operation directly.
No higher management layer may substitute for or perform work owned by a lower layer.
