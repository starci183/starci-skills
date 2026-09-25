# Workflow kernel

The kernel is **one long-lived logical LLM agent per workflow**. A provider
generation may return to its input prompt; the durable Kernel identity spans
those turn boundaries. It is not a scheduler process: it is an agent that reasons over ledger
projections and mutates state only through `scripts/kernel/api.mjs`. This page
is the map; the authoritative contracts are the YAML files it cites — when
they disagree with prose, the YAML wins.

## Lifecycle

```text
owner prompt
  → node scripts/goal/define-goal.mjs        workflows + goals(rev) + inbox rows
  → node scripts/kernel/start-workflow.mjs   claims the inbox row, spawns [Kernel] <workflow_id>
  → driver loop (below)                      until every job settled + final verify pass
  → api finish                               phase=finished; history preserved, never deleted
```

Kernel death is recoverable: re-running `start-workflow` with the same goal
spawns a *replacement* kernel (attempt+1, same workflow generation) — durable
plan, jobs and events survive agent churn. A `signals` singleton row enforces
one kernel per workflow in data, not by politeness. Contract:
`modules/kernel/start-workflow.yaml`.

For explicitly authorized unattended execution,
`scripts/kernel/watchdog.mjs` is the liveness supervisor. Every five minutes it
reads canonical status/survey and the attested terminal. It wakes the same
Kernel on `turn-idle`, or re-enters start-workflow only after exact
disconnected/unwritable proof. It never chooses, retries or settles Ops. The
Kernel processes immediately executable transitions and then yields when
durably waiting; it never uses shell sleep, timers, or an in-turn polling loop.
Normal Op completion does not wait for that cadence: `api report` commits the
report row and immediately wakes the same Kernel when its provider turn is at
the input prompt. The watchdog is the missed-event/disconnection fallback.

One watchdog loop runs per workflow (host lock `kernel-watchdog-<workflow>`; a second loop exits
`already-watched`). Each tick runs as a fresh `--once` child, and the loop itself never keeps stale code:
on every tick it compares the runtime's `git rev-parse HEAD` and the mtimes of the modules and cards it
loaded with what it started on, and its log against the rotation cap. On a change it spawns its replacement
with the same arguments (detached, hidden, appending to the same `watchdog-logs/<workflow>.log`, rotated first
when full), hands it the lock and exits
(`action=reloaded`, then `reload-took-over` from the new pid). At most one reload per five minutes; a
replacement that does not take the lock within 30 s is stopped and the old loop keeps running
(`reload-failed`). A landed runtime fix therefore reaches every watchdog without a manual restart
(`scripts/lib/self-reload.mjs`; the `[Supervisor]` watchdog and the Telegram bridge reload the same way).

A host shutdown loses every process but not the ledger, and a workflow resumes
like a saga. `scripts/kernel/resume-all.mjs` (run at logon and every ten
minutes by the scheduled tasks `--install-startup --apply` creates) starts one
`--repair` watchdog per running workflow that has none, once Orca is up. Each
watchdog relaunches its dead Kernel from the ledger. The Kernel's status then
reads `worker-dead` for every op whose terminal died, and
`api reconcile --job <id> --dead-worker` settles each one: a filed report is
consumed, checked and settled; an attempt with provably no effect goes back to
queued at the same attempt; one with any evidence of effect is fenced
`effect_unknown` for the Kernel to inspect and settle.

## The tick — `modules/kernel/driver-loop.yaml`

Each iteration, in order, expressed in api calls:

