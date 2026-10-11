Owner: modules/supervisor/
# Supervisor

One Supervisor decision seat. It answers a menu of judgment points and changes no runtime code.
`modules/supervisor/supervise.yaml` defines the seat and its authority; `modules/supervisor/supervisor-menu.yaml` defines the menu. The single
long-running host loop is `scripts/reconciler/engine.mjs`: its Job, Workflow,
Resource, Host, GC, Workers and Learning controllers perform deterministic duties
and open Decision Items for the Supervisor when judgment is required.
`modules/reconciler/reconciler.yaml` is the controller contract.

## Mode

`config.yaml supervisor.mode` says where the seat runs (validated: `chat` or `kernel`; default `chat`):

- **chat** (default): the owner's desktop chat is the Supervisor. It owns channel `main`
  without an Orca terminal (`channel.mjs register --id main --label <text>`), reads
  its inbox and its menu, and answers the menu with `starci supervisor decide`. `scripts/supervisor/poll.mjs --once` is a read-only
  digest; the chat does not run a deterministic tick. No `[Supervisor]` terminal is
  started in this mode (`start-supervisor.mjs` answers `chat-mode`).
- **kernel** (optional): `[Supervisor] main` is one long-lived Orca terminal.
  The reconciler Host controller keeps its seat alive by running
  `scripts/supervisor/supervisor-watchdog.mjs --once`; the Workers controller opens its owed
  Decision Items. There is no Supervisor watchdog loop.

Either way: the Supervisor never dispatches ops, never writes a product ledger and never answers an owner ask;
define-goal and a kernel start run only in the owner's chat, on the owner's own words.

## The menu

`starci supervisor status --json` prints `menu[]`: one item per live Decision Item the Supervisor decides, with the typed choices
that answer it. `starci supervisor decide --item <id> --choice <choice> --reason <why> [--text <input>]` validates the choice
against the current menu, records it as a Supervisor action, runs the choice's steps as the `starci` verbs they name and closes the
item. A choice off the menu is refused with the menu.

| Kind | Items | Choices |
| --- | --- | --- |
| `gate-ruling` | a supervisor-gate a Kernel raised | `fixed` (commit), `workaround` (pool), `not-runtime-fault`, `record-defect` |
| `workflow-conflict` | cross-workflow, deadlock | `rule`, `prioritize` |
| `resource-division` | cap-starved, quota-exhausted | `prioritize`, `rule` |
| `kernel-escape` | a Kernel item escalated, a Kernel menu with no fitting option | `rule`, `record-defect` |
| `runtime-defect` | every other Supervisor item | `record-defect` |

Every item also carries `none-fits`, which records the reason and hands the item to the owner. The guard of the Supervisor seat
(`modules/kernel/command-policy.yaml`, `supervisor`) allows the reads, `starci supervisor decide`,
`starci supervisor actions record --item runtime-defect:<cause>`, the owner channel and the collectors the Supervisor owns; any other
call is refused with the menu and the spelling of the decision verb.

## Roles

| Role | Responsibility |
| --- | --- |
| Supervisor (chat or kernel mode) | Decides gate rulings, conflicts between workflows and the division of shared resources from its menu, records runtime defects for Debug, and handles owner messages. It changes no runtime code, dispatches no product work and writes no product ledger. |
| Debug | Fixes the recorded runtime defects in `.claude` with a spec. |
| Reconciler Host controller | Maintains the Supervisor seat and runs `scripts/supervisor/supervisor-watchdog.mjs --once` in kernel mode. |
| Reconciler Job controller | Settles reports and reconciles dead workers. |
| Reconciler Workers controller | Opens Supervisor Decision Items for owed work and sends the owner digest through `scripts/reconciler/notifier.mjs`. |
| Telegram bridge | Files owner messages in channel `main` and relays replies. |

State lives in `machine.sqlite`, written only through `engine/db/machine.mjs` ([storage](ledger-db.md) §4):

| Fact | Table |
| --- | --- |
| The seat, its terminal, parked state and input failures | `seats`, `deliveries`, `seat_turns`, `seat_transcript_snapshots` |
| Worker records of earlier fix jobs, read-only | `sup_jobs`, `sup_leases`, `sup_attempts`, `sup_reports` |
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

## Land gate

