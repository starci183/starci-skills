---
name: claude-debug
description: >-
  Supervise and debug the StarCi CORE (the .claude runtime, reconciler engine, services, harness UI, checkers) from a
  chat while workflows run: invoked once it starts one Claude Code `/loop <config claudeDebug.interval>` (never a second one); each
  tick is one pass (a read-only check of everything, diagnosis, one lane per new core alert, a Vietnamese diagnosis table), plus the fix
  loop through disjoint Claude Sonnet lanes landed through the gate, hard rules and the known failure signatures. Kernels and the
  Supervisor seat run the workflows; this chat only fixes the core. Use when the owner says claude-debug, "debug
  core", "monitor core", "fix core while a workflow runs", or runs /claude-debug. Owner-facing replies in Vietnamese.
user-invocable: true
---

# claude-debug

**Invoke once; it loops by itself.** `/claude-debug` (no argument) is the setup:

1. Run `node --no-warnings scripts/supervisor/debug-pass.mjs setup`. It reads the interval from `config.yaml`
   `claudeDebug.interval` (default in `config.example.yaml`; a missing block is refused with the line to copy, which the
   owner adds) and prints `{created, loop: {id, interval, ...}}`.
2. `{"created": false}`: a live loop already runs on this host (in this chat or another). Start nothing; tell the owner
   in Vietnamese which loop (`loop.id`, last pass) and stop here.
3. `{"created": true}`: start Claude Code's built-in loop with the loop skill: `/loop <loop.interval> /claude-debug pass`,
   using the printed `loop.interval` verbatim. That is the only scheduler; never write a watcher, a sleep loop or a
   Monitor stream instead.

`/claude-debug pass` is one tick (section 2): exactly one pass, then the turn ends. To stop, end the `/loop` and run
`node scripts/supervisor/debug-pass.mjs stop`.

Reply to the owner in Vietnamese; every file, commit and lane prompt is English.

## 1. Role

- The chat fixes ONLY the core: the `.claude` runtime, the reconciler engine, services, the harness UI, the checkers.
- Kernels and the `[Supervisor]` Orca seat run the workflows. This chat NEVER types into a Kernel terminal, never
  defers a leg, never steers, approves, cancels or re-plans a workflow, never answers an owner ask. A workflow
  defect is evidence to fix in the core (a lane), not something to work around in the workflow.
- Reading a Kernel screen is allowed (read only, section 3). Restarting the engine or the host is the owner's
  `/start`, not this chat's reflex.

## 2. One pass (`/claude-debug pass`)

Commands run from the runtime root (`.claude`). One pass, then stop:

1. `node --no-warnings scripts/supervisor/debug-pass.mjs pass` takes one read-only core snapshot
   of everything (`scripts/supervisor/core-watch.mjs --json` in process) and prints `{ok, loop, dispatched[], rows[]}`.
   It closes the fixes whose alert cleared and records every alert that has no open fix; `dispatched` lists only those
   new alerts, each with its default `fixOwner` (`owner` for an open owner ask or the owner's `config.yaml`, noted at
   once; `core` for everything else, reserved for a lane). An alert that already has a lane (or a note) is never in
   `dispatched` again, so a pass is idempotent.
2. Diagnose each `dispatched` core alert read-only with section 3 until you can name its cause.
3. A core defect: dispatch one lane (section 4), then
   `node scripts/supervisor/debug-pass.mjs claim --key <alert key> --lane <lane>`. Not a core defect (an owner ask, a
   workflow waiting normally): `node scripts/supervisor/debug-pass.mjs note --key <alert key> --reason "<why>"`. A lane that
   died or landed without clearing its alert: `release --key <alert key>` so the next pass dispatches it again. A
   reservation nobody claims or notes within 30 minutes is dispatched again.
4. Print a short diagnosis table in Vietnamese from `rows`, one row per alert: symptom (the alert text), cause (your
   diagnosis, or the recorded one for an alert already being fixed), fix owner (the `core` lane name, or the owner for
   `owner`), state (new, fixing, noted, resolved). Then end the turn.