| Step | Call | Why |
| --- | --- | --- |
| survey | `api survey --workflow <id>` | Open on the ledger, never on memory: goal revision + `opChain`, all jobs, inbox, signals, event tail, open incidents. |
| plan | `api plan --workflow <id> --file <plan.json>` | Persist the derived plan; the api stores its digest and the *structural* diff vs the approved `opChain`. Divergence → `incident --kind plan-divergence`; dispatch nothing on a divergent plan. |
| enqueue | `api enqueue --workflow <id> --op <opId> --paths <csv>` | One `queued` job row per planned op the queue lacks. An oversized semantic op is partitioned into bounded same-op jobs with `--cut-id/--cut-ordinal/--cut-total`; this does not change the approved plan. |
| drive | `status → dispatch → durable wait/observe → nudge → settle → retry\|incident` | Launch only what is disjoint (paths) and admitted (leases/budgets); yield when no transition is executable and let the external watchdog own the cadence (`modules/models/runtimes.yaml` `allocation.watchdogCadenceMs`); observe a running op's screen on `allocation.observeCadenceMs` for context; nudge an exact `turn-idle` worker that owes a report; settle every arrived verdict before picking again; route retries inside the kind's budget, then escalate. |
| finish | `api finish --workflow <id>` | Last call. Refuses while any job is unsettled (`workflow-open-jobs`) or the owner has not approved the newest handover after the last business settle (`handover-not-approved`). |

The kernel decides order and assignment. It never decides scope, identity or
authority, never answers an `ask` itself, and never edits the ledger by hand.

## The verbs — `modules/kernel/api.yaml`

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` `commands:` is the verb surface: one entry per verb
naming what it reads, what it writes, what it returns and when it refuses.
`scripts/checks/check-api-surface.mjs` holds that block and `scripts/kernel/api.mjs`
in step, and `api.mjs --help` prints each verb with its arguments.

Every write is one transaction + one hash-chained `events` row; every refusal
exits 1 with `{ok:false, reason}` where the reason string is the contract.
`observe` is read-only in every way that matters: it returns the exact worker
terminal's liveness plus a bounded screen tail as reasoning context and
appends only a compact `op-observed` receipt — an op's screen is never proof,
and only `api report` plus kernel-run `api check` rows settle a verdict.

## Dispatch — `modules/kernel/dispatch.yaml`

`dispatch` reserves the lease + budget atomically, renders the packet and —
with `--spawn` — runs the terminal sequence itself through
`scripts/agent/lib.mjs` (readiness attested, packet delivered, submission
attested; agent flags injected from `modules/models/agents/<agent>.yaml`).
The packet is a bounded grant: one op, its brief (`modules/ops/ops/<op>.yaml`),
a closed read set, a closed write set (`owned_paths`), one model, one budget,
one lease token. Without `--spawn` it is a dry-run — the packet prints and
nothing is reserved. A spawn that does not land is `dispatch-rejected`: the
reservation is settled, never left leasing a ghost.

## Verdicts — `modules/kernel/verdict-contract.yaml`

Two layers, kept distinct: the op's **report outcome**
(`done|partial|failed|ask|blocked`, schema `starci/op-report@1`) is what the
agent claims; the kernel's **verdict** (`pass|fail|blocked`) is what the api
records after re-proof. `settle` validates the report file — identity binds
`{workflow_id, op_id, attempt, generation, lease_token}` exactly, files stay
inside `owned_paths`, and `pass` is recorded only after the op's declared
checks re-ran green on bytes computed from git. A refused settle
(`stale-lease-settle`, `out-of-scope-files`, `report-invalid`) is a routed
fact, never silent loss.

## What the kernel may not do

- Open `.starciwork/runtime.sqlite` or write any row directly — api only.
- Call the host (Orca) API or spawn terminals directly — `dispatch` owns host mechanics.
- Pick a model by taste — `scripts/route/route-model.mjs` resolves eligibility from `modules/models/selection.yaml`; owner `config.yaml` and an explicit `--agent` override in that order.
- Delete history — `finish` preserves goals/jobs/reports/events.
- Retry forever — routes carry per-kind limits; exhaustion is an `incident`, and identical evidence is not progress.

## Durable memory

The ledger is the kernel's memory: findings, plans and settlements are
persisted as `events` as they form — never hoarded in
context. Re-plans keep lineage (`replannedFrom`, blocker, path delta, routing
reason) so a replacement kernel reconstructs intent from rows, not from a
dead agent's transcript.