The land gate serves the lead, the coordinator and the owner; the Supervisor lands nothing on the runtime (`RUNTIME_CHANGE_OWNED_BY_DEBUG`).
A change that loosens a gate (a check removed from a gate file's list, a floor lowered or a ceiling raised there, an allowlist entry added, a spec deleted, weakened or skipped together with product code: `modules/kernel/gate-loosening.yaml`) is owner-class: the gate refuses it as `gate-loosening` and the `gate-loosening` self-check flags it, unless the tree it is judged against already holds the owner's `owner-rulings.yaml` entry `gate-loosening-<fingerprint>` for exactly that loosening.
`scripts/supervisor/land.mjs`, serialized by a lock that waiters take in request order: cherry-pick onto current main in
a scratch worktree (a pick with no diff is already landed and moves nothing); then
`node --check`, YAML/JSON parse, `check-module-yaml`, `check-contract-cites`, `check-cli-parity`, the named specs
plus the specs that can see the change (`--specs touching`, the default: the named specs, the specs importing or reading a changed file, the specs that spawn the CLI entry of a verb whose handler reaches a changed file and name that verb (the verbs importing a changed file themselves, then the nearest others up to `allocation.landGate.cliVerbs`), the tree-wide invariant specs and a smoke set of at most 24 specs reaching it only through the import graph; `--specs direct` is the same without the smoke set; a land never runs the whole suite - `--specs all` needs `specs.harness: true`, `--specs none` needs `--reason`; the full suite is /starci release's). Current contract and native package/proof checks refuse red or unavailable evidence. Every child of the gate runs with `STARCI_RUNTIME` set to the scratch tree it verifies, never the per-user runtime record. The gate holds no host lock: lands serialize on the land queue. Only when all pass does it take the host lock (purpose `land`, waited for up to 10 minutes, then refused as `host-lock-held` naming the holder), move live main by compare-and-swap, update exactly
those (clean) paths - each swapped in atomically by rename of a fully written temp (checkout-paths.mjs), so a reader mid-update never opens a partial file); the lock is released then, so a dependency install (`starci npm ci`, a staging checkout) is never starved for the length of a gate. A land runs up to 30 minutes: start it in the background (a shell `timeout` kills it, cancels its ticket and loses the run) and read `land.mjs --status`. Red lands nothing. Lanes already committing directly keep doing so until they finish
(`landGate.mode: shared`). A land ends at the fast-forward of local main and never pushes: the remote main of the runtime moves once per release (`starci release cut`), the pre-push hook of the runtime repository refuses every other push of it, and push-mains covers product repositories only. `land.mjs --commit <sha> --lane <name>` moves a lane to the gate, and the owner sets
`exclusive` when all have.

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
- Token budget (provisional): 10000000 per wake; over it, the usage sweep cuts the Supervisor session at its supervisor-wake events and tags every supervisor-turn row with the wake that owns it; the digest reports a wake over the budget as a departure of the Supervisor (supervisor-wake-budget).
- Runtime changes (modules/kernel/revision-scope.yaml): woken once with exactly the changed files that concern it, it reads them and attests with starci supervisor revision-ack; a change that concerns it nothing costs it nothing; it is replaced by a fresh seat, at its next yield, only when a rule of its contract was removed or reversed or its boot prompt changed.
- Guard: its terminals are bound as the "supervisor" role of modules/kernel/command-policy.yaml.
- Happy errors it handles (the system working as designed, handled inside the chain through the policy):
  - gate-ruling (policy row supervisor-gate): a gate a Kernel raised: the Supervisor rules with fixed, workaround or not-runtime-fault (menu gate-ruling)
  - budget-gate (policy row budget-gate): a workflow cap exceeded holds dispatch: the Supervisor extends the budget or hands the matter to the owner
  - workflow-conflict (policy row peer-dependency): two workflows want the same files, ports or foundation: the Supervisor decides who goes first (menu workflow-conflict)
  - resource-division (policy row pool-full): provider capacity is shared by every workflow: the Supervisor divides it (menu resource-division)
  - runtime-defect (policy row runtime-defect): a suspected runtime defect: the Supervisor gives the Kernel a workaround and records the defect for Debug (menu runtime-defect)
  - kernel-escape (policy row menu-escape): a Kernel whose menu offered no fitting option escaped it with none-fits: the Supervisor answers with a ruling to the Kernel or records the defect for Debug (menu kernel-escape)
- A bug in this role (the chain neither fixes nor works around it; Debug removes it with a change to .claude) is detected by:
  - the Supervisor runs a command that is not a starci verb or a pure read: SUPERVISOR_STARCI_ONLY from the seat guard
  - the Supervisor uses a verb the runtime-driven menu replaces: SUPERVISOR_USE_DECIDE from the seat guard
  - the Supervisor changes .claude: RUNTIME_CHANGE_OWNED_BY_DEBUG from the command and file guards
  - a menu choice of the Supervisor fails to execute: SUPERVISOR_MENU_STEP_FAILED
  - a gate stands past its acknowledgement bound: gate-stale departure of the digest
  - a Supervisor wake spends more tokens than its wake budget: supervisor-wake-budget problem line of the digest
- Principles: P1 P3 P4 P5 P6 P7 P8 (modules/kernel/roles.yaml, principles).
<!-- roles:end supervisor -->
