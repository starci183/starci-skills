# Orca Orchestration

For the owner's chat only. The `[Kernel]` and `[Op]` agents never run these commands; they call `scripts/kernel/cli.mjs` or `scripts/api/orca/*.mjs`.

Every agent is started with `orchestration worker-start --agent <provider> [--model <id> --effort <level>]` - the
StarCi Kernel, Supervisor, [Worker]s and [Op]s included (runtime contract
`.claude/modules/kernel/start-workflow.yaml`). Never launch an agent with
`terminal create`, never hand a pre-made terminal to `worker-start --terminal`, and never `dispatch --inject` a Task
into a terminal you made. Supervise with `worker-show`, `worker-read`, `worker-stop` and `worker-release`.

Nested Runs: an agent that starts agents (the Kernel starting its [Op]s) binds its OWN Run with
`run-create --from <its terminal>`, files each Task there and starts it with `worker-start --task --run --from <its
terminal>`. Never pass `--parent`: Orca takes a parent only from the same Run, and a Task in the Run the agent is
a worker of is refused `consumer_fenced`.

Worktrees: before a StarCi Kernel starts, the runtime has Orca create the ONE worktree of that workflow (`worktree create
--name wf-<workflowId> --base-branch main --setup run`, a real `npm ci`, no junctions) and starts the Kernel with
`worker-start --worktree <its path>`; the workflow branch is Orca's `wf-<workflowId>`; its
[Op]s start with `--worktree <that worktree>` and never get a worktree of their own. The workflow's finish marks it
release-pending and the runtime's host-side controller removes it once its terminals are released (link check first);
never remove it, nor run `git worktree remove`, from this chat.

The usage guide is served by the `orca` binary itself (see shared setup below). Host/worktree operations
use `orca-cli.md`; visible OS inspection uses `computer-use.md`. Coordination requires real Orca runtime state; never substitute
a non-Orca subagent tool.

## Shared Orca setup

Before any Orca command, follow [CLI resolution and fallback](orca-cli.md#resolve-the-cli-once)
and [version-matched guide rules](orca-cli.md#load-the-version-matched-guide-before-running-orca-commands).
Then load this procedure's guide:

```text
ORCA skills get orchestration
```

It covers the normal local coordinator loop. For a conditional action gate (remote placement,
uncertain release recovery, expanded DAG work) load only the reference that gate names:
`ORCA skills get orchestration --reference references/<file>.md` (`--references` lists them;
if `--reference` is rejected, use `--full` and read the named reference).
