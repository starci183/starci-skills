# Execution agent model

For explicitly enrolled 6.0 workflows, [the v6 contract](runtime-v6.md) replaces the 5-plus scheduling,
acceptance and provisional-decision details below. The kernel and supervisor remain programs. An explicitly
enrolled `agent-v1` workflow also has one bounded manager model function; other workflows retain their recorded policy.

StarCi 5-plus has three kinds of participant, and only one of them is an agent.

1. **Kernel (code).** One ordinary process owns the whole control loop: it freezes the approved goal,
   allocates a runtime per ready operation, launches operation agents, verifies their acceptance,
   commits, runs the gates and writes the final report. It is deterministic, it is the only writer of
   workflow state, and it never performs operation work.
2. **Model functions.** A model is called as a function with a typed form, never as a control loop.
   `assessGoal` turns a job into a definition of done, a ledger of required artifacts and the operation
   set. `critiqueGoal` objects to the goal itself before anyone works from it. `planOp` turns one operation
   node plus its SDS material and prior reports into that operation's contract. `decide` chooses between
   enumerated options and returns the option with a rationale. `validateOp` answers the one closed verdict
   on an accepted result. Each answers one JSON object against a declared form; the process around it —
   provider, retries, waiting, reporting — is fixed by the runtime (`models/functions.mjs`) and is not the
   model's to change.
3. **Operation agents.** One agent executes exactly one operation contract inside the workflow worktree
   and ends with exactly one typed report. It does not schedule, supervise, re-plan, or create worktrees.

There is no state-owning Coordinator or Workflow Manager layer. In agent-led v6, `manageWorkflow` is a
typed decision function over a bounded, digest-bound snapshot. It orders kernel-authored executable action
IDs and may request only listed opaque context references. The kernel alone persists the decision, rechecks
preconditions and executes actions. Owner choices, authority changes and evidence acceptance stay outside the manager.

The logical operation and its concrete runtime binding remain two things at one boundary: changing the
allocated runtime does not change the operation's goal, ownership, input, output or authority.
Provider-specific call forms stay canonical in `providers/codex/index.yaml`,
`providers/claude/index.yaml` and `providers/orca/index.yaml`. A runtime must use the declared mode and
call form instead of inferring a topology from a terminal, prompt or UI subtitle.

## Kernel-owned handoff

Before an operation starts, the kernel freezes a normalized input envelope:

```text
operation identity + goal + scope + capabilities
+ accepted dependency outputs
+ output contract + acceptance + checks
+ disjoint write allowlist
+ allocated runtime
```

After the agent stops, the kernel validates acceptance itself: it re-runs the operation's checks,
computes the changed files from git rather than trusting the report's list, refuses any file outside the
allowlist, and only then commits that operation and seals its output envelope. Dependents receive that
envelope, never the producing agent's hidden chat history. A relaunch may bind a new runtime to the same
logical operation; partial or unknown effects require reconciliation before any relaunch.

## One workflow, one worktree, a pool of operations

A workflow is one approved goal, one branch and one worktree. Enrolled manager calls and all other admitted
AI work share ten slots, so at most nine operation agents run while the manager holds one slot. Concurrency comes from disjoint allowlists, not from repository layout: two operations may
overlap precisely when they cannot write the same file. One operation instance is never divided among
several agents, and the ten-agent ceiling is not permission to shard one operation.

```text
workflow (one goal, one worktree)
├─ kernel process          allocate → launch → verify acceptance → commit → gate → report
├─ OP-1 → agent on runtime A   allowlist a/**
├─ OP-2 → agent on runtime B   allowlist b/**
├─ OP-3 → agent on runtime C   allowlist c/**
└─ verify OP-1 → agent on a runtime other than A
```

If OP-2 depends on OP-1, the kernel runs them in order. Every accepted slice is verified by an
operation allocated away from the runtime that produced it, so no model grades its own work.

## Hosts

The kernel is host-agnostic. A host supplies a working directory and a way to launch and attest an
agent; the allocator decides which runtime, and the workflow's state directory is identical either way.

- **Codex or Claude host.** The current session runs the kernel directly. Each ready operation opens one
  isolated background agent and closes it after acceptance.
- **Orca host.** Orca additionally supplies isolated worktrees and attested managed agents, so a
  workflow gets a clean worktree and each operation a branded, identity-proven agent. Orca is a provider
  of those two capabilities; it is not a second architecture, and no Orca supervisor agent exists.

Operation communication is one-directional and file-shaped. An operation reads its contract at launch and writes
one report; the kernel reads reports and writes state. Nothing is sent into a live agent's terminal, so
a fenced mailbox or a staged prompt cannot lose an instruction. The manager receives a safe semantic
projection rather than raw state, secret values or evidence bodies. A decision that changes the goal, scope,
authority, accepted product meaning or safety envelope goes to the owner. No participant may substitute for
or perform work owned by another participant.
