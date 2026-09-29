---
name: claude-debug
description: >-
  Supervise and debug the StarCi CORE (the .claude runtime, reconciler engine, services, harness UI, checkers) from a
  chat while workflows run: a continuous read-only core watch, a read-only diagnosis playbook, a fix loop through
  disjoint Claude Sonnet lanes landed through the gate, hard rules and the known failure signatures. Kernels and the
  Supervisor seat run the workflows; this chat only fixes the core. Use when the owner says claude-debug, "debug
  core", "giám sát core", "sửa core khi workflow chạy", or runs /claude-debug. Owner-facing replies in Vietnamese.
user-invocable: true
---

# claude-debug

Reusable procedure for a chat that supervises and debugs the StarCi core while workflows run, so no chat writes an
ad-hoc watcher or one-off query script again. Reply to the owner in Vietnamese; every file, commit and lane prompt is
English.

## 1. Role

- The chat fixes ONLY the core: the `.claude` runtime, the reconciler engine, services, the harness UI, the checkers.
- Kernels and the `[Supervisor]` Orca seat run the workflows. This chat NEVER types into a Kernel terminal, never
  defers a leg, never steers, approves, cancels or re-plans a workflow, never answers an owner ask. A workflow
  defect is evidence to fix in the core (a lane), not something to work around in the workflow.
- Reading a Kernel screen is allowed (read only, section 3). Restarting the engine or the host is the owner's
  `/start`, not this chat's reflex.

## 2. Continuous core watch (read only, stdout lines only on change)

Start it once per chat as a Monitor stream:

```
node --no-warnings scripts/supervisor/core-watch.mjs                  # forever, one line per change, every 60 s
node --no-warnings scripts/supervisor/core-watch.mjs --once --json    # one snapshot {ok, alerts[]}
```

Flags: `--interval <sec>`, `--child-timeout <sec>` (every child call is bounded, default 90), `--token-window <min>`,
`--token-spike <n>` (0 disables). Lines are `ALERT <key>: <text>`, `OK <key> (was ...)` and `GONE <key>`. Facts:

- `engine`: no leader, leader STALE (heartbeat > 90 s), SAFE MODE. `engine-controllers`: a controller configured active
  that runs shadow/off. `engine-queue`: failing queue items.
- `service:*`: harness-ui local and public `/healthz`, harness-tunnel, ask-gateway, ask-tunnel, telegram-bridge, orca,
  every seat not live.
- `wf:<ledger>:<workflow>:*` for every non-finished workflow of every registered active ledger (no hard-coded ids):
  `leg:<op>:<job>` turning failed/blocked/cancelled, `wedged`, `dead`, `stale`, `stuck`, `held`, `owner` (open owner
  asks), `status` (api status failed twice in a row).
- `tokens`: input+output tokens in the window above the spike limit, from `machine.sqlite` `llm_usage` (there is no
  `api usage` verb).

The watcher never restarts, writes or dispatches anything. Auto-restart made the crash-loop safe mode worse; do not
add it. An ALERT is a trigger for section 3, not for a restart.

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
4. Land, from the live checkout, batching several commits per land because each land re-execs the engine:
   `node scripts/supervisor/land.mjs --commit <sha>[,<sha>...] --lane <lane> --specs touching --json`.
   Anything under `modules/`, `knowledge/` or a schema needs a `modules/kernel/contract-changes/<id>.yaml`.
5. Never push. Pushing is `/push-git`'s job (once it exists; reference it by name, never run `push-mains.mjs`).
6. After the land, watch the stream (section 2) until the alert clears, then report to the owner in Vietnamese: what
   broke, the root cause, the landed shas, what is still open.

## 5. Hard rules (verbatim in every lane prompt)

- No backward compatibility: every change removes the retired form entirely (code, config, docs, specs); no shim, alias,
  fallback or dual path.
- Specs: write or update specs for the code you change; run only the touching specs (`STARCI_SLEEP_SCALE=0.02 node --test
  <specs>`), never the full suite (the full suite runs only in `/push-git`). e2e is manual only.
- Never `git stash` (it is shared across worktrees). Never delete a `node_modules` junction recursively; remove it with
  `cmd /c rmdir <junction>`.
- Live databases are read-only except through their runtime writers (`engine/ledger-db.mjs`, `engine/machine-db.mjs`);
  never edit `machine.sqlite` or a `runtime.sqlite` by hand.
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
| `push-mains.mjs` has no `--help` | Running it pushes. Never run it to see usage; read its source. |

Add a row here when a new signature is understood, with the evidence query that found it.
