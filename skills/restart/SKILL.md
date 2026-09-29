---
name: restart
description: >-
  Alias of the start skill: bring every StarCi service, the reconciler engine, the Supervisor seat and the Kernel seat
  of every running workflow back after a machine reboot or an Orca restart, and print one green/red checklist. Thin
  wrapper over .claude/scripts/reconciler/start.mjs (skills/start). Use when the owner or supervisor says restart,
  resume after reboot, "khởi động lại", or runs /restart.
user-invocable: true
---

# restart

`/restart` is `/start`: run the `start` skill (`skills/start/SKILL.md`) and report as it says.

```
node .claude/scripts/reconciler/start.mjs
```

Only the engine, without the services, the UI build and the seats: `node .claude/scripts/reconciler/boot.mjs --restart`
(an owner restart, a planned start that never counts toward the crash-loop guard). If Orca is not running, tell the
owner, in Vietnamese, to open Orca and run `/start` again; never launch Orca or any other GUI app yourself.
