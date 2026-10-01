---
name: computer-use
description: >-
  OS/window-level inspection and input in visible local app windows through `orca computer`:
  native apps, external browser windows (Chrome, Edge, Safari), and app webviews. Not for
  Orca's embedded browser (use `orca-cli`) or page-only automation (use Playwright or CDP).
---

# Computer Use

For the owner's chat only. The `[Kernel]` and `[Op]` agents never run these commands; they call `scripts/kernel/cli.mjs` or `scripts/api/orca/*.mjs`.

## Shared Orca setup

Before any Orca command, follow [CLI resolution and fallback](../orca-cli/SKILL.md#resolve-the-cli-once)
and [version-matched guide rules](../orca-cli/SKILL.md#load-the-version-matched-guide-before-running-orca-commands).
Then load this skill's guide:

```text
ORCA skills get computer-use
```