`core-watch.mjs [--json]` alone prints the same snapshot for a manual look. Flags (both scripts): `--child-timeout <sec>`
(every child call is bounded, default 90), `--token-window <min>`, `--token-spike <n>` (0 disables). Facts (alert keys):

- `engine`: no leader, leader STALE (heartbeat > 90 s), SAFE MODE. `engine-controllers`: a controller configured active
  that runs shadow/off. `engine-queue`: failing queue items.
- `service:*`: harness-ui local and public `/healthz`, harness-tunnel, ask-gateway, ask-tunnel, telegram-bridge, orca,
  every seat not live.
- `wf:<ledger>:<workflow>:*` for every non-finished workflow of every registered active ledger (no hard-coded ids):
  `leg:<op>:<job>` turning failed/blocked/cancelled, `wedged`, `dead`, `stale`, `stuck`, `held`, `owner` (open owner
  asks), `status` (api status failed twice in a row within the snapshot).
- `tokens`: input+output tokens in the window above the spike limit, from `machine.sqlite` `llm_usage` (there is no
  `api usage` verb).
- `ledger:orphan:<id>`: a registered ledger whose state directory or every source root is gone.
- `worktrees:<repo>`: for the runtime and every active ledger's repo, more registered worktrees than
  `claudeDebug.worktreeLimit`, or a registered worktree whose directory is gone (prunable). A product repository's
  registered worktrees are workflow worktrees (kind `workflow`, one per Kernel workflow, keyed by Orca's worktree id,
  created by Orca with a real `npm ci` and no junctions); there is no per-op worktree. Read only; never prune from the
  pass.
- `integrity:tracked-deleted`, `integrity:node_modules`, `integrity:packages/node_modules`: the runtime's main checkout
  (first `git worktree list` entry) lost tracked files, or a node_modules directory is missing or empty (the signature of
  a worktree removed through a junction).
- `gate:land:<lane>`, `gate:push:<repo>`: in the last day, a lane whose latest land run did not pass, a repository whose
  latest push failed or was refused (`machine.sqlite` `land_runs`, `pushes`).
- `config:claudeDebug`: the `claudeDebug` block of `config.yaml` is missing or invalid (fix owner: the owner).
- `collector:<name>`: a collector crashed; the rest of the snapshot still counts.

State: `<StarCi state root>/claude-debug/state.json` (`%LOCALAPPDATA%/StarCi`, moved by `STARCI_LOCAL_ROOT`), holding the
loop record (live while it passed within 2 x interval + 5 min) and the open fixes keyed by alert key. The snapshot never
restarts, writes or dispatches anything. Auto-restart made the crash-loop safe mode worse; do not add it. An alert is a
trigger for section 3, not for a restart.

## 3. Diagnosis playbook (read only)

Open databases read-only (`new DatabaseSync(file, { readOnly: true })`, `PRAGMA query_only = ON`); never call an API verb
to look at state. Ledger files: `SELECT ledger_id, name, repo_root, file FROM ledgers` in `machine.sqlite`
(`%LOCALAPPDATA%/StarCi/machine.sqlite`). The ready queries are in [debugging](../../docs/debugging.md); start with
its `v_blocking`.

Ledger (`runtime.sqlite`):

- `op_attempts` (`verdict`, `failure_class`, `end_state`, `settle_json`, `head_sha`, `terminal_handle`): why a leg failed.
- `check_runs` (`name`, `status`, `exit_code`, `stdout_sha`, `stderr_sha`, `summary_json`): the failing check; the blobs
  are under `~/.starci/artifacts` (or `GET /api/blob/<sha256>` on the harness).
- `reports.report_json` (`blocker`, `open`): what the op said it could not do.
- `v_blocking`, `v_open_work`, `v_settle_overdue`, `v_timeline`: what is waiting on what.

