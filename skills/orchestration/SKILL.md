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

The usage guide is served by the `orca` binary itself (below). Routing to `orca-cli` and Computer
Use is in the description above. Coordination requires real Orca runtime state; never substitute
a non-Orca subagent tool.

## Resolve the CLI once

Use the first that applies: `$ORCA_CLI_COMMAND` (managed WSL sessions); `orca-dev` when the session
exposes `ORCA_DEV_REPO_ROOT`; `orca-ide` on Linux outside an Orca terminal (bare `orca` there is the
GNOME screen reader); else `orca`. `ORCA` below is that executable, substituted literally — never a
shell variable. If it cannot run, report its exact error and stop; never fall through to another
executable.

## Load the version-matched guide before running Orca commands

```text
ORCA skills get orchestration
```

It covers the normal local coordinator loop. For a conditional action gate (remote placement,
uncertain release recovery, expanded DAG work) load only the reference that gate names:
`ORCA skills get orchestration --reference references/<file>.md` (`--references` lists them;
if `--reference` is rejected, use `--full` and read the named reference).

Prefer `--json`; use `--help` for anything the guide does not cover. If Orca is not running, run
`ORCA open --json` and retry. If `skills get` is unknown, say updating Orca restores the guide, use
`--help` for read-only discovery and never guess unsupported commands.
