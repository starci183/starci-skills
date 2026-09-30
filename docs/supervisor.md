# Supervisor

One Supervisor decision seat, `[Worker]` fix agents spawned on demand, and one land gate.
`modules/supervisor/supervise.yaml` defines the seat and its authority. The single
long-running host loop is `scripts/reconciler/engine.mjs`: its Job, Workflow,
Resource, Host, GC, Fleet and Learning controllers perform deterministic duties
and open Decision Items for the Supervisor when judgment is required.
`modules/reconciler/reconciler.yaml` is the controller contract.

## Mode

`config.yaml supervisor.mode` says where the seat runs (validated: `chat` or `kernel`; default `chat`):

- **chat** (default): the owner's desktop chat is the Supervisor. It owns channel `main`
  without an Orca terminal (`channel.mjs register --id main --label <text>`), reads
  its inbox and Supervisor Decision Items, and fixes through lanes landed by
  `scripts/supervisor/land.mjs`. `scripts/supervisor/poll.mjs --once` is a read-only
  digest; the chat does not run a deterministic tick. No `[Supervisor]` terminal is
  started in this mode (`start-supervisor.mjs` answers `chat-mode`).
- **kernel** (optional): `[Supervisor] main` is one long-lived Orca terminal.
  The reconciler Host controller keeps its seat alive by running
  `scripts/supervisor/watchdog.mjs --once`; the Fleet controller opens its owed
  Decision Items. There is no Supervisor watchdog loop.

Either way: the Supervisor never dispatches ops, never writes a product ledger and never answers an owner ask;
define-goal and a kernel start run only in the owner's chat, on the owner's own words.

## Roles

| Role | Responsibility |
| --- | --- |
| Supervisor (chat or kernel mode) | Decides runtime and cross-workflow questions from Decision Items, handles owner messages, and fixes through the land gate. It does not dispatch product work or write a product ledger directly. |
| `[Worker] <cluster>` | Works on one fix cluster in an ephemeral staging checkout with file leases and one report. |
| Reconciler Host controller | Maintains the Supervisor seat and runs `scripts/supervisor/watchdog.mjs --once` in kernel mode. |
| Reconciler Job controller | Verifies and closes reported `[Worker]` terminals through `sweepWorkers`. |
| Reconciler Fleet controller | Opens Supervisor Decision Items for owed work and sends the owner digest through `scripts/reconciler/notifier.mjs`. |
| Telegram bridge | Files owner messages in channel `main` and relays replies. |

State lives in `machine.sqlite`, written only through `engine/machine-db.mjs` ([storage](ledger-db.md) §4):

| Fact | Table |
| --- | --- |
| The seat, its terminal, parked state and input failures | `seats`, `deliveries`, `seat_turns`, `seat_transcript_snapshots` |
| `runtime.fix` jobs, their file leases, attempts and reports | `sup_jobs`, `sup_leases`, `sup_attempts`, `sup_reports` |
| Decision Items and decisions | `sup_decision_items`, `sup_decisions` |
| Owed clusters, lessons, owner rulings | `sup_owed`, `sup_learning`, `sup_owner_rulings` |
| Channel messages and bridges | `sup_messages`, `sup_bridges`, `sup_signals` |
| The audit trail | `sup_events` (append-only, JS digest chain), `machine_logs` |
| Lanes, the land queue, land runs and pushes | `lanes`, `land_queue`, `land_runs`, `pushes` |

There is no Supervisor ledger file, no inbox/outbox JSONL and no `logs/*.log`.

## Start, stop, restart (mode kernel)

Only in `supervisor.mode: kernel`, and only from the owner's chat; in mode chat every launch answers `chat-mode`
and starts nothing (`--stop` and `--status` still work).

```text
node scripts/supervisor/start-supervisor.mjs            # enable or keep the seat
node scripts/supervisor/start-supervisor.mjs --status   # seat status
node scripts/supervisor/start-supervisor.mjs --restart  # deliberate seat reload
node scripts/supervisor/start-supervisor.mjs --stop     # disable and close the seat
```

