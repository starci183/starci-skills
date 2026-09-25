---
name: computer-use
description: >-
  OS/window-level inspection and input in visible local app windows through `orca computer`:
  native apps, external browser windows (Chrome, Edge, Safari), and app webviews. Not for
  Orca's embedded browser (use `orca-cli`) or page-only automation (use Playwright or CDP).
---

# Computer Use

For the owner's chat only. The `[Kernel]` and `[Op]` agents never run these commands; they call `scripts/kernel/api.mjs` or `scripts/api/orca/*.mjs`.

## Resolve the CLI once

Use the first that applies: `$ORCA_CLI_COMMAND` (managed WSL sessions); `orca-dev` when the session
exposes `ORCA_DEV_REPO_ROOT`; `orca-ide` on Linux outside an Orca terminal (bare `orca` there is the
GNOME screen reader); else `orca`. `ORCA` below is that executable, substituted literally — never a
shell variable. If it cannot run, report its exact error and stop; never fall through to another
executable.

## Load the version-matched guide before running Orca commands

```text
ORCA skills get computer-use
```

Prefer `--json`; use `--help` for anything the guide does not cover. If Orca is not running, run
`ORCA open --json` and retry. If `skills get` is unknown, say updating Orca restores the guide, use
`--help` for read-only discovery and never guess unsupported commands.
