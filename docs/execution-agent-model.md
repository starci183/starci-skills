# Execution agent model

StarCi 5.0 has three kinds of participant, and only one of them is an agent.

1. **Kernel (code).** One ordinary process owns the whole control loop: it freezes the approved goal,
   allocates a runtime per ready operation, launches operation agents, verifies their acceptance,
   commits, runs the gates and writes the final report. It is deterministic, it is the only writer of
   workflow state, and it never performs operation work.
2. **Model functions.** A model is called as a function with a typed form, never as a control loop.
   `assessGoal` turns a job into a definition of done, a ledger of required artifacts and the operation
   set. `planOp` turns one operation node plus its SDS material and prior reports into that operation's
   contract. `decide` chooses between enumerated options and returns the option with a rationale. Each
   answers one JSON object against a declared form; the process around it — provider, retries, waiting,
   reporting — is fixed by the runtime and is not the model's to change.
3. **Operation agents.** One agent executes exactly one operation contract inside the workflow worktree
   and ends with exactly one typed report. It does not schedule, supervise, re-plan, or create worktrees.

There is no Coordinator layer and no Workflow Manager layer. Those were agents asked to run a loop; the
loop is now code, so the layers are gone rather than reassigned.

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

A workflow is one approved goal, one branch, one worktree and up to ten concurrent operation agents
inside it. Concurrency comes from disjoint allowlists, not from repository layout: two operations may
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

Communication is one-directional and file-shaped. An operation reads its contract at launch and writes
one report; the kernel reads reports and writes state. Nothing is sent into a live agent's terminal, so
a fenced mailbox or a staged prompt cannot lose an instruction. A decision the kernel cannot take
mechanically goes to `decide`, or — when it changes the goal, scope, authority or safety envelope — back
to the user. No layer may substitute for or perform work owned by a lower layer.
