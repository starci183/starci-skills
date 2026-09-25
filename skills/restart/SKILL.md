---
name: restart
description: >-
  Resume every StarCi workflow on this host after a machine reboot or an Orca restart: check Orca is
  up, run resume-all (connectors, Telegram bridge, watchdogs), wait for
  one live kernel per running workflow, settle orphan kernel jobs and the Orca Tasks of dead ops,
  count dead op workers, touch the supervisor channel and report in Vietnamese. Thin wrapper over
  .claude/scripts/kernel/restart-all.mjs. Use when the owner or supervisor says restart, resume
  after reboot, "khởi động lại", or runs /restart.
user-invocable: true
---

# restart

The owner or the supervisor runs this after the machine rebooted or Orca was
restarted. Every durable workflow lives in its ledger
(`<repo>/.starciwork/runtime.sqlite`); what a restart loses is the processes
around it. This skill brings them back and says what it did. It decides
nothing about any workflow and never approves anything on the owner's behalf:
a replacement kernel resumes its already-approved workflow by itself.

Executable: `.claude/scripts/kernel/restart-all.mjs` (spec:
`.claude/tests/restart-all.spec.mjs`). Ledgers: `config.yaml`
`supervisor.repos`, plus any `--repo`.

## Steps

1. Run the script from the source host (the directory holding `.claude/`):

   ```
   node .claude/scripts/kernel/restart-all.mjs --json [--supervisor <your channel id>]
   ```

   - Pass `--supervisor <id>` when a supervisor chat runs it (the id it
     registered with `scripts/supervisor/channel.mjs register`); add
     `--label <text>` to register a new one. Without it the registered
     supervisors are only listed (online/offline): a heartbeat for a chat that
     is not running would route the owner's Telegram messages to nobody.
   - `--dry-run` shows what would happen and changes nothing.
   - The script waits up to the restart window (runtimes.yaml
     `allocation.restart.waitMs`) for the watchdogs to relaunch or adopt the
     kernels (`--wait-ms <ms>` to change it). Run it in the background and
     let it finish.

2. Exit code 2 means Orca is not running. Tell the owner, in Vietnamese, to
   open Orca and run `/restart` again. Never launch Orca or any other GUI app
   yourself.

3. Otherwise print the `summary` field to the owner as it is (it is already
   Vietnamese and short). Then add only what needs the owner:
   - a workflow whose kernel did not come back (`kernels.kernels[]` with
     `live:false` or `duplicate`): name it and its state;
   - errors from the reconciles (`orphanKernelJobs[]` / `orcaTasks[]` with
     `ok:false`).
   Dead op workers are the kernels' to recover (`api reconcile
   --dead-worker`); only report their counts.

## What the script does

Verifies Orca answers, runs `resume-all.mjs` (connectors, Telegram bridge,
stall alert, one watchdog per running workflow; the stray-terminal dedupe runs
only on reboot evidence, `--no-dedupe` turns it off, and never touches a
session without a StarCi marker), waits for exactly one live kernel per
workflow, reconciles orphan kernel jobs and dead ops' Orca Tasks, counts dead
op workers, and heartbeats or lists the supervisor channels. Under the default
`supervisor.mode: chat` it starts no `[Supervisor]` kernel; under
`supervisor.mode: kernel` resume-all keeps an enabled seat's watchdog, which
relaunches a dead Supervisor. Never start one from this skill
(docs/supervisor.md).
