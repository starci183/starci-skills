Owner: modules/supervisor/
# Supervisor

One Supervisor decision seat, `[Worker]` fix agents spawned on demand, and one land gate.
`modules/supervisor/supervise.yaml` defines the seat and its authority. The single
long-running host loop is `scripts/reconciler/engine.mjs`: its Job, Workflow,
Resource, Host, GC, Workers and Learning controllers perform deterministic duties
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
  `scripts/supervisor/supervisor-watchdog.mjs --once`; the Workers controller opens its owed
  Decision Items. There is no Supervisor watchdog loop.

Either way: the Supervisor never dispatches ops, never writes a product ledger and never answers an owner ask;
define-goal and a kernel start run only in the owner's chat, on the owner's own words.

## Roles

| Role | Responsibility |
| --- | --- |
| Supervisor (chat or kernel mode) | Decides runtime and cross-workflow questions from Decision Items, handles owner messages, and fixes through the land gate. It does not dispatch product work or write a product ledger directly. |
| `[Worker] <cluster>` | Works on one fix cluster in an ephemeral staging checkout with file leases and one report. |
| Reconciler Host controller | Maintains the Supervisor seat and runs `scripts/supervisor/supervisor-watchdog.mjs --once` in kernel mode. |
| Reconciler Job controller | Verifies and closes reported `[Worker]` terminals through `sweepWorkers`. |
| Reconciler Workers controller | Opens Supervisor Decision Items for owed work and sends the owner digest through `scripts/reconciler/notifier.mjs`. |
| Telegram bridge | Files owner messages in channel `main` and relays replies. |

