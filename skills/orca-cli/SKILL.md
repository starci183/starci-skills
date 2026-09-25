---
name: orca-cli
description: >-
  Operate Orca-managed worktrees, folder contexts, terminals, repos, automations, artifacts,
  skill sharing, worktree comments, and Orca's embedded browser through the `orca` CLI. Use
  when the user says "$orca-cli", "Orca worktree", "child worktree", "spawn codex/claude in a
  worktree", "read/wait/send Orca terminal", "handoff" / "handover" / "give this to another
  agent", "Orca browser", "orca artifacts", or "share skills". Prefer it over raw git
  worktree, ad hoc PTYs, or Computer Use when Orca state is involved. Use Computer Use only
  for external windows or desktop UI that needs OS-level control, and Playwright or CDP for
  external pages.
---

# Orca CLI

For the owner's chat only. The `[Kernel]` and `[Op]` agents never run these commands; they call `scripts/kernel/api.mjs` or `scripts/api/orca/*.mjs`.

## Resolve the CLI once

Use the first that applies: `$ORCA_CLI_COMMAND` (managed WSL sessions); `orca-dev` when the session
exposes `ORCA_DEV_REPO_ROOT`; `orca-ide` on Linux outside an Orca terminal (bare `orca` there is the
GNOME screen reader); else `orca`. `ORCA` below is that executable, substituted literally — never a
shell variable. If it cannot run, report its exact error and stop; never fall through to another
executable.

## Load the version-matched guide before running Orca commands

```text
ORCA skills get orca-cli
```

Prefer `--json`; use `--help` for anything the guide does not cover. If Orca is not running, run
`ORCA open --json` and retry. If `skills get` is unknown, say updating Orca restores the guide, use
`--help` for read-only discovery and never guess unsupported commands.