Machine (`machine.sqlite`):

- `engine_actions` (`state`, `error_signature`, `stdout_sha`, `stderr_sha`, `exit_code`): what the engine tried and how it failed.
- `machine_logs` (`actor`, `controller`, `level`, `kind`, `msg`, `data_json`; FTS `machine_logs_fts`).
- `process_runs` (`start_reason`, `exit_reason`, `killed_by`, `heartbeat_age_at_end_ms`): engine starts, crash loops.
- `mode_changes` (who set which controller to which mode), `schedules` (`last_finished_at`, `last_result`, `running_pid`),
  `engine_leader` (`heartbeat_at`, `passes`, `last_pass_ms`, `last_error`).

Which controller blocks the engine thread: time each one alone (`--once` keeps its queue in memory and takes no live
engine's keys):

```
node scripts/reconciler/engine.mjs --once --controller job --json     # then host, workflow, resource, gc, fleet, learning
```

Compare wall time per controller; a controller that takes minutes on the engine thread starves the heartbeat. Do not
pass `--apply`.

Kernel screen (read only): `node scripts/api/orca/terminal-read.mjs --terminal <handle> --screen` (handle from
`op_attempts.terminal_handle`, `seats`, `terminals`). Never `terminal-send`.

Also: `node scripts/reconciler/boot.mjs --status`, `node scripts/reconciler/start.mjs --check`,
`node scripts/supervisor/poll.mjs --once --repo <repo>`.

## 4. Fix loop

1. Reproduce from evidence (section 3) and name the root cause; contain with the smallest lever (a controller `off` in
   `config.yaml`) only when the engine is being harmed, and record it.
2. One lane per disjoint file set. Worktree under `D:/starci-lanes/<lane>`:
   `git -C D:/Repositories/starci-academy-backend/.claude worktree add D:/starci-lanes/<lane> -b lane/<lane> origin/main`;
   junction `node_modules` (and package `node_modules`) with `cmd /c mklink /J`, copy `packages/grammar/dist` from the
   live checkout.
3. Spawn a Claude Sonnet agent per lane with a self-contained prompt: the evidence, the scope (files it may touch), the
   hard rules of section 5 verbatim, the deliverable (commit shas, touching-spec counts, `npm run check` exit 0, a
   report). Lanes never edit the same file.
4. Land as soon as a lane's touching specs are green; never hold a ready lane waiting for others (owner 2026-09-29:
   held lanes keep the kernels on the broken core and collide with each other). Commits that are ready at the same
   moment go in one land (each land re-execs the engine); a busy gate is the only reason to wait, and the land runs
   again the moment it is free:
   `node scripts/supervisor/land.mjs --commit <sha>[,<sha>...] --lane <lane> --specs touching --json`.
   Anything under `modules/`, `knowledge/` or a schema needs a `modules/kernel/contract-changes/<id>.yaml`.
5. Never push. Pushing is `/push-git`'s job (once it exists; reference it by name, never run `push-mains.mjs`).
6. After the land, the next passes (section 2) show the alert `resolved` once it clears; then report to the owner in
   Vietnamese: what broke, the root cause, the landed shas, what is still open.

## 5. Hard rules (verbatim in every lane prompt)

- No backward compatibility: every change removes the retired form entirely (code, config, docs, specs); no shim, alias,
  fallback or dual path.
- Specs: write or update specs for the code you change; run only the touching specs (`STARCI_SLEEP_SCALE=0.02 node --test
  <specs>`), never the full suite (the full suite runs only in `/push-git`). e2e is manual only.
- Never `git stash` (it is shared across worktrees). Never delete a `node_modules` junction recursively; remove it with
  `cmd /c rmdir <junction>`.
- Never `git worktree remove --force` a worktree with a node_modules junction inside; `cmd /c rmdir` the junction first (git
  deletes through junctions; the live node_modules was emptied twice on 2026-09-29).
