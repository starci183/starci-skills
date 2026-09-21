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

## The tick — `modules/kernel/driver-loop.yaml`

Each iteration, in order, expressed in api calls:

| Step | Call | Why |
| --- | --- | --- |
| survey | `api survey --workflow <id>` | Open on the ledger, never on memory: goal revision + `opChain`, all jobs, inbox, signals, event tail, open incidents. |
| plan | `api plan --workflow <id> --file <plan.json>` | Persist the derived plan; the api stores its digest and the *structural* diff vs the approved `opChain`. Divergence → `incident --kind plan-divergence`; dispatch nothing on a divergent plan. |
| enqueue | `api enqueue --workflow <id> --op <opId> --paths <csv>` | One `queued` job row per planned op the queue lacks. An oversized semantic op is partitioned into bounded same-op jobs with `--cut-id/--cut-ordinal/--cut-total`; this does not change the approved plan. |
| drive | `status → dispatch → durable wait/observe → nudge → settle → retry\|incident` | Launch only what is disjoint (paths) and admitted (leases/budgets); yield when no transition is executable and let the external watchdog own the five-minute cadence; observe a running op's screen on a ~3-minute cadence for context; nudge an exact `turn-idle` worker that owes a report; settle every arrived verdict before picking again; route retries inside the kind's budget, then escalate. |
| finish | `api finish --workflow <id>` | Last call. Refuses while any job is unsettled (`jobs-unsettled`) or the final verify leg has not passed (`verify-open`). |

The kernel decides order and assignment. It never decides scope, identity or
authority, never answers an `ask` itself, and never edits the ledger by hand.

## The verbs — `modules/kernel/api.yaml`

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
survey   status                       reads: projections only
plan     --file <plan.json>           write: plan-derived event + structural diff
enqueue  --op <opId> --paths <csv> [--cut-id <id> --cut-ordinal <n> --cut-total <N>]
                                        write: queued job row / bounded same-op cut slice
dispatch --job <id> [--spawn] [--model <t>] [--worktree <sel>]
route    --job <id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
nudge    --job <id>               wakes the exact turn-idle worker; no new authority
observe  --job <id> [--lines <n>] read-only op-terminal screen tail; context, never evidence
op-contract --job <id>           worker reads its contracts row
report   --job <id> --report <file> [--outcome <o>]   files a starci/op-report@1 row
consume-report --job <id>        kernel marks the report integrated
check    --job <id> --checks '<json>'    kernel records its re-run
settle   --job <id> --verdict <pass|fail|blocked> [--report <path>]
incident --kind <k> --detail <s> [--op <opId>]
finish
```

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
nothing is reserved. A spawn that does not land is `spawn-failed`: the
reservation is settled, never left leasing a ghost.

## Verdicts — `modules/kernel/verdict-contract.yaml`

Two layers, kept distinct: the op's **report outcome**
(`done|partial|failed|ask|blocked`, schema `starci/op-report@1`) is what the
agent claims; the kernel's **verdict** (`pass|fail|blocked`) is what the api
records after re-proof. `settle` validates the report file — identity binds
`{workflow_id, op_id, attempt, generation, lease_token}` exactly, files stay
inside `owned_paths`, and `pass` is recorded only after the op's declared
checks re-ran green on bytes computed from git. A refused settle
(`stale-settlement`, `out-of-scope-files`, `report-invalid`) is a routed
fact, never silent loss.

## What the kernel may not do

- Open `.starciwork/runtime.sqlite` or write any row directly — api only.
- Call the host (Orca) API or spawn terminals directly — `dispatch` owns host mechanics.
- Pick a model by taste — `scripts/route/route-model.mjs` resolves eligibility from `modules/models/selection.yaml`; owner `config.yaml` and an explicit `--agent` override in that order.
- Delete history — `finish` preserves goals/jobs/reports/events.
- Retry forever — routes carry per-kind limits; exhaustion is an `incident`, and identical evidence is not progress.

## Durable memory

The ledger is the kernel's memory: findings, plans and settlements are
persisted as `events`/`state_snapshots` as they form — never hoarded in
context. Re-plans keep lineage (`replannedFrom`, blocker, path delta, routing
reason) so a replacement kernel reconstructs intent from rows, not from a
dead agent's transcript.
