---
name: start
description: >-
  Bring EVERYTHING on this host up in one command and print ONE green/red checklist: preflight, the reconciler
  engine with its operational controller profile, the harness UI (rebuilt when its sources are newer), tunnels and
  connectors, the Supervisor seat and the Kernel seat of every already-running workflow. It never defines or starts a
  new workflow. Thin wrapper over .claude/scripts/reconciler/start.mjs. Use when the owner or supervisor says start,
  "khởi động", "bật hết", after a reboot or an Orca restart, or runs /start (/restart is the same command).
user-invocable: true
---

# start

The owner or the supervisor runs this to make the host fully operational. Every durable workflow lives in its ledger
(`%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite`); what a reboot or a bad day loses is the processes around
it. `start` brings them back and shows, in one list, what is green and what is red. It decides nothing about any
workflow and never approves anything on the owner's behalf: a replacement Kernel resumes its already-approved workflow
by itself. It never defines a goal and never starts a new workflow (that is `define-goal` / `start-kernel`).

Executable: `.claude/scripts/reconciler/start.mjs` (also `node .claude/scripts/reconciler/boot.mjs up`).

## Steps

1. From the source host (the directory holding `.claude/`):

   ```
   node .claude/scripts/reconciler/start.mjs            # bring everything up, then the checklist (exit 0 = all required green)
   node .claude/scripts/reconciler/start.mjs --check    # the checklist only, changes nothing
   node .claude/scripts/reconciler/start.mjs --json     # the same, machine readable
   ```

   Flags: `--wait <sec>` (how long to re-read until green, default 120), `--no-apply-profile` (validate, do not edit
   config.yaml), `--no-build` (skip the ui/dist rebuild), `--retire-stale-ledgers` (retire registered ledgers whose
   path is a temp/test path, through the machine-db API).

2. What an apply run does, in order: preflight (Node bundles SQLite >= 3.51.3; machine.sqlite quick_check; temp/test or
   missing registered ledgers; legacy in-repo `.starciwork/runtime.sqlite`; kernel/supervisor pins whose model the agent
   card cannot attest; Orca reachable) -> applies `reconciler.profile: operational` to config.yaml (job, host, workflow,
   resource active; gc, fleet, learning shadow; the old file is saved as `config.yaml.bak-<time>`) -> rebuilds `ui/dist`
   when a ui source is newer -> starts the reconciler engine (restarts it out of `--safe` when no real crash loop is on
   record) -> starts every service that is down -> the Supervisor seat (`supervisor.mode: kernel` only) and every running
   workflow's Kernel seat.

3. If Orca is not running, tell the owner, in Vietnamese, to open Orca and run `/start` again. Never launch Orca or any
   other GUI app yourself.

4. Report to the owner in Vietnamese, from the checklist, in this shape: one line "XANH" or "ĐỎ" for the whole host, then
   every RED row with its one-line fix (copy `fix:`), then the WARN rows in a few words, then the leader and its
   heartbeat age, the mode of each controller, the services (harness UI local and public, tunnel, Telegram, ask gateway),
   the Supervisor seat and every Kernel seat that is not live. Dead op workers are the Job controller's to recover; only
   report counts. Do not run the fixes yourself except `start` again; a red config, build or Orca item is the owner's
   or the lane's to act on.

`/restart` is the same command (see `skills/restart`); `node .claude/scripts/reconciler/boot.mjs --restart` remains the
lever that only restarts the engine.