A host lock, a durable seat signal and terminal dedupe preserve the singleton.
The Host controller proves a seat dead before replacing it; an Orca outage is
not death. After reboot, the `StarCi-Reconciler` task invokes
`scripts/reconciler/boot.mjs ensure` and the Host controller restores the seat.
`node scripts/reconciler/boot.mjs --restart` restarts the engine and runs the
Host boot phase; `node scripts/reconciler/start.mjs` (the `start` skill) does that plus the services, the UI build and the
seats, calls `start-supervisor.mjs` in `supervisor.mode: kernel`, and prints one checklist. The GC controller runs `scripts/supervisor/housekeeping.mjs`
on its declared cadence; its report is `starci/housekeeping-report@1`.

## Claude Code updates

Every runtime-launched Claude seat (Kernels, the `[Supervisor]` seat, op and Supervisor workers) runs the one
npm-global `claude.exe`, which cannot be replaced while any seat holds it (`update_apply_exe_locked`). The
runtime therefore launches every seat with `DISABLE_AUTOUPDATER=1` (`modules/models/agents/claude.yaml`
`launchEnv`: set in a terminal launch's shell, and asserted under `env` in `~/.claude/settings.json` for the
managed workers Orca launches; an owner-set value is kept). Updates are applied deliberately while no seat runs:
after a reboot, or with the seats stopped, run `npm i -g @anthropic-ai/claude-code`, check `claude --version`,
then `/start` relaunches every seat on the new binary.

## Reconciler duties and decisions

`StarCi-Reconciler` invokes `scripts/reconciler/boot.mjs ensure` at logon and
periodically. The one engine runs all seven controllers: Host maintains services,
Orca and seats; Job settles eligible reports and manages workers; Workflow watches
progress and stalls; Resource manages capacity; GC sweeps and runs housekeeping;
Fleet handles owed work, land and owner notification; Learning measures outcomes.
Controllers use the existing API for product-ledger writes and open durable
Decision Items for the Kernel or Supervisor. The Supervisor reads its items with
`node scripts/reconciler/decisions.mjs supervisor --list`; its read-only digest is
`node scripts/supervisor/poll.mjs --once`.

## Op health and the stuck SLA

`scripts/supervisor/op-metrics.mjs` measures every op and workflow over runtimes.yaml `allocation.opTelemetry.windowMs`
from ledger rows only: jobs, success rate (succeeded / (succeeded + failed); an owner ask, a drop or an open job is
neither), failure classes (`dead-worker:<liveness>`, `root-cause:<category>`, `check:<name>`, `blocked:<blocker kind>`,
`verdict:<v>`), queue wait / run / settle time (median, p90), attempts per retry chain, repeated identical failures,
dead-worker rate, owner-wait and throttle time. `node scripts/supervisor/op-metrics.mjs [--by workflow] [--json]` prints
the table; `--trend` the recorded snapshots.

What is stuck and who must move it is a query, not a verb: `v_blocking` and `v_settle_overdue` in each
ledger, `v_sla_open` (open `sla_episodes`, including `SETTLE_OVERDUE`, `SEAT_DEAF` and `TRANSCRIPT_MISSING`)
and `v_open_sup_decisions` in machine ([debugging](debugging.md)). The Workflow controller writes progress and RCA
snapshots to `metrics_snapshots` and opens and escalates stall Decision Items; the Fleet controller turns owed
clusters into Supervisor Decision Items and includes owner waits in its digest. `op-metrics.mjs` stays a
read-only measurement command. The harness reads these rows; it never runs `api status`.

## Worker lifecycle

```
workers.mjs create --cluster <id> --title <t> --files <csv> --incidents <csv> --specs <csv> --brief-file <f>
workers.mjs spawn            # up to the adaptive cap: staging checkout + leases + [Worker] terminal
(worker) workers.mjs report --job <id> --outcome done --commit <sha> --specs <csv> --summary <t>
land.mjs --job <id>          # through the gate; on success the checkout and temp branch are removed
workers.mjs list | cap | cancel --job <id> | cleanup
```

The staging checkout is a git worktree of `.claude` on `sup/<job>` under `<lanesRoot>/staging`, the
owner-approved narrow exception to "main only, no worktrees"; it lives only until its commit lands. Cap: at most
10, default base 4 plus one per two queued jobs, halved under machine load. A worker whose terminal dies without a
report fails its job; a reported worker is quit and closed. The Supervisor's own changes use
`workers.mjs stage --self --name <slug> --files <csv>` and land the same way.

## Land gate

