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

The `StarCi-Reconciler` task starts the one host engine through
`scripts/reconciler/boot.mjs ensure`. Its Host controller keeps the Kernel seat
alive by running `scripts/kernel/watchdog.mjs --once --repair` for the workflow.
That command is a single liveness pass: it reads ledger status and attested
terminal evidence, wakes a turn-idle Kernel when work is actionable, and replaces
a seat only after proving it dead or unwritable. There is no per-workflow
watchdog loop or fallback process.

The Job controller runs `scripts/reconcile/job-settle.mjs` for eligible green
reports, reconciles dead or held workers and dispatches ready work through the
existing API. A non-green report opens a `settle-nongreen` Decision Item; the
Kernel chooses its verdict. The Workflow controller opens progress and stall
Decision Items and re-parks asks. The Kernel reads its Decision Items first on
every wake, acts through `scripts/kernel/api.mjs`, then yields when nothing needs
a decision. See `modules/reconciler/reconciler.yaml` and
`modules/kernel/driver-loop.yaml` for the ownership split.

After a host restart, the Host controller's boot phase restores services and
Kernel seats. The Job controller reconciles dead or held workers. A filed
report is consumed; an attempt with no proven effect can return to queued;
evidence of an unknown effect is fenced for a Kernel decision. The ledger
preserves the plan, jobs and events across restarts.

## Kernel decision cycle — `modules/kernel/driver-loop.yaml`

The Kernel uses these API calls for its decisions. Controllers own green settlement,
worker recovery, ready dispatch and seat liveness:

| Step | Call | Why |
| --- | --- | --- |
| survey | `api survey --workflow <id>` | Open on the ledger, never on memory: goal revision + `opChain`, all jobs, inbox, signals, event tail, open incidents. |
| plan | `api plan --workflow <id> --file <plan.json>` | Persist the derived plan; the api stores its digest and the *structural* diff vs the approved `opChain`. Divergence → `incident --kind plan-divergence`; dispatch nothing on a divergent plan. |
| enqueue | `api enqueue --workflow <id> --op <opId> --paths <csv>` | One `queued` job row per planned op the queue lacks. An oversized semantic op is partitioned into bounded same-op jobs with `--cut-id/--cut-ordinal/--cut-total`; this does not change the approved plan. |
| drive | `api decisions --workflow <id>` then `api status` and an allowed decision verb | Claim and resolve non-green verdicts, worker questions, progress stalls and Supervisor rulings; use `--decision <id>` for the chosen action. Yield when no decision is executable. Job, Workflow and Host controllers continue their mechanical passes. |
| finish | `api finish --workflow <id>` | Last call. Refuses while any job is unsettled (`workflow-open-jobs`) or the owner has not approved the newest handover after the last business settle (`handover-not-approved`). |

The kernel decides the plan and its open Decision Items. It never decides scope, identity or
authority, never answers an `ask` itself, and never edits the ledger by hand.

## The verbs — `modules/kernel/api.yaml`

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
```

`modules/kernel/api.yaml` `commands:` and `modules/kernel/api-commands/<verb>.yaml`
together form the verb surface: one entry per verb naming what it reads, writes,
returns and refuses. New verbs use `scripts/kernel/api-verbs/<verb>.mjs`.
`scripts/checks/check-api-surface.mjs` checks both contract forms against the
core and extension code, and `api.mjs --help` prints each verb with its arguments.

Every write is one transaction + one hash-chained `events` row; every refusal
exits 1 with `{ok:false, reason}` where the reason string is the contract.
`observe` is read-only in every way that matters: it returns the exact worker
terminal's liveness plus a bounded screen tail as reasoning context and
appends only a compact `op-observed` receipt — an op's screen is never proof,
and only `api report` plus recorded `api check` rows support a verdict.

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
