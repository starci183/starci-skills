---
name: orchestration
description: >-
  Coordinate supervised Orca workers: threaded messages, blocking ask/reply,
  task dispatch, worker_done/escalation waits, task DAGs, decision gates,
  coordinator loops, and decomposing work across agents. Use `orca-cli` for full
  ownership handoffs — "hand off", "handoff", "handover", "give this to another
  agent", "another worktree" — unless asked to supervise, monitor, or coordinate
  a DAG, and for terminal control, lightweight terminal prompts, shell commands,
  Orca worktree management, and reading or waiting on terminals. Use Computer
  Use for external browser windows, webviews, Orca app UI, or desktop UI outside
  Orca's embedded browser only when the task requires OS/window-level control
  such as focus, menus, dialogs, coordinates, or screenshots. Use `orca-cli` for
  Orca's embedded pages and a page-automation tool such as Playwright or CDP for
  external pages.
---

# Orca Orchestration

For the owner's chat only. The `[Kernel]` and `[Op]` agents never run these commands; they call `scripts/kernel/api.mjs` or `scripts/api/orca/*.mjs`.

Every agent is started with `orchestration worker-start --agent <provider> [--model <id> --effort <level>]` - the
StarCi Kernel, Supervisor, [Worker]s and [Op]s included (runtime contract
`.claude/modules/kernel/contract-changes/launch-through-worker-start.yaml`). Never launch an agent with
`terminal create`, never hand a pre-made terminal to `worker-start --terminal`, and never `dispatch --inject` a Task
into a terminal you made. Supervise with `worker-show`, `worker-read`, `worker-stop` and `worker-release`.

The usage guide is served by the `orca` binary itself (see shared setup below). Routing to `orca-cli` and Computer
Use is in the description above. Coordination requires real Orca runtime state; never substitute
a non-Orca subagent tool.

## Shared Orca setup

Before any Orca command, follow [CLI resolution and fallback](../orca-cli/SKILL.md#resolve-the-cli-once)
and [version-matched guide rules](../orca-cli/SKILL.md#load-the-version-matched-guide-before-running-orca-commands).
Then load this skill's guide:

```text
ORCA skills get orchestration
```

It covers the normal local coordinator loop. For a conditional action gate (remote placement,
uncertain release recovery, expanded DAG work) load only the reference that gate names:
`ORCA skills get orchestration --reference references/<file>.md` (`--references` lists them;
if `--reference` is rejected, use `--full` and read the named reference).