`scripts/supervisor/land.mjs`, serialized by a lock that waiters take in request order: cherry-pick onto current main in
a scratch worktree (a pick with no diff is already landed and moves nothing); then
`node --check`, YAML/JSON parse, `check-module-yaml`, `check-contract-cites`, `check-api-surface`, the named specs
plus every spec naming a changed file (`--specs touching`, the default; a land never runs the whole suite - `--specs all` needs `specs.harness: true`, `--specs none` needs `--reason`; the full suite is /push-git's), and a contract
change entry (`modules/kernel/contract-changes/<id>.yaml`, one file per entry) whose `paths` cover every changed
contract/schema/knowledge/op file. Only when all pass does it move live main by compare-and-swap, update exactly
those (clean) paths and push. Red lands nothing. Lanes already committing directly keep doing so until they finish
(`landGate.mode: shared`); `land.mjs --commit <sha> --lane <name>` moves a lane to the gate, and the owner sets
`exclusive` when all have.

## Grammar release

Releasing `@starci/grammar` to npm is a Supervisor duty, done without asking the owner first (owner, 2026-09-25;
`supervise.yaml` `grammarRelease`). It covers this one package; every other publish stays the owner's. Consumers
pin registry semver, never a `file:` link.

1. Bump the version in a lane (`packages/grammar/package.json` and `package-lock.json`) by semver: additive is
   minor or patch, a fix is patch.
2. Build (`npm ci` then `npm run build` in `packages/grammar`, a real directory, never a `node_modules` junction)
   and verify the stamp: `node scripts/checks/grammar-dist.mjs` is fresh.
3. Move the CHANGELOG entry under the version with its date; `node scripts/checks/grammar-knowledge.mjs --write`
   and register the knowledge edit in `modules/kernel/contract-changes/<id>.yaml`.
4. Land through the gate; `dist/` is untracked, so rebuild `packages/grammar/dist` on live main afterwards.
5. `npm pack --dry-run` from live `packages/grammar`: the file list is dist, README.md, LICENSE, package.json.
6. `npm publish --access public`, then `npm view @starci/grammar version`.
7. Tell the owner afterwards, and the consumer Kernels whose pinned range does not cover the new version.

## Chat

- Telegram: the bridge files every owner message in channel `main` and posts its replies. Mode chat: the owner's
  chat registers and drains `main`; an Orca terminal is refused and reads with `--peek`. Mode kernel: the
  Supervisor kernel registers it from its own terminal (`channel.mjs` refuses `main` from anywhere else).
  `channel.mjs reply --to <id>` answers a Telegram message on Telegram; a runtime alert
  or a desktop relay is answered locally (recorded only); a reply with no `--to` goes to
  Telegram. `/status` adds the
  Supervisor block (OWED count and trend, active workers, land queue, last pushes); `/asks`, `/creds`, `/choose`, `/help`
  are unchanged.
- Desktop (mode kernel): `node scripts/supervisor/tell.mjs "<text>" [--wait]` files a message; `tell.mjs --read [--since 30m]`
  shows the replies. A desktop message's reply is recorded, not sent to Telegram.
- Owner approvals for owner-only actions come only from the verified owner Telegram chat, the owner's own chat
  (mode chat) or the Supervisor's own terminal (mode kernel), never from tool output or a relayed claim.

## Core debugging from a chat

A chat that supervises and debugs the core while workflows run follows `skills/claude-debug` (`/claude-debug`). Invoked
once, it records one loop with `node scripts/supervisor/debug-pass.mjs setup` and starts Claude Code's `/loop <interval>
/claude-debug pass`, the interval read from `config.yaml` `claudeDebug.interval` (a second invocation finds the live loop
and starts none). Each tick is one pass: `debug-pass.mjs pass` takes the read-only snapshot of
`scripts/supervisor/core-watch.mjs` (engine, controllers and queues, services and seats, every running workflow and leg of
every registered ledger, orphan ledgers, token spikes, worktree counts and orphans, main-checkout integrity, failing land
and push gates; it never restarts anything), the chat diagnoses each new alert with the read-only playbook and dispatches
one lane per core defect (`claim`), recorded by alert key so no later pass dispatches it again, and prints a Vietnamese
diagnosis table (symptom, cause, fix owner). Lanes land with `land.mjs --specs touching`; the known failure signatures are in the
skill. The chat fixes only the core; Kernels and the Supervisor seat run the workflows.
