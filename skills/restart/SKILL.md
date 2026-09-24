---
name: restart
description: >-
  Resume every StarCi workflow on this host after a machine reboot or an Orca restart: check Orca is
  up, run resume-all with the stray-terminal dedupe (connectors, Telegram bridge, watchdogs), wait for
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
   - The script waits up to 8 minutes for the watchdogs to relaunch or adopt
     the kernels (`--wait-ms <ms>` to change it). Run it in the background and
     wait for it rather than cutting it short.

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

1. Orca must answer a terminal listing (it is never started from here).
2. `resume-all.mjs --dedupe`: the ask gateway and tunnel when
   `connectors.cloudflare` is on, the Telegram bridge, the stall alert, and
   one watchdog loop per running workflow. Before any watchdog starts, every
   terminal in the repos' worktrees that no ledger binds and that is a bare
   shell or a StarCi session Orca restored (`[Kernel]`/`[Op]`/`kernel`/
   `op-<kind>-<hex>`/qwen-code) is quit (Claude: double Ctrl+C) and closed
   with its tab. A session with no StarCi marker is the owner's own and is
   never touched.
3. Waits until each running workflow has exactly one live kernel (watchdog
   `--repair` relaunches it through `start-workflow.mjs`; a replacement
   kernel's prompt carries its launch authority and needs no go).
4. `api reconcile --orphan-kernel-jobs` (kernel jobs of finished or archived
   workflows) and `api reconcile --orca-tasks` (each workflow's Orca Run bound
   to its live kernel, open Tasks of dead ops closed) per ledger.
5. `api status` per workflow for the dead-worker counts.
6. Supervisor channel heartbeat or registration (`--supervisor`), else a
   listing of the registered supervisors.
7. The Supervisor (docs/supervisor.md). In `config.yaml supervisor.mode: chat`
   (the default) the owner's desktop chat is the Supervisor: restart starts no
   `[Supervisor]` kernel and no supervisor watchdog, and the summary says so
   (`- [Supervisor]: chế độ chat ...`). Never start one from this skill. Only in
   the optional `supervisor.mode: kernel` does resume-all keep the kernel's
   watchdog loop running while the seat is enabled; that loop relaunches a dead
   Supervisor (`scripts/supervisor/start-supervisor.mjs --replace`). A seat
   that was never started or was stopped (`start-supervisor.mjs --stop`) is
   left down: the owner starts it from their own chat,
   `node .claude/scripts/supervisor/start-supervisor.mjs`; to reload it after a
   contract change, `start-supervisor.mjs --restart`.