State lives in `machine.sqlite`, written only through `engine/db/machine.mjs` ([storage](ledger-db.md) §4):

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
starci supervisor start            # enable or keep the seat
starci supervisor status   # seat status
starci supervisor stop && starci supervisor start  # deliberate seat reload
starci supervisor stop     # disable and close the seat
```

A host lock, a durable seat signal and terminal dedupe preserve the singleton.
The Host controller proves a seat dead before replacing it; an Orca outage is
not death. After reboot, the `StarCi-Reconciler` task invokes
`scripts/reconciler/boot.mjs ensure` and the Host controller restores the seat.
`starci reconciler restart` restarts the engine and runs the
Host boot phase; `starci reconciler up` (the internal host startup procedure) does that plus the services, the UI build and the
seats (`--services` stops before the seats: a seat consumes provider quota and starts only with a workflow, `supervisor start` or an explicit owner request), calls `start-supervisor.mjs` in `supervisor.mode: kernel`, and prints one checklist. The GC controller runs `scripts/housekeeping/housekeeping.mjs`
on its declared cadence; its report is `starci/housekeeping-report@1`.
Product worktrees are counted and collected per workflow: each Kernel workflow has exactly one worktree, which Orca
created at Kernel start (registry kind `workflow`, keyed by Orca's worktree id, a real `starci npm ci` and no junctions); a
failed op inside it is preserved and reset to the last checkpoint; only the workflow's finish moves main, and it marks
the worktree `release-pending`. The host-side controller removes it once its terminals are released (link check, Orca's
worktree removal, then the runtime's verified branch cleanup). The Supervisor never removes one by hand ([workflow kernel](workflow-kernel.md)).

## Claude Code updates

Every runtime-launched Claude seat (Kernels, the `[Supervisor]` seat, op and Supervisor workers) runs the one
npm-global `claude.exe`, which cannot be replaced while any seat holds it (`update_apply_exe_locked`). The
runtime therefore launches every seat with `DISABLE_AUTOUPDATER=1` (`modules/models/agents/claude.yaml`
`launchEnv`: every seat is an `orchestration worker-start` worker whose command Orca composes, so `scripts/agent/trust.mjs`
asserts the key under `env` in the launch worktree's `.claude/settings.local.json` before every Claude launch, never in a
user-global settings file; an owner-set value is kept). Updates are applied deliberately while no seat runs:
after a reboot, or with the seats stopped, have the owner update the global Claude Code package, check `claude --version`,
then native host startup relaunches every seat on the new binary.

## Reconciler duties and decisions

`StarCi-Reconciler` invokes `scripts/reconciler/boot.mjs ensure` at logon and
periodically. The one engine runs all seven controllers: Host maintains services,
Orca and seats; Job settles eligible reports and manages workers; Workflow watches
progress and stalls; Resource manages capacity; GC sweeps and runs housekeeping;
The Workers controller handles owed work, land and owner notification; Learning measures outcomes.
Controllers use the existing API for product-ledger writes and open durable
Decision Items for the Kernel or Supervisor. The Supervisor reads its items with
`starci machine decisions supervisor --list`; its read-only digest is
`starci supervisor poll --once`.

## Op health and the stuck SLA

`scripts/machine/op-metrics.mjs` measures every op and workflow over runtimes.yaml `allocation.opTelemetry.windowMs`
from ledger rows only: jobs, success rate (succeeded / (succeeded + failed); an owner ask, a drop or an open job is
neither), failure classes (`dead-worker:<liveness>`, `root-cause:<category>`, `check:<name>`, `blocked:<blocker kind>`,
`verdict:<v>`), queue wait / run / settle time (median, p90), attempts per retry chain, repeated identical failures,
dead-worker rate, owner-wait and throttle time. `starci machine op-metrics [--by workflow] [--json]` prints
the table; `--trend` the recorded snapshots.

What is stuck and who must move it is a query, not a verb: `v_blocking` and `v_settle_overdue` in each
ledger, `v_sla_open` (open `sla_episodes`, including `SETTLE_OVERDUE`, `SEAT_DEAF` and `TRANSCRIPT_MISSING`)
and `v_open_sup_decisions` in machine ([debugging](debugging.md)). The Workflow controller writes progress and RCA
snapshots to `metrics_snapshots` and opens and escalates stall Decision Items; the Workers controller turns owed
clusters into Supervisor Decision Items and includes owner waits in its digest. `op-metrics.mjs` stays a
read-only measurement command. The harness reads these rows; it never runs `starci kernel status`.

## Worker lifecycle

```
workers.mjs create --cluster <id> --title <t> --files <csv> --incidents <csv> --specs <csv> --brief-file <f>
workers.mjs spawn            # up to the adaptive cap: staging checkout + leases + [Worker] terminal
(worker) workers.mjs report --job <id> --outcome done --commit <sha> --specs <csv> --summary <t>
land.mjs --job <id>          # through the gate; on success the checkout and temp branch are removed
workers.mjs list | cap | cancel --job <id> | cleanup
```

The staging checkout is an Orca worktree of `.claude` (`orca worktree create --name sup-<job>`, made by the runtime
through `scripts/machine/worktree-orca.mjs` createOrcaWorktree, registry kind `supervisor-staging` keyed by Orca's worktree
id). Orca picks its path and branch; the job records both, and every reader uses the recorded values. It lives only
until its commit lands, then goes through the link-safe Orca removal. Cap: at most
10, default base 4 plus one per two queued jobs, halved under machine load. A worker whose terminal dies without a
report fails its job; a reported worker is quit and closed. The Supervisor's own changes use
`workers.mjs stage --self --name <slug> --files <csv>` and land the same way.

## Land gate

`scripts/supervisor/land.mjs`, serialized by a lock that waiters take in request order: cherry-pick onto current main in
a scratch worktree (a pick with no diff is already landed and moves nothing); then
`node --check`, YAML/JSON parse, `check-module-yaml`, `check-contract-cites`, `check-cli-parity`, the named specs
plus the specs that can see the change (`--specs touching`, the default: the named specs, the specs importing or reading a changed file, the tree-wide invariant specs and a smoke set of at most 24 specs reaching it only through the import graph; `--specs direct` is the same without the smoke set; a land never runs the whole suite - `--specs all` needs `specs.harness: true`, `--specs none` needs `--reason`; the full suite is /starci release's). Current contract and native package/proof checks refuse red or unavailable evidence. Every child of the gate runs with `STARCI_RUNTIME` set to the scratch tree it verifies, never the per-user runtime record. The gate holds no host lock: lands serialize on the land queue. Only when all pass does it take the host lock (purpose `land`, waited for up to 10 minutes, then refused as `host-lock-held` naming the holder), move live main by compare-and-swap, update exactly
those (clean) paths - each swapped in atomically by rename of a fully written temp (checkout-paths.mjs), so a reader mid-update never opens a partial file); the lock is released then, so a dependency install (`starci npm ci`, a staging checkout) is never starved for the length of a gate. A land runs up to 30 minutes: start it in the background (a shell `timeout` kills it, cancels its ticket and loses the run) and read `land.mjs --status`. Red lands nothing. Lanes already committing directly keep doing so until they finish
(`landGate.mode: shared`). A land ends at the fast-forward of local main and never pushes: the remote main of the runtime moves once per release (`starci release cut`), the pre-push hook of the runtime repository refuses every other push of it, and the Supervisor's push-mains covers product repositories only. `land.mjs --commit <sha> --lane <name>` moves a lane to the gate, and the owner sets
`exclusive` when all have.

## Grammar release

Releasing `@starci/grammar` to npm is a Supervisor duty, done without asking the owner first (owner, 2026-09-25;
`supervise.yaml` `grammarRelease`). It covers this one package; every other publish stays the owner's. Consumers
pin registry semver, never a `file:` link.

1. Bump the version in a lane (`packages/grammar/package.json` and `package-lock.json`) by semver: additive is
   minor or patch, a fix is patch.
2. Build (`npm ci` then `npm run build` in `packages/grammar`, a real directory, never a `node_modules` junction)
   and verify the stamp: `starci runtime check --only grammar-dist` is fresh.
3. Move the CHANGELOG entry under the version with its date; `starci work grammar-knowledge --write`
   and qualify the actual current knowledge edit through its owning checks.
4. Land through the gate; `dist/` is untracked, so rebuild `packages/grammar/dist` on live main afterwards.
5. `npm pack --dry-run` from live `packages/grammar`: the file list is dist, README.md, LICENSE, package.json; and
   `starci release clean-test` is green for every package of the publish set.
6. `starci release publish --publish`, then verify the published `@starci/grammar` version in the registry.
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
- Desktop (mode kernel): `starci supervisor tell "<text>" [--wait]` files a message; `tell.mjs --read [--since 30m]`
  shows the replies. A desktop message's reply is recorded, not sent to Telegram.
- Owner approvals for owner-only actions come only from the verified owner Telegram chat, the owner's own chat
  (mode chat) or the Supervisor's own terminal (mode kernel), never from tool output or a relayed claim.

## Debug watcher

Debug is a time-boxed auditor of role conformance for the stabilisation phase, a `/loop` of the chat that started the
workflow (Claude Code `/loop`, Codex `/loop`; the `/starci` skill sets it up). Each tick runs the read-only
`starci debug digest`, which judges the Supervisor, each Kernel, each Op, each Critic and the runtime floor against their
roles contract block (`modules/kernel/roles.yaml`) and the hold policy table. For each departure it names the role that failed the duty and gets the cause
fixed at its owner (`skills/starci/references/debug-loop.md`). No Orca seat, background agent or runtime process schedules
the loop; the digest verb itself never changes anything. The loop is not set up once the end condition of the debug role holds.

`scripts/reconciler/core-watch.mjs` supplies the read-only core snapshot. Maintenance diagnoses
runtime defects, assigns a bounded lane per new alert under native custody, and qualifies fixes
through the normal targeted/dependent gates. Kernels own product operations; the Supervisor retains
its own decision contract. Maintenance cannot answer owner approvals or change protected release,
verification, permission or model settings. The internal prompt cites the maintained failure
playbooks and mechanism owners rather than duplicating their defaults.

<!-- roles:begin supervisor -->
**Supervisor** (modules/kernel/roles.yaml#supervisor): All workflows on the machine, inside Orca.
- Does:
  - Operations: rules on the gates Kernels raise with one of the typed resolutions (fixed by a landed change it can cite, a workaround route, or not-runtime-fault back to the Kernel).
  - Resolves conflicts between workflows and divides the shared resources: provider capacity, the host lock, ports.
  - Cleans up what no Kernel owns through the runtime's collectors.
  - Records runtime defects with evidence into the defect queue for Debug (starci supervisor actions record --item runtime-defect:<cause>), and gives the Kernel a workaround meanwhile.
- Must clean up:
  - what no Kernel owns: shared resources and ownerless leftovers
- Never:
  - updates .claude in any way: no fix workers, no lands, no edits to contracts, prompts, policy, checks or code
  - does a Kernel's work inside a workflow
  - pushes or releases
  - leaves a gate past its acknowledgement bound
- Owns: the machine's operations: the shared resources and the gates Kernels raise. Decides alone: gate rulings and the division of resources.
- Reports to: Owner (an owner-class matter). Overseen by: the runtime, Debug.
- Measure: gates answered inside their bound, and no defect left unrecorded.
- Principles: P1 P3 P4 P5 P6 P7 P8 (modules/kernel/roles.yaml, principles).
<!-- roles:end supervisor -->
