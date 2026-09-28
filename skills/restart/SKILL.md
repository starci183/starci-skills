---
name: restart
description: >-
  Bring every StarCi workflow on this host back after a machine reboot or an Orca restart by restarting the
  reconciler engine (the only runtime loop): its Host controller's boot phase waits for Orca, restarts the
  services, dedupes stray terminals, reconciles orphan kernel jobs and dead ops' Orca Tasks, then gives every
  running workflow its Kernel seat. Thin wrapper over .claude/scripts/reconciler/boot.mjs --restart. Use when the
  owner or supervisor says restart, resume after reboot, "khởi động lại", or runs /restart.
user-invocable: true
---

# restart

The owner or the supervisor runs this after the machine rebooted or Orca was restarted. Every durable workflow
lives in its ledger (`%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite`); what a restart loses is the processes around it. The
reconciler brings them back (DESIGN §7.7: the one way in after a reboot). It decides nothing about any workflow and
never approves anything on the owner's behalf: a replacement kernel resumes its already-approved workflow by itself.

Executable: `.claude/scripts/reconciler/boot.mjs`. Ledgers: `config.yaml` `supervisor.repos`
(`scripts/kernel/managed-repos.mjs`).

## Steps

1. From the source host (the directory holding `.claude/`):

   ```
   node .claude/scripts/reconciler/boot.mjs --restart
   node .claude/scripts/reconciler/boot.mjs --status --json
   ```

2. If Orca is not running, tell the owner, in Vietnamese, to open Orca and run `/restart` again. Never launch Orca
   or any other GUI app yourself.

3. Report to the owner in Vietnamese from `--status`: the leader and its heartbeat age, each controller's mode, the
   services, open violations, and every Kernel seat that is quarantined or not live. Dead op workers are the Job
   controller's to recover; only report their counts.