- Live databases are read-only except through their runtime writers (`engine/ledger-db.mjs`, `engine/machine-db.mjs`);
  never edit `machine.sqlite` or a `runtime.sqlite` by hand.
- Every probe or debug script that creates a throwaway repo or ledger (a `repro`, a fake terminal, a one-off `api`/`kernel`
  call against a scratch checkout) must set `STARCI_LOCAL_ROOT` to a temp directory before it runs and remove/unset that
  env var when it exits, success or failure, so the probe's ledger and workflow rows land in the temp state root and
  never in the real `%LOCALAPPDATA%/StarCi` (`engine/machine-db.mjs` `starciLocalRoot`/`LOCAL_ROOT_ENV`, also honored by
  `engine/ledger-db.mjs` `projectsRootFor`). Incident 2026-09-30: probes under the OS temp dir (`probe-*`, `dbg-ask-*`,
  `dbg-env*`) left six fake-worker ledgers with workflows stuck `running` in the live store because they never set this.
  A probe that only needs the machine registry (not a project ledger too) may instead set the narrower
  `STARCI_TEST_MACHINE_FILE`; a probe that needs a specific ledger location without moving the whole state root may
  instead set `STARCI_PROJECTS_ROOT`. Verify before finishing: the probe's ledger id must not appear in
  `node engine/machine-db.mjs ledgers --file "$LOCALAPPDATA/StarCi/machine.sqlite"`.
- A standard, schema or rule set that has not been released is unversioned or version 1 in the runtime; never label runtime
  content as a second version before a first one has shipped (owner ruling 2026-09-29).
- Never push, never `--no-verify`, never rewrite landed history. The lane does not land; the lead lands.
- Report outcomes truthfully: what ran, its exit code and counts, what did not run and why.

## 6. Known failure signatures and first responses

| Signature | First response |
| --- | --- |
| A gc sweep in the engine thread: heartbeat STALE, then crash-loop SAFE MODE (`process_runs`, `engine_actions` of controller gc) | Set that controller `off` in `config.yaml`; fix the sweep in a lane (off the engine thread, bounded). |
| A declared check under a scratch path fails `TARGET_MISSING` at the settle re-run | The op declared a check on a scratch path; the op prompt must forbid it and the check must resolve inside the repo; fix in a lane, never re-settle by hand. |
| Kernel boot "did not render expected model" | The agent card lacks `modelAttestation.displayNames` for the pinned model; fix the card (`start.mjs --check` preflight names it). |
| Supervisor seat `selector_not_found` | The nested `.claude` repo is not an Orca worktree; the seat and worker launch must fall back to the registered host repo. |
| `LEDGER_CORRUPT` on a legacy store | Usually a false alarm for a legacy in-repo store; verify with `PRAGMA quick_check` on the registered file before acting; `start.mjs --retire-stale-ledgers` for temp/test paths. |
| `integrity:*`: tracked files deleted and `packages/node_modules` empty in the main checkout (2026-10-01: 490 files, nothing caught it) | A `git worktree remove` ran through a node_modules junction. Fix the remover in a lane (rmdir junctions first); restoring the checkout is the owner's call. |
| A workflow worktree left after its workflow finished, or a failed op's changes gone | The finish fast-forwards and pushes main, then marks the worktree `release-pending`; the host-side controller removes it once its terminals are released (link check, Orca's worktree removal, then `git branch -d`), so a `release-pending` row with a live terminal is expected and one without is a controller defect. A failed or blocked op's work is the ref `preserved/<workflowId>/<op>` and the tree was reset to the last checkpoint on `wf-<workflowId>`. Read the registry row (`machine.sqlite` `worktrees`, kind `workflow`) and the ref before acting; fix the runtime in a lane, never remove the tree by hand. |
| `push-mains.mjs` has no `--help` | Running it pushes. Never run it to see usage; read its source. |

Add a row here when a new signature is understood, with the evidence query that found it.
